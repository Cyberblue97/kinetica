from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from models.database import (
    GymType,
    PaymentMethod,
    PaymentStatus,
    SessionStatus,
    UserRole,
)

# --- Auth ---


class TrainerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=6)
    phone: Optional[str] = None


class TrainerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = None
    is_active: Optional[bool] = None


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = None
    gym_name: str = Field(min_length=1, max_length=200)
    gym_type: GymType = GymType.gym


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int
    gym_id: int
    role: UserRole


class UserResponse(BaseModel):
    id: int
    gym_id: int
    email: str
    name: str
    role: UserRole
    phone: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Gym ---


class GymCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: GymType = GymType.gym
    address: Optional[str] = None
    phone: Optional[str] = None


class GymResponse(BaseModel):
    id: int
    name: str
    type: GymType
    address: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Package ---


class PackageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    total_sessions: int = Field(gt=0)
    price: int = Field(ge=0)
    validity_days: int = Field(gt=0, default=90)


class PackageUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    total_sessions: Optional[int] = Field(default=None, gt=0)
    price: Optional[int] = Field(default=None, ge=0)
    validity_days: Optional[int] = Field(default=None, gt=0)
    is_active: Optional[bool] = None


class PackageResponse(BaseModel):
    id: int
    gym_id: int
    name: str
    description: Optional[str]
    total_sessions: int
    price: int
    validity_days: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Member ---


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    notes: Optional[str] = None
    trainer_id: Optional[int] = None
    goals: List[str] = []


class MemberUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    notes: Optional[str] = None
    trainer_id: Optional[int] = None
    is_active: Optional[bool] = None
    goals: Optional[List[str]] = None


class MemberPackageSummary(BaseModel):
    id: int
    package_id: int
    sessions_total: int
    sessions_remaining: int
    price_paid: int
    payment_status: PaymentStatus
    start_date: date
    expiry_date: date

    model_config = {"from_attributes": True}


class MemberResponse(BaseModel):
    id: int
    gym_id: int
    trainer_id: Optional[int]
    trainer: Optional["TrainerBasic"] = None
    name: str
    email: Optional[str]
    phone: Optional[str]
    birth_date: Optional[date]
    notes: Optional[str]
    goals: List[str] = []
    is_active: bool
    created_at: datetime
    member_packages: List[MemberPackageSummary] = []

    model_config = {"from_attributes": True}


# --- MemberPackage (Payments) ---


class MemberPackageCreate(BaseModel):
    member_id: int
    package_id: int
    price_paid: int = Field(ge=0)
    payment_method: PaymentMethod = PaymentMethod.card
    payment_status: PaymentStatus = PaymentStatus.paid
    start_date: date
    notes: Optional[str] = None


class MemberPackageUpdate(BaseModel):
    payment_method: Optional[PaymentMethod] = None
    payment_status: Optional[PaymentStatus] = None
    notes: Optional[str] = None
    sessions_remaining: Optional[int] = Field(None, ge=0)


class MemberPackageResponse(BaseModel):
    id: int
    member_id: int
    package_id: int
    sessions_total: int
    sessions_remaining: int
    price_paid: int
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    start_date: date
    expiry_date: date
    notes: Optional[str]
    created_at: datetime
    member: Optional["MemberBasic"] = None
    package: Optional[PackageResponse] = None

    model_config = {"from_attributes": True}


class MemberBasic(BaseModel):
    id: int
    name: str
    phone: Optional[str]
    email: Optional[str]

    model_config = {"from_attributes": True}


MemberPackageResponse.model_rebuild()


# --- Session ---


class SessionCreate(BaseModel):
    member_id: int
    trainer_id: int
    member_package_id: Optional[int] = None
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, gt=0)
    notes: Optional[str] = None

    @field_validator("scheduled_at")
    @classmethod
    def strip_timezone(cls, v: datetime) -> datetime:
        return v.replace(tzinfo=None)


class SessionUpdate(BaseModel):
    status: Optional[SessionStatus] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(default=None, gt=0)
    notes: Optional[str] = None


class SessionResponse(BaseModel):
    id: int
    member_id: int
    trainer_id: int
    member_package_id: Optional[int]
    scheduled_at: datetime
    duration_minutes: int
    status: SessionStatus
    notes: Optional[str]
    created_at: datetime
    member: Optional[MemberBasic] = None
    trainer: Optional["TrainerBasic"] = None

    model_config = {"from_attributes": True}


class TrainerBasic(BaseModel):
    id: int
    name: str
    phone: Optional[str]

    model_config = {"from_attributes": True}


MemberResponse.model_rebuild()
SessionResponse.model_rebuild()


# --- Dashboard ---


class DashboardStats(BaseModel):
    today_sessions: int
    expiring_packages_this_week: int
    unpaid_members: int
    active_members: int


class TodaySession(BaseModel):
    id: int
    scheduled_at: datetime
    duration_minutes: int
    status: SessionStatus
    member_name: str
    trainer_name: str

    model_config = {"from_attributes": True}


class ExpiringPackage(BaseModel):
    id: int
    member_name: str
    package_name: str
    sessions_remaining: int
    expiry_date: date
