from fastapi import APIRouter

from backend.controllers.nutrition import calculate_recipe
from backend.models.schemas import RecipeRequest

router = APIRouter(tags=["recipes"])


@router.post("/recipes/analyze")
def analyze_recipe(request: RecipeRequest):
    return calculate_recipe(
        [item.model_dump() for item in request.items],
        [ingredient.model_dump() for ingredient in request.custom_ingredients],
    )
