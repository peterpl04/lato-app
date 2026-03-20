function openDWG() {
  window.api.openDWGRenamer();
}

function openProjectManager() {
  window.api.openProjectManager();
}

function toggleSettings() {
  const menu = document.getElementById("settingsMenu");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
  document.getElementById("settingsMenu").style.display = "none";
}

// aplica tema salvo ao abrir
window.onload = () => {
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
};

window.onload = () => {
  const theme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
};

