// Tiny stand-in for Firebase Auth + Firestore, for tests only. Mirrors the rules in firestore.rules.
const http = require('http');
const docs = new Map();            // path -> data
const clients = new Map();         // clientId -> { res, subs: Map(subId -> sub) }
const emails = new Map();          // google email -> uid
let seq = 0;
const nid = (p = '') => p + (++seq).toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const isDel = v => v && typeof v === 'object' && v.__del === true;

function parent(path) { return path.split('/').slice(0, -1).join('/'); }
function segs(path) { return path.split('/'); }
function denied() { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; return e; }

// ---- rules ----
function tableOf(path) { const s = segs(path); return s[0] === 'tables' ? docs.get('tables/' + s[1]) : null; }
function isGM(uid, path) { const t = tableOf(path); return !!(t && t.gm === uid); }
function isMember(uid, path) { const s = segs(path); return docs.has(`tables/${s[1]}/members/${uid}`) || isGM(uid, path); }
function allowRead(uid, path, data) {
  if (!uid) return false;
  const s = segs(path);
  if (s[0] === 'users') return s[1] === uid;
  if (s[0] !== 'tables') return false;
  if (s.length === 2) return true;               // get only (list is refused in query())
  const sub = s[2];
  if (sub === 'members' || sub === 'rolls') return isMember(uid, path);
  if (sub === 'chars') return isGM(uid, path) || (isMember(uid, path) && data && data.hidden === false);
  return false;
}
function allowWrite(uid, path, before, after) {
  if (!uid) return false;
  const s = segs(path);
  if (s[0] === 'users') return s[1] === uid;
  if (s[0] !== 'tables') return false;
  if (s.length === 2) {
    if (!before) return after && after.gm === uid;
    if (!after) return before.gm === uid;
    return before.gm === uid && after.gm === before.gm;
  }
  const sub = s[2], id = s[3];
  const gm = isGM(uid, path), mem = isMember(uid, path);
  if (sub === 'members') {
    if (!after) return id === uid || gm;
    if (!before) { const t = tableOf(path); return id === uid && !!t && (t.open !== false || gm); }
    return id === uid;
  }
  if (sub === 'chars') {
    if (!after) return gm || (before && before.owner === uid);
    if (!before) return mem && (gm || (after.owner === uid && after.hidden === false));
    return gm || (before.owner === uid && after.owner === uid && after.hidden === false);
  }
  if (sub === 'rolls') {
    if (!after) return gm;
    if (before) return false;
    return mem && after.by === uid && typeof after.text === 'string' && after.text.length <= 500;
  }
  return false;
}

// ---- data ops ----
function deepMerge(a, b) {
  const out = clone(a) || {};
  for (const k in b) {
    if (isDel(b[k])) delete out[k];
    else if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], b[k]);
    else out[k] = clone(b[k]);
  }
  return out;
}
function applyUpdate(a, b) {
  const out = clone(a);
  for (const k in b) {
    const parts = k.split('.'); let o = out;
    for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
    const last = parts[parts.length - 1];
    if (isDel(b[k])) delete o[last]; else o[last] = clone(b[k]);
  }
  return out;
}
function write(uid, path, after) {
  const before = docs.get(path);
  if (!allowWrite(uid, path, before, after)) throw denied();
  if (after) docs.set(path, after); else docs.delete(path);
  setImmediate(broadcast);
}
function query(uid, q) {
  const s = segs(q.path);
  if (s.length === 1 && s[0] === 'tables') throw denied();
  let out = [];
  for (const [p, d] of docs) if (parent(p) === q.path) out.push({ id: segs(p).pop(), path: p, data: d });
  for (const [f, op, v] of (q.where || [])) out = out.filter(x => op === '==' ? x.data[f] === v : true);
  for (const x of out) if (!allowRead(uid, x.path, x.data)) throw denied();
  if (!out.length && s[0] === 'tables' && !isMember(uid, q.path) && !isGM(uid, q.path)) throw denied();
  if (q.orderBy) { const [f, dir] = q.orderBy; out.sort((a, b) => ((a.data[f] > b.data[f]) - (a.data[f] < b.data[f])) * (dir === 'desc' ? -1 : 1)); }
  if (q.limit) out = out.slice(0, q.limit);
  return out.map(x => ({ id: x.id, data: x.data }));
}
function evalSub(sub) {
  try {
    if (sub.kind === 'doc') {
      const d = docs.get(sub.path);
      if (d && !allowRead(sub.uid, sub.path, d)) throw denied();
      if (!d && segs(sub.path)[0] === 'tables' && segs(sub.path).length > 2 && !isMember(sub.uid, sub.path)) throw denied();
      return { doc: d ? { id: segs(sub.path).pop(), data: d } : null };
    }
    return { docs: query(sub.uid, sub) };
  } catch (e) { return { error: { code: e.code || 'unknown', message: e.message } }; }
}
function push(c, msg) { c.res.write('data: ' + JSON.stringify(msg) + '\n\n'); }
function broadcast() {
  for (const c of clients.values()) for (const [id, sub] of c.subs) {
    const r = evalSub(sub); const j = JSON.stringify(r);
    if (j === sub.last) continue; sub.last = j;
    push(c, Object.assign({ subId: id }, r));
    if (r.error) c.subs.delete(id);
  }
}

function handle(o) {
  const uid = o.uid;
  switch (o.op) {
    case 'anon': return { uid: nid('u_') };
    case 'google': { if (!emails.has(o.email)) emails.set(o.email, nid('g_')); return { uid: emails.get(o.email), email: o.email }; }
    case 'link': { if (emails.has(o.email) && emails.get(o.email) !== uid) { const e = new Error('This credential is already associated with a different user account.'); e.code = 'auth/credential-already-in-use'; throw e; } emails.set(o.email, uid); return { uid, email: o.email }; }
    case 'get': { const d = docs.get(o.path); if (d && !allowRead(uid, o.path, d)) throw denied(); if (!d && !allowRead(uid, o.path, { hidden: false })) throw denied(); return { doc: d ? { id: segs(o.path).pop(), data: d } : null }; }
    case 'query': return { docs: query(uid, o) };
    case 'set': { const before = docs.get(o.path); write(uid, o.path, o.merge ? deepMerge(before, o.data) : deepMerge({}, o.data)); return {}; }
    case 'update': { const before = docs.get(o.path); if (!before) { const e = new Error('No document to update: ' + o.path); e.code = 'not-found'; throw e; } write(uid, o.path, applyUpdate(before, o.data)); return {}; }
    case 'delete': { if (!docs.has(o.path)) return {}; write(uid, o.path, null); return {}; }
    case 'add': { const id = nid('r_'); write(uid, o.path + '/' + id, deepMerge({}, o.data)); return { id }; }
    case 'sub': { const c = clients.get(o.client); if (!c) throw new Error('no client'); const sub = Object.assign({ uid }, o.sub); c.subs.set(o.subId, sub); const r = evalSub(sub); sub.last = JSON.stringify(r); setImmediate(() => { push(c, Object.assign({ subId: o.subId }, r)); if (r.error) c.subs.delete(o.subId); }); return {}; }
    case 'unsub': { const c = clients.get(o.client); if (c) c.subs.delete(o.subId); return {}; }
    case 'dump': return { docs: Object.fromEntries(docs) };
  }
  throw new Error('bad op ' + o.op);
}

const srv = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.url.startsWith('/events')) {
    const id = new URL(req.url, 'http://x').searchParams.get('client');
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(': hi\n\n');
    clients.set(id, { res, subs: new Map() });
    req.on('close', () => clients.delete(id));
    return;
  }
  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    let out, code = 200;
    try { out = handle(JSON.parse(body || '{}')); } catch (e) { code = 200; out = { error: { code: e.code || 'unknown', message: e.message } }; }
    res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
  });
});
srv.listen(+process.argv[2] || 0, '127.0.0.1', () => console.log('PORT ' + srv.address().port));
