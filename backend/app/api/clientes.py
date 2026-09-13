from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database.connection import get_db
from app.database.models import Cliente
from app.schemas import ClienteCreate, ClienteResponse
from app.services.audit_service import registrar_auditoria, get_client_ip
from app.core.deps import get_current_user

router = APIRouter()

@router.get("/", response_model=list[ClienteResponse])
async def listar_clientes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Cliente).where(Cliente.activo == True))
    return result.scalars().all()

@router.get("/{cliente_id}", response_model=ClienteResponse)
async def obtener_cliente(cliente_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return cliente

@router.post("/", response_model=ClienteResponse)
async def crear_cliente(cliente: ClienteCreate, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    db_cliente = Cliente(**cliente.model_dump())
    db.add(db_cliente)
    await db.commit()
    await db.refresh(db_cliente)
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="CREAR",
        tabla="clientes",
        registro_id=db_cliente.id,
        detalles={"nombre": cliente.nombre, "empresa": cliente.empresa},
        ip=get_client_ip(request)
    )
    
    return db_cliente

@router.put("/{cliente_id}", response_model=ClienteResponse)
async def actualizar_cliente(cliente_id: int, cliente: ClienteCreate, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    db_cliente = result.scalar_one_or_none()
    if not db_cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    for key, value in cliente.model_dump().items():
        setattr(db_cliente, key, value)
    await db.commit()
    await db.refresh(db_cliente)
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="ACTUALIZAR",
        tabla="clientes",
        registro_id=cliente_id,
        ip=get_client_ip(request)
    )
    
    return db_cliente

@router.delete("/{cliente_id}")
async def eliminar_cliente(cliente_id: int, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    await db.delete(cliente)
    await db.commit()
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="ELIMINAR",
        tabla="clientes",
        registro_id=cliente_id,
        ip=get_client_ip(request)
    )
    
    return {"ok": True, "mensaje": "Cliente eliminado permanentemente"}

@router.patch("/{cliente_id}/toggle-status", response_model=ClienteResponse)
async def alternar_estado_cliente(cliente_id: int, request: Request, db: AsyncSession = Depends(get_db), user: dict = Depends(get_current_user)):
    result = await db.execute(select(Cliente).where(Cliente.id == cliente_id))
    cliente = result.scalar_one_or_none()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    cliente.activo = not cliente.activo
    await db.commit()
    await db.refresh(cliente)
    
    registrar_auditoria(
        usuario_id=user["id"],
        accion="CAMBIAR_ESTADO",
        tabla="clientes",
        registro_id=cliente_id,
        detalles={"activo": cliente.activo},
        ip=get_client_ip(request)
    )
    
    return cliente
