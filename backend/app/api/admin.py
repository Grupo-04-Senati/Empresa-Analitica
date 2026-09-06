from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.core.deps import get_current_user, require_admin
from app.services.supabase_client import get_supabase
from app.services.audit_service import registrar_auditoria, get_client_ip

router = APIRouter()

class CambioRolRequest(BaseModel):
    nuevo_rol: str

class UpdateUsuarioRequest(BaseModel):
    nombre: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None

@router.get("/usuarios")
async def listar_usuarios(user: dict = Depends(require_admin)):
    supabase = get_supabase()
    response = supabase.table("usuarios").select("id, nombre, email, rol, activo, created_at").order("created_at", desc=True).execute()
    return response.data or []

@router.get("/usuarios/{usuario_id}")
async def obtener_usuario(usuario_id: int, user: dict = Depends(require_admin)):
    supabase = get_supabase()
    response = supabase.table("usuarios").select("id, nombre, email, rol, activo, created_at").eq("id", usuario_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return response.data[0]

@router.put("/usuarios/{usuario_id}/rol")
async def cambiar_rol(usuario_id: int, req: CambioRolRequest, request: Request, user: dict = Depends(require_admin)):
    supabase = get_supabase()
    
    response = supabase.table("usuarios").select("id, nombre, email, rol").eq("id", usuario_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    usuario_actual = response.data[0]
    rol_anterior = usuario_actual["rol"]
    
    if req.nuevo_rol.upper() not in ["ADMIN", "ANALISTA", "SUPERVISOR", "USUARIO"]:
        raise HTTPException(status_code=400, detail="Rol no válido")
    
    supabase.table("usuarios").update({"rol": req.nuevo_rol.upper(), "updated_at": "now()"}).eq("id", usuario_id).execute()
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="CAMBIAR_ROL",
        tabla="usuarios",
        registro_id=usuario_id,
        detalles={
            "usuario_afectado": usuario_actual["email"],
            "rol_anterior": rol_anterior,
            "rol_nuevo": req.nuevo_rol.upper()
        },
        ip=get_client_ip(request)
    )
    
    return {"mensaje": "Rol actualizado correctamente", "rol_anterior": rol_anterior, "rol_nuevo": req.nuevo_rol.upper()}

@router.put("/usuarios/{usuario_id}")
async def actualizar_usuario(usuario_id: int, req: UpdateUsuarioRequest, request: Request, user: dict = Depends(require_admin)):
    supabase = get_supabase()
    
    response = supabase.table("usuarios").select("id, nombre, email, rol, activo").eq("id", usuario_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    updates = {}
    if req.nombre is not None:
        updates["nombre"] = req.nombre
    if req.rol is not None:
        if req.rol.upper() not in ["ADMIN", "ANALISTA", "SUPERVISOR", "USUARIO"]:
            raise HTTPException(status_code=400, detail="Rol no válido")
        updates["rol"] = req.rol.upper()
    if req.activo is not None:
        updates["activo"] = req.activo
    
    if updates:
        updates["updated_at"] = "now()"
        supabase.table("usuarios").update(updates).eq("id", usuario_id).execute()
        
        registrar_auditoria(
            usuario_id=user["id"],
            accion="ACTUALIZAR_USUARIO",
            tabla="usuarios",
            registro_id=usuario_id,
            detalles={"campo_modificado": list(updates.keys())},
            ip=get_client_ip(request)
        )
    
    return {"mensaje": "Usuario actualizado correctamente"}

@router.delete("/usuarios/{usuario_id}")
async def eliminar_usuario(usuario_id: int, request: Request, user: dict = Depends(require_admin)):
    supabase = get_supabase()
    
    response = supabase.table("usuarios").select("id, email").eq("id", usuario_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if usuario_id == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    
    supabase.table("usuarios").update({"activo": False}).eq("id", usuario_id).execute()
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="DESACTIVAR_USUARIO",
        tabla="usuarios",
        registro_id=usuario_id,
        detalles={"usuario_desactivado": response.data[0]["email"]},
        ip=get_client_ip(request)
    )
    
    return {"mensaje": "Usuario desactivado correctamente"}

@router.get("/auditoria")
async def listar_auditoria(user: dict = Depends(require_admin), limit: int = 50):
    supabase = get_supabase()
    response = supabase.table("auditoria").select("*, usuarios(nombre, email)").order("created_at", desc=True).limit(limit).execute()
    return response.data or []
