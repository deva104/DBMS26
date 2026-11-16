-- =====================================================================
-- schema.sql  -  Library Management System with RFID
-- 7 tables, all InnoDB, every table has a PRIMARY KEY (Aiven requires it).
-- Safe to re-run: drops the tables first (children before parents,
-- because a parent table cannot be dropped while a foreign key points to it).
-- =====================================================================

DROP TABLE IF EXISTS fines;
DROP TABLE IF EXISTS issues;
DROP TABLE IF EXISTS book_copies;
DROP TABLE IF EXISTS books;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS scan_logs;

-- ---------------------------------------------------------------------
-- 1. categories : subject areas (Computer Science, Civil, ...)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(60) NOT NULL UNIQUE
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 2. books : one row per TITLE (the physical copies are in book_copies)
-- ---------------------------------------------------------------------
CREATE TABLE books (
  book_id     INT AUTO_INCREMENT PRIMARY KEY,
  isbn        VARCHAR(20)  NOT NULL UNIQUE,
  title       VARCHAR(200) NOT NULL,
  author      VARCHAR(150) NOT NULL,
  publisher   VARCHAR(100),
  pub_year    SMALLINT,
  category_id INT NOT NULL,
  CONSTRAINT chk_books_year CHECK (pub_year IS NULL OR pub_year BETWEEN 1900 AND 2100),
  -- RESTRICT: a category that still has books cannot be deleted
  CONSTRAINT fk_books_category FOREIGN KEY (category_id)
    REFERENCES categories (category_id) ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 3. book_copies : one row per PHYSICAL copy, each with its own RFID tag
-- ---------------------------------------------------------------------
CREATE TABLE book_copies (
  copy_id        INT AUTO_INCREMENT PRIMARY KEY,
  book_id        INT NOT NULL,
  rfid_tag       VARCHAR(32) NOT NULL UNIQUE,  -- NTAG213 UID, e.g. 04:BB:00:01
  shelf_location VARCHAR(20),
  status         ENUM('available', 'issued', 'lost') NOT NULL DEFAULT 'available',
  added_on       DATE NOT NULL DEFAULT (CURRENT_DATE),
  -- tag must be upper-case hex pairs separated by ':' (same format the app sends)
  CONSTRAINT chk_copies_tag CHECK (REGEXP_LIKE(rfid_tag, '^[0-9A-F]{2}(:[0-9A-F]{2})+$', 'c')),
  CONSTRAINT fk_copies_book FOREIGN KEY (book_id)
    REFERENCES books (book_id) ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 4. members : students and faculty who borrow books
-- ---------------------------------------------------------------------
CREATE TABLE members (
  member_id   INT AUTO_INCREMENT PRIMARY KEY,
  prn         VARCHAR(20)  NOT NULL UNIQUE,   -- college registration / employee number
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(100) NOT NULL UNIQUE,
  phone       VARCHAR(10),
  department  VARCHAR(10)  NOT NULL,
  member_type ENUM('student', 'faculty') NOT NULL DEFAULT 'student',
  rfid_uid    VARCHAR(32) UNIQUE,             -- library card tag; NULL = card not given yet
  max_books   TINYINT NOT NULL DEFAULT 3,     -- student 3, faculty 5
  status      ENUM('active', 'blocked') NOT NULL DEFAULT 'active',
  joined_on   DATE NOT NULL DEFAULT (CURRENT_DATE),
  CONSTRAINT chk_members_dept  CHECK (department IN ('ENTC', 'CS', 'IT', 'Mech', 'Civil')),
  CONSTRAINT chk_members_max   CHECK (max_books BETWEEN 1 AND 10),
  CONSTRAINT chk_members_email CHECK (email LIKE '%_@_%._%'),
  CONSTRAINT chk_members_phone CHECK (phone IS NULL OR REGEXP_LIKE(phone, '^[6-9][0-9]{9}$')),
  CONSTRAINT chk_members_uid   CHECK (rfid_uid IS NULL OR REGEXP_LIKE(rfid_uid, '^[0-9A-F]{2}(:[0-9A-F]{2})+$', 'c'))
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 5. issues : one row per loan. return_date NULL = book is still out.
-- ---------------------------------------------------------------------
CREATE TABLE issues (
  issue_id     INT AUTO_INCREMENT PRIMARY KEY,
  copy_id      INT NOT NULL,
  member_id    INT NOT NULL,
  issue_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  due_date     DATE NOT NULL,                 -- issue date + 14 days
  return_date  DATETIME NULL,
  -- Generated column: equals copy_id while the book is out, NULL after return.
  -- The UNIQUE key on it means the same copy can never have two open issues.
  open_copy_id INT AS (IF(return_date IS NULL, copy_id, NULL)) STORED,
  UNIQUE KEY uq_issues_open_copy (open_copy_id),
  CONSTRAINT chk_issues_due    CHECK (due_date > DATE(issue_date)),
  CONSTRAINT chk_issues_return CHECK (return_date IS NULL OR return_date >= issue_date),
  -- RESTRICT: copies and members with loan history cannot be deleted
  CONSTRAINT fk_issues_copy   FOREIGN KEY (copy_id)   REFERENCES book_copies (copy_id) ON DELETE RESTRICT,
  CONSTRAINT fk_issues_member FOREIGN KEY (member_id) REFERENCES members (member_id)   ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 6. fines : created when a book is returned late (Rs 2 per late day).
--    At most one fine per issue -> issue_id is UNIQUE (1 : 0..1 relation).
--    No member_id here: the member is found through issues (avoids redundancy).
-- ---------------------------------------------------------------------
CREATE TABLE fines (
  fine_id  INT AUTO_INCREMENT PRIMARY KEY,
  issue_id INT NOT NULL UNIQUE,
  amount   DECIMAL(8, 2) NOT NULL,
  status   ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  paid_on  DATETIME NULL,
  CONSTRAINT chk_fines_amount CHECK (amount > 0),
  -- paid_on must be filled exactly when the fine is paid
  CONSTRAINT chk_fines_paid CHECK ((status = 'unpaid' AND paid_on IS NULL)
                                OR (status = 'paid'   AND paid_on IS NOT NULL)),
  CONSTRAINT fk_fines_issue FOREIGN KEY (issue_id) REFERENCES issues (issue_id) ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------
-- 7. scan_logs : every RFID scan, even unknown tags. No foreign key on uid
--    on purpose - an unregistered tag must still be logged.
--    The 60-second "member then book" issue window is read from this table.
-- ---------------------------------------------------------------------
CREATE TABLE scan_logs (
  log_id     INT AUTO_INCREMENT PRIMARY KEY,
  uid        VARCHAR(32) NOT NULL,
  device_id  VARCHAR(40) NOT NULL,            -- which phone / desk did the scan
  scan_type  ENUM('member', 'book', 'unknown') NOT NULL DEFAULT 'unknown',
  action     VARCHAR(20) NOT NULL DEFAULT 'pending',
  message    VARCHAR(255),
  scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 'pending' only exists for a moment: the row is inserted first, then updated
  CONSTRAINT chk_scan_action CHECK (action IN ('pending', 'member_ready', 'issue', 'return',
                                               'info', 'unregistered', 'rejected'))
) ENGINE = InnoDB;
