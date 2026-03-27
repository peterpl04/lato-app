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

function normalizeEnvironment(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (["dev", "development", "local"].includes(raw)) {
    return "dev";
  }

  return "prod";
}

function getRequestEnvironment(req) {
  return normalizeEnvironment(
    req.headers["x-app-env"] || req.query.env || req.body?.env || process.env.APP_ENV
  );
}

function toDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value) {
  if (typeof value !== "string") {
    return toDateKey();
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  return toDateKey();
}

function normalizeActivityPayload(payload, env) {
  const raw = payload && typeof payload === "object" ? payload : {};
  const parsedDate = raw.at ? new Date(raw.at) : new Date();
  const occurredAt = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `${Date.now()}-${Math.round(Math.random() * 100000)}`,
    message: typeof raw.message === "string" && raw.message.trim() ? raw.message.trim() : "Evento registrado",
    tone: typeof raw.tone === "string" && raw.tone.trim() ? raw.tone.trim() : "info",
    user: typeof raw.user === "string" && raw.user.trim() ? raw.user.trim() : "Operador",
    module: typeof raw.module === "string" && raw.module.trim() ? raw.module.trim() : "launcher",
    eventType: typeof raw.eventType === "string" && raw.eventType.trim() ? raw.eventType.trim() : "generic",
    details: raw.details && typeof raw.details === "object" ? raw.details : {},
    environment: env,
    at: occurredAt.toISOString(),
    day: normalizeDateKey(raw.day || toDateKey(occurredAt))
  };
}

function mapActivityRow(row) {
  const occurredAt = row.occurred_at instanceof Date
    ? row.occurred_at.toISOString()
    : new Date(row.occurred_at || Date.now()).toISOString();

  return {
    id: row.activity_id || String(row.id),
    message: row.message,
    tone: row.tone,
    user: row.user_name,
    module: row.module,
    eventType: row.event_type,
    details: row.details || {},
    at: occurredAt,
    day: toDateKey(occurredAt)
  };
}

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
      environment TEXT NOT NULL DEFAULT 'prod',
      progresso_percent INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS progresso_percent INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'prod'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS launcher_activities (
      id BIGSERIAL PRIMARY KEY,
      activity_id TEXT,
      message TEXT NOT NULL,
      tone TEXT NOT NULL DEFAULT 'info',
      user_name TEXT NOT NULL DEFAULT 'Operador',
      module TEXT NOT NULL DEFAULT 'launcher',
      event_type TEXT NOT NULL DEFAULT 'generic',
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      environment TEXT NOT NULL DEFAULT 'prod',
      occurred_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_launcher_activities_activity_id ON launcher_activities(activity_id) WHERE activity_id IS NOT NULL`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_launcher_activities_env_occurred ON launcher_activities(environment, occurred_at DESC)`);

  console.log("🟢 Tabela projects pronta");
}

initDB().catch(err => {
  console.error("❌ Erro ao iniciar banco:", err);
});
/* =========================
   SOCKET
========================= */

io.on("connection", socket => {
  const socketEnv = normalizeEnvironment(socket.handshake.query?.env);
  socket.join(`projects:${socketEnv}`);
  socket.join(`activities:${socketEnv}`);

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
  const env = getRequestEnvironment(req);

  try {
  const result = await pool.query(
    "SELECT * FROM projects WHERE environment = $1 ORDER BY id DESC",
    [env]
  );
  res.json(result.rows);
  } catch (err) {
    res.status(500).json(err);
  }
});

// CREATE
app.post("/projects", async (req, res) => {
  const p = req.body;
  const env = getRequestEnvironment(req);
  const createdBy =
    typeof p.createdBy === "object"
      ? p.createdBy.name
      : p.createdBy;

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
        environment,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
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
        env,
        createdBy
      ]
    );

    io.to(`projects:${env}`).emit("projects:update");
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
  const env = getRequestEnvironment(req);

  try {
  const result = await pool.query(
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
AND environment = $16

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
      id,
      env
    ]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Projeto não encontrado para este ambiente" });
  }

  io.to(`projects:${env}`).emit("projects:update");
  res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

// UPDATE PROGRESS
app.patch("/projects/:id/progress", async (req, res) => {
  const { id } = req.params;
  const env = getRequestEnvironment(req);
  const percentRaw = Number(req.body.progressPercent);

  const validStages = [0, 25, 50, 65, 90, 100];
  const progressPercent = validStages.includes(percentRaw) ? percentRaw : 0;

  try {
    const result = await pool.query(
      `
      UPDATE projects
      SET progresso_percent = $1
      WHERE id = $2 AND environment = $3
      `,
      [progressPercent, id, env]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Projeto não encontrado para este ambiente" });
    }

    io.to(`projects:${env}`).emit("projects:update");
    res.json({ success: true, progresso_percent: progressPercent });
  } catch (err) {
    res.status(500).json(err);
  }
});

// DELETE
app.delete("/projects/:id", async (req, res) => {
  const env = getRequestEnvironment(req);

  try {
  const result = await pool.query(
    "DELETE FROM projects WHERE id=$1 AND environment = $2",
    [req.params.id, env]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Projeto não encontrado para este ambiente" });
  }

  io.to(`projects:${env}`).emit("projects:update");
  res.json({ success: true });
  } catch (err) {
    res.status(500).json(err);
  }
});

// GET ACTIVITIES BY DAY
app.get("/activities", async (req, res) => {
  const env = getRequestEnvironment(req);
  const day = normalizeDateKey(req.query.day);
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(500, requestedLimit)) : 200;

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM launcher_activities
      WHERE environment = $1
        AND occurred_at >= $2::date
        AND occurred_at < ($2::date + INTERVAL '1 day')
      ORDER BY occurred_at DESC
      LIMIT $3
      `,
      [env, day, limit]
    );

    res.json(result.rows.map(mapActivityRow));
  } catch (err) {
    console.error("❌ ERRO AO CONSULTAR ACTIVITIES:", err);
    res.status(500).json({ error: "Erro ao consultar atividades" });
  }
});

// CREATE ACTIVITY
app.post("/activities", async (req, res) => {
  const env = getRequestEnvironment(req);
  const normalized = normalizeActivityPayload(req.body, env);

  try {
    const result = await pool.query(
      `
      INSERT INTO launcher_activities (
        activity_id,
        message,
        tone,
        user_name,
        module,
        event_type,
        details,
        environment,
        occurred_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (activity_id)
      DO UPDATE SET
        message = EXCLUDED.message,
        tone = EXCLUDED.tone,
        user_name = EXCLUDED.user_name,
        module = EXCLUDED.module,
        event_type = EXCLUDED.event_type,
        details = EXCLUDED.details,
        environment = EXCLUDED.environment,
        occurred_at = EXCLUDED.occurred_at
      RETURNING *
      `,
      [
        normalized.id,
        normalized.message,
        normalized.tone,
        normalized.user,
        normalized.module,
        normalized.eventType,
        JSON.stringify(normalized.details || {}),
        normalized.environment,
        normalized.at
      ]
    );

    const entry = mapActivityRow(result.rows[0]);
    io.to(`activities:${env}`).emit("activity:new", entry);
    res.json(entry);
  } catch (err) {
    console.error("❌ ERRO AO INSERIR ACTIVITY:", err);
    res.status(500).json({ error: "Erro ao registrar atividade" });
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

