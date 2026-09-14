from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Account, Debt, NetWorthSnapshot, User
from app.schemas import NetWorthOut, NetWorthPoint, NetWorthTypeTotal

router = APIRouter(prefix="/networth", tags=["networth"])

TYPE_ORDER = ["checking", "savings", "brokerage", "retirement", "other"]


@router.get("", response_model=NetWorthOut)
def get_net_worth(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    accounts = db.query(Account).filter(Account.user_id == user.id).all()
    debts = db.query(Debt).filter(Debt.user_id == user.id).all()

    total_assets = sum(a.balance for a in accounts)
    total_debt = sum(d.balance for d in debts)
    net_worth = total_assets - total_debt

    totals_by_type: dict[str, float] = defaultdict(float)
    for a in accounts:
        totals_by_type[a.type] += a.balance
    by_type = sorted(
        (NetWorthTypeTotal(type=t, total=v) for t, v in totals_by_type.items()),
        key=lambda x: TYPE_ORDER.index(x.type) if x.type in TYPE_ORDER else len(TYPE_ORDER),
    )

    # Refresh today's snapshot (rather than append) so revisiting the tab after
    # editing Accounts/Debts updates today's point instead of piling up duplicates —
    # the trend is built purely from what's on the books each day.
    today = date.today()
    snapshot = (
        db.query(NetWorthSnapshot)
        .filter(NetWorthSnapshot.user_id == user.id, NetWorthSnapshot.date == today)
        .first()
    )
    if snapshot:
        snapshot.total_assets = total_assets
        snapshot.total_debt = total_debt
        snapshot.net_worth = net_worth
    else:
        snapshot = NetWorthSnapshot(
            user_id=user.id, date=today, total_assets=total_assets, total_debt=total_debt, net_worth=net_worth,
        )
        db.add(snapshot)
    db.commit()

    history = (
        db.query(NetWorthSnapshot)
        .filter(NetWorthSnapshot.user_id == user.id)
        .order_by(NetWorthSnapshot.date)
        .all()
    )

    return NetWorthOut(
        total_assets=total_assets,
        total_debt=total_debt,
        net_worth=net_worth,
        by_type=by_type,
        history=[NetWorthPoint(date=h.date, net_worth=h.net_worth) for h in history],
    )
