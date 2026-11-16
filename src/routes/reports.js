// /api/reports - the 7 report queries from db/queries.sql
const router = require('express').Router();
const { pool } = require('../db');
const { httpError, toId } = require('../helpers');
const { loadReports } = require('../reports');

const reports = loadReports(); // read db/queries.sql once at start-up

// GET /api/reports  - list of available reports (for the dropdown)
router.get('/', (req, res) => {
  res.json(reports.map((r) => ({ no: r.no, name: r.name, title: r.title, notes: r.notes })));
});

// GET /api/reports/:name?member_id=1  - run one report
router.get('/:name', async (req, res) => {
  const report = reports.find((r) => r.name === req.params.name);
  if (!report) throw httpError(404, 'No report called ' + req.params.name);

  // queries.sql uses the session variable @member_id (handy in MySQL Workbench).
  // Here it becomes a ? placeholder so the value goes in as a prepared-statement parameter.
  let sql = report.sql;
  const params = [];
  if (sql.includes('@member_id')) {
    sql = sql.replace(/@member_id/g, '?');
    params.push(toId(req.query.member_id || 1, 'member_id'));
  }

  const [rows, fields] = await pool.execute(sql, params);
  res.json({
    name: report.name,
    title: report.title,
    notes: report.notes,
    sql: report.sql,
    columns: fields.map((f) => f.name),
    rows,
  });
});

module.exports = router;
