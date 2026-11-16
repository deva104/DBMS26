// reports.js - pick one of the 7 reports, run it, show the table and its SQL.
const select = document.getElementById('reportSelect');
const memberBox = document.getElementById('memberBox');

async function init() {
  const [reports, members] = await Promise.all([api('/api/reports'), api('/api/members')]);
  select.innerHTML = reports.map((r) => `<option value="${r.name}">Q${r.no}. ${esc(r.title)}</option>`).join('');
  document.getElementById('memberSelect').innerHTML = members
    .map((m) => `<option value="${m.member_id}">${esc(m.name)} (${m.books_out} out)</option>`)
    .join('');
  select.addEventListener('change', () => {
    memberBox.style.display = select.value === 'member_books' ? '' : 'none';
    runReport();
  });
  runReport();
}

async function runReport() {
  let url = '/api/reports/' + select.value;
  if (select.value === 'member_books') url += '?member_id=' + document.getElementById('memberSelect').value;
  try {
    const r = await api(url);
    document.getElementById('notes').textContent = r.notes;
    document.getElementById('result').innerHTML =
      makeTable(r.rows, r.columns.map((c) => [c, c])) + `<p class="small">${r.rows.length} rows</p>`;
    document.getElementById('sql').textContent = r.sql;
    document.getElementById('msg').textContent = '';
  } catch (err) {
    say(document.getElementById('msg'), err.message, true);
  }
}

document.getElementById('reportForm').addEventListener('submit', (e) => {
  e.preventDefault();
  runReport();
});

init();
