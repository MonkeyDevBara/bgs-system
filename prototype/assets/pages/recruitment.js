/* M03 Recruitment (lamaran & seleksi) + M04 Document (pusat dokumen). Routes: /applications, /applications/:id, /documents */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui;
  const ALL = ['superadmin', 'director', 'admin', 'pic', 'viewer'];
  const DAY = 86400000;

  // ============================ shared helpers ============================
  const me = () => BGS.state.userId;
  const nowIso = () => BGS.today.toISOString();
  const uname = id => (D.user(id) || {}).name || '—';
  const TERMINAL = ['REJECTED', 'WITHDRAWN', 'CANCELLED'];
  const isActive = a => !TERMINAL.includes(a.status);
  const routeName = id => (D.routes.find(r => r.id === id) || {}).name || id;
  const combo = a => `${D.cn(a.country)} · ${D.pn(a.profession)}`;
  const ageDays = a => Math.max(0, Math.round((BGS.today - new Date(a.createdAt)) / DAY));
  const threshold = () => D.settings.assessmentThreshold || 70;
  const pad2 = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const keepScroll = fn => { const m = BGS.$('#main'); const a = m ? m.scrollTop : 0, b = window.scrollY; fn(); if (m) m.scrollTop = a; window.scrollTo(0, b); };
  const fld = (label, input, hint, req) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label, req && h('i', { class: 'req' }, '*')), input, hint && h('span', { class: 'hint' }, hint));
  const opts = (list, sel) => list.map(([v, l]) => h('option', { value: v, selected: String(sel) === String(v) }, l));
  const addHist = (app, text, tone) => app.history.push({ at: nowIso(), by: me(), text, tone });
  const notFound = (title, text) => ui.emptyState({ icon: 'lock', title, text, action: h('a', { class: 'btn btn-primary', href: '#/applications' }, 'Kembali ke daftar lamaran') });
  const tomorrowLocal = () => { const d = new Date(BGS.today.getTime() + DAY); return `${ymd(d)}T09:00`; };

  // ---- documents: model helpers ----
  const WORKER_TYPES = ['DT01', 'DT02', 'DT03', 'DT04', 'DT05', 'DT06', 'DT07', 'DT08', 'DT09', 'DT10', 'DT13'];
  const CASE_TYPES = D.docTypes.map(t => t.id).filter(id => !WORKER_TYPES.includes(id));
  const typeName = d => (D.docType(d.typeId) || {}).name || d.typeId;
  const currentDoc = (ownerType, ownerId, typeId) => D.documents.filter(d => d.ownerType === ownerType && d.ownerId === ownerId && d.typeId === typeId && d.status !== 'SUPERSEDED').sort((a, b) => b.version - a.version)[0] || null;
  const versionsOf = d => D.documents.filter(x => x.ownerType === d.ownerType && x.ownerId === d.ownerId && x.typeId === d.typeId).sort((a, b) => b.version - a.version);
  const ownerWorkerId = d => d.ownerType === 'worker' ? d.ownerId : (D.case(d.ownerId) || {}).workerId;
  const ownerName = d => (D.worker(ownerWorkerId(d)) || {}).name || '—';
  const visibleDocs = () => {
    let list = D.documents;
    if (BGS.scope.isLimited()) {
      const ws = new Set(BGS.scope.workers().map(w => w.id)), cs = new Set(BGS.scope.cases().map(c => c.id));
      list = list.filter(d => d.ownerType === 'worker' ? ws.has(d.ownerId) : cs.has(d.ownerId));
    }
    return list;
  };
  const daysLeft = d => (d.expiresAt ? BGS.fmt.daysFrom(d.expiresAt) : null);
  const expiryBadge = d => {
    const n = daysLeft(d); if (n == null) return h('span', { class: 'muted' }, '—');
    if (n < 0) return ui.badge(`Lewat ${-n} hari`, 'red', { dot: true });
    return ui.badge(`${n} hari lagi`, n <= 30 ? 'red' : 'amber', { dot: true });
  };
  const addMonths = (n) => { const d = new Date(BGS.today); d.setMonth(d.getMonth() + n); return ymd(d); };
  const nextDocId = () => 'DOC-' + String(Math.max(0, ...D.documents.map(d => parseInt(d.id.slice(4), 10) || 0)) + 1).padStart(5, '0');
  const ownerCell = d => d.ownerType === 'worker'
    ? h('div', null, ui.workerLink(d.ownerId), h('div', { class: 'muted xs mono' }, d.ownerId))
    : h('div', null, ui.caseLink(d.ownerId), h('div', { class: 'muted xs' }, ownerName(d)));

  // ---- document actions (RUL-016, RUL-022, RUL-023, BR-009) ----
  function guardReview(d) {
    if (!BGS.can('document.verify')) { ui.toast(`Peran ${BGS.roles[BGS.role()]} tidak boleh memverifikasi dokumen.`, 'danger'); return false; }
    if (d.status !== 'UPLOADED') { ui.toast('Hanya dokumen berstatus "Menunggu verifikasi" yang dapat diperiksa.', 'warn'); return false; }
    if (D.settings.uploaderCannotVerify && d.uploadedBy === me()) { ui.toast('Anda yang mengunggah dokumen ini, jadi tidak boleh memverifikasinya. Minta Admin/PIC lain memeriksa (RUL-016: pembuat ≠ pemeriksa).', 'danger'); return false; }
    return true;
  }
  function verifyDoc(d, done) {
    if (!guardReview(d)) return;
    if (daysLeft(d) != null && daysLeft(d) < 0) { ui.toast('Dokumen sudah kedaluwarsa. Minta unggah versi baru.', 'danger'); return; }
    d.status = 'VERIFIED'; d.verifiedBy = me(); d.verifiedAt = nowIso(); d.rejectReason = null;
    BGS.audit('Dokumen diverifikasi', 'Dokumen', d.id, `${typeName(d)} v${d.version} · pemilik ${d.ownerId}`);
    ui.toast(`${typeName(d)} terverifikasi`); done && done();
  }
  async function rejectDoc(d, done) {
    if (!guardReview(d)) return;
    const r = await ui.reasonPrompt({ title: 'Tolak dokumen', message: `${typeName(d)} · ${d.filename}. Alasan akan dilihat oleh pengunggah (RUL-022).`, label: 'Alasan penolakan', confirmLabel: 'Tolak dokumen', tone: 'danger', presets: ['Gambar buram / terpotong', 'Dokumen salah jenis', 'Data tidak sesuai profil', 'Dokumen tidak lengkap'] });
    if (!r) return;
    d.status = 'REJECTED'; d.verifiedBy = me(); d.verifiedAt = nowIso(); d.rejectReason = r;
    BGS.audit('Dokumen ditolak', 'Dokumen', d.id, `${typeName(d)} v${d.version} · Alasan: ${r}`);
    if (d.uploadedBy && d.uploadedBy !== me()) BGS.notify(d.uploadedBy, `Dokumen ${typeName(d)} (${ownerName(d)}) ditolak: ${r}`, '#/documents?owner=' + d.ownerId, 'WARN');
    ui.toast('Dokumen ditolak. Pengunggah akan diberi tahu.', 'warn'); done && done();
  }
  function openDoc(d, done) {
    const t = D.docType(d.typeId) || { name: d.typeId };
    BGS.audit('Dokumen dibuka', 'Dokumen', d.id, `${t.name} v${d.version}`);
    const wid = ownerWorkerId(d), w = D.worker(wid) || {};
    const wm = h('div', { class: 'rc-wm', 'aria-hidden': 'true' }, Array.from({ length: 36 }, () => h('span', null, `BGS · ${uname(me())} · ${BGS.fmt.date(BGS.today)} · RAHASIA`)));
    const bar = wd => h('div', { class: 'rc-line', style: `width:${wd}%` });
    const paper = h('div', { class: 'rc-paper' }, wm,
      h('div', { class: 'rc-paper-in' },
        h('div', { class: 'rc-paper-top' }, h('b', null, t.name.toUpperCase()), h('span', { class: 'muted xs' }, 'CONTOH DOKUMEN — SIMULASI')),
        h('div', { class: 'rc-paper-body' },
          d.typeId === 'DT01' || d.typeId === 'DT02' || d.typeId === 'DT08' ? h('div', { class: 'rc-photo' }, BGS.icon('user', 40)) : null,
          h('div', { class: 'stack-sm', style: 'flex:1' },
            h('div', null, h('span', { class: 'muted xs' }, 'Nama'), h('div', { class: 'b' }, w.name || '—')),
            d.typeId === 'DT02' ? h('div', null, h('span', { class: 'muted xs' }, 'NIK'), h('div', { class: 'mono' }, w.nik)) : null,
            d.typeId === 'DT08' ? h('div', null, h('span', { class: 'muted xs' }, 'No. paspor'), h('div', { class: 'mono' }, w.passport)) : null,
            bar(80), bar(65), bar(72))),
        bar(95), bar(88), bar(92), bar(60), bar(78),
        h('div', { class: 'rc-paper-foot muted xs' }, `${d.filename} · v${d.version}`)));
    const vers = versionsOf(d);
    const body = h('div', { class: 'stack' },
      ui.callout('info', 'Tautan aman', 'Tautan berumur pendek (kedaluwarsa dalam 5 menit), berkas dipindai malware dan disimpan terenkripsi (BR-009). Watermark berisi nama Anda dan tanggal akses.'),
      paper,
      ui.kv([['Jenis', t.name], ['Status', ui.status('document', d.status)], ['Pemilik', ownerCell(d)], ['Diunggah', `${uname(d.uploadedBy)} · ${BGS.fmt.dateTime(d.uploadedAt)}`], ['Diperiksa', d.verifiedBy ? `${uname(d.verifiedBy)} · ${BGS.fmt.dateTime(d.verifiedAt)}` : 'Belum'], d.rejectReason ? ['Alasan penolakan', d.rejectReason] : null, ['Berlaku s/d', d.expiresAt ? h('span', { class: 'row gap-sm' }, BGS.fmt.date(d.expiresAt), expiryBadge(d)) : 'Tanpa masa berlaku'], ['Ukuran', `${BGS.fmt.num(d.sizeKb)} KB`]], 2),
      vers.length > 1 ? h('div', null, h('h4', { style: 'margin:0 0 6px' }, 'Riwayat versi (RUL-023)'), versionTable(vers)) : null);
    const m = ui.modal({
      title: `${t.name} · versi ${d.version}`, size: 'lg', body,
      footer: [
        ui.btn('Unduh', { icon: 'download', onClick: () => { BGS.audit('Dokumen diunduh', 'Dokumen', d.id, `${t.name} v${d.version}`); ui.toast('Unduhan disimulasikan dan tercatat di audit', 'info'); } }),
        BGS.can('document.upload') && ['VERIFIED', 'REJECTED', 'EXPIRED', 'UPLOADED'].includes(d.status) ? ui.btn('Unggah versi baru', { icon: 'upload', onClick: () => { m.close(); uploadDialog({ ownerType: d.ownerType, ownerId: d.ownerId, typeId: d.typeId, onDone: done }); } }) : null,
        d.status === 'UPLOADED' && BGS.can('document.verify') ? ui.btn('Tolak', { kind: 'danger', icon: 'x', onClick: () => { m.close(); rejectDoc(d, done); } }) : null,
        d.status === 'UPLOADED' && BGS.can('document.verify') ? ui.btn('Verifikasi', { kind: 'good', icon: 'check', onClick: () => { if (D.settings.uploaderCannotVerify && d.uploadedBy === me()) return verifyDoc(d); m.close(); verifyDoc(d, done); } }) : null,
      ],
    });
  }
  function versionTable(vers) {
    return ui.table({ dense: true, pageSize: 20, rows: vers, columns: [
      { label: 'Versi', render: v => 'v' + v.version }, { label: 'Berkas', render: v => h('span', { class: 'mono' }, v.filename) },
      { label: 'Status', render: v => ui.status('document', v.status) }, { label: 'Diunggah', render: v => `${uname(v.uploadedBy)} · ${BGS.fmt.date(v.uploadedAt)}` },
    ] });
  }
  function showVersions(d) {
    const vers = versionsOf(d);
    ui.modal({ title: `Riwayat versi · ${typeName(d)}`, size: 'lg', body: h('div', { class: 'stack' }, h('p', { class: 'muted' }, `Pemilik: ${d.ownerType === 'worker' ? ownerName(d) : d.ownerId}. Versi lama tidak pernah dihapus, hanya ditandai "Digantikan" (RUL-023).`), versionTable(vers)) });
  }

  // ---- upload dialog (simulated file) ----
  function uploadDialog({ ownerType = 'worker', ownerId, typeId, onDone } = {}) {
    if (!BGS.can('document.upload')) { ui.toast('Peran Anda tidak boleh mengunggah dokumen.', 'danger'); return; }
    const workers = BGS.scope.workers().slice().sort((a, b) => a.name.localeCompare(b.name));
    const cases = BGS.scope.cases();
    const oType = h('select', { class: 'input' }, opts([['worker', 'Worker (dokumen pribadi)'], ['case', 'Placement Case (dokumen proses)']], ownerType));
    const oSel = h('select', { class: 'input' });
    const tSel = h('select', { class: 'input' });
    const fileIn = h('input', { class: 'input', type: 'file', onChange: e => { if (e.target.files[0]) fname.value = e.target.files[0].name; } });
    const fname = h('input', { class: 'input', placeholder: 'mis. paspor-siti.pdf' });
    const exp = h('input', { class: 'input', type: 'date' });
    const info = h('div'); const err = h('div', { class: 'field-err', style: 'display:none' });
    const fillOwners = () => {
      const list = oType.value === 'worker' ? workers.map(w => [w.id, `${w.name} · ${w.id}`]) : cases.map(c => [c.id, `${c.id} · ${(D.worker(c.workerId) || {}).name || ''}`]);
      if (ownerId && !list.some(([v]) => v === ownerId) && (oType.value === 'worker' ? !ownerId.startsWith('PC-') : ownerId.startsWith('PC-'))) list.unshift([ownerId, ownerId]);
      BGS.clear(oSel); oSel.append(...opts(list, ownerId));
    };
    const fillTypes = () => {
      const ids = oType.value === 'worker' ? WORKER_TYPES : CASE_TYPES;
      BGS.clear(tSel); tSel.append(...opts(ids.map(id => [id, D.docType(id).name]), typeId));
    };
    const refreshInfo = () => {
      const t = D.docType(tSel.value); BGS.clear(info); if (!t) return;
      const cur = currentDoc(oType.value, oSel.value, t.id);
      if (!exp.dataset.touched) exp.value = t.validMonths && t.id !== 'DT08' ? addMonths(t.validMonths) : exp.value && t.id === 'DT08' ? exp.value : '';
      info.append(cur ? ui.callout('warn', `Sudah ada ${t.name} v${cur.version} (${BGS.ST.document[cur.status][0]})`, `Dokumen baru akan menjadi versi ${Math.max(...versionsOf(cur).map(v => v.version)) + 1}. Versi lama otomatis ditandai "Digantikan" dan tetap tersimpan (RUL-023).`) : ui.callout('info', null, `Belum ada ${t.name} untuk pemilik ini. Dokumen akan menjadi versi 1.`));
    };
    exp.addEventListener('input', () => { exp.dataset.touched = '1'; });
    oType.addEventListener('change', () => { ownerId = null; fillOwners(); fillTypes(); refreshInfo(); });
    oSel.addEventListener('change', refreshInfo); tSel.addEventListener('change', () => { delete exp.dataset.touched; exp.value = ''; refreshInfo(); });
    fillOwners(); fillTypes(); if (typeId) tSel.value = typeId; refreshInfo();
    const submit = () => {
      const t = D.docType(tSel.value); const fn = fname.value.trim(); const msgs = [];
      if (!oSel.value) msgs.push('Pilih pemilik dokumen.');
      if (!fn) msgs.push('Nama berkas wajib diisi (pilih berkas atau ketik namanya).');
      if (t.validMonths > 0 && !exp.value) msgs.push(`${t.name} wajib diisi tanggal kedaluwarsa.`);
      if (exp.value && new Date(exp.value) < BGS.today) msgs.push('Tanggal kedaluwarsa sudah lewat. Gunakan dokumen yang masih berlaku.');
      if (msgs.length) { err.textContent = msgs.join(' '); err.style.display = 'block'; return; }
      const prev = currentDoc(oType.value, oSel.value, t.id);
      const version = Math.max(0, ...D.documents.filter(x => x.ownerType === oType.value && x.ownerId === oSel.value && x.typeId === t.id).map(x => x.version)) + 1;
      D.documents.filter(x => x.ownerType === oType.value && x.ownerId === oSel.value && x.typeId === t.id && x.status !== 'SUPERSEDED').forEach(x => { x.status = 'SUPERSEDED'; });
      const doc = { id: nextDocId(), ownerType: oType.value, ownerId: oSel.value, typeId: t.id, filename: fn, version, status: 'UPLOADED', uploadedBy: me(), uploadedAt: nowIso(), verifiedBy: null, verifiedAt: null, rejectReason: null, expiresAt: exp.value || null, sizeKb: (fileIn.files[0] ? Math.max(1, Math.round(fileIn.files[0].size / 1024)) : 300 + Math.floor(Math.random() * 1500)) };
      D.documents.push(doc);
      BGS.audit('Dokumen diunggah', 'Dokumen', doc.id, `${t.name} v${version} · pemilik ${doc.ownerId}${prev ? ` · menggantikan v${prev.version} (SUPERSEDED)` : ''}`);
      m.close();
      ui.toast(prev ? `${t.name} versi ${version} diunggah. Versi ${prev.version} ditandai Digantikan (RUL-023).` : `${t.name} diunggah dan menunggu verifikasi.`);
      onDone && onDone(doc);
    };
    const m = ui.modal({
      title: 'Unggah dokumen', size: 'md',
      body: h('div', { class: 'stack' },
        h('div', { class: 'form-grid cols-2' }, fld('Jenis pemilik', oType, null, true), fld('Pemilik', oSel, null, true), fld('Jenis dokumen', tSel, null, true), fld('Tanggal kedaluwarsa', exp, 'Wajib untuk dokumen yang punya masa berlaku (paspor, MCU, SKCK, visa).')),
        fld('Berkas (simulasi)', fileIn, 'Berkas tidak diunggah ke server. Hanya namanya yang dicatat. Format PDF/JPG/PNG, maks 5 MB; dipindai malware.'),
        fld('Nama berkas', fname, null, true), info, err),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Unggah', { kind: 'primary', icon: 'upload', onClick: submit })],
    });
    return m;
  }

  // ============================ styles ============================
  BGS.addStyle(`
  .rc-board{display:flex;gap:12px;overflow-x:auto;padding-bottom:10px;align-items:flex-start}
  .rc-col{flex:0 0 250px;background:#F1F5F9;border-radius:12px;border-top:4px solid var(--rc-c,#64748B);padding:8px;display:flex;flex-direction:column;gap:8px;max-height:72vh}
  .rc-col-h{display:flex;justify-content:space-between;align-items:center;padding:2px 4px;font-weight:800;font-size:13px}
  .rc-col-h .tab-n{background:#fff}
  .rc-col-b{display:flex;flex-direction:column;gap:8px;overflow-y:auto}
  .rc-card{display:block;background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(15,23,42,.05)}
  .rc-card:hover{border-color:var(--blue);box-shadow:0 2px 8px rgba(29,78,216,.15)}
  .rc-card b{display:block;font-size:13.5px}
  .rc-card .mono{color:var(--muted)}
  .rc-meta{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:6px;flex-wrap:wrap}
  .rc-empty{font-size:12px;color:var(--muted);text-align:center;padding:14px 6px}
  .rc-chk{display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
  .rc-chk:last-child{border-bottom:0}
  .rc-chk .rc-ic{display:flex;justify-content:center}
  .rc-ic.ok{color:#15803D}.rc-ic.bad{color:#B91C1C}.rc-ic.wait{color:#B45309}.rc-ic.none{color:#94A3B8}
  .rc-acts{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
  @media(max-width:760px){.rc-chk{grid-template-columns:24px 1fr}.rc-acts{grid-column:1/-1;justify-content:flex-start}}
  .rc-score{display:flex;align-items:baseline;gap:8px}.rc-score b{font-size:34px;line-height:1}
  .rc-lock{display:flex;gap:10px;align-items:center;color:var(--muted);font-size:13px;padding:6px 0}
  .rc-paper{position:relative;background:#fff;border:1px solid #CBD5E1;border-radius:6px;min-height:300px;overflow:hidden;box-shadow:inset 0 0 0 6px #F8FAFC}
  .rc-paper-in{position:relative;padding:26px 28px;display:flex;flex-direction:column;gap:12px}
  .rc-paper-top{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0F172A;padding-bottom:8px;gap:8px;flex-wrap:wrap}
  .rc-paper-body{display:flex;gap:16px;align-items:flex-start}
  .rc-photo{width:86px;height:110px;background:#E2E8F0;color:#94A3B8;display:flex;align-items:center;justify-content:center;border-radius:4px;flex:none}
  .rc-line{height:9px;background:#E2E8F0;border-radius:4px}
  .rc-paper-foot{margin-top:18px}
  .rc-wm{position:absolute;inset:-60%;display:flex;flex-wrap:wrap;gap:34px 40px;transform:rotate(-26deg);align-content:center;justify-content:center;pointer-events:none;z-index:2;user-select:none}
  .rc-wm span{font-weight:800;font-size:13px;color:#1D4ED8;opacity:.16;white-space:nowrap}
  .rc-banner{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  `);

  // ============================ /applications ============================
  let appView = 'list';
  const KCOLS = [
    ['SUBMITTED', 'Diajukan', ['SUBMITTED'], '#1D4ED8'], ['SCREENING', 'Screening', ['SCREENING', 'REVISION_REQUIRED'], '#6D28D9'], ['INTERVIEW', 'Wawancara', ['INTERVIEW'], '#6D28D9'],
    ['ASSESSMENT', 'Penilaian', ['ASSESSMENT'], '#6D28D9'], ['SELECTED', 'Terpilih', ['SELECTED'], '#15803D'], ['WAITLISTED', 'Cadangan', ['WAITLISTED'], '#B45309'],
    ['ALLOCATED', 'Dialokasikan', ['ALLOCATED'], '#0F766E'], ['REJECTED', 'Ditolak', ['REJECTED'], '#B91C1C'],
  ];

  function appRecruiters() { return [...new Set(D.applications.map(a => a.recruiterId))].filter(Boolean).map(id => [id, uname(id)]); }
  const appSearch = a => `${a.id} ${(D.worker(a.workerId) || {}).name || ''} ${a.workerId} ${combo(a)}`;

  function kanban(items) {
    const f = { q: '', country: '', profession: '', recruiter: '' };
    const board = h('div', { class: 'rc-board' });
    const draw = () => {
      BGS.clear(board);
      const list = items.filter(a => (!f.q || appSearch(a).toLowerCase().includes(f.q.toLowerCase())) && (!f.country || a.country === f.country) && (!f.profession || a.profession === f.profession) && (!f.recruiter || a.recruiterId === f.recruiter));
      KCOLS.forEach(([key, label, sts, color]) => {
        const col = list.filter(a => sts.includes(a.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        board.appendChild(h('div', { class: 'rc-col', style: `--rc-c:${color}` },
          h('div', { class: 'rc-col-h' }, h('span', null, label), h('span', { class: 'tab-n' }, col.length)),
          h('div', { class: 'rc-col-b' }, col.length ? col.map(a => h('a', { class: 'rc-card', href: '#/applications/' + a.id },
            h('b', null, (D.worker(a.workerId) || {}).name || a.workerId), h('div', { class: 'mono' }, a.id), h('div', { class: 'sm', style: 'margin-top:4px' }, combo(a)),
            h('div', { class: 'rc-meta' }, a.status === 'REVISION_REQUIRED' ? ui.badge('Perlu revisi', 'amber', { dot: true }) : h('span', { class: 'muted xs' }, uname(a.recruiterId)), h('span', { class: 'muted xs' }, `${ageDays(a)} hari`)))) : h('div', { class: 'rc-empty' }, 'Tidak ada lamaran'))));
      });
    };
    const sel = (key, label, options) => h('select', { class: 'input sel', title: label, onChange: e => { f[key] = e.target.value; draw(); } }, h('option', { value: '' }, label + ': semua'), options.map(([v, l]) => h('option', { value: v }, l)));
    draw();
    return h('div', null,
      h('div', { class: 'toolbar' }, h('div', { class: 'search' }, BGS.icon('search', 16), h('input', { class: 'input', placeholder: 'Cari nama, ID lamaran…', onInput: e => { f.q = e.target.value; draw(); } })),
        sel('country', 'Negara', D.countries.map(c => [c.code, c.name])), sel('profession', 'Profesi', D.professions.map(p => [p.code, p.name])), sel('recruiter', 'Recruiter', appRecruiters())),
      board, h('div', { class: 'muted sm' }, `Lamaran berstatus Mundur/Dibatalkan (${items.filter(a => ['WITHDRAWN', 'CANCELLED'].includes(a.status)).length}) tidak ditampilkan di papan; lihat di tampilan Daftar.`));
  }

  function addApplicationDialog(done) {
    const workers = D.workers.filter(w => !w.aliasOf && w.status !== 'ARCHIVED').slice().sort((a, b) => a.name.localeCompare(b.name));
    const wSel = h('select', { class: 'input' }, h('option', { value: '' }, '— pilih worker —'), workers.map(w => h('option', { value: w.id }, `${w.name} · ${w.id}`)));
    const cSel = h('select', { class: 'input' }, h('option', { value: '' }, '— pilih negara —'), D.countries.map(c => h('option', { value: c.code }, c.name)));
    const pSel = h('select', { class: 'input' }, h('option', { value: '' }, '— pilih profesi —'), D.professions.map(p => h('option', { value: p.code }, p.name)));
    const rSel = h('select', { class: 'input' });
    const recSel = h('select', { class: 'input' }, D.users.filter(u => u.active && (u.roles.includes('admin') || u.roles.includes('superadmin'))).map(u => h('option', { value: u.id, selected: u.id === me() }, u.name)));
    const picSel = h('select', { class: 'input' }, D.users.filter(u => u.active && u.roles.includes('pic')).map(u => h('option', { value: u.id, selected: u.id === 'U07' }, `${u.name} (${u.picRole || 'PIC'})`)));
    const alert = h('div'); const err = h('div', { class: 'field-err', style: 'display:none' });
    const fillRoutes = () => { const ok = D.routes.filter(r => !cSel.value || r.countries.includes(cSel.value)); BGS.clear(rSel); rSel.append(...opts(ok.map(r => [r.id, r.name]))); };
    const dup = () => wSel.value && cSel.value && pSel.value ? D.applications.find(a => a.workerId === wSel.value && a.country === cSel.value && a.profession === pSel.value && isActive(a)) : null;
    const check = () => {
      BGS.clear(alert); err.style.display = 'none';
      const w = D.worker(wSel.value); if (w && w.recruiterId) recSel.value = recSel.querySelector(`option[value="${w.recruiterId}"]`) ? w.recruiterId : recSel.value;
      const d = dup();
      if (d) alert.appendChild(ui.callout('danger', 'Lamaran aktif sudah ada (RUL-008)', h('span', null, `${w.name} sudah punya lamaran aktif ${combo(d)} (`, ui.appLink(d.id), `, ${BGS.ST.application[d.status][0]}). Maksimal satu lamaran aktif per worker untuk negara + profesi yang sama. Tarik atau tolak lamaran lama terlebih dahulu.`)));
      else if (w) { const others = D.applications.filter(a => a.workerId === w.id && isActive(a)); if (others.length) alert.appendChild(ui.callout('info', null, `${w.name} punya ${others.length} lamaran aktif lain (${others.map(a => combo(a)).join('; ')}). Itu diperbolehkan selama negara/profesinya berbeda (BR-005).`)); }
    };
    [wSel, cSel, pSel].forEach(s => s.addEventListener('change', () => { if (s === cSel) fillRoutes(); check(); }));
    fillRoutes();
    const submit = () => {
      const miss = [];
      if (!wSel.value) miss.push('worker'); if (!cSel.value) miss.push('negara'); if (!pSel.value) miss.push('profesi'); if (!rSel.value) miss.push('jalur');
      if (miss.length) { err.textContent = 'Lengkapi: ' + miss.join(', ') + '.'; err.style.display = 'block'; return; }
      const d = dup(); if (d) { check(); err.textContent = `Ditolak sistem (RUL-008): worker ini sudah punya lamaran aktif ${combo(d)} (${d.id}).`; err.style.display = 'block'; return; }
      const year = BGS.today.getFullYear();
      const n = Math.max(0, ...D.applications.map(a => parseInt(a.id.slice(-5), 10) || 0)) + 1;
      const app = { id: `APP-${year}-${String(n).padStart(5, '0')}`, workerId: wSel.value, country: cSel.value, profession: pSel.value, route: rSel.value, status: 'SUBMITTED', createdAt: nowIso(), recruiterId: recSel.value, picId: picSel.value, caseId: null,
        screening: { documents: { status: 'PENDING', note: '' }, interview: { status: 'PENDING' }, assessment: { status: 'PENDING' } }, decision: null, history: [] };
      addHist(app, 'Lamaran dibuat (SUBMITTED)', 'blue');
      D.applications.push(app);
      BGS.deriveWorkerStatus();
      BGS.audit('Lamaran dibuat', 'Application', app.id, `${D.worker(app.workerId).name} · ${combo(app)} · ${routeName(app.route)}`);
      BGS.notify(app.picId, `Lamaran baru ${app.id} (${D.worker(app.workerId).name}) ditugaskan kepada Anda untuk screening.`, '#/applications/' + app.id);
      m.close(); ui.toast(`Lamaran ${app.id} dibuat`); BGS.go('/applications/' + app.id); done && done();
    };
    const m = ui.modal({
      title: 'Tambah lamaran', size: 'md',
      body: h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Satu worker boleh melamar ke beberapa negara/profesi, tetapi hanya satu lamaran aktif untuk kombinasi negara + profesi yang sama (RUL-008).'),
        h('div', { class: 'form-grid cols-2' }, h('div', { class: 'span-2' }, fld('Worker', wSel, 'Worker harus sudah terdaftar. Belum ada? Daftarkan lewat menu Worker.', true)), fld('Negara tujuan', cSel, null, true), fld('Profesi', pSel, null, true), fld('Jalur penempatan', rSel, 'Pilihan jalur menyesuaikan negara.', true), fld('Recruiter', recSel, null, true), h('div', { class: 'span-2' }, fld('PIC screening', picSel, 'PIC yang memeriksa dokumen & wawancara.'))),
        alert, err),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Buat lamaran', { kind: 'primary', icon: 'plus', onClick: submit })],
    });
  }

  BGS.router.add('/applications', {
    title: 'Lamaran & seleksi', roles: ALL, mvp: 1,
    render(ctx) {
      const items = BGS.scope.applications();
      const canAdd = BGS.isRole('superadmin', 'admin');
      const root = ctx.el;
      root.appendChild(ui.pageHeader({
        title: 'Lamaran & seleksi', subtitle: 'Pantau lamaran dari diajukan sampai keputusan seleksi. Satu worker bisa punya beberapa lamaran untuk tujuan berbeda.',
        actions: [
          h('div', { class: 'row gap-sm' }, ui.btn('Daftar', { icon: 'list', kind: appView === 'list' ? 'primary' : '', onClick: () => { appView = 'list'; ctx.refresh(); } }), ui.btn('Papan Kanban', { icon: 'layers', kind: appView === 'kanban' ? 'primary' : '', onClick: () => { appView = 'kanban'; ctx.refresh(); } })),
          ui.btn('Tambah lamaran', { kind: 'primary', icon: 'plus', disabled: !canAdd, title: canAdd ? '' : 'Hanya Superadmin dan Admin yang dapat membuat lamaran', onClick: () => addApplicationDialog() }),
        ],
      }));
      if (BGS.scope.isLimited()) root.appendChild(ui.callout('info', 'Cakupan data Anda', 'Sebagai PIC, Anda hanya melihat lamaran yang ditugaskan kepada Anda (RUL-020).'));
      if (BGS.isRole('viewer')) root.appendChild(ui.callout('info', null, 'Peran Viewer hanya dapat melihat. Tombol aksi dinonaktifkan.'));
      const kp = ['SUBMITTED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'SELECTED', 'WAITLISTED'].map(s => [s, items.filter(a => a.status === s || (s === 'SCREENING' && a.status === 'REVISION_REQUIRED')).length]);
      root.appendChild(h('div', { class: 'grid cols-4', style: 'margin-bottom:14px' }, [
        ui.kpi({ label: 'Lamaran aktif', value: items.filter(isActive).length, sub: `dari ${items.length} lamaran`, tone: 'blue', icon: 'clipboard' }),
        ui.kpi({ label: 'Perlu screening', value: kp[0][1] + kp[1][1], sub: 'diajukan + screening', tone: 'teal', icon: 'file-text' }),
        ui.kpi({ label: 'Menunggu alokasi', value: kp[4][1] + kp[5][1], sub: 'terpilih + cadangan', tone: 'green', icon: 'check-circle' }),
        ui.kpi({ label: 'Perlu revisi', value: items.filter(a => a.status === 'REVISION_REQUIRED').length, sub: 'menunggu perbaikan dokumen', tone: 'red', icon: 'alert' }),
      ]));
      if (appView === 'kanban') { root.appendChild(kanban(items)); return; }
      root.appendChild(ui.card({ flush: true, body: ui.listView({
        items, search: appSearch, searchPlaceholder: 'Cari nama worker, ID lamaran, negara…', sortKey: 'createdAt', sortDir: -1,
        onRowClick: a => ctx.go('/applications/' + a.id),
        filters: [
          { key: 'country', label: 'Negara', options: D.countries.map(c => [c.code, c.name]) }, { key: 'profession', label: 'Profesi', options: D.professions.map(p => [p.code, p.name]) },
          { key: 'status', label: 'Status', options: Object.entries(BGS.ST.application).map(([k, v]) => [k, v[0]]) }, { key: 'recruiterId', label: 'Recruiter', options: appRecruiters() },
        ],
        toolbar: BGS.can('export') ? ui.btn('Ekspor CSV', { icon: 'download', sm: true, onClick: () => BGS.exportCsv(items, [{ label: 'ID Lamaran', key: 'id' }, { label: 'Worker', value: a => (D.worker(a.workerId) || {}).name }, { label: 'Negara', value: a => D.cn(a.country) }, { label: 'Profesi', value: a => D.pn(a.profession) }, { label: 'Jalur', value: a => routeName(a.route) }, { label: 'Status', value: a => BGS.ST.application[a.status][0] }, { label: 'Recruiter', value: a => uname(a.recruiterId) }, { label: 'PIC', value: a => uname(a.picId) }], 'lamaran.csv') }) : null,
        columns: [
          { key: 'id', label: 'ID Lamaran', render: a => ui.appLink(a.id) },
          { key: 'workerId', label: 'Worker', render: a => h('div', null, ui.workerLink(a.workerId), h('div', { class: 'muted xs mono' }, a.workerId)) },
          { key: 'country', label: 'Negara · profesi', render: a => h('div', null, combo(a), h('div', { class: 'muted xs' }, routeName(a.route))) },
          { key: 'status', label: 'Status', sortable: true, render: a => ui.status('application', a.status) },
          { key: 'recruiterId', label: 'Recruiter', render: a => uname(a.recruiterId) },
          { key: 'picId', label: 'PIC', render: a => uname(a.picId) },
          { key: 'createdAt', label: 'Umur', sortable: true, sortValue: a => a.createdAt, render: a => h('span', { class: 'nowrap' }, `${ageDays(a)} hari`) },
        ],
      }) }));
    },
  });

  // ============================ /applications/:id ============================
  const STAGES = ['Diajukan', 'Screening dokumen', 'Wawancara', 'Penilaian', 'Keputusan'];
  const stageOf = a => ({ SUBMITTED: 0, SCREENING: 1, REVISION_REQUIRED: 1, INTERVIEW: 2, ASSESSMENT: a.screening.assessment.status === 'DONE' ? 4 : 3, SELECTED: 4, WAITLISTED: 4, REJECTED: 4, ALLOCATED: 5 })[a.status];
  const canScreen = a => BGS.can('application.screen') && (!BGS.isRole('pic') || a.picId === me());
  const screenWhy = a => !BGS.can('application.screen') ? `Peran ${BGS.roles[BGS.role()]} hanya dapat melihat.` : 'Anda bukan PIC yang ditugaskan pada lamaran ini.';
  const caseOf = a => D.cases.find(c => c.id === a.caseId || c.applicationId === a.id);

  function changeStatus(a, st, text, tone) {
    a.status = st; addHist(a, text, tone); BGS.deriveWorkerStatus();
  }
  const notifyRecruiter = (a, text) => { if (a.recruiterId && a.recruiterId !== me()) BGS.notify(a.recruiterId, text, '#/applications/' + a.id); };

  BGS.router.add('/applications/:id', {
    title: 'Detail lamaran', roles: ALL, mvp: 1,
    render(ctx) {
      const id = ctx.params.id;
      const root = ctx.el;
      const redraw = () => keepScroll(() => { BGS.clear(root); build(); });
      function build() {
        const a = D.application(id);
        if (!a) { root.appendChild(notFound('Lamaran tidak ditemukan', `ID ${id} tidak ada di sistem.`)); return; }
        if (!BGS.scope.applications().includes(a)) { root.appendChild(notFound('Lamaran di luar cakupan Anda', 'PIC hanya dapat membuka lamaran yang ditugaskan kepada PIC tersebut (RUL-020).')); return; }
        const w = D.worker(a.workerId) || { name: a.workerId };
        const kase = caseOf(a);
        const scr = canScreen(a), dec = BGS.can('application.decide');
        const sc = a.screening;

        // ---------- header ----------
        const allocBtn = () => {
          if (!['SELECTED', 'WAITLISTED'].includes(a.status)) return null;
          const ok = BGS.can('case.allocate');
          return ok ? h('a', { class: 'btn btn-primary', href: '#/allocation?app=' + a.id }, BGS.icon('git-branch', 16), 'Alokasikan ke Placement Code')
            : ui.btn('Alokasikan ke Placement Code', { kind: 'primary', icon: 'git-branch', disabled: true, title: 'Hanya Superadmin dan Admin yang dapat mengalokasikan' });
        };
        const canWithdraw = isActive(a) && a.status !== 'ALLOCATED';
        const withdrawBtn = ui.btn('Tarik lamaran', { icon: 'x-circle', disabled: !(BGS.isRole('superadmin', 'admin') && canWithdraw), title: !BGS.isRole('superadmin', 'admin') ? 'Hanya Superadmin dan Admin yang dapat menarik lamaran' : a.status === 'ALLOCATED' ? 'Sudah dialokasikan: batalkan Placement Case lebih dulu' : !canWithdraw ? 'Lamaran sudah selesai/ditutup' : '', onClick: async () => {
          const r = await ui.reasonPrompt({ title: 'Tarik lamaran', message: `Lamaran ${a.id} akan ditutup dengan status Mundur. Worker tetap tersimpan (RUL-022).`, label: 'Alasan penarikan', confirmLabel: 'Tarik lamaran', tone: 'danger', presets: ['Worker mengundurkan diri', 'Tidak dapat dihubungi', 'Pindah ke tujuan lain'] });
          if (!r) return;
          a.decision = { result: 'WITHDRAWN', reason: r, by: me(), at: nowIso() };
          changeStatus(a, 'WITHDRAWN', `Lamaran ditarik. Alasan: ${r}`, 'gray');
          BGS.audit('Lamaran ditarik', 'Application', a.id, 'Alasan: ' + r); notifyRecruiter(a, `Lamaran ${a.id} (${w.name}) ditarik: ${r}`);
          ui.toast('Lamaran ditarik', 'warn'); redraw();
        } });
        root.appendChild(ui.pageHeader({
          breadcrumbs: [{ label: 'Lamaran & seleksi', href: '/applications' }, { label: a.id }],
          title: a.id, subtitle: `${w.name} · ${combo(a)}`, actions: [ui.status('application', a.status), allocBtn(), withdrawBtn],
        }));
        if (!isActive(a)) root.appendChild(ui.callout(a.status === 'REJECTED' ? 'danger' : 'warn', `Lamaran ${BGS.ST.application[a.status][0].toLowerCase()}`, a.decision ? `Alasan: ${a.decision.reason} · oleh ${uname(a.decision.by)}, ${BGS.fmt.dateTime(a.decision.at)}` : 'Lamaran ini sudah ditutup.'));
        if (a.status === 'REVISION_REQUIRED') root.appendChild(ui.callout('warn', 'Perlu revisi dokumen', sc.documents.note || 'Dokumen perlu diperbaiki. Unggah ulang lalu verifikasi.'));
        if (BGS.isRole('viewer')) root.appendChild(ui.callout('info', null, 'Peran Viewer hanya dapat melihat; semua tombol aksi dinonaktifkan.'));
        else if (BGS.isRole('pic') && !scr && isActive(a)) root.appendChild(ui.callout('info', null, `Anda hanya dapat melihat lamaran ini. ${screenWhy(a)}`));
        if (isActive(a) || a.status === 'REJECTED' && stageOf(a) != null) root.appendChild(h('div', { style: 'overflow-x:auto' }, ui.stepper(STAGES, stageOf(a))));

        // ---------- panels ----------
        const docsPanel = () => {
          const types = WORKER_TYPES.map(D.docType).filter(t => t.required || currentDoc('worker', a.workerId, t.id));
          const rows = types.map(t => ({ t, d: currentDoc('worker', a.workerId, t.id) }));
          const req = rows.filter(r => r.t.required);
          const okCount = req.filter(r => r.d && r.d.status === 'VERIFIED').length;
          const missing = req.filter(r => !(r.d && r.d.status === 'VERIFIED'));
          const editable = isActive(a) && a.status !== 'ALLOCATED' && scr;
          const body = h('div', null,
            h('div', { class: 'row between wrap', style: 'margin-bottom:6px' }, h('div', null, h('b', null, `${okCount} dari ${req.length} dokumen wajib terverifikasi`), h('div', { class: 'muted sm' }, 'Syarat screening: semua dokumen wajib berstatus Terverifikasi.')), ui.badge(sc.documents.status === 'PASSED' ? 'Lolos' : sc.documents.status === 'REVISION' ? 'Perlu revisi' : 'Belum selesai', sc.documents.status === 'PASSED' ? 'green' : sc.documents.status === 'REVISION' ? 'amber' : 'gray', { dot: true })),
            ui.progress(req.length ? (okCount / req.length) * 100 : 0, okCount === req.length ? 'green' : 'blue'),
            h('div', { style: 'margin-top:6px' }, rows.map(({ t, d }) => {
              const cls = !d ? 'none' : d.status === 'VERIFIED' ? 'ok' : ['REJECTED', 'EXPIRED'].includes(d.status) ? 'bad' : 'wait';
              const icn = cls === 'ok' ? 'check-circle' : cls === 'bad' ? 'x-circle' : cls === 'wait' ? 'clock' : 'file';
              const mine = d && d.status === 'UPLOADED' && D.settings.uploaderCannotVerify && d.uploadedBy === me();
              return h('div', { class: 'rc-chk' }, h('span', { class: `rc-ic ${cls}` }, BGS.icon(icn, 20)),
                h('div', null, h('div', { class: 'row wrap gap-sm' }, h('b', null, t.name), t.required ? ui.badge('Wajib', 'blue') : ui.badge('Opsional', 'gray')),
                  d ? h('div', { class: 'sm muted' }, [h('span', { class: 'mono' }, d.filename), ` · v${d.version} · ${uname(d.uploadedBy)}, ${BGS.fmt.rel(d.uploadedAt)}`], mine ? h('span', { style: 'color:#B45309' }, ' · diunggah oleh Anda') : null) : h('div', { class: 'sm muted' }, 'Belum diunggah'),
                  d && d.status === 'REJECTED' ? h('div', { class: 'sm', style: 'color:#B91C1C' }, 'Ditolak: ' + d.rejectReason) : null),
                h('div', { class: 'rc-acts' }, d ? ui.status('document', d.status) : null,
                  d ? ui.btn('Lihat', { sm: true, icon: 'eye', onClick: () => openDoc(d, redraw) }) : null,
                  d && d.status === 'UPLOADED' && editable && BGS.can('document.verify') ? [ui.btn('Verifikasi', { sm: true, kind: 'good', icon: 'check', onClick: () => verifyDoc(d, redraw) }), ui.btn('Tolak', { sm: true, kind: 'danger', icon: 'x', onClick: () => rejectDoc(d, redraw) })] : null,
                  editable && BGS.can('document.upload') && (!d || ['REJECTED', 'EXPIRED'].includes(d.status)) ? ui.btn(d ? 'Unggah ulang' : 'Unggah', { sm: true, icon: 'upload', onClick: () => uploadDialog({ ownerType: 'worker', ownerId: a.workerId, typeId: t.id, onDone: redraw }) }) : null));
            })));
          const foot = [];
          if (a.status === 'SUBMITTED') foot.push(ui.btn('Mulai screening', { kind: 'primary', icon: 'play', disabled: !scr, title: scr ? '' : screenWhy(a), onClick: () => { changeStatus(a, 'SCREENING', 'Screening dokumen dimulai', 'purple'); BGS.audit('Screening dimulai', 'Application', a.id, ''); ui.toast('Screening dimulai'); redraw(); } }));
          if (['SCREENING', 'REVISION_REQUIRED'].includes(a.status)) {
            foot.push(ui.btn('Dokumen lengkap → lanjut ke wawancara', { kind: 'good', icon: 'check', disabled: !scr || missing.length > 0, title: !scr ? screenWhy(a) : missing.length ? `Belum terverifikasi: ${missing.map(m => m.t.name).join(', ')}` : '', onClick: () => {
              sc.documents = { status: 'PASSED', note: '', by: me(), at: nowIso() };
              changeStatus(a, 'INTERVIEW', 'Screening dokumen lolos. Lanjut ke wawancara', 'purple');
              BGS.audit('Screening dokumen lolos', 'Application', a.id, `${okCount}/${req.length} dokumen wajib terverifikasi`); ui.toast('Dokumen lengkap. Lanjut ke wawancara.'); redraw();
            } }));
            if (a.status === 'SCREENING') foot.push(ui.btn('Minta revisi', { kind: 'warn', icon: 'alert', disabled: !scr, title: scr ? '' : screenWhy(a), onClick: async () => {
              const r = await ui.reasonPrompt({ title: 'Minta revisi dokumen', message: 'Catatan ini akan dikirim ke recruiter agar worker memperbaiki dokumennya.', label: 'Catatan revisi', confirmLabel: 'Kirim permintaan revisi', tone: 'primary', presets: missing.map(m => `${m.t.name} belum lengkap / perlu diunggah ulang`) });
              if (!r) return;
              sc.documents = { status: 'REVISION', note: r, by: me(), at: nowIso() };
              changeStatus(a, 'REVISION_REQUIRED', `Revisi dokumen diminta: ${r}`, 'amber');
              BGS.audit('Revisi dokumen diminta', 'Application', a.id, r); notifyRecruiter(a, `Lamaran ${a.id} (${w.name}) perlu revisi dokumen: ${r}`); ui.toast('Permintaan revisi dikirim', 'warn'); redraw();
            } }));
            if (missing.length && scr) foot.push(h('span', { class: 'muted sm' }, `Masih ${missing.length} dokumen wajib belum terverifikasi.`));
          }
          return ui.card({ title: 'Screening dokumen', icon: 'file-text', subtitle: 'BR-006 · pembuat ≠ pemeriksa (RUL-016)', body: h('div', { class: 'stack' }, body, foot.length ? h('div', { class: 'row wrap gap-sm' }, foot) : null) });
        };

        const interviewPanel = () => {
          const iv = sc.interview || { status: 'PENDING' };
          let body;
          if (iv.status === 'DONE') body = h('div', { class: 'stack-sm' }, h('div', { class: 'rc-score' }, h('b', null, iv.score), h('span', { class: 'muted' }, '/ 100 · nilai wawancara')), ui.kv([['Waktu', BGS.fmt.dateTime(iv.at)], ['Pewawancara', uname(iv.by)], ['Catatan', iv.note]]));
          else if (['SUBMITTED', 'SCREENING', 'REVISION_REQUIRED'].includes(a.status)) body = h('div', { class: 'rc-lock' }, BGS.icon('lock', 18), 'Terbuka setelah screening dokumen lolos.');
          else if (!isActive(a)) body = h('div', { class: 'rc-lock' }, BGS.icon('info', 18), 'Wawancara tidak dilakukan.');
          else {
            const when = h('input', { class: 'input', type: 'datetime-local', value: iv.status === 'SCHEDULED' ? ymd(new Date(iv.at)) + 'T' + pad2(new Date(iv.at).getHours()) + ':' + pad2(new Date(iv.at).getMinutes()) : tomorrowLocal() });
            const by = h('select', { class: 'input' }, D.users.filter(u => u.active && u.roles.some(r => ['admin', 'superadmin', 'pic'].includes(r))).map(u => h('option', { value: u.id, selected: u.id === (iv.by || me()) }, u.name)));
            const score = h('input', { class: 'input', type: 'number', min: 0, max: 100, placeholder: '0–100' }); const note = h('textarea', { class: 'input', rows: 2, placeholder: 'Catatan hasil wawancara…' }); const err = h('div', { class: 'field-err', style: 'display:none' });
            const off = !scr;
            body = h('div', { class: 'stack' },
              iv.status === 'SCHEDULED' ? ui.callout('info', 'Wawancara terjadwal', `${BGS.fmt.dateTime(iv.at)} · ${BGS.fmt.rel(iv.at)} · pewawancara ${uname(iv.by)}`) : null,
              h('div', { class: 'form-grid cols-2' }, fld(iv.status === 'SCHEDULED' ? 'Jadwal ulang' : 'Tanggal & jam wawancara', when), fld('Pewawancara', by)),
              ui.btn(iv.status === 'SCHEDULED' ? 'Simpan jadwal baru' : 'Jadwalkan wawancara', { icon: 'calendar', disabled: off, title: off ? screenWhy(a) : '', onClick: () => {
                const t = new Date(when.value); if (!when.value || isNaN(t)) return ui.toast('Isi tanggal dan jam wawancara', 'warn'); if (t < BGS.today) return ui.toast('Jadwal tidak boleh di masa lalu', 'warn');
                sc.interview = { status: 'SCHEDULED', at: t.toISOString(), by: by.value }; addHist(a, `Wawancara dijadwalkan ${BGS.fmt.dateTime(t)} (${uname(by.value)})`, 'purple');
                BGS.audit('Wawancara dijadwalkan', 'Application', a.id, BGS.fmt.dateTime(t)); ui.toast('Jadwal wawancara disimpan'); redraw();
              } }),
              iv.status === 'SCHEDULED' ? h('div', { class: 'stack', style: 'border-top:1px solid var(--line);padding-top:12px' }, h('b', null, 'Catat hasil wawancara'),
                h('div', { class: 'form-grid cols-2' }, fld('Skor (0–100)', score, null, true), fld('Catatan', note, 'Ringkas: komunikasi, motivasi, kesiapan.', true)), err,
                ui.btn('Simpan hasil → lanjut ke penilaian', { kind: 'good', icon: 'check', disabled: off, title: off ? screenWhy(a) : '', onClick: () => {
                  const s = Number(score.value);
                  if (score.value === '' || isNaN(s) || s < 0 || s > 100 || !note.value.trim()) { err.textContent = 'Skor 0–100 dan catatan wajib diisi.'; err.style.display = 'block'; return; }
                  sc.interview = { status: 'DONE', at: iv.at, by: me(), score: s, note: note.value.trim() };
                  changeStatus(a, 'ASSESSMENT', `Hasil wawancara dicatat (skor ${s}). Lanjut ke penilaian kemampuan`, 'purple');
                  BGS.audit('Hasil wawancara dicatat', 'Application', a.id, `Skor ${s}`); ui.toast('Hasil wawancara disimpan'); redraw();
                } })) : null);
          }
          return ui.card({ title: 'Wawancara', icon: 'users', subtitle: iv.status === 'DONE' ? 'Selesai' : iv.status === 'SCHEDULED' ? 'Terjadwal' : 'Belum dijadwalkan', body });
        };

        const assessmentPanel = () => {
          const as = sc.assessment || { status: 'PENDING' }; let body;
          const thr = as.threshold || threshold();
          const note = h('div', { class: 'hint' }, `Ambang lulus saat ini ${thr} dan dapat dikonfigurasi. Kriteria per profesi masih menunggu keputusan (OQ-09).`);
          if (as.status === 'DONE') {
            const pass = as.score >= thr;
            body = h('div', { class: 'stack-sm' }, h('div', { class: 'rc-score' }, h('b', { style: pass ? 'color:#15803D' : 'color:#B91C1C' }, as.score), h('span', { class: 'muted' }, `/ 100 · ambang ${thr}`), ui.badge(pass ? 'Lulus' : 'Di bawah ambang', pass ? 'green' : 'red', { dot: true })), ui.progress(as.score, pass ? 'green' : 'red'), ui.kv([['Dinilai oleh', as.by ? uname(as.by) : '—'], as.at ? ['Waktu', BGS.fmt.dateTime(as.at)] : null, ['Catatan', as.note]]), note);
          } else if (a.status !== 'ASSESSMENT') body = h('div', null, h('div', { class: 'rc-lock' }, BGS.icon(isActive(a) ? 'lock' : 'info', 18), isActive(a) ? 'Terbuka setelah wawancara selesai.' : 'Penilaian tidak dilakukan.'), note);
          else {
            const score = h('input', { class: 'input', type: 'number', min: 0, max: 100, placeholder: '0–100' }); const n = h('textarea', { class: 'input', rows: 2, placeholder: 'Catatan praktik / tes kemampuan…' }); const err = h('div', { class: 'field-err', style: 'display:none' });
            body = h('div', { class: 'stack' }, h('div', { class: 'form-grid cols-2' }, fld('Skor kemampuan (0–100)', score, `Ambang lulus ${thr}`, true), fld('Catatan', n, null, true)), err, note,
              ui.btn('Simpan penilaian → siap diputuskan', { kind: 'good', icon: 'check', disabled: !scr, title: scr ? '' : screenWhy(a), onClick: () => {
                const s = Number(score.value); if (score.value === '' || isNaN(s) || s < 0 || s > 100 || !n.value.trim()) { err.textContent = 'Skor 0–100 dan catatan wajib diisi.'; err.style.display = 'block'; return; }
                sc.assessment = { status: 'DONE', score: s, threshold: thr, note: n.value.trim(), by: me(), at: nowIso() };
                addHist(a, `Penilaian kemampuan dicatat: skor ${s} (ambang ${thr}) ${s >= thr ? '— lulus' : '— di bawah ambang'}`, s >= thr ? 'green' : 'red');
                BGS.audit('Penilaian kemampuan dicatat', 'Application', a.id, `Skor ${s}/${thr}`); ui.toast('Penilaian disimpan. Lamaran siap diputuskan.'); redraw();
              } }));
          }
          return ui.card({ title: 'Penilaian kemampuan', icon: 'award', subtitle: as.status === 'DONE' ? 'Selesai' : 'Skill assessment', body });
        };

        const decide = async (result) => {
          const lab = { SELECTED: 'Terpilih', WAITLISTED: 'Cadangan', REJECTED: 'Ditolak' }[result];
          const as = sc.assessment;
          const below = result === 'SELECTED' && as.status === 'DONE' && as.score < (as.threshold || threshold());
          const r = await ui.reasonPrompt({
            title: `Keputusan: ${lab}`, tone: result === 'REJECTED' ? 'danger' : 'primary', confirmLabel: `Simpan keputusan ${lab}`, label: 'Alasan keputusan',
            message: (below ? `Perhatian: skor ${as.score} di bawah ambang ${as.threshold || threshold()}. Jelaskan alasan pengecualian. ` : '') + 'Alasan, pelaku, dan waktu keputusan dicatat permanen (BR-007, RUL-022).',
            presets: result === 'SELECTED' ? ['Memenuhi semua kriteria seleksi', 'Skor wawancara & penilaian baik'] : result === 'WAITLISTED' ? ['Lolos, menunggu kuota Placement Code', 'Menunggu Job Order yang sesuai'] : ['Nilai assessment di bawah ambang', 'Dokumen tidak lengkap setelah revisi', 'Tidak lolos pemeriksaan kesehatan awal', 'Tidak memenuhi syarat usia/pendidikan'],
          });
          if (!r) return;
          a.decision = { result, reason: r, by: me(), at: nowIso() };
          changeStatus(a, result, `Keputusan seleksi: ${lab}. Alasan: ${r}`, result === 'SELECTED' ? 'green' : result === 'REJECTED' ? 'red' : 'amber');
          BGS.audit(`Keputusan seleksi: ${lab}`, 'Application', a.id, 'Alasan: ' + r); notifyRecruiter(a, `Lamaran ${a.id} (${w.name}) diputuskan: ${lab}.`);
          ui.toast(`Keputusan "${lab}" disimpan`, result === 'REJECTED' ? 'warn' : 'good'); redraw();
        };
        const decisionPanel = () => {
          const d = a.decision; const shown = d && ['SELECTED', 'WAITLISTED', 'REJECTED', 'ALLOCATED'].includes(a.status);
          const ready = a.status === 'ASSESSMENT' && sc.assessment.status === 'DONE';
          const canSel = dec && (ready || a.status === 'WAITLISTED'), canWait = dec && (ready || a.status === 'SELECTED');
          const canRej = dec && isActive(a) && a.status !== 'ALLOCATED';
          const why = !dec ? 'Hanya Superadmin dan Admin yang memutuskan seleksi (BR-007).' : '';
          const wait = !ready ? 'Tersedia setelah penilaian kemampuan selesai.' : '';
          const btns = h('div', { class: 'row wrap gap-sm' },
            ui.btn('Terpilih', { kind: 'good', icon: 'check-circle', disabled: !canSel, title: why || (canSel ? '' : wait || 'Status lamaran tidak memungkinkan'), onClick: () => decide('SELECTED') }),
            ui.btn('Cadangan', { kind: 'warn', icon: 'clock', disabled: !canWait, title: why || (canWait ? '' : wait || 'Status lamaran tidak memungkinkan'), onClick: () => decide('WAITLISTED') }),
            ui.btn('Ditolak', { kind: 'danger', icon: 'x-circle', disabled: !canRej, title: why || (canRej ? '' : 'Lamaran sudah ditutup/dialokasikan'), onClick: () => decide('REJECTED') }));
          const body = h('div', { class: 'stack' },
            shown ? h('div', { class: 'stack-sm' }, h('div', null, ui.status('application', a.status)), ui.kv([['Alasan', d.reason], ['Diputuskan oleh', uname(d.by)], ['Waktu', BGS.fmt.dateTime(d.at)]])) : h('div', { class: 'muted sm' }, 'Belum ada keputusan.'),
            isActive(a) && a.status !== 'ALLOCATED' ? btns : null,
            isActive(a) && a.status !== 'ALLOCATED' ? h('div', { class: 'hint' }, why || 'Alasan wajib diisi untuk setiap keputusan (RUL-022). Tolak dapat dilakukan kapan saja selama lamaran aktif.') : null,
            ['SELECTED', 'WAITLISTED'].includes(a.status) ? h('div', { class: 'stack-sm' }, allocBtn(), h('div', { class: 'hint' }, 'Alokasi mengunci 1 kuota Placement Code (RUL-006). Modul alokasi tersedia mulai MVP 2.')) : null,
            a.status === 'ALLOCATED' ? h('div', { class: 'stack-sm' }, ui.callout('good', 'Sudah dialokasikan', kase ? h('span', null, 'Placement Case ', ui.caseLink(kase.id), ' · kode ', ui.codeLink(kase.placementCodeId || (kase.codeId) || '—')) : 'Placement Case sudah dibuat.'), kase ? h('a', { class: 'btn', href: '#/cases/' + kase.id }, BGS.icon('briefcase', 16), 'Buka Placement Case') : null) : null);
          return ui.card({ title: 'Keputusan seleksi', icon: 'award', body });
        };

        const summary = ui.card({ title: 'Ringkasan', icon: 'clipboard', body: ui.kv([
          ['Worker', h('span', null, ui.workerLink(a.workerId), ' ', h('span', { class: 'muted xs mono' }, a.workerId))], ['Negara', D.cn(a.country)], ['Profesi', D.pn(a.profession)], ['Jalur', routeName(a.route)],
          ['Recruiter', ui.userChip(a.recruiterId)], ['PIC screening', ui.userChip(a.picId)], ['Dibuat', `${BGS.fmt.date(a.createdAt)} (${ageDays(a)} hari)`], ['Status', ui.status('application', a.status)], kase ? ['Placement Case', ui.caseLink(kase.id)] : null,
        ]) });
        const hist = ui.card({ title: 'Riwayat', icon: 'clock', body: ui.timeline(a.history.slice().sort((x, y) => y.at.localeCompare(x.at)).map(e => ({ text: e.text, at: e.at, by: e.by, tone: e.tone || 'gray' }))) });

        root.appendChild(h('div', { class: 'grid cols-21' },
          h('div', { class: 'stack' }, docsPanel(), interviewPanel(), assessmentPanel()),
          h('div', { class: 'stack' }, summary, decisionPanel(), hist)));
      }
      build();
    },
  });

  // ============================ /documents ============================
  let docTab = 'queue';
  BGS.router.add('/documents', {
    title: 'Dokumen', roles: ALL, mvp: 1,
    render(ctx) {
      const root = ctx.el; const owner = ctx.query.owner || '';
      if (ctx.query.tab) docTab = ctx.query.tab;
      const redraw = () => keepScroll(() => { BGS.clear(root); build(); });
      const docCols = (extra) => [
        { key: 'filename', label: 'Dokumen', render: d => h('div', null, h('b', null, typeName(d)), h('div', { class: 'muted xs mono' }, `${d.filename} · v${d.version}`)) },
        { key: 'ownerId', label: 'Pemilik', render: ownerCell },
        { key: 'status', label: 'Status', render: d => h('div', null, ui.status('document', d.status), d.rejectReason ? h('div', { class: 'muted xs', style: 'max-width:180px' }, d.rejectReason) : null) },
        { key: 'uploadedAt', label: 'Diunggah', sortable: true, sortValue: d => d.uploadedAt, render: d => h('div', null, uname(d.uploadedBy), h('div', { class: 'muted xs' }, BGS.fmt.rel(d.uploadedAt))) },
        ...(extra || []),
      ];
      const actions = d => h('div', { class: 'row gap-sm' },
        ui.btn('Lihat', { sm: true, icon: 'eye', onClick: () => openDoc(d, redraw) }),
        d.status === 'UPLOADED' && BGS.can('document.verify') ? [ui.btn('Verifikasi', { sm: true, kind: 'good', icon: 'check', onClick: () => verifyDoc(d, redraw) }), ui.btn('Tolak', { sm: true, kind: 'danger', icon: 'x', onClick: () => rejectDoc(d, redraw) })] : null,
        versionsOf(d).length > 1 ? ui.btn(`Versi (${versionsOf(d).length})`, { sm: true, onClick: () => showVersions(d) }) : null);
      const ownerFilter = d => { if (!owner) return true; return d.ownerId === owner || ownerWorkerId(d) === owner; };
      const base = () => visibleDocs().filter(ownerFilter);

      function build() {
        const canUp = BGS.can('document.upload');
        root.appendChild(ui.pageHeader({
          title: 'Pusat dokumen', subtitle: 'Semua dokumen worker dan case: verifikasi, versi, dan masa berlaku di satu tempat.',
          actions: [ui.btn('Unggah dokumen', { kind: 'primary', icon: 'upload', disabled: !canUp, title: canUp ? '' : `Peran ${BGS.roles[BGS.role()]} tidak dapat mengunggah dokumen`, onClick: () => uploadDialog({ ownerId: owner || undefined, ownerType: owner && owner.startsWith('PC-') ? 'case' : 'worker', onDone: redraw }) })],
        }));
        if (owner) {
          const w = D.worker(owner); const c = D.case(owner);
          root.appendChild(h('div', { class: 'callout c-info' }, BGS.icon('filter', 18), h('div', { class: 'rc-banner' }, h('span', null, 'Menampilkan dokumen milik ', h('b', null, w ? w.name : c ? `${c.id} (${ownerName({ ownerType: 'case', ownerId: c.id })})` : owner), w || c ? ' dan dokumen case terkait.' : '.'), ui.btn('Hapus filter', { sm: true, onClick: () => ctx.go('/documents') }))));
        }
        if (BGS.scope.isLimited()) root.appendChild(ui.callout('info', 'Cakupan data Anda', 'PIC hanya melihat dokumen milik worker dan case yang ditugaskan (RUL-020).'));
        if (BGS.isRole('viewer')) root.appendChild(ui.callout('info', null, 'Peran Viewer hanya dapat melihat dokumen.'));

        const all = base();
        const queue = all.filter(d => d.status === 'UPLOADED').sort((x, y) => x.uploadedAt.localeCompare(y.uploadedAt));
        const warnDays = D.settings.expiryWarningDays;
        const expiring = all.filter(d => d.expiresAt && !['SUPERSEDED', 'REJECTED'].includes(d.status) && daysLeft(d) <= warnDays).sort((x, y) => daysLeft(x) - daysLeft(y));
        const mine = queue.filter(d => d.uploadedBy === me()).length;

        const tabs = [
          { id: 'queue', label: 'Antrean verifikasi', count: queue.length, render: () => h('div', { class: 'stack' },
            ui.callout('info', null, `Dokumen berstatus "Menunggu verifikasi", terlama di atas. ${D.settings.uploaderCannotVerify ? `Anda tidak dapat memverifikasi dokumen yang Anda unggah sendiri (RUL-016)${mine ? ` — ${mine} dokumen di antrean ini diunggah oleh Anda.` : '.'}` : ''}`),
            ui.card({ flush: true, body: ui.table({ rows: queue, pageSize: 10, columns: [...docCols([{ key: 'age', label: 'Menunggu', render: d => `${Math.max(0, -BGS.fmt.daysFrom(d.uploadedAt))} hari` }]), { key: 'act', label: 'Aksi', render: actions }], onRowClick: d => openDoc(d, redraw), empty: ui.emptyState({ icon: 'check-circle', title: 'Antrean kosong', text: 'Tidak ada dokumen yang menunggu verifikasi. Kerja bagus!' }) }) })) },
          { id: 'all', label: 'Semua dokumen', count: all.length, render: () => ui.card({ flush: true, body: ui.listView({
            items: base, search: d => `${typeName(d)} ${d.filename} ${ownerName(d)} ${d.ownerId} ${d.id}`, searchPlaceholder: 'Cari jenis, berkas, nama pemilik…', sortKey: 'uploadedAt', sortDir: -1,
            onRowClick: d => openDoc(d, redraw),
            filters: [
              { key: 'typeId', label: 'Jenis', options: D.docTypes.map(t => [t.id, t.name]) },
              { key: 'status', label: 'Status', options: Object.entries(BGS.ST.document).map(([k, v]) => [k, v[0]]) },
              { key: 'ownerType', label: 'Pemilik', options: [['worker', 'Worker'], ['case', 'Placement Case']] },
            ],
            columns: [...docCols([{ key: 'expiresAt', label: 'Berlaku s/d', render: d => d.expiresAt ? h('div', null, BGS.fmt.date(d.expiresAt), h('div', null, expiryBadge(d))) : h('span', { class: 'muted' }, '—') }]), { key: 'act', label: 'Aksi', render: actions }],
          }) }) },
          { id: 'expiry', label: 'Akan kedaluwarsa', count: expiring.length, render: () => h('div', { class: 'stack' },
            ui.callout('warn', null, `Dokumen yang sudah kedaluwarsa atau berakhir dalam ${warnDays} hari (batas peringatan di Pengaturan sistem). Unggah versi baru sebelum masa berlaku habis; versi lama otomatis menjadi Digantikan (RUL-023).`),
            ui.card({ flush: true, body: ui.table({ rows: expiring, pageSize: 10, columns: [
              { key: 'filename', label: 'Dokumen', render: d => h('div', null, h('b', null, typeName(d)), h('div', { class: 'muted xs mono' }, `${d.filename} · v${d.version}`)) },
              { key: 'ownerId', label: 'Pemilik', render: ownerCell }, { key: 'status', label: 'Status', render: d => ui.status('document', d.status) },
              { key: 'expiresAt', label: 'Berlaku s/d', render: d => BGS.fmt.date(d.expiresAt) }, { key: 'left', label: 'Sisa waktu', render: expiryBadge },
              { key: 'act', label: 'Aksi', render: d => h('div', { class: 'row gap-sm' }, ui.btn('Lihat', { sm: true, icon: 'eye', onClick: () => openDoc(d, redraw) }), ui.btn('Unggah versi baru', { sm: true, icon: 'upload', disabled: !canUp, title: canUp ? '' : 'Peran Anda tidak dapat mengunggah', onClick: () => uploadDialog({ ownerType: d.ownerType, ownerId: d.ownerId, typeId: d.typeId, onDone: redraw }) })) },
            ], empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada dokumen yang akan kedaluwarsa', text: `Semua dokumen masih berlaku lebih dari ${warnDays} hari.` }) }) })) },
          { id: 'types', label: 'Jenis dokumen', count: D.docTypes.length, render: () => h('div', { class: 'stack' },
            ui.callout('info', null, h('span', null, 'Katalog ini hanya untuk dibaca. Menambah atau mengubah jenis dokumen dilakukan oleh Superadmin di ', h('a', { class: 'lnk', href: '#/master' }, 'Data master'), '.')),
            ui.card({ flush: true, body: ui.table({ rows: D.docTypes, pageSize: 20, columns: [
              { key: 'name', label: 'Jenis dokumen', render: t => h('b', null, t.name) },
              { key: 'lvl', label: 'Dimiliki oleh', render: t => CASE_TYPES.includes(t.id) ? 'Placement Case' : 'Worker' },
              { key: 'required', label: 'Wajib?', render: t => t.required ? ui.badge('Wajib', 'blue') : ui.badge('Opsional', 'gray') },
              { key: 'validMonths', label: 'Masa berlaku', render: t => t.validMonths ? `${t.validMonths} bulan` : 'Tanpa batas' },
              { key: 'n', label: 'Dokumen aktif', render: t => D.documents.filter(d => d.typeId === t.id && d.status !== 'SUPERSEDED').length },
            ] }) })) },
        ];
        root.appendChild(ui.tabs(tabs, { active: tabs.some(t => t.id === docTab) ? docTab : 'queue', onChange: id => { docTab = id; } }));
      }
      build();
    },
  });
})();
