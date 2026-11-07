/* ============ Character file (book-style, playable, printable) ============ */
function blankChar(S) {
  const c = newChar(S); c.id = 'blank'; c.pp = 0;
  S.sets.forEach(set => {
    if (set.kind === 'fixed') set.traits.forEach(t => { c.ratings[set.id][t.id] = 0; });
    else if (set.kind === 'distinctions') { c.entries[set.id] = Array.from({ length: +set.create.count || 3 }, () => newDistinction()); }
    else if (set.kind === 'open') c.entries[set.id] = Array.from({ length: Math.max(3, (set.create.peaks || []).length + 1, +set.create.count || 0) }, () => Object.assign(newEntry(set), { die: 0 }));
    else if (set.kind === 'resources') c.entries[set.id] = [newEntry(set), newEntry(set)].map(e => Object.assign(e, { count: 0 }));
    else if (set.kind === 'powersets') c.entries[set.id] = Array.from({ length: +set.create.sets || 1 }, () => Object.assign(newEntry(set), { powers: [{ name: '', die: 0 }, { name: '', die: 0 }, { name: '', die: 0 }] }));
    else c.entries[set.id] = Array.from({ length: +set.create.count || 2 }, () => newEntry(set));
  });
  return c;
}
function ladder(v, blank, { min = 4, chain = false } = {}) {
  const ds = DICE.filter(d => d >= min);
  if (chain) return `<span class="chain">${ds.map((d, i) => (i ? '<span class="arr"></span>' : '') + dieSvg(d, !blank && d === +v ? 'on' : 'off')).join('')}</span>`;
  return ds.map(d => dieSvg(d, !blank && d === +v ? 'on' : 'off')).join('');
}
function fileView(S, C, blank) {
  if (!blank) normalizeChar(C, S);
  const B = blank;
  const ds = distSet(S);
  const top = B ? `<div class="fplay noprint"><div><h2 style="margin:0">Blank ${esc(T(S, 'file').toLowerCase())}</h2><span class="small muted">Print it for the table, or hand it out with your player pack.</span></div>
      <div class="row"><button class="btn" data-act="print">Print</button><button class="btn quiet" data-act="cview" data-v="list">Back</button></div></div>`
    : `<div class="fplay noprint"><div class="row"><span class="seg"><button data-act="cview" data-v="build" aria-pressed="false">Build</button><button aria-pressed="true">File</button></span>
      <span class="row" style="gap:4px"><button class="icon-btn" data-act="ppBump" data-n="-1" aria-label="Spend a ${esc(T(S, 'pp'))}">−</button><span class="k" style="font-size:18px">${C.pp} ${esc(T(S, 'ppAbbr'))}</span><button class="icon-btn" data-act="ppBump" data-n="1" aria-label="Gain a ${esc(T(S, 'pp'))}">+</button></span></div>
      <div class="row"><button class="btn quiet small" data-act="newScene">New scene</button><button class="btn quiet small" data-act="newSession">New session</button><button class="btn quiet small" data-act="print">Print</button><button class="btn quiet small" data-act="cview" data-v="list">All characters</button><button class="btn quiet small" data-act="charMenu">More…</button></div></div>
      <p class="small muted noprint" style="max-width:1120px;margin:-4px auto 12px">Tap a trait's name to add its die to your pool. The pool tray appears at the bottom.</p>`;
  const medal = !B && C.portrait ? `<div class="fmedal"><img src="${C.portrait}" alt=""></div>` : `<div class="fmedal" style="background:transparent;border:0">${emblem(S, 96)}</div>`;
  const head = `<div class="fhead"><div>
      <div class="fline-pair"><div class="fline big"><b>Name:</b><span>${B ? '' : esc(C.name)}</span></div><div class="fline"><b>Player:</b><span>${B ? '' : esc(C.player)}</span></div></div>
      <div class="fline"><b>Concept:</b><span>${B ? '' : esc(C.concept)}</span></div>
      <div class="fline"><b>Description:</b><span>${B ? '' : esc(C.desc)}</span></div>
      <div class="fline"><b>History:</b><span>${B ? '' : esc(C.history)}</span></div></div>
    <div class="fhead-r"><div class="ftitle"><div class="st">${esc(S.name || 'Untitled')}</div>${S.tagline ? `<div class="tl">${esc(S.tagline)}</div>` : ''}</div>${medal}</div></div>`;
  const left = [], right = [];
  S.sets.forEach(set => {
    if (set.kind === 'fixed') left.push(fsetFixed(S, C, set, B));
    else if (set.kind === 'open') (set.flavor === 'sigassets' ? right : left).push(fsetOpen(S, C, set, B));
    else if (set.kind === 'resources') left.push(fsetRes(S, C, set, B));
    else if (set.kind === 'distinctions') right.unshift(fsetDist(S, C, set, B));
    else if (set.kind === 'powersets') right.push(fsetPS(S, C, set, B));
    else if (set.kind === 'abilities') right.push(fsetAb(S, C, set, B));
    else if (set.kind === 'talents') right.push(fsetTal(S, C, set, B));
  });
  if (on(S, 'stress')) (left.length > right.length + 1 ? right : left).push(fsetStress(S, C, B));
  right.push(fsetPlay(S, C, B));
  if (on(S, 'lifePoints')) right.push(fsetLife(S, C, B));
  if (on(S, 'sessionRecords') || on(S, 'milestones') || on(S, 'growth')) right.push(fsetGrowth(S, C, B));
  if (on(S, 'vehicles') && (B || C.vehicles.length)) left.push(fsetVehicles(S, C, B));
  if (!B && (C.notes || '').trim()) left.push(`<section class="fset"><div class="vl">Notes</div><div class="ct"><p class="prose" style="white-space:pre-wrap;margin:0">${esc(C.notes)}</p></div></section>`);
  return top + `<article class="file" data-filelabel="${esc(T(S, 'file'))}">${head}<div class="fbody"><div class="fcol">${left.join('')}</div><div class="fcol">${right.join('')}</div></div>
    <div class="fnote">Prime Forge · ${esc(S.name)} · for Cortex Prime</div></article>`;
}
function fsec(label, inner, extra = '') { return `<section class="fset" ${extra}><div class="vl" title="${esc(label)}">${esc(label)}</div><div class="ct">${inner}</div></section>`; }
function fsetFixed(S, C, set, B) {
  const shaken = on(S, 'stress') && S.opt.shaken && S.stress.shakenSet === set.id;
  const rows = set.traits.map(t => {
    const v = +((C.ratings[set.id] || {})[t.id] || 0);
    const st = ((C.stmt[set.id] || {})[t.id]) || {};
    const sp = set.specialties ? (C.specs || []).filter(s => s.setId === set.id && s.traitId === t.id && s.name) : [];
    const stress = shaken ? +(C.stress['t:' + t.id] || 0) : 0;
    return `<div class="ftrait">
      <div class="tn"><button class="nmb" data-act="poolTrait" data-set="${set.id}" data-t="${t.id}" ${B ? 'disabled' : ''}>${esc(t.name || '—')}</button>
        ${set.statements && !B && st.text && !st.challenged ? `<button class="linkbtn noprint" data-act="challenge" data-set="${set.id}" data-t="${t.id}" title="Act against the statement: triple this die, then it steps down">Challenge</button>` : ''}
        ${shaken && stress ? `<span class="tag" title="${esc(T(S, 'stress'))} on this trait">${esc(T(S, 'stress'))} ${dlabel(stress)}${stress > v ? ' · shaken' : ''}</span>` : ''}</div>
      <div class="ladder">${ladder(v, B)}</div>
      ${set.statements ? `<div class="stm ${st.challenged ? 'ch' : ''}">${B ? '<span class="muted">Statement:</span>' : esc(st.text || '')}${st.challenged && !B ? ` <span class="tag ink">challenged</span> <button class="linkbtn noprint" data-act="resolveStmt" data-set="${set.id}" data-t="${t.id}">Resolve</button>` : ''}</div>` : ''}
      ${sp.length ? `<div class="specs">${sp.map(s => `<button class="chip click" data-act="poolSpec" data-id="${s.id}">${diceRow(Array(+s.count || 1).fill(+s.die || 6))}${esc(s.name)}</button>`).join('')}</div>` : ''}
      ${set.sfx && (t.sfx || []).length ? t.sfx.map(x => sfxLine(x, B ? false : !!C.unlocks[x.id])).join('') : ''}</div>`;
  }).join('') || '<p class="small muted">No traits yet.</p>';
  return fsec(set.name, rows);
}
function sfxLine(x, unlocked, extra = '') { return `<div class="fsfx ${unlocked ? '' : 'locked'}"><span class="bl ${unlocked ? 'on' : ''}"></span><span><b>${esc(x.name || 'SFX')}:</b> ${esc(x.text || '')}${extra}</span></div>`; }
function fsetDist(S, C, set, B) {
  const hs = byId(S.sets, S.dist.highlightSet);
  const list = C.entries[set.id] || [];
  const inner = list.map((d, k) => {
    const hl = hs ? (d.hl || []).map(tid => (byId(hs.traits, tid) || {}).name).filter(Boolean) : [];
    return `<div class="fdist"><div class="dh">${dieSvg(B ? 8 : (+d.die || 8), B ? 'ink' : 'on')}<button class="nmb" data-act="poolDist" data-k="${k}" ${B ? 'disabled' : ''}>${B ? '&nbsp;' : esc(d.name || '—')}</button><span class="grow"></span>
      ${B ? '' : `<button class="btn quiet small noprint" data-act="poolHinder" data-k="${k}" title="Roll it as a d4 and gain a ${esc(T(S, 'pp'))}">${dieSvg(4)} Hinder</button>`}</div>
      ${!B && d.desc ? `<div class="dd">${esc(d.desc)}</div>` : ''}
      <div class="fsfx"><span class="bl on"></span><span><b>Hinder:</b> Gain a ${esc(T(S, 'ppAbbr'))} when you switch out this ${esc(T(S, 'distinction').toLowerCase())}'s ${B ? 'd8' : dlabel(+d.die || 8)} for a d4.</span></div>
      ${(d.sfx || []).map(x => sfxLine(x, !!x.unlocked)).join('')}
      ${B && S.creation.sfxUnlocks ? '<div class="fsfx locked"><span class="bl"></span><span>&nbsp;</span></div><div class="fsfx locked"><span class="bl"></span><span>&nbsp;</span></div>' : ''}
      ${hl.length ? `<div class="small muted" style="margin-left:26px">Highlights: ${esc(hl.join(', '))}</div>` : ''}</div>`;
  }).join('');
  return fsec(set.name, inner);
}
function fsetOpen(S, C, set, B) {
  const list = (C.entries[set.id] || []).filter(e => B || (e.name || '').trim());
  const inner = list.map(e => `<div class="ftrait"><div class="tn"><button class="nmb" data-act="poolEntry" data-set="${set.id}" data-id="${e.id}" ${B ? 'disabled' : ''}>${B ? '&nbsp;' : esc(e.name)}</button>
      ${set.statements && !B && e.statement && !e.challenged ? `<button class="linkbtn noprint" data-act="challengeEntry" data-set="${set.id}" data-id="${e.id}">Challenge</button>` : ''}</div>
    <div class="ladder">${ladder(e.die, B)}</div>
    ${set.statements ? `<div class="stm ${e.challenged ? 'ch' : ''}">${B ? '<span class="muted">Statement:</span>' : esc(e.statement || '')}${e.challenged && !B ? ` <span class="tag ink">challenged</span> <button class="linkbtn noprint" data-act="resolveStmt" data-set="${set.id}" data-id="${e.id}">Resolve</button>` : ''}</div>` : ''}
    ${(e.sfx || []).map(x => sfxLine(x, !!x.unlocked)).join('')}</div>`).join('') || `<p class="small muted">None yet.</p>`;
  return fsec(set.name, inner);
}
function fsetRes(S, C, set, B) {
  const list = (C.entries[set.id] || []).filter(e => B || (e.name || '').trim());
  const typeName = { extra: 'Extra', location: 'Location', org: 'Organization', prop: 'Prop' };
  const inner = list.map(e => {
    const n = +e.count || 0, spent = +e.spent || 0;
    const dice = Array.from({ length: B ? 3 : n }, (_, i) => `<button class="dbtn" data-act="poolRes" data-set="${set.id}" data-id="${e.id}" ${B || i >= n - spent ? 'disabled' : ''} aria-label="Use a resource die">${dieSvg(B ? 6 : e.die, B ? 'off' : (i < n - spent ? 'on' : 'hitch'))}</button>`).join('');
    return `<div class="ftrait"><div class="tn"><span class="nmb" style="cursor:default">${B ? '&nbsp;' : esc(e.name)}</span><span class="small muted">${B ? '' : esc(typeName[e.type] || '')}</span></div>
      <div class="ladder">${dice}${!B && spent ? `<button class="linkbtn noprint" data-act="resRestore" data-set="${set.id}" data-id="${e.id}">Restore</button>` : ''}</div>
      <div class="small muted">${B ? 'Tags:' : esc((e.tags || []).filter(Boolean).join(' · '))}</div></div>`;
  }).join('') || '<p class="small muted">None yet.</p>';
  return fsec(set.name, inner);
}
function fsetPS(S, C, set, B) {
  const inner = (C.entries[set.id] || []).map(ps => `<div class="fbox ${ps.shutdown ? 'ftrait shut' : ''}"><div class="row"><b class="k" style="font-size:17px;text-transform:uppercase">${B ? '&nbsp;' : esc(ps.name || 'Power set')}</b><span class="grow"></span>${ps.shutdown && !B ? `<span class="tag">shut down</span><button class="linkbtn noprint" data-act="psRestore" data-id="${ps.id}" data-set="${set.id}">Restore</button>` : ''}</div>
    ${!B && ps.desc ? `<div class="dd desc small">${esc(ps.desc)}</div>` : ''}
    ${(ps.powers || []).map(pw => `<div class="ps-power"><button class="nmb" data-act="poolPower" data-set="${set.id}" data-ps="${ps.id}" data-id="${pw.id}" ${B || ps.shutdown ? 'disabled' : ''}>${B ? '&nbsp;' : esc(pw.name || '—')}</button><span class="ladder" style="display:flex;gap:4px">${ladder(pw.die, B, { min: 6 })}</span></div>`).join('')}
    <div class="fmini">${esc(T(S, 'sfx'))}</div>${(ps.sfx || []).map(x => sfxLine(x, true)).join('') || (B ? '<div class="fsfx"><span class="bl"></span><span>&nbsp;</span></div>' : '')}
    <div class="fmini">${esc(T(S, 'limit'))}s</div>${(ps.limits || []).map((x, j) => sfxLine(x, true, !B && !ps.shutdown ? ` <button class="linkbtn noprint act" data-act="psLimit" data-id="${ps.id}" data-set="${set.id}">Trigger (+1 ${esc(T(S, 'ppAbbr'))})</button>` : '')).join('') || (B ? '<div class="fsfx"><span class="bl"></span><span>&nbsp;</span></div>' : '')}</div>`).join('');
  return fsec(set.name, inner || '<p class="small muted">None yet.</p>');
}
function fsetAb(S, C, set, B) {
  const inner = (C.entries[set.id] || []).filter(a => B || a.name).map(a => `<div class="fbox"><div class="ps-power"><button class="nmb" data-act="poolAbility" data-set="${set.id}" data-id="${a.id}" ${B ? 'disabled' : ''}>${B ? '&nbsp;' : esc(a.name)}</button><span class="ladder" style="display:flex;gap:4px">${ladder(a.die, B, { min: 6 })}</span></div>
    ${B ? '<div class="small muted">Effect:</div>' : `<div class="small muted">${esc(a.effect)}${a.descriptor ? ' · ' + esc(a.descriptor) : ''}</div>`}${!B && a.desc ? `<div class="desc small">${esc(a.desc)}</div>` : ''}
    ${(a.sfx || []).map(x => sfxLine(x, !!x.unlocked)).join('')}</div>`).join('');
  return fsec(set.name, inner || '<p class="small muted">None yet.</p>');
}
function fsetTal(S, C, set, B) {
  const inner = (C.entries[set.id] || []).filter(t => B || t.name).map(t => `<div class="fbox"><b class="k" style="text-transform:uppercase">${B ? '&nbsp;' : esc(t.name)}</b>${!B && t.desc ? `<div class="desc small">${esc(t.desc)}</div>` : ''}
    <div class="small"><b class="k">Activation:</b> ${B ? '' : esc(t.activation)}</div><div class="small"><b class="k">Effect:</b> ${B ? '' : esc(t.effect)}</div></div>`).join('');
  return fsec(set.name, inner || '<p class="small muted">None yet.</p>');
}
function stressTracks(S) {
  if (S.opt.shaken) { const set = byId(S.sets, S.stress.shakenSet); return set ? set.traits.map(t => ({ id: 't:' + t.id, name: t.name, trait: t, set })) : []; }
  return S.stress.tracks.map(t => ({ id: t.id, name: t.name }));
}
function fsetStress(S, C, B) {
  const tracks = stressTracks(S);
  const chainBtns = (key, v, kind) => `<span class="chain">${DICE.map((d, i) => (i ? '<span class="arr"></span>' : '') + `<button class="dbtn" style="padding:0" data-act="setStress" data-kind="${kind}" data-k="${esc(key)}" data-die="${d}" ${B ? 'disabled' : ''} aria-label="${kind} d${d}">${dieSvg(d, !B && +v === d ? 'on' : 'off')}</button>`).join('')}</span>`;
  let shakenCount = 0;
  const rows = tracks.map(tr => {
    const v = +(C.stress[tr.id] || 0), tv = +(C.trauma[tr.id] || 0);
    if (tr.trait && v && v > +((C.ratings[tr.set.id] || {})[tr.trait.id] || 0)) shakenCount++;
    return `<div class="fstress"><span class="snm">${esc(tr.name || 'Stress')}</span><div class="row" style="gap:6px">${chainBtns(tr.id, v, 'stress')}
      ${!B && v ? `<span class="noprint row" style="gap:2px"><button class="linkbtn" data-act="stressOpp" data-k="${esc(tr.id)}" title="Add to the opposition's pool">→ opp</button>${S.opt.pushStress ? `<button class="linkbtn" data-act="stressPush" data-k="${esc(tr.id)}" title="Spend a ${esc(T(S, 'pp'))} to roll it in your own pool, then it steps up">push</button>` : ''}${v === 4 ? `<button class="linkbtn" data-act="stressOwn" data-k="${esc(tr.id)}" title="A d4 goes in your own pool and earns a ${esc(T(S, 'pp'))}">use d4</button>` : ''}</span>` : ''}</div></div>
      ${S.opt.trauma ? `<div class="fstress" style="padding-top:0"><span class="small muted" style="padding-left:12px">${esc(T(S, 'trauma'))}</span>${chainBtns(tr.id, tv, 'trauma')}</div>` : ''}`;
  }).join('') || '<p class="small muted">No stress tracks defined.</p>';
  const status = S.opt.shaken && shakenCount ? `<p class="small" style="color:var(--bad);margin:4px 0 0"><b>${shakenCount > 1 ? 'Stricken' : 'Shaken'}:</b> ${shakenCount > 1 ? 'taken out until you recover.' : 'you can keep only one die in your total.'}</p>` : '';
  return fsec(T(S, 'stress'), rows + status);
}
function fsetLife(S, C, B) {
  const max = lifeMax(S, C);
  let inner;
  if (S.opt.lifeMode === 'threshold') {
    const w = +C.life.wounds || 0, st = +C.life.stun || 0;
    const status = B ? '' : (w > max ? 'Dead' : (w + st > max ? 'Unconscious' : 'Up'));
    inner = `<div class="row"><b class="k" style="font-size:22px">${B ? '___' : max}</b><span class="small muted">life points</span>${status ? `<span class="tag ${status === 'Up' ? 'ok' : ''}">${status}</span>` : ''}</div>
      <div class="g2" style="margin-top:6px"><div class="row"><span class="k">Wounds</span>${B ? '____' : `<button class="icon-btn sm noprint" data-act="bump" data-path="C.life.wounds" data-n="-1" data-min="0">−</button><b class="k">${w}</b><button class="icon-btn sm noprint" data-act="bump" data-path="C.life.wounds" data-n="1">+</button>`}</div>
      <div class="row"><span class="k">Stun</span>${B ? '____' : `<button class="icon-btn sm noprint" data-act="bump" data-path="C.life.stun" data-n="-1" data-min="0">−</button><b class="k">${st}</b><button class="icon-btn sm noprint" data-act="bump" data-path="C.life.stun" data-n="1">+</button>`}</div></div>`;
  } else {
    const left = max - (+C.life.dmg || 0);
    inner = `<div class="row"><b class="k" style="font-size:22px">${B ? '___' : left}</b><span class="small muted">of ${B ? '___' : max} life points</span>
      ${B ? '' : `<span class="noprint row" style="gap:2px"><button class="btn quiet small" data-act="lifeDmg" data-n="1">Take damage</button><button class="btn quiet small" data-act="lifeDmg" data-n="-1">Heal</button></span>`}${!B && left <= 0 ? '<span class="tag">Taken out</span>' : ''}</div>`;
  }
  return fsec('Life', inner);
}
function fsetPlay(S, C, B) {
  const tokens = B ? `<div class="tokens">${Array(6).fill('<span class="token empty">' + esc(T(S, 'ppAbbr')) + '</span>').join('')}</div>`
    : `<div class="tokens">${Array.from({ length: Math.max(C.pp, 0) }, () => `<span class="token">${esc(T(S, 'ppAbbr'))}</span>`).join('') || '<span class="small muted">None</span>'}<span class="noprint row" style="gap:2px;margin-left:6px"><button class="icon-btn sm" data-act="ppBump" data-n="-1" aria-label="Spend">−</button><button class="icon-btn sm" data-act="ppBump" data-n="1" aria-label="Gain">+</button></span></div>`;
  let h = `<div class="fmini">${esc(T(S, 'pps'))}</div>${tokens}`;
  if (on(S, 'heroDice')) h += `<div class="fmini">${esc(T(S, 'hero'))}${T(S, 'hero').endsWith('e') ? '' : ''} bank</div><div class="row" style="gap:4px">${B ? DICE.map(d => dieSvg(d, 'off')).join('') : (C.hero.map((d, i) => `<button class="dbtn" data-act="heroUse" data-i="${i}" title="Add to your roll">${dieSvg(d, 'effect')}</button>`).join('') || '<span class="small muted">None banked</span>')}
    ${B ? '' : `<span class="noprint">${sel('U.heroAdd', DB.ui.heroAdd || 6, DICE.map(d => [d, 'd' + d]), { re: false, extra: 'style="width:auto;padding:2px 4px"' })}<button class="linkbtn" data-act="heroBank">bank</button></span>`}</div>`;
  if (on(S, 'complications') || true) {
    const temps = B ? [] : C.temps;
    h += `<div class="fmini">${esc(T(S, 'asset'))}s & ${esc(T(S, 'complication').toLowerCase())}s</div>`;
    h += temps.map((t, i) => `<div class="temp-row"><button class="dbtn" data-act="poolTemp" data-i="${i}" title="${t.type === 'asset' ? 'Add to your pool' : 'Add to the opposition (a d4 goes in yours)'}">${dieSvg(t.die, t.type === 'asset' ? 'on' : 'doom')}</button>
      <input class="bare" style="flex:1;font-family:var(--f-display);font-weight:600;text-transform:uppercase" value="${esc(t.name)}" placeholder="${t.type === 'asset' ? 'Asset' : 'Complication'}" ${bindAttr(`C.temps.${i}.name`)}>
      <span class="tag ${t.type === 'asset' ? '' : 'ink'}">${t.type === 'asset' ? (t.scope === 'session' ? 'session' : 'scene') : 'compl.'}</span>
      <span class="noprint row" style="gap:0"><button class="icon-btn sm" data-act="tempStep" data-i="${i}" data-n="-1" aria-label="Step down">▾</button><button class="icon-btn sm" data-act="tempStep" data-i="${i}" data-n="1" aria-label="Step up">▴</button><button class="icon-btn sm" data-act="delItem" data-path="C.temps" data-i="${i}" aria-label="Remove">✕</button></span></div>`).join('');
    if (!B) h += `<div class="row noprint" style="margin-top:4px;gap:6px"><button class="btn quiet small" data-act="newAsset" data-pay="1">${esc(T(S, 'asset'))} d6 (1 ${esc(T(S, 'ppAbbr'))})</button><button class="btn quiet small" data-act="newAsset" data-pay="0">${esc(T(S, 'asset'))} (free)</button><button class="btn quiet small" data-act="newComp">${esc(T(S, 'complication'))}</button></div>`;
    else h += '<div style="height:70px"></div>';
  }
  return fsec('Play', h);
}
function fsetGrowth(S, C, B) {
  let h = '';
  if (on(S, 'milestones')) {
    const avail = (+C.xp.earned || 0) - (+C.xp.spent || 0);
    h += `<div class="fmini">${esc(T(S, 'xp'))}</div><div class="row">${B ? '<span class="small">Earned ____ Spent ____</span>' : `<b class="k" style="font-size:20px">${avail}</b><span class="small muted">available (${C.xp.earned} earned, ${C.xp.spent} spent)</span>
      <span class="noprint row" style="gap:3px"><button class="btn quiet small" data-act="xpGain" data-n="1">+1</button><button class="btn quiet small" data-act="xpGain" data-n="3">+3</button><button class="btn quiet small" data-act="xpGain" data-n="10">+10</button><button class="btn quiet small" data-act="xpSpend">Spend</button></span>`}</div>
      ${C.milestones.filter(m => B || m.name).map(m => `<div class="fbox" style="padding:6px 10px"><b class="k" style="text-transform:uppercase">${B ? 'Milestone' : esc(m.name)}</b>${B ? '<div class="small">1 XP:<br>3 XP:<br>10 XP:</div>' : `${m.desc ? `<div class="desc small">${esc(m.desc)}</div>` : ''}<div class="small">${m.x1 ? '<b>1:</b> ' + esc(m.x1) + '<br>' : ''}${m.x3 ? '<b>3:</b> ' + esc(m.x3) + '<br>' : ''}${m.x10 ? '<b>10:</b> ' + esc(m.x10) : ''}</div>`}</div>`).join('')}`;
  }
  if (on(S, 'sessionRecords')) {
    h += `<div class="fmini">Session record</div>${(B ? [{}, {}, {}, {}] : C.sessions).map((s, i) => `<div class="temp-row"><input type="checkbox" class="bubble" title="Callback used this session" ${s.callback ? 'checked' : ''} ${B ? 'disabled' : bindAttr(`C.sessions.${i}.callback`)}><input class="bare" style="flex:1" value="${esc(s.name || '')}" placeholder="Session name" ${B ? 'disabled' : bindAttr(`C.sessions.${i}.name`)}>
      ${B ? '' : `<label class="check small"><input type="checkbox" ${s.spent ? 'checked' : ''} ${bindAttr(`C.sessions.${i}.spent`)} data-re>spent</label><button class="icon-btn sm noprint" data-act="delItem" data-path="C.sessions" data-i="${i}" aria-label="Remove">✕</button>`}</div>`).join('')}
      ${B ? '' : `<div class="row noprint"><button class="btn quiet small" data-act="pushItem" data-path="C.sessions" data-item='${esc(JSON.stringify({ name: '', callback: false, spent: false }))}'>Add session</button><button class="btn quiet small" data-act="showTraining">Training costs</button></div>`}`;
  }
  if (on(S, 'growth')) {
    h += `<div class="fmini">Growth pool</div><div class="row" style="gap:4px">${B ? '' : (C.growthPool.map((d, i) => `<button class="dbtn" data-act="delItem" data-path="C.growthPool" data-i="${i}" title="Remove">${dieSvg(d)}</button>`).join('') || '<span class="small muted">Empty</span>')}
      ${B ? '<div style="height:30px"></div>' : `<span class="noprint">${sel('U.growAdd', DB.ui.growAdd || 6, DICE.map(d => [d, 'd' + d]), { re: false, extra: 'style="width:auto;padding:2px 4px"' })}<button class="linkbtn" data-act="growAdd">add</button> <button class="btn quiet small" data-act="tagScene">Tag scene test</button></span>`}</div>`;
  }
  return fsec('Growth', h);
}
function fsetVehicles(S, C, B) {
  const list = B ? [{ name: '', scale: 0, r: {}, dist: '', sfx: [] }] : C.vehicles;
  return fsec('Vehicles', list.map(v => `<div class="fbox"><div class="row"><b class="k" style="text-transform:uppercase;font-size:16px">${B ? '&nbsp;' : esc(v.name || 'Vehicle')}</b><span class="grow"></span>${v.scale ? `<span class="small">Scale</span>${dieSvg(v.scale)}` : ''}</div>
    ${S.vehicle.traits.map((t, j) => `<div class="ps-power"><button class="nmb" data-act="poolVehicle" data-v="${esc(v.id || '')}" data-j="${j}" ${B ? 'disabled' : ''}>${esc(t.name)}</button><span class="ladder" style="display:flex;gap:4px">${ladder((v.r || {})[j] || S.vehicle.die, B)}</span></div>`).join('')}
    ${v.dist ? `<div class="small"><b class="k">${esc(T(S, 'distinction'))}:</b> ${esc(v.dist)}</div>` : ''}${v.sig ? `<div class="small"><b class="k">Signature asset:</b> ${esc(v.sig)}</div>` : ''}${(v.sfx || []).map(x => sfxLine(x, true)).join('')}</div>`).join(''));
}

/* ---------- file actions ---------- */
function addPool(item) { const C = curC(); POOL.own.push(Object.assign({ id: uid('pl_') }, item)); if (C) POOL.charId = C.id; renderTray(); }
function addOpp(item) { POOL.opp.push(Object.assign({ id: uid('po_') }, item)); renderTray(); }
A.poolTrait = el => {
  const S = curS(), C = curC(); const set = byId(S.sets, el.dataset.set); const t = byId(set.traits, el.dataset.t);
  const v = +((C.ratings[set.id] || {})[t.id] || 0);
  if (!v) return toast(`${t.name} has no rating.`, 'bad');
  addPool({ die: v, label: t.name, setKey: set.id, src: { set: set.id, t: t.id } });
  if (on(S, 'stress') && S.opt.shaken && S.stress.shakenSet === set.id) {
    const st = +(C.stress['t:' + t.id] || 0);
    if (st === 4) { addPool({ die: 4, label: `${T(S, 'stress')} on ${t.name} (d4)`, d4pp: true }); toast(`The d4 ${T(S, 'stress').toLowerCase()} on ${t.name} goes in your pool (+1 ${T(S, 'ppAbbr')}).`); }
    else if (st) { addOpp({ die: st, label: `${T(S, 'stress')} on ${t.name}` }); toast(`${t.name} carries ${dlabel(st)} ${T(S, 'stress').toLowerCase()}: added to the opposition.`); }
  }
};
A.poolSpec = el => { const C = curC(); const s = (C.specs || []).find(x => x.id === el.dataset.id); for (let i = 0; i < (+s.count || 1); i++) addPool({ die: +s.die || 6, label: s.name }); };
A.poolDist = el => { const S = curS(), C = curC(); const ds = distSet(S); const d = C.entries[ds.id][+el.dataset.k]; if (!d || !d.name) return; addPool({ die: +d.die || 8, label: d.name, setKey: ds.id }); };
A.poolHinder = el => { const S = curS(), C = curC(); const ds = distSet(S); const d = C.entries[ds.id][+el.dataset.k]; if (!d || !d.name) return; addPool({ die: 4, label: d.name + ' (Hinder)', setKey: ds.id, hinder: true }); };
A.poolEntry = el => {
  const S = curS(), C = curC(); const set = byId(S.sets, el.dataset.set); const e = (C.entries[set.id] || []).find(x => x.id === el.dataset.id);
  if (!e || !+e.die) return toast('No rating yet.', 'bad');
  addPool({ die: +e.die, label: e.name, setKey: set.flavor === 'sigassets' ? '' : set.id });
};
A.poolPower = el => { const S = curS(), C = curC(); const ps = C.entries[el.dataset.set].find(x => x.id === el.dataset.ps); const pw = ps.powers.find(x => x.id === el.dataset.id); if (!+pw.die) return; addPool({ die: +pw.die, label: pw.name, setKey: ps.id }); };
A.poolAbility = el => { const C = curC(); const a = C.entries[el.dataset.set].find(x => x.id === el.dataset.id); addPool({ die: +a.die, label: a.name, setKey: el.dataset.set }); };
A.poolVehicle = el => { const S = curS(), C = curC(); const v = C.vehicles.find(x => x.id === el.dataset.v); if (!v) return; const j = +el.dataset.j; addPool({ die: +((v.r || {})[j] || S.vehicle.die), label: (v.name || 'Vehicle') + ' ' + S.vehicle.traits[j].name, setKey: 'veh:' + v.id }); };
A.poolRes = el => {
  const C = curC(); const e = C.entries[el.dataset.set].find(x => x.id === el.dataset.id);
  const pending = POOL.res.filter(r => r.resId === e.id).length;
  if ((+e.count || 0) - (+e.spent || 0) - pending <= 0) return toast('No dice left in that resource.', 'bad');
  POOL.res.push({ id: uid('pr_'), die: +e.die, label: e.name, resId: e.id, resSet: el.dataset.set }); POOL.charId = C.id; renderTray();
};
A.resRestore = el => { const C = curC(); const e = C.entries[el.dataset.set].find(x => x.id === el.dataset.id); e.spent = 0; touch(C); render(); };
A.challenge = el => {
  const S = curS(), C = curC(); const set = byId(S.sets, el.dataset.set); const t = byId(set.traits, el.dataset.t);
  const v = +C.ratings[set.id][t.id]; if (!v) return;
  for (let i = 0; i < 3; i++) addPool({ die: v, label: t.name + ' (challenged)', setKey: i ? '' : set.id, challenge: { set: set.id, t: t.id } });
  toast(`${t.name} tripled. It steps down after the roll.`);
};
A.challengeEntry = el => {
  const S = curS(), C = curC(); const e = C.entries[el.dataset.set].find(x => x.id === el.dataset.id);
  if (!+e.die) return;
  for (let i = 0; i < 3; i++) addPool({ die: +e.die, label: e.name + ' (challenged)', setKey: i ? '' : el.dataset.set, challengeEntry: { set: el.dataset.set, id: e.id } });
  toast(`${e.name} tripled. It steps down after the roll.`);
};
A.ppBump = el => { const C = curC(); C.pp = Math.max(0, C.pp + (+el.dataset.n)); touch(C); render(); };
A.setStress = el => {
  const C = curC(); const k = el.dataset.k, d = +el.dataset.die; const box = el.dataset.kind === 'trauma' ? C.trauma : C.stress;
  box[k] = (+box[k] === d) ? 0 : d; touch(C); render();
};
function stressName(S, k) { const tr = stressTracks(S).find(t => t.id === k); return tr ? tr.name : T(S, 'stress'); }
A.stressOpp = el => { const S = curS(), C = curC(); addOpp({ die: +C.stress[el.dataset.k], label: `${C.name}'s ${stressName(S, el.dataset.k)}` }); toast('Added to the opposition pool'); };
A.stressOwn = el => { const S = curS(), C = curC(); addPool({ die: 4, label: stressName(S, el.dataset.k) + ' (d4)', d4pp: true }); };
A.stressPush = el => { const S = curS(), C = curC(); const k = el.dataset.k; addPool({ die: +C.stress[k], label: stressName(S, k) + ' (pushed)', push: k, ppCost: 1 }); };
A.lifeDmg = el => {
  const n = +el.dataset.n; const C = curC();
  promptBox(n > 0 ? 'Take damage' : 'Recover', n > 0 ? 'Damage (how much the attack beat the difficulty by)' : 'Life points recovered', '', v => { const x = Math.abs(parseInt(v, 10) || 0); C.life.dmg = Math.max(0, (+C.life.dmg || 0) + (n > 0 ? x : -x)); touch(C); render(); }, 'Apply');
};
A.heroBank = () => { const S = curS(), C = curC(); const d = +(DB.ui.heroAdd || 6); if (S.opt.heroOnePer && C.hero.includes(d)) return toast('You already have a d' + d + ' banked.', 'bad'); C.hero.push(d); C.hero.sort((a, b) => a - b); touch(C); render(); };
A.heroUse = el => { const C = curC(); POOL.heroQueue = POOL.heroQueue || []; const i = +el.dataset.i; DB.ui.tab = 'dice'; DB.ui.heroPick = i; render(); toast('Roll first, then add the hero die to your total.'); };
A.newAsset = el => {
  const S = curS(), C = curC(); const pay = el.dataset.pay === '1';
  if (pay && C.pp < 1) return toast(`No ${T(S, 'pps').toLowerCase()} to spend.`, 'bad');
  promptBox('New ' + T(S, 'asset').toLowerCase(), 'Name', '', name => { if (pay) C.pp--; C.temps.push({ id: uid('tm_'), name: name || T(S, 'asset'), die: 6, type: 'asset', scope: 'scene' }); touch(C); render(); }, 'Create');
};
A.newComp = () => { const S = curS(), C = curC(); promptBox('New ' + T(S, 'complication').toLowerCase(), 'Name', '', name => { C.temps.push({ id: uid('tm_'), name: name || T(S, 'complication'), die: 6, type: 'comp', scope: 'open' }); touch(C); render(); }, 'Add'); };
A.tempStep = el => {
  const S = curS(), C = curC(); const t = C.temps[+el.dataset.i]; const n = +el.dataset.n;
  const d = n > 0 ? stepUp(t.die) : stepDown(t.die);
  if (d === 0) { C.temps.splice(+el.dataset.i, 1); toast(`${t.name} is gone.`); }
  else if (d > 12) { t.die = 12; toast(t.type === 'asset' ? 'Already at d12.' : `${t.name} stepped past d12: taken out of the scene!`, t.type === 'asset' ? '' : 'bad'); }
  else t.die = d;
  touch(C); render();
};
A.poolTemp = el => {
  const C = curC(); const t = C.temps[+el.dataset.i];
  if (t.type === 'asset') addPool({ die: t.die, label: t.name });
  else if (+t.die === 4) addPool({ die: 4, label: t.name + ' (d4)', d4pp: true });
  else { addOpp({ die: t.die, label: t.name }); toast('Added to the opposition pool'); }
};
A.psLimit = el => { const S = curS(), C = curC(); const ps = C.entries[el.dataset.set].find(x => x.id === el.dataset.id); ps.shutdown = true; C.pp++; touch(C); render(); toast(`${ps.name} shut down. +1 ${T(S, 'ppAbbr')}`); };
A.psRestore = el => { const C = curC(); const ps = C.entries[el.dataset.set].find(x => x.id === el.dataset.id); ps.shutdown = false; touch(C); render(); };
A.xpGain = el => { const C = curC(); C.xp.earned = (+C.xp.earned || 0) + (+el.dataset.n); touch(C); render(); };
A.xpSpend = () => {
  const S = curS(), C = curC(); const avail = (+C.xp.earned || 0) - (+C.xp.spent || 0);
  openModal('Spend ' + T(S, 'xp'), `<p class="prose small">${avail} available. Pick an unlockable; make the change in the builder.</p>${S.growth.unlocks.map((u, i) => `<button class="setcard" style="width:100%;margin-top:6px" data-act="xpBuy" data-i="${i}" ${u.cost > avail ? 'disabled style="opacity:.5;width:100%;margin-top:6px"' : ''}><div class="row" style="width:100%"><span class="grow">${esc(u.label)}</span><b class="k">${u.cost}</b></div></button>`).join('')}`);
};
A.xpBuy = el => { const S = curS(), C = curC(); const u = S.growth.unlocks[+el.dataset.i]; C.xp.spent = (+C.xp.spent || 0) + (+u.cost); (C.xp.log = C.xp.log || []).push({ at: now(), label: u.label, cost: u.cost }); closeModal(); touch(C); render(); toast(`Spent ${u.cost} ${T(S, 'xp')}: ${u.label}`); };
A.showTraining = () => { const S = curS(); openModal('Training costs', `<table class="tbl"><tr><th>Upgrade</th><th>Sessions</th></tr>${S.growth.training.map(t => `<tr><td>${esc(t.label)}</td><td>${t.cost}</td></tr>`).join('')}</table><p class="small muted">Mark the sessions you spend; a spent session can't be used for callbacks.</p>`); };
A.growAdd = () => { const C = curC(); C.growthPool.push(+(DB.ui.growAdd || 6)); touch(C); render(); };
A.tagScene = () => {
  const S = curS(), C = curC();
  openModal('Tag scene: step up a trait', `<p class="prose small">Roll your growth pool plus the biggest ${esc(T(S, 'stress').toLowerCase())} or complication you had this session. Beat one die the size you're stepping up to, plus a die for the trait type. ${esc(T(S, 'pps'))} can't help and hitches are ignored. ${refTag('p.83')}</p>
    <div class="g3"><label class="fld"><span>Stepping up to</span><select id="tsTo">${DICE.map(d => `<option value="${d}">d${d}</option>`).join('')}</select></label>
    <label class="fld"><span>Trait type</span><select id="tsType">${GROWTH_TYPE_DIE.map(([l, d]) => `<option value="${d}">${esc(l)}</option>`).join('')}</select></label>
    <label class="fld"><span>Biggest stress or complication</span><select id="tsStress"><option value="0">None</option>${DICE.map(d => `<option value="${d}">d${d}</option>`).join('')}</select></label></div>
    <div id="tsOut" style="margin-top:12px"></div>`, { actions: `<button class="btn ghost" data-act="closeModal">Close</button><button class="btn" id="tsRoll">Roll</button>` });
  $('#tsRoll').onclick = () => {
    const pool = C.growthPool.slice(); const st = +$('#tsStress').value; if (st) pool.push(st);
    const diff = [+$('#tsTo').value, +$('#tsType').value];
    const r1 = pool.map(d => ({ die: d, val: rollDie(d) })), r2 = diff.map(d => ({ die: d, val: rollDie(d) }));
    const tot = sum(r1.map(r => r.val).sort((a, b) => b - a).slice(0, 2)); const dt = sum(r2.map(r => r.val));
    const win = tot > dt;
    $('#tsOut').innerHTML = `<div class="row">${r1.map(r => dieSvg(r.die, 'total', r.val)).join('')}<b class="k">= ${tot}</b><span class="muted">vs</span>${r2.map(r => dieSvg(r.die, 'doom', r.val)).join('')}<b class="k">= ${dt}</b></div>
      <p class="verdict ${win ? 'win' : 'lose'}" style="margin-top:8px">${win ? 'Success: step it up' : 'Not this time'}</p><p class="small">${win ? 'The growth pool is used up.' : 'You can step it up anyway by stepping something else down; the growth pool stays for next session.'}</p>
      ${win ? '<button class="btn small" id="tsClear">Empty the growth pool</button>' : ''}`;
    const b = $('#tsClear'); if (b) b.onclick = () => { C.growthPool = []; touch(C); closeModal(); render(); };
  };
};
A.newScene = () => {
  const S = curS(), C = curC();
  openModal('New scene', `<p class="prose small">Clears this character's scene ${esc(T(S, 'asset').toLowerCase())}s.</p>${on(S, 'stress') ? chkRaw('nsRest', `Rest scene: step down all ${esc(T(S, 'stress').toLowerCase())} by one`) : ''}`, { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="nsGo">Start scene</button>` });
  $('#nsGo').onclick = () => {
    C.temps = C.temps.filter(t => !(t.type === 'asset' && t.scope !== 'session'));
    const rest = $('#nsRest') && $('#nsRest').checked;
    if (rest) Object.keys(C.stress).forEach(k => { C.stress[k] = stepDown(+C.stress[k]); });
    closeModal(); touch(C); render(); toast('New scene' + (rest ? '; stress stepped down' : ''));
  };
};
function chkRaw(id, label) { return `<label class="check"><input type="checkbox" class="bubble" id="${id}"><span>${label}</span></label>`; }
function sessionReset(S, C) {
  const st = startPP(S);
  if (S.opt.ppMode === 'add') C.pp += st;
  else if (S.opt.ppMode === 'd4') { C.pp = Math.max(C.pp, rollDie(4)); }
  else if (S.opt.ppMode !== 'rolloff') C.pp = Math.max(C.pp, st);
  S.sets.forEach(set => { if (set.kind === 'resources') (C.entries[set.id] || []).forEach(e => { e.spent = 0; }); if (set.kind === 'powersets') (C.entries[set.id] || []).forEach(ps => { ps.shutdown = false; }); });
  C.temps = C.temps.filter(t => t.type !== 'asset');
  C.sessions.forEach(s => { s.callback = false; });
}
A.newSession = () => {
  const S = curS(), C = curC();
  confirmBox(`Start a new session for ${C.name || 'this character'}? Resets ${T(S, 'pps').toLowerCase()} by the setting's rule, restores resources and shut-down powers, clears ${T(S, 'asset').toLowerCase()}s and callbacks.`, () => { sessionReset(S, C); touch(C); render(); toast('New session'); }, 'Start session');
};
A.print = () => window.print();

A.resolveStmt = el => {
  const S = curS(), C = curC();
  let text, orig, cur, apply;
  if (el.dataset.id) {
    const e = C.entries[el.dataset.set].find(x => x.id === el.dataset.id);
    text = e.statement; orig = +e.origDie || +e.die; cur = +e.die;
    apply = (restore, t) => { if (restore) { e.die = orig; e.statement = t; } e.challenged = false; delete e.origDie; };
  } else {
    const st = C.stmt[el.dataset.set][el.dataset.t];
    text = st.text; orig = +st.orig || +C.ratings[el.dataset.set][el.dataset.t]; cur = +C.ratings[el.dataset.set][el.dataset.t];
    apply = (restore, t) => { if (restore) { C.ratings[el.dataset.set][el.dataset.t] = orig; st.text = t; } st.challenged = false; delete st.orig; };
  }
  openModal('Resolve a challenged statement', `<p class="prose small">At the end of the session, either rewrite the statement and return the die to ${dlabel(orig)}, or keep the statement and stay at ${dlabel(cur)} ${refTag('p.65')}. If the set has a fixed number of steps, step something else up in the builder to balance it.</p>
    <label class="fld"><span>New statement</span><input id="rsTxt" value="${esc(text || '')}"></label>`,
    { actions: `<button class="btn ghost" id="rsKeep">Keep it, stay at ${dlabel(cur)}</button><button class="btn" id="rsNew">Rewrite and restore ${dlabel(orig)}</button>` });
  $('#rsKeep').onclick = () => { apply(false); closeModal(); touch(C); render(); };
  $('#rsNew').onclick = () => { const t = $('#rsTxt').value.trim(); if (!t || t === text) return toast('Write a new statement first.', 'bad'); apply(true, t); closeModal(); touch(C); render(); };
};
