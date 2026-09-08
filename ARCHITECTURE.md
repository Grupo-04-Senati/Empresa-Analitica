# NEXUS Corp - Centro Inteligente

## Arquitectura

```
React + TypeScript → FastAPI → SciPy/NLTK → PostgreSQL
```

## Estructura del proyecto

```
empresa-inteligente/
├── frontend/          React + Vite + Tailwind
├── backend/           FastAPI + SciPy + NLTK
├── database/          PostgreSQL migrations
├── docker-compose.yml
└── README.md
```

## Tablas (11)
- usuarios (id, nombre, email, password_hash, rol, activo)
- clientes (id, nombre, email, telefono, empresa, activo)
- comentarios (id, cliente_id, contenido, canal, estado, categoria, fecha, procesado)
- analisis_nlp (id, comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza)
- categorias (id, nombre, descripcion, activo)
- tiempos_atencion (id, cliente_id, comentario_id, tiempo_minutos, fecha, operador)
- metricas_estadisticas (id, fecha_inicio, fecha_fin, cantidad_registros, media, mediana, desviacion_estandar, minimo, maximo, percentil_25, percentil_75)
- optimizaciones (id, nombre, descripcion, parametros_entrada, resultado, costo_inicial, costo_optimizado, estado)
- auditoria (id, usuario_id, accion, tabla, registro_id, detalles, ip)
- notificaciones (id, usuario_id, titulo, mensaje, tipo, leida, accion_url)
- servicios (id, nombre, descripcion, keywords, categoria, activo)

## Roles
- ADMIN, ANALISTA, SUPERVISOR, USUARIO

## Menú
- DASHBOARD (Inicio)
- CLIENTES (Lista, Nuevo, Historial)
- ATENCIÓN (Solicitudes, Comentarios, Tiempos)
- INTELIGENCIA NLP (Analizar, Palabras frecuentes, Categorías, Clasificación, Buscador)
- SCIENTIFIC DATA (Estadísticas, Interpolación, Optimización)
- REPORTES (Atención, NLP, Estadísticas)
- NOTIFICACIONES
- CONFIGURACIÓN (Usuarios, Categorías, Auditoría)

## Backend API
### Clientes
- GET /api/clientes
- GET /api/clientes/{id}
- POST /api/clientes
- PUT /api/clientes/{id}
- DELETE /api/clientes/{id}

### Comentarios
- GET /api/comentarios
- GET /api/comentarios/{id}
- POST /api/comentarios
- POST /api/comentarios/{id}/procesar
- DELETE /api/comentarios/{id}

### NLTK
- POST /api/nltk/analizar
- GET /api/nltk/centro-inteligente
- GET /api/nltk/comentarios
- GET /api/nltk/categorias
- GET /api/nltk/palabras-frecuentes
- POST /api/nltk/palabras-frecuentes
- POST /api/nltk/clasificar
- POST /api/nltk/buscar-servicio
- GET /api/nltk/evaluar-clasificador

### SciPy
- GET /api/scipy/estadisticas
- POST /api/scipy/estadisticas
- GET /api/scipy/tiempos-atencion
- GET /api/scipy/optimizacion
- POST /api/scipy/optimizacion
- POST /api/scipy/interpolacion

### Notificaciones
- GET /api/notificaciones
- POST /api/notificaciones
- PUT /api/notificaciones/{id}/leer
- PUT /api/notificaciones/leer-todas
- DELETE /api/notificaciones/{id}
- DELETE /api/notificaciones/eliminar-todas
- DELETE /api/notificaciones/eliminar-antiguas/{meses}

### Admin
- GET /api/admin/usuarios
- GET /api/admin/usuarios/{id}
- PUT /api/admin/usuarios/{id}/rol
- PUT /api/admin/usuarios/{id}
- DELETE /api/admin/usuarios/{id}
- GET /api/admin/auditoria

### Auth
- POST /api/auth/face-login
- DELETE /api/auth/delete-account

## Dominio
- Empresa: NEXUS Corp
- Dominio: nexuscorp.app
- Email: @nexuscorp.app

## Fases
1. Base (PostgreSQL, migraciones, usuarios, clientes)
2. Atención (comentarios, tiempos, historial)
3. NLTK (tokenización, stopwords, frecuencia, clasificación entrenada, buscador)
4. SciPy (estadísticas con ddof=1, optimización con restricciones, interpolación)
5. Dashboard (KPIs, gráficos, filtros por fecha, alertas, notificaciones)
6. Producción (auth, roles backend-only, auditoría, Docker, backups)
