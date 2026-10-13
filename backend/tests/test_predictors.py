from datetime import date

from app.models import CropType
from app.predictors.rules import (
    crop_feature_applicable,
    predict_harvest,
    predict_rejuvenation,
    predict_soil,
)


def test_harvest_prior():
    result = predict_harvest(
        variety_key="ciherang",
        planting_date=date(2026, 1, 1),
        location="Semarang",
    )
    assert "estimated_harvest_start" in result
    assert result["growth_stage"]


def test_guava_rejuvenation_not_applicable_for_rice():
    ok, reason = crop_feature_applicable("rejuvenation", CropType.rice)
    assert not ok
    assert reason


def test_rejuvenation_rules():
    result = predict_rejuvenation(
        orchard_age=16,
        productivity_decline="moderate",
        canopy_condition="fair",
    )
    assert result["recommendation"] in {"monitor", "rejuvenation_candidate", "continue_management"}


def test_rejuvenation_ui_canopy_and_decline_mappings():
    sparse = predict_rejuvenation(
        orchard_age=16,
        productivity_decline="moderate",
        canopy_condition="sparse",
    )
    assert sparse["score"] >= 4
    assert sparse["recommendation"] == "rejuvenation_candidate"

    mild = predict_rejuvenation(
        orchard_age=12,
        productivity_decline="mild",
        canopy_condition="dead",
    )
    assert mild["score"] >= 2


def test_all_crop_feature_applicability_matrix():
    features = ["harvest", "disease", "rejuvenation", "soil"]
    for crop in (CropType.rice, CropType.guava):
        for feature in features:
            ok, reason = crop_feature_applicable(feature, crop)
            if feature == "harvest" and crop == CropType.guava:
                assert not ok and reason
            elif feature == "disease" and crop == CropType.guava:
                assert not ok and reason
            elif feature == "rejuvenation" and crop == CropType.rice:
                assert not ok and reason
            else:
                assert ok and reason is None


def test_soil_ph_and_nitrogen_edge_cases():
    acidic = predict_soil(
        crop=CropType.rice,
        ph=4.5,
        moisture=40,
        nitrogen=0.05,
        phosphorus=0.02,
        potassium=0.03,
        input_provenance="manual",
        regional_context=None,
    )
    assert acidic["ph_classification"] == "sangat_asam"
    assert acidic["nitrogen_status"] == "rendah"

    alkaline = predict_soil(
        crop=CropType.guava,
        ph=7.5,
        moisture=50,
        nitrogen=0.25,
        phosphorus=0.1,
        potassium=0.12,
        input_provenance="sensor",
        regional_context={"available": True},
    )
    assert alkaline["ph_classification"] == "basa"
    assert alkaline["nitrogen_status"] == "cukup"


def test_harvest_unknown_variety_falls_back_to_ciherang():
    result = predict_harvest(
        variety_key="unknown_variety",
        planting_date=date(2026, 1, 1),
        location="Semarang",
        weather_context={"available": True, "duration_adjustment_days": 3},
    )
    assert "estimated_harvest_start" in result
    assert result["variety_duration_prior_days"] >= 110


def test_rejuvenation_score_boundary_continue_management():
    result = predict_rejuvenation(
        orchard_age=5,
        productivity_decline="none",
        canopy_condition="healthy",
    )
    assert result["score"] < 2
    assert result["recommendation"] == "continue_management"


def test_harvest_all_variety_keys():
    for key in ("ciherang", "ir64", "inpari32"):
        result = predict_harvest(
            variety_key=key,
            planting_date=date(2026, 1, 1),
            location="Semarang",
        )
        assert result["variety_duration_prior_days"] >= 110


def test_rejuvenation_monitor_boundary():
    result = predict_rejuvenation(
        orchard_age=12,
        productivity_decline="mild",
        canopy_condition="moderate",
    )
    assert 2 <= result["score"] < 4
    assert result["recommendation"] == "monitor"


def test_rejuvenation_severe_dead_is_candidate():
    result = predict_rejuvenation(
        orchard_age=16,
        productivity_decline="severe",
        canopy_condition="dead",
    )
    assert result["score"] >= 4
    assert result["recommendation"] == "rejuvenation_candidate"
