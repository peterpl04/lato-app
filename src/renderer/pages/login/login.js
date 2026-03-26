const form = document.getElementById("login-form");
const userInput = document.getElementById("user");
const passInput = document.getElementById("pass");
const submitButton = document.getElementById("submit-login");
const togglePassButton = document.getElementById("toggle-pass");
const wrapper = document.querySelector(".login-wrapper");
const errorEl = document.getElementById("error");
const capsLockEl = document.getElementById("caps-lock");

let isLoading = false;
const LAST_USER_KEY = "latoapps:last-user";

function setLoadingState(enabled) {
  isLoading = enabled;
  submitButton.disabled = enabled;
  userInput.disabled = enabled;
  passInput.disabled = enabled;
  togglePassButton.disabled = enabled;

  submitButton.classList.toggle("loading", enabled);
  submitButton.textContent = enabled ? "Entrando..." : "Entrar";
}

function showError(message) {
  errorEl.textContent = message;
  wrapper.classList.remove("shake");
  void wrapper.offsetWidth;
  wrapper.classList.add("shake");
}

function updateCapsLockState(event) {
  const enabled = event.getModifierState && event.getModifierState("CapsLock");
  capsLockEl.textContent = enabled ? "Caps Lock ativado" : "";
}

async function login() {
  if (isLoading) {
    return;
  }

  const user = userInput.value.trim();
  const pass = passInput.value;

  errorEl.textContent = "";

  if (!user || !pass) {
    showError("Informe usuario e senha");
    return;
  }

  setLoadingState(true);

  try {
    const res = await fetch("https://lato-app-production.up.railway.app/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showError(data.error || "Login invalido");
      setLoadingState(false);
      return;
    }

    localStorage.setItem(LAST_USER_KEY, user);
    window.api.loginSuccess(data.user);
  } catch (err) {
    showError("Nao foi possivel conectar ao servidor");
    setLoadingState(false);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  login();
});

togglePassButton.addEventListener("click", () => {
  const reveal = passInput.type === "password";
  passInput.type = reveal ? "text" : "password";
  togglePassButton.textContent = reveal ? "Ocultar" : "Mostrar";
  togglePassButton.setAttribute("aria-label", reveal ? "Ocultar senha" : "Mostrar senha");
  passInput.focus();
});

passInput.addEventListener("keyup", updateCapsLockState);
passInput.addEventListener("keydown", updateCapsLockState);
document.addEventListener("keyup", updateCapsLockState);

window.addEventListener("DOMContentLoaded", () => {
  const lastUser = localStorage.getItem(LAST_USER_KEY);

  if (lastUser) {
    userInput.value = lastUser;
    passInput.focus();
  } else {
    userInput.focus();
  }
});
