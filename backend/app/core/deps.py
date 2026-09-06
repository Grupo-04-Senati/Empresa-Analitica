from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import httpx
from app.core.config import SUPABASE_URL, SUPABASE_JWKS_URL
from app.services.supabaseClient import get_supabase

security = HTTPBearer(auto_error=False)

_jwks_cache = None

async def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(SUPABASE_JWKS_URL)
            _jwks_cache = resp.json()
    return _jwks_cache

async def verify_jwt_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    if credentials is None:
        raise HTTPException(status_code=401, detail="Token no proporcionado")
    
    token = credentials.credentials
    try:
        jwks = await get_jwks()
        unverified_header = jwt.get_unverified_header(token)
        
        key = None
        for k in jwks.get("keys", []):
            if k["kid"] == unverified_header.get("kid"):
                key = k
                break
        
        if key is None:
            raise HTTPException(status_code=401, detail="Key no encontrada")
        
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience="authenticated",
            options={"verify_aud": False}
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token inválido: {str(e)}")

async def get_current_user(payload: dict = Depends(verify_jwt_token)) -> dict:
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token sin user_id")
    
    supabase = get_supabase()
    response = supabase.table("usuarios").select("id, nombre, email, rol, activo").eq("email", payload.get("email", "")).execute()
    
    if not response.data:
        response = supabase.table("usuarios").select("id, nombre, email, rol, activo").eq("id", int(user_id) if user_id.isdigit() else 0).execute()
    
    if not response.data:
        return {
            "id": int(user_id) if user_id.isdigit() else 0,
            "email": payload.get("email", ""),
            "nombre": payload.get("email", "").split("@")[0],
            "rol": "USUARIO",
            "activo": True
        }
    
    user = response.data[0]
    return {
        "id": user["id"],
        "email": user["email"],
        "nombre": user["nombre"],
        "rol": user.get("rol", "USUARIO"),
        "activo": user.get("activo", True)
    }

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["rol"].upper() not in ["ADMIN", "ANALISTA"]:
        raise HTTPException(status_code=403, detail="Se requiere rol ADMIN o ANALISTA")
    return user

async def require_analyst_or_admin(user: dict = Depends(get_current_user)) -> dict:
    if user["rol"].upper() not in ["ADMIN", "ANALISTA", "SUPERVISOR"]:
        raise HTTPException(status_code=403, detail="Se requiere rol ADMIN, ANALISTA o SUPERVISOR")
    return user
