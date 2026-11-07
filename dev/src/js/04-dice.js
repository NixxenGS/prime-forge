/* ============ Dice engine (pure logic) ============ */
function rollItems(items) { return items.map(it => Object.assign({}, it, { val: rollDie(+it.die), role: null })); }

/* Assign total / effect roles.
   opts: keep (dice in total), effects (effect dice), addAll, noEffect, target (number to beat or null), prefer ('total'|'effect') */
function autoAssign(results, opts) {
  results.forEach(r => { r.role = null; });
  const elig = results.filter(r => r.val > 1);
  if (opts.addAll) { elig.forEach(r => { r.role = 'total'; }); return; }
  const keep = opts.keep || 2, effN = opts.noEffect ? 0 : (opts.effects || 1);
  // order for total picking: high value first; on ties keep the smaller die (save big dice for effect)
  const totalOrder = arr => arr.slice().sort((a, b) => b.val - a.val || a.die - b.die);
  const bestTotal = arr => totalOrder(arr).slice(0, keep);
  const score = (tot, eff) => {
    if (opts.target != null) { const win = tot > opts.target; return win ? [1, eff, tot] : [0, tot, eff]; }
    return opts.prefer === 'effect' ? [eff, tot] : [tot, eff];
  };
  const better = (a, b) => { for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return a[i] > b[i]; } return false; };
  let best = null;
  const cands = effN ? elig.concat([null]) : [null];
  cands.forEach(e => {
    const rest = elig.filter(r => r !== e);
    const tot = bestTotal(rest);
    const totalV = sum(tot.map(r => r.val));
    const effSize = e ? e.die : 0;
    const sc = score(totalV, effSize);
    if (!best || better(sc, best.sc)) best = { sc, e, tot };
  });
  if (!best) return;
  best.tot.forEach(r => { r.role = 'total'; });
  if (best.e) best.e.role = 'effect';
  // additional effect dice: largest remaining
  for (let i = 1; i < effN; i++) {
    const left = elig.filter(r => !r.role).sort((a, b) => b.die - a.die);
    if (left[0]) left[0].role = 'effect';
  }
}
function outcome(R, S) {
  const res = R.results;
  const totalDice = res.filter(r => r.role === 'total');
  const effDice = res.filter(r => r.role === 'effect').map(r => r.die).sort((a, b) => b - a);
  const hitches = res.filter(r => r.val === 1);
  const botch = res.length > 0 && hitches.length === res.length;
  let total = sum(totalDice.map(r => r.val));
  (R.hero || []).forEach(h => { if (h.val > 1) total += h.val; });
  if (R.resRolls && R.resRolls.length) total += Math.max(0, ...R.resRolls.filter(r => r.val > 1).map(r => r.val));
  let effects = effDice.slice();
  const noEff = on(S, 'noEffect');
  if (!noEff && !effects.length && !on(S, 'addAll')) effects = [4];
  if (R.rerollEffect) effects = [R.rerollEffect];
  if (noEff) effects = [];
  let margin = null, heroic = 0, success = null;
  if (R.target != null && R.target !== '') {
    margin = total - (+R.target);
    success = margin > 0;
    if (margin >= 5) heroic = Math.floor(margin / 5);
  }
  let stepped = effects.slice();
  if (heroic && stepped.length) stepped[0] = dieAt(idx(stepped[0]) + heroic);
  if (heroic && noEff) stepped = [dieAt(idx(6) + heroic)];
  return { total, totalDice, effects, stepped, hitches: hitches.length, botch, margin, heroic, success, overKeep: !on(S, 'addAll') && totalDice.length > R.keep, overEff: effDice.length > R.effects };
}
function hitchComplication(n) { return n ? dieAt(idx(6) + n - 1) : 0; }
function poolCost(items) {
  const counts = {};
  items.forEach(it => { if (it.setKey) counts[it.setKey] = (counts[it.setKey] || 0) + 1; });
  return sum(Object.values(counts).map(n => Math.max(0, n - 1)));
}
function oppTotal(results, keep = 2, addAll = false) {
  const e = results.filter(r => r.val > 1).sort((a, b) => b.val - a.val || a.die - b.die);
  results.forEach(r => { r.role = null; });
  const t = addAll ? e : e.slice(0, keep);
  t.forEach(r => { r.role = 'total'; });
  const rest = e.filter(r => !r.role).sort((a, b) => b.die - a.die);
  if (rest[0]) rest[0].role = 'effect';
  return { total: sum(t.map(r => r.val)), effect: rest[0] ? rest[0].die : 4, hitches: results.filter(r => r.val === 1).length, highest: results.slice().sort((a, b) => b.val - a.val)[0] };
}
