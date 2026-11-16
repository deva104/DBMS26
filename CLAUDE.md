# CLAUDE.md - Project brief (follow this throughout)

Build my complete DBMS college mini project end to end: "Library Management System
with RFID". Work autonomously through all phases below. Run and test everything
yourself. Only stop when you truly need me (accounts, credentials, clicks on
websites, phone testing) and then give me exact numbered steps for what to do.
First save this whole brief as CLAUDE.md and follow it throughout.

=== GRADING CONTEXT ===
Marks are for DATABASE and BACKEND. Frontend must be very simple. Each of 3 students
must explain schema, queries and data flow in a viva, so keep code simple, readable,
plain SQL (no ORM), short helpful comments.
Minimum requirements: 3+ related tables, full CRUD, 5+ meaningful queries (joins /
aggregation / reports), 2+ indexes with justification, 15-20 sample rows per main
table, backend connected to DB.

=== STACK ===
- MySQL 8 on Aiven free plan (SSL required; CA cert at ./ca.pem locally, and from env
  var DB_CA on Render). Use mysql2/promise pool, timezone '+05:30'.
- Node.js + Express. Express also serves the static frontend from /public.
- Deploy: GitHub + Render free web service (HTTPS, so Web NFC works).
- RFID reader = Android phone (Samsung S25 Ultra), Chrome Web NFC (NDEFReader),
  NTAG213 tags; use event.serialNumber as the UID. Tags are NOT bought yet, so
  every scan must also work by typing a UID manually.

=== FOLDERS ===
db/schema.sql, db/seed.sql, db/indexes.sql, db/queries.sql, db/outputs/
docs/ (er-diagram.png, architecture.png, mermaid sources)
scripts/ (node scripts: test connection, run sql files, run queries, test scan flow)
src/server.js, src/db.js, src/routes/*.js
public/*.html, public/style.css, public/js/*.js
.env (never commit), .env.example, .gitignore (.env, ca.pem, node_modules), README.md
npm scripts: start, db:test, db:setup (schema+seed), db:indexes, db:queries, test:scan

=== DATABASE (7 tables, InnoDB, every table has a PRIMARY KEY - Aiven requires it) ===
- categories(category_id PK, name UNIQUE NOT NULL)
- books(book_id PK, isbn UNIQUE, title, author, publisher, pub_year, category_id FK)
- book_copies(copy_id PK, book_id FK, rfid_tag UNIQUE NOT NULL, shelf_location,
  status ENUM('available','issued','lost') DEFAULT 'available', added_on)
- members(member_id PK, prn UNIQUE, name, email UNIQUE, phone, department,
  member_type ENUM('student','faculty'), rfid_uid UNIQUE, max_books (student 3,
  faculty 5), status ENUM('active','blocked') DEFAULT 'active', joined_on)
- issues(issue_id PK, copy_id FK, member_id FK, issue_date DATETIME, due_date DATE,
  return_date DATETIME NULL)  -- NULL return_date = currently out
- fines(fine_id PK, issue_id FK UNIQUE, amount DECIMAL(8,2),
  status ENUM('unpaid','paid') DEFAULT 'unpaid', paid_on NULL)
- scan_logs(log_id PK, uid, device_id, scan_type ENUM('member','book','unknown'),
  action VARCHAR(20) (member_ready/issue/return/info/unregistered/rejected),
  message, scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP)
FKs: ON DELETE RESTRICT where history exists. Add CHECK constraints and NOT NULL
where sensible. schema.sql must drop and recreate tables so it can be re-run.

Seed: 6 categories, 18 members, 18 books, 25 copies, 20 issues (mix of returned,
currently out, and OVERDUE), some paid and unpaid fines, ~30 scan_logs over the last
week. Realistic Indian names, Pune college departments (ENTC, CS, IT, Mech, Civil),
real-looking engineering textbooks. Fake UIDs like 04:AA:00:01. Also leave 2 members
and 4 copies clearly marked in comments as "DEMO - replace UID with real tag later".

Indexes (db/indexes.sql, with a comment justifying each):
- issues(member_id, return_date): "books this member currently holds" runs on every issue
- issues(due_date): overdue report
- scan_logs(device_id, scanned_at): 60-second issue window lookup on every book scan
- mention that UNIQUE on rfid_uid and rfid_tag already gives indexes for tag lookups
scripts must save EXPLAIN output BEFORE and AFTER creating indexes into
db/outputs/explain_before.txt and explain_after.txt.

Queries (db/queries.sql, 7, each with a comment): overdue books with member name and
fine due; top 10 most borrowed books; category-wise issue count; a member's current
books; fines collected per month; daily footfall from scan_logs; titles with zero
available copies. Script saves each result as a readable table in
db/outputs/query_results.txt.

=== BUSINESS RULES ===
- Loan 14 days. Fine Rs 2 per late day, created on return.
- Can borrow only if: status active AND open issues < max_books AND no unpaid fines.
- POST /api/scan {uid, device_id}:
  1. always insert into scan_logs first (then update its action/message)
  2. uid = member -> validate, reply member name + "ready to issue" (member_ready),
     or the rejection reason (rejected)
  3. uid = copy that is issued -> RETURN in a transaction: set return_date, copy
     'available', insert fine if late
  4. uid = available copy -> find member_ready scan from SAME device_id in last 60 s
     in scan_logs. Found -> ISSUE in a transaction (insert issue + copy 'issued').
     Not found -> INFO (title, author, shelf, available copies)
  5. unknown uid -> "Unregistered tag"
  The 60-second window MUST come from the scan_logs table, not server memory.
  Return clear JSON: {action, message, member?, book?, due_date?, fine?}

=== API ===
CRUD: /api/members, /api/books, /api/copies, /api/categories (GET list, GET one,
POST, PUT, DELETE; return a friendly error when FK RESTRICT blocks a delete)
/api/scan, /api/issues?status=open|overdue|all, POST /api/fines/:id/pay,
GET /api/reports/:name (the 7 queries), GET /api/activity?since=<log_id> (for polling),
GET /api/health. Validate inputs, prepared statements everywhere, central error handler.

=== FRONTEND (very simple) ===
Pages: scan.html, dashboard.html, members.html, books.html (copies managed inside),
reports.html. Plain HTML + one style.css + small JS files. Light colours, system font,
simple tables and forms, a plain top nav. NO animations, NO images, NO gradients,
no icons, compact pages. It must look like a student built it by hand, not a template.
- scan.html: "Start NFC scan" button (Web NFC needs a user tap; show a clear message
  if NFC is unsupported), plus a "Type UID" input + Submit as fallback. device_id
  random, stored in localStorage. Show the result in a big plain message box
  (green/red/grey) and keep the last 5 scans listed.
- dashboard.html: counts (members, books, copies out, overdue, unpaid fines),
  recent scans, currently issued, overdue list. Polls /api/activity every 2 s.
- reports.html: dropdown of the 7 reports, shows the result table.

=== TESTING ===
scripts/test-scan.js simulates the full flow against the real DB: member scan ->
book scan (issue) -> book scan again (return) -> late return creates a fine ->
blocked member rejected -> unknown tag. Print pass/fail for each. Run it and fix
until everything passes. Also smoke-test every CRUD route.

=== DOCS ===
- docs/er-diagram: Mermaid erDiagram with all 7 tables, keys and cardinalities;
  render to PNG with npx @mermaid-js/mermaid-cli.
- docs/architecture: Mermaid flowchart: NTAG tags -> phone (Chrome Web NFC) ->
  Render (Node/Express: scan handler, circulation logic, CRUD+reports) -> Aiven MySQL;
  librarian dashboard polling the backend. Render to PNG.
- README.md: what it is, how to run locally, how to deploy on Render, how to replace
  demo UIDs with real tag UIDs (SQL UPDATE examples), and a short viva cheat-sheet
  explaining the schema, each index, each query, and the issue/return transaction.

=== ORDER OF WORK ===
1. Scaffold project, then STOP and ask me for Aiven details: tell me exactly how to
   create the free Aiven MySQL service, what values to copy, and to put the CA cert
   as ./ca.pem. You create .env from what I give you. Then run db:test.
2. Schema -> seed -> EXPLAIN before -> indexes -> EXPLAIN after -> queries, all run
   against Aiven, outputs saved.
3. Backend, then run test-scan and CRUD smoke tests until all pass.
4. Frontend, then run locally and check every page loads and works with typed UIDs.
5. Docs (ER + architecture PNGs, README).
6. git init + commit. STOP: tell me how to create the GitHub repo and push (use gh
   CLI if available).
7. STOP: give me exact Render steps (build: npm install, start: npm start, free
   instance, every env var to add incl. DB_CA as the CA cert text). Make the code
   read the CA from DB_CA when set, else from ./ca.pem.
8. STOP: give me a phone test checklist for the live URL (Chrome on S25 Ultra,
   typed UID flow now, real NFC once tags arrive).
At the end, give me a short summary of what was built and what is left.
