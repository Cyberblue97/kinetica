import enum
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import ARRAY, Boolean, Date, DateTime
from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from config import settings


class UserRole(str, enum.Enum):
    owner = "owner"
    trainer = "trainer"
    member = "member"


class GymType(str, enum.Enum):
    gym = "gym"
    personal_studio = "personal_studio"


class SessionStatus(str, enum.Enum):
    scheduled = "scheduled"
    completed = "completed"
    no_show = "no_show"
    cancelled = "cancelled"


class PaymentMethod(str, enum.Enum):
    cash = "cash"
    card = "card"
    transfer = "transfer"
    online_mock = "online_mock"


class PaymentStatus(str, enum.Enum):
    paid = "paid"
    pending = "pending"
    overdue = "overdue"


class Base(DeclarativeBase):
    pass


class Gym(Base):
    __tablename__ = "gyms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[GymType] = mapped_column(
        SAEnum(GymType), default=GymType.gym, nullable=False
    )
    address: Mapped[Optional[str]] = mapped_column(String(500))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    users: Mapped[List["User"]] = relationship("User", back_populates="gym")
    members: Mapped[List["Member"]] = relationship("Member", back_populates="gym")
    packages: Mapped[List["Package"]] = relationship("Package", back_populates="gym")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    gym_id: Mapped[int] = mapped_column(Integer, ForeignKey("gyms.id"), nullable=False)
    email: Mapped[str] = mapped_column(
        String(254), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(500), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), default=UserRole.trainer, nullable=False
    )
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    gym: Mapped["Gym"] = relationship("Gym", back_populates="users")
    assigned_members: Mapped[List["Member"]] = relationship(
        "Member", back_populates="trainer"
    )
    sessions: Mapped[List["Session"]] = relationship(
        "Session", back_populates="trainer"
    )


class Member(Base):
    __tablename__ = "members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    gym_id: Mapped[int] = mapped_column(Integer, ForeignKey("gyms.id"), nullable=False)
    trainer_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(254), index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    birth_date: Mapped[Optional[date]] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    goals: Mapped[List[str]] = mapped_column(
        ARRAY(String), server_default="{}", nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    gym: Mapped["Gym"] = relationship("Gym", back_populates="members")
    trainer: Mapped[Optional["User"]] = relationship(
        "User", back_populates="assigned_members"
    )
    member_packages: Mapped[List["MemberPackage"]] = relationship(
        "MemberPackage", back_populates="member"
    )
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="member")


class Package(Base):
    __tablename__ = "packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    gym_id: Mapped[int] = mapped_column(Integer, ForeignKey("gyms.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    total_sessions: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)  # stored in KRW (won)
    validity_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    gym: Mapped["Gym"] = relationship("Gym", back_populates="packages")
    member_packages: Mapped[List["MemberPackage"]] = relationship(
        "MemberPackage", back_populates="package"
    )


class MemberPackage(Base):
    __tablename__ = "member_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("members.id"), nullable=False
    )
    package_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("packages.id"), nullable=False
    )
    sessions_total: Mapped[int] = mapped_column(Integer, nullable=False)
    sessions_remaining: Mapped[int] = mapped_column(Integer, nullable=False)
    price_paid: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod), default=PaymentMethod.card, nullable=False
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus), default=PaymentStatus.paid, nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    member: Mapped["Member"] = relationship("Member", back_populates="member_packages")
    package: Mapped["Package"] = relationship(
        "Package", back_populates="member_packages"
    )
    sessions: Mapped[List["Session"]] = relationship(
        "Session", back_populates="member_package"
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    member_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("members.id"), nullable=False
    )
    trainer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    member_package_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("member_packages.id"), nullable=True
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus), default=SessionStatus.scheduled, nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    member: Mapped["Member"] = relationship("Member", back_populates="sessions")
    trainer: Mapped["User"] = relationship("User", back_populates="sessions")
    member_package: Mapped[Optional["MemberPackage"]] = relationship(
        "MemberPackage", back_populates="sessions"
    )


engine = create_async_engine(settings.database_url, echo=False)
async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
