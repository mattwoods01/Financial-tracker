import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def gen_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    settings: Mapped["UserSettings"] = relationship(
        "UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="user", cascade="all, delete-orphan"
    )
    debts: Mapped[list["Debt"]] = relationship(
        "Debt", back_populates="user", cascade="all, delete-orphan"
    )


class UserSettings(Base):
    """
    One row per user. Mirrors the `settings` object from the original artifact —
    everything the allocation waterfall needs to know about the person's finances.
    """
    __tablename__ = "user_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, nullable=False)

    gross_annual_salary: Mapped[float] = mapped_column(Float, default=90000)
    monthly_take_home: Mapped[float] = mapped_column(Float, default=5200)
    monthly_expenses_manual: Mapped[float] = mapped_column(Float, default=3600)
    current_contribution_percent: Mapped[float] = mapped_column(Float, default=4)
    employer_match_limit: Mapped[float] = mapped_column(Float, default=6)
    age: Mapped[int] = mapped_column(Integer, default=30)
    emergency_fund_balance: Mapped[float] = mapped_column(Float, default=4000)
    emergency_fund_target_months: Mapped[float] = mapped_column(Float, default=6)
    roth_percent: Mapped[float] = mapped_column(Float, default=60)
    brokerage_balance: Mapped[float] = mapped_column(Float, default=0)
    checking_balance: Mapped[float] = mapped_column(Float, default=0)
    use_brokerage_checking_as_emergency_fund: Mapped[bool] = mapped_column(Boolean, default=False)
    use_transactions_for_expenses: Mapped[bool] = mapped_column(Boolean, default=False)
    use_transactions_for_income: Mapped[bool] = mapped_column(Boolean, default=False)

    user: Mapped["User"] = relationship("User", back_populates="settings")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)

    date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False, default="Other")
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # "income" | "expense"

    user: Mapped["User"] = relationship("User", back_populates="transactions")


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=gen_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String, nullable=False)
    balance: Mapped[float] = mapped_column(Float, nullable=False)
    apr: Mapped[float] = mapped_column(Float, default=0)
    min_payment: Mapped[float] = mapped_column(Float, default=0)

    user: Mapped["User"] = relationship("User", back_populates="debts")
