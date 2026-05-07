from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.db.config import create_tables
from app.account.routers import router as account_router


@asynccontextmanager
async def lifespan(app:FastAPI):
    await create_tables()
    yield

app = FastAPI(lifespan=lifespan)

# allow_credentials=True is required for the refresh-token cookie used by /login and /refresh
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(account_router)