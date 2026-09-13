from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ComentarioBase(BaseModel):
    cliente_id: Optional[int] = None
    contenido: str
    canal: str = "web"
    estado: str = "pendiente"
    categoria: Optional[str] = None


class ComentarioCreate(ComentarioBase):
    pass


class ComentarioUpdate(BaseModel):
    contenido: Optional[str] = None
    canal: Optional[str] = None
    estado: Optional[str] = None
    categoria: Optional[str] = None


class ComentarioResponse(ComentarioBase):
    id: int
    fecha: Optional[datetime] = None
    procesado: bool = False

    class Config:
        from_attributes = True
