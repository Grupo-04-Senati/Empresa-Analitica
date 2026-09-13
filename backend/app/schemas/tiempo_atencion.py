from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class TiempoAtencionBase(BaseModel):
    cliente_id: Optional[int] = None
    comentario_id: Optional[int] = None
    tiempo_minutos: float
    operador: Optional[str] = None


class TiempoAtencionCreate(TiempoAtencionBase):
    pass


class TiempoAtencionResponse(TiempoAtencionBase):
    id: int
    fecha: Optional[date] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
