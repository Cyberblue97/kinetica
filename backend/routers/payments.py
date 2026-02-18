from datetime import timedelta
from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import contains_eager, selectinload

from models.database import Member, MemberPackage, Package, User, UserRole, get_db
from models.schemas import (
    MemberPackageCreate,
    MemberPackageResponse,
    MemberPackageUpdate,
)
from services.auth import get_current_user

router = APIRouter()


@router.get("", response_model=List[MemberPackageResponse])
async def list_payments(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(MemberPackage)
        .join(Member, MemberPackage.member_id == Member.id)
        .where(Member.gym_id == current_user.gym_id)
        .options(
            contains_eager(MemberPackage.member),
            selectinload(MemberPackage.package),
        )
        .order_by(MemberPackage.created_at.desc())
    )
    if current_user.role == UserRole.trainer:
        query = query.where(Member.trainer_id == current_user.id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post(
    "", response_model=MemberPackageResponse, status_code=status.HTTP_201_CREATED
)
async def create_payment(
    payload: MemberPackageCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    member_result = await db.execute(
        select(Member).where(
            Member.id == payload.member_id,
            Member.gym_id == current_user.gym_id,
            Member.is_active == True,
        )
    )
    member = member_result.scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Member not found"
        )

    package_result = await db.execute(
        select(Package).where(
            Package.id == payload.package_id,
            Package.gym_id == current_user.gym_id,
            Package.is_active == True,
        )
    )
    package = package_result.scalar_one_or_none()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    expiry_date = payload.start_date + timedelta(days=package.validity_days)

    mp = MemberPackage(
        member_id=payload.member_id,
        package_id=payload.package_id,
        sessions_total=package.total_sessions,
        sessions_remaining=package.total_sessions,
        price_paid=payload.price_paid,
        payment_method=payload.payment_method,
        payment_status=payload.payment_status,
        start_date=payload.start_date,
        expiry_date=expiry_date,
        notes=payload.notes,
    )
    db.add(mp)
    await db.commit()
    result = await db.execute(
        select(MemberPackage)
        .where(MemberPackage.id == mp.id)
        .options(
            selectinload(MemberPackage.member),
            selectinload(MemberPackage.package),
        )
    )
    return result.scalar_one()


@router.get("/{payment_id}", response_model=MemberPackageResponse)
async def get_payment(
    payment_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MemberPackage)
        .join(Member, MemberPackage.member_id == Member.id)
        .where(MemberPackage.id == payment_id, Member.gym_id == current_user.gym_id)
        .options(
            contains_eager(MemberPackage.member),
            selectinload(MemberPackage.package),
        )
    )
    mp = result.scalar_one_or_none()
    if not mp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found"
        )
    if current_user.role == UserRole.trainer:
        member = mp.member
        if member.trainer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
            )
    return mp


@router.put("/{payment_id}", response_model=MemberPackageResponse)
async def update_payment(
    payment_id: int,
    payload: MemberPackageUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MemberPackage)
        .join(Member, MemberPackage.member_id == Member.id)
        .where(MemberPackage.id == payment_id, Member.gym_id == current_user.gym_id)
        .options(
            contains_eager(MemberPackage.member),
            selectinload(MemberPackage.package),
        )
    )
    mp = result.scalar_one_or_none()
    if not mp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(mp, field, value)

    await db.commit()
    result = await db.execute(
        select(MemberPackage)
        .join(Member, MemberPackage.member_id == Member.id)
        .where(MemberPackage.id == payment_id, Member.gym_id == current_user.gym_id)
        .options(
            contains_eager(MemberPackage.member),
            selectinload(MemberPackage.package),
        )
    )
    return result.scalar_one()
