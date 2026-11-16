// common.js - small helpers used by every page

// Call our API. Throws an Error with the server's message when the request fails.
async function api(path, options = {}) {
  const opts = { method: options.method || 'GET', headers: {} };
  if (options.body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
  return data;
}

// Escape text before putting it into HTML.
function esc(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// Build an HTML table.
// columns: [['key', 'Heading'], ...]; actions(row) may return extra HTML for a last column.
function makeTable(rows, columns, actions) {
  if (!rows || rows.length === 0) return '<p class="small">No rows.</p>';
  let html = '<div class="wrap"><table><tr>';
  for (const [, label] of columns) html += '<th>' + esc(label) + '</th>';
  if (actions) html += '<th></th>';
  html += '</tr>';
  for (const row of rows) {
    html += '<tr>';
    for (const [key] of columns) html += '<td>' + esc(row[key]) + '</td>';
    if (actions) html += '<td class="act">' + actions(row) + '</td>';
    html += '</tr>';
  }
  return html + '</table></div>';
}

// Read all named inputs of a form into an object.
function formData(form) {
  const data = {};
  for (const el of form.elements) {
    if (el.name) data[el.name] = el.value.trim();
  }
  return data;
}

// Put an object's values into the form's inputs with the same names.
function fillForm(form, obj) {
  for (const el of form.elements) {
    if (el.name) el.value = obj[el.name] === null || obj[el.name] === undefined ? '' : obj[el.name];
  }
}

// Show a message in an element (class ok / err).
function say(el, text, isError) {
  el.className = isError ? 'err' : 'ok';
  el.textContent = text;
}
