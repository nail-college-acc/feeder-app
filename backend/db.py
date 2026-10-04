import hashlib
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

if os.environ.get("FEEDER_DB_PATH"):
    DB_PATH = Path(os.environ["FEEDER_DB_PATH"])
elif os.environ.get("VERCEL"):
    DB_PATH = Path("/tmp/feeder.db")
else:
    DB_PATH = Path(__file__).resolve().parent / "feeder.db"


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"pbkdf2_sha256${salt.hex()}${derived.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    if not stored_hash.startswith("pbkdf2_sha256$"):
        return False
    _, salt_hex, digest_hex = stored_hash.split("$", 2)
    salt = bytes.fromhex(salt_hex)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return hmac_compare(derived.hex(), digest_hex)


def hmac_compare(a: str, b: str) -> bool:
    import hmac

    return hmac.compare_digest(a, b)


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                farm TEXT,
                role TEXT,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                farm TEXT,
                location TEXT,
                description TEXT,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(created_by) REFERENCES users(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS team_members (
                team_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                PRIMARY KEY(team_id, user_id),
                FOREIGN KEY(team_id) REFERENCES teams(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_team_state (
                user_id TEXT PRIMARY KEY,
                team_id TEXT,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id),
                FOREIGN KEY(team_id) REFERENCES teams(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS team_recipes (
                id TEXT PRIMARY KEY,
                team_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                name TEXT NOT NULL,
                items_json TEXT NOT NULL,
                saved_at TEXT NOT NULL,
                FOREIGN KEY(team_id) REFERENCES teams(id),
                FOREIGN KEY(created_by) REFERENCES users(id)
            )
            """
        )
        conn.commit()


def create_user(name: str, email: str, password: str, farm: str = "", role: str = "Pemilik ternak") -> dict:
    normalized_email = email.strip().lower()
    with get_connection() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?", (normalized_email,)).fetchone()
        if existing:
            raise ValueError("Email already registered")
        user_id = f"user-{uuid.uuid4()}"
        created_at = _utc_now()
        conn.execute(
            "INSERT INTO users (id, name, email, password_hash, farm, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, name.strip(), normalized_email, hash_password(password), farm.strip() or "Kebun pakan", role.strip() or "Pemilik ternak", created_at),
        )
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(user)


def get_user_by_email(email: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def create_team(name: str, farm: str, location: str, description: str, created_by: str) -> dict:
    with get_connection() as conn:
        if not get_user_by_id(created_by):
            raise ValueError("Creator user not found")
        team_id = f"team-{uuid.uuid4()}"
        created_at = _utc_now()
        conn.execute(
            "INSERT INTO teams (id, name, farm, location, description, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (team_id, name.strip(), farm.strip() or "Kebun pakan", location.strip() or "Belum ditentukan", description.strip() or "Tim pakan", created_by, created_at),
        )
        conn.execute(
            "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
            (team_id, created_by, "Pemilik ternak", created_at),
        )
        conn.execute(
            "INSERT INTO user_team_state (user_id, team_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET team_id = excluded.team_id, updated_at = excluded.updated_at",
            (created_by, team_id, created_at),
        )
        team = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
        return dict(team)


def add_member_to_team(team_id: str, user_id: str, role: str = "Peternak lapangan") -> dict:
    with get_connection() as conn:
        team = conn.execute("SELECT * FROM teams WHERE id = ?", (team_id,)).fetchone()
        if not team:
            raise ValueError("Team not found")
        user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not user:
            raise ValueError("User not found")
        existing = conn.execute("SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?", (team_id, user_id)).fetchone()
        joined_at = _utc_now()
        if not existing:
            conn.execute(
                "INSERT INTO team_members (team_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
                (team_id, user_id, role or "Peternak lapangan", joined_at),
            )
        conn.execute(
            "INSERT INTO user_team_state (user_id, team_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET team_id = excluded.team_id, updated_at = excluded.updated_at",
            (user_id, team_id, joined_at),
        )
        return {"team_id": team_id, "user_id": user_id, "already_member": bool(existing)}


def search_teams(search_term: str = "", limit: int = 30) -> list[dict]:
    term = f"%{search_term.strip()}%"
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT t.id, t.name, t.farm, t.location, t.description, t.created_by, t.created_at,
                   COUNT(tm.user_id) AS member_count
            FROM teams t
            LEFT JOIN team_members tm ON tm.team_id = t.id
            WHERE (? = '%%' OR t.name LIKE ? OR t.farm LIKE ? OR t.location LIKE ?)
            GROUP BY t.id
            ORDER BY member_count DESC, t.created_at DESC
            LIMIT ?
            """,
            (term, term, term, term, limit),
        ).fetchall()
        return [dict(row) for row in rows]


def remove_team_member(team_id: str, actor_user_id: str, member_user_id: str) -> None:
    with get_connection() as conn:
        team = conn.execute("SELECT created_by FROM teams WHERE id = ?", (team_id,)).fetchone()
        if not team:
            raise ValueError("Team not found")
        if team["created_by"] != actor_user_id:
            raise PermissionError("Only the team owner can remove members")
        if member_user_id == team["created_by"]:
            raise ValueError("The team owner cannot be removed")
        member = conn.execute(
            "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?",
            (team_id, member_user_id),
        ).fetchone()
        if not member:
            raise ValueError("Team member not found")
        conn.execute(
            "DELETE FROM team_members WHERE team_id = ? AND user_id = ?",
            (team_id, member_user_id),
        )
        conn.execute(
            "DELETE FROM user_team_state WHERE user_id = ? AND team_id = ?",
            (member_user_id, team_id),
        )


def create_team_recipe(team_id: str, user_id: str, name: str, items: list[dict]) -> dict:
    with get_connection() as conn:
        membership = conn.execute(
            "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?",
            (team_id, user_id),
        ).fetchone()
        if not membership:
            raise PermissionError("Join this team before saving a shared recipe")
        recipe_id = f"recipe-{uuid.uuid4()}"
        saved_at = _utc_now()
        conn.execute(
            """
            INSERT INTO team_recipes (id, team_id, created_by, name, items_json, saved_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (recipe_id, team_id, user_id, name.strip() or "Racikan tanpa nama", json.dumps(items), saved_at),
        )
        return {
            "id": recipe_id,
            "team_id": team_id,
            "created_by": user_id,
            "name": name.strip() or "Racikan tanpa nama",
            "items": items,
            "savedAt": saved_at,
        }


def get_team_recipes(team_id: str, user_id: str) -> list[dict]:
    with get_connection() as conn:
        membership = conn.execute(
            "SELECT 1 FROM team_members WHERE team_id = ? AND user_id = ?",
            (team_id, user_id),
        ).fetchone()
        if not membership:
            raise PermissionError("Join this team to view its recipes")
        rows = conn.execute(
            """
            SELECT id, team_id, created_by, name, items_json, saved_at
            FROM team_recipes
            WHERE team_id = ?
            ORDER BY saved_at DESC
            """,
            (team_id,),
        ).fetchall()
        return [
            {
                "id": row["id"],
                "team_id": row["team_id"],
                "created_by": row["created_by"],
                "name": row["name"],
                "items": json.loads(row["items_json"]),
                "savedAt": row["saved_at"],
            }
            for row in rows
        ]


def delete_team_recipe(team_id: str, recipe_id: str, user_id: str) -> None:
    with get_connection() as conn:
        recipe = conn.execute(
            "SELECT created_by FROM team_recipes WHERE id = ? AND team_id = ?",
            (recipe_id, team_id),
        ).fetchone()
        if not recipe:
            raise ValueError("Saved recipe not found")
        team = conn.execute("SELECT created_by FROM teams WHERE id = ?", (team_id,)).fetchone()
        if not team or (recipe["created_by"] != user_id and team["created_by"] != user_id):
            raise PermissionError("Only the recipe creator or team owner can delete this recipe")
        conn.execute("DELETE FROM team_recipes WHERE id = ? AND team_id = ?", (recipe_id, team_id))


def get_teams_for_user(user_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT t.* FROM teams t
            INNER JOIN team_members tm ON tm.team_id = t.id
            WHERE tm.user_id = ?
            ORDER BY t.created_at DESC
            """,
            (user_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_team_members(team_id: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT u.id, u.name, u.email, tm.role, tm.joined_at, tm.team_id
            FROM team_members tm
            INNER JOIN users u ON u.id = tm.user_id
            WHERE tm.team_id = ?
            ORDER BY tm.joined_at ASC
            """,
            (team_id,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_current_team_for_user(user_id: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT t.* FROM user_team_state uts INNER JOIN teams t ON t.id = uts.team_id WHERE uts.user_id = ?",
            (user_id,),
        ).fetchone()
        return dict(row) if row else None


def set_current_team_for_user(user_id: str, team_id: str | None) -> None:
    with get_connection() as conn:
        if team_id is None:
            conn.execute("DELETE FROM user_team_state WHERE user_id = ?", (user_id,))
            return
        membership = conn.execute(
            "SELECT 1 FROM team_members WHERE user_id = ? AND team_id = ?",
            (user_id, team_id),
        ).fetchone()
        if not membership:
            raise ValueError("Join this team before selecting it")
        conn.execute(
            "INSERT INTO user_team_state (user_id, team_id, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET team_id = excluded.team_id, updated_at = excluded.updated_at",
            (user_id, team_id, _utc_now()),
        )


def serialize_user(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "farm": row["farm"],
        "role": row["role"],
        "created_at": row["created_at"],
    }
