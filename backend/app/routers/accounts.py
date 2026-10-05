from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..ledger import get_owned_account
from ..models import Account, Transaction, User
from ..schemas import AccountOut, TransactionOut
from ..security import get_current_user

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[AccountOut])
def list_accounts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Account).where(Account.user_id == user.id).order_by(Account.id)).all()


@router.get("/{account_id}", response_model=AccountOut)
def get_account(account_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_owned_account(db, user, account_id)


@router.get("/{account_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    account_id: int,
    category: Literal["DEPOSIT", "WITHDRAWAL", "TRANSFER", "PAYMENT", "TRADE"] | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = get_owned_account(db, user, account_id)
    stmt = select(Transaction).where(Transaction.account_id == account.id)
    if category:
        stmt = stmt.where(Transaction.category == category)
    stmt = stmt.order_by(Transaction.posted_at.desc(), Transaction.id.desc()).limit(limit)
    return db.scalars(stmt).all()
