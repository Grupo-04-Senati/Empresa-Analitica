from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.database.models import TiempoAtencion
from app.schemas import TiempoAtencionCreate, TiempoAtencionResponse
from app.core.deps import get_current_user
from app.services.audit_service import registrar_auditoria, get_client_ip

router = APIRouter()

@router.get("/", response_model=list[TiempoAtencionResponse])
async def listar_tiempos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TiempoAtencion).order_by(TiempoAtencion.created_at.desc()))
    return result.scalars().all()

@router.get("/{tiempo_id}", response_model=TiempoAtencionResponse)
async def obtener_tiempo(tiempo_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TiempoAtencion).where(TiempoAtencion.id == tiempo_id))
    tiempo = result.scalar_one_or_none()
    if not tiempo:
        raise HTTPException(status_code=404, detail="Tiempo de atención no encontrado")
    return tiempo

@router.post("/", response_model=TiempoAtencionResponse)
async def crear_tiempo(tiempo: TiempoAtencionCreate, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    db_tiempo = TiempoAtencion(**tiempo.model_dump())
    db.add(db_tiempo)
    await db.commit()
    await db.refresh(db_tiempo)
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="CREAR",
        tabla="tiempos_atencion",
        registro_id=db_tiempo.id,
        detalles={"tiempo_minutos": tiempo.tiempo_minutos, "cliente_id": tiempo.cliente_id},
        ip=get_client_ip(request)
    )
    
    return db_tiempo

@router.put("/{tiempo_id}", response_model=TiempoAtencionResponse)
async def actualizar_tiempo(tiempo_id: int, tiempo: TiempoAtencionCreate, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(TiempoAtencion).where(TiempoAtencion.id == tiempo_id))
    db_tiempo = result.scalar_one_or_none()
    if not db_tiempo:
        raise HTTPException(status_code=404, detail="Tiempo de atención no encontrado")
    for key, value in tiempo.model_dump().items():
        setattr(db_tiempo, key, value)
    await db.commit()
    await db.refresh(db_tiempo)
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="ACTUALIZAR",
        tabla="tiempos_atencion",
        registro_id=tiempo_id,
        ip=get_client_ip(request)
    )
    
    return db_tiempo

@router.delete("/{tiempo_id}")
async def eliminar_tiempo(tiempo_id: int, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(TiempoAtencion).where(TiempoAtencion.id == tiempo_id))
    tiempo = result.scalar_one_or_none()
    if not tiempo:
        raise HTTPException(status_code=404, detail="Tiempo de atención no encontrado")
    await db.delete(tiempo)
    await db.commit()
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="ELIMINAR",
        tabla="tiempos_atencion",
        registro_id=tiempo_id,
        ip=get_client_ip(request)
    )
    
    return {"ok": True}
