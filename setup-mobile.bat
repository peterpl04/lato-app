@echo off
chcp 65001 >nul
title Lato Estoque Mobile - Setup
color 0B

echo.
echo ╔════════════════════════════════════════════════╗
echo ║   LATO ESTOQUE MOBILE - SETUP AUTOMATICO      ║
echo ╚════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

REM Verificar Node.js
echo [1/6] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ❌ Node.js nao encontrado! Instale em https://nodejs.org
    pause
    exit /b 1
)
for /f %%i in ('node --version') do echo  ✓ Node.js %%i

REM Criar estrutura de pastas
echo.
echo [2/6] Criando estrutura de pastas...
if not exist "mobile-app" mkdir "mobile-app"
if not exist "mobile-app\www" mkdir "mobile-app\www"
if not exist "mobile-app\www\renderer" mkdir "mobile-app\www\renderer"
if not exist "mobile-app\www\renderer\styles" mkdir "mobile-app\www\renderer\styles"
echo  ✓ Pastas criadas

REM Copiar arquivos do estoque PC para mobile
echo.
echo [3/6] Copiando arquivos do estoque PC...
copy /Y "src\apps\estoque\index.html" "mobile-app\www\index.html" >nul
copy /Y "src\apps\estoque\renderer.js" "mobile-app\www\renderer.js" >nul
copy /Y "src\apps\estoque\styles.css" "mobile-app\www\styles.css" >nul
REM Copiar tokens, base e components (cores, animacoes, botoes)
copy /Y "src\renderer\styles\tokens.css" "mobile-app\www\renderer\styles\tokens.css" >nul
copy /Y "src\renderer\styles\base.css" "mobile-app\www\renderer\styles\base.css" >nul
copy /Y "src\renderer\styles\components.css" "mobile-app\www\renderer\styles\components.css" >nul

REM Ajustar caminhos dos @import no styles.css (de ../../renderer/ para renderer/)
powershell -NoProfile -Command "(Get-Content 'mobile-app\www\styles.css' -Raw) -replace '\.\./\.\./renderer/styles/','renderer/styles/' | Set-Content 'mobile-app\www\styles.css' -Encoding UTF8"
echo  ✓ Arquivos copiados (com tokens, base, components)

REM Instalar dependencias do Capacitor
echo.
echo [4/6] Instalando Capacitor (pode demorar 2-3 min)...
cd mobile-app

REM Criar package.json se nao existir
if not exist "package.json" (
    (
    echo {
    echo   "name": "lato-estoque-mobile",
    echo   "version": "1.0.0",
    echo   "private": true,
    echo   "dependencies": {
    echo     "@capacitor/android": "^6.1.2",
    echo     "@capacitor/core": "^6.1.2"
    echo   },
    echo   "devDependencies": {
    echo     "@capacitor/cli": "^6.1.2"
    echo   }
    echo }
    ) > package.json
)

call npm install --silent
if errorlevel 1 (
    echo  ❌ Falha na instalacao
    pause
    exit /b 1
)
echo  ✓ Capacitor instalado

REM Criar configuracao do Capacitor
echo.
echo [5/6] Configurando Capacitor...
(
echo {
echo   "appId": "br.lato.estoque",
echo   "appName": "Lato Estoque",
echo   "webDir": "www",
echo   "server": { "androidScheme": "https" }
echo }
) > capacitor.config.json
echo  ✓ Capacitor configurado

REM Adicionar plataforma Android
echo.
echo [6/6] Adicionando plataforma Android...
if not exist "android" (
    call npx cap add android
) else (
    call npx cap sync android
)
echo  ✓ Android pronto

echo.
echo ╔════════════════════════════════════════════════╗
echo ║              SETUP CONCLUIDO! ✅              ║
echo ╚════════════════════════════════════════════════╝
echo.
echo PROXIMO PASSO: Gerar o APK
echo.
echo  Execute:  gerar-apk.bat
echo.
echo  Ou abra no Android Studio:
echo    cd mobile-app
echo    npx cap open android
echo.
pause
