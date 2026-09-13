from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.connection import get_db
from app.database.models import Cliente, Comentario, TiempoAtencion, AnalisisNLP
from app.schemas import DashboardResponse

router = APIRouter()

@router.get("/", response_model=DashboardResponse)
async def dashboard(db: AsyncSession = Depends(get_db)):
    total_clientes = (await db.execute(select(func.count(Cliente.id)))).scalar() or 0
    total_comentarios = (await db.execute(select(func.count(Comentario.id)))).scalar() or 0

    promedio_result = await db.execute(select(func.avg(TiempoAtencion.tiempo_minutos)))
    promedio_atencion = round(float(promedio_result.scalar() or 0), 1)

    procesados = (await db.execute(select(func.count(Comentario.id)).where(Comentario.procesado == True))).scalar() or 0
    porcentaje = round((procesados / total_comentarios * 100) if total_comentarios > 0 else 0, 1)

    tiempos_result = await db.execute(
        select(TiempoAtencion.fecha, func.avg(TiempoAtencion.tiempo_minutos))
        .group_by(TiempoAtencion.fecha)
        .order_by(TiempoAtencion.fecha.desc())
        .limit(7)
    )
    tiempos_por_dia = [{"fecha": str(r[0]), "promedio": round(float(r[1]), 1)} for r in tiempos_result.all()]

    analisis_result = await db.execute(
        select(AnalisisNLP.categoria_detectada, func.count(AnalisisNLP.id))
        .where(AnalisisNLP.categoria_detectada.isnot(None))
        .group_by(AnalisisNLP.categoria_detectada)
    )
    categorias_nlp = [{"categoria": r[0], "cantidad": r[1]} for r in analisis_result.all()]

    return DashboardResponse(
        total_clientes=total_clientes,
        total_comentarios=total_comentarios,
        promedio_atencion=promedio_atencion,
        porcentaje_procesados=porcentaje,
        tiempos_por_dia=tiempos_por_dia,
        categorias_nlp=categorias_nlp,
        palabras_frecuentes=[],
    )
