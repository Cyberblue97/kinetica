from typing import Annotated, List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import User, UserRole, get_db
from models.schemas import UserResponse
from services.auth import get_current_user

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
            User.is_active == True,
        )
    )
    return result.scalars().all()
