/* ============ Pathways map (p.73–80) ============ */
function pathMapView(S) {
  const pcs = charsOf(S);
  const W = 1000, H = 720, cx = W / 2, cy = H / 2, R = Math.min(250, 120 + pcs.length * 30);
  const nodes = {}, edges = [];
  const pcPos = {};
  pcs.forEach((c, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(1, pcs.length); pcPos[c.id] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a }; });
  const nameToPc = {}; pcs.forEach(c => { if (c.name) nameToPc[c.name.toLowerCase()] = c.id; });
  pcs.forEach(c => {
    Object.values(c.pathways || {}).forEach(rec => (rec.els || []).forEach(e => {
      if (!(e.name || '').trim()) return;
      if (e.type === 'pc') { const o = nameToPc[e.name.toLowerCase()]; if (o) edges.push({ from: c.id, to: 'pc:' + o, label: e.link, pc: true }); return; }
      const key = (e.type === 'circle' || e.type === 'triangle' ? e.type : 'res') + ':' + e.name.trim().toLowerCase();
      if (!nodes[key]) nodes[key] = { key, name: e.name.trim(), type: e.type, links: [] };
      nodes[key].links.push(c.id);
      edges.push({ from: c.id, to: key, label: e.link });
    }));
  });
  // place elements
  const list = Object.values(nodes);
  const perPc = {};
  list.forEach((n, i) => {
    const ids = [...new Set(n.links)];
    if (ids.length === 1) {
      const p = pcPos[ids[0]]; const k = (perPc[ids[0]] = (perPc[ids[0]] || 0) + 1) - 1;
      const spread = 0.42; const a = p.a + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * spread;
      const rr = R + 120 + (k > 4 ? 60 : 0);
      n.x = cx + rr * Math.cos(a); n.y = cy + rr * Math.sin(a);
    } else {
      const ax = sum(ids.map(id => pcPos[id].x)) / ids.length, ay = sum(ids.map(id => pcPos[id].y)) / ids.length;
      const j = i * 2.399; n.x = cx + (ax - cx) * 0.45 + 34 * Math.cos(j); n.y = cy + (ay - cy) * 0.45 + 34 * Math.sin(j);
    }
    n.x = clamp(n.x, 60, W - 60); n.y = clamp(n.y, 40, H - 40);
  });
  const pos = k => k.startsWith('pc:') ? pcPos[k.slice(3)] : (nodes[k] || pcPos[k]);
  const short = s => (s || '').length > 20 ? s.slice(0, 19) + '…' : (s || '');
  let svg = '';
  // PC-PC base lines
  for (let i = 0; i < pcs.length; i++) for (let j = i + 1; j < pcs.length; j++) { const a = pcPos[pcs[i].id], b = pcPos[pcs[j].id]; svg += `<line class="lnk pc" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }
  edges.forEach(e => {
    const a = pcPos[e.from], b = pos(e.to); if (!a || !b) return;
    svg += `<line class="lnk ${e.pc ? 'pc' : ''}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    if (e.label) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; svg += `<text class="lt" x="${mx}" y="${my - 4}" text-anchor="middle">${esc(short(e.label))}</text>`; }
  });
  list.forEach(n => {
    const lab = `<text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-size="12">${esc(short(n.name))}</text>`;
    if (n.type === 'circle') svg += `<circle class="shape" cx="${n.x}" cy="${n.y}" r="40"/>` + lab;
    else if (n.type === 'triangle') svg += `<polygon class="shape" points="${n.x},${n.y - 42} ${n.x + 52},${n.y + 30} ${n.x - 52},${n.y + 30}"/><text x="${n.x}" y="${n.y + 16}" text-anchor="middle" font-size="11.5">${esc(short(n.name))}</text>`;
    else { const kind = { extra: 'extra', org: 'org', prop: 'prop', location: 'location' }[n.type] || ''; svg += `<polygon class="shape" points="${n.x},${n.y - 38} ${n.x + 62},${n.y} ${n.x},${n.y + 38} ${n.x - 62},${n.y}"/>` + lab + `<text x="${n.x}" y="${n.y + 18}" text-anchor="middle" font-size="9" style="fill:var(--crimson)">${kind}</text>`; }
  });
  pcs.forEach(c => { const p = pcPos[c.id]; svg += `<rect class="shape pc" x="${p.x - 70}" y="${p.y - 22}" width="140" height="44" rx="3"/><text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14" style="text-transform:uppercase">${esc(short(c.name || 'Unnamed'))}</text>`; });
  const empty = !pcs.length || !list.length;
  return `<div class="pagehead"><div><h1>Pathways map</h1><p class="lede">${esc(S.name)}: the people, places and situations your characters are tied to.</p></div>
    <div class="acts"><button class="btn quiet" data-act="print">Print</button><button class="btn quiet" data-act="cview" data-v="list">Back to characters</button></div></div>
    ${empty ? `<div class="empty" style="margin-bottom:16px"><p>Elements appear here as players fill in their pathways stages in the builder.</p></div>` : ''}
    <svg class="pmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pathways map">${svg}</svg>
    <p class="small muted" style="margin-top:8px">Rectangle: player character · Circle: secondary character · Triangle: situation · Diamond: resource (extra, organization, prop or location). Elements with the same name are merged, so shared connections meet in the middle.</p>`;
}
