from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..ledger import confirmation_number, get_owned_account, money, post_transaction, require_funds
from ..models import Account, Holding, Order, User
from ..quotes import QUOTES, all_quotes, get_quote
from ..schemas import AccountOut, HoldingOut, OrderOut, OrderRequest, PortfolioOut, QuoteOut
from ..security import get_current_user

router = APIRouter(prefix="/api/trade", tags=["trade"])


def get_brokerage(db: Session, user: User, account_id: int, *, for_update: bool = False) -> Account:
    account = get_owned_account(db, user, account_id, for_update=for_update)
    if account.account_type != "BROKERAGE":
        raise HTTPException(status_code=400, detail="Trading is only available in brokerage accounts")
    return account


@router.get("/quotes", response_model=list[QuoteOut])
def list_quotes(_: User = Depends(get_current_user)):
    return all_quotes()


@router.get("/quotes/{symbol}", response_model=QuoteOut)
def quote(symbol: str, _: User = Depends(get_current_user)):
    q = get_quote(symbol)
    if q is None:
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol.upper()}'")
    return q


@router.get("/portfolio/{account_id}", response_model=PortfolioOut)
def portfolio(account_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = get_brokerage(db, user, account_id)
    holdings = []
    for h in account.holdings:
        name, price, _ = QUOTES[h.symbol]
        value = price * h.quantity
        holdings.append(HoldingOut(
            symbol=h.symbol,
            name=name,
            quantity=h.quantity,
            avg_cost=float(h.avg_cost),
            price=float(price),
            market_value=float(money(value)),
            gain_loss=float(money(value - h.avg_cost * h.quantity)),
        ))
    holdings_value = sum(Decimal(str(h.market_value)) for h in holdings)
    return PortfolioOut(
        account=AccountOut.model_validate(account),
        cash=float(account.balance),
        holdings=holdings,
        holdings_value=float(holdings_value),
        total_value=float(holdings_value + account.balance),
    )


@router.get("/orders", response_model=list[OrderOut])
def list_orders(
    account_id: int = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = get_brokerage(db, user, account_id)
    stmt = select(Order).where(Order.account_id == account.id).order_by(Order.id.desc()).limit(50)
    return db.scalars(stmt).all()


@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def place_order(body: OrderRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    symbol = body.symbol.upper()
    if symbol not in QUOTES:
        raise HTTPException(status_code=404, detail=f"Unknown symbol '{symbol}'")
    account = get_brokerage(db, user, body.account_id, for_update=True)
    price = QUOTES[symbol][1]
    total = money(price * body.quantity)
    holding = db.scalar(
        select(Holding).where(Holding.account_id == account.id, Holding.symbol == symbol).with_for_update()
    )

    if body.side == "BUY":
        require_funds(account, total)
        if holding is None:
            db.add(Holding(account_id=account.id, symbol=symbol, quantity=body.quantity, avg_cost=price))
        else:
            new_qty = holding.quantity + body.quantity
            holding.avg_cost = (holding.avg_cost * holding.quantity + price * body.quantity) / new_qty
            holding.quantity = new_qty
        post_transaction(db, account, -total, f"Buy {body.quantity} {symbol} @ {price}", "TRADE")
    else:
        owned = holding.quantity if holding else 0
        if owned < body.quantity:
            raise HTTPException(status_code=400, detail=f"Insufficient shares: you own {owned} {symbol}")
        if owned == body.quantity:
            db.delete(holding)
        else:
            holding.quantity -= body.quantity
        post_transaction(db, account, total, f"Sell {body.quantity} {symbol} @ {price}", "TRADE")

    order = Order(
        confirmation_number=confirmation_number("ORD"),
        account_id=account.id,
        symbol=symbol,
        side=body.side,
        quantity=body.quantity,
        price=price,
        total=total,
        status="FILLED",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order
