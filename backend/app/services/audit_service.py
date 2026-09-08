from fastapi import Request
from app.services.supabase_client import get_supabase
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def registrar_auditoria(
    usuario_id: int,
    accion: str,
    tabla: str = None,
    registro_id: int = None,
    detalles: dict = None,
    ip: str = None
):
    try:
        supabase = get_supabase()
        supabase.table("auditoria").insert({
            "usuario_id": usuario_id,
            "accion": accion,
            "tabla": tabla,
            "registro_id": registro_id,
            "detalles": detalles or {},
            "ip": ip,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        logger.warning("Error en auditoría: %s", e)

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0]
    return request.client.host if request.client else "unknown"
