"""
Backend de reconocimiento facial + borrado de cuenta.
Usa face_recognition (dlib) para deteccion y codificacion facial.

Flujo:
  POST /face/register  - Recibe 3 imagenes base64 + usuario_id + embeddings
                         Valida cara con face_recognition en servidor
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
import face_recognition
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


def imagen_base64_a_frame(imagen_b64: str):
    if "," in imagen_b64:
        imagen_b64 = imagen_b64.split(",")[1]
    datos = base64.b64decode(imagen_b64)
    arr = np.frombuffer(datos, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return frame


def detectar_cara(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    locs = face_recognition.face_locations(rgb, model="hog")
    if len(locs) == 0:
        return None
    top, right, bottom, left = locs[0]
    return {
        "x": int(left), "y": int(top),
        "w": int(right - left), "h": int(bottom - top),
        "count": len(locs),
        "top": int(top), "right": int(right),
        "bottom": int(bottom), "left": int(left),
    }


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

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    face_locs = face_recognition.face_locations(rgb, model="hog")
    encs = face_recognition.face_encodings(rgb, face_locs)
    eye_count = 0
    if len(encs) > 0:
        face_landmarks_list = face_recognition.face_landmarks(rgb, face_locs)
        if face_landmarks_list:
            lm = face_landmarks_list[0]
            left_eye = lm.get("left_eye", [])
            right_eye = lm.get("right_eye", [])
            eye_count = (1 if len(left_eye) > 0 else 0) + (1 if len(right_eye) > 0 else 0)

    prob_face = min(1.0, face_ratio * 3) if face_ratio > 0.1 else 0
    prob_centered = max(0, 1.0 - abs(cx - 0.5) * 4) * max(0, 1.0 - abs(cy - 0.5) * 4)
    prob_quality = 0
    if 50 <= brightness <= 210:
        prob_quality += 0.3
    if blur >= 50:
        prob_quality += 0.3
    if eye_count >= 2:
        prob_quality += 0.2
    if face_ratio >= 0.15:
        prob_quality += 0.2

    probability = prob_face * 0.4 + prob_centered * 0.3 + prob_quality * 0.3

    return {
        "brightness": round(brightness, 1),
        "blur": round(blur, 1),
        "centered": centered,
        "face_ratio": round(face_ratio, 3),
        "face_count": face_rect["count"],
        "eye_count": eye_count,
        "probability": round(probability, 3),
        "prob_face": round(prob_face, 3),
        "prob_centered": round(prob_centered, 3),
        "prob_quality": round(prob_quality, 3),
    }


def calcular_embedding(frame, face_rect):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    top, right, bottom, left = face_rect["top"], face_rect["right"], face_rect["bottom"], face_rect["left"]
    encs = face_recognition.face_encodings(rgb, [(top, right, bottom, left)])
    if len(encs) == 0:
        return None
    return encs[0].tolist()


def distancia(a, b):
    a = np.array(a, dtype=np.float64)
    b = np.array(b, dtype=np.float64)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a > 0:
        a = a / norm_a
    if norm_b > 0:
        b = b / norm_b
    dot = np.clip(np.dot(a, b), -1.0, 1.0)
    return float(1.0 - dot)


@app.get("/health")
def health():
    return {"status": "ok", "service": "face+delete", "engine": "face_recognition+dlib"}


@app.get("/")
def root():
    return {"service": "empresa-analitica-face", "engine": "face_recognition", "status": "running"}


@app.get("/face/debug-supabase")
def debug_supabase():
    """Debug Supabase connection and credentials"""
    try:
        # Test basic connection
        test_url = URL[:30] + "..." if URL and len(URL) > 30 else URL
        has_secret = bool(SECRET)
        has_service_role = bool(SERVICE_ROLE_KEY)
        
        # Test querying usuarios table
        usuarios_result = sb.table("usuarios").select("id, email").limit(3).execute()
        usuarios_count = len(usuarios_result.data) if usuarios_result.data else 0
        usuarios_sample = usuarios_result.data[:3] if usuarios_result.data else []
        
        # Test querying rostros table
        rostros_result = sb.table("rostros").select("id, usuario_id").limit(3).execute()
        rostros_count = len(rostros_result.data) if rostros_result.data else 0
        
        # Check specific usuario_id=9
        user9_result = sb.table("usuarios").select("id, email, nombre").eq("id", 9).execute()
        user9_found = bool(user9_result.data and len(user9_result.data) > 0)
        user9_data = user9_result.data[0] if user9_result.data else None
        
        return {
            "status": "ok",
            "url_preview": test_url,
            "has_secret_key": has_secret,
            "has_service_role_key": has_service_role,
            "usuarios_count": usuarios_count,
            "usuarios_sample": usuarios_sample,
            "rostros_count": rostros_count,
            "user9_exists": user9_found,
            "user9_data": user9_data,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "url_preview": URL[:30] + "..." if URL and len(URL) > 30 else URL,
            "has_secret_key": bool(SECRET),
            "has_service_role_key": bool(SERVICE_ROLE_KEY),
        }


@app.get("/face/check-registered")
def check_registered():
    rostros = sb.table("rostros").select("id").execute().data
    return {"count": len(rostros)}


@app.get("/face/test-user/{usuario_id}")
def test_user(usuario_id: int):
    """Test if a specific user exists in the database"""
    try:
        result = sb.table("usuarios").select("id, email, nombre").eq("id", usuario_id).execute()
        if result.data:
            return {"found": True, "user": result.data[0]}
        else:
            # Try to list all users
            all_users = sb.table("usuarios").select("id, email").limit(5).execute()
            return {"found": False, "all_users": all_users.data}
    except Exception as e:
        return {"found": False, "error": str(e)}


# ── FACE VALIDATE ──────────────────────────────────────────────

class FaceValidateReq(BaseModel):
    image: str
    expected_angle: str | None = None


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
            return {"ok": False, "error": "Alejate un poco de la camara."}

        return {"ok": True, "metricas": metricas}

    except Exception as e:
        print(f"[face] ERROR validate: {e}")
        traceback.print_exc()
        return {"ok": False, "error": "Error procesando imagen"}


# ── FACE ANGLE DETECTION ──────────────────────────────────────

class FaceAngleReq(BaseModel):
    image: str


@app.post("/face/detect-angle")
def face_detect_angle(req: FaceAngleReq):
    try:
        frame = imagen_base64_a_frame(req.image)
        if frame is None:
            return {"ok": False, "error": "No se pudo leer la imagen"}

        face = detectar_cara(frame)
        if face is None:
            return {"ok": False, "error": "No se detecto ningun rostro"}

        x, y, w, h = face["x"], face["y"], face["w"], face["h"]
        img_h, img_w = frame.shape[:2]

        face_center_x = (x + w / 2) / img_w
        nose_offset = (face_center_x - 0.5) * 2

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        face_locs = face_recognition.face_locations(rgb, model="hog")
        encs = face_recognition.face_encodings(rgb, face_locs)
        landmarks_list = face_recognition.face_landmarks(rgb, face_locs)

        eye_angle = 0
        if len(landmarks_list) > 0:
            lm = landmarks_list[0]
            left_eye = lm.get("left_eye", [])
            right_eye = lm.get("right_eye", [])
            if left_eye and right_eye:
                le_x = np.mean([p[0] for p in left_eye])
                re_x = np.mean([p[0] for p in right_eye])
                eye_center_x = (le_x + re_x) / 2
                eye_offset = (eye_center_x - w/2) / w
                eye_angle = -eye_offset

        combined_offset = nose_offset * 0.6 + eye_angle * 0.4

        if abs(combined_offset) < 0.15:
            angle = "frontal"
        elif combined_offset > 0.15:
            angle = "izquierda"
        else:
            angle = "derecha"

        probability = max(0, 1.0 - abs(combined_offset) * 2)

        embedding = None
        if len(encs) > 0:
            embedding = encs[0].tolist()

        return {
            "ok": True,
            "angle": angle,
            "nose_offset": round(float(nose_offset), 3),
            "eye_angle": round(float(eye_angle), 3),
            "combined_offset": round(float(combined_offset), 3),
            "probability": round(float(probability), 3),
            "face_rect": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
            "has_embedding": embedding is not None,
            "embedding_dims": len(embedding) if embedding else 0,
        }

    except Exception as e:
        print(f"[face] ERROR detect-angle: {e}")
        traceback.print_exc()
        return {"ok": False, "error": "Error detectando angulo"}


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

        print(f"[face] Buscando usuario_id={req.usuario_id} en tabla usuarios...")
        usuario = sb.table("usuarios").select("id, email, nombre").eq("id", req.usuario_id).execute()
        print(f"[face] Resultado busqueda usuario: {usuario.data}")
        
        if not usuario.data:
            # Try to list some users to debug
            try:
                all_users = sb.table("usuarios").select("id, email").limit(10).execute()
                print(f"[face] Usuarios en tabla (debug): {all_users.data}")
            except Exception as e2:
                print(f"[face] Error listing users for debug: {e2}")
            raise HTTPException(status_code=404, detail="Usuario no encontrado. Registrate primero.")

        existing = sb.table("rostros").select("id").eq("usuario_id", req.usuario_id).execute()

        def to_list(v):
            if isinstance(v, list):
                return [float(x) for x in v]
            return v

        update_data = {
            "embedding_frontal": to_list(embeddings.get("frontal")),
            "embedding_izquierda": to_list(embeddings.get("izquierda")),
            "embedding_derecha": to_list(embeddings.get("derecha")),
            "forma_rostro": req.face_shape or "",
            "proporciones": req.proporciones or {},
            "landmarks_68": req.landmarks_68 or [],
            "metadata": {
                "engine": "face_recognition+dlib",
                "embedding_dims": 128,
                "valid_angles": valid_count,
                "ratios": (req.proporciones or {}).get("ratios", []),
                "angles": (req.proporciones or {}).get("angles", []),
            },
        }

        print(f"[face] update_data keys: {list(update_data.keys())}")
        print(f"[face] embedding_frontal dims: {len(update_data['embedding_frontal']) if update_data['embedding_frontal'] else 0}")
        print(f"[face] proporciones: {bool(update_data['proporciones'])}")
        print(f"[face] landmarks_68 count: {len(update_data['landmarks_68'])}")

        if existing.data:
            try:
                result = sb.table("rostros").update(update_data).eq("usuario_id", req.usuario_id).execute()
                print(f"[face] Update OK: {result.data}")
            except Exception as e:
                print(f"[face] Error en update: {e}")
                # If update fails, try to add updated_at column suggestion
                if "updated_at" in str(e):
                    raise HTTPException(
                        status_code=500, 
                        detail="Error: La columna 'updated_at' no existe. Ejecuta en Supabase SQL: ALTER TABLE rostros ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();"
                    )
                raise HTTPException(status_code=500, detail=f"Error actualizando rostro: {str(e)}")
        else:
            update_data["usuario_id"] = req.usuario_id
            try:
                result = sb.table("rostros").insert(update_data).execute()
                print(f"[face] Insert OK: {result.data}")
            except Exception as e:
                print(f"[face] Error en insert: {e}")
                if "updated_at" in str(e):
                    raise HTTPException(
                        status_code=500, 
                        detail="Error: La columna 'updated_at' no existe. Ejecuta en Supabase SQL: ALTER TABLE rostros ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();"
                    )
                raise HTTPException(status_code=500, detail=f"Error guardando rostro: {str(e)}")

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
            login_arr = np.array(login_emb, dtype=np.float64)
            norm = np.linalg.norm(login_arr)
            if norm > 0:
                login_arr = login_arr / norm

            for r in rostros:
                uid = r["usuario_id"]
                for angle_key in ["embedding_frontal", "embedding_izquierda", "embedding_derecha"]:
                    stored_emb = r.get(angle_key)
                    if stored_emb is None:
                        continue
                    stored_arr = np.array(stored_emb, dtype=np.float64)
                    norm_s = np.linalg.norm(stored_arr)
                    if norm_s > 0:
                        stored_arr = stored_arr / norm_s
                    dist = distancia(login_arr.tolist(), stored_arr.tolist())
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
