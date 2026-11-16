-- =====================================================================
-- indexes.sql  -  extra indexes for the queries the app runs most often
-- Run after schema.sql.  "npm run db:indexes" runs this file and saves
-- EXPLAIN output before and after into db/outputs/.
-- =====================================================================

-- Indexes we get for free (no need to create them):
--  * PRIMARY KEY of every table (InnoDB stores rows in PK order).
--  * UNIQUE members.rfid_uid and UNIQUE book_copies.rfid_tag: every RFID scan
--    looks its tag up through one of these unique indexes (EXPLAIN type = const,
--    exactly 1 row read), so tag lookups are already fast.
--  * UNIQUE on books.isbn, members.prn, members.email, fines.issue_id.
--  * InnoDB automatically indexes every FOREIGN KEY column
--    (issues.copy_id, issues.member_id, book_copies.book_id, books.category_id).

-- ---------------------------------------------------------------------
-- 1. issues(member_id, return_date)
--    Query: "books this member currently holds"
--           WHERE member_id = ? AND return_date IS NULL
--    Runs on EVERY member scan and EVERY issue (the borrow-limit check).
--    The automatic FK index on member_id alone finds ALL of the member's loans
--    (years of history) and then filters them. The composite index jumps
--    straight to the open loans, and COUNT(*) is answered from the index
--    alone without touching the table rows ("Using index" = covering index).
-- ---------------------------------------------------------------------
CREATE INDEX idx_issues_member_return ON issues (member_id, return_date);

-- ---------------------------------------------------------------------
-- 2. issues(return_date, due_date)   (the "due_date index" for overdue books)
--    Query: overdue report / dashboard / "due in the next 3 days"
--           WHERE return_date IS NULL AND due_date < CURDATE()
--    Why not due_date alone? Every OLD returned loan also has a due_date in
--    the past, so "due_date < today" matches almost the whole table and MySQL
--    ignores a plain due_date index (we tried it - EXPLAIN still showed a full
--    scan). Putting return_date first jumps to the books still out
--    (return_date IS NULL), then due_date is a range inside that small group.
-- ---------------------------------------------------------------------
CREATE INDEX idx_issues_return_due ON issues (return_date, due_date);

-- ---------------------------------------------------------------------
-- 3. scan_logs(device_id, scanned_at)
--    Query: the 60-second issue window, run on EVERY book scan
--           WHERE device_id = ? AND scanned_at >= NOW() - INTERVAL 60 SECOND
--    scan_logs grows by one row per scan forever. Without this index each
--    book scan reads the whole log; with it MySQL goes to this device's rows
--    and reads only the last minute (newest first, for ORDER BY ... LIMIT 1).
-- ---------------------------------------------------------------------
CREATE INDEX idx_scan_device_time ON scan_logs (device_id, scanned_at);
