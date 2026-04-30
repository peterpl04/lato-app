@echo off
chcp 65001 >nul
title Lato Estoque - Gerar APK
color 0A

echo.
echo ╔════════════════════════════════════════════════╗
echo ║         GERANDO APK DO LATO ESTOQUE           ║
echo ╚════════════════════════════════════════════════╝
echo.

cd /d "%~dp0\mobile-app"

if not exist "android" (
    echo  ❌ Pasta android nao encontrada!
    echo  Execute primeiro: setup-mobile.bat
    pause
    exit /b 1
)

REM Sincronizar arquivos web com Android
echo [1/3] Sincronizando arquivos web...
call npx cap sync android
if errorlevel 1 (
    echo  ❌ Falha ao sincronizar
    pause
    exit /b 1
)
echo  ✓ Sincronizado

REM Build do APK via Gradle
echo.
echo [2/3] Compilando APK (pode demorar 3-5 min na primeira vez)...
cd android
call gradlew.bat assembleDebug
if errorlevel 1 (
    echo.
    echo  ❌ Falha no build!
    echo.
    echo  POSSIVEIS CAUSAS:
    echo   - JAVA_HOME nao configurado
    echo   - ANDROID_HOME nao configurado
    echo.
    echo  SOLUCAO RAPIDA: Abrir no Android Studio
    echo    cd mobile-app
    echo    npx cap open android
    echo  E gerar APK por la: Build ^> Build Bundle(s)/APK(s) ^> Build APK(s)
    pause
    exit /b 1
)

REM Copiar APK para raiz
echo.
echo [3/3] Copiando APK final...
cd ..\..
copy /Y "mobile-app\android\app\build\outputs\apk\debug\app-debug.apk" "LatoEstoque.apk" >nul

echo.
echo ╔════════════════════════════════════════════════╗
echo ║              APK GERADO! ✅                   ║
echo ╚════════════════════════════════════════════════╝
echo.
echo  📦 Arquivo: LatoEstoque.apk
echo  📍 Local: %cd%\LatoEstoque.apk
echo.
echo  PARA INSTALAR:
echo   1. Copie LatoEstoque.apk para o celular
echo   2. Abra o arquivo no celular
echo   3. Permita "Fontes desconhecidas" se solicitado
echo   4. Instale!
echo.
pause
