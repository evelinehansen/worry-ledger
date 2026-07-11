// storage.js
// Everything that touches localStorage or backup files lives here.
// The rest of the app treats this module as its only door to persistence.

const DATA_KEY = "worryLedger.v1";
const BACKUP_KEY = "worryLedger.lastBackup";
export const SCHEMA_VERSION = 1;

export function freshData() {
  const now = new Date().toISOString();
  return { schemaVersion: SCHEMA_VERSION, created: now, modified: now, worries: [] };
}

export function load() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (!raw) return freshData();
    const data = JSON.parse(raw);
    if (data.schemaVersion !== SCHEMA_VERSION || !Array.isArray(data.worries)) {
      return freshData();
    }
    return data;
  } catch {
    return freshData();
  }
}

export function save(data) {
  data.modified = new Date().toISOString();
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

// ---- backups -------------------------------------------------------------

export function lastBackupISO() {
  return localStorage.getItem(BACKUP_KEY);
}

export function markBackupNow() {
  localStorage.setItem(BACKUP_KEY, new Date().toISOString());
}

// Triggers a download of the whole ledger as a readable .json file.
export function exportToFile(data) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `worry-ledger-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  markBackupNow();
}

// Parses the text of an imported file. Returns { ok: true, data }
// or { ok: false, error } with a message the UI can show as-is.
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not readable as JSON." };
  }
  if (!data || typeof data !== "object" || !Array.isArray(data.worries)) {
    return { ok: false, error: "That file does not look like a Worry Ledger backup." };
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      error: `That backup uses schema version ${data.schemaVersion ?? "unknown"}, which this version of the app cannot read.`,
    };
  }
  for (const w of data.worries) {
    if (!w || typeof w.id !== "string" || typeof w.text !== "string" || typeof w.checkIn !== "string") {
      return { ok: false, error: "That backup contains entries this app cannot understand." };
    }
  }
  return { ok: true, data };
}

// Merge: keep everything from both. On an id collision, prefer whichever
// version has a resolution recorded (a check-in is never lost); otherwise
// keep the current one.
export function mergeData(current, incoming) {
  const byId = new Map(current.worries.map((w) => [w.id, w]));
  for (const w of incoming.worries) {
    const existing = byId.get(w.id);
    if (!existing || (w.resolution && !existing.resolution)) {
      byId.set(w.id, w);
    }
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    created: current.created < incoming.created ? current.created : incoming.created,
    modified: new Date().toISOString(),
    worries: [...byId.values()],
  };
}
