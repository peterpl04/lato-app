@echo off
chcp 65001 >nul
title Limpar arquivos antigos do mobile

echo.
echo Removendo arquivos mobile antigos da raiz...
echo.

del /Q "mobile-package.json" 2>nul && echo  ✓ mobile-package.json
del /Q "mobile-index.html" 2>nul && echo  ✓ mobile-index.html
del /Q "mobile-app-final.js" 2>nul && echo  ✓ mobile-app-final.js
del /Q "mobile-styles.css" 2>nul && echo  ✓ mobile-styles.css
del /Q "app-mobile.js" 2>nul && echo  ✓ app-mobile.js
del /Q "manifest.json" 2>nul && echo  ✓ manifest.json
del /Q "capacitor.config.json" 2>nul && echo  ✓ capacitor.config.json (raiz antigo)
del /Q "build-mobile.bat" 2>nul && echo  ✓ build-mobile.bat
del /Q "build-mobile.sh" 2>nul && echo  ✓ build-mobile.sh
del /Q "MOBILE-STATUS.md" 2>nul && echo  ✓ MOBILE-STATUS.md

if exist "mobile-estoque" (
    rmdir /S /Q "mobile-estoque" && echo  ✓ pasta mobile-estoque removida
)

echo.
echo Limpeza concluida!
echo Agora execute: setup-mobile.bat
echo.
pause
