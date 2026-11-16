// GET /api/activity?since=<log_id>  - polled by the dashboard every 2 seconds.
// Returns scans newer than "since" plus the headline counts.
const router = require('express').Router();
const { pool } = require('../db');
const { httpError } = require('../helpers');

router.get('/', async (req, res) => {
  const since = Number(req.query.since || 0);
  if (!Number.isInteger(since) || since < 0) throw httpError(400, 'since must be a log_id (0 or more)');

  // newest scans after the last one the dashboard has already seen
  const [logs] = await pool.execute(
    `SELECT log_id, uid, device_id, scan_type, action, message, scanned_at
     FROM scan_logs
     WHERE log_id > ?
     ORDER BY log_id DESC
     LIMIT 20`,
    [since]
  );

  // dashboard numbers, one row of scalar subqueries
  const [[counts]] = await pool.execute(
    `SELECT (SELECT COUNT(*) FROM members)                                  AS members,
            (SELECT COUNT(*) FROM books)                                    AS books,
            (SELECT COUNT(*) FROM book_copies)                              AS copies,
            (SELECT COUNT(*) FROM issues WHERE return_date IS NULL)         AS copies_out,
            (SELECT COUNT(*) FROM issues
              WHERE return_date IS NULL AND due_date < CURDATE())           AS overdue,
            (SELECT COUNT(*) FROM fines WHERE status = 'unpaid')            AS unpaid_fines,
            (SELECT COALESCE(SUM(amount), 0) FROM fines WHERE status = 'unpaid') AS unpaid_amount,
            (SELECT COALESCE(MAX(log_id), 0) FROM scan_logs)                AS last_id`
  );

  const lastId = counts.last_id;
  delete counts.last_id;
  res.json({ last_id: lastId, logs, counts });
});

module.exports = router;
