from sqlalchemy.ext.asyncio import async_session, async_sessionmaker, create_async_engine, AsyncAttrs, AsyncSession
from sqlalchemy.orm import DeclarativeBase
import pathlib
from fastapi import Depends
from typing import Annotated, AsyncGenerator

class Base(AsyncAttrs, DeclarativeBase):
    pass

BASE_DIR = pathlib.Path(__file__).parent.parent.parent

db_path = BASE_DIR / "sqlite.db"

DATABASE_URL = f"sqlite+aiosqlite:///{db_path}"

engine = create_async_engine(DATABASE_URL,future=True)
async_session = async_sessionmaker(bind = engine, expire_on_commit=False, class_= AsyncSession)

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def drop_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session

SessionDep = Annotated[AsyncSession, Depends(get_session)]