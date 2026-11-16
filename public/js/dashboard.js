// dashboard.js - polls GET /api/activity?since=<last log id> every 2 seconds.
// New scans are added on top; the issued / overdue lists reload when something changed.

let lastId = 0; // newest scan_logs.log_id we have shown
let lastCounts = ''; // counts from the previous poll, to notice changes
let logs = [];

async function loadLists() {
  const [open, overdue] = await Promise.all([api('/api/issues?status=open'), api('/api/issues?status=overdue')]);
  document.getElementById('overdue').innerHTML = makeTable(overdue, [
    ['member', 'Member'], ['department', 'Dept'], ['title', 'Book'], ['rfid_tag', 'Tag'],
    ['due_date', 'Due'], ['days_late', 'Days late'],
  ]);
  document.getElementById('issued').innerHTML = makeTable(open, [
    ['member', 'Member'], ['title', 'Book'], ['rfid_tag', 'Tag'], ['issue_date', 'Issued'], ['due_date', 'Due'], ['state', 'State'],
  ]);
}

function showCounts(c) {
  document.getElementById('c_members').textContent = c.members;
  document.getElementById('c_books').textContent = c.books;
  document.getElementById('c_out').textContent = c.copies_out + ' / ' + c.copies;
  document.getElementById('c_overdue').textContent = c.overdue;
  document.getElementById('c_fines').textContent = c.unpaid_fines + ' (Rs ' + c.unpaid_amount + ')';
}

async function poll() {
  try {
    const data = await api('/api/activity?since=' + lastId);
    if (data.last_id < lastId) logs = []; // database was re-seeded, start again

    const countsText = JSON.stringify(data.counts);
    const changed = data.logs.length > 0 || countsText !== lastCounts;

    if (data.logs.length > 0) {
      logs = data.logs.concat(logs).slice(0, 10); // newest first, keep 10
      document.getElementById('logs').innerHTML = makeTable(logs, [
        ['scanned_at', 'Time'], ['uid', 'UID'], ['device_id', 'Device'], ['action', 'Result'], ['message', 'Message'],
      ]);
    }
    lastId = data.last_id;
    showCounts(data.counts);
    if (changed) await loadLists();
    lastCounts = countsText;

    document.getElementById('status').textContent = 'Last update ' + new Date().toLocaleTimeString('en-IN');
    document.getElementById('status').className = 'small';
  } catch (err) {
    document.getElementById('status').textContent = 'Server not reachable: ' + err.message;
    document.getElementById('status').className = 'err';
  }
}

poll();
setInterval(poll, 2000);
