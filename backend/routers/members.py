from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.database import Member, MemberPackage, Session, User, UserRole, get_db
from models.schemas import (
    MemberCreate,
    MemberPackageResponse,
    MemberResponse,
    MemberUpdate,
    SessionResponse,
)
from services.auth import get_current_user

router = APIRouter()


def _member_query(gym_id: int, user: User):
    query = (
        select(Member)
        .where(Member.gym_id == gym_id, Member.is_active == True)
        .options(selectinload(Member.member_packages), selectinload(Member.trainer))
    )
    if user.role == UserRole.trainer:
        query = query.where(Member.trainer_id == user.id)
    return query


@router.get("", response_model=List[MemberResponse])
async def list_members(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(_member_query(current_user.gym_id, current_user))
    return result.scalars().all()


@router.post("", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
async def create_member(
    payload: MemberCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    if payload.trainer_id:
        trainer = await db.execute(
            select(User).where(
                User.id == payload.trainer_id, User.gym_id == current_user.gym_id
            )
        )
        if not trainer.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trainer not found in this gym",
            )

    member = Member(
        gym_id=current_user.gym_id,
        trainer_id=payload.trainer_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        birth_date=payload.birth_date,
        notes=payload.notes,
        goals=payload.goals,
    )
    db.add(member)
    await db.commit()
    result = await db.execute(
        select(Member)
        .where(Member.id == member.id)
        .options(selectinload(Member.member_packages), selectinload(Member.trainer))
    )
    return result.scalar_one()


@router.get("/{member_id}", response_model=MemberResponse)
async def get_member(
    member_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Member)
        .where(Member.id == member_id, Member.gym_id == current_user.gym_id)
        .options(selectinload(Member.member_packages), selectinload(Member.trainer))
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    if current_user.role == UserRole.trainer and member.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )
    return member


@router.put("/{member_id}", response_model=MemberResponse)
async def update_member(
    member_id: int,
    payload: MemberUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Member)
        .where(Member.id == member_id, Member.gym_id == current_user.gym_id)
        .options(selectinload(Member.member_packages), selectinload(Member.trainer))
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    if current_user.role == UserRole.trainer and member.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    if payload.trainer_id is not None:
        trainer = await db.execute(
            select(User).where(
                User.id == payload.trainer_id, User.gym_id == current_user.gym_id
            )
        )
        if not trainer.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trainer not found in this gym",
            )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(member, field, value)

    await db.commit()
    result = await db.execute(
        select(Member)
        .where(Member.id == member_id)
        .options(selectinload(Member.member_packages), selectinload(Member.trainer))
    )
    return result.scalar_one()


@router.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_member(
    member_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Member).where(
            Member.id == member_id, Member.gym_id == current_user.gym_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    if current_user.role == UserRole.trainer and member.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    member.is_active = False
    await db.commit()


@router.get("/{member_id}/sessions", response_model=List[SessionResponse])
async def get_member_sessions(
    member_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    member_result = await db.execute(
        select(Member).where(
            Member.id == member_id, Member.gym_id == current_user.gym_id
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    if current_user.role == UserRole.trainer and member.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    result = await db.execute(
        select(Session)
        .where(Session.member_id == member_id)
        .options(selectinload(Session.trainer))
        .order_by(Session.scheduled_at.desc())
    )
    return result.scalars().all()


@router.get("/{member_id}/packages", response_model=List[MemberPackageResponse])
async def get_member_packages(
    member_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    member_result = await db.execute(
        select(Member).where(
            Member.id == member_id, Member.gym_id == current_user.gym_id
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )
    if current_user.role == UserRole.trainer and member.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    result = await db.execute(
        select(MemberPackage)
        .where(MemberPackage.member_id == member_id)
        .options(
            selectinload(MemberPackage.member),
            selectinload(MemberPackage.package),
        )
        .order_by(MemberPackage.created_at.desc())
    )
    return result.scalars().all()
