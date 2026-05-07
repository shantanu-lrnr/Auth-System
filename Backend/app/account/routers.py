from fastapi import APIRouter, Request
from pydantic import EmailStr
from app.account.services import (
    create_user,
    authenticate_user,
    email_verification_link_send,
    verify_email_token,
    change_password,
    password_reset_link_send,
    reset_password_with_token,
    update_user_name
)
from app.account.models import User
from app.account.schemas import UserCreate, UserOut, UserUpdate
from fastapi import status,Depends,HTTPException
from app.db.config import SessionDep
from fastapi.security import OAuth2PasswordRequestForm
from app.account.utils import create_tokens, verify_refresh_token, revoke_refresh_token
from fastapi.responses import JSONResponse
from typing import Annotated
from app.account.dependencies import get_current_user, required_admin

router = APIRouter(prefix="/account",tags=["Account"])

@router.post("/register",response_model=UserOut,status_code=status.HTTP_201_CREATED)
async def register(session:SessionDep, user:UserCreate):
    return await create_user(session,user)

@router.post("/login")
async def login(session:SessionDep,form_data:OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(session,email=form_data.username,password=form_data.password)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )
    tokens = await create_tokens(session,user)

    response = JSONResponse(content={"access_token":tokens.get("access_token")})

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=True,
        samesite="lax",
        max_age= 60*60*24*7
    )

    return response

@router.post("/refresh")
async def refresh_token(session:SessionDep,request:Request):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing Refresh token."
        )
    user = await verify_refresh_token(session,token)

    if not user:
        raise HTTPException(
            status_code=401,
            detail = "Invalid or Expired refresh token"
        )


    # before creating new refresh token just revoked the previous one
    await revoke_refresh_token(session,token)
    
    tokens = await create_tokens(session,user)

    response = JSONResponse(content=tokens)

    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=60*60*24*7
    )

    return response

@router.get("/me",response_model=UserOut)
async def me(user:Annotated[User,Depends(get_current_user)]):
    return user

@router.patch("/me",response_model=UserOut)
async def update_me(session:SessionDep, payload:UserUpdate, user:Annotated[User,Depends(get_current_user)]):
    return await update_user_name(session, user, payload.name)

@router.post("/verify-request")
async def send_verification_email(user:Annotated[User,Depends(get_current_user)]):
    return email_verification_link_send(user)

@router.get("/verify")
async def verify_email(session:SessionDep,token:str):
    return await verify_email_token(session,token)

@router.post("/change-password")
async def password_change(session:SessionDep, new_password:str, user:Annotated[User, Depends(get_current_user)]):
    print(user)
    return await change_password(session, user, new_password)
    
@router.post("/forget-password")
async def forget_password(session:SessionDep,email:EmailStr):
    return await password_reset_link_send(session,email)

@router.post("/reset-password")
async def reset_password(session:SessionDep,token:str,new_password:str):
    return await reset_password_with_token(session,token,new_password)

@router.get("/admin")
async def admin(user:Annotated[User,Depends(required_admin)]):
    return {"msg":f"Welcome admin {user.name}"}

@router.post("/logout")
async def logout(session:SessionDep, request:Request):
    token = request.cookies.get("refresh_token")
    if token:
        await revoke_refresh_token(session, token)
    
    response = JSONResponse(content={"msg":"Logged out successfully"})

    response.delete_cookie("refresh_token")

    return response


# @router.patch("/update-user/{id}")
# async def update_user(id:int,session:SessionDep,user:UserCreate):
#     existing_user = await session.get(User,id)
#     existing_user.name=user.name
#     session.add(existing_user)
#     await session.commit()
#     await session.refresh(existing_user)
#     return existing_user

    