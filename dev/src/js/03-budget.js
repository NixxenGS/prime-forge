/* ============ Budget engine: track & warn (never blocks) ============ */
function pathwaysActive(S, c) { return c.method === 'pathways' && S.creation.methods.pathways && (S.creation.stages || []).length > 0; }
function pathwaysTotals(S) {
  const t = { dist: 0, points: 0, trade: 0, pool: 0, sfx: 0 };
  (S.creation.stages || []).forEach(st => { const g = st.g || {}; for (const k in t) t[k] += +g[k] || 0; });
  return t;
}
function highlightCounts(S, c) {
  const m = {}; const ds = distSet(S);
  if (!S.dist.highlightSet || !ds) return m;
  (c.entries[ds.id] || []).forEach(d => (d.hl || []).forEach(tid => { if (tid) m[tid] = (m[tid] || 0) + 1; }));
  return m;
}
function rowState(have, need, how = 'exact') {
  if (how === 'atmost') return have <= need ? 'ok' : 'over';
  if (how === 'atleast') return have >= need ? 'ok' : 'under';
  return have === need ? 'ok' : (have < need ? 'under' : 'over');
}
function mkRow(label, have, need, how = 'exact', hint = '') { return { label, have, need, state: rowState(have, need, how), hint, how }; }

function budget(S, c) {
  const groups = [];
  const P = pathwaysActive(S, c) ? pathwaysTotals(S) : null;
  const hl = highlightCounts(S, c);
  const poolTotal = P ? P.pool : (+S.creation.pool || 0);
  const sfxAllowed = P ? P.sfx : (+S.creation.sfxUnlocks || 0);
  let poolUsed = 0; const poolParts = [];
  let sfxUsed = 0;
  const payPool = (label, n) => { if (n > 0) { poolUsed += n; poolParts.push([label, n]); } };

  S.sets.forEach(set => {
    const cr = set.create || {};
    const g = { title: set.name, setId: set.id, rows: [], warns: [] };
    if (set.kind === 'distinctions') {
      const list = c.entries[set.id] || [];
      const named = list.filter(d => (d.name || '').trim());
      g.rows.push(mkRow('Chosen', named.length, P ? P.dist : (+cr.count || 0)));
      list.forEach(d => (d.sfx || []).forEach(x => { if (x.unlocked) sfxUsed++; }));
      if (S.dist.rated === 'variable' && named.length) {
        const avg = sum(named.map(d => idx(d.die))) / named.length;
        if (Math.abs(avg - 3) > 0.01) g.warns.push('Distinction dice should average d8 (now ' + (avg > 3 ? 'above' : 'below') + ').');
      }
      if (S.dist.highlightSet) named.forEach(d => {
        const n = (d.hl || []).filter(Boolean).length;
        if (n < +S.dist.highlightCount) g.warns.push(`${d.name}: choose ${S.dist.highlightCount} highlight traits (${n} so far).`);
      });
    } else if (set.kind === 'fixed') {
      const traits = set.traits;
      if (!traits.length) g.warns.push('This set has no traits yet. Add them in the Designer.');
      const R = t => +((c.ratings[set.id] || {})[t.id] || 0);
      const B = (t, i) => { const ov = (c.base[set.id] || {})[t.id]; return ov != null ? +ov : defaultRating(S, set, i, c.method); };
      if (cr.mode === 'trade') {
        let target = 0, cur = 0;
        traits.forEach((t, i) => { target += idx(B(t, i)) + (hl[t.id] || 0); cur += idx(R(t)); });
        if (P && isFirstOfMode(S, set, 'trade')) target += P.trade;
        g.rows.push(mkRow('Die steps', cur, target, 'exact', 'Step one trait up by stepping another down'));
        traits.forEach(t => { const v = R(t), lo = +cr.min || 4, hi = (+cr.max || 12); if (v && (v < lo || v > hi)) g.warns.push(`${t.name || 'A trait'} is ${dlabel(v)}; starting range is d${lo}–d${hi}.`); if (!v) g.warns.push(`${t.name || 'A trait'} has no rating.`); });
      } else if (cr.mode === 'points') {
        let spent = 0; const cap = +cr.cap || 12;
        traits.forEach((t, i) => {
          const b = idx(B(t, i)), v = idx(R(t)), free = Math.min(hl[t.id] || 0, Math.max(0, idx(cap) - b));
          spent += Math.max(0, v - b - free);
          if (v < b + free && free) g.warns.push(`${t.name}: highlight step not applied yet (should be at least ${dlabel(dieAt(b + free))}).`);
          if (R(t) > cap) g.warns.push(`${t.name} is above the starting cap of d${cap}.`);
          if (set.split && R(t) > 6) g.warns.push(`${t.name}: with the skill/specialty split, ratings above d6 must be specialties.`);
        });
        const allowed = (P && isFirstOfMode(S, set, 'points')) ? P.points : (+cr.points || 0);
        g.rows.push(mkRow('Points spent', spent, allowed));
        if (set.pyramid) { const pw = pyramidWarn(traits.map(R)); if (pw) g.warns.push(pw); }
      } else if (cr.mode === 'array') {
        const want = ((cr.auto ? ROLE_ARRAYS[traits.length] : null) || cr.array || []).slice().sort((a, b) => b - a);
        const have = traits.map(t => dieAt(idx(R(t)) - (hl[t.id] || 0))).filter(Boolean).sort((a, b) => b - a);
        const ok = have.length === want.length && have.every((d, i) => d === want[i]);
        g.rows.push({ label: 'Spread ' + (want.length ? want.map(dlabel).join(' ') : '(set in Designer)'), have: have.length ? have.map(dlabel).join(' ') : 'nothing assigned', need: '', state: ok ? 'ok' : (have.length < want.length ? 'under' : 'over'), text: true });
      } else if (cr.mode === 'peaks') {
        const r = peaksCheck(traits.map(R), cr); g.rows.push(r);
      }
      if (set.statements) { const n = traits.filter(t => ((c.stmt[set.id] || {})[t.id] || {}).text).length; if (n < traits.length) g.rows.push(mkRow('Statements written', n, traits.length, 'exact', 'Usually written last')); }
      if (set.sfx) traits.forEach(t => (t.sfx || []).forEach(x => { if (c.unlocks[x.id]) sfxUsed++; }));
    } else if (set.kind === 'open') {
      const list = (c.entries[set.id] || []).filter(e => (e.name || '').trim());
      const cap = +cr.cap || 12;
      if (cr.mode === 'peaks') g.rows.push(peaksCheck(list.map(e => +e.die), cr));
      else if (cr.mode === 'count') g.rows.push(mkRow('Entries', list.length, +cr.count || 0));
      else if (cr.mode === 'pool') {
        let cost = 0;
        list.forEach(e => { if (e.granted) return; cost += (cr.entryCost == null ? 1 : +cr.entryCost) + Math.max(0, idx(e.die) - idx(cr.startDie || 6)); });
        payPool(set.name, cost);
        g.rows.push({ label: 'Paid from ' + S.creation.poolName.toLowerCase(), have: cost, need: '', state: 'info', text: true });
      }
      list.forEach(e => { if (+e.die > cap) g.warns.push(`${e.name} is above the starting cap of d${cap}.`); (e.sfx || []).forEach(x => { if (x.unlocked) sfxUsed++; }); });
      if (set.statements) { const n = list.filter(e => (e.statement || '').trim()).length; if (list.length && n < list.length) g.rows.push(mkRow('Statements written', n, list.length)); }
    } else if (set.kind === 'resources') {
      const list = (c.entries[set.id] || []).filter(e => (e.name || '').trim());
      let cost = 0;
      list.forEach(e => {
        const k = 1 + Math.max(0, (+e.count || 2) - 2) + Math.max(0, idx(e.die) - idx(6));
        cost += k;
        if (k > 2) g.warns.push(`${e.name}: more than 2 points in one resource isn't recommended.`);
        if ((e.tags || []).filter(x => x.trim()).length < 2) g.warns.push(`${e.name}: give it two tags.`);
      });
      payPool(set.name, cost);
      g.rows.push({ label: 'Paid from ' + S.creation.poolName.toLowerCase(), have: cost, need: '', state: 'info', text: true });
    } else if (set.kind === 'powersets') {
      const list = c.entries[set.id] || [];
      g.rows.push(mkRow('Power sets', list.length, +cr.sets || 0));
      let value = 0; const cap = +cr.cap || 12;
      list.forEach(ps => {
        if ((ps.sfx || []).length < (+cr.sfxPerSet || 0)) g.warns.push(`${ps.name || 'Power set'}: needs ${cr.sfxPerSet} SFX.`);
        if ((ps.limits || []).length < (+cr.limitsPerSet || 0)) g.warns.push(`${ps.name || 'Power set'}: needs ${cr.limitsPerSet} limit${cr.limitsPerSet > 1 ? 's' : ''}.`);
        (ps.powers || []).forEach(p => { value += Math.max(0, idx(p.die) - 1); if (+p.die > cap) g.warns.push(`${p.name || 'A power'} is above the starting cap of d${cap}.`); if (+p.die && +p.die < 6) g.warns.push(`${p.name || 'A power'}: powers can't go below d6.`); });
      });
      const baseline = list.length ? (list.length + 1) * 2 : 0;
      g.rows.push(mkRow('Power steps (d8 = 2)', value, baseline, 'atmost', 'Free: d8 powers equal to sets + 1. Extra steps use creation points.'));
      payPool('Extra power steps', Math.max(0, value - baseline));
    } else if (set.kind === 'abilities') {
      const list = (c.entries[set.id] || []).filter(e => (e.name || '').trim());
      g.rows.push(mkRow('Abilities', list.length, +cr.count || 0));
      list.forEach(a => { const un = (a.sfx || []).filter(x => x.unlocked).length; if (un < (+cr.freeSfx || 0)) g.warns.push(`${a.name}: choose ${cr.freeSfx} free SFX.`); sfxUsed += Math.max(0, un - (+cr.freeSfx || 0)); if (+a.die > (+cr.cap || 12)) g.warns.push(`${a.name} is above the starting cap.`); });
    } else if (set.kind === 'talents') {
      const list = (c.entries[set.id] || []).filter(e => (e.name || '').trim());
      g.rows.push(mkRow('Talents', list.length, +cr.count || 0));
    }
    groups.push(g);
  });

  // attached specialties
  const specSets = S.sets.filter(x => x.kind === 'fixed' && x.specialties);
  if (specSets.length) {
    const freeLeft = {};
    specSets.forEach(set => { if (set.freeSpec && +((c.ratings[set.id] || {})[set.freeSpec] || 0) >= 6) freeLeft[set.id + ':' + set.freeSpec] = 1; });
    let cost = 0;
    const specGroup = { title: 'Specialties', rows: [], warns: [] };
    (c.specs || []).forEach(sp => {
      if (!(sp.name || '').trim()) return;
      const k = sp.setId + ':' + sp.traitId;
      let base = 1;
      if (S.spec.multiLevel) base += Math.max(0, idx(sp.die) - idx(6)) + Math.max(0, (+sp.count || 1) - 1);
      const set = byId(S.sets, sp.setId); const tr = set && byId(set.traits, sp.traitId);
      if (set && tr && !set.split && +((c.ratings[set.id] || {})[tr.id] || 0) < 6) specGroup.warns.push(`${sp.name}: its ${tr.name} must be d6 or higher.`);
      if (sp.granted) return;
      if (freeLeft[k]) { freeLeft[k] = 0; base -= 1; }
      cost += base;
    });
    payPool('Specialties', cost);
    specGroup.rows.push({ label: 'Paid from ' + S.creation.poolName.toLowerCase(), have: cost, need: '', state: 'info', text: true });
    Object.keys(freeLeft).forEach(k => { if (freeLeft[k]) { const [sid, tid] = k.split(':'); const set = byId(S.sets, sid); const tr = set && byId(set.traits, tid); specGroup.warns.push(`You have a free specialty for ${tr ? tr.name : 'a trait'}.`); } });
    groups.push(specGroup);
  }

  const head = { title: 'Totals', rows: [], warns: [] };
  if (poolTotal || poolUsed) head.rows.push(Object.assign(mkRow(S.creation.poolName, poolUsed, poolTotal), { parts: poolParts }));
  if (sfxAllowed || sfxUsed) head.rows.push(mkRow(T(S, 'sfx') + ' unlocked', sfxUsed, sfxAllowed, 'exact', 'Beyond the free Hinder'));
  if (!(c.name || '').trim()) head.warns.push('Give your character a name.');
  groups.unshift(head);

  let issues = 0;
  groups.forEach(g => { g.rows.forEach(r => { if (r.state === 'under' || r.state === 'over') issues++; }); issues += g.warns.length; });
  return { groups, issues };
}
function peaksCheck(dice, cr) {
  const have = dice.filter(Boolean).sort((a, b) => b - a);
  const peaks = (cr.peaks || []).slice().sort((a, b) => b - a);
  let ok = have.length >= peaks.length;
  have.forEach((d, i) => { const want = i < peaks.length ? peaks[i] : cr.fill; if (d !== +want) ok = false; });
  return { label: 'Spread ' + peaks.map(dlabel).join(' ') + ', rest ' + dlabel(cr.fill), have: have.length ? have.map(dlabel).join(' ') : 'none yet', need: '', state: ok ? 'ok' : (have.length < peaks.length ? 'under' : 'over'), text: true };
}
function pyramidWarn(ratings) {
  const cnt = d => ratings.filter(r => r >= d).length;
  const n10 = ratings.filter(r => r === 10).length, n12 = ratings.filter(r => r === 12).length;
  if (n12 && (cnt(10) - n12 < 2 || cnt(8) - cnt(10) < 3 || cnt(6) - cnt(8) < 4)) return 'Skill pyramid: a d12 needs two d10s, three d8s and four d6s beneath it.';
  if (n10 && (cnt(8) - cnt(10) < 2 || cnt(6) - cnt(8) < 3)) return 'Skill pyramid: a d10 needs two d8s and three d6s beneath it.';
  return '';
}
