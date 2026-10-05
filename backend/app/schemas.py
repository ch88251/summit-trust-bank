from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

Amount = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=2)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class UserOut(ORM):
    id: int
    username: str
    full_name: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AccountOut(ORM):
    id: int
    account_number: str
    account_type: str
    nickname: str
    balance: float
    opened_at: datetime


class TransactionOut(ORM):
    id: int
    posted_at: datetime
    description: str
    category: str
    amount: float
    balance_after: float


class TransferRequest(BaseModel):
    from_account_id: int
    to_account_id: int
    amount: Amount
    memo: str | None = Field(default=None, max_length=100)


class TransferOut(ORM):
    id: int
    confirmation_number: str
    from_account_id: int
    to_account_id: int
    amount: float
    memo: str | None
    created_at: datetime


class PayeeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    account_number: str = Field(pattern=r"^\d{4,17}$")
    nickname: str | None = Field(default=None, max_length=100)


class PayeeOut(ORM):
    id: int
    name: str
    account_number: str
    nickname: str | None


class PaymentRequest(BaseModel):
    from_account_id: int
    payee_id: int
    amount: Amount
    memo: str | None = Field(default=None, max_length=100)


class PaymentOut(ORM):
    id: int
    confirmation_number: str
    from_account_id: int
    payee_id: int | None
    payee_name: str
    amount: float
    memo: str | None
    created_at: datetime


class QuoteOut(BaseModel):
    symbol: str
    name: str
    price: float
    change: float
    change_pct: float


class HoldingOut(BaseModel):
    symbol: str
    name: str
    quantity: int
    avg_cost: float
    price: float
    market_value: float
    gain_loss: float


class PortfolioOut(BaseModel):
    account: AccountOut
    cash: float
    holdings: list[HoldingOut]
    holdings_value: float
    total_value: float


class OrderRequest(BaseModel):
    account_id: int
    symbol: str = Field(min_length=1, max_length=10)
    side: Literal["BUY", "SELL"]
    quantity: int = Field(gt=0, le=100_000)


class OrderOut(ORM):
    id: int
    confirmation_number: str
    account_id: int
    symbol: str
    side: str
    quantity: int
    price: float
    total: float
    status: str
    created_at: datetime


class CashTransactionRequest(BaseModel):
    account_id: int
    type: Literal["DEPOSIT", "WITHDRAWAL"]
    amount: Amount
    memo: str | None = Field(default=None, max_length=100)


class CashTransactionOut(ORM):
    id: int
    confirmation_number: str
    account_id: int
    type: str
    amount: float
    memo: str | None
    created_at: datetime
