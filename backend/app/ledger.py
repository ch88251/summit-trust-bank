"""Shared helpers for moving money and looking up a user's accounts."""

import secrets
from decimal import ROUND_HALF_UP, Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Account, Transaction, User

CENT = Decimal("0.01")


def money(value) -> Decimal:
    return Decimal(value).quantize(CENT, rounding=ROUND_HALF_UP)


def confirmation_number(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(4).upper()}"


def get_owned_account(db: Session, user: User, account_id: int, *, for_update: bool = False) -> Account:
    stmt = select(Account).where(Account.id == account_id, Account.user_id == user.id)
    if for_update:
        stmt = stmt.with_for_update()
    account = db.scalar(stmt)
    if account is None:
        raise HTTPException(status_code=404, detail=f"Account {account_id} not found")
    return account


def post_transaction(db: Session, account: Account, amount: Decimal, description: str, category: str) -> Transaction:
    """Apply a signed amount to an account and record it in the ledger."""
    amount = money(amount)
    account.balance = money(account.balance + amount)
    txn = Transaction(
        account=account,
        amount=amount,
        balance_after=account.balance,
        description=description,
        category=category,
    )
    db.add(txn)
    return txn


def require_funds(account: Account, amount: Decimal) -> None:
    if account.balance < amount:
        raise HTTPException(status_code=400, detail="Insufficient funds")
