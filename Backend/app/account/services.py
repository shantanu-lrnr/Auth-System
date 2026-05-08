from app.account.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from app.account.schemas import UserCreate
from app.account.utils import (
    get_user_by_email,
    hash_password,
    verify_password,
    create_email_verification_token,
    verify_token_and_get_user_id,
    create_password_reset_token
)
from app.account.email import send_email, render_action_email, APP_BASE_URL

from fastapi import BackgroundTasks, HTTPException


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
       