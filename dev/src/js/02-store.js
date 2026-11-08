/* ============ Store: database, factories, normalization, import/export ============ */
const STORE_KEY = typeof APP_MODE !== 'undefined' && APP_MODE === 'play' ? 'primeforge.play.v1' : 'primeforge.v1';
let DB = null;
let POOL = { own: [], opp: [], res: [], last: null, opRoll: null, scale: 0, oppScale: 0, staticDiff: null };

function blankDB() {
  return { app: 'primeforge', version: 1, settings: {}, chars: {}, gm: {}, log: [], net: { name: '', tables: {}, shareRolls: true, cfg: null, site: '', uid: '' }, ui: { tab: 'vault', theme: 'auto', dsec: 'identity', settingId: null, charId: null, cview: 'build' } };
}
function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    DB = raw ? JSON.parse(raw) : blankDB();
  } catch (e) { DB = blankDB(); }
  const b = blankDB();
  for (const k in b) if (DB[k] == null) DB[k] = b[k];
  for (const k in b.ui) if (DB.ui[k] == null) DB.ui[k] = b.ui[k];
  Object.values(DB.settings).forEach(normalizeSetting);
  Object.values(DB.chars).forEach(c => { const s = DB.settings[c.settingId]; if (s) normalizeChar(c, s); });
}
let saveFail = false;
const save = debounce(() => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); saveFail = false; if (typeof netAfterSave === 'function') netAfterSave(); }
  catch (e) { if (!saveFail) toast('Browser storage is full. Export a backup and remove portraits or old characters.', 'bad'); saveFail = true; }
}, 250);
function touch(o) { if (o) o.updated = now(); save(); }

/* ---------- factories ---------- */
function newSet(flavor) {
  const f = FLAVORS[flavor];
  return {
    id: uid('set_'), flavor, kind: f.kind, name: f.label, desc: '', prime: !!f.prime, traits: [],
    statements: false, sfx: flavor === 'sigassets' || flavor === 'distinctions', specialties: false, freeSpec: '',
    pyramid: false, split: false, create: clone(f.create)
  };
}
function newTrait(name = '') { return { id: uid('t_'), name, desc: '', sfx: [] }; }
function newSetting(name = 'Untitled setting') {
  const s = {
    id: uid('s_'), name, tagline: '', pitch: '', created: now(), updated: now(), lock: null,
    terms: clone(TERMS_DEFAULT), sets: [newSet('distinctions')], mods: {}, opt: {},
    dist: { rated: 'fixed', hinder: true, highlightSet: '', highlightCount: 2, library: [], libOnly: false },
    spec: { multiLevel: false, master: [] },
    stress: { tracks: [], shakenSet: '' },
    life: { a: '', best: [], flat: 0 },
    creation: { methods: { scratch: true, archetypes: false, pathways: false }, pool: 5, poolName: 'Creation points', sfxUnlocks: 2, stages: [] },
    lib: { powersets: [], abilities: [], talents: [], archetypes: [], sfx: [] },
    vehicle: { traits: [], die: 8 },
    growth: { training: clone(TRAINING_DEFAULT), unlocks: clone(UNLOCK_DEFAULT) },
    notes: ''
  };
  MODS.forEach(m => { s.mods[m.id] = !!(m.on || m.always); (m.opts || []).forEach(o => { if (o.def !== undefined) s.opt[o.k] = o.def; }); });
  return s;
}
function normalizeSetting(s) {
  const d = newSetting();
  ['terms', 'dist', 'spec', 'stress', 'life', 'creation', 'lib', 'vehicle', 'growth'].forEach(k => {
    if (!s[k] || typeof s[k] !== 'object') s[k] = d[k];
    else for (const kk in d[k]) if (s[k][kk] == null) s[k][kk] = d[k][kk];
  });
  s.mods = s.mods || {}; s.opt = s.opt || {};
  MODS.forEach(m => { if (s.mods[m.id] == null) s.mods[m.id] = !!(m.on || m.always); if (m.always) s.mods[m.id] = true; (m.opts || []).forEach(o => { if (s.opt[o.k] == null && o.def !== undefined) s.opt[o.k] = o.def; }); });
  s.sets = s.sets || [];
  if (!s.sets.some(x => x.kind === 'distinctions')) s.sets.unshift(newSet('distinctions'));
  s.sets.forEach(x => { x.traits = x.traits || []; x.traits.forEach(t => { t.sfx = t.sfx || []; }); x.create = Object.assign(clone(FLAVORS[x.flavor] ? FLAVORS[x.flavor].create : {}), x.create || {}); });
  s.creation.methods = Object.assign({ scratch: true, archetypes: false, pathways: false }, s.creation.methods);
  return s;
}
function newGM(s) {
  return { bank: 0, doom: [6, 6], crisis: [], gmcs: [], scene: { dists: [], temps: [] }, order: [], round: 1, timed: { beats: 4, used: 0, name: '' }, notes: '' };
}
function distSet(S) { return S.sets.find(x => x.kind === 'distinctions'); }
function T(S, k) { return (S && S.terms && S.terms[k]) || TERMS_DEFAULT[k]; }
function on(S, id) { return !!(S && S.mods && S.mods[id]); }

function defaultRating(S, set, i, method) {
  const cr = set.create || {};
  if (cr.mode === 'trade') {
    if (method === 'pathways' && S.creation.methods.pathways && isFirstOfMode(S, set, 'trade')) return cr.pathStart || 6;
    return i < (cr.baseCount || 3) ? (cr.baseline || 8) : (cr.extraBaseline || 6);
  }
  if (cr.mode === 'points') return cr.base || 4;
  if (cr.mode === 'array') return 0;
  if (cr.mode === 'peaks') return cr.fill || 6;
  return cr.startDie || 6;
}
function isFirstOfMode(S, set, mode) { const f = S.sets.find(x => x.kind === 'fixed' && x.create.mode === mode); return f && f.id === set.id; }

function newDistinction(name = '') { return { id: uid('d_'), name, desc: '', die: 8, hl: [], sfx: [], statement: '' }; }
function newSfx(name = '', text = '', unlocked = false) { return { id: uid('x_'), name, text, unlocked }; }
function newEntry(set) {
  const cr = set.create || {};
  const base = { id: uid('e_'), name: '', desc: '' };
  switch (set.kind) {
    case 'distinctions': return newDistinction();
    case 'open': return Object.assign(base, { die: cr.mode === 'peaks' ? (cr.fill || 6) : (cr.startDie || 6), statement: '', sfx: [] });
    case 'resources': return Object.assign(base, { type: 'prop', tags: ['', ''], die: 6, count: 2, spent: 0 });
    case 'powersets': return Object.assign(base, { origin: '', powers: [{ id: uid('p_'), name: '', die: 8 }], sfx: [], limits: [], shutdown: false });
    case 'abilities': return Object.assign(base, { die: 8, effect: 'Enhancement', descriptor: '', sfx: [] });
    case 'talents': return Object.assign(base, { activation: '', effect: '' });
  }
  return base;
}
function startPP(S) { const n = +S.opt.ppStart; return isNaN(n) ? 1 : n; }
function newChar(S) {
  const c = {
    id: uid('c_'), settingId: S.id, name: '', player: '', concept: '', desc: '', history: '', portrait: '', method: firstMethod(S), archetypeId: '',
    ratings: {}, base: {}, stmt: {}, specs: [], entries: {}, unlocks: {}, pp: startPP(S), hero: [], stress: {}, trauma: {},
    life: { dmg: 0, wounds: 0, stun: 0 }, temps: [], sessions: [], xp: { earned: 0, spent: 0, log: [] },
    milestones: [{ name: '', desc: '', x1: '', x3: '', x10: '' }, { name: '', desc: '', x1: '', x3: '', x10: '' }],
    growthPool: [], pathways: {}, vehicles: [], notes: '', shutdown: {}, created: now(), updated: now()
  };
  return normalizeChar(c, S);
}
function firstMethod(S) { const m = S.creation.methods; return m.scratch ? 'scratch' : m.archetypes ? 'archetype' : m.pathways ? 'pathways' : 'scratch'; }
function normalizeChar(c, S) {
  const d = { ratings: {}, base: {}, stmt: {}, specs: [], entries: {}, unlocks: {}, hero: [], stress: {}, trauma: {}, life: { dmg: 0, wounds: 0, stun: 0 }, temps: [], sessions: [], xp: { earned: 0, spent: 0, log: [] }, growthPool: [], pathways: {}, vehicles: [], shutdown: {} };
  for (const k in d) if (c[k] == null) c[k] = d[k];
  if (!c.milestones) c.milestones = [{ name: '', desc: '', x1: '', x3: '', x10: '' }, { name: '', desc: '', x1: '', x3: '', x10: '' }];
  S.sets.forEach(set => {
    if (set.kind === 'fixed') {
      c.ratings[set.id] = c.ratings[set.id] || {};
      set.traits.forEach((t, i) => { if (c.ratings[set.id][t.id] == null) c.ratings[set.id][t.id] = defaultRating(S, set, i, c.method); });
    } else {
      if (!Array.isArray(c.entries[set.id])) {
        c.entries[set.id] = [];
        if (set.kind === 'distinctions') for (let i = 0; i < (set.create.count || 3); i++) c.entries[set.id].push(newDistinction());
      }
    }
  });
  return c;
}
function charsOf(S) { return Object.values(DB.chars).filter(c => c.settingId === S.id).sort((a, b) => (a.name || '').localeCompare(b.name || '')); }
function traitRefs(S) { // all fixed-set traits as refs for pickers
  const out = [];
  S.sets.forEach(set => { if (set.kind === 'fixed') set.traits.forEach(t => out.push({ key: set.id + ':' + t.id, label: (t.name || 'Unnamed') + ' (' + set.name + ')', set, t })); });
  return out;
}
function ratingOfRef(S, c, key) {
  if (!key) return 0;
  const [sid, tid] = key.split(':');
  return +((c.ratings[sid] || {})[tid] || 0);
}

/* ---------- life points ---------- */
function lifeMax(S, c) {
  const a = ratingOfRef(S, c, S.life.a);
  const b = Math.max(0, ...(S.life.best || []).map(k => ratingOfRef(S, c, k)));
  return a + b + (+S.life.flat || 0);
}

/* ---------- import / export ---------- */
function envelope(type, data) { return JSON.stringify({ app: 'primeforge', type, version: 1, exported: now(), data }, null, 1); }
function exportBackup() { download('primeforge-backup-' + new Date().toISOString().slice(0, 10) + '.json', envelope('backup', { settings: DB.settings, chars: DB.chars, gm: DB.gm })); toast('Backup exported'); }
function exportSetting(S, asPack, pass) {
  const s = clone(S);
  delete s.table;
  if (asPack) s.lock = { hash: pass ? hashStr('pf:' + pass) : '', at: now() };
  download(slug(S.name) + (asPack ? '-player-pack' : '-setting') + '.json', envelope(asPack ? 'pack' : 'setting', { setting: s }));
  toast(asPack ? 'Player pack exported' : 'Setting exported');
}
function exportChar(c) {
  const S = DB.settings[c.settingId];
  download(slug(c.name || 'character') + '.json', envelope('character', { character: c, setting: S ? Object.assign(clone(S), S.lock ? {} : {}) : null }));
  toast('Character exported');
}
function importText(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { toast('That file isn\'t valid JSON.', 'bad'); return; }
  if (!o || o.app !== 'primeforge') { toast('That file wasn\'t made by Prime Forge.', 'bad'); return; }
  const d = o.data || {};
  if (o.type === 'backup') {
    confirmBox('Merge this backup into your vault? Settings and characters with the same ID will be replaced.', () => {
      Object.assign(DB.settings, d.settings || {}); Object.assign(DB.chars, d.chars || {}); Object.assign(DB.gm, d.gm || {});
      loadAfterImport(); toast('Backup merged');
    }, 'Merge');
  } else if (o.type === 'setting' || o.type === 'pack') {
    const s = d.setting; if (!s) return toast('No setting found in that file.', 'bad');
    const go = (replace) => {
      if (!replace && DB.settings[s.id]) { s.id = uid('s_'); s.name += ' (copy)'; }
      DB.settings[s.id] = normalizeSetting(s); DB.ui.settingId = s.id; DB.ui.tab = s.lock ? 'chars' : 'designer';
      loadAfterImport(); toast(s.lock ? 'Player pack imported. Make your character!' : 'Setting imported');
    };
    if (DB.settings[s.id]) {
      openModal('Setting already in your vault', `<p class="prose">You already have <b>${esc(DB.settings[s.id].name)}</b>. Replace it with the imported version, or keep both?</p>`,
        { actions: `<button class="btn ghost" id="impCopy">Keep both</button><button class="btn" id="impRep">Replace</button>` });
      $('#impCopy').onclick = () => { closeModal(); go(false); };
      $('#impRep').onclick = () => { closeModal(); go(true); };
    } else go(true);
  } else if (o.type === 'character') {
    const c = d.character; if (!c) return toast('No character found in that file.', 'bad');
    const finish = () => {
      if (DB.chars[c.id]) { /* replace same character */ }
      DB.chars[c.id] = c; const S = DB.settings[c.settingId]; if (S) normalizeChar(c, S);
      if (typeof netClaim === 'function') netClaim(c, S); else { delete c.table; delete c.owner; }
      DB.ui.settingId = c.settingId; DB.ui.charId = c.id; DB.ui.tab = 'chars'; DB.ui.cview = 'file';
      loadAfterImport(); toast('Character imported');
    };
    if (!DB.settings[c.settingId]) {
      if (d.setting) { DB.settings[d.setting.id] = normalizeSetting(d.setting); c.settingId = d.setting.id; finish(); toast('Its setting was added too'); }
      else toast('This character\'s setting isn\'t in your vault. Import the setting first.', 'bad');
    } else finish();
  } else toast('Unknown file type.', 'bad');
}
function loadAfterImport() { Object.values(DB.settings).forEach(normalizeSetting); Object.values(DB.chars).forEach(c => { const s = DB.settings[c.settingId]; if (s) normalizeChar(c, s); }); save(); render(); }
function isLocked(S) { return !!(S && S.lock); }
