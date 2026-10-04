from fastapi import APIRouter

from backend.data import INGREDIENTS

router = APIRouter(tags=["ingredients"])


@router.get("/ingredients")
def list_ingredients():
    return INGREDIENTS
