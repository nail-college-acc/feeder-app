from enum import Enum

from pydantic import BaseModel, Field


class RecipeItem(BaseModel):
    ingredient_id: str
    quantity_kg: float = Field(gt=0, le=100000)


class CustomIngredient(BaseModel):
    id: str = Field(pattern=r"^custom-[a-zA-Z0-9-]{1,80}$")
    name: str = Field(min_length=1, max_length=100)
    name_en: str = Field(default="", max_length=100)
    category: str = Field(pattern=r"^(Energy|Protein|Mineral|Supplement)$")
    protein_pct: float = Field(ge=0, le=100)
    energy_kcal_kg: float = Field(ge=0, le=10000)
    fiber_pct: float = Field(ge=0, le=100)
    fat_pct: float = Field(ge=0, le=100)
    calcium_pct: float = Field(ge=0, le=100)
    phosphorus_pct: float = Field(ge=0, le=100)
    cost_per_kg: float = Field(ge=0, le=1000000000)
    color: str = Field(default="sage", pattern=r"^(gold|sage|wheat|clay|stone|olive|lavender)$")
    source_url: str = Field(default="", max_length=500)


class RecipeRequest(BaseModel):
    items: list[RecipeItem] = Field(min_length=1)
    custom_ingredients: list[CustomIngredient] = Field(default_factory=list, max_length=100)


class FeedStage(str, Enum):
    starter = "starter"
    grower = "grower"
    layer = "layer"
