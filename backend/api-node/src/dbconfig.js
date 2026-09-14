'use strict';
/* ==========================================================
   BARBERFIE - database connection settings
   Either set DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
   individually, or set one DB_URL such as
     mysql://user:password@host:3306/dbname
   (Railway calls this MYSQL_PUBLIC_URL or MYSQL_URL).
   Individual DB_* values override parts of the URL.
   ========================================================== */

function fromUrl(raw) {
  if (!raw) return {};
  try {
    const u = new URL(raw);
    return {
      host: u.hostname || undefined,
      port: u.port ? Number(u.port) : undefined,
      user: u.username ? decodeURIComponent(u.username) : undefined,
      password: u.password ? decodeURIComponent(u.password) : undefined,
      database: u.pathname && u.pathname.length > 1 ? decodeURIComponent(u.pathname.slice(1)) : undefined
    };
  } catch (e) {
    console.warn('[db] DB_URL is not a valid URL; ignoring it.');
    return {};
  }
}

const url = fromUrl(process.env.DB_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL || process.env.DATABASE_URL);

module.exports = {
  host: process.env.DB_HOST || url.host || '127.0.0.1',
  port: Number(process.env.DB_PORT) || url.port || 3306,
  user: process.env.DB_USER || url.user || 'barberfie',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (url.password || ''),
  database: process.env.DB_NAME || url.database || 'barberfie'
};
