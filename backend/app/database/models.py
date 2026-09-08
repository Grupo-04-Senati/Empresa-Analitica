from sqlalchemy import Column, BigInteger, String, Text, Boolean, Integer, Numeric, Date, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class Usuario(Base):
    __tablename__ = "usuarios"
    id = Column(BigInteger, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    rol = Column(String(30), nullable=False, default="usuario")
    activo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    auditorias = relationship("Auditoria", back_populates="usuario")
    notificaciones = relationship("Notificacion", back_populates="usuario")

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(BigInteger, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    email = Column(String(200))
    telefono = Column(String(50))
    empresa = Column(String(200))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    comentarios = relationship("Comentario", back_populates="cliente")
    tiempos = relationship("TiempoAtencion", back_populates="cliente")

class Categoria(Base):
    __tablename__ = "categorias"
    id = Column(BigInteger, primary_key=True, index=True)
    nombre = Column(String(100), unique=True, nullable=False)
    descripcion = Column(Text)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Comentario(Base):
    __tablename__ = "comentarios"
    id = Column(BigInteger, primary_key=True, index=True)
    cliente_id = Column(BigInteger, ForeignKey("clientes.id", ondelete="SET NULL"))
    contenido = Column(Text, nullable=False)
    canal = Column(String(30), default="web")
    estado = Column(String(30), default="pendiente")
    categoria = Column(String(50))
    fecha = Column(DateTime, default=datetime.utcnow)
    procesado = Column(Boolean, default=False)

    cliente = relationship("Cliente", back_populates="comentarios")
    analisis = relationship("AnalisisNLP", back_populates="comentario", uselist=False)
    tiempo = relationship("TiempoAtencion", back_populates="comentario", uselist=False)

class AnalisisNLP(Base):
    __tablename__ = "analisis_nlp"
    id = Column(BigInteger, primary_key=True, index=True)
    comentario_id = Column(BigInteger, ForeignKey("comentarios.id", ondelete="CASCADE"), nullable=False)
    idioma = Column(String(20), default="es")
    cantidad_palabras = Column(Integer, default=0)
    palabras_limpias = Column(JSON)
    palabras_frecuentes = Column(JSON)
    categoria_detectada = Column(String(100))
    confianza = Column(Numeric(5, 4))
    fecha_analisis = Column(DateTime, default=datetime.utcnow)

    comentario = relationship("Comentario", back_populates="analisis")

class TiempoAtencion(Base):
    __tablename__ = "tiempos_atencion"
    id = Column(BigInteger, primary_key=True, index=True)
    cliente_id = Column(BigInteger, ForeignKey("clientes.id", ondelete="SET NULL"))
    comentario_id = Column(BigInteger, ForeignKey("comentarios.id", ondelete="SET NULL"))
    tiempo_minutos = Column(Numeric(10, 2), nullable=False)
    fecha = Column(Date, default=datetime.utcnow)
    operador = Column(String(150))
    created_at = Column(DateTime, default=datetime.utcnow)

    cliente = relationship("Cliente", back_populates="tiempos")
    comentario = relationship("Comentario", back_populates="tiempo")

class MetricaEstadistica(Base):
    __tablename__ = "metricas_estadisticas"
    id = Column(BigInteger, primary_key=True, index=True)
    fecha_inicio = Column(Date, nullable=False)
    fecha_fin = Column(Date, nullable=False)
    cantidad_registros = Column(Integer, nullable=False)
    media = Column(Numeric(12, 4))
    mediana = Column(Numeric(12, 4))
    desviacion_estandar = Column(Numeric(12, 4))
    minimo = Column(Numeric(12, 4))
    maximo = Column(Numeric(12, 4))
    percentil_25 = Column(Numeric(12, 4))
    percentil_75 = Column(Numeric(12, 4))
    created_at = Column(DateTime, default=datetime.utcnow)

class Optimizacion(Base):
    __tablename__ = "optimizaciones"
    id = Column(BigInteger, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(Text)
    parametros_entrada = Column(JSON, nullable=False)
    resultado = Column(JSON)
    costo_inicial = Column(Numeric(14, 4))
    costo_optimizado = Column(Numeric(14, 4))
    estado = Column(String(30), default="pendiente")
    created_at = Column(DateTime, default=datetime.utcnow)

class Auditoria(Base):
    __tablename__ = "auditoria"
    id = Column(BigInteger, primary_key=True, index=True)
    usuario_id = Column(BigInteger, ForeignKey("usuarios.id", ondelete="SET NULL"))
    accion = Column(String(100), nullable=False)
    tabla = Column(String(100))
    registro_id = Column(BigInteger)
    detalles = Column(JSON)
    ip = Column(String(45))
    created_at = Column(DateTime, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="auditorias")

class Notificacion(Base):
    __tablename__ = "notificaciones"
    id = Column(BigInteger, primary_key=True, index=True)
    usuario_id = Column(BigInteger, ForeignKey("usuarios.id", ondelete="CASCADE"))
    titulo = Column(String(200), nullable=False)
    mensaje = Column(Text, nullable=False)
    tipo = Column(String(30), default="info")
    leida = Column(Boolean, default=False)
    accion_url = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="notificaciones")

class Servicio(Base):
    __tablename__ = "servicios"
    id = Column(BigInteger, primary_key=True, index=True)
    nombre = Column(String(200), nullable=False)
    descripcion = Column(Text)
    keywords = Column(JSON)
    categoria = Column(String(50))
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
