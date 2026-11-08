/* ============ Online campaigns: live sync through Firebase (shared by the GM app and the player app) ============
   Firestore layout (rules in firestore.rules):
     tables/{tid}                 { gm, gmName, name, open, closed, code, settingJson, settingUpdated, created, at }
     tables/{tid}/members/{uid}   { name, role, joined }
     tables/{tid}/chars/{cid}     { owner, ownerName, name, hidden, json, updated, by, at }
     tables/{tid}/rolls/{rid}     { by, who, name, text, at }
     codes/{CODE}                 { table, gm, name, at }      room code -> campaign; get only, never listed
     users/{uid}                  { name, tables: { tid: { role, name, at } } }   lets an account find its campaigns on any device
   Everyone signs in with Google or email + password. Locally a campaign is a normal setting + characters in DB,
   marked with S.table / c.table, so every view works unchanged. ("table" in code = "campaign" on screen.) */
const FB_VER = '10.12.2';
const NET_SITE = 'https://nixxengs.github.io/prime-forge/';
const NET_ROOT = APP_MODE === 'play' ? '../' : '';
const NET = { status: 'off', err: '', user: null, app: null, auth: null, db: null, subs: {}, members: {}, rolls: {}, rollInit: {}, meta: {}, seen: {}, sent: {}, loading: null, joining: null, pendingCode: '', pendingRender: false, errShown: {}, authMode: 'in', pw: '', busy: false };

function netState() {
  if (!DB.net || typeof DB.net !== 'object') DB.net = {};
  const d = { name: '', email: '', tables: {}, shareRolls: true, cfg: null, site: '', uid: '' };
  for (const k in d) if (DB.net[k] == null) DB.net[k] = d[k];
  return DB.net;
}
function netUid() { return (NET.user && NET.user.uid) || DB.net.uid || ''; }
function netT(x) { const tid = x && x.table; const T = tid && DB.net && DB.net.tables[tid]; return T && !T.gone ? T : null; }
function netCanWrite(c) { if (!c) return false; const T = netT(c); if (!T) return APP_MODE !== 'play'; return T.role === 'gm' || c.owner === netUid(); }
function netReadOnly(c) { return !!c && !netCanWrite(c); }
function netActive() { return DB.net && Object.values(DB.net.tables).some(T => !T.gone); }
function netJsonS(S) { return JSON.stringify(Object.assign({}, S, { table: undefined, lock: undefined })); }
function netJsonC(c) { return JSON.stringify(Object.assign({}, c, { table: undefined })); }
function netRand(n, al) {
  const a = new Uint32Array(n); (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a, x => al[x % al.length]).join('');
}
function netId(n = 20) { return netRand(n, 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'); }
const CODE_AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function netCodeNorm(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function netCodeFmt(c) { c = netCodeNorm(c); return c.length === 6 ? c.slice(0, 3) + '-' + c.slice(3) : c; }

/* ---------- configuration and loading ---------- */
function netCfg() { const w = window.PF_FIREBASE; return (w && w.apiKey && w.projectId ? w : null) || DB.net.cfg || null; }
function netSiteCfg() { const w = window.PF_FIREBASE; return !!(w && w.apiKey); }
function parseCfg(text) {
  const out = {};
  ['apiKey', 'authDomain', 'projectId', 'appId', 'storageBucket', 'messagingSenderId'].forEach(k => {
    const m = String(text || '').match(new RegExp(k + '["\']?\\s*:\\s*["\']([^"\']+)["\']'));
    if (m) out[k] = m[1].trim();
  });
  if (out.projectId && !out.authDomain) out.authDomain = out.projectId + '.firebaseapp.com';
  return out.apiKey && out.projectId ? out : null;
}
function netSiteRoot() {
  if (/^https?:/.test(location.protocol)) return location.origin + location.pathname.replace(/play\/(index\.html)?$/, '').replace(/[^/]*\.html$/, '');
  return DB.net.site || NET_SITE;
}
function netPlayLink(code) { return netSiteRoot() + 'play/' + (code ? '#code=' + netCodeNorm(code) : ''); }
function netGmLink() { return netSiteRoot(); }
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
}
async function netSiteConfig() {
  if (window.PF_FIREBASE !== undefined || !/^https?:/.test(location.protocol)) return;
  try { await loadScript(NET_ROOT + 'firebase-config.js'); } catch (e) { /* not hosted with a config file */ }
  if (window.PF_FIREBASE === undefined) window.PF_FIREBASE = null;
}
async function netLoadSdk() {
  if (window.firebase && firebase.firestore && firebase.auth) return;
  const files = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
  const bases = (/^https?:/.test(location.protocol) ? [NET_ROOT + 'vendor/'] : []).concat(['https://www.gstatic.com/firebasejs/' + FB_VER + '/']);
  for (const b of bases) {
    try { for (const f of files) { if (f.includes('app-') && window.firebase) continue; await loadScript(b + f); } if (window.firebase && firebase.firestore && firebase.auth) return; } catch (e) { /* try the next source */ }
  }
  throw new Error('sdk');
}

/* ---------- connection and accounts ---------- */
function netFail(msg) { NET.status = 'error'; NET.err = msg; NET.loading = null; netRefresh(); return false; }
function authMsg(e) {
  const c = (e && e.code) || '';
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'That email and password don\'t match an account.';
  if (c.includes('email-already-in-use')) return 'There\'s already an account with that email. Sign in instead.';
  if (c.includes('weak-password')) return 'Use a password of at least 6 characters.';
  if (c.includes('invalid-email') || c.includes('missing-email')) return 'That email address doesn\'t look right.';
  if (c.includes('missing-password')) return 'Type your password.';
  if (c.includes('too-many-requests')) return 'Too many tries. Wait a few minutes and try again.';
  if (c.includes('popup-blocked')) return 'Your browser blocked the Google window. Allow pop-ups for this site and try again.';
  if (c.includes('account-exists-with-different-credential')) return 'That email already signs in another way. Use the method you used before.';
  if (c.includes('operation-not-allowed') || c.includes('admin-restricted')) return 'That sign-in method is turned off in Firebase (Authentication → Sign-in method).';
  if (c.includes('unauthorized-domain')) return 'This site isn\'t an authorized domain in Firebase. Add it under Authentication → Settings → Authorized domains.';
  if (c.includes('network')) return 'No connection to Firebase. Check your internet connection.';
  if (c.includes('api-key')) return 'The Firebase API key isn\'t valid. Check the Firebase settings.';
  return (e && e.message) || 'Could not sign in.';
}
function netQuiet(e) { return /popup-closed-by-user|cancelled-popup-request|user-cancelled/.test((e && e.code) || ''); }
function netConnect() {
  if (NET.loading) return NET.loading;
  NET.loading = (async () => {
    const cfg = netCfg();
    if (!cfg) { NET.status = 'setup'; NET.loading = null; netRefresh(); return false; }
    NET.status = 'connecting'; NET.err = ''; netRefresh();
    try { await netLoadSdk(); } catch (e) { return netFail('Couldn\'t load the online service. Check your internet connection and try again.'); }
    try {
      NET.app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      NET.auth = firebase.auth(); NET.db = firebase.firestore();
    } catch (e) { return netFail('Those Firebase settings didn\'t work: ' + e.message); }
    return await new Promise(resolve => {
      let first = true;
      const done = v => { if (first) { first = false; resolve(v); } };
      NET.auth.onAuthStateChanged(async user => {
        if (user && user.isAnonymous) { try { await NET.auth.signOut(); } catch (e) { } return; }   // old guest sessions: ask for a real account
        if (!user) { const had = !!NET.user; NET.user = null; NET.status = 'signedout'; netSignedOut(had); done(true); render(); return; }
        const changed = !!DB.net.uid && DB.net.uid !== user.uid;
        NET.user = user; NET.status = 'online'; NET.err = ''; NET.pw = '';
        await netOnUser(changed);
        done(true); render();
      });
    });
  })();
  return NET.loading;
}
function netWipeLocal() {   // the player app keeps nothing that isn't the signed-in account's
  Object.keys(NET.subs).forEach(netUnwatch);
  DB.settings = {}; DB.chars = {}; DB.log = []; DB.net.tables = {}; DB.net.uid = '';
  DB.ui.settingId = null; DB.ui.charId = null; DB.ui.cview = 'list'; DB.ui.tab = 'home';
  NET.seen = {}; NET.sent = {}; NET.members = {}; NET.rolls = {}; NET.meta = {};
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { }   // right away, not on the usual delay
  save();
}
function netSignedOut(had) {
  Object.keys(NET.subs).forEach(netUnwatch);
  if (APP_MODE === 'play') { if (had || DB.net.uid) netWipeLocal(); }
  else save();
}
async function netOnUser(changed) {
  const u = NET.user, me = u.uid;
  if (changed) {
    Object.keys(NET.subs).forEach(netUnwatch); NET.seen = {}; NET.sent = {};
    if (APP_MODE === 'play') netWipeLocal();
    else Object.keys(DB.net.tables).forEach(tid => netForget(tid, true));   // those campaigns belong to the other account; local copies stay in the vault
  }
  DB.net.uid = me;
  let doc = {};
  try { const snap = await NET.db.collection('users').doc(me).get(); doc = (snap.exists && snap.data()) || {}; } catch (e) { /* the list is a convenience */ }
  if (doc.name) DB.net.name = doc.name;
  if (!DB.net.name) DB.net.name = (u.displayName || (u.email || '').split('@')[0] || '').slice(0, 40);
  const tabs = doc.tables || {};
  Object.entries(tabs).forEach(([tid, t]) => {
    const role = t.role || 'player';
    if (APP_MODE !== 'play' && role !== 'gm') return;   // the GM app only runs your own campaigns; you play the others in the player app
    if (!DB.net.tables[tid]) DB.net.tables[tid] = { role, settingId: null, name: t.name || 'Campaign', joined: now() };
  });
  if (!doc.name && DB.net.name) NET.db.collection('users').doc(me).set({ name: DB.net.name }, { merge: true }).catch(() => { });
  Object.entries(DB.net.tables).forEach(([tid, T]) => { if (!T.gone) netWatch(tid); });
  save();
  if (NET.pendingCode) { const c = NET.pendingCode; NET.pendingCode = ''; netCodeGo(c); }
}
async function netSignInGoogle() {
  if (!(await netConnect())) return;
  NET.busy = true; render();
  try { await NET.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
  catch (e) { if (!netQuiet(e)) toast(authMsg(e), 'bad'); }
  NET.busy = false; render();
}
async function netEmailGo() {
  if (!(await netConnect())) return;
  const email = (DB.net.email || '').trim(), pw = NET.pw || '', mode = NET.authMode;
  if (!email) return toast('Type your email address.', 'bad');
  NET.busy = true; render();
  try {
    if (mode === 'reset') { await NET.auth.sendPasswordResetEmail(email); NET.authMode = 'in'; toast('Check your email for a link to set a new password.'); }
    else if (mode === 'up') {
      const name = (DB.net.name || '').trim();
      if (!name) { NET.busy = false; render(); return toast('Add the name others will see at the table.', 'bad'); }
      const r = await NET.auth.createUserWithEmailAndPassword(email, pw);
      try { await r.user.updateProfile({ displayName: name }); } catch (e) { }
    } else await NET.auth.signInWithEmailAndPassword(email, pw);
  } catch (e) { toast(authMsg(e), 'bad'); }
  NET.busy = false; render();
}
async function netSignOut() { if (NET.auth) { try { await NET.auth.signOut(); } catch (e) { toast(authMsg(e), 'bad'); } } }
async function netSaveName() {
  const name = (DB.net.name || '').trim().slice(0, 40); if (!name || !NET.user) return;
  DB.net.name = name; save();
  try {
    await NET.db.collection('users').doc(netUid()).set({ name }, { merge: true });
    await Promise.all(Object.entries(DB.net.tables).filter(([, T]) => !T.gone).map(([tid]) => tableRef(tid).collection('members').doc(netUid()).update({ name })));
    toast('Name saved');
  } catch (e) { toast('Couldn\'t save your name: ' + (e.message || e), 'bad'); }
}
function netUserDoc(tid, role, name) {
  if (!NET.db) return;
  NET.db.collection('users').doc(netUid()).set({ tables: { [tid]: { role, name: name || 'Campaign', at: Date.now() } } }, { merge: true }).catch(() => { });
}
function netUserDocDrop(tid) {
  if (!NET.db || !NET.user) return;
  NET.db.collection('users').doc(netUid()).update({ ['tables.' + tid]: firebase.firestore.FieldValue.delete() }).catch(() => { });
}
function netEmail() { const u = NET.user; if (!u) return ''; const p = (u.providerData || []).find(x => x && x.email); return u.email || (p && p.email) || ''; }
function netProvider() { const u = NET.user; const p = u && (u.providerData || [])[0]; return p && p.providerId === 'google.com' ? 'Google' : 'email'; }

/* ---------- listeners ---------- */
function tableRef(tid) { return NET.db.collection('tables').doc(tid); }
function netWatch(tid) {
  if (NET.subs[tid] || !NET.db || !NET.user) return;
  const T = DB.net.tables[tid];
  if (APP_MODE === 'play' && T.role === 'gm') return;   // you run that one from the GM app
  const ref = tableRef(tid); const u = [];
  const fail = err => netTableErr(tid, err);
  u.push(ref.onSnapshot(s => netOnTable(tid, s), fail));
  const cq = T.role === 'gm' ? ref.collection('chars') : ref.collection('chars').where('hidden', '==', false);
  u.push(cq.onSnapshot(qs => netOnChars(tid, qs), fail));
  u.push(ref.collection('members').onSnapshot(qs => { NET.members[tid] = qs.docs.map(d => Object.assign({ uid: d.id }, d.data())).sort((a, b) => (a.joined || 0) - (b.joined || 0)); netRefresh(); }, fail));
  u.push(ref.collection('rolls').orderBy('at', 'desc').limit(30).onSnapshot(qs => netOnRolls(tid, qs), fail));
  NET.subs[tid] = u;
}
function netUnwatch(tid) { (NET.subs[tid] || []).forEach(f => { try { f(); } catch (e) { } }); delete NET.subs[tid]; delete NET.rollInit[tid]; }
function netTableErr(tid, err) {
  const T = DB.net.tables[tid]; if (!T) return;
  if (err && err.code === 'permission-denied') return netTableGone(tid, T.role === 'gm' ? 'denied' : 'removed');
  NET.err = 'Lost touch with “' + (T.name || 'a campaign') + '”: ' + ((err && err.message) || 'unknown error'); netRefresh();
}
function netTableGone(tid, why) {
  const T = DB.net.tables[tid]; if (!T || T.gone) return;
  netUnwatch(tid); T.gone = why;
  const keep = APP_MODE === 'play' ? '' : ' Your copy stays in your vault.';
  toast(why === 'closed' ? `“${T.name}” was closed by the GM.${keep}` : why === 'removed' ? `You're no longer in “${T.name}”.${keep}` : `Firebase refused access to “${T.name}”. Check the security rules.`, 'bad');
  save(); netRender();
}
function netOnTable(tid, snap) {
  const T = DB.net.tables[tid]; if (!T) return;
  if (!snap.exists) return netTableGone(tid, 'closed');
  const d = snap.data(); NET.meta[tid] = d;
  if (d.closed && d.gm !== netUid()) return netTableGone(tid, 'closed');
  T.name = d.name || T.name; T.gmName = d.gmName || '';
  const amGM = d.gm === netUid();
  if (amGM !== (T.role === 'gm')) { T.role = amGM ? 'gm' : 'player'; netUnwatch(tid); setTimeout(() => netWatch(tid), 0); }
  const key = 's:' + tid; let applied = false;
  if (d.settingJson && d.settingJson !== NET.seen[key]) {
    const local = DB.settings[T.settingId];
    const unsent = local && NET.sent[key] !== undefined && netJsonS(local) !== NET.sent[key];
    if (!(amGM && unsent && (local.updated || '') > (d.settingUpdated || ''))) {
      let s; try { s = JSON.parse(d.settingJson); } catch (e) { return; }
      if (T.settingId) s.id = T.settingId;
      s.table = tid; s.lock = amGM ? null : { hash: '', at: now(), table: true };
      DB.settings[s.id] = normalizeSetting(s); T.settingId = s.id;
      Object.values(DB.chars).forEach(c => { if (c.settingId === s.id) normalizeChar(c, DB.settings[s.id]); });
      NET.seen[key] = d.settingJson; NET.sent[key] = netJsonS(DB.settings[s.id]); applied = true;
    }
  }
  save();
  if (applied) netRender(); else netRefresh();
}
function netOnChars(tid, qs) {
  const T = DB.net.tables[tid]; if (!T) return;
  let changed = false;
  qs.docChanges().forEach(ch => {
    const id = ch.doc.id, key = 'c:' + id;
    if (ch.type === 'removed') {
      const c = DB.chars[id];
      if (c && c.table === tid) { delete DB.chars[id]; if (DB.ui.charId === id) { DB.ui.charId = null; DB.ui.cview = 'list'; } changed = true; }
      delete NET.seen[key]; delete NET.sent[key]; return;
    }
    const d = ch.doc.data();
    if (d.json === NET.seen[key]) return;
    const local = DB.chars[id];
    if (local && NET.sent[key] !== undefined && netJsonC(local) !== NET.sent[key] && (local.updated || '') > (d.updated || '')) return; // our newer edit goes out on the next scan
    let c; try { c = JSON.parse(d.json); } catch (e) { return; }
    c.id = id; c.table = tid; c.owner = d.owner; c.ownerName = d.ownerName || ''; c.hidden = !!d.hidden;
    const S = DB.settings[c.settingId] || DB.settings[T.settingId];
    if (S) { c.settingId = S.id; normalizeChar(c, S); }
    DB.chars[id] = c; NET.seen[key] = d.json; NET.sent[key] = netJsonC(c); changed = true;
  });
  if (changed) { save(); netRender(); }
}
function netOnRolls(tid, qs) {
  const list = qs.docs.map(d => Object.assign({ id: d.id }, d.data()));
  if (NET.rollInit[tid]) {
    qs.docChanges().forEach(ch => {
      if (ch.type !== 'added') return; const r = ch.doc.data();
      if (r.by !== netUid() && Date.now() - (r.at || 0) < 60000) toast(`${r.who || r.name || 'Someone'} ${r.text}`.slice(0, 160));
    });
  }
  NET.rollInit[tid] = true; NET.rolls[tid] = list;
  if (DB.ui.tab === 'dice' && curS() && curS().table === tid) netRender();
}

/* ---------- pushing local changes ---------- */
function netAfterSave() { if (NET.status === 'online' && netActive()) netScan(); }
function netWriteErr(e, key, label) {
  delete NET.sent[key];
  const msg = e && e.code === 'permission-denied' ? 'Firebase refused the change' : (e && e.message) || 'unknown error';
  if (!NET.errShown[key]) { NET.errShown[key] = true; toast(`Couldn't save ${label} to the campaign: ${msg}`, 'bad'); setTimeout(() => delete NET.errShown[key], 15000); }
}
const netScan = debounce(() => {
  if (NET.status !== 'online' || !NET.user || !NET.db) return;
  const me = NET.user.uid;
  Object.entries(DB.net.tables).forEach(([tid, T]) => {
    if (T.gone || !NET.subs[tid]) return;
    const ref = tableRef(tid);
    const S = DB.settings[T.settingId];
    if (T.role === 'gm' && S && S.table === tid) {
      const j = netJsonS(S), key = 's:' + tid;
      if (j !== NET.sent[key]) {
        if (j.length > 900000) return toast('This setting is too big to share online.', 'bad');
        NET.sent[key] = j; NET.seen[key] = j;
        ref.update({ settingJson: j, name: S.name || 'Untitled setting', settingUpdated: S.updated || '', at: Date.now() }).catch(e => netWriteErr(e, key, 'the setting'));
      }
    }
    Object.values(DB.chars).forEach(c => {
      if (c.table !== tid || !netCanWrite(c)) return;
      if (!c.owner) { c.owner = me; c.ownerName = DB.net.name || ''; }
      const j = netJsonC(c), key = 'c:' + c.id;
      if (j === NET.sent[key]) return;
      if (j.length > 900000) { if (!NET.errShown[key]) { NET.errShown[key] = true; toast(`${c.name || 'A character'} is too big to share. Try a smaller portrait.`, 'bad'); } return; }
      NET.sent[key] = j; NET.seen[key] = j;
      ref.collection('chars').doc(c.id).set({ owner: c.owner, ownerName: c.ownerName || '', name: c.name || '', hidden: !!c.hidden, json: j, updated: c.updated || '', by: me, at: Date.now() })
        .catch(e => netWriteErr(e, key, c.name || 'a character'));
    });
  });
}, 700);

/* hooks called from the rest of the app */
function netClaim(c, S) {
  delete c.table; delete c.owner; delete c.ownerName; delete c.hidden;
  const T = netT(S); if (!T) return c;
  c.table = S.table; c.owner = netUid(); c.ownerName = DB.net.name || ''; c.hidden = false;
  if (T.role !== 'gm' && !c.player) c.player = DB.net.name || '';
  return c;
}
function netRoll(entry) {
  const S = curS(); const T = netT(S);
  if (!T || !DB.net.shareRolls || NET.status !== 'online' || !NET.subs[S.table]) return;
  tableRef(S.table).collection('rolls').add({ by: netUid(), who: String(entry.who || '').slice(0, 80), name: (DB.net.name || '').slice(0, 60), text: String(entry.text || '').slice(0, 500), at: Date.now() })
    .catch(e => toast('Couldn\'t share that roll: ' + (e.message || e), 'bad'));
}
function netDeleteChar(c) {
  const T = netT(c);
  if (!T || !NET.db || !netCanWrite(c)) return;
  tableRef(c.table).collection('chars').doc(c.id).delete().catch(e => toast('Couldn\'t remove it from the campaign: ' + (e.message || e), 'bad'));
  delete NET.seen['c:' + c.id]; delete NET.sent['c:' + c.id];
}
function netRender() {
  const a = document.activeElement;
  if (a && $('#view') && $('#view').contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(a.type)) || a.tagName === 'SELECT')) { NET.pendingRender = true; return; }
  netRenderSoon();
}
const netRenderSoon = debounce(() => { NET.pendingRender = false; render(); }, 120);
function netRefresh() { renderBar(); if (APP_MODE === 'play' ? ['home', 'camp'].includes(DB.ui.tab) : DB.ui.tab === 'online') netRender(); }
document.addEventListener('focusout', () => { if (NET.pendingRender) setTimeout(() => { if (NET.pendingRender) netRender(); }, 50); });
document.addEventListener('input', e => { if (e.target && e.target.id === 'netPw') NET.pw = e.target.value; });

/* ---------- campaign life cycle ---------- */
async function netNewCode(tid, quiet) {
  const ref = tableRef(tid), me = netUid(), T = DB.net.tables[tid];
  const old = (NET.meta[tid] || {}).code;
  for (let i = 0; i < 6; i++) {
    const code = netRand(6, CODE_AL);
    try {
      const s = await NET.db.collection('codes').doc(code).get();
      if (s.exists) continue;
      await NET.db.collection('codes').doc(code).set({ table: tid, gm: me, name: (T && T.name) || 'Campaign', at: Date.now() });
      await ref.update({ code });
      if (old && old !== code) NET.db.collection('codes').doc(old).delete().catch(() => { });
      if (!quiet) toast('New room code: ' + netCodeFmt(code) + '. The old one no longer works.');
      return code;
    } catch (e) { if (!quiet) toast('Couldn\'t make a room code: ' + (e.message || e), 'bad'); return ''; }
  }
  return '';
}
async function netCreateTable(S, bring) {
  if (!(await netConnect()) || !NET.user) return toast(NET.err || 'Sign in first', 'bad');
  if (!DB.net.name.trim()) DB.net.name = 'GM';
  const tid = netId(20), me = netUid(), ref = tableRef(tid);
  S.lock = null; S.table = tid; touch(S);
  const j = netJsonS(S);
  try {
    await ref.set({ gm: me, gmName: DB.net.name, name: S.name || 'Untitled setting', open: true, settingJson: j, settingUpdated: S.updated || '', created: Date.now(), at: Date.now() });
    await ref.collection('members').doc(me).set({ name: DB.net.name, role: 'gm', joined: Date.now() });
  } catch (e) { delete S.table; save(); return toast('Couldn\'t open the campaign: ' + (e.code === 'permission-denied' ? 'Firebase refused it. Did you publish the security rules?' : e.message), 'bad'); }
  NET.seen['s:' + tid] = NET.sent['s:' + tid] = j;
  DB.net.tables[tid] = { role: 'gm', settingId: S.id, name: S.name, gmName: DB.net.name, joined: now() };
  netUserDoc(tid, 'gm', S.name);
  if (bring) charsOf(S).forEach(c => { c.table = tid; c.owner = me; c.ownerName = DB.net.name; c.hidden = false; });
  netWatch(tid); save(); render();
  const code = await netNewCode(tid, true);
  toast(code ? `Your campaign is online. Room code: ${netCodeFmt(code)}` : 'Your campaign is online.');
}
async function netCodeGo(raw) {
  const code = netCodeNorm(raw);
  if (code.length < 6) return toast('Room codes have 6 letters and numbers, like K7Q-M2X.', 'bad');
  if (!(await netConnect()) || !NET.user) { NET.pendingCode = code; return; }
  let s; try { s = await NET.db.collection('codes').doc(code).get(); } catch (e) { return toast('Couldn\'t check that code: ' + (e.message || e), 'bad'); }
  if (!s.exists) return toast('No campaign has that room code. Check it with your GM.', 'bad');
  DB.net.codeDraft = ''; save();
  netPeek(s.data().table);
}
function netOpenCampaign(tid) {
  const T = DB.net.tables[tid]; if (!T || !T.settingId || !DB.settings[T.settingId]) return toast('Still loading that campaign…');
  DB.ui.settingId = T.settingId; DB.ui.tab = 'chars'; DB.ui.cview = 'list'; DB.ui.charId = null; window.scrollTo(0, 0); render();
}
async function netPeek(tid) {
  if (DB.net.tables[tid] && !DB.net.tables[tid].gone) { NET.joining = null; toast(`You're already in “${DB.net.tables[tid].name}”.`); netOpenCampaign(tid); return; }
  NET.joining = { tid }; render();
  try {
    const s = await tableRef(tid).get();
    NET.joining = s.exists && !s.data().closed ? { tid, meta: s.data() } : { tid, missing: true };
  } catch (e) { NET.joining = { tid, error: e.message || 'Could not read the campaign.' }; }
  render();
}
async function netJoin(tid, name) {
  name = (name || '').trim();
  if (!name) return toast('Add your name so the GM knows who joined.', 'bad');
  if (!(await netConnect()) || !NET.user) return toast('Sign in first.', 'bad');
  const ref = tableRef(tid);
  let snap; try { snap = await ref.get(); } catch (e) { return toast('Couldn\'t read that campaign: ' + e.message, 'bad'); }
  if (!snap.exists) return toast('That campaign is gone. Ask your GM for a new code.', 'bad');
  const d = snap.data(), me = netUid(), role = d.gm === me ? 'gm' : 'player';
  try { await ref.collection('members').doc(me).set({ name, role, joined: Date.now() }); }
  catch (e) { return toast(d.open === false ? 'Your GM has closed this campaign to new players.' : 'Couldn\'t join: ' + (e.message || e), 'bad'); }
  DB.net.name = name;
  let sid; try { sid = JSON.parse(d.settingJson).id; } catch (e) { sid = uid('s_'); }
  delete NET.seen['s:' + tid];
  DB.net.tables[tid] = { role, settingId: sid, name: d.name, gmName: d.gmName || '', joined: now() };
  netUserDoc(tid, role, d.name);
  netOnTable(tid, snap);
  netWatch(tid);
  NET.joining = null;
  DB.ui.settingId = sid; DB.ui.tab = 'chars'; DB.ui.cview = 'list'; DB.ui.charId = null;
  save(); render(); toast(`You joined “${d.name}”. Make your character!`);
}
function netForget(tid, localOnly) {
  const T = DB.net.tables[tid]; if (!T) return;
  netUnwatch(tid);
  const S = DB.settings[T.settingId];
  if (APP_MODE === 'play') {   // no vault here: drop the campaign's data entirely
    if (S) delete DB.settings[S.id];
    Object.values(DB.chars).forEach(c => { if (c.table === tid) delete DB.chars[c.id]; });
    if (DB.ui.settingId === T.settingId) { DB.ui.settingId = null; DB.ui.charId = null; DB.ui.tab = 'home'; }
  } else {
    if (S && S.table === tid) { delete S.table; if (T.role !== 'gm' && S.lock) S.lock.table = false; }
    Object.values(DB.chars).forEach(c => { if (c.table === tid) { delete c.table; delete c.owner; delete c.ownerName; delete c.hidden; } });
  }
  delete NET.seen['s:' + tid]; delete NET.sent['s:' + tid];
  delete DB.net.tables[tid]; delete NET.members[tid]; delete NET.rolls[tid]; delete NET.meta[tid];
  if (!localOnly) netUserDocDrop(tid);
  save(); render();
}
async function netLeave(tid) {
  const T = DB.net.tables[tid];
  if (!T.gone && NET.db) { try { await tableRef(tid).collection('members').doc(netUid()).delete(); } catch (e) { } }
  netForget(tid); toast(APP_MODE === 'play' ? 'You left the campaign.' : 'You left the campaign. Your copy stays in your vault.');
}
async function netClose(tid) {
  const ref = tableRef(tid); netUnwatch(tid);
  const code = (NET.meta[tid] || {}).code;
  try {
    await ref.update({ closed: true, open: false, at: Date.now() });
    if (code) await NET.db.collection('codes').doc(code).delete();
    for (const sub of ['chars', 'rolls', 'members']) {
      const qs = await ref.collection(sub).get();
      await Promise.all(qs.docs.map(d => d.ref.delete()));
    }
    await ref.delete();
  } catch (e) { toast('Firebase didn\'t remove everything: ' + (e.message || e), 'bad'); }
  netForget(tid); toast('Campaign closed. The setting and characters stay in your vault.');
}

/* ---------- shared pieces of UI ---------- */
function netBadge() {
  if (!DB.net || (APP_MODE !== 'play' && !netActive())) return '';
  const st = NET.status;
  if (APP_MODE === 'play' && st !== 'online') return '';
  const lab = st === 'online' ? 'Online' : st === 'connecting' ? 'Connecting…' : 'Offline';
  return `<button class="netpill ${st === 'online' ? 'on' : st === 'connecting' ? 'wait' : 'off'}" data-act="go" data-tab="${APP_MODE === 'play' ? 'home' : 'online'}" title="Online campaigns">${lab}</button>`;
}
function netCharTag(c) {
  if (!netT(c)) return '';
  const mine = c.owner === netUid();
  return (mine ? '<span class="tag ok">Yours</span>' : `<span class="tag ink">${esc(c.ownerName ? 'Played by ' + c.ownerName : 'Another player')}</span>`) + (c.hidden ? ' <span class="tag">Hidden from players</span>' : '');
}
function netCharBanner(C) {
  if (!C || !netT(C)) return '';
  if (netReadOnly(C)) return `<div class="lockbanner"><div><b>${esc(C.name || 'This character')}</b> <span class="small">belongs to ${esc(C.ownerName || 'another player')}. You can look, but only they and the GM can change it.</span></div><button class="btn quiet small" data-act="dupChar">Make my own copy</button></div>`;
  if (C.hidden) return `<div class="lockbanner"><div><b>Hidden from players.</b> <span class="small">Only you can see this character in the campaign.</span></div><button class="btn quiet small" data-act="netHide" data-id="${C.id}" data-v="0">Show to players</button></div>`;
  return '';
}
function netLockBanner(S) {
  const T = netT(S); if (!T || T.role === 'gm') return '';
  if (APP_MODE === 'play') return '';
  return `<div class="lockbanner"><div><b>${esc(T.name || S.name)}</b> <span class="small">Online campaign run by ${esc(T.gmName || 'your GM')}. The rules are locked; your GM's changes arrive by themselves, and your characters save as you go.</span></div><button class="btn quiet small" data-act="go" data-tab="online">Campaign</button></div>`;
}
function netRollFeed(S) {
  const T = netT(S); if (!T) return '';
  const list = NET.rolls[S.table] || [];
  return `<section class="sec" style="margin-top:22px"><div class="sec-head"><h2>Campaign rolls</h2>
      <label class="check"><input type="checkbox" class="bubble" ${DB.net.shareRolls ? 'checked' : ''} data-bind="N.shareRolls" data-re><span class="small">Share my rolls</span></label></div>
    <ul class="loglist">${list.map(r => `<li><span class="muted small">${new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> <b class="k">${esc(r.who || 'Loose dice')}</b>${r.name && r.name !== r.who ? ` <span class="small muted">(${esc(r.name)})</span>` : ''} ${esc(r.text)}</li>`).join('') || '<li class="muted">No rolls in this campaign yet.</li>'}</ul></section>`;
}
/* sign-in box used by both apps */
function netAuthPanel(intro) {
  const m = NET.authMode, busy = NET.busy ? 'disabled' : '';
  const title = m === 'up' ? 'Create your account' : m === 'reset' ? 'Reset your password' : 'Sign in';
  return `<div class="authbox panel"><div class="bar">${title}</div><div class="in stack">
    ${intro ? `<p class="prose small" style="margin:0">${intro}</p>` : ''}
    ${m !== 'reset' ? `<button class="btn ghost big gbtn" data-act="netGoogle" ${busy}><span class="gmark" aria-hidden="true">G</span>Continue with Google</button>
    <div class="oror"><span>or use your email</span></div>` : ''}
    ${m === 'up' ? `<label class="fld"><span>Your name at the table</span><input value="${esc(DB.net.name || '')}" data-bind="N.name" autocomplete="nickname" placeholder="What others will see"></label>` : ''}
    <label class="fld"><span>Email</span><input type="email" value="${esc(DB.net.email || '')}" data-bind="N.email" autocomplete="email" placeholder="you@example.com"></label>
    ${m !== 'reset' ? `<label class="fld"><span>Password</span><input type="password" id="netPw" value="${esc(NET.pw)}" autocomplete="${m === 'up' ? 'new-password' : 'current-password'}" placeholder="${m === 'up' ? 'At least 6 characters' : ''}"></label>` : ''}
    <button class="btn big" data-act="netEmailGo" ${busy}>${m === 'up' ? 'Create account' : m === 'reset' ? 'Send reset link' : 'Sign in'}</button>
    <div class="row small" style="justify-content:space-between">
      ${m === 'in' ? '<button class="linkbtn" data-act="netAuthMode" data-m="up">New here? Create an account</button><button class="linkbtn" data-act="netAuthMode" data-m="reset">Forgot password?</button>'
      : '<button class="linkbtn" data-act="netAuthMode" data-m="in">I already have an account</button>'}
    </div>
    ${NET.err ? `<p class="small" style="color:var(--crimson);margin:0">${esc(NET.err)}</p>` : ''}
  </div></div>`;
}
function netAccountCard() {
  return `<div class="panel"><div class="bar">Your account</div><div class="in stack">
    <p class="small muted" style="margin:0">Signed in with ${netProvider() === 'Google' ? 'Google' : 'email'} as <b class="k">${esc(netEmail() || 'your account')}</b>. Sign in the same way on any device to get everything back.</p>
    <div class="row" style="align-items:flex-end;flex-wrap:nowrap"><label class="fld grow"><span>Your name at the table</span><input value="${esc(DB.net.name || '')}" data-bind="N.name" maxlength="40"></label><button class="btn ghost small" data-act="netSaveName">Save</button></div>
    <div class="row"><button class="btn quiet small" data-act="netSignOut">Sign out</button></div></div></div>`;
}
function netJoinCard() {
  const J = NET.joining;
  if (J.missing) return `<div class="card"><h3>That campaign is gone</h3><p class="small">The code may be old, or the GM closed the campaign. Ask them for a new code.</p><button class="btn quiet small" data-act="netCancelJoin">Dismiss</button></div>`;
  if (J.error) return `<div class="card"><h3>Couldn't open the campaign</h3><p class="small">${esc(J.error)}</p><div class="row"><button class="btn small" data-act="netRetryJoin">Try again</button><button class="btn quiet small" data-act="netCancelJoin">Dismiss</button></div></div>`;
  if (!J.meta) return `<div class="card"><h3>Finding the campaign…</h3><p class="small muted">One moment.</p></div>`;
  return `<div class="card netjoin"><span class="tag">Join</span><h3 style="margin:6px 0 2px">${esc(J.meta.name || 'A Cortex Prime campaign')}</h3><p class="small muted" style="margin:0 0 12px">Run by ${esc(J.meta.gmName || 'your GM')}</p>
    ${J.meta.open === false ? '<p class="small" style="color:var(--crimson)">The GM has closed this campaign to new players.</p>' : ''}
    <label class="fld"><span>Your name at the table</span><input id="netJoinName" value="${esc(DB.net.name || '')}" placeholder="So the GM knows who joined" data-bind="N.name"></label>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="netJoinGo">Join the campaign</button><button class="btn quiet" data-act="netCancelJoin">Not now</button></div></div>`;
}

/* ---------- GM app: Online tab ---------- */
VIEWS.online = () => {
  netState();
  const cfg = netCfg();
  const head = `<div class="pagehead"><div><h1>Online campaigns</h1><p class="lede">Put a setting online as a campaign. Players sign in to the player app, join with your room code, and build and play their characters there. Their sheets save to their account and show up here live.</p></div></div>`;
  if (!cfg) return head + netSetupPanel();
  const st = NET.status;
  if (st === 'off') setTimeout(() => netConnect(), 0);
  if (st === 'off' || st === 'connecting') return head + '<p class="muted">Connecting…</p>';
  if (st === 'error') return head + `<div class="panel" style="max-width:640px"><div class="bar">Not connected</div><div class="in stack"><p class="small" style="color:var(--crimson);margin:0">${esc(NET.err)}</p><div class="row"><button class="btn small" data-act="netConnect">Try again</button></div></div></div>`;
  if (!NET.user) return head + netAuthPanel('Sign in to run campaigns online. Use the same account on any device and your campaigns come with you.');
  const tables = Object.entries(DB.net.tables).filter(([, T]) => T.role === 'gm' || T.gone);
  const list = tables.length ? tables.map(([tid, T]) => netTableCard(tid, T)).join('') : '<p class="small muted">None yet. Start one from a setting.</p>';
  const settings = Object.values(DB.settings).filter(s => !s.lock && !netT(s)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const start = `<div class="panel"><div class="bar">Start a campaign</div><div class="in stack">
      ${settings.length ? `<label class="fld"><span>Setting</span><select id="netPick" data-bind="N.pick">${settings.map(s => `<option value="${s.id}" ${s.id === netPickId(settings) ? 'selected' : ''}>${esc(s.name || 'Untitled')} (${plural(charsOf(s).length, 'character')})</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" class="bubble" id="netBring" data-bind="N.bring" ${DB.net.bring === false ? '' : 'checked'}><span>Bring my characters for it</span></label>
      <div class="row"><button class="btn" data-act="netCreate">Put it online</button><span class="small muted grow">Players get a locked copy of the rules. Keep designing; they see your changes live.</span></div>`
      : '<p class="small muted">Create or unlock a setting in your vault first.</p>'}
    </div></div>`;
  const players = `<div class="panel"><div class="bar">Player app</div><div class="in stack"><p class="small" style="margin:0">Send players this link. They sign in, type your room code and they're in.</p>
      <div class="row" style="flex-wrap:nowrap"><input readonly value="${esc(netPlayLink())}" class="grow netinv" id="inv_play"><button class="btn small" data-act="netCopy" data-id="inv_play">Copy</button></div></div></div>`;
  return head + `<div class="netgrid"><div class="stack"><h2 style="margin:0">Your campaigns</h2>${list}</div><div class="stack">${netAccountCard()}${start}${players}
    ${netSiteCfg() ? '' : `<p class="small muted">Firebase project <b class="k">${esc(cfg.projectId)}</b>. <button class="linkbtn" data-act="netResetCfg">Change</button></p>`}</div></div>`;
};
function netPickId(list) { const ids = list.map(s => s.id); return ids.includes(DB.net.pick) ? DB.net.pick : curS() && ids.includes(curS().id) ? curS().id : ids[0]; }
function netSetupPanel() {
  return `<div class="panel" style="max-width:760px"><div class="bar">Connect your free Firebase project</div><div class="in stack">
    <p class="prose">Online campaigns live in a Firebase project you own (the free Spark plan is plenty). The steps are in <b>SETUP.md</b>: create the project, turn on Google and Email/Password sign-in, create a Firestore database, publish the security rules, and register a web app.</p>
    <label class="fld"><span>Paste the <code>firebaseConfig</code> block from Firebase (Project settings → Your apps)</span><textarea id="netCfgTxt" rows="8" data-bind="N.cfgDraft" placeholder='const firebaseConfig = {\n  apiKey: "…",\n  authDomain: "…",\n  projectId: "…",\n  appId: "…"\n};'>${esc(DB.net.cfgDraft || '')}</textarea></label>
    ${/^https?:/.test(location.protocol) ? '' : `<label class="fld"><span>Where the apps live online (for the player link)</span><input value="${esc(DB.net.site || NET_SITE)}" data-bind="N.site"></label>`}
    <div class="row"><button class="btn" data-act="netSaveCfg">Save and connect</button></div>
    <p class="small muted">These values identify your project; they aren't passwords. The security rules decide who can read and write.</p></div></div>`;
}
function netTableCard(tid, T) {
  const S = DB.settings[T.settingId];
  const members = NET.members[tid] || [];
  const meta = NET.meta[tid] || {};
  const chars = S ? charsOf(S).filter(c => c.table === tid) : [];
  if (T.gone) return `<div class="card"><div class="row"><h3 class="grow" style="margin:0">${esc(T.name || 'Campaign')}</h3><span class="tag ink">${T.gone === 'closed' ? 'Closed' : T.gone === 'removed' ? 'Removed' : 'No access'}</span></div>
    <p class="small muted">The local copy of the setting and characters stays in your vault.</p><button class="btn quiet small" data-act="netForget" data-tid="${tid}">Remove from this list</button></div>`;
  return `<div class="card nettable"><div class="row"><h3 class="grow" style="margin:0">${esc(T.name || 'Campaign')}</h3><span class="tag">You run it</span></div>
    <p class="small muted" style="margin:4px 0 10px">${plural(Math.max(members.length - 1, 0), 'player')} · ${plural(chars.length, 'character')}${S ? '' : ' · loading…'}</p>
    <div class="coderow"><div><div class="lbl">Room code</div><div class="codebig">${meta.code ? esc(netCodeFmt(meta.code)) : '<span class="muted small">none</span>'}</div></div>
      <div class="row" style="gap:6px">${meta.code ? `<button class="btn small" data-act="netCopy" data-text="${esc(netPlayLink(meta.code))}">Copy join link</button>` : ''}<button class="btn ghost small" data-act="netCodeNew" data-tid="${tid}">${meta.code ? 'New code' : 'Make a code'}</button></div></div>
    <label class="check" style="margin-top:8px"><input type="checkbox" class="bubble" data-act-change="netOpen" data-tid="${tid}" ${meta.open === false ? '' : 'checked'}><span>Let new players join with the code</span></label>
    ${members.length ? `<ul class="netmembers">${members.map(m => `<li><b>${esc(m.name || 'Someone')}</b>${m.role === 'gm' ? ' <span class="tag">GM</span>' : ''}${m.uid === netUid() ? ' <span class="small muted">(you)</span>' : ''}
      ${m.uid !== netUid() ? `<button class="linkbtn small" data-act="netKick" data-tid="${tid}" data-uid="${m.uid}" data-name="${esc(m.name || '')}">Remove</button>` : ''}</li>`).join('')}</ul>` : ''}
    <div class="row" style="margin-top:10px">${S ? `<button class="btn small" data-act="openSetting" data-id="${S.id}" data-tab="chars">Characters</button><button class="btn ghost small" data-act="openSetting" data-id="${S.id}" data-tab="designer">Design</button>` : ''}
      <span class="grow"></span><button class="btn quiet small" data-act="netCloseAsk" data-tid="${tid}">Close campaign</button></div></div>`;
}

/* ---------- actions ---------- */
A.netConnect = () => { NET.loading = null; netConnect(); };
A.netGoogle = () => netSignInGoogle();
A.netEmailGo = () => netEmailGo();
A.netAuthMode = el => { NET.authMode = el.dataset.m; NET.err = ''; render(); };
A.netSignOut = () => confirmBox('Sign out on this device?' + (APP_MODE === 'play' ? ' Your characters stay saved in your account.' : ''), () => netSignOut(), 'Sign out');
A.netSaveName = () => netSaveName();
A.netSaveCfg = () => {
  const c = parseCfg(DB.net.cfgDraft || '');
  if (!c) return toast('That doesn\'t look like a firebaseConfig block. It needs at least apiKey and projectId.', 'bad');
  DB.net.cfg = c; DB.net.cfgDraft = ''; save(); NET.status = 'off'; NET.loading = null; render(); netConnect().then(ok => { if (ok) toast('Connected to ' + c.projectId); });
};
A.netResetCfg = () => confirmBox('Disconnect from this Firebase project? Online campaigns stop syncing on this device until you connect again.', () => { DB.net.cfg = null; save(); location.reload(); }, 'Disconnect');
A.netCreate = () => {
  const S = DB.settings[netPickId(Object.values(DB.settings).filter(s => !s.lock && !netT(s)))]; if (!S) return;
  const bring = DB.net.bring !== false;
  confirmBox(`Put “${S.name}” online as a campaign? Anyone with the room code can join while joining is on.`, () => netCreateTable(S, bring), 'Put it online');
};
A.netCopy = el => {
  const txt = el.dataset.text || ($('#' + el.dataset.id) || {}).value || '';
  const ok = () => toast('Copied');
  const fallback = () => { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { } t.remove(); ok(); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
};
A.netCodeNew = el => netNewCode(el.dataset.tid);
A.netOpen = el => { tableRef(el.dataset.tid).update({ open: el.checked }).then(() => toast(el.checked ? 'New players can join' : 'Joining closed. Players already in stay.')).catch(e => toast(e.message, 'bad')); };
A.netKick = el => confirmBox(`Remove ${el.dataset.name || 'this player'} from the campaign? Their characters stay; you can hand them to someone else.`, () => {
  tableRef(el.dataset.tid).collection('members').doc(el.dataset.uid).delete().then(() => toast('Removed')).catch(e => toast(e.message, 'bad'));
}, 'Remove');
A.netCloseAsk = el => confirmBox('Close this campaign for everyone? Players lose access, and the room code stops working. You keep the setting and all characters in your vault.', () => netClose(el.dataset.tid), 'Close campaign');
A.netLeaveAsk = el => confirmBox('Leave this campaign? Your characters stay with the GM, but you won\'t see the campaign anymore.', () => netLeave(el.dataset.tid), 'Leave');
A.netForget = el => netForget(el.dataset.tid);
A.netJoinGo = () => netJoin(NET.joining.tid, DB.net.name);
A.netCancelJoin = () => { NET.joining = null; render(); };
A.netRetryJoin = () => { const t = NET.joining.tid; netPeek(t); };
A.netCodeGo = () => netCodeGo(DB.net.codeDraft || '');
A.netHide = el => { const c = DB.chars[el.dataset.id]; if (!c) return; c.hidden = el.dataset.v === '1'; touch(c); closeModal(); render(); toast(c.hidden ? 'Hidden from players' : 'Players can see it now'); };
A.netHandAsk = () => {
  const C = curC(); const T = netT(C); if (!C || !T) return;
  const ms = NET.members[C.table] || [];
  closeModal();
  openModal('Hand to a player', `<p class="prose small">The player you pick can edit ${esc(C.name || 'this character')} from their own account. You can still edit it as GM.</p>
    <label class="fld"><span>Player</span><select id="handTo">${ms.map(m => `<option value="${m.uid}" ${m.uid === C.owner ? 'selected' : ''}>${esc(m.name || 'Someone')}${m.role === 'gm' ? ' (GM)' : ''}</option>`).join('')}</select></label>`,
    { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="handGo">Hand over</button>` });
  $('#handGo').onclick = () => { const m = ms.find(x => x.uid === $('#handTo').value); if (!m) return; C.owner = m.uid; C.ownerName = m.name || ''; if (m.role !== 'gm') { C.hidden = false; if (!C.player) C.player = m.name || ''; } touch(C); closeModal(); render(); toast(`${C.name || 'Character'} now belongs to ${m.name || 'them'}`); };
};

/* ---------- boot ---------- */
function netBoot() {
  netState();
  if (APP_MODE === 'play') {
    const m = (location.hash || '').match(/code=([A-Za-z0-9-]+)/);
    if (m) { DB.net.codeDraft = netCodeNorm(m[1]); NET.pendingCode = DB.net.codeDraft; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } DB.ui.tab = 'home'; }
    render();
    (async () => { await netSiteConfig(); if (!netCfg()) { NET.status = 'setup'; render(); return; } await netConnect(); })();
    return;
  }
  (async () => { await netSiteConfig(); if (netActive()) netConnect(); else if (DB.ui.tab === 'online') render(); })();
}
