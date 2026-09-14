from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import allocate, auth, debts, settings as settings_router, transactions

# Creates tables if they don't exist yet. Fine for getting started; once this is in
# real use, switch to Alembic migrations instead of relying on this.
Base.metadata.create_all(bind=engine)

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
