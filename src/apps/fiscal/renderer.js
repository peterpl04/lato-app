let selectedFolder = "";

const btnSelectFolder = document.getElementById("btnSelectFolder");
const btnSearch = document.getElementById("btnSearch");
const folderPathInput = document.getElementById("folderPath");
const invoiceInput = document.getElementById("invoiceNumber");
const resultCounter = document.getElementById("resultCounter");
const resultList = document.getElementById("resultList");
const statusEl = document.getElementById("status");

function setStatus(message, tone = "info") {
  statusEl.className = `status ${tone}`;
  statusEl.textContent = message;
}

function renderResults(matches) {
  resultList.innerHTML = "";

  if (!Array.isArray(matches) || !matches.length) {
    return;
  }

  matches.forEach((item) => {
    const li = document.createElement("li");

    const fileName = document.createElement("p");
    fileName.className = "result-file";
    fileName.textContent = item.name;

    const relativePath = document.createElement("p");
    relativePath.className = "result-path";
    relativePath.textContent = item.movedToRelativePath || item.relativePath;

    li.append(fileName, relativePath);
    resultList.appendChild(li);
  });
}

async function selectFolder() {
  const folder = await window.api.selectFolder();
  selectedFolder = folder || "";
  folderPathInput.value = selectedFolder;
}

async function searchByInvoice() {
  const invoiceNumber = invoiceInput.value.trim();

  resultList.innerHTML = "";
  resultCounter.textContent = "Processando...";

  if (!selectedFolder) {
    setStatus("Selecione uma pasta para iniciar a busca.", "error");
    resultCounter.textContent = "Pasta não selecionada";
    return;
  }

  if (!invoiceNumber) {
    setStatus("Digite o número da nota fiscal.", "error");
    resultCounter.textContent = "Nota fiscal não informada";
    return;
  }

  setStatus("Buscando arquivos...", "info");

  try {
    const result = await window.api.searchFiscalFiles(selectedFolder, invoiceNumber);
    const totalMatches = Number(result?.totalMatches || 0);
    const scannedFiles = Number(result?.scannedFiles || 0);
    const movedFiles = Number(result?.movedFiles || 0);

    resultCounter.textContent = `${totalMatches} arquivo(s) encontrado(s) | ${movedFiles} movido(s)`;

    if (totalMatches > 0) {
      setStatus(
        `Busca finalizada em ${scannedFiles} arquivo(s). ${movedFiles} arquivo(s) enviado(s) para IMPRESSAS.`,
        "success"
      );
      renderResults(result.matches);
      return;
    }

    setStatus(`Nenhum arquivo encontrado em ${scannedFiles} arquivo(s) analisados.`, "info");
  } catch (error) {
    setStatus(error?.message || "Erro ao buscar arquivos.", "error");
    resultCounter.textContent = "Erro na busca";
  }
}

btnSelectFolder.addEventListener("click", () => {
  void selectFolder();
});

btnSearch.addEventListener("click", () => {
  void searchByInvoice();
});

invoiceInput.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  void searchByInvoice();
});
