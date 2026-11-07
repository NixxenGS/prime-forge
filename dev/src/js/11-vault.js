/* ============ Vault (home) ============ */
VIEWS.vault = () => {
  const settings = Object.values(DB.settings).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  const chars = Object.values(DB.chars).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
  const head = `<div class="pagehead"><div><h1>Your vault</h1><p class="lede">Design a character file for any setting you can dream up, then build and play the characters who live in it.</p></div>
    ${settings.length ? '<div class="acts"><button class="btn" data-act="newSetting">New setting</button><button class="btn ghost" data-act="importFile">Import file</button><button class="btn quiet" data-act="exportBackup">Export backup</button></div>' : ''}</div>`;
  if (!settings.length) {
    return head + `<div class="hero-cta"><div class="empty" style="text-align:left;padding:28px">
      <h3>Start with a setting</h3>
      <p class="prose">A setting is your game's version of Cortex Prime: which trait sets make up a character, which mods from the Big Menu are on, and how characters get built and grow.</p>
      <div class="row" style="margin-top:14px"><button class="btn big" data-act="newSetting">Create your first setting</button><button class="btn ghost" data-act="importFile">Import a setting or player pack</button></div></div>
      <div><h3>How it works</h3><ol class="howto">
        <li><div><b class="k">Design the setting.</b> Pick your prime sets and switch mods on from the Big Menu.</div></li>
        <li><div><b class="k">Build characters.</b> Budgets from your rules are tracked as you go; nothing blocks you.</div></li>
        <li><div><b class="k">Play from the file.</b> Tap traits to build a dice pool, roll, and track plot points and stress.</div></li>
        <li><div><b class="k">Share with players.</b> Export a locked player pack; they import it and make their own characters.</div></li>
      </ol></div></div>`;
  }
  const scards = settings.map(s => {
    const n = charsOf(s).length;
    const primes = s.sets.filter(x => x.prime && x.kind !== 'distinctions').map(x => x.name);
    return `<article class="scard"><div class="top">${emblem(s)}<div class="grow"><h3>${esc(s.name || 'Untitled setting')}</h3>${s.tagline ? `<div class="tl">${esc(s.tagline)}</div>` : ''}</div></div>
      <div class="meta">${s.table && DB.net.tables[s.table] && !DB.net.tables[s.table].gone ? '<span class="tag ok">Online table</span>' : s.lock ? '<span class="tag">Player pack</span>' : ''}<span class="tag ink">${plural(n, 'character')}</span>${primes.map(p => `<span class="tag ink">${esc(p)}</span>`).join('')}</div>
      <div class="foot">
        ${s.lock ? '' : `<button class="btn small" data-act="openSetting" data-id="${s.id}" data-tab="designer">Design</button>`}
        <button class="btn ${s.lock ? '' : 'ghost'} small" data-act="openSetting" data-id="${s.id}" data-tab="chars">Characters</button>
        <button class="btn quiet small" data-act="settingMenu" data-id="${s.id}">More…</button>
      </div></article>`;
  }).join('');
  const ccards = chars.slice(0, 12).map(c => {
    const s = DB.settings[c.settingId];
    return `<button class="ccard" data-act="openChar" data-id="${c.id}">${portraitDot(c)}<div class="grow"><div class="nm">${esc(c.name || 'Unnamed character')}</div><div class="cn">${[c.concept, s && s.name].filter(Boolean).map(esc).join(' · ')}</div></div></button>`;
  }).join('');
  return head + `<h2>Settings</h2><div class="vault-grid">${scards}</div>
    ${chars.length ? `<hr class="rule"><h2>Recent characters</h2><div class="vault-grid">${ccards}</div>` : ''}
    <hr class="rule"><p class="small muted">Everything is saved in this browser. Export a backup now and then, and before clearing browser data.</p>`;
};
function portraitDot(c) {
  const ini = (c.name || '?').trim().slice(0, 1).toUpperCase();
  return `<span class="pt">${c.portrait ? `<img src="${c.portrait}" alt="">` : esc(ini)}</span>`;
}
A.newSetting = () => {
  promptBox('New setting', 'Setting name', '', name => {
    const s = newSetting((name || '').trim() || 'Untitled setting');
    DB.settings[s.id] = s; DB.ui.settingId = s.id; DB.ui.tab = 'designer'; DB.ui.dsec = 'identity'; DB.ui.charId = null;
    save(); render(); toast('Setting created. Start with its trait sets.');
  }, 'Create');
};
A.importFile = () => {
  openModal('Import', `<p class="prose small">Import a setting, player pack, character or backup made with Prime Forge.</p>
    <div class="row"><button class="btn" id="impPick">Choose a .json file</button></div>
    <label class="fld" style="margin-top:14px"><span>Or paste the file's text (handy when it was sent in a chat)</span><textarea id="impTxt" rows="6" placeholder='{"app":"primeforge", …}'></textarea></label>`,
    { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="impGo">Import pasted text</button>` });
  $('#impPick').onclick = () => { closeModal(); pickFile('.json,application/json', txt => importText(txt)); };
  $('#impGo').onclick = () => { const t = $('#impTxt').value.trim(); if (!t) return toast('Paste the file text first.', 'bad'); closeModal(); importText(t); };
};
A.exportBackup = () => exportBackup();
A.openSetting = el => { DB.ui.settingId = el.dataset.id; DB.ui.tab = el.dataset.tab; DB.ui.charId = null; DB.ui.cview = 'list'; window.scrollTo(0, 0); render(); };
A.openChar = el => { const c = DB.chars[el.dataset.id]; if (!c) return; DB.ui.settingId = c.settingId; DB.ui.charId = c.id; DB.ui.tab = 'chars'; DB.ui.cview = 'file'; window.scrollTo(0, 0); render(); };
A.settingMenu = el => {
  const s = DB.settings[el.dataset.id]; if (!s) return;
  openModal(s.name || 'Setting', `<div class="stack">
    <div class="row"><button class="btn ghost" data-act="expSetting" data-id="${s.id}">Export setting</button><span class="small muted">Editable copy, for you or a co-GM.</span></div>
    ${s.lock ? '' : `<div class="row"><button class="btn ghost" data-act="expPack" data-id="${s.id}">Export player pack</button><span class="small muted">Locked copy players import to make characters.</span></div>`}
    ${s.lock ? '' : `<div class="row"><button class="btn ghost" data-act="go" data-tab="online">Play online…</button><span class="small muted">Open a live table your players join with a link.</span></div>`}
    <div class="row"><button class="btn ghost" data-act="dupSetting" data-id="${s.id}">Duplicate</button><span class="small muted">A new editable copy without characters.</span></div>
    ${s.lock ? `<div class="row"><button class="btn ghost" data-act="unlockSetting" data-id="${s.id}">Unlock editing</button><span class="small muted">Needs the pack's passphrase if it has one.</span></div>` : ''}
    <div class="row"><button class="btn danger" data-act="delSetting" data-id="${s.id}">Delete setting</button><span class="small muted">Also deletes its ${plural(charsOf(s).length, 'character')}.</span></div>
  </div>`);
};
A.expSetting = el => { closeModal(); exportSetting(DB.settings[el.dataset.id], false); };
A.expPack = el => {
  const s = DB.settings[el.dataset.id]; closeModal();
  openModal('Export player pack', `<p class="prose">Players who import the pack can read the setting and build characters, but can't change the rules or see the GM table. Add an optional passphrase so only you can unlock a copy.</p>
    <label class="fld"><span>Passphrase (optional)</span><input id="packPass" type="text" autocomplete="off"></label>`,
    { actions: `<button class="btn ghost" data-act="closeModal">Cancel</button><button class="btn" id="packGo">Export pack</button>` });
  $('#packGo').onclick = () => { const p = $('#packPass').value.trim(); closeModal(); exportSetting(s, true, p); };
};
A.dupSetting = el => { const s = clone(DB.settings[el.dataset.id]); s.id = uid('s_'); s.name += ' (copy)'; s.lock = null; delete s.table; s.created = s.updated = now(); DB.settings[s.id] = s; closeModal(); save(); render(); toast('Setting duplicated'); };
A.unlockSetting = el => {
  const s = DB.settings[el.dataset.id] || curS(); closeModal();
  if (!s.lock) return;
  if (s.lock.hash) {
    promptBox('Unlock player pack', 'Passphrase', '', p => {
      if (hashStr('pf:' + p.trim()) === s.lock.hash) { s.lock = null; touch(s); render(); toast('Unlocked. You can edit this setting now.'); }
      else toast('That passphrase doesn\'t match.', 'bad');
    }, 'Unlock');
  } else confirmBox('This pack has no passphrase. Unlock it for editing? (Usually only the GM should.)', () => { s.lock = null; touch(s); render(); toast('Unlocked'); }, 'Unlock');
};
A.delSetting = el => {
  const s = DB.settings[el.dataset.id]; closeModal();
  const NT = typeof netT === 'function' && netT(s);
  if (NT) return toast(NT.role === 'gm' ? 'This setting runs an online table. Close the table on the Online tab first.' : 'This setting belongs to an online table. Leave the table on the Online tab first.', 'bad');
  confirmBox(`Delete “${s.name}” and its ${plural(charsOf(s).length, 'character')}? This can't be undone.`, () => {
    charsOf(s).forEach(c => delete DB.chars[c.id]); delete DB.settings[s.id]; delete DB.gm[s.id];
    if (DB.ui.settingId === s.id) { DB.ui.settingId = null; DB.ui.charId = null; DB.ui.tab = 'vault'; }
    save(); render(); toast('Setting deleted');
  }, 'Delete');
};
