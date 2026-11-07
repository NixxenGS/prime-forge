/* ============ Setting Designer ============ */
const OPEN = {};   // transient expanders
function dsecs(S) {
  const has = k => S.sets.some(x => x.kind === k);
  const L = [
    { grp: 'Setting' },
    { id: 'identity', label: 'Identity' },
    { id: 'traits', label: 'Trait sets', cnt: S.sets.length },
    { id: 'distinctions', label: T(S, 'distinctions'), cnt: S.dist.library.length || '' },
    { grp: 'Libraries' },
    has('powersets') && { id: 'lib_powersets', label: 'Power sets', cnt: S.lib.powersets.length || '' },
    has('abilities') && { id: 'lib_abilities', label: 'Abilities', cnt: S.lib.abilities.length || '' },
    has('talents') && { id: 'lib_talents', label: 'Talents', cnt: S.lib.talents.length || '' },
    S.creation.methods.archetypes && { id: 'lib_archetypes', label: 'Archetypes', cnt: S.lib.archetypes.length || '' },
    { id: 'lib_sfx', label: T(S, 'sfx') + ' library', cnt: S.lib.sfx.length || '' },
    { grp: 'Big Menu of Mods' },
    ...MOD_CATS.map(c => ({ id: 'mods_' + c.id, label: c.name, cnt: MODS.filter(m => m.cat === c.id && S.mods[m.id] && !m.always).length || '' })),
    { grp: 'Players' },
    { id: 'creation', label: 'Character creation' },
    { id: 'terms', label: 'Terminology' },
    { id: 'review', label: 'Review & share', cnt: designerWarnings(S).length ? '!' : '' }
  ];
  return L.filter(Boolean);
}
VIEWS.designer = () => {
  const S = curS(); if (!S) return VIEWS.vault();
  const secs = dsecs(S);
  if (!secs.some(x => x.id === DB.ui.dsec)) DB.ui.dsec = 'identity';
  const nav = secs.map(x => x.grp ? `<div class="grp">${esc(x.grp)}</div>` : `<button data-act="dsec" data-id="${x.id}" aria-current="${DB.ui.dsec === x.id}"><span>${esc(x.label)}</span><span class="cnt">${x.cnt || ''}</span></button>`).join('');
  const body = (DSEC[DB.ui.dsec] || DSEC.identity)(S);
  return `<div class="pagehead"><div class="row">${emblem(S, 54)}<div><h1>${esc(S.name || 'Untitled setting')}</h1><p class="lede" style="margin-top:2px">Setting designer</p></div></div>
    <div class="acts"><button class="btn ghost" data-act="go" data-tab="chars">Characters</button><button class="btn quiet" data-act="previewBlank">Blank character file</button></div></div>
    <div class="split"><nav class="sidenav" aria-label="Designer sections">${nav}</nav><div class="dbody">${body}</div></div>`;
};
A.dsec = el => { DB.ui.dsec = el.dataset.id; window.scrollTo(0, 0); render(); };
const DSEC = {};

/* ---------- identity ---------- */
DSEC.identity = S => `<section class="sec"><div class="sec-head"><h2>Identity</h2></div>
  <div class="g2"><label class="fld"><span>Setting name</span>${inp('S.name', S.name, { re: true, ph: 'e.g. Ashen Crown' })}</label>
  <label class="fld"><span>Tagline</span>${inp('S.tagline', S.tagline, { ph: 'One line that sells the setting' })}</label></div>
  <label class="fld" style="margin-top:12px"><span>Pitch</span>${area('S.pitch', S.pitch, { rows: 4, ph: 'What the game is about, who the characters are, and what they do.' })}</label>
  <label class="fld" style="margin-top:12px"><span>Notes for players</span>${area('S.notes', S.notes, { rows: 5, ph: 'Tone, house rules, what to know before making a character. Shown in the setting guide.' })}</label>
  </section>
  <section class="sec"><h3>Where to next</h3><p class="prose">Pick the trait sets that make up a character in this setting, then switch on mods from the Big Menu.</p>
  <div class="row"><button class="btn" data-act="dsec" data-id="traits">Choose trait sets</button><button class="btn ghost" data-act="dsec" data-id="mods_dice">Open the Big Menu of Mods</button></div></section>`;

/* ---------- trait sets ---------- */
DSEC.traits = S => {
  const primes = S.sets.filter(x => x.prime && x.kind !== 'distinctions');
  const has = f => S.sets.some(x => x.flavor === f);
  const cards = FLAVOR_ORDER.map(f => {
    const F = FLAVORS[f]; const isOn = !f.startsWith('custom') && has(f);
    return `<button class="setcard ${isOn ? 'on' : ''}" data-act="toggleFlavor" data-f="${f}" aria-pressed="${isOn}">
      <input type="checkbox" class="bubble" tabindex="-1" ${isOn ? 'checked' : ''} aria-hidden="true">
      <div><div class="nm">${esc(F.label)} ${f.startsWith('custom') ? '<span class="tag ink">add</span>' : ''}</div><div class="sm">${esc(F.blurb)}</div>${F.ref ? refTag(F.ref) : ''}</div></button>`;
  }).join('');
  const blocks = S.sets.map((set, i) => set.kind === 'distinctions' ? distBlockMini(S, set, i) : setBlock(S, set, i)).join('');
  return `<section class="sec"><div class="sec-head"><h2>Trait sets</h2>${refTag('p.46–66')}</div>
    <p class="prose">Every character has ${esc(T(S, 'distinctions').toLowerCase())}. Add at least two more <b>prime sets</b>: the sets nearly every dice pool draws one trait from. Other sets (signature assets, resources, talents) add extra dice and tricks.</p>
    <p class="small ${primes.length >= 2 ? 'muted' : ''}" style="color:${primes.length >= 2 ? '' : 'var(--warn)'}">Prime sets besides ${esc(T(S, 'distinctions').toLowerCase())}: <b>${primes.length ? primes.map(p => esc(p.name)).join(', ') : 'none yet'}</b>${primes.length < 2 ? ' (the handbook recommends at least two)' : ''}</p>
    <h3 style="margin-top:16px">Add or remove sets</h3><div class="setcards">${cards}</div></section>
    <section class="sec"><div class="sec-head"><h2>This setting's file</h2><span class="small muted">Order here is the order on the character file.</span></div>${blocks}</section>`;
};
function distBlockMini(S, set, i) {
  return `<div class="setblock"><header>${moveBtns('S.sets', i)}<span class="disp" style="font-size:18px;text-transform:uppercase">${esc(set.name)}</span><span class="tag">Prime · always on</span><span class="grow"></span><button class="btn quiet small" data-act="dsec" data-id="distinctions">Configure</button></header>
    <div class="body small muted">${set.create.count} per character, ${S.dist.rated === 'fixed' ? 'rated d8' : 'rated d4–d12 averaging d8'}${S.dist.highlightSet ? ', each highlighting ' + S.dist.highlightCount + ' traits' : ''}. Library: ${plural(S.dist.library.length, 'pre-built ' + T(S, 'distinction').toLowerCase())}.</div></div>`;
}
function moveBtns(path, i) { return RO ? '' : `<span class="row" style="gap:0"><button class="icon-btn sm" data-act="moveItem" data-path="${path}" data-i="${i}" data-dir="-1" aria-label="Move up">↑</button><button class="icon-btn sm" data-act="moveItem" data-path="${path}" data-i="${i}" data-dir="1" aria-label="Move down">↓</button></span>`; }
function setBlock(S, set, i) {
  const p = `S.sets.${i}`; const F = FLAVORS[set.flavor] || {};
  const modes = set.kind === 'fixed' ? ['trade', 'points', 'array', 'peaks', 'free'] : set.kind === 'open' ? ['peaks', 'pool', 'count', 'free'] : set.kind === 'powersets' ? ['powers', 'free'] : set.kind === 'resources' ? ['pool', 'free'] : ['count', 'free'];
  let traits = '';
  if (set.kind === 'fixed') {
    traits = `<div class="lbl" style="margin:12px 0 4px">Traits (${set.traits.length})</div>
      ${set.traits.map((t, j) => `<div class="traitrow"><span class="num">${j + 1}</span>
        <input value="${esc(t.name)}" placeholder="Trait name" ${bindAttr(`${p}.traits.${j}.name`)} data-re>
        <input class="tdesc" value="${esc(t.desc)}" placeholder="What it covers" ${bindAttr(`${p}.traits.${j}.desc`)}>
        <span class="row" style="gap:0">${set.sfx ? `<button class="btn quiet small" data-act="openToggle" data-k="${t.id}">${T(S, 'sfx')} ${t.sfx.length || ''}</button>` : ''}${moveBtns(`${p}.traits`, j)}<button class="icon-btn sm" data-act="delItem" data-path="${p}.traits" data-i="${j}" aria-label="Remove trait">✕</button></span></div>
        ${set.sfx && OPEN[t.id] ? `<div style="margin:4px 0 10px 36px">${sfxEditor(`${p}.traits.${j}.sfx`, t.sfx, S)}</div>` : ''}`).join('')}
      <div class="row" style="margin-top:8px"><button class="btn ghost small" data-act="addTrait" data-i="${i}">Add trait</button><button class="btn quiet small" data-act="bulkTraits" data-i="${i}">Paste a list</button>
      ${set.flavor === 'roles' && (set.traits.length < 3 || set.traits.length > 6) ? '<span class="small" style="color:var(--warn)">Roles work best with 3 to 6 entries.</span>' : ''}</div>`;
  } else if (set.kind === 'open') traits = `<p class="small muted" style="margin:10px 0 0">Players write their own entries for this set.</p>`;
  else if (set.kind === 'powersets' || set.kind === 'abilities' || set.kind === 'talents') traits = `<p class="small muted" style="margin:10px 0 0">Players pick from your <button class="linkbtn" data-act="dsec" data-id="lib_${set.kind}">${esc(set.kind === 'powersets' ? 'power set' : set.kind === 'abilities' ? 'ability' : 'talent')} library</button> or write their own.</p>`;
  else if (set.kind === 'resources') traits = `<p class="small muted" style="margin:10px 0 0">Each resource is an extra, location, organization or prop with two tags and a few dice that get spent.</p>`;

  const opts = [];
  if (set.kind === 'fixed' || set.kind === 'open') {
    opts.push(chk(`${p}.statements`, set.statements, `Trait statements ${refTag('p.65')}`));
    if (set.flavor !== 'sigassets') opts.push(chk(`${p}.sfx`, set.sfx, `${esc(T(S, 'sfx'))} on this set ${refTag('p.61')}`));
    else opts.push(chk(`${p}.sfx`, set.sfx, `Signature assets can carry ${esc(T(S, 'sfx'))} ${refTag('p.64')}`));
  }
  if (set.kind === 'fixed') {
    opts.push(chk(`${p}.specialties`, set.specialties, `Specialties inside these traits ${refTag('p.59')}`));
    if (set.specialties) {
      opts.push(`<div class="row" style="padding-left:28px"><label class="fld" style="min-width:220px"><span>Free specialty with this trait (at d6+)</span>${sel(`${p}.freeSpec`, set.freeSpec, [['', 'None']].concat(set.traits.map(t => [t.id, t.name || 'Unnamed'])))}</label></div>`);
      opts.push(`<div style="padding-left:28px">${chk('S.spec.multiLevel', S.spec.multiLevel, `Multi-level specialties (applies to all sets) ${refTag('p.59')}`)}</div>`);
      opts.push(`<div style="padding-left:28px">${chk(`${p}.split`, set.split, `Skill and specialty split: traits cap at d6, specialties go higher ${refTag('p.59')}`)}</div>`);
    }
    if (set.create.mode === 'points') opts.push(chk(`${p}.pyramid`, set.pyramid, `Skill pyramid ${refTag('p.59')}`));
  }
  const g = GUIDES[F.guide];
  return `<div class="setblock" id="blk-${set.id}"><header>${moveBtns('S.sets', i)}
      <input class="title" value="${esc(set.name)}" aria-label="Set name" ${bindAttr(`${p}.name`)} data-re>
      <span class="tag ink">${esc(F.label || set.flavor)}</span>
      <label class="check" style="align-items:center"><input type="checkbox" class="bubble" ${set.prime ? 'checked' : ''} ${bindAttr(`${p}.prime`)} data-re><span class="small k">Prime set</span></label>
      <span class="grow"></span>${refTag(F.ref)}
      <button class="icon-btn" data-act="delSet" data-i="${i}" aria-label="Remove set">✕</button></header>
    <div class="body">
      <label class="fld"><span>Description</span>${area(`${p}.desc`, set.desc, { rows: 2, ph: F.blurb })}</label>
      ${traits}
      <div class="g2" style="margin-top:14px"><div><div class="lbl">Character creation</div>
        <div style="margin-top:4px">${sel(`${p}.create.mode`, set.create.mode, modes.map(m => [m, CREATE_MODES[m]]))}</div>
        <div style="margin-top:8px">${createFields(S, set, p)}</div></div>
        <div><div class="lbl">Trait mods</div><div class="stack" style="margin-top:6px">${opts.join('') || '<span class="small muted">None for this kind of set.</span>'}</div>
        ${g ? `<div class="small muted" style="margin-top:10px">${DICE.filter(d => g[d]).map(d => `${dlabel(d)} ${esc(g[d])}`).join(' · ')}</div>` : ''}</div></div>
    </div></div>`;
}
function createFields(S, set, p) {
  const c = set.create; const P = `${p}.create`;
  const ds = (k, label, min = 4) => `<label class="fld"><span>${label}</span>${dieSelect(`${P}.${k}`, c[k], { min })}</label>`;
  const num = (k, label) => `<label class="fld"><span>${label}</span>${inp(`${P}.${k}`, c[k], { type: 'number' })}</label>`;
  switch (c.mode) {
    case 'trade': return `<div class="g3">${ds('baseline', 'Start die')}${num('baseCount', 'How many start there')}${ds('extraBaseline', 'Start die for the rest')}${ds('min', 'Lowest at creation')}${ds('max', 'Highest at creation')}${ds('pathStart', 'Pathways start die')}</div><p class="small muted">Characters may step one trait up by stepping another down.</p>`;
    case 'points': return `<div class="g3">${ds('base', 'Base die')}${num('points', 'Points to spend')}${ds('cap', 'Highest at creation')}</div><p class="small muted">One point steps a trait up once. Highlight steps from ${esc(T(S, 'distinctions').toLowerCase())} are free.</p>`;
    case 'array': return `${chk(`${P}.auto`, c.auto, 'Use the handbook spread for the number of traits (3: d10 d8 d4 … 6: d10 d8 d6 d6 d6 d4)')}
      ${c.auto ? '' : `<label class="fld" style="margin-top:8px"><span>Dice to assign (comma separated)</span><input value="${esc((c.array || []).join(', '))}" ${bindAttr(`${P}.array`)} data-type="csvnum"></label>`}`;
    case 'peaks': return `<div class="g3"><label class="fld"><span>High dice</span><input value="${esc((c.peaks || []).join(', '))}" ${bindAttr(`${P}.peaks`)} data-type="csvnum"></label>${ds('fill', 'Everything else')}${ds('cap', 'Highest at creation')}</div>`;
    case 'pool': return `<div class="g3">${set.kind === 'resources' ? '' : ds('startDie', 'Starts at')}${set.kind === 'resources' ? '' : num('entryCost', 'Cost per entry')}${set.kind === 'resources' ? '' : ds('cap', 'Highest at creation')}</div><p class="small muted">${set.kind === 'resources' ? '1 point buys a 2d6 resource; more points add a die or step them up.' : 'Each step above the start die costs another point.'} Paid from ${esc(S.creation.poolName.toLowerCase())} (${S.creation.pool}).</p>`;
    case 'count': return `<div class="g3">${num('count', 'Entries per character')}${set.kind === 'talents' ? '' : ds('startDie', 'Typical die')}${set.kind === 'abilities' ? num('freeSfx', 'Free SFX each') : ''}${set.kind === 'talents' ? '' : ds('cap', 'Highest at creation')}</div>`;
    case 'powers': return `<div class="g4">${num('sets', 'Power sets each')}${num('sfxPerSet', 'SFX per set')}${num('limitsPerSet', 'Limits per set')}${ds('cap', 'Highest power', 6)}</div><p class="small muted">Characters get d8 powers equal to their number of sets plus one; more steps come from ${esc(S.creation.poolName.toLowerCase())}.</p>`;
  }
  return '<p class="small muted">Characters assign dice freely.</p>';
}
A.toggleFlavor = el => {
  const S = curS(); const f = el.dataset.f;
  if (!f.startsWith('custom')) {
    const i = S.sets.findIndex(x => x.flavor === f);
    if (i >= 0) { confirmBox(`Remove ${S.sets[i].name} from this setting? Characters keep their old data but it won't show.`, () => { S.sets.splice(i, 1); touch(S); render(); }, 'Remove'); return; }
  }
  const set = newSet(f);
  if (f === 'skills' && S.sets.some(x => x.flavor === 'roles')) set.prime = false;
  S.sets.push(set); touch(S); render();
  setTimeout(() => { const b = $('#blk-' + set.id); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
};
A.delSet = el => { const S = curS(); const i = +el.dataset.i; confirmBox(`Remove ${S.sets[i].name}?`, () => { S.sets.splice(i, 1); touch(S); render(); }, 'Remove'); };
A.addTrait = el => { const S = curS(); const set = S.sets[+el.dataset.i]; set.traits.push(newTrait('')); touch(S); render(); setTimeout(() => { const ins = $$(`#blk-${set.id} .traitrow input`); const last = ins[ins.length - 2]; if (last) last.focus(); }, 20); };
A.bulkTraits = el => {
  const S = curS(); const set = S.sets[+el.dataset.i];
  openModal('Paste traits', `<p class="prose small">One trait per line. Add a description after a colon, like <i>Notice: spotting what others miss</i>.</p><textarea id="bulkIn" rows="10"></textarea>`,
    { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="bulkGo">Add traits</button>` });
  $('#bulkGo').onclick = () => {
    $('#bulkIn').value.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => { const [n, ...d] = line.split(':'); const t = newTrait(n.trim()); t.desc = d.join(':').trim(); set.traits.push(t); });
    closeModal(); touch(S); render();
  };
};
A.openToggle = el => { OPEN[el.dataset.k] = !OPEN[el.dataset.k]; render(); };


/* ---------- SFX editor ---------- */
function sfxEditor(path, list, S, { unlock = false } = {}) {
  list = list || [];
  return `<div class="sfxed">${list.map((x, k) => `<div class="sfxrow">
      ${unlock ? `<input type="checkbox" class="bubble" title="Unlocked" ${x.unlocked ? 'checked' : ''} ${bindAttr(`${path}.${k}.unlocked`)} data-re>` : '<span class="ref" style="padding-top:8px">SFX</span>'}
      <input value="${esc(x.name)}" placeholder="Name" ${bindAttr(`${path}.${k}.name`)}>
      <textarea class="sfxtext" rows="1" placeholder="Trigger, cost and benefit" ${bindAttr(`${path}.${k}.text`)}>${esc(x.text)}</textarea>
      <button class="icon-btn sm" data-act="delItem" data-path="${path}" data-i="${k}" aria-label="Remove SFX"${dis()}>✕</button></div>`).join('')}
    ${RO ? '' : `<div class="row" style="margin-top:6px"><button class="btn ghost small" data-act="pushItem" data-path="${path}" data-item='${esc(JSON.stringify({ name: '', text: '', unlocked: false }))}'>Add ${esc(T(S, 'sfx'))}</button>
      <button class="btn quiet small" data-act="sfxStd" data-path="${path}">Standard six</button>
      <button class="btn quiet small" data-act="sfxWorkshop" data-path="${path}">Workshop</button>
      ${S.lib.sfx.length ? `<button class="btn quiet small" data-act="sfxLib" data-path="${path}">From library</button>` : ''}</div>`}</div>`;
}
function appendSfx(path, items) {
  const [root, p, r] = rootAndPath({ dataset: { path } });
  const arr = getPath(root, p) || []; items.forEach(x => arr.push(Object.assign({ id: uid('x_'), unlocked: false }, x))); setPath(root, p, arr);
  if (r === 'S' || r === 'C') touch(root);
}
A.sfxStd = el => {
  const path = el.dataset.path; const S = curS();
  openModal('Standard SFX', `<p class="prose small">Six all-purpose SFX for when you need one in a pinch ${refTag('p.63')}. Click to add, then reword for the trait.</p>
    ${STD_SFX.map((x, k) => `<button class="setcard" style="width:100%;margin-top:8px" data-act="sfxStdPick" data-k="${k}" data-path="${esc(path)}"><div><div class="nm">${esc(x.name)}</div><div class="sm">${esc(x.text.replace(/PP/g, T(S, 'ppAbbr')))}</div></div></button>`).join('')}`, { wide: false });
};
A.sfxStdPick = el => { const x = STD_SFX[+el.dataset.k]; const S = curS(); appendSfx(el.dataset.path, [{ name: x.name.replace(/^The /, ''), text: x.text.replace(/PP/g, T(S, 'ppAbbr')) }]); closeModal(); render(); };
A.sfxLib = el => {
  const S = curS(); const path = el.dataset.path;
  openModal(T(S, 'sfx') + ' library', S.lib.sfx.map((x, k) => `<button class="setcard" style="width:100%;margin-top:8px" data-act="sfxLibPick" data-k="${k}" data-path="${esc(path)}"><div><div class="nm">${esc(x.name || 'Unnamed')}</div><div class="sm">${esc(x.text)}</div></div></button>`).join(''));
};
A.sfxLibPick = el => { const S = curS(); const x = S.lib.sfx[+el.dataset.k]; appendSfx(el.dataset.path, [{ name: x.name, text: x.text }]); closeModal(); render(); };
A.sfxWorkshop = el => {
  const path = el.dataset.path; const S = curS(); const pp = T(S, 'ppAbbr');
  openModal(T(S, 'sfx') + ' workshop', `<p class="prose small">An SFX is a cost plus a benefit, often with a trigger ${refTag('p.62')}.</p>
    <div class="stack"><label class="fld"><span>Name</span><input id="wsName" placeholder="e.g. Lightning Reflexes"></label>
    <label class="fld"><span>Trigger (optional)</span><input id="wsTrig" placeholder="e.g. When you fight more than one foe"></label>
    <div class="g2"><label class="fld"><span>Cost</span><select id="wsCost">${SFX_COSTS.map(x => `<option>${esc(x.replace(/PP/g, pp))}</option>`).join('')}</select></label>
    <label class="fld"><span>Benefit</span><select id="wsBen">${SFX_BENEFITS.map(x => `<option>${esc(x.replace(/PP/g, pp))}</option>`).join('')}</select></label></div>
    <label class="fld"><span>Trait to name in the benefit (if it says [trait])</span><input id="wsTrait" placeholder="e.g. FIGHT"></label>
    <label class="fld"><span>Result (edit freely)</span><textarea id="wsOut" rows="3"></textarea></label></div>`,
    { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="wsAdd">Add SFX</button>` });
  const build = () => {
    const trig = $('#wsTrig').value.trim(); let cost = $('#wsCost').value; let ben = $('#wsBen').value.replace('[trait]', $('#wsTrait').value.trim() || 'a trait');
    let s;
    if (/^earn/i.test(ben)) s = `Earn a ${pp} ${trig ? trig.replace(/^when/i, 'when') : 'when [condition]'}.`;
    else if (cost.startsWith('(no cost)')) s = `${trig ? trig + ', ' : ''}${ben}.`;
    else s = `${trig ? trig + ', ' : ''}${cost} ${ben}.`;
    s = s.charAt(0).toUpperCase() + s.slice(1);
    $('#wsOut').value = s;
  };
  ['wsTrig', 'wsCost', 'wsBen', 'wsTrait'].forEach(id => { $('#' + id).addEventListener('input', build); $('#' + id).addEventListener('change', build); });
  build();
  $('#wsAdd').onclick = () => { appendSfx(path, [{ name: $('#wsName').value.trim() || 'New SFX', text: $('#wsOut').value.trim() }]); closeModal(); render(); };
};

/* ---------- distinctions ---------- */
DSEC.distinctions = S => {
  const ds = distSet(S); const di = S.sets.indexOf(ds);
  const fixedSets = S.sets.filter(x => x.kind === 'fixed');
  const hs = byId(S.sets, S.dist.highlightSet);
  const lib = S.dist.library.map((d, k) => {
    const p = `S.dist.library.${k}`;
    return `<div class="libitem"><div class="row"><input class="grow" style="font-family:var(--f-display);font-weight:700;text-transform:uppercase" value="${esc(d.name)}" placeholder="${esc(T(S, 'distinction'))} name" ${bindAttr(p + '.name')}>
      ${moveBtns('S.dist.library', k)}<button class="icon-btn" data-act="delItem" data-path="S.dist.library" data-i="${k}" aria-label="Remove">✕</button></div>
      <label class="fld" style="margin-top:6px"><span>Description</span>${area(p + '.desc', d.desc, { rows: 1, ph: 'One or two sentences of context.' })}</label>
      ${hs ? `<div class="row" style="margin-top:8px"><span class="lbl">Highlights</span>${Array.from({ length: +S.dist.highlightCount || 0 }).map((_, h) => sel(`${p}.hl.${h}`, (d.hl || [])[h] || '', [['', '—']].concat(hs.traits.map(t => [t.id, t.name || 'Unnamed'])), { re: false })).join('')}</div>` : ''}
      <div style="margin-top:8px"><div class="lbl">${esc(T(S, 'sfx'))} beyond Hinder</div>${sfxEditor(p + '.sfx', d.sfx, S)}</div></div>`;
  }).join('');
  return `<section class="sec"><div class="sec-head"><h2>${esc(T(S, 'distinctions'))}</h2>${refTag('p.50')}</div>
    <p class="prose">The universal trait set. Each one carries the Hinder ${esc(T(S, 'sfx'))}: gain a ${esc(T(S, 'pp').toLowerCase())} when you roll it as a d4 instead of a d8.</p>
    <div class="g3"><label class="fld"><span>Set name on the file</span>${inp(`S.sets.${di}.name`, ds.name, { re: true })}</label>
    <label class="fld"><span>Per character</span>${inp(`S.sets.${di}.create.count`, ds.create.count, { type: 'number' })}</label>
    <label class="fld"><span>Ratings</span>${sel('S.dist.rated', S.dist.rated, [['fixed', 'Always d8'], ['variable', 'd4–d12, averaging d8']])}</label></div>
    <div class="g2" style="margin-top:12px"><label class="fld"><span>Highlight traits from ${refTag('p.50')}</span>${sel('S.dist.highlightSet', S.dist.highlightSet, [['', 'No highlights']].concat(fixedSets.map(x => [x.id, x.name])))}</label>
    ${S.dist.highlightSet ? `<label class="fld"><span>Highlights per ${esc(T(S, 'distinction').toLowerCase())}</span>${inp('S.dist.highlightCount', S.dist.highlightCount, { type: 'number', re: true })}</label>` : '<div></div>'}</div>
    <div style="margin-top:12px">${chk('S.dist.libOnly', S.dist.libOnly, 'Players choose only from the library below (no custom ones)')}</div></section>
    <section class="sec"><div class="sec-head"><h2>Library</h2><span class="small muted">Optional pre-built ${esc(T(S, 'distinctions').toLowerCase())} players can pick.</span></div>
    ${lib || `<div class="empty"><p>No pre-built ${esc(T(S, 'distinctions').toLowerCase())} yet. Players will write their own.</p></div>`}
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="pushItem" data-path="S.dist.library" data-item='${esc(JSON.stringify({ name: '', desc: '', hl: [], sfx: [] }))}'>Add ${esc(T(S, 'distinction').toLowerCase())}</button></div></section>`;
};

/* ---------- libraries ---------- */
function libHead(S, title, ref, blurb) { return `<div class="sec-head"><h2>${esc(title)}</h2>${refTag(ref)}</div><p class="prose">${blurb}</p>`; }
DSEC.lib_powersets = S => {
  const items = S.lib.powersets.map((ps, k) => {
    const p = `S.lib.powersets.${k}`;
    return `<div class="libitem"><div class="row"><input class="grow" style="font-family:var(--f-display);font-weight:700;text-transform:uppercase" value="${esc(ps.name)}" placeholder="Power set name (its origin or theme)" ${bindAttr(p + '.name')}>${moveBtns('S.lib.powersets', k)}<button class="icon-btn" data-act="delItem" data-path="S.lib.powersets" data-i="${k}" aria-label="Remove">✕</button></div>
      <label class="fld" style="margin-top:6px"><span>Description</span>${area(p + '.desc', ps.desc, { rows: 1 })}</label>
      <div class="lbl" style="margin-top:10px">Powers</div>
      ${(ps.powers || []).map((pw, j) => `<div class="row" style="margin-top:4px"><input class="grow" value="${esc(pw.name)}" placeholder="Power" ${bindAttr(`${p}.powers.${j}.name`)}>${diePick(`${p}.powers.${j}.die`, pw.die, { min: 6 })}<button class="icon-btn sm" data-act="delItem" data-path="${p}.powers" data-i="${j}" aria-label="Remove power">✕</button></div>`).join('')}
      <button class="btn ghost small" style="margin-top:6px" data-act="pushItem" data-path="${p}.powers" data-item='${esc(JSON.stringify({ name: '', die: 8 }))}'>Add power</button>
      <div class="g2" style="margin-top:12px"><div><div class="lbl">${esc(T(S, 'sfx'))}</div>${sfxEditor(p + '.sfx', ps.sfx, S)}</div>
      <div><div class="lbl">${esc(T(S, 'limit'))}s ${refTag('p.63')}</div>${sfxEditor(p + '.limits', ps.limits, S)}</div></div></div>`;
  }).join('');
  return `<section class="sec">${libHead(S, 'Power set library', 'p.52', 'Pre-built power sets players can take as-is or tweak. A power set needs at least one SFX and one limit; limits usually earn a ' + esc(T(S, 'pp').toLowerCase()) + ' by shutting the set down until a recovery condition.')}
    ${items || '<div class="empty"><p>No power sets yet.</p></div>'}
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="pushItem" data-path="S.lib.powersets" data-item='${esc(JSON.stringify({ name: '', desc: '', powers: [{ name: '', die: 8 }], sfx: [], limits: [] }))}'>Add power set</button></div></section>`;
};
DSEC.lib_abilities = S => {
  const items = S.lib.abilities.map((a, k) => {
    const p = `S.lib.abilities.${k}`;
    return `<div class="libitem"><div class="row"><input class="grow" style="font-family:var(--f-display);font-weight:700;text-transform:uppercase" value="${esc(a.name)}" placeholder="Ability name" ${bindAttr(p + '.name')}>${diePick(p + '.die', a.die, { min: 6 })}${moveBtns('S.lib.abilities', k)}<button class="icon-btn" data-act="delItem" data-path="S.lib.abilities" data-i="${k}" aria-label="Remove">✕</button></div>
      <div class="g2" style="margin-top:6px"><label class="fld"><span>Effect tag</span>${sel(p + '.effect', a.effect, POWER_EFFECTS, { re: false })}</label><label class="fld"><span>Descriptor</span>${inp(p + '.descriptor', a.descriptor, { ph: 'e.g. Lightning Bolt' })}</label></div>
      <label class="fld" style="margin-top:6px"><span>Description</span>${area(p + '.desc', a.desc, { rows: 1 })}</label>
      <div style="margin-top:8px"><div class="lbl">${esc(T(S, 'sfx'))} (players unlock ${FLAVORS.abilities.create.freeSfx} free)</div>${sfxEditor(p + '.sfx', a.sfx, S)}</div></div>`;
  }).join('');
  return `<section class="sec">${libHead(S, 'Ability library', 'p.54', 'Each ability is one rated trait with its own SFX list. Effect tags suggest how it rolls: Attack, Sensory, Movement, Control, Defense or Enhancement.')}
    ${items || '<div class="empty"><p>No abilities yet.</p></div>'}
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="pushItem" data-path="S.lib.abilities" data-item='${esc(JSON.stringify({ name: '', die: 8, effect: 'Enhancement', descriptor: '', desc: '', sfx: [] }))}'>Add ability</button></div></section>`;
};
DSEC.lib_talents = S => {
  const items = S.lib.talents.map((t, k) => {
    const p = `S.lib.talents.${k}`;
    return `<div class="libitem"><div class="row"><input class="grow" style="font-family:var(--f-display);font-weight:700;text-transform:uppercase" value="${esc(t.name)}" placeholder="Talent name" ${bindAttr(p + '.name')}>${inp(p + '.group', t.group, { ph: 'Group (optional)', extra: 'style="max-width:200px"' })}${moveBtns('S.lib.talents', k)}<button class="icon-btn" data-act="delItem" data-path="S.lib.talents" data-i="${k}" aria-label="Remove">✕</button></div>
      <label class="fld" style="margin-top:6px"><span>Description</span>${area(p + '.desc', t.desc, { rows: 1 })}</label>
      <div class="g2" style="margin-top:6px"><label class="fld"><span>Activation</span>${area(p + '.activation', t.activation, { rows: 2, ph: 'Cost or trigger' })}</label><label class="fld"><span>Effect</span>${area(p + '.effect', t.effect, { rows: 2, ph: 'Benefit' })}</label></div></div>`;
  }).join('');
  return `<section class="sec">${libHead(S, 'Talent library', 'p.66', 'Unrated tricks written as Activation and Effect. Group them by profession, culture or background so they\'re easy to skim.')}
    ${items || '<div class="empty"><p>No talents yet.</p></div>'}
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="pushItem" data-path="S.lib.talents" data-item='${esc(JSON.stringify({ name: '', group: '', desc: '', activation: '', effect: '' }))}'>Add talent</button></div></section>`;
};
DSEC.lib_sfx = S => {
  return `<section class="sec">${libHead(S, T(S, 'sfx') + ' library', 'p.61', 'A shared list of SFX you can drop onto distinctions, power sets, assets and traits anywhere in the designer or builder.')}
    ${sfxEditor('S.lib.sfx', S.lib.sfx, S)}</section>
    <section class="sec"><h3>Dice tricks SFX use</h3><table class="tbl"><tr><th>Trick</th><th>Meaning</th></tr>
    <tr><td>Step up / down</td><td>Swap a die for the next size up or down.</td></tr><tr><td>Double</td><td>Add a second die of the same size before rolling.</td></tr><tr><td>Reroll</td><td>Roll again and use the new result.</td></tr></table></section>`;
};
DSEC.lib_archetypes = S => {
  const fixed = S.sets.filter(x => x.kind === 'fixed');
  const sig = S.sets.find(x => x.flavor === 'sigassets');
  const hs = byId(S.sets, S.dist.highlightSet);
  const items = S.lib.archetypes.map((a, k) => {
    const p = `S.lib.archetypes.${k}`;
    a.ratings = a.ratings || {}; a.dists = a.dists || []; a.sig = a.sig || []; a.specs = a.specs || [];
    return `<div class="libitem"><div class="row"><input class="grow" style="font-family:var(--f-display);font-weight:700;font-size:18px;text-transform:uppercase" value="${esc(a.name)}" placeholder="Archetype name" ${bindAttr(p + '.name')}>${moveBtns('S.lib.archetypes', k)}<button class="icon-btn" data-act="delItem" data-path="S.lib.archetypes" data-i="${k}" aria-label="Remove">✕</button></div>
      <label class="fld" style="margin-top:6px"><span>Pitch</span>${area(p + '.pitch', a.pitch, { rows: 2, ph: 'Background and how to play them.' })}</label>
      ${fixed.filter(x => x.create.mode !== 'points').map(set => `<div class="lbl" style="margin-top:10px">${esc(set.name)} (preset)</div>${set.traits.map(t => `<div class="ratingrow"><span class="nm">${esc(t.name || 'Unnamed')}</span>${diePick(`${p}.ratings.${set.id}.${t.id}`, (a.ratings[set.id] || {})[t.id], { none: true })}<span></span></div>`).join('')}`).join('')}
      <div class="lbl" style="margin-top:12px">${esc(T(S, 'distinctions'))}</div>
      ${a.dists.map((d, j) => `<div class="entry"><div class="eh"><input class="nm" value="${esc(d.name)}" placeholder="${esc(T(S, 'distinction'))}" ${bindAttr(`${p}.dists.${j}.name`)}><button class="icon-btn sm" data-act="delItem" data-path="${p}.dists" data-i="${j}" aria-label="Remove">✕</button></div>
        ${area(`${p}.dists.${j}.desc`, d.desc, { rows: 1, ph: 'Description' })}
        ${hs ? `<div class="row" style="margin-top:6px"><span class="lbl">Highlights</span>${Array.from({ length: +S.dist.highlightCount || 0 }).map((_, h) => sel(`${p}.dists.${j}.hl.${h}`, (d.hl || [])[h] || '', [['', '—']].concat(hs.traits.map(t => [t.id, t.name || 'Unnamed'])), { re: false })).join('')}</div>` : ''}
        <div style="margin-top:6px">${sfxEditor(`${p}.dists.${j}.sfx`, d.sfx, S)}</div></div>`).join('')}
      <div class="row" style="margin-top:6px"><button class="btn ghost small" data-act="pushItem" data-path="${p}.dists" data-item='${esc(JSON.stringify({ name: '', desc: '', hl: [], sfx: [] }))}'>Add ${esc(T(S, 'distinction').toLowerCase())}</button>
      ${S.dist.library.length ? `<button class="btn quiet small" data-act="archFromLib" data-k="${k}">From library</button>` : ''}</div>
      ${sig ? `<div class="lbl" style="margin-top:12px">Signature asset choices (player picks one)</div>${a.sig.map((x, j) => `<div class="row" style="margin-top:4px"><input class="grow" value="${esc(x.name)}" placeholder="Asset" ${bindAttr(`${p}.sig.${j}.name`)}>${diePick(`${p}.sig.${j}.die`, x.die, { min: 6 })}<button class="icon-btn sm" data-act="delItem" data-path="${p}.sig" data-i="${j}" aria-label="Remove">✕</button></div>`).join('')}
        <button class="btn ghost small" style="margin-top:6px" data-act="pushItem" data-path="${p}.sig" data-item='${esc(JSON.stringify({ name: '', die: 8 }))}'>Add choice</button>` : ''}
      <label class="fld" style="margin-top:12px"><span>Other notes (specialties, suggested ${esc(T(S, 'sfx'))} picks)</span>${area(p + '.notes', a.notes, { rows: 2 })}</label></div>`;
  }).join('');
  return `<section class="sec">${libHead(S, 'Archetypes', 'p.68', 'Partly built characters: preset dice, three ' + esc(T(S, 'distinctions').toLowerCase()) + ' with SFX to unlock, and a choice of signature assets. Players then spend their points as usual.')}
    ${items || '<div class="empty"><p>No archetypes yet.</p></div>'}
    <div class="row" style="margin-top:10px"><button class="btn ghost" data-act="pushItem" data-path="S.lib.archetypes" data-item='${esc(JSON.stringify({ name: '', pitch: '', ratings: {}, dists: [], sig: [], notes: '' }))}'>Add archetype</button></div></section>`;
};
A.archFromLib = el => {
  const S = curS(); const a = S.lib.archetypes[+el.dataset.k];
  openModal('Add from library', S.dist.library.map((d, j) => `<button class="setcard" style="width:100%;margin-top:8px" data-act="archLibPick" data-k="${el.dataset.k}" data-j="${j}"><div><div class="nm">${esc(d.name || 'Unnamed')}</div><div class="sm">${esc(d.desc)}</div></div></button>`).join(''));
};
A.archLibPick = el => { const S = curS(); const a = S.lib.archetypes[+el.dataset.k]; const d = clone(S.dist.library[+el.dataset.j]); d.id = uid('d_'); (d.sfx || []).forEach(x => x.id = uid('x_')); a.dists.push(d); closeModal(); touch(S); render(); };

/* ---------- mods ---------- */
MOD_CATS.forEach(cat => {
  DSEC['mods_' + cat.id] = S => `<section class="sec"><div class="sec-head"><h2>${esc(cat.name)}</h2>${refTag('p.248')}</div><p class="prose">${esc(cat.q)}</p>
    <div>${MODS.filter(m => m.cat === cat.id).map(m => modRow(S, m)).join('')}</div></section>${(MOD_EXTRA[cat.id] || (() => ''))(S)}`;
});
function modRow(S, m) {
  const isOn = !!S.mods[m.id];
  const opts = isOn && m.opts ? `<div class="opts">${m.opts.map(o => {
    if (o.type === 'select') return `<label class="fld" style="max-width:520px"><span>${esc(o.label)}</span>${sel('S.opt.' + o.k, S.opt[o.k], o.choices)}</label>`;
    if (o.type === 'num') return `<label class="fld"><span>${esc(o.label)}</span><span class="inline-num">${inp('S.opt.' + o.k, S.opt[o.k], { type: 'number' })}</span></label>`;
    if (o.type === 'text') return `<label class="fld" style="max-width:320px"><span>${esc(o.label)}</span>${inp('S.opt.' + o.k, S.opt[o.k])}</label>`;
    return chk('S.opt.' + o.k, S.opt[o.k], esc(o.label));
  }).join('')}</div>` : '';
  return `<div class="modrow ${isOn ? '' : 'off'} ${m.always ? 'always' : ''}">
    <input type="checkbox" class="bubble" aria-label="${esc(m.name)}" ${isOn ? 'checked' : ''} ${m.always ? 'disabled' : bindAttr('S.mods.' + m.id)} data-re>
    <div><div class="nm">${esc(m.name)}${m.always ? ' <span class="tag ink">always on</span>' : ''}</div><div class="sm">${esc(m.sum.replace(/plot point/g, T(S, 'pp').toLowerCase()))}</div>${opts}</div>${refTag(m.ref)}</div>`;
}
const MOD_EXTRA = {
  dice: S => S.mods.vehicles ? `<section class="sec"><h3>Vehicle file</h3><p class="prose small">Name the vehicle attributes your setting uses (the handbook's motor pool uses three).</p>
    ${S.vehicle.traits.map((t, k) => `<div class="row" style="margin-top:4px"><input class="grow" value="${esc(t.name)}" placeholder="Vehicle attribute" ${bindAttr(`S.vehicle.traits.${k}.name`)}><button class="icon-btn sm" data-act="delItem" data-path="S.vehicle.traits" data-i="${k}" aria-label="Remove">✕</button></div>`).join('')}
    <div class="row" style="margin-top:6px"><button class="btn ghost small" data-act="pushItem" data-path="S.vehicle.traits" data-item='${esc(JSON.stringify({ name: '' }))}'>Add vehicle attribute</button><label class="fld" style="flex-direction:row;align-items:center;gap:8px"><span>Default die</span>${dieSelect('S.vehicle.die', S.vehicle.die)}</label></div></section>` : '',
  conflict: S => S.mods.doom ? `<section class="sec"><h3>${esc(S.opt.doomName || 'Doom pool')} at the start of a session</h3><p class="small muted">Usually d6d6; bigger dice or more of them for climactic sessions.</p>
    <label class="fld" style="max-width:260px"><span>Starting dice</span><input value="${esc((S.opt.doomStart || [6, 6]).join(', '))}" ${bindAttr('S.opt.doomStart')} data-type="csvnum"></label></section>` : '',
  harm: S => {
    let h = '';
    if (S.mods.stress) {
      const fixed = S.sets.filter(x => x.kind === 'fixed');
      h += `<section class="sec"><h3>${esc(T(S, 'stress'))} ${S.opt.shaken ? 'targets' : 'tracks'}</h3>`;
      if (S.opt.shaken) h += `<p class="prose small">With shaken & stricken, stress lands on a trait. Pick the set it lands on.</p><label class="fld" style="max-width:300px"><span>Stress lands on</span>${sel('S.stress.shakenSet', S.stress.shakenSet, [['', 'Choose a set']].concat(fixed.map(x => [x.id, x.name])))}</label>`;
      else h += `<p class="prose small">One track, or several types such as Physical / Mental / Social, or Afraid / Angry / Exhausted / Injured / Insecure.</p>
        ${S.stress.tracks.map((t, k) => `<div class="row" style="margin-top:4px"><input class="grow" value="${esc(t.name)}" placeholder="Stress type" ${bindAttr(`S.stress.tracks.${k}.name`)}>${moveBtns('S.stress.tracks', k)}<button class="icon-btn sm" data-act="delItem" data-path="S.stress.tracks" data-i="${k}" aria-label="Remove">✕</button></div>`).join('')}
        <button class="btn ghost small" style="margin-top:6px" data-act="pushItem" data-path="S.stress.tracks" data-item='${esc(JSON.stringify({ name: '' }))}'>Add stress type</button>`;
      h += '</section>';
    }
    if (S.mods.lifePoints) {
      const refs = traitRefs(S);
      h += `<section class="sec"><h3>Life points formula</h3><p class="prose small">Add two traits that reflect hardiness, will or stamina. The handbook's example: a physical attribute plus the highest of three toughness skills.</p>
        <div class="g2"><label class="fld"><span>Base trait</span>${sel('S.life.a', S.life.a, [['', 'Choose']].concat(refs.map(r => [r.key, r.label])))}</label>
        <label class="fld"><span>Flat bonus</span>${inp('S.life.flat', S.life.flat, { type: 'number' })}</label></div>
        <div class="lbl" style="margin-top:10px">Plus the highest of</div><div class="g3" style="margin-top:4px">${refs.map(r => `<label class="check"><input type="checkbox" class="bubble" ${S.life.best.includes(r.key) ? 'checked' : ''} data-act="lifeBest" data-key="${r.key}"${dis()}><span class="small">${esc(r.label)}</span></label>`).join('') || '<span class="small muted">Add fixed trait sets first.</span>'}</div></section>`;
    }
    return h;
  },
  growth: S => {
    let h = '';
    if (S.mods.sessionRecords) h += `<section class="sec"><h3>Training costs (sessions)</h3>${costTable(S, 'S.growth.training', S.growth.training, 'sessions')}</section>`;
    if (S.mods.milestones) h += `<section class="sec"><h3>Unlockables (XP)</h3>${costTable(S, 'S.growth.unlocks', S.growth.unlocks, T(S, 'xp'))}</section>`;
    if (S.mods.growth) h += `<section class="sec"><h3>Growth test difficulty</h3><p class="prose small">Roll the growth pool plus the session's highest stress or complication against one die the size you're stepping up to, plus a die by trait type. ${refTag('p.83')}</p>
      <table class="tbl"><tr><th>Trait type</th><th>Second die</th></tr>${GROWTH_TYPE_DIE.map(([l, d]) => `<tr><td>${esc(l)}</td><td>${dieSvg(d)}</td></tr>`).join('')}</table></section>`;
    return h;
  }
};
function costTable(S, path, list, unit) {
  return `${list.map((x, k) => `<div class="row" style="margin-top:4px"><input class="grow" value="${esc(x.label)}" ${bindAttr(`${path}.${k}.label`)}><span class="inline-num">${inp(`${path}.${k}.cost`, x.cost, { type: 'number' })}<span class="small muted">${esc(unit)}</span></span><button class="icon-btn sm" data-act="delItem" data-path="${path}" data-i="${k}" aria-label="Remove">✕</button></div>`).join('')}
    <button class="btn ghost small" style="margin-top:6px" data-act="pushItem" data-path="${path}" data-item='${esc(JSON.stringify({ label: '', cost: 1 }))}'>Add row</button>`;
}
A.lifeBest = el => { const S = curS(); const k = el.dataset.key; const i = S.life.best.indexOf(k); if (i >= 0) S.life.best.splice(i, 1); else S.life.best.push(k); touch(S); render(); };

/* ---------- creation ---------- */
DSEC.creation = S => {
  const m = S.creation.methods;
  const ptsSet = S.sets.find(x => x.kind === 'fixed' && x.create.mode === 'points');
  const trdSet = S.sets.find(x => x.kind === 'fixed' && x.create.mode === 'trade');
  const payers = S.sets.filter(x => (x.kind === 'open' && x.create.mode === 'pool') || x.kind === 'resources' || x.kind === 'powersets').map(x => x.name);
  if (S.sets.some(x => x.specialties)) payers.push('specialties');
  const rules = S.sets.map(set => `<tr><td class="k">${esc(set.name)}</td><td>${esc(ruleText(S, set))}</td></tr>`).join('');
  let stages = '';
  if (m.pathways) {
    stages = `<section class="sec"><div class="sec-head"><h2>Pathways stages</h2>${refTag('p.73–80')}</div>
      <p class="prose small">Each stage is a period of the characters' lives. Major stages add two map elements and a ${esc(T(S, 'distinction').toLowerCase())}; meta stages also let players rewire the map. Grants below set the pathways budget.</p>
      ${S.creation.stages.map((st, k) => { const p = `S.creation.stages.${k}`; st.g = st.g || {}; return `<div class="libitem"><div class="row"><b class="k">${k + 1}</b><input class="grow" value="${esc(st.name)}" placeholder="Stage name" ${bindAttr(p + '.name')}>${sel(p + '.type', st.type, [['standard', 'Standard'], ['major', 'Major'], ['meta', 'Meta']], { re: false })}${moveBtns('S.creation.stages', k)}<button class="icon-btn sm" data-act="delItem" data-path="S.creation.stages" data-i="${k}" aria-label="Remove">✕</button></div>
        <label class="fld" style="margin-top:6px"><span>Choices (comma separated)</span>${inp(p + '.opts', st.opts)}</label>
        <div class="g5" style="margin-top:6px"><label class="fld"><span>${esc(T(S, 'distinctions'))}</span>${inp(p + '.g.dist', st.g.dist || 0, { type: 'number' })}</label>
        <label class="fld"><span>${esc(ptsSet ? ptsSet.name : 'Point-buy')} steps</span>${inp(p + '.g.points', st.g.points || 0, { type: 'number' })}</label>
        <label class="fld"><span>${esc(trdSet ? trdSet.name : 'Trade set')} steps</span>${inp(p + '.g.trade', st.g.trade || 0, { type: 'number' })}</label>
        <label class="fld"><span>${esc(S.creation.poolName)}</span>${inp(p + '.g.pool', st.g.pool || 0, { type: 'number' })}</label>
        <label class="fld"><span>${esc(T(S, 'sfx'))} unlocks</span>${inp(p + '.g.sfx', st.g.sfx || 0, { type: 'number' })}</label></div></div>`; }).join('') || '<div class="empty"><p>No stages yet.</p></div>'}
      <div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="pathDefault" data-n="5">Use the handbook's five-stage build</button><button class="btn quiet small" data-act="pathDefault" data-n="9">Add stages 6–9 of the default table</button>
      <button class="btn quiet small" data-act="pushItem" data-path="S.creation.stages" data-item='${esc(JSON.stringify({ name: '', type: 'standard', opts: '', g: { dist: 0, points: 1, trade: 0, pool: 1, sfx: 0 } }))}'>Add stage</button></div>
      ${trdSet ? `<p class="small muted">In pathways, ${esc(trdSet.name)} start at ${dlabel(trdSet.create.pathStart || 6)} and grow with the steps above.</p>` : ''}</section>`;
  }
  return `<section class="sec"><div class="sec-head"><h2>Character creation</h2>${refTag('p.67')}</div>
    <p class="prose">Turn on the methods players can use. Budgets are tracked in the builder and flagged when off; nothing is ever blocked.</p>
    ${Object.entries(METHODS).map(([k, M]) => `<div class="modrow ${m[k] ? '' : 'off'}"><input type="checkbox" class="bubble" aria-label="${esc(M.name)}" ${m[k] ? 'checked' : ''} ${bindAttr('S.creation.methods.' + k)} data-re><div><div class="nm">${esc(M.name)}</div><div class="sm">${esc(M.sum)}</div>
      ${k === 'archetypes' && m[k] ? `<div class="opts"><button class="btn ghost small" data-act="dsec" data-id="lib_archetypes" style="align-self:flex-start">Edit archetypes (${S.lib.archetypes.length})</button></div>` : ''}</div>${refTag(M.ref)}</div>`).join('')}
    </section>
    <section class="sec"><h2>Shared budgets</h2>
    <div class="g3"><label class="fld"><span>Name of the shared points</span>${inp('S.creation.poolName', S.creation.poolName, { re: true })}</label>
    <label class="fld"><span>Points per character</span>${inp('S.creation.pool', S.creation.pool, { type: 'number' })}</label>
    <label class="fld"><span>${esc(T(S, 'sfx'))} unlocked at creation</span>${inp('S.creation.sfxUnlocks', S.creation.sfxUnlocks, { type: 'number' })}<small>Beyond each ${esc(T(S, 'distinction').toLowerCase())}'s free Hinder.</small></label></div>
    <p class="small muted">${esc(S.creation.poolName)} pay for: ${payers.length ? esc(payers.join(', ')) : 'nothing yet (add signature assets, specialties, resources or power sets)'}. The handbook gives 5 points for specialties and signature assets ${refTag('p.71')}.</p></section>
    <section class="sec"><h2>Per-set rules</h2><table class="tbl"><tr><th>Set</th><th>At creation</th></tr>${rules}</table>
    <p class="small muted" style="margin-top:6px">Change these on each set in <button class="linkbtn" data-act="dsec" data-id="traits">Trait sets</button>.</p></section>${stages}`;
};
function ruleText(S, set) {
  const c = set.create || {};
  if (set.kind === 'distinctions') return `${c.count} ${T(S, 'distinctions').toLowerCase()}, ${S.dist.rated === 'fixed' ? 'each d8' : 'd4–d12 averaging d8'}; unlock ${S.creation.sfxUnlocks} ${T(S, 'sfx')} beyond Hinder.`;
  switch (c.mode) {
    case 'trade': return `${c.baseCount} start at ${dlabel(c.baseline)}, the rest at ${dlabel(c.extraBaseline)}; step one up by stepping another down (range ${dlabel(c.min)}–${dlabel(c.max)}).`;
    case 'points': return `Start at ${dlabel(c.base)}; ${c.points} points to step up (max ${dlabel(c.cap)}), plus free highlight steps.`;
    case 'array': return `Assign ${c.auto ? (ROLE_ARRAYS[set.traits.length] ? ROLE_ARRAYS[set.traits.length].map(dlabel).join(', ') : 'the handbook spread for 3–6 traits') : (c.array || []).map(dlabel).join(', ')}.`;
    case 'peaks': return `${(c.peaks || []).map(dlabel).join(', ')}, everything else ${dlabel(c.fill)}.`;
    case 'pool': return set.kind === 'resources' ? `1 point for a 2d6 resource with two tags; more points add or step up dice.` : `Each entry costs ${c.entryCost == null ? 1 : c.entryCost} point at ${dlabel(c.startDie)}, +1 per step (max ${dlabel(c.cap)}).`;
    case 'count': return `${plural(+c.count, set.kind === 'talents' ? 'talent' : set.kind === 'abilities' ? 'ability' : 'entry', set.kind === 'abilities' ? 'abilities' : set.kind === 'talents' ? 'talents' : 'entries')}${set.kind === 'abilities' ? `, ${c.freeSfx} free SFX each` : ''}.`;
    case 'powers': return `${c.sets} power set(s), each with ${c.sfxPerSet} SFX and ${c.limitsPerSet} limit; d8 powers equal to sets + 1 (max ${dlabel(c.cap)}).`;
  }
  return 'Assigned freely.';
}
A.pathDefault = el => {
  const S = curS(); const n = +el.dataset.n;
  if (n === 5) { S.creation.stages = PATHWAY_TABLE.slice(0, 5).map((x, i) => Object.assign(clone(x), { g: clone(PATHWAY_GRANTS5[i]) })); }
  else { PATHWAY_TABLE.slice(5).forEach(x => { if (!S.creation.stages.some(s => s.name === x.name)) S.creation.stages.push(Object.assign(clone(x), { g: { dist: x.type === 'major' ? 0 : 0, points: 1, trade: 0, pool: 1, sfx: x.type === 'meta' ? 1 : 0 } })); }); }
  touch(S); render();
};

/* ---------- terms ---------- */
DSEC.terms = S => `<section class="sec"><div class="sec-head"><h2>Terminology</h2></div><p class="prose">Rename game terms to fit the setting. ${esc(T(S, 'pps'))} could be Luck, Fate or Chi; the GM could be the Narrator.</p>
  <div class="g3">${Object.keys(TERMS_DEFAULT).map(k => `<label class="fld"><span>${esc(TERM_LABELS[k])}</span>${inp('S.terms.' + k, S.terms[k], { re: true, ph: TERMS_DEFAULT[k] })}</label>`).join('')}</div></section>`;

/* ---------- review ---------- */
function designerWarnings(S) {
  const w = [];
  const primes = S.sets.filter(x => x.prime && x.kind !== 'distinctions');
  if (primes.length < 2) w.push(['traits', `Only ${primes.length} prime set${primes.length === 1 ? '' : 's'} besides ${T(S, 'distinctions').toLowerCase()}; the handbook recommends at least two.`]);
  S.sets.forEach(x => { if (x.kind === 'fixed' && !x.traits.length) w.push(['traits', `${x.name} has no traits.`]); if (x.kind === 'fixed' && x.traits.some(t => !(t.name || '').trim())) w.push(['traits', `${x.name} has an unnamed trait.`]); });
  const st = S.sets.filter(x => x.statements).length; if (st > 2) w.push(['traits', `Trait statements are on ${st} sets; the handbook suggests no more than two.`]);
  const sfxSets = S.sets.filter(x => (x.sfx && x.flavor !== 'sigassets' && x.kind !== 'distinctions') || x.kind === 'powersets' || x.kind === 'abilities').length + (S.dist.library.some(d => d.sfx && d.sfx.length) || S.creation.sfxUnlocks > 0 ? 1 : 0);
  if (sfxSets > 2) w.push(['traits', `${T(S, 'sfx')} appear on ${sfxSets} sets; the handbook suggests keeping them to two.`]);
  if (S.sets.some(x => x.kind === 'powersets') && S.creation.sfxUnlocks > 0) w.push(['creation', `With power sets, the handbook suggests no ${T(S, 'sfx')} on ${T(S, 'distinctions').toLowerCase()} (set unlocks to 0).`]);
  if (S.mods.addAll && !S.mods.noEffect && !S.mods.rerollEffect) w.push(['mods_dice', 'Add all the dice leaves no effect die: also turn on No effect dice or Reroll for effect.']);
  if (S.dist.highlightSet && !byId(S.sets, S.dist.highlightSet)) w.push(['distinctions', 'The highlight set no longer exists.']);
  if (S.dist.libOnly && !S.dist.library.length) w.push(['distinctions', `Players must pick from the library, but it's empty.`]);
  const m = S.creation.methods; if (!m.scratch && !m.archetypes && !m.pathways) w.push(['creation', 'No character creation method is on.']);
  if (m.archetypes && !S.lib.archetypes.length) w.push(['lib_archetypes', 'Archetypes are on but none exist yet.']);
  if (m.pathways && !S.creation.stages.length) w.push(['creation', 'Pathways is on but has no stages.']);
  if (S.mods.stress && !S.opt.shaken && !S.stress.tracks.length) w.push(['mods_harm', `${T(S, 'stress')} is on but has no tracks.`]);
  if (S.mods.stress && S.opt.shaken && !S.stress.shakenSet) w.push(['mods_harm', 'Shaken & stricken needs a set for stress to land on.']);
  if (S.mods.lifePoints && !S.life.a) w.push(['mods_harm', 'Life points need a base trait.']);
  if (S.sets.some(x => x.kind === 'powersets') && !S.lib.powersets.length) w.push(['lib_powersets', 'No power sets in the library (players can still write their own).']);
  if (S.mods.vehicles && !S.vehicle.traits.length) w.push(['mods_dice', 'Vehicles are on but have no vehicle attributes.']);
  return w;
}
DSEC.review = S => {
  const w = designerWarnings(S);
  return `<section class="sec"><div class="sec-head"><h2>Review & share</h2></div>
    ${w.length ? `<div class="panel"><div class="bar">${plural(w.length, 'thing')} to look at</div><div class="in">${w.map(([sec, t]) => `<div class="bwarn">${esc(t)} <button class="linkbtn" data-act="dsec" data-id="${sec}">Fix</button></div>`).join('')}</div></div>` : `<div class="panel"><div class="bar">Ready to play</div><div class="in"><p class="prose" style="margin:0">Nothing flagged. Build a character, or share the setting with your players.</p></div></div>`}
    </section>
    <section class="sec"><h3>Try it</h3><div class="row"><button class="btn" data-act="go" data-tab="chars">Build a character</button><button class="btn ghost" data-act="previewBlank">Preview blank character file</button><button class="btn quiet" data-act="go" data-tab="rules">Read the rules summary</button></div></section>
    <section class="sec"><h3>Share</h3><p class="prose small">A <b>player pack</b> is a locked copy: players can read the setting guide and build characters, but can't change rules or see the GM table. They send their characters back as files you import.</p>
    <div class="row"><button class="btn" data-act="expPack" data-id="${S.id}">Export player pack</button><button class="btn ghost" data-act="expSetting" data-id="${S.id}">Export editable setting</button></div></section>`;
};
A.previewBlank = () => { DB.ui.tab = 'chars'; DB.ui.cview = 'blank'; window.scrollTo(0, 0); render(); };
