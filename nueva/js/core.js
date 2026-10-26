/* =========================================================
   CasaFlow (app nueva) · core.js
   Utilidades, formato es-AR y reglas del dominio de bloques.
   Todo opera sobre D (los datos) y no sabe de dónde vienen.

   Reglas:
     - Bloques: Mañana 8–13 (5 h) y Tarde 13–19 (6 h), lunes a domingo.
     - Cupo: 1 titular + 1 lugar de shadow. El lugar de shadow lo habilita
       la administración bloque por bloque, y solo si ya hay titular.
     - Permisos por persona: puede ir de titular y/o de shadow.
     - Bloques de titular: por turnos según el orden de prioridad. En su
       turno cada una toma HASTA su mínimo de cada semana; al cubrirlo (o si
       pasa su turno porque no puede completarlo) le toca a la siguiente.
       Recién en la ronda 2, cuando pasaron todas, se llega al máximo.
     - Una persona no puede tomar dos bloques el mismo día.
     - Lugares de shadow: sin turno, apenas se habilitan.
     - Mínimo y máximo por semana (lunes a domingo), contando titular y
       shadow. Las semanas que no caen enteras en el mes no exigen mínimo.
     - Cambios hasta 24 h antes del bloque (en meses ya cerrados).
     - Presente: Asistió / Parcial (horas reales) / No asistió.
     - Faltas no se pagan; sin marcar no cuenta; extras cuentan aprobadas.
   ========================================================= */

'use strict';

/* ---------- utilidades ---------- */

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const fromISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, 12, 0, 0); };
const todayISO = () => toISO(new Date());
const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
const weekStartISO = (iso) => { const d = fromISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); };
const ymOf = (iso) => iso.slice(0, 7);
const currentYM = () => todayISO().slice(0, 7);
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1, 12); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const fmtMoney = (n) => new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2,
}).format(n || 0);
const fmtNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(n || 0);
/** Horas con signo: +1,5 h (extra) o −1 h (descuento). */
const fmtSigned = (h) => `${h < 0 ? '−' : '+'}${fmtNum(Math.abs(h))} h`;
const fmtDateLong = (iso) => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(fromISO(iso));
const fmtDateShort = (iso) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' }).format(fromISO(iso));
const fmtDateFull = (iso) => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(fromISO(iso));
const monthName = (ym) => { const [y, m] = ym.split('-').map(Number); return new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(new Date(y, m - 1, 12)); };
const monthLabel = (ym) => `${cap(monthName(ym))} ${ym.slice(0, 4)}`;

const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const dayLabel = (d) => `${DOW_SHORT[fromISO(d).getDay()]} ${Number(d.slice(8))}`;
const relDay = (d) => (d === todayISO() ? 'hoy' : d === addDays(todayISO(), 1) ? 'mañana' : fmtDateLong(d));

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/;

const STAFF_COLORS = [
  '#7c6cf0', '#e05f8f', '#2fa989', '#e08f3c', '#4f93e0', '#b0568f',
  '#5f9ea0', '#c46a4a', '#6a7fdb', '#3f9e5f', '#9b59b6', '#c0871f',
];

/* ---------- bloques y estados ---------- */

const BLOCKS = {
  M: { label: 'Mañana', short: 'M', range: '8 a 13', start: 8, hours: 5 },
  T: { label: 'Tarde', short: 'T', range: '13 a 19', start: 13, hours: 6 },
};
const BKEYS = ['M', 'T'];

const STATUS = {
  asistio:   { label: 'Asistió',    mark: '✓', cls: 'ok' },
  parcial:   { label: 'Parcial',    mark: '½', cls: 'half' },
  falto:     { label: 'No asistió', mark: '✕', cls: 'no' },
  sinmarcar: { label: 'Sin marcar', mark: '!', cls: 'warn' },
  hoy:       { label: 'Hoy',        mark: '•', cls: 'today' },
  prog:      { label: 'Programado', mark: '',  cls: 'soft' },
};

const MONTH_STEPS = [
  { key: 'prep', label: 'Preparación' },
  { key: 'reservas', label: 'Reservas abiertas' },
  { key: 'cerrado', label: 'Reservas cerradas' },
  { key: 'curso', label: 'En curso' },
  { key: 'liquidado', label: 'Liquidado' },
];

/** Hora real de inicio de un bloque, en horario de Argentina (UTC-3), sea cual sea el huso del teléfono.
    Las reglas de Firestore calculan la misma hora para validar la regla de 24 h. */
const blockStart = (d, b) => new Date(`${d}T${pad2(BLOCKS[b].start)}:00:00-03:00`);
const hoursUntil = (d, b) => (blockStart(d, b) - new Date()) / 3600000;
const otherBlock = (b) => (b === 'M' ? 'T' : 'M');
const bookingId = (d, b, role) => `${d}_${b}_${role === 'shadow' ? 'S' : 'T'}`;
const blockKey = (d, b) => `${d}_${b}`;

function monthDays(ym) {
  const [y, m] = ym.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${ym}-${pad2(i + 1)}`);
}

/** Semanas (lunes a domingo) que tocan el mes; full = los 7 días dentro del mes. */
function weeksOfMonth(ym) {
  const out = [];
  const seen = new Set();
  monthDays(ym).forEach((d) => {
    const w = weekStartISO(d);
    if (seen.has(w)) return;
    seen.add(w);
    const days = Array.from({ length: 7 }, (_, i) => addDays(w, i)).filter((x) => ymOf(x) === ym);
    out.push({ start: w, days, full: days.length === 7 });
  });
  return out;
}
const weekOf = (d) => weeksOfMonth(ymOf(d)).find((w) => w.days.includes(d));
const weekRange = (w) => (w.days.length === 1
  ? fmtDateShort(w.days[0])
  : `${Number(w.days[0].slice(8))} al ${fmtDateShort(w.days[w.days.length - 1])}`);

/* ---------- datos en memoria ---------- */

const EMPTY_DATA = () => ({
  house: { name: 'Mi casa', ownerName: 'Administración' },
  staff: [],       // {id, name, color, email, active, rank, min, max, canTit, canSh, rates:[{from,value}]}
  months: {},      // ym -> {status, order:[sid], mins:{sid:n}, maxs:{sid:n}, turnFloor}
  blocks: {},      // 'YYYY-MM-DD_B' -> {closed, shadow}
  bookings: [],    // {id, date, b, role, sid, month, att:{st,h}|null}
  extras: [],      // {id, date, b, sid, h, motivo, by, estado:'pend'|'ok'|'rej'}  (h < 0 = horas descontadas)
  pagos: {},       // 'YYYY-MM_sid' -> {paidAt, staffId, month}
  pases: {},       // 'YYYY-MM_semana_sid' -> {month, week, at}  (pasó su turno de esa semana sin completar el mínimo)
});

let D = EMPTY_DATA();

/* ---------- consultas ---------- */

const person = (sid) => D.staff.find((s) => s.id === sid) || null;
const ranked = () => D.staff.filter((s) => s.active !== false).sort((a, b) => (a.rank || 99) - (b.rank || 99));
const archived = () => D.staff.filter((s) => s.active === false);
const roleText = (s) => (s.canTit && s.canSh ? 'titular y shadow' : s.canSh ? 'shadow' : s.canTit ? 'titular' : 'sin habilitar');
const blockInfo = (d, b) => D.blocks[blockKey(d, b)] || { closed: false, shadow: false };

function at(d, b) {
  const list = D.bookings.filter((x) => x.date === d && x.b === b);
  return {
    tit: list.find((x) => x.role === 'titular') || null,
    sh: list.find((x) => x.role === 'shadow') || null,
  };
}
const mine = (sid, d, b) => D.bookings.find((x) => x.date === d && x.b === b && x.sid === sid) || null;
const weekCount = (sid, w) => D.bookings.filter((x) => x.sid === sid && w.days.includes(x.date)).length;
const monthDoc = (ym) => D.months[ym] || { status: 'prep' };

/** Estado "visible" del mes: un mes cerrado que ya empezó está "en curso". */
function monthStatus(ym) {
  const st = monthDoc(ym).status || 'prep';
  if (st === 'cerrado' && todayISO() >= `${ym}-01`) return 'curso';
  return st;
}

/** Límites de la persona para el mes (la foto que se guardó al abrir reservas manda). */
function limitsOf(sid, ym) {
  const mo = monthDoc(ym);
  const s = person(sid);
  return {
    min: mo.mins && mo.mins[sid] !== undefined ? mo.mins[sid] : (s ? s.min : 0),
    max: mo.maxs && mo.maxs[sid] !== undefined ? mo.maxs[sid] : (s ? s.max : 0),
  };
}

const metMin = (sid, ym) => weeksOfMonth(ym).filter((w) => w.full).every((w) => weekCount(sid, w) >= limitsOf(sid, ym).min);

/** Orden de turnos para titulares (la foto del mes; si no hay, el orden actual de Equipo). */
function turnOrder(ym) {
  const mo = monthDoc(ym);
  if (Array.isArray(mo.order) && mo.order.length) return mo.order;
  return ranked().filter((s) => s.canTit).map((s) => s.id);
}

/** ¿La persona pasó su turno de esa semana (por no poder completar el mínimo)? */
const passedTurn = (sid, ym, wk) => !!(D.pases && D.pases[`${ym}_${wk}_${sid}`]);
/** En esa semana, ¿ya terminó su turno? (cubrió el mínimo o lo pasó) */
const doneWeek = (sid, ym, w) => weekCount(sid, w) >= limitsOf(sid, ym).min || passedTurn(sid, ym, w.start);

/** Semanas que se eligen por turnos: las completas que todavía no terminaron. */
const turnWeeks = (ym) => weeksOfMonth(ym).filter((w) => w.full && w.days[6] >= todayISO());

/**
 * Turnos semana por semana: en la primera semana pendiente eligen en orden, cada una hasta su mínimo;
 * cuando pasaron todas, esa semana queda libre hasta el máximo y sigue la próxima.
 * Al terminar todas las semanas se abre la ronda 2 (incluye los días sueltos de inicio y fin de mes).
 */
function turnInfo(ym) {
  const mo = monthDoc(ym);
  const order = turnOrder(ym);
  const weeks = turnWeeks(ym);
  if (mo.status !== 'reservas') return { open: false, ronda: 0, current: null, idx: 0, order, week: null, weeks };
  for (const w of weeks) {
    const i = order.findIndex((sid) => !doneWeek(sid, ym, w));
    if (i > -1) return { open: true, ronda: 1, current: order[i], idx: i, order, week: w, weeks };
  }
  return { open: true, ronda: 2, current: null, idx: order.length, order, week: null, weeks };
}

/** Con qué rol entraría la persona a ese bloque (o null si no puede). */
function roleFor(sid, d, b) {
  const s = person(sid);
  if (!s) return null;
  const a = at(d, b);
  if (!a.tit && s.canTit) return 'titular';
  if (a.tit && a.tit.sid !== sid && !a.sh && s.canSh && blockInfo(d, b).shadow) return 'shadow';
  return null;
}

function canBook(sid, d, b) {
  const s = person(sid);
  const ym = ymOf(d);
  if (!s) return { ok: false, why: 'Perfil no encontrado' };
  if (monthDoc(ym).status !== 'reservas') return { ok: false, why: 'Las reservas de este mes no están abiertas' };
  if (blockInfo(d, b).closed) return { ok: false, why: 'Bloque cerrado' };
  if (hoursUntil(d, b) <= 0) return { ok: false, why: 'Ese bloque ya pasó' };
  if (mine(sid, d, otherBlock(b))) return { ok: false, why: 'Ya tenés el otro bloque de ese día: no se pueden tomar dos el mismo día' };
  const role = roleFor(sid, d, b);
  if (!role) {
    const a = at(d, b);
    if (!a.tit && !s.canTit) return { ok: false, why: 'No tenés habilitado ir de titular' };
    return { ok: false, why: 'Ocupado' };
  }
  const ti = turnInfo(ym);
  const { min, max } = limitsOf(sid, ym);
  const w = weekOf(d);
  const n = weekCount(sid, w);
  if (role === 'titular' && ti.ronda === 1) {
    if (!w.full) return { ok: false, why: 'Los días sueltos de inicio y fin de mes se abren cuando terminen los turnos de todas las semanas' };
    if (w.start > ti.week.start) return { ok: false, why: `Esa semana todavía no se abrió: ahora se elige la semana del ${weekRange(ti.week)}` };
    if (w.start === ti.week.start) {
      if (ti.current !== sid) {
        const pos = ti.order.indexOf(sid);
        return { ok: false, why: pos > -1 && pos < ti.idx
          ? 'Ya terminaste tu turno de esta semana: cuando todas elijan, vas a poder sumar hasta tu máximo'
          : 'Todavía no es tu turno en esta semana' };
      }
      if (n >= min) return { ok: false, why: `En tu turno podés tomar hasta tu mínimo (${min}) en esta semana. El resto, cuando todas hayan elegido.` };
    }
    // semanas anteriores: ya eligieron todas, quedan libres hasta el máximo
  }
  if (n >= max) return { ok: false, why: `Llegaste a tu máximo de ${max} por semana` };
  return { ok: true, role };
}

function statusOf(bk) {
  if (bk.att && bk.att.st) return bk.att.st;
  const t = todayISO();
  if (bk.date < t) return 'sinmarcar';
  if (bk.date === t) return 'hoy';
  return 'prog';
}

/** Tarifa vigente para una fecha (la última cuyo "from" <= fecha). */
function rateFor(s, iso) {
  if (!s || !Array.isArray(s.rates) || !s.rates.length) return 0;
  const sorted = [...s.rates].sort((a, b) => a.from.localeCompare(b.from));
  let v = sorted[0].value;
  sorted.forEach((r) => { if (r.from <= iso) v = r.value; });
  return v;
}
const currentRate = (s) => rateFor(s, todayISO());

/** Liquidación del mes: cada bloque con presente se valúa con la tarifa de su fecha. */
function liq(ym) {
  const t = todayISO();
  const people = D.staff.filter((s) => s.active !== false
    || D.bookings.some((x) => x.sid === s.id && ymOf(x.date) === ym));
  return people.sort((a, b) => (a.rank || 99) - (b.rank || 99)).map((s) => {
    const bks = D.bookings.filter((x) => x.sid === s.id && ymOf(x.date) === ym && x.date <= t);
    let asist = 0, hAsist = 0, hParc = 0, faltas = 0, sin = 0, total = 0;
    bks.forEach((x) => {
      const a = x.att;
      if (!a || !a.st) { sin++; return; }
      if (a.st === 'asistio') { asist++; hAsist += a.h; total += a.h * rateFor(s, x.date); }
      else if (a.st === 'parcial') { hParc += a.h; total += a.h * rateFor(s, x.date); }
      else faltas++;
    });
    const ex = D.extras.filter((e) => e.sid === s.id && ymOf(e.date) === ym);
    const ok = ex.filter((e) => e.estado === 'ok');
    const hEx = ok.reduce((a, e) => a + e.h, 0);
    total += ok.reduce((a, e) => a + e.h * rateFor(s, e.date), 0);
    const pend = ex.filter((e) => e.estado === 'pend').length;
    const pago = D.pagos[`${ym}_${s.id}`] || null;
    return { s, asist, hAsist, hParc, hEx, pend, faltas, sin, h: hAsist + hParc + hEx, total, pago };
  });
}

/** Mes que se está reservando (o el próximo, si no hay ninguno abierto). */
function reservingMonth() {
  const cur = currentYM();
  if (monthDoc(cur).status === 'reservas') return cur;
  return addMonths(cur, 1);
}
