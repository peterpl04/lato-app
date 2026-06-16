const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const pool = require("./db");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(express.json());
const ACTIVITY_RETENTION_DAYS = 30;
const ACTIVITY_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

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
    environment: normalizeEnvironment(row.environment),
    at: occurredAt,
    day: toDateKey(occurredAt)
  };
}

async function cleanupOldActivities() {
  try {
    const result = await pool.query(
      `
      DELETE FROM launcher_activities
      WHERE occurred_at < (NOW() - ($1::int * INTERVAL '1 day'))
      `,
      [ACTIVITY_RETENTION_DAYS]
    );

    if (Number(result.rowCount) > 0) {
      console.log(`🧹 Limpeza de atividades: ${result.rowCount} registro(s) removido(s)`);
    }
  } catch (err) {
    console.error("❌ Erro ao limpar atividades antigas:", err);
  }
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

  // ALIMENTADOR COLUMNS
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alimentador_aplicacao TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alimentador_tipo_produto TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alimentador_tipo_painel TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alimentador_local_botoeira TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS alimentador_altura_entrega TEXT`);

  // GIRAFA COLUMNS
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_codigo TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_altura_recepcao TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_altura_entrega TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_tipo_produto TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_largura_fita TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_comprimento_fita TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_modelo_fita TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_taliscas TEXT`);
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS girafa_tirantes BOOLEAN DEFAULT FALSE`);

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

  await pool.query(`DROP INDEX IF EXISTS ux_launcher_activities_activity_id`);
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_launcher_activities_activity_id ON launcher_activities(activity_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_launcher_activities_env_occurred ON launcher_activities(environment, occurred_at DESC)`);

  /* ESTOQUE TABLES */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS estoque_items (
      id SERIAL PRIMARY KEY,
      item_id TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      environment TEXT NOT NULL DEFAULT 'prod',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS estoque_movements (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES estoque_items(id) ON DELETE CASCADE,
      movement_type TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      movement_date DATE NOT NULL,
      address TEXT,
      environment TEXT NOT NULL DEFAULT 'prod',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS ix_estoque_items_category ON estoque_items(category, environment)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS ix_estoque_movements_item ON estoque_movements(item_id)`);

  // Migration: add location (endereçamento do item no estoque)
  await pool.query(`ALTER TABLE estoque_items ADD COLUMN IF NOT EXISTS location TEXT`);

  console.log("🟢 Tabelas projects e estoque prontas");
}

initDB().catch(err => {
  console.error("❌ Erro ao iniciar banco:", err);
});

cleanupOldActivities();
setInterval(cleanupOldActivities, ACTIVITY_CLEANUP_INTERVAL_MS);
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
        girafa_codigo,
        girafa_altura_recepcao,
        girafa_altura_entrega,
        girafa_tipo_produto,
        girafa_largura_fita,
        girafa_comprimento_fita,
        girafa_modelo_fita,
        girafa_taliscas,
        girafa_tirantes,
        esteira,
        entrega,
        instalacao,
        environment,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
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
        p.girafa_codigo || null,
        p.girafa_altura_recepcao || null,
        p.girafa_altura_entrega || null,
        p.girafa_tipo_produto || null,
        p.girafa_largura_fita || null,
        p.girafa_comprimento_fita || null,
        p.girafa_modelo_fita || null,
        p.girafa_taliscas || null,
        p.girafa_tirantes || false,
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
  girafa_codigo=$12,
  girafa_altura_recepcao=$13,
  girafa_altura_entrega=$14,
  girafa_tipo_produto=$15,
  girafa_largura_fita=$16,
  girafa_comprimento_fita=$17,
  girafa_modelo_fita=$18,
  girafa_taliscas=$19,
  girafa_tirantes=$20,
  esteira=$21,
  entrega=$22,
  instalacao=$23
WHERE id=$24
AND environment = $25

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
      p.girafa_codigo,
      p.girafa_altura_recepcao,
      p.girafa_altura_entrega,
      p.girafa_tipo_produto,
      p.girafa_largura_fita,
      p.girafa_comprimento_fita,
      p.girafa_modelo_fita,
      p.girafa_taliscas,
      p.girafa_tirantes || false,
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

/* =========================
   ESTOQUE ENDPOINTS
========================= */

// GET ALL ITEMS BY CATEGORY
app.get("/estoque/items/:category", async (req, res) => {
  const { category } = req.params;
  const env = getRequestEnvironment(req);

  try {
    const result = await pool.query(
      `SELECT * FROM estoque_items WHERE category = $1 AND environment = $2 ORDER BY created_at DESC`,
      [category, env]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ ERRO AO BUSCAR ITEMS:", err);
    res.status(500).json({ error: "Erro ao buscar itens" });
  }
});

// GET SINGLE ITEM WITH MOVEMENTS
app.get("/estoque/items/:itemId/movements", async (req, res) => {
  const { itemId } = req.params;
  const env = getRequestEnvironment(req);

  try {
    const itemResult = await pool.query(
      `SELECT * FROM estoque_items WHERE item_id = $1 AND environment = $2`,
      [itemId, env]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const movementsResult = await pool.query(
      `SELECT * FROM estoque_movements WHERE item_id = $1 ORDER BY movement_date DESC`,
      [itemResult.rows[0].id]
    );

    res.json({
      item: itemResult.rows[0],
      movements: movementsResult.rows
    });
  } catch (err) {
    console.error("❌ ERRO AO BUSCAR ITEM:", err);
    res.status(500).json({ error: "Erro ao buscar item" });
  }
});

// CREATE ITEM
app.post("/estoque/items", async (req, res) => {
  const { itemId, category, name, code, quantity, location } = req.body;
  const env = getRequestEnvironment(req);

  if (!itemId || !category || !name || !code) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  try {
    const result = await pool.query(
      `
      INSERT INTO estoque_items (item_id, category, name, code, quantity, location, environment)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [itemId, category, name, code, quantity || 0, location || null, env]
    );

    io.to(`estoque:${env}`).emit("estoque:update");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERRO AO INSERIR ITEM:", err);
    res.status(500).json({ error: "Erro ao criar item" });
  }
});

// UPDATE ITEM (quantity and/or location)
app.patch("/estoque/items/:itemId", async (req, res) => {
  const { itemId } = req.params;
  const { quantity, location } = req.body;
  const env = getRequestEnvironment(req);

  const sets = [];
  const params = [];
  let i = 1;
  if (quantity !== undefined) { sets.push(`quantity = $${i++}`); params.push(quantity); }
  if (location !== undefined) { sets.push(`location = $${i++}`); params.push(location); }
  if (sets.length === 0) {
    return res.status(400).json({ error: "Nenhum campo para atualizar" });
  }
  sets.push(`updated_at = NOW()`);
  params.push(itemId, env);

  try {
    const result = await pool.query(
      `UPDATE estoque_items SET ${sets.join(', ')} WHERE item_id = $${i++} AND environment = $${i} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    io.to(`estoque:${env}`).emit("estoque:update");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ ERRO AO ATUALIZAR ITEM:", err);
    res.status(500).json({ error: "Erro ao atualizar item" });
  }
});

// ADD MOVEMENT
app.post("/estoque/items/:itemId/movements", async (req, res) => {
  const { itemId } = req.params;
  const { movementType, quantity, movementDate, address } = req.body;
  const env = getRequestEnvironment(req);

  if (!movementType || !quantity || !movementDate) {
    return res.status(400).json({ error: "Dados inválidos" });
  }

  try {
    const itemResult = await pool.query(
      `SELECT id FROM estoque_items WHERE item_id = $1 AND environment = $2`,
      [itemId, env]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    const dbItemId = itemResult.rows[0].id;

    const movementResult = await pool.query(
      `
      INSERT INTO estoque_movements (item_id, movement_type, quantity, movement_date, address, environment)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [dbItemId, movementType, quantity, movementDate, address || null, env]
    );

    // Update item quantity
    let quantityUpdate = quantity;
    if (movementType === 'saida') {
      quantityUpdate = -quantity;
    }

    await pool.query(
      `
      UPDATE estoque_items
      SET quantity = quantity + $1, updated_at = NOW()
      WHERE id = $2
      `,
      [quantityUpdate, dbItemId]
    );

    io.to(`estoque:${env}`).emit("estoque:update");
    res.json(movementResult.rows[0]);
  } catch (err) {
    console.error("❌ ERRO AO ADICIONAR MOVIMENTO:", err);
    res.status(500).json({ error: "Erro ao registrar movimento" });
  }
});

// DELETE ITEM
app.delete("/estoque/items/:itemId", async (req, res) => {
  const { itemId } = req.params;
  const env = getRequestEnvironment(req);

  try {
    const result = await pool.query(
      `DELETE FROM estoque_items WHERE item_id = $1 AND environment = $2 RETURNING *`,
      [itemId, env]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Item não encontrado" });
    }

    io.to(`estoque:${env}`).emit("estoque:update");
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error("❌ ERRO AO DELETAR ITEM:", err);
    res.status(500).json({ error: "Erro ao deletar item" });
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

