/* ============ Player app: dashboard, campaign page and app bar (APP_MODE 'play') ============
   The player app is the same code as Prime Forge with a different shell: no vault, no designer, no GM table.
   Everything it shows comes from the signed-in account's campaigns. */
if (APP_MODE === 'play') VIEWS.vault = () => VIEWS.home();

function renderPlayBar(S, tabs, dark) {
  const camps = Object.values(DB.net.tables).filter(T => !T.gone && T.role !== 'gm' && T.settingId && DB.settings[T.settingId]);
  $('#bar').innerHTML = `<div class="appbar-in">
    <button class="brand" data-act="go" data-tab="home" aria-label="Your campaigns">${brandMark()}<b>PRIME<span>·</span>FORGE</b><small class="brandsub">Players</small></button>
    ${NET.user && camps.length ? `<label class="setswitch"><select data-act-change="pickSetting" aria-label="Campaign">
      <option value="" ${S ? '' : 'selected'}>Your campaigns</option>
      ${camps.map(T => `<option value="${T.settingId}" ${S && S.id === T.settingId ? 'selected' : ''}>${esc(T.name || 'Campaign')}</option>`).join('')}
    </select></label>` : ''}
    <nav class="tabs" aria-label="Sections">${tabs.length > 1 ? tabs.map(t => `<button class="tab" data-act="go" data-tab="${t.id}" ${DB.ui.tab === t.id ? 'aria-current="page"' : ''}>${esc(t.label)}${t.n ? `<span class="n">${t.n}</span>` : ''}</button>`).join('') : ''}</nav>
    <div class="bar-right">${netBadge()}
      <button class="icon-btn" data-act="toggleTheme" title="Switch to ${dark ? 'Handbook (light)' : 'Neon (dark)'} theme" aria-label="Switch theme">${dark ? '☀' : '☾'}</button>
    </div></div>`;
}

VIEWS.home = () => {
  netState();
  const st = NET.status;
  if (st === 'setup') return `<div class="pagehead"><div><h1>Prime Forge Players</h1><p class="lede">This copy of the player app isn't connected to a campaign server. Open the player link your GM sent you.</p></div></div>`;
  if (st === 'off' || st === 'connecting') return '<p class="muted" style="margin-top:40px;text-align:center">Connecting…</p>';
  if (st === 'error') return `<div class="authbox panel"><div class="bar">Can't connect</div><div class="in stack"><p class="small" style="color:var(--crimson);margin:0">${esc(NET.err)}</p><div class="row"><button class="btn" data-act="netConnect">Try again</button></div></div></div>`;
  if (!NET.user) {
    const code = NET.pendingCode || DB.net.codeDraft;
    return `<div class="playhero"><h1>Your characters, at every table.</h1>
      <p class="lede">Sign in to join your GM's Cortex Prime campaigns with a room code, then build and play your characters. They're saved to your account, so they're there on any phone, tablet or computer.</p>
      ${code ? `<p class="small"><span class="tag">Room code ${esc(netCodeFmt(code))}</span> Sign in and we'll take you to that campaign.</p>` : ''}</div>`
      + netAuthPanel('');
  }
  const me = netUid();
  const tabs = Object.entries(DB.net.tables).sort((a, b) => (b[1].joined || '').localeCompare(a[1].joined || ''));
  const cards = tabs.map(([tid, T]) => playCard(tid, T, me)).join('');
  const join = `<div class="panel"><div class="bar">Join a campaign</div><div class="in stack">
      <label class="fld"><span>Room code from your GM</span><input class="codein" value="${esc(netCodeFmt(DB.net.codeDraft || ''))}" data-bind="N.codeDraft" placeholder="K7Q-M2X" maxlength="9" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <div class="row"><button class="btn" data-act="netCodeGo">Find campaign</button></div></div></div>`;
  return `<div class="pagehead"><div><h1>Your campaigns</h1><p class="lede">Hello, ${esc(DB.net.name || 'adventurer')}. Pick a campaign to play, or join a new one with a room code.</p></div></div>
    <div class="netgrid"><div class="stack">${NET.joining ? netJoinCard() : ''}${cards || '<div class="card"><h3 style="margin-top:0">No campaigns yet</h3><p class="small muted" style="margin:0">Ask your GM for their room code and type it in to join.</p></div>'}</div>
    <div class="stack">${join}${netAccountCard()}</div></div>`;
};
function playCard(tid, T, me) {
  const S = DB.settings[T.settingId];
  if (T.gone) return `<div class="card"><div class="row"><h3 class="grow" style="margin:0">${esc(T.name || 'Campaign')}</h3><span class="tag ink">${T.gone === 'closed' ? 'Closed by the GM' : T.gone === 'removed' ? 'You were removed' : 'No access'}</span></div>
    <p class="small muted">You can't open this campaign anymore.</p><button class="btn quiet small" data-act="netForget" data-tid="${tid}">Remove from list</button></div>`;
  if (T.role === 'gm') return `<div class="card"><div class="row"><h3 class="grow" style="margin:0">${esc(T.name || 'Campaign')}</h3><span class="tag">You run it</span></div>
    <p class="small muted" style="margin:6px 0 10px">You're the GM here. Run it from Prime Forge.</p><a class="btn ghost small" href="${esc(netGmLink())}" target="_blank" rel="noopener">Open Prime Forge</a></div>`;
  const mine = S ? charsOf(S).filter(c => c.owner === me) : [];
  const members = (NET.members[tid] || []).filter(m => m.role !== 'gm');
  return `<div class="card playcard"><button class="ccard" style="border:0;padding:0;box-shadow:none;width:100%;text-align:left" data-act="netOpenC" data-tid="${tid}">
      <div class="grow"><div class="nm">${esc(T.name || 'Campaign')}</div><div class="cn">Run by ${esc(T.gmName || 'your GM')}${S && S.tagline ? ' · ' + esc(S.tagline) : ''}</div></div></button>
    <div class="row" style="margin-top:10px;gap:6px;flex-wrap:wrap">${mine.length ? mine.map(c => `<button class="tag ok" data-act="netOpenChar" data-tid="${tid}" data-id="${c.id}" style="cursor:pointer;border:0">${esc(c.name || 'Unnamed')}</button>`).join('') : `<span class="small muted">${S ? 'No character yet' : 'Loading…'}</span>`}
      <span class="grow"></span>${members.length ? `<span class="small muted">${plural(members.length, 'player')}</span>` : ''}</div>
    <div class="row" style="margin-top:10px"><button class="btn small" data-act="netOpenC" data-tid="${tid}" ${S ? '' : 'disabled'}>Play</button></div></div>`;
}
VIEWS.camp = () => {
  const S = curS(); const T = netT(S); if (!S || !T) return VIEWS.home();
  const members = NET.members[S.table] || [];
  const chars = charsOf(S);
  const who = uid => chars.filter(c => c.owner === uid).map(c => esc(c.name || 'Unnamed')).join(', ');
  return `<div class="pagehead"><div><h1>${esc(T.name || S.name)}</h1><p class="lede">Run by ${esc(T.gmName || 'your GM')}${S.tagline ? ' · ' + esc(S.tagline) : ''}</p></div></div>
    <div class="netgrid"><div class="stack">
      <div class="panel"><div class="bar">At the table</div><div class="in"><ul class="netmembers" style="margin:0">${members.map(m => `<li><b>${esc(m.name || 'Someone')}</b>${m.role === 'gm' ? ' <span class="tag">GM</span>' : ''}${m.uid === netUid() ? ' <span class="small muted">(you)</span>' : ''}<span class="small muted" style="margin-left:auto">${who(m.uid)}</span></li>`).join('') || '<li class="muted">Loading…</li>'}</ul></div></div>
      ${S.pitch ? `<div class="panel"><div class="bar">The pitch</div><div class="in prose">${esc(S.pitch)}</div></div>` : ''}
    </div><div class="stack">
      <div class="panel"><div class="bar">Your settings here</div><div class="in stack">
        <label class="check"><input type="checkbox" class="bubble" ${DB.net.shareRolls ? 'checked' : ''} data-bind="N.shareRolls" data-re><span>Share my dice rolls with the table</span></label>
        <p class="small muted" style="margin:0">Your characters save to the campaign as you edit them. Sign in on another device and they're there.</p>
        <div class="row"><button class="btn quiet small" data-act="netLeaveAsk" data-tid="${S.table}">Leave campaign</button></div></div></div>
    </div></div>`;
};
A.netOpenC = el => netOpenCampaign(el.dataset.tid);
A.netOpenChar = el => { netOpenCampaign(el.dataset.tid); if (DB.chars[el.dataset.id]) { DB.ui.charId = el.dataset.id; DB.ui.cview = 'file'; render(); } };
