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

Authentication and team data use SQLite locally by default. To use Cloud Firestore, install requirements and set `FEEDER_DB_BACKEND=firestore`; configure Firebase Admin credentials with `FIREBASE_SERVICE_ACCOUNT_JSON` (the service-account JSON contents) and `FIREBASE_PROJECT_ID` in the backend environment. Application Default Credentials are also supported outside Vercel. Keep the service-account private key only in server-side environment settings, never in the frontend or repository. The Firestore database must be created in the Firebase project before the backend connects.

### Google Sign-In setup

The login and signup pages support Google OpenID Connect. For local testing with SQLite:

1. Create an OAuth 2.0 Web client in Google Cloud Console and add `http://localhost:5173/api/auth/google/callback` as an authorized redirect URI.
2. Set these variables in the shell before starting FastAPI:

   ```bash
   export GOOGLE_CLIENT_ID="your-client-id"
   export GOOGLE_CLIENT_SECRET="your-client-secret"
   export GOOGLE_REDIRECT_URI="http://localhost:5173/api/auth/google/callback"
   export FRONTEND_URL="http://localhost:5173"
   export SESSION_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
   ```

3. Start `uvicorn backend.main:app --reload` and the Vite dev server. SQLite remains the default storage and new Google accounts are saved in `backend/feeder.db`.

For Vercel, set the same server-side variables in Project Settings and use your production URL for `GOOGLE_REDIRECT_URI` and `FRONTEND_URL` (for example, `https://your-domain.example/api/auth/google/callback`). Register that exact callback URL in Google Cloud Console. Set a long random `SESSION_SECRET`; do not use the local development fallback in production. Google accounts with verified email addresses are linked to an existing account with the same normalized email, or a new local account is created. OAuth identities are stored in SQLite's `oauth_accounts` table or Firestore's `oauth_accounts` collection.

Firestore uses this document structure:

| Collection / document | Fields and purpose |
| --- | --- |
| `users/{user_id}` | `id`, `name`, `email`, `password_hash`, `farm`, `role`, `created_at` |
| `user_emails/{sha256(email)}` | `email`, `user_id`; unique normalized-email lookup |
| `oauth_accounts/{sha256(provider:subject)}` | `provider`, `provider_user_id`, `user_id`, `email`, `created_at`; links Google identity to a local user |
| `teams/{team_id}` | `id`, `name`, `farm`, `location`, `description`, `created_by`, `created_at`, `member_count` |
| `teams/{team_id}/members/{user_id}` | `id`, `user_id`, `name`, `email`, `role`, `joined_at`, `team_id` |
| `team_memberships/{user_id}__{team_id}` | `user_id`, `team_id`, `created_at`; reverse lookup for a user's teams |
| `teams/{team_id}/join_requests/{user_id}` | `id`, `user_id`, `name`, `email`, `role`, `requested_at` |
| `teams/{team_id}/recipes/{recipe_id}` | `id`, `team_id`, `created_by`, `name`, `items` (array), `savedAt` |
| `user_team_state/{user_id}` | `user_id`, `team_id`, `updated_at`; user's currently selected team |

Select Firestore in Vercel by setting `FEEDER_DB_BACKEND=firestore`, `FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT_JSON` in the project's server-side environment variables. This adapter does not migrate existing SQLite records; migrate any existing users, teams, and recipes separately before switching production traffic. Team search currently scans team documents to preserve substring matching, so consider adding a search service/index if the number of teams grows substantially.

Saved recipes are associated with the active team and stored in the configured backend when a signed-in team member saves them. Users can search public teams and request to join; owners can accept or reject requests, remove members, and delete their teams. Deleting a team also removes its memberships, pending requests, and shared recipes. If the user has not joined a team, saved recipes remain in that browser's local storage.

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
