from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.deps import get_current_user
from app.services.supabaseClient import get_supabase
from app.core.config import SUPABASE_URL
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class DeleteAccountRequest(BaseModel):
    password: str

class FaceLoginRequest(BaseModel):
    user_id: int

@router.post("/face-login")
async def face_login(req: FaceLoginRequest):
    sb = get_supabase()

    result = sb.table("usuarios").select("id, email, activo").eq("id", req.user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user = result.data[0]
    if not user.get("activo", True):
        raise HTTPException(status_code=403, detail="Cuenta desactivada")

    email = user["email"]

    try:
        link_result = sb.auth.admin.generate_link({
            "type": "magiclink",
            "email": email,
            "options": {
                "redirect_to": "http://localhost:5173"
            }
        })

        action_link = None
        if hasattr(link_result, 'action_link'):
            action_link = link_result.action_link
        elif isinstance(link_result, dict) and 'action_link' in link_result:
            action_link = link_result['action_link']
        elif hasattr(link_result, 'properties') and hasattr(link_result.properties, 'action_link'):
            action_link = link_result.properties.action_link

        if not action_link:
            logger.error(f"No action_link in response: {link_result}")
            raise HTTPException(status_code=500, detail="Error al generar enlace de sesion")

        return {"action_link": action_link}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Face login error: {e}")
        raise HTTPException(status_code=500, detail=f"Error al generar enlace: {str(e)}")

@router.delete("/delete-account")
async def delete_account(req: DeleteAccountRequest, current_user: dict = Depends(get_current_user)):
    email = current_user["email"]
    user_id = current_user["id"]

    sb = get_supabase()

    try:
        sb.auth.sign_in_with_password({"email": email, "password": req.password})
    except Exception:
        raise HTTPException(status_code=400, detail="Contrasena incorrecta")

    try:
        sb.table("rostros").delete().eq("usuario_id", user_id).execute()
    except Exception:
        pass

    try:
        sb.table("usuarios").delete().eq("email", email).execute()
    except Exception:
        pass

    try:
        users = sb.auth.admin.list_users()
        for u in users:
            if u.email == email:
                sb.auth.admin.delete_user(u.id)
                break
    except Exception:
        pass

    return {"success": True, "message": "Cuenta eliminada correctamente"}
