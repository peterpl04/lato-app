const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

/* =========================
   INIT DATABASE
========================= */

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      obra TEXT NOT NULL,
      cliente TEXT,
      unidade TEXT,
      alimentador TEXT,
      observacao TEXT NOT NULL,
      girafa TEXT,
      esteira TEXT,
      entrega DATE,
      instalacao DATE,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log("🟢 Tabela projects pronta");
}

initDB().catch(err => {
  console.error("❌ Erro ao iniciar banco:", err);
});
/* =========================
   SOCKET
========================= */

io.on("connection", socket => {
  console.log("🟢 Cliente conectado");

  socket.on("disconnect", () => {
    console.log("🔴 Cliente desconectado");
  });
});

/* =========================
   API
========================= */

// GET ALL
app.get("/projects", async (req, res) => {
  try {
  const result = await pool.query(
    "SELECT * FROM projects ORDER BY id DESC"
  );
  res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// CREATE
app.post("/projects", async (req, res) => {
  const p = req.body;

  try {
    const result = await pool.query(
      `
      INSERT INTO projects (
        obra,
        cliente,
        unidade,
        alimentador,
        alimentador_aplicacao,
        alimentador_tipo_produto,
        alimentador_tipo_painel,
        alimentador_local_botoeira,
        alimentador_altura_entrega,
        observacao,
        girafa,
        esteira,
        entrega,
        instalacao,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
      )

      RETURNING *
      `,
      [
        p.obra,
        p.cliente || null,
        p.unidade || null,
        p.alimentador || null,

        p.alimentador_aplicacao || null,
        p.alimentador_tipo_produto || null,
        p.alimentador_tipo_painel || null,
        p.alimentador_local_botoeira || null,
        p.alimentador_altura_entrega || null,

        p.observacao,
        p.girafa || null,
        p.esteira || null,
        p.entrega || null,
        p.instalacao || null,
        p.createdBy
      ]
    );

    io.emit("projects:update");
    res.json(result.rows[0]);

  } catch (err) {
    console.error("❌ ERRO AO INSERIR:", err); // 👈 NÃO REMOVA ISSO
    res.status(500).json(err);
  }
});


// UPDATE
app.put("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const p = req.body;

  try {
  await pool.query(
    `
    UPDATE projects SET
  obra=$1,
  cliente=$2,
  unidade=$3,
  alimentador=$4,
  alimentador_aplicacao=$5,
  alimentador_tipo_produto=$6,
  alimentador_tipo_painel=$7,
  alimentador_local_botoeira=$8,
  alimentador_altura_entrega=$9,
  observacao=$10,
  girafa=$11,
  esteira=$12,
  entrega=$13,
  instalacao=$14
WHERE id=$15

    `,
    [
      p.obra,
      p.cliente,
      p.unidade,
      p.alimentador,

      p.alimentador_aplicacao,
      p.alimentador_tipo_produto,
      p.alimentador_tipo_painel,
      p.alimentador_local_botoeira,
      p.alimentador_altura_entrega,

      p.observacao,
      p.girafa,
      p.esteira,
      p.entrega,
      p.instalacao,
      id
    ]
  );

  io.emit("projects:update");
  res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

// DELETE
app.delete("/projects/:id", async (req, res) => {
  try {
  await pool.query(
    "DELETE FROM projects WHERE id=$1",
    [req.params.id]
  );

  io.emit("projects:update");
  res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

/* ========================= */

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`🚀 Backend rodando na porta ${PORT}`)
);


app.post("/auth/login", async (req, res) => {
  const { user, pass } = req.body;

  if (!user || !pass) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [user]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    const dbUser = result.rows[0];

    const ok = await bcrypt.compare(pass, dbUser.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Usuário ou senha inválidos" });
    }

    res.json({
      success: true,
      user: {
        id: dbUser.id,
        name: dbUser.username,
        role: dbUser.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro interno" });
  }
});

