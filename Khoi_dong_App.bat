@echo off
chcp 65001 >nul
title May chu Diem Nhan 24H (Shipper & Kiosk Station)
color 0A
echo ===================================================
echo   DANG KHOI DONG TRAM GIAO NHAN 24H (SHIPPER & KIOSK)...
echo ===================================================
echo.
echo May chu dang chay. Vui long KHONG TAT cua so nay.
echo De dung lai, hay bam dau X o goc tren cung ben phai.
echo.

cd /d "%~dp0shipper-app"
npm run dev -- --host

pause
