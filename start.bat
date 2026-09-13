@echo off
cls
echo ========================================
echo   NEXUS Corp - Centro Inteligente
echo ========================================
echo.
echo  Seleccione modo de ejecucion:
echo.
echo  [1] MOCK   - Solo frontend + mock server (sin backend)
echo  [2] FULL   - Frontend + backend Python + Supabase
echo  [3] STOP   - Detener todos los servicios
echo.
set /p modo="Seleccione (1/2/3): "

if "%modo%"=="1" goto :mock
if "%modo%"=="2" goto :full
if "%modo%"=="3" goto :stop
goto :invalid

:mock
echo.
echo Iniciando en modo MOCK...
echo.

echo [1/2] Iniciando Mock Server en puerto 8000...
start "Mock Server" cmd /c "node mock-server\server.js"

timeout /t 2 /nobreak >nul

echo [2/2] Iniciando Frontend en puerto 5173...
cd frontend
start "Frontend" cmd /c "npm run dev"
cd ..

echo.
echo ========================================
echo   Modo MOCK activado
echo   Frontend:  http://localhost:5173
echo   Mock API:  http://localhost:8000
echo ========================================
echo.
pause
goto :end

:full
echo.
echo Iniciando en modo FULL (Backend + Supabase)...
echo.

echo [1/3] Iniciando Backend FastAPI en puerto 8000...
cd backend
start "Backend" cmd /c "python -m uvicorn app.main:app --reload --port 8000"
cd ..

timeout /t 3 /nobreak >nul

echo [2/3] Iniciando Frontend en puerto 5173...
cd frontend
start "Frontend" cmd /c "npm run dev"
cd ..

echo [3/3] Verificando conexion con Supabase...
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Modo FULL activado
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   Supabase:  https://poikhicityheikmnfltb.supabase.co
echo ========================================
echo.
pause
goto :end

:stop
echo.
echo Deteniendo servicios...
taskkill /FI "WINDOWTITLE eq Mock Server" /F 2>nul
taskkill /FI "WINDOWTITLE eq Backend" /F 2>nul
taskkill /FI "WINDOWTITLE eq Frontend" /F 2>nul
echo Servicios detenidos.
pause
goto :end

:invalid
echo.
echo Opcion no valida. Intente de nuevo.
pause
goto :end

:end
