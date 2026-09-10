# NEXUS Corp - Centro Inteligente de Analisis Empresarial

Plataforma web empresarial para analisis de sentimiento, gestion de clientes y optimizacion basada en inteligencia artificial. Combina **React + TypeScript** en el frontend con **FastAPI + SciPy + NLTK** en el backend, conectados a **Supabase** (PostgreSQL + Auth + Realtime).

## Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                     │
│          React + TypeScript + Vite + Tailwind CSS        │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │Dashboard │ │Clientes  │ │  NLP     │ │  SciPy    │  │
│  │  KPIs    │ │CRUD      │ │Analisis  │ │Estadistica│  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Reconocimiento Facial (face-api.js + Supabase)  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────────┐
│                   BACKEND (Render/Railway)               │
│              FastAPI + SciPy + NumPy + NLTK              │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │NLTK API  │ │SciPy API │ │Auth API  │ │Admin API  │  │
│  │Analisis  │ │Stats     │ │JWT/JWKS  │ │CRUD       │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                   SUPABASE (Cloud)                       │
│         PostgreSQL + Auth + Realtime + Storage           │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │usuarios  │ │clientes  │ │rostros   │ │comentarios│  │
│  │auth.users│ │CRUD      │ │facial    │ │NLP        │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │analisis  │ │categorias│ │tiempos   │ │metricas   │  │
│  │_nlp      │ │config    │ │atencion  │ │estadistic │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Flujo de Datos

### Flujo de un Comentario (NLP)

```
Cliente escribe comentario
        │
        ▼
   Frontend (React)
        │
        ▼
   POST /api/comentarios
        │
        ▼
   PostgreSQL (Supabase)
        │
        ▼
   FastAPI + NLTK
        │
   ┌────┴─────┐
   ▼          ▼
Limpieza   Tokenizacion
   │          │
   └────┬─────┘
        ▼
  Analisis de texto
        ▼
  Clasificacion
        ▼
  PostgreSQL (Supabase)
        ▼
  Frontend (Dashboard Realtime)
```

### Flujo de Estadisticas (SciPy)

```
Datos de atencion
        │
        ▼
   PostgreSQL (Supabase)
        │
        ▼
   FastAPI
        │
        ▼
   SciPy
        │
   ┌────┼────────┐
   ▼    ▼        ▼
Media  Desv.  Percentiles
   │
   ▼
Resultados → PostgreSQL → React Dashboard
```

### Flujo de Reconocimiento Facial

```
Registro:
  Usuario → Camera → 3 fotos → embedding promedio → Supabase (rostros)

Login:
  Usuario → Camera → 1 foto → comparar con todos → match →
  Backend (magic link) → Supabase Auth → JWT session → Dashboard
```

## Estructura del Proyecto

```
empresa-inteligente/
├── frontend/                    # React + TypeScript + Vite + Tailwind
│   ├── .env                     # Variables de entorno (Supabase)
│   ├── index.html
│   ├── package.json             # Dependencias: face-api.js, @supabase/supabase-js
│   ├── vite.config.ts           # Proxy API + alias @/
│   ├── tsconfig.json
│   ├── vercel.json              # Configuracion Vercel (SPA rewrite)
│   ├── public/
│   │   └── models/              # Modelos IA face-api.js (~6MB)
│   │       ├── tiny_face_detector_model-*
│   │       ├── face_landmark_68_model-*
│   │       └── face_recognition_model-*
│   └── src/
│       ├── main.tsx             # Entry: BrowserRouter > AuthProvider > App
│       ├── App.tsx              # Carga modelos face + AppRoutes
│       ├── App.css
│       ├── context/
│       │   └── AuthContext.tsx  # Autenticacion principal (login, register, face)
│       ├── routes/
│       │   └── AppRoutes.tsx   # Rutas + AuthGuard + GuestGuard
│       ├── layouts/
│       │   ├── dashboard.tsx   # Layout sidebar + header + realtime
│       │   ├── AuthLayout.tsx
│       │   └── MainLayout.tsx
│       ├── services/
│       │   ├── supabase.ts     # Cliente Supabase (createClient)
│       │   ├── api.ts          # Fetch wrapper con JWT token
│       │   ├── faceRecognition.ts  # Logica IA facial
│       │   ├── nltk.ts         # Consumo API NLTK
│       │   └── scipy.ts        # Consumo API SciPy
│       ├── components/
│       │   ├── FaceCapture.tsx  # Modal captura/reconocimiento facial
│       │   ├── dashboard/      # KpiCards, TiemposChart, PalabrasFrecuentes
│       │   ├── comentarios/    # ComentarioList, ComentarioForm
│       │   ├── metricas/       # MetricaList, MetricaForm
│       │   └── ui/             # Button, Card, Input, Toast, LoadingSpinner
│       ├── pages/              # 25 paginas (ver abajo)
│       ├── hooks/
│       │   ├── useAuth.tsx
│       │   ├── useClientes.ts
│       │   └── useDashboardData.ts
│       ├── types/
│       │   ├── face-api.d.ts
│       │   ├── clientes.ts
│       │   ├── comentarios.ts
│       │   ├── metricas.ts
│       │   └── index.ts
│       └── utils/
│           ├── validators.ts
│           ├── formatters.ts
│           └── index.ts
│
├── backend/                     # FastAPI + SciPy + NLTK
│   ├── .env                     # Variables de entorno (Supabase, DB)
│   ├── Dockerfile
│   ├── requirements.txt         # fastapi, supabase, scipy, nltk, etc.
│   ├── delete_server.py         # Servidor auxiliar para delete-account
│   └── app/
│       ├── main.py              # FastAPI app + CORS + routers
│       ├── core/
│       │   ├── config.py        # Variables de entorno
│       │   ├── security.py      # JWT creation
│       │   └── deps.py          # JWT verification via JWKS + role guards
│       ├── api/
│       │   ├── auth.py          # DELETE /api/auth/delete-account + POST /api/auth/face-login
│       │   ├── admin.py         # CRUD usuarios + auditoria
│       │   ├── clientes.py      # CRUD clientes
│       │   ├── comentarios.py   # CRUD comentarios
│       │   ├── tiempos.py       # Tiempos de atencion
│       │   ├── metricas.py      # Metricas del dashboard
│       │   ├── nltk.py          # Analisis NLP
│       │   └── scipy.py         # Estadisticas SciPy
│       ├── database/
│       │   ├── connection.py    # SQLAlchemy async engine
│       │   └── models.py        # Modelos ORM (9 tablas)
│       ├── schemas/
│       └── services/
│           ├── supabaseClient.py # Cliente Supabase (SERVICE_KEY)
│           ├── nltk_service.py   # Procesamiento NLP
│           ├── scipy_service.py  # Estadisticas scipy
│           └── audit_service.py  # Servicio de auditoria
│
├── database/
│   ├── SETUP_SUPABASE.sql       # Config manual Supabase (Realtime, RLS, triggers)
│   ├── 001_schema.sql           # 9 tablas principales
│   ├── 002_seed.sql             # Datos iniciales
│   ├── 003_rls_policies.sql     # Row Level Security
│   ├── 004_auth_sync.sql        # Triggers sync auth <-> usuarios
│   ├── 005_test_users.sql       # Usuarios de prueba
│   └── migrations/
│       ├── 20260901000001_schema.sql
│       ├── 20260901000002_seed_data.sql
│       ├── 20260901000003_rls_policies.sql
│       ├── 20260901000004_auth_sync.sql
│       ├── 20260901000005_realtime_triggers.sql
│       ├── 20260901000006_test_users.sql
│       ├── 20260905000007_add_avatar_url.sql
│       └── 20260905000008_create_rostros_table.sql
│
├── mock-server/
│   └── server.js                # Mock API Node.js (puerto 8000)
│
├── start.bat                    # Lanzador (MOCK / FULL / STOP)
├── stop.bat
├── docker-compose.yml           # PostgreSQL + backend + frontend
├── ARCHITECTURE.md              # Guia de arquitectura
└── README.md                    # Este archivo
```

## Tablas de Base de Datos

| Tabla | Descripcion |
|-------|-------------|
| `usuarios` | Usuarios del sistema (id, nombre, email, password_hash, rol, activo, avatar_url) |
| `clientes` | Clientes empresariales (id, nombre, email, telefono, empresa, activo) |
| `comentarios` | Comentarios de clientes (id, cliente_id, contenido, canal, estado, categoria) |
| `analisis_nlp` | Resultados NLP (id, comentario_id, idioma, palabras_frecuentes, confianza) |
| `categorias` | Categorias configurables (id, nombre, descripcion, activo) |
| `tiempos_atencion` | Metricas de tiempo (id, cliente_id, tiempo_minutos, fecha, operador) |
| `metricas_estadisticas` | Resultados SciPy (media, mediana, desviacion, percentiles) |
| `optimizaciones` | Escenarios de optimizacion (parametros_entrada, resultado, costo) |
| `auditoria` | Registro de acciones (usuario_id, accion, tabla, detalles) |
| `rostros` | Embeddings faciales (id, usuario_id, embedding JSONB, metadata) |

### Diagrama de Relaciones

```
usuarios ─────┬──────────── auditoria
              │
              ├───< clientes
              │       │
              │       ├───< comentarios
              │       │       │
              │       │       ├───< analisis_nlp
              │       │       │
              │       │       └───< tiempos_atencion
              │       │
              │       └───< tiempos_atencion
              │
              ├───< rostros (embeddings faciales)
              │
              └───< metricas_estadisticas
              └───< optimizaciones
              └───< categorias
```

## Paginas del Sistema

| Pagina | Ruta | Descripcion |
|--------|------|-------------|
| Login | `/login` | Inicio de sesion (email + facial) |
| Registro | `/register` | Crear cuenta (con opcional facial) |
| Perfil | `/perfil` | Gestion de perfil + facial + password |
| Dashboard | `/` | KPIs, graficos en tiempo real |
| Clientes | `/clientes` | Lista de clientes |
| Nuevo Cliente | `/clientes/nuevo` | Formulario de creacion |
| Historial | `/clientes-historial` | Historial de clientes |
| Solicitudes | `/solicitudes` | Gestion de solicitudes |
| Comentarios | `/comentarios` | Lista y gestion de comentarios |
| Tiempo Atencion | `/tiempo-atencion` | Metricas de tiempo |
| Analizar | `/analizar-comentario` | Analisis NLP individual |
| Palabras Frecuentes | `/palabras-frecuentes` | Grafico de frecuencia |
| Categorias | `/categorias` | Distribucion por categorias |
| Clasificacion | `/clasificacion` | Clasificacion automatica |
| Estadisticas | `/estadisticas` | Metricas SciPy |
| Interpolacion | `/interpolacion` | Interpolacion de datos |
| Optimizacion | `/optimizacion` | Escenarios de optimizacion |
| Reportes NLP | `/reportes/nlp` | Reportes de analisis |
| Reportes Stats | `/reportes/estadisticas` | Reportes estadisticos |
| Reportes Atencion | `/reportes/atencion` | Reportes de atencion |
| Usuarios | `/usuarios` | Lista de usuarios |
| Admin Usuarios | `/admin/usuarios` | Gestion de roles |
| Auditoria | `/auditoria` | Registro de acciones |
| Config Categorias | `/configuracion` | Configuracion de categorias |
| Limpieza Datos | `/limpieza-datos` | Herramienta de limpieza |

## Tecnologias

### Frontend

| Tecnologia | Version | Uso |
|------------|---------|-----|
| React | 18.2 | UI Library |
| TypeScript | 5.3 | Tipado estatico |
| Vite | 5.0 | Build tool + dev server |
| Tailwind CSS | 4.3 | Estilos utility-first |
| React Router | 6.20 | Navegacion SPA |
| Recharts | 2.10 | Graficos |
| Lucide React | 1.40 | Iconografia |
| face-api.js | 0.22 | Reconocimiento facial (IA) |
| @supabase/supabase-js | 2.115 | Cliente Supabase |

### Backend

| Tecnologia | Version | Uso |
|------------|---------|-----|
| Python | 3.11+ | Runtime |
| FastAPI | 0.115 | API REST |
| SQLAlchemy | 2.0 | ORM async |
| SciPy | 1.14 | Estadisticas, interpolacion, optimizacion |
| NumPy | 1.26 | Computo numerico |
| NLTK | 3.9 | Procesamiento de lenguaje natural |
| Pydantic | 2.9 | Validacion de datos |
| python-jose | 3.3 | JWT verification (JWKS) |
| supabase | 2.10 | Cliente Supabase (Python) |
| uvicorn | 0.30 | ASGI server |

### Base de Datos y Servicios

| Servicio | Proveedor | Uso |
|----------|-----------|-----|
| PostgreSQL | Supabase | Base de datos principal |
| Auth | Supabase | Autenticacion JWT + magic links |
| Realtime | Supabase | Actualizaciones en tiempo real |
| Hosting Frontend | Vercel | Despliegue SPA |
| Hosting Backend | Render/Railway | API FastAPI |

## Roles de Usuario

| Rol | Permisos |
|-----|----------|
| `ADMIN` | Acceso total: gestionar usuarios, auditoria, configuracion |
| `ANALISTA` | Acceso admin: mismo que ADMIN en permisos |
| `SUPERVISOR` | Acceso intermedio: reportes, admin parcial |
| `USUARIO` | Acceso basico: lectura y operaciones limitadas |

## Configuracion de Supabase

### Variables de Entorno

**Frontend** (`.env`):
```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
VITE_API_URL=http://localhost:8000
```

**Backend** (`.env`):
```
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SECRET_KEY=tu-secret-key
SUPABASE_JWKS_URL=https://tu-proyecto.supabase.co/auth/v1/.well-known/jwks.json
DATABASE_URL=postgresql+asyncpg://postgres:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres
SECRET_KEY=tu-secret-key-jwt
```

### Configuracion en Supabase Dashboard

1. **SQL Editor**: Ejecutar `database/migrations/` en orden
2. **Authentication**: Habilitar Email/Password
3. **API Settings**: Copiar URL y keys al `.env`
4. **Realtime**: Habilitar en tablas: `comentarios`, `clientes`, `usuarios`, `rostros`
5. **RLS**: Deshabilitar (confirmado por administrador)
6. **Redirect URLs**: Agregar `https://tu-app.vercel.app` y `http://localhost:5173`

## Instalacion y Desarrollo

### Requisitos Previos

- Node.js 18+
- Python 3.11+
- Git
- Cuenta en Supabase (supabase.com)

### Opcion 1: Modo MOCK (Solo Frontend)

```bash
# Clonar repositorio
git clone https://github.com/Grupo-04-Senati/Empresa-Analitica.git
cd Empresa-Analitica

# Instalar dependencias del frontend
cd frontend
npm install

# Iniciar mock server + frontend
cd ..
# Windows:
start.bat  -> opcion [1]

# O manualmente:
cd mock-server && node server.js &
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Mock API: http://localhost:8000

### Opcion 2: Modo FULL (Frontend + Backend + Supabase)

```bash
# 1. Configurar variables de entorno
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
# Editar .env con tus keys de Supabase

# 2. Ejecutar migraciones SQL en Supabase Dashboard
# Copiar y ejecutar cada archivo de database/migrations/ en orden

# 3. Instalar dependencias
cd frontend && npm install && cd ..
cd backend && pip install -r requirements.txt && cd ..

# 4. Iniciar servicios
# Windows:
start.bat  -> opcion [2]

# O manualmente:
cd backend && python -m uvicorn app.main:app --reload --port 8000 &
cd frontend && npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Supabase Dashboard: https://supabase.com/dashboard

### Opcion 3: Docker

```bash
docker-compose up --build
```

## Comandos Utiles

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Desarrollo
npm run dev              # Dev server en http://localhost:5173

# Build production
npm run build            # Build optimizado en dist/

# Preview production
npm run preview          # Preview del build en http://localhost:4173
```

### Backend

```bash
cd backend

# Instalar dependencias
pip install -r requirements.txt

# Desarrollo
python -m uvicorn app.main:app --reload --port 8000

# Produccion
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Base de Datos

```bash
# Usando Supabase CLI
supabase link --project-ref tu-project-ref
supabase db push

# O ejecutar SQL manualmente en Supabase Dashboard > SQL Editor
```

### Git

```bash
git add .
git commit -m "feat: descripcion del cambio"
git push origin main
```

## Despliegue en Vercel

### Configuracion

El frontend esta configurado para desplegarse en Vercel con:

- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Framework**: Vite (React)

### Pasos

1. Conectar repositorio GitHub a Vercel
2. Configurar variables de entorno en Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_API_URL` (URL del backend desplegado)
3. Deploy automatico al hacer push a `main`

### Archivos de Configuracion Vercel

- `frontend/vercel.json`: Rewrites para SPA routing
- `frontend/vite.config.ts`: Proxy en desarrollo

## API del Backend

### Auth

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/auth/face-login` | POST | Login facial (genera magic link) |
| `/api/auth/delete-account` | DELETE | Eliminar cuenta (requiere password) |

### Clientes

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/clientes` | GET | Listar clientes |
| `/api/clientes` | POST | Crear cliente |
| `/api/clientes/{id}` | GET | Obtener cliente |
| `/api/clientes/{id}` | PUT | Actualizar cliente |
| `/api/clientes/{id}` | DELETE | Eliminar cliente |

### Comentarios

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/comentarios` | GET | Listar comentarios |
| `/api/comentarios` | POST | Crear comentario |
| `/api/comentarios/{id}` | DELETE | Eliminar comentario |

### NLTK (Analisis de Lenguaje)

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/nltk/analizar` | POST | Analizar sentimiento y categorizar |
| `/api/nltk/palabras-frecuentes` | GET | Palabras mas frecuentes |
| `/api/nltk/categorias` | GET | Distribucion de categorias |
| `/api/nltk/comentarios` | GET | Comentarios analizados |

### SciPy (Estadisticas)

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/scipy/estadisticas` | POST | Calcular media, mediana, desviacion |
| `/api/scipy/interpolacion` | POST | Interpolar datos faltantes |
| `/api/scipy/optimizacion` | GET | Escenarios de optimizacion |
| `/api/scipy/tiempos-atencion` | GET | Tiempos para analisis |

### Admin

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/admin/usuarios` | GET | Listar todos los usuarios |
| `/api/admin/usuarios/{id}` | GET | Obtener usuario |
| `/api/admin/usuarios/{id}/rol` | PUT | Cambiar rol |
| `/api/admin/usuarios/{id}` | PUT | Actualizar usuario |
| `/api/admin/usuarios/{id}` | DELETE | Desactivar usuario |
| `/api/admin/auditoria` | GET | Logs de auditoria |

### Dashboard

| Endpoint | Metodo | Descripcion |
|----------|--------|-------------|
| `/api/dashboard` | GET | KPIs del dashboard |
| `/api/tiempos` | GET | Tiempos de atencion |
| `/api/health` | GET | Health check |

## Funcionalidades Clave

### Reconocimiento Facial

- **Registro**: 3 capturas automaticas con countdown de 3 segundos
- **Login**: Comparacion en tiempo real con todos los embeddings registrados
- **Umbral**: Distancia euclidiana < 0.55 para considerar match
- **Metadata**: Dimensiones, modelo, fecha, dispositivo
- **Upsert**: Actualiza embedding existente en lugar de duplicar

### Dashboard en Tiempo Real

- Supabase Realtime para actualizaciones automaticas
- KPIs: total clientes, comentarios, promedio atencion, porcentaje procesados
- Graficos: tiempos de atencion, categorias NLP, palabras frecuentes

### Analisis NLP

- Tokenizacion y limpieza de texto en espanol
- Deteccion de sentimiento (positivo/negativo/neutro)
- Clasificacion automatica por categorias
- Palabras frecuentes con frecuencia de aparicion

### Estadisticas SciPy

- Media, mediana, desviacion estandar
- Percentiles 25 y 75
- Interpolacion de datos faltantes
- Optimizacion de recursos

## Usuarios de Prueba

| Email | Password | Rol |
|-------|----------|-----|
| admin@nexus.com | admin123 | ADMIN |
| analista@nexus.com | analista123 | ANALISTA |
| usuario@nexus.com | usuario123 | USUARIO |

## Troubleshooting

### Modelos faciales no cargan

Los modelos de IA (~6MB) se descargan automaticamente la primera vez. Verificar que `frontend/public/models/` contenga los archivos.

### CORS errors en desarrollo

El Vite proxy (`vite.config.ts`) redirige `/api` al backend. Verificar que el backend este corriendo en puerto 8000.

### Login facial no crea sesion JWT

Verificar que el backend este corriendo y que `POST /api/auth/face-login` este funcionando. El flujo usa magic links de Supabase.

### Supabase connection refused

Verificar las variables de entorno `.env` tanto en frontend como backend. Las keys deben coincidir con las del dashboard de Supabase.

## Licencia

Proyecto academico - SENATI Grupo 04

## Contacto

- GitHub: [Grupo-04-Senati](https://github.com/Grupo-04-Senati)
- Repositorio: [Empresa-Analitica](https://github.com/Grupo-04-Senati/Empresa-Analitica)
"# Empresa-Analitica" 
