from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from models.database import Base, engine
from routers import auth, dashboard, members, packages, payments, sessions, trainers


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            text(
                "ALTER TABLE members ADD COLUMN IF NOT EXISTS goals VARCHAR[] NOT NULL DEFAULT '{}'"
            )
        )
    yield


app = FastAPI(title="Kinetica API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(members.router, prefix="/members", tags=["members"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(packages.router, prefix="/packages", tags=["packages"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(trainers.router, prefix="/trainers", tags=["trainers"])


@app.get("/health")
async def health():
    return {"status": "ok"}
