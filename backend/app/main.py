from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from app.api import clientes, comentarios, metricas, scipy, nltk, admin, tiempos, auth
from app.database.models import Base
from app.database.connection import engine

app = FastAPI(title="Empresa Inteligente API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://empresa-analitica.onrender.com",
        "https://frontend-eta-sand-78.vercel.app",
        "https://*.vercel.app",
        "https://*.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(metricas.router, prefix="/api", tags=["Dashboard"])
app.include_router(clientes.router, prefix="/api/clientes", tags=["Clientes"])
app.include_router(comentarios.router, prefix="/api/comentarios", tags=["Comentarios"])
app.include_router(scipy.router, prefix="/api/scipy", tags=["SciPy"])
app.include_router(nltk.router, prefix="/api/nltk", tags=["NLTK"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(tiempos.router, prefix="/api/tiempos", tags=["Tiempos"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
