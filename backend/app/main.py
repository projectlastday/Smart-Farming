from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes.admin import router as admin_router
from app.api.routes.auth import router as auth_router
from app.api.routes.core import router as core_router
from app.api.routes.disease import router as disease_router
from app.auth.security import bootstrap_superadmin
from app.config import settings
from app.db import SessionLocal, wait_for_database
from app.middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.observability import RequestContextMiddleware, configure_logging


@asynccontextmanager
async def lifespan(_: FastAPI):
    wait_for_database()
    db = SessionLocal()
    try:
        bootstrap_superadmin(db)
        db.commit()
    finally:
        db.close()
    yield


configure_logging()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestContextMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.public_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(core_router, prefix="/api/v1")
app.include_router(disease_router, prefix="/api/v1")


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    if isinstance(exc, StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    logging.getLogger("agrifusion.error").exception(
        "unhandled",
        extra={"request_id": getattr(request.state, "request_id", None)},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Server sedang bermasalah. Coba lagi."},
    )
