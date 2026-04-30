# Lato Estoque Mobile

App Android do módulo Estoque — **mesma interface, mesmo backend, mesma funcionalidade do PC**.

## Estrutura

```
LatoApps/
├── src/apps/estoque/          ← Estoque do PC (NÃO MEXER)
├── mobile-app/                ← Projeto mobile (gerado pelo setup)
│   ├── www/                   ← Arquivos copiados do estoque PC
│   ├── android/               ← Projeto Android nativo
│   └── capacitor.config.json
├── setup-mobile.bat           ← Roda 1x para preparar tudo
└── gerar-apk.bat              ← Roda toda vez que quiser gerar APK
```

## Como usar

### Passo 1 — Setup inicial (rodar 1 vez só)

Duplo clique em: **`setup-mobile.bat`**

O script vai:
1. Criar a pasta `mobile-app/`
2. Copiar HTML/CSS/JS do estoque PC
3. Instalar o Capacitor
4. Adicionar a plataforma Android

### Passo 2 — Gerar o APK

**Opção A — Via Android Studio (recomendado, já que você instalou):**

```cmd
cd mobile-app
npx cap open android
```

No Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

APK ficará em: `mobile-app\android\app\build\outputs\apk\debug\app-debug.apk`

**Opção B — Via terminal (sem abrir Android Studio):**

Duplo clique em: **`gerar-apk.bat`**

APK ficará em: `LatoEstoque.apk` (na raiz do projeto)

### Passo 3 — Atualizar mobile com mudanças do PC

Sempre que você atualizar o estoque no PC e quiser refletir no mobile, rode novamente o **`setup-mobile.bat`** (ele recopia os arquivos) e depois **`gerar-apk.bat`**.

## Importante

- ✅ O mobile usa o **mesmo backend Railway** do PC — movimentações sincronizam automaticamente
- ✅ **Nada foi alterado no estoque PC** — está intocado em `src/apps/estoque/`
- ✅ Mesma tela e funcionalidades — só roda em Android agora
