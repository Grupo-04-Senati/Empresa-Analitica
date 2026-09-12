from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import os
from app.database.models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "")

if DATABASE_URL and "localhost" not in DATABASE_URL and "127.0.0.1" not in DATABASE_URL:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
else:
    engine = None
    async_session = None

async def get_db():
    if async_session is None:
        yield None
        return
    async with async_session() as session:
        yield session
