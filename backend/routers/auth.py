from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.db import create_user, get_user_by_email, serialize_user, verify_password

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


@router.post("/auth/signup")
def signup(payload: SignupInput):
    try:
        user = create_user(payload.name, payload.email, payload.password, payload.farm, payload.role)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"user": serialize_user(user), "message": "Account created successfully."}


@router.post("/auth/login")
def login(payload: LoginInput):
    user = get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return {"user": serialize_user(user), "message": "Login successful."}
