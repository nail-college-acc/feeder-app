# Feeder

Feeder is a feed-planning web app for building animal-feed recipes, estimating ingredient nutrition and cost, and adapting stage-based duck-feed starting points.

## Stack

- React and Vite frontend
- FastAPI / Python API
- Vercel deployment configuration

## Run locally

Use Node.js 18+ and Python 3.10+.

```bash
npm install
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

On Windows, activate the environment with `.venv\Scripts\activate` instead.

Start the API and frontend in separate terminals:

```bash
uvicorn backend.main:app --reload
npm run dev
```

The Vite dev server proxies `/api` requests to `http://127.0.0.1:8000`. Open the URL printed by Vite. The API schema is available at `/docs`.

Ingredient profiles are stored in [`backend/data/catalog.json`](./backend/data/catalog.json) so they can be maintained independently of application logic. Nutrient values are representative reference values with linked source profiles. Indonesian rupiah ingredient prices are planning estimates, not live market data; update them using local supplier quotes before costing a real feed.

The interface is in Indonesian. You can add custom ingredients from the ingredient list; these ingredient profiles and saved recipes are stored in that browser's local storage and are not synced between devices or users. Search the catalog by ingredient name, then optionally open the web-search link shown for a query that has no matching result. Web search opens Google in a new tab; Feeder does not scrape or import search results. Verify nutrient values and prices before using custom or catalog data in a real feed formulation.

Authentication and team data are stored in a local SQLite database at `backend/feeder.db` when the FastAPI backend runs. `/api/auth/signup` creates a user record and hashes the password before saving it; `/api/auth/login` verifies stored credentials; `/api/teams` and related routes persist team records and memberships. On Vercel, the database is initialized under `/tmp` because the deployed application files are read-only. Vercel's temporary filesystem is not durable or shared between function instances, so accounts, teams, and shared recipes may disappear; use a hosted database such as PostgreSQL or Supabase for persistent production data. Set `FEEDER_DB_PATH` to override the database path where a persistent writable disk is available.

Saved recipes are associated with the active team and stored in SQLite when a signed-in team member saves them. Users can search public teams and request to join; owners can accept or reject requests, remove members, and delete their teams. Deleting a team also removes its memberships, pending requests, and shared recipes. If the user has not joined a team, saved recipes remain in that browser's local storage.

## Deploy to Vercel

Import the project into Vercel and deploy from the repository root. Vercel builds the Vite frontend and serves the Python ASGI app at `api/index.py`; `/api/*` requests are rewritten to that function. The dependencies for the Python function are listed in `requirements.txt`.

The landing page is available at `/` (with `/home` as an alias), and the dashboard is available at `/dash`. Login and signup are available at `/login` and `/signup`. Vercel rewrites those direct requests and the standalone Bahasa Indonesia guide at `/docs/guide` to the frontend entry point.

## API

- `GET /api/health` — health check
- `GET /api/ingredients` — ingredient catalog and reference nutrition values
- `GET /api/advisor?stage=starter|grower|layer` — stage-specific recipe starting point
- `POST /api/recipes/analyze` — weighted nutrition and cost estimate

Recipe analysis request:

```json
{
  "items": [
    { "ingredient_id": "corn", "quantity_kg": 49 },
    { "ingredient_id": "soybean-meal", "quantity_kg": 23 }
  ]
}
```

Ingredient nutrient values and advisor recipes are illustrative planning references, not veterinary or nutritionist advice. Prices are not official Bapanas data or live quotations. Validate feed formulations for the specific species, breed, age, production goals, local ingredients, and applicable regulations before use.
