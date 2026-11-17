@echo off
chcp 65001 >nul
title MULTIVERSE CARTOON TCG
cd /d "%~dp0"

echo ==========================================================
echo   MULTIVERSE CARTOON TCG - Prototype local
echo ==========================================================
echo.

if not exist "node_modules" (
  echo Installation des dependances...
  call npm install
  echo.
)

echo Liberation des anciennes instances sur les ports 8787 / 5173...
node scripts\free-ports.mjs --kill
echo.
echo (Garde cette fenetre ouverte. Ctrl+C pour arreter.)
echo.

REM Ouvre le navigateur apres 8 secondes, sans bloquer le serveur.
start "" cmd /c "timeout /t 8 /nobreak >nul & start "" http://localhost:5173"

call npm run dev

echo.
echo Serveur arrete. Si le navigateur affiche une erreur, relancez ce fichier.
pause
