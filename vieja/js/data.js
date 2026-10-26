/* =========================================================
   CasaFlow · data.js
   Capa de datos: modelo en memoria (_db), adaptador de
   almacenamiento (local o nube), tarifas vigentes, calendario
   de pagos configurable y períodos.
   ========================================================= */

'use strict';

const DB_KEY = 'casaflow.db.v1';
const SESSION_KEY = 'casaflow.session.v1';
const ONBOARD_KEY = 'casaflow.onboarded';
const THEME_KEY = 'casaflow.theme';

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

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/* ---------- fechas de pago ----------
   Son 100% manuales: quien organiza carga cada fecha de pago.
   Una fecha que ya tiene pagos marcados se conserva siempre
   (así nada de lo registrado desaparece). */

const DEFAULT_SCHEDULE = () => ({
  extra: [],               // fechas de pago cargadas a mano
});

function normalizeSchedule(s) {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  if (!s || typeof s !== 'object') return DEFAULT_SCHEDULE();
  return {
    extra: Array.isArray(s.extra) ? [...new Set(s.extra.filter((x) => ISO.test(x)))].sort() : [],
  };
}

function currentSchedule() {
  return normalizeSchedule(loadDB().settings.paySchedule);
}

function describeSchedule() {
  return 'en las fechas que carga quien organiza';
}

/** Todas las fechas de pago: las cargadas a mano + las que ya tienen pagos marcados. */
function allPaydays() {
  const db = loadDB();
  const out = new Set(currentSchedule().extra);
  db.payments.forEach((p) => out.add(p.payday));
  return [...out].sort();
}

function paydaysOfYear(year) {
  return allPaydays().filter((p) => p.startsWith(String(year)));
}

/** Compatibilidad: antes era un rango de años; ahora son todas las fechas cargadas. */
function paydaysAround() {
  return allPaydays();
}

function nextPayday(fromIso) {
  return allPaydays().find((p) => p >= fromIso) || null;
}

function prevPayday(beforeIso) {
  const all = allPaydays().filter((p) => p < beforeIso);
  return all.length ? all[all.length - 1] : null;
}

/** Ventana que cubre un día de pago: desde el pago anterior (exclusive) hasta este.
    Para la primera fecha, desde el primer registro de horas que exista. */
function payWindow(payday) {
  const prev = prevPayday(payday);
  if (prev) return { from: addDays(prev, 1), to: payday };
  const dates = loadDB().entries.map((e) => e.date).filter((d) => d <= payday).sort();
  return { from: dates.length ? dates[0] : addDays(payday, -30), to: payday };
}

/* ---------- base de datos en memoria ---------- */

const DEFAULT_DB = () => ({
  version: 1,
  settings: {
    houseName: 'Mi casa',
    ownerName: 'Organizador/a',
    pin: btoa('1234'),          // solo modo local (en la nube se entra con Google)
    pinIsDefault: true,
    paySchedule: DEFAULT_SCHEDULE(),
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
  // migraciones suaves
  if (!_db.settings) _db.settings = DEFAULT_DB().settings;
  _db.settings.paySchedule = normalizeSchedule(_db.settings.paySchedule);
  if (!Array.isArray(_db.staff)) _db.staff = [];
  if (!Array.isArray(_db.entries)) _db.entries = [];
  if (!Array.isArray(_db.payments)) _db.payments = [];
  return _db;
}

function setDB(db) { _db = db; }

function saveDB() {
  if (Store.mode !== 'local') return;
  localStorage.setItem(DB_KEY, JSON.stringify(_db));
}

function resetDB(withDemo) {
  _db = DEFAULT_DB();
  if (withDemo) seedDemo(_db);
  setOnboarded(true);
  saveDB();
}

/* ---------- onboarding y tema (por dispositivo) ---------- */

const isOnboarded = () => localStorage.getItem(ONBOARD_KEY) === '1';
const setOnboarded = (v) => localStorage.setItem(ONBOARD_KEY, v ? '1' : '0');
const getThemePref = () => localStorage.getItem(THEME_KEY) || 'auto';
const setThemePref = (t) => localStorage.setItem(THEME_KEY, t);

/* ---------- adaptador de almacenamiento ----------
   En modo 'local' todo va a localStorage. En modo 'cloud'
   cloud.js reemplaza estos métodos por escrituras a Firestore. */

const Store = {
  mode: 'local',
  putSettings() { saveDB(); },
  putStaff() { saveDB(); },
  putRates() { saveDB(); },
  putEntry() { saveDB(); },
  removeEntry() { saveDB(); },
  putPayment() { saveDB(); },
  removePayment() { saveDB(); },
};

/* ---------- sesión (modo local) ---------- */

function getSession() {
  if (Store.mode === 'cloud') return Cloud.session();
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}
function setSession(s) {
  if (Store.mode === 'cloud') { if (!s) Cloud.signOut(); return; }
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
  if (!staffMember || !Array.isArray(staffMember.rates) || !staffMember.rates.length) return 0;
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

function addStaff(db, { name, color, rate, rateFrom, email }) {
  const member = {
    id: uid(),
    name: name.trim(),
    color: color || STAFF_COLORS[db.staff.length % STAFF_COLORS.length],
    email: (email || '').trim().toLowerCase(),
    active: true,
    rates: [{ from: rateFrom || todayISO(), value: Number(rate) || 0 }],
    createdAt: new Date().toISOString(),
  };
  db.staff.push(member);
  Store.putStaff(member, '');
  Store.putRates(member);
  return member;
}

function updateStaff(db, id, { name, color, email, active }) {
  const m = staffById(db, id);
  if (!m) return;
  const prevEmail = m.email || '';
  if (name !== undefined) m.name = String(name).trim();
  if (color !== undefined) m.color = color;
  if (email !== undefined) m.email = String(email).trim().toLowerCase();
  if (active !== undefined) m.active = !!active;
  Store.putStaff(m, prevEmail);
}

function addRate(db, staffId, { value, from }) {
  const m = staffById(db, staffId);
  if (!m) return;
  m.rates = m.rates.filter((r) => r.from !== from); // reemplaza si misma fecha
  m.rates.push({ from, value: Number(value) || 0 });
  m.rates.sort((a, b) => a.from.localeCompare(b.from));
  Store.putRates(m);
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
  Store.putEntry(entry);
  return entry;
}

function updateEntry(db, id, patch) {
  const e = db.entries.find((x) => x.id === id);
  if (!e) return;
  if (patch.date) e.date = patch.date;
  if (patch.hours !== undefined) e.hours = Math.max(0, Math.min(24, Number(patch.hours) || 0));
  if (patch.note !== undefined) e.note = String(patch.note).trim().slice(0, 200);
  Store.putEntry(e);
}

function deleteEntry(db, id) {
  db.entries = db.entries.filter((x) => x.id !== id);
  Store.removeEntry(id);
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

/* ---------- pagos ---------- */

function isPaid(db, payday, staffId) {
  return db.payments.some((p) => p.payday === payday && p.staffId === staffId);
}

function togglePaid(db, payday, staffId) {
  if (isPaid(db, payday, staffId)) {
    // al desmarcar, la fecha queda guardada como manual para que la fila no desaparezca
    if (!currentSchedule().extra.includes(payday)) addExtraPayday(db, payday);
    db.payments = db.payments.filter((p) => !(p.payday === payday && p.staffId === staffId));
    Store.removePayment(payday, staffId);
  } else {
    const p = { payday, staffId, paidAt: new Date().toISOString() };
    db.payments.push(p);
    Store.putPayment(p);
  }
}

/* ---------- fechas de pago: edición ---------- */

function saveSchedule(db, schedule) {
  db.settings.paySchedule = normalizeSchedule(schedule);
  Store.putSettings(db.settings);
}

function addExtraPayday(db, iso) {
  const s = currentSchedule();
  if (!s.extra.includes(iso)) s.extra.push(iso);
  s.extra.sort();
  saveSchedule(db, s);
}

/** Quita una fecha de pago y los pagos marcados en ella. */
function removePayday(db, iso) {
  const s = currentSchedule();
  s.extra = s.extra.filter((x) => x !== iso);
  saveSchedule(db, s);
  db.payments.filter((p) => p.payday === iso).forEach((p) => Store.removePayment(p.payday, p.staffId));
  db.payments = db.payments.filter((p) => p.payday !== iso);
  saveDB();
}

/* ---------- períodos internos (vista colaboradora e insights) ---------- */

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

/** Valida y normaliza un backup. Devuelve un db limpio (no lo aplica). */
function parseBackup(text) {
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
      email: typeof s.email === 'string' ? s.email.trim().toLowerCase().slice(0, 120) : '',
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
    paySchedule: normalizeSchedule(s.paySchedule),
  };

  return { version: 1, settings, staff, entries, payments };
}

function importJSON(text) {
  _db = parseBackup(text);
  setOnboarded(true);
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

  // Fechas de pago cargadas a mano: dos pasadas y una próxima
  const p1 = addDays(todayISO(), -58), p2 = addDays(todayISO(), -30), p3 = addDays(todayISO(), 5);
  db.settings.paySchedule = { extra: [p1, p2, p3] };
  const team = [marta.id, sol.id, paula.id];
  team.forEach((sid) => db.payments.push({ payday: p1, staffId: sid, paidAt: new Date().toISOString() }));
  team.slice(0, 2).forEach((sid) => db.payments.push({ payday: p2, staffId: sid, paidAt: new Date().toISOString() }));
}

function addStaffRaw(db, name, color, rate) {
  const m = {
    id: uid(), name, color, email: '', active: true,
    rates: [{ from: addDays(todayISO(), -365), value: rate }],
    createdAt: new Date().toISOString(),
  };
  db.staff.push(m);
  return m;
}

function entryRaw(staffId, date, hours) {
  return { id: uid(), staffId, date, hours, note: '', createdAt: new Date().toISOString() };
}
