import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models import CropType, CycleStatus


class MessageResponse(BaseModel):
    message: str


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    phone: str | None
    role: str
    status: str
    must_change_password: bool


class SessionOut(BaseModel):
    user: UserOut
    csrf_token: str


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class FarmCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    location: str = Field(min_length=1, max_length=255)

    @field_validator("name", "location")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field tidak boleh kosong")
        return cleaned


FarmUpdateRequest = FarmCreateRequest


class FarmOut(BaseModel):
    id: str
    name: str
    location: str
    farmer_id: str
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CropCycleCreateRequest(BaseModel):
    crop: CropType
    variety: str = Field(min_length=1, max_length=100)
    planting_date: date
    area: float = Field(gt=0, le=10_000)
    location: str = Field(min_length=1, max_length=255)
    lifecycle_status: CycleStatus = CycleStatus.growing
    soil_inputs: dict[str, Any] | None = None

    @field_validator("variety", "location")
    @classmethod
    def strip_required(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field tidak boleh kosong")
        return cleaned


class CropCycleUpdateRequest(CropCycleCreateRequest):
    farm_id: str | None = None


class CropCycleOut(BaseModel):
    id: str
    farm_id: str
    crop: str
    variety: str
    planting_date: date
    area: float
    location: str
    lifecycle_status: str
    actual_harvest_date: date | None = None
    actual_yield: float | None = None
    yield_unit: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PredictionOut(BaseModel):
    id: str
    feature_type: str
    model_version: str
    inputs_snapshot: dict[str, Any]
    output: dict[str, Any]
    confidence: float | None
    assumptions: str | None
    explanation: str | None
    recommendation: str | None
    provenance: dict[str, Any] | None
    client_operation_id: str
    created_at: datetime
    crop_cycle_id: str
    farm_id: str


class SyncPredictionRequest(BaseModel):
    client_operation_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    farm_id: str
    crop_cycle_id: str
    feature_type: str
    model_version: str
    inputs_snapshot: dict[str, Any]
    output: dict[str, Any]
    confidence: float | None = None
    assumptions: str | None = None
    explanation: str | None = None
    recommendation: str | None = None
    provenance: dict[str, Any] | None = None


class HarvestRequest(BaseModel):
    crop_cycle_id: str
    variety_key: str | None = None


class SoilRequest(BaseModel):
    crop_cycle_id: str
    ph: float
    moisture: float
    nitrogen: float
    phosphorus: float
    potassium: float
    input_provenance: str = "manual"


class RejuvenationRequest(BaseModel):
    crop_cycle_id: str
    orchard_age: int
    productivity_decline: str
    canopy_condition: str


class MappingRequest(BaseModel):
    crop_cycle_id: str
    use_fixture: bool = True


class HarvestActualRequest(BaseModel):
    crop_cycle_id: str
    actual_harvest_date: date
    actual_yield: float | None = Field(default=None, ge=0)
    yield_unit: str | None = Field(default="kg", max_length=16)


class PredictionListOut(BaseModel):
    items: list[PredictionOut]
    page: int
    page_size: int
    total: int
    total_pages: int


class ReferenceEntryOut(BaseModel):
    id: int
    reference_type: str
    crop: str
    key_code: str
    display_value: str
    scientific_metadata: dict[str, Any] | None = None


class AdminCreateFarmerRequest(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None


class AdminCreateUserRequest(BaseModel):
    name: str
    email: str
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = None
    role: str = "farmer"


class HealthOut(BaseModel):
    status: str
    database: str
    model_available: bool
