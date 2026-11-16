// server.js - Express app: JSON API under /api and the static website from /public.
require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const { pool } = require('./db');
const { errorHandler } = require('./helpers');

const app = express();
app.use(express.json()); // parse JSON request bodies
app.use(express.static(path.join(__dirname, '..', 'public'))); // scan.html, dashboard.html, ...
app.get('/', (req, res) => res.redirect('/scan.html'));

// GET /api/health - is the server up and can it reach MySQL?
app.get('/api/health', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT NOW() AS db_time, VERSION() AS mysql_version');
    res.json({ ok: true, ...row });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

app.use('/api/categories', require('./routes/categories'));
app.use('/api/books', require('./routes/books'));
app.use('/api/copies', require('./routes/copies'));
app.use('/api/members', require('./routes/members'));
app.use('/api/scan', require('./routes/scan'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api', require('./routes/circulation')); // /api/issues, /api/fines

// unknown /api/... path
app.use('/api', (req, res) => res.status(404).json({ error: 'No such API route' }));

// central error handler (must be last)
app.use(errorHandler);

// Start listening only when run directly (node src/server.js).
// The test scripts import the app and start it on a random port themselves.
if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`Library server running on http://localhost:${port}`));
}

module.exports = app;
