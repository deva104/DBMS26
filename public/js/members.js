// members.js - list / add / edit / delete members, view one member, pay fines.
const form = document.getElementById('memberForm');
const formMsg = document.getElementById('formMsg');
const listMsg = document.getElementById('listMsg');
let members = [];

async function loadMembers() {
  const q = document.getElementById('search').value.trim();
  members = await api('/api/members?q=' + encodeURIComponent(q));
  document.getElementById('list').innerHTML = makeTable(
    members,
    [
      ['member_id', 'ID'], ['prn', 'PRN'], ['name', 'Name'], ['department', 'Dept'], ['member_type', 'Type'],
      ['rfid_uid', 'Card UID'], ['books_out', 'Out'], ['max_books', 'Max'], ['unpaid_fines', 'Fine Rs'], ['status', 'Status'],
    ],
    (m) =>
      `<button onclick="viewMember(${m.member_id})">View</button> ` +
      `<button onclick="editMember(${m.member_id})">Edit</button> ` +
      `<button onclick="deleteMember(${m.member_id})">Delete</button>`
  );
}

async function loadFines() {
  const fines = await api('/api/fines?status=unpaid');
  document.getElementById('fines').innerHTML = makeTable(
    fines,
    [['fine_id', 'Fine'], ['member', 'Member'], ['title', 'Book'], ['due_date', 'Due'], ['return_date', 'Returned'], ['amount', 'Rs']],
    (f) => `<button onclick="payFine(${f.fine_id})">Mark paid</button>`
  );
}

// Save = POST for a new member, PUT when editing (hidden member_id is filled).
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = formData(form);
  const id = data.member_id;
  delete data.member_id;
  try {
    if (id) await api('/api/members/' + id, { method: 'PUT', body: data });
    else await api('/api/members', { method: 'POST', body: data });
    say(formMsg, id ? 'Member updated.' : 'Member added.');
    clearForm();
    await loadMembers();
  } catch (err) {
    say(formMsg, err.message, true);
  }
});

function clearForm() {
  form.reset();
  form.elements.member_id.value = '';
  document.getElementById('formTitle').textContent = 'Add member';
}
document.getElementById('clearBtn').addEventListener('click', () => {
  clearForm();
  formMsg.textContent = '';
});

function editMember(id) {
  const m = members.find((x) => x.member_id === id);
  fillForm(form, m);
  document.getElementById('formTitle').textContent = 'Edit member #' + id;
  formMsg.textContent = '';
  window.scrollTo(0, 0);
}

async function deleteMember(id) {
  if (!confirm('Delete member #' + id + '?')) return;
  try {
    await api('/api/members/' + id, { method: 'DELETE' });
    say(listMsg, 'Member deleted.');
    await loadMembers();
  } catch (err) {
    say(listMsg, err.message, true); // e.g. "has loan history" from FK RESTRICT
  }
}

async function viewMember(id) {
  const m = await api('/api/members/' + id);
  document.getElementById('detail').innerHTML =
    `<h3>${esc(m.name)} (${esc(m.prn)}) - books held now</h3>` +
    makeTable(m.current_books, [['title', 'Book'], ['rfid_tag', 'Tag'], ['issue_date', 'Issued'], ['due_date', 'Due']]) +
    '<h3>All fines of this member</h3>' +
    makeTable(m.fines, [['fine_id', 'Fine'], ['title', 'Book'], ['amount', 'Rs'], ['status', 'Status'], ['paid_on', 'Paid on']]);
}

async function payFine(id) {
  try {
    const r = await api('/api/fines/' + id + '/pay', { method: 'POST' });
    say(listMsg, r.message);
    await Promise.all([loadFines(), loadMembers()]);
  } catch (err) {
    say(listMsg, err.message, true);
  }
}

document.getElementById('search').addEventListener('input', loadMembers);
loadMembers();
loadFines();
