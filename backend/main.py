from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import advisor, ingredients, recipes

app = FastAPI(
    title="Feeder API",
    description="Ingredient, feed recipe, and nutrition planning API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(ingredients.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(advisor.router, prefix="/api")


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
