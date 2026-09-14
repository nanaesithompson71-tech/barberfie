'use strict';
/* ==========================================================
   BARBERFIE - first-run database setup
   When the API starts against an empty database (for example a
   freshly created one on Railway) it creates the database, loads
   database/schema.sql and database/seed.sql, and carries on.
   If the tables already exist nothing is touched.
   ========================================================== */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function findSqlDir() {
  const candidates = [
    path.join(__dirname, '..', '..', 'database'),   // repo layout: backend/database
    path.join(__dirname, '..', 'database')          // bundled copy: backend/api-node/database
  ];
  return candidates.find(d => fs.existsSync(path.join(d, 'schema.sql'))) || null;
}

/** Drop statements that only make sense for a local root install. */
function cleanSql(sql) {
  // Remove whole statements (they may span several lines) up to their semicolon
  return sql.replace(/^\s*(CREATE DATABASE|USE |CREATE USER|GRANT |FLUSH PRIVILEGES)[^;]*;/gim, '');
}

const RETRY_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'ECONNRESET', 'PROTOCOL_CONNECTION_LOST'];
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Hosted databases (Railway's private network in particular) can take a few
    seconds to become reachable after the container starts, so keep trying. */
async function bootstrap() {
  const attempts = Number(process.env.DB_CONNECT_ATTEMPTS) || 20;
  for (let i = 1; i <= attempts; i++) {
    try { return await bootstrapOnce(); }
    catch (err) {
      if (!RETRY_CODES.includes(err.code) || i === attempts) throw err;
      console.log(`[db] Not reachable yet (${err.code}); retrying in 3s (${i}/${attempts})...`);
      await sleep(3000);
    }
  }
}

async function bootstrapOnce() {
  const dbcfg = require('./dbconfig');
  const cfg = { host: dbcfg.host, port: dbcfg.port, user: dbcfg.user, password: dbcfg.password };
  const dbName = dbcfg.database;
  console.log(`[db] Connecting to ${cfg.host}:${cfg.port} as ${cfg.user}, database ${dbName}`);

  // 1. Make sure the database exists (needs a connection without a database selected)
  const admin = await mysql.createConnection(cfg);
  try {
    await admin.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (err) {
    console.warn('[db] Could not create database (may already exist or user lacks rights):', err.message);
  } finally { await admin.end(); }

  // 2. Load the schema and seed data if the tables are missing
  const conn = await mysql.createConnection({ ...cfg, database: dbName, multipleStatements: true });
  try {
    const [rows] = await conn.query("SHOW TABLES LIKE 'services'");
    if (rows.length) { console.log(`[db] Connected to ${dbName}; tables already exist.`); return; }

    const dir = findSqlDir();
    if (!dir) { console.error('[db] Tables are missing and no schema.sql was found to create them.'); return; }

    console.log(`[db] ${dbName} is empty. Creating tables from ${dir} ...`);
    await conn.query(cleanSql(fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8')));
    const seed = path.join(dir, 'seed.sql');
    if (fs.existsSync(seed)) {
      await conn.query(cleanSql(fs.readFileSync(seed, 'utf8')));
      console.log('[db] Sample data loaded (admin@barberfie.com / Password123).');
    }
    console.log('[db] Database ready.');
  } finally { await conn.end(); }
}

module.exports = { bootstrap };
