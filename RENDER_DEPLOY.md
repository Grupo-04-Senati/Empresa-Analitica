# Guía de Despliegue - Render (Backend Python)

## Pasos para Desplegar en Render

### 1. Preparar el Repositorio
Asegúrate de que estos archivos estén en tu repositorio:
- `render.yaml` (en la raíz)
- `backend/requirements.txt`
- `backend/render_start.py`
- `backend/app/main.py`

### 2. Crear Cuenta en Render
1. Ve a [render.com](https://render.com)
2. Regístrate con tu cuenta de GitHub
3. Autoriza el acceso a tu repositorio

### 3. Crear Nuevo Web Service
1. Haz clic en **"New +"** → **"Web Service"**
2. Conecta tu repositorio de GitHub
3. Selecciona el repositorio `Empresa-Analitica`

### 4. Configurar el Servicio
- **Name**: `empresa-analitica-api`
- **Runtime**: Python
- **Build Command**: `cd backend && pip install -r requirements.txt`
- **Start Command**: `cd backend && python render_start.py`
- **Plan**: Free

### 5. Variables de Entorno (Environment Variables)
Agrega estas variables en el dashboard de Render:

```
PYTHON_VERSION=3.11.0
DATABASE_URL=postgresql://postgres:postgres@db.poikhicityheikmnfltb.supabase.co:5432/postgres
SECRET_KEY=tu-secret-key-aqui
DEBUG=false
SUPABASE_URL=https://poikhicityheikmnfltb.supabase.co
SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_PUBLISHABLE_KEY=tu-publishable-key-aqui
SUPABASE_SECRET_KEY=tu-secret-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
SUPABASE_JWKS_URL=https://poikhicityheikmnfltb.supabase.co/auth/v1/.well-known/jwks.json
```

### 6. Desplegar
1. Haz clic en **"Create Web Service"**
2. Espera a que termine el build (2-5 minutos)
3. Tu API estará disponible en: `https://empresa-analitica-api.onrender.com`

### 7. Verificar
1. Visita: `https://empresa-analitica-api.onrender.com/api/health`
2. Deberías ver: `{"status": "ok"}`

## Endpoints Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/clientes` | GET/POST | Clientes |
| `/api/comentarios` | GET/POST | Comentarios |
| `/api/nltk/analizar` | POST | Análisis NLP |
| `/api/scipy/estadisticas` | POST | Estadísticas |
| `/api/admin/usuarios` | GET | Usuarios |

## Variables de Entorno

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL (Supabase) |
| `SECRET_KEY` | Clave secreta para JWT |
| `SUPABASE_URL` | URL de tu proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase |

## Notas Importantes

### Plan Free de Render
- Se suspende después de 15 minutos de inactividad
- Tarda ~30 segundos en despertar
- 750 horas/mes incluidas

### Configuración del Frontend (Vercel)
Actualiza `VITE_API_URL` en Vercel:
```
VITE_API_URL=https://empresa-analitica-api.onrender.com
```

### CORS
El backend acepta peticiones de:
- `http://localhost:5173` (desarrollo)
- `http://localhost:3000` (desarrollo)
- Agrega tu URL de Vercel en producción

## Solución de Problemas

### Error: "Application failed to respond"
- Verifica que el puerto esté correctamente configurado
- Revisa los logs en Render Dashboard

### Error: "Module not found"
- Asegúrate de que `requirements.txt` tenga todas las dependencias
- Verifica la versión de Python

### Error: "Database connection failed"
- Verifica que `DATABASE_URL` sea correcta
- Asegúrate de que Supabase permita conexiones externas

## Comandos Útiles

### Ver logs en Render
```bash
# En el dashboard de Render, ve a Logs
```

### Probar localmente
```bash
cd backend
pip install -r requirements.txt
python render_start.py
```

### Verificar health check
```bash
curl https://empresa-analitica-api.onrender.com/api/health
```
