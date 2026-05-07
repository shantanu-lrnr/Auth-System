from pydantic import BaseModel, EmailStr
from datetime import datetime

class UserBase(BaseModel):
    name:str
    email:EmailStr

class UserCreate(UserBase):
    password:str

class UserUpdate(BaseModel):
    name:str

class UserOut(UserBase):
    id:int
    is_active:bool
    is_verified:bool
    created_at:datetime
    updated_at:datetime

    model_config = {
        "from_attributes":True
    }