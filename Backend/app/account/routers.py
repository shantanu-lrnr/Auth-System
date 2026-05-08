from fastapi import APIRouter, BackgroundTasks, Request, Query
from pydantic import EmailStr
from app.account.services import (
    create_user,
    authenticate_user,
    email_verification_link_send,
    verify_email_token,
    change_password,
    password_reset_link_send,
    reset_password_with_token,
    update_user_name,
    list_users,
    get_user_by_id,
    toggle_user_active,
    toggle_user_admin,
    user_stats,
    create_user_as_admin,
    export_users_csv,
)
from app.account.models import User
from app.account.schemas import (
    UserCreate,
    UserOut,
    UserUpdate,
    UserListOut,
    AdminActionOut,
    UserStatsOut,
    AdminUserCreate,
)
from fastapi.responses import Response
from datetime import datetime, timezone
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

@router.patch("/me", response_model=UserOut)
async def update_me(session: SessionDep, payload: UserUpdate, user: Annotated[User, Depends(get_current_user)]):
    return await update_user_name(session, user, payload.name)

@router.post("/verify-request")
async def send_verification_email(background:BackgroundTasks, user:Annotated[User,Depends(get_current_user)]):
    return email_verification_link_send(background, user)

@router.get("/verify")
async def verify_email(session:SessionDep,token:str):
    return await verify_email_token(session,token)

@router.post("/change-password")
async def password_change(session:SessionDep, new_password:str, user:Annotated[User, Depends(get_current_user)]):
    return await change_password(session, user, new_password)
    
@router.post("/forget-password")
async def forget_password(session:SessionDep, background:BackgroundTasks, email:EmailStr):
    return await password_reset_link_send(session, background, email)

@router.post("/reset-password")
async def reset_password(session:SessionDep,token:str,new_password:str):
    return await reset_password_with_token(session,token,new_password)

@router.post("/logout")
async def logout(session:SessionDep, request:Request):
    token = request.cookies.get("refresh_token")
    if token:
        await revoke_refresh_token(session, token)
    
    response = JSONResponse(content={"msg":"Logged out successfully"})

    response.delete_cookie("refresh_token")

    return response


# -------------------- Admin sub-router --------------------

admin_router = APIRouter(prefix="/admin/users", tags=["Admin"])


@admin_router.get("/", response_model=UserListOut)
async def admin_list_users(
    session: SessionDep,
    actor: Annotated[User, Depends(required_admin)],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
    role: str | None = Query(None),
    status: str | None = Query(None),
):
    return await list_users(session, page, page_size, search, sort_by, order, role, status)


@admin_router.get("/stats", response_model=UserStatsOut)
async def admin_user_stats(
    session: SessionDep,
    actor: Annotated[User, Depends(required_admin)],
):
    return await user_stats(session)


@admin_router.get("/export")
async def admin_export_users(
    session: SessionDep,
    actor: Annotated[User, Depends(required_admin)],
    search: str | None = Query(None),
    sort_by: str = Query("created_at"),
    order: str = Query("desc"),
    role: str | None = Query(None),
    status: str | None = Query(None),
):
    csv_text = await export_users_csv(session, search, sort_by, order, role, status)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="users-{today}.csv"'},
    )


@admin_router.post("/", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    session: SessionDep,
    actor: Annotated[User, Depends(required_admin)],
    payload: AdminUserCreate,
):
    return await create_user_as_admin(session, payload)


@admin_router.get("/{user_id}", response_model=UserOut)
async def admin_get_user(
    session: SessionDep,
    actor: Annotated[User, Depends(required_admin)],
    user_id: int,
):
    return await get_user_by_id(session, user_id)


@admin_router.patch("/{user_id}/toggle-active", response_model=AdminActionOut)
async def admin_toggle_active(
    session: SessionDep,
    actor: Annotated[User, Depends(required_admin)],
    user_id: int,
):
    return await toggle_user_active(session, actor, user_id)


@admin_router.patch("/{user_id}/toggle-admin", response_model=AdminActionOut)
async def admin_toggle_admin(
    session: SessionDep,
    actor: Annotated[User, Depends(required_admin)],
    user_id: int,
):
    return await toggle_user_admin(session, actor, user_id)


router.include_router(admin_router)
