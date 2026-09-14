"""
Port of the `computeAllocation` waterfall from the original React artifact.
Keep this in sync with the frontend's logic if you ever change one — this is now
the single source of truth once both the web and mobile apps call this API instead
of computing it client-side.
"""

from app.models import Debt, UserSettings
from app.schemas import AllocationResult, AllocationStep

HIGH_INTEREST_APR_THRESHOLD = 7.0  # roughly long-run stock market return
IRS_2026_EMPLOYEE_LIMIT = 24500.0
CHECKING_BUFFER_TARGET_MONTHS = 0.5  # keep roughly half a month of expenses on hand


def fmt(n: float) -> str:
    sign = "-$" if n < 0 else "$"
    return f"{sign}{abs(n):,.0f}"


def split_roth_traditional(amount: float, roth_percent: float) -> tuple[float, float]:
    roth = amount * (roth_percent / 100)
    traditional = amount - roth
    return roth, traditional


def catch_up_amount(age: int) -> float:
    if 60 <= age <= 63:
        return 11250.0
    if age >= 50:
        return 8000.0
    return 0.0


def compute_allocation(
    settings: UserSettings,
    effective_income: float,
    effective_expenses: float,
    debts: list[Debt],
) -> AllocationResult:
    monthly_gross = settings.gross_annual_salary / 12
    match_limit_pct = settings.employer_match_limit / 100
    current_pct = settings.current_contribution_percent / 100
    surplus = max(effective_income - effective_expenses, 0)
    remaining = surplus
    steps: list[AllocationStep] = []

    high_interest_debts = [d for d in debts if d.apr >= HIGH_INTEREST_APR_THRESHOLD]
    high_interest_balance = sum(d.balance for d in high_interest_debts)
    low_interest_debts = [d for d in debts if 0 < d.apr < HIGH_INTEREST_APR_THRESHOLD]

    # Step 1 — capture the full employer match (split Roth vs Traditional)
    match_gap_pct = max(match_limit_pct - current_pct, 0)
    match_gap_monthly = match_gap_pct * monthly_gross
    step1 = min(match_gap_monthly, remaining)
    remaining -= step1
    roth1, trad1 = split_roth_traditional(step1, settings.roth_percent)
    steps.append(AllocationStep(
        key="401k",
        label="401(k) — capture full match",
        amount=step1,
        roth_amount=roth1,
        traditional_amount=trad1,
        note=(
            f"You're contributing {settings.current_contribution_percent:g}% of salary; the match tops "
            f"out at {settings.employer_match_limit:g}%. Closing that gap is free money before anything else."
            if match_gap_pct > 0
            else "You're already capturing the full employer match — no gap here."
        ),
    ))

    # Step 2 — extra payoff toward high-interest debt
    debt_payoff = min(remaining, high_interest_balance) if high_interest_balance > 0 else 0.0
    remaining -= debt_payoff
    if high_interest_balance > 0:
        count = len(high_interest_debts)
        note = (
            f"{count} debt{'s' if count > 1 else ''} at {HIGH_INTEREST_APR_THRESHOLD:g}%+ APR, "
            f"{fmt(high_interest_balance)} total. A guaranteed double-digit return by not paying that "
            f"interest usually beats investing further, ahead of the emergency fund."
        )
    else:
        note = "No debt at or above 7% APR logged — nothing urgent to prioritize here."
    steps.append(AllocationStep(
        key="debt", label="Debt — extra payoff (high interest)", amount=debt_payoff, note=note,
    ))

    # Step 3 — build the emergency fund
    if settings.use_brokerage_checking_as_emergency_fund:
        emergency_balance = settings.brokerage_balance + settings.checking_balance
        source_note = (
            f"Counting your brokerage + checking balances ({fmt(emergency_balance)} combined) as your "
            f"emergency fund instead of a separate account. "
        )
    else:
        emergency_balance = settings.emergency_fund_balance
        source_note = ""
    target_fund = settings.emergency_fund_target_months * effective_expenses
    fund_gap = max(target_fund - emergency_balance, 0)
    monthly_fund_target = min(fund_gap / 6, remaining) if fund_gap > 0 else 0.0
    remaining -= monthly_fund_target
    steps.append(AllocationStep(
        key="savings",
        label="Savings — emergency fund",
        amount=monthly_fund_target,
        note=(
            f"{source_note}Target is {settings.emergency_fund_target_months:g} months of expenses "
            f"({fmt(target_fund)}). You're {fmt(fund_gap)} short — this pace fills it in about 6 months."
            if fund_gap > 0
            else f"{source_note}Emergency fund is already at or above target."
        ),
    ))

    # Step 4 — additional 401(k) up to the IRS limit (split Roth vs Traditional)
    catch_up = catch_up_amount(settings.age)
    irs_annual_limit = IRS_2026_EMPLOYEE_LIMIT + catch_up
    irs_monthly_limit = irs_annual_limit / 12
    contributing_monthly = current_pct * monthly_gross + step1
    room_left = max(irs_monthly_limit - contributing_monthly, 0)
    step4 = min(room_left, remaining)
    remaining -= step4
    roth4, trad4 = split_roth_traditional(step4, settings.roth_percent)
    steps.append(AllocationStep(
        key="401k-extra",
        label="401(k) — extra, toward IRS max",
        amount=step4,
        roth_amount=roth4,
        traditional_amount=trad4,
        note=(
            f"2026 employee limit is {fmt(irs_annual_limit)}/yr. Tax-advantaged room is generally worth "
            f"filling before a taxable brokerage."
        ),
    ))

    # Step 5 — low-interest debt: informational only, doesn't claim surplus by default
    if low_interest_debts:
        low_balance = sum(d.balance for d in low_interest_debts)
        steps.append(AllocationStep(
            key="debt-low",
            label="Debt — low interest (optional)",
            amount=0.0,
            note=(
                f"{fmt(low_balance)} at under {HIGH_INTEREST_APR_THRESHOLD:g}% APR. Paying minimums and "
                f"investing the rest is usually fine here — extra payoff is a personal choice, not a math "
                f"requirement."
            ),
        ))

    # Step 6 — top up the checking buffer toward its target, then brokerage gets the rest
    checking_target = CHECKING_BUFFER_TARGET_MONTHS * effective_expenses
    checking_gap = max(checking_target - settings.checking_balance, 0)
    checking_buffer = min(remaining, checking_gap) if checking_gap > 0 else 0.0
    brokerage = max(remaining - checking_buffer, 0)
    steps.append(AllocationStep(
        key="brokerage",
        label="Brokerage / IRA",
        amount=brokerage,
        note=(
            "Once the match, high-interest debt, emergency fund, and IRS-limited retirement room are "
            "handled, extra surplus works well in a taxable brokerage or IRA."
            + (
                f" You're currently holding {fmt(settings.brokerage_balance)} there."
                if settings.brokerage_balance > 0
                else ""
            )
        ),
    ))
    steps.append(AllocationStep(
        key="checking",
        label="Checking — buffer",
        amount=checking_buffer,
        note=(
            f"Target buffer is {fmt(checking_target)} ({CHECKING_BUFFER_TARGET_MONTHS:g} months of expenses) "
            f"for timing gaps between paychecks and bills. You're {fmt(checking_gap)} short — topping that up "
            f"here."
            if checking_gap > 0
            else "Checking buffer is already at or above target — all remaining surplus goes to brokerage/IRA instead."
        ),
    ))

    return AllocationResult(
        effective_income=effective_income,
        effective_expenses=effective_expenses,
        surplus=surplus,
        steps=steps,
    )
