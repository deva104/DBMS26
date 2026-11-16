// reports.js - reads the 7 report queries from db/queries.sql.
// One source of truth: the same SQL is used by "npm run db:queries" and by
// GET /api/reports/:name, so what you show in the viva is what the app runs.
const fs = require('fs');
const path = require('path');

const QUERIES_FILE = path.join(__dirname, '..', 'db', 'queries.sql');

// Split queries.sql into blocks that start with "-- Qn name: title".
function loadReports() {
  const lines = fs.readFileSync(QUERIES_FILE, 'utf8').split(/\r?\n/);
  const reports = [];
  let current = null;
  for (const line of lines) {
    const header = line.match(/^-- Q(\d+) (\w+): (.+)$/);
    if (header) {
      current = { no: Number(header[1]), name: header[2], title: header[3].trim(), notes: [], sqlLines: [] };
      reports.push(current);
    } else if (current && line.startsWith('--')) {
      current.notes.push(line.replace(/^--\s?/, ''));
    } else if (current) {
      current.sqlLines.push(line);
    }
  }
  return reports.map((r) => ({
    no: r.no,
    name: r.name,
    title: r.title,
    notes: r.notes.join(' '),
    sql: r.sqlLines.join('\n').trim().replace(/;$/, ''),
  }));
}

module.exports = { loadReports };
