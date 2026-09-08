"""
Backend de reconocimiento facial + borrado de cuenta.
Corre en puerto 8001.

Flujo:
  POST /face/register  - Recibe 3 imagenes (frontal, izquierda, derecha) + usuario_id
                         Calcula embedding promedio de las 3 -> guarda en rostros
  POST /face/login     - Recibe 3 imagenes -> compara promedio con todos los embeddings -> retorna usuario_id
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
SECRET = os.getenv("SUPABASE_SECRET_KEY")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
sb = create_client(URL, SECRET)

UMBRAL = 0.4

_deepface = None


def get_deepface():
    global _deepface
    if _deepface is None:
        from deepface import DeepFace
        _deepface = DeepFace
    return _deepface


def imagen_base64_a_frame(imagen_b64: str):
    if "," in imagen_b64:
        imagen_b64 = imagen_b64.split(",")[1]
    datos = base64.b64decode(imagen_b64)
    arr = np.frombuffer(datos, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return frame


def detectar_y_recortar_cara(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    face_cascade = cv2.CascadeClassifier(cascade_path)

    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

    if len(faces) == 0:
        return None

    x, y, w, h = faces[0]
    pad = int(max(w, h) * 0.3)
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(frame.shape[1], x + w + pad)
    y2 = min(frame.shape[0], y + h + pad)

    cara = frame[y1:y2, x1:x2]
    cara = cv2.resize(cara, (160, 160))
    return cara


def obtener_embedding(frame):
    cara = detectar_y_recortar_cara(frame)
    if cara is None:
        print("[face] No se detecto cara en la imagen")
        return None

    rgb = cv2.cvtColor(cara, cv2.COLOR_BGR2RGB)
    DeepFace = get_deepface()
    try:
        results = DeepFace.represent(
            img_path=rgb,
            model_name="Facenet",
            enforce_detection=False,
        )
        if results and len(results) > 0:
            emb = np.array(results[0]["embedding"])
            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            return emb
    except Exception as e:
        print(f"[face] Error obteniendo embedding: {e}")
    return None


def promediar_embeddings(embeddings):
    if not embeddings:
        return None
    avg = np.mean(embeddings, axis=0)
    return avg


def distancia(a, b):
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


# ── FACE REGISTER (3 angulos) ─────────────────────────────────

class FaceRegisterReq(BaseModel):
    usuario_id: int
    frontal: str
    izquierda: str
    derecha: str


@app.post("/face/register")
def face_register(req: FaceRegisterReq):
    try:
        print(f"[face] Register called: usuario_id={req.usuario_id}")
        embeddings = []
        foto_preview = None

        for angle_name, angle_img in [("frontal", req.frontal), ("izquierda", req.izquierda), ("derecha", req.derecha)]:
            try:
                frame = imagen_base64_a_frame(angle_img)
                if frame is None:
                    print(f"[face] Imagen {angle_name}: frame None")
                    continue

                emb = obtener_embedding(frame)
                if emb is not None:
                    embeddings.append(emb)
                    print(f"[face] Imagen {angle_name}: embedding OK (len={len(emb)})")
                    if angle_name == "frontal":
                        thumb = cv2.resize(frame, (100, 100))
                        _, buf = cv2.imencode('.jpg', thumb, [cv2.IMWRITE_JPEG_QUALITY, 60])
                        foto_preview = 'data:image/jpeg;base64,' + base64.b64encode(buf).decode('utf-8')
                else:
                    print(f"[face] Imagen {angle_name}: no se detecto rostro")
            except Exception as e:
                print(f"[face] Error procesando {angle_name}: {e}")
                traceback.print_exc()

        print(f"[face] Embeddings validos: {len(embeddings)}/3")

        if len(embeddings) < 2:
            raise HTTPException(status_code=422, detail="No se detecto rostro en al menos 2 de las 3 fotos. Intenta con mejor iluminacion.")

        embedding_avg = promediar_embeddings(embeddings)
        embedding_list = [float(x) for x in embedding_avg]

        existing = sb.table("rostros").select("id").eq("usuario_id", req.usuario_id).execute()

        if existing.data:
            result = sb.table("rostros").update({
                "embedding": embedding_list,
                "foto_preview": foto_preview,
            }).eq("usuario_id", req.usuario_id).execute()
            print(f"[face] Update OK: {result.data}")
        else:
            result = sb.table("rostros").insert({
                "usuario_id": req.usuario_id,
                "embedding": embedding_list,
                "foto_preview": foto_preview,
            }).execute()
            print(f"[face] Insert OK: {result.data}")

        return {"ok": True, "usuario_id": req.usuario_id, "dimensions": len(embedding_list), "valid_angles": len(embeddings)}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[face] ERROR FATAL en register: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")


# ── FACE LOGIN (multi-captura) ────────────────────────────────

class FaceLoginReq(BaseModel):
    frontal: str
    izquierda: str | None = None
    derecha: str | None = None


@app.post("/face/login")
def face_login(req: FaceLoginReq):
    try:
        embeddings = []

        for i, angle_img in enumerate([req.frontal, req.izquierda, req.derecha]):
            if angle_img is None:
                continue
            frame = imagen_base64_a_frame(angle_img)
            if frame is None:
                continue
            emb = obtener_embedding(frame)
            if emb is not None:
                embeddings.append(emb)
                print(f"[face] Login angle {i}: embedding OK")
            else:
                print(f"[face] Login angle {i}: no detection")

        if not embeddings:
            raise HTTPException(status_code=422, detail="No se detecto ningun rostro en las imagenes")

        embedding_actual = promediar_embeddings(embeddings)
        norm = np.linalg.norm(embedding_actual)
        if norm > 0:
            embedding_actual = embedding_actual / norm

        rostros = sb.table("rostros").select("usuario_id, embedding").execute().data
        if not rostros:
            raise HTTPException(status_code=404, detail="No hay usuarios con rostro registrado. Debes registrarte primero.")

        mejor_usuario = None
        mejor_distancia = float("inf")

        for r in rostros:
            embedding_guardado = np.array(r["embedding"])
            dist = distancia(embedding_actual, embedding_guardado)
            print(f"[face] vs user {r['usuario_id']}: dist={dist:.4f}")
            if dist < mejor_distancia:
                mejor_distancia = dist
                mejor_usuario = r["usuario_id"]

        print(f"[face] Login: best_dist={mejor_distancia:.4f} threshold={UMBRAL} user={mejor_usuario}")

        if mejor_distancia < UMBRAL:
            usuario = sb.table("usuarios").select("id, nombre, email, rol").eq("id", mejor_usuario).execute()
            if usuario.data:
                u = usuario.data[0]
                return {
                    "ok": True,
                    "usuario_id": u["id"],
                    "nombre": u["nombre"],
                    "email": u["email"],
                    "rol": u["rol"],
                    "distancia": round(mejor_distancia, 4),
                }

        raise HTTPException(status_code=401, detail=f"Rostro no reconocido (distancia: {round(mejor_distancia, 4)})")

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
