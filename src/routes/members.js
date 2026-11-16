// /api/members - CRUD for library members (students and faculty)
const router = require('express').Router();
const { pool } = require('../db');
const { httpError, toId, text, int, oneOf, normalizeUid, assertUidFree } = require('../helpers');

// Read and check the fields of a member from the request body.
function readMember(body = {}) {
  const memberType = oneOf(body, 'member_type', ['student', 'faculty'], 'student');
  return {
    prn: text(body, 'prn', { required: true, max: 20 }),
    name: text(body, 'name', { required: true, max: 100 }),
    email: text(body, 'email', { required: true, max: 100 }),
    phone: text(body, 'phone', { max: 10 }),
    department: text(body, 'department', { required: true, max: 10 }),
    member_type: memberType,
    rfid_uid: normalizeUid(body.rfid_uid),
    // business rule: students may hold 3 books, faculty 5 (unless given explicitly)
    max_books: int(body, 'max_books') || (memberType === 'faculty' ? 5 : 3),
    status: oneOf(body, 'status', ['active', 'blocked'], 'active'),
  };
}

// GET /api/members?q=word  - list with books out and unpaid fines (correlated subqueries)
router.get('/', async (req, res) => {
  const like = '%' + (req.query.q || '') + '%';
  const [rows] = await pool.execute(
    `SELECT m.member_id, m.prn, m.name, m.email, m.phone, m.department, m.member_type,
            m.rfid_uid, m.max_books, m.status, m.joined_on,
            (SELECT COUNT(*) FROM issues i
              WHERE i.member_id = m.member_id AND i.return_date IS NULL) AS books_out,
            (SELECT COALESCE(SUM(f.amount), 0) FROM fines f
              JOIN issues i ON i.issue_id = f.issue_id
              WHERE i.member_id = m.member_id AND f.status = 'unpaid') AS unpaid_fines
     FROM members m
     WHERE m.name LIKE ? OR m.prn LIKE ? OR m.department LIKE ?
     ORDER BY m.member_id`,
    [like, like, like]
  );
  res.json(rows);
});

// GET /api/members/:id  - one member with current books and all fines
router.get('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [members] = await pool.execute('SELECT * FROM members WHERE member_id = ?', [id]);
  if (members.length === 0) throw httpError(404, 'Member not found');
  const [books] = await pool.execute(
    `SELECT i.issue_id, b.title, c.rfid_tag, i.issue_date, i.due_date
     FROM issues i
     JOIN book_copies c ON c.copy_id = i.copy_id
     JOIN books b       ON b.book_id = c.book_id
     WHERE i.member_id = ? AND i.return_date IS NULL
     ORDER BY i.due_date`,
    [id]
  );
  const [fines] = await pool.execute(
    `SELECT f.fine_id, f.amount, f.status, f.paid_on, b.title
     FROM fines f
     JOIN issues i      ON i.issue_id = f.issue_id
     JOIN book_copies c ON c.copy_id  = i.copy_id
     JOIN books b       ON b.book_id  = c.book_id
     WHERE i.member_id = ?
     ORDER BY f.fine_id`,
    [id]
  );
  res.json({ ...members[0], current_books: books, fines });
});

// POST /api/members
router.post('/', async (req, res) => {
  const m = readMember(req.body);
  if (m.rfid_uid) await assertUidFree(m.rfid_uid);
  const [result] = await pool.execute(
    `INSERT INTO members (prn, name, email, phone, department, member_type, rfid_uid, max_books, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [m.prn, m.name, m.email, m.phone, m.department, m.member_type, m.rfid_uid, m.max_books, m.status]
  );
  res.status(201).json({ member_id: result.insertId, ...m });
});

// PUT /api/members/:id
router.put('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const m = readMember(req.body);
  if (m.rfid_uid) await assertUidFree(m.rfid_uid, { memberId: id });
  const [result] = await pool.execute(
    `UPDATE members SET prn = ?, name = ?, email = ?, phone = ?, department = ?,
            member_type = ?, rfid_uid = ?, max_books = ?, status = ?
     WHERE member_id = ?`,
    [m.prn, m.name, m.email, m.phone, m.department, m.member_type, m.rfid_uid, m.max_books, m.status, id]
  );
  if (result.affectedRows === 0) throw httpError(404, 'Member not found');
  res.json({ member_id: id, ...m });
});

// DELETE /api/members/:id  (blocked by FK RESTRICT if the member ever borrowed)
router.delete('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [result] = await pool.execute('DELETE FROM members WHERE member_id = ?', [id]);
  if (result.affectedRows === 0) throw httpError(404, 'Member not found');
  res.json({ deleted: true, member_id: id });
});

module.exports = router;
