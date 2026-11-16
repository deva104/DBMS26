// books.js - books CRUD, the copies of a selected book, and categories.
const bookForm = document.getElementById('bookForm');
const copyForm = document.getElementById('copyForm');
const listMsg = document.getElementById('listMsg');
let books = [];
let copies = [];
let currentBook = null; // book whose copies are shown

// ---------- books ----------
async function loadBooks() {
  const q = document.getElementById('search').value.trim();
  books = await api('/api/books?q=' + encodeURIComponent(q));
  document.getElementById('books').innerHTML = makeTable(
    books,
    [
      ['book_id', 'ID'], ['isbn', 'ISBN'], ['title', 'Title'], ['author', 'Author'], ['category', 'Category'],
      ['pub_year', 'Year'], ['copies', 'Copies'], ['available', 'Available'],
    ],
    (b) =>
      `<button onclick="showCopies(${b.book_id})">Copies</button> ` +
      `<button onclick="editBook(${b.book_id})">Edit</button> ` +
      `<button onclick="deleteBook(${b.book_id})">Delete</button>`
  );
}

bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(bookForm);
  const id = data.book_id;
  delete data.book_id;
  try {
    if (id) await api('/api/books/' + id, { method: 'PUT', body: data });
    else await api('/api/books', { method: 'POST', body: data });
    say(document.getElementById('bookMsg'), id ? 'Book updated.' : 'Book added.');
    clearBookForm();
    await loadBooks();
  } catch (err) {
    say(document.getElementById('bookMsg'), err.message, true);
  }
});

function clearBookForm() {
  bookForm.reset();
  bookForm.elements.book_id.value = '';
  document.getElementById('bookFormTitle').textContent = 'Add book';
}
document.getElementById('bookClear').addEventListener('click', clearBookForm);

function editBook(id) {
  fillForm(bookForm, books.find((b) => b.book_id === id));
  document.getElementById('bookFormTitle').textContent = 'Edit book #' + id;
  window.scrollTo(0, 0);
}

async function deleteBook(id) {
  if (!confirm('Delete book #' + id + '?')) return;
  try {
    await api('/api/books/' + id, { method: 'DELETE' });
    say(listMsg, 'Book deleted.');
    await loadBooks();
  } catch (err) {
    say(listMsg, err.message, true); // e.g. "still has copies"
  }
}

// ---------- copies of one book ----------
async function showCopies(bookId) {
  currentBook = books.find((b) => b.book_id === bookId);
  copies = await api('/api/copies?book_id=' + bookId);
  document.getElementById('copiesSection').style.display = '';
  document.getElementById('copiesTitle').textContent = 'Copies of "' + currentBook.title + '"';
  document.getElementById('copies').innerHTML = makeTable(
    copies,
    [['copy_id', 'Copy'], ['rfid_tag', 'RFID tag'], ['shelf_location', 'Shelf'], ['status', 'Status'], ['added_on', 'Added']],
    (c) => `<button onclick="editCopy(${c.copy_id})">Edit</button> <button onclick="deleteCopy(${c.copy_id})">Delete</button>`
  );
  clearCopyForm();
  document.getElementById('copiesSection').scrollIntoView();
}

copyForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(copyForm);
  const id = data.copy_id;
  delete data.copy_id;
  data.book_id = currentBook.book_id;
  try {
    if (id) await api('/api/copies/' + id, { method: 'PUT', body: data });
    else await api('/api/copies', { method: 'POST', body: data });
    await showCopies(currentBook.book_id);
    await loadBooks();
    say(document.getElementById('copyMsg'), id ? 'Copy updated.' : 'Copy added.');
  } catch (err) {
    say(document.getElementById('copyMsg'), err.message, true);
  }
});

function clearCopyForm() {
  copyForm.reset();
  copyForm.elements.copy_id.value = '';
  document.getElementById('copyFormTitle').textContent = 'Add copy';
  document.getElementById('copyMsg').textContent = '';
}
document.getElementById('copyClear').addEventListener('click', clearCopyForm);

function editCopy(id) {
  fillForm(copyForm, copies.find((c) => c.copy_id === id));
  document.getElementById('copyFormTitle').textContent = 'Edit copy #' + id;
}

async function deleteCopy(id) {
  if (!confirm('Delete copy #' + id + '?')) return;
  try {
    await api('/api/copies/' + id, { method: 'DELETE' });
    await showCopies(currentBook.book_id);
    await loadBooks();
    say(document.getElementById('copyMsg'), 'Copy deleted.');
  } catch (err) {
    say(document.getElementById('copyMsg'), err.message, true); // e.g. "has loan history"
  }
}

// ---------- categories ----------
async function loadCategories() {
  const cats = await api('/api/categories');
  document.getElementById('catSelect').innerHTML = cats
    .map((c) => `<option value="${c.category_id}">${esc(c.name)}</option>`)
    .join('');
  document.getElementById('cats').innerHTML = makeTable(
    cats,
    [['category_id', 'ID'], ['name', 'Name'], ['books', 'Books']],
    (c) => `<button onclick="renameCategory(${c.category_id})">Rename</button> <button onclick="deleteCategory(${c.category_id})">Delete</button>`
  );
}

document.getElementById('catForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('catMsg');
  try {
    await api('/api/categories', { method: 'POST', body: formData(e.target) });
    e.target.reset();
    say(msg, 'Category added.');
    await loadCategories();
  } catch (err) {
    say(msg, err.message, true);
  }
});

async function renameCategory(id) {
  const name = prompt('New name for category #' + id);
  if (!name) return;
  try {
    await api('/api/categories/' + id, { method: 'PUT', body: { name: name } });
    await Promise.all([loadCategories(), loadBooks()]);
  } catch (err) {
    say(document.getElementById('catMsg'), err.message, true);
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete category #' + id + '?')) return;
  try {
    await api('/api/categories/' + id, { method: 'DELETE' });
    say(document.getElementById('catMsg'), 'Category deleted.');
    await loadCategories();
  } catch (err) {
    say(document.getElementById('catMsg'), err.message, true); // "still has books"
  }
}

document.getElementById('search').addEventListener('input', loadBooks);
loadCategories();
loadBooks();
