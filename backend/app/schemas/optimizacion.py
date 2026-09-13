from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Any


class OptimizacionBase(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    parametros_entrada: Any
    resultado: Optional[Any] = None
    costo_inicial: Optional[float] = None
    costo_optimizado: Optional[float] = None
    estado: str = "pendiente"


class OptimizacionCreate(OptimizacionBase):
    pass


class OptimizacionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    resultado: Optional[Any] = None
    costo_optimizado: Optional[float] = None
    estado: Optional[str] = None


class OptimizacionResponse(OptimizacionBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
