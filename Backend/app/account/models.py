from sqlalchemy.orm import mapped_column, Mapped,relationship
from sqlalchemy import BooleanClauseList, Integer,String,Boolean,DateTime,ForeignKey
from datetime import datetime, timezone
from app.db.config import Base


class User(Base):
    __tablename__ = "user"

    id:Mapped[int] = mapped_column(Integer,primary_key=True)
    name:Mapped[str] = mapped_column(String,nullable=False)
    email:Mapped[str] = mapped_column(String,unique=True,nullable=False,index=True)
    hashed_password:Mapped[str] = mapped_column(String,nullable=False)
    is_active:Mapped[bool] = mapped_column(Boolean,default=True)
    is_verified:Mapped[bool] = mapped_column(Boolean,default=False)
    is_admin:Mapped[bool] = mapped_column(Boolean,default=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    refresh_tokens:Mapped[list["RefreshToken"]] = relationship("RefreshToken",back_populates="user",cascade="all,delete")
    
class RefreshToken(Base):
    __tablename__ = "refresh_token"

    id:Mapped[int] = mapped_column(Integer,primary_key=True)
    user_id:Mapped[int] = mapped_column(Integer,ForeignKey("user.id",ondelete="CASCADE"))

    token:Mapped[str] = mapped_column(String,nullable=False,unique=True)
    revoked:Mapped[bool] = mapped_column(Boolean,default=False)
    expires_at:Mapped[datetime] = mapped_column(DateTime(timezone=True),nullable=False)
    created_at:Mapped[datetime] = mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc))

    user:Mapped["User"] = relationship("User",back_populates="refresh_tokens")
    
