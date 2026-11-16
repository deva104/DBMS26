// test-utils.js - tiny test helpers: start the app on a free port, call the API, count pass/fail.
const app = require('../src/server');

let baseUrl = '';
let server = null;
const results = { pass: 0, fail: 0 };

async function startServer() {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve); // port 0 = any free port
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  return baseUrl;
}

async function stopServer() {
  if (server) await new Promise((resolve) => server.close(resolve));
}

// api('POST', '/api/scan', { uid, device_id }) -> { status, body }
async function api(method, path, body) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

// Print PASS/FAIL for one check.
function check(name, ok, detail = '') {
  if (ok) {
    results.pass++;
    console.log('  PASS  ' + name);
  } else {
    results.fail++;
    console.log('  FAIL  ' + name + (detail ? '\n        -> ' + detail : ''));
  }
  return ok;
}

function summary() {
  console.log(`\n${results.pass} passed, ${results.fail} failed`);
  return results.fail === 0;
}

module.exports = { startServer, stopServer, api, check, summary };
