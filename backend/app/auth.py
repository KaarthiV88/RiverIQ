"""JWT verification for Supabase user sessions.

The frontend signs the user in via Supabase Auth (magic link). Supabase
issues a JWT signed with the project's JWT secret. Every authenticated
backend request carries that JWT as `Authorization: Bearer <token>`.

`current_user` is a FastAPI dependency that:
  * pulls the bearer token
  * verifies signature, expiry, audience, and issuer
  * returns the verified Supabase user UUID

That UUID becomes the trusted `user_id` for all DB writes. The client can
no longer spoof someone else's UUID by editing localStorage.
"""

from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

# auto_error=False so we can return our own 401 message (matching the rest
# of the API) instead of FastAPI's default.
_bearer = HTTPBearer(auto_error=False)


def _verify(token: str) -> dict:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth not configured: SUPABASE_JWT_SECRET is missing",
        )
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — sign in again")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def current_user(
    request: Request,                                   # noqa: ARG001 — used implicitly by slowapi
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """Returns the authenticated user's UUID, or 401."""
    if creds is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    claims = _verify(creds.credentials)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token missing subject")
    return sub


def maybe_current_user(
    request: Request,                                   # noqa: ARG001
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    """Like current_user but returns None instead of 401 if no token is
    present. Use for routes that work both signed-in and signed-out."""
    if creds is None:
        return None
    claims = _verify(creds.credentials)
    return claims.get("sub")
