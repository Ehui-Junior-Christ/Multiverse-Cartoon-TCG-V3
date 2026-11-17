@echo off
chcp 65001 >nul
title MULTIVERSE CARTOON TCG - Arret
cd /d "%~dp0"
echo Arret des instances Node du prototype (ports 8787 et 5173)...
node scripts\free-ports.mjs --kill
echo.
pause
