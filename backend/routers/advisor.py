from fastapi import APIRouter, HTTPException

from backend.controllers.advisor import FEED_PROFILES
from backend.controllers.nutrition import calculate_recipe
from backend.models.schemas import FeedStage

router = APIRouter(tags=["advisor"])


@router.get("/advisor")
def get_recommendation(stage: FeedStage):
    profile = FEED_PROFILES.get(stage.value)
    if profile is None:
        raise HTTPException(status_code=404, detail="No recommendation found for this feed stage.")
    result = {**profile}
    result["estimated_nutrition"] = calculate_recipe(
        [
            {
                "ingredient_id": item["ingredient_id"],
                "quantity_kg": item["percentage"],
            }
            for item in profile["recipe"]
        ]
    )["nutrients"]
    return result
