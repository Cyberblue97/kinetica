from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from models.database import User, get_db
from models.schemas import TokenData, UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def verify_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        user_id: int = payload.get("sub")
        gym_id: int = payload.get("gym_id")
        role: str = payload.get("role")
        if user_id is None or gym_id is None or role is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
            )
        return TokenData(user_id=int(user_id), gym_id=int(gym_id), role=UserRole(role))
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User:
    token_data = verify_token(token)
    result = await db.execute(
        select(User).where(User.id == token_data.user_id, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


async def require_owner(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if current_user.role != UserRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required"
        )
    return current_user
