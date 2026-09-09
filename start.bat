@echo off
title متجر إبرة وخيط - خادم التشغيل
chcp 65001 > nul
echo ======================================================
echo    جاري تشغيل خادم متجر إبرة وخيط (Khama IQ)...
echo ======================================================
echo.
echo المتجر يعمل على: http://localhost:8080
echo لوحة التحكم:      http://localhost:8080/admin
echo تتبع الطلبات:    http://localhost:8080/track
echo.
start http://localhost:8080/
echo [!] المتجر يعمل الآن. لإيقاف الخادم يمكنك إغلاق هذه النافذة.
echo ======================================================
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0server.ps1"
pause
