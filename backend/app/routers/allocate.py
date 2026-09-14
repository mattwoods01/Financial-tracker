from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.allocation import compute_allocation
from app.auth import get_current_user
from app.database import get_db
from app.models import Account, Debt, Transaction, User, UserSettings
from app.schemas import AllocationResult

router = APIRouter(prefix="/allocate", tags=["allocate"])


@router.get("", response_model=AllocationResult)
def get_allocation(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if not settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    debts = db.query(Debt).filter(Debt.user_id == user.id).all()
    accounts = db.query(Account).filter(Account.user_id == user.id).all()

    today = date.today()
    month_start = today.replace(day=1)
    month_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id, Transaction.date >= month_start)
        .all()
    )
    # Income and expenses come solely from this month's Transactions — no manual override.
    effective_income = sum(t.amount for t in month_txs if t.type == "income")
    effective_expenses = sum(t.amount for t in month_txs if t.type == "expense")

    return compute_allocation(settings, effective_income, effective_expenses, debts, accounts)
