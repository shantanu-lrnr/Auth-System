from app.account.models import User, RefreshToken
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt
from jose.exceptions import JWTClaimsError, ExpiredSignatureError, JWTError
import uuid

SECRET_KEY = "MY-SECRET-KEY"
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_at: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_at or timedelta(minutes=15))
    to_encode.update({"exp": expire})

    return jwt.encode(claims=to_encode, key=SECRET_KEY, algorithm=ALGORITHM)


async def create_tokens(session: AsyncSession, user: User):
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token_str = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)

    refresh_token = RefreshToken(
        token=refresh_token_str,
        user_id=user.id,
        expires_at=expires_at
    )

    session.add(refresh_token)
    await session.commit()

    return {
        "access_token": access_token,
        "refresh_token": refresh_token_str,
        "token_type": "bearer"
    }


async def verify_refresh_token(session: AsyncSession, token: str):
    stmt = select(RefreshToken).where(RefreshToken.token == token).options(selectinload(RefreshToken.user))
    result = await session.scalars(stmt)
    db_token = result.first()

    if db_token and not db_token.revoked:

        expires_at = db_token.expires_at

        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if expires_at > datetime.now(timezone.utc):
            if not db_token.user.is_active:
                return None
            return db_token.user

    return None


def decode_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=ALGORITHM)
    except (ExpiredSignatureError, JWTClaimsError, JWTError) as e:
        print("Error:---------", e)
        return None


def verify_token_and_get_user_id(token: str, token_type: str):
    payload = decode_token(token)
    if not payload or payload.get("type") != token_type:
        return None

    return int(payload.get("sub"))


def create_email_verification_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "type": "verify"
    }

    return jwt.encode(claims=to_encode, key=SECRET_KEY, algorithm=ALGORITHM)


def create_password_reset_token(user_id: int):
    expire = datetime.now(timezone.utc) + timedelta(hours=1)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "type": "reset"
    }

    return jwt.encode(claims=to_encode, key=SECRET_KEY, algorithm=ALGORITHM)


async def get_user_by_email(session: AsyncSession, email: str) -> User | None:
    stmt = select(User).where(User.email == email)
    result = await session.scalars(stmt)
    return result.first()


async def revoke_refresh_token(session: AsyncSession, token: str):
    stmt = select(RefreshToken).where(RefreshToken.token == token)
    result = await session.scalars(stmt)

    db_refresh_token = result.first()

    if db_refresh_token:
        db_refresh_token.revoked = True
        session.add(db_refresh_token)
        await session.commit()


async def revoke_all_user_tokens(session: AsyncSession, user_id: int) -> None:
    stmt = (
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
        .values(revoked=True)
    )
    await session.execute(stmt)
    await session.commit()
