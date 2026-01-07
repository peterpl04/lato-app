if (process.env.NODE_ENV === "development") {
  require("dotenv").config();

  require("electron-reload")(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`)
  });
}


const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function createMainWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets/icons/logo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.setMenu(null);
  win.loadFile("index.html");
}


function openDWGRenamer() {
  const win = new BrowserWindow({
    width: 560,
    height: 550,
    resizable: false,
    parent: mainWindow,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  win.setMenu(null);
  win.loadFile("apps/dwg-renamer/index.html");
}

/* ===== IPC ===== */

ipcMain.handle("open-dwg-renamer", () => {
  openDWGRenamer();
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("processar", async (_, origem, destino, multiplicador) => {
  const mult = Number(multiplicador);

  if (!Number.isFinite(mult) || mult <= 0) {
    return;
  }

  const arquivos = fs.readdirSync(origem);
  let processados = 0;

  arquivos.forEach(arquivo => {
    const origemArquivo = path.join(origem, arquivo);
    const { name, ext } = path.parse(arquivo);

    // 🔹 PDF → copia direto, sem renomear
    if (ext.toLowerCase() === ".pdf") {
      fs.copyFileSync(
        origemArquivo,
        path.join(destino, arquivo)
      );
      processados++;
      return;
    }

    // 🔹 DWG → renomeia e copia
    if (ext.toLowerCase() === ".dwg") {
      const match = name.match(/_(\d+)PC$/i);
      if (!match) return;

      const qtd = Number(match[1]);
      const novaQtd = qtd * mult;

      const base = name.replace(/_(\d+)PC$/i, "");
      const novoNome = `${base}_${novaQtd}PC${ext}`;

      fs.copyFileSync(
        origemArquivo,
        path.join(destino, novoNome)
      );

      processados++;
    }
  });

  return processados;
});



/* ===== APP ===== */

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  app.quit();
});
