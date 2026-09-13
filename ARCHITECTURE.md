# NEXUS Corp - Guía Arquitectónica

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

## Tablas (9)
- usuarios (id, nombre, email, password_hash, rol, activo)
- clientes (id, nombre, email, telefono, empresa, activo)
- comentarios (id, cliente_id, contenido, canal, estado, categoria, fecha, procesado)
- analisis_nlp (id, comentario_id, idioma, cantidad_palabras, palabras_limpias, palabras_frecuentes, categoria_detectada, confianza)
- categorias (id, nombre, descripcion, activo)
- tiempos_atencion (id, cliente_id, comentario_id, tiempo_minutos, fecha, operador)
- metricas_estadisticas (id, fecha_inicio, fecha_fin, cantidad_registros, media, mediana, desviacion_estandar, minimo, maximo, percentil_25, percentil_75)
- optimizaciones (id, nombre, descripcion, parametros_entrada, resultado, costo_inicial, costo_optimizado, estado)
- auditoria (id, usuario_id, accion, tabla, registro_id, detalles, ip)

## Roles
- ADMIN, ANALISTA, SUPERVISOR, USUARIO

## Menú
- DASHBOARD (Inicio)
- CLIENTES (Lista, Nuevo, Historial)
- ATENCIÓN (Solicitudes, Comentarios, Tiempos)
- INTELIGENCIA NLP (Analizar, Palabras frecuentes, Categorías, Clasificación)
- SCIENTIFIC DATA (Estadísticas, Interpolación, Optimización)
- REPORTES (Atención, NLP, Estadísticas)
- CONFIGURACIÓN (Usuarios, Categorías, Auditoría)

## Backend API
- GET/POST /api/clientes
- GET/POST /api/comentarios
- POST /api/nltk/analizar
- POST /api/nltk/palabras-frecuentes
- POST /api/nltk/clasificar
- GET/POST /api/scipy/estadisticas
- POST /api/scipy/optimizacion
- POST /api/scipy/interpolacion

## Fases
1. Base (PostgreSQL, migraciones, usuarios, clientes)
2. Atención (comentarios, tiempos, historial)
3. NLTK (tokenización, stopwords, frecuencia, clasificación)
4. SciPy (estadísticas, desviación, percentiles, interpolación, optimización)
5. Dashboard (KPIs, gráficos, filtros, alertas)
6. Producción (auth, roles, auditoría, Docker, backups)
