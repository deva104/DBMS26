// POST /api/scan  { uid, device_id }  -  the heart of the RFID system.
//
// What a scan does (decided by what the UID belongs to):
//   member card        -> check borrowing rules -> "member_ready" or "rejected"
//   copy that is out   -> RETURN (transaction; fine if late)
//   copy on the shelf  -> if the same device scanned a ready member in the last
//                         60 s -> ISSUE (transaction), otherwise just show INFO
//   anything else      -> "unregistered"
// Every scan is first written to scan_logs, then that row is updated with the result.
const router = require('express').Router();
const { pool } = require('../db');
const { httpError, normalizeUid } = require('../helpers');

// Business rules (also written as plain numbers inside the SQL below):
//   loan period = 14 days, fine = Rs 2 per late day, issue window = 60 seconds.

router.post('/', async (req, res) => {
  const body = req.body || {};
  const uid = normalizeUid(body.uid);
  if (!uid) throw httpError(400, 'uid is required');
  const deviceId = String(body.device_id || '').trim();
  if (!/^[A-Za-z0-9_-]{3,40}$/.test(deviceId)) {
    throw httpError(400, 'device_id is required (3-40 letters, digits, - or _)');
  }

  // 1. Log the scan FIRST, so every scan is recorded even if a later step fails.
  const [logged] = await pool.execute('INSERT INTO scan_logs (uid, device_id) VALUES (?, ?)', [uid, deviceId]);
  const logId = logged.insertId;

  let result;
  try {
    result = await handleScan(uid, deviceId, logId);
  } catch (err) {
    await saveLog(logId, 'unknown', 'rejected', 'Server error while processing this scan');
    throw err;
  }

  // 2. Store the outcome on the same log row.
  await saveLog(logId, result.scan_type, result.action, result.message);
  res.json({ log_id: logId, uid, ...result });
});

async function saveLog(logId, scanType, action, message) {
  await pool.execute('UPDATE scan_logs SET scan_type = ?, action = ?, message = ? WHERE log_id = ?', [
    scanType,
    action,
    String(message).slice(0, 255),
    logId,
  ]);
}

// Decide what kind of tag this is and what to do with it.
async function handleScan(uid, deviceId, logId) {
  // Is it a member card? (UNIQUE index on rfid_uid -> one-row lookup)
  const [members] = await pool.execute('SELECT member_id FROM members WHERE rfid_uid = ?', [uid]);
  if (members.length > 0) return memberScan(members[0].member_id);

  // Is it a book copy tag? (UNIQUE index on rfid_tag)
  const [copies] = await pool.execute(
    `SELECT c.copy_id, c.rfid_tag, c.status, c.shelf_location, b.book_id, b.title, b.author
     FROM book_copies c JOIN books b ON b.book_id = c.book_id
     WHERE c.rfid_tag = ?`,
    [uid]
  );
  if (copies.length === 0) {
    return { scan_type: 'unknown', action: 'unregistered', message: `Unregistered tag ${uid}` };
  }
  const copy = copies[0];

  if (copy.status === 'issued') return returnCopy(copy);
  if (copy.status === 'lost') return bookInfo(copy, 'This copy is marked LOST. ');

  // Copy is on the shelf: was a member scanned on THIS device in the last 60 seconds?
  const memberId = await findReadyMember(deviceId, logId);
  if (memberId) return issueCopy(memberId, copy);
  return bookInfo(copy, '');
}

// ---------- member rules ----------

// Member row + how many books they hold + unpaid fine total.
// conn can be the pool or a transaction connection.
async function getMemberStatus(conn, memberId) {
  const [rows] = await conn.execute(
    `SELECT m.member_id, m.name, m.department, m.member_type, m.status, m.max_books,
            (SELECT COUNT(*) FROM issues i
              WHERE i.member_id = m.member_id AND i.return_date IS NULL) AS books_out,
            (SELECT COALESCE(SUM(f.amount), 0) FROM fines f
              JOIN issues i ON i.issue_id = f.issue_id
              WHERE i.member_id = m.member_id AND f.status = 'unpaid') AS unpaid_fines
     FROM members m
     WHERE m.member_id = ?`,
    [memberId]
  );
  return rows[0];
}

// The borrowing rule: status active AND books_out < max_books AND no unpaid fines.
// Returns null when the member may borrow, otherwise the reason.
function whyCannotBorrow(m) {
  if (m.status !== 'active') return 'member is blocked';
  if (Number(m.unpaid_fines) > 0) return `unpaid fine of Rs ${m.unpaid_fines}`;
  if (m.books_out >= m.max_books) return `limit reached (${m.books_out} of ${m.max_books} books)`;
  return null;
}

function memberJson(m) {
  return {
    member_id: m.member_id,
    name: m.name,
    department: m.department,
    member_type: m.member_type,
    books_out: m.books_out,
    max_books: m.max_books,
    unpaid_fines: m.unpaid_fines,
  };
}

function bookJson(copy) {
  return {
    copy_id: copy.copy_id,
    book_id: copy.book_id,
    title: copy.title,
    author: copy.author,
    rfid_tag: copy.rfid_tag,
    shelf_location: copy.shelf_location,
  };
}

// Member card scanned.
async function memberScan(memberId) {
  const m = await getMemberStatus(pool, memberId);
  const reason = whyCannotBorrow(m);
  if (reason) {
    return { scan_type: 'member', action: 'rejected', message: `${m.name} - cannot borrow: ${reason}`, member: memberJson(m) };
  }
  return {
    scan_type: 'member',
    action: 'member_ready',
    message: `${m.name} - ready to issue (${m.books_out} of ${m.max_books} books out). Scan a book within 60 s.`,
    member: memberJson(m),
  };
}

// The 60-second window is read from the scan_logs TABLE (not server memory),
// so it still works after a server restart. Uses index (device_id, scanned_at).
// We look at the LATEST member scan on this device: if that member was
// rejected, an older "ready" member must not get the book.
async function findReadyMember(deviceId, currentLogId) {
  const [rows] = await pool.execute(
    `SELECT s.log_id, s.action, m.member_id
     FROM scan_logs s
     JOIN members m ON m.rfid_uid = s.uid
     WHERE s.device_id = ?
       AND s.scan_type = 'member'
       AND s.log_id < ?
       AND s.scanned_at >= NOW() - INTERVAL 60 SECOND
     ORDER BY s.scanned_at DESC, s.log_id DESC
     LIMIT 1`,
    [deviceId, currentLogId]
  );
  if (rows.length > 0 && rows[0].action === 'member_ready') return rows[0].member_id;
  return null;
}

// ---------- ISSUE (transaction) ----------
async function issueCopy(memberId, copy) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the copy row: if two phones scan the same book at once, the second waits here.
    const [[c]] = await conn.execute('SELECT status FROM book_copies WHERE copy_id = ? FOR UPDATE', [copy.copy_id]);
    // Lock the member row so two parallel issues cannot both pass the limit check.
    await conn.execute('SELECT member_id FROM members WHERE member_id = ? FOR UPDATE', [memberId]);

    // Check the rules again inside the transaction (they may have changed since the card scan).
    const m = await getMemberStatus(conn, memberId);
    const reason = c.status !== 'available' ? 'copy is no longer available' : whyCannotBorrow(m);
    if (reason) {
      await conn.rollback();
      return {
        scan_type: 'book',
        action: 'rejected',
        message: `Cannot issue "${copy.title}" to ${m.name}: ${reason}`,
        member: memberJson(m),
        book: bookJson(copy),
      };
    }

    // Loan period 14 days.
    const [ins] = await conn.execute(
      `INSERT INTO issues (copy_id, member_id, issue_date, due_date)
       VALUES (?, ?, NOW(), CURDATE() + INTERVAL 14 DAY)`,
      [copy.copy_id, memberId]
    );
    await conn.execute("UPDATE book_copies SET status = 'issued' WHERE copy_id = ?", [copy.copy_id]);
    const [[issue]] = await conn.execute('SELECT issue_id, issue_date, due_date FROM issues WHERE issue_id = ?', [
      ins.insertId,
    ]);

    await conn.commit(); // both changes become visible together

    m.books_out += 1;
    return {
      scan_type: 'book',
      action: 'issue',
      message: `Issued "${copy.title}" to ${m.name}. Due ${toIndianDate(issue.due_date)}`,
      member: memberJson(m),
      book: bookJson(copy),
      issue_id: issue.issue_id,
      due_date: issue.due_date,
    };
  } catch (err) {
    await conn.rollback(); // undo everything if any statement failed
    throw err;
  } finally {
    conn.release();
  }
}

// ---------- RETURN (transaction) ----------
async function returnCopy(copy) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute('SELECT status FROM book_copies WHERE copy_id = ? FOR UPDATE', [copy.copy_id]);
    const [open] = await conn.execute(
      `SELECT i.issue_id, i.member_id, i.due_date, m.name
       FROM issues i JOIN members m ON m.member_id = i.member_id
       WHERE i.copy_id = ? AND i.return_date IS NULL
       FOR UPDATE`,
      [copy.copy_id]
    );

    if (open.length === 0) {
      // status said "issued" but there is no open loan - repair the status
      await conn.execute("UPDATE book_copies SET status = 'available' WHERE copy_id = ?", [copy.copy_id]);
      await conn.commit();
      return { scan_type: 'book', action: 'info', message: `"${copy.title}" had no open loan, marked available`, book: bookJson(copy) };
    }
    const loan = open[0];

    await conn.execute('UPDATE issues SET return_date = NOW() WHERE issue_id = ?', [loan.issue_id]);
    await conn.execute("UPDATE book_copies SET status = 'available' WHERE copy_id = ?", [copy.copy_id]);

    // Fine: Rs 2 for every day after the due date. The SELECT returns a row
    // only when the book is late, so on-time returns insert nothing.
    const [fineIns] = await conn.execute(
      `INSERT INTO fines (issue_id, amount)
       SELECT issue_id, DATEDIFF(DATE(return_date), due_date) * 2
       FROM issues
       WHERE issue_id = ? AND DATE(return_date) > due_date`,
      [loan.issue_id]
    );

    let fine = null;
    if (fineIns.affectedRows === 1) {
      const [[f]] = await conn.execute(
        `SELECT f.fine_id, f.amount, f.status, DATEDIFF(DATE(i.return_date), i.due_date) AS days_late
         FROM fines f JOIN issues i ON i.issue_id = f.issue_id
         WHERE f.issue_id = ?`,
        [loan.issue_id]
      );
      fine = f;
    }

    await conn.commit();

    const lateText = fine ? `Late by ${fine.days_late} days, fine Rs ${fine.amount}` : 'On time.';
    return {
      scan_type: 'book',
      action: 'return',
      message: `Returned "${copy.title}" from ${loan.name}. ${lateText}`,
      member: { member_id: loan.member_id, name: loan.name },
      book: bookJson(copy),
      issue_id: loan.issue_id,
      due_date: loan.due_date,
      fine,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---------- INFO ----------
async function bookInfo(copy, prefix) {
  const [[n]] = await pool.execute(
    `SELECT COUNT(*) AS total, COALESCE(SUM(status = 'available'), 0) AS available
     FROM book_copies WHERE book_id = ?`,
    [copy.book_id]
  );
  return {
    scan_type: 'book',
    action: 'info',
    message:
      `${prefix}"${copy.title}" by ${copy.author} - shelf ${copy.shelf_location || '?'}` +
      ` - ${Number(n.available)} of ${n.total} copies available`,
    book: { ...bookJson(copy), status: copy.status, available: Number(n.available), total: n.total },
  };
}

// '2026-11-30' -> '30-11-2026'
function toIndianDate(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd).slice(0, 10).split('-');
  return `${d}-${m}-${y}`;
}

module.exports = router;
