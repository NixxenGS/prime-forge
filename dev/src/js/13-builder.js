/* ============ Characters: list + builder ============ */
function lockBanner(S) {
  const nb = typeof netLockBanner === 'function' ? netLockBanner(S) : '';
  if (nb || (typeof netT === 'function' && netT(S))) return nb;
  if (!isLocked(S)) return '';
  return `<div class="lockbanner"><div><b>Player pack.</b> <span class="small">The rules are locked; you can build and play characters.</span></div><button class="btn quiet small" data-act="unlockSetting" data-id="${S.id}">Unlock (GM)</button></div>`;
}
VIEWS.chars = () => {
  const S = curS(); if (!S) return VIEWS.vault();
  const C = curC();
  if (DB.ui.cview === 'blank') return lockBanner(S) + fileView(S, blankChar(S), true);
  if (DB.ui.cview === 'map' && S.creation.methods.pathways) return lockBanner(S) + pathMapView(S);
  if (C && DB.ui.cview === 'build') return lockBanner(S) + netCharBanner(C) + (netReadOnly(C) ? fileView(S, C, false) : builderView(S, C));
  if (C && DB.ui.cview === 'file') return lockBanner(S) + netCharBanner(C) + fileView(S, C, false);
  return lockBanner(S) + charList(S);
};
function charList(S) {
  const list = charsOf(S);
  if (APP_MODE === 'play') { const me = netUid(); list.sort((a, b) => (b.owner === me) - (a.owner === me)); }
  return `<div class="pagehead"><div><h1>Characters</h1><p class="lede">${esc(S.name)}${S.tagline ? ' · ' + esc(S.tagline) : ''}</p></div>
    <div class="acts"><button class="btn" data-act="newChar">New character</button><button class="btn ghost" data-act="importFile">Import character</button>
    ${S.creation.methods.pathways ? '<button class="btn quiet" data-act="go" data-tab="chars" data-cview="map">Pathways map</button>' : ''}<button class="btn quiet" data-act="previewBlank">Blank file</button></div></div>
    ${list.length ? `<div class="vault-grid">${list.map(c => {
      const b = budget(S, c);
      return `<div class="card"><button class="ccard" style="border:0;padding:0;box-shadow:none" data-act="openChar" data-id="${c.id}">${portraitDot(c)}<div class="grow"><div class="nm">${esc(c.name || 'Unnamed character')}</div><div class="cn">${esc(c.concept || (c.player ? 'Played by ' + c.player : ''))}</div></div></button>
        ${netCharTag(c) ? `<div class="row" style="margin-top:8px;gap:6px">${netCharTag(c)}</div>` : ''}
        <div class="row" style="margin-top:10px">${netReadOnly(c) ? '' : b.issues ? `<span class="tag">${plural(b.issues, 'thing')} to check</span>` : '<span class="tag ok">Within budget</span>'}<span class="grow"></span>
        ${netReadOnly(c) ? '' : `<button class="btn quiet small" data-act="charGo" data-id="${c.id}" data-cview="build">Build</button>`}<button class="btn small" data-act="charGo" data-id="${c.id}" data-cview="file">File</button></div></div>`;
    }).join('')}</div>` : `<div class="empty"><h3>No characters yet</h3><p class="prose" style="margin:6px auto 14px">Make the first one. The builder tracks this setting's budgets as you go.</p><button class="btn" data-act="newChar">New character</button></div>`}`;
}
A.newChar = () => { const S = curS(); const c = newChar(S); netClaim(c, S); DB.chars[c.id] = c; DB.ui.charId = c.id; DB.ui.cview = 'build'; DB.ui.tab = 'chars'; save(); window.scrollTo(0, 0); render(); };
A.charGo = el => { DB.ui.charId = el.dataset.id; DB.ui.cview = el.dataset.cview; DB.ui.tab = 'chars'; window.scrollTo(0, 0); render(); };
A.cview = el => { DB.ui.cview = el.dataset.v; window.scrollTo(0, 0); render(); };
A.charMenu = () => {
  const C = curC(); if (!C) return;
  const NT = netT(C), ro = netReadOnly(C);
  openModal(C.name || 'Character', `<div class="stack">
    <div class="row"><button class="btn ghost" data-act="expChar">Export character</button><span class="small muted">Send it to your GM, or keep a copy.</span></div>
    <div class="row"><button class="btn ghost" data-act="dupChar">${ro ? 'Make my own copy' : 'Duplicate'}</button></div>
    ${NT && NT.role === 'gm' ? `<div class="row"><button class="btn ghost" data-act="netHandAsk">Hand to a player…</button><span class="small muted">${esc(C.ownerName ? 'Now: ' + C.ownerName : '')}</span></div>
    <div class="row"><button class="btn ghost" data-act="netHide" data-id="${C.id}" data-v="${C.hidden ? 0 : 1}">${C.hidden ? 'Show to players' : 'Hide from players'}</button><span class="small muted">${C.hidden ? 'Only you can see it now.' : 'For NPCs and secrets.'}</span></div>` : ''}
    ${ro ? '' : `<div class="row"><button class="btn danger" data-act="delChar">Delete character</button>${NT ? '<span class="small muted">Also removes it from the table.</span>' : ''}</div>`}</div>`);
};
A.expChar = () => { closeModal(); exportChar(curC()); };
A.dupChar = () => { const c = clone(curC()); c.id = uid('c_'); c.name = (c.name || 'Unnamed') + ' (copy)'; c.created = c.updated = now(); netClaim(c, curS()); DB.chars[c.id] = c; DB.ui.charId = c.id; closeModal(); save(); render(); toast('Character duplicated'); };
A.delChar = () => { const c = curC(); closeModal(); confirmBox(`Delete ${c.name || 'this character'}? This can't be undone.`, () => { netDeleteChar(c); delete DB.chars[c.id]; DB.ui.charId = null; DB.ui.cview = 'list'; save(); render(); toast('Character deleted'); }, 'Delete'); };

/* ---------- builder ---------- */
function builderView(S, C) {
  normalizeChar(C, S);
  const methods = Object.entries(S.creation.methods).filter(([k, v]) => v).map(([k]) => k === 'archetypes' ? 'archetype' : k);
  if (!methods.includes(C.method)) C.method = methods[0] || 'scratch';
  const mName = { scratch: 'Scratch-built', archetype: 'Archetype', pathways: 'Pathways' };
  let out = `<div class="pagehead"><div><h1>${esc(C.name || 'New character')}</h1><p class="lede">${esc(S.name)} · build</p></div>
    <div class="acts"><span class="seg"><button aria-pressed="true">Build</button><button data-act="cview" data-v="file" aria-pressed="false">File</button></span>
    <button class="btn quiet" data-act="cview" data-v="list">All characters</button><button class="btn quiet" data-act="charMenu">More…</button></div></div>
    <a class="mobonly budget-mini" href="#budgetPanel" data-live="budgetMini">${budgetMini(S, C)}</a>
    <div class="split-r"><div class="bmain">`;
  // who
  out += `<div class="bstage"><div class="sh"><h2>Who they are</h2></div>
    <div class="row top" style="gap:18px"><button class="portrait-drop" data-act="portrait" aria-label="Upload portrait">${C.portrait ? `<img src="${C.portrait}" alt="Portrait">` : 'Add portrait'}</button>
    <div class="grow stack"><div class="g2"><label class="fld"><span>Name</span>${inp('C.name', C.name, { re: true, ph: 'Character name' })}</label><label class="fld"><span>Player</span>${inp('C.player', C.player)}</label></div>
    <label class="fld"><span>Concept</span>${inp('C.concept', C.concept, { ph: 'A short pitch for the character' })}</label></div></div>
    <div class="g2" style="margin-top:12px"><label class="fld"><span>Description</span>${area('C.desc', C.desc, { rows: 3, ph: 'Look, manner, voice' })}</label><label class="fld"><span>History</span>${area('C.history', C.history, { rows: 3, ph: 'Where they came from' })}</label></div>
    ${C.portrait ? '<button class="linkbtn" data-act="clearPortrait" style="margin-top:6px">Remove portrait</button>' : ''}</div>`;
  // method
  if (methods.length > 1 || C.method !== 'scratch') {
    out += `<div class="bstage"><div class="sh"><h2>Method</h2>${refTag(METHODS[C.method === 'archetype' ? 'archetypes' : C.method].ref)}</div>
      ${methods.length > 1 ? `<span class="seg" role="group" aria-label="Creation method">${methods.map(m => `<button data-act="setMethod" data-m="${m}" aria-pressed="${C.method === m}">${mName[m]}</button>`).join('')}</span>` : ''}
      <p class="hint" style="margin-top:8px">${esc(METHODS[C.method === 'archetype' ? 'archetypes' : C.method].sum)}</p>
      ${C.method === 'archetype' ? archetypePanel(S, C) : ''}${C.method === 'pathways' ? pathwaysPanel(S, C) : ''}</div>`;
  }
  // sets
  S.sets.forEach(set => { out += setStage(S, C, set); });
  // extras
  if (on(S, 'vehicles')) out += vehiclesStage(S, C);
  if (on(S, 'milestones')) out += `<div class="bstage"><div class="sh"><h2>Milestones</h2>${refTag('p.84')}</div><p class="hint">Two milestones: often one shared by the group and one personal. Each pays 1 ${esc(T(S, 'xp'))} (any time it applies), 3 (once a scene) and 10 (once a session).</p>
    <div class="g2">${C.milestones.map((m, k) => `<div class="entry"><input class="nm" style="font-family:var(--f-display);font-weight:700;text-transform:uppercase" value="${esc(m.name)}" placeholder="${k ? 'Personal' : 'Group'} milestone" ${bindAttr(`C.milestones.${k}.name`)}>
      <div class="stack" style="margin-top:6px">${area(`C.milestones.${k}.desc`, m.desc, { rows: 1, ph: 'What it is about' })}${inp(`C.milestones.${k}.x1`, m.x1, { ph: '1 XP when…' })}${inp(`C.milestones.${k}.x3`, m.x3, { ph: '3 XP when…' })}${inp(`C.milestones.${k}.x10`, m.x10, { ph: '10 XP when…' })}</div></div>`).join('')}</div></div>`;
  out += `<div class="bstage"><div class="sh"><h2>Notes</h2></div>${area('C.notes', C.notes, { rows: 4, ph: 'Anything else: gear, contacts, secrets.' })}</div>`;
  out += `<div class="row" style="margin-top:10px"><button class="btn big" data-act="cview" data-v="file">Open the character file</button></div>`;
  out += `</div><aside class="sticky" id="budgetPanel"><div class="panel"><div class="bar">Budget</div><div class="in budget" data-live="budget">${budgetHtml(S, C)}</div></div>
    <p class="small muted" style="margin-top:8px">Track and warn: these numbers flag anything off-budget, but never stop you.</p></aside></div>`;
  return out;
}
function budgetMini(S, C) { const b = budget(S, C); return b.issues ? `<b>${b.issues}</b> ${b.issues === 1 ? 'thing' : 'things'} to check in the budget ↓` : '<b>✓</b> Within budget'; }
LIVE.budgetMini = () => { const S = curS(), C = curC(); return S && C ? budgetMini(S, C) : ''; };
LIVE.budget = () => { const S = curS(), C = curC(); return S && C ? budgetHtml(S, C) : ''; };
function budgetHtml(S, C) {
  const b = budget(S, C);
  let h = b.issues ? `<div class="bsum bad"><span class="big">${b.issues}</span><span>${b.issues === 1 ? 'thing' : 'things'} to check</span></div>` : `<div class="bsum ok"><span class="big">✓</span><span>Within budget</span></div>`;
  b.groups.forEach(g => {
    if (!g.rows.length && !g.warns.length) return;
    h += `<div class="grp"><div class="gt">${esc(g.title)}</div>`;
    g.rows.forEach(r => {
      const v = r.text ? esc(r.have) : `${r.have} / ${r.need}`;
      h += `<div class="brow ${r.state}" title="${esc(stateWord(r.state))}"><span class="dot"></span><span>${esc(r.label)}</span><span class="v">${v}</span>${r.hint ? `<span class="h">${esc(r.hint)}</span>` : ''}${r.parts && r.parts.length ? `<span class="h">${r.parts.map(([l, n]) => esc(l) + ' ' + n).join(' · ')}</span>` : ''}</div>`;
    });
    g.warns.forEach(w => { h += `<div class="bwarn">${esc(w)}</div>`; });
    h += '</div>';
  });
  return h;
}
A.portrait = () => { const C = curC(); pickFile('image/*', data => shrinkImage(data, 320, small => { if (!small) return toast('Couldn\'t read that image.', 'bad'); C.portrait = small; touch(C); render(); })); };
A.clearPortrait = () => { const C = curC(); C.portrait = ''; touch(C); render(); };
A.setMethod = el => {
  const S = curS(), C = curC(); const m = el.dataset.m;
  if (m === C.method) return;
  const trade = S.sets.filter(set => set.kind === 'fixed' && set.create.mode === 'trade' && set.traits.length);
  const go = () => {
    C.method = m;
    if (m !== 'archetype') { C.base = {}; C.archetypeId = ''; }
    // reset trade-set ratings to the new method's start so budgets line up
    trade.forEach(set => set.traits.forEach((t, i) => { C.ratings[set.id][t.id] = defaultRating(S, set, i, m); }));
    touch(C); render();
  };
  if (trade.length) confirmBox(`Switching method resets ${trade.map(x => x.name).join(' and ')} to their starting dice. Continue?`, go, 'Switch');
  else go();
};

/* ---------- archetypes ---------- */
function archetypePanel(S, C) {
  if (!S.lib.archetypes.length) return '<p class="small muted">The GM hasn\'t made any archetypes yet.</p>';
  const cur = byId(S.lib.archetypes, C.archetypeId);
  const sig = S.sets.find(x => x.flavor === 'sigassets');
  return `<div class="stack">${S.lib.archetypes.map(a => `<div class="entry" style="${cur && cur.id === a.id ? 'border-color:var(--crimson)' : ''}"><div class="eh"><b class="k" style="font-size:17px;text-transform:uppercase">${esc(a.name || 'Unnamed')}</b><span class="grow"></span>
      ${cur && cur.id === a.id ? '<span class="tag">Applied</span>' : `<button class="btn small" data-act="applyArch" data-id="${a.id}">Use this archetype</button>`}</div>
      ${a.pitch ? `<p class="desc small" style="margin:4px 0 0">${esc(a.pitch)}</p>` : ''}
      ${a.dists && a.dists.length ? `<p class="small" style="margin:4px 0 0">${esc(a.dists.map(d => d.name).filter(Boolean).join(' · '))}</p>` : ''}
      ${cur && cur.id === a.id && sig && (a.sig || []).length ? `<div class="row" style="margin-top:8px"><span class="lbl">Pick a signature asset:</span>${a.sig.map((x, j) => { const has = (C.entries[sig.id] || []).some(e => e.archSig && e.name === x.name); return `<button class="chip click" data-act="archSig" data-j="${j}" aria-pressed="${has}" style="${has ? 'border-color:var(--crimson)' : ''}">${dieSvg(x.die)}${esc(x.name || 'Unnamed')}</button>`; }).join('')}</div>` : ''}
      ${cur && cur.id === a.id && a.notes ? `<p class="small muted" style="margin:6px 0 0">${esc(a.notes)}</p>` : ''}</div>`).join('')}</div>`;
}
A.applyArch = el => {
  const S = curS(), C = curC(); const a = byId(S.lib.archetypes, el.dataset.id); if (!a) return;
  confirmBox(`Use ${a.name}? This replaces the character's preset dice and ${T(S, 'distinctions').toLowerCase()}.`, () => {
    C.archetypeId = a.id; C.base = {};
    Object.entries(a.ratings || {}).forEach(([sid, m]) => { C.base[sid] = {}; Object.entries(m).forEach(([tid, d]) => { if (+d) { C.base[sid][tid] = +d; (C.ratings[sid] = C.ratings[sid] || {})[tid] = +d; } }); });
    const ds = distSet(S);
    C.entries[ds.id] = (a.dists || []).map(d => Object.assign(newDistinction(d.name), { desc: d.desc || '', hl: clone(d.hl || []), sfx: (d.sfx || []).map(x => newSfx(x.name, x.text, false)), fromArch: true }));
    while (C.entries[ds.id].length < (+ds.create.count || 3)) C.entries[ds.id].push(newDistinction());
    touch(C); render(); toast(a.name + ' applied');
  }, 'Use archetype');
};
A.archSig = el => {
  const S = curS(), C = curC(); const a = byId(S.lib.archetypes, C.archetypeId); const sig = S.sets.find(x => x.flavor === 'sigassets');
  const x = a.sig[+el.dataset.j]; const list = C.entries[sig.id];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].archSig) list.splice(i, 1);
  const e = newEntry(sig); e.name = x.name; e.die = +x.die || 8; e.granted = true; e.archSig = true; list.unshift(e);
  touch(C); render();
};

/* ---------- pathways ---------- */
function grantText(S, g) {
  const ptsSet = S.sets.find(x => x.kind === 'fixed' && x.create.mode === 'points'), trd = S.sets.find(x => x.kind === 'fixed' && x.create.mode === 'trade');
  const parts = [];
  if (+g.dist) parts.push(`${g.dist} ${T(S, g.dist > 1 ? 'distinctions' : 'distinction').toLowerCase()} (+ highlights)`);
  if (+g.points) parts.push(`${g.points} ${ptsSet ? ptsSet.name : 'point-buy'} step${g.points > 1 ? 's' : ''}`);
  if (+g.trade) parts.push(`${g.trade} ${trd ? trd.name : 'trade-set'} step${g.trade > 1 ? 's' : ''}`);
  if (+g.pool) parts.push(`${g.pool} ${S.creation.poolName.toLowerCase()}`);
  if (+g.sfx) parts.push(`unlock ${g.sfx} ${T(S, 'sfx')}`);
  return parts.join(', ') || 'Story only';
}
function pathwaysPanel(S, C) {
  if (!S.creation.stages.length) return '<p class="small muted">The GM hasn\'t set up pathways stages yet.</p>';
  const others = charsOf(S).filter(x => x.id !== C.id);
  return `<div class="row"><button class="btn quiet small" data-act="go" data-tab="chars" data-cview="map">Open the group's pathways map</button></div>` + S.creation.stages.map((st, k) => {
    const rec = C.pathways[k] = C.pathways[k] || { choice: '', els: [], note: '', done: false };
    const nEl = st.type === 'major' ? 2 : 1;
    while (rec.els.length < nEl) rec.els.push({ type: 'circle', name: '', link: '' });
    const opts = String(st.opts || '').split(',').map(s => s.trim()).filter(Boolean);
    return `<div class="pstage ${rec.done ? 'done' : ''}"><div class="row"><b class="k" style="font-size:16px">${k + 1}. ${esc(st.name || 'Stage')}</b><span class="ptype">${esc(st.type)} stage</span><span class="grow"></span><label class="check"><input type="checkbox" class="bubble" ${rec.done ? 'checked' : ''} ${bindAttr(`C.pathways.${k}.done`)} data-re><span class="small">Done</span></label></div>
      <p class="small muted" style="margin:2px 0 6px">Gain: ${esc(grantText(S, st.g || {}))}</p>
      ${opts.length ? `<div class="row" style="margin-bottom:6px"><span class="lbl">Choice</span>${sel(`C.pathways.${k}.choice`, rec.choice, [['', 'Choose…']].concat(opts), { re: false })}</div>` : ''}
      ${rec.els.slice(0, nEl).map((e, j) => `<div class="g3" style="margin-top:4px"><label class="fld"><span>Element ${nEl > 1 ? j + 1 : ''}</span>${sel(`C.pathways.${k}.els.${j}.type`, e.type, ELEMENT_TYPES.concat([['pc', 'Another player character']]), { re: false })}</label>
        <label class="fld"><span>Name</span>${e.type === 'pc' ? sel(`C.pathways.${k}.els.${j}.name`, e.name, [['', 'Choose…']].concat(others.map(o => [o.name, o.name || 'Unnamed'])), { re: false }) : inp(`C.pathways.${k}.els.${j}.name`, e.name, { ph: 'e.g. Mother Yolanda' })}</label>
        <label class="fld"><span>Connection</span>${inp(`C.pathways.${k}.els.${j}.link`, e.link, { ph: 'e.g. grew up together' })}</label></div>`).join('')}
      ${st.type === 'meta' ? `<label class="fld" style="margin-top:6px"><span>Meta move</span>${inp(`C.pathways.${k}.note`, rec.note, { ph: 'Connect two elements, sever and replace a link, or add an element for another PC' })}</label>` : ''}</div>`;
  }).join('');
}

/* ---------- set stages ---------- */
function setStage(S, C, set) {
  const head = `<div class="sh"><h2>${esc(set.name)}</h2><span class="row">${set.prime ? '<span class="tag ink">Prime</span>' : ''}${refTag((FLAVORS[set.flavor] || {}).ref)}</span></div>
    <p class="hint">${set.desc ? esc(set.desc) + ' ' : ''}<span class="muted">${esc(ruleText(S, set))}</span></p>`;
  let body = '';
  switch (set.kind) {
    case 'distinctions': body = distStage(S, C, set); break;
    case 'fixed': body = fixedStage(S, C, set); break;
    case 'open': body = openStage(S, C, set); break;
    case 'resources': body = resStage(S, C, set); break;
    case 'powersets': body = psStage(S, C, set); break;
    case 'abilities': body = abStage(S, C, set); break;
    case 'talents': body = talStage(S, C, set); break;
  }
  return `<div class="bstage" id="st-${set.id}">${head}${body}</div>`;
}
function distStage(S, C, set) {
  const list = C.entries[set.id];
  const hs = byId(S.sets, S.dist.highlightSet);
  const lib = S.dist.library;
  return list.map((d, k) => {
    const p = `C.entries.${set.id}.${k}`;
    const nameField = S.dist.libOnly && lib.length
      ? sel(p + '.name', d.name, [['', `Choose a ${T(S, 'distinction').toLowerCase()}…`]].concat(lib.map(x => x.name)), { re: true, extra: `data-libdist="${k}"` })
      : `<input class="nm" value="${esc(d.name)}" placeholder="${esc(T(S, 'distinction'))} ${k + 1}" ${bindAttr(p + '.name')} data-re>`;
    return `<div class="entry"><div class="eh">${S.dist.rated === 'variable' ? diePick(p + '.die', d.die) : dieSvg(8)}${nameField}
      ${lib.length && !S.dist.libOnly ? `<button class="btn quiet small" data-act="distFromLib" data-k="${k}">From library</button>` : ''}
      <button class="icon-btn" data-act="delItem" data-path="C.entries.${set.id}" data-i="${k}" aria-label="Remove">✕</button></div>
      ${area(p + '.desc', d.desc, { rows: 1, ph: 'One or two sentences of context', cls: 'bare' })}
      ${hs ? `<div class="row" style="margin-top:6px"><span class="lbl">Highlight ${esc(hs.name.toLowerCase())}</span>${Array.from({ length: +S.dist.highlightCount || 0 }).map((_, h) => sel(`${p}.hl.${h}`, (d.hl || [])[h] || '', [['', '—']].concat(hs.traits.map(t => [t.id, t.name || 'Unnamed'])), { re: true })).join('')}</div>` : ''}
      <div style="margin-top:8px"><div class="sfxpick"><input type="checkbox" class="bubble" checked disabled aria-label="Hinder is always unlocked"><span class="small"><b>Hinder:</b> Gain a ${esc(T(S, 'ppAbbr'))} when you switch out this ${esc(T(S, 'distinction').toLowerCase())}'s d8 for a d4.</span></div>
      ${sfxEditor(p + '.sfx', d.sfx, S, { unlock: true })}</div></div>`;
  }).join('') + `<div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="pushDist">Add ${esc(T(S, 'distinction').toLowerCase())}</button></div>`;
}
A.pushDist = () => { const S = curS(), C = curC(); C.entries[distSet(S).id].push(newDistinction()); touch(C); render(); };
A.distFromLib = el => {
  const S = curS(); const k = el.dataset.k;
  openModal('Pick a ' + T(S, 'distinction').toLowerCase(), S.dist.library.map((d, j) => `<button class="setcard" style="width:100%;margin-top:8px" data-act="distLibPick" data-k="${k}" data-j="${j}"><div><div class="nm">${esc(d.name || 'Unnamed')}</div><div class="sm">${esc(d.desc)}</div>${(d.sfx || []).length ? `<div class="sm muted">${esc(d.sfx.map(x => x.name).join(' · '))}</div>` : ''}</div></button>`).join(''), { wide: true });
};
A.distLibPick = el => {
  const S = curS(), C = curC(); const d = S.dist.library[+el.dataset.j]; const e = C.entries[distSet(S).id][+el.dataset.k];
  Object.assign(e, { name: d.name, desc: d.desc, hl: clone(d.hl || []), sfx: (d.sfx || []).map(x => newSfx(x.name, x.text, false)) });
  closeModal(); touch(C); render();
};
// library-only select: copy desc/SFX after choosing
document.addEventListener('change', e => {
  const el = e.target.closest('[data-libdist]'); if (!el) return;
  const S = curS(), C = curC(); if (!S || !C) return;
  const d = S.dist.library.find(x => x.name === el.value); const e2 = C.entries[distSet(S).id][+el.dataset.libdist];
  if (d && e2) { Object.assign(e2, { desc: d.desc, hl: clone(d.hl || []), sfx: (d.sfx || []).map(x => newSfx(x.name, x.text, false)) }); touch(C); render(); }
});

function fixedStage(S, C, set) {
  if (!set.traits.length) return `<p class="small muted">No traits defined yet. ${isLocked(S) ? '' : '<button class="linkbtn" data-act="go" data-tab="designer" data-sec="traits">Add them in the Designer</button>'}</p>`;
  const hl = highlightCounts(S, C); const cr = set.create; const g = GUIDES[(FLAVORS[set.flavor] || {}).guide] || {};
  let spread = '';
  if (cr.mode === 'array') {
    const want = ((cr.auto ? ROLE_ARRAYS[set.traits.length] : null) || cr.array || []).slice();
    set.traits.forEach(t => { const v = dieAt(idx((C.ratings[set.id] || {})[t.id]) - (hl[t.id] || 0)); const i = want.indexOf(v); if (i >= 0) want.splice(i, 1); });
    spread = `<p class="small" style="margin:0 0 6px">Still to assign: ${want.length ? diceRow(want, 'free') : '<b>nothing</b>'}</p>`;
  }
  return spread + set.traits.map(t => {
    const p = `C.ratings.${set.id}.${t.id}`; const v = +((C.ratings[set.id] || {})[t.id] || 0);
    const sp = set.specialties ? (C.specs || []).map((s, i) => [s, i]).filter(([s]) => s.setId === set.id && s.traitId === t.id) : [];
    return `<div class="ratingrow"><span class="nm">${esc(t.name || 'Unnamed')}${hl[t.id] ? `<span class="hlmark">+${hl[t.id]} highlight</span>` : ''}${t.desc ? `<small>${esc(t.desc)}</small>` : ''}</span>
      ${diePick(p, v, { none: cr.mode === 'array' || cr.mode === 'free' })}
      <span class="gd">${esc(g[v] || '')}</span></div>
      ${set.statements ? `<div style="padding:0 0 6px">${inp(`C.stmt.${set.id}.${t.id}.text`, ((C.stmt[set.id] || {})[t.id] || {}).text, { ph: `Statement for ${t.name || 'this trait'}, e.g. “Tough as nails”`, cls: 'bare' })}</div>` : ''}
      ${set.sfx && (t.sfx || []).length ? `<div style="padding:0 0 6px 6px">${t.sfx.map(x => `<label class="sfxpick"><input type="checkbox" class="bubble" ${C.unlocks[x.id] ? 'checked' : ''} data-act="toggleUnlock" data-id="${x.id}"><span class="small"><b>${esc(x.name)}:</b> ${esc(x.text)}</span></label>`).join('')}</div>` : ''}
      ${set.specialties ? `<div class="row" style="padding:0 0 8px 6px;gap:6px">${sp.map(([s, i]) => `<span class="chip">${S.spec.multiLevel ? `<select style="width:auto;padding:1px 4px;font-size:13px" ${bindAttr(`C.specs.${i}.die`)} data-type="num" data-re>${[6, 8, 10, 12].map(d => `<option value="${d}" ${+s.die === d ? 'selected' : ''}>d${d}</option>`).join('')}</select>` : dieSvg(6)}<input style="width:150px;padding:2px 5px;font-size:14px" value="${esc(s.name)}" placeholder="Specialty" ${bindAttr(`C.specs.${i}.name`)}><button class="x" data-act="delItem" data-path="C.specs" data-i="${i}" aria-label="Remove specialty">✕</button></span>`).join('')}
        <button class="linkbtn" data-act="addSpec" data-set="${set.id}" data-t="${t.id}">+ specialty</button>${set.freeSpec === t.id ? '<span class="small muted">(one free at d6+)</span>' : ''}</div>` : ''}`;
  }).join('');
}
A.toggleUnlock = el => { const C = curC(); C.unlocks[el.dataset.id] = !C.unlocks[el.dataset.id]; touch(C); refreshLive(); };
A.addSpec = el => { const C = curC(); C.specs.push({ id: uid('sp_'), setId: el.dataset.set, traitId: el.dataset.t, name: '', die: 6, count: 1 }); touch(C); render(); };

function openStage(S, C, set) {
  const list = C.entries[set.id]; const cr = set.create; const g = GUIDES[(FLAVORS[set.flavor] || {}).guide] || {};
  const others = set.flavor === 'relationships' ? charsOf(S).filter(x => x.id !== C.id && x.name) : [];
  return list.map((e, k) => {
    const p = `C.entries.${set.id}.${k}`;
    return `<div class="entry"><div class="eh"><input class="nm" value="${esc(e.name)}" placeholder="${esc(set.name.replace(/s$/, ''))}" ${bindAttr(p + '.name')} ${others.length ? `list="dl-${set.id}"` : ''}>${diePick(p + '.die', e.die)}${e.granted ? '<span class="tag">from archetype</span>' : ''}
      <button class="icon-btn" data-act="delItem" data-path="C.entries.${set.id}" data-i="${k}" aria-label="Remove">✕</button></div>
      ${g[e.die] ? `<div class="small muted" style="margin:2px 0 0 4px">${esc(g[e.die])}</div>` : ''}
      ${set.statements ? `<div style="margin-top:6px">${inp(p + '.statement', e.statement, { ph: 'Statement, e.g. “He’s my brother from another mother”', cls: 'bare' })}</div>` : ''}
      ${set.sfx ? `<div style="margin-top:6px">${sfxEditor(p + '.sfx', e.sfx, S, { unlock: true })}</div>` : ''}</div>`;
  }).join('') + (others.length ? `<datalist id="dl-${set.id}">${others.map(o => `<option value="${esc(o.name)}">`).join('')}</datalist>` : '') +
    `<div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="addEntry" data-set="${set.id}">Add ${esc(set.name.replace(/s$/, '').toLowerCase())}</button></div>`;
}
A.addEntry = el => { const S = curS(), C = curC(); const set = byId(S.sets, el.dataset.set); C.entries[set.id].push(newEntry(set)); touch(C); render(); };

function resStage(S, C, set) {
  return C.entries[set.id].map((e, k) => {
    const p = `C.entries.${set.id}.${k}`;
    return `<div class="entry"><div class="eh"><input class="nm" value="${esc(e.name)}" placeholder="Resource" ${bindAttr(p + '.name')}>
      ${sel(p + '.type', e.type, [['extra', 'Extra'], ['location', 'Location'], ['org', 'Organization'], ['prop', 'Prop']], { re: false, extra: 'style="width:auto"' })}
      <span class="inline-num"><input type="number" min="1" max="6" value="${e.count}" ${bindAttr(p + '.count')} data-type="num" data-re style="width:56px">×</span>${diePick(p + '.die', e.die, { min: 6 })}
      <button class="icon-btn" data-act="delItem" data-path="C.entries.${set.id}" data-i="${k}" aria-label="Remove">✕</button></div>
      <div class="g2" style="margin-top:6px">${inp(p + '.tags.0', e.tags[0], { ph: 'Tag, e.g. Investigation' })}${inp(p + '.tags.1', e.tags[1], { ph: 'Tag, e.g. Law' })}</div></div>`;
  }).join('') + `<div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="addEntry" data-set="${set.id}">Add resource</button></div>`;
}
function psStage(S, C, set) {
  const lib = S.lib.powersets;
  return C.entries[set.id].map((ps, k) => {
    const p = `C.entries.${set.id}.${k}`;
    return `<div class="entry"><div class="eh"><input class="nm" value="${esc(ps.name)}" placeholder="Power set" ${bindAttr(p + '.name')}><button class="icon-btn" data-act="delItem" data-path="C.entries.${set.id}" data-i="${k}" aria-label="Remove">✕</button></div>
      ${area(p + '.desc', ps.desc, { rows: 1, ph: 'Origin or source', cls: 'bare' })}
      <div class="lbl" style="margin-top:6px">Powers</div>
      ${ps.powers.map((pw, j) => `<div class="row" style="margin-top:3px"><input class="grow" value="${esc(pw.name)}" placeholder="Power" ${bindAttr(`${p}.powers.${j}.name`)}>${diePick(`${p}.powers.${j}.die`, pw.die, { min: 6 })}<span class="small muted" style="width:86px">${esc((GUIDES.powers[pw.die]) || '')}</span><button class="icon-btn sm" data-act="delItem" data-path="${p}.powers" data-i="${j}" aria-label="Remove power">✕</button></div>`).join('')}
      <button class="linkbtn" data-act="pushItem" data-path="${p}.powers" data-item='${esc(JSON.stringify({ name: '', die: 8 }))}'>+ power</button>
      <div class="g2" style="margin-top:8px"><div><div class="lbl">${esc(T(S, 'sfx'))}</div>${sfxEditor(p + '.sfx', ps.sfx, S)}</div><div><div class="lbl">${esc(T(S, 'limit'))}s</div>${sfxEditor(p + '.limits', ps.limits, S)}</div></div></div>`;
  }).join('') + `<div class="row" style="margin-top:10px">${lib.length ? `<button class="btn ghost small" data-act="psFromLib" data-set="${set.id}">Add from library</button>` : ''}<button class="btn ${lib.length ? 'quiet' : 'ghost'} small" data-act="addEntry" data-set="${set.id}">Write a new power set</button></div>`;
}
A.psFromLib = el => {
  const S = curS();
  openModal('Power set library', S.lib.powersets.map((ps, j) => `<button class="setcard" style="width:100%;margin-top:8px" data-act="psLibPick" data-set="${el.dataset.set}" data-j="${j}"><div><div class="nm">${esc(ps.name || 'Unnamed')}</div><div class="sm">${esc(ps.desc || '')}</div><div class="sm muted">${esc((ps.powers || []).map(x => x.name + ' d' + x.die).join(', '))}</div></div></button>`).join(''), { wide: true });
};
A.psLibPick = el => { const S = curS(), C = curC(); const ps = clone(S.lib.powersets[+el.dataset.j]); ps.id = uid('e_'); ps.powers.forEach(x => x.id = uid('p_')); ps.sfx.forEach(x => x.id = uid('x_')); ps.limits.forEach(x => x.id = uid('x_')); ps.shutdown = false; C.entries[el.dataset.set].push(ps); closeModal(); touch(C); render(); };
function abStage(S, C, set) {
  const lib = S.lib.abilities;
  return C.entries[set.id].map((a, k) => {
    const p = `C.entries.${set.id}.${k}`;
    return `<div class="entry"><div class="eh"><input class="nm" value="${esc(a.name)}" placeholder="Ability" ${bindAttr(p + '.name')}>${diePick(p + '.die', a.die, { min: 6 })}<button class="icon-btn" data-act="delItem" data-path="C.entries.${set.id}" data-i="${k}" aria-label="Remove">✕</button></div>
      <div class="g2" style="margin-top:6px">${sel(p + '.effect', a.effect, POWER_EFFECTS, { re: false })}${inp(p + '.descriptor', a.descriptor, { ph: 'Descriptor, e.g. Flame Strike' })}</div>
      ${area(p + '.desc', a.desc, { rows: 1, cls: 'bare', ph: 'What it looks like' })}
      <div style="margin-top:6px">${sfxEditor(p + '.sfx', a.sfx, S, { unlock: true })}</div></div>`;
  }).join('') + `<div class="row" style="margin-top:10px">${lib.length ? `<button class="btn ghost small" data-act="abFromLib" data-set="${set.id}">Add from library</button>` : ''}<button class="btn ${lib.length ? 'quiet' : 'ghost'} small" data-act="addEntry" data-set="${set.id}">Write a new ability</button></div>`;
}
A.abFromLib = el => {
  const S = curS();
  openModal('Ability library', S.lib.abilities.map((a, j) => `<button class="setcard" style="width:100%;margin-top:8px" data-act="abLibPick" data-set="${el.dataset.set}" data-j="${j}"><div><div class="nm">${esc(a.name || 'Unnamed')} d${a.die}</div><div class="sm">${esc(a.effect)}${a.descriptor ? ' · ' + esc(a.descriptor) : ''}</div><div class="sm muted">${esc(a.desc || '')}</div></div></button>`).join(''), { wide: true });
};
A.abLibPick = el => { const S = curS(), C = curC(); const a = clone(S.lib.abilities[+el.dataset.j]); a.id = uid('e_'); a.sfx = (a.sfx || []).map(x => newSfx(x.name, x.text, false)); C.entries[el.dataset.set].push(a); closeModal(); touch(C); render(); };
function talStage(S, C, set) {
  const lib = S.lib.talents;
  return C.entries[set.id].map((t, k) => {
    const p = `C.entries.${set.id}.${k}`;
    return `<div class="entry"><div class="eh"><input class="nm" value="${esc(t.name)}" placeholder="Talent" ${bindAttr(p + '.name')}><button class="icon-btn" data-act="delItem" data-path="C.entries.${set.id}" data-i="${k}" aria-label="Remove">✕</button></div>
      ${area(p + '.desc', t.desc, { rows: 1, cls: 'bare', ph: 'Description (optional)' })}
      <div class="g2" style="margin-top:6px"><label class="fld"><span>Activation</span>${area(p + '.activation', t.activation, { rows: 2 })}</label><label class="fld"><span>Effect</span>${area(p + '.effect', t.effect, { rows: 2 })}</label></div></div>`;
  }).join('') + `<div class="row" style="margin-top:10px">${lib.length ? `<button class="btn ghost small" data-act="talFromLib" data-set="${set.id}">Add from library</button>` : ''}<button class="btn ${lib.length ? 'quiet' : 'ghost'} small" data-act="addEntry" data-set="${set.id}">Write a new talent</button></div>`;
}
A.talFromLib = el => {
  const S = curS();
  const groups = {}; S.lib.talents.forEach((t, j) => { (groups[t.group || 'Talents'] = groups[t.group || 'Talents'] || []).push([t, j]); });
  openModal('Talent library', Object.entries(groups).map(([g, items]) => `<h3 style="margin-top:12px">${esc(g)}</h3>` + items.map(([t, j]) => `<button class="setcard" style="width:100%;margin-top:8px" data-act="talLibPick" data-set="${el.dataset.set}" data-j="${j}"><div><div class="nm">${esc(t.name || 'Unnamed')}</div><div class="sm"><b>Activation:</b> ${esc(t.activation)}<br><b>Effect:</b> ${esc(t.effect)}</div></div></button>`).join('')).join(''), { wide: true });
};
A.talLibPick = el => { const S = curS(), C = curC(); const t = clone(S.lib.talents[+el.dataset.j]); t.id = uid('e_'); C.entries[el.dataset.set].push(t); closeModal(); touch(C); render(); };

function vehiclesStage(S, C) {
  return `<div class="bstage"><div class="sh"><h2>Vehicles</h2>${refTag('p.216')}</div>
    ${C.vehicles.map((v, k) => { const p = `C.vehicles.${k}`; v.r = v.r || {}; return `<div class="entry"><div class="eh"><input class="nm" value="${esc(v.name)}" placeholder="Vehicle name" ${bindAttr(p + '.name')}><span class="lbl">Scale</span>${diePick(p + '.scale', v.scale, { none: true })}<button class="icon-btn" data-act="delItem" data-path="C.vehicles" data-i="${k}" aria-label="Remove">✕</button></div>
      ${S.vehicle.traits.map((t, j) => `<div class="ratingrow"><span class="nm">${esc(t.name || 'Unnamed')}</span>${diePick(`${p}.r.${j}`, v.r[j] || S.vehicle.die)}<span></span></div>`).join('')}
      <div class="g2" style="margin-top:6px">${inp(p + '.dist', v.dist, { ph: 'Vehicle distinction' })}${inp(p + '.sig', v.sig, { ph: 'Signature asset (optional)' })}</div>
      <div style="margin-top:6px">${sfxEditor(p + '.sfx', v.sfx, S)}</div></div>`; }).join('')}
    <button class="btn ghost small" data-act="pushItem" data-path="C.vehicles" data-item='${esc(JSON.stringify({ name: '', scale: 0, r: {}, dist: '', sig: '', sfx: [] }))}'>Add vehicle</button></div>`;
}
