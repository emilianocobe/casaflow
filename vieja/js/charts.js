/* =========================================================
   CasaFlow · charts.js
   Gráficos SVG hechos a mano: barras, dona, área y
   calendario de calor. Sin dependencias externas.
   ========================================================= */

'use strict';

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ---------- Barras horizontales (horas por persona) ---------- */

function barChart(items, { valueFmt = (v) => v } = {}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const rows = items.map((it) => {
    const pct = Math.round((it.value / max) * 100);
    return `
      <div class="bar-row" role="img" aria-label="${esc(it.label)}: ${esc(valueFmt(it.value))}">
        <span class="bar-label">${esc(it.label)}</span>
        <span class="bar-track"><span class="bar-fill" style="--w:${pct}%;--c:${esc(it.color)}"></span></span>
        <span class="bar-value">${esc(valueFmt(it.value))}</span>
      </div>`;
  }).join('');
  return `<div class="bar-chart">${rows || '<p class="muted">Sin datos en este período.</p>'}</div>`;
}

/* ---------- Dona (participación en el costo) ---------- */

function donutChart(items, centerTop, centerBottom) {
  const total = items.reduce((a, i) => a + i.value, 0);
  if (!total) return '<p class="muted">Sin datos en este período.</p>';
  const R = 15.9155; // circunferencia = 100
  let acc = 0;
  const segs = items.map((it) => {
    const pct = (it.value / total) * 100;
    const seg = `<circle r="${R}" cx="21" cy="21" fill="transparent"
      stroke="${esc(it.color)}" stroke-width="5.4"
      stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}"
      stroke-dashoffset="${(25 - acc).toFixed(2)}"></circle>`;
    acc += pct;
    return seg;
  }).join('');
  const legend = items.map((it) => {
    const pct = Math.round((it.value / total) * 100);
    return `<li><span class="dot" style="--c:${esc(it.color)}"></span>${esc(it.label)} <b>${pct}%</b></li>`;
  }).join('');
  return `
    <div class="donut-wrap">
      <svg viewBox="0 0 42 42" class="donut" role="img" aria-label="Distribución">
        ${segs}
        <text x="21" y="20" class="donut-num">${esc(centerTop)}</text>
        <text x="21" y="26" class="donut-cap">${esc(centerBottom)}</text>
      </svg>
      <ul class="donut-legend">${legend}</ul>
    </div>`;
}

/* ---------- Área / línea (horas por día) ---------- */

function areaChart(points, { height = 120 } = {}) {
  // points: [{label, value}]
  if (!points.length) return '<p class="muted">Sin datos en este período.</p>';
  const W = 100, H = 36;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = points.length > 1 ? W / (points.length - 1) : 0;
  const xy = points.map((p, i) => [
    (i * step).toFixed(2),
    (H - 3 - (p.value / max) * (H - 8)).toFixed(2),
  ]);
  const line = xy.map((c, i) => (i ? 'L' : 'M') + c[0] + ' ' + c[1]).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const dots = xy.map(([x, y], i) =>
    points[i].value > 0
      ? `<circle cx="${x}" cy="${y}" r="0.9" class="area-dot"><title>${esc(points[i].label)}: ${points[i].value} h</title></circle>`
      : ''
  ).join('');
  const first = points[0].label, last = points[points.length - 1].label;
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="area-chart" style="height:${height}px" role="img" aria-label="Horas por día">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="grad-a"/><stop offset="1" class="grad-b"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#areaGrad)"></path>
      <path d="${line}" class="area-line" fill="none"></path>
      ${dots}
    </svg>
    <div class="area-axis"><span>${esc(first)}</span><span>${esc(last)}</span></div>`;
}

/* ---------- Calendario de calor mensual ---------- */

function heatCalendar(yearMonth, valuesByDate, { maxRef = 8 } = {}) {
  // yearMonth: 'YYYY-MM'
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDow = (new Date(y, m - 1, 1, 12).getDay() + 6) % 7; // lunes=0
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = todayISO();

  let cells = '';
  for (let i = 0; i < firstDow; i++) cells += '<span class="hc-cell hc-empty"></span>';
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${pad2(m)}-${pad2(d)}`;
    const v = valuesByDate[iso] || 0;
    const lvl = v <= 0 ? 0 : Math.min(4, Math.ceil((v / maxRef) * 4));
    const isToday = iso === today ? ' hc-today' : '';
    const title = v > 0 ? `${fmtDateShort(iso)}: ${fmtNum(v)} h` : fmtDateShort(iso);
    cells += `<span class="hc-cell hc-l${lvl}${isToday}" title="${esc(title)}" aria-label="${esc(title)}">${d}${v > 0 ? `<i>${fmtNum(v)}</i>` : ''}</span>`;
  }
  const dows = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
    .map((d) => `<span class="hc-dow">${d}</span>`).join('');
  return `
    <div class="heatcal" aria-label="Calendario de horas">
      <div class="hc-grid">${dows}${cells}</div>
      <div class="hc-scale"><span>menos</span>
        <span class="hc-cell hc-l0"></span><span class="hc-cell hc-l1"></span>
        <span class="hc-cell hc-l2"></span><span class="hc-cell hc-l3"></span>
        <span class="hc-cell hc-l4"></span><span>más</span></div>
    </div>`;
}

/* ---------- Números animados (count-up) ---------- */

function animateCounts(root = document) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    const fmt = el.dataset.fmt === 'money' ? fmtMoney : fmtNum;
    if (reduce || target === 0) { el.textContent = fmt(target); return; }
    const t0 = performance.now(), dur = 650;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(target * eased);
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = fmt(target);
    };
    requestAnimationFrame(tick);
  });
}
