from typing import Annotated, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import Package, User, get_db
from models.schemas import PackageCreate, PackageResponse, PackageUpdate
from services.auth import get_current_user, require_owner

router = APIRouter()


@router.get("", response_model=List[PackageResponse])
async def list_packages(
    current_user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Package).where(
            Package.gym_id == current_user.gym_id, Package.is_active == True
        )
    )
    return result.scalars().all()


@router.post("", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
async def create_package(
    payload: PackageCreate,
    current_user: Annotated[User, Depends(require_owner)],
    db: AsyncSession = Depends(get_db),
):
    package = Package(
        gym_id=current_user.gym_id,
        name=payload.name,
        description=payload.description,
        total_sessions=payload.total_sessions,
        price=payload.price,
        validity_days=payload.validity_days,
    )
    db.add(package)
    await db.commit()
    await db.refresh(package)
    return package


@router.put("/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: int,
    payload: PackageUpdate,
    current_user: Annotated[User, Depends(require_owner)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Package).where(
            Package.id == package_id, Package.gym_id == current_user.gym_id
        )
    )
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(package, field, value)

    await db.commit()
    await db.refresh(package)
    return package


@router.delete("/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    package_id: int,
    current_user: Annotated[User, Depends(require_owner)],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Package).where(
            Package.id == package_id, Package.gym_id == current_user.gym_id
        )
    )
    package = result.scalar_one_or_none()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    package.is_active = False
    await db.commit()
