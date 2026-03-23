const statusEl = document.getElementById("status");
const versionEl = document.getElementById("version");
const barEl = document.getElementById("bar");
const percentEl = document.getElementById("percent");
const speedEl = document.getElementById("speed");
const dataEl = document.getElementById("data");

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatSpeed(bytesPerSecond) {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) {
    return "-";
  }

  const mbps = bytesPerSecond / (1024 * 1024);
  return `${mbps.toFixed(2)} MB/s`;
}

if (window.api?.onUpdateAvailable) {
  window.api.onUpdateAvailable(version => {
    versionEl.textContent = `Nova versão ${version} encontrada.`;
    statusEl.textContent = "Iniciando download...";
  });

  window.api.onUpdateProgress(data => {
    const safePercent = Math.min(100, Math.max(0, Math.round(data.percent || 0)));

    barEl.style.width = `${safePercent}%`;
    percentEl.textContent = `${safePercent}%`;
    speedEl.textContent = formatSpeed(data.speed);
    dataEl.textContent = `${formatBytes(data.transferred)} / ${formatBytes(data.total)}`;
    statusEl.textContent = `Baixando atualização... ${safePercent}%`;
  });

  window.api.onUpdateDone(() => {
    barEl.style.width = "100%";
    percentEl.textContent = "100%";
    statusEl.textContent = "Pacote pronto. Finalizando instalação...";
  });
} else {
  statusEl.textContent = "Erro ao conectar com o serviço de update.";
}
