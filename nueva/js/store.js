/* =========================================================
   CasaFlow (app nueva) · store.js
   Dos modos con la misma interfaz:
     - 'cloud': Firebase (Auth con Google + Firestore), datos reales.
       Usa colecciones NUEVAS (hogares/, invitaciones/), separadas de
       la app vieja (houses/, invites/): la app nueva arranca en blanco.
     - 'demo' : datos de ejemplo en este navegador (?demo en la URL).

   Modelo en Firestore:
     hogares/{hid}                       nombre, dueño (ownerUid)
     hogares/{hid}/equipo/{sid}          ficha: nombre, color, email, orden, mín/máx, permisos
     hogares/{hid}/tarifas/{sid}         tarifas con vigencia (solo administración)
     hogares/{hid}/meses/{YYYY-MM}       estado del mes + foto de turnos (orden, mínimos, máximos)
     hogares/{hid}/bloques/{fecha_B}     bloque cerrado / lugar de shadow habilitado
     hogares/{hid}/reservas/{fecha_B_R}  R = T (titular) o S (shadow); presente en "att"
     hogares/{hid}/extras/{id}           horas extra (pend / ok / rej)
     hogares/{hid}/pagos/{YYYY-MM_sid}   pago del mes marcado por la administración
     invitaciones/{email}                a qué hogar y ficha pertenece cada mail
   ========================================================= */

'use strict';

const DEMO_KEY = 'casaflow2.demo';

const Store = (() => {
  const params = new URLSearchParams(location.search);
  const cfg = window.CASAFLOW_FIREBASE || null;
  const mode = params.has('demo') || !cfg || typeof firebase === 'undefined' ? 'demo' : 'cloud';

  let onChange = () => {};
  let state = 'init';          // init | anon | loading | noaccess | ready | error
  let role = null;             // 'admin' | 'collab'
  let mySid = null;
  let errorMsg = '';
  let user = null;

  const changed = (() => {
    let t = null;
    return () => { clearTimeout(t); t = setTimeout(() => onChange(), 30); };
  })();

  /* =================== DEMO =================== */

  function demoLoad() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) { D = Object.assign(EMPTY_DATA(), JSON.parse(raw)); return; }
    } catch { /* datos corruptos: se rehace la demo */ }
    D = demoSeed();
    demoSave();
  }
  function demoSave() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(D)); } catch { /* sin espacio */ } }

  function demoSeed() {
    const data = EMPTY_DATA();
    const live = currentYM();
    const plan = addMonths(live, 1);
    const t = todayISO();
    const since = `${Number(live.slice(0, 4)) - 1}-01-01`;
    data.house = { name: 'Casa de ejemplo', ownerName: 'Administración' };
    data.staff = [
      { id: 'jo', name: 'Josefina', color: '#e08f3c', email: 'josefina@ejemplo.com', active: true, rank: 1, min: 3, max: 5, canTit: true, canSh: false, rates: [{ from: since, value: 7500 }] },
      { id: 'li', name: 'Lilian',   color: '#e05f8f', email: 'lilian@ejemplo.com',   active: true, rank: 2, min: 2, max: 4, canTit: true, canSh: false, rates: [{ from: since, value: 7000 }] },
      { id: 'mi', name: 'Micaela',  color: '#2fa989', email: 'micaela@ejemplo.com',  active: true, rank: 3, min: 2, max: 4, canTit: true, canSh: false, rates: [{ from: since, value: 8500 }] },
      { id: 'ca', name: 'Carla',    color: '#4f93e0', email: 'carla@ejemplo.com',    active: true, rank: 4, min: 1, max: 3, canTit: false, canSh: true, rates: [{ from: since, value: 5000 }] },
    ];
    const add = (date, b, sid, r = 'titular') => data.bookings.push({ id: bookingId(date, b, r), date, b, role: r, sid, month: ymOf(date), att: null });

    // mes en curso: el plan que reservaron el mes pasado
    let mondays = 0;
    monthDays(live).forEach((d) => {
      const dow = fromISO(d).getDay();
      if ([1, 3, 5].includes(dow)) add(d, 'M', 'jo');
      if ([1, 4].includes(dow)) add(d, 'T', 'li');
      if ([2, 4].includes(dow)) add(d, 'M', 'mi');
      if (dow === 6) add(d, 'T', 'mi');
      if (dow === 1 && ++mondays >= 2) { data.blocks[blockKey(d, 'M')] = { closed: false, shadow: true }; add(d, 'M', 'ca', 'shadow'); }
    });
    data.bookings.forEach((x) => { if (x.date < t) x.att = { st: 'asistio', h: BLOCKS[x.b].hours }; });
    const past = (sid, b) => data.bookings.filter((x) => x.sid === sid && x.b === b && x.date < t);
    const pMiM = past('mi', 'M'), pLiT = past('li', 'T'), pMiT = past('mi', 'T'), pJoM = past('jo', 'M');
    if (pMiM[0]) pMiM[0].att = { st: 'falto', h: 0 };
    if (pLiT.length > 2) pLiT[1].att = { st: 'parcial', h: 4 };
    if (pLiT.length > 1) pLiT[pLiT.length - 1].att = null;
    if (pMiT.length) pMiT[pMiT.length - 1].att = null;
    if (pJoM[2]) data.extras.push({ id: 'x1', date: pJoM[2].date, b: 'M', sid: 'jo', h: 1, motivo: 'Se quedó a recibir al técnico', by: 'admin', estado: 'ok' });
    if (pLiT[2]) data.extras.push({ id: 'x2', date: pLiT[2].date, b: 'T', sid: 'li', h: 1.5, motivo: 'Me quedé a terminar el planchado', by: 'collab', estado: 'pend' });
    data.months[live] = { status: 'cerrado' };

    // mes siguiente: reservas abiertas; Josefina ya cubrió su mínimo
    const full = weeksOfMonth(plan).filter((w) => w.full);
    full.forEach((w) => w.days.forEach((d) => {
      const dow = fromISO(d).getDay();
      if ([1, 3, 5].includes(dow)) add(d, 'M', 'jo');
      if (dow === 1) data.blocks[blockKey(d, 'M')] = { closed: false, shadow: true };
    }));
    if (full[0]) {
      const wd = (w, dow) => w.days.find((d) => fromISO(d).getDay() === dow);
      data.blocks[blockKey(wd(full[0], 3), 'M')] = { closed: false, shadow: true };
      add(wd(full[0], 2), 'T', 'li');
      add(wd(full[0], 4), 'T', 'li');
      if (full[1]) add(wd(full[1], 2), 'T', 'li');
      if (full[2]) ['M', 'T'].forEach((b) => [6, 0].forEach((dow) => { data.blocks[blockKey(wd(full[2], dow), b)] = { closed: true, shadow: false }; }));
    }
    const snap = snapshotFor(data.staff);
    data.months[plan] = { status: 'reservas', ...snap, turnFloor: 0 };
    return data;
  }

  /** Foto de turnos para un mes: orden de titulares y límites de cada persona. */
  function snapshotFor(staff) {
    const act = staff.filter((s) => s.active !== false).sort((a, b) => (a.rank || 99) - (b.rank || 99));
    const mins = {}, maxs = {};
    act.forEach((s) => { mins[s.id] = s.min; maxs[s.id] = s.max; });
    return { order: act.filter((s) => s.canTit).map((s) => s.id), mins, maxs };
  }

  const demoWriters = {
    async saveHouse(p) { Object.assign(D.house, p); },
    async saveStaff(m) {
      const i = D.staff.findIndex((x) => x.id === m.id);
      if (i > -1) D.staff[i] = { ...D.staff[i], ...m }; else D.staff.push(m);
    },
    async saveRates(sid, rates) { const s = person(sid); if (s) s.rates = rates; },
    async saveMonth(ym, p) { D.months[ym] = { ...(D.months[ym] || {}), ...p }; },
    async saveBlock(key, p) { D.blocks[key] = { closed: false, shadow: false, ...(D.blocks[key] || {}), ...p }; },
    async addBooking(bk) {
      if (D.bookings.some((x) => x.id === bk.id)) throw Object.assign(new Error('ocupado'), { code: 'taken' });
      D.bookings.push({ att: null, ...bk });
    },
    async removeBooking(id) { D.bookings = D.bookings.filter((x) => x.id !== id); },
    async moveBooking(oldId, bk) {
      if (D.bookings.some((x) => x.id === bk.id)) throw Object.assign(new Error('ocupado'), { code: 'taken' });
      D.bookings = D.bookings.filter((x) => x.id !== oldId);
      D.bookings.push({ att: null, ...bk });
    },
    async setAtt(id, att) { const x = D.bookings.find((y) => y.id === id); if (x) x.att = att; },
    async addExtra(e) { D.extras.push(e); },
    async updateExtra(id, p) { const e = D.extras.find((x) => x.id === id); if (e) Object.assign(e, p); },
    async setPago(key, data) { if (data) D.pagos[key] = data; else delete D.pagos[key]; },
  };

  // envuelve cada escritura demo: guarda y avisa
  const demoApi = {};
  Object.keys(demoWriters).forEach((k) => {
    demoApi[k] = async (...args) => { await demoWriters[k](...args); demoSave(); changed(); };
  });

  /* =================== NUBE =================== */

  let auth = null, fs = null, hid = null, unsubs = [], gen = 0;
  let ratesMap = {};

  const col = (name) => fs.collection('hogares').doc(hid).collection(name);

  async function onAuth(u) {
    const my = ++gen;
    stop();
    user = u;
    if (!u) { state = 'anon'; role = mySid = hid = null; D = EMPTY_DATA(); return changed(); }
    state = 'loading'; changed();
    try {
      const owned = await fs.collection('hogares').where('ownerUid', '==', u.uid).limit(1).get();
      if (my !== gen) return;
      if (!owned.empty) { hid = owned.docs[0].id; role = 'admin'; mySid = null; return subscribe(); }
      const email = (u.email || '').toLowerCase();
      const inv = email ? await fs.doc('invitaciones/' + email).get() : null;
      if (my !== gen) return;
      if (inv && inv.exists) {
        hid = inv.data().hid; mySid = inv.data().staffId; role = 'collab';
        return subscribe();
      }
      state = 'noaccess'; changed();
    } catch (e) {
      if (my !== gen) return;
      console.error('[CasaFlow] acceso', e);
      state = 'error'; errorMsg = e.code === 'permission-denied'
        ? 'Firebase rechazó el acceso. ¿Ya están publicadas las reglas nuevas de Firestore?'
        : (e.message || String(e));
      changed();
    }
  }

  function stop() { unsubs.forEach((f) => f()); unsubs = []; ratesMap = {}; }

  function subscribe() {
    D = EMPTY_DATA();
    const got = { house: false, staff: false, months: false, blocks: false, bookings: false, extras: false, pagos: false, rates: role !== 'admin' };
    const ready = (k) => { got[k] = true; if (Object.values(got).every(Boolean)) state = 'ready'; changed(); };
    const onErr = (e) => {
      console.error('[CasaFlow] lectura', e);
      state = 'error';
      errorMsg = e.code === 'permission-denied'
        ? 'No se pudieron leer los datos: falta publicar las reglas nuevas de Firestore.'
        : 'No se pudieron leer los datos (' + (e.code || e.message) + ').';
      changed();
    };
    const listen = (q, fn, k) => unsubs.push(q.onSnapshot((snap) => { fn(snap); ready(k); }, onErr));

    unsubs.push(fs.collection('hogares').doc(hid).onSnapshot((doc) => {
      const d = doc.data() || {};
      D.house = { name: d.name || 'Mi casa', ownerName: d.ownerName || 'Administración' };
      ready('house');
    }, onErr));

    const toStaff = (doc) => ({ id: doc.id, ...doc.data(), rates: ratesMap[doc.id] || [] });
    if (role === 'admin') {
      listen(col('equipo'), (snap) => { D.staff = snap.docs.map(toStaff); }, 'staff');
      listen(col('tarifas'), (snap) => {
        ratesMap = {};
        snap.docs.forEach((d) => { ratesMap[d.id] = d.data().rates || []; });
        D.staff.forEach((s) => { s.rates = ratesMap[s.id] || []; });
      }, 'rates');
    } else {
      unsubs.push(col('equipo').doc(mySid).onSnapshot((doc) => {
        D.staff = doc.exists ? [toStaff(doc)] : [];
        ready('staff');
      }, onErr));
    }
    listen(col('meses'), (snap) => { D.months = {}; snap.docs.forEach((d) => { D.months[d.id] = d.data(); }); }, 'months');
    listen(col('bloques'), (snap) => { D.blocks = {}; snap.docs.forEach((d) => { D.blocks[d.id] = d.data(); }); }, 'blocks');
    listen(col('reservas'), (snap) => {
      D.bookings = snap.docs.map((d) => {
        const x = d.data();
        return { id: d.id, date: x.date, b: x.b, role: x.role, sid: x.staffId, month: x.month, att: x.att || null };
      });
    }, 'bookings');
    const mineQ = (q) => (role === 'admin' ? q : q.where('staffId', '==', mySid));
    listen(mineQ(col('extras')), (snap) => {
      D.extras = snap.docs.map((d) => { const x = d.data(); return { id: d.id, ...x, sid: x.staffId }; });
    }, 'extras');
    listen(mineQ(col('pagos')), (snap) => { D.pagos = {}; snap.docs.forEach((d) => { D.pagos[d.id] = d.data(); }); }, 'pagos');
  }

  const toDoc = (bk) => ({
    date: bk.date, b: bk.b, role: bk.role, staffId: bk.sid, month: ymOf(bk.date),
    startAt: firebase.firestore.Timestamp.fromDate(blockStart(bk.date, bk.b)),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });

  const cloudApi = {
    saveHouse: (p) => fs.collection('hogares').doc(hid).set(p, { merge: true }),
    async saveStaff(m, prevEmail) {
      const batch = fs.batch();
      batch.set(col('equipo').doc(m.id), {
        name: m.name, color: m.color, email: m.email || '', active: m.active !== false,
        rank: m.rank || 99, min: m.min || 0, max: m.max || 0, canTit: !!m.canTit, canSh: !!m.canSh,
        createdAt: m.createdAt || new Date().toISOString(),
      });
      const mineInvite = async (email) => {
        const old = await fs.doc('invitaciones/' + email).get().catch(() => null);
        return old && old.exists && old.data().ownerUid === user.uid ? old.ref : null;
      };
      if (prevEmail && prevEmail !== m.email) { const r = await mineInvite(prevEmail); if (r) batch.delete(r); }
      if (m.email) {
        if (m.active !== false) batch.set(fs.doc('invitaciones/' + m.email), { hid, staffId: m.id, ownerUid: user.uid, name: m.name });
        else { const r = await mineInvite(m.email); if (r) batch.delete(r); }
      }
      try { await batch.commit(); }
      catch (e) {
        if (e.code === 'permission-denied' && m.email) throw Object.assign(new Error(`El mail ${m.email} ya está vinculado a otra casa.`), { code: 'email' });
        throw e;
      }
    },
    saveRates: (sid, rates) => col('tarifas').doc(sid).set({ rates }),
    saveMonth: (ym, p) => col('meses').doc(ym).set(p, { merge: true }),
    saveBlock: (key, p) => col('bloques').doc(key).set(p, { merge: true }),
    async addBooking(bk) {
      try { await col('reservas').doc(bk.id).set(toDoc(bk)); }
      catch (e) { if (e.code === 'permission-denied') throw Object.assign(new Error('No se pudo reservar'), { code: 'taken' }); throw e; }
    },
    removeBooking: (id) => col('reservas').doc(id).delete(),
    async moveBooking(oldId, bk) {
      const batch = fs.batch();
      batch.delete(col('reservas').doc(oldId));
      batch.set(col('reservas').doc(bk.id), toDoc(bk));
      try { await batch.commit(); }
      catch (e) { if (e.code === 'permission-denied') throw Object.assign(new Error('No se pudo cambiar'), { code: 'taken' }); throw e; }
    },
    setAtt: (id, att) => col('reservas').doc(id).update({ att }),
    addExtra: (e) => col('extras').doc(e.id).set({
      date: e.date, b: e.b, staffId: e.sid, h: e.h, motivo: e.motivo, by: e.by, estado: e.estado,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    }),
    updateExtra: (id, p) => col('extras').doc(id).update(p),
    setPago: (key, data) => (data
      ? col('pagos').doc(key).set(data)
      : col('pagos').doc(key).delete()),
  };

  /* =================== interfaz pública =================== */

  async function init(cb) {
    onChange = cb;
    if (mode === 'demo') {
      demoLoad();
      state = 'ready';
      role = sessionStorage.getItem('casaflow2.demoRole') || 'admin';
      mySid = sessionStorage.getItem('casaflow2.demoSid') || 'li';
      return changed();
    }
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    fs = firebase.firestore();
    auth.getRedirectResult().catch((e) => { state = 'error'; errorMsg = e.message; changed(); });
    auth.onAuthStateChanged(onAuth);
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(provider); }
    catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') return auth.signInWithRedirect(provider);
      throw e;
    }
  }

  async function createHouse(name, ownerName) {
    const ref = await fs.collection('hogares').add({
      name: name || 'Mi casa', ownerName: ownerName || (user && user.displayName) || 'Administración',
      ownerUid: user.uid, ownerEmail: (user.email || '').toLowerCase(), createdAt: new Date().toISOString(),
    });
    hid = ref.id; role = 'admin'; mySid = null; state = 'loading'; changed();
    subscribe();
  }

  /* solo demo: cambiar de persona y reiniciar */
  function demoAs(r, sid) {
    role = r; mySid = sid || mySid;
    sessionStorage.setItem('casaflow2.demoRole', role);
    sessionStorage.setItem('casaflow2.demoSid', mySid);
    changed();
  }
  function demoReset() { localStorage.removeItem(DEMO_KEY); demoLoad(); changed(); }

  const api = mode === 'demo' ? demoApi : cloudApi;
  return {
    mode, init, signIn, createHouse, demoAs, demoReset, snapshotFor,
    signOut: () => (mode === 'demo' ? null : auth.signOut()),
    get state() { return state; },
    get role() { return role; },
    get mySid() { return mySid; },
    get user() { return user; },
    get error() { return errorMsg; },
    ...api,
  };
})();
