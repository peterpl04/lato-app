const button = document.querySelector("button");
const wrapper = document.querySelector(".login-wrapper");

async function login() {
  button.classList.add("press");
  setTimeout(() => button.classList.remove("press"), 120);

  const user = document.getElementById("user").value.trim();
  const pass = document.getElementById("pass").value;
  const error = document.getElementById("error");

  if (!user || !pass) {
    error.textContent = "Informe usuário e senha";
    return;
  }

  try {
    const res = await fetch("https://lato-app-production.up.railway.app/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass })
    });

    const data = await res.json();

    if (!res.ok) {
      error.textContent = data.error || "Login inválido";
      wrapper.classList.remove("shake");
      void wrapper.offsetWidth;
      wrapper.classList.add("shake");
      return;
    }

    window.api.loginSuccess(data.user);

  } catch (err) {
    error.textContent = "Erro de conexão";
  }
}

document.addEventListener("keydown", e => {
  if (e.key === "Enter") login();
});
