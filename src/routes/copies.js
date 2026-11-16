// /api/copies - CRUD for physical book copies (each has its own RFID tag)
const router = require('express').Router();
const { pool } = require('../db');
const { httpError, toId, text, normalizeUid, assertUidFree } = require('../helpers');

// GET /api/copies?book_id=3  - all copies, or only the copies of one book
router.get('/', async (req, res) => {
  const bookId = req.query.book_id ? toId(req.query.book_id, 'book_id') : 0;
  const [rows] = await pool.execute(
    `SELECT bc.copy_id, bc.book_id, b.title, bc.rfid_tag, bc.shelf_location, bc.status, bc.added_on
     FROM book_copies bc
     JOIN books b ON b.book_id = bc.book_id
     WHERE ? = 0 OR bc.book_id = ?
     ORDER BY bc.copy_id`,
    [bookId, bookId]
  );
  res.json(rows);
});

// GET /api/copies/:id
router.get('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [rows] = await pool.execute(
    `SELECT bc.*, b.title, b.author
     FROM book_copies bc JOIN books b ON b.book_id = bc.book_id
     WHERE bc.copy_id = ?`,
    [id]
  );
  if (rows.length === 0) throw httpError(404, 'Copy not found');
  res.json(rows[0]);
});

// POST /api/copies  { book_id, rfid_tag, shelf_location, status? }
router.post('/', async (req, res) => {
  const body = req.body || {};
  const bookId = toId(body.book_id, 'book_id');
  const tag = normalizeUid(body.rfid_tag);
  if (!tag) throw httpError(400, 'rfid_tag is required');
  const shelf = text(body, 'shelf_location', { max: 20 });
  // a new copy can only start as available or lost; "issued" happens at the scan desk
  const status = body.status === 'lost' ? 'lost' : 'available';

  await assertUidFree(tag);
  const [result] = await pool.execute(
    'INSERT INTO book_copies (book_id, rfid_tag, shelf_location, status) VALUES (?, ?, ?, ?)',
    [bookId, tag, shelf, status]
  );
  res.status(201).json({ copy_id: result.insertId, book_id: bookId, rfid_tag: tag, shelf_location: shelf, status });
});

// PUT /api/copies/:id  { book_id, rfid_tag, shelf_location, status }
router.put('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const body = req.body || {};
  const [found] = await pool.execute('SELECT status FROM book_copies WHERE copy_id = ?', [id]);
  if (found.length === 0) throw httpError(404, 'Copy not found');
  const current = found[0].status;

  const bookId = toId(body.book_id, 'book_id');
  const tag = normalizeUid(body.rfid_tag);
  if (!tag) throw httpError(400, 'rfid_tag is required');
  const shelf = text(body, 'shelf_location', { max: 20 });
  const status = body.status || current;
  if (!['available', 'issued', 'lost'].includes(status)) throw httpError(400, 'status must be available, issued or lost');
  // issue / return only through the scan desk, so issues and copy status never disagree
  if (current === 'issued' && status !== 'issued') throw httpError(409, 'This copy is issued. Return it by scanning it first.');
  if (current !== 'issued' && status === 'issued') throw httpError(409, 'Use the scan desk to issue a copy.');

  await assertUidFree(tag, { copyId: id });
  await pool.execute(
    'UPDATE book_copies SET book_id = ?, rfid_tag = ?, shelf_location = ?, status = ? WHERE copy_id = ?',
    [bookId, tag, shelf, status, id]
  );
  res.json({ copy_id: id, book_id: bookId, rfid_tag: tag, shelf_location: shelf, status });
});

// DELETE /api/copies/:id  (blocked by FK RESTRICT if the copy was ever issued)
router.delete('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [result] = await pool.execute('DELETE FROM book_copies WHERE copy_id = ?', [id]);
  if (result.affectedRows === 0) throw httpError(404, 'Copy not found');
  res.json({ deleted: true, copy_id: id });
});

module.exports = router;
