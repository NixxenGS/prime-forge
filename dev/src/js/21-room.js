/* ============ Dice room: rolls the GM asks for, compared live (both apps) ============
   tables/{tid}/checks/{id} = {
     type: 'test' | 'contest' | 'other', label, target (player uid), targetName, charId, charName, gm (uid),
     first: 'gm' | 'player', both (other only), turn: 'gm' | 'player' | null, status: 'open' | 'done' | 'cancelled',
     rounds: { r0: {...}, r1: {...} }, n (number of rounds)   round = { side, who, total, effect, dice: [{ d, v, r }], hitches, botch, static, giveIn, at }
     (stored as a map so the rules can check that a player adds exactly one round, rN, and touches nothing else)
     winner: 'gm' | 'player' | null, margin, heroic, created, at }
   Only the GM creates checks and rolls opposition. The asked player may only append their own round on their turn. */
const CHECK_NAMES = { test: 'Test', contest: 'Contest', other: 'Roll' };

function netChecks(tid) { return NET.checks && NET.checks[tid] || []; }
function netMyTurn(chk, tid) {
  if (!chk || chk.status !== 'open') return false;
  const T = DB.net.tables[tid]; if (!T || T.gone) return false;
  return chk.turn === 'gm' ? T.role === 'gm' : chk.turn === 'player' && chk.target === netUid();
}
function netTurnKey(chk) { return chk.id + ':' + (chk.rounds || []).length; }
function netOnChecks(tid, qs) {
  if (!NET.checks) NET.checks = {};
  if (!NET.turnSeen) NET.turnSeen = {};
  const first = !NET.checks[tid];
  const list = qs.docs.map(d => { const x = Object.assign({ id: d.id }, d.data()); x.old = Array.isArray(x.rounds); x.rounds = netRoundsArr(x); return x; });
  NET.checks[tid] = list;
  list.forEach(chk => {
    if (!netMyTurn(chk, tid)) return;
    const k = netTurnKey(chk);
    if (NET.turnSeen[k]) return;
    NET.turnSeen[k] = Date.now();
    if (!first || (chk.rounds || []).length === 0) {
      const T = DB.net.tables[tid];
      const what = chk.label ? `: ${chk.label}` : '';
      toast(T.role === 'gm' ? `Your roll for ${CHECK_NAMES[chk.type].toLowerCase()} with ${chk.charName || chk.targetName}${what}` : `${T.gmName || 'The GM'} asks ${chk.charName || 'you'} for a ${CHECK_NAMES[chk.type].toLowerCase()}${what}`);
    }
  });
  renderBar();
  if (DB.ui.tab === 'dice' && curS() && curS().table === tid) netRender();
}
function netRoundsArr(x) {
  if (Array.isArray(x.rounds)) return x.rounds;
  const m = x.rounds || {}, out = [];
  for (let i = 0; i < (+x.n || 0); i++) if (m['r' + i]) out.push(m['r' + i]);
  return out;
}
function netWaitingOnMe() {
  const out = [];
  Object.keys(NET.checks || {}).forEach(tid => netChecks(tid).forEach(chk => { if (netMyTurn(chk, tid)) out.push({ tid, chk }); }));
  return out;
}
function netAskPill() {
  const w = netWaitingOnMe(); if (!w.length) return '';
  return `<button class="netask" data-act="netGoAsk" title="A roll is waiting on you">${w.length > 1 ? w.length + ' rolls' : 'Your roll'}</button>`;
}
A.netGoAsk = () => {
  const w = netWaitingOnMe()[0]; if (!w) return;
  const T = DB.net.tables[w.tid];
  if (T.settingId && DB.settings[T.settingId]) DB.ui.settingId = T.settingId;
  if (w.chk.charId && DB.chars[w.chk.charId] && netCanWrite(DB.chars[w.chk.charId])) POOL.charId = w.chk.charId;
  DB.ui.tab = 'dice'; window.scrollTo(0, 0); render();
};
/* the number the current roll has to beat, for auto-picking dice */
function netCheckTarget() {
  const S = curS(); if (!S || !netT(S)) return null;
  const chk = netChecks(S.table).find(c => netMyTurn(c, S.table) && (c.rounds || []).length);
  if (!chk || chk.type === 'other') return null;
  return chk.rounds[chk.rounds.length - 1].total;
}

/* ---------- turning local rolls into rounds ---------- */
function netFreshRoll(chk, tid) {
  const since = (NET.turnSeen || {})[netTurnKey(chk)] || 0;
  const S = curS();
  const T = DB.net.tables[tid];
  const cands = [];
  if (POOL.last && POOL.last.at >= since) cands.push({ kind: 'pool', at: POOL.last.at });
  if (T.role === 'gm' && POOL.opRoll && POOL.opRoll.at >= since) cands.push({ kind: 'opp', at: POOL.opRoll.at });
  if (!cands.length) return null;
  const pick = cands.sort((a, b) => b.at - a.at)[0];
  if (pick.kind === 'opp') {
    const O = POOL.opRoll;
    return { kind: 'opp', total: oppTotalNow(O), effect: O.static != null ? 0 : oppEffectNow(O), hitches: O.hitches || 0, botch: false, static: O.static, dice: O.results.map(r => ({ d: r.die, v: r.val, r: r.role || '' })) };
  }
  const R = POOL.last, o = outcome(Object.assign({}, R, { target: null }), S || {});
  const C = DB.chars[R.charId];
  return { kind: 'pool', total: o.total, effect: o.effects[0] || 0, hitches: o.hitches, botch: o.botch, who: C ? C.name : '', dice: R.results.map(r => ({ d: r.die, v: r.val, r: r.role || '' })).concat((R.hero || []).map(h => ({ d: h.die, v: h.val, r: h.val > 1 ? 'total' : '' }))).concat((R.resRolls || []).map(x => ({ d: x.die, v: x.val, r: 'res' }))) };
}
function netResolve(chk, rounds) {
  const n = rounds.length, last = rounds[n - 1], prev = rounds[n - 2];
  const other = s => s === 'gm' ? 'player' : 'gm';
  const done = (winner, margin) => ({ turn: null, status: 'done', winner, margin: margin || 0, heroic: margin >= 5 ? Math.floor(margin / 5) : 0 });
  if (chk.type === 'test') {
    if (n < 2) return { turn: 'player', status: 'open' };
    const diff = last.total - prev.total;
    return diff > 0 ? done('player', diff) : Object.assign(done('gm', 0), { margin: -diff });
  }
  if (chk.type === 'contest') {
    if (last.giveIn) return Object.assign(done(other(last.side), 0), { gaveIn: last.side });
    if (n === 1) return { turn: other(last.side), status: 'open' };
    if (last.total > prev.total) return { turn: other(last.side), status: 'open' };
    return done(prev.side, prev.total - last.total);
  }
  // other: one roll, or both sides once
  if (!chk.both || n >= 2) {
    if (n < 2) return { turn: null, status: 'done', winner: null, margin: 0, heroic: 0 };
    const p = rounds.find(r => r.side === 'player'), g = rounds.find(r => r.side === 'gm');
    return { turn: null, status: 'done', winner: p.total === g.total ? null : p.total > g.total ? 'player' : 'gm', margin: Math.abs(p.total - g.total), heroic: 0 };
  }
  return { turn: other(last.side), status: 'open' };
}
async function netAppend(tid, chk, round) {
  const n = (chk.rounds || []).length;
  const rounds = (chk.rounds || []).concat([round]);
  const res = netResolve(chk, rounds);
  const me = NET.auth && NET.auth.currentUser && NET.auth.currentUser.uid;
  if (round.side === 'player' && me !== chk.target) { toast('This browser is signed in to a different account than the one the GM asked. Sign in as yourself and try again.', 'bad'); return false; }
  if (chk.old && round.side === 'player') { toast('That request came from an older version of the app. Ask the GM to send it again.', 'bad'); return false; }
  const upd = { n: n + 1, at: Date.now(), turn: res.turn, status: res.status };
  if (chk.old) { const m = {}; rounds.forEach((r, i) => { m['r' + i] = r; }); upd.rounds = m; }   // GM converting an old request
  else upd['rounds.r' + n] = round;
  if (res.status === 'done') { upd.winner = res.winner; upd.margin = res.margin; upd.heroic = res.heroic; }
  const ref = tableRef(tid).collection('checks').doc(chk.id);
  try { await ref.update(upd); return true; }
  catch (e) {
    let why = e.message || String(e);
    if (e.code === 'permission-denied') {
      why = 'Firebase refused it. Make sure the GM has published the latest security rules.';
      try {
        const s = await ref.get(); const d = s.data() || {};
        if (!s.exists || d.status !== 'open') why = 'that roll was closed or cancelled.';
        else if (d.turn !== round.side) why = 'it isn\'t your turn anymore.';
        else if (round.side === 'player' && d.target !== me) why = 'you\'re signed in to a different account than the one the GM asked.';
      } catch (e2) { }
    }
    toast('Couldn\'t send that roll: ' + why, 'bad'); return false;
  }
}
A.netLockIn = async el => {
  const tid = el.dataset.tid, chk = netChecks(tid).find(c => c.id === el.dataset.id);
  if (!chk || !netMyTurn(chk, tid)) return toast('It isn\'t your turn on that roll.', 'bad');
  const f = netFreshRoll(chk, tid);
  if (!f) return toast('Roll first, then lock it in.', 'bad');
  const T = DB.net.tables[tid];
  const side = T.role === 'gm' ? 'gm' : 'player';
  const who = side === 'gm' ? 'Opposition' : (f.who || chk.charName || DB.net.name || 'Player');
  const round = { side, who, total: f.total, effect: f.effect, dice: f.dice, hitches: f.hitches, botch: !!f.botch, at: Date.now() };
  if (f.static != null) round.static = f.static;
  if (await netAppend(tid, chk, round)) { if (f.kind === 'pool') POOL.last = null; else POOL.opRoll = null; render(); }
};
A.netGiveIn = el => {
  const tid = el.dataset.tid, chk = netChecks(tid).find(c => c.id === el.dataset.id);
  if (!chk || !netMyTurn(chk, tid)) return;
  const T = DB.net.tables[tid], side = T.role === 'gm' ? 'gm' : 'player';
  confirmBox(side === 'gm' ? 'Give in? The player wins the contest and describes how.' : `Give in? You lose on your own terms, take no complication, and ${chk.charName || 'your character'} earns 1 plot point.`, async () => {
    if (await netAppend(tid, chk, { side, who: side === 'gm' ? 'Opposition' : (chk.charName || DB.net.name), giveIn: true, total: 0, effect: 0, dice: [], hitches: 0, botch: false, at: Date.now() })) {
      const C = DB.chars[chk.charId];
      if (side === 'player' && C && netCanWrite(C)) { C.pp = (+C.pp || 0) + 1; touch(C); toast(`${C.name || 'Your character'} earns 1 plot point.`); }
      render();
    }
  }, 'Give in');
};
A.netCheckCancel = el => { tableRef(el.dataset.tid).collection('checks').doc(el.dataset.id).update({ status: 'cancelled', turn: null, at: Date.now() }).catch(e => toast(e.message, 'bad')); };
A.netCheckDel = el => { tableRef(el.dataset.tid).collection('checks').doc(el.dataset.id).delete().catch(e => toast(e.message, 'bad')); };
A.netChecksClear = el => {
  const tid = el.dataset.tid;
  netChecks(tid).filter(c => c.status !== 'open').forEach(c => tableRef(tid).collection('checks').doc(c.id).delete().catch(() => { }));
};

/* ---------- GM: ask a player for a roll ---------- */
A.netAsk = el => {
  const S = curS(); const tid = S && S.table; if (!tid) return;
  const members = (NET.members[tid] || []).filter(m => m.role !== 'gm');
  if (!members.length) return toast('No players have joined yet.', 'bad');
  const pick = el.dataset.uid || members[0].uid;
  const charsFor = u => charsOf(S).filter(c => c.owner === u);
  const charOpts = u => charsFor(u).map(c => `<option value="${c.id}">${esc(c.name || 'Unnamed')}</option>`).join('') + '<option value="">No particular character</option>';
  const statics = DIFFICULTY.map(d => `<option value="s${d.stat}">${esc(d.name)}: ${d.stat}</option>`).join('');
  const dice = DIFFICULTY.map(d => `<option value="d${d.dice.join(',')}" ${d.dice[0] === 8 ? 'selected' : ''}>${esc(d.name)}: ${d.dice.map(x => 'd' + x).join(' ')}</option>`).join('');
  openModal('Ask for a roll', `<div class="stack">
    <label class="fld"><span>Player</span><select id="askWho">${members.map(m => `<option value="${m.uid}" ${m.uid === pick ? 'selected' : ''}>${esc(m.name || 'Someone')}</option>`).join('')}</select></label>
    <label class="fld"><span>Character</span><select id="askChar">${charOpts(pick)}</select></label>
    <div class="fld"><span>Kind of roll</span><div class="seg" id="askType"><button data-v="test" aria-pressed="true">Test</button><button data-v="contest" aria-pressed="false">Contest</button><button data-v="other" aria-pressed="false">Other</button></div></div>
    <label class="fld"><span>What's it for?</span><input id="askLabel" placeholder="e.g. Climb the palace wall" maxlength="120"></label>
    <div id="askOpts"></div>
    <p class="small muted" id="askHelp" style="margin:0"></p></div>`,
    { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="askGo">Ask</button>` });
  let type = 'test';
  const opts = () => {
    $('#askOpts').innerHTML = type === 'test'
      ? `<label class="fld"><span>Difficulty</span><select id="askDiff"><optgroup label="I roll difficulty dice">${dice}</optgroup><optgroup label="Static number">${statics}</optgroup></select></label>`
      : type === 'contest'
        ? `<label class="fld"><span>Who rolls first?</span><select id="askFirst"><option value="player">The player (they start it)</option><option value="gm">Me (a GMC starts it)</option></select></label>`
        : `<label class="fld"><span>Who rolls?</span><select id="askBoth"><option value="p">Only the player</option><option value="pg">The player, then me</option><option value="gp">Me, then the player</option></select></label>`;
    $('#askHelp').textContent = type === 'test' ? 'You roll first and set the difficulty; they have to beat it. Ties fail.'
      : type === 'contest' ? 'Each side has to beat the last total, back and forth, until someone fails or gives in. Giving in earns a player 1 plot point.'
        : 'A plain roll call. With both of you rolling, the totals are compared but nobody automatically wins.';
  };
  opts();
  $('#askWho').onchange = () => { $('#askChar').innerHTML = charOpts($('#askWho').value); };
  $$('#askType button').forEach(b => b.onclick = () => { type = b.dataset.v; $$('#askType button').forEach(x => x.setAttribute('aria-pressed', x === b)); opts(); });
  $('#askGo').onclick = async () => {
    const who = members.find(m => m.uid === $('#askWho').value); const C = DB.chars[$('#askChar').value];
    const chk = { type, label: $('#askLabel').value.trim().slice(0, 120), target: who.uid, targetName: who.name || '', charId: C ? C.id : '', charName: C ? (C.name || '') : '',
      gm: netUid(), rounds: {}, n: 0, status: 'open', created: Date.now(), at: Date.now() };
    if (type === 'test') {
      chk.first = 'gm'; const v = $('#askDiff').value;
      if (v[0] === 's') { const n = +v.slice(1); chk.rounds = { r0: { side: 'gm', who: 'Difficulty', total: n, effect: 0, dice: [], hitches: 0, botch: false, static: n, at: Date.now() } }; chk.n = 1; chk.turn = 'player'; }
      else { chk.turn = 'gm'; POOL.oppBase = v.slice(1).split(',').map(Number); POOL.useDoom = false; POOL.opRoll = null; DB.ui.oppMode = 'dice'; }
    } else if (type === 'contest') { chk.first = $('#askFirst').value; chk.turn = chk.first; }
    else { const b = $('#askBoth').value; chk.both = b !== 'p'; chk.first = b === 'gp' ? 'gm' : 'player'; chk.turn = chk.first; }
    try { await tableRef(tid).collection('checks').add(chk); closeModal(); toast(`Asked ${who.name || 'them'} for a ${CHECK_NAMES[type].toLowerCase()}`); if (chk.turn === 'gm') { DB.ui.tab = 'dice'; render(); } }
    catch (e) { toast('Couldn\'t send it: ' + (e.code === 'permission-denied' ? 'Firebase refused it. Did you publish the latest security rules?' : e.message || e), 'bad'); }
  };
};

/* ---------- the room itself ---------- */
function netDie(r) { return dieSvg(r.d, r.r === 'res' ? 'free' : r.v === 1 ? 'hitch' : r.r === 'total' ? 'total' : r.r === 'effect' ? 'effect' : 'off', r.v); }
function netRoundHtml(chk, r) {
  const name = r.side === 'gm' ? (r.static != null && !(r.dice || []).length ? 'Difficulty' : (r.who || 'Opposition')) : (r.who || chk.charName || chk.targetName || 'Player');
  if (r.giveIn) return `<div class="round"><span class="rname">${esc(name)}</span><span class="small"><b>Gave in.</b></span></div>`;
  return `<div class="round ${r.side}"><span class="rname">${esc(name)}</span><span class="rdice">${(r.dice || []).map(netDie).join('')}${r.static != null ? `<span class="tag ink">target ${r.static}</span>` : ''}</span>
    <span class="rtot">${r.total}</span>${r.effect ? `<span class="reff" title="Effect die">${dieSvg(r.effect, 'effect')}</span>` : ''}${r.hitches ? `<span class="small muted">${plural(r.hitches, r.side === 'gm' ? 'opportunity' : 'hitch', r.side === 'gm' ? 'opportunities' : 'hitches')}</span>` : ''}${r.botch ? '<span class="tag">botch</span>' : ''}</div>`;
}
function netCheckVerdict(chk) {
  const pn = esc(chk.charName || chk.targetName || 'The player');
  const rounds = chk.rounds || [];
  if (chk.status === 'cancelled') return '<p class="small muted" style="margin:6px 0 0">Cancelled.</p>';
  if (chk.status !== 'done') return '';
  const winR = chk.winner ? [...rounds].reverse().find(r => r.side === chk.winner && !r.giveIn) : null;
  const eff = winR && winR.effect ? dieAt(idx(winR.effect) + (chk.heroic || 0)) : 0;
  const effTxt = eff ? (eff > 12 ? 'an effect beyond d12 (taken out)' : `a ${dlabel(eff)} effect`) : '';
  if (chk.type === 'other' && !chk.winner) return `<p class="verdict" style="margin:8px 0 0">${rounds.length > 1 ? 'Tied' : 'Rolled'}</p>`;
  const pw = chk.winner === 'player';
  const head = pw ? (chk.heroic ? 'Heroic success' : `${pn} wins`) : (chk.type === 'test' ? `${pn} fails` : 'Opposition wins');
  let more = '';
  if (rounds.some(r => r.giveIn)) more = rounds.find(r => r.giveIn).side === 'player' ? `${pn} gave in and earns 1 plot point. No complication.` : 'The GM gave in.';
  else if (chk.type === 'test') more = pw ? `Beat ${rounds[0].total} with ${rounds[rounds.length - 1].total}${chk.heroic ? `: the effect die steps up ${plural(chk.heroic, 'time')}` : ''}.` : `Needed more than ${rounds[0].total}. Ties go to the difficulty.`;
  else if (chk.type === 'contest') more = `${pw ? 'The opposition' : pn} couldn't beat the last total${chk.heroic ? ` and missed by ${chk.margin}: heroic` : ''}.${effTxt ? ` Loser takes a complication from ${effTxt}.` : ''}`;
  return `<p class="verdict ${pw ? 'win' : 'lose'}" style="margin:8px 0 0">${head}</p><p class="small" style="margin:2px 0 0">${more}</p>`;
}
function netCheckCard(tid, chk) {
  const T = DB.net.tables[tid], gm = T.role === 'gm', mine = netMyTurn(chk, tid);
  const rounds = chk.rounds || [];
  const pn = esc(chk.charName || chk.targetName || 'Player');
  const waitWho = chk.turn === 'gm' ? (gm ? 'you' : esc(T.gmName || 'the GM')) : (chk.target === netUid() ? 'you' : esc(chk.targetName || 'the player'));
  const status = chk.status === 'open' ? `<span class="tag ${mine ? '' : 'ink'}">Waiting on ${waitWho}</span>` : chk.status === 'cancelled' ? '<span class="tag ink">Cancelled</span>' : '<span class="tag ok">Done</span>';
  let act = '';
  if (mine) {
    const f = netFreshRoll(chk, tid);
    const rolledBefore = rounds.some(r => r.side === (gm ? 'gm' : 'player') && !r.giveIn);
    const need = chk.type !== 'other' && rounds.length ? ` (beat ${rounds[rounds.length - 1].total})` : '';
    act = `<div class="row" style="margin-top:10px;gap:8px">
      ${f ? `<button class="btn" data-act="netLockIn" data-tid="${tid}" data-id="${chk.id}">Lock in: ${f.total}${f.effect ? ' · ' + dlabel(f.effect) : ''}</button>` : `<span class="small">${gm ? (chk.type === 'test' ? 'Roll the difficulty in the Opposition panel' : 'Roll the opposition') : `Build ${pn}'s pool and roll`}${need}, then lock it in here.</span>`}
      ${chk.type === 'contest' && rolledBefore ? `<button class="btn quiet small" data-act="netGiveIn" data-tid="${tid}" data-id="${chk.id}">Give in${gm ? '' : ' (+1 PP)'}</button>` : ''}</div>`;
  }
  const gmActs = gm ? `<div class="row" style="margin-top:8px;gap:6px;justify-content:flex-end">${chk.status === 'open' ? `<button class="linkbtn small" data-act="netCheckCancel" data-tid="${tid}" data-id="${chk.id}">Cancel</button>` : `<button class="linkbtn small" data-act="netCheckDel" data-tid="${tid}" data-id="${chk.id}">Remove</button>`}</div>` : '';
  return `<div class="card checkcard ${chk.status} ${mine ? 'myturn' : ''}">
    <div class="row" style="gap:8px"><span class="tag">${CHECK_NAMES[chk.type]}</span><b class="grow">${esc(chk.label || (chk.type === 'test' ? 'A test' : chk.type === 'contest' ? 'A contest' : 'A roll'))}</b>${status}</div>
    <p class="small muted" style="margin:4px 0 8px">${pn}${chk.charName && chk.targetName ? ` (${esc(chk.targetName)})` : ''}${chk.type === 'other' && !chk.both ? '' : ' vs the GM'}</p>
    <div class="rounds">${rounds.map(r => netRoundHtml(chk, r)).join('') || '<p class="small muted" style="margin:0">No rolls yet.</p>'}</div>
    ${netCheckVerdict(chk)}${act}${gmActs}</div>`;
}
function netRoomPanel(S) {
  const tid = S.table, T = DB.net.tables[tid], gm = T.role === 'gm';
  const list = netChecks(tid).filter(c => gm || c.target === netUid() || c.status === 'open' || Date.now() - (c.at || 0) < 600000);
  const open = list.filter(c => c.status === 'open'), past = list.filter(c => c.status !== 'open').slice(0, 6);
  const players = (NET.members[tid] || []).filter(m => m.role !== 'gm');
  const ask = gm ? `<div class="row askrow" style="gap:6px;margin-bottom:12px"><span class="lbl">Ask for a roll</span>${players.map(m => {
    const cs = charsOf(S).filter(c => c.owner === m.uid).map(c => c.name || 'Unnamed').join(', ');
    return `<button class="chip click" data-act="netAsk" data-uid="${m.uid}"><b>${esc(m.name || 'Someone')}</b>${cs ? `<span class="small muted">${esc(cs)}</span>` : ''}</button>`;
  }).join('') || '<span class="small muted">Players who join show up here.</span>'}</div>` : '';
  return `<div class="panel roompanel"><div class="bar">${gm ? 'Rolls you asked for' : 'Rolls the GM asked for'}</div><div class="in">
    ${ask}
    <div class="checkgrid">${open.map(c => netCheckCard(tid, c)).join('') || `<p class="small muted" style="margin:0">${gm ? 'Tap a player above to ask for a test, a contest or another roll.' : 'Nothing right now. When the GM asks you to roll, it shows up here.'}</p>`}</div>
    ${past.length ? `<div class="row" style="margin-top:14px"><span class="lbl grow">Finished</span>${gm ? `<button class="linkbtn small" data-act="netChecksClear" data-tid="${tid}">Clear finished</button>` : ''}</div><div class="checkgrid past">${past.map(c => netCheckCard(tid, c)).join('')}</div>` : ''}
  </div></div>`;
}
