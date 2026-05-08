from app.account.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, asc, desc
from datetime import datetime, timezone, timedelta
from app.account.schemas import UserCreate, AdminUserCreate
from app.account.utils import (
    get_user_by_email,
    hash_password,
    verify_password,
    create_email_verification_token,
    verify_token_and_get_user_id,
    create_password_reset_token,
    revoke_all_user_tokens,
)
from app.account.email import send_email, render_action_email, APP_BASE_URL

from fastapi import BackgroundTasks, HTTPException


_SORT_COLUMNS = {
    "name": User.name,
    "email": User.email,
    "created_at": User.created_at,
    "is_active": User.is_active,
    "is_admin": User.is_admin,
}


async def create_user(session:AsyncSession, user:UserCreate) -> User:
    existing_user = await get_user_by_email(session,email=user.email)
    if existing_user:
        raise HTTPException(status_code=400,
        detail="User with this email already exist")
    
    new_user = User(
        name=user.name,
        email=user.email,
        hashed_password=hash_password(user.password)
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return new_user

async def authenticate_user(session:AsyncSession, email:str,password:str):
    user = await get_user_by_email(session,email)
    if user and verify_password(password,user.hashed_password):
        if user.deletion_requested_at is not None:
            requested_at = user.deletion_requested_at
            if requested_at.tzinfo is None:
                requested_at = requested_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - requested_at > timedelta(days=30):
                raise HTTPException(status_code=403, detail="Account is permanently deleted.")
            user.is_active = True
            user.deletion_requested_at = None
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Your account has been blocked due to policy violations. Contact an administrator.")
        return user
    return None

def email_verification_link_send(background: BackgroundTasks, user: User):
    token = create_email_verification_token(user.id)
    link = f"{APP_BASE_URL}/verify-email?token={token}"
    html = render_action_email(
        name=user.name,
        heading="Verify your email address",
        intro="Welcome to Auth System! Please confirm your email address by clicking the button below. This helps us keep your account secure.",
        button_label="Verify email",
        button_url=link,
        footnote="This link will expire in 1 hour. If you didn't create an account, you can safely ignore this email.",
    )
    background.add_task(send_email, user.email, "Verify your email – Auth System", html)
    return {"msg": "Verification email sent"}

async def verify_email_token(session:AsyncSession,token:str):
    user_id = verify_token_and_get_user_id(token,"verify")
    if not user_id:
        raise HTTPException(status_code=400,detail="Invalid or expired token")
    user = await session.get(User,user_id)
    if not user:
        raise HTTPException(status_code=404,detail="User not found")

    user.is_verified = True
    session.add(user)
    await session.commit()
    return {"msg":"Email verified successfully"}

async def update_user_name(session: AsyncSession, user: User, name: str) -> User:
    user.name = name
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user

async def change_password(session:AsyncSession,user:User,new_password:str):
    if verify_password(new_password,user.hashed_password):
        raise HTTPException(status_code=400,detail="New password cannot be same as old password")
    user.hashed_password = hash_password(new_password)
    session.add(user)
    await session.commit()
    return {"msg":"Password changed successfully"}

async def request_account_deletion(session: AsyncSession, user: User, password: str):
    if not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    user.is_active = False
    user.deletion_requested_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()
    await revoke_all_user_tokens(session, user.id)
    return {"msg": "Account scheduled for deletion. You have 30 days to log back in to restore it."}
    
async def password_reset_link_send(session: AsyncSession, background: BackgroundTasks, email: str):
    user = await get_user_by_email(session, email)
    if not user:
        raise HTTPException(status_code=404, detail="User with this email does not exist")
    token = create_password_reset_token(user.id)
    link = f"{APP_BASE_URL}/reset-password?token={token}"
    html = render_action_email(
        name=user.name,
        heading="Reset your password",
        intro="We received a request to reset the password for your Auth System account. Click the button below to choose a new one.",
        button_label="Reset password",
        button_url=link,
        footnote="This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.",
    )
    background.add_task(send_email, user.email, "Reset your password – Auth System", html)
    return {"msg": "Reset password link sent"}

async def reset_password_with_token(session:AsyncSession,token:str,new_password:str):
    user_id = verify_token_and_get_user_id(token,"reset")
    if not user_id:
        raise HTTPException(status_code=400,detail="Invalid or expired token")
    user = await session.get(User,user_id)
    if not user:
        raise HTTPException(status_code=404,detail="User not found")
    return await change_password(session, user, new_password)


# -------------------- Admin services --------------------

def _apply_user_filters(stmt, search: str | None, role: str | None, status: str | None):
    if search is not None:
        s = search.strip()
        if s:
            pattern = f"%{s}%"
            stmt = stmt.where(or_(User.name.ilike(pattern), User.email.ilike(pattern)))
    if role == "admin":
        stmt = stmt.where(User.is_admin == True)
    elif role == "user":
        stmt = stmt.where(User.is_admin == False)
    if status == "active":
        stmt = stmt.where(User.is_active == True)
    elif status == "inactive":
        stmt = stmt.where(User.is_active == False)
    return stmt


async def list_users(
    session: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    sort_by: str = "created_at",
    order: str = "desc",
    role: str | None = None,
    status: str | None = None,
):
    if sort_by not in _SORT_COLUMNS:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid order")
    if role is not None and role not in {"admin", "user"}:
        raise HTTPException(status_code=400, detail="Invalid role filter")
    if status is not None and status not in {"active", "inactive"}:
        raise HTTPException(status_code=400, detail="Invalid status filter")

    page = max(1, page)
    page_size = min(max(1, page_size), 100)

    base = _apply_user_filters(select(User), search, role, status)
    total = await session.scalar(select(func.count()).select_from(base.subquery()))
    direction = asc if order == "asc" else desc
    stmt = (
        base.order_by(direction(_SORT_COLUMNS[sort_by]))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await session.scalars(stmt)).all()

    return {"items": items, "total": total, "page": page, "page_size": page_size}


async def user_stats(session: AsyncSession):
    total = await session.scalar(select(func.count()).select_from(User))
    active = await session.scalar(
        select(func.count()).select_from(User).where(User.is_active == True)
    )
    admins = await session.scalar(
        select(func.count()).select_from(User).where(User.is_admin == True)
    )
    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
    new_this_month = await session.scalar(
        select(func.count()).select_from(User).where(User.created_at >= month_start)
    )
    return {
        "total": total or 0,
        "active": active or 0,
        "admins": admins or 0,
        "new_this_month": new_this_month or 0,
    }


async def get_user_by_id(session: AsyncSession, user_id: int) -> User:
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


async def toggle_user_active(session: AsyncSession, actor: User, target_id: int):
    target = await get_user_by_id(session, target_id)
    if actor.id == target.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account")
    if target.is_admin:
        raise HTTPException(status_code=403, detail="Cannot modify another admin's account")

    target.is_active = not target.is_active
    session.add(target)
    await session.commit()
    await session.refresh(target)

    if not target.is_active:
        await revoke_all_user_tokens(session, target.id)

    msg = "User activated" if target.is_active else "User deactivated"
    return {"msg": msg, "user": target}


async def toggle_user_admin(session: AsyncSession, actor: User, target_id: int):
    target = await get_user_by_id(session, target_id)
    if actor.id == target.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account")
    if target.is_admin:
        raise HTTPException(status_code=403, detail="Cannot modify another admin's account")

    target.is_admin = not target.is_admin
    session.add(target)
    await session.commit()
    await session.refresh(target)

    msg = "Admin role granted" if target.is_admin else "Admin role revoked"
    return {"msg": msg, "user": target}


async def create_user_as_admin(session: AsyncSession, payload: AdminUserCreate) -> User:
    existing = await get_user_by_email(session, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = User(
        name=payload.name.strip(),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_admin=payload.is_admin,
        is_active=True,
        is_verified=False,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return new_user


async def export_users_csv(
    session: AsyncSession,
    search: str | None = None,
    sort_by: str = "created_at",
    order: str = "desc",
    role: str | None = None,
    status: str | None = None,
) -> str:
    if sort_by not in _SORT_COLUMNS:
        raise HTTPException(status_code=400, detail="Invalid sort field")
    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Invalid order")

    base = _apply_user_filters(select(User), search, role, status)
    direction = asc if order == "asc" else desc
    stmt = base.order_by(direction(_SORT_COLUMNS[sort_by]))
    items = (await session.scalars(stmt)).all()

    import csv
    import io
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "id", "name", "email", "is_active", "is_verified",
        "is_admin", "created_at", "updated_at",
    ])
    for u in items:
        w.writerow([
            u.id,
            u.name,
            u.email,
            u.is_active,
            u.is_verified,
            u.is_admin,
            u.created_at.isoformat() if u.created_at else "",
            u.updated_at.isoformat() if u.updated_at else "",
        ])
    return buf.getvalue()
