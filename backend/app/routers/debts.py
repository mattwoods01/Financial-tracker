from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Debt, User
from app.schemas import DebtCreate, DebtOut

router = APIRouter(prefix="/debts", tags=["debts"])


@router.get("", response_model=list[DebtOut])
def list_debts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.query(Debt).filter(Debt.user_id == user.id).order_by(Debt.apr.desc()).all()


@router.post("", response_model=DebtOut, status_code=status.HTTP_201_CREATED)
def create_debt(payload: DebtCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    debt = Debt(user_id=user.id, **payload.model_dump())
    db.add(debt)
    db.commit()
    db.refresh(debt)
    return debt


@router.delete("/{debt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debt(debt_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    debt = db.query(Debt).filter(Debt.id == debt_id, Debt.user_id == user.id).first()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    db.delete(debt)
    db.commit()
