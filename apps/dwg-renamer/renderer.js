let origem = null;
let destino = null;

const statusEl = document.getElementById("status");

document.getElementById("btnOrigem").onclick = async () => {
  origem = await window.api.selectFolder();
  document.getElementById("origemPath").innerText = origem || "";
};

document.getElementById("btnDestino").onclick = async () => {
  destino = await window.api.selectFolder();
  document.getElementById("destinoPath").innerText = destino || "";
};

document.getElementById("btnProcessar").onclick = async () => {
  statusEl.className = "status";
  statusEl.innerText = "";

  if (!origem || !destino) {
    statusEl.innerText = "❌ Selecione as pastas de origem e destino.";
    statusEl.classList.add("error");
    return;
  }

  const valor = document.getElementById("multiplicador").value;
  const multiplicador = Number(valor);

  if (
    valor === "" ||
    !Number.isFinite(multiplicador) ||
    multiplicador <= 0
  ) {
    statusEl.innerText =
      "❌ Informe um multiplicador válido (número maior que zero).";
    statusEl.classList.add("error");
    return;
  }

  try {
    await window.api.processar(origem, destino, multiplicador);

    statusEl.innerText = "✅ Arquivos processados com sucesso.";
    statusEl.classList.add("success");
  } catch (err) {
    statusEl.innerText = "❌ Erro ao processar os arquivos.";
    statusEl.classList.add("error");
  } finally {
    // 🔄 RESET GARANTIDO DA TELA
    origem = null;
    destino = null;

    document.getElementById("origemPath").innerText = "";
    document.getElementById("destinoPath").innerText = "";
    document.getElementById("multiplicador").value = "";
  }
};



