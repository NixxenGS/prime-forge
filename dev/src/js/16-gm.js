/* ============ GM table ============ */
const GMC_TYPES = [
  ['major', 'Major GMC', 'gmMajor'], ['minor', 'Minor GMC', 'gmMinor'], ['extra', 'Extra', 'gmExtras'], ['mob', 'Mob', 'gmMobs'],
  ['boss', 'Boss', 'gmBosses'], ['location', 'Location', 'gmLocations'], ['faction', 'Faction / org', 'gmFactions']
];
function newGMC(type, S) {
  const g = { id: uid('g_'), type, name: '', desc: '', main: null, traits: [], dists: [], sfx: [], comps: [], stress: {}, active: true, notes: '', scale: 0 };
  if (type === 'extra') g.main = { name: '', die: 6, count: 1 };
  if (type === 'mob') g.main = { name: 'Mob', die: 6, count: 3 };
  if (type === 'boss') g.main = { name: 'Boss', die: 10, count: 3 };
  if (type === 'faction') { g.main = { name: '', die: 8, count: 3 }; g.scale = 8; }
  if (type === 'minor') g.traits = [0, 1, 2].map(() => ({ id: uid('gt_'), name: '', die: 8 }));
  if (type === 'location') g.traits = [{ id: uid('gt_'), name: '', die: 8 }];
  if (type === 'major') { g.dists = [{ name: '' }, { name: '' }, { name: '' }]; }
  return g;
}
VIEWS.gm = () => {
  const S = curS(); if (!S) return VIEWS.vault();
  const G = curG();
  const types = GMC_TYPES.filter(t => on(S, t[2]));
  const pcs = charsOf(S);
  const roster = G.gmcs.map((g, i) => gmcBlock(S, G, g, i)).join('') || `<div class="empty"><p>No ${esc(T(S, 'gmc'))}s yet. Add one above; tap any die on a stat block to add it to the opposition.</p></div>`;
  const doomName = S.opt.doomName || 'Doom pool';
  const right = [];
  right.push(`<div class="panel"><div class="bar">Session</div><div class="in"><div class="row"><button class="btn" data-act="gmNewSession">New session</button><button class="btn ghost" data-act="gmNewScene">New scene</button></div>
    <p class="small muted" style="margin:8px 0 0">New session: ${on(S, 'doom') ? `resets the ${esc(doomName.toLowerCase())}` : `sets the bank to ${pcs.length} (one per character)`} and refreshes every character's ${esc(T(S, 'pps').toLowerCase())}, resources and callbacks.</p></div></div>`);
  if (!on(S, 'doom')) right.push(`<div class="panel"><div class="bar">${esc(T(S, 'gm'))} bank</div><div class="in"><div class="row"><button class="icon-btn" data-act="bump" data-path="G.bank" data-n="-1" data-min="0" aria-label="Spend">−</button><span class="bigtotal" style="font-size:44px">${G.bank}</span><button class="icon-btn" data-act="bump" data-path="G.bank" data-n="1" aria-label="Add">+</button><span class="small muted grow">${on(S, 'noBank') ? 'No bank mod: points you spend go to the affected player.' : `For ${esc(T(S, 'gmc'))} SFX, extra dice and staying in a fight.`}</span></div></div></div>`);
  else right.push(`<div class="panel"><div class="bar">${esc(doomName)}</div><div class="in"><div class="row" style="gap:5px">${G.doom.map((d, i) => `<span class="chip">${dieSvg(d, 'doom')}<button class="x" data-act="doomStep" data-i="${i}" aria-label="Step up">▴</button><button class="x" data-act="delItem" data-path="G.doom" data-i="${i}" aria-label="Spend">✕</button></span>`).join('') || '<span class="small muted">Empty</span>'}</div>
    <div class="row" style="margin-top:8px;gap:4px"><span class="lbl">Add</span>${DICE.map(d => `<button class="dbtn" data-act="doomAdd" data-die="${d}" aria-label="Add d${d}">${dieSvg(d, 'off')}</button>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="btn small" data-act="doomRoll">Roll as difficulty</button><button class="btn quiet small" data-act="doomReset">Reset to start</button></div>
    <p class="small muted" style="margin:8px 0 0">Spend dice (✕) like ${esc(T(S, 'pps').toLowerCase())}: a d6 equals one. Bigger dice buy twists: a scene complication or asset of that size, a new extra, ending the scene (two d12s).</p></div></div>`);
  if (on(S, 'crisis')) right.push(`<div class="panel"><div class="bar">Crisis pools</div><div class="in">${G.crisis.map((c, i) => `<div style="padding:6px 0;border-top:${i ? '1px solid var(--line-2)' : '0'}"><div class="row"><input class="grow bare k" value="${esc(c.name)}" placeholder="Crisis name" ${bindAttr(`G.crisis.${i}.name`)}><button class="icon-btn sm" data-act="delItem" data-path="G.crisis" data-i="${i}" aria-label="Remove crisis">✕</button></div>
      <div class="row" style="gap:4px">${c.dice.map((d, j) => `<span class="chip">${dieSvg(d, 'doom')}<button class="x" data-act="crisisDie" data-i="${i}" data-j="${j}" data-n="-1" aria-label="Step down">▾</button><button class="x" data-act="delItem" data-path="G.crisis.${i}.dice" data-i="${j}" aria-label="Remove">✕</button></span>`).join('')}
      ${[6, 8, 10].map(d => `<button class="dbtn" data-act="crisisAdd" data-i="${i}" data-die="${d}" aria-label="Add d${d}">${dieSvg(d, 'off')}</button>`).join('')}<button class="btn quiet small" data-act="crisisRoll" data-i="${i}">Roll</button></div></div>`).join('') || '<span class="small muted">None</span>'}
    <button class="btn ghost small" style="margin-top:8px" data-act="pushItem" data-path="G.crisis" data-item='${esc(JSON.stringify({ name: '', dice: [6, 6, 6] }))}'>Add crisis pool</button></div></div>`);
  if (on(S, 'turnOrder')) right.push(orderPanel(S, G, pcs));
  if (on(S, 'timed')) right.push(`<div class="panel"><div class="bar">Timed test</div><div class="in"><div class="row"><input class="grow" value="${esc(G.timed.name)}" placeholder="What's on the clock?" ${bindAttr('G.timed.name')}><span class="inline-num"><input type="number" value="${G.timed.beats}" ${bindAttr('G.timed.beats')} data-type="num" data-re style="width:60px"><span class="small">beats</span></span></div>
    <div class="row" style="margin-top:8px;gap:5px">${Array.from({ length: +G.timed.beats || 0 }, (_, i) => `<button class="beat ${i < G.timed.used ? 'used' : ''}" data-act="beat" data-i="${i}" aria-label="Beat ${i + 1}"></button>`).join('')}<button class="linkbtn" data-act="setVal" data-path="G.timed.used" data-val="0" data-type="num">reset</button></div>
    <p class="small muted" style="margin:6px 0 0">Success costs 1 beat, failure 2, heroic success 0.</p></div></div>`);
  right.push(`<div class="panel"><div class="bar">The party</div><div class="in">${pcs.map(c => `<div class="row" style="padding:5px 0;border-top:1px solid var(--line-2)"><button class="linkbtn grow" style="text-align:left" data-act="openChar" data-id="${c.id}">${esc(c.name || 'Unnamed')}</button>
      ${Object.entries(c.stress || {}).filter(([k, v]) => +v).map(([k, v]) => `<span class="tag ink" title="${esc(T(S, 'stress'))}">${esc(stressName(S, k))} ${dlabel(v)}</span>`).join('')}
      ${(c.temps || []).filter(t => t.type !== 'asset').length ? `<span class="tag ink">${c.temps.filter(t => t.type !== 'asset').length} compl.</span>` : ''}
      <span class="row" style="gap:2px"><button class="icon-btn sm" data-act="pcPP" data-id="${c.id}" data-n="-1" aria-label="Take">−</button><b class="k">${c.pp}</b><button class="icon-btn sm" data-act="pcPP" data-id="${c.id}" data-n="1" aria-label="Give">+</button></span></div>`).join('') || '<span class="small muted">No characters yet.</span>'}</div></div>`);
  const scene = sceneBlock(S, G);
  return `<div class="pagehead"><div><h1>${esc(T(S, 'gm'))} table</h1><p class="lede">${esc(S.name)}: ${esc(T(S, 'gmc'))}s, the scene, and the pools you spend from.</p></div>
    <div class="acts"><button class="btn ghost" data-act="go" data-tab="dice">Open dice</button></div></div>
    <div class="gm-grid"><div>
      <div class="row" style="margin-bottom:12px"><span class="lbl">Add</span>${types.map(([k, l]) => `<button class="btn ghost small" data-act="addGMC" data-type="${k}">${esc(l)}</button>`).join('') || '<span class="small muted">Turn on GM characters in the Designer.</span>'}</div>
      <div class="stack">${roster}</div>${scene}
      <section class="sec" style="margin-top:22px"><h3>${esc(T(S, 'gm'))} notes</h3>${area('G.notes', G.notes, { rows: 5, ph: 'Reveals, situations, secrets.' })}</section></div>
    <div class="stack">${right.join('')}</div></div>`;
};
function gmcBlock(S, G, g, i) {
  const p = `G.gmcs.${i}`; const edit = OPEN[g.id];
  const tname = (GMC_TYPES.find(t => t[0] === g.type) || [])[1] || g.type;
  const oppBtn = (die, label) => `<button class="chip click" data-act="gmcOpp" data-die="${die}" data-label="${esc(label)}">${dieSvg(die, 'doom')}${esc(label)}</button>`;
  let body;
  if (edit) {
    body = `<div class="stack">${area(p + '.desc', g.desc, { rows: 1, ph: 'Description' })}
      ${g.main ? `<div class="row"><span class="lbl">${g.type === 'extra' ? 'Trait' : 'Main trait'}</span><input class="grow" value="${esc(g.main.name)}" placeholder="${g.type === 'mob' ? 'Mob of thugs' : g.type === 'boss' ? 'Boss trait' : 'Trait'}" ${bindAttr(p + '.main.name')}>${dieSelect(p + '.main.die', g.main.die, { re: true })}${g.type !== 'extra' ? `<span class="inline-num"><input type="number" min="1" max="8" value="${g.main.count}" ${bindAttr(p + '.main.count')} data-type="num" data-re style="width:58px"><span class="small">dice</span></span>` : ''}</div>` : ''}
      ${g.type === 'faction' && on(S, 'scale') ? `<div class="row"><span class="lbl">Scale die</span>${dieSelect(p + '.scale', g.scale, { re: true })}</div>` : ''}
      <div><div class="lbl">Traits</div>${g.traits.map((t, j) => `<div class="row" style="margin-top:3px">${t.group ? `<span class="tag ink">${esc(t.group)}</span>` : ''}<input class="grow" value="${esc(t.name)}" placeholder="Trait" ${bindAttr(`${p}.traits.${j}.name`)}>${dieSelect(`${p}.traits.${j}.die`, t.die, { re: true })}<button class="icon-btn sm" data-act="delItem" data-path="${p}.traits" data-i="${j}" aria-label="Remove">✕</button></div>`).join('')}
      <div class="row" style="margin-top:4px"><button class="btn ghost small" data-act="pushItem" data-path="${p}.traits" data-item='${esc(JSON.stringify({ name: '', die: 8 }))}'>Add trait</button>${g.type === 'major' ? `<span class="small muted">Fill from this setting's sets:</span><button class="btn quiet small" data-act="gmcFill" data-i="${i}" data-lvl="light">Light</button><button class="btn quiet small" data-act="gmcFill" data-i="${i}" data-lvl="medium">Medium</button><button class="btn quiet small" data-act="gmcFill" data-i="${i}" data-lvl="heavy">Heavy</button>` : ''}</div></div>
      ${g.type === 'major' || g.type === 'boss' || g.type === 'location' || g.type === 'faction' ? `<div><div class="lbl">${g.type === 'location' ? 'Scene distinctions' : esc(T(S, 'distinctions'))}</div>${g.dists.map((d, j) => `<div class="row" style="margin-top:3px"><input class="grow" value="${esc(d.name)}" placeholder="${esc(T(S, 'distinction'))}" ${bindAttr(`${p}.dists.${j}.name`)}><button class="icon-btn sm" data-act="delItem" data-path="${p}.dists" data-i="${j}" aria-label="Remove">✕</button></div>`).join('')}<button class="btn ghost small" style="margin-top:4px" data-act="pushItem" data-path="${p}.dists" data-item='${esc(JSON.stringify({ name: '' }))}'>Add</button></div>` : ''}
      <div><div class="lbl">${esc(T(S, 'sfx'))}</div>${sfxEditor(p + '.sfx', g.sfx, S)}</div>
      ${area(p + '.notes', g.notes, { rows: 1, ph: 'Notes' })}
      <div class="row"><button class="btn small" data-act="openToggle" data-k="${g.id}">Done editing</button></div></div>`;
  } else {
    const mainDice = g.main && +g.main.count > 0 ? `<div class="row" style="gap:5px">${g.type === 'extra' ? oppBtn(g.main.die, g.main.name || g.name || 'Extra') : `<button class="chip click" data-act="gmcMain" data-i="${i}">${diceRow(Array(+g.main.count).fill(+g.main.die), 'doom')}${esc(g.main.name || 'Main trait')}</button>${g.type !== 'extra' ? `<button class="linkbtn" data-act="gmcKnock" data-i="${i}" title="Effect beat the ${g.type} die: remove one">knock off a die</button>` : ''}`}
      ${g.scale && on(S, 'scale') ? `<span class="tag ink">scale ${dlabel(g.scale)}</span>` : ''}</div>` : (g.main ? `<span class="tag">Taken out</span>` : '');
    body = `${g.desc ? `<p class="desc small" style="margin:0 0 6px">${esc(g.desc)}</p>` : ''}${mainDice}
      ${g.traits.length ? `<div class="row" style="gap:5px;margin-top:6px">${g.traits.filter(t => t.name).map(t => oppBtn(t.die, t.name)).join('')}</div>` : ''}
      ${g.dists.filter(d => d.name).length ? `<div class="row" style="gap:5px;margin-top:6px">${g.dists.filter(d => d.name).map(d => `${oppBtn(8, d.name)}<button class="linkbtn" data-act="gmcHinder" data-label="${esc(d.name)}" title="Roll as d4 and add a ${esc(T(S, 'pp').toLowerCase())} to the bank">d4</button>`).join('')}</div>` : ''}
      ${g.sfx.filter(x => x.name || x.text).map(x => sfxLine(x, true)).join('')}
      ${g.comps.length ? `<div class="row" style="gap:5px;margin-top:6px">${g.comps.map((c, j) => `<span class="chip">${dieSvg(c.die)}${esc(c.name)}<button class="x" data-act="gmcComp" data-i="${i}" data-j="${j}" aria-label="Step up">▴</button><button class="x" data-act="delItem" data-path="${p}.comps" data-i="${j}" aria-label="Remove">✕</button></span>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:8px"><button class="linkbtn" data-act="gmcAddComp" data-i="${i}">+ ${esc(T(S, 'complication').toLowerCase())}</button>${g.notes ? `<span class="small muted">${esc(g.notes)}</span>` : ''}</div>`;
  }
  return `<div class="statblock ${g.active ? '' : 'inactive'}"><header><span class="tag ink">${esc(tname)}</span>
    ${edit ? `<input class="grow k" style="font-size:16px;text-transform:uppercase" value="${esc(g.name)}" placeholder="Name" ${bindAttr(p + '.name')}>` : `<span class="nm">${esc(g.name || (g.main && g.main.name) || 'Unnamed')}</span>`}
    <label class="check" title="In the current scene"><input type="checkbox" class="bubble" ${g.active ? 'checked' : ''} ${bindAttr(p + '.active')} data-re><span class="small">in scene</span></label>
    ${edit ? '' : `<button class="btn quiet small" data-act="openToggle" data-k="${g.id}">Edit</button>`}
    <button class="icon-btn sm" data-act="dupGMC" data-i="${i}" aria-label="Duplicate" title="Duplicate">⧉</button><button class="icon-btn sm" data-act="delItem" data-path="G.gmcs" data-i="${i}" data-confirm="Remove this ${esc(tname)}?" aria-label="Remove">✕</button></header><div class="bd">${body}</div></div>`;
}
function sceneBlock(S, G) {
  return `<section class="sec" style="margin-top:22px"><div class="sec-head"><h3>The scene</h3>${refTag('p.116')}</div>
    ${on(S, 'gmLocations') ? `<div class="lbl">Scene distinctions (anyone can use them, d8 or d4 for a ${esc(T(S, 'pp').toLowerCase())})</div>
      <div class="row" style="gap:5px;margin-top:4px">${G.scene.dists.map((d, i) => `<span class="chip">${dieSvg(8)}<input class="bare" style="width:150px;padding:1px 4px" value="${esc(d.name)}" placeholder="e.g. Panicked crowd" ${bindAttr(`G.scene.dists.${i}.name`)}><button class="x" data-act="sceneToPool" data-k="dist" data-i="${i}" title="Add to your pool">+mine</button><button class="x" data-act="sceneToOpp" data-k="dist" data-i="${i}" title="Add to the opposition">+opp</button><button class="x" data-act="delItem" data-path="G.scene.dists" data-i="${i}" aria-label="Remove">✕</button></span>`).join('')}
      <button class="btn ghost small" data-act="pushItem" data-path="G.scene.dists" data-item='${esc(JSON.stringify({ name: '' }))}'>Add scene distinction</button></div>` : ''}
    <div class="lbl" style="margin-top:10px">Scene ${esc(T(S, 'asset').toLowerCase())}s & ${esc(T(S, 'complication').toLowerCase())}s</div>
    <div class="row" style="gap:5px;margin-top:4px">${G.scene.temps.map((t, i) => `<span class="chip">${dieSvg(t.die, t.type === 'asset' ? 'on' : 'doom')}<input class="bare" style="width:140px;padding:1px 4px" value="${esc(t.name)}" placeholder="Name" ${bindAttr(`G.scene.temps.${i}.name`)}>${dieSelect(`G.scene.temps.${i}.die`, t.die, { re: true })}<button class="x" data-act="sceneToPool" data-k="temp" data-i="${i}">+mine</button><button class="x" data-act="sceneToOpp" data-k="temp" data-i="${i}">+opp</button><button class="x" data-act="delItem" data-path="G.scene.temps" data-i="${i}" aria-label="Remove">✕</button></span>`).join('')}
      <button class="btn ghost small" data-act="pushItem" data-path="G.scene.temps" data-item='${esc(JSON.stringify({ name: '', die: 6, type: 'asset' }))}'>Add asset</button><button class="btn quiet small" data-act="pushItem" data-path="G.scene.temps" data-item='${esc(JSON.stringify({ name: '', die: 6, type: 'comp' }))}'>Add complication</button></div></section>`;
}
function orderPanel(S, G, pcs) {
  const mode = S.opt.turnMode || 'action';
  const actors = pcs.map(c => ({ id: c.id, name: c.name || 'Unnamed', pc: true })).concat(G.gmcs.filter(g => g.active).map(g => ({ id: g.id, name: g.name || (g.main && g.main.name) || 'GMC' })));
  G.order = G.order || []; G.init = G.init || {};
  const acted = new Set(G.order);
  if (mode === 'initiative') actors.sort((a, b) => (+(G.init[b.id] || 0)) - (+(G.init[a.id] || 0)));
  const label = { action: 'Action order', dramatic: 'Dramatic order', initiative: 'Initiative' }[mode];
  if (mode === 'dramatic') return `<div class="panel"><div class="bar">${label}</div><div class="in"><p class="small" style="margin:0">Whoever wants something leads: they start a contest and the other side tries to stop them. Vary the dramatic lead between contests. ${refTag('p.98')}</p></div></div>`;
  return `<div class="panel"><div class="bar">${label} · round ${G.round || 1}</div><div class="in"><ul class="orderlist">${actors.map(a => `<li><input type="checkbox" class="bubble" ${acted.has(a.id) ? 'checked' : ''} data-act="actToggle" data-id="${a.id}" aria-label="${esc(a.name)} has acted"><span class="grow ${acted.has(a.id) ? 'acted' : ''} ${a.pc ? 'k' : ''}">${esc(a.name)}</span>
      ${mode === 'initiative' ? `<input type="number" style="width:64px" value="${esc(G.init[a.id] || '')}" ${bindAttr('G.init.' + a.id)} data-type="num" data-re aria-label="Initiative">` : ''}</li>`).join('')}</ul>
    <div class="row" style="margin-top:8px"><button class="btn quiet small" data-act="nextRound">Next round</button></div>
    <p class="small muted" style="margin:6px 0 0">${mode === 'action' ? 'Whoever acts picks who goes next; the last to act picks who leads the next round.' : 'Highest goes first.'}</p></div></div>`;
}
A.addGMC = el => { const S = curS(), G = curG(); const g = newGMC(el.dataset.type, S); G.gmcs.unshift(g); OPEN[g.id] = true; save(); render(); };
A.dupGMC = el => { const G = curG(); const g = clone(G.gmcs[+el.dataset.i]); g.id = uid('g_'); g.name = (g.name || '') + ' 2'; G.gmcs.splice(+el.dataset.i + 1, 0, g); save(); render(); };
A.gmcOpp = el => { addOpp({ die: +el.dataset.die, label: el.dataset.label }); toast(`${el.dataset.label} added to the opposition`); };
A.gmcHinder = el => { const G = curG(); addOpp({ die: 4, label: el.dataset.label + ' (d4)' }); G.bank++; save(); toast('d4 added; +1 to the bank'); };
A.gmcMain = el => { const G = curG(); const g = G.gmcs[+el.dataset.i]; for (let k = 0; k < +g.main.count; k++) addOpp({ die: +g.main.die, label: g.main.name || g.name }); if (g.scale) addOpp({ die: +g.scale, label: 'Scale' }); toast('Added to the opposition'); };
A.gmcKnock = el => { const G = curG(); const g = G.gmcs[+el.dataset.i]; g.main.count = Math.max(0, +g.main.count - 1); save(); render(); toast(g.main.count ? `${g.name || g.main.name}: ${g.main.count} dice left` : `${g.name || g.main.name} is taken out`); };
A.gmcAddComp = el => { const S = curS(), G = curG(); const g = G.gmcs[+el.dataset.i]; promptBox('Complication on ' + (g.name || 'GMC'), 'Name (starts at d6)', '', n => { g.comps.push({ name: n || T(S, 'complication'), die: 6 }); save(); render(); }, 'Add'); };
A.gmcComp = el => { const G = curG(); const c = G.gmcs[+el.dataset.i].comps[+el.dataset.j]; const d = stepUp(c.die); if (d > 12) toast('Stepped past d12: taken out!', 'bad'); c.die = Math.min(12, d); save(); render(); };
A.gmcFill = el => {
  const S = curS(), G = curG(); const g = G.gmcs[+el.dataset.i]; const lvl = el.dataset.lvl;
  g.traits = [];
  S.sets.forEach(set => {
    if (set.kind !== 'fixed') return;
    set.traits.forEach((t, k) => {
      let d = defaultRating(S, set, k, 'scratch') || 6;
      if (set.create.mode === 'points') d = k % 3 === 0 ? 8 : k % 3 === 1 ? 6 : 4;
      if (set.create.mode === 'array') d = (ROLE_ARRAYS[set.traits.length] || set.create.array || [])[k] || 6;
      if (lvl === 'light') d = stepDown(d) || 4;
      if (lvl === 'heavy' && k === 0) d = Math.min(12, stepUp(d));
      if (set.create.mode === 'points' && lvl === 'light' && d < 6) return;
      g.traits.push({ id: uid('gt_'), name: t.name, die: d, group: set.name });
    });
  });
  save(); render(); toast('Filled at ' + lvl + ' strength. Adjust as needed.');
};
A.doomStep = el => { const G = curG(); const i = +el.dataset.i; G.doom[i] = Math.min(12, stepUp(G.doom[i])); save(); render(); };
A.doomAdd = el => { const G = curG(); G.doom.push(+el.dataset.die); G.doom.sort((a, b) => a - b); save(); render(); };
A.doomReset = () => { const S = curS(), G = curG(); G.doom = clone(S.opt.doomStart || [6, 6]); save(); render(); };
A.doomRoll = () => { POOL.useDoom = true; DB.ui.oppMode = 'dice'; DB.ui.tab = 'dice'; A.rollOpp(); };
A.crisisAdd = el => { const G = curG(); G.crisis[+el.dataset.i].dice.push(+el.dataset.die); save(); render(); };
A.crisisDie = el => { const G = curG(); const c = G.crisis[+el.dataset.i]; const j = +el.dataset.j; const d = stepDown(c.dice[j]); if (!d) c.dice.splice(j, 1); else c.dice[j] = d; save(); render(); };
A.crisisRoll = el => { const G = curG(); const c = G.crisis[+el.dataset.i]; POOL.oppBase = []; POOL.useDoom = false; POOL.opp = c.dice.map(d => ({ id: uid('po_'), die: d, label: c.name || 'Crisis' })); DB.ui.oppMode = 'dice'; DB.ui.tab = 'dice'; A.rollOpp(); };
A.pcPP = el => { const c = DB.chars[el.dataset.id]; c.pp = Math.max(0, c.pp + (+el.dataset.n)); touch(c); render(); };
A.actToggle = el => { const G = curG(); const i = G.order.indexOf(el.dataset.id); if (i >= 0) G.order.splice(i, 1); else G.order.push(el.dataset.id); save(); render(); };
A.nextRound = () => { const G = curG(); G.order = []; G.round = (G.round || 1) + 1; save(); render(); };
A.beat = el => { const G = curG(); const i = +el.dataset.i; G.timed.used = G.timed.used === i + 1 ? i : i + 1; save(); render(); };
A.sceneToPool = el => { const G = curG(); const x = el.dataset.k === 'dist' ? { die: 8, name: G.scene.dists[+el.dataset.i].name } : G.scene.temps[+el.dataset.i]; addPool({ die: +x.die, label: x.name || 'Scene' }); toast('Added to your pool'); };
A.sceneToOpp = el => { const G = curG(); const x = el.dataset.k === 'dist' ? { die: 8, name: G.scene.dists[+el.dataset.i].name } : G.scene.temps[+el.dataset.i]; addOpp({ die: +x.die, label: x.name || 'Scene' }); toast('Added to the opposition'); };
A.gmNewSession = () => {
  const S = curS(), G = curG(); const pcs = charsOf(S);
  confirmBox(`Start a new session? ${on(S, 'doom') ? `The ${(S.opt.doomName || 'doom pool').toLowerCase()} resets` : `The bank becomes ${pcs.length}`}, and every character's ${T(S, 'pps').toLowerCase()}, resources, shut-down powers and callbacks refresh.`, () => {
    if (on(S, 'doom')) G.doom = clone(S.opt.doomStart || [6, 6]); else G.bank = pcs.length;
    pcs.forEach(c => { sessionReset(S, c); touch(c); });
    G.scene = { dists: [], temps: [] }; G.order = []; G.round = 1;
    save(); render(); toast('New session started');
  }, 'Start session');
};
A.gmNewScene = () => {
  const S = curS(), G = curG(); const pcs = charsOf(S);
  openModal('New scene', `<p class="prose small">Clears scene distinctions and scene ${esc(T(S, 'asset').toLowerCase())}s, and every character's scene ${esc(T(S, 'asset').toLowerCase())}s.</p>${on(S, 'stress') ? chkRaw('gnsRest', `Rest scene: step everyone's ${esc(T(S, 'stress').toLowerCase())} down by one`) : ''}`, { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="gnsGo">Start scene</button>` });
  $('#gnsGo').onclick = () => {
    const rest = $('#gnsRest') && $('#gnsRest').checked;
    G.scene = { dists: [], temps: [] }; G.order = []; G.round = 1;
    pcs.forEach(c => { c.temps = c.temps.filter(t => !(t.type === 'asset' && t.scope !== 'session')); if (rest) Object.keys(c.stress).forEach(k => { c.stress[k] = stepDown(+c.stress[k]); }); touch(c); });
    closeModal(); save(); render(); toast('New scene');
  };
};
