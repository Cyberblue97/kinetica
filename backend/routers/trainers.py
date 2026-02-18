from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import User, UserRole, get_db
from models.schemas import TrainerCreate, TrainerUpdate, UserResponse
from services.auth import get_current_user, get_password_hash

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def list_trainers(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.gym_id == current_user.gym_id,
            User.role == UserRole.trainer,
        )
    )
    return result.scalars().all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_trainer(
    payload: TrainerCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.owner:
        raise HTTPException(status_code=403, detail="Owner only")

    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    trainer = User(
        gym_id=current_user.gym_id,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        name=payload.name,
        phone=payload.phone,
        role=UserRole.trainer,
    )
    db.add(trainer)
    await db.commit()
    await db.refresh(trainer)
    return trainer


@router.put("/{trainer_id}", response_model=UserResponse)
async def update_trainer(
    trainer_id: int,
    payload: TrainerUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.owner:
        raise HTTPException(status_code=403, detail="Owner only")

    result = await db.execute(
        select(User).where(
            User.id == trainer_id,
            User.gym_id == current_user.gym_id,
            User.role == UserRole.trainer,
        )
    )
    trainer = result.scalar_one_or_none()
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")

    if payload.name is not None:
        trainer.name = payload.name
    if payload.phone is not None:
        trainer.phone = payload.phone
    if payload.is_active is not None:
        trainer.is_active = payload.is_active

    await db.commit()
    await db.refresh(trainer)
    return trainer


@router.delete("/{trainer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_trainer(
    trainer_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != UserRole.owner:
        raise HTTPException(status_code=403, detail="Owner only")

    result = await db.execute(
        select(User).where(
            User.id == trainer_id,
            User.gym_id == current_user.gym_id,
            User.role == UserRole.trainer,
        )
    )
    trainer = result.scalar_one_or_none()
    if not trainer:
        raise HTTPException(status_code=404, detail="Trainer not found")

    trainer.is_active = False
    await db.commit()
