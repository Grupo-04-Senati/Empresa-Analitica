from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class AnalisisNLPBase(BaseModel):
    comentario_id: int
    idioma: str = "es"
    cantidad_palabras: int = 0
    palabras_limpias: Optional[Any] = None
    palabras_frecuentes: Optional[Any] = None
    categoria_detectada: Optional[str] = None
    confianza: Optional[float] = None


class AnalisisNLPCreate(AnalisisNLPBase):
    pass


class AnalisisNLPResponse(AnalisisNLPBase):
    id: int
    fecha_analisis: Optional[datetime] = None

    class Config:
        from_attributes = True
