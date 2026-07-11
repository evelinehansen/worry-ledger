// app.js
// Wires the DOM to the engine (pure statistics) and storage (persistence).

import {
  DREAD_WORDS, SEVERITY_WORDS, OUTCOME_LABELS,
  todayStr, plusDays, plusMonths, daysBetween, formatDate, describeCheckIn,
  groupWorries, categoriesOf, outcomeTally, headline, bandSegments,
} from "./engine.js";

import {
  load, save, exportToFile, parseImport, mergeData,
  lastBackupISO, markBackupNow,
} from "./storage.js";

let data = load();
let currentView = "today";
let enteringId = null; // worry that should animate onto the shelf

const $ = (sel) => document.querySelector(sel);

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function persist() {
  save(data);
}

// ---- toast -----------------------------------------------------------------

let toastTimer = null;
function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---- view switching -----------------------------------------------------------

function switchView(view) {
  currentView = view;
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle("is-active", active);
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  $("#view-today").hidden = view !== "today";
  $("#view-pattern").hidden = view !== "pattern";
  $("#view-lot").hidden = view !== "lot";
  $("#view-history").hidden = view !== "history";
  render();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchView(tab.dataset.view));
});

// ---- rendering ------------------------------------------------------------------

function render() {
  if (currentView === "today") renderToday();
  if (currentView === "pattern") renderPattern();
  if (currentView === "lot") renderLot();
  if (currentView === "history") renderHistory();
  renderBackupStatus();
  renderTabBadge();
}

// The Today tab badge shows how many check-ins are due.
function renderTabBadge() {
  const badge = $("#today-badge");
  const { ready } = groupWorries(data.worries);
  badge.textContent = ready.length;
  badge.hidden = ready.length === 0;
}

function worryCardHTML(w, { ready = false } = {}) {
  const today = todayStr();
  const meta = [];
  meta.push(`<span class="dread-dot" data-dread="${w.dread}" title="dread ${w.dread} of 5"></span>`);
  meta.push(`<span>dread ${w.dread} of 5, ${esc(DREAD_WORDS[w.dread])}</span>`);
  meta.push(`<span>${esc(describeCheckIn(w.checkIn, today))}</span>`);
  if (w.category) meta.push(`<span class="category-chip">${esc(w.category)}</span>`);
  return `
    <div class="worry-card card ${ready ? "is-ready" : ""} ${w.id === enteringId ? "entering" : ""}"
         data-id="${w.id}" data-dread="${w.dread}"
         ${ready ? `role="button" tabindex="0" aria-label="Check in on this worry"` : ""}>
      <p class="worry-text">${esc(w.text)}</p>
      <div class="worry-meta">${meta.join("")}</div>
      ${ready ? `<span class="ready-hint">Tap to check in</span>` : ""}
      <button class="worry-delete" data-delete="${w.id}" aria-label="Delete this worry">&times;</button>
    </div>`;
}

// Today shows only what needs the user now: due check-ins, or permission
// to not worry. Everything else waits in the parking lot.
function renderToday() {
  const el = $("#today-content");
  const today = todayStr();
  const { ready, waiting, resolved } = groupWorries(data.worries, today);

  if (data.worries.length === 0) {
    el.innerHTML = `
      <div class="empty-state card">
        <h2 class="empty-title">A place to put worries down</h2>
        <ol class="empty-steps">
          <li>Write the worry down and give it a check-in date.</li>
          <li>When that date comes, record what actually happened.</li>
          <li>Watch your own evidence build, one check-in at a time.</li>
        </ol>
        <button class="btn primary" id="park-first-btn">Park your first worry</button>
        <p class="empty-note">This is a journal, not therapy. If worry feels overwhelming, support from a professional can make a real difference.</p>
      </div>`;
    $("#park-first-btn").addEventListener("click", openCapture);
    enteringId = null;
    return;
  }

  if (ready.length > 0) {
    el.innerHTML = `
      <h2 class="section-h">Ready to check</h2>
      <div class="worry-list">${ready.map((w) => worryCardHTML(w, { ready: true })).join("")}</div>`;
    enteringId = null;
    return;
  }

  let sub;
  if (waiting.length > 0) {
    const next = waiting[0].checkIn;
    sub = `${waiting.length} worr${waiting.length === 1 ? "y is" : "ies are"} parked and waiting. The next check-in is ${formatDate(next, today)}. Until then, they can wait without you.`;
  } else {
    sub = `Nothing is parked right now. Your ${resolved.length === 1 ? "checked worry rests" : "checked worries rest"} in History.`;
  }
  el.innerHTML = `
    <div class="today-clear card">
      <p class="today-clear-title serif">Nothing to check today.</p>
      <p class="today-clear-sub">${sub}</p>
    </div>`;
  enteringId = null;
}

function renderLot() {
  const el = $("#lot-content");
  const { ready, waiting } = groupWorries(data.worries);

  if (ready.length === 0 && waiting.length === 0) {
    el.innerHTML = `<p class="quiet-note">The parking lot is empty. Park a worry and it will wait here, not in your head.</p>`;
    enteringId = null;
    return;
  }

  let html = "";
  if (ready.length > 0) {
    html += `<h2 class="section-h">Ready to check</h2>
      <div class="worry-list">${ready.map((w) => worryCardHTML(w, { ready: true })).join("")}</div>`;
  }
  if (waiting.length > 0) {
    html += `<h2 class="section-h">Waiting</h2>
      <div class="worry-list">${waiting.map((w) => worryCardHTML(w)).join("")}</div>`;
  }
  el.innerHTML = html;
  enteringId = null;
}

function renderPattern() {
  const el = $("#pattern-content");
  const today = todayStr();
  const { ready, waiting, resolved } = groupWorries(data.worries, today);
  const h = headline(data.worries);

  let headlineHTML;
  if (data.worries.length === 0) {
    headlineHTML = `
      <p class="headline-stat quiet">Your pattern starts with the first worry you park.</p>
      <p class="headline-sub">Park worries, check in when their dates arrive, and this page will show what really happened.</p>`;
  } else if (h.state === "forming") {
    const pct = Math.round((h.done / h.needed) * 100);
    headlineHTML = `
      <p class="headline-stat quiet">${h.done} of ${h.needed} check-ins done. Your pattern is forming.</p>
      <div class="forming-progress">
        <div class="progress-track"><div class="progress-fill" style="width: ${pct}%"></div></div>
      </div>
      <p class="headline-sub">The headline appears after five checked worries. No conclusions from noise.</p>`;
  } else {
    headlineHTML = `
      <p class="headline-stat"><strong>${h.didntHappen} of your ${h.considered} checked worries</strong> never came true.</p>
      <p class="headline-sub">${h.partly > 0 ? `${h.partly} more turned out smaller than feared. ` : ""}${h.happened > 0 ? `${h.happened} happened roughly as feared.` : ""}</p>`;
  }

  const tiles = [
    { num: ready.length + waiting.length, name: "parked" },
    { num: ready.length, name: "ready to check" },
    { num: waiting.length, name: "waiting" },
    { num: resolved.length, name: "checked" },
  ];

  const segments = bandSegments(data.worries);
  const colors = { didntHappen: "var(--sage)", partly: "var(--partly)", happened: "var(--clay)" };
  let bandHTML = "";
  if (segments.length > 0) {
    const tally = outcomeTally(data.worries);
    let x = 0;
    const rects = segments.map((s) => {
      const width = s.fraction * 100;
      const rect = `<rect x="${x}" y="0" width="${width}" height="26" fill="${colors[s.key]}"></rect>`;
      x += width;
      return rect;
    }).join("");
    const legend = segments.map((s) =>
      `<span><span class="legend-dot" style="background: ${colors[s.key]}"></span>${s.count} ${OUTCOME_LABELS[s.key]}</span>`
    ).join("");
    bandHTML = `
      <div class="band-card card">
        <h2 class="section-h band-title">Outcomes of ${tally.considered} checked worr${tally.considered === 1 ? "y" : "ies"}</h2>
        <div class="band-chart-wrap">
          <svg class="band-chart" viewBox="0 0 100 26" preserveAspectRatio="none" role="img"
               aria-label="Outcome proportions of checked worries">${rects}</svg>
        </div>
        <div class="band-legend">${legend}</div>
        ${tally.obsolete > 0 ? `<p class="dialog-note">${tally.obsolete} worr${tally.obsolete === 1 ? "y" : "ies"} no longer mattered and sit${tally.obsolete === 1 ? "s" : ""} outside the statistics.</p>` : ""}
      </div>`;
  }

  el.innerHTML = `
    <div class="headline-card card">${headlineHTML}</div>
    <div class="stat-tiles">
      ${tiles.map((t) => `<div class="stat-tile card"><span class="stat-num">${t.num}</span><span class="stat-name">${t.name}</span></div>`).join("")}
    </div>
    ${bandHTML}`;
}

function renderHistory() {
  const el = $("#history-content");
  const { resolved } = groupWorries(data.worries);
  if (resolved.length === 0) {
    el.innerHTML = `<p class="quiet-note">Checked worries will rest here. None yet.</p>`;
    return;
  }
  const today = todayStr();
  el.innerHTML = `
    <h2 class="section-h">Checked worries</h2>
    <div class="worry-list">
      ${resolved.map((w) => {
        const r = w.resolution;
        const details = [];
        details.push(`Parked ${formatDate(w.created.slice(0, 10), today)}, checked ${formatDate(r.resolvedOn.slice(0, 10), today)}.`);
        details.push(`Dread at capture: ${w.dread} of 5, ${DREAD_WORDS[w.dread]}.`);
        if (r.actualSeverity !== null && r.actualSeverity !== undefined) {
          details.push(`In reality: ${r.actualSeverity} of 5, ${SEVERITY_WORDS[r.actualSeverity]}.`);
        }
        if (r.reflection) details.push(`&ldquo;${esc(r.reflection)}&rdquo;`);
        if (w.notes) details.push(`Note at capture: ${esc(w.notes)}`);
        return `
        <div class="worry-card card history-card" data-id="${w.id}" data-dread="3" role="button" tabindex="0"
             aria-label="Show details of this checked worry">
          <p class="worry-text">${esc(w.text)}</p>
          <div class="worry-meta">
            <span class="outcome-chip ${r.outcome}">${OUTCOME_LABELS[r.outcome]}</span>
            <span>checked ${formatDate(r.resolvedOn.slice(0, 10), today)}</span>
            ${w.category ? `<span class="category-chip">${esc(w.category)}</span>` : ""}
          </div>
          <div class="history-details" hidden>${details.map((d) => `<span>${d}</span>`).join("")}</div>
          <button class="worry-delete" data-delete="${w.id}" aria-label="Delete this worry">&times;</button>
        </div>`;
      }).join("")}
    </div>`;
}

function renderBackupStatus() {
  const el = $("#backup-status");
  const iso = lastBackupISO();
  if (!iso) {
    el.textContent = "Last backup: never";
    el.classList.toggle("stale", data.worries.length > 0);
    return;
  }
  const days = daysBetween(iso.slice(0, 10), todayStr());
  el.textContent =
    days <= 0 ? "Last backup: today" :
    days === 1 ? "Last backup: yesterday" :
    `Last backup: ${days} days ago`;
  el.classList.toggle("stale", days > 14);
}

// ---- capture sheet ------------------------------------------------------------

const captureBackdrop = $("#capture-backdrop");
const captureForm = $("#capture-form");
let capturePreset = "week";

function checkInFromPreset(preset) {
  const today = todayStr();
  if (preset === "tomorrow") return plusDays(today, 1);
  if (preset === "week") return plusDays(today, 7);
  if (preset === "month") return plusMonths(today, 1);
  return $("#checkin-date").value || plusDays(today, 7);
}

function updateCaptureSummary() {
  const date = checkInFromPreset(capturePreset);
  const diff = daysBetween(todayStr(), date);
  const when =
    diff === 1 ? "tomorrow" :
    diff === 7 ? "in a week" :
    diff <= 0 ? "today" : `in ${diff} days`;
  $("#checkin-summary").textContent = `Check-in ${when}, on ${formatDate(date)}.`;
}

function updateDreadLabel() {
  const v = Number($("#dread-input").value);
  $("#dread-label").textContent = `${v} of 5, ${DREAD_WORDS[v]}`;
}

function openCapture() {
  captureForm.reset();
  capturePreset = "week";
  document.querySelectorAll(".preset-row .chip").forEach((c) => {
    const active = c.dataset.preset === "week";
    c.classList.toggle("is-active", active);
    c.setAttribute("aria-pressed", String(active));
  });
  $("#checkin-date").hidden = true;
  $("#checkin-date").min = todayStr();
  $("#details-fields").hidden = true;
  $("#details-toggle").setAttribute("aria-expanded", "false");
  const datalist = $("#category-list");
  datalist.innerHTML = categoriesOf(data.worries)
    .map((c) => `<option value="${esc(c)}"></option>`).join("");
  updateDreadLabel();
  updateCaptureSummary();
  openBackdrop(captureBackdrop);
  $("#worry-text").focus();
}

document.querySelectorAll(".preset-row .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    capturePreset = chip.dataset.preset;
    document.querySelectorAll(".preset-row .chip").forEach((c) => {
      const active = c === chip;
      c.classList.toggle("is-active", active);
      c.setAttribute("aria-pressed", String(active));
    });
    const dateInput = $("#checkin-date");
    dateInput.hidden = capturePreset !== "custom";
    if (capturePreset === "custom") {
      if (!dateInput.value) dateInput.value = plusDays(todayStr(), 7);
      dateInput.focus();
    }
    updateCaptureSummary();
  });
});

$("#checkin-date").addEventListener("change", updateCaptureSummary);
$("#dread-input").addEventListener("input", updateDreadLabel);

$("#details-toggle").addEventListener("click", () => {
  const fields = $("#details-fields");
  fields.hidden = !fields.hidden;
  $("#details-toggle").setAttribute("aria-expanded", String(!fields.hidden));
});

captureForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#worry-text").value.trim();
  if (!text) {
    $("#worry-text").focus();
    return;
  }
  const checkIn = checkInFromPreset(capturePreset);
  const worry = {
    id: crypto.randomUUID(),
    text,
    dread: Number($("#dread-input").value),
    checkIn,
    category: $("#category-input").value.trim(),
    notes: $("#notes-input").value.trim(),
    created: new Date().toISOString(),
    resolution: null,
  };
  data.worries.push(worry);
  persist();
  enteringId = worry.id;
  closeBackdrop(captureBackdrop);
  switchView("today");
  toast(`Parked. Check-in on ${formatDate(checkIn)}.`);
});

$("#park-btn-floating").addEventListener("click", openCapture);
$("#capture-close").addEventListener("click", () => closeBackdrop(captureBackdrop));

// ---- check-in flow ------------------------------------------------------------

const checkinBackdrop = $("#checkin-backdrop");
let checkinWorry = null;
let checkinOutcome = null;
let checkinSeverity = null;

function openCheckin(worry) {
  checkinWorry = worry;
  checkinOutcome = null;
  checkinSeverity = null;
  $("#checkin-worry-text").textContent = worry.text;
  const parked = formatDate(worry.created.slice(0, 10));
  $("#checkin-worry-meta").textContent =
    `Parked ${parked}. Dread then: ${worry.dread} of 5, ${DREAD_WORDS[worry.dread]}.`;
  document.querySelectorAll(".outcome-btn").forEach((b) => b.classList.remove("is-active"));
  document.querySelectorAll("#severity-row .chip").forEach((c) => c.classList.remove("is-active"));
  $("#severity-block").hidden = true;
  $("#severity-label").textContent = "";
  $("#reflection-block").hidden = true;
  $("#reflection-input").value = "";
  openBackdrop(checkinBackdrop);
}

document.querySelectorAll(".outcome-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    checkinOutcome = btn.dataset.outcome;
    document.querySelectorAll(".outcome-btn").forEach((b) =>
      b.classList.toggle("is-active", b === btn));
    const asksSeverity = checkinOutcome === "partly" || checkinOutcome === "happened";
    $("#severity-block").hidden = !asksSeverity;
    if (!asksSeverity) {
      checkinSeverity = null;
      document.querySelectorAll("#severity-row .chip").forEach((c) => c.classList.remove("is-active"));
      $("#severity-label").textContent = "";
    }
    $("#reflection-block").hidden = false;
  });
});

document.querySelectorAll("#severity-row .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    checkinSeverity = Number(chip.dataset.severity);
    document.querySelectorAll("#severity-row .chip").forEach((c) =>
      c.classList.toggle("is-active", c === chip));
    $("#severity-label").textContent = `${checkinSeverity} of 5, ${SEVERITY_WORDS[checkinSeverity]}`;
  });
});

$("#checkin-save").addEventListener("click", () => {
  if (!checkinWorry || !checkinOutcome) return;
  checkinWorry.resolution = {
    outcome: checkinOutcome,
    actualSeverity: checkinSeverity,
    resolvedOn: new Date().toISOString(),
    reflection: $("#reflection-input").value.trim(),
  };
  persist();
  const resolvedId = checkinWorry.id;
  closeBackdrop(checkinBackdrop);
  animateCardAway(resolvedId, () => {
    render();
    const t = outcomeTally(data.worries);
    toast(`Checked. ${t.considered > 0 ? `${t.didntHappen} of ${t.considered} checked worries never came true.` : "Left out of your statistics."}`);
  });
  checkinWorry = null;
});

$("#checkin-close").addEventListener("click", () => closeBackdrop(checkinBackdrop));

function animateCardAway(id, done) {
  const card = document.querySelector(`.worry-card[data-id="${id}"]`);
  if (!card) { done(); return; }
  card.classList.add("leaving");
  setTimeout(done, 320);
}

// ---- card clicks (check-in, history expand, delete) ------------------------------

document.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".worry-delete");
  if (deleteBtn) {
    e.stopPropagation();
    handleDelete(deleteBtn);
    return;
  }
  const card = e.target.closest(".worry-card");
  if (!card) return;
  if (card.classList.contains("is-ready")) {
    const worry = data.worries.find((w) => w.id === card.dataset.id);
    if (worry) openCheckin(worry);
  } else if (card.classList.contains("history-card")) {
    const details = card.querySelector(".history-details");
    if (details) details.hidden = !details.hidden;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest?.(".worry-card[role='button']");
    if (card && e.target === card) {
      e.preventDefault();
      card.click();
    }
  }
  if (e.key === "Escape") {
    if (!captureBackdrop.hidden) closeBackdrop(captureBackdrop);
    if (!checkinBackdrop.hidden) closeBackdrop(checkinBackdrop);
    if (!importBackdrop.hidden) closeBackdrop(importBackdrop);
  }
});

// Deleting is allowed at any time, without ceremony: one quiet confirm, that is all.
function handleDelete(btn) {
  if (!btn.classList.contains("confirming")) {
    btn.classList.add("confirming");
    btn.textContent = "Delete?";
    setTimeout(() => {
      btn.classList.remove("confirming");
      btn.innerHTML = "&times;";
    }, 3000);
    return;
  }
  const id = btn.dataset.delete;
  data.worries = data.worries.filter((w) => w.id !== id);
  persist();
  animateCardAway(id, render);
}

// ---- backdrop open/close --------------------------------------------------------

function openBackdrop(backdrop) {
  backdrop.classList.remove("closing");
  backdrop.hidden = false;
}

function closeBackdrop(backdrop) {
  backdrop.classList.add("closing");
  setTimeout(() => {
    backdrop.hidden = true;
    backdrop.classList.remove("closing");
  }, 250);
}

[captureBackdrop, checkinBackdrop].forEach((backdrop) => {
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeBackdrop(backdrop);
  });
});

// ---- export / import --------------------------------------------------------------

const importBackdrop = $("#import-backdrop");
let pendingImport = null;

$("#export-btn").addEventListener("click", () => {
  exportToFile(data);
  renderBackupStatus();
  toast("Backup exported. Keep the file somewhere private.");
});

$("#import-btn").addEventListener("click", () => $("#import-file").click());

$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  const text = await file.text();
  const result = parseImport(text);
  if (!result.ok) {
    toast(result.error);
    return;
  }
  pendingImport = result.data;
  const n = pendingImport.worries.length;
  $("#import-summary").textContent =
    `This backup holds ${n} worr${n === 1 ? "y" : "ies"}. You currently have ${data.worries.length} in the browser.`;
  openBackdrop(importBackdrop);
});

$("#import-merge").addEventListener("click", () => {
  if (!pendingImport) return;
  data = mergeData(data, pendingImport);
  finishImport("Merged. Everything from both is kept.");
});

$("#import-replace").addEventListener("click", () => {
  if (!pendingImport) return;
  data = pendingImport;
  finishImport("Replaced. The backup is now your ledger.");
});

function finishImport(message) {
  pendingImport = null;
  persist();
  closeBackdrop(importBackdrop);
  render();
  toast(message);
}

$("#import-cancel").addEventListener("click", () => {
  pendingImport = null;
  closeBackdrop(importBackdrop);
});

importBackdrop.addEventListener("click", (e) => {
  if (e.target === importBackdrop) {
    pendingImport = null;
    closeBackdrop(importBackdrop);
  }
});

// ---- init ---------------------------------------------------------------------------

render();
