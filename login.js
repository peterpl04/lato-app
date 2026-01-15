const users = [
  { user: "Luiz", pass: "luiz@adm" },
  { user: "Carlos", pass: "carlos@adm" },
  { user: "João", pass: "joao@proj" },
  { user: "Pedro", pass: "pedro@dev" },
  { user: "Princesa_do_Pedro", pass: "princesinha" },
  { user: "1", pass: "1"}
];

const button = document.querySelector("button");
const wrapper = document.querySelector(".login-wrapper");

function login() {
  button.classList.add("press");
  setTimeout(() => button.classList.remove("press"), 120);

  const u = document.getElementById("user").value;
  const p = document.getElementById("pass").value;
  const error = document.getElementById("error");

  const valid = users.find(x => x.user === u && x.pass === p);

  if (!valid) {
    error.textContent = "Usuário ou senha inválidos";

    wrapper.classList.remove("shake");
    void wrapper.offsetWidth;
    wrapper.classList.add("shake");

    return;
  }

  window.api.loginSuccess();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    login();
  }
});
