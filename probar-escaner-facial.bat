@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
cls

echo ============================================================
echo   Escaner Facial 478 puntos - Pruebas
echo ============================================================
echo.
echo  [1] Prueba completa   (verificaciones + servidor + navegador)
echo  [2] Solo verificar    (matematica, tipos, modelo y WASM)
echo  [3] Build produccion  (igual que Vercel)
echo.
set /p modo="Seleccione (1/2/3): "
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js no esta instalado o no esta en el PATH.
  echo     Descargalo desde https://nodejs.org
  goto :fin
)
for /f "delims=" %%v in ('node -v') do echo [OK] Node.js %%v

if not exist "frontend\node_modules" (
  echo.
  echo [..] Instalando dependencias del frontend ^(puede tardar unos minutos^)...
  pushd frontend
  call npm install
  popd
  if errorlevel 1 (
    echo [X] Fallo la instalacion de dependencias.
    goto :fin
  )
)

echo.
echo ------------------------------------------------------------
echo  1/4  Modelo facial
echo ------------------------------------------------------------
set MODELO=frontend\public\models\face_landmarker.task
if not exist "%MODELO%" (
  echo [X] Falta %MODELO%
  echo     Descargalo de:
  echo     https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
  echo     y guardalo en frontend\public\models\
  goto :fin
)
for %%A in ("%MODELO%") do set TAM=%%~zA
if !TAM! LSS 1000000 (
  echo [X] El modelo esta incompleto ^(!TAM! bytes, se esperan ~3.7 MB^).
  echo     Vuelve a descargarlo.
  goto :fin
)
echo [OK] face_landmarker.task presente ^(!TAM! bytes^)

echo.
echo ------------------------------------------------------------
echo  2/4  Binarios WASM de MediaPipe
echo ------------------------------------------------------------
pushd frontend
call npm run copy-wasm
popd
if not exist "frontend\public\wasm\vision_wasm_internal.wasm" (
  echo [!] No se pudo copiar el WASM local; se usara el CDN como respaldo.
) else (
  echo [OK] WASM local listo en frontend\public\wasm
)

echo.
echo ------------------------------------------------------------
echo  3/4  Matematica del reconocimiento
echo ------------------------------------------------------------
pushd frontend
call npm run test:face
set RES_MATE=!errorlevel!
popd
if !RES_MATE! NEQ 0 (
  echo [X] Fallaron las verificaciones de reconocimiento facial.
  goto :fin
)

echo.
echo ------------------------------------------------------------
echo  4/4  Tipos de TypeScript
echo ------------------------------------------------------------
pushd frontend
call npx tsc --noEmit
set RES_TSC=!errorlevel!
popd
if !RES_TSC! NEQ 0 (
  echo [X] Hay errores de TypeScript.
  goto :fin
)
echo [OK] Sin errores de tipos

if "%modo%"=="2" goto :solo_verificar
if "%modo%"=="3" goto :build
if "%modo%"=="1" goto :servidor
echo.
echo Opcion no valida.
goto :fin

:solo_verificar
echo.
echo ============================================================
echo   TODAS LAS VERIFICACIONES PASARON
echo ============================================================
goto :fin

:build
echo.
echo ------------------------------------------------------------
echo  Build de produccion
echo ------------------------------------------------------------
pushd frontend
call npm run build
set RES_BUILD=!errorlevel!
popd
if !RES_BUILD! NEQ 0 (
  echo [X] Fallo el build.
  goto :fin
)
echo.
echo [OK] Build correcto en frontend\dist
echo      Para probarlo igual que en produccion:
echo        cd frontend ^&^& npm run preview
goto :fin

:servidor
echo.
echo ============================================================
echo   Iniciando servidor de desarrollo
echo ============================================================
echo.
echo  La camara solo funciona en http://localhost o con HTTPS.
echo  Usa SIEMPRE http://localhost:5173 ^(no la IP de red^).
echo.
pushd frontend
start "Frontend - Escaner Facial" cmd /c "npm run dev"
popd

echo  Esperando a que arranque Vite...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173/login"

echo.
echo ============================================================
echo   QUE COMPROBAR EN EL NAVEGADOR
echo ============================================================
echo.
echo  Abre la consola del navegador con F12 y revisa:
echo.
echo   0. ANTES DE TODO: ejecuta database\MIGRATION_478_LANDMARKS.sql en
echo      Supabase ^> SQL Editor. Sin eso sale "expected 128 dimensions".
echo.
echo   1. En /register: marca "Registrar rostro ahora", crea la cuenta.
echo      - La consola debe mostrar:
echo          [MediaPipe] Inicializando FaceLandmarker (wasm: /wasm)
echo          [MediaPipe] FaceLandmarker listo
echo      - La malla debe QUEDAR PEGADA a tu cara al moverte, con nariz,
echo        boca y ojos cada uno en su sitio (no apelotonados entre si).
echo      - Mira de frente y pulsa "Capturar De frente": la malla se CONGELA
echo        un momento y la casilla se pone verde.
echo      - Gira a un lado y pulsa "Capturar Lado A". Igual con "Lado B".
echo      - Pulsa "Guardar rostro". Al terminar sale la tabla de MEDIDAS 3D
echo        (pomulos, mandibula, proyeccion de nariz, profundidad de cuencas).
echo      - PRUEBA DE DISTANCIA: alejate y acercate. Las medidas no cambian,
echo        por eso el login funciona a cualquier distancia.
echo.
echo      - Los lados son OPCIONALES: con la vista de frente ya queda registrado.
echo      - El recuadro muestra "Giro: +0.00": tiene que pasar de +-0.22
echo        para que un lado cuente como pose lateral.
echo.
echo   2. En /login: "Iniciar sesion con mi rostro", mirando de frente.
echo      - Debe reconocerte y mostrar el porcentaje de coincidencia.
echo      - La consola imprime:
echo          [FaceCapture478] mejor=0.9xx (usuario N, poses frontal) segundo=...
echo          [FaceCapture478] similitud por region: {nariz:..., ojoIzq:...}
echo        TODAS las regiones deben ir altas. Si una sola baja de 0.35,
echo        el login se rechaza a proposito.
echo.
echo   3. PRUEBA DE SEGURIDAD (la del problema que tuviste):
echo      - Que otra persona intente entrar con su rostro.
echo        Debe decir "Rostro no reconocido", NO entrar a tu cuenta.
echo      - Cierra sesion y recarga la pagina: debe pedir login de nuevo,
echo        no abrir sola la ultima cuenta que escaneo.
echo.
echo   4. Cierra y vuelve a abrir el escaner DOS veces seguidas.
echo      - Debe funcionar igual la segunda vez (antes fallaba aqui).
echo.
echo  Si dice que los rostros son de una version anterior:
echo  ejecuta database\MIGRATION_478_LANDMARKS.sql en Supabase y
echo  vuelve a registrar tu rostro.
echo.
echo ============================================================
echo.
echo  Para detener el servidor cierra la ventana "Frontend - Escaner Facial".
echo.

:fin
echo.
pause
endlocal
