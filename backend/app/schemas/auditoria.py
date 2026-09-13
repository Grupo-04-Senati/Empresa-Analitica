from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class AuditoriaBase(BaseModel):
    usuario_id: Optional[int] = None
    accion: str
    tabla: Optional[str] = None
    registro_id: Optional[int] = None
    detalles: Optional[Any] = None
    ip: Optional[str] = None


class AuditoriaCreate(AuditoriaBase):
    pass


class AuditoriaResponse(AuditoriaBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
