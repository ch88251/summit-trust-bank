"""Transfers between a user's own accounts, deposits/withdrawals, payees, and bill payments."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..ledger import confirmation_number, get_owned_account, post_transaction, require_funds
from ..models import CashTransaction, Payee, Payment, Transfer, User
from ..schemas import (
    CashTransactionOut,
    CashTransactionRequest,
    PayeeIn,
    PayeeOut,
    PaymentOut,
    PaymentRequest,
    TransferOut,
    TransferRequest,
)
from ..security import get_current_user

router = APIRouter(prefix="/api", tags=["transfer & pay"])

MAX_DEPOSIT = Decimal("10000.00")


@router.get("/transfers", response_model=list[TransferOut])
def list_transfers(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Transfer).where(Transfer.user_id == user.id).order_by(Transfer.id.desc()).limit(50)
    return db.scalars(stmt).all()


@router.post("/transfers", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def create_transfer(body: TransferRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if body.from_account_id == body.to_account_id:
        raise HTTPException(status_code=400, detail="From and To accounts must be different")
    # Lock in id order to avoid deadlocks between concurrent opposite transfers.
    locked = {
        aid: get_owned_account(db, user, aid, for_update=True)
        for aid in sorted((body.from_account_id, body.to_account_id))
    }
    src, dst = locked[body.from_account_id], locked[body.to_account_id]
    require_funds(src, body.amount)

    note = f" - {body.memo}" if body.memo else ""
    post_transaction(db, src, -body.amount, f"Transfer to {dst.nickname} ...{dst.account_number[-4:]}{note}", "TRANSFER")
    post_transaction(db, dst, body.amount, f"Transfer from {src.nickname} ...{src.account_number[-4:]}{note}", "TRANSFER")
    transfer = Transfer(
        confirmation_number=confirmation_number("TRF"),
        user_id=user.id,
        from_account_id=src.id,
        to_account_id=dst.id,
        amount=body.amount,
        memo=body.memo,
    )
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return transfer


@router.get("/cash-transactions", response_model=list[CashTransactionOut])
def list_cash_transactions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(CashTransaction).where(CashTransaction.user_id == user.id).order_by(CashTransaction.id.desc()).limit(50)
    return db.scalars(stmt).all()


@router.post("/cash-transactions", response_model=CashTransactionOut, status_code=status.HTTP_201_CREATED)
def create_cash_transaction(
    body: CashTransactionRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    account = get_owned_account(db, user, body.account_id, for_update=True)
    if account.account_type not in ("CHECKING", "SAVINGS"):
        raise HTTPException(status_code=400, detail="Deposits and withdrawals are only available for checking and savings accounts")

    note = f" - {body.memo}" if body.memo else ""
    if body.type == "DEPOSIT":
        if body.amount > MAX_DEPOSIT:
            raise HTTPException(status_code=400, detail=f"Deposits are limited to ${MAX_DEPOSIT:,} per transaction")
        post_transaction(db, account, body.amount, f"Deposit{note}", "DEPOSIT")
        prefix = "DEP"
    else:
        require_funds(account, body.amount)
        post_transaction(db, account, -body.amount, f"Withdrawal{note}", "WITHDRAWAL")
        prefix = "WDL"

    cash_txn = CashTransaction(
        confirmation_number=confirmation_number(prefix),
        user_id=user.id,
        account_id=account.id,
        type=body.type,
        amount=body.amount,
        memo=body.memo,
    )
    db.add(cash_txn)
    db.commit()
    db.refresh(cash_txn)
    return cash_txn


@router.get("/payees", response_model=list[PayeeOut])
def list_payees(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Payee).where(Payee.user_id == user.id).order_by(Payee.name)).all()


@router.post("/payees", response_model=PayeeOut, status_code=status.HTTP_201_CREATED)
def create_payee(body: PayeeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = body.name.strip()
    duplicate = db.scalar(
        select(Payee).where(Payee.user_id == user.id, Payee.name.ilike(name), Payee.account_number == body.account_number)
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A payee with this name and account number already exists")
    payee = Payee(user_id=user.id, name=name, account_number=body.account_number, nickname=body.nickname or None)
    db.add(payee)
    db.commit()
    db.refresh(payee)
    return payee


@router.delete("/payees/{payee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payee(payee_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payee = db.scalar(select(Payee).where(Payee.id == payee_id, Payee.user_id == user.id))
    if payee is None:
        raise HTTPException(status_code=404, detail="Payee not found")
    db.delete(payee)
    db.commit()


@router.get("/payments", response_model=list[PaymentOut])
def list_payments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Payment).where(Payment.user_id == user.id).order_by(Payment.id.desc()).limit(50)
    return db.scalars(stmt).all()


@router.post("/payments", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def create_payment(body: PaymentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payee = db.scalar(select(Payee).where(Payee.id == body.payee_id, Payee.user_id == user.id))
    if payee is None:
        raise HTTPException(status_code=404, detail="Payee not found")
    src = get_owned_account(db, user, body.from_account_id, for_update=True)
    if src.account_type == "BROKERAGE":
        raise HTTPException(status_code=400, detail="Bill payments must come from a checking or savings account")
    require_funds(src, body.amount)

    post_transaction(db, src, -body.amount, f"Bill Pay - {payee.name}", "PAYMENT")
    payment = Payment(
        confirmation_number=confirmation_number("PAY"),
        user_id=user.id,
        from_account_id=src.id,
        payee_id=payee.id,
        payee_name=payee.name,
        amount=body.amount,
        memo=body.memo,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment
