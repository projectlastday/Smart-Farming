from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUserContext, get_current_user, require_csrf, require_roles
from app.db import get_db
from app.models import CropCycle, CropType, CycleStatus, Farm, Prediction, SavedImage, User, UserRole
from app.schemas import (
    CropCycleCreateRequest,
    CropCycleOut,
    CropCycleUpdateRequest,
    FarmCreateRequest,
    FarmOut,
    FarmUpdateRequest,
    HarvestActualRequest,
    HarvestRequest,
    MappingRequest,
    MessageResponse,
    PredictionListOut,
    PredictionOut,
    RejuvenationRequest,
    SoilRequest,
    SyncPredictionRequest,
)
from app.observability import snapshot_metrics
from app.services.features import FeatureService, mark_actual_harvest, save_prediction
from app.services.farms import (
    DependencyError,
    create_cycle_record,
    create_farm_record,
    cycle_out,
    delete_cycle_record,
    delete_farm_record,
    farm_out,
    update_cycle_record,
    update_farm_record,
)

router = APIRouter(tags=["core"])
feature_service = FeatureService()


def prediction_out(p: Prediction) -> PredictionOut:
    return PredictionOut(
        id=p.id,
        feature_type=p.feature_type,
        model_version=p.model_version,
        inputs_snapshot=p.inputs_snapshot,
        output=p.output,
        confidence=float(p.confidence) if p.confidence is not None else None,
        assumptions=p.assumptions,
        explanation=p.explanation,
        recommendation=p.recommendation,
        provenance=p.provenance,
        client_operation_id=p.client_operation_id,
        created_at=p.created_at,
        crop_cycle_id=p.crop_cycle_id,
        farm_id=p.farm_id,
    )


@router.get("/health/live")
def live():
    return {"status": "ok"}


@router.get("/health/ready")
def ready(db: Session = Depends(get_db)):
    from pathlib import Path
    from app.config import settings

    db.execute(__import__("sqlalchemy").text("SELECT 1"))
    model_ok = Path(settings.disease_model_path).exists() or Path(
        settings.resolved_disease_model_path
    ).exists()
    return {
        "status": "ready",
        "database": "ok",
        "model_available": model_ok,
        "nasa_power_enabled": settings.nasa_power_enabled,
        "soilgrids_live_enabled": settings.soilgrids_live_enabled,
    }


@router.get("/metrics")
def metrics():
    return {"status": "ok", **snapshot_metrics()}


@router.get("/farms", response_model=list[FarmOut])
def list_farms(ctx: CurrentUserContext = Depends(get_current_user), db: Session = Depends(get_db)):
    farms = db.query(Farm).filter(Farm.farmer_id == ctx.user.id).all()
    return [farm_out(f) for f in farms]


@router.post("/farms", response_model=FarmOut)
def create_farm(
    payload: FarmCreateRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    farm = create_farm_record(db, ctx.user, payload)
    db.commit()
    db.refresh(farm)
    return farm_out(farm)


@router.patch("/farms/{farm_id}", response_model=FarmOut)
def update_farm(
    farm_id: str,
    payload: FarmUpdateRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        farm = update_farm_record(db, ctx.user, farm_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(farm)
    return farm_out(farm)


@router.delete("/farms/{farm_id}", response_model=MessageResponse)
def delete_farm(
    farm_id: str,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        delete_farm_record(db, ctx.user, farm_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DependencyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    return MessageResponse(message="Lahan berhasil dihapus")


@router.get("/crop-cycles", response_model=list[CropCycleOut])
def list_cycles(ctx: CurrentUserContext = Depends(get_current_user), db: Session = Depends(get_db)):
    cycles = (
        db.query(CropCycle)
        .join(Farm)
        .filter(Farm.farmer_id == ctx.user.id)
        .all()
    )
    return [
        cycle_out(c)
        for c in cycles
    ]


@router.patch("/crop-cycles/{cycle_id}", response_model=CropCycleOut)
def update_cycle(
    cycle_id: str,
    payload: CropCycleUpdateRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    body = CropCycleCreateRequest.model_validate(payload.model_dump(exclude={"farm_id"}))
    try:
        cycle = update_cycle_record(
            db,
            ctx.user,
            cycle_id,
            body,
            farm_id=payload.farm_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(cycle)
    return cycle_out(cycle)


@router.delete("/crop-cycles/{cycle_id}", response_model=MessageResponse)
def delete_cycle(
    cycle_id: str,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        delete_cycle_record(db, ctx.user, cycle_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except DependencyError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    return MessageResponse(message="Siklus tanam berhasil dihapus")


@router.post("/farms/{farm_id}/crop-cycles", response_model=CropCycleOut)
def create_cycle_for_farm(
    farm_id: str,
    payload: CropCycleCreateRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        cycle = create_cycle_record(db, ctx.user, farm_id, payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(cycle)
    return cycle_out(cycle)


@router.get("/predictions", response_model=PredictionListOut)
def list_predictions(
    ctx: CurrentUserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
    crop_cycle_id: str | None = None,
    farm_id: str | None = None,
    feature_type: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    latest_per_feature: bool = False,
):
    query = db.query(Prediction).filter(Prediction.user_id == ctx.user.id)
    if crop_cycle_id:
        query = query.filter(Prediction.crop_cycle_id == crop_cycle_id)
    if farm_id:
        query = query.filter(Prediction.farm_id == farm_id)
    if feature_type:
        query = query.filter(Prediction.feature_type == feature_type)
    if date_from:
        query = query.filter(Prediction.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(
            Prediction.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        )
    if status == "applicable":
        extracted = func.json_unquote(func.json_extract(Prediction.output, "$.status"))
        query = query.filter(or_(extracted.is_(None), extracted != "not_applicable"))
    elif status:
        query = query.filter(
            func.json_unquote(func.json_extract(Prediction.output, "$.status")) == status
        )
    query = query.order_by(Prediction.created_at.desc(), Prediction.id.desc())
    start = (page - 1) * page_size
    if latest_per_feature:
        rows = query.all()
        seen: set[str] = set()
        latest_rows = []
        for row in rows:
            if row.feature_type in seen:
                continue
            seen.add(row.feature_type)
            latest_rows.append(row)
        total = len(latest_rows)
        page_rows = latest_rows[start : start + page_size]
    else:
        total = query.order_by(None).with_entities(func.count(Prediction.id)).scalar() or 0
        page_rows = query.offset(start).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size if total else 0
    return PredictionListOut(
        items=[prediction_out(p) for p in page_rows],
        page=page,
        page_size=page_size,
        total=total,
        total_pages=total_pages,
    )


@router.get("/predictions/{prediction_id}", response_model=PredictionOut)
def get_prediction(
    prediction_id: str,
    ctx: CurrentUserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(Prediction)
        .filter(Prediction.id == prediction_id, Prediction.user_id == ctx.user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Prediksi tidak ditemukan")
    return prediction_out(row)


@router.get("/predictions/{prediction_id}/image")
def get_saved_image(
    prediction_id: str,
    ctx: CurrentUserContext = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(Prediction)
        .filter(Prediction.id == prediction_id, Prediction.user_id == ctx.user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Prediksi tidak ditemukan")
    saved = db.query(SavedImage).filter(SavedImage.prediction_id == row.id).first()
    if not saved or not Path(saved.path).exists():
        raise HTTPException(status_code=404, detail="Gambar tidak ditemukan")
    return FileResponse(saved.path, media_type="image/jpeg")


@router.post("/predictions/sync", response_model=PredictionOut)
def sync_prediction(
    payload: SyncPredictionRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    cycle = (
        db.query(CropCycle)
        .join(Farm)
        .filter(
            CropCycle.id == payload.crop_cycle_id,
            Farm.farmer_id == ctx.user.id,
            Farm.id == payload.farm_id,
        )
        .first()
    )
    if not cycle:
        raise HTTPException(status_code=404, detail="Siklus tidak ditemukan")
    prediction = save_prediction(
        db,
        user=ctx.user,
        cycle=cycle,
        feature_type=payload.feature_type,
        model_version=payload.model_version,
        inputs_snapshot=payload.inputs_snapshot,
        output=payload.output,
        confidence=payload.confidence,
        assumptions=payload.assumptions,
        explanation=payload.explanation,
        recommendation=payload.recommendation,
        provenance=payload.provenance,
        client_operation_id=payload.client_operation_id,
    )
    db.commit()
    db.refresh(prediction)
    return prediction_out(prediction)


@router.post("/features/harvest", response_model=PredictionOut)
def harvest_feature(
    payload: HarvestRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        prediction = feature_service.run_harvest(
            db, ctx.user, payload.crop_cycle_id, payload.variety_key
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(prediction)
    return prediction_out(prediction)


@router.post("/features/soil", response_model=PredictionOut)
def soil_feature(
    payload: SoilRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        prediction = feature_service.run_soil(db, ctx.user, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(prediction)
    return prediction_out(prediction)


@router.post("/features/rejuvenation", response_model=PredictionOut)
def rejuvenation_feature(
    payload: RejuvenationRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        prediction = feature_service.run_rejuvenation(db, ctx.user, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(prediction)
    return prediction_out(prediction)


@router.post("/features/mapping", response_model=PredictionOut)
def mapping_feature(
    payload: MappingRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    try:
        prediction = feature_service.run_mapping(
            db, ctx.user, payload.crop_cycle_id, payload.use_fixture
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    db.commit()
    db.refresh(prediction)
    return prediction_out(prediction)


@router.post("/crop-cycles/{cycle_id}/harvest", response_model=CropCycleOut)
def mark_harvest(
    cycle_id: str,
    payload: HarvestActualRequest,
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    if payload.crop_cycle_id != cycle_id:
        raise HTTPException(status_code=400, detail="crop_cycle_id tidak cocok")
    try:
        cycle = mark_actual_harvest(
            db,
            ctx.user,
            crop_cycle_id=cycle_id,
            actual_harvest_date=payload.actual_harvest_date,
            actual_yield=payload.actual_yield,
            yield_unit=payload.yield_unit,
        )
    except ValueError as exc:
        message = str(exc)
        code = 404 if "tidak ditemukan" in message.lower() else 400
        raise HTTPException(status_code=code, detail=message) from exc
    db.commit()
    db.refresh(cycle)
    return cycle_out(cycle)
