// engine.js
// Pure functions over the worry list. No DOM, no storage, no side effects.
// Everything here can be tested by calling it with plain data in the console.

export const DREAD_WORDS = {
  1: "a whisper",
  2: "a murmur",
  3: "unsettling",
  4: "feels heavy",
  5: "a knot in the stomach",
};

export const SEVERITY_WORDS = {
  0: "nothing at all",
  1: "barely anything",
  2: "mild",
  3: "noticeable",
  4: "hard",
  5: "as bad as feared",
};

export const OUTCOME_LABELS = {
  didntHappen: "didn't happen",
  partly: "smaller than feared",
  happened: "happened",
  obsolete: "no longer mattered",
};

export const MIN_RESOLVED_FOR_HEADLINE = 5;

// ---- dates ------------------------------------------------------------
// Dates are stored as local "YYYY-MM-DD" strings, which compare correctly
// as plain strings.

export function todayStr(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fromDate(date) {
  return todayStr(date);
}

export function plusDays(dateStr, n) {
  const d = toDate(dateStr);
  d.setDate(d.getDate() + n);
  return fromDate(d);
}

export function plusMonths(dateStr, n) {
  const d = toDate(dateStr);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  // If the month overflowed (e.g. Jan 31 + 1 month), clamp to month end.
  if (d.getDate() !== day) d.setDate(0);
  return fromDate(d);
}

// Days from `fromStr` to `toStr` (positive when `toStr` is later).
export function daysBetween(fromStr, toStr) {
  const ms = toDate(toStr) - toDate(fromStr);
  return Math.round(ms / 86400000);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Jul 18" for the current year, "Jul 18, 2027" otherwise.
export function formatDate(dateStr, today = todayStr()) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const sameYear = y === Number(today.slice(0, 4));
  return `${MONTHS[m - 1]} ${d}${sameYear ? "" : ", " + y}`;
}

// A gentle relative phrase for a check-in date.
export function describeCheckIn(dateStr, today = todayStr()) {
  const diff = daysBetween(today, dateStr);
  if (diff < 0) return `ready since ${formatDate(dateStr, today)}`;
  if (diff === 0) return "ready today";
  if (diff === 1) return "checks in tomorrow";
  if (diff < 14) return `checks in ${diff} days`;
  return `checks in ${formatDate(dateStr, today)}`;
}

// ---- grouping ----------------------------------------------------------

export function groupWorries(worries, today = todayStr()) {
  const ready = [];
  const waiting = [];
  const resolved = [];
  for (const w of worries) {
    if (w.resolution) resolved.push(w);
    else if (w.checkIn <= today) ready.push(w);
    else waiting.push(w);
  }
  const byCheckIn = (a, b) => (a.checkIn < b.checkIn ? -1 : a.checkIn > b.checkIn ? 1 : 0);
  ready.sort(byCheckIn);
  waiting.sort(byCheckIn);
  resolved.sort((a, b) =>
    a.resolution.resolvedOn < b.resolution.resolvedOn ? 1 : -1);
  return { ready, waiting, resolved };
}

export function categoriesOf(worries) {
  const set = new Set();
  for (const w of worries) {
    if (w.category) set.add(w.category);
  }
  return [...set].sort();
}

// ---- statistics ---------------------------------------------------------

export function outcomeTally(worries) {
  const t = { didntHappen: 0, partly: 0, happened: 0, obsolete: 0 };
  for (const w of worries) {
    if (w.resolution && t[w.resolution.outcome] !== undefined) {
      t[w.resolution.outcome] += 1;
    }
  }
  t.resolved = t.didntHappen + t.partly + t.happened + t.obsolete;
  // "considered" excludes obsolete worries from every statistic.
  t.considered = t.resolved - t.obsolete;
  return t;
}

// The headline statistic, gated behind the minimum-data rule.
export function headline(worries) {
  const tally = outcomeTally(worries);
  if (tally.considered >= MIN_RESOLVED_FOR_HEADLINE) {
    return { state: "ready", ...tally };
  }
  return {
    state: "forming",
    done: tally.considered,
    needed: MIN_RESOLVED_FOR_HEADLINE,
  };
}

// Segments for the outcome band chart, in display order.
export function bandSegments(worries) {
  const t = outcomeTally(worries);
  if (t.considered === 0) return [];
  return [
    { key: "didntHappen", count: t.didntHappen },
    { key: "partly", count: t.partly },
    { key: "happened", count: t.happened },
  ]
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, fraction: s.count / t.considered }));
}
