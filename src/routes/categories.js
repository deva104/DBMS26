// /api/categories - CRUD for book categories
const router = require('express').Router();
const { pool } = require('../db');
const { httpError, toId, text } = require('../helpers');

// GET /api/categories  - all categories with the number of books in each
router.get('/', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT c.category_id, c.name, COUNT(b.book_id) AS books
     FROM categories c
     LEFT JOIN books b ON b.category_id = c.category_id
     GROUP BY c.category_id, c.name
     ORDER BY c.name`
  );
  res.json(rows);
});

// GET /api/categories/:id
router.get('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [rows] = await pool.execute('SELECT category_id, name FROM categories WHERE category_id = ?', [id]);
  if (rows.length === 0) throw httpError(404, 'Category not found');
  res.json(rows[0]);
});

// POST /api/categories  { name }
router.post('/', async (req, res) => {
  const name = text(req.body || {}, 'name', { required: true, max: 60 });
  const [result] = await pool.execute('INSERT INTO categories (name) VALUES (?)', [name]);
  res.status(201).json({ category_id: result.insertId, name });
});

// PUT /api/categories/:id  { name }
router.put('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const name = text(req.body || {}, 'name', { required: true, max: 60 });
  const [result] = await pool.execute('UPDATE categories SET name = ? WHERE category_id = ?', [name, id]);
  if (result.affectedRows === 0) throw httpError(404, 'Category not found');
  res.json({ category_id: id, name });
});

// DELETE /api/categories/:id  (blocked by FK RESTRICT if books use it)
router.delete('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [result] = await pool.execute('DELETE FROM categories WHERE category_id = ?', [id]);
  if (result.affectedRows === 0) throw httpError(404, 'Category not found');
  res.json({ deleted: true, category_id: id });
});

module.exports = router;
