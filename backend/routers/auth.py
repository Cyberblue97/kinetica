from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Gym, User, UserRole, get_db
from models.schemas import Token, UserCreate, UserLogin, UserResponse
from services.auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
)

router = APIRouter()


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    gym = Gym(
        name=payload.gym_name,
        type=payload.gym_type,
    )
    db.add(gym)
    await db.flush()  # get gym.id before inserting user

    user = User(
        gym_id=gym.id,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        name=payload.name,
        phone=payload.phone,
        role=UserRole.owner,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.email == payload.email, User.is_active == True)
    )
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    token = create_access_token(
        {"sub": str(user.id), "gym_id": str(user.gym_id), "role": user.role.value}
    )
    return Token(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
