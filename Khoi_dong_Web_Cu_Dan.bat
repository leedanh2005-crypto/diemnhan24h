@echo off
chcp 65001 >nul
title May chu Web Cu Dan PODO (Resident Portal - Port 3000)
color 0B
echo ===================================================
echo   DANG KHOI DONG WEB CU DAN PODO (CONG 3000)...
echo ===================================================
echo.
echo May chu dang chay tai: http://localhost:3000
echo Vui long KHONG TAT cua so nay trong khi su dung.
echo De dung lai, hay bam dau X o goc tren cung ben phai.
echo.

:: Tu dong mo trinh duyet vao Web Cu Dan sau 2 giay
start "" http://localhost:3000

cd /d "%~dp0PICKO"
node server.js

pause

