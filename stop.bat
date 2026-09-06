@echo off
echo ========================================
echo   Deteniendo servicios...
echo ========================================
echo.

echo Deteniendo Mock Server...
taskkill /FI "WINDOWTITLE eq Mock Server" /F 2>nul

echo Deteniendo Backend...
taskkill /FI "WINDOWTITLE eq Backend" /F 2>nul

echo Deteniendo Frontend...
taskkill /FI "WINDOWTITLE eq Frontend" /F 2>nul

echo.
echo Todos los servicios han sido detenidos.
echo.
pause
