from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import settings
from app.database import Base, engine
from app.routers import allocate, auth, debts, settings as settings_router, transactions

# Creates tables if they don't exist yet. Fine for getting started; once this is in
# real use, switch to Alembic migrations instead of relying on this.
Base.metadata.create_all(bind=engine)

# create_all only adds new tables, not new columns on existing ones. Patch those in too
# so a pre-existing local database picks up columns added after the table first existed.
_NEW_COLUMNS = {
    "user_settings": {
        "brokerage_balance": "FLOAT DEFAULT 0",
        "checking_balance": "FLOAT DEFAULT 0",
        "use_brokerage_checking_as_emergency_fund": "BOOLEAN DEFAULT 0",
        "use_transactions_for_expenses": "BOOLEAN DEFAULT 0",
        "use_transactions_for_income": "BOOLEAN DEFAULT 0",
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


_migrate_missing_columns()

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
app.include_router(allocate.router)


@app.get("/health")
def health():
    return {"status": "ok"}
