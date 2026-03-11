"use strict";

/**
 * Database Connection Pool
 *
 * PostgreSQL pool (pg) configured from config.getDatabaseUri().
 * Pool.query() acquires a client, runs the query, and releases it automatically.
 * All existing db.query() call-sites work unchanged since Pool exposes the same API.
 */
const { Pool } = require("pg");
const { getDatabaseUri } = require("./config");

const databaseUri = getDatabaseUri();

const isRemoteDb = databaseUri.includes("supabase") || databaseUri.includes("railway") || process.env.DB_SSL === "true";

const db = new Pool({
  connectionString: databaseUri,
  max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT_MS, 10) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECT_TIMEOUT_MS, 10) || 5000,
  ...(isRemoteDb && { ssl: { rejectUnauthorized: false } }),
});

let _pgvectorAvailable = null;

async function connectDb() {
  const { log, error } = require("console");
  try {
    const client = await db.connect();
    try {
      const pgvector = require("pgvector/pg");
      await pgvector.registerTypes(client);
      _pgvectorAvailable = true;
    } catch (e) {
      _pgvectorAvailable = false;
      if (process.env.NODE_ENV !== "test") {
        const { warn } = require("console");
        warn("pgvector not available (run migration 013). Document RAG disabled.");
      }
    }
    client.release();
    log(`Connected to ${databaseUri} (pool max: ${db.options.max})`);
  } catch (err) {
    error(`Couldn't connect to ${databaseUri}`, err.message);
    process.exit(1);
  }
}
connectDb();

db.on("connect", async (client) => {
  if (!_pgvectorAvailable) return;
  try {
    const pgvector = require("pgvector/pg");
    await pgvector.registerTypes(client);
  } catch (_) { /* already warned at startup */ }
});

module.exports = db;