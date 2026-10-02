"""School-scope location table. No live geocoder; unknown names use Central Java."""

from __future__ import annotations

KNOWN_LOCATIONS: dict[str, tuple[float, float]] = {
    "semarang": (-6.9667, 110.4167),
    "semarang, jawa tengah": (-6.9667, 110.4167),
    "demak": (-6.8946, 110.6378),
    "demak, jawa tengah": (-6.8946, 110.6378),
    "central-java": (-7.1500, 110.1400),
    "jawa tengah": (-7.1500, 110.1400),
}

DEFAULT_LATLON = (-7.1500, 110.1400)
DEFAULT_LABEL = "central-java"


def latlon_for(location: str) -> tuple[float, float, str]:
    key = (location or "").strip().lower()
    if key in KNOWN_LOCATIONS:
        lat, lon = KNOWN_LOCATIONS[key]
        return lat, lon, key
    for name, pair in KNOWN_LOCATIONS.items():
        if name in key or key in name:
            return pair[0], pair[1], name
    return (*DEFAULT_LATLON, DEFAULT_LABEL)
