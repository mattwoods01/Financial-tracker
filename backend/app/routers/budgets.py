from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Budget, User
from app.schemas import BudgetOut, BudgetSet

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetOut])
def list_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Budget).filter(Budget.user_id == user.id).all()


@router.put("/{category}", response_model=BudgetOut)
def set_budget(
    category: str, payload: BudgetSet, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    budget = db.query(Budget).filter(Budget.user_id == user.id, Budget.category == category).first()
    if budget:
        budget.monthly_target = payload.monthly_target
    else:
        budget = Budget(user_id=user.id, category=category, monthly_target=payload.monthly_target)
        db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{category}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(category: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    budget = db.query(Budget).filter(Budget.user_id == user.id, Budget.category == category).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
