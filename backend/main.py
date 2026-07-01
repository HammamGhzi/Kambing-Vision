from math import sqrt
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


app = FastAPI(title="Goat AI Height Estimator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Point(BaseModel):
    x: float = Field(..., ge=0, le=100)
    y: float = Field(..., ge=0, le=100)


class HeightRequest(BaseModel):
    marker_height_cm: float = Field(..., gt=0, le=500)
    points: Dict[str, Optional[Point]]
    photo_id: Optional[str] = None
    image_mime: Optional[str] = "image/jpeg"


def distance(a: Point, b: Point) -> float:
    return sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)


def confidence_label(height_cm: float, marker_ratio: float) -> str:
    if height_cm < 25 or height_cm > 140:
        return "rendah"
    if marker_ratio < 0.18 or marker_ratio > 6:
        return "rendah"
    if marker_ratio < 0.35 or marker_ratio > 4:
        return "sedang"
    return "baik"


@app.get("/")
def health_check():
    return {"status": "ok", "service": "goat-ai-height-estimator"}


@app.post("/estimate-height")
def estimate_height(payload: HeightRequest):
    required = ["goatTop", "goatBottom", "markerTop", "markerBottom"]
    missing = [key for key in required if payload.points.get(key) is None]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Titik belum lengkap: {', '.join(missing)}",
        )

    goat_px = distance(payload.points["goatTop"], payload.points["goatBottom"])
    marker_px = distance(payload.points["markerTop"], payload.points["markerBottom"])

    if marker_px <= 0 or goat_px <= 0:
        raise HTTPException(status_code=400, detail="Jarak titik ukur tidak valid.")

    height_cm = (goat_px / marker_px) * payload.marker_height_cm
    marker_ratio = goat_px / marker_px

    return {
        "tinggi_cm": round(height_cm, 1),
        "confidence": confidence_label(height_cm, marker_ratio),
        "method": "python_marker_ratio",
        "catatan": (
            "Hasil lebih akurat jika marker sejajar dengan kambing dan foto diambil dari samping."
        ),
    }