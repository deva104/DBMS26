// /api/books - CRUD for book titles (physical copies are in /api/copies)
const router = require('express').Router();
const { pool } = require('../db');
const { httpError, toId, text, int } = require('../helpers');

// Read and check the fields of a book from the request body.
function readBook(body = {}) {
  return {
    isbn: text(body, 'isbn', { required: true, max: 20 }),
    title: text(body, 'title', { required: true, max: 200 }),
    author: text(body, 'author', { required: true, max: 150 }),
    publisher: text(body, 'publisher', { max: 100 }),
    pub_year: int(body, 'pub_year'),
    category_id: toId(body.category_id, 'category_id'),
  };
}

// GET /api/books?q=word  - list with category name and copy counts
router.get('/', async (req, res) => {
  const like = '%' + (req.query.q || '') + '%';
  const [rows] = await pool.execute(
    `SELECT b.book_id, b.isbn, b.title, b.author, b.publisher, b.pub_year,
            b.category_id, c.name AS category,
            COUNT(bc.copy_id)                         AS copies,
            COALESCE(SUM(bc.status = 'available'), 0) AS available
     FROM books b
     JOIN categories c        ON c.category_id = b.category_id
     LEFT JOIN book_copies bc ON bc.book_id    = b.book_id
     WHERE b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?
     GROUP BY b.book_id, c.name
     ORDER BY b.title`,
    [like, like, like]
  );
  res.json(rows);
});

// GET /api/books/:id  - one book plus its copies
router.get('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [books] = await pool.execute(
    `SELECT b.*, c.name AS category
     FROM books b JOIN categories c ON c.category_id = b.category_id
     WHERE b.book_id = ?`,
    [id]
  );
  if (books.length === 0) throw httpError(404, 'Book not found');
  const [copies] = await pool.execute(
    'SELECT copy_id, rfid_tag, shelf_location, status, added_on FROM book_copies WHERE book_id = ? ORDER BY copy_id',
    [id]
  );
  res.json({ ...books[0], copies });
});

// POST /api/books
router.post('/', async (req, res) => {
  const b = readBook(req.body);
  const [result] = await pool.execute(
    `INSERT INTO books (isbn, title, author, publisher, pub_year, category_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [b.isbn, b.title, b.author, b.publisher, b.pub_year, b.category_id]
  );
  res.status(201).json({ book_id: result.insertId, ...b });
});

// PUT /api/books/:id
router.put('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const b = readBook(req.body);
  const [result] = await pool.execute(
    `UPDATE books SET isbn = ?, title = ?, author = ?, publisher = ?, pub_year = ?, category_id = ?
     WHERE book_id = ?`,
    [b.isbn, b.title, b.author, b.publisher, b.pub_year, b.category_id, id]
  );
  if (result.affectedRows === 0) throw httpError(404, 'Book not found');
  res.json({ book_id: id, ...b });
});

// DELETE /api/books/:id  (blocked by FK RESTRICT while the book has copies)
router.delete('/:id', async (req, res) => {
  const id = toId(req.params.id);
  const [result] = await pool.execute('DELETE FROM books WHERE book_id = ?', [id]);
  if (result.affectedRows === 0) throw httpError(404, 'Book not found');
  res.json({ deleted: true, book_id: id });
});

module.exports = router;
