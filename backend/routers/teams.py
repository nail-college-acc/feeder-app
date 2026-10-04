from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.models.schemas import RecipeItem
from backend.db import (
    add_member_to_team,
    create_team,
    create_team_recipe,
    delete_team,
    delete_team_recipe,
    get_current_team_for_user,
    get_team_join_requests,
    get_team_members,
    get_team_recipes,
    get_teams_for_user,
    remove_team_member,
    review_team_join_request,
    search_teams,
    set_current_team_for_user,
)

router = APIRouter(tags=["teams"])


class TeamCreateInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    farm: str = Field(default="", max_length=150)
    location: str = Field(default="", max_length=150)
    description: str = Field(default="", max_length=400)
    user_id: str = Field(min_length=1, max_length=100)


class TeamMemberInput(BaseModel):
    team_id: str = Field(min_length=1, max_length=120)
    user_id: str = Field(min_length=1, max_length=100)
    role: str = Field(default="Peternak lapangan", max_length=60)


class RemoveTeamMemberInput(BaseModel):
    team_id: str = Field(min_length=1, max_length=120)
    actor_user_id: str = Field(min_length=1, max_length=100)
    member_user_id: str = Field(min_length=1, max_length=100)


class TeamOwnerActionInput(BaseModel):
    owner_user_id: str = Field(min_length=1, max_length=100)


class TeamRecipeInput(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=160)
    items: list[RecipeItem] = Field(min_length=1, max_length=100)


class DeleteTeamRecipeInput(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)


@router.get("/teams/search")
def find_teams(q: str = "", user_id: str | None = None):
    return search_teams(q[:100], user_id)


@router.get("/teams")
def list_teams(user_id: str | None = None):
    if not user_id:
        return []
    teams = get_teams_for_user(user_id)
    for team in teams:
        team["members"] = get_team_members(team["id"])
    return teams


@router.get("/teams/current")
def current_team(user_id: str):
    team = get_current_team_for_user(user_id)
    if not team:
        return None
    team["members"] = get_team_members(team["id"])
    return team


@router.post("/teams")
def create_team_route(payload: TeamCreateInput):
    try:
        team = create_team(payload.name, payload.farm, payload.location, payload.description, payload.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"team": team, "members": get_team_members(team["id"]), "message": "Team created successfully."}


@router.delete("/teams/{team_id}")
def delete_team_route(team_id: str, payload: TeamOwnerActionInput):
    try:
        delete_team(team_id, payload.owner_user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"message": "Team deleted."}


@router.post("/teams/join")
def join_team(payload: TeamMemberInput):
    try:
        result = add_member_to_team(payload.team_id, payload.user_id, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    message = "Join request sent." if result["request_pending"] else "You are already a team member."
    return {"result": result, "members": get_team_members(payload.team_id), "message": message}


@router.get("/teams/{team_id}/requests")
def list_team_join_requests(team_id: str, user_id: str):
    try:
        return get_team_join_requests(team_id, user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/teams/{team_id}/requests/{requester_user_id}/accept")
def accept_team_join_request(team_id: str, requester_user_id: str, payload: TeamOwnerActionInput):
    try:
        review_team_join_request(team_id, payload.owner_user_id, requester_user_id, accept=True)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"members": get_team_members(team_id), "requests": get_team_join_requests(team_id, payload.owner_user_id)}


@router.delete("/teams/{team_id}/requests/{requester_user_id}")
def reject_team_join_request(team_id: str, requester_user_id: str, payload: TeamOwnerActionInput):
    try:
        review_team_join_request(team_id, payload.owner_user_id, requester_user_id, accept=False)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"requests": get_team_join_requests(team_id, payload.owner_user_id)}


@router.delete("/teams/{team_id}/members/{member_user_id}")
def delete_team_member(team_id: str, member_user_id: str, payload: RemoveTeamMemberInput):
    if payload.team_id != team_id or payload.member_user_id != member_user_id:
        raise HTTPException(status_code=422, detail="Team and member IDs must match the request path.")
    try:
        remove_team_member(team_id, payload.actor_user_id, member_user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"members": get_team_members(team_id), "message": "Team member removed."}


@router.get("/teams/{team_id}/recipes")
def list_team_recipes(team_id: str, user_id: str):
    try:
        return get_team_recipes(team_id, user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/teams/{team_id}/recipes")
def save_team_recipe(team_id: str, payload: TeamRecipeInput):
    try:
        recipe = create_team_recipe(
            team_id,
            payload.user_id,
            payload.name,
            [item.model_dump() for item in payload.items],
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return recipe


@router.delete("/teams/{team_id}/recipes/{recipe_id}")
def delete_saved_team_recipe(team_id: str, recipe_id: str, payload: DeleteTeamRecipeInput):
    try:
        delete_team_recipe(team_id, recipe_id, payload.user_id)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"message": "Saved recipe deleted."}


@router.post("/teams/current")
def set_current_team(payload: TeamMemberInput):
    try:
        set_current_team_for_user(payload.user_id, payload.team_id)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return {"team_id": payload.team_id, "user_id": payload.user_id, "message": "Current team saved."}


@router.post("/teams/leave")
def leave_team(payload: TeamMemberInput):
    set_current_team_for_user(payload.user_id, None)
    return {"user_id": payload.user_id, "message": "Current team cleared."}
