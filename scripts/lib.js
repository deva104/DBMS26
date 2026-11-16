// lib.js - small helpers shared by the scripts in this folder.
const mysql = require('mysql2/promise');
const { connectionConfig } = require('../src/db');

// One connection that may run a whole .sql file at once (multipleStatements).
async function openScriptConnection() {
  const conn = await mysql.createConnection(connectionConfig({ multipleStatements: true }));
  await conn.query("SET time_zone = '+05:30'");
  return conn;
}

// Turn an array of row objects into a plain text table like the mysql client prints:
// +----+-------+
// | id | name  |
// +----+-------+
function formatTable(rows) {
  if (!rows || rows.length === 0) return '(no rows)\n';
  const cols = Object.keys(rows[0]);
  const text = (v) => (v === null || v === undefined ? 'NULL' : String(v));
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => text(r[c]).length)));
  const line = '+' + widths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
  const fmt = (vals) => '| ' + vals.map((v, i) => v.padEnd(widths[i])).join(' | ') + ' |';
  const out = [line, fmt(cols), line, ...rows.map((r) => fmt(cols.map((c) => text(r[c])))), line];
  return out.join('\n') + '\n' + rows.length + (rows.length === 1 ? ' row' : ' rows') + '\n';
}

module.exports = { openScriptConnection, formatTable };
