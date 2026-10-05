import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import Base, SessionLocal, engine
from .routers import accounts, auth, payments, testing, trade
from .seed import seed_if_empty

ENABLE_TEST_ENDPOINTS = os.getenv("ENABLE_TEST_ENDPOINTS", "true").lower() == "true"
# Built React app. Present in the single-container image; absent when the frontend runs separately.
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parent.parent / "static")).resolve()
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5174").split(",")


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_if_empty(db)
    yield


app = FastAPI(title="Summit Trust Bank API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(payments.router)
app.include_router(trade.router)
if ENABLE_TEST_ENDPOINTS:
    app.include_router(testing.router)


@app.get("/api/health", tags=["health"])
def health():
    return {"status": "ok"}


if (STATIC_DIR / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        """Serve files from the React build, falling back to index.html for client-side routes."""
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file = (STATIC_DIR / path).resolve()
        if path and file.is_file() and file.is_relative_to(STATIC_DIR):
            return FileResponse(file)
        return FileResponse(STATIC_DIR / "index.html")
