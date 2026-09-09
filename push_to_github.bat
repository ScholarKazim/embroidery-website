@echo off
title رفع المشروع إلى GitHub
chcp 65001 > nul
cd /d "%~dp0"
echo ======================================================
echo    جاري رفع مشروع إبرة وخيط إلى GitHub...
echo ======================================================
echo.
echo المستودع: https://github.com/scholarkazim/embroidery-website.git
echo الفرع: main
echo.
echo إذا ظهرت نافذة المتصفح، يرجى الموافقة على تسجيل الدخول بحسابك (scholarkazim).
echo.
"C:\Users\Nobel\AppData\Local\Programs\Git\cmd\git.exe" push -u origin main
echo.
echo ======================================================
pause
