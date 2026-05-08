from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserBase(BaseModel):
    name:str
    email:EmailStr

class UserCreate(UserBase):
    password:str

class UserUpdate(BaseModel):
    name: str

class UserOut(UserBase):
    id:int
    is_active:bool
    is_verified:bool
    is_admin:bool
    created_at:datetime
    updated_at:datetime

    model_config = {
        "from_attributes":True
    }

class UserListOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int

class AdminActionOut(BaseModel):
    msg: str
    user: UserOut

class UserStatsOut(BaseModel):
    total: int
    active: int
    admins: int
    new_this_month: int

class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    is_admin: bool = False