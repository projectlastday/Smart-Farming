from app.config import settings


def test_origin_allows_localhost_and_loopback_variants():
    assert settings.origin_allowed("http://localhost:8080")
    assert settings.origin_allowed("http://127.0.0.1:8080")
    assert not settings.origin_allowed("http://evil.example:8080")


def test_cookie_secure_matches_public_origin_scheme():
    if settings.app_env == "production":
        assert settings.cookie_secure == settings.public_origin.lower().startswith("https://")
    else:
        assert settings.cookie_secure is False
