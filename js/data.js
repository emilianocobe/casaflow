/* =========================================================
   CasaFlow · data.js
   Capa de datos: almacenamiento local, modelo y utilidades
   de dominio (tarifas vigentes, días de pago, períodos).
   Los datos viven SOLO en este dispositivo (localStorage).
   ========================================================= */

'use strict';

const DB_KEY = 'casaflow.db.v1';
const SESSION_KEY = 'casaflow.session.v1';

/* ---------- utilidades básicas ---------- */

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

const pad2 = (n) => String(n).padStart(2, '0');

/** Date local -> 'YYYY-MM-DD' */
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** 'YYYY-MM-DD' -> Date local (mediodía para evitar líos de huso) */
const fromISO = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

const todayISO = () => toISO(new Date());

const addDays = (iso, n) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

/** Lunes de la semana de una fecha */
const weekStartISO = (iso) => {
  const d = fromISO(iso);
  const shift = (d.getDay() + 6) % 7; // lunes=0 ... domingo=6
  d.setDate(d.getDate() - shift);
  return toISO(d);
};

const monthStartISO = (iso) => iso.slice(0, 8) + '01';

const monthEndISO = (iso) => {
  const d = fromISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12));
};

/* ---------- formato es-AR ---------- */

const fmtMoney = (n) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(n || 0);

const fmtNum = (n) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDateLong = (iso) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    .format(fromISO(iso));

const fmtDateShort = (iso) =>
  new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(fromISO(iso));

const fmtDateFull = (iso) =>
  new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(fromISO(iso));

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/* ---------- base de datos ---------- */

const DEFAULT_DB = () => ({
  version: 1,
  settings: {
    houseName: 'Mi casa',
    ownerName: 'Organizador/a',
    pin: btoa('1234'),          // protección liviana (ver README)
    pinIsDefault: true,
    theme: 'auto',
    onboarded: false,
  },
  staff: [],
  entries: [],
  payments: [],                  // {payday:'YYYY-MM-DD', staffId, paidAt}
});

let _db = null;

function loadDB() {
  if (_db) return _db;
  try {
    const raw = localStorage.getItem(DB_KEY);
    _db = raw ? JSON.parse(raw) : DEFAULT_DB();
  } catch {
    _db = DEFAULT_DB();
  }
  return _db;
}

function saveDB() {
  localStorage.setItem(DB_KEY, JSON.stringify(_db));
}

function resetDB(withDemo) {
  _db = DEFAULT_DB();
  if (withDemo) seedDemo(_db);
  _db.settings.onboarded = true;
  saveDB();
}

/* ---------- sesión ---------- */

function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function setSession(s) {
  if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else sessionStorage.removeItem(SESSION_KEY);
}

/* ---------- personal y tarifas ---------- */

const STAFF_COLORS = [
  '#7c6cf0', '#e05f8f', '#2fa989', '#e08f3c', '#4f93e0', '#b0568f',
  '#5f9ea0', '#c46a4a', '#6a7fdb', '#3f9e5f', '#9b59b6', '#c0871f',
];

function activeStaff(db) {
  return db.staff.filter((s) => s.active);
}

function staffById(db, id) {
  return db.staff.find((s) => s.id === id) || null;
}

/** Tarifa vigente para una fecha (la última cuyo 'from' <= fecha). */
function rateFor(staffMember, iso) {
  if (!staffMember || !staffMember.rates.length) return 0;
  const sorted = [...staffMember.rates].sort((a, b) => a.from.localeCompare(b.from));
  let value = sorted[0].value;
  for (const r of sorted) {
    if (r.from <= iso) value = r.value;
    else break;
  }
  return value;
}

function currentRate(staffMember) {
  return rateFor(staffMember, todayISO());
}

function addStaff(db, { name, color, rate, rateFrom }) {
  const member = {
    id: uid(),
    name: name.trim(),
    color: color || STAFF_COLORS[db.staff.length % STAFF_COLORS.length],
    active: true,
    rates: [{ from: rateFrom || todayISO(), value: Number(rate) || 0 }],
    createdAt: new Date().toISOString(),
  };
  db.staff.push(member);
  saveDB();
  return member;
}

function addRate(db, staffId, { value, from }) {
  const m = staffById(db, staffId);
  if (!m) return;
  m.rates = m.rates.filter((r) => r.from !== from); // reemplaza si misma fecha
  m.rates.push({ from, value: Number(value) || 0 });
  m.rates.sort((a, b) => a.from.localeCompare(b.from));
  saveDB();
}

/* ---------- registros de horas ---------- */

function addEntry(db, { staffId, date, hours, note }) {
  const entry = {
    id: uid(), staffId, date,
    hours: Math.max(0, Math.min(24, Number(hours) || 0)),
    note: (note || '').trim().slice(0, 200),
    createdAt: new Date().toISOString(),
  };
  db.entries.push(entry);
  saveDB();
  return entry;
}

function updateEntry(db, id, patch) {
  const e = db.entries.find((x) => x.id === id);
  if (!e) return;
  if (patch.date) e.date = patch.date;
  if (patch.hours !== undefined) e.hours = Math.max(0, Math.min(24, Number(patch.hours) || 0));
  if (patch.note !== undefined) e.note = String(patch.note).trim().slice(0, 200);
  saveDB();
}

function deleteEntry(db, id) {
  db.entries = db.entries.filter((x) => x.id !== id);
  saveDB();
}

function entriesIn(db, from, to, staffId) {
  return db.entries.filter(
    (e) => e.date >= from && e.date <= to && (!staffId || e.staffId === staffId)
  );
}

function hoursIn(db, from, to, staffId) {
  return entriesIn(db, from, to, staffId).reduce((a, e) => a + e.hours, 0);
}

/** Costo exacto: cada registro se valúa con la tarifa vigente en SU fecha. */
function costIn(db, from, to, staffId) {
  return entriesIn(db, from, to, staffId).reduce((a, e) => {
    const m = staffById(db, e.staffId);
    return a + e.hours * rateFor(m, e.date);
  }, 0);
}

/* ---------- días de pago (2º y 4º viernes) ---------- */

function fridaysOfMonth(year, monthIdx0) {
  const first = new Date(year, monthIdx0, 1, 12);
  const offset = (5 - first.getDay() + 7) % 7; // 5 = viernes
  const firstFriday = 1 + offset;
  return {
    second: toISO(new Date(year, monthIdx0, firstFriday + 7, 12)),
    fourth: toISO(new Date(year, monthIdx0, firstFriday + 21, 12)),
  };
}

function paydaysOfYear(year) {
  const out = [];
  for (let m = 0; m < 12; m++) {
    const { second, fourth } = fridaysOfMonth(year, m);
    out.push(second, fourth);
  }
  return out;
}

/** Todos los días de pago en un rango amplio, ordenados. */
function paydaysAround(iso, yearsBack = 1, yearsFwd = 1) {
  const y = fromISO(iso).getFullYear();
  const out = [];
  for (let yy = y - yearsBack; yy <= y + yearsFwd; yy++) out.push(...paydaysOfYear(yy));
  return out.sort();
}

function nextPayday(fromIso) {
  return paydaysAround(fromIso).find((p) => p >= fromIso) || null;
}

function prevPayday(beforeIso) {
  const all = paydaysAround(beforeIso).filter((p) => p < beforeIso);
  return all.length ? all[all.length - 1] : null;
}

/** Ventana que cubre un día de pago: (pago anterior, este pago]. */
function payWindow(payday) {
  const prev = prevPayday(payday);
  return { from: prev ? addDays(prev, 1) : addDays(payday, -13), to: payday };
}

function isPaid(db, payday, staffId) {
  return db.payments.some((p) => p.payday === payday && p.staffId === staffId);
}

function togglePaid(db, payday, staffId) {
  if (isPaid(db, payday, staffId)) {
    db.payments = db.payments.filter((p) => !(p.payday === payday && p.staffId === staffId));
  } else {
    db.payments.push({ payday, staffId, paidAt: new Date().toISOString() });
  }
  saveDB();
}

/* ---------- períodos con nombre ---------- */

const PERIODS = [
  { key: 'week',      label: 'Esta semana' },
  { key: 'lastweek',  label: 'Semana pasada' },
  { key: 'q1',        label: 'Quincena 1' },
  { key: 'q2',        label: 'Quincena 2' },
  { key: 'month',     label: 'Este mes' },
  { key: 'lastmonth', label: 'Mes pasado' },
];

function periodRange(key, refIso = todayISO()) {
  switch (key) {
    case 'week': {
      const from = weekStartISO(refIso);
      return { from, to: addDays(from, 6) };
    }
    case 'lastweek': {
      const from = addDays(weekStartISO(refIso), -7);
      return { from, to: addDays(from, 6) };
    }
    case 'q1': {
      const from = monthStartISO(refIso);
      return { from, to: from.slice(0, 8) + '15' };
    }
    case 'q2': {
      return { from: refIso.slice(0, 8) + '16', to: monthEndISO(refIso) };
    }
    case 'lastmonth': {
      const d = fromISO(monthStartISO(refIso));
      d.setMonth(d.getMonth() - 1);
      const from = toISO(d);
      return { from, to: monthEndISO(from) };
    }
    case 'month':
    default:
      return { from: monthStartISO(refIso), to: monthEndISO(refIso) };
  }
}

/* ---------- exportar / importar ---------- */

function exportJSON(db) {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `casaflow-backup-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function importJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { data = null; }
  if (!data || typeof data !== 'object' || data.version !== 1) {
    throw new Error('El archivo no parece un backup válido de CasaFlow.');
  }
  const base = DEFAULT_DB();

  const staff = (Array.isArray(data.staff) ? data.staff : [])
    .filter((s) =>
      s && typeof s === 'object' &&
      typeof s.id === 'string' && typeof s.name === 'string' &&
      Array.isArray(s.rates) && s.rates.length &&
      s.rates.every((r) => r && ISO_RE.test(r.from) && typeof r.value === 'number' && isFinite(r.value)))
    .map((s) => ({
      id: s.id,
      name: s.name.trim().slice(0, 40) || 'Sin nombre',
      color: COLOR_RE.test(s.color) ? s.color : STAFF_COLORS[0],
      active: s.active !== false,
      rates: [...s.rates]
        .map((r) => ({ from: r.from, value: Math.max(0, r.value) }))
        .sort((a, b) => a.from.localeCompare(b.from)),
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
    }));

  const staffIds = new Set(staff.map((s) => s.id));

  const entries = (Array.isArray(data.entries) ? data.entries : [])
    .filter((e) =>
      e && typeof e === 'object' && typeof e.id === 'string' &&
      staffIds.has(e.staffId) && ISO_RE.test(e.date) &&
      typeof e.hours === 'number' && isFinite(e.hours))
    .map((e) => ({
      id: e.id, staffId: e.staffId, date: e.date,
      hours: Math.max(0, Math.min(24, e.hours)),
      note: typeof e.note === 'string' ? e.note.slice(0, 200) : '',
      createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
    }));

  const payments = (Array.isArray(data.payments) ? data.payments : [])
    .filter((p) => p && typeof p === 'object' && ISO_RE.test(p.payday) && staffIds.has(p.staffId))
    .map((p) => ({
      payday: p.payday, staffId: p.staffId,
      paidAt: typeof p.paidAt === 'string' ? p.paidAt : new Date().toISOString(),
    }));

  const s = (data.settings && typeof data.settings === 'object') ? data.settings : {};
  const settings = {
    ...base.settings,
    houseName: typeof s.houseName === 'string' ? s.houseName.slice(0, 40) : base.settings.houseName,
    ownerName: typeof s.ownerName === 'string' ? s.ownerName.slice(0, 40) : base.settings.ownerName,
    pin: typeof s.pin === 'string' && s.pin ? s.pin : base.settings.pin,
    pinIsDefault: s.pinIsDefault !== false,
    theme: ['auto', 'light', 'dark'].includes(s.theme) ? s.theme : 'auto',
    onboarded: true,
  };

  _db = { version: 1, settings, staff, entries, payments };
  saveDB();
}

/* ---------- datos de ejemplo (equipo ficticio) ---------- */

function seedDemo(db) {
  const marta = addStaffRaw(db, 'Marta', STAFF_COLORS[0], 7500);
  const sol   = addStaffRaw(db, 'Sol',   STAFF_COLORS[1], 7000);
  const paula = addStaffRaw(db, 'Paula', STAFF_COLORS[2], 8500);

  // Patrón determinístico de las últimas ~10 semanas
  const start = addDays(todayISO(), -70);
  for (let i = 0; i <= 70; i++) {
    const iso = addDays(start, i);
    const dow = fromISO(iso).getDay(); // 0=dom ... 6=sab
    const dayNum = Number(iso.slice(8, 10));
    if ([1, 3, 5].includes(dow)) db.entries.push(entryRaw(marta.id, iso, 5));
    if ([2, 4].includes(dow))    db.entries.push(entryRaw(sol.id, iso, 6));
    if (dow >= 1 && dow <= 5 && dayNum % 9 !== 0) db.entries.push(entryRaw(paula.id, iso, 4));
  }

  // Pagos pasados marcados como hechos (el más reciente queda a medias, para mostrar el flujo)
  const past = paydaysAround(todayISO())
    .filter((p) => p < todayISO() && p >= addDays(todayISO(), -130));
  past.forEach((payday, idx) => {
    const team = [marta.id, sol.id, paula.id];
    const who = idx === past.length - 1 ? team.slice(0, 2) : team;
    who.forEach((sid) => db.payments.push({ payday, staffId: sid, paidAt: new Date().toISOString() }));
  });
}

function addStaffRaw(db, name, color, rate) {
  const m = {
    id: uid(), name, color, active: true,
    rates: [{ from: addDays(todayISO(), -365), value: rate }],
    createdAt: new Date().toISOString(),
  };
  db.staff.push(m);
  return m;
}

function entryRaw(staffId, date, hours) {
  return { id: uid(), staffId, date, hours, note: '', createdAt: new Date().toISOString() };
}
