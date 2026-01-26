@echo off
echo Starting Speech AI Frontend...
echo ================================

if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo Building application...
npm run build

echo Starting frontend server...
echo Frontend will be available at:
echo   Local: http://localhost:3000
echo   Network: http://%COMPUTERNAME%:3000
echo.
echo Make sure backend is running on Device B!
echo ================================

npm run preview
pause
