from pydantic import BaseModel
from typing import Optional


class EstadisticasRequest(BaseModel):
    valores: list[float]


class EstadisticasResponse(BaseModel):
    cantidad: int
    media: float
    mediana: float
    desviacion_estandar: float
    minimo: float
    maximo: float
    percentil_25: float
    percentil_75: float


class AnalisisRequest(BaseModel):
    texto: str


class AnalisisResponse(BaseModel):
    idioma: str
    cantidad_palabras: int
    tokens: list[str]
    keywords: list[str]
    temas: list[str]
    palabras_frecuentes: list[dict]
    categoria: str
    categoria_detectada: str
    sentimiento: str
    confianza: float


class PalabraFrecuente(BaseModel):
    palabra: str
    frecuencia: int
    color: Optional[str] = None


class TiempoPorDia(BaseModel):
    fecha: str
    promedio: float


class CategoriaNLP(BaseModel):
    categoria: str
    cantidad: int


class DashboardResponse(BaseModel):
    total_clientes: int
    total_comentarios: int
    promedio_atencion: float
    porcentaje_procesados: float
    tiempos_por_dia: list[TiempoPorDia]
    categorias_nlp: list[CategoriaNLP]
    palabras_frecuentes: list[PalabraFrecuente]
