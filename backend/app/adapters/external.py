"""NASA POWER and SoilGrids adapters with timeout, retry, cache, provenance, fallback."""

from __future__ import annotations

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from app.adapters.geocode import latlon_for
from app.adapters.httputil import ExternalFetchError, cache_file, get_json, read_cache, write_cache
from app.config import settings
from app.observability import bump


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class SoilGridsAdapter:
    version = "soilgrids-rest-v2"

    def __init__(self, cache_dir: str | None = None, live_cache_dir: str | None = None) -> None:
        self.fixture_dir = Path(cache_dir or settings.soilgrids_cache_dir)
        self.live_cache_dir = Path(live_cache_dir or settings.soilgrids_live_cache_dir)

    def _fixture_payload(self) -> dict[str, Any] | None:
        cache_file_path = self.fixture_dir / f"{settings.soilgrids_demo_region}.json"
        if not cache_file_path.exists():
            return None
        return json.loads(cache_file_path.read_text(encoding="utf-8"))

    def _live_query(self, lat: float, lon: float) -> dict[str, Any]:
        params = [
            ("lon", f"{lon:.4f}"),
            ("lat", f"{lat:.4f}"),
            ("property", "phh2o"),
            ("property", "nitrogen"),
            ("depth", "0-5cm"),
            ("value", "mean"),
        ]
        url = f"{settings.soilgrids_base_url}?{urlencode(params)}"
        return get_json(
            url,
            timeout=settings.soilgrids_timeout_seconds,
            retries=settings.soilgrids_retries,
        )

    def get_regional_context(self, location: str) -> dict[str, Any]:
        lat, lon, place = latlon_for(location)
        cache_key = f"soilgrids:{lat:.4f},{lon:.4f}"
        live_path = cache_file(self.live_cache_dir, cache_key)
        fixture = self._fixture_payload()

        if settings.soilgrids_live_enabled:
            cached, stale = read_cache(live_path, settings.soilgrids_cache_ttl_hours)
            if cached and not stale:
                bump("soilgrids_live_ok")
                return self._success(
                    location=location,
                    place=place,
                    lat=lat,
                    lon=lon,
                    baseline=cached.get("baseline") or cached,
                    mode="cache",
                    source="soilgrids_rest_v2_cache",
                    retrieved_at=cached.get("retrieved_at") or cached.get("_cached_at"),
                    live=True,
                )
            try:
                raw = self._live_query(lat, lon)
                baseline = self._summarize_live(raw, fixture)
                payload = {
                    "baseline": baseline,
                    "retrieved_at": _now_iso(),
                    "raw_properties": list((raw.get("properties") or {}).keys())
                    if isinstance(raw.get("properties"), dict)
                    else None,
                }
                write_cache(live_path, payload)
                bump("soilgrids_live_ok")
                return self._success(
                    location=location,
                    place=place,
                    lat=lat,
                    lon=lon,
                    baseline=baseline,
                    mode="live",
                    source="soilgrids_rest_v2",
                    retrieved_at=payload["retrieved_at"],
                    live=True,
                )
            except ExternalFetchError:
                if cached:
                    bump("soilgrids_fallback")
                    return self._success(
                        location=location,
                        place=place,
                        lat=lat,
                        lon=lon,
                        baseline=cached.get("baseline") or cached,
                        mode="stale_cache" if stale else "cache",
                        source="soilgrids_rest_v2_cache",
                        retrieved_at=cached.get("retrieved_at") or cached.get("_cached_at"),
                        live=True,
                        fallback_reason="live_http_failed",
                    )

        if fixture:
            bump("soilgrids_fallback")
            return self._success(
                location=location,
                place=place,
                lat=lat,
                lon=lon,
                baseline=fixture,
                mode="local_cache",
                source="local_cache",
                retrieved_at=fixture.get("retrieved_at"),
                live=False,
            )

        bump("soilgrids_fallback")
        return {
            "available": False,
            "mode": "unavailable",
            "message": "Konteks regional tidak tersedia",
            "source": "none",
            "adapter_version": self.version,
            "location": location,
            "retrieved_at": None,
        }

    def _summarize_live(self, raw: dict[str, Any], fixture: dict[str, Any] | None) -> dict[str, Any]:
        layers = raw.get("properties", {}).get("layers") if isinstance(raw.get("properties"), dict) else None
        ph_mean = None
        nitrogen_mean = None
        if isinstance(layers, list):
            for layer in layers:
                name = str(layer.get("name") or "")
                depths = layer.get("depths") or []
                if not depths:
                    continue
                values = depths[0].get("values") or {}
                mean = values.get("mean")
                if name == "phh2o" and mean is not None:
                    ph_mean = mean / 10.0 if mean > 14 else mean
                if name == "nitrogen" and mean is not None:
                    nitrogen_mean = mean
        baseline = {
            "region": settings.soilgrids_demo_region,
            "ph_hydroxide": ph_mean,
            "nitrogen_gkg": nitrogen_mean,
            "uncertainty": "ISRIC SoilGrids v2 pixel mean; regional context, not a lab measurement.",
            "retrieved_at": _now_iso(),
        }
        if fixture:
            baseline["local_demo_note"] = fixture.get("note")
        return baseline

    def _success(
        self,
        *,
        location: str,
        place: str,
        lat: float,
        lon: float,
        baseline: dict[str, Any],
        mode: str,
        source: str,
        retrieved_at: str | None,
        live: bool,
        fallback_reason: str | None = None,
    ) -> dict[str, Any]:
        return {
            "available": True,
            "mode": mode,
            "region": settings.soilgrids_demo_region,
            "place": place,
            "latitude": lat,
            "longitude": lon,
            "location": location,
            "baseline": baseline,
            "uncertainty": "Regional baseline; bukan pengukuran laboratorium.",
            "source": source,
            "adapter_version": self.version,
            "retrieved_at": retrieved_at,
            "live_attempted": live or settings.soilgrids_live_enabled,
            "fallback_reason": fallback_reason,
        }


class NasaPowerAdapter:
    version = "nasa-power-daily-v1"

    def __init__(self, cache_dir: str | None = None) -> None:
        self.cache_dir = Path(cache_dir or settings.nasa_power_cache_dir)

    def _live_query(self, lat: float, lon: float, start: date, end: date) -> dict[str, Any]:
        params = {
            "parameters": "T2M,PRECTOTCORR",
            "community": "AG",
            "longitude": f"{lon:.4f}",
            "latitude": f"{lat:.4f}",
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
            "format": "JSON",
        }
        url = f"{settings.nasa_power_base_url}?{urlencode(params)}"
        return get_json(
            url,
            timeout=settings.nasa_power_timeout_seconds,
            retries=settings.nasa_power_retries,
        )

    def get_weather_context(self, location: str) -> dict[str, Any]:
        lat, lon, place = latlon_for(location)
        end = date.today()
        start = end - timedelta(days=30)
        cache_key = f"nasa:{lat:.4f},{lon:.4f}:{start.isoformat()}:{end.isoformat()}"
        path = cache_file(self.cache_dir, cache_key)

        if settings.nasa_power_enabled:
            cached, stale = read_cache(path, settings.nasa_power_cache_ttl_hours)
            if cached and not stale:
                bump("nasa_live_ok")
                return self._from_summary(
                    cached,
                    location=location,
                    place=place,
                    lat=lat,
                    lon=lon,
                    mode="cache",
                    source="nasa_power_cache",
                )
            try:
                raw = self._live_query(lat, lon, start, end)
                summary = self._summarize(raw, start, end)
                write_cache(path, summary)
                bump("nasa_live_ok")
                return self._from_summary(
                    summary,
                    location=location,
                    place=place,
                    lat=lat,
                    lon=lon,
                    mode="live",
                    source="nasa_power",
                )
            except ExternalFetchError as exc:
                if cached:
                    bump("nasa_fallback")
                    result = self._from_summary(
                        cached,
                        location=location,
                        place=place,
                        lat=lat,
                        lon=lon,
                        mode="stale_cache" if stale else "cache",
                        source="nasa_power_cache",
                    )
                    result["fallback_reason"] = "live_http_failed"
                    result["fallback_detail"] = str(exc)
                    return result

        bump("nasa_fallback")
        return {
            "available": True,
            "mode": "demo_fallback",
            "location": location,
            "place": place,
            "latitude": lat,
            "longitude": lon,
            "duration_adjustment_days": 0,
            "message": "Data cuaca demo; bukan observasi NASA POWER langsung.",
            "source": "demo_fallback",
            "adapter_version": self.version,
            "retrieved_at": None,
            "live_attempted": settings.nasa_power_enabled,
        }

    def _summarize(self, raw: dict[str, Any], start: date, end: date) -> dict[str, Any]:
        parameter = (
            raw.get("properties", {}).get("parameter")
            if isinstance(raw.get("properties"), dict)
            else {}
        )
        t2m = parameter.get("T2M") if isinstance(parameter, dict) else None
        precip = parameter.get("PRECTOTCORR") if isinstance(parameter, dict) else None
        temps = [v for v in (t2m or {}).values() if isinstance(v, (int, float)) and v > -90]
        rains = [v for v in (precip or {}).values() if isinstance(v, (int, float)) and v >= 0]
        t2m_mean = round(sum(temps) / len(temps), 2) if temps else None
        precip_sum = round(sum(rains), 2) if rains else None
        adjustment = 0
        if t2m_mean is not None:
            if t2m_mean < 24:
                adjustment = 3
            elif t2m_mean > 30:
                adjustment = -2
        return {
            "t2m_mean_c": t2m_mean,
            "precip_sum_mm": precip_sum,
            "sample_days": len(temps),
            "duration_adjustment_days": adjustment,
            "window_start": start.isoformat(),
            "window_end": end.isoformat(),
            "retrieved_at": _now_iso(),
            "adjustment_rule": "uncalibrated heuristic: T2M mean <24°C +3d, >30°C -2d, else 0",
        }

    def _from_summary(
        self,
        summary: dict[str, Any],
        *,
        location: str,
        place: str,
        lat: float,
        lon: float,
        mode: str,
        source: str,
    ) -> dict[str, Any]:
        return {
            "available": True,
            "mode": mode,
            "location": location,
            "place": place,
            "latitude": lat,
            "longitude": lon,
            "duration_adjustment_days": int(summary.get("duration_adjustment_days") or 0),
            "t2m_mean_c": summary.get("t2m_mean_c"),
            "precip_sum_mm": summary.get("precip_sum_mm"),
            "sample_days": summary.get("sample_days"),
            "window_start": summary.get("window_start"),
            "window_end": summary.get("window_end"),
            "message": "Observasi NASA POWER (atau cache) sebagai konteks, bukan model panen terkalibrasi.",
            "source": source,
            "adapter_version": self.version,
            "retrieved_at": summary.get("retrieved_at") or summary.get("_cached_at"),
            "adjustment_rule": summary.get("adjustment_rule"),
            "live_attempted": True,
        }
