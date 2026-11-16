-- =====================================================================
-- seed.sql  -  sample data (run after schema.sql)
-- Dates are written relative to CURDATE() so the data always looks "live":
-- whenever you re-seed there are books currently out, overdue and returned.
-- UIDs: 04:AA:xx:xx = member cards, 04:BB:xx:xx = book copy tags.
-- =====================================================================

-- ---------- categories (6) ----------
INSERT INTO categories (category_id, name) VALUES
  (1, 'Computer Science'),
  (2, 'Electronics & Telecommunication'),
  (3, 'Mechanical Engineering'),
  (4, 'Civil Engineering'),
  (5, 'Engineering Mathematics'),
  (6, 'Physics & Chemistry');

-- ---------- books (18 titles) ----------
INSERT INTO books (book_id, isbn, title, author, publisher, pub_year, category_id) VALUES
  (1,  '978-93-5532-503-6', 'Database System Concepts (7th Ed.)', 'Abraham Silberschatz, Henry F. Korth, S. Sudarshan', 'McGraw Hill Education', 2019, 1),
  (2,  '978-81-265-5427-0', 'Operating System Concepts (10th Ed.)', 'Abraham Silberschatz, Peter B. Galvin, Greg Gagne', 'Wiley India', 2018, 1),
  (3,  '978-81-203-4007-7', 'Introduction to Algorithms (3rd Ed.)', 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein', 'PHI Learning', 2010, 1),
  (4,  '978-93-325-8608-1', 'Computer Networks (5th Ed.)', 'Andrew S. Tanenbaum, David J. Wetherall', 'Pearson India', 2013, 1),
  (5,  '978-93-89845-68-8', 'Let Us C (17th Ed.)', 'Yashavant Kanetkar', 'BPB Publications', 2020, 1),
  (6,  '978-01-980-9930-7', 'Data Structures Using C (2nd Ed.)', 'Reema Thareja', 'Oxford University Press', 2014, 1),
  (7,  '978-93-325-4260-5', 'Electronic Devices and Circuit Theory (11th Ed.)', 'Robert L. Boylestad, Louis Nashelsky', 'Pearson India', 2015, 2),
  (8,  '978-93-325-8604-3', 'Digital Design (6th Ed.)', 'M. Morris Mano, Michael D. Ciletti', 'Pearson India', 2018, 2),
  (9,  '978-93-325-5023-5', 'Signals and Systems (2nd Ed.)', 'Alan V. Oppenheim, Alan S. Willsky', 'Pearson India', 2015, 2),
  (10, '978-81-87972-88-4', 'Microprocessor Architecture, Programming and Applications with the 8085', 'Ramesh S. Gaonkar', 'Penram International', 2013, 2),
  (11, '978-81-318-0814-6', 'A Textbook of Strength of Materials', 'R. K. Bansal', 'Laxmi Publications', 2018, 3),
  (12, '978-93-5260-347-7', 'Theory of Machines (5th Ed.)', 'S. S. Rattan', 'McGraw Hill Education', 2019, 3),
  (13, '978-93-5260-683-6', 'Engineering Thermodynamics (6th Ed.)', 'P. K. Nag', 'McGraw Hill Education', 2017, 3),
  (14, '978-81-7008-853-0', 'Surveying Vol. I', 'B. C. Punmia, Ashok K. Jain, Arun K. Jain', 'Laxmi Publications', 2016, 4),
  (15, '978-93-5260-472-6', 'Design of Steel Structures (3rd Ed.)', 'S. K. Duggal', 'McGraw Hill Education', 2017, 4),
  (16, '978-81-933284-9-1', 'Higher Engineering Mathematics (44th Ed.)', 'B. S. Grewal', 'Khanna Publishers', 2020, 5),
  (17, '978-81-265-5423-2', 'Advanced Engineering Mathematics (10th Ed.)', 'Erwin Kreyszig', 'Wiley India', 2015, 5),
  (18, '978-81-7700-121-4', 'Engineering Physics', 'R. K. Gaur, S. L. Gupta', 'Dhanpat Rai Publications', 2015, 6);

-- ---------- book_copies (25 physical copies) ----------
-- status 'issued' must match an open row in issues (see below).
INSERT INTO book_copies (copy_id, book_id, rfid_tag, shelf_location, status, added_on) VALUES
  (1,  1,  '04:BB:00:01', 'CS-1A', 'issued',    '2023-07-10'),
  (2,  1,  '04:BB:00:02', 'CS-1A', 'available', '2023-07-10'),
  (3,  1,  '04:BB:00:03', 'CS-1A', 'available', '2024-01-15'),
  (4,  2,  '04:BB:00:04', 'CS-1B', 'available', '2023-07-10'),
  (5,  2,  '04:BB:00:05', 'CS-1B', 'available', '2024-01-15'),
  (6,  3,  '04:BB:00:06', 'CS-1C', 'issued',    '2023-07-12'),
  (7,  3,  '04:BB:00:07', 'CS-1C', 'issued',    '2023-07-12'),
  (8,  4,  '04:BB:00:08', 'CS-2A', 'issued',    '2023-07-12'),
  (9,  5,  '04:BB:00:09', 'CS-2B', 'available', '2023-07-15'),
  (10, 5,  '04:BB:00:10', 'CS-2B', 'available', '2024-01-15'),
  (11, 6,  '04:BB:00:11', 'CS-2C', 'available', '2023-07-15'),
  (12, 7,  '04:BB:00:12', 'EC-1A', 'issued',    '2023-07-20'),
  (13, 7,  '04:BB:00:13', 'EC-1A', 'available', '2023-07-20'),
  (14, 8,  '04:BB:00:14', 'EC-1B', 'available', '2023-07-20'),
  (15, 9,  '04:BB:00:15', 'EC-1C', 'issued',    '2023-07-20'),
  (16, 10, '04:BB:00:16', 'EC-2A', 'available', '2023-07-22'),
  (17, 11, '04:BB:00:17', 'ME-1A', 'issued',    '2023-08-01'),
  (18, 11, '04:BB:00:18', 'ME-1A', 'available', '2024-01-20'),
  (19, 12, '04:BB:00:19', 'ME-1B', 'lost',      '2023-08-01'),
  (20, 13, '04:BB:00:20', 'ME-1C', 'available', '2023-08-01'),
  (21, 14, '04:BB:00:21', 'CV-1A', 'issued',    '2023-08-05'),
  -- DEMO - replace UID with real tag later (copies 22-25, see README)
  (22, 15, '04:BB:00:22', 'CV-1B', 'available', '2023-08-05'),
  (23, 16, '04:BB:00:23', 'MA-1A', 'available', '2023-08-10'),
  (24, 17, '04:BB:00:24', 'MA-1B', 'available', '2023-08-10'),
  (25, 18, '04:BB:00:25', 'PH-1A', 'available', '2024-02-01');

-- ---------- members (18: 15 students + 3 faculty) ----------
-- max_books: student 3, faculty 5. Yash (9) is blocked for a long overdue book.
INSERT INTO members (member_id, prn, name, email, phone, department, member_type, rfid_uid, max_books, status, joined_on) VALUES
  (1,  '2023CS0011', 'Aarav Kulkarni',       'aarav.kulkarni@college.edu.in',  '9822011101', 'CS',    'student', '04:AA:00:01', 3, 'active',  '2023-08-01'),
  (2,  '2023EN0024', 'Sneha Patil',          'sneha.patil@college.edu.in',     '9822011102', 'ENTC',  'student', '04:AA:00:02', 3, 'active',  '2023-08-01'),
  (3,  '2022ME0007', 'Rohan Deshmukh',       'rohan.deshmukh@college.edu.in',  '9822011103', 'Mech',  'student', '04:AA:00:03', 3, 'active',  '2022-08-02'),
  (4,  '2023IT0015', 'Priya Joshi',          'priya.joshi@college.edu.in',     '9822011104', 'IT',    'student', '04:AA:00:04', 3, 'active',  '2023-08-01'),
  (5,  '2022CV0032', 'Omkar Jadhav',         'omkar.jadhav@college.edu.in',    '9822011105', 'Civil', 'student', '04:AA:00:05', 3, 'active',  '2022-08-02'),
  (6,  '2024CS0003', 'Ananya Kale',          'ananya.kale@college.edu.in',     '9822011106', 'CS',    'student', '04:AA:00:06', 3, 'active',  '2024-08-05'),
  (7,  '2023EN0041', 'Siddharth Pawar',      'siddharth.pawar@college.edu.in', '9822011107', 'ENTC',  'student', '04:AA:00:07', 3, 'active',  '2023-08-01'),
  (8,  '2024IT0019', 'Tanvi Gokhale',        'tanvi.gokhale@college.edu.in',   '9822011108', 'IT',    'student', '04:AA:00:08', 3, 'active',  '2024-08-05'),
  (9,  '2022ME0028', 'Yash Shinde',          'yash.shinde@college.edu.in',     '9822011109', 'Mech',  'student', '04:AA:00:09', 3, 'blocked', '2022-08-02'),
  (10, '2023CS0046', 'Isha Bhosale',         'isha.bhosale@college.edu.in',    '9822011110', 'CS',    'student', '04:AA:00:10', 3, 'active',  '2023-08-01'),
  (11, '2022CV0011', 'Pratik More',          'pratik.more@college.edu.in',     '9822011111', 'Civil', 'student', '04:AA:00:11', 3, 'active',  '2022-08-02'),
  (12, '2024EN0008', 'Neha Chavan',          'neha.chavan@college.edu.in',     '9822011112', 'ENTC',  'student', '04:AA:00:12', 3, 'active',  '2024-08-05'),
  (13, '2023IT0037', 'Aditya Sawant',        'aditya.sawant@college.edu.in',   '9822011113', 'IT',    'student', '04:AA:00:13', 3, 'active',  '2023-08-01'),
  (14, '2024CS0029', 'Kavya Apte',           'kavya.apte@college.edu.in',      '9822011114', 'CS',    'student', '04:AA:00:14', 3, 'active',  '2024-08-05'),
  (15, 'FAC-CS-104', 'Dr. Meera Deshpande',  'meera.deshpande@college.edu.in', '9822011115', 'CS',    'faculty', '04:AA:00:15', 5, 'active',  '2015-06-15'),
  (16, 'FAC-ME-211', 'Prof. Sanjay Gaikwad', 'sanjay.gaikwad@college.edu.in',  '9822011116', 'Mech',  'faculty', '04:AA:00:16', 5, 'active',  '2012-07-01'),
  -- DEMO - replace UID with real tag later (members 17 and 18, see README)
  (17, '2024IT0050', 'Riya Naik',            'riya.naik@college.edu.in',       '9822011117', 'IT',    'student', '04:AA:00:17', 3, 'active',  '2024-08-05'),
  (18, 'FAC-EN-117', 'Prof. Vikram Bhide',   'vikram.bhide@college.edu.in',    '9822011118', 'ENTC',  'faculty', '04:AA:00:18', 5, 'active',  '2016-07-01');

-- ---------- issues (20 loans) ----------
-- Rule used everywhere: due_date = issue date + 14 days.
-- 12 returned (6 of them late -> fines), 8 still out (4 of them OVERDUE).
INSERT INTO issues (issue_id, copy_id, member_id, issue_date, due_date, return_date) VALUES
  -- returned
  (1,  1,  6,  TIMESTAMP(CURDATE() - INTERVAL 60 DAY, '10:15:00'), CURDATE() - INTERVAL 46 DAY, TIMESTAMP(CURDATE() - INTERVAL 50 DAY, '12:30:00')),
  (2,  2,  1,  TIMESTAMP(CURDATE() - INTERVAL 55 DAY, '11:40:00'), CURDATE() - INTERVAL 41 DAY, TIMESTAMP(CURDATE() - INTERVAL 38 DAY, '09:50:00')), -- 3 days late
  (3,  4,  1,  TIMESTAMP(CURDATE() - INTERVAL 50 DAY, '14:05:00'), CURDATE() - INTERVAL 36 DAY, TIMESTAMP(CURDATE() - INTERVAL 26 DAY, '15:20:00')), -- 10 days late
  (4,  6,  14, TIMESTAMP(CURDATE() - INTERVAL 48 DAY, '10:00:00'), CURDATE() - INTERVAL 34 DAY, TIMESTAMP(CURDATE() - INTERVAL 30 DAY, '11:10:00')), -- 4 days late
  (5,  3,  10, TIMESTAMP(CURDATE() - INTERVAL 45 DAY, '13:25:00'), CURDATE() - INTERVAL 31 DAY, TIMESTAMP(CURDATE() - INTERVAL 33 DAY, '16:00:00')),
  (6,  9,  8,  TIMESTAMP(CURDATE() - INTERVAL 40 DAY, '09:35:00'), CURDATE() - INTERVAL 26 DAY, TIMESTAMP(CURDATE() - INTERVAL 22 DAY, '10:40:00')), -- 4 days late
  -- still out, very overdue (this is why Yash is blocked)
  (7,  15, 9,  TIMESTAMP(CURDATE() - INTERVAL 40 DAY, '12:10:00'), CURDATE() - INTERVAL 26 DAY, NULL),
  (8,  14, 7,  TIMESTAMP(CURDATE() - INTERVAL 35 DAY, '15:45:00'), CURDATE() - INTERVAL 21 DAY, TIMESTAMP(CURDATE() - INTERVAL 23 DAY, '12:00:00')),
  (9,  23, 12, TIMESTAMP(CURDATE() - INTERVAL 33 DAY, '10:30:00'), CURDATE() - INTERVAL 19 DAY, TIMESTAMP(CURDATE() - INTERVAL 21 DAY, '14:15:00')),
  (10, 2,  15, TIMESTAMP(CURDATE() - INTERVAL 30 DAY, '11:05:00'), CURDATE() - INTERVAL 16 DAY, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '10:20:00')),
  (11, 18, 11, TIMESTAMP(CURDATE() - INTERVAL 28 DAY, '14:50:00'), CURDATE() - INTERVAL 14 DAY, TIMESTAMP(CURDATE() - INTERVAL 9 DAY,  '13:35:00')), -- 5 days late
  (12, 13, 13, TIMESTAMP(CURDATE() - INTERVAL 26 DAY, '09:55:00'), CURDATE() - INTERVAL 12 DAY, TIMESTAMP(CURDATE() - INTERVAL 15 DAY, '11:45:00')),
  -- still out, overdue
  (13, 8,  4,  TIMESTAMP(CURDATE() - INTERVAL 25 DAY, '13:00:00'), CURDATE() - INTERVAL 11 DAY, NULL),
  -- returned 2 days late
  (14, 3,  2,  TIMESTAMP(CURDATE() - INTERVAL 22 DAY, '10:45:00'), CURDATE() - INTERVAL 8 DAY,  TIMESTAMP(CURDATE() - INTERVAL 6 DAY,  '10:05:00')),
  -- still out, overdue
  (15, 7,  10, TIMESTAMP(CURDATE() - INTERVAL 20 DAY, '12:20:00'), CURDATE() - INTERVAL 6 DAY,  NULL),
  (16, 21, 5,  TIMESTAMP(CURDATE() - INTERVAL 18 DAY, '15:10:00'), CURDATE() - INTERVAL 4 DAY,  NULL),
  -- still out, not yet due
  (17, 17, 3,  TIMESTAMP(CURDATE() - INTERVAL 10 DAY, '11:30:00'), CURDATE() + INTERVAL 4 DAY,  NULL),
  (18, 12, 2,  TIMESTAMP(CURDATE() - INTERVAL 8 DAY,  '14:40:00'), CURDATE() + INTERVAL 6 DAY,  NULL),
  (19, 1,  1,  TIMESTAMP(CURDATE() - INTERVAL 5 DAY,  '11:02:10'), CURDATE() + INTERVAL 9 DAY,  NULL),
  (20, 6,  1,  TIMESTAMP(CURDATE() - INTERVAL 3 DAY,  '14:20:30'), CURDATE() + INTERVAL 11 DAY, NULL);

-- ---------- fines (6: 4 paid, 2 unpaid) ----------
-- amount = days late x Rs 2. Tanvi (issue 6) and Pratik (issue 11) have NOT paid,
-- so the scan desk will refuse to issue them more books.
INSERT INTO fines (fine_id, issue_id, amount, status, paid_on) VALUES
  (1, 2,  6.00,  'paid',   TIMESTAMP(CURDATE() - INTERVAL 37 DAY, '10:00:00')),
  (2, 3,  20.00, 'paid',   TIMESTAMP(CURDATE() - INTERVAL 25 DAY, '12:30:00')),
  (3, 4,  8.00,  'paid',   TIMESTAMP(CURDATE() - INTERVAL 28 DAY, '15:00:00')),
  (4, 6,  8.00,  'unpaid', NULL),
  (5, 11, 10.00, 'unpaid', NULL),
  (6, 14, 4.00,  'paid',   TIMESTAMP(CURDATE() - INTERVAL 5 DAY,  '11:15:00'));

-- ---------- scan_logs (31 scans over the last 7 days) ----------
-- Two scanners: the librarian's desk PC and a phone.
INSERT INTO scan_logs (uid, device_id, scan_type, action, message, scanned_at) VALUES
  -- 7 days ago
  ('04:AA:00:06', 'desk-pc-01',   'member',  'member_ready', 'Ananya Kale - ready to issue (0 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '10:00:00')),
  ('04:BB:00:13', 'desk-pc-01',   'book',    'info',         '"Electronic Devices and Circuit Theory (11th Ed.)" by Robert L. Boylestad, Louis Nashelsky - shelf EC-1A - 1 of 2 copies available', TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '10:20:00')),
  ('04:AA:00:16', 'desk-pc-01',   'member',  'member_ready', 'Prof. Sanjay Gaikwad - ready to issue (0 of 5 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 7 DAY, '13:30:00')),
  -- 6 days ago
  ('04:BB:00:03', 'desk-pc-01',   'book',    'return',       'Returned "Database System Concepts (7th Ed.)" from Sneha Patil. Late by 2 days, fine Rs 4.00', TIMESTAMP(CURDATE() - INTERVAL 6 DAY, '10:05:00')),
  ('04:7C:1E:A2', 'phone-a91f3c', 'unknown', 'unregistered', 'Unregistered tag 04:7C:1E:A2', TIMESTAMP(CURDATE() - INTERVAL 6 DAY, '11:20:33')),
  ('04:AA:00:09', 'desk-pc-01',   'member',  'rejected',     'Yash Shinde - cannot borrow: member is blocked', TIMESTAMP(CURDATE() - INTERVAL 6 DAY, '15:42:10')),
  -- 5 days ago
  ('04:AA:00:01', 'desk-pc-01',   'member',  'member_ready', 'Aarav Kulkarni - ready to issue (0 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '11:01:48')),
  ('04:BB:00:01', 'desk-pc-01',   'book',    'issue',        CONCAT('Issued "Database System Concepts (7th Ed.)" to Aarav Kulkarni. Due ', DATE_FORMAT(CURDATE() + INTERVAL 9 DAY, '%d-%m-%Y')), TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '11:02:10')),
  ('04:BB:00:05', 'phone-a91f3c', 'book',    'info',         '"Operating System Concepts (10th Ed.)" by Abraham Silberschatz, Peter B. Galvin, Greg Gagne - shelf CS-1B - 2 of 2 copies available', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '12:15:00')),
  ('04:AA:00:08', 'desk-pc-01',   'member',  'rejected',     'Tanvi Gokhale - cannot borrow: unpaid fine of Rs 8.00', TIMESTAMP(CURDATE() - INTERVAL 5 DAY, '16:30:20')),
  -- 4 days ago
  ('04:AA:00:15', 'desk-pc-01',   'member',  'member_ready', 'Dr. Meera Deshpande - ready to issue (0 of 5 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '09:45:00')),
  ('04:BB:00:14', 'phone-a91f3c', 'book',    'info',         '"Digital Design (6th Ed.)" by M. Morris Mano, Michael D. Ciletti - shelf EC-1B - 1 of 1 copies available', TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '10:10:00')),
  ('04:AA:00:11', 'desk-pc-01',   'member',  'rejected',     'Pratik More - cannot borrow: unpaid fine of Rs 10.00', TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '13:05:00')),
  ('04:AA:00:07', 'desk-pc-01',   'member',  'member_ready', 'Siddharth Pawar - ready to issue (0 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 4 DAY, '14:30:00')),
  -- 3 days ago
  ('04:AA:00:01', 'desk-pc-01',   'member',  'member_ready', 'Aarav Kulkarni - ready to issue (1 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '14:20:05')),
  ('04:BB:00:06', 'desk-pc-01',   'book',    'issue',        CONCAT('Issued "Introduction to Algorithms (3rd Ed.)" to Aarav Kulkarni. Due ', DATE_FORMAT(CURDATE() + INTERVAL 11 DAY, '%d-%m-%Y')), TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '14:20:30')),
  ('04:52:9B:11', 'phone-a91f3c', 'unknown', 'unregistered', 'Unregistered tag 04:52:9B:11', TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '15:00:00')),
  ('04:BB:00:10', 'phone-a91f3c', 'book',    'info',         '"Let Us C (17th Ed.)" by Yashavant Kanetkar - shelf CS-2B - 2 of 2 copies available', TIMESTAMP(CURDATE() - INTERVAL 3 DAY, '16:10:00')),
  -- 2 days ago
  ('04:AA:00:04', 'desk-pc-01',   'member',  'member_ready', 'Priya Joshi - ready to issue (1 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '10:30:00')),
  ('04:BB:00:11', 'desk-pc-01',   'book',    'info',         '"Data Structures Using C (2nd Ed.)" by Reema Thareja - shelf CS-2C - 1 of 1 copies available', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '10:31:30')),
  ('04:AA:00:09', 'desk-pc-01',   'member',  'rejected',     'Yash Shinde - cannot borrow: member is blocked', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '11:45:00')),
  ('04:AA:00:12', 'desk-pc-01',   'member',  'member_ready', 'Neha Chavan - ready to issue (0 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '12:00:00')),
  ('04:AA:00:13', 'phone-a91f3c', 'member',  'member_ready', 'Aditya Sawant - ready to issue (0 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '15:15:00')),
  ('04:BB:00:09', 'phone-a91f3c', 'book',    'info',         '"Let Us C (17th Ed.)" by Yashavant Kanetkar - shelf CS-2B - 2 of 2 copies available', TIMESTAMP(CURDATE() - INTERVAL 2 DAY, '15:16:10')),
  -- yesterday
  ('04:AA:00:10', 'desk-pc-01',   'member',  'member_ready', 'Isha Bhosale - ready to issue (1 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '09:30:00')),
  ('04:BB:00:16', 'desk-pc-01',   'book',    'info',         '"Microprocessor Architecture, Programming and Applications with the 8085" by Ramesh S. Gaonkar - shelf EC-2A - 1 of 1 copies available', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '09:50:00')),
  ('04:AA:00:03', 'desk-pc-01',   'member',  'member_ready', 'Rohan Deshmukh - ready to issue (1 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '11:00:00')),
  ('04:E1:77:30', 'phone-a91f3c', 'unknown', 'unregistered', 'Unregistered tag 04:E1:77:30', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '12:40:00')),
  ('04:AA:00:08', 'desk-pc-01',   'member',  'rejected',     'Tanvi Gokhale - cannot borrow: unpaid fine of Rs 8.00', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '14:00:00')),
  ('04:AA:00:14', 'desk-pc-01',   'member',  'member_ready', 'Kavya Apte - ready to issue (0 of 3 books out). Scan a book within 60 s.', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '16:20:00')),
  ('04:BB:00:20', 'desk-pc-01',   'book',    'info',         '"Engineering Thermodynamics (6th Ed.)" by P. K. Nag - shelf ME-1C - 1 of 1 copies available', TIMESTAMP(CURDATE() - INTERVAL 1 DAY, '16:45:00'));
