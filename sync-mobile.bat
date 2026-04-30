@echo off
chcp 65001 >nul
title Lato Estoque Mobile - Sync
color 0E

echo.
echo ╔════════════════════════════════════════════════╗
echo ║   SINCRONIZANDO ESTOQUE PC -> MOBILE          ║
echo ╚════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

if not exist "mobile-app\www" (
    echo  ❌ Projeto mobile nao existe ainda!
    echo  Rode primeiro: setup-mobile.bat
    pause
    exit /b 1
)

if not exist "mobile-app\www\renderer\styles" mkdir "mobile-app\www\renderer\styles"

REM Copiar tudo do estoque PC
echo [1/3] Copiando arquivos do estoque...
copy /Y "src\apps\estoque\index.html" "mobile-app\www\index.html" >nul
copy /Y "src\apps\estoque\renderer.js" "mobile-app\www\renderer.js" >nul
copy /Y "src\apps\estoque\styles.css" "mobile-app\www\styles.css" >nul
copy /Y "src\renderer\styles\tokens.css" "mobile-app\www\renderer\styles\tokens.css" >nul
copy /Y "src\renderer\styles\base.css" "mobile-app\www\renderer\styles\base.css" >nul
copy /Y "src\renderer\styles\components.css" "mobile-app\www\renderer\styles\components.css" >nul
echo  ✓ Arquivos copiados

REM Ajustar @import paths
echo [2/3] Ajustando caminhos dos imports CSS...
powershell -NoProfile -Command "(Get-Content 'mobile-app\www\styles.css' -Raw) -replace '\.\./\.\./renderer/styles/','renderer/styles/' | Set-Content 'mobile-app\www\styles.css' -Encoding UTF8"
echo  ✓ Imports ajustados

REM Sincronizar com Android
echo [3/3] Sincronizando com Android...
cd mobile-app
call npx cap sync android
if errorlevel 1 (
    echo  ❌ Falha no sync
    pause
    exit /b 1
)
echo  ✓ Android sincronizado

echo.
echo ╔════════════════════════════════════════════════╗
echo ║              SYNC CONCLUIDO! ✅               ║
echo ╚════════════════════════════════════════════════╝
echo.
echo Agora gere o APK:
echo   - No Android Studio: Build ^> Build APK(s)
echo   - Ou execute: gerar-apk.bat
echo.
pause
