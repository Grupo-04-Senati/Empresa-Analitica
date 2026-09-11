"""
Backend de reconocimiento facial + borrado de cuenta.
Corre en puerto 8001.

Flujo:
  POST /face/register  - Recibe 3 embeddings (frontal, izquierda, derecha) + usuario_id
                         Guarda cada embedding por separado en su columna
  POST /face/login     - Recibe 3 embeddings -> compara contra TODOS los embeddings de cada usuario -> retorna usuario_id
  DELETE /delete-account - Verifica contrasena -> borra de rostros, usuarios, auth.users
"""

import os
import base64
import traceback
import requests

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

URL = os.getenv("SUPABASE_URL")
SECRET = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_ANON_KEY")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
sb = create_client(URL, SECRET)

UMBRAL = 0.35
UMBRAL_GAP = 0.08
MIN_MATCHES = 2


def distancia(a, b):
    a = np.array(a)
    b = np.array(b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a > 0:
        a = a / norm_a
    if norm_b > 0:
        b = b / norm_b
    dot = np.dot(a, b)
    dot = np.clip(dot, -1.0, 1.0)
    return float(1.0 - dot)


@app.get("/health")
def health():
    return {"status": "ok", "service": "face+delete"}


@app.get("/face/check-registered")
def check_registered():
    rostros = sb.table("rostros").select("id").execute().data
    return {"count": len(rostros)}


# ── FACE REGISTER (3 angulos separados) ───────────────────────

class FaceRegisterReq(BaseModel):
    usuario_id: int
    embeddings: dict
    face_shape: str | None = None
    proporciones: dict | None = None
    landmarks_68: dict | None = None


@app.post("/face/register")
def face_register(req: FaceRegisterReq):
    try:
        print(f"[face] Register called: usuario_id={req.usuario_id}")

        embeddings = req.embeddings
        valid_count = sum(1 for v in embeddings.values() if v is not None)
        print(f"[face] Embeddings validos: {valid_count}/3")

        if valid_count < 2:
            raise HTTPException(status_code=422, detail="No se detecto rostro en al menos 2 de las 3 fotos. Intenta con mejor iluminacion.")

        existing = sb.table("rostros").select("id").eq("usuario_id", req.usuario_id).execute()

        update_data = {
            "embedding_frontal": embeddings.get("frontal"),
            "embedding_izquierda": embeddings.get("izquierda"),
            "embedding_derecha": embeddings.get("derecha"),
            "forma_rostro": req.face_shape or "",
        }

        if existing.data:
            result = sb.table("rostros").update(update_data).eq("usuario_id", req.usuario_id).execute()
            print(f"[face] Update OK: {result.data}")
        else:
            update_data["usuario_id"] = req.usuario_id
            result = sb.table("rostros").insert(update_data).execute()
            print(f"[face] Insert OK: {result.data}")

        return {"ok": True, "usuario_id": req.usuario_id, "valid_angles": valid_count}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[face] ERROR FATAL en register: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# ── FACE LOGIN (compara contra cada embedding individual) ─────

class FaceLoginReq(BaseModel):
    embeddings: list
    face_shape: str | None = None


@app.post("/face/login")
def face_login(req: FaceLoginReq):
    try:
        login_embeddings = req.embeddings

        if not login_embeddings:
            raise HTTPException(status_code=422, detail="No se detecto ningun rostro en las imagenes")

        rostros = sb.table("rostros").select("usuario_id, embedding_frontal, embedding_izquierda, embedding_derecha").execute().data
        if not rostros:
            raise HTTPException(status_code=404, detail="No hay usuarios con rostro registrado. Debes registrarte primero.")

        user_scores: dict[int, list[float]] = {}

        for login_emb in login_embeddings:
            for r in rostros:
                uid = r["usuario_id"]
                for angle_key in ["embedding_frontal", "embedding_izquierda", "embedding_derecha"]:
                    stored_emb = r.get(angle_key)
                    if stored_emb is None:
                        continue
                    stored_arr = np.array(stored_emb)
                    norm = np.linalg.norm(stored_arr)
                    if norm > 0:
                        stored_arr = stored_arr / norm
                    dist = distancia(login_emb, stored_arr)
                    if uid not in user_scores:
                        user_scores[uid] = []
                    user_scores[uid].append(dist)
                    print(f"[face] vs user {uid} ({angle_key}): dist={dist:.4f}")

        results = []
        for uid, dists in user_scores.items():
            matches = [d for d in dists if d <= UMBRAL]
            if len(matches) >= MIN_MATCHES:
                best = min(matches)
                results.append({"userId": uid, "bestDist": best, "matchCount": len(matches)})

        if not results:
            raise HTTPException(status_code=401, detail="Rostro no reconocido. Debes registrarte primero.")

        results.sort(key=lambda x: x["bestDist"])

        if len(results) > 1:
            gap = results[1]["bestDist"] - results[0]["bestDist"]
            if gap < UMBRAL_GAP:
                print(f"[face] Ambiguo: gap={gap:.4f} < {UMBRAL_GAP}")
                raise HTTPException(status_code=401, detail="Rostro ambiguo, intente de nuevo")

        winner = results[0]
        usuario = sb.table("usuarios").select("id, nombre, email, rol").eq("id", winner["userId"]).execute()

        if usuario.data:
            u = usuario.data[0]
            print(f"[face] Login OK: user={u['id']} dist={winner['bestDist']:.4f}")
            return {
                "ok": True,
                "usuario_id": u["id"],
                "nombre": u["nombre"],
                "email": u["email"],
                "rol": u["rol"],
                "distancia": round(winner["bestDist"], 4),
            }

        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[face] ERROR FATAL en login: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# ── DELETE ACCOUNT ──────────────────────────────────────────────

class DeleteReq(BaseModel):
    password: str
    email: str


@app.delete("/delete-account")
def delete_account(req: DeleteReq):
    print(f"[delete] Solicitud de borrado para: {req.email}")
    try:
        sb.auth.sign_in_with_password({"email": req.email, "password": req.password})
        print(f"[delete] Contrasena verificada OK")
    except Exception as e:
        print(f"[delete] Error verificando contrasena: {e}")
        raise HTTPException(status_code=400, detail="Contrasena incorrecta")

    errors = []

    try:
        usuario = sb.table("usuarios").select("id").eq("email", req.email).execute()
        print(f"[delete] Usuario encontrado: {usuario.data}")
        if usuario.data:
            uid = usuario.data[0]["id"]
            for tabla in ["rostros", "auditoria", "optimizaciones"]:
                try:
                    result = sb.table(tabla).delete().eq("usuario_id", uid).execute()
                    print(f"[delete] {tabla} eliminados para uid {uid}: {len(result.data or [])} registros")
                except Exception as e2:
                    errors.append(f"{tabla}: {str(e2)}")
                    print(f"[delete] Error borrando {tabla}: {e2}")
        else:
            print(f"[delete] No se encontro usuario en tabla usuarios para {req.email}")
    except Exception as e:
        errors.append(f"lookup: {str(e)}")
        print(f"[delete] Error buscando usuario: {e}")

    try:
        result = sb.table("usuarios").delete().eq("email", req.email).execute()
        print(f"[delete] Usuario eliminado de tabla: {result.data}")
    except Exception as e:
        errors.append(f"usuarios: {str(e)}")
        print(f"[delete] Error borrando usuario: {e}")

    try:
        admin_key = SERVICE_ROLE_KEY or SECRET
        resp = requests.get(
            f"{URL}/auth/v1/admin/users",
            headers={
                "apikey": admin_key,
                "Authorization": f"Bearer {admin_key}",
            },
            params={"email": req.email},
        )
        print(f"[delete] Auth list response: {resp.status_code}")
        if resp.status_code == 200:
            auth_users = resp.json().get("users", [])
            if auth_users:
                auth_uid = auth_users[0]["id"]
                del_resp = requests.delete(
                    f"{URL}/auth/v1/admin/users/{auth_uid}",
                    headers={
                        "apikey": admin_key,
                        "Authorization": f"Bearer {admin_key}",
                    },
                )
                print(f"[delete] Auth user delete response: {del_resp.status_code} {del_resp.text}")
                if del_resp.status_code not in (200, 204):
                    errors.append(f"auth: {del_resp.status_code} {del_resp.text}")
            else:
                print(f"[delete] No auth user found for {req.email}")
        else:
            errors.append(f"auth list: {resp.status_code} {resp.text}")
            print(f"[delete] Error listando auth users: {resp.status_code} {resp.text}")
    except Exception as e:
        errors.append(f"auth: {str(e)}")
        print(f"[delete] Error borrando auth user: {e}")

    if errors:
        print(f"[delete] Errores encontrados: {errors}")

    return {"success": True, "errors": errors}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
