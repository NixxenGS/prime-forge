/* ============ Rules / setting guide ============ */
VIEWS.rules = () => {
  const S = curS(); if (!S) return VIEWS.vault();
  const pp = T(S, 'pp').toLowerCase();
  const setsHtml = S.sets.map(set => {
    const F = FLAVORS[set.flavor] || {}; const g = GUIDES[F.guide];
    let inner = `<p class="prose small" style="margin:2px 0 6px">${esc(set.desc || F.blurb || '')}</p><p class="small"><b class="k">At creation:</b> ${esc(ruleText(S, set))}</p>`;
    if (set.kind === 'fixed' && set.traits.length) inner += `<table class="tbl" style="margin-top:6px"><tr><th>Trait</th><th>Covers</th></tr>${set.traits.map(t => `<tr><td class="k">${esc(t.name)}</td><td>${esc(t.desc)}${(t.sfx || []).length ? `<div class="small muted">${t.sfx.map(x => `<b>${esc(x.name)}:</b> ${esc(x.text)}`).join('<br>')}</div>` : ''}</td></tr>`).join('')}</table>`;
    if (g) inner += `<p class="small muted" style="margin-top:6px">${DICE.filter(d => g[d]).map(d => `${dlabel(d)} ${esc(g[d])}`).join(' · ')}</p>`;
    const mods = [];
    if (set.statements) mods.push(TRAIT_MODS.statements); if (set.sfx && set.kind !== 'distinctions') mods.push(TRAIT_MODS.sfx); if (set.specialties) mods.push(TRAIT_MODS.specialties); if (set.split) mods.push(TRAIT_MODS.split); if (set.pyramid) mods.push(TRAIT_MODS.pyramid);
    if (set.kind === 'distinctions') { if (S.dist.highlightSet) mods.push(TRAIT_MODS.highlight); }
    if (set.kind === 'powersets') mods.push(TRAIT_MODS.limits);
    if (mods.length) inner += mods.map(m => `<p class="small" style="margin:4px 0 0"><b class="k">${esc(m.name)}</b> ${refTag(m.ref)} ${esc(m.sum)}</p>`).join('');
    return `<div class="rule"><h4><span>${esc(set.name)} ${set.prime ? '<span class="tag ink">Prime</span>' : ''}</span>${refTag(F.ref)}</h4>${inner}</div>`;
  }).join('');
  const libs = [];
  if (S.dist.library.length) libs.push(`<h3>${esc(T(S, 'distinctions'))}</h3><div class="rulegrid">${S.dist.library.map(d => `<div class="rule"><h4>${esc(d.name)}</h4><p class="desc">${esc(d.desc)}</p>${hlNames(S, d)}${(d.sfx || []).map(x => `<p class="small"><b class="k">${esc(x.name)}:</b> ${esc(x.text)}</p>`).join('')}</div>`).join('')}</div>`);
  if (S.lib.powersets.length && S.sets.some(x => x.kind === 'powersets')) libs.push(`<h3>Power sets</h3><div class="rulegrid">${S.lib.powersets.map(ps => `<div class="rule"><h4>${esc(ps.name)}</h4><p class="desc">${esc(ps.desc)}</p><p class="small">${(ps.powers || []).map(p => `${esc(p.name)} ${dlabel(p.die)}`).join(' · ')}</p>${(ps.sfx || []).map(x => `<p class="small"><b class="k">${esc(x.name)}:</b> ${esc(x.text)}</p>`).join('')}${(ps.limits || []).map(x => `<p class="small"><b class="k">${esc(T(S, 'limit'))}: ${esc(x.name)}.</b> ${esc(x.text)}</p>`).join('')}</div>`).join('')}</div>`);
  if (S.lib.abilities.length && S.sets.some(x => x.kind === 'abilities')) libs.push(`<h3>Abilities</h3><div class="rulegrid">${S.lib.abilities.map(a => `<div class="rule"><h4>${esc(a.name)} ${dlabel(a.die)}</h4><p class="small muted">${esc(a.effect)}${a.descriptor ? ' · ' + esc(a.descriptor) : ''}</p><p class="desc">${esc(a.desc)}</p>${(a.sfx || []).map(x => `<p class="small"><b class="k">${esc(x.name)}:</b> ${esc(x.text)}</p>`).join('')}</div>`).join('')}</div>`);
  if (S.lib.talents.length && S.sets.some(x => x.kind === 'talents')) libs.push(`<h3>Talents</h3><div class="rulegrid">${S.lib.talents.map(t => `<div class="rule"><h4>${esc(t.name)}${t.group ? ` <span class="tag ink">${esc(t.group)}</span>` : ''}</h4><p class="desc">${esc(t.desc)}</p><p class="small"><b class="k">Activation:</b> ${esc(t.activation)}<br><b class="k">Effect:</b> ${esc(t.effect)}</p></div>`).join('')}</div>`);
  if (S.creation.methods.archetypes && S.lib.archetypes.length) libs.push(`<h3>Archetypes</h3><div class="rulegrid">${S.lib.archetypes.map(a => `<div class="rule"><h4>${esc(a.name)}</h4><p class="desc">${esc(a.pitch)}</p><p class="small">${esc((a.dists || []).map(d => d.name).filter(Boolean).join(' · '))}</p></div>`).join('')}</div>`);
  if (S.lib.sfx.length) libs.push(`<h3>${esc(T(S, 'sfx'))}</h3><div class="rulegrid">${S.lib.sfx.map(x => `<div class="rule"><h4>${esc(x.name)}</h4><p>${esc(x.text)}</p></div>`).join('')}</div>`);

  const modsOn = MOD_CATS.map(cat => {
    const ms = MODS.filter(m => m.cat === cat.id && S.mods[m.id]);
    if (!ms.length) return '';
    return `<div><h3>${esc(cat.name)}</h3>${ms.map(m => `<div class="modrow" style="grid-template-columns:minmax(0,1fr) auto"><div><div class="nm">${esc(m.name)}</div><div class="sm">${esc(m.sum.replace(/plot point/g, pp))}</div>${modOptText(S, m)}</div>${refTag(m.ref)}</div>`).join('')}</div>`;
  }).join('');
  const steps = creationSteps(S);
  const extra = [];
  if (on(S, 'stress')) extra.push(`<p class="small"><b class="k">${esc(T(S, 'stress'))}:</b> ${S.opt.shaken ? `lands on ${esc((byId(S.sets, S.stress.shakenSet) || {}).name || 'a trait set')}` : esc(S.stress.tracks.map(t => t.name).filter(Boolean).join(', ') || 'no tracks yet')}</p>`);
  if (on(S, 'lifePoints')) { const r = traitRefs(S); const nm = k => ((r.find(x => x.key === k) || {}).label || '?'); extra.push(`<p class="small"><b class="k">Life points:</b> ${esc(nm(S.life.a))}${S.life.best.length ? ' + highest of ' + esc(S.life.best.map(nm).join(', ')) : ''}${+S.life.flat ? ' + ' + S.life.flat : ''} (${esc(S.opt.lifeMode)})</p>`); }
  if (on(S, 'sessionRecords')) extra.push(`<h4 style="margin-top:12px">Training (sessions)</h4><table class="tbl">${S.growth.training.map(t => `<tr><td>${esc(t.label)}</td><td>${t.cost}</td></tr>`).join('')}</table>`);
  if (on(S, 'milestones')) extra.push(`<h4 style="margin-top:12px">Unlockables (${esc(T(S, 'xp'))})</h4><table class="tbl">${S.growth.unlocks.map(t => `<tr><td>${esc(t.label)}</td><td>${t.cost}</td></tr>`).join('')}</table>`);
  return `<div class="pagehead"><div class="row">${emblem(S, 60)}<div><h1>${esc(S.name || 'Untitled')}</h1>${S.tagline ? `<p class="lede" style="margin-top:2px">${esc(S.tagline)}</p>` : ''}</div></div>
    <div class="acts"><button class="btn quiet" data-act="print">Print</button>${isLocked(S) ? '' : '<button class="btn ghost" data-act="go" data-tab="designer">Edit in Designer</button>'}</div></div>
    ${lockBanner(S)}
    ${S.pitch ? `<p class="prose" style="font-size:18px">${esc(S.pitch)}</p>` : ''}${S.notes ? `<div class="panel" style="margin:14px 0"><div class="bar">From your ${esc(T(S, 'gm'))}</div><div class="in"><p class="prose" style="white-space:pre-wrap;margin:0">${esc(S.notes)}</p></div></div>` : ''}
    <section class="sec"><div class="sec-head"><h2>The ${esc(T(S, 'file').toLowerCase())}</h2></div><div class="rulegrid">${setsHtml}</div>${extra.join('')}</section>
    ${libs.length ? `<section class="sec"><h2>Libraries</h2>${libs.join('')}</section>` : ''}
    <section class="sec"><div class="sec-head"><h2>Making a character</h2>${refTag('p.67')}</div><ol class="howto">${steps.map(s => `<li><div>${s}</div></li>`).join('')}</ol></section>
    <section class="sec"><div class="sec-head"><h2>Mods in play</h2>${refTag('p.248')}</div>${modsOn || '<p class="muted">Only the core rules.</p>'}</section>
    <section class="sec"><div class="sec-head"><h2>Core rules</h2></div><div class="rulegrid">${CORE_RULES.map(r => `<div class="rule"><h4><span>${esc(r.h)}</span>${refTag(r.ref)}</h4><p>${esc(r.t.replace(/plot point/g, pp))}</p></div>`).join('')}</div>
    <h3 style="margin-top:18px">Difficulty</h3><table class="tbl" style="max-width:560px"><tr><th>Difficulty</th><th>Dice</th><th>Static</th></tr>${DIFFICULTY.map(d => `<tr><td class="k">${esc(d.name)}</td><td><span class="row" style="gap:3px">${diceRow(d.dice)}</span></td><td>${d.stat}</td></tr>`).join('')}</table></section>
    <p class="small muted">Page numbers refer to the Cortex Prime Game Handbook (2nd printing). Summaries are short paraphrases; the handbook has the full rules.</p>`;
};
function hlNames(S, d) { const hs = byId(S.sets, S.dist.highlightSet); if (!hs) return ''; const n = (d.hl || []).map(id => (byId(hs.traits, id) || {}).name).filter(Boolean); return n.length ? `<p class="small muted">Highlights: ${esc(n.join(', '))}</p>` : ''; }
function modOptText(S, m) {
  if (!m.opts) return '';
  const bits = m.opts.map(o => {
    const v = S.opt[o.k];
    if (o.type === 'select') { const c = (o.choices || []).find(x => x[0] === v); return c ? c[1] : ''; }
    if (o.type === 'num' || o.type === 'text') return v != null && v !== '' ? `${o.label}: ${v}` : '';
    return v ? o.label : '';
  }).filter(Boolean);
  return bits.length ? `<ul class="small" style="margin:4px 0 0;padding-left:18px">${bits.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
}
function creationSteps(S) {
  const steps = [];
  const m = S.creation.methods;
  const ms = Object.entries(METHODS).filter(([k]) => m[k]).map(([k, M]) => M.name);
  steps.push(`<b class="k">Pick a method:</b> ${esc(ms.join(', ') || 'scratch-built')}.`);
  steps.push(`<b class="k">Name and concept.</b> Who they are, where they came from.`);
  S.sets.forEach(set => steps.push(`<b class="k">${esc(set.name)}:</b> ${esc(ruleText(S, set))}`));
  const payers = S.sets.filter(x => (x.kind === 'open' && x.create.mode === 'pool') || x.kind === 'resources' || x.kind === 'powersets').map(x => x.name);
  if (S.sets.some(x => x.specialties)) payers.push('specialties');
  if (payers.length && +S.creation.pool) steps.push(`<b class="k">Spend ${S.creation.pool} ${esc(S.creation.poolName.toLowerCase())}</b> on ${esc(payers.join(', '))}.`);
  if (on(S, 'milestones')) steps.push(`<b class="k">Choose two milestones</b>, one shared with the group and one personal.`);
  steps.push(`<b class="k">Start play</b> with ${startPP(S)} ${esc(T(S, startPP(S) === 1 ? 'pp' : 'pps').toLowerCase())}.`);
  return steps;
}
