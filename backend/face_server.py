"""
Backend de reconocimiento facial + borrado de cuenta.

Flujo:
  POST /face/register  - Recibe 3 imagenes base64 + usuario_id + embeddings
                         Valida cara con opencv en servidor
                         Guarda embeddings en rostros
  POST /face/login     - Recibe 3 embeddings -> compara contra TODOS -> retorna usuario_id
  DELETE /delete-account - Verifica contrasena -> borra de rostros, usuarios, auth.users
"""

import os
import base64
import traceback
import requests

import cv2
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

UMBRAL = 0.40
UMBRAL_GAP = 0.08
MIN_MATCHES = 2

_face_cascade = None


def get_face_cascade():
    global _face_cascade
    if _face_cascade is None:
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        _face_cascade = cv2.CascadeClassifier(cascade_path)
    return _face_cascade


def imagen_base64_a_frame(imagen_b64: str):
    if "," in imagen_b64:
        imagen_b64 = imagen_b64.split(",")[1]
    datos = base64.b64decode(imagen_b64)
    arr = np.frombuffer(datos, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return frame


def detectar_cara(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = get_face_cascade()
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))
    if len(faces) == 0:
        return None
    x, y, w, h = faces[0]
    return {"x": int(x), "y": int(y), "w": int(w), "h": int(h), "count": int(len(faces))}


def calcular_metricas(frame, face_rect):
    x, y, w, h = face_rect["x"], face_rect["y"], face_rect["w"], face_rect["h"]
    img_h, img_w = frame.shape[:2]
    cara = frame[y:y+h, x:x+w]
    gray_cara = cv2.cvtColor(cara, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray_cara))
    blur = float(cv2.Laplacian(gray_cara, cv2.CV_64F).var())
    cx = (x + w / 2) / img_w
    cy = (y + h / 2) / img_h
    centered = abs(cx - 0.5) < 0.15 and abs(cy - 0.5) < 0.15
    face_ratio = w / img_w
    return {
        "brightness": round(brightness, 1),
        "blur": round(blur, 1),
        "centered": centered,
        "face_ratio": round(face_ratio, 3),
        "face_count": face_rect["count"],
    }


def distancia(a, b):
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
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


# ── FACE VALIDATE (valida imagen en servidor) ───────────────────

class FaceValidateReq(BaseModel):
    image: str


@app.post("/face/validate")
def face_validate(req: FaceValidateReq):
    try:
        frame = imagen_base64_a_frame(req.image)
        if frame is None:
            return {"ok": False, "error": "No se pudo leer la imagen"}

        face = detectar_cara(frame)
        if face is None:
            return {"ok": False, "error": "No se detecto ningun rostro en la imagen"}

        if face["count"] > 1:
            return {"ok": False, "error": "Se detectaron multiples personas. Solo debe haber una."}

        metricas = calcular_metricas(frame, face)

        if metricas["brightness"] < 50:
            return {"ok": False, "error": "Demasiado oscuro. Busca mejor iluminacion."}
        if metricas["brightness"] > 220:
            return {"ok": False, "error": "Demasiado brillante. Reduce la luz."}
        if metricas["blur"] < 50:
            return {"ok": False, "error": "Imagen borrosa. Manten la camara quieta."}
        if not metricas["centered"]:
            return {"ok": False, "error": "Centra tu rostro en la pantalla."}
        if metricas["face_ratio"] < 0.15:
            return {"ok": False, "error": "Acercate mas a la camara."}
        if metricas["face_ratio"] > 0.6:
            return {"ok": False, "error": "Aléjate un poco de la camara."}

        return {"ok": True, "metricas": metricas}

    except Exception as e:
        print(f"[face] ERROR validate: {e}")
        traceback.print_exc()
        return {"ok": False, "error": "Error procesando imagen"}


# ── FACE REGISTER ──────────────────────────────────────────────

class FaceRegisterReq(BaseModel):
    usuario_id: int
    embeddings: dict
    face_shape: str | None = None
    proporciones: dict | None = None
    landmarks_68: list | None = None


@app.post("/face/register")
def face_register(req: FaceRegisterReq):
    try:
        print(f"[face] Register called: usuario_id={req.usuario_id}")

        embeddings = req.embeddings
        valid_count = sum(1 for v in embeddings.values() if v is not None)
        print(f"[face] Embeddings validos: {valid_count}/3")

        if valid_count < 2:
            raise HTTPException(status_code=422, detail="No se detecto rostro en al menos 2 de las 3 fotos. Intenta con mejor iluminacion.")

        usuario = sb.table("usuarios").select("id").eq("id", req.usuario_id).execute()
        if not usuario.data:
            raise HTTPException(status_code=404, detail="Usuario no encontrado. Registrate primero.")

        existing = sb.table("rostros").select("id").eq("usuario_id", req.usuario_id).execute()

        update_data = {
            "embedding_frontal": embeddings.get("frontal"),
            "embedding_izquierda": embeddings.get("izquierda"),
            "embedding_derecha": embeddings.get("derecha"),
            "forma_rostro": req.face_shape or "",
        }

        metadata = {}
        if req.proporciones:
            metadata["proporciones"] = req.proporciones
        if req.landmarks_68:
            metadata["landmarks_68"] = req.landmarks_68
        if metadata:
            update_data["metadata"] = metadata

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


# ── FACE LOGIN ─────────────────────────────────────────────────

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
                    stored_arr = np.array(stored_emb, dtype=np.float64)
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
            print(f"[delete] Error listing auth users: {resp.status_code} {resp.text}")
    except Exception as e:
        errors.append(f"auth: {str(e)}")
        print(f"[delete] Error borrando auth user: {e}")

    if errors:
        print(f"[delete] Errores encontrados: {errors}")

    return {"success": True, "errors": errors}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
