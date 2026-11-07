/* ============ PRIME FORGE — utilities ============ */
'use strict';
const DICE = [4, 6, 8, 10, 12];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const idx = d => d ? DICE.indexOf(+d) + 1 : 0;          // d4=1 … d12=5, none=0
const dieAt = i => i <= 0 ? 0 : (i > 5 ? 13 : DICE[i - 1]); // 13 = "beyond d12"
const stepUp = d => d ? dieAt(idx(d) + 1) : 4;
const stepDown = d => dieAt(idx(d) - 1);
const dlabel = d => d ? (d > 12 ? '>d12' : 'd' + d) : '—';
const rollDie = n => 1 + Math.floor(Math.random() * n);
const plural = (n, w, p) => n + ' ' + (n === 1 ? w : (p || w + 's'));
const byId = (arr, id) => (arr || []).find(x => x && x.id === id);
const sum = a => a.reduce((x, y) => x + y, 0);
const now = () => new Date().toISOString();

function getPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) {
    const k = ks[i];
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {};
    o = o[k];
  }
  o[ks[ks.length - 1]] = val;
}
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function moveItem(arr, i, dir) { const j = i + dir; if (j < 0 || j >= arr.length) return; const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
function slug(s) { return String(s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'; }

/* ---------- die shapes ---------- */
const DIE_SHAPE = {
  4: '<polygon points="16,2.5 30.5,28.5 1.5,28.5"/>',
  6: '<rect x="3" y="3" width="26" height="26" rx="3.5"/>',
  8: '<polygon points="16,1 31,16 16,31 1,16"/>',
  10: '<polygon points="16,1.5 30.5,12 16,30.5 1.5,12"/>',
  12: '<polygon points="16,1.5 30.8,12.3 25.2,29.7 6.8,29.7 1.2,12.3"/>'
};
const DIE_TY = { 4: 24.5, 6: 21, 8: 21, 10: 18.5, 12: 22 };
/* state: on | off | ghost | total | effect | hitch | doom */
function dieSvg(n, state = 'on', text) {
  n = +n;
  if (!DIE_SHAPE[n]) return `<span class="die-txt">${esc(dlabel(n))}</span>`;
  const t = text == null ? n : text;
  const fs = String(t).length > 1 ? 11.5 : 13.5;
  return `<svg class="die die-${n} ds-${state}" viewBox="0 0 32 32" aria-label="d${n}${text != null ? ' rolled ' + text : ''}" role="img">${DIE_SHAPE[n]}<text x="16" y="${DIE_TY[n]}" font-size="${fs}" text-anchor="middle">${esc(t)}</text></svg>`;
}
function diceRow(dice, state = 'on') { return (dice || []).map(d => dieSvg(d, state)).join(''); }

/* ---------- toasts & modal ---------- */
function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}
let MODAL_CB = null;
function openModal(title, bodyHtml, { wide = false, actions = '', onClose = null } = {}) {
  MODAL_CB = onClose;
  const m = $('#modal');
  m.innerHTML = `<div class="modal-back" data-act="closeModal"></div>
  <div class="modal-card ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-act="closeModal" aria-label="Close">✕</button></div>
    <div class="modal-body">${bodyHtml}</div>
    ${actions ? `<div class="modal-foot">${actions}</div>` : ''}
  </div>`;
  m.classList.add('open');
  const f = m.querySelector('input,select,textarea,button:not(.icon-btn)'); if (f) setTimeout(() => f.focus(), 30);
}
function closeModal() { const m = $('#modal'); m.classList.remove('open'); m.innerHTML = ''; if (MODAL_CB) { const cb = MODAL_CB; MODAL_CB = null; cb(); } }
function confirmBox(msg, onYes, yesLabel = 'Confirm') {
  openModal('Please confirm', `<p class="prose">${esc(msg)}</p>`, {
    actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn danger" id="cfYes">${esc(yesLabel)}</button>`
  });
  $('#cfYes').onclick = () => { closeModal(); onYes(); };
}
function promptBox(title, label, def, onOk, okLabel = 'Save') {
  openModal(title, `<label class="fld"><span>${esc(label)}</span><input id="pbIn" value="${esc(def || '')}"></label>`, {
    actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="pbOk">${esc(okLabel)}</button>`
  });
  const go = () => { const v = $('#pbIn').value; closeModal(); onOk(v); };
  $('#pbOk').onclick = go;
  $('#pbIn').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}

/* ---------- files ---------- */
function download(name, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function pickFile(accept, cb) {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = accept;
  i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(r.result, f); if (/image/.test(accept)) r.readAsDataURL(f); else r.readAsText(f); };
  i.click();
}
function shrinkImage(dataUrl, max, cb) {
  const img = new Image();
  img.onload = () => {
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    cb(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = () => cb(null);
  img.src = dataUrl;
}
