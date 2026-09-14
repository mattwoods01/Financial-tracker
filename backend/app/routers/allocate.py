from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.allocation import compute_allocation
from app.auth import get_current_user
from app.database import get_db
from app.models import Debt, Transaction, User, UserSettings
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

    today = date.today()
    month_start = today.replace(day=1)
    month_txs = (
        db.query(Transaction)
        .filter(Transaction.user_id == user.id, Transaction.date >= month_start)
        .all()
    )
    month_income = sum(t.amount for t in month_txs if t.type == "income")
    month_expenses = sum(t.amount for t in month_txs if t.type == "expense")

    effective_income = settings.monthly_take_home if settings.monthly_take_home > 0 else month_income
    if settings.use_transactions_for_expenses:
        effective_expenses = month_expenses + sum(d.min_payment for d in debts)
    else:
        effective_expenses = settings.monthly_expenses_manual

    return compute_allocation(settings, effective_income, effective_expenses, debts)
