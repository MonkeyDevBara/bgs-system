/* M05 Workflow template + M09 Compliance pages.
   Routes: /workflows, /workflows/:id, /workflows/:id/edit, /compliance/rules, /compliance/library, /compliance/checklists */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui;
  const MGMT = ['superadmin', 'director', 'admin'];
  const pad = (n, l) => String(n).padStart(l, '0');
  const iso10 = d => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
  const todayISO = () => iso10(BGS.today);
  const roleName = r => (D.picByStepRole || {})[r] || r;
  const routeName = id => (id ? ((D.routes.find(r => r.id === id) || {}).name || id) : null);
  const NS = 'http://www.w3.org/2000/svg';
  const put = (el, ...k) => { k.flat(Infinity).forEach(x => { if (x) el.appendChild(x); }); return el; };
  const sv = (tag, a, ...k) => { const e = document.createElementNS(NS, tag); for (const [x, v] of Object.entries(a || {})) if (v != null) e.setAttribute(x, v); k.flat().forEach(c => { if (c == null || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; };
  const uid = (() => { let n = 0; return () => ++n; })();

  // ---------- seed: one rule revised after the cases took their snapshot (so RUL-025 delta is demonstrable) ----------
  (function seedRuleRevision() {
    const r = D.requirements.find(x => x.id === 'RQ05');
    if (!r || r.version > 1 || r.history) return;
    r.history = [{ version: 1, effective: r.effective, name: r.name, at: '2026-01-01', by: 'U01', reason: 'Versi awal' }];
    r.version = 2; r.effective = '2026-10-20';
    r.name = 'Surat izin keluarga / wali untuk worker menikah (lampirkan KK terbaru)';
  })();

  // ---------- styles ----------
  BGS.addStyle(`
  .wf-chart{display:flex;flex-direction:column;gap:8px}
  .wf-zoom{display:flex;align-items:center;gap:6px;justify-content:flex-end;font-size:12px;color:var(--muted)}
  .wf-scroll{overflow:auto;border:1px solid var(--line);border-radius:10px;background:#F8FAFC;background-image:radial-gradient(#CBD5E1 1px,transparent 1px);background-size:18px 18px;max-height:640px}
  .wf-svg{display:block}
  .wf-node{cursor:pointer} .wf-node:hover rect.wf-box{filter:drop-shadow(0 3px 6px rgba(15,23,42,.25))}
  .wf-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#334155;align-items:center}
  .wf-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:5px;vertical-align:-2px;border:1.5px solid}
  .wf-pill{display:inline-block;font-size:10.5px;font-weight:800;border-radius:10px;padding:0 7px;margin-right:4px}
  .wf-li{display:flex;gap:10px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:#fff;cursor:pointer}
  .wf-li:hover{background:#F8FAFC} .wf-li.on{border-color:var(--blue);background:var(--blue-l);box-shadow:0 0 0 2px #93C5FD}
  .wf-li .wf-n{width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex:none}
  .wf-li .wf-t{flex:1;min-width:0;line-height:1.3} .wf-li .wf-t b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
  .wf-pick{display:flex;gap:8px;align-items:center;padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:#fff;font-size:13px}
  .wf-pick.dis{opacity:.5;background:var(--bg)}
  .wf-gantt{position:relative;height:14px;background:var(--gray-l);border-radius:8px;min-width:140px}
  .wf-gantt i{position:absolute;top:0;bottom:0;border-radius:8px;background:#3B82F6} .wf-gantt i.crit{background:var(--orange)}
  .wf-ul{margin:4px 0 0;padding-left:18px} .wf-ul li{margin:2px 0}
  .wf-diff{display:grid;grid-template-columns:repeat(4,1fr);gap:10px} @media(max-width:760px){.wf-diff{grid-template-columns:1fr 1fr}}
  .wf-dbox{border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff} .wf-dbox .n{font-size:24px;font-weight:800;line-height:1.1}
  .wf-sw{display:inline-flex;border:1px solid var(--line2);border-radius:9px;overflow:hidden}
  .wf-sw button{border:0;background:#fff;padding:4px 10px;font-size:12.5px;font-weight:700;color:#475569;border-right:1px solid var(--line2)} .wf-sw button:last-child{border-right:0}
  .wf-sw button.met.on{background:var(--green);color:#fff} .wf-sw button.not.on{background:var(--red);color:#fff} .wf-sw button:disabled{opacity:.55;cursor:not-allowed}
  .wf-ci{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:10px 0;border-bottom:1px dashed var(--line)}
  .wf-note{font-size:11.5px;color:var(--muted)}
  `);

  // =====================================================================================
  //  Template helpers
  // =====================================================================================
  const pubOf = t => t.versions.find(v => v.status === 'PUBLISHED');
  const draftOf = t => t.versions.find(v => v.status === 'DRAFT');
  const verOf = (t, n) => t.versions.find(v => v.v === n);
  const isRunning = c => !['DEPARTED', 'CANCELLED'].includes(c.status);
  const casesOf = (t, v, running = true) => D.cases.filter(c => c.templateId === t.id && c.templateVersion === v && (!running || isRunning(c)));
  const clone = steps => steps.map(s => Object.assign({}, s, { pred: (s.pred || []).slice() }));
  const pendingMig = () => D.approvals.filter(a => a.type === 'MIGRASI_WORKFLOW' && a.status === 'PENDING');
  const keyChips = t => [D.cn(t.country), D.pn(t.profession), t.route ? routeName(t.route) : 'Semua jalur', t.jobOrderId ? 'Job Order ' + t.jobOrderId : null].filter(Boolean);
  const keyLabel = t => `${t.country}-${t.profession}${t.route ? '-' + t.route.replace('RT-', '') : ''}${t.jobOrderId ? '-' + t.jobOrderId : ''}`;
  const STEP_FIELDS = [['name', 'nama'], ['required', 'wajib/opsional'], ['role', 'peran PIC'], ['dueDays', 'tenggat'], ['pred', 'pendahulu'], ['verification', 'verifikasi'], ['external', 'langkah eksternal'], ['consumesQuota', 'kuota']];
  const VER_LBL = { NONE: 'Tanpa verifikasi', VERIFY: 'Verifikasi', APPROVE: 'Approval' };

  // ---------- graph analysis ----------
  function analyze(steps) {
    const byId = new Map(steps.map(s => [s.id, s]));
    const succ = {}; steps.forEach(s => (succ[s.id] = []));
    steps.forEach(s => s.pred.forEach(p => { if (byId.has(p)) succ[p].push(s.id); }));
    const reaches = (a, b) => { const seen = new Set(); const st = [a]; while (st.length) { const x = st.pop(); for (const y of succ[x] || []) { if (y === b) return true; if (!seen.has(y)) { seen.add(y); st.push(y); } } } return false; };
    const cyc = new Set(steps.filter(s => reaches(s.id, s.id)).map(s => s.id));
    const lvl = {}; steps.forEach(s => (lvl[s.id] = 0));
    const n = steps.length;
    for (let it = 0; it < n; it++) {
      let ch = false;
      steps.forEach(s => s.pred.forEach(p => { if (byId.has(p) && lvl[p] + 1 > lvl[s.id] && lvl[p] + 1 < n) { lvl[s.id] = lvl[p] + 1; ch = true; } }));
      if (!ch) break;
    }
    return { byId, succ, cyc, lvl, reaches };
  }
  function validate(steps) {
    const errors = [], warnings = [];
    if (!steps.length) { errors.push('Template belum punya langkah. Minimal 1 langkah.'); return { errors, warnings }; }
    const A = analyze(steps); const no = id => steps.findIndex(s => s.id === id) + 1;
    steps.forEach((s, i) => {
      if (!String(s.name || '').trim()) errors.push(`Langkah #${i + 1} belum punya nama.`);
      if (!(Number.isInteger(+s.dueDays) && +s.dueDays >= 1)) errors.push(`Langkah #${i + 1} (${s.name || 'tanpa nama'}): tenggat harus minimal 1 hari.`);
      s.pred.forEach(p => { if (!A.byId.has(p)) errors.push(`Langkah #${i + 1} (${s.name}) mengacu pada pendahulu yang tidak ada (langkah yatim).`); });
      if (s.pred.includes(s.id)) errors.push(`Langkah #${i + 1} (${s.name}) menjadikan dirinya sendiri pendahulu.`);
    });
    if (A.cyc.size) errors.push('Ada putaran (siklus) ketergantungan antar langkah: ' + steps.filter(s => A.cyc.has(s.id)).map(s => '#' + no(s.id)).join(', ') + '. Langkah di putaran tidak akan pernah terbuka (RUL-014).');
    const roots = steps.filter(s => !s.pred.some(p => A.byId.has(p)));
    if (!roots.length) errors.push('Tidak ada langkah awal (root): minimal satu langkah harus tanpa pendahulu agar proses bisa dimulai.');
    const q = steps.filter(s => s.consumesQuota);
    if (q.length > 1) errors.push(`Hanya boleh satu langkah yang menghabiskan kuota, sekarang ada ${q.length}: ${q.map(s => '#' + no(s.id)).join(', ')} (RUL-005).`);
    if (!q.length) warnings.push('Belum ada langkah yang menghabiskan kuota. Kuota akan tetap berstatus "Dicadangkan" selama proses (RUL-005..007).');
    const names = {}; steps.forEach((s, i) => { const k = String(s.name || '').trim().toLowerCase(); if (k) (names[k] = names[k] || []).push(i + 1); });
    Object.values(names).filter(a => a.length > 1).forEach(a => warnings.push(`Nama langkah sama pada #${a.join(', #')}. Sebaiknya dibedakan agar mudah dibaca.`));
    const reqAfterOpt = steps.filter(s => s.required && s.pred.some(p => A.byId.has(p) && !A.byId.get(p).required));
    if (reqAfterOpt.length) warnings.push(`Langkah wajib ${reqAfterOpt.map(s => '#' + no(s.id)).join(', ')} bergantung pada langkah opsional; langkah opsional harus diselesaikan atau dilewati (dengan alasan) dulu (RUL-014/015).`);
    return { errors, warnings };
  }
  function diffSteps(oldS, newS) {
    const o = new Map(oldS.map(s => [s.id, s])), n = new Map(newS.map(s => [s.id, s]));
    const added = newS.filter(s => !o.has(s.id)), removed = oldS.filter(s => !n.has(s.id)), changed = [];
    newS.forEach(s => { const a = o.get(s.id); if (!a) return; const f = STEP_FIELDS.filter(([k]) => (k === 'pred' ? a.pred.slice().sort().join() !== s.pred.slice().sort().join() : a[k] !== s[k])).map(x => x[1]); if (f.length) changed.push({ step: s, fields: f }); });
    return { added, removed, changed };
  }
  function simulate(steps, startDate) {
    const A = analyze(steps); if (!steps.length || A.cyc.size || steps.some(s => s.pred.some(p => !A.byId.has(p)))) return null;
    const res = {}; const visit = id => {
      if (res[id]) return res[id]; const s = A.byId.get(id);
      const ps = s.pred.map(visit); const off = ps.length ? Math.max(...ps.map(p => p.end)) : 0;
      return (res[id] = { s, start: off, end: off + Math.max(0, +s.dueDays || 0), from: ps.length ? ps.reduce((a, b) => (b.end > a.end ? b : a)).s.id : null });
    };
    steps.forEach(s => visit(s.id));
    const total = Math.max(...Object.values(res).map(r => r.end)); const crit = new Set();
    let cur = Object.values(res).find(r => r.end === total); while (cur) { crit.add(cur.s.id); cur = cur.from ? res[cur.from] : null; }
    const rows = steps.map(s => { const r = res[s.id]; return { s, offset: r.start, dur: r.end - r.start, start: BGS.addDays(startDate, r.start), end: BGS.addDays(startDate, r.end), critical: crit.has(s.id) }; });
    return { rows, total };
  }

  // =====================================================================================
  //  Flowchart (inline SVG DAG)
  // =====================================================================================
  const ROLE_CLR = { docs: ['#DBEAFE', '#1D4ED8'], medical: ['#CCFBF1', '#0F766E'], visa: ['#FFEDD5', '#C2410C'], departure: ['#DCFCE7', '#15803D'], owner: ['#EDE9FE', '#6D28D9'] };
  const BW = 232, BH = 90, GX = 48, GY = 24, PAD = 18;
  function layout(steps) {
    const A = analyze(steps); const cols = [];
    steps.forEach(s => { (cols[A.lvl[s.id]] = cols[A.lvl[s.id]] || []).push(s); });
    for (let i = 0; i < cols.length; i++) cols[i] = cols[i] || [];
    const row = {};
    cols.forEach((col, ci) => {
      if (ci > 0) { const bary = s => { const r = s.pred.filter(p => row[p] != null).map(p => row[p]); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; }; col.sort((a, b) => bary(a) - bary(b)); }
      col.forEach((s, i) => (row[s.id] = i));
    });
    const maxRows = Math.max(1, ...cols.map(c => c.length)); const H = maxRows * (BH + GY) - GY;
    const pos = {};
    cols.forEach((col, ci) => { const ch = col.length * (BH + GY) - GY; col.forEach((s, i) => (pos[s.id] = { x: PAD + ci * (BW + GX), y: PAD + (H - ch) / 2 + i * (BH + GY) })); });
    return { A, pos, width: PAD * 2 + cols.length * BW + Math.max(0, cols.length - 1) * GX, height: PAD * 2 + H };
  }
  const wrapText = (t, max = 26) => { const words = String(t || '').split(/\s+/); const lines = ['']; words.forEach(w => { const l = lines[lines.length - 1]; if ((l + ' ' + w).trim().length <= max) lines[lines.length - 1] = (l + ' ' + w).trim(); else lines.push(w); }); if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, max - 1) + '…'; } return lines; };
  const pillsOf = s => { const l = [s.required ? ['Wajib', '#FEE2E2', '#991B1B'] : ['Opsional', '#F1F5F9', '#475569']]; if (s.external) l.push(['No. ref', '#FEF3C7', '#92400E']); if (s.consumesQuota) l.push(['Kuota', '#DCFCE7', '#166534']); if (s.verification === 'VERIFY') l.push(['Verifikasi', '#EDE9FE', '#5B21B6']); if (s.verification === 'APPROVE') l.push(['Approval', '#FCE7F3', '#9D174D']); return l; };

  /* opt: {selected:id, onStepClick(step), scale, onScale(n), extra(step)->string} */
  function flowchart(steps, opt = {}) {
    const wrap = h('div', { class: 'wf-chart' });
    if (!steps.length) { wrap.appendChild(ui.emptyState({ icon: 'git-branch', title: 'Belum ada langkah', text: 'Tambahkan langkah untuk melihat diagram alur.' })); return wrap; }
    const L = layout(steps), A = L.A; const id = uid(); const no = {}; steps.forEach((s, i) => (no[s.id] = i + 1));
    const svg = sv('svg', { width: L.width, height: L.height, viewBox: `0 0 ${L.width} ${L.height}`, class: 'wf-svg', role: 'img', 'aria-label': 'Diagram alur langkah template' });
    svg.appendChild(sv('defs', null,
      sv('marker', { id: `wfa${id}`, markerWidth: 9, markerHeight: 9, refX: 8, refY: 4.5, orient: 'auto' }, sv('path', { d: 'M0,0 L9,4.5 L0,9z', fill: '#64748B' })),
      sv('marker', { id: `wfr${id}`, markerWidth: 9, markerHeight: 9, refX: 8, refY: 4.5, orient: 'auto' }, sv('path', { d: 'M0,0 L9,4.5 L0,9z', fill: '#B91C1C' }))));
    const eg = sv('g'), ng = sv('g'); svg.append(eg, ng);
    steps.forEach(s => s.pred.forEach(p => {
      const a = L.pos[p], b = L.pos[s.id]; if (!a || !b) return;
      const bad = A.cyc.has(p) && A.cyc.has(s.id) && A.reaches(s.id, p);
      const x1 = a.x + BW, y1 = a.y + BH / 2, x2 = b.x, y2 = b.y + BH / 2; const dx = x2 > x1 ? Math.max(30, (x2 - x1) / 2) : 90;
      eg.appendChild(sv('path', { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, fill: 'none', stroke: bad ? '#B91C1C' : '#64748B', 'stroke-width': bad ? 2.2 : 1.6, 'stroke-dasharray': bad ? '6 4' : null, 'marker-end': `url(#${bad ? 'wfr' : 'wfa'}${id})` }));
    }));
    steps.forEach(s => {
      const p = L.pos[s.id]; const [fill, stroke] = ROLE_CLR[s.role] || ['#F1F5F9', '#475569']; const sel = opt.selected === s.id;
      const g = sv('g', { class: 'wf-node', transform: `translate(${p.x},${p.y})`, tabindex: 0, role: 'button' });
      g.appendChild(sv('title', null, `${no[s.id]}. ${s.name}\nPeran: ${roleName(s.role)} · tenggat ${s.dueDays} hari\n${s.required ? 'Wajib' : 'Opsional'} · ${VER_LBL[s.verification] || ''}${s.external ? ' · Langkah eksternal (nomor referensi + bukti)' : ''}${s.consumesQuota ? ' · Menghabiskan kuota' : ''}${s.pred.length ? '\nPendahulu: ' + s.pred.map(x => '#' + (no[x] || '?')).join(', ') : '\nLangkah awal'}`));
      g.appendChild(sv('rect', { class: 'wf-box', width: BW, height: BH, rx: 11, fill, stroke: sel ? '#0F172A' : stroke, 'stroke-width': sel ? 3.4 : 1.7, 'stroke-dasharray': s.required ? null : '6 4' }));
      g.appendChild(sv('circle', { cx: 20, cy: 22, r: 12, fill: stroke })); g.appendChild(sv('text', { x: 20, y: 26.5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, fill: '#fff' }, String(no[s.id])));
      wrapText(s.name || '(tanpa nama)').forEach((ln, i) => g.appendChild(sv('text', { x: 40, y: 20 + i * 15, 'font-size': 12.5, 'font-weight': 700, fill: '#0F172A' }, ln)));
      g.appendChild(sv('text', { x: 12, y: 56, 'font-size': 11, fill: '#334155' }, `${roleName(s.role)} · ${s.dueDays} hari`));
      if (opt.extra) g.appendChild(sv('text', { x: BW - 10, y: 56, 'text-anchor': 'end', 'font-size': 10.5, 'font-weight': 700, fill: stroke }, opt.extra(s) || ''));
      let px = 12; pillsOf(s).forEach(([t, bg, fg]) => { const w = t.length * 5.8 + 12; g.appendChild(sv('rect', { x: px, y: 65, width: w, height: 17, rx: 8.5, fill: bg })); g.appendChild(sv('text', { x: px + w / 2, y: 77, 'text-anchor': 'middle', 'font-size': 10, 'font-weight': 800, fill: fg }, t)); px += w + 4; });
      if (opt.onStepClick) { g.addEventListener('click', () => opt.onStepClick(s)); g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.onStepClick(s); } }); }
      ng.appendChild(g);
    });
    let scale = opt.scale || 1; const scroll = h('div', { class: 'wf-scroll' }, svg); const lbl = h('span', { style: 'min-width:42px;text-align:center' });
    const setScale = n => { scale = Math.max(0.4, Math.min(1.6, n)); svg.style.width = L.width * scale + 'px'; svg.style.height = L.height * scale + 'px'; lbl.textContent = Math.round(scale * 100) + '%'; opt.onScale && opt.onScale(scale); };
    wrap.append(h('div', { class: 'wf-zoom' }, h('span', null, opt.onStepClick ? 'Klik langkah untuk memilih · geser untuk menjelajah' : 'Arahkan kursor ke langkah untuk detail · geser untuk menjelajah'), h('span', { class: 'grow' }),
      ui.btn('', { icon: 'chevron-down', sm: true, title: 'Perkecil', onClick: () => setScale(scale - 0.1) }), lbl, ui.btn('', { icon: 'plus', sm: true, title: 'Perbesar', onClick: () => setScale(scale + 0.1) }),
      ui.btn('Muat', { sm: true, title: 'Sesuaikan dengan lebar', onClick: () => setScale((scroll.clientWidth - 6) / L.width) })), scroll);
    setScale(scale);
    if (!opt.scale) requestAnimationFrame(() => { if (scroll.isConnected && scroll.clientWidth && L.width > scroll.clientWidth) setScale(Math.max(0.72, (scroll.clientWidth - 6) / L.width)); });
    wrap.append(h('div', { class: 'wf-legend' },
      Object.keys(ROLE_CLR).map(r => h('span', null, h('i', { style: `background:${ROLE_CLR[r][0]};border-color:${ROLE_CLR[r][1]}` }), roleName(r))),
      h('span', null, h('i', { style: 'background:#fff;border-color:#475569;border-style:dashed' }), 'Garis putus = opsional'),
      pillsOf({ required: true, external: true, consumesQuota: true, verification: 'VERIFY' }).slice(0).concat([['Approval', '#FCE7F3', '#9D174D']]).map(([t, bg, fg]) => h('span', { class: 'wf-pill', style: `background:${bg};color:${fg}` }, t)),
      h('span', { class: 'muted' }, '"No. ref" = langkah eksternal wajib nomor referensi + bukti (BR-033)')));
    return wrap;
  }

  // =====================================================================================
  //  Template actions: new draft, publish
  // =====================================================================================
  function newDraftFrom(t) {
    if (draftOf(t)) return draftOf(t);
    const base = pubOf(t) || t.versions[t.versions.length - 1];
    const v = { v: Math.max(0, ...t.versions.map(x => x.v)) + 1, status: 'DRAFT', publishedAt: null, publishedBy: null, steps: base ? clone(base.steps) : [], basedOn: base ? base.v : null, createdAt: BGS.today.toISOString() };
    t.versions.push(v);
    BGS.audit('Draf versi template dibuat', 'Workflow Template', t.id, `v${v.v} dibuat${base ? ' dari v' + base.v : ''}`);
    return v;
  }
  function showErrors(title, errors, warnings) {
    return ui.modal({ title, size: 'md', body: h('div', { class: 'stack-sm' },
      ui.callout('danger', 'Belum bisa dipublikasikan', 'Perbaiki hal berikut, lalu coba lagi:'),
      h('ul', { class: 'wf-ul' }, errors.map(e => h('li', null, e))),
      warnings && warnings.length ? ui.callout('warn', 'Catatan', h('ul', { class: 'wf-ul' }, warnings.map(e => h('li', null, e)))) : null),
      footer: null });
  }
  function publishFlow(t, ver, after) {
    const val = validate(ver.steps);
    if (val.errors.length) { showErrors(`Validasi gagal — ${t.name} v${ver.v}`, val.errors, val.warnings); return; }
    const prev = pubOf(t); const locked = prev ? casesOf(t, prev.v) : [];
    const d = prev ? diffSteps(prev.steps, ver.steps) : null;
    const m = ui.modal({
      title: `Publish ${t.name} v${ver.v}`, size: 'md',
      body: h('div', { class: 'stack-sm' },
        ui.callout('info', 'Satu versi PUBLISHED per kunci template (RUL-013)', prev ? `v${prev.v} yang sekarang PUBLISHED akan menjadi "Digantikan". Versi PUBLISHED tidak bisa diubah lagi.` : 'Ini akan menjadi versi PUBLISHED pertama untuk kunci ini. Setelah itu Placement Case untuk kunci ini bisa diaktifkan (RUL-011).'),
        prev && ui.callout(locked.length ? 'warn' : 'good', `${locked.length} case berjalan tetap terkunci di v${prev.v} (RUL-012)`, locked.length ? 'Publish tidak mengubah case yang sedang berjalan. Case baru memakai v' + ver.v + '. Untuk memindahkan case lama, gunakan "Migrasi case berjalan" (butuh persetujuan Director).' : 'Tidak ada case berjalan di versi lama.'),
        d && h('div', { class: 'sm' }, h('b', null, 'Perubahan dari v' + prev.v + ': '), `${d.added.length} langkah ditambah, ${d.removed.length} dihapus, ${d.changed.length} diubah.`),
        val.warnings.length ? ui.callout('warn', 'Catatan validasi', h('ul', { class: 'wf-ul' }, val.warnings.map(e => h('li', null, e)))) : null,
        h('p', { class: 'muted sm' }, 'Pastikan urutan langkah sudah dikonfirmasi owner dan konsultan hukum (OQ-03, OQ-04).')),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Publish sekarang', { kind: 'good', icon: 'check', onClick: () => {
        if (prev) prev.status = 'SUPERSEDED';
        ver.status = 'PUBLISHED'; ver.publishedAt = todayISO(); ver.publishedBy = BGS.state.userId;
        BGS.audit('Template dipublikasikan', 'Workflow Template', t.id, `v${ver.v} PUBLISHED${prev ? '; v' + prev.v + ' menjadi SUPERSEDED; ' + locked.length + ' case berjalan tetap di v' + prev.v : ''}`);
        m.close(); ui.toast(`${t.name} v${ver.v} berhasil dipublikasikan`); after && after();
      } })],
    });
  }

  // =====================================================================================
  //  /workflows  — list
  // =====================================================================================
  function newTemplateModal(ctx) {
    const jos = D.jobOrders.filter(j => j.status !== 'CLOSED');
    const form = ui.form({
      cols: 2, submitLabel: 'Buat draf v1', cancel: ui.btn('Batal', { onClick: () => m.close() }),
      fields: [
        { name: 'name', label: 'Nama template', placeholder: 'Kosongkan untuk nama otomatis', span: 2 },
        { name: 'country', label: 'Negara tujuan', type: 'select', options: D.countries.map(c => [c.code, c.name]), required: true },
        { name: 'profession', label: 'Profesi', type: 'select', options: D.professions.map(p => [p.code, p.name]), required: true },
        { name: 'route', label: 'Jalur (opsional)', type: 'select', options: [['', 'Semua jalur (kosong)'], ...D.routes.map(r => [r.id, r.name])], hint: 'Kosong = berlaku untuk semua jalur.' },
        { name: 'jobOrderId', label: 'Job Order spesifik (opsional)', type: 'select', options: [['', 'Tidak spesifik'], ...jos.map(j => [j.id, `${j.id} · ${j.country}-${j.profession}`])], hint: 'Jika diisi, negara/profesi/jalur mengikuti Job Order.' },
      ],
      onSubmit: v => {
        let { country, profession, route, jobOrderId } = v;
        if (jobOrderId) { const j = D.jobOrder(jobOrderId); country = j.country; profession = j.profession; route = j.route; }
        const dup = D.templates.find(t => t.country === country && t.profession === profession && (t.route || '') === (route || '') && (t.jobOrderId || '') === (jobOrderId || ''));
        if (dup) { ui.toast(`Template untuk kunci ini sudah ada: ${dup.name}. Buat versi baru dari template itu.`, 'warn'); return; }
        let id = `WT-${country}-${profession}${route ? '-' + route.replace('RT-', '') : ''}${jobOrderId ? '-' + jobOrderId.slice(-4) : ''}`; let base = id, n = 2; while (D.template(id)) id = base + '-' + n++;
        const t = { id, name: v.name.trim() || `${D.cn(country)} — ${D.pn(profession)}${route ? ' (' + routeName(route) + ')' : ''}${jobOrderId ? ' · ' + jobOrderId : ''}`, country, profession, route: route || null, jobOrderId: jobOrderId || null, versions: [{ v: 1, status: 'DRAFT', publishedAt: null, publishedBy: null, steps: [], createdAt: BGS.today.toISOString() }] };
        D.templates.push(t); BGS.audit('Template dibuat', 'Workflow Template', t.id, 'Draf v1 dibuat untuk ' + keyLabel(t));
        m.close(); ui.toast('Template dibuat sebagai draf v1. Lanjut susun langkahnya.'); BGS.go(`/workflows/${t.id}/edit`);
      },
    });
    const m = ui.modal({ title: 'Template workflow baru', size: 'md', body: h('div', { class: 'stack' }, ui.callout('info', 'Kunci template', 'Satu kunci (Negara + Profesi + Jalur + Job Order) hanya boleh punya satu template. Template baru dimulai sebagai DRAFT v1 dan belum dipakai sampai dipublikasikan (RUL-013).'), form.el) });
  }

  function resolverCard() {
    const st = { country: 'SA', profession: 'DMW', route: '', jo: '' }; const host = h('div', { class: 'stack-sm' });
    const sel = (label, key, opts) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), h('select', { class: 'input', onChange: e => { st[key] = e.target.value; if (key === 'jo' && st.jo) { const j = D.jobOrder(st.jo); st.country = j.country; st.profession = j.profession; st.route = j.route || ''; } draw(); } }, opts.map(([v, l]) => h('option', { value: v, selected: st[key] === v }, l))));
    const draw = () => {
      BGS.clear(host);
      const t = D.findTemplate(st.country, st.profession, st.route || null, st.jo || null);
      const level = !t ? null : (t.jobOrderId && t.jobOrderId === st.jo) ? 1 : (t.route && t.route === st.route) ? 2 : 3;
      const cands = D.templates.filter(x => x.country === st.country && x.profession === st.profession).map(x => ({ x, why: x === t ? 'Dipakai' : !pubOf(x) ? 'Belum ada versi PUBLISHED' : (x.jobOrderId && x.jobOrderId !== st.jo) ? 'Untuk Job Order lain' : (x.route && x.route !== st.route) ? 'Jalur tidak cocok' : 'Kalah prioritas' }));
      host.append(
        h('div', { class: 'form-grid cols-2' },
          sel('Negara', 'country', D.countries.map(c => [c.code, c.name])), sel('Profesi', 'profession', D.professions.map(p => [p.code, p.name])),
          sel('Jalur', 'route', [['', 'Tidak dipilih'], ...D.routes.map(r => [r.id, r.name])]), sel('Job Order', 'jo', [['', 'Tidak dipilih'], ...D.jobOrders.map(j => [j.id, `${j.id} · ${D.partner(j.partnerId) ? D.partner(j.partnerId).name : ''}`])]))
        , t ? ui.callout('good', `Template yang dipakai: ${t.name} v${pubOf(t).v}`, h('span', null, ['Level 1 — Job Order spesifik', 'Level 2 — Negara + Profesi + Jalur', 'Level 3 — Negara + Profesi (jalur kosong)'][level - 1] + '. ', h('a', { class: 'lnk', href: `#/workflows/${t.id}` }, 'Buka template →')))
          : ui.callout('danger', 'Tidak ada template PUBLISHED yang cocok', 'Placement Case untuk kombinasi ini tidak dapat diaktifkan (RUL-011) dan sistem tidak memakai template umum secara diam-diam. Coba pilih jalur yang sesuai, atau minta Superadmin menyusun & mempublikasikan template.'),
        cands.length ? h('div', { class: 'sm' }, h('b', null, 'Kandidat untuk negara + profesi ini'), h('ul', { class: 'wf-ul' }, cands.map(c => h('li', null, h('a', { class: 'lnk', href: `#/workflows/${c.x.id}` }, c.x.name), ` (${c.x.route ? routeName(c.x.route) : 'semua jalur'}${c.x.jobOrderId ? ', ' + c.x.jobOrderId : ''}) — `, h('span', { class: c.why === 'Dipakai' ? 'b' : 'muted' }, c.why))))) : h('div', { class: 'muted sm' }, 'Belum ada template untuk negara + profesi ini.'));
    };
    draw();
    return ui.card({ title: 'Cara pencarian template (RUL-011)', icon: 'search', subtitle: 'Saat Placement Case diaktifkan, sistem memilih template PUBLISHED dengan urutan prioritas berikut.', body: h('div', { class: 'stack' },
      h('ol', { class: 'wf-ul', style: 'margin:0' }, h('li', null, h('b', null, 'Job Order spesifik'), ' — template yang dikunci ke Job Order tersebut.'), h('li', null, h('b', null, 'Negara + Profesi + Jalur'), ' — template yang jalurnya sama dengan lamaran.'), h('li', null, h('b', null, 'Negara + Profesi'), ' — template dengan jalur kosong.')),
      h('div', { class: 'muted sm' }, 'Tidak ada fallback generik: bila tidak ada yang cocok, case tidak bisa diaktifkan.'),
      h('hr', { style: 'border:0;border-top:1px solid var(--line);width:100%;margin:2px 0' }), h('div', { class: 'b' }, 'Coba sendiri'), host) });
  }

  BGS.router.add('/workflows', { title: 'Workflow template', roles: MGMT, mvp: 2, render(ctx) {
    const canW = BGS.can('workflow.write'); const page = ctx.el;
    const nPub = D.templates.filter(pubOf).length, nDraft = D.templates.filter(draftOf).length, nRun = D.cases.filter(isRunning).length; const pend = pendingMig();
    put(page,
      ui.pageHeader({ title: 'Workflow template', mvp: 2, subtitle: 'Alur processing per Negara + Profesi (+ Jalur / Job Order). Hanya Superadmin yang membuat dan mempublikasikan; case berjalan mengunci versinya (RUL-012, RUL-013).',
        actions: canW ? ui.btn('Template baru', { kind: 'primary', icon: 'plus', onClick: () => newTemplateModal(ctx) }) : h('span', { class: 'muted sm', title: 'RUL-013' }, 'Hanya Superadmin yang dapat membuat/mengubah template (RUL-013)') }),
      h('div', { class: 'grid cols-4' },
        ui.kpi({ label: 'Template', value: D.templates.length, sub: 'kunci Negara + Profesi', tone: 'blue', icon: 'git-branch' }),
        ui.kpi({ label: 'Versi PUBLISHED', value: nPub, sub: 'aktif dipakai case baru', tone: 'green', icon: 'check-circle' }),
        ui.kpi({ label: 'Draf', value: nDraft, sub: 'belum dipublikasikan', tone: 'amber', icon: 'edit' }),
        ui.kpi({ label: 'Case berjalan', value: nRun, sub: 'terkunci di versinya', tone: 'orange', icon: 'briefcase' })),
      pend.length ? ui.callout('warn', `${pend.length} permintaan migrasi workflow menunggu persetujuan Director`, h('span', null, 'Migrasi case berjalan wajib disetujui Director (BR-015). ', BGS.can('approval.decide') || BGS.isRole('superadmin') ? h('a', { class: 'lnk', href: '#/approvals' }, 'Buka halaman Persetujuan →') : 'Director yang akan memutuskan.')) : null,
      ui.callout('warn', 'Template awal hanya contoh', 'Daftar tahapan resmi dan posisi SISKO belum dikonfirmasi owner/konsultan hukum (OQ-03, OQ-04). Validasi sebelum dipublikasikan sebagai prosedur resmi.'),
      ui.card({ title: 'Daftar template', icon: 'layers', flush: true, body: ui.listView({
        items: () => D.templates, search: t => `${t.name} ${t.id} ${keyChips(t).join(' ')}`, searchPlaceholder: 'Cari template, negara, profesi…',
        filters: [{ key: 'country', label: 'Negara', options: D.countries.map(c => [c.code, c.name]) }, { key: 'state', label: 'Status', options: [['PUBLISHED', 'Ada versi PUBLISHED'], ['DRAFT', 'Ada draf'], ['NOPUB', 'Belum ada PUBLISHED']], match: (t, v) => (v === 'PUBLISHED' ? !!pubOf(t) : v === 'DRAFT' ? !!draftOf(t) : !pubOf(t)) }],
        pageSize: 8, onRowClick: t => BGS.go('/workflows/' + t.id),
        columns: [
          { key: 'name', label: 'Template', sortable: true, render: t => h('div', null, h('a', { class: 'lnk', href: `#/workflows/${t.id}` }, t.name), h('div', { class: 'muted xs mono' }, t.id)) },
          { key: 'key', label: 'Kunci', render: t => h('div', { class: 'row wrap gap-sm' }, keyChips(t).map(c => h('span', { class: 'chip static' }, c))) },
          { key: 'versions', label: 'Versi', render: t => h('div', { class: 'row wrap gap-sm' }, t.versions.slice().sort((a, b) => b.v - a.v).map(v => h('a', { href: `#/workflows/${t.id}?v=${v.v}`, title: `Lihat v${v.v}`, style: 'text-decoration:none' }, ui.badge(`v${v.v} · ${BGS.ST.template[v.status][0]}`, BGS.ST.template[v.status][1], { dot: true })))) },
          { key: 'run', label: 'Case berjalan / versi', render: t => { const parts = t.versions.map(v => [v.v, casesOf(t, v.v).length]).filter(x => x[1]); return parts.length ? h('div', { class: 'row wrap gap-sm' }, parts.map(([v, n]) => h('span', { class: 'chip static' }, `v${v}: ${n}`))) : h('span', { class: 'muted' }, '—'); } },
          { key: 'last', label: 'Terakhir dipublikasikan', sortValue: t => (t.versions.map(v => v.publishedAt).filter(Boolean).sort().pop() || ''), sortable: true, render: t => { const v = t.versions.filter(x => x.publishedAt).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0]; return v ? h('div', null, BGS.fmt.date(v.publishedAt), h('div', { class: 'muted xs' }, `v${v.v} · ${(D.user(v.publishedBy) || {}).name || '—'}`)) : h('span', { class: 'muted' }, 'Belum pernah'); } },
        ] }) }),
      resolverCard());
  } });

  // =====================================================================================
  //  Migration wizard (BR-015, RUL-012)
  // =====================================================================================
  function migPlan(c, toSteps) {
    const toIds = new Set(toSteps.map(s => s.id)), have = new Set(c.steps.map(x => x.stepId));
    const notStarted = x => ['LOCKED', 'READY'].includes(x.status);
    return { kept: c.steps.filter(x => toIds.has(x.stepId)), added: toSteps.filter(s => !have.has(s.id)), cancelled: c.steps.filter(x => !toIds.has(x.stepId) && notStarted(x)), history: c.steps.filter(x => !toIds.has(x.stepId) && !notStarted(x)) };
  }
  function migrationWizard(t, ctx) {
    const target = pubOf(t);
    if (!target) { ui.modal({ title: 'Migrasi case berjalan', size: 'sm', body: ui.callout('warn', 'Belum ada versi PUBLISHED', 'Migrasi hanya bisa menuju versi PUBLISHED. Publish sebuah draf terlebih dahulu.') }); return; }
    const inPending = new Set(pendingMig().flatMap(a => (a.payload && a.payload.caseIds) || []));
    const fromOpts = t.versions.filter(v => v.v !== target.v && casesOf(t, v.v).length);
    const S = { step: 0, from: fromOpts.length ? fromOpts[fromOpts.length - 1].v : null, sel: new Set(), reason: '' };
    const body = h('div'), foot = h('div', { class: 'row gap-sm', style: 'justify-content:flex-end;width:100%' });
    const m = ui.modal({ title: `Migrasi case berjalan — ${t.name}`, size: 'xl', body, footer: foot });
    const reset = () => { S.sel = new Set(casesOf(t, S.from).filter(c => !inPending.has(c.id)).map(c => c.id)); };
    if (S.from != null) reset();
    const stepsOfSel = () => casesOf(t, S.from).filter(c => S.sel.has(c.id));
    const draw = () => {
      BGS.clear(body); BGS.clear(foot);
      body.appendChild(ui.stepper(['Pilih case', 'Tinjau perubahan', 'Alasan & kirim'], S.step));
      if (S.from == null) {
        body.appendChild(ui.emptyState({ icon: 'git-branch', title: 'Tidak ada case berjalan di versi lama', text: `Semua case berjalan sudah memakai v${target.v} (PUBLISHED). Setelah versi baru dipublikasikan, case yang masih di versi sebelumnya akan muncul di sini.` }));
        foot.appendChild(ui.btn('Tutup', { onClick: () => m.close() })); return;
      }
      if (S.step === 0) {
        const cs = casesOf(t, S.from);
        body.append(h('div', { class: 'stack' },
          ui.callout('info', 'Migrasi bukan otomatis', `Case yang dipilih dipindahkan dari v${S.from} ke v${target.v} (PUBLISHED) hanya setelah Director menyetujui (BR-015). Sebelum disetujui, semua case tetap berjalan di versi lamanya (RUL-012).`),
          h('div', { class: 'row wrap' }, h('label', { class: 'field', style: 'min-width:220px' }, h('span', { class: 'lbl' }, 'Dari versi'), h('select', { class: 'input', onChange: e => { S.from = +e.target.value; reset(); draw(); } }, fromOpts.map(v => h('option', { value: v.v, selected: v.v === S.from }, `v${v.v} (${BGS.ST.template[v.status][0]}) — ${casesOf(t, v.v).length} case`)))),
            h('div', { class: 'b' }, BGS.icon('arrow-right', 18)), h('div', null, h('div', { class: 'lbl' }, 'Ke versi'), ui.badge(`v${target.v} · PUBLISHED`, 'green', { dot: true }))),
          h('div', { class: 'row' }, ui.btn('Pilih semua', { sm: true, onClick: () => { S.sel = new Set(cs.filter(c => !inPending.has(c.id)).map(c => c.id)); draw(); } }), ui.btn('Kosongkan', { sm: true, onClick: () => { S.sel.clear(); draw(); } }), h('span', { class: 'muted sm' }, `${S.sel.size} dari ${cs.length} case dipilih`)),
          ui.table({ pageSize: 8, dense: true, rows: cs, columns: [
            { key: 'pick', label: '', width: '36px', render: c => h('input', { type: 'checkbox', checked: S.sel.has(c.id), disabled: inPending.has(c.id), onChange: e => { e.target.checked ? S.sel.add(c.id) : S.sel.delete(c.id); draw(); } }) },
            { key: 'id', label: 'Case', render: c => h('span', { class: 'mono' }, c.id) }, { key: 'w', label: 'Worker', render: c => (D.worker(c.workerId) || {}).name },
            { key: 'st', label: 'Status', render: c => ui.status('case', c.status) },
            { key: 'pr', label: 'Progres', render: c => { const d = c.steps.filter(x => x.status === 'COMPLETED').length; return h('div', { class: 'row gap-sm' }, ui.progress(BGS.fmt.pct(d, c.steps.length).replace('%', ''), 'green'), h('span', { class: 'xs nowrap' }, `${d}/${c.steps.length}`)); } },
            { key: 'note', label: '', render: c => inPending.has(c.id) ? ui.badge('Sudah diajukan', 'amber') : null },
          ] })));
        foot.append(ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Lanjut: tinjau perubahan', { kind: 'primary', disabled: !S.sel.size, title: S.sel.size ? '' : 'Pilih minimal satu case', onClick: () => { S.step = 1; draw(); } }));
      } else if (S.step === 1) {
        const fromV = verOf(t, S.from); const d = diffSteps(fromV.steps, target.steps); const plans = stepsOfSel().map(c => [c, migPlan(c, target.steps)]);
        const sum = k => plans.reduce((a, [, p]) => a + p[k].length, 0);
        const risky = plans.filter(([, p]) => p.history.some(x => x.status === 'IN_PROGRESS'));
        body.append(h('div', { class: 'stack' },
          h('div', { class: 'wf-diff' },
            h('div', { class: 'wf-dbox' }, h('div', { class: 'n', style: 'color:var(--green)' }, sum('kept')), h('div', { class: 'b sm' }, 'Dipertahankan'), h('div', { class: 'muted xs' }, 'Status & bukti langkah tetap')),
            h('div', { class: 'wf-dbox' }, h('div', { class: 'n', style: 'color:var(--blue)' }, sum('added')), h('div', { class: 'b sm' }, 'Ditambahkan'), h('div', { class: 'muted xs' }, 'Langkah baru dari versi tujuan')),
            h('div', { class: 'wf-dbox' }, h('div', { class: 'n', style: 'color:var(--red)' }, sum('cancelled')), h('div', { class: 'b sm' }, 'Dibatalkan'), h('div', { class: 'muted xs' }, 'Dihapus & belum mulai → CANCELLED')),
            h('div', { class: 'wf-dbox' }, h('div', { class: 'n', style: 'color:#64748B' }, sum('history')), h('div', { class: 'b sm' }, 'Tetap sebagai riwayat'), h('div', { class: 'muted xs' }, 'Dihapus tapi sudah dikerjakan'))),
          ui.callout('info', 'Aturan migrasi (RUL-012)', 'Langkah selesai dipertahankan · langkah baru ditambahkan · langkah yang dihapus dan belum mulai dibatalkan · langkah yang dihapus tapi sudah dikerjakan tetap tersimpan sebagai riwayat. Langkah dicocokkan berdasarkan ID langkah.'),
          risky.length ? ui.callout('warn', `${risky.length} case punya langkah yang sedang dikerjakan lalu dihapus di v${target.v}`, 'Langkah tersebut tetap sebagai riwayat dan tidak lagi menjadi syarat. Pastikan PIC-nya diberi tahu.') : null,
          plans.filter(([c, p]) => ['FINAL_VERIFICATION', 'READY_TO_DEPART'].includes(c.status) && p.added.length).length ? ui.callout('warn', 'Ada case di tahap akhir yang mendapat langkah baru', 'Case berstatus Verifikasi akhir / Siap berangkat akan memiliki langkah baru yang belum selesai; langkah wajib harus diselesaikan sebelum final verification lolos (RUL-018).') : null,
          h('div', { class: 'grid cols-3' },
            ui.card({ title: `Ditambahkan di v${target.v}`, body: d.added.length ? h('ul', { class: 'wf-ul' }, d.added.map(s => h('li', null, s.name))) : h('span', { class: 'muted' }, 'Tidak ada') }),
            ui.card({ title: `Dihapus dari v${S.from}`, body: d.removed.length ? h('ul', { class: 'wf-ul' }, d.removed.map(s => h('li', null, s.name))) : h('span', { class: 'muted' }, 'Tidak ada') }),
            ui.card({ title: 'Diubah', body: d.changed.length ? h('ul', { class: 'wf-ul' }, d.changed.map(c => h('li', null, c.step.name, h('span', { class: 'muted xs' }, ' — ' + c.fields.join(', '))))) : h('span', { class: 'muted' }, 'Tidak ada') })),
          ui.table({ pageSize: 6, dense: true, rows: plans, columns: [
            { key: 'c', label: 'Case', render: ([c]) => h('span', { class: 'mono' }, c.id) }, { key: 'w', label: 'Worker', render: ([c]) => (D.worker(c.workerId) || {}).name },
            { key: 'k', label: 'Dipertahankan', align: 'center', render: ([, p]) => p.kept.length }, { key: 'a', label: 'Ditambahkan', align: 'center', render: ([, p]) => p.added.length ? ui.badge('+' + p.added.length, 'blue') : 0 },
            { key: 'x', label: 'Dibatalkan', align: 'center', render: ([, p]) => p.cancelled.length ? ui.badge(p.cancelled.length, 'red') : 0 }, { key: 'r', label: 'Riwayat', align: 'center', render: ([, p]) => p.history.length || 0 },
          ] })));
        foot.append(ui.btn('Kembali', { onClick: () => { S.step = 0; draw(); } }), ui.btn('Lanjut: alasan', { kind: 'primary', onClick: () => { S.step = 2; draw(); } }));
      } else {
        const ta = h('textarea', { class: 'input', rows: 3, placeholder: 'Mis. Menambah langkah BASMA sesuai prosedur terbaru…', onInput: e => (S.reason = e.target.value) }, S.reason);
        const err = h('div', { class: 'field-err', style: 'display:none' }, 'Alasan wajib diisi (RUL-022).');
        body.append(h('div', { class: 'stack' },
          ui.callout('warn', 'Permintaan akan dikirim ke Director', `${S.sel.size} case: v${S.from} → v${target.v}. Migrasi baru dijalankan setelah Director menyetujui; semuanya tercatat di audit (BR-015).`),
          ui.kv([['Template', t.name], ['Dari → ke', `v${S.from} → v${target.v}`], ['Jumlah case', S.sel.size], ['Diajukan oleh', (BGS.user() || {}).name]]),
          h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Alasan migrasi', h('i', { class: 'req' }, '*')), ta, err)));
        foot.append(ui.btn('Kembali', { onClick: () => { S.step = 1; draw(); } }), ui.btn('Kirim ke Director', { kind: 'primary', icon: 'send', onClick: () => {
          if (!S.reason.trim()) { err.style.display = 'block'; return; }
          const ids = stepsOfSel().map(c => c.id); const n = D.approvals.length + 1;
          const ap = { id: 'AP-' + pad(n, 3), type: 'MIGRASI_WORKFLOW', title: `Migrasi ${ids.length} case berjalan ${keyLabel(t)} dari v${S.from} ke v${target.v}`, subject: t.id, requestedBy: BGS.state.userId, at: BGS.today.toISOString(), reason: S.reason.trim(), status: 'PENDING', expires: BGS.addDays(BGS.today, 3).toISOString(), payload: { templateId: t.id, fromV: S.from, toV: target.v, caseIds: ids } };
          D.approvals.unshift(ap);
          BGS.audit('Permintaan migrasi workflow', 'Workflow Template', t.id, `${ids.length} case v${S.from}→v${target.v}; alasan: ${ap.reason}`);
          BGS.notify('U03', `Permintaan persetujuan: Migrasi workflow ${keyLabel(t)} (${ids.length} case)`, '#/approvals', 'APPROVAL');
          m.close(); ui.toast('Permintaan migrasi dikirim ke Director'); ctx.refresh();
        } }));
      }
    };
    draw();
  }

  // =====================================================================================
  //  /workflows/:id  — detail
  // =====================================================================================
  BGS.router.add('/workflows/:id', { title: 'Detail workflow', roles: MGMT, mvp: 2, render(ctx) {
    const page = ctx.el; const t = D.template(ctx.params.id);
    if (!t) { page.append(ui.pageHeader({ title: 'Template tidak ditemukan', breadcrumbs: [{ label: 'Workflow template', href: '/workflows' }, { label: ctx.params.id }] }), ui.emptyState({ icon: 'git-branch', title: 'Template tidak ditemukan', text: 'ID template tidak dikenal.', action: h('a', { class: 'btn btn-primary', href: '#/workflows' }, 'Kembali ke daftar') })); return; }
    const canW = BGS.can('workflow.write');
    const ver = (ctx.query.v && verOf(t, +ctx.query.v)) || pubOf(t) || draftOf(t) || t.versions[t.versions.length - 1];
    const pub = pubOf(t), draft = draftOf(t); const pend = pendingMig().filter(a => a.subject === t.id);
    const actions = [];
    if (canW) {
      actions.push(ui.btn('Buat draf versi baru', { icon: 'copy', disabled: !!draft, title: draft ? `Sudah ada draf v${draft.v}. Edit atau publish draf itu dulu.` : 'Salin versi PUBLISHED menjadi draf baru', onClick: () => { const d = newDraftFrom(t); ui.toast(`Draf v${d.v} dibuat. Silakan edit.`); BGS.go(`/workflows/${t.id}/edit`); } }));
      if (draft) actions.push(h('a', { class: 'btn', href: `#/workflows/${t.id}/edit` }, BGS.icon('edit', 16), `Edit draf v${draft.v}`));
      if (draft) actions.push(ui.btn(`Publish v${draft.v}`, { kind: 'good', icon: 'check', onClick: () => publishFlow(t, draft, () => ctx.go(`/workflows/${t.id}?v=${draft.v}`) || ctx.refresh()) }));
      actions.push(ui.btn('Migrasi case berjalan', { icon: 'git-branch', onClick: () => migrationWizard(t, ctx) }));
    }
    const runByV = t.versions.map(v => [v, casesOf(t, v.v)]);
    put(page,
      ui.pageHeader({ title: t.name, mvp: 2, breadcrumbs: [{ label: 'Workflow template', href: '/workflows' }, { label: t.id }], subtitle: undefined, actions }),
      h('div', { class: 'row wrap gap-sm' }, keyChips(t).map(c => h('span', { class: 'chip static' }, c)), h('span', { class: 'muted sm' }, 'Kunci template · ' + keyLabel(t))),
      !canW ? ui.callout('info', 'Mode baca saja', `Peran ${BGS.roles[BGS.role()]} hanya dapat melihat. Hanya Superadmin yang membuat, mengubah draf, dan mempublikasikan template (RUL-013).`) : null,
      pend.length ? ui.callout('warn', `${pend.length} permintaan migrasi menunggu Director`, h('span', null, pend.map(a => a.title).join('; ') + '. ', BGS.isRole('director', 'superadmin') ? h('a', { class: 'lnk', href: '#/approvals' }, 'Buka Persetujuan →') : null)) : null,
      // versions + RUL-012
      ui.card({ title: 'Versi & case berjalan', icon: 'layers', subtitle: 'Case berjalan terkunci pada versi tempat ia dimulai (RUL-012).', flush: true, body: h('div', null,
        h('div', { style: 'padding:14px 18px 0' }, ui.callout(runByV.some(([, c]) => c.length) ? 'info' : 'good', 'Publish tidak mengubah case yang sedang berjalan', runByV.filter(([, c]) => c.length).length ? runByV.filter(([, c]) => c.length).map(([v, c]) => `${c.length} case berjalan terkunci di v${v.v}`).join(' · ') + '. Pindah versi hanya lewat Migrasi (butuh persetujuan Director, BR-015).' : 'Belum ada case berjalan memakai template ini.')),
        ui.table({ pageSize: 10, rows: t.versions.slice().sort((a, b) => b.v - a.v), columns: [
          { key: 'v', label: 'Versi', render: v => h('b', null, 'v' + v.v) }, { key: 'status', label: 'Status', render: v => ui.status('template', v.status) },
          { key: 'pub', label: 'Dipublikasikan', render: v => v.publishedAt ? h('div', null, BGS.fmt.date(v.publishedAt), h('div', { class: 'muted xs' }, (D.user(v.publishedBy) || {}).name || '')) : h('span', { class: 'muted' }, '—') },
          { key: 'n', label: 'Langkah', align: 'center', render: v => v.steps.length },
          { key: 'run', label: 'Case berjalan', render: v => { const c = casesOf(t, v.v); return c.length ? h('div', { class: 'row wrap gap-sm' }, h('b', null, c.length), c.slice(0, 3).map(x => ui.caseLink(x.id)), c.length > 3 ? h('span', { class: 'muted xs' }, `+${c.length - 3}`) : null) : h('span', { class: 'muted' }, '0'); } },
          { key: 'all', label: 'Total case', align: 'center', render: v => casesOf(t, v.v, false).length },
          { key: 'a', label: '', render: v => v.v === ver.v ? ui.badge('Sedang dilihat', 'blue') : ui.btn('Lihat', { sm: true, onClick: () => ctx.go(`/workflows/${t.id}?v=${v.v}`) }) },
        ] }))
      }),
      // chart
      ui.card({ title: `Diagram alur — v${ver.v}`, icon: 'git-branch', actions: ui.status('template', ver.status), subtitle: ver.status === 'DRAFT' ? 'Draf belum dipakai case mana pun. Superadmin dapat mengeditnya.' : ver.status === 'SUPERSEDED' ? 'Versi lama (hanya untuk case yang masih terkunci di versi ini).' : 'Versi PUBLISHED: tidak bisa diubah (RUL-013).', body: flowchart(ver.steps) }),
      // draft vs published diff
      ver.status === 'DRAFT' && pub ? (() => { const d = diffSteps(pub.steps, ver.steps); return ui.card({ title: `Perbedaan v${ver.v} dengan v${pub.v} (PUBLISHED)`, icon: 'refresh', body: (d.added.length + d.removed.length + d.changed.length) ? h('div', { class: 'grid cols-3' },
        h('div', null, h('b', { class: 'sm' }, `Ditambah (${d.added.length})`), h('ul', { class: 'wf-ul' }, d.added.map(s => h('li', null, s.name)))), h('div', null, h('b', { class: 'sm' }, `Dihapus (${d.removed.length})`), h('ul', { class: 'wf-ul' }, d.removed.map(s => h('li', null, s.name)))),
        h('div', null, h('b', { class: 'sm' }, `Diubah (${d.changed.length})`), h('ul', { class: 'wf-ul' }, d.changed.map(c => h('li', null, c.step.name, h('span', { class: 'muted xs' }, ' — ' + c.fields.join(', '))))))) : h('span', { class: 'muted' }, 'Draf sama dengan versi PUBLISHED.') }); })() : null,
      // steps table
      ui.card({ title: `Daftar langkah — v${ver.v}`, icon: 'list', flush: true, body: ui.table({ pageSize: 20, rows: ver.steps.map((s, i) => Object.assign({ no: i + 1 }, s)), empty: ui.emptyState({ icon: 'list', title: 'Belum ada langkah', text: canW && ver.status === 'DRAFT' ? 'Buka editor untuk menambah langkah.' : '' }), columns: [
        { key: 'no', label: '#', width: '44px' }, { key: 'name', label: 'Nama langkah', render: s => h('b', null, s.name) },
        { key: 'required', label: 'Wajib?', render: s => s.required ? ui.badge('Wajib', 'red') : ui.badge('Opsional', 'gray') },
        { key: 'role', label: 'Peran PIC', render: s => ui.badge(roleName(s.role), ({ docs: 'blue', medical: 'teal', visa: 'orange', departure: 'green', owner: 'purple' })[s.role] || 'gray') },
        { key: 'dueDays', label: 'Tenggat', render: s => `${s.dueDays} hari` },
        { key: 'pred', label: 'Pendahulu', render: s => s.pred.length ? s.pred.map(p => '#' + (ver.steps.findIndex(x => x.id === p) + 1)).join(', ') : h('span', { class: 'muted' }, 'Langkah awal') },
        { key: 'verification', label: 'Verifikasi', render: s => s.verification === 'NONE' ? h('span', { class: 'muted' }, '—') : ui.badge(VER_LBL[s.verification], s.verification === 'APPROVE' ? 'pink' : 'purple') },
        { key: 'external', label: 'Eksternal', render: s => s.external ? ui.badge('No. ref + bukti', 'amber') : h('span', { class: 'muted' }, '—') },
        { key: 'consumesQuota', label: 'Kuota', render: s => s.consumesQuota ? ui.badge('Menghabiskan kuota', 'green') : h('span', { class: 'muted' }, '—') },
      ] }) }),
      h('div', { class: 'muted sm' }, 'Pencarian template saat case diaktifkan mengikuti RUL-011 — ', h('a', { class: 'lnk', href: '#/workflows' }, 'lihat penjelasan dan alat pencocokan di daftar template'), '.'));
  } });

  // =====================================================================================
  //  /workflows/:id/edit — builder (superadmin)
  // =====================================================================================
  BGS.router.add('/workflows/:id/edit', { title: 'Editor workflow', roles: ['superadmin'], mvp: 2, render(ctx) {
    const page = ctx.el; const t = D.template(ctx.params.id);
    if (!t) { page.append(ui.emptyState({ icon: 'git-branch', title: 'Template tidak ditemukan', action: h('a', { class: 'btn btn-primary', href: '#/workflows' }, 'Kembali ke daftar') })); return; }
    const draft = draftOf(t);
    if (!draft) { ui.toast('Template ini belum punya draf. Buat draf versi baru lebih dulu.', 'warn'); ctx.go('/workflows/' + t.id); return; }
    const ws = { steps: clone(draft.steps), sel: 0, dirty: false, sim: todayISO(), scale: null };
    const no = id => ws.steps.findIndex(s => s.id === id) + 1;
    const listBox = h('div', { class: 'stack-sm' }), formBox = h('div'), chartBox = h('div'), valBox = h('div'), simBox = h('div');
    const dirtyBadge = h('span'); const drawDirty = () => { BGS.clear(dirtyBadge); dirtyBadge.appendChild(ws.dirty ? ui.badge('Belum disimpan', 'amber', { dot: true }) : ui.badge('Tersimpan', 'green', { dot: true })); };
    const touch = () => { ws.dirty = true; drawDirty(); drawList(); drawChart(); drawVal(); drawSim(); };
    const select = i => { ws.sel = i; drawList(); drawForm(); drawChart(); };

    function drawList() {
      BGS.clear(listBox);
      if (!ws.steps.length) { listBox.appendChild(h('div', { class: 'muted sm' }, 'Belum ada langkah.')); return; }
      ws.steps.forEach((s, i) => listBox.appendChild(h('div', { class: 'wf-li' + (i === ws.sel ? ' on' : ''), onClick: () => select(i) },
        h('span', { class: 'wf-n' }, i + 1), h('div', { class: 'wf-t' }, h('b', null, s.name || '(tanpa nama)'), h('span', { class: 'muted xs' }, `${roleName(s.role)} · ${s.dueDays} hari${s.required ? '' : ' · opsional'}${s.consumesQuota ? ' · kuota' : ''}${s.pred.length ? ' · ← ' + s.pred.map(p => '#' + no(p)).join(',') : ''}`)),
        h('div', { class: 'row gap-sm' },
          h('button', { class: 'icon-btn sm', title: 'Naikkan', disabled: i === 0, onClick: e => { e.stopPropagation(); [ws.steps[i - 1], ws.steps[i]] = [ws.steps[i], ws.steps[i - 1]]; ws.sel = i - 1; touch(); drawForm(); } }, BGS.icon('arrow-up', 14)),
          h('button', { class: 'icon-btn sm', title: 'Turunkan', disabled: i === ws.steps.length - 1, onClick: e => { e.stopPropagation(); [ws.steps[i + 1], ws.steps[i]] = [ws.steps[i], ws.steps[i + 1]]; ws.sel = i + 1; touch(); drawForm(); } }, BGS.icon('arrow-down', 14)),
          h('button', { class: 'icon-btn sm', title: 'Hapus langkah', onClick: async e => { e.stopPropagation(); if (!await ui.confirm({ title: 'Hapus langkah', message: `Hapus langkah #${i + 1} "${s.name}"? Langkah lain yang bergantung padanya akan kehilangan pendahulu ini.`, confirmLabel: 'Hapus', tone: 'danger' })) return; ws.steps.splice(i, 1); ws.steps.forEach(x => (x.pred = x.pred.filter(p => p !== s.id))); ws.sel = Math.max(0, Math.min(ws.sel, ws.steps.length - 1)); touch(); drawForm(); } }, BGS.icon('trash', 14))))));
    }
    function addStep() {
      const n = Math.max(0, ...ws.steps.map(s => parseInt(String(s.id).replace(/\D/g, '')) || 0)) + 1; const last = ws.steps[ws.steps.length - 1];
      ws.steps.push({ id: 's' + n, name: 'Langkah baru', role: 'docs', dueDays: 3, pred: last ? [last.id] : [], required: true, verification: 'NONE', external: false, consumesQuota: false });
      ws.sel = ws.steps.length - 1; touch(); drawForm();
    }
    function descendants(id) { const A = analyze(ws.steps); const seen = new Set(); const st = [id]; while (st.length) { const x = st.pop(); (A.succ[x] || []).forEach(y => { if (!seen.has(y)) { seen.add(y); st.push(y); } }); } return seen; }

    function drawForm() {
      BGS.clear(formBox);
      const s = ws.steps[ws.sel];
      if (!s) { formBox.appendChild(ui.emptyState({ icon: 'plus', title: 'Mulai dengan menambah langkah', text: 'Langkah pertama biasanya tanpa pendahulu.', action: ui.btn('Tambah langkah', { kind: 'primary', icon: 'plus', onClick: addStep }) })); return; }
      const fName = ui.field({ name: 'wf_name', label: 'Nama langkah', value: s.name, required: true }); fName.input.addEventListener('input', e => { s.name = e.target.value; touch(); drawPreds(); });
      const fRole = ui.field({ name: 'wf_role', label: 'Peran PIC pelaksana', type: 'select', options: Object.entries(D.picByStepRole), value: s.role, hint: 'Peran PIC yang mengerjakan tugas ini.' }); fRole.input.addEventListener('change', e => { s.role = e.target.value; touch(); });
      const fDue = ui.field({ name: 'wf_due', label: 'Tenggat (hari)', type: 'number', value: s.dueDays, hint: 'Hari kalender sejak semua pendahulu selesai.' }); fDue.input.min = 1; fDue.input.addEventListener('input', e => { s.dueDays = parseInt(e.target.value) || 0; touch(); });
      const fVer = ui.field({ name: 'wf_ver', label: 'Verifikasi', type: 'select', options: [['NONE', 'Tanpa verifikasi'], ['VERIFY', 'Perlu verifikasi (maker-checker)'], ['APPROVE', 'Perlu approval']], value: s.verification, hint: 'Pelaksana tidak boleh memverifikasi tugasnya sendiri (RUL-016).' }); fVer.input.addEventListener('change', e => { s.verification = e.target.value; touch(); });
      const fReq = ui.field({ name: 'wf_req', label: 'Langkah wajib', type: 'checkbox', value: s.required, hint: 'Wajib tidak boleh dilewati. Opsional boleh dilewati dengan alasan (RUL-015).' }); fReq.input.addEventListener('change', e => { s.required = e.target.checked; touch(); });
      const fExt = ui.field({ name: 'wf_ext', label: 'Langkah eksternal (wajib nomor referensi + bukti)', type: 'checkbox', value: s.external, hint: 'Hasil dari sistem pemerintah/pihak luar dicatat manual (BR-033).' }); fExt.input.addEventListener('change', e => { s.external = e.target.checked; touch(); });
      const other = ws.steps.find(x => x !== s && x.consumesQuota);
      const fQ = ui.field({ name: 'wf_q', label: 'Menghabiskan kuota saat selesai', type: 'checkbox', value: s.consumesQuota, readonly: !!other && !s.consumesQuota, hint: other ? `Sudah dipakai langkah #${no(other.id)} — hanya satu langkah boleh menghabiskan kuota.` : 'Kuota berubah dari Dicadangkan menjadi Terpakai saat langkah ini selesai (RUL-005).' }); fQ.input.addEventListener('change', e => { s.consumesQuota = e.target.checked; touch(); drawForm(); });
      const predBox = h('div', { class: 'stack-sm' }); const drawPreds = () => {
        BGS.clear(predBox); const desc = descendants(s.id); const others = ws.steps.filter(x => x !== s);
        if (!others.length) { predBox.appendChild(h('div', { class: 'muted sm' }, 'Belum ada langkah lain.')); return; }
        others.forEach(o => { const dis = desc.has(o.id) && !s.pred.includes(o.id); predBox.appendChild(h('label', { class: 'wf-pick' + (dis ? ' dis' : ''), title: dis ? 'Akan membuat putaran (siklus)' : '' }, h('input', { type: 'checkbox', checked: s.pred.includes(o.id), disabled: dis, onChange: e => { s.pred = e.target.checked ? [...s.pred, o.id] : s.pred.filter(p => p !== o.id); touch(); drawPreds(); } }), h('span', { class: 'b' }, '#' + no(o.id)), h('span', null, o.name || '(tanpa nama)'), dis ? h('span', { class: 'muted xs' }, '(akan membuat putaran)') : null)); });
      };
      drawPreds();
      formBox.append(h('div', { class: 'stack' }, h('div', { class: 'b' }, `Langkah #${ws.sel + 1}`), h('div', { class: 'form-grid cols-2' }, Object.assign(fName, {}), fRole, fDue, fVer),
        h('div', { class: 'stack-sm' }, fReq, fExt, fQ),
        h('div', null, h('div', { class: 'lbl', style: 'margin-bottom:6px' }, 'Pendahulu (harus selesai/dilewati dulu — RUL-014)'), h('div', { class: 'muted xs', style: 'margin-bottom:6px' }, 'Tanpa pendahulu = langkah awal (terbuka sejak case aktif). Boleh beberapa pendahulu.'), predBox)));
      fName.classList.add('span-2');
    }

    function drawChart() {
      const old = chartBox.querySelector('.wf-scroll'); const sl = old ? [old.scrollLeft, old.scrollTop] : null; BGS.clear(chartBox);
      const cur = ws.steps[ws.sel];
      chartBox.appendChild(flowchart(ws.steps, { selected: cur && cur.id, scale: ws.scale, onScale: n => (ws.scale = n), onStepClick: s => select(ws.steps.indexOf(s)) }));
      const nu = chartBox.querySelector('.wf-scroll'); if (sl && nu) { nu.scrollLeft = sl[0]; nu.scrollTop = sl[1]; }
    }
    function drawVal() {
      BGS.clear(valBox); const v = validate(ws.steps);
      valBox.appendChild(h('div', { class: 'stack-sm' },
        v.errors.length ? ui.callout('danger', `${v.errors.length} masalah harus diperbaiki sebelum publish`, h('ul', { class: 'wf-ul' }, v.errors.map(e => h('li', null, e)))) : ui.callout('good', 'Lolos validasi', 'Ada langkah awal, tidak ada putaran/langkah yatim, dan paling banyak satu langkah kuota. Siap dipublikasikan.'),
        v.warnings.length ? ui.callout('warn', 'Catatan (tidak memblokir)', h('ul', { class: 'wf-ul' }, v.warnings.map(e => h('li', null, e)))) : null,
        h('div', { class: 'muted xs' }, 'Aturan validasi: minimal 1 langkah · tanpa putaran · minimal 1 langkah awal · maksimal 1 langkah kuota · tiap langkah punya nama & tenggat ≥ 1 hari.')));
    }
    function drawSim() {
      BGS.clear(simBox);
      const start = new Date(ws.sim + 'T00:00:00'); const r = simulate(ws.steps, isNaN(start) ? BGS.today : start);
      const dateIn = h('input', { class: 'input', type: 'date', value: ws.sim, style: 'max-width:180px', onChange: e => { if (e.target.value) { ws.sim = e.target.value; drawSim(); } } });
      simBox.append(h('div', { class: 'stack' }, h('div', { class: 'row wrap' }, h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Tanggal case diaktifkan'), dateIn), r ? h('div', null, h('div', { class: 'lbl' }, 'Perkiraan selesai'), h('b', null, BGS.fmt.date(BGS.addDays(start, r.total))), h('div', { class: 'muted xs' }, `${r.total} hari kalender di jalur terpanjang`)) : null),
        !r ? ui.callout('warn', 'Simulasi belum bisa dihitung', ws.steps.length ? 'Perbaiki putaran/pendahulu yang tidak valid dulu.' : 'Tambahkan langkah terlebih dahulu.')
          : ui.table({ pageSize: 30, dense: true, rows: r.rows, columns: [
            { key: 'n', label: '#', width: '40px', render: x => ws.steps.indexOf(x.s) + 1 }, { key: 'name', label: 'Langkah', render: x => h('span', { class: x.critical ? 'b' : '' }, x.s.name) },
            { key: 'start', label: 'Mulai', render: x => BGS.fmt.date(x.start) }, { key: 'end', label: 'Tenggat', render: x => BGS.fmt.date(x.end) }, { key: 'dur', label: 'Hari', align: 'center', render: x => x.dur },
            { key: 'g', label: 'Garis waktu', render: x => h('div', { class: 'wf-gantt', title: `Hari ${x.offset} → ${x.offset + x.dur}` }, h('i', { class: x.critical ? 'crit' : '', style: `left:${(x.offset / Math.max(1, r.total)) * 100}%;width:${Math.max(2, (x.dur / Math.max(1, r.total)) * 100)}%` })) },
            { key: 'c', label: '', render: x => x.critical ? ui.badge('Jalur terpanjang', 'orange') : null }] }),
        h('div', { class: 'muted xs' }, 'Simulasi menghitung tenggat tiap langkah = mulai setelah semua pendahulu tenggatnya lewat + jumlah hari tenggat langkah. Hanya perkiraan, bukan jadwal sungguhan.')));
    }
    function save(silent) {
      draft.steps = clone(ws.steps); draft.updatedAt = BGS.today.toISOString(); ws.dirty = false; drawDirty();
      BGS.audit('Draf template disimpan', 'Workflow Template', t.id, `v${draft.v}: ${draft.steps.length} langkah`); if (!silent) ui.toast(`Draf v${draft.v} disimpan`);
    }

    put(page,
      ui.pageHeader({ title: `Editor: ${t.name} — draf v${draft.v}`, mvp: 2, breadcrumbs: [{ label: 'Workflow template', href: '/workflows' }, { label: t.name, href: '/workflows/' + t.id }, { label: 'Edit draf' }],
        actions: [dirtyBadge,
          ui.btn('Kembali', { icon: 'chevron-left', onClick: async () => { if (ws.dirty && !await ui.confirm({ title: 'Perubahan belum disimpan', message: 'Tinggalkan editor tanpa menyimpan draf?', confirmLabel: 'Tinggalkan', tone: 'danger' })) return; ctx.go(`/workflows/${t.id}?v=${draft.v}`); } }),
          ui.btn('Simpan draf', { icon: 'check', onClick: () => save() }),
          ui.btn('Publish', { kind: 'good', icon: 'send', onClick: () => { save(true); publishFlow(t, draft, () => ctx.go(`/workflows/${t.id}?v=${draft.v}`)); } })] }),
      ui.callout('info', 'Perubahan tersimpan di draf', 'Draf tidak memengaruhi case berjalan. Hanya versi PUBLISHED yang dipakai untuk case baru, dan versi PUBLISHED tidak dapat diubah (RUL-012, RUL-013). Urutan SISKO masih menunggu keputusan (OQ-04).'),
      h('div', { class: 'grid cols-12' },
        ui.card({ title: 'Langkah', icon: 'list', actions: ui.btn('Tambah', { sm: true, kind: 'primary', icon: 'plus', onClick: addStep }), body: listBox }),
        ui.card({ title: 'Detail langkah', icon: 'edit', body: formBox })),
      ui.card({ title: 'Pratinjau diagram (langsung)', icon: 'git-branch', body: chartBox }),
      h('div', { class: 'grid cols-2' },
        ui.card({ title: 'Validasi', icon: 'shield', body: valBox }),
        ui.card({ title: 'Simulasi tenggat', icon: 'calendar', body: simBox })));
    drawDirty(); drawList(); drawForm(); drawChart(); drawVal(); drawSim();
  } });

  // =====================================================================================
  //  Compliance helpers
  // =====================================================================================
  const refOf = r => (r.ref ? D.regRefs.find(x => x.id === r.ref) : null);
  const legalOf = r => (r.source !== 'Pemerintah' ? 'INTERNAL' : (refOf(r) && refOf(r).legal === 'TERVERIFIKASI') ? 'TERVERIFIKASI' : 'PERLU_VERIFIKASI');
  const syncLegal = () => D.requirements.forEach(r => (r.legal = legalOf(r)));
  const scopeText = r => `${r.scope.country === '*' ? 'Semua negara' : D.cn(r.scope.country)} · ${r.scope.profession ? D.pn(r.scope.profession) : 'Semua profesi'}`;
  const RULE_TYPES = ['DOKUMEN', 'PROSES', 'ELIGIBILITAS', 'PERLINDUNGAN DATA', 'LAPORAN'];
  const ruleApplies = (r, c) => (r.scope.country === '*' || r.scope.country === c.country) && (!r.scope.profession || r.scope.profession === c.profession);
  const srcBadge = s => ui.badge(s, s === 'Pemerintah' ? 'purple' : 'blue');
  const legalBadge = r => ui.status('legal', legalOf(r));
  syncLegal();

  // =====================================================================================
  //  /compliance/rules
  // =====================================================================================
  function blockActivation(r) {
    const ref = refOf(r);
    const m = ui.modal({ title: 'Aturan belum dapat diaktifkan', size: 'md', body: h('div', { class: 'stack-sm' },
      ui.callout('danger', 'Rujukan belum diverifikasi hukum', ref ? `Aturan ini bersumber dari Pemerintah dan merujuk ${ref.id}, yang masih berstatus "Perlu verifikasi hukum". Aturan Pemerintah hanya boleh ACTIVE setelah rujukannya diverifikasi (BR-023, §17).` : 'Aturan sumber Pemerintah wajib punya rujukan regulasi yang sudah diverifikasi hukum sebelum diaktifkan (BR-023, §17). Aturan ini belum punya rujukan.'),
      h('div', { class: 'muted sm' }, 'Aturan internal tidak memerlukan verifikasi hukum dan dapat langsung diaktifkan.')),
      footer: [ui.btn('Tutup', { onClick: () => m.close() }), h('a', { class: 'btn btn-primary', href: '#/compliance/library' + (ref ? '?ref=' + ref.id : ''), onClick: () => m.close() }, BGS.icon('file-text', 16), 'Buka Pustaka regulasi')] });
  }
  function ruleModal(ctx, rule, mode) {
    const today = todayISO();
    const fields = [
      { name: 'name', label: 'Isi aturan / syarat', type: 'textarea', rows: 2, required: true, span: 2, value: rule ? rule.name : '' },
      { name: 'country', label: 'Negara', type: 'select', options: [['*', 'Semua negara'], ...D.countries.map(c => [c.code, c.name])], value: rule ? rule.scope.country : '*' },
      { name: 'profession', label: 'Profesi', type: 'select', options: [['', 'Semua profesi'], ...D.professions.map(p => [p.code, p.name])], value: (rule && rule.scope.profession) || '' },
      { name: 'type', label: 'Jenis', type: 'select', options: RULE_TYPES, value: rule ? rule.type : 'DOKUMEN' },
      { name: 'source', label: 'Sumber', type: 'select', options: ['Internal', 'Pemerintah'], value: rule ? rule.source : 'Internal', hint: 'Sumber Pemerintah baru bisa diaktifkan setelah rujukannya terverifikasi hukum.' },
      { name: 'ref', label: 'Rujukan regulasi', type: 'select', options: [['', '— tidak ada —'], ...D.regRefs.map(r => [r.id, `${r.id} · ${r.title.length > 58 ? r.title.slice(0, 58) + '…' : r.title}`])], value: (rule && rule.ref) || '', hint: 'Wajib bila sumber Pemerintah.' },
      { name: 'effective', label: 'Berlaku mulai', type: 'date', required: true, value: mode === 'version' || !rule ? today : rule.effective },
      { name: 'mandatory', label: 'Wajib (mandatory) untuk final verification', type: 'checkbox', value: rule ? rule.mandatory : true },
      mode === 'version' ? { name: 'reason', label: 'Alasan perubahan', type: 'textarea', required: true, span: 2, placeholder: 'Mis. Dasar hukum berubah / syarat diperketat' } : null,
    ].filter(Boolean);
    const title = mode === 'new' ? 'Aturan syarat baru' : mode === 'version' ? `Versi baru — ${rule.id} (v${rule.version} → v${rule.version + 1})` : `Edit aturan ${rule.id}`;
    const form = ui.form({ fields, cols: 2, submitLabel: mode === 'new' ? 'Simpan sebagai draf' : mode === 'version' ? `Buat v${rule.version + 1}` : 'Simpan', cancel: ui.btn('Batal', { onClick: () => m.close() }), onSubmit: v => {
      if (v.source === 'Pemerintah' && !v.ref) { ui.toast('Aturan sumber Pemerintah wajib punya rujukan regulasi', 'warn'); return; }
      const scope = { country: v.country }; if (v.profession) scope.profession = v.profession;
      const data = { name: v.name.trim(), scope, type: v.type, source: v.source, ref: v.ref || null, mandatory: !!v.mandatory, effective: v.effective };
      if (mode === 'new') {
        const r = Object.assign({ id: 'RQ' + pad(D.requirements.length + 1, 2), version: 1, legal: 'PERLU_VERIFIKASI', status: 'DRAFT' }, data); D.requirements.push(r); syncLegal();
        BGS.audit('Aturan syarat dibuat', 'Requirement Rule', r.id, `${r.name} (${r.source})`); ui.toast(`Aturan ${r.id} disimpan sebagai draf`);
      } else if (mode === 'edit') {
        Object.assign(rule, data); if (rule.status === 'ACTIVE' && !(rule.source !== 'Pemerintah' || legalOf(rule) === 'TERVERIFIKASI')) rule.status = 'DRAFT'; syncLegal();
        BGS.audit('Aturan syarat diubah', 'Requirement Rule', rule.id, `v${rule.version}: ${rule.name}`); ui.toast(`Aturan ${rule.id} diperbarui`);
      } else {
        rule.history = (rule.history || []).concat([{ version: rule.version, effective: rule.effective, name: rule.name, at: todayISO(), by: BGS.state.userId, reason: v.reason }]);
        Object.assign(rule, data); rule.version += 1; syncLegal();
        const blocked = rule.source === 'Pemerintah' && legalOf(rule) !== 'TERVERIFIKASI' && rule.status === 'ACTIVE'; if (blocked) rule.status = 'DRAFT';
        BGS.audit('Versi baru aturan syarat', 'Requirement Rule', rule.id, `v${rule.version} berlaku ${rule.effective}; alasan: ${v.reason}`);
        D.users.filter(u => u.roles.includes('admin')).slice(0, 1).forEach(u => BGS.notify(u.id, `Aturan ${rule.id} berubah ke v${rule.version}; checklist case berjalan perlu ditinjau`, '#/compliance/checklists', 'RULE_CHANGE'));
        ui.toast(blocked ? `v${rule.version} dibuat. Status kembali Draf karena rujukan belum terverifikasi.` : `Versi baru v${rule.version} dibuat. Checklist case berjalan tidak berubah otomatis (RUL-025).`, blocked ? 'warn' : 'good');
      }
      m.close(); ctx.refresh();
    } });
    const m = ui.modal({ title, size: 'md', body: h('div', { class: 'stack' }, mode === 'version' ? ui.callout('info', 'Versi lama tetap tersimpan', 'Checklist case yang sudah berjalan memakai snapshot versi lama. Perubahan diterapkan lewat peninjauan (RUL-025).') : null, form.el) });
  }
  function toggleRule(ctx, r) {
    if (r.status === 'ACTIVE') {
      ui.reasonPrompt({ title: `Nonaktifkan ${r.id}`, message: 'Aturan nonaktif tidak masuk ke checklist case baru. Case berjalan tidak berubah otomatis (RUL-025).', confirmLabel: 'Nonaktifkan', tone: 'danger' }).then(reason => { if (!reason) return; r.status = 'INACTIVE'; BGS.audit('Aturan syarat dinonaktifkan', 'Requirement Rule', r.id, 'Alasan: ' + reason); ui.toast(`Aturan ${r.id} dinonaktifkan`); ctx.refresh(); });
      return;
    }
    syncLegal();
    if (r.source === 'Pemerintah' && legalOf(r) !== 'TERVERIFIKASI') { blockActivation(r); return; }
    ui.confirm({ title: `Aktifkan ${r.id}?`, message: `Aturan "${r.name}" (v${r.version}) akan masuk ke checklist case yang diaktifkan setelah ini. Checklist case berjalan tidak berubah otomatis (RUL-025).`, confirmLabel: 'Aktifkan', tone: 'good' }).then(ok => { if (!ok) return; r.status = 'ACTIVE'; BGS.audit('Aturan syarat diaktifkan', 'Requirement Rule', r.id, `v${r.version}, ${r.source}`); ui.toast(`Aturan ${r.id} aktif`); ctx.refresh(); });
  }

  BGS.router.add('/compliance/rules', { title: 'Aturan syarat', roles: MGMT, mvp: 1, render(ctx) {
    syncLegal(); const canW = BGS.can('rule.write'); const page = ctx.el; const R = D.requirements;
    const unver = R.filter(r => r.source === 'Pemerintah' && legalOf(r) !== 'TERVERIFIKASI');
    put(page,
      ui.pageHeader({ title: 'Aturan syarat (Requirement Rules)', mvp: 1, subtitle: 'Syarat per negara / profesi dengan sumber, rujukan regulasi, versi, dan tanggal berlaku (BR-023).', actions: canW ? ui.btn('Aturan baru', { kind: 'primary', icon: 'plus', onClick: () => ruleModal(ctx, null, 'new') }) : h('span', { class: 'muted sm' }, 'Hanya Superadmin yang dapat membuat/mengubah aturan') }),
      ui.disclaimer(),
      ui.callout('info', 'Checklist hanyalah kontrol internal (RUL-024)', 'Centang di checklist case menunjukkan bahwa tim BGS sudah memeriksa — bukan bukti resmi bahwa persyaratan pemerintah terpenuhi, dan bukan nasihat hukum. Aturan sumber Pemerintah tidak boleh aktif sebelum rujukannya diverifikasi hukum.'),
      h('div', { class: 'grid cols-4' },
        ui.kpi({ label: 'Total aturan', value: R.length, sub: `${R.filter(r => r.source === 'Internal').length} internal · ${R.filter(r => r.source === 'Pemerintah').length} Pemerintah`, icon: 'list', tone: 'blue' }),
        ui.kpi({ label: 'Aktif', value: R.filter(r => r.status === 'ACTIVE').length, sub: 'masuk checklist case baru', icon: 'check-circle', tone: 'green' }),
        ui.kpi({ label: 'Draf / nonaktif', value: R.filter(r => r.status !== 'ACTIVE').length, sub: 'belum dipakai', icon: 'edit', tone: 'amber' }),
        ui.kpi({ label: 'Pemerintah belum terverifikasi', value: unver.length, sub: 'tidak boleh aktif', icon: 'alert', tone: 'red', href: '/compliance/library' })),
      unver.some(r => r.status === 'ACTIVE') ? ui.callout('danger', 'Ada aturan Pemerintah AKTIF yang rujukannya belum diverifikasi', `${unver.filter(r => r.status === 'ACTIVE').map(r => r.id).join(', ')} — segera verifikasi di Pustaka regulasi atau nonaktifkan.${canW ? '' : ' Hubungi Superadmin.'}`) : null,
      ui.card({ title: 'Daftar aturan', icon: 'list', flush: true, body: ui.listView({
        items: () => D.requirements, search: r => `${r.id} ${r.name} ${r.type} ${r.ref || ''} ${scopeText(r)}`, searchPlaceholder: 'Cari aturan, jenis, rujukan…', pageSize: 8,
        filters: [{ key: 'source', label: 'Sumber', options: ['Pemerintah', 'Internal'] }, { key: 'status', label: 'Status', options: [['ACTIVE', 'Aktif'], ['DRAFT', 'Draf'], ['INACTIVE', 'Nonaktif']] },
          { key: 'country', label: 'Negara', options: D.countries.map(c => [c.code, c.name]), match: (r, v) => r.scope.country === '*' || r.scope.country === v }, { key: 'type', label: 'Jenis', options: RULE_TYPES }],
        rowClass: r => (r.source === 'Pemerintah' && legalOf(r) !== 'TERVERIFIKASI' && r.status === 'ACTIVE' ? 'row-danger' : ''),
        columns: [
          { key: 'name', label: 'Aturan', render: r => h('div', { style: 'min-width:240px' }, h('div', { class: 'b' }, r.name), h('div', { class: 'row wrap gap-sm', style: 'margin-top:4px' }, h('span', { class: 'mono muted xs' }, r.id), ui.badge(r.type, 'gray'), ui.badge(r.mandatory ? 'Wajib' : 'Opsional', r.mandatory ? 'red' : 'gray'))) },
          { key: 'scope', label: 'Cakupan', render: r => h('div', { style: 'min-width:110px' }, scopeText(r)) },
          { key: 'source', label: 'Sumber & rujukan', render: r => h('div', { class: 'stack-sm', style: 'gap:3px;align-items:flex-start' }, srcBadge(r.source), r.ref ? h('a', { class: 'lnk mono xs', href: `#/compliance/library?ref=${r.ref}` }, r.ref) : h('span', { class: 'muted xs' }, 'tanpa rujukan')) },
          { key: 'version', label: 'Versi', sortable: true, render: r => h('div', { class: 'nowrap' }, h('b', null, 'v' + r.version), h('div', { class: 'muted xs' }, 'berlaku ' + BGS.fmt.date(r.effective))) },
          { key: 'status', label: 'Status', render: r => h('div', { class: 'stack-sm', style: 'gap:3px;align-items:flex-start' }, ui.status('generic', r.status), legalBadge(r), r.source === 'Pemerintah' && legalOf(r) !== 'TERVERIFIKASI' ? (r.status === 'ACTIVE' ? ui.badge('Aktif tanpa verifikasi!', 'red') : h('span', { class: 'xs muted', style: 'display:inline-flex;gap:4px;align-items:center' }, BGS.icon('lock', 12), 'Terkunci sampai terverifikasi')) : null) },
          { key: 'act', label: '', render: r => canW ? h('div', { class: 'stack-sm', style: 'gap:4px;align-items:stretch;min-width:112px' },
            r.status === 'ACTIVE' ? null : ui.btn('Edit', { sm: true, icon: 'edit', onClick: () => ruleModal(ctx, r, 'edit') }),
            ui.btn('Versi baru', { sm: true, icon: 'plus', onClick: () => ruleModal(ctx, r, 'version') }),
            ui.btn(r.status === 'ACTIVE' ? 'Nonaktifkan' : 'Aktifkan', { sm: true, kind: r.status === 'ACTIVE' ? '' : (r.source === 'Pemerintah' && legalOf(r) !== 'TERVERIFIKASI' ? 'warn' : 'good'), icon: r.status === 'ACTIVE' ? 'x' : (r.source === 'Pemerintah' && legalOf(r) !== 'TERVERIFIKASI' ? 'lock' : 'check'), onClick: () => toggleRule(ctx, r) })) : h('span', { class: 'muted xs' }, 'Baca saja') },
        ] }) }),
      docSetsCard());
  } });

  function docSetsCard() {
    const pairs = []; const add = (c, p) => { if (!pairs.some(x => x[0] === c && x[1] === p)) pairs.push([c, p]); };
    D.templates.forEach(t => add(t.country, t.profession)); D.placementCodes.forEach(p => add(p.country, p.profession));
    pairs.sort((a, b) => D.cn(a[0]).localeCompare(D.cn(b[0])) || a[1].localeCompare(b[1]));
    const base = D.docTypes.filter(d => d.required);
    return ui.card({ title: 'Syarat dokumen per negara / profesi', icon: 'folder', subtitle: 'Ringkasan baca-saja: dokumen wajib dasar + aturan tambahan yang berlaku.', actions: h('a', { class: 'btn btn-sm', href: '#/master' }, 'Kelola di Data master'), body: h('div', { class: 'stack' },
      h('div', null, h('div', { class: 'lbl', style: 'margin-bottom:6px' }, `Dokumen wajib dasar (semua negara) — ${base.length} jenis`), h('div', { class: 'row wrap gap-sm' }, base.map(d => h('span', { class: 'chip static', title: d.validMonths ? `Masa berlaku minimal ${d.validMonths} bulan` : '' }, d.name, d.validMonths ? ` (≥${d.validMonths} bln)` : '')))),
      h('div', { class: 'muted sm' }, `Sisa masa berlaku paspor minimal ${D.settings.passportMinMonths} bulan (pengaturan sistem; angka resmi menunggu OQ-10).`),
      ui.table({ pageSize: 12, dense: true, rows: pairs, columns: [
        { key: 'c', label: 'Negara', render: p => D.cn(p[0]) }, { key: 'p', label: 'Profesi', render: p => D.pn(p[1]) },
        { key: 'extra', label: 'Aturan tambahan yang berlaku', render: p => { const rs = D.requirements.filter(r => ruleApplies(r, { country: p[0], profession: p[1] }) && r.type === 'DOKUMEN'); return rs.length ? h('ul', { class: 'wf-ul', style: 'margin:0' }, rs.map(r => h('li', null, r.name, ' ', ui.status('generic', r.status), ' ', srcBadge(r.source)))) : h('span', { class: 'muted' }, 'Hanya dokumen dasar'); } },
      ] })) });
  }

  // =====================================================================================
  //  /compliance/library
  // =====================================================================================
  function refModal(ctx) {
    const form = ui.form({ cols: 2, submitLabel: 'Simpan rujukan', cancel: ui.btn('Batal', { onClick: () => m.close() }), fields: [
      { name: 'title', label: 'Judul regulasi', type: 'textarea', rows: 2, required: true, span: 2, placeholder: 'Mis. Peraturan Menteri … No. … Tahun …' },
      { name: 'type', label: 'Jenis', type: 'select', options: ['Undang-undang', 'Peraturan Pemerintah', 'Peraturan Menteri', 'Keputusan', 'Surat Edaran', 'Lainnya'] },
      { name: 'link', label: 'Tautan sumber resmi (opsional)', type: 'url', placeholder: 'https://…' }],
      onSubmit: v => { const r = { id: 'REF-' + pad(D.regRefs.length + 1, 2), title: v.title.trim(), type: v.type, link: v.link.trim(), legal: 'PERLU_VERIFIKASI' }; D.regRefs.push(r); BGS.audit('Rujukan regulasi ditambahkan', 'Regulatory Reference', r.id, r.title); m.close(); ui.toast(`${r.id} ditambahkan dengan status Perlu verifikasi hukum`); ctx.refresh(); } });
    const m = ui.modal({ title: 'Tambah rujukan regulasi', size: 'md', body: h('div', { class: 'stack' }, ui.callout('warn', 'Selalu mulai sebagai "Perlu verifikasi hukum"', 'Rujukan baru tidak dianggap terverifikasi sampai verifikator hukum mengisi hasilnya.'), form.el) });
  }
  function verifyModal(ctx, ref) {
    const linked = D.requirements.filter(r => r.ref === ref.id);
    const form = ui.form({ cols: 2, submitLabel: 'Tandai terverifikasi', cancel: ui.btn('Batal', { onClick: () => m.close() }), fields: [
      { name: 'by', label: 'Nama verifikator', required: true, placeholder: 'Konsultan hukum / pejabat yang memverifikasi', hint: 'Orang yang memeriksa teks regulasi terhadap sumber resmi.' },
      { name: 'at', label: 'Tanggal verifikasi', type: 'date', required: true, value: todayISO() },
      { name: 'note', label: 'Catatan hasil verifikasi', type: 'textarea', rows: 3, required: true, span: 2, placeholder: 'Mis. Diperiksa terhadap JDIH BP2MI; pasal 27 sesuai.' },
      { name: 'ok', label: 'Saya memastikan verifikasi ini benar-benar sudah dilakukan', type: 'checkbox', required: true, span: 2 }],
      onSubmit: v => {
        if (new Date(v.at) > BGS.today) { ui.toast('Tanggal verifikasi tidak boleh di masa depan', 'warn'); return; }
        Object.assign(ref, { legal: 'TERVERIFIKASI', verifiedBy: v.by.trim(), verifiedAt: v.at, verifyNote: v.note.trim(), verifiedRecordedBy: BGS.state.userId }); syncLegal();
        BGS.audit('Rujukan regulasi diverifikasi', 'Regulatory Reference', ref.id, `Verifikator: ${ref.verifiedBy}; ${ref.verifiedAt}; ${ref.verifyNote}`);
        m.close(); ui.toast(`${ref.id} ditandai terverifikasi. ${linked.filter(r => r.source === 'Pemerintah' && r.status !== 'ACTIVE').length} aturan Pemerintah kini bisa diaktifkan.`); ctx.refresh();
      } });
    const m = ui.modal({ title: `Verifikasi hukum — ${ref.id}`, size: 'md', body: h('div', { class: 'stack' }, h('div', { class: 'sm' }, h('b', null, ref.title)), ui.callout('warn', 'Tandai hanya bila sudah diverifikasi', 'Sistem tidak memverifikasi isi regulasi. Status ini hanya mencatat bahwa pihak berwenang/konsultan hukum sudah memeriksanya (§17). Ini bukan nasihat hukum.'), linked.length ? h('div', { class: 'sm muted' }, `Aturan terkait: ${linked.map(r => r.id).join(', ')}`) : null, form.el) });
  }

  BGS.router.add('/compliance/library', { title: 'Pustaka regulasi', roles: MGMT, mvp: 2, render(ctx) {
    syncLegal(); const canW = BGS.can('rule.write'); const page = ctx.el; const hi = ctx.query.ref;
    const nVer = D.regRefs.filter(r => r.legal === 'TERVERIFIKASI').length;
    put(page,
      ui.pageHeader({ title: 'Pustaka regulasi (Regulatory Reference Library)', mvp: 2, subtitle: 'Daftar rujukan regulasi beserta status verifikasi hukum. Rujukan tidak dianggap benar sebelum ditandai terverifikasi.', actions: canW ? ui.btn('Tambah rujukan', { kind: 'primary', icon: 'plus', onClick: () => refModal(ctx) }) : h('span', { class: 'muted sm' }, 'Hanya Superadmin yang dapat menambah/memverifikasi') }),
      ui.disclaimer(),
      h('div', { class: 'grid cols-2' },
        ui.callout('warn', 'OQ-04 — Urutan pendaftaran SISKO', 'Draf v0.1 mencatat urutan resmi menaruh pendaftaran SISKO P2MI sebelum seleksi, sedangkan wawancara menaruhnya setelah screening. Usulan sementara: screening BGS = pra-seleksi internal [RECOMMENDATION]. Posisi langkah SISKO di template workflow menunggu jawaban konsultan hukum + Direktur.'),
        ui.callout('warn', 'OQ-24 — Penyesuaian sistem informasi (Permen 2/2026)', 'Sumber sekunder menyebut sistem informasi penempatan wajib menyesuaikan paling lambat 1 tahun sejak diundangkan. Dampaknya pada sistem internal BGS belum diketahui dan perlu dijawab konsultan hukum. Tidak ada integrasi API dengan sistem pemerintah (A-08).')),
      h('div', { class: 'grid cols-3' },
        ui.kpi({ label: 'Rujukan', value: D.regRefs.length, icon: 'file-text', tone: 'blue' }), ui.kpi({ label: 'Terverifikasi hukum', value: nVer, icon: 'check-circle', tone: 'green' }), ui.kpi({ label: 'Perlu verifikasi', value: D.regRefs.length - nVer, icon: 'alert', tone: 'amber' })),
      ui.card({ title: 'Daftar rujukan', icon: 'file-text', flush: true, body: ui.listView({
        items: () => D.regRefs, search: r => `${r.id} ${r.title} ${r.type}`, searchPlaceholder: 'Cari rujukan…', pageSize: 10, rowClass: r => (r.id === hi ? 'row-warn' : ''),
        filters: [{ key: 'legal', label: 'Status hukum', options: [['PERLU_VERIFIKASI', 'Perlu verifikasi'], ['TERVERIFIKASI', 'Terverifikasi']] }, { key: 'type', label: 'Jenis', options: Array.from(new Set(D.regRefs.map(r => r.type))) }],
        columns: [
          { key: 'title', label: 'Rujukan', render: r => h('div', null, h('div', { class: 'b' }, r.title), h('div', { class: 'muted xs mono' }, r.id)) }, { key: 'type', label: 'Jenis', render: r => ui.badge(r.type, 'gray') },
          { key: 'link', label: 'Tautan', render: r => r.link ? h('a', { class: 'lnk', href: r.link, target: '_blank', rel: 'noopener noreferrer' }, 'Buka sumber ↗') : h('span', { class: 'muted xs' }, 'Belum ada tautan') },
          { key: 'legal', label: 'Status verifikasi', render: r => r.legal === 'TERVERIFIKASI' ? h('div', null, ui.status('legal', 'TERVERIFIKASI'), h('div', { class: 'muted xs' }, `${r.verifiedBy} · ${BGS.fmt.date(r.verifiedAt)}`), r.verifyNote ? h('div', { class: 'xs', style: 'max-width:240px' }, '“' + r.verifyNote + '”') : null) : ui.status('legal', 'PERLU_VERIFIKASI') },
          { key: 'rules', label: 'Aturan terkait', render: r => { const rs = D.requirements.filter(x => x.ref === r.id); return rs.length ? h('div', null, h('b', null, rs.length + ' aturan'), h('ul', { class: 'wf-ul xs', style: 'margin:2px 0 0' }, rs.slice(0, 4).map(x => h('li', null, h('span', { class: 'mono' }, x.id), ' · ', x.name.length > 40 ? x.name.slice(0, 40) + '…' : x.name, ' ', ui.status('generic', x.status))), rs.length > 4 ? h('li', { class: 'muted' }, `+${rs.length - 4} lainnya`) : null)) : h('span', { class: 'muted' }, 'Belum ada'); } },
          { key: 'act', label: '', render: r => canW ? (r.legal === 'TERVERIFIKASI' ? ui.btn('Cabut verifikasi', { sm: true, onClick: async () => { const why = await ui.reasonPrompt({ title: `Cabut verifikasi ${r.id}`, message: 'Aturan Pemerintah yang merujuk ini akan kembali terkunci.', confirmLabel: 'Cabut', tone: 'danger' }); if (!why) return; Object.assign(r, { legal: 'PERLU_VERIFIKASI', verifiedBy: null, verifiedAt: null, verifyNote: null }); syncLegal(); BGS.audit('Verifikasi rujukan dicabut', 'Regulatory Reference', r.id, 'Alasan: ' + why); ui.toast('Verifikasi dicabut', 'warn'); ctx.refresh(); } }) : ui.btn('Tandai terverifikasi', { sm: true, kind: 'primary', icon: 'check', onClick: () => verifyModal(ctx, r) })) : null },
        ] }) }),
      ui.card({ title: 'Pasal yang dirujuk draf v0.1 — belum diverifikasi', icon: 'info', subtitle: 'Hanya catatan; tidak dipakai sebagai aturan sistem (§17.1).', body: h('ul', { class: 'wf-ul sm', style: 'margin:0' },
        [['Ps. 25', 'SIP2MI / surat permintaan'], ['Ps. 27', 'Urutan pendaftaran → seleksi → pemenuhan dokumen → OPP → pemberangkatan'], ['Ps. 31, 35, 39, 40', 'OPP, biometrik, E-KPMI'], ['Ps. 41', 'Laporan keberangkatan'], ['Ps. 43–44', 'Pelaporan pemantauan, kepulangan']].map(([a, b]) => h('li', null, h('b', null, a + ': '), b, ' ', ui.badge('Perlu verifikasi hukum', 'amber'))) ) }));
  } });

  // =====================================================================================
  //  /compliance/checklists
  // =====================================================================================
  const clStats = c => { const cl = c.checklist || []; const met = cl.filter(i => i.status === 'MET').length; return { total: cl.length, met, mand: cl.filter(i => i.mandatory && i.status !== 'MET').length }; };
  function ruleDelta(c) {
    const cl = c.checklist || []; const out = { changed: [], added: [], retired: [] };
    cl.forEach(i => { const r = D.requirements.find(x => x.id === i.ruleId); if (!r || r.status === 'INACTIVE') out.retired.push({ item: i, rule: r }); else if (r.version > i.ruleVersion) out.changed.push({ item: i, rule: r }); });
    D.requirements.filter(r => r.status === 'ACTIVE' && ruleApplies(r, c) && !cl.some(i => i.ruleId === r.id)).forEach(r => out.added.push({ rule: r }));
    return out;
  }
  const canEditChecklist = c => BGS.isRole('superadmin', 'admin') || (BGS.isRole('pic') && BGS.scope.cases().includes(c));

  function checklistDrawer(c, onChange) {
    const editable = canEditChecklist(c); const w = D.worker(c.workerId) || {}; const body = h('div'); const bar = h('div');
    const drawer = ui.drawer({ title: `Checklist ${c.id}`, size: 'lg', body: h('div', { class: 'stack' }, ui.disclaimer(), bar, body), footer: ui.btn('Tutup', { onClick: () => drawer.close() }) });
    const set = async (i, status) => {
      if (i.status === status) return;
      let note = null;
      if (status === 'NOT_MET') { note = await ui.reasonPrompt({ title: 'Ubah menjadi "Belum terpenuhi"', message: `${i.label}`, label: 'Alasan perubahan', confirmLabel: 'Simpan' }); if (!note) return; }
      i.status = status; i.checkedBy = BGS.state.userId; i.checkedAt = BGS.today.toISOString(); i.note = note;
      BGS.audit(status === 'MET' ? 'Item checklist ditandai terpenuhi' : 'Item checklist ditandai belum terpenuhi', 'Placement Case', c.id, `${i.ruleId} v${i.ruleVersion}: ${i.label}${note ? ' — ' + note : ''}`);
      ui.toast(status === 'MET' ? 'Ditandai terpenuhi (kontrol internal)' : 'Ditandai belum terpenuhi', status === 'MET' ? 'good' : 'warn'); draw(); onChange && onChange();
    };
    const row = i => { const r = D.requirements.find(x => x.id === i.ruleId); const unverGov = i.source === 'Pemerintah' && r && legalOf(r) !== 'TERVERIFIKASI';
      return h('div', { class: 'wf-ci' }, h('div', { style: 'min-width:0' }, h('div', { class: 'b' }, i.label),
        h('div', { class: 'row wrap gap-sm', style: 'margin-top:4px' }, srcBadge(i.source), ui.badge(i.mandatory ? 'Wajib' : 'Opsional', i.mandatory ? 'red' : 'gray'), ui.badge(`${i.ruleId} · v${i.ruleVersion}`, 'gray'), r && r.version > i.ruleVersion ? ui.badge(`Aturan sudah v${r.version}`, 'amber') : null),
        unverGov ? h('div', { class: 'wf-note', style: 'color:#92400E;margin-top:3px' }, 'Rujukan belum diverifikasi hukum — centang hanya sebagai kontrol internal.') : null,
        i.checkedAt ? h('div', { class: 'wf-note' }, `Dicek ${(D.user(i.checkedBy) || {}).name || ''}, ${BGS.fmt.dateTime(i.checkedAt)}${i.note ? ' · ' + i.note : ''}`) : null),
        h('div', { class: 'wf-sw', title: editable ? '' : 'Hanya Admin/Superadmin (atau PIC pada case-nya) yang dapat mengubah' }, h('button', { class: 'met' + (i.status === 'MET' ? ' on' : ''), disabled: !editable, onClick: () => set(i, 'MET') }, 'Terpenuhi'), h('button', { class: 'not' + (i.status !== 'MET' ? ' on' : ''), disabled: !editable, onClick: () => set(i, 'NOT_MET') }, 'Belum'))); };
    function draw() {
      const s = clStats(c); BGS.clear(bar); BGS.clear(body);
      bar.append(h('div', { class: 'stack-sm' }, h('div', { class: 'row wrap between' }, h('div', null, h('b', null, w.name || c.workerId), h('div', { class: 'muted sm' }, `${D.cn(c.country)} · ${D.pn(c.profession)} · template v${c.templateVersion}`)), ui.status('case', c.status)),
        h('div', { class: 'row' }, ui.progress(s.total ? (s.met / s.total) * 100 : 0, s.mand ? 'amber' : 'green'), h('b', { class: 'nowrap' }, `${s.met}/${s.total}`)),
        s.mand ? ui.callout('warn', `${s.mand} item wajib belum terpenuhi`, 'Final verification mensyaratkan seluruh item wajib terpenuhi (RUL-018).') : ui.callout('good', 'Semua item wajib sudah ditandai terpenuhi', 'Tetap kontrol internal — bukan bukti resmi (RUL-024).'),
        !editable ? ui.callout('info', 'Mode baca saja', 'Peran Anda tidak dapat mengubah checklist.') : null,
        h('div', { class: 'row gap-sm' }, h('a', { class: 'btn btn-sm', href: `#/cases/${c.id}` }, 'Buka case'))));
      const mand = (c.checklist || []).filter(i => i.mandatory), opt = (c.checklist || []).filter(i => !i.mandatory);
      if (!(c.checklist || []).length) { body.appendChild(ui.emptyState({ icon: 'check-square', title: 'Belum ada checklist', text: 'Tidak ada aturan yang berlaku saat case ini dibuat.' })); return; }
      body.append(h('div', { class: 'stack-sm' }, h('div', { class: 'lbl' }, `Wajib (${mand.length})`), mand.map(row), opt.length ? h('div', { class: 'lbl', style: 'margin-top:10px' }, `Opsional (${opt.length})`) : null, opt.map(row),
        h('div', { class: 'wf-note', style: 'margin-top:10px' }, `Checklist ini adalah snapshot aturan ACTIVE saat case diaktifkan (RUL-025). Perubahan aturan tidak mengubahnya otomatis.`)));
    }
    draw();
  }

  function deltaModal(c, ctx) {
    const d = ruleDelta(c); const editable = BGS.isRole('superadmin', 'admin'); let ok = false;
    const chk = h('input', { type: 'checkbox', onChange: e => { ok = e.target.checked; btn.disabled = !ok || !editable; } });
    const btn = ui.btn('Terapkan setelah ditinjau', { kind: 'primary', icon: 'check', disabled: true, title: editable ? 'Centang konfirmasi peninjauan dulu' : 'Hanya Admin/Superadmin', onClick: () => {
      d.changed.forEach(({ item, rule }) => { Object.assign(item, { ruleVersion: rule.version, label: rule.name, mandatory: rule.mandatory, source: rule.source, status: 'NOT_MET', checkedBy: null, checkedAt: null, note: `Perlu dicek ulang: aturan berubah ke v${rule.version}` }); });
      d.added.forEach(({ rule }) => c.checklist.push({ ruleId: rule.id, label: rule.name, mandatory: rule.mandatory, source: rule.source, ruleVersion: rule.version, status: 'NOT_MET', checkedBy: null }));
      const gone = new Set(d.retired.map(x => x.item)); c.checklist = c.checklist.filter(i => !gone.has(i));
      BGS.audit('Perubahan aturan diterapkan ke checklist case', 'Placement Case', c.id, `${d.changed.length} diperbarui, ${d.added.length} ditambahkan, ${d.retired.length} dicabut (setelah ditinjau)`);
      m.close(); ui.toast(`Checklist ${c.id} diperbarui. Item yang berubah perlu dicek ulang.`); ctx.refresh();
    } });
    const list = (title, items, fmt) => items.length ? h('div', null, h('div', { class: 'lbl' }, `${title} (${items.length})`), h('ul', { class: 'wf-ul' }, items.map(x => h('li', null, fmt(x))))) : null;
    const m = ui.modal({ title: `Tinjau perubahan aturan — ${c.id}`, size: 'md', body: h('div', { class: 'stack' }, ui.callout('info', 'Tidak otomatis (RUL-025)', 'Aturan versi baru tidak mengubah checklist case berjalan. Tinjau perubahan di bawah, lalu terapkan bila sesuai.'),
      list('Versi aturan berubah', d.changed, ({ item, rule }) => h('span', null, h('b', null, rule.id), ` v${item.ruleVersion} → v${rule.version}: ${rule.name}`, item.status === 'MET' ? h('span', { class: 'muted xs' }, ' (status Terpenuhi akan direset)') : null)),
      list('Aturan baru yang berlaku', d.added, ({ rule }) => h('span', null, h('b', null, rule.id), ` v${rule.version}: ${rule.name}`)),
      list('Aturan dicabut / nonaktif', d.retired, ({ item }) => h('span', null, h('b', null, item.ruleId), `: ${item.label} (item akan dihapus dari checklist)`)),
      h('label', { class: 'row gap-sm' }, chk, h('span', { class: 'b' }, 'Saya sudah meninjau perubahan ini'))), footer: [ui.btn('Batal', { onClick: () => m.close() }), btn] });
  }

  BGS.router.add('/compliance/checklists', { title: 'Checklist case', roles: ['superadmin', 'director', 'admin', 'pic'], mvp: 2, render(ctx) {
    syncLegal(); const page = ctx.el; const cases = BGS.scope.cases().filter(c => c.status !== 'CANCELLED');
    const stats = cases.map(c => [c, clStats(c)]); const withMand = stats.filter(([, s]) => s.mand).length; const tot = stats.reduce((a, [, s]) => [a[0] + s.met, a[1] + s.total], [0, 0]);
    put(page,
      ui.pageHeader({ title: 'Checklist compliance per case', mvp: 2, subtitle: BGS.isRole('pic') ? 'Hanya case yang ditugaskan kepada Anda (RUL-020).' : 'Snapshot aturan per case. Alat kontrol internal, bukan bukti resmi (BR-024, RUL-024).' }),
      ui.disclaimer(),
      h('div', { class: 'grid cols-3' },
        ui.kpi({ label: 'Case', value: cases.length, sub: 'dengan checklist snapshot', icon: 'briefcase', tone: 'blue' }),
        ui.kpi({ label: 'Terpenuhi', value: BGS.fmt.pct(tot[0], tot[1]), sub: `${tot[0]} dari ${tot[1]} item`, icon: 'check-circle', tone: 'green' }),
        ui.kpi({ label: 'Wajib belum terpenuhi', value: withMand, sub: 'case tertahan di final verification', icon: 'alert', tone: withMand ? 'amber' : 'green' })),
      ui.card({ title: 'Daftar checklist', icon: 'check-square', flush: true, body: ui.listView({
        items: () => cases, search: c => `${c.id} ${(D.worker(c.workerId) || {}).name} ${c.country} ${c.profession}`, searchPlaceholder: 'Cari case atau worker…', pageSize: 10,
        filters: [{ key: 'country', label: 'Negara', options: D.countries.map(c => [c.code, c.name]) }, { key: 'status', label: 'Status case', options: Object.entries(BGS.ST.case).map(([k, v]) => [k, v[0]]) }, { key: 'mand', label: 'Wajib', options: [['unmet', 'Ada wajib belum terpenuhi'], ['ok', 'Semua wajib terpenuhi']], match: (c, v) => (v === 'unmet') === (clStats(c).mand > 0) }],
        onRowClick: c => checklistDrawer(c, () => ctx.refresh()),
        columns: [
          { key: 'id', label: 'Case', sortable: true, render: c => h('div', null, h('a', { class: 'lnk mono', href: `#/cases/${c.id}` }, c.id), h('div', { class: 'muted xs' }, (D.worker(c.workerId) || {}).name)) },
          { key: 'k', label: 'Negara · profesi', render: c => `${D.cn(c.country)} · ${D.pn(c.profession)}` }, { key: 'st', label: 'Status', render: c => ui.status('case', c.status) },
          { key: 'prog', label: 'Progres', sortValue: c => { const s = clStats(c); return s.total ? s.met / s.total : 0; }, sortable: true, render: c => { const s = clStats(c); return h('div', { class: 'row gap-sm', style: 'min-width:130px' }, ui.progress(s.total ? (s.met / s.total) * 100 : 0, s.mand ? 'amber' : 'green'), h('span', { class: 'xs nowrap' }, `${s.met}/${s.total}`)); } },
          { key: 'mand', label: 'Wajib belum', align: 'center', render: c => { const n = clStats(c).mand; return n ? ui.badge(n + ' item', 'amber') : ui.badge('Lengkap', 'green'); } },
          { key: 'snap', label: 'Snapshot aturan', render: c => { const vs = (c.checklist || []).map(i => i.ruleVersion); return vs.length ? h('div', { class: 'xs' }, `${vs.length} aturan · v${Math.min(...vs)}${Math.max(...vs) !== Math.min(...vs) ? '–v' + Math.max(...vs) : ''}`, BGS.state.mvp >= 3 && (() => { const d = ruleDelta(c); const n = d.changed.length + d.added.length + d.retired.length; return n ? h('div', null, ui.badge(`${n} perubahan baru`, 'purple')) : null; })()) : h('span', { class: 'muted' }, '—'); } },
          { key: 'a', label: '', render: c => ui.btn('Buka', { sm: true, icon: 'check-square', onClick: () => checklistDrawer(c, () => ctx.refresh()) }) },
        ] }) }),
      BGS.state.mvp >= 3 ? deltaPanel(cases, ctx) : null);
  } });

  function deltaPanel(cases, ctx) {
    const rows = cases.map(c => [c, ruleDelta(c)]).filter(([, d]) => d.changed.length + d.added.length + d.retired.length);
    const editable = BGS.isRole('superadmin', 'admin');
    return ui.card({ title: 'Perubahan aturan baru', icon: 'refresh', subtitle: 'Selisih antara aturan ACTIVE saat ini dan snapshot tiap case (RUL-025, MVP 3).', actions: ui.mvpTag(3), flush: true, body: h('div', null,
      h('div', { style: 'padding:14px 18px 0' }, ui.callout('info', 'Tidak diterapkan otomatis', 'Aturan versi baru tidak mengubah checklist case berjalan. Admin meninjau selisih lalu menerapkannya per case. Item yang berubah direset menjadi "Belum terpenuhi" agar dicek ulang.')),
      ui.table({ pageSize: 8, rows, empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada perubahan aturan yang menunggu', text: 'Semua checklist sesuai versi aturan ACTIVE. Perubahan akan muncul setelah Superadmin membuat versi baru atau menambah aturan di "Aturan syarat".' }), columns: [
        { key: 'c', label: 'Case', render: ([c]) => h('div', null, ui.caseLink(c.id), h('div', { class: 'muted xs' }, (D.worker(c.workerId) || {}).name)) },
        { key: 'ch', label: 'Versi berubah', align: 'center', render: ([, d]) => d.changed.length || 0 }, { key: 'ad', label: 'Aturan baru', align: 'center', render: ([, d]) => d.added.length || 0 }, { key: 're', label: 'Dicabut', align: 'center', render: ([, d]) => d.retired.length || 0 },
        { key: 'p', label: 'Contoh perubahan', render: ([, d]) => { const x = d.changed[0] || d.added[0] || d.retired[0]; const r = x.rule || (D.requirements.find(q => q.id === x.item.ruleId)); return h('span', { class: 'xs muted' }, (x.rule ? x.rule.id : x.item.ruleId) + (d.changed[0] ? ` v${x.item.ruleVersion}→v${x.rule.version}` : d.added[0] ? ' (baru)' : ' (dicabut)') + (r ? ' · ' + (r.name.length > 44 ? r.name.slice(0, 44) + '…' : r.name) : '')); } },
        { key: 'a', label: '', render: ([c]) => ui.btn('Tinjau', { sm: true, kind: 'primary', title: editable ? '' : 'Hanya Admin/Superadmin yang dapat menerapkan', onClick: () => deltaModal(c, ctx) }) },
      ] })) });
  }
})();
