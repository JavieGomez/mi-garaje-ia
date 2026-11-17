@echo off
rem Abre Mi Garaje IA en el navegador con un servidor local (necesita Node.js).
rem Si no tienes Node.js, abre index.html con doble clic: también funciona (sin modo sin conexión).
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se ha encontrado Node.js. Abriendo index.html directamente...
  start "" "%~dp0index.html"
  exit /b
)
node scripts\servidor.js --abrir
pause
