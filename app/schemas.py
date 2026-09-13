from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


# ---- Auth ----

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---- Settings ----

class SettingsBase(BaseModel):
    gross_annual_salary: float = 90000
    monthly_take_home: float = 5200
    monthly_expenses_manual: float = 3600
    current_contribution_percent: float = 4
    employer_match_limit: float = 6
    age: int = 30
    emergency_fund_balance: float = 4000
    emergency_fund_target_months: float = 6
    roth_percent: float = Field(default=60, ge=0, le=100)


class SettingsUpdate(SettingsBase):
    pass


class SettingsOut(SettingsBase):
    class Config:
        from_attributes = True


# ---- Transactions ----

class TransactionCreate(BaseModel):
    date: date
    description: str
    category: str = "Other"
    amount: float = Field(gt=0)
    type: Literal["income", "expense"]


class TransactionOut(TransactionCreate):
    id: str

    class Config:
        from_attributes = True


# ---- Debts ----

class DebtCreate(BaseModel):
    name: str
    balance: float = Field(gt=0)
    apr: float = Field(default=0, ge=0)
    min_payment: float = Field(default=0, ge=0)


class DebtOut(DebtCreate):
    id: str

    class Config:
        from_attributes = True


# ---- Allocation ----

class AllocationStep(BaseModel):
    key: str
    label: str
    amount: float
    roth_amount: float | None = None
    traditional_amount: float | None = None
    note: str


class AllocationResult(BaseModel):
    effective_income: float
    effective_expenses: float
    surplus: float
    steps: list[AllocationStep]
