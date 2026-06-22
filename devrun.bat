@echo off
cd /d "%~dp0"
echo Starting LaneYa Backend (port 4000) and Frontend (port 3000)...
start "LaneYa Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "LaneYa Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
exit /b 0
