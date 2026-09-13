'use strict';
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'barberfie',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'barberfie',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,      // return DATE/TIME as 'YYYY-MM-DD' / 'HH:MM:SS' strings
  decimalNumbers: true    // return DECIMAL as JS numbers
});

/** Run a query and return rows. */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Run a query and return the first row or null. */
async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { pool, query, one };
