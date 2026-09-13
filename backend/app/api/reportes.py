from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.connection import get_db
from app.database.models import Comentario, AnalisisNLP, TiempoAtencion, MetricaEstadistica, Cliente
from app.services.supabase_client import get_supabase
from app.services import scipy_service, nltk_service
from datetime import date, datetime, timedelta

router = APIRouter()

@router.get("/nlp")
async def reporte_nlp(db: AsyncSession = Depends(get_db)):
    try:
        total_analisis = (await db.execute(select(func.count(AnalisisNLP.id)))).scalar() or 0
        total_comentarios = (await db.execute(select(func.count(Comentario.id)))).scalar() or 0

        cat_result = await db.execute(
            select(AnalisisNLP.categoria_detectada, func.count(AnalisisNLP.id))
            .where(AnalisisNLP.categoria_detectada.isnot(None))
            .group_by(AnalisisNLP.categoria_detectada)
        )
        categorias = [{"nombre": r[0], "total": r[1]} for r in cat_result.all()]

        confianza_result = await db.execute(
            select(func.avg(AnalisisNLP.confianza))
            .where(AnalisisNLP.confianza.isnot(None))
        )
        confianza_prom = confianza_result.scalar()

        analisis_detalle = await db.execute(
            select(
                AnalisisNLP.id,
                AnalisisNLP.comentario_id,
                AnalisisNLP.categoria_detectada,
                AnalisisNLP.confianza,
                Comentario.contenido,
                Cliente.nombre.label("cliente_nombre"),
            )
            .join(Comentario, AnalisisNLP.comentario_id == Comentario.id, isouter=True)
            .join(Cliente, Comentario.cliente_id == Cliente.id, isouter=True)
            .order_by(AnalisisNLP.id.desc())
            .limit(50)
        )
        detalle = [
            {
                "id": r[0],
                "comentario_id": r[1],
                "categoria_detectada": r[2],
                "confianza": float(r[3]) * 100 if r[3] else None,
                "contenido": r[4] or "",
                "cliente_nombre": r[5] or "—",
            }
            for r in analisis_detalle.all()
        ]

        return {
            "total_analisis": total_analisis,
            "total_comentarios": total_comentarios,
            "confianza_promedio": round(float(confianza_prom) * 100, 1) if confianza_prom else 0,
            "categorias": categorias,
            "detalle": detalle,
            "tiene_datos": total_analisis > 0,
        }
    except Exception as e:
        return {
            "total_analisis": 0,
            "total_comentarios": 0,
            "confianza_promedio": 0,
            "categorias": [],
            "detalle": [],
            "tiene_datos": False,
            "error": str(e),
        }


@router.get("/atencion")
async def reporte_atencion(db: AsyncSession = Depends(get_db)):
    try:
        total = (await db.execute(select(func.count(TiempoAtencion.id)))).scalar() or 0
        promedio_result = await db.execute(select(func.avg(TiempoAtencion.tiempo_minutos)))
        promedio = round(float(promedio_result.scalar() or 0), 1)

        SLA = 30
        dentro_sla = (await db.execute(
            select(func.count(TiempoAtencion.id))
            .where(TiempoAtencion.tiempo_minutos <= SLA)
        )).scalar() or 0
        sla_pct = round((dentro_sla / total * 100), 1) if total > 0 else 0

        tiempos_diarios = await db.execute(
            select(
                TiempoAtencion.fecha,
                func.avg(TiempoAtencion.tiempo_minutos).label("promedio"),
                func.count(TiempoAtencion.id).label("cantidad"),
            )
            .group_by(TiempoAtencion.fecha)
            .order_by(TiempoAtencion.fecha.desc())
            .limit(30)
        )
        historial = [
            {
                "fecha": str(r[0]),
                "promedio": round(float(r[1]), 1),
                "cantidad": r[2],
                "sla": SLA,
            }
            for r in tiempos_diarios.all()
        ]

        min_result = await db.execute(select(func.min(TiempoAtencion.tiempo_minutos)))
        max_result = await db.execute(select(func.max(TiempoAtencion.tiempo_minutos)))
        minimo = round(float(min_result.scalar() or 0), 1)
        maximo = round(float(max_result.scalar() or 0), 1)

        return {
            "total": total,
            "promedio": promedio,
            "minimo": minimo,
            "maximo": maximo,
            "dentro_sla": dentro_sla,
            "fuera_sla": total - dentro_sla,
            "sla_pct": sla_pct,
            "historial": historial,
            "tiene_datos": total > 0,
        }
    except Exception as e:
        return {
            "total": 0,
            "promedio": 0,
            "minimo": 0,
            "maximo": 0,
            "dentro_sla": 0,
            "fuera_sla": 0,
            "sla_pct": 0,
            "historial": [],
            "tiene_datos": False,
            "error": str(e),
        }


@router.get("/estadisticas")
async def reporte_estadisticas(db: AsyncSession = Depends(get_db)):
    try:
        tiempos_res = await db.execute(select(TiempoAtencion.tiempo_minutos).where(TiempoAtencion.tiempo_minutos.isnot(None)))
        tiempos = [float(r[0]) for r in tiempos_res.all() if r[0] is not None]

        stats_tiempos = None
        if len(tiempos) >= 2:
            stats_tiempos = scipy_service.calcular_estadisticas(tiempos)
        elif len(tiempos) == 1:
            stats_tiempos = {
                "cantidad": 1,
                "media": tiempos[0],
                "mediana": tiempos[0],
                "desviacion_estandar": 0,
                "minimo": tiempos[0],
                "maximo": tiempos[0],
                "percentil_25": tiempos[0],
                "percentil_75": tiempos[0],
            }

        cat_result = await db.execute(
            select(Comentario.categoria, func.count(Comentario.id))
            .where(Comentario.categoria.isnot(None))
            .group_by(Comentario.categoria)
        )
        categorias = [{"nombre": r[0], "total": r[1]} for r in cat_result.all()]

        total_comentarios = (await db.execute(select(func.count(Comentario.id)))).scalar() or 0
        procesados = (await db.execute(
            select(func.count(Comentario.id)).where(Comentario.procesado == True)
        )).scalar() or 0
        total_analisis = (await db.execute(select(func.count(AnalisisNLP.id)))).scalar() or 0

        interpolacion = None
        if len(tiempos) >= 2:
            x_base = list(range(1, len(tiempos) + 1))
            x_new = list(range(1, len(tiempos) + 3))
            interp = scipy_service.interpolar_datos(x_base, tiempos, x_new)
            interpolacion = {
                "puntos": [
                    {"x": interp["x"][i], "observado": tiempos[i] if i < len(tiempos) else None, "interpolado": interp["y"][i]}
                    for i in range(len(interp["x"]))
                ]
            }

        return {
            "stats_tiempos": stats_tiempos,
            "categorias": categorias,
            "total_comentarios": total_comentarios,
            "procesados": procesados,
            "total_analisis": total_analisis,
            "interpolacion": interpolacion,
            "tiene_datos": len(tiempos) > 0,
        }
    except Exception as e:
        return {
            "stats_tiempos": None,
            "categorias": [],
            "total_comentarios": 0,
            "procesados": 0,
            "total_analisis": 0,
            "interpolacion": None,
            "tiene_datos": False,
            "error": str(e),
        }
