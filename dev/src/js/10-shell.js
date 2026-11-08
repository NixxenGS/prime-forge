/* ============ Shell: rendering, routing, binding, actions ============ */
const A = {};          // click actions: data-act="name"
const LIVE = {};       // live regions: data-live="name"
const VIEWS = {};
let RO = false;        // read-only rendering flag

function curS() { return DB.settings[DB.ui.settingId] || null; }
function curC() { const c = DB.chars[DB.ui.charId]; return c && c.settingId === DB.ui.settingId ? c : null; }
function curG() { const s = curS(); if (!s) return null; if (!DB.gm[s.id]) DB.gm[s.id] = newGM(s); return DB.gm[s.id]; }
function rootObj(r) { return r === 'S' ? curS() : r === 'C' ? curC() : r === 'G' ? curG() : r === 'U' ? DB.ui : r === 'P' ? POOL : r === 'N' ? DB.net : null; }

function brandMark(size = 30) {
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><circle cx="20" cy="20" r="17.5" fill="none" stroke="var(--crimson)" stroke-width="1.6"/><circle cx="20" cy="20" r="12.5" fill="none" stroke="var(--line)" stroke-width="1"/><circle cx="34.3" cy="10" r="2.6" fill="var(--crimson)"/><polygon points="20,9.5 30.5,20 20,30.5 9.5,20" fill="var(--crimson)"/><text x="20" y="24" text-anchor="middle" font-size="10" font-family="Josefin Sans, sans-serif" font-weight="700" fill="var(--on-crimson)">8</text></svg>`;
}
function emblem(S, size = 46) {
  const h = parseInt(hashStr(S.name || S.id), 36);
  const d = DICE[h % 5];
  const ini = (S.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const ang = (h % 360) * Math.PI / 180;
  const x = 23 + 20 * Math.cos(ang), y = 23 + 20 * Math.sin(ang);
  return `<svg class="emblem" viewBox="0 0 46 46" width="${size}" height="${size}" aria-hidden="true"><circle cx="23" cy="23" r="20" fill="none" stroke="var(--crimson)" stroke-width="1.4"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="var(--crimson)"/><g transform="translate(9 9) scale(.875)"><g class="ds-on">${DIE_SHAPE[d]}</g></g><text x="23" y="${d === 4 ? 30 : 27.5}" text-anchor="middle" font-size="${ini.length > 1 ? 10.5 : 13}" font-family="Josefin Sans, sans-serif" font-weight="700" fill="var(--on-crimson)">${esc(ini)}</text></svg>`;
}

function applyTheme() {
  const t = DB.ui.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}
function effectiveDark() { const t = DB.ui.theme; if (t === 'dark') return true; if (t === 'light') return false; return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches; }

function tabsFor() {
  const S = curS(); const C = curC();
  if (APP_MODE === 'play') {
    const p = [{ id: 'home', label: 'Campaigns' }];
    if (S && netT(S) && (NET.user || NET.status === 'off' || NET.status === 'connecting')) p.push({ id: 'chars', label: 'Characters', n: charsOf(S).length || '' }, { id: 'dice', label: 'Dice room' }, { id: 'rules', label: 'Setting guide' }, { id: 'camp', label: 'Campaign' });
    return p;
  }
  const t = [{ id: 'vault', label: 'Vault' }];
  if (S) {
    if (!isLocked(S)) t.push({ id: 'designer', label: 'Designer' });
    t.push({ id: 'chars', label: 'Characters', n: charsOf(S).length || '' });
    t.push({ id: 'dice', label: netT(S) ? 'Dice room' : 'Dice' });
    if (!isLocked(S)) t.push({ id: 'gm', label: T(S, 'gm') + ' table' });
    t.push({ id: 'rules', label: isLocked(S) ? 'Setting guide' : 'Rules' });
  } else t.push({ id: 'dice', label: 'Dice' });
  t.push({ id: 'online', label: 'Online' });
  return t;
}
function renderBar() {
  const S = curS();
  const settings = Object.values(DB.settings).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const tabs = tabsFor();
  if (!tabs.some(t => t.id === DB.ui.tab)) DB.ui.tab = APP_MODE === 'play' ? 'home' : 'vault';
  const dark = effectiveDark();
  if (APP_MODE === 'play') return renderPlayBar(S, tabs, dark);
  $('#bar').innerHTML = `<div class="appbar-in">
    <button class="brand" data-act="go" data-tab="vault" aria-label="Prime Forge vault">${brandMark()}<b>PRIME<span>·</span>FORGE</b></button>
    ${settings.length ? `<label class="setswitch"><span class="sr" hidden>Setting</span><select data-act-change="pickSetting" aria-label="Current setting">
      ${S ? '' : '<option value="">Choose a setting…</option>'}
      ${settings.map(s => `<option value="${s.id}" ${S && S.id === s.id ? 'selected' : ''}>${esc(s.name || 'Untitled')}${s.table && DB.net.tables[s.table] && !DB.net.tables[s.table].gone ? ' (online)' : s.lock ? ' (player pack)' : ''}</option>`).join('')}
    </select></label>` : ''}
    <nav class="tabs" aria-label="Sections">${tabs.map(t => `<button class="tab" data-act="go" data-tab="${t.id}" ${DB.ui.tab === t.id ? 'aria-current="page"' : ''}>${esc(t.label)}${t.n ? `<span class="n">${t.n}</span>` : ''}</button>`).join('')}</nav>
    <div class="bar-right">${typeof netBadge === 'function' ? netAskPill() + netBadge() : ''}
      <button class="icon-btn" data-act="toggleTheme" title="Switch to ${dark ? 'Handbook (light)' : 'Neon (dark)'} theme" aria-label="Switch theme">${dark ? '☀' : '☾'}</button>
    </div></div>`;
}

let FRESH_ROLL = false;
let VIEW_RO = false;   // viewing another player's character at an online table
const RO_OK = new Set(['go', 'cview', 'charGo', 'openChar', 'print', 'closeModal', 'charMenu', 'expChar', 'dupChar', 'previewBlank', 'toggleTheme', 'openSetting']);
function render() {
  applyTheme();
  renderBar();
  const fe = document.activeElement;
  let fkey = null, fsel = null;
  if (fe && (fe.dataset.bind || fe.id) && $('#view').contains(fe)) { fkey = fe.dataset.bind ? `[data-bind="${CSS.escape(fe.dataset.bind)}"]` : '#' + CSS.escape(fe.id); try { fsel = [fe.selectionStart, fe.selectionEnd]; } catch (e) { } }
  const v = VIEWS[DB.ui.tab] || VIEWS.vault;
  RO = VIEW_RO = DB.ui.tab === 'chars' && (DB.ui.cview === 'build' || DB.ui.cview === 'file') && typeof netReadOnly === 'function' && netReadOnly(curC());
  $('#view').innerHTML = `<div class="wrap">${v()}</div>`;
  RO = false;
  if (fkey) { const el = $(fkey); if (el) { el.focus({ preventScroll: true }); try { if (fsel && fsel[0] != null) el.setSelectionRange(fsel[0], fsel[1]); } catch (e) { } } }
  renderTray();
  FRESH_ROLL = false;
  save();
}
function refreshLive() { $$('[data-live]').forEach(el => { const f = LIVE[el.dataset.live]; if (f) el.innerHTML = f(el); }); renderTray(); }

/* ---------- binding ---------- */
function parseVal(el) {
  const t = el.dataset.type;
  if (el.type === 'checkbox') return el.checked;
  const v = el.value;
  if (t === 'num') { const n = parseFloat(v); return isNaN(n) ? 0 : n; }
  if (t === 'lines') return v.split('\n').map(s => s.trim()).filter(Boolean);
  if (t === 'csv') return v.split(',').map(s => s.trim()).filter(Boolean);
  if (t === 'csvnum') return v.split(/[,\s]+/).map(s => parseInt(String(s).replace(/^d/i, ''), 10)).filter(n => DICE.includes(n));
  return v;
}
function onBind(e) {
  const el = e.target.closest('[data-bind]');
  if (!el) return;
  const discrete = el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio';
  if (e.type === 'input' && discrete) return;
  if (e.type === 'change' && !discrete) return;   // text already handled on input
  const [r, ...p] = el.dataset.bind.split('.');
  const root = rootObj(r); if (!root) return;
  setPath(root, p.join('.'), parseVal(el));
  if (r === 'S' || r === 'C') touch(root); else save();
  if (el.hasAttribute('data-re')) { if (discrete) render(); else debouncedRender(); }
  else refreshLive();
}
const debouncedRender = debounce(render, 450);

/* ---------- action dispatch ---------- */
function onClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const f = A[el.dataset.act];
  if (!f) return;
  if (el.tagName === 'A') e.preventDefault();
  if (VIEW_RO && el.closest('#view') && !RO_OK.has(el.dataset.act)) { toast('This character belongs to another player. You can look, but not change it.'); return; }
  f(el, e);
}
function onChangeAct(e) {
  const el = e.target.closest('[data-act-change]');
  if (!el) return;
  const f = A[el.dataset.actChange]; if (f) f(el, e);
}
A.closeModal = () => closeModal();
A.go = el => { DB.ui.tab = el.dataset.tab; if (el.dataset.sec) DB.ui.dsec = el.dataset.sec; if (el.dataset.cview) DB.ui.cview = el.dataset.cview; window.scrollTo(0, 0); render(); };
A.toggleTheme = () => { DB.ui.theme = effectiveDark() ? 'light' : 'dark'; save(); render(); };
A.pickSetting = el => { if (APP_MODE === 'play') { DB.ui.settingId = el.value || null; DB.ui.charId = null; DB.ui.cview = 'list'; DB.ui.tab = el.value ? 'chars' : 'home'; window.scrollTo(0, 0); return render(); }
  DB.ui.settingId = el.value || null; DB.ui.charId = null; DB.ui.cview = 'list'; if (DB.ui.tab === 'vault') DB.ui.tab = curS() && isLocked(curS()) ? 'chars' : 'designer'; render(); };

/* data-act helpers that mutate a path generically */
function rootAndPath(el) { const [r, ...p] = el.dataset.path.split('.'); return [rootObj(r), p.join('.'), r]; }
A.setVal = el => { const [root, p, r] = rootAndPath(el); let v = el.dataset.val; if (el.dataset.type === 'num') v = +v; if (v === 'true') v = true; if (v === 'false') v = false; setPath(root, p, v); if (r === 'S' || r === 'C') touch(root); render(); };
A.setDie = el => {
  const [root, p, r] = rootAndPath(el); const v = +el.dataset.die;
  const cur = +getPath(root, p) || 0;
  setPath(root, p, (el.dataset.toggle && cur === v) ? 0 : v);
  if (r === 'S' || r === 'C') touch(root);
  if (el.dataset.soft) refreshDiePick(el, root, p); else render();
};
function refreshDiePick(el, root, p) {
  const wrap = el.closest('.diepick'); if (!wrap) return render();
  const v = +getPath(root, p) || 0;
  $$('.dbtn', wrap).forEach(b => { const d = +b.dataset.die; const svg = b.querySelector('svg'); svg.classList.remove('ds-on', 'ds-off'); svg.classList.add(d === v ? 'ds-on' : 'ds-off'); b.setAttribute('aria-pressed', d === v); });
  const nb = wrap.querySelector('.none'); if (nb) nb.setAttribute('aria-pressed', !v);
  refreshLive();
}
A.pushItem = el => { const [root, p, r] = rootAndPath(el); const arr = getPath(root, p) || []; let item = el.dataset.item ? JSON.parse(el.dataset.item) : {}; if (item && typeof item === 'object' && !Array.isArray(item)) item = Object.assign({ id: uid('i_') }, item); arr.push(item); setPath(root, p, arr); if (r === 'S' || r === 'C') touch(root); render(); };
A.delItem = el => { const [root, p, r] = rootAndPath(el); const arr = getPath(root, p); const i = +el.dataset.i; const go = () => { arr.splice(i, 1); if (r === 'S' || r === 'C') touch(root); render(); }; if (el.dataset.confirm) confirmBox(el.dataset.confirm, go, 'Remove'); else go(); };
A.moveItem = el => { const [root, p, r] = rootAndPath(el); const arr = getPath(root, p); moveItem(arr, +el.dataset.i, +el.dataset.dir); if (r === 'S' || r === 'C') touch(root); render(); };
A.toggleVal = el => { const [root, p, r] = rootAndPath(el); setPath(root, p, !getPath(root, p)); if (r === 'S' || r === 'C') touch(root); render(); };
A.bump = el => { const [root, p, r] = rootAndPath(el); const v = (+getPath(root, p) || 0) + (+el.dataset.n); const min = el.dataset.min != null ? +el.dataset.min : -Infinity; setPath(root, p, Math.max(min, v)); if (r === 'S' || r === 'C') touch(root); render(); };

/* ---------- small components ---------- */
function dis() { return RO ? ' disabled' : ''; }
function bindAttr(path, extra = '') { return `data-bind="${esc(path)}"${extra ? ' ' + extra : ''}${dis()}`; }
function inp(path, val, { ph = '', cls = '', type = 'text', re = false, extra = '' } = {}) {
  return `<input type="${type}" class="${cls}" value="${esc(val == null ? '' : val)}" placeholder="${esc(ph)}" ${bindAttr(path)} ${type === 'number' ? 'data-type="num"' : ''} ${re ? 'data-re' : ''} ${extra}>`;
}
function area(path, val, { ph = '', rows = 2, re = false, cls = '' } = {}) { return `<textarea rows="${rows}" class="${cls}" placeholder="${esc(ph)}" ${bindAttr(path)} ${re ? 'data-re' : ''}>${esc(val || '')}</textarea>`; }
function sel(path, val, options, { re = true, num = false, extra = '' } = {}) {
  return `<select ${bindAttr(path)} ${re ? 'data-re' : ''} ${num ? 'data-type="num"' : ''} ${extra}>${options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
}
function chk(path, val, label, { re = true, cls = 'bubble' } = {}) { return `<label class="check"><input type="checkbox" class="${cls}" ${val ? 'checked' : ''} ${bindAttr(path)} ${re ? 'data-re' : ''}><span>${label}</span></label>`; }
function diePick(path, cur, { min = 4, max = 12, none = false, soft = true, toggle = false } = {}) {
  cur = +cur || 0;
  let h = `<span class="diepick" role="group" aria-label="Die rating">`;
  if (none) h += `<button class="none" data-act="setDie" data-path="${esc(path)}" data-die="0" ${soft ? 'data-soft="1"' : ''} aria-pressed="${!cur}"${dis()}>none</button>`;
  DICE.forEach(d => { if (d < min || d > max) return; h += `<button class="dbtn" data-act="setDie" data-path="${esc(path)}" data-die="${d}" ${soft ? 'data-soft="1"' : ''} ${toggle ? 'data-toggle="1"' : ''} aria-pressed="${cur === d}" aria-label="d${d}"${dis()}>${dieSvg(d, cur === d ? 'on' : 'off')}</button>`; });
  return h + '</span>';
}
function dieSelect(path, cur, { min = 4, max = 12, re = false } = {}) {
  return sel(path, cur, DICE.filter(d => d >= min && d <= max).map(d => [d, 'd' + d]), { re, num: true });
}
function refTag(r) { return r ? `<span class="ref">pg. ${esc(String(r).replace(/^p\./, ''))}</span>` : ''; }
function stateWord(st) { return st === 'ok' ? 'on target' : st === 'under' ? 'left to spend' : st === 'over' ? 'over budget' : ''; }

function renderTray() {
  const t = $('#tray');
  const S = curS();
  const show = (POOL.own.length || POOL.res.length) && DB.ui.tab !== 'dice';
  if (!show) { t.innerHTML = ''; t.hidden = true; return; }
  t.hidden = false;
  const C = curC() || DB.chars[POOL.charId];
  const cost = poolCost(POOL.own);
  t.innerHTML = `<div class="tray-in" role="region" aria-label="Dice pool">
    <span class="lab">Pool</span>
    <div class="chips">${POOL.own.map((it, i) => poolChip(it, i, 'own')).join('')}${POOL.res.map((it, i) => poolChip(it, i, 'res')).join('')}</div>
    ${cost ? `<span class="tag">+${cost} ${esc(T(S, 'ppAbbr'))}</span>` : ''}
    ${C ? `<span class="pp">${esc(T(S, 'ppAbbr'))} ${C.pp}</span>` : ''}
    <button class="btn quiet small" data-act="clearPool">Clear</button>
    <button class="btn" data-act="rollFromTray">Roll ${POOL.own.length + POOL.res.length} dice</button>
  </div>`;
}
function poolChip(it, i, side) {
  return `<span class="chip ${it.setKey && side === 'own' && POOL.own.filter(x => x.setKey === it.setKey).indexOf(it) > 0 ? 'cost' : ''} ${side === 'opp' ? 'opp' : ''}">${dieSvg(it.die, side === 'res' ? 'free' : 'on')}<span>${esc(it.label || 'd' + it.die)}</span><button class="x" data-act="poolDel" data-side="${side}" data-i="${i}" aria-label="Remove ${esc(it.label || '')}">✕</button></span>`;
}

/* boot */
function boot() {
  loadDB();
  document.addEventListener('click', onClick);
  document.addEventListener('input', onBind);
  document.addEventListener('change', onBind);
  document.addEventListener('change', onChangeAct);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#modal').classList.contains('open')) closeModal(); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (DB.ui.theme === 'auto') render(); });
  if (DB.ui.settingId && !DB.settings[DB.ui.settingId]) DB.ui.settingId = null;
  render();
}
