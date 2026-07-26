"""JWT verification for Supabase user sessions.

The frontend signs the user in via Supabase Auth. Supabase issues a JWT that
every authenticated backend request carries as `Authorization: Bearer <token>`.

Supabase now signs session tokens with rotating **asymmetric** keys (ES256);
the public keys are published at the project's JWKS endpoint. Older projects
(and the legacy config) signed with a shared **HS256** secret. We support both
and pick the path from the token's own `alg` header.

`current_user` is a FastAPI dependency that:
  * pulls the bearer token
  * verifies signature, expiry, audience, and (for JWKS tokens) issuer
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

# Lazily-built JWKS client. It caches the fetched key set in-process, so we
# don't hit the JWKS endpoint on every request. Built once on first use.
_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        if not settings.supabase_url:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth not configured: SUPABASE_URL is missing",
            )
        jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        _jwks_client = jwt.PyJWKClient(jwks_url)
    return _jwks_client


def _verify(token: str) -> dict:
    try:
        alg = jwt.get_unverified_header(token).get("alg", "")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Malformed token: {e}")

    try:
        if alg == "HS256":
            # Legacy shared-secret signing.
            if not settings.supabase_jwt_secret:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Auth not configured: SUPABASE_JWT_SECRET is missing",
                )
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        # Asymmetric signing (current Supabase default) — verify against the
        # JWKS public key selected by the token's `kid`, and pin the issuer.
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — sign in again")
    except jwt.PyJWKClientError as e:
        # Couldn't fetch or match a signing key (network, key rotation, or an
        # unknown `kid`). Distinct from a bad token — signal a transient 503.
        raise HTTPException(status_code=503, detail=f"Auth key lookup failed: {e}")
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
