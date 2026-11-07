// Browser-side stand-in for the Firebase compat SDK (firebase.auth / firebase.firestore), talking to test/fake/server.js.
(function () {
  const URL_ = window.FAKE_FB_URL;
  const client = 'cl_' + Math.random().toString(36).slice(2);
  const err = e => { const x = new Error(e.message); x.code = e.code; return x; };
  async function call(o) {
    const r = await fetch(URL_ + '/op', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ client, uid: auth.currentUser && auth.currentUser.uid }, o)) });
    const j = await r.json(); if (j.error) throw err(j.error); return j;
  }
  const subs = new Map();
  let es = null;
  function ensureES() {
    if (es) return;
    es = new EventSource(URL_ + '/events?client=' + client);
    es.onmessage = ev => { const m = JSON.parse(ev.data); const s = subs.get(m.subId); if (s) s(m); };
  }
  let subSeq = 0;
  async function subscribe(sub, onMsg) {
    ensureES();
    await new Promise(r => { if (es.readyState === 1) r(); else es.addEventListener('open', r, { once: true }); });
    const id = 's' + (++subSeq); subs.set(id, onMsg);
    call({ op: 'sub', subId: id, sub }).catch(e => onMsg({ error: { code: e.code, message: e.message } }));
    return () => { subs.delete(id); call({ op: 'unsub', subId: id }).catch(() => { }); };
  }

  /* ---------- auth ---------- */
  const KEY = 'fakefb.auth';
  function mkUser(o) {
    if (!o) return null;
    const u = { uid: o.uid, isAnonymous: !o.email, email: o.email || null, providerData: o.email ? [{ providerId: 'google.com', email: o.email }] : [] };
    u.linkWithPopup = async () => { const r = await call({ op: 'link', email: window.FAKE_GOOGLE_EMAIL || 'gm@example.com' }).catch(e => { if (e.code === 'auth/credential-already-in-use') e.credential = { email: window.FAKE_GOOGLE_EMAIL || 'gm@example.com' }; throw e; }); setUser({ uid: r.uid, email: r.email }); return { user: auth.currentUser }; };
    return u;
  }
  const listeners = [];
  function setUser(o) { try { if (o) localStorage.setItem(KEY, JSON.stringify(o)); else localStorage.removeItem(KEY); } catch (e) { } auth.currentUser = mkUser(o); listeners.forEach(f => f(auth.currentUser)); }
  const auth = {
    currentUser: null,
    onAuthStateChanged(f) { listeners.push(f); setTimeout(() => f(auth.currentUser), 0); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },
    async signInAnonymously() { if (window.FAKE_AUTH_FAIL) { const e = new Error('Anonymous auth disabled'); e.code = 'auth/operation-not-allowed'; throw e; } const r = await call({ op: 'anon' }); setUser({ uid: r.uid }); return { user: auth.currentUser }; },
    async signInWithPopup() { const r = await call({ op: 'google', email: window.FAKE_GOOGLE_EMAIL || 'gm@example.com' }); setUser({ uid: r.uid, email: r.email }); return { user: auth.currentUser }; },
    async signInWithCredential(c) { const r = await call({ op: 'google', email: c.email }); setUser({ uid: r.uid, email: r.email }); return { user: auth.currentUser }; },
  };
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) auth.currentUser = mkUser(o); } catch (e) { }

  /* ---------- firestore ---------- */
  const DEL = { __del: true };
  function docSnap(path, d) {
    return { id: path.split('/').pop(), exists: !!d, data: () => d ? JSON.parse(JSON.stringify(d.data)) : undefined, ref: new DocRef(path), metadata: { hasPendingWrites: false, fromCache: false } };
  }
  function enc(v) { return JSON.parse(JSON.stringify(v, (k, x) => x === DEL ? { __del: true } : x)); }
  function checkData(o) { JSON.stringify(o, (k, v) => { if (v === undefined && k !== '') { const e = new Error('Function setDoc() called with invalid data. Unsupported field value: undefined (found in field ' + k + ')'); e.code = 'invalid-argument'; throw e; } return v; }); }
  class DocRef {
    constructor(path) { this.path = path; this.id = path.split('/').pop(); }
    collection(n) { return new Query(this.path + '/' + n); }
    async set(data, opts) { checkData(data); await call({ op: 'set', path: this.path, data: enc(data), merge: !!(opts && opts.merge) }); }
    async update(data) { checkData(data); await call({ op: 'update', path: this.path, data: enc(data) }); }
    async delete() { await call({ op: 'delete', path: this.path }); }
    async get() { const r = await call({ op: 'get', path: this.path }); return docSnap(this.path, r.doc); }
    onSnapshot(next, fail) {
      let un = null, dead = false;
      subscribe({ kind: 'doc', path: this.path }, m => { if (m.error) { fail && fail(err(m.error)); return; } next(docSnap(this.path, m.doc)); }).then(u => { if (dead) u(); else un = u; });
      return () => { dead = true; if (un) un(); };
    }
  }
  class Query {
    constructor(path, q) { this.path = path; this.q = q || { where: [] }; }
    doc(id) { return new DocRef(this.path + '/' + (id || Math.random().toString(36).slice(2, 12))); }
    where(f, op, v) { return new Query(this.path, Object.assign({}, this.q, { where: this.q.where.concat([[f, op, v]]) })); }
    orderBy(f, dir) { return new Query(this.path, Object.assign({}, this.q, { orderBy: [f, dir || 'asc'] })); }
    limit(n) { return new Query(this.path, Object.assign({}, this.q, { limit: n })); }
    async add(data) { checkData(data); const r = await call({ op: 'add', path: this.path, data: enc(data) }); return new DocRef(this.path + '/' + r.id); }
    snap(list, prev) {
      const docs = list.map(d => docSnap(this.path + '/' + d.id, d));
      const before = new Map((prev || []).map(d => [d.id, JSON.stringify(d.data)]));
      const after = new Set(list.map(d => d.id));
      const changes = [];
      list.forEach((d, i) => { if (!before.has(d.id)) changes.push({ type: 'added', doc: docs[i] }); else if (before.get(d.id) !== JSON.stringify(d.data)) changes.push({ type: 'modified', doc: docs[i] }); });
      (prev || []).forEach(d => { if (!after.has(d.id)) changes.push({ type: 'removed', doc: docSnap(this.path + '/' + d.id, d) }); });
      return { docs, size: docs.length, empty: !docs.length, forEach: f => docs.forEach(f), docChanges: () => changes };
    }
    async get() { const r = await call(Object.assign({ op: 'query', path: this.path }, this.q)); return this.snap(r.docs, []); }
    onSnapshot(next, fail) {
      let un = null, dead = false, prev = [];
      subscribe(Object.assign({ kind: 'query', path: this.path }, this.q), m => { if (m.error) { fail && fail(err(m.error)); return; } const s = this.snap(m.docs, prev); prev = m.docs; next(s); }).then(u => { if (dead) u(); else un = u; });
      return () => { dead = true; if (un) un(); };
    }
  }
  const fs = { collection: p => new Query(p), doc: p => new DocRef(p) };
  const apps = [];
  window.firebase = {
    apps,
    initializeApp(cfg) { const a = { options: cfg }; apps.push(a); return a; },
    app() { return apps[0]; },
    auth: Object.assign(() => auth, { GoogleAuthProvider: function () { } }),
    firestore: Object.assign(() => fs, { FieldValue: { delete: () => DEL, serverTimestamp: () => Date.now() } }),
  };
})();
