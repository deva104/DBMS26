// helpers.js - shared helpers: input validation, RFID UID format,
// and the central error handler that turns MySQL errors into friendly messages.
const { pool } = require('./db');

// Create an error that the error handler sends back as { error: message }.
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ---------- input validation ----------

// Positive whole number from the URL or body, e.g. /api/books/7
function toId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw httpError(400, `${name} must be a positive whole number`);
  return n;
}

// Trimmed text field from the request body. Returns null when empty and not required.
function text(body, field, { required = false, max = 255 } = {}) {
  const value = body[field];
  if (value === undefined || value === null || String(value).trim() === '') {
    if (required) throw httpError(400, `${field} is required`);
    return null;
  }
  const s = String(value).trim();
  if (s.length > max) throw httpError(400, `${field} must be at most ${max} characters`);
  return s;
}

// Optional whole number field (e.g. pub_year, max_books).
function int(body, field, { required = false } = {}) {
  const value = body[field];
  if (value === undefined || value === null || value === '') {
    if (required) throw httpError(400, `${field} is required`);
    return null;
  }
  const n = Number(value);
  if (!Number.isInteger(n)) throw httpError(400, `${field} must be a whole number`);
  return n;
}

// Field that must be one of a fixed list (matches the ENUM columns).
function oneOf(body, field, allowed, fallback) {
  const value = body[field] === undefined || body[field] === '' ? fallback : body[field];
  if (!allowed.includes(value)) throw httpError(400, `${field} must be one of: ${allowed.join(', ')}`);
  return value;
}

// ---------- RFID UIDs ----------

// Web NFC gives UIDs like "04:a1:b2:c3:d4:e5:f6"; people may type "04A1B2C3".
// We store every UID the same way: upper-case hex pairs joined by ':'.
function normalizeUid(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const s = String(raw).trim();
  if (!/^[0-9A-Fa-f:\-\s]+$/.test(s)) throw httpError(400, 'UID must be hex bytes like 04:AA:00:01');
  const hex = s.replace(/[:\-\s]/g, '').toUpperCase();
  if (hex.length % 2 !== 0 || hex.length < 4 || hex.length > 20) {
    throw httpError(400, 'UID must be 2 to 10 hex bytes like 04:AA:00:01');
  }
  return hex.match(/../g).join(':');
}

// One UID must not be BOTH a member card and a book tag (UNIQUE works only inside one table).
async function assertUidFree(uid, { memberId = 0, copyId = 0 } = {}) {
  const [rows] = await pool.execute(
    `SELECT 'member card' AS used_by FROM members WHERE rfid_uid = ? AND member_id <> ?
     UNION ALL
     SELECT 'book copy' FROM book_copies WHERE rfid_tag = ? AND copy_id <> ?`,
    [uid, memberId, uid, copyId]
  );
  if (rows.length > 0) throw httpError(409, `UID ${uid} is already used by a ${rows[0].used_by}`);
}

// ---------- central error handler ----------

// Delete blocked by ON DELETE RESTRICT -> explain which history is in the way.
const FK_MESSAGES = {
  fk_books_category: 'This category still has books. Move or delete those books first.',
  fk_copies_book: 'This book still has copies. Delete its copies first.',
  fk_issues_copy: 'This copy has loan history, so it cannot be deleted. Mark it as lost instead.',
  fk_issues_member: 'This member has loan history, so they cannot be deleted. Block them instead.',
  fk_fines_issue: 'This loan has a fine attached, so it cannot be deleted.',
};

// CHECK constraint names (see schema.sql) -> readable message.
const CHECK_MESSAGES = {
  chk_books_year: 'pub_year must be between 1900 and 2100',
  chk_copies_tag: 'rfid_tag must look like 04:BB:00:01',
  chk_members_dept: 'department must be one of ENTC, CS, IT, Mech, Civil',
  chk_members_max: 'max_books must be between 1 and 10',
  chk_members_email: 'email is not a valid address',
  chk_members_phone: 'phone must be a 10-digit mobile number starting with 6-9',
  chk_members_uid: 'rfid_uid must look like 04:AA:00:01',
  chk_fines_amount: 'fine amount must be more than 0',
  chk_fines_paid: 'a paid fine needs paid_on, an unpaid fine must not have it',
};

// Express calls this whenever a route throws. Our own errors carry .status;
// MySQL errors carry .code; anything else is a 500.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.status) return res.status(err.status).json({ error: err.message });

  const sqlMsg = err.sqlMessage || '';
  switch (err.code) {
    case 'ER_ROW_IS_REFERENCED_2': {
      // constraint name is quoted with ` normally and with " in ANSI mode (Aiven)
      const fk = (sqlMsg.match(/CONSTRAINT [`"](\w+)[`"]/) || [])[1];
      return res.status(409).json({ error: FK_MESSAGES[fk] || 'Cannot delete: other records still use this one.' });
    }
    case 'ER_NO_REFERENCED_ROW_2':
      return res.status(400).json({ error: 'The linked record does not exist (check the category / book / member id).' });
    case 'ER_DUP_ENTRY': {
      const m = sqlMsg.match(/Duplicate entry '(.*)' for key '(?:\w+\.)?(\w+)'/);
      return res.status(409).json({ error: m ? `"${m[1]}" already exists (${m[2]} must be unique)` : 'Duplicate value' });
    }
    case 'ER_CHECK_CONSTRAINT_VIOLATED': {
      const chk = (sqlMsg.match(/'(\w+)'/) || [])[1];
      return res.status(400).json({ error: CHECK_MESSAGES[chk] || `Value not allowed (${chk})` });
    }
    case 'ER_DATA_TOO_LONG':
    case 'WARN_DATA_TRUNCATED':
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
      return res.status(400).json({ error: 'Invalid value: ' + sqlMsg });
  }

  console.error(err);
  res.status(500).json({ error: 'Server error: ' + (sqlMsg || err.message) });
}

module.exports = { httpError, toId, text, int, oneOf, normalizeUid, assertUidFree, errorHandler };
