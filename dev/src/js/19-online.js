/* ============ Online tables: optional live sync through the GM's own free Firebase project ============
   Firestore layout (rules in firestore.rules):
     tables/{tid}            { gm, gmName, name, open, settingJson, settingUpdated, created, at }
     tables/{tid}/members/{uid}  { name, role, joined }
     tables/{tid}/chars/{cid}    { owner, ownerName, name, hidden, json, updated, by, at }
     tables/{tid}/rolls/{rid}    { by, who, name, text, at }
     users/{uid}             { tables: { tid: { role, name, at } } }   (lets a Google-linked account find its tables on any device)
   Locally a table is a normal setting + characters in DB, marked with S.table / c.table, so every view works unchanged.
   The table id is the invite: long and random, never listed. */
const FB_VER = '10.12.2';
const NET_SITE = 'https://nixxengs.github.io/prime-forge/';
const NET = { status: 'off', err: '', user: null, app: null, auth: null, db: null, subs: {}, members: {}, rolls: {}, rollInit: {}, meta: {}, seen: {}, sent: {}, loading: null, joining: null, pendingRender: false, errShown: {} };

function netState() {
  if (!DB.net || typeof DB.net !== 'object') DB.net = {};
  const d = { name: '', tables: {}, shareRolls: true, cfg: null, site: '', uid: '' };
  for (const k in d) if (DB.net[k] == null) DB.net[k] = d[k];
  return DB.net;
}
function netUid() { return (NET.user && NET.user.uid) || DB.net.uid || ''; }
function netT(x) { const tid = x && x.table; const T = tid && DB.net && DB.net.tables[tid]; return T && !T.gone ? T : null; }
function netCanWrite(c) { if (!c) return false; const T = netT(c); if (!T) return true; return T.role === 'gm' || c.owner === netUid(); }
function netReadOnly(c) { return !!c && !netCanWrite(c); }
function netActive() { return DB.net && Object.values(DB.net.tables).some(T => !T.gone); }
function netJsonS(S) { return JSON.stringify(Object.assign({}, S, { table: undefined, lock: undefined })); }
function netJsonC(c) { return JSON.stringify(Object.assign({}, c, { table: undefined })); }
function netId(n = 20) {
  const al = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const a = new Uint32Array(n); (window.crypto || window.msCrypto).getRandomValues(a);
  return Array.from(a, x => al[x % al.length]).join('');
}

/* ---------- configuration ---------- */
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
function b64u(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
function cfgToLink(c) { return b64u(JSON.stringify({ a: c.apiKey, d: c.authDomain, p: c.projectId, i: c.appId })); }
function cfgFromLink(s) { try { const o = JSON.parse(unb64u(s)); return o.a && o.p ? { apiKey: o.a, authDomain: o.d || o.p + '.firebaseapp.com', projectId: o.p, appId: o.i } : null; } catch (e) { return null; } }
function netSiteBase() { return /^https?:/.test(location.protocol) ? location.origin + location.pathname : (DB.net.site || NET_SITE); }
function netInvite(tid) { const c = netCfg(); return netSiteBase() + '#join=' + tid + (!netSiteCfg() && c ? '&cfg=' + cfgToLink(c) : ''); }

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = () => res(); s.onerror = () => { s.remove(); rej(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
}
async function netSiteConfig() {
  if (window.PF_FIREBASE !== undefined || !/^https?:/.test(location.protocol)) return;
  try { await loadScript('firebase-config.js'); } catch (e) { /* not hosted with a config file */ }
  if (window.PF_FIREBASE === undefined) window.PF_FIREBASE = null;
}
async function netLoadSdk() {
  if (window.firebase && firebase.firestore && firebase.auth) return;
  const files = ['firebase-app-compat.js', 'firebase-auth-compat.js', 'firebase-firestore-compat.js'];
  const bases = (/^https?:/.test(location.protocol) ? ['vendor/'] : []).concat(['https://www.gstatic.com/firebasejs/' + FB_VER + '/']);
  for (const b of bases) {
    try { for (const f of files) { if (f.includes('app-') && window.firebase) continue; await loadScript(b + f); } if (window.firebase && firebase.firestore && firebase.auth) return; } catch (e) { /* try the next source */ }
  }
  throw new Error('sdk');
}

/* ---------- connection ---------- */
function netFail(msg) { NET.status = 'error'; NET.err = msg; NET.loading = null; netRefresh(); return false; }
function authMsg(e) {
  const c = (e && e.code) || '';
  if (c.includes('operation-not-allowed') || c.includes('admin-restricted')) return 'Anonymous sign-in is turned off in your Firebase project. Turn it on under Authentication → Sign-in method.';
  if (c.includes('network')) return 'No connection to Firebase. Check your internet connection.';
  if (c.includes('api-key') || c.includes('invalid-api-key')) return 'The Firebase API key isn\'t valid. Paste your firebaseConfig again.';
  if (c.includes('unauthorized-domain')) return 'This site isn\'t an authorized domain in Firebase. Add it under Authentication → Settings → Authorized domains.';
  return (e && e.message) || 'Could not sign in.';
}
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
        if (!user) {
          try { await NET.auth.signInAnonymously(); } catch (e) { netFail(authMsg(e)); done(false); }
          return;
        }
        const changed = !!NET.user && NET.user.uid !== user.uid;
        NET.user = user; NET.status = 'online'; NET.err = '';
        if (first || changed) await netOnUser(changed);
        done(true); netRefresh();
      });
    });
  })();
  return NET.loading;
}
async function netOnUser(changed) {
  const me = NET.user.uid;
  if (changed) { Object.keys(NET.subs).forEach(netUnwatch); NET.seen = {}; NET.sent = {}; }
  DB.net.uid = me;
  try {
    const snap = await NET.db.collection('users').doc(me).get();
    const tabs = (snap.exists && snap.data().tables) || {};
    Object.entries(tabs).forEach(([tid, t]) => { if (!DB.net.tables[tid]) DB.net.tables[tid] = { role: t.role || 'player', settingId: null, name: t.name || 'Table', joined: now() }; });
  } catch (e) { /* the list is a convenience; the tables on this device still work */ }
  Object.entries(DB.net.tables).forEach(([tid, T]) => { if (!T.gone) netWatch(tid); });
  save();
}
function netUserDoc(tid, role, name) {
  if (!NET.db) return;
  NET.db.collection('users').doc(netUid()).set({ tables: { [tid]: { role, name: name || 'Table', at: Date.now() } } }, { merge: true }).catch(() => { });
}
function netUserDocDrop(tid) {
  if (!NET.db) return;
  NET.db.collection('users').doc(netUid()).update({ ['tables.' + tid]: firebase.firestore.FieldValue.delete() }).catch(() => { });
}

/* ---------- listeners ---------- */
function tableRef(tid) { return NET.db.collection('tables').doc(tid); }
function netWatch(tid) {
  if (NET.subs[tid] || !NET.db) return;
  const T = DB.net.tables[tid]; const ref = tableRef(tid); const u = [];
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
  NET.err = 'Lost touch with “' + (T.name || 'a table') + '”: ' + ((err && err.message) || 'unknown error'); netRefresh();
}
function netTableGone(tid, why) {
  const T = DB.net.tables[tid]; if (!T || T.gone) return;
  netUnwatch(tid); T.gone = why;
  toast(why === 'closed' ? `“${T.name}” was closed by the GM. Your copy stays in your vault.` : why === 'removed' ? `You're no longer at “${T.name}”. Your copy stays in your vault.` : `Firebase refused access to “${T.name}”. Check the security rules.`, 'bad');
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
  if (!NET.errShown[key]) { NET.errShown[key] = true; toast(`Couldn't save ${label} to the table: ${msg}`, 'bad'); setTimeout(() => delete NET.errShown[key], 15000); }
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
  tableRef(c.table).collection('chars').doc(c.id).delete().catch(e => toast('Couldn\'t remove it from the table: ' + (e.message || e), 'bad'));
  delete NET.seen['c:' + c.id]; delete NET.sent['c:' + c.id];
}
function netRender() {
  const a = document.activeElement;
  if (a && $('#view') && $('#view').contains(a) && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes(a.type)) || a.tagName === 'SELECT')) { NET.pendingRender = true; return; }
  netRenderSoon();
}
const netRenderSoon = debounce(() => { NET.pendingRender = false; render(); }, 120);
function netRefresh() { renderBar(); if (DB.ui.tab === 'online') netRender(); }
document.addEventListener('focusout', () => { if (NET.pendingRender) setTimeout(() => { if (NET.pendingRender) netRender(); }, 50); });

/* ---------- table life cycle ---------- */
async function netCreateTable(S, bring) {
  if (!(await netConnect())) return toast(NET.err || 'Not connected', 'bad');
  if (!DB.net.name.trim()) DB.net.name = 'GM';
  const tid = netId(20), me = netUid(), ref = tableRef(tid);
  S.lock = null; S.table = tid; touch(S);
  const j = netJsonS(S);
  try {
    await ref.set({ gm: me, gmName: DB.net.name, name: S.name || 'Untitled setting', open: true, settingJson: j, settingUpdated: S.updated || '', created: Date.now(), at: Date.now() });
    await ref.collection('members').doc(me).set({ name: DB.net.name, role: 'gm', joined: Date.now() });
  } catch (e) { delete S.table; save(); return toast('Couldn\'t open the table: ' + (e.code === 'permission-denied' ? 'Firebase refused it. Did you paste the security rules?' : e.message), 'bad'); }
  NET.seen['s:' + tid] = NET.sent['s:' + tid] = j;
  DB.net.tables[tid] = { role: 'gm', settingId: S.id, name: S.name, gmName: DB.net.name, joined: now() };
  netUserDoc(tid, 'gm', S.name);
  if (bring) charsOf(S).forEach(c => { c.table = tid; c.owner = me; c.ownerName = DB.net.name; c.hidden = false; });
  netWatch(tid); save(); render();
  toast('Your table is open. Copy the invite link for your players.');
}
async function netPeek(tid) {
  if (DB.net.tables[tid] && !DB.net.tables[tid].gone) { NET.joining = null; const T = DB.net.tables[tid]; if (T.settingId && DB.settings[T.settingId]) { DB.ui.settingId = T.settingId; DB.ui.tab = 'chars'; DB.ui.cview = 'list'; } render(); toast(`You're already at “${T.name}”.`); return; }
  try {
    const s = await tableRef(tid).get();
    NET.joining = s.exists ? { tid, meta: s.data() } : { tid, missing: true };
  } catch (e) { NET.joining = { tid, error: e.message || 'Could not read the table.' }; }
  render();
}
async function netJoin(tid, name) {
  name = (name || '').trim();
  if (!name) return toast('Add your name so the GM knows who joined.', 'bad');
  if (!(await netConnect())) return toast(NET.err || 'Not connected', 'bad');
  const ref = tableRef(tid);
  let snap; try { snap = await ref.get(); } catch (e) { return toast('Couldn\'t read that table: ' + e.message, 'bad'); }
  if (!snap.exists) return toast('That table is gone. Ask your GM for a new link.', 'bad');
  const d = snap.data(), me = netUid(), role = d.gm === me ? 'gm' : 'player';
  try { await ref.collection('members').doc(me).set({ name, role, joined: Date.now() }); }
  catch (e) { return toast(d.open === false ? 'Your GM has closed this table to new players.' : 'Couldn\'t join: ' + (e.message || e), 'bad'); }
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
function netForget(tid) {
  const T = DB.net.tables[tid]; if (!T) return;
  netUnwatch(tid);
  const S = DB.settings[T.settingId];
  if (S && S.table === tid) { delete S.table; if (T.role !== 'gm' && S.lock) S.lock.table = false; }
  Object.values(DB.chars).forEach(c => { if (c.table === tid) { delete c.table; delete c.owner; delete c.ownerName; delete c.hidden; } });
  Object.keys(NET.seen).concat(Object.keys(NET.sent)).forEach(k => { if (k === 's:' + tid) { delete NET.seen[k]; delete NET.sent[k]; } });
  delete DB.net.tables[tid]; delete NET.members[tid]; delete NET.rolls[tid]; delete NET.meta[tid];
  netUserDocDrop(tid); save(); render();
}
async function netLeave(tid) {
  const T = DB.net.tables[tid];
  if (!T.gone && NET.db) { try { await tableRef(tid).collection('members').doc(netUid()).delete(); } catch (e) { } }
  netForget(tid); toast('You left the table. Your copy stays in your vault.');
}
async function netClose(tid) {
  const ref = tableRef(tid); netUnwatch(tid);
  try {
    await ref.update({ closed: true, open: false, at: Date.now() });
    for (const sub of ['chars', 'rolls', 'members']) {
      const qs = await ref.collection(sub).get();
      await Promise.all(qs.docs.map(d => d.ref.delete()));
    }
    await ref.delete();
  } catch (e) { toast('Firebase didn\'t remove everything: ' + (e.message || e), 'bad'); }
  netForget(tid); toast('Table closed. The setting and characters stay in your vault.');
}

/* ---------- Google account (optional, keeps access across devices) ---------- */
function netGoogleEmail() { const u = NET.user; if (!u || u.isAnonymous) return ''; const p = (u.providerData || []).find(x => x && x.email); return u.email || (p && p.email) || 'Google account'; }
async function netLinkGoogle() {
  if (!(await netConnect())) return;
  const prov = new firebase.auth.GoogleAuthProvider();
  try { await NET.user.linkWithPopup(prov); NET.user = NET.auth.currentUser; toast('Google account linked. Sign in with it on any device to get your tables back.'); netRefresh(); }
  catch (e) {
    if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') {
      confirmBox('That Google account is already linked to other Prime Forge tables. Switch this device to it? Tables you joined as a guest on this device will need their invite link again.', async () => {
        try { if (e.credential) await NET.auth.signInWithCredential(e.credential); else await NET.auth.signInWithPopup(prov); toast('Switched accounts.'); } catch (e2) { toast(authMsg(e2), 'bad'); }
      }, 'Switch');
    } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') { /* nothing */ }
    else if (e.code === 'auth/operation-not-allowed') toast('Google sign-in is turned off in your Firebase project (Authentication → Sign-in method).', 'bad');
    else toast(authMsg(e), 'bad');
  }
}
async function netGoogleSignIn() {
  if (!(await netConnect())) return;
  try { await NET.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); toast('Signed in. Your tables are loading.'); }
  catch (e) { if (!/popup-closed|cancelled-popup/.test(e.code || '')) toast(authMsg(e), 'bad'); }
}

/* ---------- views ---------- */
function netBadge() {
  if (!DB.net || !netActive()) return '';
  const st = NET.status;
  const lab = st === 'online' ? 'Online' : st === 'connecting' ? 'Connecting…' : 'Offline';
  return `<button class="netpill ${st === 'online' ? 'on' : st === 'connecting' ? 'wait' : 'off'}" data-act="go" data-tab="online" title="Online tables">${lab}</button>`;
}
function netCharTag(c) {
  if (!netT(c)) return '';
  const mine = c.owner === netUid();
  return (mine ? '<span class="tag ok">Yours</span>' : `<span class="tag ink">${esc(c.ownerName ? 'Played by ' + c.ownerName : 'Another player')}</span>`) + (c.hidden ? ' <span class="tag">Hidden from players</span>' : '');
}
function netCharBanner(C) {
  if (!C || !netT(C)) return '';
  if (netReadOnly(C)) return `<div class="lockbanner"><div><b>${esc(C.name || 'This character')}</b> <span class="small">belongs to ${esc(C.ownerName || 'another player')}. You can look, but only they and the GM can change it.</span></div><button class="btn quiet small" data-act="dupChar">Make my own copy</button></div>`;
  if (C.hidden) return `<div class="lockbanner"><div><b>Hidden from players.</b> <span class="small">Only you can see this character at the table.</span></div><button class="btn quiet small" data-act="netHide" data-id="${C.id}" data-v="0">Show to players</button></div>`;
  return '';
}
function netLockBanner(S) {
  const T = netT(S); if (!T || T.role === 'gm') return '';
  return `<div class="lockbanner"><div><b>${esc(T.name || S.name)}</b> <span class="small">Online table run by ${esc(T.gmName || 'your GM')}. The rules are locked; changes your GM makes arrive by themselves, and your characters save to the table as you go.</span></div><button class="btn quiet small" data-act="go" data-tab="online">Table</button></div>`;
}
function netRollFeed(S) {
  const T = netT(S); if (!T) return '';
  const list = NET.rolls[S.table] || [];
  return `<section class="sec" style="margin-top:22px"><div class="sec-head"><h2>Table rolls</h2>
      <label class="check"><input type="checkbox" class="bubble" ${DB.net.shareRolls ? 'checked' : ''} data-bind="N.shareRolls" data-re><span class="small">Share my rolls with the table</span></label></div>
    <ul class="loglist">${list.map(r => `<li><span class="muted small">${new Date(r.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> <b class="k">${esc(r.who || 'Loose dice')}</b>${r.name && r.name !== r.who ? ` <span class="small muted">(${esc(r.name)})</span>` : ''} ${esc(r.text)}</li>`).join('') || '<li class="muted">No rolls at this table yet.</li>'}</ul></section>`;
}
VIEWS.online = () => {
  netState();
  const cfg = netCfg();
  const head = `<div class="pagehead"><div><h1>Play online</h1><p class="lede">Run a live table. Players open your invite link, build characters from your setting, and everyone's sheets and rolls stay in sync. No accounts needed for players.</p></div></div>`;
  if (!cfg) return head + netSetupPanel();
  const st = NET.status;
  const tables = Object.entries(DB.net.tables);
  const gmName = DB.net.name || '';
  const email = netGoogleEmail();
  const me = `<div class="panel"><div class="bar">You</div><div class="in stack">
      <label class="fld"><span>Your name at the table</span><input value="${esc(gmName)}" placeholder="What should others see?" data-bind="N.name"></label>
      <div class="row"><span class="netpill ${st === 'online' ? 'on' : st === 'connecting' ? 'wait' : 'off'}">${st === 'online' ? 'Online' : st === 'connecting' ? 'Connecting…' : st === 'error' ? 'Not connected' : 'Offline'}</span>
        ${st !== 'online' && st !== 'connecting' ? '<button class="btn small" data-act="netConnect">Connect</button>' : ''}
        <span class="small muted grow">${st === 'online' ? (email ? 'Signed in with ' + esc(email) + '.' : 'Guest on this device.') : ''}</span></div>
      ${NET.err ? `<p class="small" style="color:var(--crimson);margin:0">${esc(NET.err)}</p>` : ''}
      ${st === 'online' && !email ? `<div class="row"><button class="btn ghost small" data-act="netLinkGoogle">Link a Google account</button><span class="small muted grow">Optional. Keeps your tables if this browser's data is cleared or you switch devices.</span></div>` : ''}
      ${st === 'online' ? `<div class="row"><button class="btn quiet small" data-act="netGoogleSignIn">${email ? 'Switch Google account' : 'Already linked on another device? Sign in with Google'}</button></div>` : ''}
    </div></div>`;
  const join = NET.joining ? netJoinCard() : '';
  const list = tables.length ? tables.map(([tid, T]) => netTableCard(tid, T)).join('') : '<p class="small muted">You aren\'t at any online tables yet.</p>';
  const settings = Object.values(DB.settings).filter(s => !s.lock && !netT(s)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const start = `<div class="panel"><div class="bar">Start a table (GM)</div><div class="in stack">
      ${settings.length ? `<label class="fld"><span>Setting to share</span><select id="netPick" data-bind="N.pick">${settings.map(s => `<option value="${s.id}" ${s.id === netPickId(settings) ? 'selected' : ''}>${esc(s.name || 'Untitled')} (${plural(charsOf(s).length, 'character')})</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" class="bubble" id="netBring" data-bind="N.bring" ${DB.net.bring === false ? '' : 'checked'}><span>Bring my characters for it to the table</span></label>
      <div class="row"><button class="btn" data-act="netCreate" ${st === 'online' ? '' : 'disabled'}>Open table</button><span class="small muted grow">Players get a locked copy of the rules. Keep designing; they see your changes live.</span></div>`
      : '<p class="small muted">To run your own table, create a setting in your vault first.</p>'}
    </div></div>`;
  const byLink = `<div class="panel"><div class="bar">Join with a link</div><div class="in stack">
      <label class="fld"><span>Paste the invite link your GM sent</span><input id="netLink" placeholder="${esc(netSiteBase())}#join=…" value="${esc(DB.net.linkDraft || '')}" data-bind="N.linkDraft"></label>
      <div class="row"><button class="btn ghost" data-act="netJoinLink">Open invite</button></div></div></div>`;
  return head + `<div class="netgrid"><div class="stack">${join}<h2 style="margin:${NET.joining ? '18px' : '0'} 0 0">Your tables</h2>${list}</div><div class="stack">${me}${start}${byLink}
    ${netSiteCfg() ? '' : `<p class="small muted">Connected to Firebase project <b class="k">${esc(cfg.projectId)}</b>. <button class="linkbtn" data-act="netResetCfg">Change</button></p>`}</div></div>`;
};
function netPickId(list) { const ids = list.map(s => s.id); return ids.includes(DB.net.pick) ? DB.net.pick : curS() && ids.includes(curS().id) ? curS().id : ids[0]; }
function netSetupPanel() {
  return `<div class="panel" style="max-width:760px"><div class="bar">Connect your free Firebase project</div><div class="in stack">
    <p class="prose">Online play keeps the table in a Firebase project you own (the free Spark plan is plenty). Set it up once: create the project, turn on Anonymous sign-in, create a Firestore database, paste the security rules, then register a web app. The full steps are in <b>SETUP.md</b> next to this app.</p>
    <label class="fld"><span>Paste the <code>firebaseConfig</code> block from Firebase (Project settings → Your apps)</span><textarea id="netCfgTxt" rows="8" data-bind="N.cfgDraft" placeholder='const firebaseConfig = {\n  apiKey: "…",\n  authDomain: "…",\n  projectId: "…",\n  appId: "…"\n};'>${esc(DB.net.cfgDraft || '')}</textarea></label>
    ${/^https?:/.test(location.protocol) ? '' : `<label class="fld"><span>Where the app lives online (used for invite links)</span><input value="${esc(DB.net.site || NET_SITE)}" data-bind="N.site"></label>`}
    <div class="row"><button class="btn" data-act="netSaveCfg">Save and connect</button></div>
    <p class="small muted">These values identify your project; they aren't passwords. The security rules decide who can read and write.</p></div></div>`;
}
function netJoinCard() {
  const J = NET.joining;
  if (J.missing) return `<div class="card"><h3>That table is gone</h3><p class="small">The link may be old, or the GM closed the table. Ask them for a new invite.</p><button class="btn quiet small" data-act="netCancelJoin">Dismiss</button></div>`;
  if (J.error) return `<div class="card"><h3>Couldn't open the invite</h3><p class="small">${esc(J.error)}</p><div class="row"><button class="btn small" data-act="netRetryJoin">Try again</button><button class="btn quiet small" data-act="netCancelJoin">Dismiss</button></div></div>`;
  if (!J.meta) return `<div class="card"><h3>Opening the invite…</h3><p class="small muted">Connecting to the table.</p></div>`;
  return `<div class="card netjoin"><span class="tag">Invite</span><h3 style="margin:6px 0 2px">${esc(J.meta.name || 'A Cortex Prime table')}</h3><p class="small muted" style="margin:0 0 12px">Run by ${esc(J.meta.gmName || 'your GM')}</p>
    ${J.meta.open === false ? '<p class="small" style="color:var(--crimson)">The GM has closed this table to new players.</p>' : ''}
    <label class="fld"><span>Your name</span><input id="netJoinName" value="${esc(DB.net.name || '')}" placeholder="So the GM knows who joined" data-bind="N.name"></label>
    <div class="row" style="margin-top:10px"><button class="btn" data-act="netJoinGo">Join the table</button><button class="btn quiet" data-act="netCancelJoin">Not now</button></div></div>`;
}
function netTableCard(tid, T) {
  const S = DB.settings[T.settingId];
  const members = NET.members[tid] || [];
  const meta = NET.meta[tid] || {};
  const chars = S ? charsOf(S).filter(c => c.table === tid) : [];
  if (T.gone) return `<div class="card"><div class="row"><h3 class="grow" style="margin:0">${esc(T.name || 'Table')}</h3><span class="tag ink">${T.gone === 'closed' ? 'Closed by the GM' : T.gone === 'removed' ? 'You were removed' : 'No access'}</span></div>
    <p class="small muted">Your copy of the setting and characters stays in your vault.</p><button class="btn quiet small" data-act="netForget" data-tid="${tid}">Remove from this list</button></div>`;
  const gm = T.role === 'gm';
  return `<div class="card nettable"><div class="row"><h3 class="grow" style="margin:0">${esc(T.name || 'Table')}</h3><span class="tag ${gm ? '' : 'ink'}">${gm ? 'You run it' : 'Player'}</span></div>
    <p class="small muted" style="margin:4px 0 10px">${gm ? '' : 'Run by ' + esc(T.gmName || 'the GM') + ' · '}${plural(members.length, 'person', 'people')} · ${plural(chars.length, 'character')}${S ? '' : ' · loading…'}</p>
    ${gm ? `<label class="fld"><span>Invite link (send it to your players)</span><div class="row" style="flex-wrap:nowrap"><input readonly value="${esc(netInvite(tid))}" class="grow netinv" id="inv_${tid}"><button class="btn small" data-act="netCopy" data-tid="${tid}">Copy</button></div></label>
      <label class="check" style="margin-top:8px"><input type="checkbox" class="bubble" data-act-change="netOpen" data-tid="${tid}" ${meta.open === false ? '' : 'checked'}><span>Let new players join with the link</span></label>` : ''}
    ${members.length ? `<ul class="netmembers">${members.map(m => `<li><b>${esc(m.name || 'Someone')}</b>${m.role === 'gm' ? ' <span class="tag">GM</span>' : ''}${m.uid === netUid() ? ' <span class="small muted">(you)</span>' : ''}
      ${gm && m.uid !== netUid() ? `<button class="linkbtn small" data-act="netKick" data-tid="${tid}" data-uid="${m.uid}" data-name="${esc(m.name || '')}">Remove</button>` : ''}</li>`).join('')}</ul>` : ''}
    <div class="row" style="margin-top:10px">${S ? `<button class="btn small" data-act="openSetting" data-id="${S.id}" data-tab="chars">Characters</button>${gm ? `<button class="btn ghost small" data-act="openSetting" data-id="${S.id}" data-tab="designer">Design</button>` : ''}` : ''}
      <span class="grow"></span>${gm ? `<button class="btn quiet small" data-act="netCloseAsk" data-tid="${tid}">Close table</button>` : `<button class="btn quiet small" data-act="netLeaveAsk" data-tid="${tid}">Leave</button>`}</div></div>`;
}

/* ---------- actions ---------- */
A.netConnect = () => { netConnect(); };
A.netSaveCfg = () => {
  const c = parseCfg(DB.net.cfgDraft || '');
  if (!c) return toast('That doesn\'t look like a firebaseConfig block. It needs at least apiKey and projectId.', 'bad');
  DB.net.cfg = c; DB.net.cfgDraft = ''; save(); NET.status = 'off'; render(); netConnect().then(ok => { if (ok) toast('Connected to ' + c.projectId); });
};
A.netResetCfg = () => confirmBox('Disconnect from this Firebase project? Your online tables stop syncing on this device until you connect again.', () => { DB.net.cfg = null; save(); location.reload(); }, 'Disconnect');
A.netCreate = () => {
  const S = DB.settings[netPickId(Object.values(DB.settings).filter(s => !s.lock && !netT(s)))]; if (!S) return;
  const bring = DB.net.bring !== false;
  confirmBox(`Open an online table for “${S.name}”? Anyone with the invite link can join while joining is on.`, () => netCreateTable(S, bring), 'Open table');
};
A.netCopy = el => {
  const inp = $('#inv_' + el.dataset.tid); const txt = inp.value;
  const ok = () => toast('Invite link copied');
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, () => { inp.select(); document.execCommand('copy'); ok(); });
  else { inp.select(); document.execCommand('copy'); ok(); }
};
A.netOpen = el => { tableRef(el.dataset.tid).update({ open: el.checked }).then(() => toast(el.checked ? 'New players can join' : 'Joining closed. Players already at the table stay.')).catch(e => toast(e.message, 'bad')); };
A.netKick = el => confirmBox(`Remove ${el.dataset.name || 'this player'} from the table? Their characters stay; you can hand them to someone else.`, () => {
  tableRef(el.dataset.tid).collection('members').doc(el.dataset.uid).delete().then(() => toast('Removed')).catch(e => toast(e.message, 'bad'));
}, 'Remove');
A.netCloseAsk = el => confirmBox('Close this table for everyone? Players keep their own copies, but nothing syncs anymore. You keep the setting and all characters.', () => netClose(el.dataset.tid), 'Close table');
A.netLeaveAsk = el => confirmBox('Leave this table? You keep a copy of the setting and your characters, but they stop syncing.', () => netLeave(el.dataset.tid), 'Leave');
A.netForget = el => netForget(el.dataset.tid);
A.netJoinGo = () => netJoin(NET.joining.tid, DB.net.name);
A.netCancelJoin = () => { NET.joining = null; render(); };
A.netRetryJoin = () => { const t = NET.joining.tid; NET.joining = { tid: t }; render(); netConnect().then(ok => ok && netPeek(t)); };
A.netJoinLink = () => {
  const v = (DB.net.linkDraft || '').trim(); DB.net.linkDraft = '';
  const m = v.match(/join=([A-Za-z0-9]+)/) || v.match(/^([A-Za-z0-9]{12,})$/);
  if (!m) return toast('That isn\'t a Prime Forge invite link.', 'bad');
  const c = v.match(/cfg=([A-Za-z0-9_-]+)/);
  if (c && !netCfg()) { const cf = cfgFromLink(c[1]); if (cf) DB.net.cfg = cf; }
  NET.joining = { tid: m[1] }; render(); netConnect().then(ok => ok && netPeek(m[1]));
};
A.netLinkGoogle = () => netLinkGoogle();
A.netGoogleSignIn = () => netGoogleSignIn();
A.netHide = el => { const c = DB.chars[el.dataset.id]; if (!c) return; c.hidden = el.dataset.v === '1'; touch(c); closeModal(); render(); toast(c.hidden ? 'Hidden from players' : 'Players can see it now'); };
A.netHandAsk = () => {
  const C = curC(); const T = netT(C); if (!C || !T) return;
  const ms = NET.members[C.table] || [];
  closeModal();
  openModal('Hand to a player', `<p class="prose small">The player you pick can edit ${esc(C.name || 'this character')} from their own device. You can still edit it as GM.</p>
    <label class="fld"><span>Player</span><select id="handTo">${ms.map(m => `<option value="${m.uid}" ${m.uid === C.owner ? 'selected' : ''}>${esc(m.name || 'Someone')}${m.role === 'gm' ? ' (GM)' : ''}</option>`).join('')}</select></label>`,
    { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="handGo">Hand over</button>` });
  $('#handGo').onclick = () => { const m = ms.find(x => x.uid === $('#handTo').value); if (!m) return; C.owner = m.uid; C.ownerName = m.name || ''; if (m.role !== 'gm') { C.hidden = false; if (!C.player) C.player = m.name || ''; } touch(C); closeModal(); render(); toast(`${C.name || 'Character'} now belongs to ${m.name || 'them'}`); };
};

/* ---------- boot ---------- */
function netBoot() {
  netState();
  const h = location.hash || '';
  const m = h.match(/join=([A-Za-z0-9]+)/), c = h.match(/cfg=([A-Za-z0-9_-]+)/);
  if (m) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { } NET.joining = { tid: m[1] }; DB.ui.tab = 'online'; render(); }
  (async () => {
    await netSiteConfig();
    if (c && !netCfg()) { const cf = cfgFromLink(c[1]); if (cf) { DB.net.cfg = cf; save(); } }
    if (m) { if (await netConnect()) netPeek(m[1]); else render(); }
    else if (netActive()) netConnect();
    else if (DB.ui.tab === 'online') render();
  })();
}
