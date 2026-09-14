'use strict';
const mysql = require('mysql2/promise');

const dbcfg = require('./dbconfig');

const pool = mysql.createPool({
  host: dbcfg.host,
  port: dbcfg.port,
  user: dbcfg.user,
  password: dbcfg.password,
  database: dbcfg.database,
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
