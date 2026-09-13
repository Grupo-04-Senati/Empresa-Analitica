from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class MetricaEstadisticaBase(BaseModel):
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


class MetricaEstadisticaCreate(MetricaEstadisticaBase):
    pass


class MetricaEstadisticaResponse(MetricaEstadisticaBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
