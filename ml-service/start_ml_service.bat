@echo off
title MP-Enviro ML Service
color 0A

echo.
echo  ============================================
echo   MP-Enviro ML Service  (Port 5000)
echo   Auto-restarts on crash
echo  ============================================
echo.

:LOOP
echo [%TIME%] Starting ML service...
python app.py
echo.
echo [%TIME%] ML service stopped (exit code: %ERRORLEVEL%). Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto LOOP
