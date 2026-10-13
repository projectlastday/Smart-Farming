from datetime import date, timedelta

from app.predictors.rules import classify_growth_stage, predict_harvest


def test_harvest_future_planting_is_not_yet_planted():
    planting = date.today() + timedelta(days=10)
    result = predict_harvest(variety_key="ciherang", planting_date=planting, location="Semarang")
    assert result["growth_stage"] == "not_yet_planted"
    assert "confidence" not in result
    assert result["reliability"]["kind"] == "rule_completeness"


def test_harvest_overdue_after_window():
    planting = date.today() - timedelta(days=200)
    result = predict_harvest(variety_key="ciherang", planting_date=planting, location="Semarang")
    assert result["growth_stage"] == "overdue"


def test_harvest_uses_actual_harvest_stage():
    planting = date.today() - timedelta(days=40)
    actual = date.today() - timedelta(days=1)
    result = predict_harvest(
        variety_key="ciherang",
        planting_date=planting,
        location="Semarang",
        actual_harvest_date=actual,
    )
    assert result["growth_stage"] == "harvested"
    assert result["predicted_vs_actual"]["delta_days_from_window_mid"] is not None


def test_stage_boundaries():
    planting = date(2026, 1, 1)
    start = date(2026, 4, 26)
    end = date(2026, 5, 6)
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2025, 12, 31)) == "not_yet_planted"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2026, 1, 10)) == "vegetative"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2026, 2, 15)) == "reproductive"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=date(2026, 3, 20)) == "ripening"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=start) == "near_harvest"
    assert classify_growth_stage(planting_date=planting, harvest_start=start, harvest_end=end, today=end + timedelta(days=1)) == "overdue"
    assert classify_growth_stage(
        planting_date=planting,
        harvest_start=start,
        harvest_end=end,
        today=date.today(),
        actual_harvest_date=date(2026, 5, 1),
    ) == "harvested"
