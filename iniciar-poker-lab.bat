@echo off
title Poker Study Lab — Live Desktop Assistant
cd /d "%~dp0"
echo ========================================================
echo   Iniciando Poker Study Lab (Modo Desktop Nativo)
echo ========================================================
if not exist "dist\index.html" (
    echo Compilando aplicacao para primeira execucao...
    call npm.cmd run build
)
call npx.cmd electron apps/desktop/electron/main.cjs
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Tentando via npm.cmd...
    call npm.cmd run desktop
)
