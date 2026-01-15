const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");

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
      local TEXT NOT NULL,
      alimentador TEXT,
      observacao TEXT NOT NULL,
      girafa TEXT,
      esteira TEXT,
      entrega DATE,
      instalacao DATE,
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
      INSERT INTO projects
      (obra, local, alimentador, observacao, girafa, esteira, entrega, instalacao)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        p.obra,
        p.local,
        p.alimentador,
        p.observacao,
        p.girafa,
        p.esteira,
        p.entrega,
        p.instalacao
      ]
    );

    io.emit("projects:update");
    res.json(result.rows[0]);
  } catch (err) {
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
        obra=$1, local=$2, alimentador=$3, observacao=$4,
        girafa=$5, esteira=$6, entrega=$7, instalacao=$8
      WHERE id=$9
      `,
      [
        p.obra,
        p.local,
        p.alimentador,
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
