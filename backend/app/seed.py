"""Demo users and accounts. Data is rebuilt identically on every reset."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, engine
from .models import Account, Holding, Payee, Transaction, User
from .security import hash_password

# (days ago, description, category, signed amount)
CHECKING_HISTORY = [
    (45, "Opening deposit", "DEPOSIT", "2500.00"),
    (40, "Payroll - Acme Corp", "DEPOSIT", "3150.00"),
    (38, "Whole Foods Market", "WITHDRAWAL", "-142.37"),
    (35, "City Electric - Autopay", "PAYMENT", "-96.40"),
    (31, "Shell Gas Station", "WITHDRAWAL", "-48.15"),
    (26, "Payroll - Acme Corp", "DEPOSIT", "3150.00"),
    (24, "Rent - Parkview Apartments", "PAYMENT", "-1850.00"),
    (20, "Netflix Subscription", "WITHDRAWAL", "-15.49"),
    (17, "Transfer to Savings", "TRANSFER", "-500.00"),
    (12, "Payroll - Acme Corp", "DEPOSIT", "3150.00"),
    (10, "Target", "WITHDRAWAL", "-87.62"),
    (6, "Metro Water - Autopay", "PAYMENT", "-54.20"),
    (3, "Corner Bistro", "WITHDRAWAL", "-62.80"),
    (1, "ATM Withdrawal", "WITHDRAWAL", "-100.00"),
]

SAVINGS_HISTORY = [
    (45, "Opening deposit", "DEPOSIT", "17500.00"),
    (30, "Interest payment", "DEPOSIT", "21.88"),
    (17, "Transfer from Checking", "TRANSFER", "500.00"),
    (1, "Interest payment", "DEPOSIT", "22.54"),
]

DEMO_USERS = [
    {
        "username": "demo",
        "password": "Demo@123",
        "full_name": "Alex Morgan",
        "email": "alex.morgan@example.com",
        "accounts": [
            ("1000234567", "CHECKING", "Everyday Checking", CHECKING_HISTORY),
            ("2000238812", "SAVINGS", "High-Yield Savings", SAVINGS_HISTORY),
            ("3000231190", "BROKERAGE", "Self-Directed Brokerage", [(45, "Opening deposit", "DEPOSIT", "10000.00")]),
        ],
        "holdings": [("AAPL", 25, "170.25"), ("MSFT", 10, "380.00"), ("VTI", 15, "240.10")],
        "payees": [
            ("City Electric", "88442211", "Electric"),
            ("Metro Water", "55120987", "Water"),
            ("Summit Visa Card", "4111222233334444", "Credit Card"),
        ],
    },
    {
        "username": "jane",
        "password": "Jane@123",
        "full_name": "Jane Cooper",
        "email": "jane.cooper@example.com",
        "accounts": [
            ("1000987654", "CHECKING", "Primary Checking", [(20, "Opening deposit", "DEPOSIT", "1200.00")]),
            ("2000981432", "SAVINGS", "Rainy Day Savings", [(20, "Opening deposit", "DEPOSIT", "3000.00")]),
        ],
        "holdings": [],
        "payees": [("Northside Gas Co.", "77001234", None)],
    },
]


def seed(db: Session) -> None:
    now = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
    for spec in DEMO_USERS:
        user = User(
            username=spec["username"],
            password_hash=hash_password(spec["password"]),
            full_name=spec["full_name"],
            email=spec["email"],
        )
        db.add(user)
        brokerage = None
        for number, acct_type, nickname, history in spec["accounts"]:
            first_day = max(h[0] for h in history)
            account = Account(
                owner=user,
                account_number=number,
                account_type=acct_type,
                nickname=nickname,
                balance=Decimal("0.00"),
                opened_at=now - timedelta(days=first_day),
            )
            db.add(account)
            for days_ago, desc, category, amount in history:
                account.balance += Decimal(amount)
                db.add(Transaction(
                    account=account,
                    posted_at=now - timedelta(days=days_ago),
                    description=desc,
                    category=category,
                    amount=Decimal(amount),
                    balance_after=account.balance,
                ))
            if acct_type == "BROKERAGE":
                brokerage = account
        for symbol, qty, cost in spec["holdings"]:
            db.add(Holding(account=brokerage, symbol=symbol, quantity=qty, avg_cost=Decimal(cost)))
        for name, number, nickname in spec["payees"]:
            db.add(Payee(owner=user, name=name, account_number=number, nickname=nickname))
    db.commit()


def seed_if_empty(db: Session) -> None:
    if db.scalar(select(User.id).limit(1)) is None:
        seed(db)


def reset_database(db: Session) -> None:
    db.close()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    seed(db)
