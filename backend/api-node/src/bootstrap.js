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

async function bootstrap() {
  const cfg = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'barberfie',
    password: process.env.DB_PASSWORD || ''
  };
  const dbName = process.env.DB_NAME || 'barberfie';

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
