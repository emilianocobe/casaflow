/* =========================================================
   CasaFlow · app.js
   Enrutado, sesión por perfil, vistas de colaboradora y
   organizador/a, modales, toasts y micro-interacciones.
   ========================================================= */

'use strict';

/* ================= helpers de UI ================= */

const $app = () => document.getElementById('app');

const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

function toast(msg, kind = 'ok') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.setAttribute('role', kind === 'err' ? 'alert' : 'status');
  const ic = kind === 'ok' ? 'check' : kind === 'err' ? 'alert' : 'info';
  el.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => el.classList.add('gone'), 2600);
  setTimeout(() => el.remove(), 3100);
}

let _lastFocus = null;

function openModal(html, { wide = false } = {}) {
  _lastFocus = document.activeElement;
  const layer = document.getElementById('modal-layer');
  layer.innerHTML = `
    <div class="modal-backdrop" data-action="modal-close"></div>
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-x" data-action="modal-close" aria-label="Cerrar">${icon('x')}</button>
      ${html}
    </div>`;
  const h3 = layer.querySelector('h3');
  if (h3) h3.id = 'modal-title';
  layer.classList.add('open');
  const f = layer.querySelector('input, select, button:not(.modal-x)');
  if (f) f.focus();
}

function closeModal() {
  const layer = document.getElementById('modal-layer');
  layer.classList.remove('open');
  layer.innerHTML = '';
  if (_lastFocus && document.contains(_lastFocus)) _lastFocus.focus();
  _lastFocus = null;
}

/* Escape cierra; Tab queda atrapado dentro del modal */
document.addEventListener('keydown', (ev) => {
  const layer = document.getElementById('modal-layer');
  if (!layer.classList.contains('open')) return;
  if (ev.key === 'Escape') { ev.preventDefault(); closeModal(); return; }
  if (ev.key === 'Tab') {
    const focusables = layer.querySelectorAll(
      'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  }
});

function confirmModal(title, body, actionLabel, dataAttrs) {
  openModal(`
    <h3>${esc(title)}</h3>
    <p class="muted">${body}</p>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-action="modal-close">Cancelar</button>
      <button class="btn btn-danger" ${dataAttrs}>${esc(actionLabel)}</button>
    </div>`);
}

/* ================= estado de vistas ================= */

const view = {
  collabMonth: todayISO().slice(0, 7),   // 'YYYY-MM'
  orgPeriod: 'week',
  orgCustom: { from: monthStartISO(todayISO()), to: todayISO() },
  liqPeriod: 'q1',
  liqCustom: { from: monthStartISO(todayISO()), to: todayISO() },
  payYear: fromISO(todayISO()).getFullYear(),
  regFilter: { staffId: '', month: todayISO().slice(0, 7) },
};

function orgRange() {
  return view.orgPeriod === 'custom' ? { ...view.orgCustom } : periodRange(view.orgPeriod);
}
function liqRange() {
  return view.liqPeriod === 'custom' ? { ...view.liqCustom } : periodRange(view.liqPeriod);
}

/* ================= enrutador ================= */

function go(hash) { location.hash = hash; }

function route() {
  const db = loadDB();
  const s = getSession();
  const h = location.hash || '#/';

  if (!db.settings.onboarded) return renderOnboarding();

  if (h.startsWith('#/c')) {
    if (!s || s.role !== 'collab') return go('#/');
    return renderCollab(db, s);
  }
  if (h.startsWith('#/o')) {
    if (!s || s.role !== 'org') return go('#/');
    const sub = h.split('/')[2] || 'tablero';
    return renderOrg(db, sub);
  }
  return renderLogin(db);
}

/* ================= barra superior ================= */

function topbar(db, { showLogout = false, subtitle = '' } = {}) {
  return `
  <header class="topbar">
    <div class="brand">
      <span class="brand-logo">${icon('home')}</span>
      <span class="brand-text"><b>CasaFlow</b><small>${esc(subtitle || db.settings.houseName)}</small></span>
    </div>
    <div class="topbar-actions">
      <button class="iconbtn" data-action="glossary" title="Glosario" aria-label="Glosario">${icon('book')}</button>
      <button class="iconbtn" data-action="theme" title="Tema claro/oscuro" aria-label="Cambiar tema">${icon('moon')}</button>
      ${showLogout ? `<button class="iconbtn" data-action="logout" title="Salir" aria-label="Salir">${icon('logout')}</button>` : ''}
    </div>
  </header>`;
}

/* ================= onboarding ================= */

let obSlide = 0;

function renderOnboarding() {
  const slides = [
    {
      icon: 'sparkle',
      title: 'Te damos la bienvenida a CasaFlow',
      body: 'La historia es simple: las personas que cuidan tu casa registran sus horas, y vos ves todo claro para pagarles a tiempo. Sin papeles, sin planillas enredadas.',
    },
    {
      icon: 'clock',
      title: 'Para el equipo',
      body: 'Cada colaboradora entra con un toque, carga sus horas en 10 segundos y ve su propio calendario y el estado de sus pagos. Nunca ve montos de otras personas.',
    },
    {
      icon: 'chart',
      title: 'Para quien organiza',
      body: 'Tablero con gráficos, liquidación por semana, quincena o mes, tarifas con historial y control de pagos cada 2º y 4º viernes. Todo calculado automáticamente.',
    },
    {
      icon: 'shield',
      title: 'Tus datos, en tu dispositivo',
      body: 'CasaFlow no envía nada a ningún servidor: la información vive solo acá. Podés exportar un respaldo cuando quieras. ¿Cómo querés empezar?',
      last: true,
    },
  ];
  const s = slides[obSlide];
  $app().innerHTML = `
  <div class="onboard">
    <div class="ob-card view-enter">
      <div class="ob-icon">${icon(s.icon)}</div>
      <h1 class="ob-title">${esc(s.title)}</h1>
      <p class="ob-body">${esc(s.body)}</p>
      <div class="ob-dots">${slides.map((_, i) =>
        `<span class="ob-dot ${i === obSlide ? 'on' : ''}"></span>`).join('')}</div>
      ${s.last ? `
        <div class="ob-actions">
          <button class="btn btn-primary btn-big" data-action="ob-demo">${icon('sparkle')} Probar con datos de ejemplo</button>
          <button class="btn btn-ghost btn-big" data-action="ob-fresh">Empezar de cero con mi equipo</button>
          <button class="btn btn-ghost" data-action="ob-back">Volver</button>
        </div>` : `
        <div class="ob-actions">
          <button class="btn btn-primary btn-big" data-action="ob-next">Continuar ${icon('arrow-right')}</button>
          ${obSlide > 0 ? '<button class="btn btn-ghost" data-action="ob-back">Volver</button>' : ''}
        </div>`}
    </div>
  </div>`;
}

/* ================= ingreso ================= */

function renderLogin(db) {
  const staff = activeStaff(db);
  const cards = staff.map((m) => `
    <button class="login-card" data-action="login-collab" data-id="${m.id}">
      <span class="avatar" style="--c:${esc(m.color)}">${esc(initials(m.name))}</span>
      <span class="login-name">${esc(m.name)}</span>
      <span class="login-role">Colaboradora</span>
    </button>`).join('');

  $app().innerHTML = `
  ${topbar(db)}
  <main class="wrap view-enter">
    <section class="login-hero">
      <h1 class="display">¿Quién sos?</h1>
      <p class="muted">Elegí tu perfil para entrar.</p>
    </section>
    <section class="login-grid">
      ${cards || `<p class="empty-note">Todavía no hay colaboradoras cargadas.<br>Entrá como organizador/a y armá tu equipo.</p>`}
      <button class="login-card login-org" data-action="login-org">
        <span class="avatar avatar-org">${icon('key')}</span>
        <span class="login-name">${esc(db.settings.ownerName)}</span>
        <span class="login-role">Organizador/a · con PIN</span>
      </button>
    </section>
    <footer class="foot-note">${icon('shield')} Tus datos viven solo en este dispositivo.</footer>
  </main>`;
}

function initials(name) {
  return name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function askPin() {
  const db = loadDB();
  openModal(`
    <h3>PIN de organizador/a</h3>
    <p class="muted">Ingresá tu PIN para ver montos y configuración.</p>
    <form data-action-submit="pin-submit" class="pin-form">
      <input class="input pin-input" name="pin" type="password" inputmode="numeric"
             maxlength="8" placeholder="••••" autocomplete="off" aria-label="PIN">
      ${db.settings.pinIsDefault ? '<p class="hint">PIN inicial: <b>1234</b> — cambialo en Ajustes.</p>' : ''}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button>
        <button type="submit" class="btn btn-primary">Entrar</button>
      </div>
    </form>`);
}

/* ================= vista colaboradora ================= */

function renderCollab(db, session) {
  const me = staffById(db, session.staffId);
  if (!me || !me.active) { setSession(null); return go('#/'); }

  const t = todayISO();
  const wk = periodRange('week');
  const mo = periodRange('month');
  const wkH = hoursIn(db, wk.from, wk.to, me.id);
  const moH = hoursIn(db, mo.from, mo.to, me.id);
  const todayH = hoursIn(db, t, t, me.id);

  // calendario
  const [yy, mm] = view.collabMonth.split('-').map(Number);
  const mLabel = cap(new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
    .format(new Date(yy, mm - 1, 12)));
  const valuesByDate = {};
  entriesIn(db, `${view.collabMonth}-01`, monthEndISO(`${view.collabMonth}-01`), me.id)
    .forEach((e) => { valuesByDate[e.date] = (valuesByDate[e.date] || 0) + e.hours; });

  // pagos propios
  const upcoming = paydaysAround(t).filter((p) => p >= addDays(t, -45) && p <= addDays(t, 45));
  const payRows = upcoming.map((p) => {
    const paid = isPaid(db, p, me.id);
    const isNext = p === nextPayday(t);
    const w = payWindow(p);
    const worked = hoursIn(db, w.from, w.to, me.id) > 0;
    const state = paid
      ? `<span class="chip chip-ok">${icon('check')} Pagado</span>`
      : p >= t ? '<span class="chip chip-soft">Programado</span>'
      : worked ? '<span class="chip chip-warn">Pendiente</span>'
      : '<span class="chip chip-soft">Sin horas</span>';
    return `
      <li class="timeline-item ${paid ? 'is-paid' : ''} ${isNext ? 'is-next' : ''}">
        <span class="tl-dot"></span>
        <span class="tl-date">${esc(cap(fmtDateLong(p)))}</span>
        ${state}
      </li>`;
  }).join('');

  const insight = collabInsight(db, me);
  const quote = QUOTES[dayOfYear() % QUOTES.length];

  $app().innerHTML = `
  ${topbar(db, { showLogout: true, subtitle: `Hola, ${me.name}` })}
  <main class="wrap view-enter">

    <section class="hero">
      <p class="hero-kicker">${esc(cap(fmtDateLong(t)))}</p>
      <h1 class="display">Hola, ${esc(me.name)} 👋</h1>
      ${todayH > 0
        ? `<p class="muted">Hoy ya cargaste <b>${fmtNum(todayH)} h</b>. ¡Gracias!</p>`
        : '<p class="muted">¿Cuántas horas trabajaste hoy?</p>'}
    </section>

    <section class="card card-accent" id="quick-add">
      <h2 class="card-title">${icon('plus')} Cargar horas</h2>
      <form data-action-submit="entry-save">
        <div class="chip-row" role="group" aria-label="Horas rápidas">
          ${[2, 3, 4, 5, 6, 8].map((h) =>
            `<button type="button" class="chip chip-pick" data-action="pick-hours" data-h="${h}">${h} h</button>`).join('')}
        </div>
        <div class="form-grid">
          <label class="field"><span>Horas</span>
            <input class="input" name="hours" type="number" min="0.5" max="24" step="0.5" required placeholder="0">
          </label>
          <label class="field"><span>Fecha</span>
            <input class="input" name="date" type="date" value="${t}" max="${t}" required>
          </label>
        </div>
        <label class="field"><span>Nota (opcional)</span>
          <input class="input" name="note" type="text" maxlength="200" placeholder="Ej: llegué más tarde, hice horas extra…">
        </label>
        <button class="btn btn-primary btn-big btn-block" type="submit">${icon('check')} Guardar mis horas</button>
      </form>
    </section>

    <section class="kpi-row">
      <div class="card kpi">
        <span class="kpi-label">Esta semana</span>
        <span class="kpi-num"><b data-count="${wkH}">0</b> h</span>
        <span class="progress"><span class="progress-fill" style="--w:${Math.min(100, (wkH / 40) * 100)}%"></span></span>
      </div>
      <div class="card kpi">
        <span class="kpi-label">Este mes</span>
        <span class="kpi-num"><b data-count="${moH}">0</b> h</span>
        <span class="progress"><span class="progress-fill" style="--w:${Math.min(100, (moH / 160) * 100)}%"></span></span>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2 class="card-title">${icon('calendar')} Mi calendario</h2>
        <div class="month-nav">
          <button class="iconbtn" data-action="cal-prev" aria-label="Mes anterior">${icon('arrow-left')}</button>
          <span class="month-label">${esc(mLabel)}</span>
          <button class="iconbtn" data-action="cal-next" aria-label="Mes siguiente">${icon('arrow-right')}</button>
        </div>
      </div>
      ${heatCalendar(view.collabMonth, valuesByDate)}
    </section>

    <section class="card">
      <h2 class="card-title">${icon('money')} Mis pagos</h2>
      <p class="hint">Los pagos son cada 2º y 4º viernes del mes.</p>
      <ul class="timeline">${payRows}</ul>
    </section>

    ${insight ? `
    <section class="card card-insight">
      <h2 class="card-title">${icon('sparkle')} Tu momento</h2>
      <p class="insight-text">${insight}</p>
    </section>` : ''}

    <blockquote class="quote">
      <p>“${esc(quote.text)}”</p>
      <cite>— ${esc(quote.by)}</cite>
    </blockquote>

    <button class="btn btn-ghost btn-big btn-block" data-action="logout">
      ${icon('logout')} Salir / Cambiar de persona
    </button>
  </main>`;
  animateCounts();
}

function collabInsight(db, me) {
  const wk = periodRange('week'), lw = periodRange('lastweek');
  const a = hoursIn(db, wk.from, wk.to, me.id);
  const b = hoursIn(db, lw.from, lw.to, me.id);
  if (!a && !b) return '';
  if (!b) return `Arrancaste la semana con <b>${fmtNum(a)} h</b>. ¡Buen comienzo!`;
  const diff = a - b;
  if (diff > 0) return `Llevás <b>${fmtNum(a)} h</b> esta semana, ${fmtNum(diff)} h más que la semana pasada. 💪`;
  if (diff < 0) return `Llevás <b>${fmtNum(a)} h</b> esta semana. La pasada cerraste con ${fmtNum(b)} h.`;
  return `Vas igual que la semana pasada: <b>${fmtNum(a)} h</b>. Constancia total.`;
}

const QUOTES = [
  { text: 'Cuidar una casa es cuidar a quienes viven en ella.', by: 'Anónimo' },
  { text: 'El trabajo bien hecho se nota en los detalles.', by: 'Proverbio' },
  { text: 'La constancia convierte lo ordinario en extraordinario.', by: 'Anónimo' },
  { text: 'Un hogar ordenado es una mente tranquila.', by: 'Proverbio' },
];

function dayOfYear() {
  const d = new Date();
  return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
}

/* ================= vista organizador/a ================= */

const ORG_TABS = [
  { key: 'tablero',     label: 'Tablero',     icon: 'chart' },
  { key: 'liquidacion', label: 'Liquidación', icon: 'money' },
  { key: 'pagos',       label: 'Pagos',       icon: 'check' },
  { key: 'equipo',      label: 'Equipo',      icon: 'users' },
  { key: 'registros',   label: 'Registros',   icon: 'list' },
  { key: 'ajustes',     label: 'Ajustes',     icon: 'settings' },
];

let _lastOrgSub = null;

function renderOrg(db, sub) {
  const tabs = ORG_TABS.map((tb) => `
    <a class="tab ${tb.key === sub ? 'on' : ''}" href="#/o/${tb.key}">
      ${icon(tb.icon)}<span>${tb.label}</span></a>`).join('');

  const bodies = {
    tablero: orgDashboard, liquidacion: orgLiquidacion, pagos: orgPagos,
    equipo: orgEquipo, registros: orgRegistros, ajustes: orgAjustes,
  };
  const body = (bodies[sub] || orgDashboard)(db);

  $app().innerHTML = `
  ${topbar(db, { showLogout: true, subtitle: 'Panel de organización' })}
  <nav class="tabs" aria-label="Secciones">${tabs}</nav>
  <main class="wrap view-enter">${body}</main>`;
  animateCounts();

  // Al ENTRAR a Pagos (no en cada re-render), llevar la vista al próximo pago
  if (sub === 'pagos' && _lastOrgSub !== 'pagos'
      && view.payYear === fromISO(todayISO()).getFullYear()) {
    const target = document.querySelector('.pay-item.is-next') || document.querySelector('.pay-item.is-late');
    if (target) target.scrollIntoView({ block: 'center' });
  }
  _lastOrgSub = sub;
}

/* ---- selector de período reutilizable ---- */

function periodPicker(current, custom, actionPrefix) {
  const chips = PERIODS.map((p) => `
    <button class="chip chip-pick ${current === p.key ? 'on' : ''}"
      data-action="${actionPrefix}-period" data-key="${p.key}">${p.label}</button>`).join('');
  const customChip = `
    <button class="chip chip-pick ${current === 'custom' ? 'on' : ''}"
      data-action="${actionPrefix}-period" data-key="custom">Personalizado</button>`;
  const range = current === 'custom' ? `
    <div class="custom-range">
      <label class="field"><span>Desde</span>
        <input class="input" type="date" value="${custom.from}" data-action-change="${actionPrefix}-from"></label>
      <label class="field"><span>Hasta</span>
        <input class="input" type="date" value="${custom.to}" data-action-change="${actionPrefix}-to"></label>
    </div>` : '';
  return `<div class="chip-row period-row" role="group" aria-label="Período">${chips}${customChip}</div>${range}`;
}

function rangeLabel(r) {
  return `${fmtDateShort(r.from)} — ${fmtDateShort(r.to)}`;
}

/* ---- tablero ---- */

function orgDashboard(db) {
  const staff = activeStaff(db);
  const r = orgRange();
  // Totales solo del personal activo, consistentes con los gráficos
  const totalH = staff.reduce((a, m) => a + hoursIn(db, r.from, r.to, m.id), 0);
  const totalC = staff.reduce((a, m) => a + costIn(db, r.from, r.to, m.id), 0);
  const next = nextPayday(todayISO());
  const daysToPay = next ? Math.round((fromISO(next) - fromISO(todayISO())) / 86400000) : null;

  // Pendiente = pago vencido sin marcar Y con trabajo real en su ventana
  const duePast = paydaysAround(todayISO()).filter((p) => p < todayISO() && p >= addDays(todayISO(), -120));
  const pendingCount = duePast.reduce((a, p) => {
    const w = payWindow(p);
    return a + staff.filter((m) =>
      !isPaid(db, p, m.id) && hoursIn(db, w.from, w.to, m.id) > 0).length;
  }, 0);

  const barItems = staff.map((m) => ({
    label: m.name, color: m.color, value: hoursIn(db, r.from, r.to, m.id),
  })).sort((a, b) => b.value - a.value);

  const donutItems = staff.map((m) => ({
    label: m.name, color: m.color, value: costIn(db, r.from, r.to, m.id),
  })).filter((i) => i.value > 0);

  // serie por día
  const points = [];
  for (let iso = r.from; iso <= r.to; iso = addDays(iso, 1)) {
    points.push({ label: fmtDateShort(iso), value: hoursIn(db, iso, iso) });
    if (points.length > 62) break;
  }

  const insight = orgInsight(db, staff, r);
  const question = TRIGGERS[dayOfYear() % TRIGGERS.length];

  const pinBanner = db.settings.pinIsDefault ? `
    <div class="banner-warn" role="note">
      ${icon('key')} Estás usando el PIN inicial (1234). <a class="link" href="#/o/ajustes">Cambialo en Ajustes</a> para que solo vos veas los montos.
    </div>` : '';

  const emptyTeam = !staff.length ? `
    <section class="card" style="text-align:center">
      <p class="muted">Todavía no hay colaboradoras en el equipo.</p>
      <a class="btn btn-primary" href="#/o/equipo">${icon('users')} Armar mi equipo</a>
    </section>` : '';

  return `
    <section class="page-head">
      <h1 class="display-sm">Tablero</h1>
      ${pinBanner}
      ${periodPicker(view.orgPeriod, view.orgCustom, 'org')}
      <p class="hint">Período: <b>${rangeLabel(r)}</b></p>
    </section>
    ${emptyTeam}

    <section class="kpi-grid">
      <div class="card kpi">
        <span class="kpi-icon">${icon('clock')}</span>
        <span class="kpi-label">Horas del período</span>
        <span class="kpi-num"><b data-count="${totalH}">0</b> h</span>
      </div>
      <div class="card kpi">
        <span class="kpi-icon">${icon('money')}</span>
        <span class="kpi-label">Costo estimado</span>
        <span class="kpi-num kpi-money"><b data-count="${totalC}" data-fmt="money">0</b></span>
      </div>
      <div class="card kpi ${daysToPay !== null && daysToPay <= 2 ? 'kpi-alert' : ''}">
        <span class="kpi-icon">${icon('calendar')}</span>
        <span class="kpi-label">Próximo pago</span>
        <span class="kpi-num kpi-date">${next ? esc(cap(fmtDateLong(next))) : '—'}</span>
        ${daysToPay !== null ? `<span class="hint">${daysToPay === 0 ? '¡Es hoy!' : `Faltan ${daysToPay} día${daysToPay === 1 ? '' : 's'}`}</span>` : ''}
      </div>
      <div class="card kpi ${pendingCount ? 'kpi-alert' : ''}">
        <span class="kpi-icon">${icon('alert')}</span>
        <span class="kpi-label">Pagos pendientes</span>
        <span class="kpi-num"><b data-count="${pendingCount}">0</b></span>
        ${pendingCount ? '<a class="hint link" href="#/o/pagos">Ver en Pagos →</a>' : '<span class="hint">Todo al día ✨</span>'}
      </div>
    </section>

    <section class="grid-2">
      <div class="card">
        <h2 class="card-title">${icon('users')} Horas por persona</h2>
        ${barChart(barItems, { valueFmt: (v) => fmtNum(v) + ' h' })}
      </div>
      <div class="card">
        <h2 class="card-title">${icon('chart')} Participación en el costo</h2>
        ${donutChart(donutItems, fmtNum(totalH) + ' h', 'total')}
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">${icon('trend')} Ritmo del período</h2>
      ${areaChart(points)}
    </section>

    ${insight ? `
    <section class="card card-insight">
      <h2 class="card-title">${icon('sparkle')} Insight</h2>
      <p class="insight-text">${insight}</p>
    </section>` : ''}

    <section class="card card-question">
      <h2 class="card-title">${icon('question')} Para pensar</h2>
      <p class="insight-text">${esc(question)}</p>
    </section>`;
}

const TRIGGERS = [
  '¿Sabías que podés registrar un aumento de tarifa con fecha de vigencia? El histórico se recalcula solo con la tarifa correcta de cada día.',
  '¿Exportaste un respaldo últimamente? En Ajustes podés bajar todos los datos en un archivo.',
  '¿El equipo conoce su vista? Cada colaboradora puede ver su calendario y sus pagos, sin montos.',
  '¿Comparaste este mes contra el anterior? Probá el período "Mes pasado" en el tablero.',
];

function orgInsight(db, staff, r) {
  if (!staff.length) return '';
  const days = Math.round((fromISO(r.to) - fromISO(r.from)) / 86400000) + 1;
  const prevR = { from: addDays(r.from, -days), to: addDays(r.from, -1) };
  const now = hoursIn(db, r.from, r.to);
  const before = hoursIn(db, prevR.from, prevR.to);
  if (!now && !before) return '';
  let phrase;
  if (!before) phrase = `El equipo sumó <b>${fmtNum(now)} h</b> en este período.`;
  else {
    const pct = Math.round(((now - before) / before) * 100);
    phrase = pct >= 0
      ? `El equipo sumó <b>${fmtNum(now)} h</b>, un <b>${pct}% más</b> que el período anterior (${fmtNum(before)} h).`
      : `El equipo sumó <b>${fmtNum(now)} h</b>, un <b>${Math.abs(pct)}% menos</b> que el período anterior (${fmtNum(before)} h).`;
  }
  const top = staff
    .map((m) => ({ m, h: hoursIn(db, r.from, r.to, m.id) }))
    .sort((a, b) => b.h - a.h)[0];
  if (top && top.h > 0) phrase += ` Quien más horas registró fue <b>${esc(top.m.name)}</b> (${fmtNum(top.h)} h).`;
  return phrase;
}

/* ---- liquidación ---- */

function orgLiquidacion(db) {
  const staff = activeStaff(db);
  const r = liqRange();
  let grand = 0;
  const rows = staff.map((m) => {
    const h = hoursIn(db, r.from, r.to, m.id);
    const c = costIn(db, r.from, r.to, m.id);
    grand += c;
    return `
      <tr>
        <td><span class="avatar avatar-xs" style="--c:${esc(m.color)}">${esc(initials(m.name))}</span> ${esc(m.name)}</td>
        <td class="num">${fmtNum(h)} h</td>
        <td class="num">${fmtMoney(currentRate(m))}</td>
        <td class="num strong">${fmtMoney(c)}</td>
        <td class="num">
          <button class="btn btn-mini" data-action="receipt" data-id="${m.id}">${icon('doc')} Recibo</button>
        </td>
      </tr>`;
  }).join('');

  return `
    <section class="page-head">
      <h1 class="display-sm">Liquidación</h1>
      ${periodPicker(view.liqPeriod, view.liqCustom, 'liq')}
      <p class="hint">Período: <b>${rangeLabel(r)}</b> · Cada registro se valúa con la tarifa vigente en su fecha.</p>
    </section>

    <section class="card">
      <div class="table-scroll">
        <table class="table">
          <thead><tr><th>Colaboradora</th><th class="num">Horas</th><th class="num">Tarifa actual</th><th class="num">Total</th><th class="num"></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Sin colaboradoras activas.</td></tr>'}</tbody>
          <tfoot><tr><td colspan="3">Total general</td><td class="num strong total-cell">${fmtMoney(grand)}</td><td></td></tr></tfoot>
        </table>
      </div>
    </section>`;
}

function receiptHTML(db, m, r) {
  const entries = entriesIn(db, r.from, r.to, m.id).sort((a, b) => a.date.localeCompare(b.date));
  const total = costIn(db, r.from, r.to, m.id);
  const h = hoursIn(db, r.from, r.to, m.id);
  const rows = entries.map((e) => `
    <tr><td>${fmtDateFull(e.date)}</td><td class="num">${fmtNum(e.hours)} h</td>
    <td class="num">${fmtMoney(rateFor(m, e.date))}</td>
    <td class="num">${fmtMoney(e.hours * rateFor(m, e.date))}</td></tr>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
  <title>Recibo · ${esc(m.name)}</title>
  <style>
    body{font-family:system-ui,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;color:#1a1a2e}
    h1{font-size:20px} .sub{color:#666;font-size:13px}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
    th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left}
    .num{text-align:right} tfoot td{font-weight:700;border-top:2px solid #333}
    .sign{margin-top:64px;display:flex;gap:48px}
    .sign div{flex:1;border-top:1px solid #333;padding-top:6px;font-size:12px;color:#666;text-align:center}
  </style></head><body>
  <h1>Recibo de pago — ${esc(m.name)}</h1>
  <p class="sub">${esc(db.settings.houseName)} · Período ${fmtDateFull(r.from)} al ${fmtDateFull(r.to)} · Emitido el ${fmtDateFull(todayISO())}</p>
  <table>
    <thead><tr><th>Fecha</th><th class="num">Horas</th><th class="num">Tarifa</th><th class="num">Importe</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">Sin registros en el período.</td></tr>'}</tbody>
    <tfoot><tr><td>Total</td><td class="num">${fmtNum(h)} h</td><td></td><td class="num">${fmtMoney(total)}</td></tr></tfoot>
  </table>
  <div class="sign"><div>Recibí conforme</div><div>Entregué conforme</div></div>
  <script>window.print()</script></body></html>`;
}

/* ---- pagos ---- */

function orgPagos(db) {
  const staff = activeStaff(db);
  const t = todayISO();
  const next = nextPayday(t);
  const paydays = paydaysOfYear(view.payYear);

  // Solo cuenta pagos "debidos": vencidos y con trabajo real en su ventana
  const dueSlots = [];
  paydays.filter((p) => p <= t).forEach((p) => {
    const w = payWindow(p);
    staff.forEach((m) => {
      if (hoursIn(db, w.from, w.to, m.id) > 0) dueSlots.push({ p, id: m.id });
    });
  });
  const doneCount = dueSlots.filter((s) => isPaid(db, s.p, s.id)).length;
  const pct = dueSlots.length ? Math.round((doneCount / dueSlots.length) * 100) : 100;
  const progressLine = staff.length
    ? `<div class="progress progress-lg" role="img" aria-label="Avance de pagos del año: ${pct}%">
         <span class="progress-fill" style="--w:${pct}%"></span>
       </div>
       <p class="hint">Pagos al día: <b>${pct}%</b> de lo debido en ${view.payYear}.</p>`
    : `<p class="hint">Sin equipo activo — <a class="link" href="#/o/equipo">agregá colaboradoras</a> para llevar los pagos.</p>`;

  const items = paydays.map((p) => {
    const w = payWindow(p);
    const withWork = staff.filter((m) => hoursIn(db, w.from, w.to, m.id) > 0);
    const allPaid = withWork.length > 0 && withWork.every((m) => isPaid(db, p, m.id));
    const noWork = withWork.length === 0;
    const isNext = p === next;
    const isLate = p < t && withWork.some((m) => !isPaid(db, p, m.id));
    const chips = staff.map((m) => {
      const paid = isPaid(db, p, m.id);
      const amount = costIn(db, w.from, w.to, m.id);
      return `
        <button class="paychip ${paid ? 'paid' : ''}" data-action="toggle-paid"
          data-payday="${p}" data-id="${m.id}"
          title="${paid ? 'Marcar como NO pagado' : 'Marcar como pagado'} · sugerido ${fmtMoney(amount)}">
          <span class="avatar avatar-xs" style="--c:${esc(m.color)}">${esc(initials(m.name))}</span>
          ${esc(m.name)} · ${fmtMoney(amount)} ${paid ? icon('check') : ''}
        </button>`;
    }).join('');
    return `
      <li class="pay-item ${allPaid ? 'is-paid' : ''} ${isNext ? 'is-next' : ''} ${isLate ? 'is-late' : ''}">
        <div class="pay-head">
          <span class="tl-dot"></span>
          <span class="tl-date">${esc(cap(fmtDateLong(p)))}</span>
          ${isNext ? '<span class="chip chip-accent">Próximo</span>' : ''}
          ${allPaid ? `<span class="chip chip-ok">${icon('check')} Completo</span>`
            : isLate ? '<span class="chip chip-warn">Pendiente</span>'
            : p < t && noWork ? '<span class="chip chip-soft">Sin horas registradas</span>' : ''}
        </div>
        <p class="hint">Cubre del ${fmtDateShort(w.from)} al ${fmtDateShort(w.to)}</p>
        <div class="paychips">${chips || '<span class="muted">Sin equipo activo.</span>'}</div>
      </li>`;
  }).join('');

  return `
    <section class="page-head">
      <h1 class="display-sm">Pagos</h1>
      <p class="muted">Cada <b>2º</b> y <b>4º viernes</b> del mes. Tocá una persona para marcar su pago.</p>
      <div class="year-nav">
        <button class="iconbtn" data-action="pay-year" data-d="-1" aria-label="Año anterior">${icon('arrow-left')}</button>
        <span class="month-label">${view.payYear}</span>
        <button class="iconbtn" data-action="pay-year" data-d="1" aria-label="Año siguiente">${icon('arrow-right')}</button>
      </div>
      ${progressLine}
    </section>
    <ul class="timeline pay-timeline">${items}</ul>`;
}

/* ---- equipo ---- */

function orgEquipo(db) {
  const cards = db.staff.map((m) => {
    const rate = currentRate(m);
    const history = [...m.rates].sort((a, b) => b.from.localeCompare(a.from)).map((r) => `
      <li><b>${fmtMoney(r.value)}</b> <span class="muted">desde ${fmtDateFull(r.from)}</span></li>`).join('');
    return `
      <div class="card staff-card ${m.active ? '' : 'is-archived'}">
        <div class="staff-head">
          <span class="avatar" style="--c:${esc(m.color)}">${esc(initials(m.name))}</span>
          <div><h3>${esc(m.name)}</h3>
            <p class="hint">${m.active ? 'Activa' : 'Archivada'} · Tarifa actual: <b>${fmtMoney(rate)}</b>/h</p>
          </div>
        </div>
        <details class="rate-history"><summary>Historial de tarifas</summary><ul>${history}</ul></details>
        <div class="staff-actions">
          <button class="btn btn-mini" data-action="staff-edit" data-id="${m.id}">${icon('edit')} Editar</button>
          <button class="btn btn-mini" data-action="rate-new" data-id="${m.id}">${icon('money')} Nueva tarifa</button>
          <button class="btn btn-mini btn-ghost" data-action="staff-toggle" data-id="${m.id}">
            ${m.active ? 'Archivar' : 'Restaurar'}</button>
        </div>
      </div>`;
  }).join('');

  return `
    <section class="page-head">
      <h1 class="display-sm">Equipo</h1>
      <p class="muted">Las personas archivadas dejan de aparecer, pero su historial se conserva.</p>
      <button class="btn btn-primary" data-action="staff-new">${icon('plus')} Agregar colaboradora</button>
    </section>
    <section class="staff-grid">${cards || '<p class="empty-note">Todavía no hay nadie en el equipo. ¡Agregá a la primera persona!</p>'}</section>`;
}

function staffFormModal(db, member) {
  const isNew = !member;
  const selected = member && STAFF_COLORS.includes(member.color) ? member.color : STAFF_COLORS[0];
  const colors = STAFF_COLORS.map((c) => `
    <label class="color-pick"><input type="radio" name="color" value="${c}"
      ${c === selected ? 'checked' : ''}>
      <span style="--c:${c}"></span></label>`).join('');
  openModal(`
    <h3>${isNew ? 'Nueva colaboradora' : 'Editar a ' + esc(member.name)}</h3>
    <form data-action-submit="staff-save" ${member ? `data-id="${member.id}"` : ''}>
      <label class="field"><span>Nombre</span>
        <input class="input" name="name" required maxlength="40" value="${member ? esc(member.name) : ''}" placeholder="Ej: Carmen">
      </label>
      <div class="field"><span>Color</span><div class="color-row">${colors}</div></div>
      ${isNew ? `
      <div class="form-grid">
        <label class="field"><span>Tarifa por hora</span>
          <input class="input" name="rate" type="number" min="0" step="0.01" required placeholder="7500">
        </label>
        <label class="field"><span>Vigente desde</span>
          <input class="input" name="rateFrom" type="date" value="${todayISO()}">
        </label>
      </div>` : ''}
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>`);
}

function rateModal(db, member) {
  openModal(`
    <h3>Nueva tarifa · ${esc(member.name)}</h3>
    <p class="muted">La tarifa anterior sigue valiendo para las fechas previas. Ideal para aumentos de convenio.</p>
    <form data-action-submit="rate-save" data-id="${member.id}">
      <div class="form-grid">
        <label class="field"><span>Valor por hora</span>
          <input class="input" name="value" type="number" min="0" step="0.01" required
            value="${currentRate(member)}">
        </label>
        <label class="field"><span>Vigente desde</span>
          <input class="input" name="from" type="date" value="${todayISO()}" required>
        </label>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar tarifa</button>
      </div>
    </form>`);
}

/* ---- registros ---- */

function orgRegistros(db) {
  const staff = db.staff;
  const f = view.regFilter;
  const from = f.month ? `${f.month}-01` : '0000-01-01';
  const to = f.month ? monthEndISO(`${f.month}-01`) : '9999-12-31';
  const list = entriesIn(db, from, to, f.staffId || undefined)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const rows = list.map((e) => {
    const m = staffById(db, e.staffId);
    return `
      <tr>
        <td>${fmtDateFull(e.date)}</td>
        <td>${m ? `<span class="avatar avatar-xs" style="--c:${esc(m.color)}">${esc(initials(m.name))}</span> ${esc(m.name)}` : '—'}</td>
        <td class="num">${fmtNum(e.hours)} h</td>
        <td class="note-cell" ${e.note ? `title="${esc(e.note)}"` : ''}>${e.note ? esc(e.note) : '<span class="muted">—</span>'}</td>
        <td class="num">
          <button class="iconbtn" data-action="entry-edit" data-id="${e.id}" aria-label="Editar">${icon('edit')}</button>
          <button class="iconbtn" data-action="entry-del" data-id="${e.id}" aria-label="Borrar">${icon('trash')}</button>
        </td>
      </tr>`;
  }).join('');

  const opts = staff.map((m) =>
    `<option value="${m.id}" ${f.staffId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');

  const totalH = list.reduce((a, e) => a + e.hours, 0);

  return `
    <section class="page-head">
      <h1 class="display-sm">Registros</h1>
      <div class="filter-row">
        <label class="field"><span>Persona</span>
          <select class="input" data-action-change="reg-staff">
            <option value="">Todas</option>${opts}</select>
        </label>
        <label class="field"><span>Mes</span>
          <input class="input" type="month" value="${f.month}" data-action-change="reg-month">
        </label>
        <button class="btn btn-ghost" data-action="org-add-entry">${icon('plus')} Cargar horas</button>
      </div>
      <p class="hint">${list.length} registro${list.length === 1 ? '' : 's'} · ${fmtNum(totalH)} h en total</p>
    </section>
    <section class="card">
      <div class="table-scroll">
        <table class="table">
          <thead><tr><th>Fecha</th><th>Persona</th><th class="num">Horas</th><th>Nota</th><th class="num"></th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="muted">Sin registros con estos filtros.</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
}

function entryModal(db, entry) {
  const staff = activeStaff(db);
  const opts = staff.map((m) =>
    `<option value="${m.id}" ${entry && entry.staffId === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  openModal(`
    <h3>${entry ? 'Editar registro' : 'Cargar horas'}</h3>
    <form data-action-submit="org-entry-save" ${entry ? `data-id="${entry.id}"` : ''}>
      ${entry ? '' : `<label class="field"><span>Persona</span>
        <select class="input" name="staffId" required>${opts}</select></label>`}
      <div class="form-grid">
        <label class="field"><span>Fecha</span>
          <input class="input" name="date" type="date" required value="${entry ? entry.date : todayISO()}" max="${todayISO()}">
        </label>
        <label class="field"><span>Horas</span>
          <input class="input" name="hours" type="number" min="0.5" max="24" step="0.5" required value="${entry ? entry.hours : ''}">
        </label>
      </div>
      <label class="field"><span>Nota</span>
        <input class="input" name="note" maxlength="200" value="${entry ? esc(entry.note) : ''}">
      </label>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-action="modal-close">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar</button>
      </div>
    </form>`);
}

/* ---- ajustes ---- */

function orgAjustes(db) {
  return `
    <section class="page-head"><h1 class="display-sm">Ajustes</h1></section>

    <section class="card">
      <h2 class="card-title">${icon('home')} La casa</h2>
      <form data-action-submit="settings-save" class="form-grid">
        <label class="field"><span>Nombre de la casa</span>
          <input class="input" name="houseName" maxlength="40" value="${esc(db.settings.houseName)}"></label>
        <label class="field"><span>Tu nombre</span>
          <input class="input" name="ownerName" maxlength="40" value="${esc(db.settings.ownerName)}"></label>
        <button class="btn btn-primary" type="submit">Guardar</button>
      </form>
    </section>

    <section class="card">
      <h2 class="card-title">${icon('key')} PIN de acceso</h2>
      <p class="hint">Protege la vista de organización en este dispositivo. No es una contraseña fuerte: es una traba amable para uso hogareño.</p>
      <form data-action-submit="pin-change" class="form-grid">
        <label class="field"><span>PIN actual</span>
          <input class="input" name="oldPin" type="password" inputmode="numeric" maxlength="8" required></label>
        <label class="field"><span>PIN nuevo (4 a 8 dígitos)</span>
          <input class="input" name="newPin" type="password" inputmode="numeric" minlength="4" maxlength="8" required></label>
        <button class="btn btn-primary" type="submit">Cambiar PIN</button>
      </form>
    </section>

    <section class="card">
      <h2 class="card-title">${icon('download')} Respaldo</h2>
      <p class="hint">Los datos viven solo en este dispositivo. Exportá un archivo de respaldo cada tanto.</p>
      <div class="btn-row">
        <button class="btn" data-action="export">${icon('download')} Exportar datos</button>
        <label class="btn btn-ghost">
          ${icon('upload')} Importar respaldo
          <input type="file" accept="application/json" class="sr-only" data-action-change="import">
        </label>
      </div>
    </section>

    <section class="card card-danger">
      <h2 class="card-title">${icon('alert')} Zona delicada</h2>
      <div class="btn-row">
        <button class="btn btn-ghost" data-action="reset-demo">Reiniciar con datos de ejemplo</button>
        <button class="btn btn-danger" data-action="reset-all">Borrar todo</button>
      </div>
    </section>

    <p class="foot-note">${icon('shield')} CasaFlow v1 · código abierto · tus datos no salen de este dispositivo.</p>`;
}

/* ================= glosario ================= */

const GLOSSARY = [
  { icon: 'money',    term: 'Liquidación',   def: 'El cálculo de cuánto corresponde pagar: horas trabajadas × tarifa vigente, en un período.' },
  { icon: 'calendar', term: 'Quincena',      def: 'Mitades del mes: del 1 al 15 (quincena 1) y del 16 a fin de mes (quincena 2).' },
  { icon: 'clock',    term: 'Tarifa vigente', def: 'El valor por hora que aplica en una fecha. Si hubo aumentos, cada día usa el valor que correspondía.' },
  { icon: 'check',    term: 'Día de pago',   def: 'En esta casa: el 2º y el 4º viernes de cada mes.' },
  { icon: 'chart',    term: 'Mapa de calor', def: 'Calendario donde cada día se pinta más intenso cuantas más horas se registraron.' },
  { icon: 'download', term: 'Respaldo',      def: 'Archivo con todos tus datos, para guardar o pasar a otro dispositivo.' },
];

function glossaryModal() {
  const items = GLOSSARY.map((g) => `
    <li class="gloss-item">
      <span class="gloss-icon">${icon(g.icon)}</span>
      <div><b>${esc(g.term)}</b><p>${esc(g.def)}</p></div>
    </li>`).join('');
  openModal(`<h3>${icon('book')} Glosario visual</h3><ul class="gloss-list">${items}</ul>`, { wide: true });
}

/* ================= temas ================= */

function applyTheme() {
  const db = loadDB();
  const t = db.settings.theme;
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

function cycleTheme() {
  const db = loadDB();
  const order = ['auto', 'light', 'dark'];
  const next = order[(order.indexOf(db.settings.theme) + 1) % order.length];
  db.settings.theme = next;
  saveDB();
  applyTheme();
  toast(`Tema: ${next === 'auto' ? 'automático' : next === 'light' ? 'claro' : 'oscuro'}`);
}

/* ================= acciones (delegación) ================= */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const db = loadDB();
  const a = el.dataset.action;

  switch (a) {
    case 'modal-close': closeModal(); break;
    case 'glossary': glossaryModal(); break;
    case 'theme': cycleTheme(); break;
    case 'logout': setSession(null); go('#/'); break;

    /* onboarding */
    case 'ob-next': obSlide++; renderOnboarding(); break;
    case 'ob-back': obSlide--; renderOnboarding(); break;
    case 'ob-demo': resetDB(true); toast('Datos de ejemplo cargados ✨'); go('#/'); route(); break;
    case 'ob-fresh': resetDB(false); go('#/'); route(); break;

    /* ingreso */
    case 'login-collab':
      setSession({ role: 'collab', staffId: el.dataset.id });
      go('#/c'); break;
    case 'login-org': askPin(); break;

    /* colaboradora */
    case 'pick-hours': {
      const input = el.closest('form').querySelector('[name="hours"]');
      input.value = el.dataset.h;
      el.closest('.chip-row').querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
      el.classList.add('on');
      break;
    }
    case 'cal-prev': case 'cal-next': {
      const d = fromISO(view.collabMonth + '-01');
      d.setMonth(d.getMonth() + (a === 'cal-next' ? 1 : -1));
      view.collabMonth = toISO(d).slice(0, 7);
      route(); break;
    }

    /* organizador: períodos */
    case 'org-period': view.orgPeriod = el.dataset.key; route(); break;
    case 'liq-period': view.liqPeriod = el.dataset.key; route(); break;
    case 'pay-year': view.payYear += Number(el.dataset.d); route(); break;

    /* pagos */
    case 'toggle-paid': {
      togglePaid(db, el.dataset.payday, el.dataset.id);
      const m = staffById(db, el.dataset.id);
      toast(isPaid(db, el.dataset.payday, el.dataset.id)
        ? `Pago de ${m.name} marcado ✔` : `Pago de ${m.name} desmarcado`);
      route(); break;
    }

    /* liquidación */
    case 'receipt': {
      const m = staffById(db, el.dataset.id);
      const w = window.open('', '_blank');
      if (w) { w.document.write(receiptHTML(db, m, liqRange())); w.document.close(); }
      else toast('El navegador bloqueó la ventana del recibo.', 'info');
      break;
    }

    /* equipo */
    case 'staff-new': staffFormModal(db, null); break;
    case 'staff-edit': staffFormModal(db, staffById(db, el.dataset.id)); break;
    case 'rate-new': rateModal(db, staffById(db, el.dataset.id)); break;
    case 'staff-toggle': {
      const m = staffById(db, el.dataset.id);
      m.active = !m.active; saveDB();
      toast(m.active ? `${m.name} restaurada` : `${m.name} archivada`);
      route(); break;
    }

    /* registros */
    case 'org-add-entry': entryModal(db, null); break;
    case 'entry-edit': entryModal(db, db.entries.find((x) => x.id === el.dataset.id)); break;
    case 'entry-del':
      confirmModal('¿Borrar este registro?',
        'Esta acción no se puede deshacer.',
        'Borrar', `data-action="entry-del-confirm" data-id="${el.dataset.id}"`);
      break;
    case 'entry-del-confirm':
      deleteEntry(db, el.dataset.id); closeModal(); toast('Registro borrado'); route(); break;

    /* ajustes */
    case 'export': exportJSON(db); toast('Respaldo exportado'); break;
    case 'reset-demo':
      confirmModal('¿Reiniciar con datos de ejemplo?',
        'Se borra <b>todo</b> lo actual y se carga el equipo ficticio de demostración.',
        'Reiniciar', 'data-action="reset-demo-confirm"');
      break;
    case 'reset-demo-confirm': resetDB(true); setSession(null); closeModal(); go('#/'); route(); break;
    case 'reset-all':
      confirmModal('¿Borrar TODOS los datos?',
        'Se pierde todo: equipo, horas y pagos. Exportá un respaldo antes si tenés dudas.',
        'Borrar todo', 'data-action="reset-all-confirm"');
      break;
    case 'reset-all-confirm': resetDB(false); setSession(null); closeModal(); go('#/'); route(); break;
  }
});

/* cambios (selects, fechas, archivos) */
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-action-change]');
  if (!el) return;
  const a = el.dataset.actionChange;
  switch (a) {
    /* si el campo de fecha queda vacío, se ignora el cambio (evita fechas inválidas) */
    case 'org-from': if (el.value) { view.orgCustom.from = el.value; route(); } break;
    case 'org-to': if (el.value) { view.orgCustom.to = el.value; route(); } break;
    case 'liq-from': if (el.value) { view.liqCustom.from = el.value; route(); } break;
    case 'liq-to': if (el.value) { view.liqCustom.to = el.value; route(); } break;
    case 'reg-staff': view.regFilter.staffId = el.value; route(); break;
    case 'reg-month': view.regFilter.month = el.value; route(); break;
    case 'import': {
      const file = el.files[0];
      if (!file) return;
      file.text().then((txt) => {
        try { importJSON(txt); toast('Respaldo importado ✔'); route(); }
        catch (e) { toast(e.message, 'err'); }
      });
      break;
    }
  }
});

/* formularios */
document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-action-submit]');
  if (!form) return;
  ev.preventDefault();
  const db = loadDB();
  const a = form.dataset.actionSubmit;
  const fd = new FormData(form);

  switch (a) {
    case 'pin-submit': {
      const pin = String(fd.get('pin') || '');
      const ok = /^\d{1,8}$/.test(pin) && btoa(pin) === db.settings.pin;
      if (!ok) { toast('PIN incorrecto', 'err'); return; }
      closeModal();
      setSession({ role: 'org' });
      go('#/o/tablero');
      break;
    }
    case 'entry-save': {
      const s = getSession();
      const hours = Number(fd.get('hours'));
      if (!hours || hours <= 0) { toast('Ingresá las horas', 'err'); return; }
      addEntry(db, {
        staffId: s.staffId, date: String(fd.get('date')),
        hours, note: String(fd.get('note') || ''),
      });
      celebrate();
      toast('¡Horas guardadas! 🎉');
      route();
      break;
    }
    case 'org-entry-save': {
      const id = form.dataset.id;
      if (id) {
        updateEntry(db, id, {
          date: String(fd.get('date')), hours: Number(fd.get('hours')),
          note: String(fd.get('note') || ''),
        });
        toast('Registro actualizado');
      } else {
        addEntry(db, {
          staffId: String(fd.get('staffId')), date: String(fd.get('date')),
          hours: Number(fd.get('hours')), note: String(fd.get('note') || ''),
        });
        toast('Horas cargadas');
      }
      closeModal(); route();
      break;
    }
    case 'staff-save': {
      const id = form.dataset.id;
      const pickedColor = STAFF_COLORS.includes(String(fd.get('color')))
        ? String(fd.get('color')) : STAFF_COLORS[0];
      if (id) {
        const m = staffById(db, id);
        m.name = String(fd.get('name')).trim();
        m.color = pickedColor;
        saveDB(); toast('Equipo actualizado');
      } else {
        addStaff(db, {
          name: String(fd.get('name')), color: pickedColor,
          rate: Number(fd.get('rate')), rateFrom: String(fd.get('rateFrom') || todayISO()),
        });
        toast('¡Bienvenida al equipo! 🎉');
      }
      closeModal(); route();
      break;
    }
    case 'rate-save': {
      addRate(db, form.dataset.id, {
        value: Number(fd.get('value')), from: String(fd.get('from')),
      });
      closeModal(); toast('Nueva tarifa registrada'); route();
      break;
    }
    case 'settings-save': {
      db.settings.houseName = String(fd.get('houseName')).trim() || 'Mi casa';
      db.settings.ownerName = String(fd.get('ownerName')).trim() || 'Organizador/a';
      saveDB(); toast('Guardado'); route();
      break;
    }
    case 'pin-change': {
      const op = String(fd.get('oldPin'));
      if (!/^\d{1,8}$/.test(op) || btoa(op) !== db.settings.pin) {
        toast('El PIN actual no coincide', 'err'); return;
      }
      const np = String(fd.get('newPin'));
      if (!/^\d{4,8}$/.test(np)) { toast('El PIN debe tener 4 a 8 dígitos', 'err'); return; }
      db.settings.pin = btoa(np);
      db.settings.pinIsDefault = false;
      saveDB(); form.reset(); toast('PIN actualizado ✔');
      break;
    }
  }
});

/* pequeña celebración al guardar horas */
function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const burst = document.createElement('div');
  burst.className = 'confetti';
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('i');
    p.style.setProperty('--dx', (Math.random() * 2 - 1).toFixed(2));
    p.style.setProperty('--dy', (-Math.random()).toFixed(2));
    p.style.setProperty('--hue', String(Math.floor(Math.random() * 360)));
    burst.appendChild(p);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1200);
}

/* ================= arranque ================= */

window.addEventListener('hashchange', route);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

applyTheme();
route();
