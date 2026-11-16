// npm run test:scan
// Simulates the whole RFID desk against the REAL database through the real API:
// member scan -> book scan (issue) -> book scan (return) -> late return fine ->
// rejected members -> unknown tag, and more. Prints PASS / FAIL for each step.
// Uses its own TEST member and copy (UIDs FE:ED:..) and deletes them at the end.
const { pool } = require('../src/db');
const { startServer, stopServer, api, check, summary } = require('./test-utils');

const MEMBER_UID = 'FE:ED:00:01'; // TEST active student
const BLOCKED_UID = 'FE:ED:00:02'; // TEST blocked student
const COPY_TAG = 'FE:ED:00:10'; // TEST copy of book 1
const UNKNOWN_UID = 'FE:ED:99:99'; // not in any table
const RUN = 'test-' + Date.now().toString(36); // device ids of this run start with this

let scansSent = 0;
async function scan(uid, device) {
  scansSent++;
  return api('POST', '/api/scan', { uid, device_id: `${RUN}-${device}` });
}

async function one(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0];
}

// Remove everything the test created (children first because of FK RESTRICT).
async function cleanup() {
  const ids = `SELECT member_id FROM members WHERE rfid_uid IN ('${MEMBER_UID}', '${BLOCKED_UID}')`;
  const copy = `SELECT copy_id FROM book_copies WHERE rfid_tag = '${COPY_TAG}'`;
  await pool.query(
    `DELETE f FROM fines f JOIN issues i ON i.issue_id = f.issue_id
     WHERE i.member_id IN (${ids}) OR i.copy_id IN (${copy})`
  );
  await pool.query(`DELETE FROM issues WHERE member_id IN (${ids}) OR copy_id IN (${copy})`);
  await pool.query(`DELETE FROM book_copies WHERE rfid_tag = '${COPY_TAG}'`);
  await pool.query(`DELETE FROM members WHERE rfid_uid IN ('${MEMBER_UID}', '${BLOCKED_UID}')`);
  await pool.query(`DELETE FROM scan_logs WHERE device_id LIKE 'test-%' OR uid IN ('${UNKNOWN_UID}')`);
}

async function main() {
  await cleanup(); // in case an earlier run crashed half-way
  await pool.query(
    `INSERT INTO members (prn, name, email, department, member_type, rfid_uid, max_books, status) VALUES
     ('TEST-0001', 'Test Active Student',  'test.active@college.edu.in',  'CS', 'student', ?, 3, 'active'),
     ('TEST-0002', 'Test Blocked Student', 'test.blocked@college.edu.in', 'IT', 'student', ?, 3, 'blocked')`,
    [MEMBER_UID, BLOCKED_UID]
  );
  await pool.query("INSERT INTO book_copies (book_id, rfid_tag, shelf_location) VALUES (1, ?, 'TEST')", [COPY_TAG]);
  const member = await one('SELECT member_id FROM members WHERE rfid_uid = ?', [MEMBER_UID]);
  const copy = await one('SELECT copy_id FROM book_copies WHERE rfid_tag = ?', [COPY_TAG]);
  // (Aiven runs MySQL in ANSI mode: strings must use 'single quotes')
  const { due14 } = await one(`SELECT DATE_FORMAT(CURDATE() + INTERVAL 14 DAY, '%Y-%m-%d') AS due14`);

  await startServer();
  console.log('Scan flow test (device ids start with ' + RUN + ')\n');

  // 1. member card
  let r = await scan('fe:ed:00:01', 'A'); // lower case on purpose: the API must normalise it
  check('1. Member scan -> member_ready', r.body?.action === 'member_ready', JSON.stringify(r.body));
  check('   reply has member name', r.body?.member?.name === 'Test Active Student');

  // 2. book within 60 s on the same device -> issue
  r = await scan(COPY_TAG, 'A');
  check('2. Book scan within 60 s -> ISSUE', r.body?.action === 'issue', JSON.stringify(r.body));
  check('   due date is today + 14 days', r.body?.due_date === due14, `got ${r.body?.due_date}, expected ${due14}`);
  let row = await one('SELECT status FROM book_copies WHERE copy_id = ?', [copy.copy_id]);
  check('   DB: copy status is issued', row.status === 'issued', row.status);
  row = await one('SELECT COUNT(*) AS n FROM issues WHERE copy_id = ? AND return_date IS NULL', [copy.copy_id]);
  check('   DB: one open issue row', row.n === 1, 'open issues: ' + row.n);

  // 3. same book again -> return, on time, no fine
  r = await scan(COPY_TAG, 'A');
  check('3. Same book again -> RETURN', r.body?.action === 'return', JSON.stringify(r.body));
  check('   on time -> no fine', r.body?.fine === null, JSON.stringify(r.body?.fine));
  row = await one('SELECT status FROM book_copies WHERE copy_id = ?', [copy.copy_id]);
  check('   DB: copy status back to available', row.status === 'available', row.status);

  // 4. a ready member on ANOTHER device does not count
  await scan(MEMBER_UID, 'B');
  r = await scan(COPY_TAG, 'C');
  check('4. Member on device B, book on device C -> INFO (no issue)', r.body?.action === 'info', JSON.stringify(r.body));

  // 5. the window comes from scan_logs: make the member scan 61 s old in the table
  r = await scan(MEMBER_UID, 'D');
  await pool.query('UPDATE scan_logs SET scanned_at = NOW() - INTERVAL 61 SECOND WHERE log_id = ?', [r.body.log_id]);
  r = await scan(COPY_TAG, 'D');
  check('5. Member scan older than 60 s (in scan_logs) -> INFO', r.body?.action === 'info', JSON.stringify(r.body));

  // 6. ready member followed by a REJECTED member on the same device -> book must not be issued
  await scan(MEMBER_UID, 'E');
  await scan(BLOCKED_UID, 'E');
  r = await scan(COPY_TAG, 'E');
  check('6. Latest member on device was rejected -> INFO (no issue)', r.body?.action === 'info', JSON.stringify(r.body));

  // 7. borrow limit (max_books = 1 for this check)
  await pool.query('UPDATE members SET max_books = 1 WHERE member_id = ?', [member.member_id]);
  await scan(MEMBER_UID, 'F');
  await scan(COPY_TAG, 'F'); // issue -> now 1 of 1
  r = await scan(MEMBER_UID, 'F');
  check('7. Member at borrow limit -> rejected', r.body?.action === 'rejected' && /limit reached/.test(r.body?.message), r.body?.message);
  await scan(COPY_TAG, 'F'); // return it again
  await pool.query('UPDATE members SET max_books = 3 WHERE member_id = ?', [member.member_id]);

  // 8. late return creates a fine (pretend the book was issued 20 days ago, due 6 days ago)
  await scan(MEMBER_UID, 'G');
  r = await scan(COPY_TAG, 'G');
  const issueId = r.body?.issue_id;
  await pool.query(
    'UPDATE issues SET issue_date = NOW() - INTERVAL 20 DAY, due_date = CURDATE() - INTERVAL 6 DAY WHERE issue_id = ?',
    [issueId]
  );
  r = await scan(COPY_TAG, 'G');
  check('8. Late return -> RETURN with fine', r.body?.action === 'return' && r.body?.fine !== null, JSON.stringify(r.body));
  check('   fine = 6 days x Rs 2 = 12.00', r.body?.fine?.amount === '12.00', JSON.stringify(r.body?.fine));
  row = await one('SELECT amount, status FROM fines WHERE issue_id = ?', [issueId]);
  check('   DB: unpaid fine row of 12.00', row && row.amount === '12.00' && row.status === 'unpaid', JSON.stringify(row));
  const fineId = r.body?.fine?.fine_id;

  // 9. member with an unpaid fine cannot borrow
  r = await scan(MEMBER_UID, 'H');
  check('9. Member with unpaid fine -> rejected', r.body?.action === 'rejected' && /unpaid fine/.test(r.body?.message), r.body?.message);

  // 10. pay the fine -> can borrow again
  r = await api('POST', `/api/fines/${fineId}/pay`);
  check('10. Pay fine -> 200 and status paid', r.status === 200 && r.body?.fine?.status === 'paid', JSON.stringify(r.body));
  r = await scan(MEMBER_UID, 'H');
  check('    after paying -> member_ready again', r.body?.action === 'member_ready', r.body?.message);

  // 11. blocked member
  r = await scan(BLOCKED_UID, 'I');
  check('11. Blocked member -> rejected', r.body?.action === 'rejected' && /blocked/.test(r.body?.message), r.body?.message);

  // 12. unknown tag
  r = await scan(UNKNOWN_UID, 'J');
  check('12. Unknown tag -> unregistered', r.body?.action === 'unregistered', JSON.stringify(r.body));

  // 13. bad input is refused before anything is written
  r = await api('POST', '/api/scan', { uid: 'hello', device_id: `${RUN}-K` });
  check('13. Invalid UID -> 400 error', r.status === 400, JSON.stringify(r.body));
  r = await api('POST', '/api/scan', { uid: MEMBER_UID });
  check('    missing device_id -> 400 error', r.status === 400, JSON.stringify(r.body));

  // 14. every scan was logged and every log row got its final action
  row = await one("SELECT COUNT(*) AS n, SUM(action = 'pending') AS pending FROM scan_logs WHERE device_id LIKE ?", [RUN + '-%']);
  check(`14. scan_logs has all ${scansSent} scans`, row.n === scansSent, `logged ${row.n}`);
  check('    no log row left as pending', Number(row.pending) === 0, `pending: ${row.pending}`);
}

main()
  .catch((err) => {
    check('test crashed', false, err.stack);
  })
  .finally(async () => {
    await stopServer();
    await cleanup();
    console.log('(test rows removed)');
    await pool.end();
    process.exit(summary() ? 0 : 1);
  });
