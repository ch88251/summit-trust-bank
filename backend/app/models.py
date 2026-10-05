from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

Money = Numeric(14, 2)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255))

    accounts: Mapped[list["Account"]] = relationship(back_populates="owner", order_by="Account.id")
    payees: Mapped[list["Payee"]] = relationship(back_populates="owner", order_by="Payee.name")


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    account_number: Mapped[str] = mapped_column(String(20), unique=True)
    account_type: Mapped[str] = mapped_column(String(20))  # CHECKING | SAVINGS | BROKERAGE
    nickname: Mapped[str] = mapped_column(String(100))
    balance: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    owner: Mapped[User] = relationship(back_populates="accounts")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")
    holdings: Mapped[list["Holding"]] = relationship(back_populates="account", order_by="Holding.symbol")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    posted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    description: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(20))  # DEPOSIT | WITHDRAWAL | TRANSFER | PAYMENT | TRADE
    amount: Mapped[Decimal] = mapped_column(Money)  # signed: + credit, - debit
    balance_after: Mapped[Decimal] = mapped_column(Money)

    account: Mapped[Account] = relationship(back_populates="transactions")


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    confirmation_number: Mapped[str] = mapped_column(String(20), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    from_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    to_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    amount: Mapped[Decimal] = mapped_column(Money)
    memo: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Payee(Base):
    __tablename__ = "payees"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    account_number: Mapped[str] = mapped_column(String(20))
    nickname: Mapped[str | None] = mapped_column(String(100))

    owner: Mapped[User] = relationship(back_populates="payees")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    confirmation_number: Mapped[str] = mapped_column(String(20), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    from_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    payee_id: Mapped[int | None] = mapped_column(ForeignKey("payees.id", ondelete="SET NULL"))
    payee_name: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Money)
    memo: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(10))
    quantity: Mapped[int] = mapped_column(Integer)
    avg_cost: Mapped[Decimal] = mapped_column(Numeric(14, 4))

    account: Mapped[Account] = relationship(back_populates="holdings")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    confirmation_number: Mapped[str] = mapped_column(String(20), unique=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    symbol: Mapped[str] = mapped_column(String(10))
    side: Mapped[str] = mapped_column(String(4))  # BUY | SELL
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    total: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(String(20), default="FILLED")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CashTransaction(Base):
    """A deposit to or withdrawal from a checking or savings account."""

    __tablename__ = "cash_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    confirmation_number: Mapped[str] = mapped_column(String(20), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"))
    type: Mapped[str] = mapped_column(String(10))  # DEPOSIT | WITHDRAWAL
    amount: Mapped[Decimal] = mapped_column(Money)
    memo: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
