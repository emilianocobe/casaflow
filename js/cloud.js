/* =========================================================
   CasaFlow · cloud.js
   Sincronización opcional con Firebase (Auth con Google +
   Firestore). Si no hay configuración en firebase-config.js,
   la app funciona 100% local como siempre.

   Modelo en Firestore:
     houses/{houseId}                 → nombre, dueño, calendario de pagos
     houses/{houseId}/staff/{id}      → nombre, color, email, activa
     houses/{houseId}/rates/{id}      → tarifas (solo dueño)
     houses/{houseId}/entries/{id}    → horas
     houses/{houseId}/payments/{id}   → pagos marcados
     invites/{email}                  → a qué casa y perfil pertenece un mail
   ========================================================= */

'use strict';

const Cloud = (() => {
  const cfg = window.CASAFLOW_FIREBASE || null;
  const demoMode = new URLSearchParams(location.search).has('demo');
  const enabled = !!cfg && !demoMode && typeof firebase !== 'undefined';

  let auth = null, fs = null;
  let state = 'init';          // init | anon | loading | noaccess | ready | error
  let user = null;
  let houseId = null, role = null, staffId = null;
  let unsubs = [];
  let rates = {};              // staffId -> rates[] (solo organizador/a)
  let errorMsg = '';
  let routeTimer = null;

  function scheduleRoute() {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(() => { if (typeof route === 'function') route(); }, 40);
  }

  function init() {
    if (!enabled) return false;
    firebase.initializeApp(cfg);
    auth = firebase.auth();
    fs = firebase.firestore();
    Store.mode = 'cloud';
    Object.assign(Store, writers);
    auth.onAuthStateChanged(onAuth);
    return true;
  }

  async function onAuth(u) {
    stopListeners();
    user = u;
    if (!u) {
      state = 'anon'; houseId = role = staffId = null;
      setDB(DEFAULT_DB()); scheduleRoute(); return;
    }
    state = 'loading'; scheduleRoute();
    try { await resolveRole(); }
    catch (e) { console.error('[CasaFlow] acceso', e); state = 'error'; errorMsg = e.message; scheduleRoute(); }
  }

  async function resolveRole() {
    const owned = await fs.collection('houses').where('ownerUid', '==', user.uid).limit(1).get();
    if (!owned.empty) {
      houseId = owned.docs[0].id; role = 'org'; staffId = null;
      subscribe(); return;
    }
    const email = (user.email || '').toLowerCase();
    const inv = email ? await fs.doc('invites/' + email).get() : null;
    if (inv && inv.exists) {
      houseId = inv.data().houseId; staffId = inv.data().staffId; role = 'collab';
      subscribe(); return;
    }
    state = 'noaccess'; houseId = role = staffId = null; scheduleRoute();
  }

  function subscribe() {
    setDB(DEFAULT_DB());
    const db = loadDB();
    const base = fs.collection('houses').doc(houseId);
    const got = { house: false, staff: false, entries: false, payments: false, rates: role !== 'org' };
    const check = () => {
      if (Object.values(got).every(Boolean)) state = 'ready';
      scheduleRoute();
    };

    unsubs.push(base.onSnapshot((snap) => {
      const d = snap.data() || {};
      db.settings.houseName = d.name || 'Mi casa';
      db.settings.ownerName = d.ownerName || 'Organizador/a';
      db.settings.paySchedule = normalizeSchedule(d.paySchedule);
      got.house = true; check();
    }, onErr));

    unsubs.push(base.collection('staff').onSnapshot((snap) => {
      db.staff = snap.docs.map((doc) => ({ id: doc.id, ...doc.data(), rates: rates[doc.id] || [] }));
      got.staff = true; check();
    }, onErr));

    if (role === 'org') {
      unsubs.push(base.collection('rates').onSnapshot((snap) => {
        rates = {};
        snap.docs.forEach((doc) => { rates[doc.id] = doc.data().rates || []; });
        db.staff.forEach((m) => { m.rates = rates[m.id] || []; });
        got.rates = true; check();
      }, onErr));
    }

    const entriesQ = role === 'org'
      ? base.collection('entries')
      : base.collection('entries').where('staffId', '==', staffId);
    unsubs.push(entriesQ.onSnapshot((snap) => {
      db.entries = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      got.entries = true; check();
    }, onErr));

    const payQ = role === 'org'
      ? base.collection('payments')
      : base.collection('payments').where('staffId', '==', staffId);
    unsubs.push(payQ.onSnapshot((snap) => {
      db.payments = snap.docs.map((doc) => doc.data());
      got.payments = true; check();
    }, onErr));
  }

  function onErr(e) {
    console.error('[CasaFlow] Firestore', e);
    state = 'error';
    errorMsg = 'No se pudieron leer los datos (' + (e.code || e.message) + ').';
    scheduleRoute();
  }

  function stopListeners() {
    unsubs.forEach((u) => u());
    unsubs = []; rates = {};
  }

  function writeErr(e) {
    console.error('[CasaFlow] escritura', e);
    if (typeof toast === 'function') toast('No se pudo guardar en la nube (' + (e.code || e.message) + ')', 'err');
  }

  /* Escrituras: reemplazan a los métodos de Store en modo nube */
  const writers = {
    putSettings(s) {
      return fs.doc('houses/' + houseId)
        .set({ name: s.houseName, ownerName: s.ownerName, paySchedule: s.paySchedule }, { merge: true })
        .catch(writeErr);
    },
    putStaff(m, prevEmail) {
      const batch = fs.batch();
      batch.set(fs.doc(`houses/${houseId}/staff/${m.id}`), {
        name: m.name, color: m.color, email: m.email || '',
        active: !!m.active, createdAt: m.createdAt || new Date().toISOString(),
      });
      if (prevEmail && prevEmail !== m.email) batch.delete(fs.doc('invites/' + prevEmail));
      if (m.email) {
        batch.set(fs.doc('invites/' + m.email), {
          houseId, staffId: m.id, ownerUid: user.uid, name: m.name,
        });
      }
      return batch.commit().catch(writeErr);
    },
    putRates(m) {
      return fs.doc(`houses/${houseId}/rates/${m.id}`).set({ rates: m.rates }).catch(writeErr);
    },
    putEntry(e) {
      return fs.doc(`houses/${houseId}/entries/${e.id}`).set({
        staffId: e.staffId, date: e.date, hours: e.hours,
        note: e.note || '', createdAt: e.createdAt, uid: user.uid,
      }).catch(writeErr);
    },
    removeEntry(id) {
      return fs.doc(`houses/${houseId}/entries/${id}`).delete().catch(writeErr);
    },
    putPayment(p) {
      return fs.doc(`houses/${houseId}/payments/${p.payday}_${p.staffId}`).set(p).catch(writeErr);
    },
    removePayment(payday, sid) {
      return fs.doc(`houses/${houseId}/payments/${payday}_${sid}`).delete().catch(writeErr);
    },
  };

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return;
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        await auth.signInWithRedirect(provider); return;
      }
      throw e;
    }
  }

  function signOut() { return auth.signOut(); }

  async function createHouse(name, ownerName) {
    const ref = await fs.collection('houses').add({
      name: name || 'Mi casa',
      ownerName: ownerName || user.displayName || 'Organizador/a',
      ownerUid: user.uid,
      ownerEmail: (user.email || '').toLowerCase(),
      paySchedule: DEFAULT_SCHEDULE(),
      createdAt: new Date().toISOString(),
    });
    houseId = ref.id; role = 'org'; staffId = null;
    state = 'loading'; scheduleRoute();
    subscribe();
  }

  function session() {
    if (state !== 'ready') return null;
    return role === 'org' ? { role: 'org' } : { role: 'collab', staffId };
  }

  return {
    enabled, init, signIn, signOut, createHouse, session,
    get state() { return state; },
    get user() { return user; },
    get role() { return role; },
    get error() { return errorMsg; },
  };
})();
