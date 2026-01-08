if (process.env.NODE_ENV === "development") {
  require("dotenv").config();

  require("electron-reload")(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`)
  });
}


const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const archiver = require("archiver");
const path = require("path");
const fs = require("fs");

let loginWindow;
let mainWindow;

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 390,
    height: 460,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  loginWindow.loadFile("login.html");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets/icons/logo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile("index.html");
}



function openDWGRenamer() {
  const win = new BrowserWindow({
    width: 560,
    height: 630,
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

function zipDestino(destino) {
  return new Promise((resolve, reject) => {
    const zipPath = path.join(destino, "MUDAR_NOME.zip");

    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve());
    archive.on("error", err => reject(err));

    archive.pipe(output);

    // adiciona TODOS os arquivos da pasta destino
    // archive.directory(destino, false);

    archive.glob("**/*", {
      cwd: destino,
      ignore: ["MUDAR_NOME.zip"]
    });


    archive.finalize();
  });
}


/* ===== IPC ===== */

ipcMain.handle("login-success", () => {
  if (loginWindow) {
    loginWindow.close();
    loginWindow = null;
  }

  createMainWindow();
});


ipcMain.handle("open-dwg-renamer", () => {
  openDWGRenamer();
});

ipcMain.handle("select-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle(
  "processar",
  async (_, origem, destino, multiplicador, deleteOrigem) => {

    const mult = Number(multiplicador);

    if (!Number.isFinite(mult) || mult <= 0) {
      throw new Error("Multiplicador inválido");
    }

    if (path.resolve(origem) === path.resolve(destino)) {
      throw new Error("Origem e destino não podem ser a mesma pasta");
    }

    const arquivos = fs.readdirSync(origem);
    let processados = 0;

    arquivos.forEach(arquivo => {
      const origemArquivo = path.join(origem, arquivo);
      const { name, ext } = path.parse(arquivo);

      // PDF
      if (ext.toLowerCase() === ".pdf") {
        fs.copyFileSync(
          origemArquivo,
          path.join(destino, arquivo)
        );
        processados++;
        return;
      }

      // DWG
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

    // 🧹 Apaga origem SOMENTE se marcado
    if (deleteOrigem && processados > 0) {
      const arquivosOrigem = fs.readdirSync(origem);

      arquivosOrigem.forEach(arquivo => {
        const caminho = path.join(origem, arquivo);

        // garante que é arquivo, não pasta
        if (fs.lstatSync(caminho).isFile()) {
          fs.unlinkSync(caminho);
        }
      });
    }


    // 📦 cria o zip automaticamente
    await zipDestino(destino);


    // 📂 abre a pasta de destino no Explorer
    shell.openPath(destino);


    return processados;
  }
);




/* ===== APP ===== */

app.whenReady().then(createLoginWindow);

app.on("window-all-closed", () => {
  app.quit();
});
