from datetime import date, datetime, time
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.database import (
    Member,
    MemberPackage,
    Session,
    SessionStatus,
    User,
    UserRole,
    get_db,
)
from models.schemas import SessionCreate, SessionResponse, SessionUpdate
from services.auth import get_current_user

router = APIRouter()


@router.get("", response_model=List[SessionResponse])
async def list_sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
    filter_date: Optional[date] = Query(default=None, alias="date"),
):
    query = (
        select(Session)
        .join(Member, Session.member_id == Member.id)
        .where(Member.gym_id == current_user.gym_id)
        .options(selectinload(Session.member), selectinload(Session.trainer))
        .order_by(Session.scheduled_at)
    )
    if current_user.role == UserRole.trainer:
        query = query.where(Session.trainer_id == current_user.id)
    if filter_date:
        day_start = datetime.combine(filter_date, time.min)
        day_end = datetime.combine(filter_date, time.max)
        query = query.where(Session.scheduled_at.between(day_start, day_end))

    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
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

    trainer_result = await db.execute(
        select(User).where(
            User.id == payload.trainer_id, User.gym_id == current_user.gym_id
        )
    )
    if not trainer_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Trainer not found"
        )

    if payload.member_package_id:
        mp_result = await db.execute(
            select(MemberPackage).where(
                MemberPackage.id == payload.member_package_id,
                MemberPackage.member_id == payload.member_id,
            )
        )
        if not mp_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Member package not found for this member",
            )

    session = Session(
        member_id=payload.member_id,
        trainer_id=payload.trainer_id,
        member_package_id=payload.member_package_id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        notes=payload.notes,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session, ["member", "trainer"])
    return session


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    payload: SessionUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session)
        .join(Member, Session.member_id == Member.id)
        .where(Session.id == session_id, Member.gym_id == current_user.gym_id)
        .options(selectinload(Session.member), selectinload(Session.trainer))
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    if current_user.role == UserRole.trainer and session.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    previous_status = session.status

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, value)

    # Decrement sessions_remaining when a session is marked completed
    if (
        payload.status == SessionStatus.completed
        and previous_status != SessionStatus.completed
    ):
        if session.member_package_id:
            mp_result = await db.execute(
                select(MemberPackage).where(
                    MemberPackage.id == session.member_package_id
                )
            )
            mp = mp_result.scalar_one_or_none()
            if mp and mp.sessions_remaining > 0:
                mp.sessions_remaining -= 1

    # Restore sessions_remaining if un-completing a previously completed session
    if (
        previous_status == SessionStatus.completed
        and payload.status
        and payload.status != SessionStatus.completed
    ):
        if session.member_package_id:
            mp_result = await db.execute(
                select(MemberPackage).where(
                    MemberPackage.id == session.member_package_id
                )
            )
            mp = mp_result.scalar_one_or_none()
            if mp:
                mp.sessions_remaining += 1

    await db.commit()
    await db.refresh(session, ["member", "trainer"])
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Session)
        .join(Member, Session.member_id == Member.id)
        .where(Session.id == session_id, Member.gym_id == current_user.gym_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    if current_user.role == UserRole.trainer and session.trainer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )

    if session.status == SessionStatus.completed and session.member_package_id:
        mp_result = await db.execute(
            select(MemberPackage).where(MemberPackage.id == session.member_package_id)
        )
        mp = mp_result.scalar_one_or_none()
        if mp:
            mp.sessions_remaining += 1

    await db.delete(session)
    await db.commit()
