from datetime import date, datetime, time, timedelta
from typing import Annotated, List

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.database import (
    Member,
    MemberPackage,
    PaymentStatus,
    Session,
    SessionStatus,
    User,
    UserRole,
    get_db,
)
from models.schemas import DashboardStats, ExpiringPackage, TodaySession
from services.auth import get_current_user

router = APIRouter()


@router.get("", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    day_start = datetime.combine(today, time.min)
    day_end = datetime.combine(today, time.max)
    week_end = today + timedelta(days=7)

    # Today's sessions count
    sessions_query = (
        select(func.count(Session.id))
        .join(Member, Session.member_id == Member.id)
        .where(
            Member.gym_id == current_user.gym_id,
            Session.scheduled_at.between(day_start, day_end),
            Session.status != SessionStatus.cancelled,
        )
    )
    if current_user.role == UserRole.trainer:
        sessions_query = sessions_query.where(Session.trainer_id == current_user.id)
    today_sessions = (await db.execute(sessions_query)).scalar() or 0

    # Expiring packages this week
    expiring_query = (
        select(func.count(MemberPackage.id))
        .join(Member, MemberPackage.member_id == Member.id)
        .where(
            Member.gym_id == current_user.gym_id,
            Member.is_active == True,
            MemberPackage.expiry_date >= today,
            MemberPackage.expiry_date <= week_end,
            MemberPackage.sessions_remaining > 0,
        )
    )
    if current_user.role == UserRole.trainer:
        expiring_query = expiring_query.where(Member.trainer_id == current_user.id)
    expiring_count = (await db.execute(expiring_query)).scalar() or 0

    # Members with unpaid/pending packages
    unpaid_query = (
        select(func.count(func.distinct(MemberPackage.member_id)))
        .join(Member, MemberPackage.member_id == Member.id)
        .where(
            Member.gym_id == current_user.gym_id,
            Member.is_active == True,
            MemberPackage.payment_status.in_(
                [PaymentStatus.pending, PaymentStatus.overdue]
            ),
        )
    )
    if current_user.role == UserRole.trainer:
        unpaid_query = unpaid_query.where(Member.trainer_id == current_user.id)
    unpaid_members = (await db.execute(unpaid_query)).scalar() or 0

    # Total active members
    members_query = select(func.count(Member.id)).where(
        Member.gym_id == current_user.gym_id, Member.is_active == True
    )
    if current_user.role == UserRole.trainer:
        members_query = members_query.where(Member.trainer_id == current_user.id)
    active_members = (await db.execute(members_query)).scalar() or 0

    return DashboardStats(
        today_sessions=today_sessions,
        expiring_packages_this_week=expiring_count,
        unpaid_members=unpaid_members,
        active_members=active_members,
    )


@router.get("/today", response_model=List[TodaySession])
async def get_today_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    day_start = datetime.combine(today, time.min)
    day_end = datetime.combine(today, time.max)

    query = (
        select(Session)
        .join(Member, Session.member_id == Member.id)
        .where(
            Member.gym_id == current_user.gym_id,
            Session.scheduled_at.between(day_start, day_end),
            Session.status != SessionStatus.cancelled,
        )
        .options(selectinload(Session.member), selectinload(Session.trainer))
        .order_by(Session.scheduled_at)
    )
    if current_user.role == UserRole.trainer:
        query = query.where(Session.trainer_id == current_user.id)

    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        TodaySession(
            id=s.id,
            scheduled_at=s.scheduled_at,
            duration_minutes=s.duration_minutes,
            status=s.status,
            member_name=s.member.name,
            trainer_name=s.trainer.name,
        )
        for s in sessions
    ]


@router.get("/expiring", response_model=List[ExpiringPackage])
async def get_expiring_packages(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    week_end = today + timedelta(days=7)

    query = (
        select(MemberPackage)
        .join(Member, MemberPackage.member_id == Member.id)
        .where(
            Member.gym_id == current_user.gym_id,
            Member.is_active == True,
            MemberPackage.expiry_date >= today,
            MemberPackage.expiry_date <= week_end,
            MemberPackage.sessions_remaining > 0,
        )
        .options(
            selectinload(MemberPackage.member), selectinload(MemberPackage.package)
        )
        .order_by(MemberPackage.expiry_date)
    )
    if current_user.role == UserRole.trainer:
        query = query.where(Member.trainer_id == current_user.id)

    result = await db.execute(query)
    packages = result.scalars().all()

    return [
        ExpiringPackage(
            id=mp.id,
            member_name=mp.member.name,
            package_name=mp.package.name,
            sessions_remaining=mp.sessions_remaining,
            expiry_date=mp.expiry_date,
        )
        for mp in packages
    ]
