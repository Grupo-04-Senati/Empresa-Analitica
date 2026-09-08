from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, and_
from datetime import datetime, timedelta
from app.database.connection import get_db
from app.database.models import Notificacion
from app.core.deps import get_current_user
from app.services.audit_service import registrar_auditoria, get_client_ip
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

class NotificacionCreate(BaseModel):
    titulo: str
    mensaje: str
    tipo: str = "info"
    accion_url: Optional[str] = None

@router.get("/")
async def listar_notificaciones(
    usuario_id: int = Depends(get_current_user),
    solo_no_leidas: bool = False,
    db: AsyncSession = Depends(get_db)
):
    try:
        uid = usuario_id.get("id") if isinstance(usuario_id, dict) else usuario_id
        query = select(Notificacion).where(Notificacion.usuario_id == uid)
        if solo_no_leidas:
            query = query.where(Notificacion.leida == False)
        query = query.order_by(Notificacion.created_at.desc()).limit(100)
        result = await db.execute(query)
        notifs = result.scalars().all()
        total_no_leidas = (await db.execute(
            select(func.count(Notificacion.id)).where(
                and_(Notificacion.usuario_id == uid, Notificacion.leida == False)
            )
        )).scalar() or 0
        return {
            "notificaciones": [
                {
                    "id": n.id,
                    "titulo": n.titulo,
                    "mensaje": n.mensaje,
                    "tipo": n.tipo,
                    "leida": n.leida,
                    "accion_url": n.accion_url,
                    "created_at": n.created_at.isoformat() if n.created_at else "",
                }
                for n in notifs
            ],
            "total_no_leidas": total_no_leidas,
        }
    except Exception as e:
        logger.error("Error listando notificaciones: %s", e)
        return {"notificaciones": [], "total_no_leidas": 0}

@router.post("/")
async def crear_notificacion(
    notif: NotificacionCreate,
    request: Request,
    usuario_actual: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    try:
        uid = usuario_actual.get("id") if isinstance(usuario_actual, dict) else usuario_actual
        db_notif = Notificacion(
            usuario_id=uid,
            titulo=notif.titulo,
            mensaje=notif.mensaje,
            tipo=notif.tipo,
            accion_url=notif.accion_url,
        )
        db.add(db_notif)
        await db.commit()
        await db.refresh(db_notif)
        return {"id": db_notif.id, "mensaje": "Notificación creada"}
    except Exception as e:
        logger.error("Error creando notificación: %s", e)
        raise HTTPException(status_code=500, detail="Error al crear notificación")

@router.put("/{notif_id}/leer")
async def marcar_leida(
    notif_id: int,
    usuario_actual: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    uid = usuario_actual.get("id") if isinstance(usuario_actual, dict) else usuario_actual
    result = await db.execute(
        select(Notificacion).where(Notificacion.id == notif_id, Notificacion.usuario_id == uid)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    notif.leida = True
    await db.commit()
    return {"mensaje": "Marcada como leída"}

@router.put("/leer-todas")
async def marcar_todas_leidas(
    usuario_actual: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    uid = usuario_actual.get("id") if isinstance(usuario_actual, dict) else usuario_actual
    result = await db.execute(
        select(Notificacion).where(Notificacion.usuario_id == uid, Notificacion.leida == False)
    )
    notifs = result.scalars().all()
    for n in notifs:
        n.leida = True
    await db.commit()
    return {"mensaje": f"{len(notifs)} notificaciones marcadas como leídas"}

@router.delete("/{notif_id}")
async def eliminar_notificacion(
    notif_id: int,
    usuario_actual: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    uid = usuario_actual.get("id") if isinstance(usuario_actual, dict) else usuario_actual
    result = await db.execute(
        select(Notificacion).where(Notificacion.id == notif_id, Notificacion.usuario_id == uid)
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    await db.delete(notif)
    await db.commit()
    return {"mensaje": "Notificación eliminada"}

@router.delete("/eliminar-todas")
async def eliminar_todas(
    usuario_actual: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    uid = usuario_actual.get("id") if isinstance(usuario_actual, dict) else usuario_actual
    await db.execute(
        delete(Notificacion).where(Notificacion.usuario_id == uid)
    )
    await db.commit()
    return {"mensaje": "Todas las notificaciones eliminadas"}

@router.delete("/eliminar-antiguas/{meses}")
async def eliminar_antiguas(
    meses: int,
    usuario_actual: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    uid = usuario_actual.get("id") if isinstance(usuario_actual, dict) else usuario_actual
    fecha_limite = datetime.utcnow() - timedelta(days=meses * 30)
    result = await db.execute(
        select(Notificacion).where(
            Notificacion.usuario_id == uid,
            Notificacion.created_at < fecha_limite
        )
    )
    notifs = result.scalars().all()
    for n in notifs:
        await db.delete(n)
    await db.commit()
    return {"mensaje": f"{len(notifs)} notificaciones antiguas eliminadas"}
