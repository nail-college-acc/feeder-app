import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from backend.db import init_db
from backend.routers import advisor, auth, ingredients, recipes, teams

session_secret = os.environ.get("SESSION_SECRET")
if os.environ.get("VERCEL") and not session_secret:
    raise RuntimeError("Set SESSION_SECRET in Vercel environment variables before starting the API.")

init_db()

app = FastAPI(
    title="Feeder API",
    description="Ingredient, feed recipe, and nutrition planning API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(
    SessionMiddleware,
    secret_key=session_secret or "feeder-local-development-session-secret",
    same_site="lax",
    https_only=bool(os.environ.get("VERCEL")),
    max_age=60 * 60 * 24 * 7,
)

app.include_router(auth.router, prefix="/api")
app.include_router(ingredients.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(advisor.router, prefix="/api")
app.include_router(teams.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
