from pydantic import BaseModel
from datetime import datetime, date
from typing import Optional

# === USUARIOS ===
class UsuarioBase(BaseModel):
    nombre: str
    email: str
    rol: str = "usuario"

class UsuarioCreate(UsuarioBase):
    password: str

class UsuarioResponse(UsuarioBase):
    id: int
    activo: bool
    created_at: datetime
    class Config:
        from_attributes = True

# === CLIENTES ===
class ClienteBase(BaseModel):
    nombre: str
    email: Optional[str] = None
    telefono: Optional[str] = None
    empresa: Optional[str] = None

class ClienteCreate(ClienteBase):
    pass

class ClienteResponse(ClienteBase):
    id: int
    activo: bool
    created_at: datetime
    class Config:
        from_attributes = True

# === CATEGORIAS ===
class CategoriaBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class CategoriaCreate(CategoriaBase):
    pass

class CategoriaResponse(CategoriaBase):
    id: int
    activo: bool
    created_at: datetime
    class Config:
        from_attributes = True

# === COMENTARIOS ===
class ComentarioBase(BaseModel):
    cliente_id: Optional[int] = None
    contenido: str
    canal: str = "web"
    categoria: Optional[str] = None

class ComentarioCreate(ComentarioBase):
    pass

class ComentarioResponse(ComentarioBase):
    id: int
    estado: str
    fecha: datetime
    procesado: bool
    class Config:
        from_attributes = True

# === ANALISIS NLP ===
class AnalisisNLPResponse(BaseModel):
    id: int
    comentario_id: int
    idioma: str
    cantidad_palabras: int
    palabras_limpias: Optional[list] = None
    palabras_frecuentes: Optional[list] = None
    categoria_detectada: Optional[str] = None
    confianza: Optional[float] = None
    fecha_analisis: datetime
    class Config:
        from_attributes = True

class AnalisisRequest(BaseModel):
    texto: str

class AnalisisResponse(BaseModel):
    idioma: str
    cantidad_palabras: int
    tokens: list[str] = []
    keywords: list[str] = []
    temas: list[str] = []
    palabras_frecuentes: list[dict] = []
    categoria: str
    categoria_detectada: Optional[str] = None
    sentimiento: Optional[str] = "neutro"
    confianza: Optional[float] = None

# === TIEMPOS DE ATENCION ===
class TiempoAtencionBase(BaseModel):
    cliente_id: Optional[int] = None
    comentario_id: Optional[int] = None
    tiempo_minutos: float
    operador: Optional[str] = None

class TiempoAtencionCreate(TiempoAtencionBase):
    pass

class TiempoAtencionResponse(TiempoAtencionBase):
    id: int
    fecha: date
    created_at: datetime
    class Config:
        from_attributes = True

# === METRICAS ESTADISTICAS ===
class MetricaEstadisticaResponse(BaseModel):
    id: int
    fecha_inicio: date
    fecha_fin: date
    cantidad_registros: int
    media: Optional[float] = None
    mediana: Optional[float] = None
    desviacion_estandar: Optional[float] = None
    minimo: Optional[float] = None
    maximo: Optional[float] = None
    percentil_25: Optional[float] = None
    percentil_75: Optional[float] = None
    created_at: datetime
    class Config:
        from_attributes = True

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

# === OPTIMIZACIONES ===
class OptimizacionBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    parametros_entrada: dict
    costo_inicial: Optional[float] = None

class OptimizacionCreate(OptimizacionBase):
    pass

class OptimizacionResponse(OptimizacionBase):
    id: int
    resultado: Optional[dict] = None
    costo_optimizado: Optional[float] = None
    estado: str
    created_at: datetime
    class Config:
        from_attributes = True

# === INTERPOLACION ===
class InterpolacionRequest(BaseModel):
    x: list[float]
    y: list[float]
    x_new: list[float]

class InterpolacionResponse(BaseModel):
    x: list[float]
    y: list[float]

# === DASHBOARD ===
class DashboardResponse(BaseModel):
    total_clientes: int
    total_comentarios: int
    promedio_atencion: float
    porcentaje_procesados: float
    tiempos_por_dia: list[dict]
    categorias_nlp: list[dict]
    palabras_frecuentes: list[dict]
