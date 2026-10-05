"""Endpoints that exist purely to support automated tests."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..seed import reset_database

router = APIRouter(prefix="/api/test", tags=["testing"])


@router.post("/reset")
def reset(db: Session = Depends(get_db)):
    """Drop all data and restore the seeded demo users and accounts."""
    reset_database(db)
    return {"status": "ok"}
