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

from fastapi import HTTPException


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

def email_verification_link_send(user:User):
    token = create_email_verification_token(user.id)
    link = f"http://localhost:8000/account/verify?token={token}"
    print("Verify your email:",link)
    return {"msg":"Verification email sent"}

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

async def change_password(session:AsyncSession,user:User,new_password:str):
    if verify_password(new_password,user.hashed_password):
        raise HTTPException(status_code=400,detail="New password cannot be same as old password")
    user.hashed_password = hash_password(new_password)
    session.add(user)
    await session.commit()
    return {"msg":"Password changed successfully"}
    
async def password_reset_link_send(session:AsyncSession,email:str):
    user = await get_user_by_email(session,email)
    if not user:
        raise HTTPException(status_code=404,detail="User with this email does not exist")
    token = create_password_reset_token(user.id)
    link = f"http://localhost:8000/account/reset-password?token={token}"
    print("Reset Password Link:",link)
    return {"msg":"Reset password link sent"}

async def reset_password_with_token(session:AsyncSession,token:str,new_password:str):
    user_id = verify_token_and_get_user_id(token,"reset")
    if not user_id:
        raise HTTPException(status_code=400,detail="Invalid or expired token")
    user = await session.get(User,user_id)
    if not user:
        raise HTTPException(status_code=404,detail="User not found")
    return await change_password(session, user, new_password)

async def update_user_name(session:AsyncSession,user:User,name:str) -> User:
    cleaned = name.strip() if name else ""
    if not cleaned:
        raise HTTPException(status_code=400,detail="Name cannot be empty")
    user.name = cleaned
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
       