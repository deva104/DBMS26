// npm run db:indexes
// 1. EXPLAIN the hot queries  -> db/outputs/explain_before.txt
// 2. run db/indexes.sql
// 3. EXPLAIN them again       -> db/outputs/explain_after.txt
// Needs a fresh schema (npm run db:setup) so the "before" really has no extra indexes.
const fs = require('fs');
const path = require('path');
const { openScriptConnection, formatTable } = require('./lib');

const OUT_DIR = path.join(__dirname, '..', 'db', 'outputs');
const OUR_INDEXES = ['idx_issues_member_return', 'idx_issues_return_due', 'idx_scan_device_time'];

// The queries the indexes are meant for (same shape as in the app code).
const EXPLAINS = [
  {
    title: 'A. Books member 1 currently holds (borrow-limit check, runs on every issue)',
    sql: 'SELECT COUNT(*) AS open_issues FROM issues WHERE member_id = 1 AND return_date IS NULL',
  },
  {
    title: 'B. Overdue report',
    sql: 'SELECT issue_id, copy_id, member_id, due_date FROM issues WHERE return_date IS NULL AND due_date < CURDATE()',
  },
  {
    title: 'C. Books due in the next 3 days (reminders)',
    sql: 'SELECT issue_id, member_id, due_date FROM issues WHERE return_date IS NULL AND due_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 3 DAY',
  },
  {
    title: 'D. 60-second issue window (runs on every book scan)',
    sql: "SELECT log_id, uid, action FROM scan_logs WHERE device_id = 'desk-pc-01' AND scan_type = 'member' AND scanned_at >= NOW() - INTERVAL 60 SECOND ORDER BY scanned_at DESC LIMIT 1",
  },
  {
    title: 'E. Member card lookup by RFID (UNIQUE rfid_uid already indexed)',
    sql: "SELECT member_id, name FROM members WHERE rfid_uid = '04:AA:00:01'",
  },
  {
    title: 'F. Book copy lookup by RFID (UNIQUE rfid_tag already indexed)',
    sql: "SELECT copy_id, status FROM book_copies WHERE rfid_tag = '04:BB:00:01'",
  },
];

async function explainAll(conn, heading) {
  // refresh table statistics so the optimizer sees the real row counts
  await conn.query('ANALYZE TABLE issues, scan_logs, members, book_copies');
  let text = `${heading}\nGenerated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n`;
  const summary = [];
  for (const e of EXPLAINS) {
    const [rows] = await conn.query('EXPLAIN ' + e.sql);
    const [tree] = await conn.query('EXPLAIN FORMAT=TREE ' + e.sql);
    text += `\n${'='.repeat(78)}\n${e.title}\n${e.sql}\n\n${formatTable(rows)}\nPlan (FORMAT=TREE):\n${tree[0].EXPLAIN}\n`;
    summary.push({ query: e.title.slice(0, 2), type: rows[0].type, key: rows[0].key, rows: rows[0].rows, extra: rows[0].Extra });
  }
  return { text, summary };
}

async function main() {
  const conn = await openScriptConnection();
  try {
    const [existing] = await conn.query(
      `SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME IN (?)`,
      [OUR_INDEXES]
    );
    if (existing.length > 0) {
      console.log('These indexes already exist:', existing.map((r) => r.INDEX_NAME).join(', '));
      console.log('Run "npm run db:setup" first (re-creates the tables), then "npm run db:indexes".');
      process.exit(1);
    }

    fs.mkdirSync(OUT_DIR, { recursive: true });

    const before = await explainAll(conn, 'EXPLAIN output BEFORE creating db/indexes.sql');
    fs.writeFileSync(path.join(OUT_DIR, 'explain_before.txt'), before.text);
    console.log('Saved db/outputs/explain_before.txt');

    await conn.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'indexes.sql'), 'utf8'));
    console.log('OK   db/indexes.sql (3 indexes created)');

    const after = await explainAll(conn, 'EXPLAIN output AFTER creating db/indexes.sql');
    fs.writeFileSync(path.join(OUT_DIR, 'explain_after.txt'), after.text);
    console.log('Saved db/outputs/explain_after.txt\n');

    console.log('BEFORE'); console.log(formatTable(before.summary));
    console.log('AFTER'); console.log(formatTable(after.summary));
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.code || '', err.sqlMessage || err.message);
  process.exit(1);
});
