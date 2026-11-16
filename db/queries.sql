-- =====================================================================
-- queries.sql  -  the 7 report queries
-- Used in two places:
--   * npm run db:queries  runs them all and saves db/outputs/query_results.txt
--   * GET /api/reports/<name>  (the website's Reports page) runs one of them
-- Each query starts with a line "-- Qn <name>: <title>"; the scripts read
-- the file using those lines, so keep that format.
-- Q4 needs a member: set @member_id here; the API passes it as a ? parameter.
-- =====================================================================

SET @member_id = 1;

-- Q1 overdue_books: Overdue books with member name and fine due
-- Books still out (return_date IS NULL) whose due date has passed.
-- 4-table JOIN; fine so far = days late x Rs 2 (the real fine row is created on return).
SELECT i.issue_id,
       m.name                           AS member,
       m.department,
       b.title,
       c.rfid_tag,
       DATE(i.issue_date)               AS issued_on,
       i.due_date,
       DATEDIFF(CURDATE(), i.due_date)     AS days_late,
       DATEDIFF(CURDATE(), i.due_date) * 2 AS fine_due_rs
FROM issues i
JOIN members m     ON m.member_id = i.member_id
JOIN book_copies c ON c.copy_id   = i.copy_id
JOIN books b       ON b.book_id   = c.book_id
WHERE i.return_date IS NULL
  AND i.due_date < CURDATE()
ORDER BY days_late DESC;

-- Q2 top_borrowed: Top 10 most borrowed books
-- Counts loans per TITLE (all copies of a book together) with GROUP BY.
SELECT b.book_id,
       b.title,
       b.author,
       COUNT(i.issue_id) AS times_borrowed
FROM books b
JOIN book_copies c ON c.book_id = b.book_id
JOIN issues i      ON i.copy_id = c.copy_id
GROUP BY b.book_id, b.title, b.author
ORDER BY times_borrowed DESC, b.title
LIMIT 10;

-- Q3 category_issues: Category-wise issue count
-- LEFT JOINs keep categories that were never borrowed (they show 0).
SELECT cat.name                  AS category,
       COUNT(DISTINCT b.book_id) AS titles,
       COUNT(DISTINCT c.copy_id) AS copies,
       COUNT(i.issue_id)         AS total_issues
FROM categories cat
LEFT JOIN books b       ON b.category_id = cat.category_id
LEFT JOIN book_copies c ON c.book_id     = b.book_id
LEFT JOIN issues i      ON i.copy_id     = c.copy_id
GROUP BY cat.category_id, cat.name
ORDER BY total_issues DESC, category;

-- Q4 member_books: Books a member currently holds
-- Uses index idx_issues_member_return (member_id, return_date).
SELECT m.name            AS member,
       b.title,
       c.rfid_tag,
       DATE(i.issue_date) AS issued_on,
       i.due_date,
       CASE WHEN i.due_date < CURDATE() THEN 'OVERDUE' ELSE 'on time' END AS state
FROM issues i
JOIN members m     ON m.member_id = i.member_id
JOIN book_copies c ON c.copy_id   = i.copy_id
JOIN books b       ON b.book_id   = c.book_id
WHERE i.member_id = @member_id
  AND i.return_date IS NULL
ORDER BY i.due_date;

-- Q5 fines_per_month: Fines collected per month
-- Only PAID fines, grouped by the month they were paid in.
SELECT DATE_FORMAT(paid_on, '%Y-%m') AS month,
       COUNT(*)                      AS fines_paid,
       SUM(amount)                   AS total_collected_rs
FROM fines
WHERE status = 'paid'
GROUP BY DATE_FORMAT(paid_on, '%Y-%m')
ORDER BY month;

-- Q6 daily_footfall: Daily footfall from scan_logs (last 7 days)
-- Footfall = different members who scanned their card that day.
-- SUM(condition) counts rows where the condition is true.
SELECT DATE(scanned_at)                                          AS day,
       COUNT(*)                                                  AS total_scans,
       COUNT(DISTINCT CASE WHEN scan_type = 'member' THEN uid END) AS members_visited,
       SUM(action = 'issue')                                     AS issues,
       SUM(action = 'return')                                    AS returns,
       SUM(action IN ('rejected', 'unregistered'))               AS refused
FROM scan_logs
WHERE scanned_at >= CURDATE() - INTERVAL 7 DAY
GROUP BY DATE(scanned_at)
ORDER BY day;

-- Q7 zero_available: Titles with zero available copies
-- Every copy is issued or lost (or the title has no copies at all).
-- HAVING filters groups after GROUP BY; COALESCE turns NULL (no copies) into 0.
SELECT b.book_id,
       b.title,
       COUNT(c.copy_id)                       AS total_copies,
       COALESCE(SUM(c.status = 'issued'), 0)  AS issued,
       COALESCE(SUM(c.status = 'lost'), 0)    AS lost
FROM books b
LEFT JOIN book_copies c ON c.book_id = b.book_id
GROUP BY b.book_id, b.title
HAVING COALESCE(SUM(c.status = 'available'), 0) = 0
ORDER BY b.title;
