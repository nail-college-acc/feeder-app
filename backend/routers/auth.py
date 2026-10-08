import os

from authlib.integrations.base_client import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from backend.db import (
    create_user,
    get_or_create_oauth_user,
    get_user_by_email,
    get_user_by_id,
    serialize_user,
    verify_password,
)

router = APIRouter(tags=["auth"])


class SignupInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=6, max_length=200)
    farm: str = Field(default="", max_length=160)
    role: str = Field(default="Pemilik ternak", max_length=60)


class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)


def _google_oauth_client():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        return None
    oauth = OAuth()
    oauth.register(
        name="google",
        client_id=client_id,
        client_secret=client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )
    return oauth.google


def _deployment_origin(request: Request) -> str:
    if os.environ.get("VERCEL_ENV") == "preview":
        branch_url = os.environ.get("VERCEL_BRANCH_URL") or os.environ.get("VERCEL_URL")
        if branch_url:
            if not branch_url.startswith(("http://", "https://")):
                branch_url = f"https://{branch_url}"
            return branch_url.rstrip("/")

    return os.environ.get("FRONTEND_URL", str(request.base_url)).rstrip("/")


def _frontend_url(request: Request, result: str) -> str:
    return f"{_deployment_origin(request)}/login?oauth={result}"


@router.get("/auth/google")
async def google_login(request: Request):
    client = _google_oauth_client()
    if not client:
        return RedirectResponse(_frontend_url(request, "error_provider_config"))
    if os.environ.get("VERCEL_ENV") == "preview":
        redirect_uri = f"{_deployment_origin(request)}/api/auth/google/callback"
    else:
        redirect_uri = os.environ.get("GOOGLE_REDIRECT_URI") or str(request.url_for("google_callback"))
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/auth/google/callback", name="google_callback")
async def google_callback(request: Request):
    client = _google_oauth_client()
    if not client:
        return RedirectResponse(_frontend_url(request, "error_provider_config"))
    try:
        token = await client.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse(_frontend_url(request, "error_provider_response"))

    profile = token.get("userinfo")
    if not profile or not profile.get("sub") or not profile.get("email"):
        return RedirectResponse(_frontend_url(request, "error_profile"))
    if profile.get("email_verified") is not True:
        return RedirectResponse(_frontend_url(request, "error_unverified"))

    user = get_or_create_oauth_user(
        "google",
        profile["sub"],
        profile["email"],
        profile.get("name", ""),
        email_verified=True,
    )
    request.session.clear()
    request.session["user_id"] = user["id"]
    return RedirectResponse(_frontend_url(request, "success"))


@router.get("/auth/session")
def auth_session(request: Request):
    user_id = request.session.get("user_id")
    user = get_user_by_id(user_id) if user_id else None
    if not user:
        request.session.clear()
        raise HTTPException(status_code=401, detail="No active session.")
    return {"user": serialize_user(user)}


@router.post("/auth/logout")
def auth_logout(request: Request):
    request.session.clear()
    return {"message": "Logged out."}


@router.post("/auth/signup")
def signup(payload: SignupInput, request: Request):
    try:
        user = create_user(payload.name, payload.email, payload.password, payload.farm, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    request.session.clear()
    request.session["user_id"] = user["id"]
    return {"user": serialize_user(user), "message": "Account created successfully."}


@router.post("/auth/login")
def login(payload: LoginInput, request: Request):
    user = get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    request.session.clear()
    request.session["user_id"] = user["id"]
    return {"user": serialize_user(user), "message": "Login successful."}
