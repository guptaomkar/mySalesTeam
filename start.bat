@echo off
echo Starting mySalesTeam Backend...
start cmd /k "cd /d "c:\Omkar Gupta\C drive bcp\working\mySalesTeam" && .venv\Scripts\uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3

echo Starting mySalesTeam Frontend...
start cmd /k "cd /d "c:\Omkar Gupta\C drive bcp\working\mySalesTeam\frontend" && npm run dev"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
