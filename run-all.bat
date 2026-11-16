@echo off
echo ===================================================
echo   🎬 Starting CineRoom (Socket Server + Next.js)
echo ===================================================
echo.
start "CineRoom Socket Server (Port 3001)" cmd /k "cd /d %~dp0server && node index.js"
start "CineRoom Next.js App (Port 3000)" cmd /k "cd /d %~dp0 && npm run dev"
echo [OK] Both servers are starting in separate windows.
echo.
echo - Web App: http://localhost:3000
echo - Socket Server: http://localhost:3001
echo.
echo Press any key to exit this launcher window...
pause >nul
