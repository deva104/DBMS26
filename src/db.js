// db.js - one shared MySQL connection pool for the whole app (mysql2/promise).
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Aiven requires SSL. On Render the CA certificate text is stored in the DB_CA
// env var; on a laptop we read it from ./ca.pem.
function readCA() {
  // DB_CA may be pasted with real line breaks or as one line with \n in it
  if (process.env.DB_CA) return process.env.DB_CA.replace(/\\n/g, '\n');
  const file = path.join(__dirname, '..', 'ca.pem');
  if (!fs.existsSync(file)) {
    throw new Error('No CA certificate: set the DB_CA env var or put ca.pem in the project folder');
  }
  return fs.readFileSync(file, 'utf8');
}

// Common connection settings (also used by the scripts/ folder).
function connectionConfig(extra = {}) {
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { ca: readCA(), rejectUnauthorized: true },
    timezone: '+05:30', // India time for JS <-> MySQL date conversion
    dateStrings: true, // give DATE / DATETIME back as plain 'YYYY-MM-DD hh:mm:ss' strings
    ...extra,
  };
}

const pool = mysql.createPool(connectionConfig({ connectionLimit: 5, waitForConnections: true }));

// Every new connection uses IST so NOW() and CURDATE() match Indian time.
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+05:30'");
});

module.exports = { pool, connectionConfig };
