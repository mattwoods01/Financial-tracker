import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.routers import (
    accounts as accounts_router,
    allocate,
    auth,
    budgets as budgets_router,
    debts,
    networth,
    settings as settings_router,
    transactions,
)

# Creates tables if they don't exist yet. Fine for getting started; once this is in
# real use, switch to Alembic migrations instead of relying on this.
Base.metadata.create_all(bind=engine)

# create_all only adds new tables, not new columns on existing ones. Patch those in too
# so a pre-existing local database picks up columns added after the table first existed.
_NEW_COLUMNS = {
    "user_settings": {
        "disabled_allocation_steps": "VARCHAR DEFAULT ''",
    },
}


def _migrate_missing_columns() -> None:
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _NEW_COLUMNS.items():
            if table not in inspector.get_table_names():
                continue
            existing = {col["name"] for col in inspector.get_columns(table)}
            for name, ddl_type in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl_type}"))


def _migrate_net_worth_snapshot_columns() -> None:
    """net_worth_snapshots used to store one column per balance type; it's now a single
    total_assets figure (individual balances live in accounts instead). Add the column,
    backfill it from the old ones, then rebuild the table to actually drop those old
    columns — they were declared NOT NULL, so just leaving them in place (as we do for
    other superseded columns) breaks every future insert since new rows never set them.
    SQLite can't ALTER a column's nullability directly, hence the rebuild."""
    inspector = inspect(engine)
    if "net_worth_snapshots" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("net_worth_snapshots")}
    legacy_cols = {"checking_balance", "savings_balance", "brokerage_balance", "retirement_balance"}
    needs_total_assets = "total_assets" not in existing
    needs_rebuild = bool(legacy_cols & existing)
    if not needs_total_assets and not needs_rebuild:
        return

    with engine.begin() as conn:
        if needs_total_assets:
            conn.execute(text("ALTER TABLE net_worth_snapshots ADD COLUMN total_assets FLOAT DEFAULT 0"))
            if legacy_cols <= existing:
                conn.execute(text(
                    "UPDATE net_worth_snapshots SET total_assets = "
                    "COALESCE(checking_balance, 0) + COALESCE(savings_balance, 0) + "
                    "COALESCE(brokerage_balance, 0) + COALESCE(retirement_balance, 0)"
                ))
        if needs_rebuild:
            conn.execute(text(
                "CREATE TABLE net_worth_snapshots_new ("
                "id VARCHAR NOT NULL PRIMARY KEY, "
                "user_id VARCHAR NOT NULL REFERENCES users (id), "
                "date DATE NOT NULL, "
                "total_assets FLOAT, "
                "total_debt FLOAT, "
                "net_worth FLOAT, "
                "CONSTRAINT uq_net_worth_user_date UNIQUE (user_id, date))"
            ))
            conn.execute(text(
                "INSERT INTO net_worth_snapshots_new (id, user_id, date, total_assets, total_debt, net_worth) "
                "SELECT id, user_id, date, total_assets, total_debt, net_worth FROM net_worth_snapshots"
            ))
            conn.execute(text("DROP TABLE net_worth_snapshots"))
            conn.execute(text("ALTER TABLE net_worth_snapshots_new RENAME TO net_worth_snapshots"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_net_worth_snapshots_user_id ON net_worth_snapshots (user_id)"
            ))


def _migrate_legacy_balances_to_accounts() -> None:
    """Settings used to carry checking/brokerage/retirement/emergency-fund balances
    directly. Those columns are gone from the model but may still exist in a
    pre-existing database — one-time seed them into Account rows (skipped per-user
    once they have any accounts) so nobody loses their numbers in this move."""
    inspector = inspect(engine)
    if "user_settings" not in inspector.get_table_names() or "accounts" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("user_settings")}
    legacy_fields = {
        "checking_balance": ("Checking", "checking", True),
        "emergency_fund_balance": ("Savings", "savings", True),
        "brokerage_balance": ("Brokerage", "brokerage", False),
        "retirement_balance": ("401(k)", "retirement", False),
    }
    if not all(field in existing for field in legacy_fields):
        return  # this database never had the old columns — nothing to migrate

    with engine.begin() as conn:
        cols = ", ".join(["user_id", *legacy_fields.keys()])
        rows = conn.execute(text(f"SELECT {cols} FROM user_settings")).mappings().all()
        for row in rows:
            user_id = row["user_id"]
            already_migrated = conn.execute(
                text("SELECT COUNT(*) FROM accounts WHERE user_id = :uid"), {"uid": user_id}
            ).scalar()
            if already_migrated:
                continue
            for field, (name, type_, counts) in legacy_fields.items():
                balance = row[field] or 0
                if not balance:
                    continue
                conn.execute(
                    text(
                        "INSERT INTO accounts (id, user_id, name, type, balance, counts_as_emergency_fund) "
                        "VALUES (:id, :user_id, :name, :type, :balance, :counts)"
                    ),
                    {
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "name": name,
                        "type": type_,
                        "balance": balance,
                        "counts": counts,
                    },
                )


def _migrate_budget_columns() -> None:
    """The Budget column was originally named monthly_amount before settling on
    monthly_target. Rename it in place on any database created during that window."""
    inspector = inspect(engine)
    if "budgets" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("budgets")}
    if "monthly_target" in existing:
        return
    if "monthly_amount" not in existing:
        return
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE budgets RENAME COLUMN monthly_amount TO monthly_target"))


_migrate_missing_columns()
_migrate_net_worth_snapshot_columns()
_migrate_legacy_balances_to_accounts()
_migrate_budget_columns()

app = FastAPI(title="Ledger API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(settings_router.router)
app.include_router(transactions.router)
app.include_router(debts.router)
app.include_router(accounts_router.router)
app.include_router(allocate.router)
app.include_router(networth.router)
app.include_router(budgets_router.router)


@app.get("/health")
def health():
    return {"status": "ok"}
