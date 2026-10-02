import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import CurrentUserContext, get_current_user, require_csrf
from app.config import settings
from app.db import get_db
from app.models import Prediction, SavedImage
from app.schemas import PredictionOut
from app.services.features import feature_service
from app.services.uploads import cleanup_path, read_and_validate_image, write_temp_upload
from app.api.routes.core import prediction_out

router = APIRouter(prefix="/features/disease", tags=["disease"])


@router.post("", response_model=PredictionOut)
async def disease_diagnosis(
    crop_cycle_id: str = Form(...),
    context_json: str | None = Form(default=None),
    save_image: bool = Form(default=False),
    image: UploadFile = File(...),
    ctx: CurrentUserContext = Depends(require_csrf),
    db: Session = Depends(get_db),
):
    image_bytes = await read_and_validate_image(image)
    context = None
    if context_json:
        try:
            context = json.loads(context_json)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="context_json tidak valid") from exc
    tmp_path = None
    try:
        tmp_path = write_temp_upload(image_bytes, Path(settings.upload_tmp_dir))
        try:
            prediction = feature_service.run_disease(
                db, ctx.user, crop_cycle_id, image_bytes, context
            )
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        if save_image:
            saved_dir = Path(settings.saved_image_dir)
            saved_dir.mkdir(parents=True, exist_ok=True)
            path = write_temp_upload(image_bytes, saved_dir)
            db.add(SavedImage(prediction_id=prediction.id, path=str(path)))
        db.commit()
        db.refresh(prediction)
        return prediction_out(prediction)
    finally:
        if tmp_path:
            cleanup_path(tmp_path)


@router.get("/model/metadata")
def model_metadata(ctx: CurrentUserContext = Depends(get_current_user)):
    return feature_service.disease.metadata()


@router.get("/model/download")
def model_download(ctx: CurrentUserContext = Depends(get_current_user)):
    path = settings.resolved_disease_model_path
    if not path.exists():
        raise HTTPException(
            status_code=503,
            detail="Model ONNX belum tersedia.",
        )
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename="disease_v1.onnx",
    )
