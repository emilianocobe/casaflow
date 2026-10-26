/* =========================================================
   CasaFlow (app nueva) · app.js
   Pantallas, navegación y acciones.
     Administración: Hoy · Planificación · Equipo · Liquidación
     Colaboradoras:  Reservar (agenda semanal) · Mis bloques
   ========================================================= */

'use strict';

/* ---------- estado de la interfaz ---------- */

const U = {
  adminTab: 'hoy',
  collabTab: 'reservar',
  planMonth: addMonths(currentYM(), 1),
  liqMonth: currentYM(),
  myLiqMonth: currentYM(),
  cWeek: null,          // índice de semana en Reservar (null = elegir automáticamente)
  modal: null,          // {type, d, b} para refrescar el modal abierto
  anim: true,
};

/* ---------- utilidades de interfaz ---------- */

const icon = (n, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${n}"></use></svg>`;
const $app = () => document.getElementById('app');

function toast(msg, kind = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  el.innerHTML = `${icon(kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info')}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('gone'), 2800);
  setTimeout(() => el.remove(), 3300);
}

const fail = (e) => {
  console.error('[CasaFlow]', e);
  toast(e && e.code === 'taken' ? 'Alguien lo tomó recién. Probá con otro bloque.'
    : e && e.code === 'email' ? e.message
    : 'No se pudo guardar (' + ((e && (e.code || e.message)) || 'error') + ')', 'err');
};

function openModal(html) {
  const layer = document.getElementById('modal-layer');
  const wasOpen = layer.classList.contains('open');
  layer.innerHTML = `
    <div class="modal-backdrop" data-act="modal-close"></div>
    <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-x" data-act="modal-close" aria-label="Cerrar">${icon('x')}</button>
      ${html}
    </div>`;
  const h3 = layer.querySelector('h3');
  if (h3) h3.id = 'modal-title';
  layer.classList.add('open');
  if (!wasOpen) {
    const f = layer.querySelector('input, select, button:not(.modal-x)') || layer.querySelector('.modal-x');
    if (f) f.focus();
  }
}

function closeModal() {
  const layer = document.getElementById('modal-layer');
  layer.classList.remove('open');
  layer.innerHTML = '';
  U.modal = null;
}

function refreshModal() {
  if (!U.modal) return;
  const { type, d, b, sid } = U.modal;
  if (type === 'block') blockModal(d, b);
  if (type === 'cblock') collabBlockModal(d, b);
  if (type === 'staff') staffModal(sid);
}

function stk(s, { mark = '', cls = '', small = false } = {}) {
  if (!s) return '';
  return `<span class="stk ${small ? 'stk-sm' : ''}" style="--c:${esc(s.color)}" title="${esc(s.name)}">${esc(s.name[0])}${
    mark ? `<i class="stk-badge bd-${cls}">${mark}</i>` : ''}</span>`;
}

function banner(kind, html) {
  const ic = { go: 'sparkle', wait: 'clock', done: 'check', info: 'info', warn: 'alert' }[kind];
  return `<div class="banner b-${kind}">${icon(ic)}<div>${html}</div></div>`;
}

const statusChip = (st) => `<span class="chip st-${STATUS[st].cls}">${STATUS[st].mark ? STATUS[st].mark + ' ' : ''}${STATUS[st].label}</span>`;

function anim() {
  if (!U.anim) return '';
  U.anim = false;
  return 'view-enter';
}

function calGrid(ym, cellFn, cls) {
  const days = monthDays(ym);
  const lead = (fromISO(days[0]).getDay() + 6) % 7;
  const head = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((x) => `<span class="cal-dow">${x}</span>`).join('');
  let cells = '';
  for (let i = 0; i < lead; i++) cells += `<div class="${cls}-day cal-blank" aria-hidden="true"></div>`;
  const t = todayISO();
  days.forEach((d) => {
    cells += `<div class="${cls}-day ${d === t ? 'is-today' : ''}"><span class="cal-num">${Number(d.slice(8))}</span>${cellFn(d)}</div>`;
  });
  return `<div class="cal ${cls}">${head}${cells}</div>`;
}

function monthNav(ym, act) {
  return `<div class="month-nav">
    <button class="iconbtn" data-act="${act}" data-d="-1" aria-label="Mes anterior">${icon('arrow-left')}</button>
    <span class="month-label">${esc(monthLabel(ym))}</span>
    <button class="iconbtn" data-act="${act}" data-d="1" aria-label="Mes siguiente">${icon('arrow-right')}</button>
  </div>`;
}

/* ---------- barra superior ---------- */

function topbar() {
  const demo = Store.mode === 'demo';
  const who = Store.role === 'collab' ? person(Store.mySid) : null;
  return `<header class="topbar">
    <div class="brand">
      <span class="brand-logo">${icon('home')}</span>
      <span class="brand-text"><b>CasaFlow</b><small>${esc(D.house.name || 'Mi casa')}${who ? ' · ' + esc(who.name) : ''}</small></span>
    </div>
    <div class="topbar-actions">
      <a class="iconbtn" href="../" title="Elegir app" aria-label="Volver a elegir app">${icon('arrow-left')}</a>
      ${!demo && Store.user ? `<button class="iconbtn" data-act="logout" title="Salir" aria-label="Salir">${icon('logout')}</button>` : ''}
    </div>
  </header>
  ${demo ? demoBar() : ''}`;
}

function demoBar() {
  const opts = [['admin', '', 'Administración'], ...D.staff.filter((s) => s.active !== false).map((s) => ['collab', s.id, s.name])];
  const cur = Store.role === 'admin' ? 'admin|' : `collab|${Store.mySid}`;
  return `<div class="demo-bar" role="note">
    ${icon('sparkle')} <b>Demo</b> con datos de ejemplo (solo en este navegador).
    <label>Ver como <select class="input" data-chg="demo-as">${opts.map(([r, sid, l]) =>
      `<option value="${r}|${sid}" ${cur === `${r}|${sid}` ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
    <button class="btn btn-mini btn-ghost" data-act="demo-reset">Reiniciar demo</button>
  </div>`;
}

/* ---------- pantallas de acceso (nube) ---------- */

function screenLoading() {
  return `${topbar()}<main class="wrap"><section class="login-hero">
    <div class="spinner" aria-hidden="true"></div><p class="muted">Conectando con tu casa…</p></section></main>`;
}

function screenLogin() {
  return `${topbar()}<main class="wrap view-enter">
    <section class="login-hero">
      <span class="new-badge">App nueva · bloques</span>
      <h1 class="display">Hola 👋</h1>
      <p class="muted">Entrá con tu cuenta de Google. Cada persona ve solo lo suyo.</p>
    </section>
    <section class="login-grid login-grid-one">
      <button class="login-card" data-act="signin">
        <span class="avatar avatar-org">${icon('key')}</span>
        <span class="login-name">Entrar con Google</span>
        <span class="login-role">Colaboradoras y administración</span>
      </button>
    </section>
  </main>`;
}

function screenNoAccess() {
  const u = Store.user || {};
  return `${topbar()}<main class="wrap view-enter">
    <section class="login-hero">
      <h1 class="display-sm">Todavía no estás en ninguna casa</h1>
      <p class="muted">Entraste como <b>${esc(u.email || '')}</b>.</p>
    </section>
    <section class="card">
      <h2 class="card-title">${icon('users')} ¿Sos colaboradora?</h2>
      <p class="muted">Pedile a la administración que te agregue al equipo de la <b>app nueva</b> con este mail:
        <b>${esc(u.email || '')}</b>. Después volvé a entrar.</p>
      <p class="hint">Si antes tenías acceso, puede que la administración lo haya pausado.</p>
    </section>
    <section class="card card-accent">
      <h2 class="card-title">${icon('home')} ¿Administrás la casa?</h2>
      <p class="muted">Creá la casa en la app nueva. Arranca en blanco, lista para planificar.</p>
      <form data-submit="house-create" class="form-grid">
        <label class="field"><span>Nombre de la casa</span>
          <input class="input" name="houseName" maxlength="40" required placeholder="Ej: Casa de la familia"></label>
        <label class="field"><span>Tu nombre</span>
          <input class="input" name="ownerName" maxlength="40" value="${esc(u.displayName || '')}"></label>
        <button class="btn btn-primary" type="submit">Crear mi casa</button>
      </form>
    </section>
  </main>`;
}

function screenError() {
  return `${topbar()}<main class="wrap view-enter"><section class="card card-danger">
    <h2 class="card-title">${icon('alert')} Algo no salió bien</h2>
    <p class="muted">${esc(Store.error || 'Error desconocido.')}</p>
    <div class="btn-row"><button class="btn" data-act="reload">Reintentar</button>
      <button class="btn btn-ghost" data-act="logout">Salir</button></div>
  </section></main>`;
}

/* =========================================================
   ADMINISTRACIÓN
   ========================================================= */

const ADMIN_TABS = [['hoy', 'Hoy', 'check'], ['plan', 'Planificación', 'calendar'], ['equipo', 'Equipo', 'users'], ['liq', 'Liquidación', 'money']];

function adminView() {
  const nav = `<nav class="tabs" aria-label="Secciones">${ADMIN_TABS.map(([v, l, ic]) =>
    `<button class="tab ${U.adminTab === v ? 'on' : ''}" data-act="atab" data-v="${v}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>`;
  const views = { hoy: hoyView, plan: planView, equipo: equipoView, liq: liqView };
  return topbar() + nav + `<main class="wrap ${anim()}">${views[U.adminTab]()}</main>`;
}

function attButtons(bk, big) {
  const cur = bk.att ? bk.att.st : null;
  const full = BLOCKS[bk.b].hours;
  const inputId = `ph-${bk.id}`;
  const val = bk.att && bk.att.st === 'parcial' ? bk.att.h : full - 1;
  const btn = (st, label) => `<button class="att-btn att-${STATUS[st].cls} ${cur === st ? 'on' : ''}"
      data-act="att" data-id="${bk.id}" data-st="${st}" ${st === 'parcial' ? `data-input="${inputId}"` : ''}>${label}</button>`;
  return `<div class="att ${big ? 'att-big' : ''}">
    ${btn('asistio', '✓ Asistió')}
    <span class="att-parcial">${btn('parcial', '½ Parcial')}
      <input id="${inputId}" class="input att-h" type="number" min="0.5" max="${full}" step="0.5" value="${val}" aria-label="Horas reales"> <small>h</small></span>
    ${btn('falto', '✕ No asistió')}
  </div>`;
}

function personAttRow(bk, big, withDate) {
  const p = person(bk.sid);
  return `<div class="att-row">
    <div class="att-who">${stk(p)}<div><b>${esc(p ? p.name : '—')}</b>${bk.role === 'shadow' ? ' <span class="chip chip-sh">shadow</span>' : ''}
      ${withDate ? `<small>${esc(cap(fmtDateLong(bk.date)))} · ${BLOCKS[bk.b].label.toLowerCase()}</small>` : ''}</div></div>
    ${attButtons(bk, big)}
  </div>`;
}

function extrasPending() {
  const pend = D.extras.filter((e) => e.estado === 'pend');
  if (!pend.length) return '';
  return `<section class="card card-accent">
    <h2 class="card-title">${icon('clock')} Horas extra para aprobar (${pend.length})</h2>
    ${pend.map((e) => {
      const p = person(e.sid);
      return `<div class="ex-row">${stk(p)}
        <div class="ex-text"><span><b>${esc(p ? p.name : '—')}</b> pide <b>+${fmtNum(e.h)} h</b> · ${esc(cap(fmtDateLong(e.date)))}, ${BLOCKS[e.b].label.toLowerCase()}</span>
          <small>“${esc(e.motivo)}”</small></div>
        <div class="ex-btns">
          <button class="btn btn-mini btn-ghost" data-act="ex-no" data-id="${e.id}">Rechazar</button>
          <button class="btn btn-mini btn-primary" data-act="ex-ok" data-id="${e.id}">Aprobar</button>
        </div></div>`;
    }).join('')}
  </section>`;
}

/* ---- Hoy ---- */

function hoyView() {
  const t = todayISO();
  const blocks = BKEYS.map((b) => ({ b, a: at(t, b) })).filter((x) => x.a.tit || x.a.sh);
  const cards = blocks.map(({ b, a }) => `<section class="card hoy-card">
      <div class="hoy-head"><h2 class="card-title">${icon('clock')} ${BLOCKS[b].label} · ${BLOCKS[b].range} h</h2>
        <span class="chip chip-soft">${BLOCKS[b].hours} h</span>
        <button class="btn btn-mini btn-ghost" data-act="block" data-d="${t}" data-b="${b}">${icon('plus')} Horas extra</button></div>
      ${[a.tit, a.sh].filter(Boolean).map((bk) => personAttRow(bk, true, false)).join('')}
    </section>`).join('')
    || `<section class="card"><p class="muted">Hoy no hay bloques reservados.</p></section>`;

  const desde = addDays(t, -62);
  const pend = D.bookings
    .filter((x) => x.date < t && x.date >= desde && !(x.att && x.att.st) && monthDoc(ymOf(x.date)).status !== 'liquidado')
    .sort((a, b) => (a.date + a.b).localeCompare(b.date + b.b));
  const pendCard = pend.length ? `<section class="card card-warnish">
      <h2 class="card-title">${icon('alert')} Te quedaron sin marcar (${pend.length})</h2>
      ${pend.map((bk) => personAttRow(bk, false, true)).join('')}
    </section>` : '';

  return `<section class="page-head"><p class="hero-kicker">${esc(cap(fmtDateLong(t)))}</p>
      <h1 class="display-sm">Hoy</h1>
      <p class="muted">Tomá presente con un toque. Lo que marques alimenta la liquidación.</p></section>
    ${cards}${pendCard}${extrasPending()}`;
}

/* ---- Planificación ---- */

function reservasPanel(ym) {
  const mo = monthDoc(ym);
  const st = monthStatus(ym);
  const ti = turnInfo(ym);
  const stepIdx = MONTH_STEPS.findIndex((x) => x.key === st);
  const steps = `<ol class="steps">${MONTH_STEPS.map((x, i) =>
    `<li class="${i < stepIdx ? 'done' : i === stepIdx ? 'now' : ''}"><span class="step-dot"></span><span>${x.label}</span></li>`).join('')}</ol>`;
  const full = weeksOfMonth(ym).filter((w) => w.full);
  const tw = ti.week ? ti.week.start : null;
  const chips = (sid) => full.map((w) => {
    const n = weekCount(sid, w);
    const { min } = limitsOf(sid, ym);
    return `<span class="qw ${n >= min ? 'qw-ok' : 'qw-low'} ${w.start === tw ? 'qw-now' : ''}" title="Semana del ${weekRange(w)}">${n}/${min}</span>`;
  }).join('');
  const queue = ti.order.map((sid, i) => {
    const s = person(sid);
    if (!s) return '';
    const passed = tw && passedTurn(sid, ym, tw) && weekCount(sid, ti.week) < limitsOf(sid, ym).min;
    const state = !ti.open ? (metMin(sid, ym) ? 'done' : 'wait')
      : ti.ronda === 2 ? 'done' : i < ti.idx ? (passed ? 'passed' : 'done') : i === ti.idx ? 'now' : 'wait';
    const tag = state === 'done' ? (ti.ronda === 1 ? '✓ eligió esta semana' : '✓ mínimo cubierto') : state === 'passed'
      ? `⏭ pasó su turno <button class="link-btn" data-act="unpass" data-sid="${sid}" data-wk="${tw}">devolverle el turno</button>`
      : state === 'now' ? 'eligiendo ahora' : 'en espera';
    const { min, max } = limitsOf(sid, ym);
    return `<li class="q q-${state}"><span class="q-pos">${i + 1}</span>${stk(s)}
      <span class="q-name">${esc(s.name)} <small>${roleText(s)} · mín ${min} / máx ${max} por semana</small></span>
      <span class="q-weeks">${chips(sid)}</span><span class="q-tag">${tag}</span></li>`;
  }).join('');
  const wkLine = ti.open && ti.weeks.length ? `<div class="wk-turns">${ti.weeks.map((w, j) => {
      const st = !tw || w.start < tw ? 'ok' : w.start === tw ? 'now' : 'wait';
      return `<span class="wkt wkt-${st}">${st === 'ok' ? '✓ ' : ''}Semana ${j + 1} · ${weekRange(w)}${st === 'now' ? ' · eligiendo' : st === 'ok' ? ' · libre' : ''}</span>`;
    }).join('')}</div>` : '';
  const r2 = `<li class="q q-${ti.open && ti.ronda === 2 ? 'now' : 'wait'} q-r2"><span class="q-pos">${icon('users')}</span>
    <span class="q-name">Ronda 2 <small>cuando terminan todas las semanas: todas suman hasta su máximo, también los días sueltos</small></span>
    <span class="q-tag">${ti.open && ti.ronda === 2 ? 'abierta' : 'después'}</span></li>`;
  const shadows = ranked().filter((s) => s.canSh);
  const shRow = shadows.length ? `<li class="q q-sh"><span class="q-pos sh-slot">S</span>
    <span class="q-name">Shadows · sin turno <small>toman los lugares de shadow apenas los habilitás</small></span>
    <span class="q-weeks">${shadows.map((s) => `<span class="q-shp">${stk(s, { small: true })}${esc(s.name)} ${chips(s.id)}</span>`).join('')}</span>
    <span class="q-tag">${ti.open ? 'abierto' : 'cerrado'}</span></li>` : '';

  let actions = '';
  if (mo.status === 'reservas') {
    actions = `${ti.ronda === 1 ? '<button class="btn btn-ghost" data-act="skip-turn">Pasar al siguiente turno</button>' : ''}
      <button class="btn btn-primary" data-act="close-res">${icon('check')} Cerrar reservas</button>`;
  } else if (st === 'prep') {
    actions = `<button class="btn btn-primary" data-act="open-res">${icon('sparkle')} Abrir reservas de ${monthName(ym)}</button>`;
  } else if (st === 'cerrado') {
    actions = '<button class="btn btn-ghost" data-act="reopen-res">Reabrir reservas</button>';
  }
  const prepHint = st === 'prep'
    ? `<p class="hint">Antes de abrir, cerrá los bloques que no se trabajan (tocá el bloque → Cerrar). Al abrir, se toma una foto del orden y de los mínimos y máximos de Equipo.</p>` : '';
  return `<section class="card">
    <h2 class="card-title">${icon('users')} Reservas de ${monthName(ym)}</h2>
    ${steps}${prepHint}
    <p class="hint">Los bloques de titular se eligen por turnos, <b>semana por semana</b>, en el orden de <b>Equipo</b>: en su turno, cada una toma
      <b>hasta su mínimo</b> de esa semana. Cuando eligieron todas, esa semana queda libre hasta el máximo y empieza la siguiente.
      Cada cuadradito es una semana completa (reservas / mínimo). Los lugares de shadow no esperan turno. Nadie puede tomar dos bloques el mismo día.</p>
    ${wkLine}
    ${ti.order.length ? `<ol class="queue">${queue}${r2}${shRow}</ol>` : '<p class="muted">Todavía no hay nadie en el equipo que pueda ir de titular.</p>'}
    <div class="btn-row">${actions}</div>
  </section>`;
}

function planRow(d, b) {
  const info = blockInfo(d, b);
  const a = at(d, b);
  const t = todayISO();
  let inner;
  if (info.closed) inner = '<span class="pr-closed">cerrado</span>';
  else if (!a.tit && !a.sh) inner = `<span class="pr-free">${d < t ? '—' : 'libre'}</span>`;
  else {
    inner = [a.tit, a.sh].filter(Boolean).map((bk) => {
      const st = bk.date <= t ? statusOf(bk) : null;
      return stk(person(bk.sid), { small: bk.role === 'shadow', mark: st ? STATUS[st].mark : '', cls: st ? STATUS[st].cls : '' });
    }).join('');
    if (info.shadow && a.tit && !a.sh) inner += '<span class="sh-slot" title="Lugar de shadow habilitado y libre">S</span>';
    if (a.sh && !a.tit) inner += '<span class="pr-alert" title="Shadow sin titular">!</span>';
  }
  return `<button class="pr ${info.closed ? 'is-closed' : ''}" data-act="block" data-d="${d}" data-b="${b}"
    aria-label="${esc(`${fmtDateLong(d)}, ${BLOCKS[b].label}`)}"><span class="pr-b">${BLOCKS[b].short}</span><span class="pr-who">${inner}</span></button>`;
}

function planView() {
  const ym = U.planMonth;
  const st = monthStatus(ym);
  const top = ['prep', 'reservas', 'cerrado'].includes(st) ? reservasPanel(ym)
    : banner('info', st === 'curso'
      ? `${monthLabel(ym)} está <b>en curso</b>. Para tomar presente usá <b>Hoy</b>; acá ves el mes completo.`
      : `${monthLabel(ym)} está <b>liquidado</b>.`);
  const legend = `<div class="legend">
    <span class="lg">${stk({ name: 'T', color: '#e08f3c' })} titular</span>
    <span class="lg">${stk({ name: 'S', color: '#4f93e0' }, { small: true })} shadow</span>
    <span class="lg"><span class="sh-slot">S</span> lugar de shadow libre</span>
    <span class="lg"><i class="stk-badge bd-ok">✓</i> asistió</span><span class="lg"><i class="stk-badge bd-half">½</i> parcial</span>
    <span class="lg"><i class="stk-badge bd-no">✕</i> no asistió</span><span class="lg"><i class="stk-badge bd-warn">!</i> sin marcar</span>
    <span class="lg"><span class="pr-closed">cerrado</span></span>
  </div>`;
  return `<section class="page-head"><h1 class="display-sm">Planificación</h1>${monthNav(ym, 'pmonth')}</section>
    ${top}
    <section class="card card-tight">${calGrid(ym, (d) => BKEYS.map((b) => planRow(d, b)).join(''), 'pcal')}${legend}
      <p class="hint">Tocá un bloque para asignar, habilitar un lugar de shadow, cerrarlo o tomar presente.</p></section>`;
}

function blockModal(d, b) {
  U.modal = { type: 'block', d, b };
  const a = at(d, b);
  const info = blockInfo(d, b);
  const canMark = d <= todayISO();
  const head = `<h3>${esc(cap(fmtDateLong(d)))}</h3>
    <p class="muted modal-sub">${BLOCKS[b].label} · ${BLOCKS[b].range} h · ${BLOCKS[b].hours} h</p>`;
  if (info.closed) {
    return openModal(head + banner('info', 'Este bloque está <b>cerrado</b>: nadie lo puede reservar.') + `
      <div class="modal-actions">
        <button class="btn btn-ghost" data-act="modal-close">Listo</button>
        <button class="btn btn-primary" data-act="blk-open" data-d="${d}" data-b="${b}">Abrir bloque</button>
      </div>`);
  }
  const w = weekOf(d);
  const ym = ymOf(d);
  const personSlot = (bk, title) => {
    const p = person(bk.sid);
    return `<div class="slot ${bk.role === 'shadow' ? 'slot-shadow' : ''}">
      <div class="slot-head"><span class="slot-role">${title}</span>${stk(p)}<b>${esc(p ? p.name : '—')}</b>
        ${canMark ? statusChip(statusOf(bk)) : ''}
        <button class="btn btn-mini btn-ghost slot-rm" data-act="rm" data-id="${bk.id}">Quitar</button></div>
      ${canMark ? attButtons(bk, false) : ''}
    </div>`;
  };
  const picker = (role, pool0, label) => {
    const pool = pool0.filter((s) => !mine(s.id, d, otherBlock(b)));
    if (!pool.length) return '<span class="hint">Las que podrían ir ya tienen el otro bloque de ese día.</span>';
    return `<div class="slot-assign">
      <select class="input" id="pick-${role}" aria-label="Elegir persona">${pool.map((s) =>
        `<option value="${s.id}">${esc(s.name)} · ${weekCount(s.id, w)}/${limitsOf(s.id, ym).max} esa semana</option>`).join('')}</select>
      <button class="btn btn-mini" data-act="assign" data-role="${role}" data-d="${d}" data-b="${b}">${label}</button></div>`;
  };

  let titSec;
  if (a.tit) titSec = personSlot(a.tit, 'Titular');
  else {
    const pool = ranked().filter((s) => s.canTit);
    titSec = `<div class="slot slot-empty"><span class="slot-role">Titular</span>
      ${pool.length ? picker('titular', pool, 'Asignar') : '<span class="hint">Nadie tiene habilitado ir de titular.</span>'}</div>`;
  }

  let shSec;
  if (a.sh) shSec = personSlot(a.sh, 'Shadow') + (!a.tit ? banner('warn', 'Quedó la shadow sin titular. Asigná una titular o quitala.') : '');
  else if (!a.tit) {
    shSec = `<div class="slot slot-empty"><span class="slot-role">Shadow</span>
      <span class="hint">El lugar de shadow se puede habilitar cuando el bloque ya tiene titular.</span></div>`;
  } else if (!info.shadow) {
    shSec = `<div class="slot slot-empty"><span class="slot-role">Shadow</span><span class="hint">Sin lugar de shadow.</span>
      <button class="btn btn-mini btn-primary slot-rm" data-act="sh-on" data-d="${d}" data-b="${b}">${icon('plus')} Habilitar lugar de shadow</button></div>`;
  } else {
    const pool = ranked().filter((s) => s.canSh && s.id !== a.tit.sid);
    shSec = `<div class="slot slot-shadow slot-open">
      <div class="slot-head"><span class="slot-role">Shadow</span><span class="chip chip-sh">Lugar habilitado · libre</span>
        <button class="btn btn-mini btn-ghost slot-rm" data-act="sh-off" data-d="${d}" data-b="${b}">Deshabilitar</button></div>
      <p class="hint">Lo puede tomar cualquier persona habilitada como shadow, sin turno. O asignalo vos:</p>
      ${pool.length ? picker('shadow', pool, 'Asignar ahora') : '<p class="hint">Nadie tiene habilitado ir de shadow (se activa en Equipo).</p>'}
    </div>`;
  }

  const booked = [a.tit, a.sh].filter(Boolean);
  const exList = D.extras.filter((e) => e.date === d && e.b === b);
  const exRows = exList.map((e) => `<li>${stk(person(e.sid), { small: true })}<span><b>${fmtSigned(e.h)}</b> · ${esc(e.motivo)}</span>
      ${e.h < 0 ? '<span class="chip chip-soft">descontada</span>' : e.estado === 'ok' ? '<span class="chip st-ok">aprobada</span>' : e.estado === 'rej' ? '<span class="chip st-no">rechazada</span>'
        : `<button class="btn btn-mini btn-ghost" data-act="ex-no" data-id="${e.id}">Rechazar</button>
           <button class="btn btn-mini btn-primary" data-act="ex-ok" data-id="${e.id}">Aprobar</button>`}</li>`).join('');
  const exSec = canMark && booked.length ? `<div class="ex-sec"><h4>${icon('clock')} Horas extra o descontadas en este bloque</h4>
      ${exRows ? `<ul class="ex-list">${exRows}</ul>` : '<p class="hint">Sin cambios de horas.</p>'}
      <div class="ex-add">
        <select class="input" id="ex-sid" aria-label="Persona">${booked.map((x) => `<option value="${x.sid}">${esc((person(x.sid) || {}).name || '—')}</option>`).join('')}</select>
        <input class="input" id="ex-h" type="number" min="0.5" max="6" step="0.5" value="1" aria-label="Horas">
        <input class="input" id="ex-m" type="text" maxlength="80" placeholder="Motivo (opcional)" aria-label="Motivo">
        <button class="btn btn-mini" data-act="ex-add" data-d="${d}" data-b="${b}">${icon('plus')} Sumar</button>
        <button class="btn btn-mini btn-ghost" data-act="ex-sub" data-d="${d}" data-b="${b}">− Restar</button>
      </div><p class="hint">Restar sirve, por ejemplo, si se fue antes. Se descuenta de las horas ya cargadas de ese bloque.</p></div>` : '';
  const closeBtn = !booked.length ? `<button class="btn btn-ghost" data-act="blk-close" data-d="${d}" data-b="${b}">Cerrar este bloque</button>` : '';
  openModal(head + titSec + shSec + exSec + `<div class="modal-actions">${closeBtn}<button class="btn btn-primary" data-act="modal-close">Listo</button></div>`);
}

/* ---- Equipo ---- */

function equipoView() {
  const list = ranked();
  const stepper = (s, f) => `<div class="num-step"><span>${f === 'min' ? 'Mínimo' : 'Máximo'}</span>
    <button class="iconbtn" data-act="lim" data-sid="${s.id}" data-f="${f}" data-d="-1" aria-label="Restar">−</button>
    <b>${s[f] || 0}</b>
    <button class="iconbtn" data-act="lim" data-sid="${s.id}" data-f="${f}" data-d="1" aria-label="Sumar">+</button></div>`;
  const sw = (s, p, label) => `<label class="switch ${p === 'canSh' ? 'switch-sh' : ''}">
      <input type="checkbox" data-chg="perm" data-p="${p}" data-sid="${s.id}" ${s[p] ? 'checked' : ''}>
      <span class="sw" aria-hidden="true"></span><span>${label}</span></label>`;
  const cards = list.map((s, i) => `<div class="card tm ${!s.canTit && s.canSh ? 'tm-shadow' : ''}">
    <div class="tm-rank">
      <button class="iconbtn" data-act="rank" data-sid="${s.id}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir en la prioridad">▲</button>
      <span class="tm-pos">${i + 1}</span>
      <button class="iconbtn" data-act="rank" data-sid="${s.id}" data-d="1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Bajar en la prioridad">▼</button>
    </div>
    <div class="tm-main">
      <div class="tm-head">${stk(s)}<div><b>${esc(s.name)}</b>
        <small>${fmtMoney(currentRate(s))}/h · ${s.email ? esc(s.email) : '<span class="warn-text">sin email: no puede entrar</span>'}</small></div></div>
      <div class="tm-limits"><span class="tm-lbl">Reservas por semana</span>${stepper(s, 'min')}${stepper(s, 'max')}</div>
      <div class="tm-perms">${sw(s, 'canTit', 'Puede ir de titular')}${sw(s, 'canSh', 'Puede ir de shadow')}</div>
      <div class="tm-actions"><button class="btn btn-mini" data-act="staff-edit" data-sid="${s.id}">${icon('edit')} Editar</button>
        <button class="btn btn-mini" data-act="rate-new" data-sid="${s.id}">${icon('money')} Nueva tarifa</button>
        <button class="btn btn-mini btn-ghost" data-act="staff-archive" data-sid="${s.id}">Archivar</button></div>
    </div>
  </div>`).join('');
  const arch = archived();
  return `<section class="page-head"><h1 class="display-sm">Equipo</h1>
      <p class="muted">El orden es la <b>prioridad para elegir</b> bloques de titular: la nº 1 elige primero. El mínimo y el máximo son
        <b>por semana</b> (lunes a domingo) y cuentan todas sus reservas, de titular y de shadow. Los lugares de shadow se eligen sin turno.</p>
      <button class="btn btn-primary" data-act="staff-new">${icon('plus')} Agregar colaboradora</button></section>
    <div class="tm-list">${cards || '<p class="empty-note">Todavía no hay nadie en el equipo. ¡Agregá a la primera persona!</p>'}</div>
    ${adminsCard()}
    ${arch.length ? `<details class="rate-history" style="margin-top:14px"><summary>Archivadas (${arch.length})</summary>
      <ul class="skip-list">${arch.map((s) => `<li><span>${stk(s, { small: true })} ${esc(s.name)}</span>
        <button class="btn btn-mini" data-act="staff-restore" data-sid="${s.id}">Restaurar</button></li>`).join('')}</ul></details>` : ''}`;
}

/** Administradoras: quien creó la casa puede sumar a otras personas con acceso total. */
function adminsCard() {
  const admins = Object.entries(D.house.admins || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const owner = Store.isOwner;
  const rows = admins.map(([email, a]) => `<li><span><b>${esc((a && a.name) || email)}</b> <small class="muted">${esc(email)}</small></span>
      ${owner ? `<button class="btn btn-mini btn-ghost" data-act="admin-rm" data-email="${esc(email)}">Quitar</button>` : ''}</li>`).join('');
  return `<section class="card admins-card">
    <h2 class="card-title">${icon('users')} Administración</h2>
    <p class="hint">Las administradoras ven y manejan todo, igual que vos: equipo, tarifas, planificación, presentes y liquidaciones.
      Entran con su cuenta de Google en este mismo link.</p>
    <ul class="skip-list">
      <li><span><b>${esc(D.house.ownerName || 'Administración')}</b> <small class="muted">${esc(D.house.ownerEmail || '')} · creó la casa</small></span></li>
      ${rows}
    </ul>
    ${owner ? `<form data-submit="admin-add" class="admin-add">
        <input class="input" name="name" type="text" maxlength="40" placeholder="Nombre" aria-label="Nombre" required>
        <input class="input" name="email" type="email" maxlength="120" placeholder="Gmail de la persona" aria-label="Gmail" required>
        <button class="btn btn-mini btn-primary" type="submit">${icon('plus')} Agregar administradora</button>
      </form>` : '<p class="hint">Solo quien creó la casa puede sumar o quitar administradoras.</p>'}
  </section>`;
}

function staffModal(sid) {
  const m = sid ? person(sid) : null;
  U.modal = null;
  const selected = m && m.color ? m.color : STAFF_COLORS[D.staff.length % STAFF_COLORS.length];
  const palette = m && m.color && !STAFF_COLORS.includes(m.color) ? [m.color, ...STAFF_COLORS] : STAFF_COLORS;
  const colors = palette.map((c) => `<label class="color-pick"><input type="radio" name="color" value="${esc(c)}" ${c === selected ? 'checked' : ''}>
      <span style="--c:${esc(c)}"></span></label>`).join('');
  openModal(`<h3>${m ? 'Editar a ' + esc(m.name) : 'Nueva colaboradora'}</h3>
    <form data-submit="staff-save" ${m ? `data-sid="${m.id}"` : ''}>
      <label class="field"><span>Nombre</span><input class="input" name="name" required maxlength="40" value="${m ? esc(m.name) : ''}" placeholder="Ej: Josefina"></label>
      <label class="field"><span>Email (cuenta de Google)</span>
        <input class="input" name="email" type="email" maxlength="120" value="${m ? esc(m.email || '') : ''}" placeholder="nombre@gmail.com">
        <small class="hint">Con este mail entra desde su celular y ve solo lo suyo.</small></label>
      <div class="field"><span>Color</span><div class="color-row">${colors}</div></div>
      ${m ? '' : `<div class="form-grid">
        <label class="field"><span>Tarifa por hora</span><input class="input" name="rate" type="number" min="0" step="0.01" required placeholder="7500"></label>
        <label class="field"><span>Vigente desde</span><input class="input" name="rateFrom" type="date" value="${todayISO()}"></label>
        <label class="field"><span>Mínimo por semana</span><input class="input" name="min" type="number" min="0" max="14" value="2"></label>
        <label class="field"><span>Máximo por semana</span><input class="input" name="max" type="number" min="1" max="14" value="4"></label>
      </div>
      <label class="check"><input type="checkbox" name="canTit" checked> <span>Puede ir de titular</span></label>
      <label class="check"><input type="checkbox" name="canSh"> <span>Puede ir de shadow</span></label>`}
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-act="modal-close">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button></div>
    </form>`);
}

function rateModal(sid) {
  const m = person(sid);
  const hist = [...(m.rates || [])].sort((a, b) => b.from.localeCompare(a.from))
    .map((r) => `<li><b>${fmtMoney(r.value)}</b> <span class="muted">desde ${fmtDateFull(r.from)}</span></li>`).join('');
  openModal(`<h3>Nueva tarifa · ${esc(m.name)}</h3>
    <p class="muted">La tarifa anterior sigue valiendo para las fechas previas.</p>
    <form data-submit="rate-save" data-sid="${m.id}">
      <div class="form-grid">
        <label class="field"><span>Valor por hora</span><input class="input" name="value" type="number" min="0" step="0.01" required value="${currentRate(m)}"></label>
        <label class="field"><span>Vigente desde</span><input class="input" name="from" type="date" value="${todayISO()}" required></label>
      </div>
      ${hist ? `<details class="rate-history"><summary>Historial</summary><ul>${hist}</ul></details>` : ''}
      <div class="modal-actions"><button type="button" class="btn btn-ghost" data-act="modal-close">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar tarifa</button></div>
    </form>`);
}

/* ---- Liquidación ---- */

function liqView() {
  const ym = U.liqMonth;
  const rows = liq(ym);
  const total = rows.reduce((a, r) => a + r.total, 0);
  const sin = rows.reduce((a, r) => a + r.sin, 0);
  const body = rows.map((r) => `<tr>
      <td>${stk(r.s, { small: true })} ${esc(r.s.name)}</td>
      <td class="num">${r.asist} · ${fmtNum(r.hAsist)} h</td>
      <td class="num">${r.hParc ? fmtNum(r.hParc) + ' h' : '—'}</td>
      <td class="num">${r.hEx ? fmtSigned(r.hEx) : '—'}${r.pend ? ` <span class="chip st-warn">${r.pend} pend.</span>` : ''}</td>
      <td class="num">${r.faltas || '—'}</td>
      <td class="num">${r.sin ? `<span class="chip st-warn">${r.sin}</span>` : '—'}</td>
      <td class="num strong">${fmtNum(r.h)} h</td>
      <td class="num strong">${fmtMoney(r.total)}</td>
      <td class="num"><button class="paychip ${r.pago ? 'paid' : ''}" data-act="pago" data-sid="${r.s.id}">
        ${r.pago ? `${icon('check')} Pagado` : 'Marcar pagado'}</button></td>
    </tr>`).join('');
  const st = monthStatus(ym);
  return `<section class="page-head"><h1 class="display-sm">Liquidación</h1>${monthNav(ym, 'lmonth')}
      <p class="muted">Sale sola de los bloques con presente tomado, hasta hoy.</p></section>
    ${sin ? banner('warn', `Hay <b>${plural(sin, 'bloque sin marcar', 'bloques sin marcar')}</b> que todavía no se cuentan.
      <button class="link-btn" data-act="go-hoy">Tomar presente →</button>`) : ''}
    ${extrasPending()}
    <section class="card">
      ${rows.length ? `<div class="table-scroll"><table class="table">
        <thead><tr><th>Persona</th><th class="num">Bloques asistidos</th><th class="num">Parciales</th><th class="num">Extras</th>
          <th class="num">Faltas</th><th class="num">Sin marcar</th><th class="num">Horas</th><th class="num">Total</th><th class="num">Pago</th></tr></thead>
        <tbody>${body}</tbody>
        <tfoot><tr><td colspan="7">Total del mes</td><td class="num strong total-cell">${fmtMoney(total)}</td><td></td></tr></tfoot>
      </table></div>` : '<p class="muted">Sin datos para este mes.</p>'}
      <p class="hint">Mañana = 5 h · Tarde = 6 h · las faltas no se pagan · las horas extra cuentan cuando las aprobás · cada bloque con la tarifa vigente en su fecha.</p>
      ${st === 'curso' || st === 'cerrado' ? `<div class="btn-row"><button class="btn btn-ghost" data-act="liquidar">${icon('check')} Marcar ${monthName(ym)} como liquidado</button></div>` : ''}
    </section>`;
}

/* =========================================================
   COLABORADORA
   ========================================================= */

const COLLAB_TABS = [['reservar', 'Reservar', 'calendar'], ['mis', 'Mis bloques', 'list'], ['liq', 'Mi liquidación', 'money']];

function collabView() {
  const s = person(Store.mySid);
  if (!s || s.active === false) {
    return `${topbar()}<main class="wrap"><section class="card">
      <h2 class="card-title">${icon('info')} Tu acceso está pausado</h2>
      <p class="muted">La administración archivó tu perfil. Si creés que es un error, hablalo con ella.</p></section></main>`;
  }
  const body = U.collabTab === 'reservar' ? reservarView(s) : U.collabTab === 'liq' ? myLiqView(s) : misView(s);
  return `${topbar()}<div class="collab">
    <div class="ph-top"><span class="avatar" style="--c:${esc(s.color)}">${esc(s.name[0])}</span>
      <div><b>Hola, ${esc(s.name)}</b><small>${esc(cap(roleText(s)))}</small></div></div>
    <nav class="ph-tabs" aria-label="Secciones">${COLLAB_TABS.map(([v, l, ic]) =>
      `<button class="${U.collabTab === v ? 'on' : ''}" data-act="ctab" data-v="${v}">${icon(ic)} ${l}</button>`).join('')}</nav>
    <div class="ph-body ${anim()}">${body}</div>
  </div>`;
}

function turnBanner(s, ym) {
  const ti = turnInfo(ym);
  const st = monthStatus(ym);
  const { min, max } = limitsOf(s.id, ym);
  if (!s.canTit && !s.canSh) return banner('info', 'Todavía no tenés habilitado reservar. Hablá con la administración.');
  if (!ti.open) {
    return banner('info', st === 'prep'
      ? `Las reservas de <b>${monthName(ym)}</b> todavía no abrieron. Te avisamos cuando abran.`
      : `<b>Las reservas de ${monthName(ym)} están cerradas.</b> Para un cambio, avisale a la administración.`);
  }
  if (!s.canTit) {
    return banner('go', `<b>Elegí cuando quieras: no esperás turno.</b> Apenas la administración habilita un lugar de shadow, lo podés tomar.
      Meta: <b>${min} por semana</b> (máximo ${max}).`);
  }
  const que = s.canSh ? 'reservas (de titular o de shadow)' : 'bloques';
  const shNote = s.canSh ? ' Los lugares de shadow los podés tomar cuando quieras, sin esperar turno.' : '';
  if (ti.ronda === 1) {
    const pos = ti.order.indexOf(s.id);
    const wn = ti.weeks.indexOf(ti.week) + 1;
    const semana = `la <b>semana ${wn}</b> (del ${weekRange(ti.week)})`;
    const libres = wn > 1 ? ` Las semanas anteriores ya están libres: ahí podés sumar hasta tu máximo (${max}).` : '';
    if (ti.current === s.id) {
      return banner('go', `<b>¡Es tu turno en ${semana}!</b> Elegí <b>${min} ${que}</b> en esa semana, tu mínimo. Cuando lo cubras, le toca a la siguiente.${libres}${shNote}
        <div class="pass-row"><span>¿No podés completar el mínimo de esta semana?</span>
          <button class="btn btn-mini btn-ghost" data-act="pass-turn" data-ym="${ym}" data-wk="${ti.week.start}">${icon('arrow-right')} Pasar mi turno</button></div>`);
    }
    if (pos > -1 && pos < ti.idx) {
      const msg = passedTurn(s.id, ym, ti.week.start) && weekCount(s.id, ti.week) < min ? 'Pasaste tu turno' : 'Ya elegiste';
      return banner('done', `<b>${msg} en ${semana}.</b> Cuando todas elijan, sigue la semana siguiente.${libres}${shNote}`);
    }
    const ahead = pos > -1 ? pos - ti.idx : 0;
    return banner('wait', `<b>Se está eligiendo ${semana}.</b> ${ahead === 1 ? 'Falta 1 persona' : `Faltan ${ahead} personas`} antes que vos. Mientras, podés mirar qué queda libre.${libres}${shNote}`);
  }
  return banner('go', `<b>Ronda 2 abierta.</b> Ya eligieron todas en todas las semanas: podés sumar ${que} hasta tu máximo de ${max} por semana, también en los días sueltos.${shNote}`);
}

function pillState(s, d, b) {
  if (blockInfo(d, b).closed) return { cls: 'closed', text: 'cerrado' };
  const own = mine(s.id, d, b);
  if (own) return { cls: 'mine', text: own.role === 'shadow' ? 'vas de shadow' : 'tuyo' };
  const a = at(d, b);
  const c = canBook(s.id, d, b);
  if (!a.tit) {
    if (!s.canTit) return { cls: 'na', text: 'sin lugar para vos', why: 'No tenés habilitado ir de titular' };
    return c.ok ? { cls: 'free', text: 'libre' } : { cls: 'na', text: 'libre', why: c.why };
  }
  if (s.canSh && a.tit.sid !== s.id && !a.sh && blockInfo(d, b).shadow) {
    return c.ok ? { cls: 'free-sh', text: 'lugar de shadow' } : { cls: 'na-sh', text: 'lugar de shadow', why: c.why };
  }
  return { cls: 'busy', text: 'ocupado' };
}

function agButton(s, d, b) {
  const ps = pillState(s, d, b);
  const own = mine(s.id, d, b);
  const label = `${cap(fmtDateLong(d))}, ${BLOCKS[b].label}: ${ps.text}${ps.why ? ` (${ps.why})` : ''}`;
  return `<button class="ag ag-${ps.cls} ${own && own.role === 'shadow' ? 'ag-mine-sh' : ''}" ${ps.cls === 'mine' ? `style="--c:${esc(s.color)}"` : ''}
      data-act="reserve" data-d="${d}" data-b="${b}" aria-label="${esc(label)}">
    <span class="ag-t">${BLOCKS[b].label}</span>
    <span class="ag-r">${BLOCKS[b].range} h · ${BLOCKS[b].hours} h</span>
    <span class="ag-s">${ps.cls === 'mine' ? icon('check') : ''}${esc(ps.text)}</span></button>`;
}

function reservarView(s) {
  const ym = reservingMonth();
  const weeks = weeksOfMonth(ym);
  const tiW = turnInfo(ym).week;
  if (U.cWeek === null) U.cWeek = Math.max(0, tiW ? weeks.findIndex((w) => w.start === tiW.start) : weeks.findIndex((w) => w.full));
  const i = clamp(U.cWeek, 0, weeks.length - 1);
  const w = weeks[i];
  const n = weekCount(s.id, w);
  const { min, max } = limitsOf(s.id, ym);
  const strip = `<div class="wk-strip" role="group" aria-label="Semanas de ${monthName(ym)}">${weeks.map((x, j) => {
    const c = weekCount(s.id, x);
    const st = !x.full ? 'part' : c >= min ? 'ok' : 'low';
    const days = x.days.length === 1 ? `${Number(x.days[0].slice(8))}` : `${Number(x.days[0].slice(8))}–${Number(x.days[x.days.length - 1].slice(8))}`;
    const turn = tiW && x.start === tiW.start;
    return `<button class="wkc wkc-${st} ${j === i ? 'on' : ''} ${turn ? 'wkc-turn' : ''}" data-act="cweek-go" data-i="${j}" aria-label="Semana del ${weekRange(x)}: ${c} reservas${turn ? ', en turno' : ''}">
      <b>${c}${x.full ? `<small>/${min}</small>` : ''}</b><span>${days}</span>${turn ? '<em>turno</em>' : ''}</button>`;
  }).join('')}</div>`;
  const rows = w.days.map((d) => `<div class="ag-day">
      <div class="ag-date"><b>${DOW_SHORT[fromISO(d).getDay()]}</b><span>${Number(d.slice(8))}</span></div>
      ${BKEYS.map((b) => agButton(s, d, b)).join('')}
    </div>`).join('');
  const segs = Array.from({ length: Math.max(1, max) }, (_, x) =>
    `<i class="${x < n ? 'on' : ''} ${w.full && min > 0 && x === min - 1 ? 'minmark' : ''}" style="--c:${esc(s.color)}"></i>`).join('');
  const status = !w.full ? 'semana incompleta: no exige mínimo'
    : n >= min ? `mínimo cubierto ✓ · podés llegar a ${max}` : `mínimo ${min} · te ${min - n === 1 ? 'falta 1' : `faltan ${min - n}`}`;
  return `<h2 class="collab-month">${icon('calendar')} Reservas de ${monthLabel(ym)}</h2>
    ${turnBanner(s, ym)}
    ${strip}
    <div class="wk-nav">
      <button class="iconbtn" data-act="cweek" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Semana anterior">${icon('arrow-left')}</button>
      <div><b>Semana del ${weekRange(w)}</b><small>Mínimo ${min} · máximo ${max} reservas por semana</small></div>
      <button class="iconbtn" data-act="cweek" data-d="1" ${i === weeks.length - 1 ? 'disabled' : ''} aria-label="Semana siguiente">${icon('arrow-right')}</button>
    </div>
    <div class="ag-list">${rows}</div>
    <div class="sticky-bar">
      <div class="sb-text"><span><b>${plural(n, 'reserva', 'reservas')}</b> esta semana</span><small>${status}</small></div>
      ${i < weeks.length - 1
        ? `<button class="btn btn-primary btn-mini" data-act="cweek" data-d="1">Siguiente ${icon('arrow-right')}</button>`
        : '<button class="btn btn-ghost btn-mini" data-act="cweek-go" data-i="0">Volver al inicio</button>'}
      <div class="sb-seg" aria-hidden="true">${segs}</div>
    </div>`;
}

function cbRow(bk) {
  const hrs = hoursUntil(bk.date, bk.b);
  const st = statusOf(bk);
  const reserving = monthDoc(ymOf(bk.date)).status === 'reservas' || monthDoc(ymOf(bk.date)).status === 'prep' || !monthDoc(ymOf(bk.date)).status;
  let act;
  if (hrs > 0) {
    if (reserving) act = '<span class="chip chip-soft">reservado</span>';
    else act = hrs >= 24
      ? `<button class="btn btn-mini" data-act="cambiar" data-d="${bk.date}" data-b="${bk.b}">Cambiar</button>
         <button class="btn btn-mini btn-ghost" data-act="liberar" data-d="${bk.date}" data-b="${bk.b}">Liberar</button>`
      : '<span class="chip chip-soft">🔒 menos de 24 h</span>';
  } else {
    act = `${statusChip(st)}${['asistio', 'parcial', 'sinmarcar', 'hoy'].includes(st)
      ? `<button class="btn btn-mini btn-ghost" data-act="cblock" data-d="${bk.date}" data-b="${bk.b}">${icon('plus')} extra</button>` : ''}`;
  }
  return `<div class="cb-row">
    <div class="cb-when"><b>${dayLabel(bk.date)}</b><small>${monthName(ymOf(bk.date)).slice(0, 3)}</small></div>
    <div class="cb-what"><b>${BLOCKS[bk.b].label}${bk.role === 'shadow' ? ' · de shadow' : ''}</b><small>${BLOCKS[bk.b].range} h · ${BLOCKS[bk.b].hours} h</small></div>
    <div class="cb-act">${act}</div></div>`;
}

function misView(s) {
  const all = D.bookings.filter((x) => x.sid === s.id).sort((a, b) => (a.date + a.b).localeCompare(b.date + b.b));
  const future = all.filter((x) => hoursUntil(x.date, x.b) > 0);
  const past = all.filter((x) => hoursUntil(x.date, x.b) <= 0).reverse().slice(0, 10);
  const next = future[0];
  const cur = currentYM();
  const hMes = D.bookings.filter((x) => x.sid === s.id && ymOf(x.date) === cur && x.att && x.att.st)
    .reduce((a, x) => a + (x.att.h || 0), 0)
    + D.extras.filter((e) => e.sid === s.id && ymOf(e.date) === cur && e.estado === 'ok').reduce((a, e) => a + e.h, 0);
  return `${next ? `<section class="next-card" style="--c:${esc(s.color)}">
      <span>Tu próximo bloque</span>
      <b>${esc(cap(relDay(next.date)))} · ${BLOCKS[next.b].label}</b>
      <small>${BLOCKS[next.b].range} h · ${BLOCKS[next.b].hours} h${next.role === 'shadow' ? ' · de shadow' : ''}</small></section>` : ''}
    <section class="card card-tight"><h2 class="card-title">${icon('calendar')} Próximos</h2>
      ${future.slice(0, 14).map(cbRow).join('') || '<p class="muted">No tenés bloques próximos.</p>'}
      <p class="hint">En un mes ya cerrado podés cambiar o liberar un bloque hasta 24 h antes.</p></section>
    <section class="card card-tight"><h2 class="card-title">${icon('list')} Ya trabajados</h2>
      ${past.map(cbRow).join('') || '<p class="muted">Todavía nada.</p>'}</section>
    <div class="ph-stats">
      <div class="card kpi"><span class="kpi-label">Horas en ${monthName(cur)}</span><span class="kpi-num">${fmtNum(hMes)} h</span></div>
      <div class="card kpi"><span class="kpi-label">Próximos bloques</span><span class="kpi-num">${future.length}</span></div>
    </div>
    <p class="hint">Tus montos y pagos están en <button class="link-btn" data-act="ctab" data-v="liq">Mi liquidación →</button></p>`;
}

/** Mi liquidación: cada colaboradora controla lo suyo, bloque por bloque. */
function myLiqView(s) {
  const ym = U.myLiqMonth;
  const r = liq(ym).find((x) => x.s.id === s.id)
    || { asist: 0, hAsist: 0, hParc: 0, hEx: 0, pend: 0, faltas: 0, sin: 0, h: 0, total: 0, pago: null };
  const t = todayISO();
  const mis = D.bookings.filter((x) => x.sid === s.id && ymOf(x.date) === ym && x.date <= t)
    .sort((a, b) => (a.date + a.b).localeCompare(b.date + b.b));
  const rows = mis.map((bk) => {
    const st = statusOf(bk);
    const h = bk.att && bk.att.st ? bk.att.h : 0;
    return `<tr><td>${esc(dayLabel(bk.date))}</td><td>${BLOCKS[bk.b].label}${bk.role === 'shadow' ? ' · shadow' : ''}</td>
      <td>${statusChip(st)}</td><td class="num">${h ? fmtNum(h) + ' h' : '—'}</td>
      <td class="num">${h ? fmtMoney(h * rateFor(s, bk.date)) : '—'}</td></tr>`;
  }).join('');
  const ex = D.extras.filter((e) => e.sid === s.id && ymOf(e.date) === ym)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => `<tr><td>${esc(dayLabel(e.date))}</td><td>${e.h < 0 ? 'Descuento' : 'Extra'} · ${BLOCKS[e.b].label.toLowerCase()}</td>
      <td>${e.h < 0 ? '<span class="chip chip-soft">descontada</span>' : e.estado === 'ok' ? '<span class="chip st-ok">aprobada</span>' : e.estado === 'rej' ? '<span class="chip st-no">no aprobada</span>' : '<span class="chip st-warn">pendiente</span>'}</td>
      <td class="num">${fmtSigned(e.h)}</td><td class="num">${e.estado === 'ok' ? fmtMoney(e.h * rateFor(s, e.date)) : '—'}</td></tr>`).join('');
  const hasRate = Array.isArray(s.rates) && s.rates.length;
  const rateTxt = hasRate ? `${fmtMoney(rateFor(s, `${ym}-28`))} por hora` : 'sin tarifa cargada';
  return `<div class="liq-head">${monthNav(ym, 'mylmonth')}</div>
    <section class="card my-liq">
      <span class="kpi-label">Total de ${monthName(ym)}</span>
      <span class="my-liq-total">${fmtMoney(r.total)}</span>
      <span class="hint">${fmtNum(r.h)} h · tarifa ${rateTxt}</span>
      ${r.pago ? `<span class="chip st-ok">${icon('check')} Pagado el ${fmtDateFull((r.pago.paidAt || '').slice(0, 10) || t)}</span>`
        : '<span class="chip chip-soft">Todavía sin pagar</span>'}
    </section>
    <div class="ph-stats ph-stats-4">
      <div class="card kpi"><span class="kpi-label">Asistidos</span><span class="kpi-num">${r.asist}</span></div>
      <div class="card kpi"><span class="kpi-label">Parciales</span><span class="kpi-num">${fmtNum(r.hParc)} h</span></div>
      <div class="card kpi"><span class="kpi-label">Extras</span><span class="kpi-num">${r.hEx ? fmtSigned(r.hEx) : '0 h'}</span></div>
      <div class="card kpi"><span class="kpi-label">Faltas</span><span class="kpi-num">${r.faltas}</span></div>
    </div>
    ${r.sin ? banner('info', `${plural(r.sin, 'bloque todavía no tiene', 'bloques todavía no tienen')} el presente tomado: se suma cuando la administración lo marque.`) : ''}
    ${r.pend ? banner('info', `Tenés ${plural(r.pend, 'pedido de horas extra pendiente', 'pedidos de horas extra pendientes')} de aprobación.`) : ''}
    <section class="card card-tight">
      <h2 class="card-title">${icon('list')} Detalle del mes</h2>
      ${rows || ex ? `<div class="table-scroll"><table class="table table-sm">
        <thead><tr><th>Día</th><th>Bloque</th><th>Estado</th><th class="num">Horas</th><th class="num">Importe</th></tr></thead>
        <tbody>${rows}${ex}</tbody>
        <tfoot><tr><td colspan="3">Total</td><td class="num">${fmtNum(r.h)} h</td><td class="num strong">${fmtMoney(r.total)}</td></tr></tfoot>
      </table></div>` : '<p class="muted">Todavía no hay bloques trabajados en este mes.</p>'}
      <p class="hint">Las faltas no se pagan. ¿Algo no coincide? Avisale a la administración.</p>
    </section>`;
}

function collabBlockModal(d, b) {
  const sid = Store.mySid;
  const bk = mine(sid, d, b);
  if (!bk) return closeModal();
  U.modal = { type: 'cblock', d, b };
  const st = statusOf(bk);
  const worked = ['asistio', 'parcial', 'sinmarcar'].includes(st) || (st === 'hoy' && hoursUntil(d, b) <= 0);
  const myEx = D.extras.filter((e) => e.date === d && e.b === b && e.sid === sid);
  const exRows = myEx.map((e) => `<li><b>${fmtSigned(e.h)}</b> · ${esc(e.motivo)}
      ${e.h < 0 ? '<span class="chip chip-soft">descontada</span>' : e.estado === 'ok' ? '<span class="chip st-ok">aprobada</span>' : e.estado === 'rej' ? '<span class="chip st-no">no aprobada</span>' : '<span class="chip st-warn">pendiente</span>'}</li>`).join('');
  const exForm = worked ? `<div class="ex-sec"><h4>${icon('clock')} ¿Te quedaste más tiempo?</h4>
      ${exRows ? `<ul class="ex-list">${exRows}</ul>` : ''}
      <div class="ex-add">
        <input class="input" id="ex-h" type="number" min="0.5" max="6" step="0.5" value="1" aria-label="Horas extra">
        <input class="input" id="ex-m" type="text" maxlength="80" placeholder="¿Por qué? (ej: terminé el planchado)" aria-label="Motivo">
        <button class="btn btn-mini btn-primary" data-act="ex-prop" data-d="${d}" data-b="${b}">${icon('plus')} Pedir horas extra</button>
      </div><p class="hint">La administración las aprueba y se suman a tu liquidación.</p></div>`
    : banner('info', 'Las horas extra se piden una vez que empezó el bloque.');
  openModal(`<h3>${esc(cap(fmtDateLong(d)))}</h3>
    <p class="muted modal-sub">${BLOCKS[b].label} · ${BLOCKS[b].range} h · ${BLOCKS[b].hours} h${bk.role === 'shadow' ? ' · de shadow' : ''}</p>
    <p>${statusChip(st)}</p>${exForm}
    <div class="modal-actions"><button class="btn btn-primary" data-act="modal-close">Listo</button></div>`);
}

function changeModal(d, b) {
  const s = person(Store.mySid);
  const bk = mine(s.id, d, b);
  if (!bk) return;
  const options = [];
  weekOf(d).days.forEach((dd) => BKEYS.forEach((bb) => {
    if (dd === d && bb === b) return;
    if (hoursUntil(dd, bb) < 24 || blockInfo(dd, bb).closed || mine(s.id, dd, bb)) return;
    // el otro bloque de ese día es suyo (salvo que sea justo el que está dejando)
    if (mine(s.id, dd, otherBlock(bb)) && !(dd === d && otherBlock(bb) === b)) return;
    const a = at(dd, bb);
    const ok = bk.role === 'titular' ? !a.tit && s.canTit : a.tit && a.tit.sid !== s.id && !a.sh && blockInfo(dd, bb).shadow;
    if (ok) options.push({ dd, bb });
  }));
  U.modal = null;
  openModal(`<h3>Cambiar ${bk.role === 'shadow' ? 'lugar de shadow' : 'bloque'}</h3>
    <p class="muted modal-sub">Dejás el ${esc(fmtDateLong(d))}, ${BLOCKS[b].label.toLowerCase()}. Elegí otro libre de la misma semana:</p>
    ${options.length ? `<div class="pick-list">${options.map((o) => `
      <button class="pick" data-act="move" data-d="${d}" data-b="${b}" data-nd="${o.dd}" data-nb="${o.bb}">
        <b>${esc(cap(fmtDateLong(o.dd)))}</b><span>${BLOCKS[o.bb].label} · ${BLOCKS[o.bb].range} h</span></button>`).join('')}</div>`
      : banner('info', 'No hay otros lugares libres esa semana con más de 24 h de anticipación.')}
    <div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Cancelar</button></div>`);
}

/* =========================================================
   RENDER
   ========================================================= */

function render() {
  const st = Store.state;
  let html;
  if (st === 'init' || st === 'loading') html = screenLoading();
  else if (st === 'anon') html = screenLogin();
  else if (st === 'noaccess') html = screenNoAccess();
  else if (st === 'error') html = screenError();
  else html = Store.role === 'admin' ? adminView() : collabView();
  $app().innerHTML = html;
  if (Store.role === 'admin' && st === 'ready') cleanupStaleSlots();
}

/** Un lugar de shadow solo tiene sentido con titular: si quedó vacío y sin titular, se cierra. */
let _cleaning = false;
function cleanupStaleSlots() {
  if (_cleaning) return;
  const stale = Object.keys(D.blocks).filter((key) => {
    const info = D.blocks[key];
    if (!info.shadow) return false;
    const [d, b] = key.split('_');
    const a = at(d, b);
    return !a.tit && !a.sh && d >= todayISO();
  });
  if (!stale.length) return;
  _cleaning = true;
  Promise.all(stale.map((key) => Store.saveBlock(key, { shadow: false }))).catch(fail).finally(() => { _cleaning = false; });
}

/** La foto de turnos de los meses con reservas abiertas sigue a Equipo. */
function syncSnapshots() {
  const snap = Store.snapshotFor(D.staff);
  return Promise.all(Object.keys(D.months)
    .filter((ym) => D.months[ym].status === 'reservas')
    .map((ym) => Store.saveMonth(ym, { order: snap.order, mins: snap.mins, maxs: snap.maxs })));
}

/* =========================================================
   ACCIONES
   ========================================================= */

async function reserve(d, b) {
  const s = person(Store.mySid);
  const ym = ymOf(d);
  const own = mine(s.id, d, b);
  const ti = turnInfo(ym);
  if (own) {
    if (!ti.open) return toast('Las reservas están cerradas. Para cambios, avisale a la administración.', 'err');
    if (own.role === 'titular' && ti.ronda === 1) {
      const ow = weekOf(d);
      const inTurn = ow.full && ow.start === ti.week.start && ti.current === s.id;
      const before = ow.full && ow.start < ti.week.start && weekCount(s.id, ow) - 1 >= limitsOf(s.id, ym).min;
      if (!inTurn && !before) return toast('Ese bloque lo podés soltar durante tu turno de esa semana o en la ronda 2.', 'err');
    }
    await Store.removeBooking(own.id);
    const w = weekOf(d);
    const { min } = limitsOf(s.id, ym);
    const a = at(d, b);
    if (own.role === 'titular' && a.sh) toast('Quedó una shadow sin titular: la administración lo va a ver.', 'info');
    else if (w.full && weekCount(s.id, w) < min) toast(`Liberado. Ojo: esa semana quedás debajo de tu mínimo (${min}).`, 'info');
    else toast('Reserva liberada');
    return;
  }
  const c = canBook(s.id, d, b);
  if (!c.ok) return toast(c.why, 'err');
  const before = ti.ronda === 1 ? `${ti.week.start}_${ti.idx}` : 'r2';
  await Store.addBooking({ id: bookingId(d, b, c.role), date: d, b, role: c.role, sid: s.id, month: ym });
  const after = turnInfo(ym);
  const now = after.ronda === 1 ? `${after.week.start}_${after.idx}` : 'r2';
  if (c.role === 'titular' && ti.ronda === 1 && now !== before) {
    toast(after.ronda === 2 ? '¡Cubriste tu mínimo! Terminaron los turnos: se abrió la ronda 2.'
      : after.week.start !== ti.week.start ? `¡Cubriste tu mínimo! Arrancan los turnos de la semana del ${weekRange(after.week)}.`
      : '¡Cubriste tu mínimo de esta semana! Ahora le toca a la siguiente persona.', 'ok');
  } else toast(`Reservado${c.role === 'shadow' ? ' de shadow' : ''}: ${dayLabel(d)}, ${BLOCKS[b].label.toLowerCase()}`, 'ok');
}

const handlers = {
  /* navegación */
  'modal-close': () => closeModal(),
  atab: (el) => { U.adminTab = el.dataset.v; U.anim = true; render(); },
  ctab: (el) => { U.collabTab = el.dataset.v; U.anim = true; render(); window.scrollTo(0, 0); },
  pmonth: (el) => { U.planMonth = addMonths(U.planMonth, Number(el.dataset.d)); render(); },
  lmonth: (el) => { U.liqMonth = addMonths(U.liqMonth, Number(el.dataset.d)); render(); },
  cweek: (el) => { U.cWeek = (U.cWeek || 0) + Number(el.dataset.d); render(); window.scrollTo(0, 0); },
  'cweek-go': (el) => { U.cWeek = Number(el.dataset.i); render(); window.scrollTo(0, 0); },
  'go-hoy': () => { U.adminTab = 'hoy'; U.anim = true; render(); },
  reload: () => location.reload(),
  logout: () => Store.signOut(),
  signin: () => Store.signIn().catch(fail),
  'demo-reset': () => { Store.demoReset(); toast('Demo reiniciada'); },
  mylmonth: (el) => { U.myLiqMonth = addMonths(U.myLiqMonth, Number(el.dataset.d)); render(); },
  'pass-turn': (el) => {
    const { ym, wk } = el.dataset;
    const { min } = limitsOf(Store.mySid, ym);
    openModal(`<h3>¿Pasar tu turno de esta semana?</h3>
      <p class="muted">Le toca elegir a la siguiente persona en la semana del ${weekRange(weekOf(wk))}. Lo que ya reservaste queda igual,
        y cuando todas elijan vas a poder sumar más bloques si quedan libres. En las semanas siguientes vas a tener tu turno igual.
        Tu mínimo es ${min} por semana: la administración va a ver que pasaste el turno sin completarlo.</p>
      <div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Cancelar</button>
        <button class="btn btn-primary" data-act="pass-turn-ok" data-ym="${ym}" data-wk="${wk}">Sí, pasar mi turno</button></div>`);
  },
  async 'pass-turn-ok'(el) {
    await Store.passTurn(el.dataset.ym, Store.mySid, el.dataset.wk);
    closeModal();
    toast('Pasaste tu turno de esta semana. Le toca a la siguiente persona.', 'ok');
  },
  async unpass(el) {
    await Store.unpassTurn(U.planMonth, el.dataset.sid, el.dataset.wk);
    const p = person(el.dataset.sid);
    toast(`${p ? p.name : ''} recuperó su turno`, 'ok');
  },

  /* colaboradora */
  reserve: (el) => reserve(el.dataset.d, el.dataset.b).catch(fail),
  cblock: (el) => collabBlockModal(el.dataset.d, el.dataset.b),
  cambiar: (el) => changeModal(el.dataset.d, el.dataset.b),
  async liberar(el) {
    const { d, b } = el.dataset;
    if (hoursUntil(d, b) < 24) return toast('Faltan menos de 24 h: ya no se puede liberar.', 'err');
    const bk = mine(Store.mySid, d, b);
    if (!bk) return;
    await Store.removeBooking(bk.id);
    closeModal();
    toast('Liberado. La administración lo va a ver en Planificación.', 'ok');
  },
  async move(el) {
    const bk = mine(Store.mySid, el.dataset.d, el.dataset.b);
    if (!bk) return closeModal();
    const nd = el.dataset.nd, nb = el.dataset.nb;
    await Store.moveBooking(bk.id, { id: bookingId(nd, nb, bk.role), date: nd, b: nb, role: bk.role, sid: bk.sid, month: ymOf(nd) });
    closeModal();
    toast(`Listo: ahora venís el ${fmtDateLong(nd)}, ${BLOCKS[nb].label.toLowerCase()}.`, 'ok');
  },
  async 'ex-prop'(el) {
    const h = Number(document.getElementById('ex-h').value);
    if (!(h > 0 && h <= 6)) return toast('Ingresá entre 0,5 y 6 horas', 'err');
    const motivo = document.getElementById('ex-m').value.trim().slice(0, 80) || 'Sin motivo';
    await Store.addExtra({ id: uid(), date: el.dataset.d, b: el.dataset.b, sid: Store.mySid, h, motivo, by: 'collab', estado: 'pend' });
    toast('Pedido enviado: la administración lo aprueba.', 'ok');
    refreshModal();
  },

  /* administración: bloques */
  block: (el) => blockModal(el.dataset.d, el.dataset.b),
  async att(el) {
    const bk = D.bookings.find((x) => x.id === el.dataset.id);
    if (!bk) return;
    const st = el.dataset.st;
    const full = BLOCKS[bk.b].hours;
    const input = el.dataset.input ? document.getElementById(el.dataset.input) : null;
    const h = st === 'asistio' ? full : st === 'parcial' ? clamp(Number(input && input.value) || 0, 0.5, full) : 0;
    await Store.setAtt(bk.id, { st, h });
    const p = person(bk.sid);
    toast(`${p ? p.name : ''}: ${STATUS[st].label.toLowerCase()}${st === 'parcial' ? ` (${fmtNum(h)} h)` : ''}`, 'ok');
    refreshModal();
  },
  async assign(el) {
    const { d, b, role } = el.dataset;
    const pick = document.getElementById(`pick-${role}`);
    if (!pick) return;
    const sid = pick.value;
    const a = at(d, b);
    if ((role === 'titular' && a.tit) || (role === 'shadow' && a.sh)) return toast('Ese lugar ya está ocupado', 'err');
    if (role === 'shadow' && !a.tit) return toast('Primero tiene que haber una titular', 'err');
    if (mine(sid, d, b)) return toast('Ya está en este bloque', 'err');
    if (mine(sid, d, otherBlock(b))) return toast('Ya tiene el otro bloque de ese día', 'err');
    if (role === 'shadow') await Store.saveBlock(blockKey(d, b), { shadow: true });
    await Store.addBooking({ id: bookingId(d, b, role), date: d, b, role, sid, month: ymOf(d) });
    const p = person(sid);
    const { max } = limitsOf(sid, ymOf(d));
    toast(weekCount(sid, weekOf(d)) > max ? `${p.name} quedó por encima de su máximo semanal (${max}).` : `${p.name} asignada${role === 'shadow' ? ' de shadow' : ''}`,
      weekCount(sid, weekOf(d)) > max ? 'info' : 'ok');
    refreshModal();
  },
  async rm(el) {
    const bk = D.bookings.find((x) => x.id === el.dataset.id);
    if (!bk) return;
    await Store.removeBooking(bk.id);
    const p = person(bk.sid);
    toast(bk.role === 'titular' && at(bk.date, bk.b).sh ? 'Quedó la shadow sin titular.' : `${p ? p.name : ''} quitada del bloque`, 'ok');
    refreshModal();
  },
  async 'sh-on'(el) {
    if (!at(el.dataset.d, el.dataset.b).tit) return toast('Primero tiene que haber una titular', 'err');
    await Store.saveBlock(blockKey(el.dataset.d, el.dataset.b), { shadow: true });
    toast('Lugar de shadow habilitado'); refreshModal();
  },
  async 'sh-off'(el) {
    if (at(el.dataset.d, el.dataset.b).sh) return toast('Primero quitá a la shadow de este bloque', 'err');
    await Store.saveBlock(blockKey(el.dataset.d, el.dataset.b), { shadow: false });
    toast('Lugar de shadow deshabilitado'); refreshModal();
  },
  async 'blk-close'(el) { await Store.saveBlock(blockKey(el.dataset.d, el.dataset.b), { closed: true, shadow: false }); toast('Bloque cerrado'); refreshModal(); },
  async 'blk-open'(el) { await Store.saveBlock(blockKey(el.dataset.d, el.dataset.b), { closed: false }); toast('Bloque abierto'); refreshModal(); },
  async 'ex-add'(el) {
    const h = Number(document.getElementById('ex-h').value);
    if (!(h > 0 && h <= 6)) return toast('Ingresá entre 0,5 y 6 horas', 'err');
    await Store.addExtra({ id: uid(), date: el.dataset.d, b: el.dataset.b, sid: document.getElementById('ex-sid').value, h,
      motivo: document.getElementById('ex-m').value.trim().slice(0, 80) || 'Cargada por la administración', by: 'admin', estado: 'ok' });
    toast(`+${fmtNum(h)} h extra sumadas`, 'ok'); refreshModal();
  },
  async 'ex-sub'(el) {
    const { d, b } = el.dataset;
    const sid = document.getElementById('ex-sid').value;
    const h = Number(document.getElementById('ex-h').value);
    if (!(h > 0 && h <= 6)) return toast('Ingresá entre 0,5 y 6 horas', 'err');
    const bk = mine(sid, d, b);
    const base = bk && bk.att && ['asistio', 'parcial'].includes(bk.att.st) ? bk.att.h : 0;
    const tiene = base + D.extras.filter((e) => e.sid === sid && e.date === d && e.b === b && e.estado === 'ok').reduce((a, e) => a + e.h, 0);
    if (h > tiene) {
      return toast(tiene > 0 ? `Solo se pueden restar hasta ${fmtNum(tiene)} h en este bloque` : 'Primero tomá el presente: no hay horas cargadas para restar', 'err');
    }
    await Store.addExtra({ id: uid(), date: d, b, sid, h: -h,
      motivo: document.getElementById('ex-m').value.trim().slice(0, 80) || 'Descontada por la administración', by: 'admin', estado: 'ok' });
    toast(`−${fmtNum(h)} h descontadas`, 'ok'); refreshModal();
  },
  async 'ex-ok'(el) { await Store.updateExtra(el.dataset.id, { estado: 'ok' }); toast('Horas extra aprobadas', 'ok'); refreshModal(); },
  async 'ex-no'(el) { await Store.updateExtra(el.dataset.id, { estado: 'rej' }); toast('Horas extra rechazadas', 'info'); refreshModal(); },

  /* administración: mes */
  async 'open-res'() {
    const snap = Store.snapshotFor(D.staff);
    if (!snap.order.length) return toast('Primero agregá en Equipo a alguien que pueda ir de titular.', 'err');
    await Store.saveMonth(U.planMonth, { status: 'reservas', ...snap, turnFloor: 0 });
    toast(`Reservas de ${monthName(U.planMonth)} abiertas`, 'ok');
  },
  async 'skip-turn'() {
    const ti = turnInfo(U.planMonth);
    if (ti.ronda !== 1) return;
    await Store.passTurn(U.planMonth, ti.current, ti.week.start);
    const p = person(ti.current);
    toast(`Pasaste el turno${p ? ' de ' + p.name : ''}`, 'info');
  },
  async 'close-res'() { await Store.saveMonth(U.planMonth, { status: 'cerrado' }); toast(`Reservas de ${monthName(U.planMonth)} cerradas: el plan quedó fijo.`, 'ok'); },
  async 'reopen-res'() { await Store.saveMonth(U.planMonth, { status: 'reservas', ...Store.snapshotFor(D.staff) }); toast('Reservas reabiertas'); },
  async liquidar() { await Store.saveMonth(U.liqMonth, { status: 'liquidado' }); toast(`${monthLabel(U.liqMonth)} marcado como liquidado`, 'ok'); },
  async pago(el) {
    const key = `${U.liqMonth}_${el.dataset.sid}`;
    const p = person(el.dataset.sid);
    if (D.pagos[key]) { await Store.setPago(key, null); toast(`Pago de ${p.name} desmarcado`, 'info'); }
    else { await Store.setPago(key, { paidAt: new Date().toISOString(), staffId: el.dataset.sid, month: U.liqMonth }); toast(`Pago de ${p.name} marcado ✔`, 'ok'); }
  },

  /* administración: equipo */
  'staff-new': () => staffModal(null),
  'admin-rm': (el) => {
    const email = el.dataset.email;
    const a = (D.house.admins || {})[email] || {};
    openModal(`<h3>¿Quitar a ${esc(a.name || email)} de la administración?</h3>
      <p class="muted">Deja de tener acceso a la app apenas lo confirmes.</p>
      <div class="modal-actions"><button class="btn btn-ghost" data-act="modal-close">Cancelar</button>
        <button class="btn btn-primary" data-act="admin-rm-ok" data-email="${esc(email)}">Sí, quitar</button></div>`);
  },
  async 'admin-rm-ok'(el) {
    await Store.removeAdmin(el.dataset.email);
    closeModal();
    toast('Administradora quitada', 'info');
  },
  'staff-edit': (el) => staffModal(el.dataset.sid),
  'rate-new': (el) => rateModal(el.dataset.sid),
  async 'staff-archive'(el) {
    const s = person(el.dataset.sid);
    await Store.saveStaff({ ...s, active: false }, s.email);
    await syncSnapshots();
    toast(`${s.name} archivada: ya no puede entrar ni reservar`, 'info');
  },
  async 'staff-restore'(el) {
    const s = person(el.dataset.sid);
    await Store.saveStaff({ ...s, active: true, rank: ranked().length + 1 }, s.email);
    await syncSnapshots();
    toast(`${s.name} restaurada`, 'ok');
  },
  async rank(el) {
    const list = ranked();
    const i = list.findIndex((x) => x.id === el.dataset.sid);
    const j = i + Number(el.dataset.d);
    if (j < 0 || j >= list.length) return;
    // se renumera todo el orden para que quede prolijo (1, 2, 3…)
    const order = list.map((s) => s.id);
    [order[i], order[j]] = [order[j], order[i]];
    await Promise.all(order.map((sid, k) => {
      const s = person(sid);
      return s.rank === k + 1 ? null : Store.saveStaff({ ...s, rank: k + 1 }, s.email);
    }));
    await syncSnapshots();
    toast(`${list[i].name} ahora es nº ${j + 1} en la prioridad`, 'ok');
  },
  async lim(el) {
    const s = person(el.dataset.sid);
    const f = el.dataset.f;
    const v = (s[f] || 0) + Number(el.dataset.d);
    const next = { ...s };
    if (f === 'min') next.min = clamp(v, 0, s.max || 0);
    else next.max = clamp(v, Math.max(1, s.min || 0), 14);
    if (next[f] === s[f]) return;
    await Store.saveStaff(next, s.email);
    await syncSnapshots();
  },
};

/* ---------- formularios ---------- */

const submits = {
  async 'house-create'(form, fd) {
    const btn = form.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Creando…'; }
    try { await Store.createHouse(String(fd.get('houseName')).trim(), String(fd.get('ownerName')).trim()); }
    finally { if (btn && document.contains(btn)) { btn.disabled = false; btn.textContent = 'Crear mi casa'; } }
  },
  async 'admin-add'(form, fd) {
    const email = String(fd.get('email') || '').trim().toLowerCase();
    const name = String(fd.get('name') || '').trim().slice(0, 40);
    if (!EMAIL_RE.test(email)) return toast('El email no parece válido', 'err');
    if (!name) return toast('Poné un nombre', 'err');
    if (email === (D.house.ownerEmail || '') || (Store.user && (Store.user.email || '').toLowerCase() === email)) return toast('Ese mail ya es el de quien creó la casa', 'err');
    if ((D.house.admins || {})[email]) return toast('Ya es administradora', 'err');
    if (D.staff.some((x) => (x.email || '').toLowerCase() === email)) return toast('Ese mail es de alguien del equipo: usá otro Gmail para administrar', 'err');
    await Store.addAdmin(email, name);
    form.reset();
    toast(`${name} ya es administradora. Pasale el link para que entre con ${email}.`, 'ok');
  },
  async 'staff-save'(form, fd) {
    const sid = form.dataset.sid;
    const email = String(fd.get('email') || '').trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) return toast('El email no parece válido', 'err');
    if (email && (D.house.admins || {})[email]) return toast('Ese mail es de una administradora: usá otro Gmail', 'err');
    const color = String(fd.get('color') || '');
    const pickedColor = STAFF_COLORS.includes(color) || COLOR_RE.test(color) ? color : STAFF_COLORS[0];
    const name = String(fd.get('name')).trim();
    if (!name) return toast('Poné un nombre', 'err');
    if (sid) {
      const s = person(sid);
      await Store.saveStaff({ ...s, name, email, color: pickedColor }, s.email);
      toast('Equipo actualizado');
    } else {
      const min = clamp(Number(fd.get('min')) || 0, 0, 14);
      const max = clamp(Number(fd.get('max')) || 1, Math.max(1, min), 14);
      const m = {
        id: uid(), name, email, color: pickedColor, active: true, rank: ranked().length + 1, min, max,
        canTit: !!fd.get('canTit'), canSh: !!fd.get('canSh'), createdAt: new Date().toISOString(),
      };
      await Store.saveStaff(m, '');
      await Store.saveRates(m.id, [{ from: String(fd.get('rateFrom') || todayISO()), value: Math.max(0, Number(fd.get('rate')) || 0) }]);
      toast(`¡${name} se sumó al equipo! 🎉`);
    }
    await syncSnapshots();
    closeModal();
  },
  async 'rate-save'(form, fd) {
    const s = person(form.dataset.sid);
    const from = String(fd.get('from'));
    if (!ISO_RE.test(from)) return toast('Elegí una fecha', 'err');
    const rates = (s.rates || []).filter((r) => r.from !== from);
    rates.push({ from, value: Math.max(0, Number(fd.get('value')) || 0) });
    rates.sort((a, b) => a.from.localeCompare(b.from));
    await Store.saveRates(s.id, rates);
    closeModal();
    toast('Nueva tarifa registrada', 'ok');
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = handlers[el.dataset.act];
  if (!fn) return;
  Promise.resolve(fn(el)).catch(fail);
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-chg]');
  if (!el) return;
  if (el.dataset.chg === 'demo-as') {
    const [r, sid] = el.value.split('|');
    U.anim = true; U.cWeek = null;
    Store.demoAs(r, sid);
  }
  if (el.dataset.chg === 'perm') {
    const s = person(el.dataset.sid);
    const next = { ...s, [el.dataset.p]: el.checked };
    Store.saveStaff(next, s.email).then(syncSnapshots).then(() => {
      const what = el.dataset.p === 'canTit' ? 'ir de titular' : 'ir de shadow';
      toast(`${s.name} ${el.checked ? 'ahora puede' : 'ya no puede'} ${what}.${!next.canTit && !next.canSh ? ' Ojo: así no puede reservar nada.' : ''}`,
        !next.canTit && !next.canSh ? 'info' : 'ok');
    }).catch(fail);
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-submit]');
  if (!form) return;
  ev.preventDefault();
  const fn = submits[form.dataset.submit];
  if (fn) Promise.resolve(fn(form, new FormData(form))).catch(fail);
});

document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && document.getElementById('modal-layer').classList.contains('open')) closeModal();
});

/* ---------- arranque ---------- */

Store.init(() => { render(); refreshModal(); });
