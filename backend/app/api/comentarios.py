from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.database.models import Comentario, AnalisisNLP
from app.schemas import ComentarioCreate, ComentarioResponse, AnalisisNLPResponse
from app.services import nltk_service
from app.services.audit_service import registrar_auditoria, get_client_ip
from app.core.deps import get_current_user

router = APIRouter()

@router.get("/", response_model=list[ComentarioResponse])
async def listar_comentarios(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Comentario).order_by(Comentario.fecha.desc()))
    return result.scalars().all()

@router.get("/{comentario_id}", response_model=ComentarioResponse)
async def obtener_comentario(comentario_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Comentario).where(Comentario.id == comentario_id))
    comentario = result.scalar_one_or_none()
    if not comentario:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    return comentario

@router.post("/", response_model=ComentarioResponse)
async def crear_comentario(comentario: ComentarioCreate, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    db_comentario = Comentario(**comentario.model_dump())
    db.add(db_comentario)
    await db.commit()
    await db.refresh(db_comentario)
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="CREAR",
        tabla="comentarios",
        registro_id=db_comentario.id,
        detalles={"canal": comentario.canal, "cliente_id": comentario.cliente_id},
        ip=get_client_ip(request)
    )
    
    return db_comentario

@router.post("/{comentario_id}/procesar", response_model=AnalisisNLPResponse)
async def procesar_comentario(comentario_id: int, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Comentario).where(Comentario.id == comentario_id))
    comentario = result.scalar_one_or_none()
    if not comentario:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")

    analisis = nltk_service.analizar_texto(comentario.contenido)

    db_analisis = AnalisisNLP(
        comentario_id=comentario_id,
        idioma=analisis["idioma"],
        cantidad_palabras=analisis["cantidad_palabras"],
        palabras_limpias=analisis["tokens"],
        palabras_frecuentes=analisis["palabras_frecuentes"],
        categoria_detectada=analisis["categoria"],
        confianza=analisis["confianza"],
    )
    db.add(db_analisis)

    comentario.estado = "procesado"
    comentario.procesado = True
    comentario.categoria = analisis["categoria"]

    await db.commit()
    await db.refresh(db_analisis)
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="PROCESAR_COMENTARIO",
        tabla="comentarios",
        registro_id=comentario_id,
        detalles={"categoria": analisis["categoria"], "confianza": analisis["confianza"]},
        ip=get_client_ip(request)
    )
    
    return db_analisis

@router.delete("/{comentario_id}")
async def eliminar_comentario(comentario_id: int, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Comentario).where(Comentario.id == comentario_id))
    comentario = result.scalar_one_or_none()
    if not comentario:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    await db.delete(comentario)
    await db.commit()
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="ELIMINAR",
        tabla="comentarios",
        registro_id=comentario_id,
        ip=get_client_ip(request)
    )
    
    return {"ok": True}
