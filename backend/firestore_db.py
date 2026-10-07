import hashlib
import json
import os
import uuid
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore

_firestore_client = None


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _client():
    global _firestore_client
    if _firestore_client is not None:
        return _firestore_client

    try:
        firebase_admin.get_app()
    except ValueError:
        service_account_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if service_account_json:
            credential = credentials.Certificate(json.loads(service_account_json))
        else:
            credential = credentials.ApplicationDefault()
        options = {}
        project_id = os.environ.get("FIREBASE_PROJECT_ID") or os.environ.get("GCLOUD_PROJECT")
        if project_id:
            options["projectId"] = project_id
        firebase_admin.initialize_app(credential, options or None)

    _firestore_client = firestore.client()
    return _firestore_client


def init_db() -> None:
    _client()


def _user_ref(user_id: str):
    return _client().collection("users").document(user_id)


def _team_ref(team_id: str):
    return _client().collection("teams").document(team_id)


def _membership_ref(user_id: str, team_id: str):
    return _client().collection("team_memberships").document(f"{user_id}__{team_id}")


def _email_ref(email: str):
    email_key = hashlib.sha256(email.encode("utf-8")).hexdigest()
    return _client().collection("user_emails").document(email_key)


def _snapshot_data(snapshot) -> dict | None:
    if not snapshot.exists:
        return None
    data = snapshot.to_dict()
    data["id"] = snapshot.id
    return data


def _require_team(team_id: str) -> dict:
    team = _snapshot_data(_team_ref(team_id).get())
    if not team:
        raise ValueError("Team not found")
    return team


def _require_owner(team_id: str, owner_user_id: str) -> dict:
    team = _require_team(team_id)
    if team["created_by"] != owner_user_id:
        raise PermissionError("Only the team owner can perform this action")
    return team


def create_user(name: str, email: str, password: str, farm: str = "", role: str = "Pemilik ternak") -> dict:
    normalized_email = email.strip().lower()
    user_id = f"user-{uuid.uuid4()}"
    created_at = _utc_now()
    user = {
        "id": user_id,
        "name": name.strip(),
        "email": normalized_email,
        "password_hash": _password_hash(password),
        "farm": farm.strip() or "Kebun pakan",
        "role": role.strip() or "Pemilik ternak",
        "created_at": created_at,
    }
    client = _client()
    transaction = client.transaction()
    email_ref = _email_ref(normalized_email)
    user_ref = _user_ref(user_id)

    @firestore.transactional
    def create_in_transaction(transaction):
        if transaction.get(email_ref).exists:
            raise ValueError("Email already registered")
        transaction.create(email_ref, {"email": normalized_email, "user_id": user_id})
        transaction.create(user_ref, user)

    create_in_transaction(transaction)
    return user


def get_user_by_email(email: str) -> dict | None:
    normalized_email = email.strip().lower()
    email_record = _snapshot_data(_email_ref(normalized_email).get())
    if email_record:
        return get_user_by_id(email_record["user_id"])

    matches = list(
        _client().collection("users")
        .where("email", "==", normalized_email)
        .limit(1)
        .stream()
    )
    return _snapshot_data(matches[0]) if matches else None


def get_user_by_id(user_id: str) -> dict | None:
    return _snapshot_data(_user_ref(user_id).get())


def get_or_create_oauth_user(
    provider: str,
    provider_user_id: str,
    email: str,
    name: str,
    email_verified: bool,
) -> dict:
    if not email_verified:
        raise ValueError("The identity provider must verify the email address")
    normalized_email = email.strip().lower()
    if not normalized_email or not provider_user_id:
        raise ValueError("The identity provider did not return a valid account")

    identity_key = hashlib.sha256(f"{provider}:{provider_user_id}".encode("utf-8")).hexdigest()
    identity_ref = _client().collection("oauth_accounts").document(identity_key)
    email_ref = _email_ref(normalized_email)
    transaction = _client().transaction()
    user_id = f"user-{uuid.uuid4()}"
    created_at = _utc_now()

    @firestore.transactional
    def create_or_link_in_transaction(transaction):
        identity = _snapshot_data(transaction.get(identity_ref))
        if identity:
            user = _snapshot_data(transaction.get(_user_ref(identity["user_id"])))
            if not user:
                raise RuntimeError("OAuth identity points to a missing user")
            return user

        email_record = _snapshot_data(transaction.get(email_ref))
        if email_record:
            linked_user_id = email_record["user_id"]
            user = _snapshot_data(transaction.get(_user_ref(linked_user_id)))
            if not user:
                raise RuntimeError("Email index points to a missing user")
        else:
            linked_user_id = user_id
            user = {
                "id": user_id,
                "name": name.strip() or normalized_email.split("@", 1)[0],
                "email": normalized_email,
                "password_hash": _password_hash(str(uuid.uuid4())),
                "farm": "Kebun pakan",
                "role": "Pemilik ternak",
                "created_at": created_at,
            }
            transaction.create(_user_ref(user_id), user)
            transaction.create(email_ref, {"email": normalized_email, "user_id": user_id})

        transaction.create(identity_ref, {
            "provider": provider,
            "provider_user_id": provider_user_id,
            "user_id": linked_user_id,
            "email": normalized_email,
            "created_at": _utc_now(),
        })
        return user

    return create_or_link_in_transaction(transaction)


def create_team(name: str, farm: str, location: str, description: str, created_by: str) -> dict:
    client = _client()
    user = get_user_by_id(created_by)
    if not user:
        raise ValueError("Creator user not found")
    team_id = f"team-{uuid.uuid4()}"
    created_at = _utc_now()
    team = {
        "id": team_id,
        "name": name.strip(),
        "farm": farm.strip() or "Kebun pakan",
        "location": location.strip() or "Belum ditentukan",
        "description": description.strip() or "Tim pakan",
        "created_by": created_by,
        "created_at": created_at,
        "member_count": 1,
    }
    batch = client.batch()
    batch.create(_team_ref(team_id), team)
    batch.create(
        _team_ref(team_id).collection("members").document(created_by),
        {
            "id": created_by,
            "user_id": created_by,
            "name": user["name"],
            "email": user["email"],
            "role": "Pemilik ternak",
            "joined_at": created_at,
            "team_id": team_id,
        },
    )
    batch.create(_membership_ref(created_by, team_id), {
        "user_id": created_by,
        "team_id": team_id,
        "created_at": created_at,
    })
    batch.set(_client().collection("user_team_state").document(created_by), {
        "user_id": created_by,
        "team_id": team_id,
        "updated_at": created_at,
    })
    batch.commit()
    return team


def add_member_to_team(team_id: str, user_id: str, role: str = "Peternak lapangan") -> dict:
    team_ref = _team_ref(team_id)
    team = _snapshot_data(team_ref.get())
    if not team:
        raise ValueError("Team not found")
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found")

    member_ref = team_ref.collection("members").document(user_id)
    request_ref = team_ref.collection("join_requests").document(user_id)
    transaction = _client().transaction()

    @firestore.transactional
    def request_in_transaction(transaction):
        if transaction.get(member_ref).exists:
            return True
        if not transaction.get(request_ref).exists:
            transaction.create(request_ref, {
                "id": user_id,
                "user_id": user_id,
                "name": user["name"],
                "email": user["email"],
                "role": role or "Peternak lapangan",
                "requested_at": _utc_now(),
            })
        return False

    already_member = request_in_transaction(transaction)
    return {
        "team_id": team_id,
        "user_id": user_id,
        "already_member": already_member,
        "request_pending": not already_member,
    }


def search_teams(search_term: str = "", user_id: str | None = None, limit: int = 30) -> list[dict]:
    term = search_term.strip().casefold()
    teams = []
    for snapshot in _client().collection("teams").stream():
        team = _snapshot_data(snapshot)
        if term and not any(
            term in str(team.get(field, "")).casefold()
            for field in ("name", "farm", "location")
        ):
            continue
        team_ref = _team_ref(team["id"])
        team["member_count"] = int(team.get("member_count", 0))
        team["request_status"] = (
            "pending"
            if user_id and team_ref.collection("join_requests").document(user_id).get().exists
            else None
        )
        teams.append(team)
    teams.sort(key=lambda team: (team["member_count"], team["created_at"]), reverse=True)
    return teams[:limit]


def remove_team_member(team_id: str, actor_user_id: str, member_user_id: str) -> None:
    team_ref = _team_ref(team_id)
    member_ref = team_ref.collection("members").document(member_user_id)
    membership_ref = _membership_ref(member_user_id, team_id)
    state_ref = _client().collection("user_team_state").document(member_user_id)
    transaction = _client().transaction()

    @firestore.transactional
    def remove_in_transaction(transaction):
        team = _snapshot_data(transaction.get(team_ref))
        if not team:
            raise ValueError("Team not found")
        if team["created_by"] != actor_user_id:
            raise PermissionError("Only the team owner can remove members")
        if member_user_id == team["created_by"]:
            raise ValueError("The team owner cannot be removed")
        if not transaction.get(member_ref).exists:
            raise ValueError("Team member not found")
        state = _snapshot_data(transaction.get(state_ref))
        transaction.delete(member_ref)
        transaction.delete(membership_ref)
        transaction.update(team_ref, {"member_count": max(0, int(team.get("member_count", 1)) - 1)})
        if state and state.get("team_id") == team_id:
            transaction.delete(state_ref)

    remove_in_transaction(transaction)


def get_team_join_requests(team_id: str, owner_user_id: str) -> list[dict]:
    _require_owner(team_id, owner_user_id)
    requests = [_snapshot_data(snapshot) for snapshot in _team_ref(team_id).collection("join_requests").stream()]
    return sorted(requests, key=lambda request: request["requested_at"])


def review_team_join_request(
    team_id: str,
    owner_user_id: str,
    requester_user_id: str,
    accept: bool,
) -> None:
    team_ref = _team_ref(team_id)
    request_ref = team_ref.collection("join_requests").document(requester_user_id)
    member_ref = team_ref.collection("members").document(requester_user_id)
    membership_ref = _membership_ref(requester_user_id, team_id)
    state_ref = _client().collection("user_team_state").document(requester_user_id)
    transaction = _client().transaction()

    @firestore.transactional
    def review_in_transaction(transaction):
        team = _snapshot_data(transaction.get(team_ref))
        if not team:
            raise ValueError("Team not found")
        if team["created_by"] != owner_user_id:
            raise PermissionError("Only the team owner can review join requests")
        request = _snapshot_data(transaction.get(request_ref))
        if not request:
            raise ValueError("Join request not found")
        if accept:
            joined_at = _utc_now()
            transaction.create(member_ref, {
                "id": requester_user_id,
                "user_id": requester_user_id,
                "name": request["name"],
                "email": request["email"],
                "role": request["role"],
                "joined_at": joined_at,
                "team_id": team_id,
            })
            transaction.create(membership_ref, {
                "user_id": requester_user_id,
                "team_id": team_id,
                "created_at": joined_at,
            })
            transaction.set(state_ref, {
                "user_id": requester_user_id,
                "team_id": team_id,
                "updated_at": joined_at,
            })
            transaction.update(team_ref, {
                "member_count": int(team.get("member_count", 0)) + 1,
            })
        transaction.delete(request_ref)

    review_in_transaction(transaction)


def delete_team(team_id: str, owner_user_id: str) -> None:
    team_ref = _team_ref(team_id)
    team = _require_owner(team_id, owner_user_id)
    client = _client()

    memberships = list(client.collection("team_memberships").where("team_id", "==", team_id).stream())
    state_docs = list(
        client.collection("user_team_state")
        .where("team_id", "==", team_id)
        .stream()
    )
    batch = client.batch()
    operations = 0

    for snapshot in memberships + state_docs:
        batch.delete(snapshot.reference)
        operations += 1
        if operations == 400:
            batch.commit()
            batch = client.batch()
            operations = 0

    for collection_name in ("members", "join_requests", "recipes"):
        collection = team_ref.collection(collection_name)
        while True:
            documents = list(collection.limit(400).stream())
            if not documents:
                break
            for snapshot in documents:
                batch.delete(snapshot.reference)
            batch.commit()
            batch = client.batch()

    batch.delete(team_ref)
    batch.commit()


def create_team_recipe(team_id: str, user_id: str, name: str, items: list[dict]) -> dict:
    team_ref = _team_ref(team_id)
    if not team_ref.get().exists or not team_ref.collection("members").document(user_id).get().exists:
        raise PermissionError("Join this team before saving a shared recipe")
    recipe_id = f"recipe-{uuid.uuid4()}"
    saved_at = _utc_now()
    recipe = {
        "id": recipe_id,
        "team_id": team_id,
        "created_by": user_id,
        "name": name.strip() or "Racikan tanpa nama",
        "items": items,
        "savedAt": saved_at,
    }
    team_ref.collection("recipes").document(recipe_id).create(recipe)
    return recipe


def get_team_recipes(team_id: str, user_id: str) -> list[dict]:
    team_ref = _team_ref(team_id)
    if not team_ref.get().exists or not team_ref.collection("members").document(user_id).get().exists:
        raise PermissionError("Join this team to view its recipes")
    recipes = [_snapshot_data(snapshot) for snapshot in team_ref.collection("recipes").stream()]
    return sorted(recipes, key=lambda recipe: recipe["savedAt"], reverse=True)


def delete_team_recipe(team_id: str, recipe_id: str, user_id: str) -> None:
    team_ref = _team_ref(team_id)
    recipe_ref = team_ref.collection("recipes").document(recipe_id)
    recipe = _snapshot_data(recipe_ref.get())
    if not recipe:
        raise ValueError("Saved recipe not found")
    team = _snapshot_data(team_ref.get())
    if not team or (recipe["created_by"] != user_id and team["created_by"] != user_id):
        raise PermissionError("Only the recipe creator or team owner can delete this recipe")
    recipe_ref.delete()


def get_teams_for_user(user_id: str) -> list[dict]:
    membership_docs = _client().collection("team_memberships").where("user_id", "==", user_id).stream()
    teams = []
    for membership in membership_docs:
        team = _snapshot_data(_team_ref(membership.id).get())
        if team:
            teams.append(team)
    return sorted(teams, key=lambda team: team["created_at"], reverse=True)


def get_team_members(team_id: str) -> list[dict]:
    members = [_snapshot_data(snapshot) for snapshot in _team_ref(team_id).collection("members").stream()]
    return sorted(members, key=lambda member: member["joined_at"])


def get_current_team_for_user(user_id: str) -> dict | None:
    state = _snapshot_data(_client().collection("user_team_state").document(user_id).get())
    if not state or not state.get("team_id"):
        return None
    team = _snapshot_data(_team_ref(state["team_id"]).get())
    if not team:
        return None
    team["members"] = get_team_members(team["id"])
    return team


def set_current_team_for_user(user_id: str, team_id: str | None) -> None:
    state_ref = _client().collection("user_team_state").document(user_id)
    if team_id is None:
        state_ref.delete()
        return
    team_ref = _team_ref(team_id)
    if not team_ref.get().exists or not team_ref.collection("members").document(user_id).get().exists:
        raise ValueError("Join this team before selecting it")
    state_ref.set({"user_id": user_id, "team_id": team_id, "updated_at": _utc_now()})


def _password_hash(password: str) -> str:
    import hashlib

    salt = os.urandom(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return f"pbkdf2_sha256${salt.hex()}${derived.hex()}"
