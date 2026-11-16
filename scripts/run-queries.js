// npm run db:queries
// Runs the 7 report queries from db/queries.sql against Aiven and saves the
// results as readable tables in db/outputs/query_results.txt.
const fs = require('fs');
const path = require('path');
const { openScriptConnection, formatTable } = require('./lib');
const { loadReports } = require('../src/reports');

const MEMBER_ID = 1; // used by Q4 (a member's current books)

async function main() {
  const reports = loadReports();
  const conn = await openScriptConnection();
  let text =
    'Results of db/queries.sql\n' +
    `Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n` +
    `Q4 is run for member_id = ${MEMBER_ID}\n`;
  try {
    await conn.query('SET @member_id = ?', [MEMBER_ID]);
    for (const r of reports) {
      const [rows] = await conn.query(r.sql);
      text += `\n${'='.repeat(78)}\nQ${r.no}. ${r.title}\n${r.notes}\n\n${r.sql};\n\n${formatTable(rows)}`;
      console.log(`Q${r.no} ${r.name.padEnd(16)} ${rows.length} rows`);
    }
  } finally {
    await conn.end();
  }
  const out = path.join(__dirname, '..', 'db', 'outputs', 'query_results.txt');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log('Saved db/outputs/query_results.txt');
}

main().catch((err) => {
  console.error('FAILED:', err.code || '', err.sqlMessage || err.message);
  process.exit(1);
});
