/* M02 Worker Management: inbox registrasi, daftar worker, input manual, Profil 360°, impor Excel.
   Routes: /registrations, /registrations/:id, /workers, /workers/new, /workers/:id, /import */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui, fmt = BGS.fmt;
  const OPS = BGS.ROLES.OPS, ALL = BGS.ROLES.ALL;

  // ====================================================================
  // helpers
  // ====================================================================
  const pad = (n, l) => String(n).padStart(l, '0');
  let tick = 0;
  // timestamps for new records: fixed "today" + 1 minute per action (never new Date())
  const stamp = () => new Date(BGS.today.getTime() + (++tick) * 60000).toISOString();
  const digits = s => String(s || '').replace(/\D/g, '');
  const put = (el, ...kids) => kids.forEach(k => k && el.appendChild(k));
  const titleCase = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  const userName = id => (D.user(id) || {}).name || id || '—';
  const TERMINAL_APP = ['REJECTED', 'WITHDRAWN', 'CANCELLED'];
  const ACTIVE_CASE = ['DRAFT', 'IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART', 'ON_HOLD'];
  const CITY_PROV = { Indramayu: 'Jawa Barat', Cianjur: 'Jawa Barat', Cirebon: 'Jawa Barat', Brebes: 'Jawa Tengah', Cilacap: 'Jawa Tengah', Malang: 'Jawa Timur', Blitar: 'Jawa Timur', 'Lombok Timur': 'NTB', 'Lampung Tengah': 'Lampung', Karawang: 'Jawa Barat', Bekasi: 'Jawa Barat', Sukabumi: 'Jawa Barat' };
  const PROVINCES = ['Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Banten', 'DKI Jakarta', 'DI Yogyakarta', 'Lampung', 'NTB', 'NTT', 'Sumatera Utara', 'Sumatera Selatan', 'Kalimantan Barat', 'Sulawesi Selatan', 'Bali', 'Lainnya'];
  const EDU = ['SD', 'SMP', 'SMA/SMK', 'D3', 'S1'];
  const MARITAL = ['Belum menikah', 'Menikah', 'Cerai'];
  const EVIDENCE_TYPES = ['Formulir bertanda tangan', 'Rekaman persetujuan lisan (telepon/WhatsApp)', 'Tangkapan layar persetujuan WhatsApp'];
  const countryOpts = () => D.countries.map(c => [c.code, c.name]);
  const profOpts = () => D.professions.map(p => [p.code, p.name]);
  const routesFor = c => D.routes.filter(r => r.countries.includes(c));
  const routeOpts = c => routesFor(c).map(r => [r.id, r.name]);
  const defaultRoute = c => { const rs = routesFor(c); return (rs.find(r => r.id === 'RT-P3MI') || rs[0] || {}).id || ''; };
  const routeName = id => (D.routes.find(r => r.id === id) || {}).name || id || '—';
  const staffAdmins = () => D.users.filter(u => u.active && (u.roles.includes('admin') || u.roles.includes('superadmin')));
  const defaultRecruiter = () => (staffAdmins().some(u => u.id === BGS.state.userId) ? BGS.state.userId : 'U04');
  const curConsent = () => (D.consentVersions.find(c => c.current) || D.consentVersions[0]).version;
  const genderLabel = g => (g === 'L' ? 'Laki-laki' : g === 'P' ? 'Perempuan' : '—');
  const appStatusLabel = s => ((BGS.ST.application[s] || [s])[0]);
  const stripProv = c => String(c || '').split(',')[0].trim();
  const validDate = iso => { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false; const d = new Date(iso + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === iso; };
  const ageOk = iso => { const a = fmt.age(iso); return a >= 17 && a <= 60; };

  const maxSeq = (ids, re) => ids.reduce((m, x) => { const r = re.exec(x); return r ? Math.max(m, +r[1]) : m; }, 0);
  const issued = { w: 0, a: 0 };
  // RUL-001: Worker ID is permanent and never re-used (even after an import rollback)
  const nextWorkerId = () => { const seq = Math.max(issued.w, maxSeq(D.workers.flatMap(w => [w.id, ...(w.aliases || [])]), /^BGS-W-\d{4}-(\d+)$/)) + 1; issued.w = seq; return `BGS-W-${BGS.today.getFullYear()}-${pad(seq, 5)}`; };
  const nextAppId = () => { const seq = Math.max(issued.a, maxSeq(D.applications.map(a => a.id), /^APP-\d{4}-(\d+)$/)) + 1; issued.a = seq; return `APP-${BGS.today.getFullYear()}-${pad(seq, 5)}`; };

  // ---------- similarity / duplicate detection (RUL-001/002, FR-WRK-006) ----------
  const normName = s => String(s || '').toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  const lev = (a, b) => { const m = a.length, n = b.length; if (!m) return n; if (!n) return m; let prev = Array.from({ length: n + 1 }, (_, j) => j); for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; } return prev[n]; };
  const nameSim = (a, b) => { a = normName(a); b = normName(b); if (!a || !b) return 0; return 1 - lev(a, b) / Math.max(a.length, b.length); };
  /* returns [{worker, reasons[], kinds:Set, hard}] — hard = NIK or passport equal (blocks creation, RUL-002) */
  function findDuplicates(rec, excludeId) {
    const out = new Map(); const nik = digits(rec.nik); const pp = String(rec.passport || '').toUpperCase().trim();
    const add = (w, reason, kind) => { const e = out.get(w.id) || { worker: w, reasons: [], kinds: new Set(), hard: false }; if (!e.reasons.includes(reason)) e.reasons.push(reason); e.kinds.add(kind); if (kind !== 'NAME') e.hard = true; out.set(w.id, e); };
    D.workers.forEach(w => {
      if (w.id === excludeId || w.status === 'ARCHIVED') return;
      if (nik && w.nik === nik) add(w, 'NIK sama persis', 'NIK');
      if (pp && w.passport && String(w.passport).toUpperCase() === pp) add(w, 'Nomor paspor sama', 'PASSPORT');
      if (rec.dob && w.dob === rec.dob && nameSim(rec.name, w.name) >= 0.8) add(w, 'Nama mirip & tanggal lahir sama', 'NAME');
    });
    return [...out.values()].sort((a, b) => (b.hard - a.hard) || (b.reasons.length - a.reasons.length));
  }

  // ---------- creators (shared by registrations, manual input, import) ----------
  const activeAppConflict = (workerId, country, profession) => D.applications.find(a => a.workerId === workerId && a.country === country && a.profession === profession && !TERMINAL_APP.includes(a.status));
  const screeningPic = () => { const n = id => D.applications.filter(a => a.picId === id && !TERMINAL_APP.includes(a.status)).length; return n('U07') <= n('U11') ? 'U07' : 'U11'; };
  function createApplication(w, o) {
    if (w.status === 'ARCHIVED') throw new Error('Worker ini diarsipkan, tidak bisa menambah lamaran.');
    const dup = activeAppConflict(w.id, o.country, o.profession);
    if (dup) throw Object.assign(new Error(`Worker sudah punya lamaran aktif ${D.cn(o.country)} · ${D.pn(o.profession)} (${dup.id}, ${appStatusLabel(dup.status)}). Selesaikan atau batalkan lamaran itu dulu (RUL-008).`), { dup });
    const route = o.route || defaultRoute(o.country);
    if (!routesFor(o.country).some(r => r.id === route)) throw new Error(`Jalur penempatan "${routeName(route)}" tidak tersedia untuk ${D.cn(o.country)}.`);
    const at = o.at || stamp();
    const app = {
      id: nextAppId(), workerId: w.id, country: o.country, profession: o.profession, route, status: 'SUBMITTED', createdAt: at, recruiterId: o.recruiterId || w.recruiterId, picId: screeningPic(), caseId: null,
      screening: { documents: { status: 'PENDING', note: '' }, interview: { status: 'PENDING' }, assessment: { status: 'PENDING' } }, decision: null,
      history: [{ at, by: BGS.state.userId, text: `Lamaran dibuat (SUBMITTED)${o.via ? ' — ' + o.via : ''}` }],
    };
    if (o.importBatchId) app.importBatchId = o.importBatchId;
    D.applications.push(app); return app;
  }
  function createWorker(d, o) {
    const at = o.at || stamp();
    const w = {
      id: nextWorkerId(), name: String(d.name).trim().replace(/\s+/g, ' '), gender: d.gender || '', dob: d.dob, nik: digits(d.nik), passport: d.passport ? String(d.passport).toUpperCase().trim() : null, phone: d.phone || '',
      city: d.city || '', province: d.province || CITY_PROV[d.city] || '', address: d.address || '', education: d.education || '', maritalStatus: d.maritalStatus || '',
      source: o.source, createdAt: at, color: BGS.palette[D.workers.length % BGS.palette.length], status: 'ACTIVE', aliasOf: null, aliases: [], consent: o.consent, recruiterId: o.recruiterId, tags: [],
    };
    if (o.importBatchId) w.importBatchId = o.importBatchId;
    if (o.referrer) w.referrer = o.referrer;
    D.workers.push(w); return w;
  }
  /* merge incoming data (registration / manual form) into an existing worker — keeps the existing Worker ID (RUL-001) */
  function mergeIntoWorker(keeper, rec, o) {
    const filled = [];
    [['phone', 'telepon'], ['address', 'alamat'], ['education', 'pendidikan'], ['maritalStatus', 'status pernikahan'], ['gender', 'jenis kelamin']].forEach(([k, l]) => { if (!keeper[k] && rec[k]) { keeper[k] = rec[k]; filled.push(l); } });
    if (!keeper.city && rec.city) { keeper.city = stripProv(rec.city); filled.push('kota'); }
    if (!keeper.province && (rec.province || CITY_PROV[stripProv(rec.city)])) { keeper.province = rec.province || CITY_PROV[stripProv(rec.city)]; filled.push('provinsi'); }
    if (!keeper.passport && rec.passport) { keeper.passport = String(rec.passport).toUpperCase(); filled.push('paspor'); }
    keeper.aliases = keeper.aliases || [];
    if (rec.name && normName(rec.name) !== normName(keeper.name)) { const a = `Nama lain: ${rec.name} (${o.ref})`; if (!keeper.aliases.includes(a)) keeper.aliases.push(a); }
    let app = null, appNote = '';
    if (o.addApp && rec.country && rec.profession) {
      try { app = createApplication(keeper, { country: rec.country, profession: rec.profession, route: o.route, recruiterId: o.recruiterId || keeper.recruiterId, via: `digabung dari ${o.ref}` }); } catch (e) { appNote = e.message; }
    }
    BGS.deriveWorkerStatus();
    return { filled, app, appNote };
  }

  // ---------- small UI helpers ----------
  const field = (label, ...kids) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), ...kids);
  const small = t => h('span', { class: 'muted sm' }, t);
  const wkId = id => h('span', { class: 'mono' }, id);
  const loc = w => [w.city, w.province].filter(Boolean).join(', ') || '—';
  const noPerm = (can, why) => (can ? {} : { disabled: true, title: why });

  /* mini form kit: ui.field nodes + own validation so we can group fields in cards/modals */
  function kit(fields) {
    const nodes = {}, files = {};
    fields.forEach(f => { const ff = Object.assign({}, f); if (f.type === 'file') ff.onFile = file => { files[f.name] = file ? file.name : ''; }; nodes[f.name] = ui.field(ff); const inp = nodes[f.name].input; ['input', 'change'].forEach(ev => inp.addEventListener(ev, () => { if (inp.classList.contains('invalid')) setErr(f.name); })); });
    const get = n => { const i = nodes[n].input; return i.type === 'checkbox' ? i.checked : i.type === 'file' ? (files[n] || '') : String(i.value).trim(); };
    const setErr = (n, msg) => { const w = nodes[n]; const e = BGS.$('.field-err', w); e.textContent = msg || ''; e.style.display = msg ? 'block' : 'none'; w.input.classList.toggle('invalid', !!msg); };
    const values = () => Object.fromEntries(fields.map(f => [f.name, get(f.name)]));
    const validate = () => {
      const v = values(); let ok = true;
      fields.forEach(f => {
        if (f.hidden && f.hidden(v)) { setErr(f.name); return; }
        let msg = null;
        if (f.required && !v[f.name]) msg = 'Wajib diisi'; else if (f.validate && v[f.name] !== '') msg = f.validate(v[f.name], v);
        setErr(f.name, msg); if (msg) ok = false;
      });
      return ok;
    };
    return { nodes, get, setErr, values, validate, node: n => nodes[n], input: n => nodes[n].input };
  }
  const sectionCard = (title, icon, body, subtitle) => ui.card({ title, icon, subtitle, body });

  // data comparison (submission/new data vs. existing worker(s)) — duplicate panel
  const CMP_ROWS = [['Nama', 'name'], ['NIK', 'nik', 'nik'], ['Paspor', 'passport', 'passport'], ['Tanggal lahir', 'dob', 'date'], ['Jenis kelamin', 'gender', 'gender'], ['Telepon', 'phone', 'phone'], ['Kota', 'city', 'city'], ['Pendidikan', 'education']];
  const cmpVal = (rec, key, kind, entityId) => {
    const v = rec[key]; if (v == null || v === '') return '—';
    if (kind === 'nik' || kind === 'passport' || kind === 'phone') return ui.masked(v, kind, entityId);
    if (kind === 'date') return fmt.date(v); if (kind === 'gender') return genderLabel(v); if (kind === 'city') return stripProv(v); return String(v);
  };
  const cmpNorm = (key, v) => (key === 'nik' || key === 'phone' ? digits(v) : key === 'name' ? normName(v) : key === 'city' ? stripProv(v).toLowerCase() : String(v == null ? '' : v).toLowerCase().trim());
  const IDENT_KEYS = ['name', 'nik', 'passport', 'dob', 'phone'];
  function compareTable(rec, matches, leftLabel = 'Data baru', leftId = 'baru') {
    return h('div', { class: 'tbl-scroll' }, h('table', { class: 'wk-cmp' },
      h('thead', null, h('tr', null, h('th', null, 'Data'), h('th', null, leftLabel), matches.map(m => h('th', null, 'Worker ', h('a', { href: `#/workers/${m.worker.id}` }, m.worker.id))))),
      h('tbody', null, CMP_ROWS.map(([label, key, kind]) => h('tr', null, h('th', { scope: 'row' }, label), h('td', null, cmpVal(rec, key, kind, leftId)),
        matches.map(m => { const a = cmpNorm(key, rec[key]), b = cmpNorm(key, m.worker[key]); const same = IDENT_KEYS.includes(key) && a && b && a === b; const diff = a && b && a !== b; return h('td', { class: same ? 'wk-same' : diff ? 'wk-diff' : '' }, cmpVal(m.worker, key, kind, m.worker.id), same && h('span', { class: 'wk-eq' }, 'SAMA')); }))))));
  }

  BGS.addStyle(`
  .wk-cmp{width:100%;border-collapse:collapse;font-size:13px} .wk-cmp th,.wk-cmp td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
  .wk-cmp thead th{background:#F8FAFC;font-size:11.5px;text-transform:uppercase;letter-spacing:.4px;color:#475569} .wk-cmp tbody th{color:var(--muted);font-weight:600;width:120px;font-size:12.5px;white-space:nowrap}
  .wk-same{background:#FEF3C7} .wk-diff{color:#475569} .wk-eq{margin-left:6px;font-size:10px;font-weight:800;background:var(--red);color:#fff;border-radius:6px;padding:1px 5px;vertical-align:middle}
  .wk-head{display:flex;gap:16px;align-items:flex-start;padding:18px;flex-wrap:wrap} .wk-head h1{font-size:22px;font-weight:800;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .wk-head .wk-meta{display:flex;gap:6px 14px;flex-wrap:wrap;margin-top:8px;color:var(--muted);font-size:12.5px} .wk-head-act{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
  .wk-check{display:flex;gap:9px;align-items:flex-start;padding:7px 0;border-bottom:1px dashed var(--line)} .wk-check:last-child{border-bottom:0}
  .wk-check .ico{margin-top:2px} .wk-ok .ico{color:var(--green)} .wk-bad .ico{color:var(--red)} .wk-warn .ico{color:var(--amber-d)}
  .wk-actbtn{display:flex;flex-direction:column;gap:3px;align-items:stretch} .wk-actbtn .btn{width:100%} .wk-actbtn .hint{margin-bottom:6px}
  .wk-lock td{background:#F8FAFC;color:var(--muted)} .wk-drop{border:2px dashed var(--line2);border-radius:12px;padding:30px 20px;text-align:center;background:#F8FAFC;display:flex;flex-direction:column;align-items:center;gap:10px}
  .wk-drop.on{border-color:var(--blue);background:var(--blue-l)} .wk-drop .ico{color:var(--blue)}
  .wk-tips{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px;font-size:13px} .wk-map-sel{min-width:200px}
  .wk-big{font-size:22px;font-weight:800;line-height:1.1} .wk-pill{display:inline-flex;gap:6px;align-items:center}
  .wk-sec{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin:2px 0 -4px}
  .wk-dupbox{border:1px solid #FCA5A5;background:#FEF2F2;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:10px}
  .wk-rowerr td{background:#FEF2F2} .wk-rowdup td{background:#FFFBEB}
  `);

  // ====================================================================
  // dialogs shared by several screens
  // ====================================================================
  const workerOptionList = (matches, exceptId) => {
    const mids = new Set(matches.map(m => m.worker.id));
    const rest = D.workers.filter(w => w.status !== 'ARCHIVED' && !mids.has(w.id) && w.id !== exceptId).sort((a, b) => a.name.localeCompare(b.name));
    return [...matches.map(m => [m.worker.id, `${m.worker.name} · ${m.worker.id} (cocok: ${m.reasons.join(', ').toLowerCase()})`]), ...rest.map(w => [w.id, `${w.name} · ${w.id}`])];
  };

  /* merge incoming data (a registration or a manual form) into an existing worker (A-15b: Admin may merge). */
  function mergeDialog({ rec, matches, ref, leftLabel, onMerged, title = 'Gabung ke worker yang sudah ada' }) {
    const opts = workerOptionList(matches, null);
    const sel = h('select', { class: 'input' }, opts.map(([v, l]) => h('option', { value: v }, l)));
    const reason = h('textarea', { class: 'input', rows: 2, placeholder: 'Contoh: NIK sama, nama berbeda ejaan.' });
    const reasonErr = h('div', { class: 'field-err', style: 'display:none' }, 'Alasan penggabungan wajib diisi (jejak audit).');
    const hasApp = !!(rec.country && rec.profession);
    const addApp = h('input', { type: 'checkbox', checked: hasApp, disabled: !hasApp });
    const cmpHost = h('div'); const info = h('div'); let targetId = opts[0] && opts[0][0];
    const draw = () => {
      targetId = sel.value; const w = D.worker(targetId); BGS.clear(cmpHost); BGS.clear(info); if (!w) return;
      const mm = matches.find(m => m.worker.id === w.id) || { worker: w, reasons: [] };
      cmpHost.appendChild(compareTable(rec, [mm], leftLabel, ref));
      const conf = hasApp && activeAppConflict(w.id, rec.country, rec.profession);
      addApp.disabled = !hasApp || !!conf; if (conf) addApp.checked = false;
      info.appendChild(h('div', { class: 'stack-sm' },
        ui.callout('info', `Worker ID ${w.id} dipertahankan`, 'Data baru TIDAK membuat Worker baru. Kolom kosong di profil diisi dari data ini, dan nama yang berbeda disimpan sebagai alias (RUL-001).'),
        conf && ui.callout('warn', 'Lamaran tidak ditambahkan', `Worker sudah punya lamaran aktif ${D.cn(rec.country)} · ${D.pn(rec.profession)} (${conf.id}). RUL-008: maksimal satu lamaran aktif per negara + profesi.`)));
    };
    sel.addEventListener('change', draw); draw();
    const m = ui.modal({
      title, size: 'lg',
      body: h('div', { class: 'stack' },
        field('Gabung ke worker', sel), cmpHost, info,
        hasApp && h('label', { class: 'field field-check' }, addApp, h('span', null, `Tambahkan lamaran ${D.cn(rec.country)} · ${D.pn(rec.profession)} ke worker ini`)),
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Alasan penggabungan', h('i', { class: 'req' }, '*')), reason, reasonErr),
        small('Admin boleh menggabungkan duplikat tanpa persetujuan Director (asumsi A-15b). Tindakan dicatat di audit.')),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Gabungkan', {
        kind: 'primary', icon: 'merge', onClick: () => {
          if (!reason.value.trim()) { reasonErr.style.display = 'block'; reason.classList.add('invalid'); return; }
          const w = D.worker(targetId); if (!w) return;
          const res = mergeIntoWorker(w, rec, { ref, addApp: addApp.checked, route: rec.route, recruiterId: rec.recruiterId });
          BGS.audit('Worker digabung (data baru)', 'Worker', w.id, `Sumber ${ref}. Alasan: ${reason.value.trim()}. Kolom terisi: ${res.filled.join(', ') || '—'}.${res.app ? ' Lamaran ' + res.app.id + ' dibuat.' : ''}`);
          m.close(); onMerged(w, res, reason.value.trim());
        },
      })],
    });
  }

  // ====================================================================
  // /registrations  (inbox)
  // ====================================================================
  const regMatches = reg => {
    if (reg.status !== 'NEW') return [];
    const ms = findDuplicates(reg);
    if (reg.dupOf && D.worker(reg.dupOf) && !ms.some(m => m.worker.id === reg.dupOf)) ms.unshift({ worker: D.worker(reg.dupOf), reasons: ['Terdeteksi saat pendaftaran'], kinds: new Set(['NIK']), hard: true });
    return ms;
  };
  const dupBadge = ms => (!ms.length ? ui.badge('Aman', 'green', { dot: true }) : ms.some(m => m.hard) ? ui.badge('Duplikat NIK/paspor', 'red', { dot: true, title: ms.map(m => m.worker.id + ': ' + m.reasons.join(', ')).join('\n') }) : ui.badge('Mirip: nama + tgl lahir', 'amber', { dot: true }));
  const regTarget = r => (r.country ? `${D.cn(r.country)} · ${D.pn(r.profession)}` : '—');

  BGS.router.add('/registrations', {
    title: 'Inbox registrasi', roles: OPS, mvp: 1,
    render(ctx) {
      const regs = D.registrations.slice().sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
      const news = regs.filter(r => r.status === 'NEW'), done = regs.filter(r => r.status !== 'NEW');
      const withDup = news.filter(r => regMatches(r).length);
      const cache = new Map(); const ms = r => { if (!cache.has(r.id)) cache.set(r.id, regMatches(r)); return cache.get(r.id); };
      const baseCols = [
        { key: 'name', label: 'Pendaftar', sortable: true, render: r => h('div', null, h('b', null, r.name), h('div', { class: 'muted sm mono' }, r.id)) },
        { key: 'nik', label: 'NIK', render: r => h('span', { class: 'mono' }, BGS.mask.nik(digits(r.nik))) },
        { key: 'country', label: 'Tujuan', render: r => regTarget(r) },
        { key: 'submittedAt', label: 'Masuk', sortable: true, render: r => h('div', null, fmt.dateTime(r.submittedAt), h('div', { class: 'muted sm' }, fmt.rel(r.submittedAt))) },
      ];
      const consentCell = r => { const v = r.consent && r.consent.version; return h('span', { class: 'row gap-sm' }, h('span', { class: 'mono' }, v || '—'), v && v !== curConsent() ? ui.badge('versi lama', 'amber') : null, !v && ui.badge('Tidak ada', 'red')); };
      const filt = [{ key: 'country', label: 'Negara', options: countryOpts() }];
      const search = r => [r.name, r.id, r.phone, r.nik].join(' ');
      const tabNew = () => ui.listView({
        items: news, search, searchPlaceholder: 'Cari nama, ID registrasi, telepon…', filters: filt, sortKey: 'submittedAt', sortDir: -1,
        columns: [...baseCols, { key: 'dup', label: 'Cek duplikat', render: r => dupBadge(ms(r)) }, { key: 'consent', label: 'Consent', render: consentCell }, { key: 'act', label: '', render: r => ui.btn('Tinjau', { sm: true, kind: 'primary', onClick: () => ctx.go('/registrations/' + r.id) }) }],
        rowClass: r => (ms(r).some(m => m.hard) ? 'row-danger' : ms(r).length ? 'row-warn' : ''), onRowClick: r => ctx.go('/registrations/' + r.id),
        empty: ui.emptyState({ icon: 'inbox', title: 'Inbox kosong', text: 'Tidak ada registrasi baru yang menunggu ditinjau. Pendaftaran dari website publik akan muncul di sini.' }),
      });
      const tabDone = () => ui.listView({
        items: done, search, searchPlaceholder: 'Cari nama, ID registrasi…', filters: [...filt, { key: 'status', label: 'Hasil', options: ['ACCEPTED', 'MERGED', 'DISCARDED'].map(s => [s, BGS.ST.registration[s][0]]) }], sortKey: 'submittedAt', sortDir: -1,
        columns: [...baseCols, { key: 'status', label: 'Hasil', render: r => ui.status('registration', r.status) }, { key: 'by', label: 'Ditinjau oleh', render: r => ui.userChip(r.reviewedBy) },
          { key: 'res', label: 'Keterangan', render: r => (r.resultWorkerId ? ui.workerLink(r.resultWorkerId) : r.reason ? small(r.reason) : '—') }],
        onRowClick: r => ctx.go('/registrations/' + r.id),
        empty: ui.emptyState({ icon: 'check-circle', title: 'Belum ada yang ditinjau', text: 'Registrasi yang diterima, digabung, atau dibuang akan tercatat di sini.' }),
      });
      ctx.el.append(
        ui.pageHeader({ title: 'Inbox registrasi', mvp: 1, subtitle: 'Pendaftaran dari website publik masuk sebagai pengajuan, belum menjadi Worker. Worker + lamaran baru dibuat setelah Admin menerima (RUL-003).', breadcrumbs: [{ label: 'Worker & Rekrutmen' }, { label: 'Inbox registrasi' }], actions: [h('a', { class: 'btn', href: 'register.html', target: '_blank' }, BGS.icon('globe', 16), 'Buka form publik')] }),
        h('div', { class: 'grid cols-4' },
          ui.kpi({ label: 'Menunggu ditinjau', value: news.length, sub: 'registrasi baru', tone: 'blue', icon: 'inbox' }),
          ui.kpi({ label: 'Perlu cek duplikat', value: withDup.length, sub: 'NIK / nama mirip', tone: withDup.length ? 'red' : 'green', icon: 'copy' }),
          ui.kpi({ label: 'Diterima', value: done.filter(r => r.status === 'ACCEPTED').length, sub: 'jadi Worker baru', tone: 'green', icon: 'user-plus' }),
          ui.kpi({ label: 'Digabung / dibuang', value: done.filter(r => r.status !== 'ACCEPTED').length, sub: 'tidak membuat Worker', tone: 'teal', icon: 'merge' })),
        ui.card({ flush: true, body: ui.tabs([{ id: 'new', label: 'Baru', count: news.length, render: tabNew }, { id: 'done', label: 'Sudah ditinjau', count: done.length, render: tabDone }], { active: ctx.query.tab === 'done' ? 'done' : 'new' }) }));
    },
  });

  // ====================================================================
  // /registrations/:id  (review, RUL-003)
  // ====================================================================
  const regToData = r => ({ name: r.name, nik: digits(r.nik), dob: r.dob, gender: r.gender, phone: r.phone, city: stripProv(r.city), province: r.province || CITY_PROV[stripProv(r.city)] || '', address: r.address || '', education: r.education, maritalStatus: r.maritalStatus || r.marital || '', passport: r.passport || '', country: r.country, profession: r.profession });
  function regChecks(reg, ms) {
    const nikOk = /^\d{16}$/.test(digits(reg.nik)); const hard = ms.filter(m => m.hard), soft = ms.filter(m => !m.hard);
    const dobOk = validDate(reg.dob) && ageOk(reg.dob);
    return [
      { ok: nikOk, level: 'error', label: 'NIK terdiri dari 16 digit', detail: nikOk ? '' : 'NIK tidak valid — koreksi data atau buang pengajuan.' },
      { ok: !!(reg.consent && reg.consent.version && reg.consent.at), level: 'error', label: 'Bukti consent tercatat (RUL-029)', detail: reg.consent && reg.consent.version ? `Versi ${reg.consent.version}${reg.consent.version !== curConsent() ? ' (bukan versi terbaru)' : ''}` : 'Tidak ada bukti consent — tidak boleh diterima.' },
      { ok: !hard.length, level: 'error', label: 'NIK / paspor belum terdaftar (RUL-002)', detail: hard.length ? hard.map(m => `${m.worker.name} (${m.worker.id}): ${m.reasons.join(', ').toLowerCase()}`).join('; ') : '' },
      { ok: !soft.length, level: 'warn', label: 'Tidak ada nama + tanggal lahir yang mirip', detail: soft.length ? soft.map(m => `${m.worker.name} (${m.worker.id})`).join('; ') : '' },
      { ok: dobOk, level: 'warn', label: 'Tanggal lahir wajar (usia 17–60 tahun)', detail: dobOk ? '' : 'Periksa tanggal lahir.' },
      { ok: !!(reg.country && reg.profession), level: 'warn', label: 'Negara & profesi tujuan terisi', detail: '' },
    ];
  }

  BGS.router.add('/registrations/:id', {
    title: 'Tinjau registrasi', roles: OPS, mvp: 1,
    render(ctx) {
      const reg = D.registration(ctx.params.id);
      if (!reg) { ctx.el.append(ui.pageHeader({ title: 'Registrasi tidak ditemukan', breadcrumbs: [{ label: 'Inbox registrasi', href: '/registrations' }] }), ui.emptyState({ icon: 'search', title: 'ID registrasi tidak ditemukan', text: ctx.params.id, action: h('a', { class: 'btn btn-primary', href: '#/registrations' }, 'Kembali ke inbox') })); return; }
      const isNew = reg.status === 'NEW'; const ms = regMatches(reg); const checks = regChecks(reg, ms);
      const blockers = checks.filter(c => c.level === 'error' && !c.ok);
      const can = BGS.can('registration.review');
      const refresh = () => ctx.refresh();

      // ----- actions -----
      const openBlocked = () => {
        const nikM = ms.filter(m => m.hard);
        const m = ui.modal({
          title: 'Tidak bisa diterima: data sudah ada', size: 'lg',
          body: h('div', { class: 'stack' },
            ui.callout('danger', 'NIK atau paspor sudah terdaftar (RUL-002)', 'Satu orang hanya boleh punya satu Worker ID. Registrasi ini tidak boleh membuat Worker baru. Buka profil yang sudah ada, atau gabungkan data pengajuan ini ke worker tersebut.'),
            compareTable(reg, nikM, 'Pengajuan ini', reg.id)),
          footer: [ui.btn('Tutup', { onClick: () => m.close() }), ...nikM.slice(0, 2).map(x => h('a', { class: 'btn', href: '#/workers/' + x.worker.id, onClick: () => m.close() }, BGS.icon('user', 16), 'Buka profil ' + x.worker.id)), ui.btn('Gabung ke worker ini', { kind: 'primary', icon: 'merge', onClick: () => { m.close(); openMerge(); } })],
        });
      };
      const openAccept = () => {
        if (blockers.length) {
          if (blockers.some(b => b.label.includes('RUL-002'))) return openBlocked();
          const m = ui.modal({ title: 'Belum bisa diterima', size: 'sm', body: h('div', { class: 'stack-sm' }, ui.callout('danger', 'Perbaiki dulu', 'Ada pemeriksaan yang belum lolos:'), h('ul', { class: 'wk-tips' }, blockers.map(b => h('li', null, b.label, b.detail ? ' — ' + b.detail : '')))), footer: [ui.btn('Tutup', { onClick: () => m.close() })] });
          return;
        }
        const k = kit([
          { name: 'route', label: 'Jalur penempatan', type: 'select', options: routeOpts(reg.country), value: defaultRoute(reg.country), required: true, hidden: () => !reg.country },
          { name: 'recruiter', label: 'Recruiter (pemilik data)', type: 'select', options: staffAdmins().map(u => [u.id, u.name]), value: defaultRecruiter(), required: true },
        ]);
        const nextId = `BGS-W-${BGS.today.getFullYear()}-${pad(Math.max(issued.w, maxSeq(D.workers.flatMap(w => [w.id, ...(w.aliases || [])]), /^BGS-W-\d{4}-(\d+)$/)) + 1, 5)}`;
        const m = ui.modal({
          title: 'Terima registrasi', size: 'md',
          body: h('div', { class: 'stack' },
            ui.callout('info', 'Yang akan dibuat', h('span', null, 'Worker baru ', h('b', { class: 'mono' }, nextId), ' dan lamaran (status Diajukan) untuk ', h('b', null, regTarget(reg)), '. Tidak ada kuota yang dipakai (RUL-004).')),
            ui.kv([['Nama', reg.name], ['NIK', BGS.mask.nik(digits(reg.nik))], ['Consent', `${reg.consent.version} · ${fmt.dateTime(reg.consent.at)} · ${reg.consent.channel}`]]),
            h('div', { class: 'form-grid cols-2' }, k.node('route'), k.node('recruiter'))),
          footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Terima & buat Worker', {
            kind: 'good', icon: 'check', onClick: () => {
              if (!k.validate()) return;
              const v = k.values(); const d = regToData(reg);
              const again = findDuplicates(d).filter(x => x.hard); if (again.length) { m.close(); refresh(); return; }
              try {
                const w = createWorker(d, { source: 'Website', recruiterId: v.recruiter, consent: { version: reg.consent.version, at: reg.consent.at, channel: reg.consent.channel || 'Website', evidence: 'Registrasi website ' + reg.id } });
                let app = null; if (reg.country && reg.profession) app = createApplication(w, { country: reg.country, profession: reg.profession, route: v.route, recruiterId: v.recruiter, via: 'dari registrasi ' + reg.id });
                Object.assign(reg, { status: 'ACCEPTED', reviewedBy: BGS.state.userId, reviewedAt: stamp(), resultWorkerId: w.id, resultAppId: app && app.id });
                BGS.deriveWorkerStatus();
                BGS.audit('Registrasi diterima', 'Registration', reg.id, `Worker ${w.id}${app ? ' + lamaran ' + app.id : ''} dibuat`);
                BGS.audit('Worker dibuat dari registrasi', 'Worker', w.id, `Sumber ${reg.id} (Website), consent ${reg.consent.version}`);
                if (app) BGS.notify(app.picId, `Lamaran baru perlu screening: ${w.name} (${D.cn(app.country)} · ${D.pn(app.profession)})`, '#/applications/' + app.id, 'TASK_ASSIGNED');
                m.close(); ui.toast(`Registrasi diterima — Worker ${w.id} dibuat`); ctx.go('/workers/' + w.id);
              } catch (e) { ui.toast(e.message, 'danger'); }
            },
          })],
        });
      };
      function openMerge() {
        if (!ms.length && !D.workers.length) return;
        const d = regToData(reg); d.route = defaultRoute(reg.country); d.recruiterId = defaultRecruiter();
        mergeDialog({
          rec: d, matches: ms, ref: reg.id, leftLabel: 'Pengajuan ini',
          onMerged: (w, res, reason) => {
            Object.assign(reg, { status: 'MERGED', reviewedBy: BGS.state.userId, reviewedAt: stamp(), resultWorkerId: w.id, reason, resultAppId: res.app ? res.app.id : null });
            BGS.audit('Registrasi digabung', 'Registration', reg.id, `Digabung ke ${w.id}. Alasan: ${reason}`);
            ui.toast(`Digabung ke ${w.name} (${w.id})${res.app ? ' · lamaran ' + res.app.id + ' ditambahkan' : ''}`); if (res.appNote) ui.toast(res.appNote, 'warn'); ctx.go('/workers/' + w.id);
          },
        });
      }
      const openDiscard = async () => {
        const reason = await ui.reasonPrompt({ title: 'Buang registrasi', message: `Pengajuan ${reg.name} tidak akan menjadi Worker. Data tetap tersimpan sebagai riwayat.`, label: 'Alasan membuang', confirmLabel: 'Buang registrasi', tone: 'danger', presets: ['Spam / data uji', 'Data tidak valid', 'Duplikat tanpa data baru', 'Calon worker mengundurkan diri'] });
        if (!reason) return;
        Object.assign(reg, { status: 'DISCARDED', reviewedBy: BGS.state.userId, reviewedAt: stamp(), reason });
        BGS.audit('Registrasi dibuang', 'Registration', reg.id, 'Alasan: ' + reason); ui.toast('Registrasi dibuang'); ctx.go('/registrations');
      };
      const openCorrect = () => {
        const k = kit([
          { name: 'name', label: 'Nama sesuai KTP', value: reg.name, required: true }, { name: 'nik', label: 'NIK (16 digit)', value: digits(reg.nik), required: true, validate: v => (/^\d{16}$/.test(v) ? null : 'NIK harus 16 digit angka') },
          { name: 'dob', label: 'Tanggal lahir', type: 'date', value: reg.dob, required: true, validate: v => (validDate(v) && ageOk(v) ? null : 'Tanggal tidak valid (usia 17–60)') }, { name: 'phone', label: 'Telepon', value: reg.phone, required: true },
          { name: 'reason', label: 'Alasan koreksi', required: true, span: 2, placeholder: 'Contoh: salah ketik NIK, dikonfirmasi lewat telepon' },
        ]);
        const m = ui.modal({ title: 'Koreksi data pengajuan', size: 'md', body: h('div', { class: 'stack' }, small('Koreksi hanya untuk salah ketik yang sudah dikonfirmasi ke calon worker. Perubahan dicatat di audit.'), h('div', { class: 'form-grid cols-2' }, ['name', 'nik', 'dob', 'phone', 'reason'].map(n => k.node(n)))),
          footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Simpan koreksi', { kind: 'primary', onClick: () => { if (!k.validate()) return; const v = k.values(); const ch = ['name', 'nik', 'dob', 'phone'].filter(f => String(reg[f] || '') !== v[f]); Object.assign(reg, { name: v.name, nik: v.nik, dob: v.dob, phone: v.phone }); BGS.audit('Data registrasi dikoreksi', 'Registration', reg.id, `Kolom: ${ch.join(', ') || '—'}. Alasan: ${v.reason}`); m.close(); ui.toast('Data pengajuan dikoreksi'); refresh(); } })] });
      };

      // ----- layout -----
      const left = h('div', { class: 'stack' });
      left.appendChild(ui.card({ title: 'Data pendaftar', icon: 'user', actions: isNew && can ? [ui.btn('Koreksi data', { sm: true, icon: 'edit', onClick: openCorrect })] : null, body: ui.kv([
        ['Nama', reg.name], ['NIK', ui.masked(digits(reg.nik), 'nik', reg.id)], ['Tanggal lahir', reg.dob ? `${fmt.date(reg.dob)} (${fmt.age(reg.dob)} th)` : '—'], ['Jenis kelamin', genderLabel(reg.gender)],
        ['Telepon', ui.masked(reg.phone, 'phone', reg.id)], ['Kota / provinsi', [stripProv(reg.city), reg.province].filter(Boolean).join(', ') || '—'], ['Pendidikan', reg.education], ['Status pernikahan', reg.maritalStatus || reg.marital],
        ['Tujuan', regTarget(reg)], ['Pengalaman kerja', reg.experience], ['Berkas terlampir', [reg.photoName && `Foto: ${reg.photoName}`, reg.cvName && `CV: ${reg.cvName}`].filter(Boolean).join(' · ') || 'Tidak ada (dokumen diunggah saat screening)'], ['Perangkat', reg.userAgent]], 2) }));
      left.appendChild(ui.card({
        title: 'Deteksi duplikat', icon: 'copy', subtitle: 'Dibandingkan dengan seluruh worker non-arsip (NIK, paspor, nama + tanggal lahir)',
        body: !isNew ? small('Pengecekan hanya relevan untuk registrasi yang masih baru.') : ms.length ? h('div', { class: 'stack' },
          ui.callout(ms.some(m => m.hard) ? 'danger' : 'warn', ms.some(m => m.hard) ? `${ms.filter(m => m.hard).length} worker punya NIK / paspor yang sama` : 'Ada worker dengan nama dan tanggal lahir mirip', ms.some(m => m.hard) ? 'Registrasi ini tidak boleh membuat Worker baru (RUL-002). Gabungkan atau buang.' : 'Pastikan ini bukan orang yang sama sebelum menerima.'),
          compareTable(reg, ms.slice(0, 3), 'Pengajuan ini', reg.id)) : ui.callout('good', 'Tidak ada duplikat', 'NIK, paspor, dan kombinasi nama + tanggal lahir belum ada di database worker.'),
      }));

      const right = h('div', { class: 'stack' });
      // result / decision
      if (isNew) {
        right.appendChild(ui.card({ title: 'Keputusan Admin', icon: 'check-square', subtitle: 'Pilih salah satu. Semua tercatat di audit.', body: h('div', { class: 'stack' },
          !can && ui.callout('warn', 'Hanya baca', 'Peran Anda tidak berwenang meninjau registrasi.'),
          h('div', { class: 'wk-actbtn' }, h('span', { class: 'hint' }, 'Membuat Worker + lamaran baru. Diblok bila NIK/paspor sudah ada.'), ui.btn('Terima', Object.assign({ kind: 'good', icon: 'check-circle', onClick: openAccept }, noPerm(can, 'Hanya Admin / Superadmin'))), blockers.length ? h('span', { class: 'sm', style: 'color:var(--red);font-weight:600' }, `Perlu perhatian: ${blockers[0].label}`) : null),
          h('div', { class: 'wk-actbtn' }, h('span', { class: 'hint' }, 'Orang ini sudah punya Worker ID. Data digabung, ID tertua dipertahankan.'), ui.btn('Gabung ke worker yang sudah ada', Object.assign({ kind: 'warn', icon: 'merge', onClick: openMerge }, noPerm(can, 'Hanya Admin / Superadmin')))),
          h('div', { class: 'wk-actbtn' }, h('span', { class: 'hint' }, 'Spam, data uji, atau tidak valid. Alasan wajib (RUL-022).'), ui.btn('Buang', Object.assign({ kind: 'danger', icon: 'trash', onClick: openDiscard }, noPerm(can, 'Hanya Admin / Superadmin'))))) }));
      } else {
        const tone = reg.status === 'ACCEPTED' ? 'good' : reg.status === 'MERGED' ? 'info' : 'warn';
        right.appendChild(ui.card({ title: 'Hasil tinjauan', icon: 'check-circle', body: h('div', { class: 'stack' },
          ui.callout(tone, BGS.ST.registration[reg.status][0], reg.reason ? 'Alasan: ' + reg.reason : reg.status === 'ACCEPTED' ? 'Worker dan lamaran dibuat dari pengajuan ini.' : reg.status === 'MERGED' ? 'Data digabung ke worker yang sudah ada.' : ''),
          ui.kv([['Status', ui.status('registration', reg.status)], ['Ditinjau oleh', ui.userChip(reg.reviewedBy)], ['Waktu', reg.reviewedAt ? fmt.dateTime(reg.reviewedAt) : '—'], ['Worker', reg.resultWorkerId ? ui.workerLink(reg.resultWorkerId) : '—'], ['Lamaran', reg.resultAppId ? ui.appLink(reg.resultAppId) : '—']])) }));
      }
      right.appendChild(ui.card({ title: 'Pemeriksaan otomatis', icon: 'shield', body: h('div', null, checks.map(c => h('div', { class: `wk-check ${c.ok ? 'wk-ok' : c.level === 'error' ? 'wk-bad' : 'wk-warn'}` }, BGS.icon(c.ok ? 'check-circle' : c.level === 'error' ? 'x-circle' : 'alert', 18), h('div', null, h('b', null, c.label), c.detail && h('div', { class: 'muted sm' }, c.detail))))) }));
      right.appendChild(ui.card({ title: 'Bukti consent', icon: 'file-text', subtitle: 'RUL-029 · wajib sebelum data disimpan', body: reg.consent ? ui.kv([
        ['Versi pemberitahuan', h('span', { class: 'row gap-sm' }, h('span', { class: 'mono' }, reg.consent.version), reg.consent.version === curConsent() ? ui.badge('terbaru', 'green') : ui.badge('versi lama', 'amber'))], ['Waktu persetujuan', fmt.dateTime(reg.consent.at)], ['Kanal', reg.consent.channel], ['Diterima sistem', fmt.dateTime(reg.submittedAt)]]) : ui.callout('danger', 'Tidak ada bukti consent', 'Registrasi tanpa consent tidak boleh diterima.') }));

      ctx.el.append(
        ui.pageHeader({ title: reg.name, mvp: 1, subtitle: `${reg.id} · masuk ${fmt.dateTime(reg.submittedAt)} (${fmt.rel(reg.submittedAt)})`, breadcrumbs: [{ label: 'Inbox registrasi', href: '/registrations' }, { label: reg.id }], actions: [ui.status('registration', reg.status), isNew ? dupBadge(ms) : null] }),
        h('div', { class: 'grid cols-21' }, left, right));
    },
  });

  // ====================================================================
  // /workers  (database worker)
  // ====================================================================
  const appsOf = id => D.applications.filter(a => a.workerId === id);
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();

  BGS.router.add('/workers', {
    title: 'Worker', roles: ALL, mvp: 1,
    render(ctx) {
      const canWrite = BGS.can('worker.write'), canExport = BGS.can('export');
      const batchQ = ctx.query.batch; let showArchived = false;
      const items = () => BGS.scope.workers().filter(w => (showArchived || w.status !== 'ARCHIVED') && (!batchQ || w.importBatchId === batchQ));
      const scoped = BGS.scope.workers().filter(w => w.status !== 'ARCHIVED');
      const count = s => scoped.filter(w => w.status === s).length;
      let lv;
      const archToggle = h('label', { class: 'row gap-sm sm', style: 'font-weight:600;white-space:nowrap' }, h('input', { type: 'checkbox', onChange: e => { showArchived = e.target.checked; lv.redraw(); } }), 'Tampilkan arsip');
      const exportBtn = ui.btn('Ekspor CSV', Object.assign({ icon: 'download', onClick: () => BGS.exportCsv(items(), [
        { label: 'Worker ID', key: 'id' }, { label: 'Nama', key: 'name' }, { label: 'NIK (disamarkan)', value: w => BGS.mask.nik(w.nik) }, { label: 'Telepon (disamarkan)', value: w => BGS.mask.phone(w.phone) },
        { label: 'Status', value: w => (BGS.ST.worker[w.status] || [w.status])[0] }, { label: 'Sumber', key: 'source' }, { label: 'Provinsi', key: 'province' }, { label: 'Recruiter', value: w => userName(w.recruiterId) },
        { label: 'Jumlah lamaran', value: w => appsOf(w.id).length }, { label: 'Terdaftar', value: w => fmt.date(w.createdAt) }], 'daftar-worker.csv') }, noPerm(canExport, 'Ekspor hanya untuk Superadmin, Director, dan Admin')));
      lv = ui.listView({
        items, searchPlaceholder: 'Cari nama, Worker ID, atau telepon…', sortKey: 'createdAt', sortDir: -1, pageSize: 12,
        search: w => [w.name, w.id, w.phone, ...(w.aliases || [])].join(' '),
        filters: [
          { key: 'status', label: 'Status', options: Object.entries(BGS.ST.worker).map(([k, v]) => [k, v[0]]) },
          { key: 'country', label: 'Negara tujuan', options: countryOpts(), match: (w, v) => appsOf(w.id).some(a => a.country === v) },
          { key: 'source', label: 'Sumber', options: uniq(D.workers.map(w => w.source)) },
          { key: 'province', label: 'Provinsi', options: uniq(D.workers.map(w => w.province)) },
        ],
        columns: [
          { key: 'name', label: 'Worker', sortable: true, render: w => h('div', { class: 'row gap-sm' }, ui.avatar(w.name, w.color, 32), h('div', null, h('a', { class: 'lnk', href: '#/workers/' + w.id }, w.name), h('div', { class: 'muted sm mono' }, w.id)), w.importBatchId && ui.badge('impor', 'gray', { title: w.importBatchId })) },
          { key: 'nik', label: 'NIK', render: w => h('span', { class: 'mono' }, BGS.mask.nik(w.nik)) },
          { key: 'status', label: 'Status', sortable: true, render: w => ui.status('worker', w.status) },
          { key: 'apps', label: 'Lamaran', sortable: true, sortValue: w => appsOf(w.id).length, render: w => { const a = appsOf(w.id); return a.length ? h('div', { class: 'row gap-sm wrap' }, h('b', null, a.length), a.slice(0, 2).map(x => h('span', { class: 'badge b-gray', title: `${x.id} · ${appStatusLabel(x.status)}` }, `${x.country}·${x.profession}`)), a.length > 2 ? small('+' + (a.length - 2)) : null) : small('Belum ada'); } },
          { key: 'recruiter', label: 'Recruiter', render: w => userName(w.recruiterId) },
          { key: 'source', label: 'Sumber', render: w => ui.badge(w.source || '—', w.source === 'Website' ? 'blue' : w.source === 'Impor' ? 'purple' : 'gray') },
          { key: 'province', label: 'Provinsi', render: w => w.province || '—' },
          { key: 'createdAt', label: 'Terdaftar', sortable: true, render: w => fmt.date(w.createdAt) },
        ],
        rowClass: w => (w.status === 'ARCHIVED' ? 'row-warn' : ''), onRowClick: w => ctx.go('/workers/' + w.id),
        toolbar: [archToggle],
        empty: ui.emptyState({ icon: 'users', title: 'Tidak ada worker yang cocok', text: BGS.scope.isLimited() ? 'Anda hanya melihat worker yang ditugaskan kepada Anda.' : 'Ubah kata kunci / filter, atau tambahkan worker baru.', action: canWrite ? h('a', { class: 'btn btn-primary', href: '#/workers/new' }, 'Tambah worker') : null }),
      });
      put(ctx.el,
        ui.pageHeader({
          title: 'Worker', mvp: 1, subtitle: 'Satu orang = satu Worker ID permanen. NIK dan paspor disamarkan; buka profil untuk melihat detail dengan alasan tercatat.', breadcrumbs: [{ label: 'Worker & Rekrutmen' }, { label: 'Worker' }],
          actions: [exportBtn, canWrite ? h('a', { class: 'btn', href: '#/import' }, BGS.icon('upload', 16), 'Impor Excel') : null, h('a', Object.assign({ class: 'btn btn-primary', href: canWrite ? '#/workers/new' : undefined }, canWrite ? {} : { title: 'Hanya Admin / Superadmin yang bisa menambah worker', style: 'opacity:.45;cursor:not-allowed', onClick: e => e.preventDefault() }), BGS.icon('user-plus', 16), 'Tambah worker')],
        }),
        BGS.scope.isLimited() && ui.callout('info', 'Tampilan PIC', 'Anda hanya melihat worker yang punya lamaran atau case yang ditugaskan kepada Anda (RUL-020).'),
        batchQ && ui.callout('info', `Menampilkan worker dari batch impor ${batchQ}`, h('a', { href: '#/workers' }, 'Tampilkan semua worker')),
        h('div', { class: 'grid cols-4' },
          ui.kpi({ label: 'Total worker', value: scoped.length, sub: 'tidak termasuk arsip', tone: 'blue', icon: 'users' }),
          ui.kpi({ label: 'Aktif', value: count('ACTIVE'), sub: 'lamaran berjalan', tone: 'purple', icon: 'activity' }),
          ui.kpi({ label: 'Dalam proses', value: count('IN_PROCESS'), sub: 'Placement Case aktif', tone: 'orange', icon: 'briefcase' }),
          ui.kpi({ label: 'Sudah berangkat', value: count('DEPLOYED'), sub: `${count('INACTIVE')} tidak aktif`, tone: 'green', icon: 'plane' })),
        ui.card({ flush: true, body: lv }));
    },
  });

  // ====================================================================
  // /workers/new  (manual input: walk-in / WhatsApp / referensi)
  // ====================================================================
  BGS.router.add('/workers/new', {
    title: 'Tambah worker', roles: OPS, mvp: 1,
    render(ctx) {
      const opt = (arr, ph) => [['', ph || 'Pilih…'], ...arr.map(x => (Array.isArray(x) ? x : [x, x]))];
      const F = [
        { name: 'name', label: 'Nama sesuai KTP', required: true, placeholder: 'Contoh: Siti Aminah', validate: v => (v.length < 3 ? 'Nama terlalu pendek' : /[^A-Za-z\s.'-]/.test(v) ? 'Nama hanya boleh huruf' : null) },
        { name: 'gender', label: 'Jenis kelamin', type: 'select', options: opt([['L', 'Laki-laki'], ['P', 'Perempuan']]), required: true },
        { name: 'dob', label: 'Tanggal lahir', type: 'date', required: true, validate: v => (validDate(v) && ageOk(v) ? null : 'Tanggal tidak valid (usia harus 17–60 tahun)') },
        { name: 'nik', label: 'NIK (16 digit)', required: true, placeholder: '16 digit angka', hint: 'Harus unik (RUL-002).', validate: v => (/^\d{16}$/.test(v) ? null : 'NIK harus tepat 16 digit angka') },
        { name: 'passport', label: 'Nomor paspor (jika ada)', placeholder: 'Contoh: C1234567', hint: 'Harus unik bila diisi.', validate: v => (/^[A-Za-z]\d{7}$/.test(v) ? null : 'Format: 1 huruf + 7 angka, contoh C1234567') },
        { name: 'phone', label: 'Telepon / WhatsApp', required: true, placeholder: '0812xxxxxxxx', validate: v => (/^(08|628)\d{7,12}$/.test(digits(v)) ? null : 'Nomor telepon tidak valid') },
        { name: 'address', label: 'Alamat lengkap', required: true, span: 2, placeholder: 'Dusun / RT RW, desa, kecamatan' },
        { name: 'city', label: 'Kota / kabupaten', required: true }, { name: 'province', label: 'Provinsi', type: 'select', options: opt(PROVINCES), required: true },
        { name: 'education', label: 'Pendidikan terakhir', type: 'select', options: opt(EDU), required: true }, { name: 'maritalStatus', label: 'Status pernikahan', type: 'select', options: opt(MARITAL), required: true },
        { name: 'source', label: 'Sumber pendaftaran', type: 'select', options: opt(['Walk-in', 'WhatsApp', 'Referensi']), required: true },
        { name: 'referrer', label: 'Nama perujuk (bila Referensi)', placeholder: 'Opsional' },
        { name: 'recruiter', label: 'Recruiter (pemilik data)', type: 'select', options: staffAdmins().map(u => [u.id, u.name]), value: defaultRecruiter(), required: true },
        { name: 'consentVersion', label: 'Versi pemberitahuan privasi', type: 'select', options: D.consentVersions.map(c => [c.version, c.version + (c.current ? ' (terbaru)' : '')]), value: curConsent(), required: true },
        { name: 'consentDate', label: 'Tanggal persetujuan diberikan', type: 'date', value: BGS.today.toISOString().slice(0, 10), required: true, validate: v => (!validDate(v) ? 'Tanggal tidak valid' : new Date(v) > BGS.today ? 'Tidak boleh di masa depan' : null) },
        { name: 'evidenceType', label: 'Jenis bukti consent', type: 'select', options: opt(EVIDENCE_TYPES), required: true },
        { name: 'evidenceFile', label: 'Berkas bukti consent', type: 'file', required: true, hint: 'Unggah scan formulir / rekaman / tangkapan layar (simulasi: hanya nama file dicatat).' },
        { name: 'wantApp', label: 'Buat lamaran pertama sekarang', type: 'checkbox', value: true },
        { name: 'country', label: 'Negara tujuan', type: 'select', options: opt(countryOpts()), hidden: v => !v.wantApp, required: true },
        { name: 'profession', label: 'Profesi', type: 'select', options: opt(profOpts()), hidden: v => !v.wantApp, required: true },
        { name: 'route', label: 'Jalur penempatan', type: 'select', options: opt([], 'Pilih negara dulu'), hidden: v => !v.wantApp, required: true },
      ];
      const k = kit(F);
      const grp = (names, cols = 2) => h('div', { class: `form-grid cols-${cols}` }, names.map(n => k.node(n)));
      const dupHost = h('div');
      const appBox = h('div', { class: 'stack' }, grp(['country', 'profession', 'route'], 3), small('Lamaran dibuat dengan status "Diajukan". Kuota belum terpakai (RUL-004). Maksimal satu lamaran aktif per negara + profesi (RUL-008).'));
      const wantApp = k.input('wantApp'); const syncApp = () => { appBox.style.display = wantApp.checked ? '' : 'none'; };
      wantApp.addEventListener('change', syncApp);
      k.input('country').addEventListener('change', e => { const sel = k.input('route'); BGS.clear(sel); sel.appendChild(h('option', { value: '' }, e.target.value ? 'Pilih jalur…' : 'Pilih negara dulu')); routeOpts(e.target.value).forEach(([v, l]) => sel.appendChild(h('option', { value: v }, l))); if (e.target.value) sel.value = defaultRoute(e.target.value); });
      const record = () => { const v = k.values(); return { name: v.name, nik: digits(v.nik), passport: v.passport.toUpperCase(), dob: v.dob, gender: v.gender, phone: digits(v.phone), city: v.city, province: v.province, address: v.address, education: v.education, maritalStatus: v.maritalStatus, country: v.wantApp ? v.country : '', profession: v.wantApp ? v.profession : '', route: v.route, recruiterId: v.recruiter }; };

      const showDup = (ms, blocked) => {
        BGS.clear(dupHost); if (!ms.length) return;
        const rec = record();
        dupHost.appendChild(h('div', { class: blocked ? 'wk-dupbox' : 'wk-dupbox', style: blocked ? '' : 'border-color:#FCD34D;background:#FFFBEB' },
          ui.callout(blocked ? 'danger' : 'warn', blocked ? 'NIK / paspor sudah terdaftar — tidak bisa disimpan (RUL-002)' : 'Ada worker dengan nama + tanggal lahir mirip', blocked ? 'Satu orang hanya boleh punya satu Worker ID. Buka profil yang ada, atau gabungkan data ini ke worker tersebut.' : 'Periksa dulu apakah ini orang yang sama.'),
          compareTable(rec, ms.slice(0, 3), 'Data yang diinput', 'input-baru'),
          h('div', { class: 'row wrap gap-sm' }, ms.slice(0, 2).map(m => h('a', { class: 'btn', href: '#/workers/' + m.worker.id }, BGS.icon('user', 16), 'Buka profil ' + m.worker.id)),
            ui.btn('Gabung ke worker yang sudah ada', { kind: 'primary', icon: 'merge', onClick: () => mergeDialog({ rec: Object.assign(record(), { route: rec.route || defaultRoute(rec.country) }), matches: ms, ref: 'input manual', leftLabel: 'Data yang diinput', onMerged: (w, res) => { ui.toast(`Data digabung ke ${w.name} (${w.id})`); if (res.appNote) ui.toast(res.appNote, 'warn'); ctx.go('/workers/' + w.id); } }) }))));
      };
      const live = () => { const v = k.values(); const ms = findDuplicates({ nik: v.nik, passport: v.passport, name: v.name, dob: v.dob }); showDup(ms, ms.some(m => m.hard)); };
      ['nik', 'passport'].forEach(n => k.input(n).addEventListener('input', () => { const v = digits(k.get('nik')); if (n === 'passport' ? /^[A-Za-z]\d{7}$/.test(k.get('passport')) : v.length === 16) live(); else if (!k.get('nik') && !k.get('passport')) BGS.clear(dupHost); }));

      const save = async () => {
        if (!k.validate()) { ui.toast('Lengkapi kolom yang wajib diisi dan perbaiki kolom bertanda merah', 'warn'); const bad = BGS.$('.input.invalid', ctx.el); bad && bad.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        const v = k.values(); const rec = record(); const all = findDuplicates(rec); const hard = all.filter(m => m.hard);
        if (hard.length) { showDup(all, true); ui.toast('NIK / paspor sudah terdaftar — data tidak disimpan (RUL-002)', 'danger'); dupHost.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
        if (all.length) { const ok = await ui.confirm({ title: 'Mungkin duplikat', message: `Ada worker dengan nama dan tanggal lahir mirip: ${all.map(m => `${m.worker.name} (${m.worker.id})`).join(', ')}. Tetap simpan sebagai worker baru?`, confirmLabel: 'Ya, simpan sebagai baru', tone: 'warn' }); if (!ok) { showDup(all, false); return; } }
        try {
          const at = new Date(v.consentDate + 'T09:00:00+07:00').toISOString();
          const w = createWorker(rec, { source: v.source, recruiterId: v.recruiter, referrer: v.referrer || null, consent: { version: v.consentVersion, at, channel: v.evidenceType + ' (dicatat Admin)', evidence: v.evidenceFile } });
          let app = null; if (rec.country && rec.profession) app = createApplication(w, { country: rec.country, profession: rec.profession, route: v.route, recruiterId: v.recruiter, via: 'input manual' });
          BGS.deriveWorkerStatus();
          BGS.audit('Worker dibuat (input manual)', 'Worker', w.id, `Sumber ${v.source}. Bukti consent ${v.consentVersion}: ${v.evidenceType} — ${v.evidenceFile}${app ? '. Lamaran ' + app.id : ''}`);
          if (app) BGS.notify(app.picId, `Lamaran baru perlu screening: ${w.name} (${D.cn(app.country)} · ${D.pn(app.profession)})`, '#/applications/' + app.id, 'TASK_ASSIGNED');
          ui.toast(`Worker ${w.id} dibuat${app ? ' beserta lamaran ' + app.id : ''}`); ctx.go('/workers/' + w.id);
        } catch (e) { ui.toast(e.message, 'danger'); }
      };
      const wrapSec = (t, icon, sub, body) => ui.card({ title: t, icon, subtitle: sub, body });
      ctx.el.append(
        ui.pageHeader({ title: 'Tambah worker', mvp: 1, subtitle: 'Untuk pendaftar walk-in, WhatsApp, atau referensi. Bukti consent wajib dicatat (RUL-029).', breadcrumbs: [{ label: 'Worker', href: '/workers' }, { label: 'Tambah worker' }] }),
        h('div', { class: 'stack' },
          wrapSec('1. Identitas', 'user', 'NIK dicek unik langsung saat diketik', h('div', { class: 'stack' }, grp(['name', 'gender', 'dob', 'nik', 'passport']), dupHost)),
          wrapSec('2. Kontak & alamat', 'phone', null, grp(['phone', 'address', 'city', 'province'])),
          wrapSec('3. Latar belakang', 'clipboard', null, grp(['education', 'maritalStatus'])),
          wrapSec('4. Sumber & recruiter', 'users', null, grp(['source', 'referrer', 'recruiter'])),
          wrapSec('5. Bukti consent (wajib)', 'file-text', 'RUL-029 · tanpa bukti consent worker tidak bisa disimpan', h('div', { class: 'stack' }, ui.callout('warn', 'Pastikan calon worker sudah setuju datanya diproses', 'Catat versi pemberitahuan privasi, tanggal, dan bukti persetujuan (formulir bertanda tangan atau rekaman). Teks pemberitahuan perlu verifikasi hukum.'), grp(['consentVersion', 'consentDate', 'evidenceType', 'evidenceFile']))),
          wrapSec('6. Lamaran pertama (opsional)', 'briefcase', null, h('div', { class: 'stack' }, k.node('wantApp'), appBox)),
          h('div', { class: 'form-actions' }, h('a', { class: 'btn', href: '#/workers' }, 'Batal'), ui.btn('Simpan worker', { kind: 'primary', icon: 'check', onClick: save }))));
      syncApp();
    },
  });

  // ====================================================================
  // merge two existing workers (profile action)
  // ====================================================================
  const olderFirst = (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id);
  function mergePreflight(a, b) {
    const [keeper, loser] = [a, b].sort(olderFirst);
    const out = { keeper, loser, error: null, cancel: [], apps: D.applications.filter(x => x.workerId === loser.id), cases: D.cases.filter(c => c.workerId === loser.id), docs: D.documents.filter(d => d.ownerType === 'worker' && d.ownerId === loser.id) };
    if (D.cases.some(c => c.workerId === keeper.id && ACTIVE_CASE.includes(c.status)) && out.cases.some(c => ACTIVE_CASE.includes(c.status))) { out.error = 'Kedua worker punya Placement Case aktif. Satu worker hanya boleh punya satu case aktif (RUL-009) — selesaikan salah satu dulu.'; return out; }
    for (const la of out.apps) {
      if (TERMINAL_APP.includes(la.status)) continue; const ka = activeAppConflict(keeper.id, la.country, la.profession); if (!ka) continue;
      const newer = olderFirst(ka, la) <= 0 ? la : ka;
      if (newer.caseId) { out.error = `Lamaran ${newer.id} (${D.cn(newer.country)} · ${D.pn(newer.profession)}) ganda tetapi sudah punya Placement Case. Selesaikan manual dulu.`; return out; }
      out.cancel.push(newer);
    }
    return out;
  }
  function doMergeWorkers(pf, reason) {
    const { keeper, loser } = pf;
    pf.cancel.forEach(a => { a.status = 'CANCELLED'; a.history.push({ at: stamp(), by: BGS.state.userId, text: 'Dibatalkan otomatis saat penggabungan worker: lamaran ganda (RUL-008)' }); });
    pf.apps.forEach(a => { a.workerId = keeper.id; a.history.push({ at: stamp(), by: BGS.state.userId, text: `Dipindahkan dari ${loser.id} ke ${keeper.id} (penggabungan worker)` }); });
    pf.cases.forEach(c => { c.workerId = keeper.id; }); pf.docs.forEach(d => { d.ownerId = keeper.id; });
    D.registrations.forEach(r => { if (r.resultWorkerId === loser.id) r.resultWorkerId = keeper.id; }); (D.subjectRequests || []).forEach(s => { if (s.subject === loser.id) s.subject = keeper.id; });
    ['phone', 'address', 'city', 'province', 'education', 'maritalStatus', 'gender'].forEach(f => { if (!keeper[f] && loser[f]) keeper[f] = loser[f]; }); if (!keeper.passport && loser.passport) keeper.passport = loser.passport;
    keeper.aliases = [...(keeper.aliases || []), loser.id, ...(loser.aliases || [])]; if (normName(loser.name) !== normName(keeper.name)) keeper.aliases.push(`Nama lain: ${loser.name} (${loser.id})`);
    loser.status = 'ARCHIVED'; loser.aliasOf = keeper.id; loser.aliases = []; loser.archivedAt = stamp(); loser.archiveReason = `Digabung ke ${keeper.id}`;
    BGS.deriveWorkerStatus();
    BGS.audit('Worker digabung', 'Worker', keeper.id, `${loser.id} → ${keeper.id}. ${pf.apps.length} lamaran, ${pf.cases.length} case, ${pf.docs.length} dokumen dipindahkan.${pf.cancel.length ? ' Lamaran ganda dibatalkan: ' + pf.cancel.map(a => a.id).join(', ') + '.' : ''} Alasan: ${reason}`);
    BGS.audit('Worker menjadi alias', 'Worker', loser.id, `Alias read-only dari ${keeper.id}`);
    return keeper;
  }
  function openMergeWorkers(w, ctx) {
    const others = D.workers.filter(x => x.status !== 'ARCHIVED' && x.id !== w.id).sort((a, b) => a.name.localeCompare(b.name));
    const sims = findDuplicates(w, w.id); const simIds = new Set(sims.map(s => s.worker.id));
    const sel = h('select', { class: 'input' }, h('option', { value: '' }, 'Pilih worker yang akan digabung…'), sims.length ? h('optgroup', { label: 'Kemungkinan duplikat' }, sims.map(s => h('option', { value: s.worker.id }, `${s.worker.name} · ${s.worker.id} (${s.reasons.join(', ').toLowerCase()})`))) : null,
      h('optgroup', { label: 'Semua worker' }, others.filter(x => !simIds.has(x.id)).map(x => h('option', { value: x.id }, `${x.name} · ${x.id}`))));
    const reason = h('textarea', { class: 'input', rows: 2, placeholder: 'Contoh: data ganda dari impor Excel dan registrasi website.' });
    const err = h('div', { class: 'field-err', style: 'display:none' }, 'Alasan wajib diisi.'); const host = h('div', { class: 'stack' }); let pf = null;
    const draw = () => {
      BGS.clear(host); pf = null; const o = D.worker(sel.value); if (!o) { host.appendChild(small('Pilih worker lain untuk melihat perbandingan.')); return; }
      pf = mergePreflight(w, o);
      host.appendChild(compareTable(o, [{ worker: w }].map(x => ({ worker: x.worker, reasons: [] })), `${o.name} (${o.id})`, o.id));
      host.appendChild(ui.callout(pf.error ? 'danger' : 'info', pf.error ? 'Tidak bisa digabung' : `Worker ID ${pf.keeper.id} dipertahankan (paling tua)`, pf.error || `${pf.loser.id} menjadi alias read-only. Dipindahkan: ${pf.apps.length} lamaran, ${pf.cases.length} case, ${pf.docs.length} dokumen (RUL-001).`));
      if (pf.cancel.length) host.appendChild(ui.callout('warn', 'Lamaran ganda dibatalkan otomatis (RUL-008)', pf.cancel.map(a => `${a.id} (${D.cn(a.country)} · ${D.pn(a.profession)})`).join(', ')));
      go.disabled = !!pf.error;
    };
    const go = ui.btn('Gabungkan worker', { kind: 'primary', icon: 'merge', disabled: true, onClick: () => { if (!pf || pf.error) return; if (!reason.value.trim()) { err.style.display = 'block'; reason.classList.add('invalid'); return; } const k = doMergeWorkers(pf, reason.value.trim()); m.close(); ui.toast(`Digabung ke ${k.id}. ${pf.loser.id} kini alias.`); ctx.go('/workers/' + k.id); } });
    sel.addEventListener('change', draw); draw();
    const m = ui.modal({ title: `Gabung duplikat dengan ${w.name}`, size: 'lg', body: h('div', { class: 'stack' }, small('Perbandingan: kolom kiri worker yang dipilih, kolom kanan profil ini.'), field('Worker lain', sel), host, h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Alasan penggabungan', h('i', { class: 'req' }, '*')), reason, err), small('Admin boleh menggabungkan tanpa persetujuan Director (A-15b). Tercatat di audit.')), footer: [ui.btn('Batal', { onClick: () => m.close() }), go] });
  }

  // ====================================================================
  // /workers/:id  (Profil 360°, BR-032)
  // ====================================================================
  const statusReason = (w, cases, apps) => {
    if (w.status === 'ARCHIVED') return w.archiveReason ? `Diarsipkan: ${w.archiveReason}` : 'Diarsipkan (soft delete, RUL-026).';
    const act = cases.find(c => ACTIVE_CASE.includes(c.status));
    if (act) return `Ada Placement Case aktif ${act.id} (${BGS.ST.case[act.status][0]}).`;
    if (w.status === 'DEPLOYED') return 'Case terakhir sudah berstatus Berangkat.';
    if (w.status === 'ACTIVE') return 'Ada lamaran aktif dan belum ada case aktif.';
    return 'Tidak ada lamaran aktif maupun case aktif.';
  };
  const docPreview = (d, restricted) => {
    const dt = D.docType(d.typeId) || { name: d.typeId };
    const m = ui.modal({ title: dt.name, size: 'md', body: h('div', { class: 'stack' }, h('div', { class: 'wk-drop' }, BGS.icon('file-text', 40), h('b', null, d.filename), small(`${d.sizeKb} KB · versi ${d.version} · diunggah ${fmt.dateTime(d.uploadedAt)}`)), ui.callout('info', 'Pratinjau disimulasikan', restricted ? 'Akses dokumen RESTRICTED sudah tercatat di audit trail beserta alasannya (RUL-021).' : 'Prototipe tidak menyimpan berkas sungguhan.')), footer: [ui.btn('Tutup', { onClick: () => m.close() })] });
  };

  function openAddApplication(w, ctx) {
    const k = kit([
      { name: 'country', label: 'Negara tujuan', type: 'select', options: [['', 'Pilih…'], ...countryOpts()], required: true }, { name: 'profession', label: 'Profesi', type: 'select', options: [['', 'Pilih…'], ...profOpts()], required: true },
      { name: 'route', label: 'Jalur penempatan', type: 'select', options: [['', 'Pilih negara dulu']], required: true, span: 2 },
    ]);
    const errHost = h('div');
    k.input('country').addEventListener('change', e => { const sel = k.input('route'); BGS.clear(sel); sel.appendChild(h('option', { value: '' }, e.target.value ? 'Pilih jalur…' : 'Pilih negara dulu')); routeOpts(e.target.value).forEach(([v, l]) => sel.appendChild(h('option', { value: v }, l))); if (e.target.value) sel.value = defaultRoute(e.target.value); });
    const m = ui.modal({
      title: 'Tambah lamaran', size: 'md',
      body: h('div', { class: 'stack' }, small(`Untuk ${w.name} (${w.id}). Maksimal satu lamaran aktif per negara + profesi (RUL-008); kuota belum terpakai (RUL-004).`), h('div', { class: 'form-grid cols-2' }, ['country', 'profession', 'route'].map(n => k.node(n))), errHost),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Buat lamaran', { kind: 'primary', onClick: () => {
        BGS.clear(errHost); if (!k.validate()) return; const v = k.values();
        try {
          const app = createApplication(w, { country: v.country, profession: v.profession, route: v.route, recruiterId: w.recruiterId, via: 'ditambahkan dari profil worker' });
          BGS.deriveWorkerStatus(); BGS.audit('Lamaran dibuat', 'Application', app.id, `Worker ${w.id}: ${D.cn(app.country)} · ${D.pn(app.profession)}`);
          BGS.notify(app.picId, `Lamaran baru perlu screening: ${w.name} (${D.cn(app.country)} · ${D.pn(app.profession)})`, '#/applications/' + app.id, 'TASK_ASSIGNED');
          m.close(); ui.toast(`Lamaran ${app.id} dibuat`); ctx.refresh();
        } catch (e) { errHost.appendChild(ui.callout('danger', 'Lamaran tidak bisa dibuat', h('span', null, e.message, ' ', e.dup ? h('a', { href: '#/applications/' + e.dup.id }, 'Buka ' + e.dup.id) : null))); }
      } })],
    });
  }

  function openEditWorker(w, ctx) {
    const k = kit([
      { name: 'name', label: 'Nama sesuai KTP', value: w.name, required: true, validate: v => (/[^A-Za-z\s.'-]/.test(v) ? 'Nama hanya boleh huruf' : null) },
      { name: 'gender', label: 'Jenis kelamin', type: 'select', options: [['L', 'Laki-laki'], ['P', 'Perempuan']], value: w.gender }, { name: 'dob', label: 'Tanggal lahir', type: 'date', value: w.dob, required: true, validate: v => (validDate(v) && ageOk(v) ? null : 'Tanggal tidak valid (usia 17–60)') },
      { name: 'phone', label: 'Telepon', value: w.phone, required: true, validate: v => (/^(08|628)\d{7,12}$/.test(digits(v)) ? null : 'Nomor telepon tidak valid') },
      { name: 'address', label: 'Alamat', value: w.address, span: 2 }, { name: 'city', label: 'Kota / kabupaten', value: w.city }, { name: 'province', label: 'Provinsi', type: 'select', options: [...new Set([...PROVINCES, w.province].filter(Boolean))], value: w.province },
      { name: 'education', label: 'Pendidikan', type: 'select', options: EDU, value: w.education }, { name: 'maritalStatus', label: 'Status pernikahan', type: 'select', options: MARITAL, value: w.maritalStatus },
      { name: 'recruiter', label: 'Recruiter', type: 'select', options: staffAdmins().map(u => [u.id, u.name]), value: w.recruiterId, span: 2 },
      { name: 'nik', label: 'NIK baru (kosongkan bila tidak diubah)', placeholder: `Saat ini ${BGS.mask.nik(w.nik)}`, validate: v => (/^\d{16}$/.test(v) ? null : 'NIK harus 16 digit angka') },
      { name: 'passport', label: 'Paspor baru (kosongkan bila tidak diubah)', placeholder: w.passport ? `Saat ini ${BGS.mask.passport(w.passport)}` : 'Belum ada', validate: v => (/^[A-Za-z]\d{7}$/.test(v) ? null : 'Format: 1 huruf + 7 angka') },
      { name: 'reason', label: 'Alasan mengubah NIK / paspor', span: 2, placeholder: 'Wajib bila NIK atau paspor diubah (identitas)', hint: 'Perubahan identitas tercatat di audit (RUL-002).' },
    ]);
    const dupHost = h('div');
    const m = ui.modal({
      title: 'Ubah data worker', size: 'lg',
      body: h('div', { class: 'stack' }, h('div', { class: 'form-grid cols-2' }, ['name', 'gender', 'dob', 'phone', 'address', 'city', 'province', 'education', 'maritalStatus', 'recruiter'].map(n => k.node(n))), h('div', { class: 'wk-sec' }, 'Identitas resmi (jarang berubah)'), h('div', { class: 'form-grid cols-2' }, ['nik', 'passport', 'reason'].map(n => k.node(n))), dupHost),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Simpan perubahan', { kind: 'primary', onClick: () => {
        BGS.clear(dupHost); if (!k.validate()) return; const v = k.values();
        const idChange = v.nik || v.passport; if (idChange && !v.reason) { k.setErr('reason', 'Alasan wajib bila NIK / paspor diubah'); return; }
        if (idChange) { const ms = findDuplicates({ nik: v.nik, passport: v.passport.toUpperCase() }, w.id).filter(x => x.hard); if (ms.length) { dupHost.appendChild(h('div', { class: 'stack-sm' }, ui.callout('danger', 'NIK / paspor sudah dipakai worker lain (RUL-002)', 'Perubahan diblok. Bila ini orang yang sama, gunakan "Gabung duplikat".'), h('div', { class: 'row wrap gap-sm' }, ms.map(x => h('a', { class: 'btn btn-sm', href: '#/workers/' + x.worker.id, onClick: () => m.close() }, 'Buka profil ' + x.worker.id))))); return; } }
        const ch = [];
        [['name', 'nama'], ['gender', 'jenis kelamin'], ['dob', 'tanggal lahir'], ['phone', 'telepon'], ['address', 'alamat'], ['city', 'kota'], ['province', 'provinsi'], ['education', 'pendidikan'], ['maritalStatus', 'status pernikahan']].forEach(([f, l]) => { if (String(w[f] || '') !== v[f]) { ch.push(l); w[f] = v[f]; } });
        if (v.recruiter !== w.recruiterId) { ch.push('recruiter'); w.recruiterId = v.recruiter; }
        if (v.nik) { w.nik = v.nik; ch.push('NIK'); } if (v.passport) { w.passport = v.passport.toUpperCase(); ch.push('paspor'); }
        if (!ch.length) { ui.toast('Tidak ada perubahan', 'info'); m.close(); return; }
        BGS.audit('Data worker diubah', 'Worker', w.id, `Kolom: ${ch.join(', ')}.${idChange ? ' Alasan: ' + v.reason : ''}`); m.close(); ui.toast('Data worker disimpan'); ctx.refresh();
      } })],
    });
  }

  BGS.router.add('/workers/:id', {
    title: 'Profil worker', roles: ALL, mvp: 1,
    render(ctx) {
      const w = D.worker(ctx.params.id);
      const back = [{ label: 'Worker', href: '/workers' }];
      if (!w) { ctx.el.append(ui.pageHeader({ title: 'Worker tidak ditemukan', breadcrumbs: back }), ui.emptyState({ icon: 'search', title: 'Worker ID tidak ditemukan', text: ctx.params.id, action: h('a', { class: 'btn btn-primary', href: '#/workers' }, 'Kembali ke daftar worker') })); return; }
      if (w.aliasOf && D.worker(w.aliasOf)) { const k = D.worker(w.aliasOf); ctx.el.append(ui.pageHeader({ title: w.id, breadcrumbs: [...back, { label: w.id }] }), ui.callout('info', `${w.id} adalah alias read-only`, h('span', null, `Worker ini sudah digabung ke ${k.name}. Gunakan Worker ID `, h('a', { href: '#/workers/' + k.id }, k.id), '. ', w.archiveReason || '')), h('div', null, h('a', { class: 'btn btn-primary', href: '#/workers/' + k.id }, 'Buka worker utama'))); return; }
      if (BGS.scope.isLimited() && !BGS.scope.workers().includes(w)) { ctx.el.append(ui.pageHeader({ title: 'Profil worker', breadcrumbs: back }), ui.emptyState({ icon: 'lock', title: 'Di luar cakupan akses Anda', text: 'PIC hanya dapat melihat worker yang ditugaskan kepada Anda (RUL-020).', action: h('a', { class: 'btn btn-primary', href: '#/workers' }, 'Kembali ke daftar worker') })); return; }

      const canWrite = BGS.can('worker.write'), canMerge = BGS.can('merge.worker'); const archived = w.status === 'ARCHIVED';
      const apps = BGS.scope.applications().filter(a => a.workerId === w.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      const cases = BGS.scope.cases().filter(c => c.workerId === w.id);
      const caseIds = new Set(cases.map(c => c.id));
      const allCases = D.cases.filter(c => c.workerId === w.id);
      const docs = D.documents.filter(d => (d.ownerType === 'worker' && d.ownerId === w.id) || (d.ownerType === 'case' && caseIds.has(d.ownerId)));
      const tasks = BGS.scope.tasks().filter(t => caseIds.has(t.caseId));
      const openTasks = tasks.filter(t => !['COMPLETED', 'CANCELLED'].includes(t.status));
      const activeApps = apps.filter(a => !TERMINAL_APP.includes(a.status));
      const verified = docs.filter(d => d.status === 'VERIFIED').length;

      // ----- actions -----
      const doArchive = async () => {
        if (allCases.some(c => ACTIVE_CASE.includes(c.status))) { ui.toast('Tidak bisa diarsipkan: masih ada Placement Case aktif', 'danger'); return; }
        const reason = await ui.reasonPrompt({ title: `Arsipkan ${w.name}`, message: 'Data tidak dihapus permanen (soft delete, RUL-026). Worker disembunyikan dari daftar dan NIK-nya bisa dipakai lagi.', label: 'Alasan mengarsipkan', confirmLabel: 'Arsipkan', tone: 'danger', presets: ['Permintaan penghapusan data oleh subjek', 'Data ganda / salah input', 'Tidak aktif lebih dari 2 tahun'] });
        if (!reason) return; w.status = 'ARCHIVED'; w.archivedAt = stamp(); w.archiveReason = reason;
        BGS.audit('Worker diarsipkan', 'Worker', w.id, 'Alasan: ' + reason); ui.toast('Worker diarsipkan'); ctx.refresh();
      };
      const doRestore = async () => {
        const dup = findDuplicates(w, w.id).filter(m => m.hard);
        if (dup.length) { ui.toast(`Tidak bisa dipulihkan: NIK/paspor sudah dipakai ${dup[0].worker.id} (RUL-002)`, 'danger'); return; }
        const ok = await ui.confirm({ title: 'Pulihkan worker', message: `Pulihkan ${w.name} dari arsip? Status akan dihitung ulang otomatis (RUL-027).` }); if (!ok) return;
        w.status = 'INACTIVE'; delete w.archiveReason; BGS.deriveWorkerStatus(); BGS.audit('Worker dipulihkan dari arsip', 'Worker', w.id, ''); ui.toast('Worker dipulihkan'); ctx.refresh();
      };
      const ro = 'Hanya Admin / Superadmin yang bisa mengubah data worker';
      const actions = h('div', { class: 'wk-head-act' },
        !canWrite && ui.badge('Hanya baca', 'gray', { title: ro }),
        ui.btn('Ubah data', Object.assign({ icon: 'edit', onClick: () => openEditWorker(w, ctx) }, noPerm(canWrite && !archived, archived ? 'Worker diarsipkan' : ro))),
        ui.btn('Gabung duplikat', Object.assign({ icon: 'merge', onClick: () => openMergeWorkers(w, ctx) }, noPerm(canMerge && !archived, archived ? 'Worker diarsipkan' : 'Hanya Admin / Superadmin yang bisa menggabung worker'))),
        archived ? ui.btn('Pulihkan', Object.assign({ icon: 'refresh', onClick: doRestore }, noPerm(canWrite, ro))) : ui.btn('Arsipkan', Object.assign({ kind: 'danger', icon: 'trash', onClick: doArchive }, noPerm(canWrite, ro))));

      // ----- tabs -----
      const tabSummary = () => {
        const picRows = [];
        activeApps.forEach(a => a.picId && picRows.push([`PIC screening (${a.id})`, ui.userChip(a.picId)]));
        cases.filter(c => ACTIVE_CASE.includes(c.status)).forEach(c => Object.entries(c.pics).forEach(([role, u]) => picRows.push([`${role} (${c.id})`, ui.userChip(u)])));
        const con = w.consent;
        return h('div', { class: 'grid cols-2' },
          ui.card({ title: 'Identitas', icon: 'user', body: ui.kv([['Nama lengkap', w.name], ['Jenis kelamin', genderLabel(w.gender)], ['Tanggal lahir', `${fmt.date(w.dob)} (${fmt.age(w.dob)} th)`], ['NIK', ui.masked(w.nik, 'nik', w.id)], ['Nomor paspor', w.passport ? ui.masked(w.passport, 'passport', w.id) : 'Belum ada'], ['Telepon', ui.masked(w.phone, 'phone', w.id)], ['Alamat', w.address], ['Kota / provinsi', loc(w)], ['Pendidikan', w.education], ['Status pernikahan', w.maritalStatus]]) }),
          h('div', { class: 'stack' },
            ui.card({ title: 'Status & penanggung jawab', icon: 'activity', body: h('div', { class: 'stack' }, h('div', { class: 'row' }, ui.status('worker', w.status), small('Status dihitung otomatis dari lamaran & case (RUL-027)')), h('div', { class: 'muted sm' }, statusReason(w, allCases, apps)),
              ui.kv([['Sumber pendaftaran', w.source + (w.referrer ? ` (perujuk: ${w.referrer})` : '')], ['Recruiter', ui.userChip(w.recruiterId)], ['Terdaftar', fmt.dateTime(w.createdAt)], w.importBatchId && ['Batch impor', h('a', { href: '#/workers?batch=' + w.importBatchId }, w.importBatchId)]]),
              h('div', { class: 'wk-sec' }, 'PIC yang menangani'), picRows.length ? ui.kv(picRows) : small('Belum ada PIC (ditunjuk saat screening / alokasi).')) }),
            ui.card({ title: 'Consent data pribadi', icon: 'file-text', subtitle: 'RUL-029', body: con ? h('div', { class: 'stack-sm' }, con.pending && ui.callout('warn', 'Bukti consent belum dilengkapi', 'Data berasal dari impor. Minta bukti consent dan catat sebelum diproses lebih jauh.'), ui.kv([['Versi', h('span', { class: 'row gap-sm' }, h('span', { class: 'mono' }, con.version), con.version === curConsent() ? ui.badge('terbaru', 'green') : ui.badge('versi lama', 'amber'))], ['Waktu', fmt.dateTime(con.at)], ['Kanal / jenis bukti', con.channel], con.evidence && ['Berkas bukti', con.evidence]])) : ui.callout('danger', 'Tidak ada bukti consent', 'Lengkapi segera.') }),
            ui.card({ title: 'Alias & penanda', icon: 'merge', body: h('div', { class: 'stack-sm' }, (w.aliases || []).length ? h('ul', { class: 'wk-tips' }, w.aliases.map(a => h('li', null, /^BGS-W-/.test(a) ? [h('span', { class: 'mono' }, a), ' (Worker ID lama, read-only)'] : a))) : small('Tidak ada alias — satu Worker ID, satu orang.'), (w.tags || []).length ? ui.chips(w.tags) : null) })));
      };
      const tabApps = () => h('div', { class: 'stack' },
        h('div', { class: 'row between wrap' }, small('Satu worker boleh punya beberapa lamaran untuk negara/profesi berbeda (BR-005). Maksimal satu lamaran aktif per kombinasi (RUL-008).'), ui.btn('Tambah lamaran', Object.assign({ kind: 'primary', icon: 'plus', onClick: () => openAddApplication(w, ctx) }, noPerm(canWrite && !archived, archived ? 'Worker diarsipkan' : ro)))),
        ui.card({ flush: true, body: ui.table({ rows: apps, pageSize: 8, onRowClick: a => ctx.go('/applications/' + a.id), empty: ui.emptyState({ icon: 'clipboard', title: 'Belum ada lamaran', text: 'Tambahkan lamaran agar worker bisa masuk proses seleksi.' }),
          columns: [{ key: 'id', label: 'Lamaran', render: a => ui.appLink(a.id) }, { key: 'tujuan', label: 'Tujuan', render: a => `${D.cn(a.country)} · ${D.pn(a.profession)}` }, { key: 'route', label: 'Jalur', render: a => routeName(a.route) }, { key: 'status', label: 'Status', render: a => ui.status('application', a.status) },
            { key: 'createdAt', label: 'Dibuat', render: a => fmt.date(a.createdAt) }, { key: 'pic', label: 'PIC screening', render: a => (a.picId ? userName(a.picId) : '—') }, { key: 'case', label: 'Case', render: a => (a.caseId ? ui.caseLink(a.caseId) : '—') }] }) }));
      const tabCases = () => ui.card({ flush: true, body: ui.table({ rows: cases, pageSize: 8, onRowClick: c => ctx.go('/cases/' + c.id), empty: ui.emptyState({ icon: 'briefcase', title: 'Belum ada Placement Case', text: 'Case dibuat saat lamaran dialokasikan ke Placement Code (setelah terpilih / cadangan).', action: canWrite && apps.some(a => ['SELECTED', 'WAITLISTED'].includes(a.status)) ? h('a', { class: 'btn btn-primary', href: '#/allocation?app=' + apps.find(a => ['SELECTED', 'WAITLISTED'].includes(a.status)).id }, 'Alokasikan lamaran') : null }),
        columns: [{ key: 'id', label: 'Case', render: c => ui.caseLink(c.id) }, { key: 'tujuan', label: 'Tujuan', render: c => `${D.cn(c.country)} · ${D.pn(c.profession)}` }, { key: 'status', label: 'Status', render: c => ui.status('case', c.status) }, { key: 'code', label: 'Placement Code', render: c => ui.codeLink(c.placementCodeId) },
          { key: 'prog', label: 'Progres langkah', render: c => { const done = c.steps.filter(s => ['COMPLETED', 'SKIPPED'].includes(s.status)).length; return h('div', { class: 'row gap-sm', style: 'min-width:150px' }, ui.progress(Math.round((done / Math.max(1, c.steps.length)) * 100), 'green'), small(`${done}/${c.steps.length}`)); } },
          { key: 'dep', label: 'Rencana berangkat', render: c => fmt.date(c.plannedDeparture) }, { key: 'owner', label: 'Case Owner', render: c => userName(c.ownerId) }] }) });
      const tabDocs = () => {
        const canR = BGS.can('document.restricted.view');
        const restricted = d => (D.docType(d.typeId) || {}).sensitivity === 'RESTRICTED';
        const openR = async d => { const r = await ui.reasonPrompt({ title: 'Buka dokumen RESTRICTED', message: `${(D.docType(d.typeId) || {}).name} · ${w.name}. Akses ini tercatat di audit trail (RUL-021).`, label: 'Alasan membuka dokumen', presets: ['Verifikasi dokumen', 'Pengisian formulir resmi', 'Permintaan instansi (terdokumentasi)'] }); if (!r) return; BGS.audit('Akses dokumen RESTRICTED', 'Document', d.id, `Worker ${w.id}. Alasan: ${r}`); docPreview(d, true); };
        const lock = d => restricted(d) && !canR;
        return h('div', { class: 'stack' },
          !canR && ui.callout('warn', 'Sebagian dokumen terkunci', 'Dokumen RESTRICTED (KTP, KK, paspor, MCU, psikologi) tidak dapat dibuka oleh peran Anda (BR-009, RUL-020).'),
          h('div', { class: 'row between wrap' }, small('Dokumen RESTRICTED hanya dibuka dengan alasan dan tercatat di audit.'), h('a', { class: 'btn', href: '#/documents?owner=' + w.id }, BGS.icon('folder', 16), 'Kelola dokumen')),
          ui.card({ flush: true, body: ui.table({ rows: docs, pageSize: 10, rowClass: d => (lock(d) ? 'wk-lock' : ''), empty: ui.emptyState({ icon: 'folder', title: 'Belum ada dokumen', text: 'Dokumen diunggah saat screening.' }),
            columns: [
              { key: 'type', label: 'Jenis', render: d => (lock(d) ? h('span', { class: 'row gap-sm' }, BGS.icon('lock', 14), (D.docType(d.typeId) || {}).name) : (D.docType(d.typeId) || {}).name) },
              { key: 'file', label: 'Berkas', render: d => (lock(d) ? small('Terkunci — RESTRICTED') : restricted(d) ? h('span', { class: 'mono' }, '••••••••.' + d.filename.split('.').pop()) : h('span', { class: 'mono' }, d.filename)) },
              { key: 'owner', label: 'Milik', render: d => (d.ownerType === 'case' ? ui.caseLink(d.ownerId) : 'Worker') }, { key: 'v', label: 'Versi', render: d => 'v' + d.version },
              { key: 'status', label: 'Status', render: d => (lock(d) ? '—' : ui.status('document', d.status)) }, { key: 'sens', label: 'Kerahasiaan', render: d => ui.status('sensitivity', (D.docType(d.typeId) || {}).sensitivity) },
              { key: 'exp', label: 'Berlaku s.d.', render: d => (lock(d) ? '—' : d.expiresAt ? fmt.date(d.expiresAt) : '—') },
              { key: 'act', label: '', render: d => (lock(d) ? null : ui.btn(restricted(d) ? 'Buka (alasan)' : 'Lihat', { sm: true, icon: restricted(d) ? 'lock' : 'eye', onClick: () => (restricted(d) ? openR(d) : docPreview(d, false)) })) }] }) }));
      };
      const tabTasks = () => ui.card({ flush: true, body: ui.table({ rows: tasks, pageSize: 10, onRowClick: t => (BGS.taskDrawer ? BGS.taskDrawer(t.id, { onChange: ctx.refresh }) : ctx.go('/cases/' + t.caseId)),
        empty: ui.emptyState({ icon: 'check-square', title: 'Tidak ada tugas', text: BGS.scope.isLimited() ? 'Tidak ada tugas yang ditugaskan kepada Anda untuk worker ini.' : 'Tugas muncul setelah Placement Case diaktifkan.' }),
        columns: [{ key: 'id', label: 'Tugas', render: t => h('div', null, h('b', null, t.title), h('div', { class: 'muted sm mono' }, t.id)) }, { key: 'case', label: 'Case', render: t => ui.caseLink(t.caseId) }, { key: 'status', label: 'Status', render: t => ui.status('task', t.status) },
          { key: 'due', label: 'Tenggat', render: t => { const over = !['COMPLETED', 'CANCELLED'].includes(t.status) && new Date(t.dueAt) < BGS.today; return h('span', { style: over ? 'color:var(--red);font-weight:700' : '' }, fmt.date(t.dueAt), over ? ' · terlambat' : ''); } }, { key: 'as', label: 'Penanggung jawab', render: t => userName(t.assigneeId) }] }) });
      const tabHistory = () => {
        const ids = new Set([w.id, ...apps.map(a => a.id), ...cases.map(c => c.id), ...(w.aliases || []).filter(a => /^BGS-W-/.test(a))]); const ev = [];
        ev.push({ at: w.createdAt, by: w.recruiterId, tone: 'blue', text: `Worker dibuat (sumber: ${w.source})` });
        if (w.consent) ev.push({ at: w.consent.at, tone: 'green', text: `Consent ${w.consent.version} dicatat — ${w.consent.channel}` });
        D.registrations.filter(r => r.resultWorkerId === w.id).forEach(r => ev.push({ at: r.reviewedAt || r.submittedAt, by: r.reviewedBy, tone: 'blue', text: `Registrasi ${r.id} ${BGS.ST.registration[r.status][0].toLowerCase()}` }));
        apps.forEach(a => a.history.forEach(x => ev.push({ at: x.at, by: x.by, tone: /tolak|batal/i.test(x.text) ? 'red' : 'blue', text: `[${a.id}] ${x.text}` })));
        cases.forEach(c => ev.push({ at: c.createdAt, by: c.ownerId, tone: 'amber', text: `Placement Case ${c.id} dibuat (${D.cn(c.country)} · ${D.pn(c.profession)})` }));
        D.audit.filter(a => ids.has(a.entityId)).forEach(a => ev.push({ at: a.at, by: a.userId, tone: /reveal|RESTRICTED/i.test(a.action) ? 'amber' : /arsip|digabung|alias|dibuang/i.test(a.action) ? 'red' : 'green', text: `${a.action}${a.detail ? ' — ' + a.detail : ''}` }));
        ev.sort((a, b) => new Date(b.at) - new Date(a.at));
        return h('div', { class: 'stack' }, small('Gabungan riwayat lamaran, proses, dan jejak audit untuk worker ini.'), ev.length ? ui.card({ body: ui.timeline(ev.slice(0, 80)) }) : ui.emptyState({ title: 'Belum ada riwayat' }));
      };

      put(ctx.el,
        ui.pageHeader({ title: 'Profil 360°', mvp: 1, breadcrumbs: [...back, { label: w.name }] }),
        archived && ui.callout('warn', 'Worker ini diarsipkan', w.archiveReason ? 'Alasan: ' + w.archiveReason : 'Data hanya dapat dibaca (soft delete, RUL-026).'),
        h('section', { class: 'card wk-head' }, ui.avatar(w.name, w.color, 60),
          h('div', null, h('h1', null, w.name, ui.status('worker', w.status)), h('div', { class: 'wk-meta' }, h('span', { class: 'mono' }, w.id), h('span', null, `${genderLabel(w.gender)} · ${fmt.age(w.dob)} th`), h('span', null, loc(w)), h('span', null, 'Sumber: ' + w.source), h('span', null, 'Recruiter: ' + userName(w.recruiterId)))), actions),
        h('div', { class: 'grid cols-4' },
          ui.kpi({ label: 'Lamaran', value: apps.length, sub: `${activeApps.length} aktif`, tone: 'purple', icon: 'clipboard' }),
          ui.kpi({ label: 'Placement Case', value: cases.length, sub: `${cases.filter(c => ACTIVE_CASE.includes(c.status)).length} aktif`, tone: 'orange', icon: 'briefcase' }),
          ui.kpi({ label: 'Dokumen', value: docs.length, sub: `${verified} terverifikasi`, tone: 'teal', icon: 'folder' }),
          ui.kpi({ label: 'Tugas terbuka', value: openTasks.length, sub: `${tasks.length} total`, tone: openTasks.length ? 'amber' : 'green', icon: 'check-square' })),
        ui.tabs([{ id: 'sum', label: 'Ringkasan', render: tabSummary }, { id: 'apps', label: 'Lamaran', count: apps.length, render: tabApps }, { id: 'cases', label: 'Placement Case', count: cases.length, render: tabCases }, { id: 'docs', label: 'Dokumen', count: docs.length, render: tabDocs }, { id: 'tasks', label: 'Tugas', count: tasks.length, render: tabTasks }, { id: 'hist', label: 'Riwayat', render: tabHistory }], { active: ctx.query.tab }));
    },
  });

  // ====================================================================
  // /import  (Excel import wizard, BR-004 / FR-WRK-017)
  // ====================================================================
  const IMP_FIELDS = [
    { key: 'name', label: 'Nama lengkap', required: true, syn: ['nama', 'namalengkap', 'namapekerja', 'namacpmi', 'name', 'fullname', 'namasesuaiktp'] },
    { key: 'nik', label: 'NIK', required: true, syn: ['nik', 'noktp', 'nomorktp', 'ktp', 'nomorindukkependudukan', 'noidentitas'] },
    { key: 'dob', label: 'Tanggal lahir', required: true, syn: ['tgllahir', 'tanggallahir', 'dob', 'lahir', 'birthdate', 'ttl', 'tanggallahir'] },
    { key: 'gender', label: 'Jenis kelamin', syn: ['jk', 'jeniskelamin', 'gender', 'kelamin', 'lp'] },
    { key: 'phone', label: 'Telepon / WhatsApp', syn: ['nohp', 'hp', 'telepon', 'telp', 'nowa', 'wa', 'whatsapp', 'nomorhp', 'phone', 'notelp', 'notelepon'] },
    { key: 'passport', label: 'Nomor paspor', syn: ['paspor', 'nopaspor', 'passport', 'nomorpaspor'] },
    { key: 'address', label: 'Alamat', syn: ['alamat', 'address', 'alamatlengkap'] },
    { key: 'city', label: 'Kota / kabupaten', syn: ['kota', 'kabupaten', 'kotakabupaten', 'kab', 'city', 'domisili'] },
    { key: 'province', label: 'Provinsi', syn: ['provinsi', 'prov', 'province'] },
    { key: 'education', label: 'Pendidikan', syn: ['pendidikan', 'pendidikanterakhir', 'education', 'sekolah'] },
    { key: 'maritalStatus', label: 'Status pernikahan', syn: ['statusnikah', 'statuspernikahan', 'nikah', 'marital', 'statuskawin'] },
    { key: 'country', label: 'Negara tujuan', syn: ['negara', 'negaratujuan', 'tujuan', 'country', 'destinasi'] },
    { key: 'profession', label: 'Profesi', syn: ['profesi', 'jabatan', 'posisi', 'pekerjaan', 'profession', 'sektor'] },
  ];
  const alnum = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const COUNTRY_ALIAS = { SA: ['arabsaudi', 'saudi', 'ksa', 'saudiarabia'], AE: ['uniemiratarab', 'uae', 'dubai', 'uea', 'abudhabi', 'emirat'], JP: ['jepang', 'japan'], KR: ['koreaselatan', 'korea', 'korsel'], TW: ['taiwan'] };
  const PROF_ALIAS = { DMW: ['domesticworker', 'pekerjarumahtangga', 'prt', 'art', 'asistenrumahtangga'], CGV: ['caregiver', 'perawatlansia', 'perawat', 'kaigo'], FAC: ['operatorpabrik', 'pabrik', 'factory'], DRV: ['sopirkeluarga', 'sopir', 'driver'], HSK: ['housekeepinghotel', 'housekeeping'] };
  const resolveCode = (s, list, alias) => { const n = alnum(s); if (!n) return ''; const hit = list.find(x => alnum(x.code) === n || alnum(x.name) === n || (alias[x.code] || []).includes(n)); return hit ? hit.code : null; };
  const parseDate = s => {
    s = String(s || '').trim(); if (!s) return null; let y, mo, d, m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else if ((m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
    else if (/^\d{5}$/.test(s)) { return new Date(Date.UTC(1899, 11, 30) + (+s) * 86400000).toISOString().slice(0, 10); }
    else return null;
    const iso = `${y}-${pad(mo, 2)}-${pad(d, 2)}`; return validDate(iso) ? iso : null;
  };
  const normGender = s => (/^(l|lk|laki|laki-laki|lakilaki|pria|m|male)$/i.test(s) ? 'L' : /^(p|pr|perempuan|wanita|f|female)$/i.test(s) ? 'P' : s ? null : '');
  const normEdu = s => { const n = alnum(s); if (!n) return ''; if (/^sd/.test(n)) return 'SD'; if (/^smp|^mts/.test(n)) return 'SMP'; if (/^sma|^smk|^slta|^ma$/.test(n)) return 'SMA/SMK'; if (/^d3|^diploma/.test(n)) return 'D3'; if (/^s1|^sarjana/.test(n)) return 'S1'; return titleCase(s); };
  const normMarital = s => { const n = alnum(s); if (!n) return ''; if (/belum|lajang|single|tk/.test(n)) return 'Belum menikah'; if (/cerai|janda|duda/.test(n)) return 'Cerai'; if (/nikah|kawin|married/.test(n)) return 'Menikah'; return titleCase(s); };
  const maskAny = s => { const d = digits(s); return d.length === 16 ? BGS.mask.nik(d) : d ? `${d.slice(0, 4)}•••• (${d.length} digit)` : '—'; };

  const IMP = { step: 0, fileName: '', fromSample: false, headers: [], rows: [], mapping: {}, recruiter: null, consentMode: 'pending', result: null, batchId: null, sample: 0, note: '' };
  const resetImp = () => Object.assign(IMP, { step: 0, fileName: '', fromSample: false, headers: [], rows: [], mapping: {}, result: null, batchId: null, note: '' });
  const SAMPLE_HEADERS = ['No', 'Nama Lengkap', 'NIK', 'Tgl Lahir', 'JK', 'No HP', 'Alamat', 'Kota', 'Provinsi', 'Pendidikan', 'Status Nikah', 'Negara Tujuan', 'Profesi', 'Keterangan'];

  D.importBatches = D.importBatches || [{ id: 'IMP-261029-01', fileName: 'worker-lama-oktober.xlsx', at: new Date(BGS.today.getTime() - 8 * 86400000).toISOString(), by: 'U05', total: 20, imported: 0, errors: 2, duplicates: 1, apps: 0, workerIds: [], appIds: [], status: 'ROLLED_BACK', rollbackReason: 'Salah memilih kolom NIK saat pemetaan — diulang dengan file yang sudah dibersihkan', rolledBackAt: new Date(BGS.today.getTime() - 8 * 86400000 + 3600000).toISOString(), rolledBackBy: 'U01' }];

  function csvParse(text) {
    const first = text.split(/\r?\n/)[0] || ''; const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === delim) { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim()));
  }
  function makeSample() {
    const n = ++IMP.sample;
    const F = ['Siti', 'Nur', 'Dewi', 'Rina', 'Yuni', 'Lestari', 'Wati', 'Ani', 'Sri', 'Fitri', 'Maya', 'Indah', 'Tuti', 'Ratna', 'Eka', 'Aisyah'], M = ['Budi', 'Agus', 'Slamet', 'Hendra', 'Joko', 'Rudi', 'Dedi', 'Yanto', 'Ahmad', 'Wahyu'];
    const L = ['Handayani', 'Rahayu', 'Kusuma', 'Wijaya', 'Saputri', 'Hidayati', 'Permata', 'Setiawan', 'Pratama', 'Nugraha', 'Santoso', 'Hartono', 'Susanti', 'Maulana', 'Utami', 'Purnama', 'Ramadhani', 'Syahputra'];
    const cities = [['Indramayu', 'Jawa Barat'], ['Cianjur', 'Jawa Barat'], ['Brebes', 'Jawa Tengah'], ['Malang', 'Jawa Timur'], ['Lombok Timur', 'NTB'], ['Karawang', 'Jawa Barat'], ['Cilacap', 'Jawa Tengah'], ['Blitar', 'Jawa Timur']];
    const combos = [['Arab Saudi', 'Domestic Worker'], ['Taiwan', 'Caregiver'], ['Dubai', 'PRT'], ['Jepang', 'Caregiver'], ['Korea Selatan', 'Operator Pabrik'], ['Taiwan', 'Housekeeping'], ['Arab Saudi', 'Sopir']];
    const edu = ['SD', 'SMP', 'SMA', 'SMK', 'D3', 'SMA'], mar = ['Belum menikah', 'Menikah', 'Cerai', 'Belum kawin'];
    const taken = new Set(D.workers.map(w => w.nik)); const rows = [];
    for (let i = 0; i < 30; i++) {
      const male = i % 3 === 0; const first = male ? M[(i + n) % M.length] : F[(i * 3 + n) % F.length]; const last = L[(i * 7 + n * 5) % L.length];
      const dd = 1 + ((i * 5 + n) % 27), mm = 1 + ((i * 7 + n) % 12), yy = 1988 + ((i * 3 + n) % 15);
      let seq = 1000 + n * 100 + i; let nik; do { nik = `32${pad(10 + (i % 80), 2)}${pad(1 + (i % 20), 2)}${pad(dd + (male ? 0 : 40), 2)}${pad(mm, 2)}${pad(yy % 100, 2)}${pad(seq++, 4)}`; } while (taken.has(nik)); taken.add(nik);
      const [city, prov] = cities[(i + n) % cities.length]; const [country, prof] = combos[(i * 2 + n) % combos.length];
      const phone = i % 4 === 0 ? `+62 8${pad(12 + (i % 7), 2)}-${pad(3000 + i * 37, 4)}-${pad(1000 + i * 91, 4)}` : `08${pad(12 + (i % 7), 2)}${pad(30000000 + i * 3719 + n, 8)}`;
      rows.push([String(i + 1), `${first} ${last}`.toUpperCase(), nik, i % 5 === 1 ? `${yy}-${pad(mm, 2)}-${pad(dd, 2)}` : `${pad(dd, 2)}/${pad(mm, 2)}/${yy}`, male ? (i % 2 ? 'Laki-laki' : 'L') : (i % 2 ? 'Perempuan' : 'P'), phone, `Dsn. Sukamaju RT ${pad(1 + (i % 9), 2)}/${pad(1 + ((i + 3) % 9), 2)}`, city, prov, edu[i % edu.length], mar[i % mar.length], country, prof, i % 6 === 0 ? 'Data dari Excel lama' : '']);
    }
    const exist = D.workers.find(w => w.status !== 'ARCHIVED' && w.id !== 'BGS-W-2026-00123') || D.workers[0];
    rows[4][2] = rows[4][2].slice(0, 15);                                // NIK terlalu pendek
    rows[9][2] = exist.nik; rows[9][1] = 'RATNA DEWI LESTARI';           // NIK sudah ada di database
    rows[13][1] = '';                                                    // nama kosong
    rows[17][3] = '31/02/1996';                                          // tanggal tidak valid
    rows[21][11] = 'Qatar';                                              // negara tidak dikenal
    rows[26][2] = rows[2][2]; rows[26][1] = rows[2][1];                 // NIK ganda di dalam file
    return { headers: SAMPLE_HEADERS, rows };
  }
  function autoMap(headers) {
    const mapping = {}; const used = new Set();
    headers.forEach((hd, i) => { const n = alnum(hd); const f = IMP_FIELDS.find(f => !used.has(f.key) && f.syn.includes(n)); if (f) { mapping[i] = f.key; used.add(f.key); } else mapping[i] = ''; });
    return mapping;
  }
  function loadParsed(headers, rows, fileName, fromSample, note) {
    Object.assign(IMP, { headers, rows, fileName, fromSample, note: note || '', mapping: autoMap(headers), result: null, step: 0, recruiter: IMP.recruiter || defaultRecruiter() });
  }

  function dryRun() {
    const colOf = {}; Object.entries(IMP.mapping).forEach(([i, f]) => { if (f) colOf[f] = +i; });
    const cell = (raw, key) => (colOf[key] == null ? '' : String(raw[colOf[key]] == null ? '' : raw[colOf[key]]).trim());
    const seenNik = new Map(), seenPp = new Map(); const out = [];
    IMP.rows.forEach((raw, i) => {
      if (raw.every(c => !String(c || '').trim())) return;
      const rowNo = i + 2; const issues = [], warns = []; const add = (field, msg, kind = 'error') => issues.push({ field, msg, kind });
      const name = cell(raw, 'name'); const nikRaw = cell(raw, 'nik'); const nik = digits(nikRaw); const dobRaw = cell(raw, 'dob'); const dob = parseDate(dobRaw);
      if (!name) add('Nama', 'Nama kosong'); else if (/[^A-Za-z\s.'-]/.test(name)) add('Nama', 'Nama mengandung angka atau simbol');
      if (!nikRaw) add('NIK', 'NIK kosong'); else if (/e\+/i.test(nikRaw)) add('NIK', 'NIK berubah jadi notasi ilmiah — format kolom NIK sebagai Teks di Excel'); else if (/[A-Za-z]/.test(nikRaw)) add('NIK', 'NIK mengandung huruf'); else if (nik.length !== 16) add('NIK', `NIK harus 16 digit (terbaca ${nik.length} digit)`);
      if (!dobRaw) add('Tanggal lahir', 'Tanggal lahir kosong'); else if (!dob) add('Tanggal lahir', `Tanggal "${dobRaw}" tidak valid (pakai dd/mm/yyyy)`); else if (!ageOk(dob)) add('Tanggal lahir', `Usia ${fmt.age(dob)} tahun di luar batas 17–60`);
      const gRaw = cell(raw, 'gender'); const gender = normGender(gRaw); if (gender === null) add('Jenis kelamin', `"${gRaw}" tidak dikenal (pakai L / P)`);
      const phoneRaw = cell(raw, 'phone'); let phone = digits(phoneRaw); if (phone.startsWith('62')) phone = '0' + phone.slice(2); if (phoneRaw && !/^08\d{7,11}$/.test(phone)) add('Telepon', `Nomor "${phoneRaw}" tidak valid`);
      const ppRaw = cell(raw, 'passport'); if (ppRaw && !/^[A-Za-z]\d{7}$/.test(ppRaw)) add('Paspor', `Format paspor "${ppRaw}" tidak valid`);
      const cRaw = cell(raw, 'country'), pRaw = cell(raw, 'profession'); const country = resolveCode(cRaw, D.countries, COUNTRY_ALIAS), prof = resolveCode(pRaw, D.professions, PROF_ALIAS);
      if (cRaw && country === null) add('Negara tujuan', `Negara "${cRaw}" tidak dikenal di Data Master`); if (pRaw && prof === null) add('Profesi', `Profesi "${pRaw}" tidak dikenal di Data Master`);
      if (cRaw && country && !pRaw) add('Profesi', 'Profesi kosong padahal negara tujuan diisi'); if (pRaw && prof && !cRaw) add('Negara tujuan', 'Negara tujuan kosong padahal profesi diisi');
      const city = titleCase(cell(raw, 'city')); let province = cell(raw, 'province'); province = PROVINCES.find(p => alnum(p) === alnum(province)) || titleCase(province) || CITY_PROV[city] || '';
      const d = { name: titleCase(name), nik, dob, gender: gender || '', phone, passport: ppRaw.toUpperCase(), address: cell(raw, 'address'), city, province, education: normEdu(cell(raw, 'education')), maritalStatus: normMarital(cell(raw, 'maritalStatus')), country: country || '', profession: prof || '', route: country ? defaultRoute(country) : '' };
      // duplicates (RUL-002): inside the file, and against existing non-archived workers
      if (nik.length === 16) { if (seenNik.has(nik)) add('NIK', `NIK sama dengan baris ${seenNik.get(nik)} di file ini`, 'dup'); else seenNik.set(nik, rowNo); }
      if (d.passport) { if (seenPp.has(d.passport)) add('Paspor', `Paspor sama dengan baris ${seenPp.get(d.passport)} di file ini`, 'dup'); else seenPp.set(d.passport, rowNo); }
      findDuplicates({ nik: nik.length === 16 ? nik : '', passport: /^[A-Za-z]\d{7}$/.test(ppRaw) ? ppRaw : '', name, dob: dob || '' }).forEach(m => {
        if (m.hard) add(m.kinds.has('NIK') ? 'NIK' : 'Paspor', `${m.kinds.has('NIK') ? 'NIK' : 'Paspor'} sudah terdaftar atas nama ${m.worker.name} (${m.worker.id})`, 'dup'); else warns.push(`Mirip ${m.worker.name} (${m.worker.id})`);
      });
      const status = issues.some(x => x.kind === 'error') ? 'ERROR' : issues.length ? 'DUPLICATE' : 'VALID';
      out.push({ rowNo, status, issues, warns, data: d, label: name || '(nama kosong)', nikRaw });
    });
    return out;
  }
  const nextBatchId = () => { const p = 'IMP-' + BGS.today.toISOString().slice(2, 10).replace(/-/g, ''); return `${p}-${pad(D.importBatches.filter(b => b.id.startsWith(p)).length + 1, 2)}`; };
  function runImport(results) {
    const id = nextBatchId(); const at = stamp(); const valid = results.filter(r => r.status === 'VALID'); const wIds = [], aIds = [];
    const consent = IMP.consentMode === 'archive' ? { version: curConsent(), at, channel: 'Formulir consent fisik di arsip BGS (dinyatakan Admin saat impor)', evidence: 'Arsip fisik', pending: false } : { version: curConsent(), at, channel: 'Impor Excel — bukti consent menyusul', evidence: '', pending: true };
    valid.forEach(r => {
      const w = createWorker(r.data, { source: 'Impor', recruiterId: IMP.recruiter, importBatchId: id, at, consent: Object.assign({}, consent) }); wIds.push(w.id);
      if (r.data.country && r.data.profession) { const a = createApplication(w, { country: r.data.country, profession: r.data.profession, route: r.data.route, recruiterId: IMP.recruiter, importBatchId: id, via: `impor batch ${id}`, at }); aIds.push(a.id); }
    });
    const b = { id, fileName: IMP.fileName, at, by: BGS.state.userId, total: results.length, imported: valid.length, errors: results.filter(r => r.status === 'ERROR').length, duplicates: results.filter(r => r.status === 'DUPLICATE').length, apps: aIds.length, workerIds: wIds, appIds: aIds, status: 'APPLIED', recruiterId: IMP.recruiter, consentMode: IMP.consentMode };
    D.importBatches.unshift(b); BGS.deriveWorkerStatus();
    BGS.audit('Impor Excel dijalankan', 'Import Batch', id, `File ${IMP.fileName}: ${b.imported} worker + ${b.apps} lamaran dibuat, ${b.errors} error & ${b.duplicates} duplikat dilewati`);
    return b;
  }
  function rollbackBlockers(b) {
    const out = [];
    b.workerIds.forEach(id => {
      const w = D.worker(id); if (!w) return; const why = [];
      const apps = D.applications.filter(a => a.workerId === id);
      if (apps.some(a => !b.appIds.includes(a.id) || a.status !== 'SUBMITTED')) why.push('lamaran sudah diproses / ditambah');
      if (D.cases.some(c => c.workerId === id)) why.push('sudah punya Placement Case');
      if (D.documents.some(d => d.ownerType === 'worker' && d.ownerId === id)) why.push('sudah ada dokumen');
      if (w.aliasOf || (w.aliases || []).length || w.status === 'ARCHIVED') why.push('sudah digabung / diarsipkan');
      if (why.length) out.push({ w, why });
    });
    return out;
  }
  function openRollback(b, onDone) {
    const blockers = rollbackBlockers(b); const live = b.workerIds.filter(id => D.worker(id)).length;
    const reason = h('textarea', { class: 'input', rows: 2, placeholder: 'Contoh: kolom NIK salah dipetakan.' }); const err = h('div', { class: 'field-err', style: 'display:none' }, 'Alasan rollback wajib diisi (RUL-022).');
    const m = ui.modal({
      title: `Rollback batch ${b.id}`, size: 'md',
      body: h('div', { class: 'stack' },
        blockers.length ? ui.callout('danger', 'Rollback tidak bisa dijalankan', 'Sebagian data hasil impor sudah diproses lanjut. Rollback hanya boleh bila seluruh data batch masih utuh seperti saat diimpor.') : ui.callout('warn', 'Data hasil impor akan dihapus', `Akan menghapus ${live} worker dan ${b.appIds.length} lamaran dari batch ini. Tindakan tidak bisa dibatalkan, tetapi Worker ID tidak akan dipakai ulang (RUL-001). Kuota tidak terpengaruh (RUL-004).`),
        blockers.length ? h('ul', { class: 'wk-tips' }, blockers.slice(0, 8).map(x => h('li', null, h('a', { href: '#/workers/' + x.w.id, onClick: () => m.close() }, x.w.name + ' (' + x.w.id + ')'), ' — ', x.why.join(', ')))) : null,
        !blockers.length && h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Alasan rollback', h('i', { class: 'req' }, '*')), reason, err)),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), !blockers.length && ui.btn('Rollback batch', { kind: 'danger', icon: 'refresh', onClick: () => {
        if (!reason.value.trim()) { err.style.display = 'block'; reason.classList.add('invalid'); return; }
        const ids = new Set(b.workerIds); const aids = new Set(b.appIds);
        for (let i = D.applications.length - 1; i >= 0; i--) if (aids.has(D.applications[i].id) || ids.has(D.applications[i].workerId)) D.applications.splice(i, 1);
        for (let i = D.workers.length - 1; i >= 0; i--) if (ids.has(D.workers[i].id)) D.workers.splice(i, 1);
        Object.assign(b, { status: 'ROLLED_BACK', rollbackReason: reason.value.trim(), rolledBackAt: stamp(), rolledBackBy: BGS.state.userId });
        BGS.deriveWorkerStatus(); BGS.audit('Rollback impor', 'Import Batch', b.id, `${live} worker & ${b.appIds.length} lamaran dihapus. Alasan: ${reason.value.trim()}`);
        m.close(); ui.toast(`Batch ${b.id} di-rollback: ${live} worker & ${b.appIds.length} lamaran dihapus`, 'warn'); onDone && onDone();
      } })].filter(Boolean),
    });
  }

  BGS.router.add('/import', {
    title: 'Impor Excel', roles: OPS, mvp: 1,
    render(ctx) {
      if (IMP.step > 0 && IMP.step < 4 && !IMP.rows.length) IMP.step = 0;
      if (IMP.step === 3 && !IMP.batchId) IMP.step = 0;
      const host = h('div', { class: 'stack' }); const draw = () => { BGS.clear(host); host.append(ui.stepper(['Unggah', 'Pemetaan kolom', 'Dry-run hasil', 'Impor', 'Riwayat batch'], IMP.step), body()); window.scrollTo(0, 0); };
      const go = n => { IMP.step = n; draw(); };

      const tips = () => ui.card({ title: 'Tips pembersihan data', icon: 'sparkle', subtitle: 'Cutover dari Excel / Google Sheets (BRD §16.5)', body: h('ol', { class: 'wk-tips' },
        h('li', null, h('b', null, 'Inventarisasi: '), 'daftar semua spreadsheet, kolom, dan pemiliknya sebelum mulai.'),
        h('li', null, h('b', null, 'Bersihkan dulu: '), 'NIK 16 digit tanpa spasi/titik (format kolom sebagai Teks), tanggal dd/mm/yyyy, nama tanpa angka, negara & profesi sesuai Data Master.'),
        h('li', null, h('b', null, 'Selesaikan duplikat '), 'di Excel — NIK ganda diblok sistem (RUL-002).'),
        h('li', null, h('b', null, 'Impor uji kecil: '), 'coba 20–30 baris, lihat dry-run & laporan error, perbaiki, baru impor penuh.'),
        h('li', null, h('b', null, 'Rollback per batch '), 'tersedia selama data hasil impor belum diproses lanjut.'),
        h('li', null, h('b', null, 'Worker yang sedang diproses: '), 'dibuatkan Placement Case terpisah setelah impor (bukan lewat file ini).'),
        h('li', null, h('b', null, 'Dokumen '), 'diunggah menyusul secara manual. Bukti consent data lama perlu dilengkapi.'),
        h('li', null, h('b', null, 'Pembekuan: '), 'setelah migrasi diverifikasi, Excel lama dijadikan read-only / arsip.'))});
      const withTips = main => h('div', { class: 'grid cols-21' }, main, tips());

      // ---------- step 0: upload ----------
      const stepUpload = () => {
        const fileIn = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', style: 'display:none', onChange: e => e.target.files[0] && onFile(e.target.files[0]) });
        const dz = h('div', { class: 'wk-drop', onDragover: e => { e.preventDefault(); dz.classList.add('on'); }, onDragleave: () => dz.classList.remove('on'), onDrop: e => { e.preventDefault(); dz.classList.remove('on'); e.dataTransfer.files[0] && onFile(e.dataTransfer.files[0]); } },
          BGS.icon('upload', 40), h('b', null, 'Tarik file ke sini, atau pilih file'), small('Excel (.xlsx, .xls) atau CSV · baris pertama harus berisi judul kolom'),
          h('div', { class: 'row wrap gap-sm', style: 'justify-content:center' }, ui.btn('Pilih file…', { kind: 'primary', icon: 'folder', onClick: () => fileIn.click() }), ui.btn('Pakai contoh file', { icon: 'sparkle', onClick: () => { const s = makeSample(); loadParsed(s.headers, s.rows, `data-worker-lama-${IMP.sample}.xlsx`, true, 'File contoh dibuat otomatis (30 baris, sebagian sengaja bermasalah).'); draw(); ui.toast('Contoh file dimuat: 30 baris'); } }), ui.btn('Unduh template CSV', { icon: 'download', onClick: () => BGS.download('template-impor-worker.csv', [SAMPLE_HEADERS.join(','), '1,SITI AMINAH,3201010101950001,01/01/1995,P,081234567890,"Dsn. Sukamaju RT 01/02",Indramayu,Jawa Barat,SMA,Belum menikah,Arab Saudi,Domestic Worker,'].join('\n')) })),
          fileIn);
        async function onFile(f) {
          if (/\.csv$/i.test(f.name) || f.type === 'text/csv') {
            const rows = csvParse(await f.text()); if (rows.length < 2) { ui.toast('File kosong atau hanya berisi judul kolom', 'danger'); return; }
            loadParsed(rows[0].map(x => String(x).trim()), rows.slice(1), f.name, false, ''); draw(); ui.toast(`${rows.length - 1} baris dibaca dari ${f.name}`);
          } else { const s = makeSample(); loadParsed(s.headers, s.rows, f.name, true, 'Prototipe tidak membaca isi .xlsx sungguhan — isi file disimulasikan dengan data contoh. Untuk menguji file sendiri, simpan sebagai CSV.'); draw(); ui.toast(`File ${f.name} dimuat (isi disimulasikan)`, 'info'); }
        }
        const loaded = IMP.rows.length ? ui.card({ title: 'File siap diproses', icon: 'check-circle', body: h('div', { class: 'stack' },
          IMP.note && ui.callout('info', null, IMP.note),
          ui.kv([['Nama file', IMP.fileName], ['Jumlah baris data', IMP.rows.length], ['Jumlah kolom', IMP.headers.length]], 3),
          h('div', { class: 'wk-sec' }, 'Pratinjau 5 baris pertama'),
          h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl dense' }, h('thead', null, h('tr', null, IMP.headers.map(x => h('th', null, x)))), h('tbody', null, IMP.rows.slice(0, 5).map(r => h('tr', null, IMP.headers.map((_, i) => h('td', null, /nik/i.test(IMP.headers[i]) ? maskAny(r[i]) : r[i] || ''))))))),
          h('div', { class: 'form-actions' }, ui.btn('Ganti file', { onClick: () => { resetImp(); draw(); } }), ui.btn('Lanjut: pemetaan kolom', { kind: 'primary', icon: 'arrow-right', onClick: () => go(1) }))) }) : null;
        return withTips(h('div', { class: 'stack' }, ui.card({ title: '1. Unggah file', icon: 'upload', body: h('div', { class: 'stack' }, ui.callout('info', 'Impor tidak langsung mengubah data', 'Anda akan melihat hasil uji (dry-run) dan laporan error dulu. Data baru dibuat setelah Anda mengonfirmasi, sebagai satu batch yang bisa di-rollback (FR-WRK-017).'), dz) }), loaded));
      };

      // ---------- step 1: mapping ----------
      const stepMap = () => {
        const used = {}; Object.values(IMP.mapping).forEach(f => { if (f) used[f] = (used[f] || 0) + 1; });
        const missing = IMP_FIELDS.filter(f => f.required && !used[f.key]); const dupMap = Object.keys(used).filter(k => used[k] > 1);
        const sampleOf = i => IMP.rows.map(r => r[i]).filter(x => String(x || '').trim()).slice(0, 2).map(x => (/nik/i.test(IMP.headers[i]) || IMP.mapping[i] === 'nik' ? maskAny(x) : x)).join(' · ') || '—';
        const rowsEl = IMP.headers.map((hd, i) => { const f = IMP.mapping[i]; const isDup = f && used[f] > 1;
          return h('tr', null, h('td', null, h('b', null, hd)), h('td', { class: 'muted sm' }, sampleOf(i)), h('td', null, BGS.icon('arrow-right', 14)),
            h('td', null, h('select', { class: 'input wk-map-sel' + (isDup ? ' invalid' : ''), onChange: e => { IMP.mapping[i] = e.target.value; draw(); } }, h('option', { value: '' }, '— Abaikan kolom ini —'), IMP_FIELDS.map(x => h('option', { value: x.key, selected: f === x.key }, x.label + (x.required ? ' *' : ''))))),
            h('td', null, isDup ? ui.badge('dipakai 2×', 'red') : f ? ui.badge('dipetakan', 'green', { dot: true }) : ui.badge('diabaikan', 'gray'))); });
        const prev = IMP.rows.slice(0, 3);
        const colOf = {}; Object.entries(IMP.mapping).forEach(([i, f]) => { if (f && colOf[f] == null) colOf[f] = +i; });
        const usedFields = IMP_FIELDS.filter(f => colOf[f.key] != null);
        return withTips(h('div', { class: 'stack' },
          ui.card({ title: '2. Pemetaan kolom', icon: 'list', subtitle: `File: ${IMP.fileName} · ${IMP.rows.length} baris`, body: h('div', { class: 'stack' },
            ui.callout(missing.length || dupMap.length ? 'warn' : 'good', missing.length || dupMap.length ? 'Pemetaan belum lengkap' : 'Pemetaan siap', missing.length ? `Kolom wajib belum dipetakan: ${missing.map(f => f.label).join(', ')}.` : dupMap.length ? 'Ada kolom sistem yang dipetakan dua kali.' : 'Sistem mengenali judul kolom secara otomatis. Periksa dan ubah bila perlu.'),
            h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl dense' }, h('thead', null, h('tr', null, ['Kolom di file', 'Contoh isi', '', 'Kolom sistem', ''].map(x => h('th', null, x)))), h('tbody', null, rowsEl))),
            h('div', { class: 'form-grid cols-2' },
              field('Recruiter untuk data impor', h('select', { class: 'input', onChange: e => { IMP.recruiter = e.target.value; } }, staffAdmins().map(u => h('option', { value: u.id, selected: u.id === IMP.recruiter }, u.name)))),
              field('Bukti consent data lama', h('select', { class: 'input', onChange: e => { IMP.consentMode = e.target.value; } }, [['pending', 'Belum ada — tandai "perlu dilengkapi"'], ['archive', 'Ada, formulir fisik tersimpan di arsip']].map(([v, l]) => h('option', { value: v, selected: IMP.consentMode === v }, l))), h('span', { class: 'hint' }, 'RUL-029: consent harus tercatat. Impor memakai versi ' + curConsent() + '.'))),
            h('div', { class: 'wk-sec' }, 'Pratinjau hasil pemetaan (3 baris pertama)'),
            usedFields.length ? h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl dense' }, h('thead', null, h('tr', null, usedFields.map(f => h('th', null, f.label)))), h('tbody', null, prev.map(r => h('tr', null, usedFields.map(f => h('td', null, f.key === 'nik' ? maskAny(r[colOf.nik]) : r[colOf[f.key]] || ''))))))) : small('Belum ada kolom yang dipetakan.'),
            h('div', { class: 'form-actions' }, ui.btn('Kembali', { onClick: () => go(0) }), ui.btn('Jalankan dry-run', Object.assign({ kind: 'primary', icon: 'play', onClick: () => { IMP.result = dryRun(); go(2); } }, noPerm(!missing.length && !dupMap.length, 'Lengkapi pemetaan kolom wajib dulu')))) ) })));
      };

      // ---------- step 2: dry-run ----------
      const stepDry = () => {
        const R = IMP.result || []; const val = R.filter(r => r.status === 'VALID'), err = R.filter(r => r.status === 'ERROR'), dup = R.filter(r => r.status === 'DUPLICATE'), bad = R.filter(r => r.status !== 'VALID');
        const exportErr = () => { const rows = []; bad.forEach(r => r.issues.forEach(x => rows.push({ baris: r.rowNo, jenis: r.status === 'ERROR' ? 'Error' : 'Duplikat', kolom: x.field, pesan: x.msg, nama: r.label, nik: maskAny(r.nikRaw) }))); BGS.exportCsv(rows, [{ label: 'Baris di file', key: 'baris' }, { label: 'Jenis', key: 'jenis' }, { label: 'Kolom', key: 'kolom' }, { label: 'Pesan', key: 'pesan' }, { label: 'Nama', key: 'nama' }, { label: 'NIK (disamarkan)', key: 'nik' }], `laporan-error-${IMP.fileName.replace(/\.[^.]+$/, '')}.csv`); };
        const doImport = async () => {
          const ok = await ui.confirm({ title: 'Mulai impor', message: `Akan membuat ${val.length} Worker (+ lamaran untuk yang punya tujuan) sebagai satu batch. ${bad.length} baris bermasalah dilewati. Batch bisa di-rollback selama data belum diproses lanjut.`, confirmLabel: `Impor ${val.length} worker`, tone: 'primary' });
          if (!ok) return; try { const b = runImport(R); IMP.batchId = b.id; ui.toast(`Batch ${b.id}: ${b.imported} worker dibuat`); go(3); } catch (e) { ui.toast(e.message, 'danger'); }
        };
        const issueCell = r => h('ul', { style: 'margin:0;padding-left:16px' }, r.issues.map(x => h('li', null, ui.badge(x.field, x.kind === 'dup' ? 'amber' : 'red'), ' ', x.msg)));
        const badTable = () => ui.table({ rows: bad, pageSize: 8, rowClass: r => (r.status === 'ERROR' ? 'wk-rowerr' : 'wk-rowdup'), empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada baris bermasalah', text: 'Semua baris lolos pemeriksaan.' }),
          columns: [{ key: 'rowNo', label: 'Baris', sortable: true, render: r => h('b', null, '#' + r.rowNo) }, { key: 'label', label: 'Nama', render: r => r.label }, { key: 'nik', label: 'NIK', render: r => h('span', { class: 'mono' }, maskAny(r.nikRaw)) }, { key: 'status', label: 'Jenis', render: r => ui.badge(r.status === 'ERROR' ? 'Error' : 'Duplikat', r.status === 'ERROR' ? 'red' : 'amber', { dot: true }) }, { key: 'issues', label: 'Masalah', render: issueCell }] });
        const okTable = () => ui.table({ rows: val, pageSize: 8, empty: ui.emptyState({ icon: 'alert', title: 'Tidak ada baris yang siap diimpor', text: 'Perbaiki file lalu unggah ulang.' }),
          columns: [{ key: 'rowNo', label: 'Baris', render: r => '#' + r.rowNo }, { key: 'label', label: 'Nama', render: r => r.data.name }, { key: 'nik', label: 'NIK', render: r => h('span', { class: 'mono' }, maskAny(r.data.nik)) }, { key: 'dob', label: 'Tgl lahir', render: r => fmt.date(r.data.dob) },
            { key: 'tujuan', label: 'Lamaran', render: r => (r.data.country ? `${D.cn(r.data.country)} · ${D.pn(r.data.profession)}` : small('Tanpa lamaran')) }, { key: 'warn', label: 'Catatan', render: r => (r.warns.length ? ui.badge(r.warns[0], 'amber') : '—') }] });
        return withTips(h('div', { class: 'stack' },
          ui.card({ title: '3. Hasil dry-run', icon: 'clipboard', subtitle: 'Uji coba — belum ada data yang dibuat', body: h('div', { class: 'stack' },
            h('div', { class: 'grid cols-4' }, ui.kpi({ label: 'Total baris', value: R.length, tone: 'blue', icon: 'list' }), ui.kpi({ label: 'Siap diimpor', value: val.length, tone: 'green', icon: 'check-circle' }), ui.kpi({ label: 'Error', value: err.length, tone: err.length ? 'red' : 'green', icon: 'x-circle' }), ui.kpi({ label: 'Duplikat', value: dup.length, tone: dup.length ? 'amber' : 'green', icon: 'copy' })),
            ui.progress(R.length ? Math.round((val.length / R.length) * 100) : 0, val.length === R.length ? 'green' : 'amber', `${val.length} dari ${R.length} baris valid`),
            ui.callout(bad.length ? 'warn' : 'good', bad.length ? `${bad.length} baris perlu diperbaiki` : 'Semua baris valid', bad.length ? 'Baris bermasalah akan dilewati. Unduh laporan error, perbaiki di Excel, lalu impor ulang sebagai batch baru.' : 'Siap diimpor.'),
            ui.tabs([{ id: 'bad', label: 'Perlu diperbaiki', count: bad.length, render: badTable }, { id: 'ok', label: 'Siap diimpor', count: val.length, render: okTable }], { active: bad.length ? 'bad' : 'ok' }),
            h('div', { class: 'form-actions', style: 'flex-wrap:wrap' }, ui.btn('Unduh laporan error (CSV)', Object.assign({ icon: 'download', onClick: exportErr }, noPerm(bad.length > 0, 'Tidak ada error untuk dilaporkan'))), h('span', { class: 'grow' }), ui.btn('Kembali ke pemetaan', { onClick: () => go(1) }), ui.btn('Unggah ulang', { onClick: () => { resetImp(); draw(); } }), ui.btn(`Impor ${val.length} worker valid`, Object.assign({ kind: 'primary', icon: 'check', onClick: doImport }, noPerm(val.length > 0, 'Tidak ada baris valid untuk diimpor'))))) })));
      };

      // ---------- step 3: result ----------
      const stepDone = () => {
        const b = D.importBatches.find(x => x.id === IMP.batchId);
        if (!b) return ui.emptyState({ title: 'Batch tidak ditemukan', action: ui.btn('Mulai impor baru', { onClick: () => { resetImp(); draw(); } }) });
        const rolled = b.status === 'ROLLED_BACK';
        return h('div', { class: 'stack' }, ui.card({ title: '4. Impor selesai', icon: rolled ? 'refresh' : 'check-circle', body: h('div', { class: 'stack' },
          rolled ? ui.callout('warn', `Batch ${b.id} sudah di-rollback`, `${b.rollbackReason} — oleh ${userName(b.rolledBackBy)}, ${fmt.dateTime(b.rolledBackAt)}.`) : ui.callout('good', `Batch ${b.id} berhasil diimpor`, `${b.imported} Worker dan ${b.apps} lamaran dibuat dengan sumber "Impor". Kuota tidak terpengaruh (RUL-004).`),
          ui.kv([['ID batch', h('span', { class: 'mono' }, b.id)], ['File', b.fileName], ['Waktu', fmt.dateTime(b.at)], ['Worker dibuat', rolled ? '0 (di-rollback)' : b.imported], ['Lamaran dibuat', rolled ? '0 (di-rollback)' : b.apps], ['Baris dilewati', `${b.errors} error · ${b.duplicates} duplikat`], ['Recruiter', userName(b.recruiterId)], ['Bukti consent', b.consentMode === 'archive' ? 'Formulir fisik di arsip' : 'Perlu dilengkapi']], 2),
          !rolled && b.consentMode !== 'archive' && ui.callout('info', 'Langkah berikutnya', 'Lengkapi bukti consent, unggah dokumen, dan mulai screening dari menu Lamaran & seleksi.'),
          h('div', { class: 'form-actions', style: 'flex-wrap:wrap' }, !rolled && h('a', { class: 'btn', href: '#/workers?batch=' + b.id }, BGS.icon('users', 16), 'Lihat worker hasil impor'), !rolled && ui.btn('Rollback batch ini', { kind: 'danger', icon: 'refresh', onClick: () => openRollback(b, draw) }), ui.btn('Riwayat batch', { onClick: () => go(4) }), ui.btn('Impor file lain', { kind: 'primary', onClick: () => { resetImp(); draw(); } }))) }));
      };

      // ---------- step 4: history ----------
      const stepHistory = () => ui.card({ title: '5. Riwayat batch impor', icon: 'clock', subtitle: 'Rollback per batch (FR-WRK-017)', actions: [ui.btn('Impor baru', { kind: 'primary', icon: 'upload', onClick: () => { resetImp(); draw(); } })], flush: true, body: ui.table({ rows: D.importBatches, pageSize: 10,
        empty: ui.emptyState({ icon: 'upload', title: 'Belum ada impor', text: 'Batch muncul di sini setelah Anda mengimpor file.', action: ui.btn('Mulai impor', { kind: 'primary', onClick: () => go(0) }) }),
        columns: [{ key: 'id', label: 'Batch', render: b => h('span', { class: 'mono b' }, b.id) }, { key: 'file', label: 'File', render: b => b.fileName }, { key: 'at', label: 'Waktu', render: b => fmt.dateTime(b.at) }, { key: 'by', label: 'Oleh', render: b => ui.userChip(b.by) },
          { key: 'total', label: 'Baris', align: 'right', render: b => b.total }, { key: 'imp', label: 'Diimpor', align: 'right', render: b => (b.status === 'ROLLED_BACK' ? small(`${b.imported} → 0`) : h('b', null, b.imported)) }, { key: 'skip', label: 'Dilewati', align: 'right', render: b => b.errors + b.duplicates },
          { key: 'status', label: 'Status', render: b => (b.status === 'APPLIED' ? ui.badge('Diterapkan', 'green', { dot: true }) : ui.badge('Di-rollback', 'gray', { dot: true, title: b.rollbackReason })) },
          { key: 'act', label: '', render: b => h('div', { class: 'row gap-sm' }, b.status === 'APPLIED' ? h('a', { class: 'btn btn-sm', href: '#/workers?batch=' + b.id }, 'Lihat worker') : null, b.status === 'APPLIED' ? ui.btn('Rollback', { sm: true, kind: 'danger', icon: 'refresh', onClick: () => openRollback(b, draw) }) : small(b.rollbackReason ? 'Alasan: ' + b.rollbackReason : '')) }] }) });

      const body = () => [stepUpload, stepMap, stepDry, stepDone, stepHistory][IMP.step]();
      ctx.el.append(
        ui.pageHeader({ title: 'Impor Excel', mvp: 1, subtitle: 'Pindahkan data worker dari Excel / Google Sheets dengan uji coba (dry-run), laporan error, dan rollback per batch.', breadcrumbs: [{ label: 'Worker', href: '/workers' }, { label: 'Impor Excel' }],
          actions: [ui.btn(`Riwayat batch (${D.importBatches.length})`, { icon: 'clock', onClick: () => go(4) }), IMP.step > 0 && IMP.step < 4 && IMP.step !== 3 ? ui.btn('Mulai ulang', { icon: 'refresh', onClick: () => { resetImp(); draw(); } }) : null] }),
        host);
      draw();
    },
  });
})();
