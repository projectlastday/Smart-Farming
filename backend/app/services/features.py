import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.adapters.external import NasaPowerAdapter, SoilGridsAdapter
from app.models import CropCycle, CycleStatus, Farm, Prediction, SyncState, User
from app.predictors.disease import DiseasePredictor
from app.predictors.mapping import MappingService
from app.predictors.rules import (
    GROWTH_STAGE_LABELS_ID,
    crop_feature_applicable,
    predict_harvest,
    predict_rejuvenation,
    predict_soil,
)
from app.services.audit import write_audit


def _get_owned_cycle(db: Session, user: User, crop_cycle_id: str) -> CropCycle:
    cycle = (
        db.query(CropCycle)
        .join(Farm, Farm.id == CropCycle.farm_id)
        .filter(CropCycle.id == crop_cycle_id, Farm.farmer_id == user.id)
        .first()
    )
    if not cycle:
        raise ValueError("Siklus tanaman tidak ditemukan")
    return cycle


def save_prediction(
    db: Session,
    *,
    user: User,
    cycle: CropCycle,
    feature_type: str,
    model_version: str,
    inputs_snapshot: dict,
    output: dict,
    confidence: float | None,
    assumptions: str | None,
    explanation: str | None,
    recommendation: str | None,
    provenance: dict | None,
    client_operation_id: str | None = None,
    sync_state: SyncState = SyncState.synced,
) -> Prediction:
    op_id = client_operation_id or str(uuid.uuid4())
    existing = (
        db.query(Prediction)
        .filter(
            Prediction.user_id == user.id,
            Prediction.client_operation_id == op_id,
        )
        .first()
    )
    if existing:
        return existing
    prediction = Prediction(
        user_id=user.id,
        farm_id=cycle.farm_id,
        crop_cycle_id=cycle.id,
        feature_type=feature_type,
        model_version=model_version,
        inputs_snapshot=inputs_snapshot,
        output=output,
        confidence=confidence,
        assumptions=assumptions,
        explanation=explanation,
        recommendation=recommendation,
        provenance=provenance,
        sync_state=sync_state,
        client_operation_id=op_id,
        created_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db.add(prediction)
    db.flush()
    return prediction


class FeatureService:
    def __init__(self) -> None:
        self.soilgrids = SoilGridsAdapter()
        self.nasa = NasaPowerAdapter()
        self.disease = DiseasePredictor()
        self.mapping = MappingService()

    def run_harvest(self, db: Session, user: User, cycle_id: str, variety_key: str | None):
        cycle = _get_owned_cycle(db, user, cycle_id)
        ok, reason = crop_feature_applicable("harvest", cycle.crop)
        if not ok:
            output = {"status": "not_applicable", "reason": reason}
            return save_prediction(
                db,
                user=user,
                cycle=cycle,
                feature_type="harvest",
                model_version="harvest-duration-v1",
                inputs_snapshot={"crop_cycle_id": cycle_id},
                output=output,
                confidence=None,
                assumptions=None,
                explanation=reason,
                recommendation="Fitur tidak berlaku untuk tanaman ini.",
                provenance=None,
            )
        key = variety_key or cycle.variety.lower().replace(" ", "")
        weather = self.nasa.get_weather_context(cycle.location)
        result = predict_harvest(
            variety_key=key,
            planting_date=cycle.planting_date,
            location=cycle.location,
            weather_context=weather,
            actual_harvest_date=cycle.actual_harvest_date,
        )
        stage = result["growth_stage"]
        stage_label = result.get("growth_stage_label") or GROWTH_STAGE_LABELS_ID.get(stage, stage)
        return save_prediction(
            db,
            user=user,
            cycle=cycle,
            feature_type="harvest",
            model_version="harvest-duration-v1",
            inputs_snapshot={"variety_key": key, "weather": weather},
            output=result,
            confidence=None,
            assumptions="Durasi varietas sebagai prior transparan. Keandalan adalah kelengkapan aturan, bukan probabilitas model.",
            explanation=f"Tahap pertumbuhan: {stage_label}",
            recommendation="Pantau kondisi lapangan dan sesuaikan jadwal panen.",
            provenance=weather,
        )

    def run_soil(self, db: Session, user: User, payload: dict):
        cycle = _get_owned_cycle(db, user, payload["crop_cycle_id"])
        regional = self.soilgrids.get_regional_context(cycle.location)
        result = predict_soil(
            crop=cycle.crop,
            ph=payload["ph"],
            moisture=payload["moisture"],
            nitrogen=payload["nitrogen"],
            phosphorus=payload["phosphorus"],
            potassium=payload["potassium"],
            input_provenance=payload["input_provenance"],
            regional_context=regional,
        )
        return save_prediction(
            db,
            user=user,
            cycle=cycle,
            feature_type="soil",
            model_version="soil-advisory-v1",
            inputs_snapshot=payload,
            output=result,
            confidence=None,
            assumptions="Input pengguna/sensor simulasi; verifikasi lab disarankan. Keandalan adalah kelengkapan aturan, bukan probabilitas model.",
            explanation=result["nitrogen_guidance"],
            recommendation="Lakukan uji tanah jika keputusan pemupukan penting.",
            provenance=regional,
        )

    def run_rejuvenation(self, db: Session, user: User, payload: dict):
        cycle = _get_owned_cycle(db, user, payload["crop_cycle_id"])
        ok, reason = crop_feature_applicable("rejuvenation", cycle.crop)
        if not ok:
            return save_prediction(
                db,
                user=user,
                cycle=cycle,
                feature_type="rejuvenation",
                model_version="guava-rejuvenation-v1",
                inputs_snapshot=payload,
                output={"status": "not_applicable", "reason": reason},
                confidence=None,
                assumptions=None,
                explanation=reason,
                recommendation="Tidak Berlaku",
                provenance=None,
            )
        result = predict_rejuvenation(
            orchard_age=payload["orchard_age"],
            productivity_decline=payload["productivity_decline"],
            canopy_condition=payload["canopy_condition"],
        )
        return save_prediction(
            db,
            user=user,
            cycle=cycle,
            feature_type="rejuvenation",
            model_version="guava-rejuvenation-v1",
            inputs_snapshot=payload,
            output=result,
            confidence=None,
            assumptions="Aturan deterministik jambu biji v1. Keandalan adalah kelengkapan aturan, bukan probabilitas model.",
            explanation=result["recommended_action"],
            recommendation=result["recommended_action"],
            provenance={"rule_version": "guava-rejuvenation-v1"},
        )

    def run_disease(self, db: Session, user: User, cycle_id: str, image_bytes: bytes, context: dict | None):
        cycle = _get_owned_cycle(db, user, cycle_id)
        ok, reason = crop_feature_applicable("disease", cycle.crop)
        if not ok:
            return save_prediction(
                db,
                user=user,
                cycle=cycle,
                feature_type="disease",
                model_version=self.disease.version,
                inputs_snapshot={"context_display_only": context},
                output={"status": "not_applicable", "reason": reason},
                confidence=None,
                assumptions=None,
                explanation=reason,
                recommendation="Tidak Berlaku",
                provenance=None,
            )
        result = self.disease.predict(image_bytes)
        explanation = result.get("label_id", "")
        recommendation = (
            "Ambil ulang foto dengan pencahayaan merata atau konsultasikan ahli."
            if result.get("status") == "unknown"
            else "Pantau penyebaran; ini bukan diagnosis agronomis definitif."
        )
        return save_prediction(
            db,
            user=user,
            cycle=cycle,
            feature_type="disease",
            model_version=self.disease.version,
            inputs_snapshot={"context_display_only": context},
            output=result,
            confidence=float(result.get("confidence", 0)) * 100 if result.get("status") == "classified" else None,
            assumptions="Visual-only v1; akurasi lapangan terbatas.",
            explanation=explanation,
            recommendation=recommendation,
            provenance={"model": self.disease.metadata()},
        )

    def run_mapping(self, db: Session, user: User, cycle_id: str, use_fixture: bool):
        cycle = _get_owned_cycle(db, user, cycle_id)
        ok, reason = crop_feature_applicable("mapping", cycle.crop)
        if not ok:
            return save_prediction(
                db,
                user=user,
                cycle=cycle,
                feature_type="mapping",
                model_version=self.mapping.version,
                inputs_snapshot={"use_fixture": use_fixture},
                output={"status": "not_applicable", "reason": reason},
                confidence=None,
                assumptions=None,
                explanation=reason,
                recommendation="Tidak Berlaku",
                provenance=None,
            )
        result = self.mapping.analyze()
        return save_prediction(
            db,
            user=user,
            cycle=cycle,
            feature_type="mapping",
            model_version=self.mapping.version,
            inputs_snapshot={"use_fixture": use_fixture},
            output=result,
            confidence=None,
            assumptions="Raster demo terbatas; metode ambang intensitas pita tunggal, bukan NDVI.",
            explanation=str(result.get("segmentation_summary", result.get("message"))),
            recommendation="Verifikasi batas lahan di lapangan.",
            provenance=result.get("provenance"),
        )


def mark_actual_harvest(
    db: Session,
    user: User,
    *,
    crop_cycle_id: str,
    actual_harvest_date,
    actual_yield: float | None,
    yield_unit: str | None,
) -> CropCycle:
    cycle = _get_owned_cycle(db, user, crop_cycle_id)
    if actual_harvest_date < cycle.planting_date:
        raise ValueError("Tanggal panen tidak boleh sebelum tanggal tanam")
    cycle.actual_harvest_date = actual_harvest_date
    cycle.actual_yield = actual_yield
    cycle.yield_unit = yield_unit or "kg"
    cycle.lifecycle_status = CycleStatus.harvested
    write_audit(
        db,
        actor_id=user.id,
        action="crop_cycle.mark_harvested",
        target_type="crop_cycles",
        target_id=cycle.id,
        metadata={
            "actual_harvest_date": actual_harvest_date.isoformat(),
            "actual_yield": actual_yield,
            "yield_unit": cycle.yield_unit,
        },
    )
    db.flush()
    return cycle


def anonymize_user(db: Session, actor_id: str, target: User) -> None:
    from app.auth.security import revoke_all_sessions
    from app.models import UserStatus

    target.name = "Pengguna Dihapus"
    target.email = f"deleted-{target.id}@anon.local"
    target.phone = None
    target.status = UserStatus.anonymized
    target.anonymized_at = datetime.now(UTC).replace(tzinfo=None)
    revoke_all_sessions(db, target)
    write_audit(
        db,
        actor_id=actor_id,
        action="user.anonymize",
        target_type="users",
        target_id=target.id,
    )


feature_service = FeatureService()
