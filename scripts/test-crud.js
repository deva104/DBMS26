// npm run test:crud
// Smoke-tests every API route against the real database: CRUD for categories,
// books, copies and members (plus friendly errors), issues, fines, reports,
// activity and health. Test rows are named "TEST ..." and removed at the end.
const { pool } = require('../src/db');
const { startServer, stopServer, api, check, summary } = require('./test-utils');

const tag = 'C0:FF:EE:01'; // test copy tag
const uid = 'C0:FF:EE:02'; // test member card

async function cleanup() {
  await pool.query('DELETE FROM book_copies WHERE rfid_tag = ?', [tag]);
  await pool.query("DELETE FROM members WHERE prn = 'TEST-CRUD-1'");
  await pool.query("DELETE FROM books WHERE isbn = 'TEST-ISBN-0001'");
  await pool.query("DELETE FROM categories WHERE name LIKE 'TEST Category%'");
}

const is = (r, status) => r.status === status;
const show = (r) => `${r.status} ${JSON.stringify(r.body).slice(0, 160)}`;

async function main() {
  await cleanup();
  await startServer();

  console.log('Health');
  let r = await api('GET', '/api/health');
  check('GET /api/health -> ok', is(r, 200) && r.body.ok === true, show(r));

  // ---------------- categories ----------------
  console.log('\nCategories');
  r = await api('GET', '/api/categories');
  check('GET list (6 seeded)', is(r, 200) && r.body.length >= 6, show(r));
  r = await api('POST', '/api/categories', { name: 'TEST Category' });
  check('POST create -> 201', is(r, 201), show(r));
  const catId = r.body.category_id;
  r = await api('GET', `/api/categories/${catId}`);
  check('GET one', is(r, 200) && r.body.name === 'TEST Category', show(r));
  r = await api('PUT', `/api/categories/${catId}`, { name: 'TEST Category renamed' });
  check('PUT update', is(r, 200) && r.body.name === 'TEST Category renamed', show(r));
  r = await api('POST', '/api/categories', { name: 'Computer Science' });
  check('POST duplicate name -> 409', is(r, 409), show(r));
  r = await api('POST', '/api/categories', {});
  check('POST without name -> 400', is(r, 400), show(r));
  r = await api('DELETE', '/api/categories/1');
  check('DELETE category that has books -> 409 friendly message', is(r, 409) && /still has books/.test(r.body.error), show(r));
  r = await api('GET', '/api/categories/abc');
  check('GET with bad id -> 400', is(r, 400), show(r));

  // ---------------- books ----------------
  console.log('\nBooks');
  r = await api('GET', '/api/books');
  check('GET list (18 seeded)', is(r, 200) && r.body.length >= 18, show(r));
  r = await api('GET', '/api/books?q=Database');
  check('GET list ?q=Database finds the DBMS book', is(r, 200) && r.body.some((b) => b.book_id === 1), show(r));
  const book = { isbn: 'TEST-ISBN-0001', title: 'TEST Book', author: 'Test Author', publisher: 'Test Press', pub_year: 2024, category_id: catId };
  r = await api('POST', '/api/books', book);
  check('POST create -> 201', is(r, 201), show(r));
  const bookId = r.body.book_id;
  r = await api('GET', `/api/books/${bookId}`);
  check('GET one (with empty copies list)', is(r, 200) && Array.isArray(r.body.copies) && r.body.copies.length === 0, show(r));
  r = await api('PUT', `/api/books/${bookId}`, { ...book, title: 'TEST Book 2nd Ed.' });
  check('PUT update', is(r, 200) && r.body.title === 'TEST Book 2nd Ed.', show(r));
  r = await api('POST', '/api/books', { ...book });
  check('POST duplicate ISBN -> 409', is(r, 409), show(r));
  r = await api('POST', '/api/books', { ...book, isbn: 'TEST-ISBN-0002', category_id: 99999 });
  check('POST with missing category -> 400', is(r, 400), show(r));
  r = await api('POST', '/api/books', { ...book, isbn: 'TEST-ISBN-0003', pub_year: 1500 });
  check('POST with pub_year 1500 -> 400 (CHECK constraint)', is(r, 400) && /pub_year/.test(r.body.error), show(r));
  r = await api('DELETE', '/api/books/1');
  check('DELETE book that has copies -> 409 friendly message', is(r, 409) && /still has copies/.test(r.body.error), show(r));

  // ---------------- copies ----------------
  console.log('\nCopies');
  r = await api('POST', '/api/copies', { book_id: bookId, rfid_tag: 'c0ffee01', shelf_location: 'T-1' });
  check('POST create -> 201, tag normalised to C0:FF:EE:01', is(r, 201) && r.body.rfid_tag === tag, show(r));
  const copyId = r.body.copy_id;
  r = await api('GET', `/api/copies?book_id=${bookId}`);
  check('GET list ?book_id=', is(r, 200) && r.body.length === 1, show(r));
  r = await api('GET', '/api/copies');
  check('GET list (all, 25 seeded)', is(r, 200) && r.body.length >= 26, show(r));
  r = await api('GET', `/api/copies/${copyId}`);
  check('GET one', is(r, 200) && r.body.title === 'TEST Book 2nd Ed.', show(r));
  r = await api('PUT', `/api/copies/${copyId}`, { book_id: bookId, rfid_tag: tag, shelf_location: 'T-2', status: 'lost' });
  check('PUT update (shelf + lost)', is(r, 200) && r.body.status === 'lost' && r.body.shelf_location === 'T-2', show(r));
  r = await api('POST', '/api/copies', { book_id: bookId, rfid_tag: tag });
  check('POST duplicate tag -> 409', is(r, 409), show(r));
  r = await api('POST', '/api/copies', { book_id: bookId, rfid_tag: '04:AA:00:01' });
  check('POST tag already used by a member card -> 409', is(r, 409) && /member card/.test(r.body.error), show(r));
  r = await api('PUT', '/api/copies/1', { book_id: 1, rfid_tag: '04:BB:00:01', shelf_location: 'CS-1A', status: 'available' });
  check('PUT issued copy to available -> 409 (must scan to return)', is(r, 409), show(r));
  r = await api('DELETE', '/api/copies/1');
  check('DELETE copy with loan history -> 409 friendly message', is(r, 409) && /loan history/.test(r.body.error), show(r));
  r = await api('DELETE', `/api/copies/${copyId}`);
  check('DELETE test copy -> 200', is(r, 200), show(r));
  r = await api('GET', `/api/copies/${copyId}`);
  check('GET deleted copy -> 404', is(r, 404), show(r));

  r = await api('DELETE', `/api/books/${bookId}`);
  check('DELETE test book -> 200', is(r, 200), show(r));
  r = await api('DELETE', `/api/categories/${catId}`);
  check('DELETE test category -> 200', is(r, 200), show(r));
  r = await api('GET', `/api/categories/${catId}`);
  check('GET deleted category -> 404', is(r, 404), show(r));

  // ---------------- members ----------------
  console.log('\nMembers');
  r = await api('GET', '/api/members');
  check('GET list (18 seeded, with books_out and unpaid_fines)', is(r, 200) && r.body.length >= 18 && 'books_out' in r.body[0], show(r));
  const mem = { prn: 'TEST-CRUD-1', name: 'TEST Member', email: 'test.crud@college.edu.in', phone: '9876543210', department: 'Civil', member_type: 'faculty', rfid_uid: uid };
  r = await api('POST', '/api/members', mem);
  check('POST create -> 201 (faculty gets max_books 5)', is(r, 201) && r.body.max_books === 5, show(r));
  const memberId = r.body.member_id;
  r = await api('GET', `/api/members/${memberId}`);
  check('GET one (with current_books and fines)', is(r, 200) && Array.isArray(r.body.current_books), show(r));
  r = await api('PUT', `/api/members/${memberId}`, { ...mem, name: 'TEST Member Renamed', status: 'blocked' });
  check('PUT update', is(r, 200) && r.body.status === 'blocked', show(r));
  r = await api('POST', '/api/members', { ...mem, prn: 'TEST-CRUD-2', email: 'x@college.edu.in', rfid_uid: null, phone: '12345' });
  check('POST bad phone -> 400 (CHECK constraint)', is(r, 400) && /phone/.test(r.body.error), show(r));
  r = await api('POST', '/api/members', { ...mem, prn: 'TEST-CRUD-2', email: 'y@college.edu.in', rfid_uid: null, department: 'Arts' });
  check('POST bad department -> 400 (CHECK constraint)', is(r, 400) && /department/.test(r.body.error), show(r));
  r = await api('POST', '/api/members', { ...mem, prn: 'TEST-CRUD-2', rfid_uid: null });
  check('POST duplicate email -> 409', is(r, 409) && /email/.test(r.body.error), show(r));
  r = await api('POST', '/api/members', { ...mem, prn: 'TEST-CRUD-2', email: 'z@college.edu.in', member_type: 'alien', rfid_uid: null });
  check('POST bad member_type -> 400', is(r, 400), show(r));
  r = await api('DELETE', '/api/members/1');
  check('DELETE member with loan history -> 409 friendly message', is(r, 409) && /loan history/.test(r.body.error), show(r));
  r = await api('DELETE', `/api/members/${memberId}`);
  check('DELETE test member -> 200', is(r, 200), show(r));
  r = await api('GET', `/api/members/${memberId}`);
  check('GET deleted member -> 404', is(r, 404), show(r));

  // ---------------- issues & fines ----------------
  console.log('\nIssues and fines');
  r = await api('GET', '/api/issues?status=open');
  check('GET /api/issues?status=open', is(r, 200) && r.body.every((i) => i.return_date === null), show(r));
  r = await api('GET', '/api/issues?status=overdue');
  check('GET /api/issues?status=overdue (all overdue)', is(r, 200) && r.body.length > 0 && r.body.every((i) => i.state === 'overdue'), show(r));
  r = await api('GET', '/api/issues?status=all');
  check('GET /api/issues?status=all', is(r, 200) && r.body.length >= 20, show(r));
  r = await api('GET', '/api/issues?status=bad');
  check('GET /api/issues?status=bad -> 400', is(r, 400), show(r));
  r = await api('GET', '/api/fines?status=unpaid');
  check('GET /api/fines?status=unpaid', is(r, 200) && r.body.every((f) => f.status === 'unpaid'), show(r));
  r = await api('POST', '/api/fines/1/pay');
  check('POST pay an already paid fine -> 409', is(r, 409), show(r));
  r = await api('POST', '/api/fines/999999/pay');
  check('POST pay a missing fine -> 404', is(r, 404), show(r));

  // ---------------- reports ----------------
  console.log('\nReports');
  r = await api('GET', '/api/reports');
  check('GET /api/reports lists 7 reports', is(r, 200) && r.body.length === 7, show(r));
  for (const rep of r.body || []) {
    const out = await api('GET', `/api/reports/${rep.name}`);
    check(`GET /api/reports/${rep.name} (${out.body?.rows?.length} rows)`, is(out, 200) && Array.isArray(out.body.rows), show(out));
  }
  r = await api('GET', '/api/reports/member_books?member_id=1');
  check('member_books for member 1 (Aarav holds 2 books)', is(r, 200) && r.body.rows.length === 2, show(r));
  r = await api('GET', '/api/reports/nope');
  check('unknown report -> 404', is(r, 404), show(r));

  // ---------------- activity & misc ----------------
  console.log('\nActivity and misc');
  r = await api('GET', '/api/activity?since=0');
  check('GET /api/activity?since=0 (logs + counts)', is(r, 200) && r.body.logs.length > 0 && r.body.counts.members >= 18, show(r));
  const last = r.body.last_id;
  r = await api('GET', `/api/activity?since=${last}`);
  check('GET /api/activity?since=last_id -> no new logs', is(r, 200) && r.body.logs.length === 0, show(r));
  r = await api('GET', '/api/activity?since=-5');
  check('GET /api/activity?since=-5 -> 400', is(r, 400), show(r));
  r = await api('GET', '/api/nothing-here');
  check('unknown /api route -> 404 JSON', is(r, 404) && r.body.error, show(r));
  r = await api('POST', '/api/members', '{bad json');
  check('invalid JSON body -> 400', is(r, 400), show(r));
}

main()
  .catch((err) => check('test crashed', false, err.stack))
  .finally(async () => {
    await stopServer();
    await cleanup();
    console.log('(test rows removed)');
    await pool.end();
    process.exit(summary() ? 0 : 1);
  });
