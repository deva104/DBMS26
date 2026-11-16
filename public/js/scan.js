// scan.js - scan desk page. A UID comes from Web NFC or the "Type UID" box
// and is sent to POST /api/scan together with this device's id.

// A random id for this phone / PC, remembered in localStorage. The server uses it
// to match "member card scan" and "book scan" made on the SAME device.
let deviceId = localStorage.getItem('device_id');
if (!deviceId) {
  deviceId = 'dev-' + Math.random().toString(16).slice(2, 10);
  localStorage.setItem('device_id', deviceId);
}
document.getElementById('deviceId').textContent = deviceId;

const resultBox = document.getElementById('result');
const COLOURS = { member_ready: 'green', issue: 'green', return: 'green', info: 'grey', rejected: 'red', unregistered: 'red' };
const lastScans = [];

async function sendScan(uid) {
  resultBox.className = 'msg grey';
  resultBox.textContent = 'Checking ' + uid + ' ...';
  try {
    const r = await api('/api/scan', { method: 'POST', body: { uid: uid, device_id: deviceId } });
    resultBox.className = 'msg ' + (COLOURS[r.action] || 'grey');
    resultBox.innerHTML = '<b>' + esc(r.action.replace('_', ' ').toUpperCase()) + '</b><br>' + esc(r.message);
    addToHistory(r.uid, r.action, r.message);
  } catch (err) {
    resultBox.className = 'msg red';
    resultBox.textContent = 'Error: ' + err.message;
    addToHistory(uid, 'error', err.message);
  }
}

function addToHistory(uid, action, message) {
  lastScans.unshift({ time: new Date().toLocaleTimeString('en-IN'), uid: uid, action: action, message: message });
  if (lastScans.length > 5) lastScans.pop();
  document.getElementById('history').innerHTML = makeTable(lastScans, [
    ['time', 'Time'], ['uid', 'UID'], ['action', 'Result'], ['message', 'Message'],
  ]);
}

// ---------- typed UID (works on any browser) ----------
const uidInput = document.getElementById('uidInput');
document.getElementById('typeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const uid = uidInput.value.trim();
  if (uid) sendScan(uid);
  uidInput.value = '';
  uidInput.focus();
});

// Suggestions for the UID box (member cards and book tags from the database).
async function loadSuggestions() {
  try {
    const [members, copies] = await Promise.all([api('/api/members'), api('/api/copies')]);
    let html = '';
    for (const m of members) if (m.rfid_uid) html += '<option value="' + esc(m.rfid_uid) + '">member: ' + esc(m.name) + '</option>';
    for (const c of copies) html += '<option value="' + esc(c.rfid_tag) + '">book: ' + esc(c.title) + ' (' + c.status + ')</option>';
    document.getElementById('uidList').innerHTML = html;
  } catch (err) {
    // suggestions are optional
  }
}
loadSuggestions();

// ---------- Web NFC (Chrome on Android, HTTPS only) ----------
const nfcBtn = document.getElementById('nfcBtn');
const nfcStatus = document.getElementById('nfcStatus');
const nfcSupported = 'NDEFReader' in window;
if (!nfcSupported) {
  nfcStatus.textContent = 'Web NFC is not supported here (it needs Chrome on Android over HTTPS). Type the UID instead.';
}

let lastUid = '';
let lastTime = 0;

nfcBtn.addEventListener('click', async () => {
  if (!nfcSupported) {
    resultBox.className = 'msg red';
    resultBox.textContent = 'Web NFC is not supported on this browser/device. Use Chrome on an Android phone, or type the UID.';
    return;
  }
  try {
    const reader = new NDEFReader();
    await reader.scan(); // Chrome asks for NFC permission the first time (needs a button tap)
    nfcBtn.disabled = true;
    nfcStatus.textContent = 'NFC is on. Hold a tag against the back of the phone.';

    reader.onreading = (event) => {
      const uid = event.serialNumber; // e.g. "04:a2:3b:c1:5d:80:00"
      if (!uid) {
        nfcStatus.textContent = 'This tag has no serial number.';
        return;
      }
      // the same tag is often read twice while it is held near the phone - ignore repeats for 3 s
      if (uid === lastUid && Date.now() - lastTime < 3000) return;
      lastUid = uid;
      lastTime = Date.now();
      sendScan(uid);
    };
    reader.onreadingerror = () => {
      nfcStatus.textContent = 'Could not read that tag. Try again (the tag may need to be NDEF formatted).';
    };
  } catch (err) {
    nfcStatus.textContent = 'NFC error: ' + err.message + ' (is NFC switched on in phone settings?)';
  }
});
