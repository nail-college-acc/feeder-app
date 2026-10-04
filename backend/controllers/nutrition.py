from fastapi import HTTPException

from backend.data import INGREDIENTS


def calculate_recipe(items: list[dict], custom_ingredients: list[dict] | None = None) -> dict:
    catalog = {ingredient["id"]: ingredient for ingredient in INGREDIENTS}
    for ingredient in custom_ingredients or []:
        if ingredient["id"] in catalog:
            raise HTTPException(
                status_code=422,
                detail=f"Custom ingredient ID '{ingredient['id']}' conflicts with the catalog.",
            )
        catalog[ingredient["id"]] = ingredient

    total_kg = sum(item["quantity_kg"] for item in items)
    if total_kg <= 0:
        raise HTTPException(status_code=422, detail="Add at least one ingredient to analyze a recipe.")

    nutrients = {
        "protein_pct": 0.0,
        "energy_kcal_kg": 0.0,
        "fiber_pct": 0.0,
        "fat_pct": 0.0,
        "calcium_pct": 0.0,
        "phosphorus_pct": 0.0,
    }
    cost = 0.0
    lines = []

    for item in items:
        ingredient = catalog.get(item["ingredient_id"])
        if ingredient is None:
            raise HTTPException(
                status_code=404,
                detail=f"Ingredient '{item['ingredient_id']}' was not found.",
            )
        quantity = item["quantity_kg"]
        share = quantity / total_kg
        cost += quantity * ingredient["cost_per_kg"]
        for nutrient in nutrients:
            nutrients[nutrient] += ingredient[nutrient] * share
        lines.append(
            {
                "ingredient_id": ingredient["id"],
                "name": ingredient["name"],
                "quantity_kg": round(quantity, 3),
                "share_pct": round(share * 100, 1),
            }
        )

    return {
        "total_kg": round(total_kg, 3),
        "cost_per_kg": round(cost / total_kg),
        "total_cost": round(cost),
        "nutrients": {key: round(value, 2) for key, value in nutrients.items()},
        "items": lines,
    }
