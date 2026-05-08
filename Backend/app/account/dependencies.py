from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends, HTTPException
from app.db.config import SessionDep
from app.account.utils import decode_token
from app.account.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="account/login")

async def get_current_user(session:SessionDep,token:str=Depends(oauth2_scheme)):
    payload = decode_token(token)
    if payload:
        sub = int(payload.get("sub"))
        user = await session.get(User,sub)
        if not user:
            raise HTTPException(status_code=404,detail="User not found")
        if not user.is_active:
            raise HTTPException(status_code=401,detail="Your account has been blocked due to policy violations. Contact an administrator.")
        return user

    raise HTTPException(
        status_code=401,
        detail="Invalid Credentials"
    )

async def required_admin(user:User=Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403,detail="Only admin can access this resource")
    return user
