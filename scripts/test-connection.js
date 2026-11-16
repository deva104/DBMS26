// npm run db:test - checks that we can reach Aiven MySQL over SSL.
// Also creates the database named in DB_NAME if it does not exist yet.
const mysql = require('mysql2/promise');
const { connectionConfig } = require('../src/db');

async function main() {
  const dbName = process.env.DB_NAME;
  // connect without selecting a database first, so we can create it if needed
  const conn = await mysql.createConnection(connectionConfig({ database: undefined }));
  await conn.query("SET time_zone = '+05:30'");
  await conn.query('CREATE DATABASE IF NOT EXISTS ??', [dbName]);
  await conn.query('USE ??', [dbName]);

  const [[info]] = await conn.query(
    'SELECT VERSION() AS version, DATABASE() AS db, NOW() AS now_ist, @@time_zone AS tz'
  );
  const [[ssl]] = await conn.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");

  console.log('Connected to MySQL OK');
  console.log('  host      :', process.env.DB_HOST + ':' + process.env.DB_PORT);
  console.log('  version   :', info.version);
  console.log('  database  :', info.db);
  console.log('  time zone :', info.tz, '-> NOW() =', info.now_ist);
  console.log('  SSL cipher:', ssl.Value || '(none - NOT encrypted!)');
  await conn.end();
}

main().catch((err) => {
  // never print the password, even if it ended up inside an error message
  const msg = String(err.message).split(process.env.DB_PASSWORD || '\u0000').join('***');
  console.error('Connection FAILED:', err.code || '', msg);
  if (String(process.env.DB_HOST).includes('://')) {
    console.error('Hint: DB_HOST must be only the host name, not the full mysql:// URI.');
  }
  process.exit(1);
});
