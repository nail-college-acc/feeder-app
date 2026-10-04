import json
from pathlib import Path

CATALOG_PATH = Path(__file__).with_name("catalog.json")

with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
    CATALOG = json.load(catalog_file)

INGREDIENTS = CATALOG["ingredients"]