/* ============ Dice view: pool, roll, opposition, log ============ */
function poolChar() { const c = DB.chars[POOL.charId]; return c && c.settingId === DB.ui.settingId ? c : curC(); }
VIEWS.dice = () => {
  const S = curS();
  const C = S ? poolChar() : null;
  if (C) POOL.charId = C.id;
  const chars = S ? charsOf(S).filter(netCanWrite) : [];
  const pp = S ? T(S, 'ppAbbr') : 'PP';
  const cost = poolCost(POOL.own) + sum(POOL.own.map(i => +i.ppCost || 0));
  const scaleOn = S && on(S, 'scale');
  const own = `<div class="panel"><div class="bar">Your pool</div><div class="in">
    ${chars.length ? `<div class="row" style="margin-bottom:10px"><label class="fld grow"><span>Rolling for</span><select data-act-change="poolCharPick">${chars.map(c => `<option value="${c.id}" ${C && C.id === c.id ? 'selected' : ''}>${esc(c.name || 'Unnamed')}</option>`).join('')}<option value="" ${C ? '' : 'selected'}>Nobody (loose dice)</option></select></label>
      ${C ? `<div class="row" style="gap:4px;align-self:flex-end"><button class="icon-btn" data-act="ppBumpPool" data-n="-1" aria-label="Spend">−</button><b class="k" style="font-size:18px">${C.pp} ${esc(pp)}</b><button class="icon-btn" data-act="ppBumpPool" data-n="1" aria-label="Gain">+</button></div>` : ''}</div>` : ''}
    <div class="row" style="gap:6px;min-height:36px">${POOL.own.map((it, i) => `<span class="chip ${it.setKey && POOL.own.filter(x => x.setKey === it.setKey).indexOf(it) > 0 ? 'cost' : ''}">${dieSvg(it.die)}<span>${esc(it.label || 'd' + it.die)}</span>
      <button class="x" data-act="poolStep" data-i="${i}" data-n="-1" aria-label="Step down" title="Step down">▾</button><button class="x" data-act="poolStep" data-i="${i}" data-n="1" aria-label="Step up" title="Step up">▴</button><button class="x" data-act="poolDouble" data-i="${i}" aria-label="Double" title="Double">×2</button><button class="x" data-act="poolDel" data-side="own" data-i="${i}" aria-label="Remove">✕</button></span>`).join('')}
      ${POOL.res.map((it, i) => `<span class="chip" title="Resource die: rolled separately, best one adds to the total">${dieSvg(it.die, 'free')}<span>${esc(it.label)}</span><button class="x" data-act="poolDel" data-side="res" data-i="${i}" aria-label="Remove">✕</button></span>`).join('')}
      ${!POOL.own.length && !POOL.res.length ? '<span class="small muted">Empty. Tap traits on a character file, or add dice below.</span>' : ''}</div>
    <div class="row" style="margin-top:10px;gap:4px"><span class="lbl">Add</span>${DICE.map(d => `<button class="dbtn" data-act="poolAddDie" data-die="${d}" aria-label="Add d${d}">${dieSvg(d, 'off')}</button>`).join('')}
      ${C ? `<button class="btn quiet small" data-act="pickFromFile">From ${esc(C.name || 'file')}…</button>` : ''}</div>
    ${cost ? `<p class="small" style="color:var(--crimson);margin:8px 0 0">Costs ${cost} ${esc(pp)}: more than one trait from the same set${POOL.own.some(i => i.push) ? ', or pushing stress' : ''}.</p>` : ''}
    <div class="row" style="margin-top:12px"><span class="lbl">Auto-pick</span><span class="seg"><button data-act="setPrefer" data-v="total" aria-pressed="${DB.ui.prefer !== 'effect'}">Best total</button><button data-act="setPrefer" data-v="effect" aria-pressed="${DB.ui.prefer === 'effect'}">Best effect</button></span>
      ${scaleOn ? `<label class="check" style="align-items:center"><input type="checkbox" class="bubble" ${POOL.scale ? 'checked' : ''} data-act="toggleScale"><span class="small">Scale die (${S.opt.multiScale ? sel('P.scaleDie', POOL.scaleDie || 8, DICE.map(d => [d, 'd' + d]), { re: false, extra: 'style="width:auto;padding:1px 4px"' }) : 'd8'}, keep +1)</span></label>` : ''}</div>
    <div class="row" style="margin-top:12px"><button class="btn big" data-act="rollPool" ${POOL.own.length || POOL.res.length ? '' : 'disabled'}>Roll ${POOL.own.length + POOL.res.length + (POOL.scale ? 1 : 0)} dice</button><button class="btn quiet" data-act="clearPool">Clear pool</button></div>
    ${POOL.last ? resultPanel(S, C) : ''}</div></div>`;
  const opp = oppPanel(S);
  return `<div class="pagehead"><div><h1>Dice</h1><p class="lede">Roll the pool, keep two for the total, pick an effect die. Ones are hitches.</p></div></div>
    <div class="rollzone">${own}${opp}</div>
    ${outcomePanel(S)}
    <section class="sec" style="margin-top:22px"><div class="sec-head"><h2>Roll log</h2>${DB.log.length ? '<button class="btn quiet small" data-act="clearLog">Clear log</button>' : ''}</div>
    <ul class="loglist">${DB.log.slice(0, 30).map(l => `<li><span class="muted small">${new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> <b class="k">${esc(l.who)}</b> ${esc(l.text)}</li>`).join('') || '<li class="muted">No rolls yet.</li>'}</ul></section>
    ${S ? netRollFeed(S) : ''}`;
};
A.poolCharPick = el => { POOL.charId = el.value || null; if (el.value) DB.ui.charId = el.value; render(); };
A.ppBumpPool = el => { const C = poolChar(); if (!C) return; C.pp = Math.max(0, C.pp + (+el.dataset.n)); touch(C); render(); };
A.poolAddDie = el => { POOL.own.push({ id: uid('pl_'), die: +el.dataset.die, label: 'd' + el.dataset.die }); render(); };
A.poolStep = el => { const it = POOL.own[+el.dataset.i]; const d = +el.dataset.n > 0 ? stepUp(it.die) : stepDown(it.die); if (!d) POOL.own.splice(+el.dataset.i, 1); else it.die = Math.min(12, d); render(); };
A.poolDouble = el => { const it = POOL.own[+el.dataset.i]; POOL.own.splice(+el.dataset.i + 1, 0, { id: uid('pl_'), die: it.die, label: (it.label || '') + ' (doubled)' }); render(); };
A.poolDel = el => { const side = el.dataset.side; const arr = side === 'res' ? POOL.res : side === 'opp' ? POOL.opp : POOL.own; arr.splice(+el.dataset.i, 1); if (DB.ui.tab === 'dice' || DB.ui.tab === 'gm') render(); else renderTray(); };
A.clearPool = () => { POOL.own = []; POOL.res = []; POOL.scale = 0; if (DB.ui.tab === 'dice') render(); else renderTray(); };
A.setPrefer = el => { DB.ui.prefer = el.dataset.v; if (POOL.last) { autoAssign(POOL.last.results, assignOpts(curS(), POOL.last)); } render(); };
A.toggleScale = () => { POOL.scale = POOL.scale ? 0 : 1; render(); };
A.clearLog = () => { DB.log = []; save(); render(); };
A.rollFromTray = () => { DB.ui.tab = 'dice'; A.rollPool(); };
A.pickFromFile = () => {
  const S = curS(), C = poolChar(); if (!C) return;
  const groups = [];
  S.sets.forEach(set => {
    const items = [];
    if (set.kind === 'fixed') set.traits.forEach(t => { const v = +((C.ratings[set.id] || {})[t.id] || 0); if (v) items.push(`<button class="chip click" data-act="poolTrait2" data-set="${set.id}" data-t="${t.id}">${dieSvg(v)}${esc(t.name)}</button>`); });
    else if (set.kind === 'distinctions') (C.entries[set.id] || []).forEach((d, k) => { if (d.name) { items.push(`<button class="chip click" data-act="poolDist2" data-k="${k}">${dieSvg(+d.die || 8)}${esc(d.name)}</button>`); items.push(`<button class="chip click" data-act="poolHinder2" data-k="${k}">${dieSvg(4)}${esc(d.name)} (Hinder)</button>`); } });
    else if (set.kind === 'open') (C.entries[set.id] || []).forEach(e => { if (e.name && +e.die) items.push(`<button class="chip click" data-act="poolEntry2" data-set="${set.id}" data-id="${e.id}">${dieSvg(e.die)}${esc(e.name)}</button>`); });
    else if (set.kind === 'powersets') (C.entries[set.id] || []).forEach(ps => { if (!ps.shutdown) ps.powers.forEach(pw => { if (+pw.die) items.push(`<button class="chip click" data-act="poolPower2" data-set="${set.id}" data-ps="${ps.id}" data-id="${pw.id}">${dieSvg(pw.die)}${esc(pw.name)}</button>`); }); });
    else if (set.kind === 'abilities') (C.entries[set.id] || []).forEach(a => { if (a.name) items.push(`<button class="chip click" data-act="poolAbility2" data-set="${set.id}" data-id="${a.id}">${dieSvg(a.die)}${esc(a.name)}</button>`); });
    if (items.length) groups.push(`<div class="pickgrp"><div class="pg">${esc(set.name)}</div><div class="trait-picker">${items.join('')}</div></div>`);
  });
  const sp = (C.specs || []).filter(s => s.name); if (sp.length) groups.push(`<div class="pickgrp"><div class="pg">Specialties</div><div class="trait-picker">${sp.map(s => `<button class="chip click" data-act="poolSpec2" data-id="${s.id}">${dieSvg(s.die || 6)}${esc(s.name)}</button>`).join('')}</div></div>`);
  const tm = C.temps.filter(t => t.type === 'asset'); if (tm.length) groups.push(`<div class="pickgrp"><div class="pg">${esc(T(S, 'asset'))}s</div><div class="trait-picker">${tm.map(t => `<button class="chip click" data-act="poolTemp2" data-i="${C.temps.indexOf(t)}">${dieSvg(t.die)}${esc(t.name)}</button>`).join('')}</div></div>`);
  openModal('Add from ' + (C.name || 'file'), (groups.join('') || '<p class="muted">Nothing rated yet.</p>') + '<p class="small muted" style="margin-top:12px">Tap as many as you like; the pool updates behind this window.</p>', { wide: true });
};
['poolTrait', 'poolDist', 'poolHinder', 'poolEntry', 'poolPower', 'poolAbility', 'poolSpec', 'poolTemp'].forEach(n => { A[n + '2'] = el => { A[n](el); toast('Added'); }; });
A.closeModalRender = () => { closeModal(); render(); };

function assignOpts(S, R) {
  return { keep: R.keep, effects: R.effects, addAll: on(S, 'addAll'), noEffect: on(S, 'noEffect'), target: R.target, prefer: DB.ui.prefer === 'effect' ? 'effect' : 'total' };
}
function currentTarget() {
  if (POOL.opRoll && POOL.opRoll.at && (!POOL.last || POOL.opRoll.at < POOL.last.at || !POOL.last)) return POOL.opRoll.total;
  if (POOL.staticDiff != null && POOL.staticDiff !== '') return +POOL.staticDiff;
  return null;
}
A.rollPool = () => {
  const S = curS(); const C = S ? poolChar() : null;
  if (!POOL.own.length && !POOL.res.length) { render(); return; }
  const cost = poolCost(POOL.own) + sum(POOL.own.map(i => +i.ppCost || 0));
  const items = POOL.own.map(x => Object.assign({}, x));
  let keep = 2;
  if (POOL.scale) { items.push({ id: uid('pl_'), die: +(POOL.scaleDie || 8), label: 'Scale' }); keep++; }
  if (C && S && on(S, 'stress') && S.opt.shaken) {
    const set = byId(S.sets, S.stress.shakenSet);
    const shaken = set ? set.traits.filter(t => +(C.stress['t:' + t.id] || 0) > +((C.ratings[set.id] || {})[t.id] || 0)).length : 0;
    if (shaken === 1) { keep = 1; toast(`${C.name || 'They'} ${C.name ? 'is' : 'are'} shaken: only one die counts toward the total.`); }
    if (shaken > 1) toast(`${C.name || 'They'} ${C.name ? 'is' : 'are'} stricken and out of the scene. Rolled anyway.`, 'bad');
  }
  const results = rollItems(items);
  const R = { results, resRolls: POOL.res.map(r => Object.assign({}, r, { val: rollDie(r.die) })), hero: [], keep, effects: 1, at: Date.now(), charId: C ? C.id : null, events: [] };
  R.target = (POOL.opRoll && POOL.opRoll.at) ? POOL.opRoll.total : (POOL.staticDiff != null && POOL.staticDiff !== '' ? +POOL.staticDiff : null);
  R.firstRoll = !(POOL.opRoll && POOL.opRoll.at);
  autoAssign(results, assignOpts(S, R));
  if (C && S) {
    if (cost) { if (cost > C.pp) toast(`That pool costs ${cost} ${T(S, 'ppAbbr')} but ${C.name || 'they'} only ha${C.name ? 's' : 've'} ${C.pp}. Rolled anyway.`, 'bad'); C.pp = Math.max(0, C.pp - cost); R.events.push(`spent ${cost} ${T(S, 'ppAbbr')}`); }
    const gain = items.filter(i => i.hinder || i.d4pp).length;
    if (gain) { R.ppGain = gain; R.events.push(`earns ${gain} ${T(S, 'ppAbbr')} after the roll`); }
    items.forEach(i => {
      if (i.challenge) { const st = (C.stmt[i.challenge.set] = C.stmt[i.challenge.set] || {}); const s = (st[i.challenge.t] = st[i.challenge.t] || {}); if (!s.challenged) { const v = +C.ratings[i.challenge.set][i.challenge.t]; s.challenged = true; s.orig = v; C.ratings[i.challenge.set][i.challenge.t] = stepDown(v) || 4; if (on(S, 'growth')) C.growthPool.push(v); R.events.push('statement challenged'); } }
      if (i.challengeEntry) { const e = (C.entries[i.challengeEntry.set] || []).find(x => x.id === i.challengeEntry.id); if (e && !e.challenged) { e.challenged = true; e.origDie = e.die; e.die = stepDown(+e.die) || 4; if (on(S, 'growth')) C.growthPool.push(+e.origDie); R.events.push('statement challenged'); } }
      if (i.push) { C.stress[i.push] = Math.min(13, stepUp(+C.stress[i.push])); R.events.push('pushed stress steps up'); }
    });
    POOL.res.forEach(r => { const e = (C.entries[r.resSet] || []).find(x => x.id === r.resId); if (e) e.spent = (+e.spent || 0) + 1; });
    touch(C);
  }
  POOL.own = POOL.own.filter(i => !i.challenge && !i.challengeEntry && !i.push);
  POOL.res = [];
  POOL.last = R; FRESH_ROLL = true;
  if (R.ppGain && C) { C.pp += R.ppGain; touch(C); }
  logRoll(S, C, R);
  DB.ui.tab = 'dice';
  render();
};
function logRoll(S, C, R) {
  const o = outcome(R, S || {});
  const pp = S ? T(S, 'ppAbbr') : 'PP';
  let t = `rolled ${R.results.map(r => 'd' + r.die + ':' + r.val).join(' ')}${R.resRolls.length ? ' + resource ' + R.resRolls.map(r => r.val).join('/') : ''} → total ${o.total}`;
  if (o.effects.length) t += `, effect ${o.stepped.map(dlabel).join('+')}`;
  if (o.hitches) t += `, ${plural(o.hitches, 'hitch', 'hitches')}`;
  if (o.botch) t += ' (BOTCH)';
  if (R.target != null) t += ` vs ${R.target}: ${o.success ? (o.heroic ? 'heroic success' : 'success') : 'fail'}`;
  if (R.events.length) t += ' · ' + R.events.join(', ');
  DB.log.unshift({ at: R.at, who: C ? (C.name || 'Unnamed') : 'Loose dice', text: t.replace(/PP/g, pp) });
  DB.log = DB.log.slice(0, 80); netRoll(DB.log[0]); save();
}
function resultPanel(S, C) {
  const R = POOL.last; const o = outcome(R, S || {});
  const roleTxt = r => r.val === 1 ? 'hitch' : r.role === 'total' ? 'total' : r.role === 'effect' ? 'effect' : '';
  const dice = R.results.map((r, i) => `<button class="rd ${r.role === 'effect' ? 'eff' : ''}" data-act="cycleRole" data-i="${i}" title="Tap to change: total, effect, unused" ${r.val === 1 ? 'disabled' : ''}>${dieSvg(r.die, r.val === 1 ? 'hitch' : r.role === 'total' ? 'total' : r.role === 'effect' ? 'effect' : 'off', r.val)}<span class="rr">${roleTxt(r)}</span><span class="rl">${esc(r.label || '')}</span></button>`).join('')
    + R.resRolls.map(r => `<span class="rd">${dieSvg(r.die, 'free', r.val)}<span class="rr">resource</span><span class="rl">${esc(r.label)}</span></span>`).join('')
    + (R.hero || []).map(h => `<span class="rd">${dieSvg(h.die, h.val === 1 ? 'hitch' : 'total', h.val)}<span class="rr">${h.val === 1 ? 'hitch' : 'hero'}</span><span class="rl">${esc(T(S, 'hero'))}</span></span>`).join('');
  const pp = S ? T(S, 'ppAbbr') : 'PP';
  const addAll = S && on(S, 'addAll');
  const hitchC = hitchComplication(o.hitches);
  const nTot = R.results.filter(r => r.role === 'total').length, nEff = R.results.filter(r => r.role === 'effect').length;
  const heroBank = S && on(S, 'heroDice') && C ? C.hero : [];
  let spends = '';
  if (C && !addAll) spends += `<button class="btn quiet small" data-act="spendKeep">Keep 1 more in total (1 ${esc(pp)})</button>`;
  if (C && S && !on(S, 'noEffect') && !addAll) spends += `<button class="btn quiet small" data-act="spendEffect">Keep an extra effect die (1 ${esc(pp)})</button>`;
  if (heroBank.length) spends += `<span class="row" style="gap:3px"><span class="small">Roll ${esc(T(S, 'hero').toLowerCase())}:</span>${heroBank.map((d, i) => `<button class="dbtn" data-act="spendHero" data-i="${i}" title="Spend 1 ${esc(pp)}">${dieSvg(d, 'effect')}</button>`).join('')}</span>`;
  if (S && on(S, 'rerollEffect')) spends += `<button class="btn quiet small" data-act="rerollEffect">Reroll for effect</button>`;
  return `<div style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
    <div class="rollres ${FRESH_ROLL ? 'fresh' : ''}">${dice}</div>
    <div class="summary-line"><div class="stat"><b>Total</b><span class="bigtotal">${o.total}</span></div>
      ${o.effects.length ? `<div class="stat"><b>Effect</b><span class="row" style="gap:4px">${o.effects.map((d, i) => dieSvg(d, 'effect')).join('')}${o.heroic && o.stepped[0] !== o.effects[0] ? `<span class="k">→</span>${dieSvg(Math.min(o.stepped[0], 12), 'effect')}${o.stepped[0] > 12 ? '<span class="tag">beyond d12</span>' : ''}` : ''}</span></div>` : ''}
      ${o.hitches ? `<div class="stat"><b>Hitches</b><span class="k" style="font-size:22px">${o.hitches}</span></div>` : ''}
      ${R.ppGain ? `<div class="stat"><b>Earned</b><span class="k" style="font-size:22px">+${R.ppGain} ${esc(pp)}</span></div>` : ''}</div>
    ${o.overKeep ? `<p class="small" style="color:var(--warn)">You've put ${nTot} dice in the total but keep ${R.keep}: spend ${esc(pp)} to keep more, or tap one off.</p>` : ''}
    ${o.overEff ? `<p class="small" style="color:var(--warn)">${nEff} effect dice chosen but only ${R.effects} kept.</p>` : ''}
    ${o.botch ? `<p class="verdict lose">Botch</p><p class="small">The ${esc(T(S, 'gm'))} can create a ${dlabel(Math.min(hitchC, 12))}${hitchC > 12 ? '+ (taken out)' : ''} complication for free.</p>`
      : o.hitches ? `<p class="small">The ${esc(T(S, 'gm'))} may give a ${esc(pp)} to turn the hitches into a ${dlabel(Math.min(hitchC, 12))} complication${S && on(S, 'doom') ? `, or add ${R.results.filter(r => r.val === 1).map(r => dlabel(r.die)).join(' / ')} to the ${esc((S.opt.doomName || 'doom pool').toLowerCase())}` : ''}.
        ${C ? `<button class="linkbtn" data-act="activateHitch">${esc(T(S, 'gm'))} activates</button>` : ''}</p>` : ''}
    ${spends ? `<div class="row" style="gap:6px;margin-top:6px">${spends}</div>` : ''}
    <p class="small muted" style="margin-top:8px">Tap a die to move it between total, effect and unused.</p></div>`;
}
A.cycleRole = el => {
  const R = POOL.last; const r = R.results[+el.dataset.i]; if (!r || r.val === 1) return;
  const S = curS(); const noEff = S && on(S, 'noEffect');
  r.role = r.role === null ? 'total' : r.role === 'total' ? (noEff ? null : 'effect') : null;
  render();
};
function spendPP(n = 1) { const S = curS(), C = poolChar(); if (!C) return false; if (C.pp < n) { toast(`Not enough ${T(S, 'pps').toLowerCase()}.`, 'bad'); return false; } C.pp -= n; touch(C); return true; }
A.spendKeep = () => { if (!spendPP()) return; const R = POOL.last; R.keep++; const left = R.results.filter(r => r.val > 1 && !r.role).sort((a, b) => b.val - a.val); if (left[0]) left[0].role = 'total'; R.events.push('kept an extra die'); render(); };
A.spendEffect = () => { if (!spendPP()) return; const R = POOL.last; R.effects++; const left = R.results.filter(r => r.val > 1 && !r.role).sort((a, b) => b.die - a.die); if (left[0]) left[0].role = 'effect'; render(); };
A.spendHero = el => {
  const S = curS(), C = poolChar(); const i = +el.dataset.i; const d = C.hero[i];
  if (!S.opt.heroAsPP || C.pp > 0) { if (!spendPP()) return; }
  C.hero.splice(i, 1); const v = rollDie(d); POOL.last.hero.push({ die: d, val: v }); touch(C);
  if (v === 1) toast(`The ${T(S, 'hero').toLowerCase()} came up a hitch.`, 'bad');
  render();
};
A.rerollEffect = () => { const R = POOL.last; const re = R.results.map(r => ({ die: r.die, val: rollDie(r.die) })).sort((a, b) => b.val - a.val || b.die - a.die); R.rerollEffect = re[0] ? re[0].die : 4; toast(`Reroll: highest was a ${re[0].val} on a d${re[0].die}`); render(); };
A.activateHitch = () => {
  const S = curS(), C = poolChar(); const R = POOL.last; const o = outcome(R, S);
  const d = hitchComplication(o.hitches);
  const doom = on(S, 'doom');
  openModal('Activate hitches', `<p class="prose small">${esc(C.name || 'The character')} gets a ${esc(T(S, 'pp').toLowerCase())}.</p>
    <label class="fld"><span>New complication on ${esc(C.name || 'them')} (${dlabel(Math.min(12, d))})</span><input id="hcName" placeholder="e.g. Twisted ankle"></label>`,
    { actions: `${doom ? `<button class="btn ghost" id="hcDoom">Add to ${esc(S.opt.doomName || 'doom pool')} instead</button>` : ''}<button class="btn" id="hcGo">Create complication</button>` });
  $('#hcGo').onclick = () => { C.pp++; C.temps.push({ id: uid('tm_'), name: $('#hcName').value.trim() || T(S, 'complication'), die: Math.min(12, d), type: 'comp', scope: 'open' }); touch(C); closeModal(); render(); toast('Complication added'); };
  if (doom) $('#hcDoom').onclick = () => { const G = curG(); C.pp++; R.results.filter(r => r.val === 1).forEach(r => G.doom.push(r.die)); G.doom.sort((a, b) => a - b); touch(C); closeModal(); render(); toast('Added to the ' + (S.opt.doomName || 'doom pool').toLowerCase()); };
};

/* ---------- opposition ---------- */
function oppPanel(S) {
  const staticMode = DB.ui.oppMode === 'static' || (S && on(S, 'staticDiff') && DB.ui.oppMode !== 'dice');
  const G = S && !isLocked(S) ? curG() : null;
  const doomOn = S && on(S, 'doom') && G;
  const base = POOL.oppBase || [];
  let h = `<div class="panel"><div class="bar">Opposition</div><div class="in">
    <div class="row" style="margin-bottom:10px"><span class="seg"><button data-act="oppMode" data-v="dice" aria-pressed="${!staticMode}">Difficulty dice</button><button data-act="oppMode" data-v="static" aria-pressed="${staticMode}">Static number</button></span></div>`;
  if (staticMode) {
    h += `<div class="row" style="gap:6px">${DIFFICULTY.map(d => `<button class="btn ${+POOL.staticDiff === d.stat ? '' : 'quiet'} small" data-act="setStatic" data-v="${d.stat}">${esc(d.name)} ${d.stat}</button>`).join('')}</div>
      <div class="row" style="margin-top:8px"><label class="fld"><span>Target number</span><input type="number" value="${POOL.staticDiff == null ? '' : esc(POOL.staticDiff)}" data-bind="P.staticDiff" data-type="num" data-re style="width:100px"></label><button class="linkbtn" data-act="setStatic" data-v="">clear</button></div>
      <p class="small muted">Complication dice below are rolled and added to the number.</p>`;
  } else {
    h += `<div class="row" style="gap:6px">${DIFFICULTY.map(d => `<button class="btn ${base.join() === d.dice.join() ? '' : 'quiet'} small" data-act="setDiffDice" data-v="${d.dice.join(',')}" title="${esc(d.name)}">${esc(d.name)}</button>`).join('')}${doomOn ? `<button class="btn ${POOL.useDoom ? '' : 'quiet'} small" data-act="useDoom">${esc(S.opt.doomName || 'Doom pool')} (${G.doom.length})</button>` : ''}</div>
      <div class="row" style="margin-top:8px;gap:4px"><span class="lbl">Difficulty</span>${(POOL.useDoom && doomOn ? G.doom : base).map(d => dieSvg(d, POOL.useDoom ? 'doom' : 'ink')).join('') || '<span class="small muted">none</span>'}</div>`;
  }
  h += `<div class="lbl" style="margin-top:12px">Extra opposition dice</div>
    <div class="row" style="gap:6px;margin-top:4px">${POOL.opp.map((it, i) => `<span class="chip opp">${dieSvg(it.die, 'doom')}<span>${esc(it.label || 'd' + it.die)}</span><button class="x" data-act="poolDel" data-side="opp" data-i="${i}" aria-label="Remove">✕</button></span>`).join('') || '<span class="small muted">GMC traits, complications, stress.</span>'}</div>
    <div class="row" style="margin-top:8px;gap:4px"><span class="lbl">Add</span>${DICE.map(d => `<button class="dbtn" data-act="oppAddDie" data-die="${d}" aria-label="Add d${d}">${dieSvg(d, 'off')}</button>`).join('')}
      ${S && on(S, 'scale') ? `<label class="check" style="align-items:center"><input type="checkbox" class="bubble" ${POOL.oppScale ? 'checked' : ''} data-act="toggleOppScale"><span class="small">Scale die</span></label>` : ''}</div>
    <div class="row" style="margin-top:12px"><button class="btn big ghost" data-act="rollOpp">Roll opposition</button><button class="btn quiet" data-act="clearOpp">Clear</button></div>`;
  if (POOL.opRoll) {
    const O = POOL.opRoll;
    h += `<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:12px"><div class="rollres">${O.results.map((r, i) => `<button class="rd" data-act="cycleOpp" data-i="${i}" ${r.val === 1 ? 'disabled' : ''}>${dieSvg(r.die, r.val === 1 ? 'hitch' : r.role === 'total' ? 'total' : r.role === 'effect' ? 'effect' : 'off', r.val)}<span class="rr">${r.val === 1 ? 'opportunity' : r.role || ''}</span><span class="rl">${esc(r.label || '')}</span></button>`).join('')}</div>
      <div class="summary-line"><div class="stat"><b>${O.static != null ? 'Target' : 'Difficulty'}</b><span class="bigtotal" style="color:var(--ink)">${oppTotalNow(O)}</span></div>${O.static == null ? `<div class="stat"><b>Effect</b>${dieSvg(oppEffectNow(O), 'effect')}</div>` : ''}
      ${O.hitches ? `<div class="stat"><b>Opportunities</b><span class="k" style="font-size:22px">${O.hitches}</span></div>` : ''}</div>
      ${O.hitches ? `<p class="small">Players can spend a ${esc(S ? T(S, 'pp').toLowerCase() : 'plot point')} on an opportunity to step down a complication or step up an asset.</p>` : ''}
      ${G && O.static == null && !on(S, 'doom') ? `<button class="btn quiet small" data-act="gmKeep">${esc(T(S, 'gm'))} keeps 1 more (bank: ${G.bank})</button>` : ''}</div>`;
  }
  return h + '</div></div>';
}
function oppTotalNow(O) { if (O.static != null) return O.static + sum(O.results.filter(r => r.val > 1).map(r => r.val)); return sum(O.results.filter(r => r.role === 'total').map(r => r.val)); }
function oppEffectNow(O) { const e = O.results.filter(r => r.role === 'effect').sort((a, b) => b.die - a.die)[0]; return e ? e.die : 4; }
A.oppMode = el => { DB.ui.oppMode = el.dataset.v; render(); };
A.setStatic = el => { POOL.staticDiff = el.dataset.v === '' ? null : +el.dataset.v; POOL.opRoll = null; render(); };
A.setDiffDice = el => { const v = el.dataset.v.split(',').map(Number); POOL.oppBase = (POOL.oppBase || []).join() === v.join() ? [] : v; POOL.useDoom = false; render(); };
A.useDoom = () => { POOL.useDoom = !POOL.useDoom; render(); };
A.oppAddDie = el => { POOL.opp.push({ id: uid('po_'), die: +el.dataset.die, label: 'd' + el.dataset.die }); render(); };
A.toggleOppScale = () => { POOL.oppScale = POOL.oppScale ? 0 : 1; render(); };
A.clearOpp = () => { POOL.opp = []; POOL.oppBase = []; POOL.opRoll = null; POOL.useDoom = false; POOL.staticDiff = null; render(); };
A.rollOpp = () => {
  const S = curS(); const G = S && !isLocked(S) ? curG() : null;
  const staticMode = DB.ui.oppMode === 'static' || (S && on(S, 'staticDiff') && DB.ui.oppMode !== 'dice');
  let items = [];
  if (!staticMode) {
    const base = POOL.useDoom && G ? G.doom : (POOL.oppBase || []);
    items = base.map(d => ({ die: d, label: POOL.useDoom ? (S.opt.doomName || 'Doom') : 'difficulty' }));
  }
  items = items.concat(POOL.opp.map(x => ({ die: x.die, label: x.label })));
  let keep = 2;
  if (POOL.oppScale) { items.push({ die: 8, label: 'Scale' }); keep++; }
  if (staticMode && (POOL.staticDiff == null || POOL.staticDiff === '')) return toast('Pick a target number first.', 'bad');
  if (!items.length && !staticMode) return toast('Add difficulty dice first.', 'bad');
  const results = rollItems(items);
  const t = oppTotal(results, keep, S && on(S, 'addAll'));
  POOL.opRoll = { results, keep, total: staticMode ? +POOL.staticDiff + sum(results.filter(r => r.val > 1).map(r => r.val)) : t.total, effect: t.effect, hitches: t.hitches, highest: t.highest, at: Date.now(), static: staticMode ? +POOL.staticDiff : null };
  if (staticMode) results.forEach(r => { if (r.val > 1) r.role = 'total'; });
  POOL.opRoll.total = oppTotalNow(POOL.opRoll);
  DB.log.unshift({ at: Date.now(), who: 'Opposition', text: `rolled ${results.map(r => 'd' + r.die + ':' + r.val).join(' ')} → ${POOL.opRoll.total}` }); DB.log = DB.log.slice(0, 80); netRoll(DB.log[0]);
  render();
};
A.cycleOpp = el => { const O = POOL.opRoll; if (O.static != null) return; const r = O.results[+el.dataset.i]; r.role = r.role === null ? 'total' : r.role === 'total' ? 'effect' : null; O.total = oppTotalNow(O); render(); };
A.gmKeep = () => { const G = curG(); if (G.bank < 1) return toast('The bank is empty.', 'bad'); G.bank--; const O = POOL.opRoll; const left = O.results.filter(r => r.val > 1 && !r.role).sort((a, b) => b.val - a.val); if (left[0]) left[0].role = 'total'; O.total = oppTotalNow(O); save(); render(); };

/* ---------- outcome ---------- */
function outcomePanel(S) {
  const R = POOL.last;
  const O = POOL.opRoll || (POOL.staticDiff != null && POOL.staticDiff !== '' ? { static: +POOL.staticDiff, results: [], at: 0 } : null);
  if (!R || !O) return '';
  const o = outcome(Object.assign({}, R, { target: null }), S || {});
  const mine = o.total, theirs = oppTotalNow(O);
  const iFirst = R.at < O.at;
  const iWin = iFirst ? !(theirs > mine) : mine > theirs;
  const margin = iWin ? mine - theirs : theirs - mine;
  const heroic = margin >= 5 ? Math.floor(margin / 5) : 0;
  const myEff = o.effects[0] || 4, theirEff = oppEffectNow(O);
  const winEff = iWin ? dieAt(idx(myEff) + heroic) : dieAt(idx(theirEff) + heroic);
  const loseEff = iWin ? theirEff : myEff;
  const noEff = S && on(S, 'noEffect');
  const pp = S ? T(S, 'pp').toLowerCase() : 'plot point';
  let detail = '';
  if (!noEff) {
    detail = `<p class="small" style="margin:6px 0 0"><b class="k">High stakes:</b> ${winEff > loseEff ? `the loser is taken out (or spends a ${esc(pp)} to take a ${dlabel(Math.min(winEff, 12))} complication instead).` : `the loser's effect die was as big, so no take-out: they take a ${dlabel(Math.min(winEff, 12))} complication.`}</p>
      <p class="small" style="margin:2px 0 0"><b class="k">Otherwise:</b> the loser takes a ${dlabel(Math.min(winEff > loseEff ? winEff : stepDown(winEff) || 4, 12))} complication${winEff > loseEff ? '' : ' (stepped down, since their effect die was as big)'}.</p>`;
  } else detail = `<p class="small" style="margin:6px 0 0">No effect dice: the loser takes a ${dlabel(dieAt(idx(6) + heroic))} complication, or is taken out in a high-stakes scene.</p>`;
  const showBank = S && on(S, 'heroDice') && iWin && heroic && poolChar() && O.highest;
  return `<div class="panel" style="margin-top:18px"><div class="bar">Result</div><div class="in">
    <div class="row" style="gap:18px"><span class="verdict ${iWin ? 'win' : 'lose'}">${iWin ? (heroic ? 'Heroic success' : 'You win') : (heroic ? 'Opposition wins big' : 'Opposition wins')}</span>
    <span class="k">${mine} vs ${theirs}</span><span class="small muted">${iFirst ? 'You rolled first, so the opposition had to beat you.' : 'The opposition rolled first, so you had to beat it.'}${heroic ? ` Won by ${margin}: effect die steps up ${plural(heroic, 'time')}.` : ''}</span></div>
    ${detail}
    ${showBank ? `<div class="row" style="margin-top:8px"><button class="btn small" data-act="bankHeroFromRoll" data-die="${O.highest.die}">Bank a d${O.highest.die} ${esc(T(S, 'hero').toLowerCase())}</button></div>` : ''}</div></div>`;
}
A.bankHeroFromRoll = el => { const S = curS(), C = poolChar(); const d = +el.dataset.die; if (S.opt.heroOnePer && C.hero.includes(d)) return toast('Already banked a d' + d + '.', 'bad'); C.hero.push(d); C.hero.sort((a, b) => a - b); touch(C); toast('Banked a d' + d); render(); };
