from datetime import date, timedelta
from typing import Any

from app.models import CropType

RICE_VARIETIES = {
    "ciherang": {"display": "Ciherang", "duration_min": 115, "duration_max": 125},
    "ir64": {"display": "IR64", "duration_min": 110, "duration_max": 115},
    "inpari32": {"display": "Inpari 32", "duration_min": 110, "duration_max": 120},
}

DISEASE_CLASSES = [
    "healthy",
    "blast",
    "brown_spot",
    "bacterial_leaf_blight",
    "tungro",
]

DISEASE_LABELS_ID = {
    "healthy": "Sehat",
    "blast": "Blast (Pyricularia)",
    "brown_spot": "Bercak coklat",
    "bacterial_leaf_blight": "Hawar daun bakteri",
    "tungro": "Tungro",
    "unknown": "Tidak dapat diklasifikasi dengan andal",
}

GROWTH_STAGE_LABELS_ID = {
    "not_yet_planted": "Belum Ditanam",
    "vegetative": "Vegetatif",
    "reproductive": "Reproduktif",
    "ripening": "Pematangan",
    "near_harvest": "Mendekati Panen",
    "overdue": "Jendela Panen Terlewat",
    "harvested": "Sudah Dipanen",
}


def rule_reliability(
    *,
    inputs_complete: bool = True,
    external_available: bool | None = None,
    external_is_demo: bool = False,
    extra_reasons: list[str] | None = None,
) -> dict[str, Any]:
    score = 100
    reasons: list[str] = []
    if not inputs_complete:
        score -= 40
        reasons.append("Input tidak lengkap.")
    if external_available is False:
        score -= 25
        reasons.append("Data eksternal tidak tersedia; memakai baseline lokal.")
    elif external_available is True and external_is_demo:
        score -= 15
        reasons.append("Konteks eksternal memakai data demo, bukan observasi langsung.")
    if extra_reasons:
        reasons.extend(extra_reasons)
    score = max(0, min(100, score))
    return {
        "kind": "rule_completeness",
        "label": "Keandalan aturan",
        "score": score,
        "reasons": reasons,
    }


def classify_growth_stage(
    *,
    planting_date: date,
    harvest_start: date,
    harvest_end: date,
    today: date | None = None,
    actual_harvest_date: date | None = None,
) -> str:
    today = today or date.today()
    if actual_harvest_date is not None:
        return "harvested"
    if planting_date > today:
        return "not_yet_planted"
    if today > harvest_end:
        return "overdue"
    avg_days = max((harvest_start - planting_date).days + (harvest_end - planting_date).days, 1) / 2
    elapsed = (today - planting_date).days
    progress = min(max(elapsed / avg_days, 0.0), 1.0)
    if today >= harvest_start:
        return "near_harvest"
    if progress < 0.25:
        return "vegetative"
    if progress < 0.55:
        return "reproductive"
    if progress < 0.9:
        return "ripening"
    return "near_harvest"


def predict_harvest(
    *,
    variety_key: str,
    planting_date: date,
    location: str,
    weather_context: dict[str, Any] | None = None,
    today: date | None = None,
    actual_harvest_date: date | None = None,
) -> dict[str, Any]:
    today = today or date.today()
    variety = RICE_VARIETIES.get(variety_key.lower(), RICE_VARIETIES["ciherang"])
    avg_days = (variety["duration_min"] + variety["duration_max"]) // 2
    weather_available = bool(weather_context and weather_context.get("available"))
    weather_demo = bool(weather_context and weather_context.get("mode") in {"demo_fallback", "unavailable"})
    if weather_available:
        adjustment = weather_context.get("duration_adjustment_days", 0) if weather_context else 0
        avg_days += int(adjustment or 0)
    harvest_start = planting_date + timedelta(days=variety["duration_min"])
    harvest_end = planting_date + timedelta(days=variety["duration_max"])
    stage = classify_growth_stage(
        planting_date=planting_date,
        harvest_start=harvest_start,
        harvest_end=harvest_end,
        today=today,
        actual_harvest_date=actual_harvest_date,
    )
    reliability = rule_reliability(
        inputs_complete=True,
        external_available=weather_available,
        external_is_demo=weather_demo,
        extra_reasons=["Durasi varietas adalah prior transparan, bukan kalibrasi lokal."],
    )
    predicted_vs_actual: dict[str, Any] | None = None
    if actual_harvest_date is not None:
        mid = harvest_start + timedelta(days=(harvest_end - harvest_start).days // 2)
        predicted_vs_actual = {
            "actual_harvest_date": actual_harvest_date.isoformat(),
            "predicted_window_start": harvest_start.isoformat(),
            "predicted_window_end": harvest_end.isoformat(),
            "delta_days_from_window_mid": (actual_harvest_date - mid).days,
        }
    return {
        "estimated_harvest_start": harvest_start.isoformat(),
        "estimated_harvest_end": harvest_end.isoformat(),
        "growth_stage": stage,
        "growth_stage_label": GROWTH_STAGE_LABELS_ID[stage],
        "reliability": reliability,
        "variety_duration_prior_days": avg_days,
        "predicted_vs_actual": predicted_vs_actual,
        "limitations": [
            "Estimasi berbasis durasi varietas, bukan kalibrasi lapangan lokal.",
            "Perbedaan praktik tanam, iklim, dan input agronomi dapat menggeser panen.",
        ],
        "location": location,
    }


def predict_soil(
    *,
    crop: CropType,
    ph: float,
    moisture: float,
    nitrogen: float,
    phosphorus: float,
    potassium: float,
    input_provenance: str,
    regional_context: dict[str, Any] | None,
) -> dict[str, Any]:
    if ph < 5.0:
        ph_class = "sangat_asam"
    elif ph < 5.5:
        ph_class = "asam"
    elif ph <= 7.0:
        ph_class = "netral"
    else:
        ph_class = "basa"
    if nitrogen < 0.12:
        n_status = "rendah"
        n_guidance = "Pertimbangkan supplement N terbatas sesuai rekomendasi lokal; verifikasi dengan uji tanah."
    elif nitrogen < 0.2:
        n_status = "sedang"
        n_guidance = "Pemupukan N dapat dipertahankan moderat; pantau respons tanaman."
    else:
        n_status = "cukup"
        n_guidance = "Kandungan N terlihat memadai; hindari over-fertilization."
    regional_ok = bool(regional_context and regional_context.get("available"))
    regional_demo = bool(
        regional_context and regional_context.get("mode") in {"local_cache", "demo_fallback"}
    )
    reliability = rule_reliability(
        inputs_complete=True,
        external_available=regional_ok,
        external_is_demo=regional_demo,
        extra_reasons=["Nilai pH/NPK berasal dari input pengguna, bukan uji lab otomatis."]
        if input_provenance != "lab"
        else None,
    )
    return {
        "ph_classification": ph_class,
        "moisture_percent": moisture,
        "nitrogen_status": n_status,
        "phosphorus_status": "sedang" if phosphorus >= 0.05 else "rendah",
        "potassium_status": "sedang" if potassium >= 0.08 else "rendah",
        "nitrogen_guidance": n_guidance,
        "input_provenance": input_provenance,
        "regional_context": regional_context,
        "reliability": reliability,
        "limitations": [
            "Nilai input bukan pengganti uji laboratorium.",
            "SoilGrids (jika ada) hanya konteks regional, bukan pengukuran lapangan.",
        ],
        "crop": crop.value,
    }


def predict_rejuvenation(
    *,
    orchard_age: int,
    productivity_decline: str,
    canopy_condition: str,
) -> dict[str, Any]:
    canopy_map = {
        "healthy": "good",
        "moderate": "fair",
        "fair": "fair",
        "sparse": "poor",
        "poor": "poor",
        "dead": "very_poor",
        "very_poor": "very_poor",
    }
    decline_map = {
        "none": "none",
        "mild": "moderate",
        "moderate": "moderate",
        "significant": "significant",
        "severe": "severe",
    }
    canopy = canopy_map.get(canopy_condition, canopy_condition)
    decline = decline_map.get(productivity_decline, productivity_decline)
    score = 0
    if orchard_age >= 15:
        score += 2
    elif orchard_age >= 10:
        score += 1
    if decline in {"significant", "severe"}:
        score += 2
    elif decline == "moderate":
        score += 1
    if canopy in {"poor", "very_poor"}:
        score += 2
    elif canopy == "fair":
        score += 1
    if score >= 4:
        recommendation = "rejuvenation_candidate"
        action = "Pertimbangkan rejuvenation; konsultasikan teknisi lokal sebelum memangkas."
    elif score >= 2:
        recommendation = "monitor"
        action = "Pantau produktivitas dan kanopi; evaluasi ulang musim depan."
    else:
        recommendation = "continue_management"
        action = "Lanjutkan manajemen rutin; belum indikasi kuat untuk rejuvenation."
    reliability = rule_reliability(
        inputs_complete=True,
        extra_reasons=["Aturan spesies jambu biji; usia saja bukan perintah memangkas."],
    )
    return {
        "recommendation": recommendation,
        "orchard_age_years": orchard_age,
        "score": score,
        "reliability": reliability,
        "pruning_guidance": (
            "Jika rejuvenation disetujui pakar: pangkas 1.0–1.5 m, musim kering (Mei–Juni)."
            if recommendation == "rejuvenation_candidate"
            else None
        ),
        "limitations": [
            "Rekomendasi berbasis aturan jambu biji, bukan mangga/litchi.",
            "Usia saja bukan perintah otomatis memangkas.",
        ],
        "recommended_action": action,
    }


def crop_feature_applicable(feature: str, crop: CropType) -> tuple[bool, str | None]:
    rules = {
        ("harvest", CropType.guava): "Panen padi tidak berlaku untuk siklus jambu biji.",
        ("disease", CropType.guava): "Diagnosis daun padi tidak berlaku untuk jambu biji.",
        ("rejuvenation", CropType.rice): "Rejuvenation kebun tidak berlaku untuk padi (tanaman semusim).",
        ("mapping", CropType.guava): "Demo pemetaan lahan v1 difokuskan pada contoh padi.",
    }
    key = (feature, crop)
    if key in rules:
        return False, rules[key]
    return True, None
