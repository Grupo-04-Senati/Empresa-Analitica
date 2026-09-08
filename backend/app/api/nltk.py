from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.connection import get_db
from app.database.models import Comentario, Cliente, AnalisisNLP, TiempoAtencion
from app.schemas import AnalisisRequest, AnalisisResponse
from app.services import nltk_service
from app.services.supabase_client import get_supabase
from app.services.audit_service import registrar_auditoria, get_client_ip
from app.core.deps import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/analizar", response_model=AnalisisResponse)
async def analizar_texto(req: AnalisisRequest, user: dict = Depends(get_current_user)):
    return nltk_service.analizar_texto(req.texto)

@router.get("/centro-inteligente")
async def centro_inteligente(db: AsyncSession = Depends(get_db)):
    try:
        total_clientes = (await db.execute(select(func.count(Cliente.id)))).scalar() or 0
        total_comentarios = (await db.execute(select(func.count(Comentario.id)))).scalar() or 0
        procesados = (await db.execute(select(func.count(Comentario.id)).where(Comentario.procesado == True))).scalar() or 0
        promedio = (await db.execute(select(func.avg(TiempoAtencion.tiempo_minutos)))).scalar() or 0
        return {
            "clientes": total_clientes,
            "comentarios": total_comentarios,
            "promedioRespuesta": round(float(promedio), 1),
            "procesados": round((procesados / total_comentarios * 100), 1) if total_comentarios > 0 else 0,
        }
    except Exception as e:
        logger.error("Error en centro-inteligente: %s", e)
        return {
            "clientes": 0,
            "comentarios": 0,
            "promedioRespuesta": 0,
            "procesados": 0,
        }

@router.get("/comentarios")
async def listar_comentarios_nlp(db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(Comentario).order_by(Comentario.fecha.desc()).limit(50))
        comentarios = res.scalars().all()
        return [
            {
                "id": c.id,
                "clienteId": c.cliente_id,
                "clienteNombre": f"Cliente #{c.cliente_id or c.id}",
                "empresa": "Corporativo",
                "texto": c.contenido,
                "categoria": c.categoria or "CONSULTA",
                "confianza": 92.0,
                "sentimiento": "positivo" if c.categoria == "FELICITACION" else "negativo" if c.categoria == "RECLAMO" else "neutro",
                "procesado": c.procesado,
                "fecha": c.fecha.isoformat() if c.fecha else "",
                "canal": c.canal or "web",
                "estado": c.estado or "procesado"
            }
            for c in comentarios
        ]
    except Exception as e:
        logger.error("Error en listar_comentarios_nlp: %s", e)
        return []

@router.get("/categorias")
async def listar_categorias_dist(db: AsyncSession = Depends(get_db)):
    colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626', '#0891b2']
    try:
        res = await db.execute(select(Comentario.categoria, func.count(Comentario.id)).group_by(Comentario.categoria))
        rows = res.all()
        total = sum(r[1] for r in rows) or 1
        return [
            {
                "nombre": r[0] or "OTROS",
                "total": r[1],
                "porcentaje": round((r[1] / total) * 100, 1),
                "color": colors[i % len(colors)]
            }
            for i, r in enumerate(rows) if r[0]
        ]
    except Exception as e:
        logger.error("Error en listar_categorias_dist: %s", e)
        return []

@router.get("/palabras-frecuentes")
async def palabras_frecuentes_get(db: AsyncSession = Depends(get_db)):
    try:
        res = await db.execute(select(Comentario.contenido).limit(100))
        textos = [r[0] for r in res.all() if r[0]]
        if not textos:
            return []
        freqs = nltk_service.calcular_frecuencias(textos)
        colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#ec4899']
        return [
            {"palabra": item["palabra"], "frecuencia": item["frecuencia"], "color": colors[i % len(colors)]}
            for i, item in enumerate(freqs[:15])
        ]
    except Exception as e:
        logger.error("Error en palabras_frecuentes_get: %s", e)
        return []

@router.post("/palabras-frecuentes")
async def palabras_frecuentes(textos: list[str], user: dict = Depends(get_current_user)):
    return {"palabras_frecuentes": nltk_service.calcular_frecuencias(textos)}

@router.post("/clasificar")
async def clasificar(req: dict, user: dict = Depends(get_current_user)):
    if "texto" in req:
        resultado_entrenado = nltk_service.clasificar_con_entrenamiento(req["texto"])
        resultado_keyword = nltk_service.analizar_texto(req["texto"])
        return {
            "texto": req["texto"],
            "categoria_entrenada": resultado_entrenado["categoria"],
            "confianza_entrenada": resultado_entrenado["confianza"],
            "distribucion": resultado_entrenado["distribucion"],
            "metodo": resultado_entrenado["metodo"],
            "categoria_keyword": resultado_keyword["categoria"],
            "sentimiento": resultado_keyword["sentimiento"],
            "tokens": resultado_keyword["tokens"],
            "palabras_frecuentes": resultado_keyword["palabras_frecuentes"],
        }
    elif "comentarios" in req:
        resultado = []
        for c in req.get("comentarios", []):
            texto = c.get("texto") or c.get("contenido") or ""
            analisis = nltk_service.clasificar_con_entrenamiento(texto)
            c["categoria"] = analisis["categoria"]
            c["confianza"] = analisis["confianza"]
            resultado.append(c)
        return resultado
    return {"mensaje": "Especifique texto o lista de comentarios"}

@router.post("/buscar-servicio")
async def buscar_servicio(req: dict, user: dict = Depends(get_current_user)):
    consulta = req.get("consulta", "")
    if not consulta.strip():
        return {"resultados": [], "mensaje": "Ingrese una consulta para buscar servicios"}
    resultados = nltk_service.buscar_servicio(consulta)
    return {
        "consulta": consulta,
        "resultados": resultados,
        "total": len(resultados),
    }

@router.get("/evaluar-clasificador")
async def evaluar_clasificador(user: dict = Depends(get_current_user)):
    try:
        resultado = nltk_service.evaluar_clasificador()
        return resultado
    except Exception as e:
        logger.error("Error evaluando clasificador: %s", e)
        raise HTTPException(status_code=500, detail=f"Error al evaluar clasificador: {str(e)}")
