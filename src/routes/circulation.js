// Circulation lists: /api/issues and /api/fines (+ paying a fine)
const router = require('express').Router();
const { pool } = require('../db');
const { httpError, toId } = require('../helpers');

// Fixed WHERE clauses chosen by ?status= (never built from user text).
const ISSUE_FILTERS = {
  open: 'i.return_date IS NULL',
  overdue: 'i.return_date IS NULL AND i.due_date < CURDATE()',
  all: '1 = 1',
};

// GET /api/issues?status=open|overdue|all
router.get('/issues', async (req, res) => {
  const status = req.query.status || 'open';
  const where = ISSUE_FILTERS[status];
  if (!where) throw httpError(400, 'status must be open, overdue or all');
  const order = status === 'all' ? 'i.issue_date DESC' : 'i.due_date';

  const [rows] = await pool.execute(
    `SELECT i.issue_id, i.copy_id, c.rfid_tag, b.title,
            i.member_id, m.name AS member, m.department,
            i.issue_date, i.due_date, i.return_date,
            CASE WHEN i.return_date IS NOT NULL THEN 'returned'
                 WHEN i.due_date < CURDATE()    THEN 'overdue'
                 ELSE 'out' END AS state,
            CASE WHEN i.return_date IS NULL AND i.due_date < CURDATE()
                 THEN DATEDIFF(CURDATE(), i.due_date) ELSE 0 END AS days_late,
            f.fine_id, f.amount AS fine, f.status AS fine_status
     FROM issues i
     JOIN members m     ON m.member_id = i.member_id
     JOIN book_copies c ON c.copy_id   = i.copy_id
     JOIN books b       ON b.book_id   = c.book_id
     LEFT JOIN fines f  ON f.issue_id  = i.issue_id
     WHERE ${where}
     ORDER BY ${order}
     LIMIT 200`
  );
  res.json(rows);
});

// GET /api/fines?status=unpaid|paid|all
router.get('/fines', async (req, res) => {
  const status = req.query.status || 'all';
  if (!['unpaid', 'paid', 'all'].includes(status)) throw httpError(400, 'status must be unpaid, paid or all');
  const [rows] = await pool.execute(
    `SELECT f.fine_id, f.issue_id, f.amount, f.status, f.paid_on,
            m.member_id, m.name AS member, b.title, i.due_date, i.return_date
     FROM fines f
     JOIN issues i      ON i.issue_id  = f.issue_id
     JOIN members m     ON m.member_id = i.member_id
     JOIN book_copies c ON c.copy_id   = i.copy_id
     JOIN books b       ON b.book_id   = c.book_id
     WHERE ? = 'all' OR f.status = ?
     ORDER BY f.status DESC, f.fine_id`,
    [status, status]
  );
  res.json(rows);
});

// POST /api/fines/:id/pay  - mark an unpaid fine as paid now
router.post('/fines/:id/pay', async (req, res) => {
  const id = toId(req.params.id);
  const [result] = await pool.execute(
    "UPDATE fines SET status = 'paid', paid_on = NOW() WHERE fine_id = ? AND status = 'unpaid'",
    [id]
  );
  if (result.affectedRows === 0) {
    const [rows] = await pool.execute('SELECT status FROM fines WHERE fine_id = ?', [id]);
    if (rows.length === 0) throw httpError(404, 'Fine not found');
    throw httpError(409, 'This fine is already paid');
  }
  const [[fine]] = await pool.execute('SELECT fine_id, issue_id, amount, status, paid_on FROM fines WHERE fine_id = ?', [id]);
  res.json({ message: `Fine of Rs ${fine.amount} paid`, fine });
});

module.exports = router;
