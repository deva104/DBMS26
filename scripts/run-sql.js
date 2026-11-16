// npm run db:setup  ->  node scripts/run-sql.js db/schema.sql db/seed.sql
// Runs each .sql file given on the command line against the Aiven database,
// then prints how many rows every table has.
const fs = require('fs');
const path = require('path');
const { openScriptConnection, formatTable } = require('./lib');

const TABLES = ['categories', 'books', 'book_copies', 'members', 'issues', 'fines', 'scan_logs'];

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.log('Usage: node scripts/run-sql.js file1.sql [file2.sql ...]');
    process.exit(1);
  }

  const conn = await openScriptConnection();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.resolve(file), 'utf8');
      await conn.query(sql); // the whole file in one go (multipleStatements)
      console.log('OK  ', file);
    }

    // row count of every table, as a quick check
    const counts = [];
    for (const t of TABLES) {
      const [[row]] = await conn.query('SELECT COUNT(*) AS n FROM ??', [t]);
      counts.push({ table: t, rows: row.n });
    }
    console.log('\n' + formatTable(counts));
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.code || '', err.sqlMessage || err.message);
  process.exit(1);
});
