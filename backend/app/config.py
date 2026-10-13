from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[2]
ROOT_ENV = ROOT_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ROOT_ENV), ".env"),
        extra="ignore",
    )

    app_env: str = "development"
    app_name: str = "AgriFusionNet"
    public_origin: str = "http://localhost:5173"
    backend_origin: str = "http://localhost:8000"
    allow_farmer_self_registration: bool = True

    database_url: str = (
        "mysql+pymysql://agrifusion:change-me-db@127.0.0.1:3306/agrifusionnet?charset=utf8mb4"
    )

    superadmin_email: str = "superadmin@gmail.com"
    superadmin_password: str = "password"
    superadmin_name: str = "Super Admin"

    demo_farmer_email: str = "petani@gmail.com"
    demo_farmer_password: str = "password"
    e2e_farmer_email: str = "e2e.farmer@agrifusion.test"
    e2e_farmer_password: str = "E2eFarmer123!"

    session_cookie_name: str = "agrifusion_session"
    session_ttl_hours: int = 24
    csrf_header_name: str = "X-CSRF-Token"
    trusted_proxy_ips: str = "127.0.0.1"

    audit_log_retention_days: int = 365
    saved_image_retention_days: int = 180
    prediction_retention_days: int = 730
    anonymized_hard_delete_days: int = 90
    hsts_max_age: int = 31536000

    soilgrids_cache_dir: str = "./fixtures/soilgrids"
    soilgrids_live_cache_dir: str = "./fixtures/soilgrids-live"
    soilgrids_demo_region: str = "central-java"
    soilgrids_live_enabled: bool = True
    soilgrids_base_url: str = "https://rest.isric.org/soilgrids/v2.0/properties/query"
    soilgrids_timeout_seconds: float = 8.0
    soilgrids_retries: int = 2
    soilgrids_cache_ttl_hours: int = 168

    nasa_power_enabled: bool = True
    nasa_power_base_url: str = "https://power.larc.nasa.gov/api/temporal/daily/point"
    nasa_power_timeout_seconds: float = 8.0
    nasa_power_retries: int = 2
    nasa_power_cache_dir: str = "./fixtures/nasa-power"
    nasa_power_cache_ttl_hours: int = 24
    external_http_user_agent: str = "AgriFusionNet-school/1.0"

    disease_model_path: str = str(ROOT_DIR / "models" / "disease_v1.onnx")
    disease_model_version: str = "disease-mobilenet-v1-paddy-doctor"
    disease_confidence_threshold: float = 0.52

    upload_max_bytes: int = 10 * 1024 * 1024
    upload_max_pixels: int = 4096 * 4096
    upload_tmp_dir: str = "/tmp/agrifusion-uploads"
    saved_image_dir: str = "/data/saved_images"

    login_rate_limit: int = 120
    register_rate_limit: int = 5
    password_rate_limit: int = 5
    upload_rate_limit: int = 20
    rate_limit_window_seconds: int = 60
    cookie_secure_enabled: bool = False

    @property
    def cookie_secure(self) -> bool:
        """Secure cookies only when explicitly enabled (HTTPS-only public origin)."""
        return self.cookie_secure_enabled

    @property
    def resolved_disease_model_path(self) -> Path:
        configured = Path(self.disease_model_path)
        if configured.exists():
            return configured
        fallback = ROOT_DIR / "models" / "disease_v1.onnx"
        return fallback

    def origin_allowed(self, origin: str | None) -> bool:
        if not origin:
            return True
        normalized = origin.rstrip("/")
        allowed = {self.public_origin.rstrip("/")}
        if "://localhost" in self.public_origin:
            allowed.add(self.public_origin.replace("://localhost", "://127.0.0.1").rstrip("/"))
        if "://127.0.0.1" in self.public_origin:
            allowed.add(self.public_origin.replace("://127.0.0.1", "://localhost").rstrip("/"))
        if self.app_env == "development":
            allowed.update(
                {
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                }
            )
        for host in ("127.0.0.1", "localhost"):
            for port in (8005, 8080, 5173):
                allowed.add(f"http://{host}:{port}")
        return normalized in allowed

    def trusted_proxy_set(self) -> set[str]:
        return {part.strip() for part in self.trusted_proxy_ips.split(",") if part.strip()}


settings = Settings()
