/* M08 Placement & Quota: Data master, Partner, Job Order, Placement Code & kuota, Batch. */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui, fmt = BGS.fmt;
  const R = BGS.ROLES, ALL = R.ALL, MG = R.MGMT;

  BGS.addStyle(`
    .pl-qcell{display:flex;flex-direction:column;gap:4px;min-width:130px}
    .pl-full td{background:#FFFBEB}
    .pl-nums{display:grid;grid-template-columns:repeat(4,auto);gap:2px 12px;font-size:12.5px}
    .pl-nums b{font-variant-numeric:tabular-nums}
    .pl-mat{border-collapse:collapse;font-size:13px;width:100%}
    .pl-mat th,.pl-mat td{border:1px solid var(--line);padding:6px 8px;text-align:center}
    .pl-mat td:first-child,.pl-mat th:first-child{text-align:left}
    .pl-req{color:#15803D;font-weight:800} .pl-opt{color:#B45309;font-weight:700} .pl-na{color:#94A3B8}
    .pl-formula{font-family:ui-monospace,Menlo,monospace;font-weight:700}
    .pl-hint{margin-top:2px}
  `);

  // ---------- shared helpers ----------
  const canMaster = () => BGS.can('master.write');
  const canPartner = () => BGS.can('partner.write');
  const canOps = () => BGS.isRole('superadmin', 'admin');
  const pad = (n, l) => String(n).padStart(l, '0');
  const isoDate = d => new Date(d).toISOString().slice(0, 10);
  const roAlert = (what, who) => ui.callout('info', 'Hanya lihat', `${what} hanya dapat diubah oleh ${who}. Peran Anda (${BGS.roles[BGS.role()]}) dapat melihat data ini saja.`);
  const countryOpts = () => D.countries.filter(c => c.active !== false).map(c => [c.code, c.name]);
  const profOpts = () => D.professions.filter(p => p.active !== false).map(p => [p.code, `${p.name} (${p.code})`]);
  const routeName = id => (D.routes.find(r => r.id === id) || {}).name || id || '—';
  const routesFor = c => D.routes.filter(r => r.active !== false && (!c || r.countries.includes(c)));
  const syncQuota = () => {
    BGS.computeQuota();
    D.placementCodes.forEach(pc => { if (pc.status === 'CLOSED') return; pc.status = pc.available <= 0 ? 'FULL' : 'OPEN'; });
  };
  const isLow = pc => pc.status !== 'CLOSED' && pc.available > 0 && pc.available <= Math.max(2, Math.ceil(pc.total * 0.15));
  const codeStatus = pc => h('span', { class: 'row gap-sm' }, ui.status('code', pc.status), isLow(pc) && ui.badge('Menipis', 'amber'));
  const quotaCell = pc => h('div', { class: 'pl-qcell' }, ui.quotaBar(pc), h('span', { class: 'muted sm' }, `${pc.utilized} terpakai · ${pc.reserved} cadangan · ${pc.available} tersedia`));
  const jobCodes = jo => D.placementCodes.filter(c => c.jobOrderId === jo.id);
  const sumTotals = jo => jobCodes(jo).reduce((a, c) => a + c.total, 0);
  const batchOf = id => D.batches.find(b => b.id === id);
  const caseActive = c => c.status !== 'CANCELLED';
  const nextId = (prefix, list, width) => { let n = list.length + 1; const has = id => list.some(x => x.id === id); while (has(prefix + pad(n, width))) n++; return prefix + pad(n, width); };

  // modal + form wrapper with custom errors
  const getNode = (f, name) => f.nodes.find(n => n.input.name === name);
  const setErr = (f, name, msg) => { const n = getNode(f, name); if (!n) return; const e = BGS.$('.field-err', n); e.textContent = msg; e.style.display = 'block'; n.input.classList.add('invalid'); };
  const formModal = ({ title, fields, cols = 2, submitLabel = 'Simpan', size = 'md', extra, intro, onSubmit, wire }) => {
    let m, f;
    f = ui.form({ fields, cols, submitLabel, extra, cancel: ui.btn('Batal', { onClick: () => m.close() }), onSubmit: v => { if (onSubmit(v, f) !== false) m.close(); } });
    m = ui.modal({ title, size, body: h('div', { class: 'stack' }, intro, f.el) });
    if (wire) wire(f);
    return { f, m };
  };
  const head = (o) => ui.pageHeader(o);

  // ======================================================================
  // /master  — Data master (MVP 1)
  // ======================================================================
  // Syarat dokumen per negara/profesi: D.docRequirements['{negara|*}|{profesi|*}'] = { DTxx: 'REQ'|'OPT'|'NA' }
  D.docRequirements = D.docRequirements || {};
  const LEVEL = { REQ: ['Wajib', 'green'], OPT: ['Opsional', 'amber'], NA: ['Tidak perlu', 'gray'] };
  const resolveReq = (c, p, dt) => {
    const keys = [`${c}|${p}`, `${c}|*`, `*|${p}`, '*|*'].filter((k, i, a) => a.indexOf(k) === i);
    for (const k of keys) { const v = (D.docRequirements[k] || {})[dt.id]; if (v) return { level: v, src: k }; }
    return { level: dt.required ? 'REQ' : 'OPT', src: 'default' };
  };
  BGS.placement = Object.assign(BGS.placement || {}, {
    requiredDocTypes: (country, prof) => D.docTypes.filter(d => d.active !== false && resolveReq(country || '*', prof || '*', d).level === 'REQ'),
  });
  const srcLabel = (src, c, p) => src === 'default' ? 'Bawaan jenis dokumen' : src === `${c}|${p}` ? 'Aturan khusus pilihan ini' : src === '*|*' ? 'Aturan umum (semua negara & profesi)' : src.endsWith('|*') ? 'Aturan negara ' + D.cn(src.split('|')[0]) : 'Aturan profesi ' + D.pn(src.split('|')[1]);

  const inUseCountry = c => D.placementCodes.filter(p => p.country === c && p.status !== 'CLOSED').length + D.jobOrders.filter(j => j.country === c && j.status !== 'CLOSED').length;
  const inUseProf = c => D.placementCodes.filter(p => p.profession === c && p.status !== 'CLOSED').length + D.jobOrders.filter(j => j.profession === c && j.status !== 'CLOSED').length;
  const toggleActive = async (obj, label, useCount, audit) => {
    const turnOff = obj.active !== false;
    if (turnOff) {
      const ok = await ui.confirm({ title: 'Nonaktifkan ' + label, message: useCount ? `${label} ini masih dipakai di ${useCount} Job Order/Placement Code berjalan. Data lama tidak berubah, tetapi tidak bisa dipilih untuk data baru. Lanjutkan?` : `${label} tidak akan bisa dipilih untuk data baru. Data lama tetap aman.`, confirmLabel: 'Nonaktifkan', tone: 'danger' });
      if (!ok) return false;
    }
    obj.active = !turnOff; BGS.audit(turnOff ? 'Master dinonaktifkan' : 'Master diaktifkan', 'Data master', audit, label);
    ui.toast(`${label} ${turnOff ? 'dinonaktifkan' : 'diaktifkan kembali'}`); return true;
  };
  const activeBadge = o => ui.status('generic', o.active === false ? 'INACTIVE' : 'ACTIVE');
  const actCell = (edit, toggle, o) => canMaster() ? h('div', { class: 'row gap-sm' }, ui.btn('Ubah', { sm: true, icon: 'edit', onClick: edit }), ui.btn(o.active === false ? 'Aktifkan' : 'Nonaktifkan', { sm: true, onClick: toggle })) : h('span', { class: 'muted sm' }, '—');

  function masterTab(kind, ctx) {
    const redraw = () => ctx.refresh();
    const add = (label, fn) => canMaster() ? ui.btn(label, { kind: 'primary', icon: 'plus', onClick: fn }) : ui.btn(label, { icon: 'lock', disabled: true, title: 'Hanya Superadmin yang dapat mengubah data master' });
    const bar = btn => h('div', { class: 'row', style: 'justify-content:flex-end;margin-bottom:10px' }, btn);

    if (kind === 'country') {
      const form = row => formModal({
        title: row ? 'Ubah negara' : 'Tambah negara', cols: 2, fields: [
          { name: 'code', label: 'Kode negara (ISO 2 huruf)', required: true, value: row && row.code, readonly: !!row, hint: row ? 'Kode tidak bisa diubah karena dipakai di Placement Code' : 'Contoh: SG' },
          { name: 'name', label: 'Nama negara', required: true, value: row && row.name }],
        onSubmit: (v, f) => {
          const code = v.code.trim().toUpperCase();
          if (!row) { if (!/^[A-Z]{2}$/.test(code)) { setErr(f, 'code', 'Harus 2 huruf (contoh: SG)'); return false; } if (D.countries.some(c => c.code === code)) { setErr(f, 'code', 'Kode sudah ada'); return false; } D.countries.push({ code, name: v.name.trim() }); BGS.audit('Negara ditambahkan', 'Data master', code, v.name); }
          else { row.name = v.name.trim(); BGS.audit('Negara diubah', 'Data master', code, v.name); }
          ui.toast('Negara disimpan'); redraw();
        },
      });
      return h('div', null, bar(add('Tambah negara', () => form())), ui.table({ pageSize: 20, columns: [
        { label: 'Kode', render: r => h('span', { class: 'mono' }, r.code) }, { label: 'Negara', render: r => r.name }, { label: 'Dipakai', render: r => `${D.placementCodes.filter(p => p.country === r.code).length} kode` },
        { label: 'Status', render: activeBadge }, { label: 'Aksi', render: r => actCell(() => form(r), async () => { if (await toggleActive(r, 'Negara ' + r.name, inUseCountry(r.code), r.code)) redraw(); }, r) }], rows: D.countries }));
    }
    if (kind === 'prof') {
      const form = row => formModal({
        title: row ? 'Ubah profesi' : 'Tambah profesi', cols: 2, fields: [
          { name: 'code', label: 'Kode profesi (3 huruf)', required: true, value: row && row.code, readonly: !!row, hint: row ? 'Kode tidak bisa diubah' : 'Dipakai pada Placement Code, contoh: DMW' },
          { name: 'name', label: 'Nama profesi', required: true, value: row && row.name },
          { name: 'sector', label: 'Sektor', type: 'select', options: ['Formal', 'Informal'], value: row ? row.sector : 'Formal' }],
        onSubmit: (v, f) => {
          const code = v.code.trim().toUpperCase();
          if (!row) { if (!/^[A-Z]{3}$/.test(code)) { setErr(f, 'code', 'Harus 3 huruf (contoh: DMW)'); return false; } if (D.professions.some(c => c.code === code)) { setErr(f, 'code', 'Kode sudah ada'); return false; } D.professions.push({ code, name: v.name.trim(), sector: v.sector }); BGS.audit('Profesi ditambahkan', 'Data master', code, v.name); }
          else { row.name = v.name.trim(); row.sector = v.sector; BGS.audit('Profesi diubah', 'Data master', code, v.name); }
          ui.toast('Profesi disimpan'); redraw();
        },
      });
      return h('div', null, bar(add('Tambah profesi', () => form())), ui.table({ pageSize: 20, columns: [
        { label: 'Kode', render: r => h('span', { class: 'mono' }, r.code) }, { label: 'Profesi', render: r => r.name }, { label: 'Sektor', render: r => ui.badge(r.sector, r.sector === 'Formal' ? 'blue' : 'orange') },
        { label: 'Status', render: activeBadge }, { label: 'Aksi', render: r => actCell(() => form(r), async () => { if (await toggleActive(r, 'Profesi ' + r.name, inUseProf(r.code), r.code)) redraw(); }, r) }], rows: D.professions }));
    }
    if (kind === 'route') {
      const form = row => {
        const boxes = D.countries.map(c => h('label', { class: 'chip', style: 'cursor:pointer;gap:6px' }, h('input', { type: 'checkbox', value: c.code, checked: !!row && row.countries.includes(c.code) }), c.name));
        formModal({
          title: row ? 'Ubah jalur penempatan' : 'Tambah jalur penempatan', cols: 1, fields: [
            { name: 'name', label: 'Nama jalur', required: true, value: row && row.name, hint: 'Contoh: P3MI (swasta), G-to-G, Mandiri' }],
          extra: h('div', { class: 'field', style: 'margin-top:12px' }, h('span', { class: 'lbl' }, 'Berlaku untuk negara'), h('div', { class: 'row wrap gap-sm' }, boxes), h('span', { class: 'hint' }, 'Pilih minimal satu negara.')),
          onSubmit: (v, f) => {
            const cs = boxes.map(b => b.firstChild).filter(i => i.checked).map(i => i.value);
            if (!cs.length) { ui.toast('Pilih minimal satu negara', 'warn'); return false; }
            if (row) { row.name = v.name.trim(); row.countries = cs; BGS.audit('Jalur diubah', 'Data master', row.id, v.name); }
            else { const id = 'RT-' + v.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) + (D.routes.length + 1); D.routes.push({ id, name: v.name.trim(), countries: cs }); BGS.audit('Jalur ditambahkan', 'Data master', id, v.name); }
            ui.toast('Jalur penempatan disimpan'); redraw();
          },
        });
      };
      return h('div', null, ui.callout('warn', 'Jalur penempatan belum final (OQ-02)', 'Daftar jalur di bawah masih bisa berubah mengikuti hasil konfirmasi hukum. Tidak ada jalur yang dikunci di dalam sistem — semuanya diatur dari data master ini.'),
        h('div', { style: 'height:10px' }), bar(add('Tambah jalur', () => form())), ui.table({ pageSize: 20, columns: [
          { label: 'ID', render: r => h('span', { class: 'mono' }, r.id) }, { label: 'Jalur', render: r => r.name }, { label: 'Negara', render: r => ui.chips(r.countries.map(D.cn)) },
          { label: 'Status', render: activeBadge }, { label: 'Aksi', render: r => actCell(() => form(r), async () => { if (await toggleActive(r, 'Jalur ' + r.name, D.placementCodes.filter(p => p.route === r.id && p.status !== 'CLOSED').length, r.id)) redraw(); }, r) }], rows: D.routes }));
    }
    if (kind === 'doc') {
      const form = row => formModal({
        title: row ? 'Ubah jenis dokumen' : 'Tambah jenis dokumen', cols: 2, fields: [
          { name: 'name', label: 'Nama dokumen', required: true, value: row && row.name, span: 2 },
          { name: 'validMonths', label: 'Masa berlaku (bulan, 0 = tanpa batas)', type: 'number', value: row ? row.validMonths : 0 },
          { name: 'required', label: 'Wajib secara umum (bawaan)', type: 'checkbox', value: row ? row.required : true }],
        onSubmit: v => {
          const vm = Math.max(0, parseInt(v.validMonths || 0, 10) || 0);
          if (row) { Object.assign(row, { name: v.name.trim(), validMonths: vm, required: !!v.required }); BGS.audit('Jenis dokumen diubah', 'Data master', row.id, row.name); }
          else { const id = nextId('DT', D.docTypes, 2); D.docTypes.push({ id, name: v.name.trim(), required: !!v.required, validMonths: vm }); BGS.audit('Jenis dokumen ditambahkan', 'Data master', id, v.name); }
          ui.toast('Jenis dokumen disimpan'); redraw();
        },
      });
      return h('div', null, bar(add('Tambah jenis dokumen', () => form())), ui.table({ pageSize: 20, columns: [
        { label: 'ID', render: r => h('span', { class: 'mono' }, r.id) }, { label: 'Dokumen', render: r => r.name },
        { label: 'Wajib (bawaan)', render: r => r.required ? ui.badge('Wajib', 'green') : ui.badge('Opsional', 'gray') }, { label: 'Masa berlaku', render: r => r.validMonths ? `${r.validMonths} bulan` : 'Tanpa batas' },
        { label: 'Status', render: activeBadge }, { label: 'Aksi', render: r => actCell(() => form(r), async () => { if (await toggleActive(r, 'Jenis dokumen ' + r.name, 0, r.id)) redraw(); }, r) }], rows: D.docTypes }));
    }
    // requirements matrix
    const st = masterTab.req || (masterTab.req = { c: '*', p: '*' });
    const host = h('div');
    const draw = () => {
      BGS.clear(host);
      const key = `${st.c}|${st.p}`; const label = `${st.c === '*' ? 'Semua negara' : D.cn(st.c)} · ${st.p === '*' ? 'Semua profesi' : D.pn(st.p)}`;
      const sel = (val, opts, on) => h('select', { class: 'input sel', onChange: e => on(e.target.value) }, opts.map(([v, l]) => h('option', { value: v, selected: v === val }, l)));
      const editor = ui.table({ pageSize: 30, dense: true, columns: [
        { label: 'Dokumen', render: d => d.name },
        { label: 'Berlaku sekarang', render: d => { const r = resolveReq(st.c, st.p, d); return h('div', null, ui.badge(LEVEL[r.level][0], LEVEL[r.level][1]), h('div', { class: 'muted sm' }, srcLabel(r.src, st.c, st.p))); } },
        { label: 'Atur untuk pilihan ini', render: d => { const own = (D.docRequirements[key] || {})[d.id] || ''; if (!canMaster()) return h('span', { class: 'muted sm' }, own ? LEVEL[own][0] : 'Mengikuti aturan lebih umum'); return sel(own, [['', 'Ikuti aturan lebih umum'], ['REQ', 'Wajib'], ['OPT', 'Opsional'], ['NA', 'Tidak perlu']], v => { const o = D.docRequirements[key] = D.docRequirements[key] || {}; if (v) o[d.id] = v; else delete o[d.id]; BGS.audit('Syarat dokumen diubah', 'Data master', key, `${d.name}: ${v || 'ikuti aturan umum'}`); ui.toast('Syarat dokumen disimpan'); draw(); }); } }],
        rows: D.docTypes.filter(d => d.active !== false) });
      const cs = D.countries.filter(c => c.active !== false);
      const mat = h('div', { class: 'tbl-scroll' }, h('table', { class: 'pl-mat' }, h('thead', null, h('tr', null, h('th', null, 'Dokumen'), cs.map(c => h('th', null, c.name)))),
        h('tbody', null, D.docTypes.filter(d => d.active !== false).map(d => h('tr', null, h('td', null, d.name), cs.map(c => { const r = resolveReq(c.code, st.p, d).level; return h('td', { class: r === 'REQ' ? 'pl-req' : r === 'OPT' ? 'pl-opt' : 'pl-na', title: LEVEL[r][0] }, r === 'REQ' ? '● Wajib' : r === 'OPT' ? '○ Opsional' : '—'); }))))));
      host.append(
        h('div', { class: 'toolbar' }, h('label', { class: 'row gap-sm' }, h('b', null, 'Negara'), sel(st.c, [['*', 'Semua negara'], ...countryOpts()], v => { st.c = v; draw(); })), h('label', { class: 'row gap-sm' }, h('b', null, 'Profesi'), sel(st.p, [['*', 'Semua profesi'], ...profOpts()], v => { st.p = v; draw(); }))),
        h('p', { class: 'muted sm' }, 'Urutan aturan: negara+profesi → negara → profesi → umum → bawaan jenis dokumen. Syarat ini menjadi dasar kelengkapan dokumen lamaran (MVP 1).'),
        ui.card({ title: 'Syarat dokumen: ' + label, icon: 'file-text', body: editor, flush: true }),
        h('div', { style: 'height:14px' }),
        ui.card({ title: 'Ringkasan per negara' + (st.p === '*' ? '' : ' · ' + D.pn(st.p)), subtitle: 'Matriks dokumen yang wajib/opsional di setiap negara tujuan', icon: 'list', body: mat }));
    };
    draw(); return host;
  }

  BGS.router.add('/master', { title: 'Data master', roles: MG, mvp: 1, render(ctx) {
    const el = ctx.el;
    el.appendChild(head({ title: 'Data master', subtitle: 'Negara, profesi, jalur penempatan, jenis dokumen, dan syarat dokumen. Semua pilihan di sistem membaca data ini — tidak ada yang ditulis mati.', mvp: 1 }));
    if (!canMaster()) el.appendChild(roAlert('Data master', 'Superadmin'));
    el.appendChild(h('div', { style: 'height:10px' }));
    const tab = ctx.query.tab || 'country';
    el.appendChild(ui.tabs([
      { id: 'country', label: 'Negara', count: D.countries.length, render: () => masterTab('country', ctx) },
      { id: 'prof', label: 'Profesi', count: D.professions.length, render: () => masterTab('prof', ctx) },
      { id: 'route', label: 'Jalur penempatan', count: D.routes.length, render: () => masterTab('route', ctx) },
      { id: 'doc', label: 'Jenis dokumen', count: D.docTypes.length, render: () => masterTab('doc', ctx) },
      { id: 'req', label: 'Syarat dokumen per negara/profesi', render: () => masterTab('req', ctx) },
    ], { active: ctx.query.tab || masterTab.last || 'country', onChange: t => { masterTab.last = t; } }));
  } });

  // ======================================================================
  // /partners (MVP 2)
  // ======================================================================
  const partnerJOs = id => D.jobOrders.filter(j => j.partnerId === id);
  function partnerForm(row, ctx) {
    formModal({
      title: row ? 'Ubah partner' : 'Tambah partner', cols: 2, fields: [
        { name: 'name', label: 'Nama partner (agensi mitra luar negeri)', required: true, value: row && row.name, span: 2 },
        { name: 'country', label: 'Negara', type: 'select', required: true, options: countryOpts(), value: row ? row.country : 'SA' },
        { name: 'status', label: 'Status', type: 'select', options: [['ACTIVE', 'Aktif'], ['INACTIVE', 'Nonaktif']], value: row ? row.status : 'ACTIVE' },
        { name: 'contact', label: 'Nama kontak', required: true, value: row && row.contact },
        { name: 'phone', label: 'Telepon', value: row && row.phone },
        { name: 'email', label: 'Email', type: 'email', value: row && row.email, span: 2 }],
      onSubmit: (v, f) => {
        if (D.partners.some(p => p !== row && p.name.toLowerCase() === v.name.trim().toLowerCase() && p.country === v.country)) { setErr(f, 'name', 'Partner dengan nama dan negara sama sudah ada'); return false; }
        if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) { setErr(f, 'email', 'Format email tidak valid'); return false; }
        if (row && row.status === 'ACTIVE' && v.status === 'INACTIVE' && partnerJOs(row.id).some(j => j.status === 'ACTIVE')) ui.toast('Perhatian: partner masih punya Job Order aktif', 'warn');
        const data = { name: v.name.trim(), country: v.country, status: v.status, contact: v.contact.trim(), phone: v.phone.trim(), email: v.email.trim() };
        if (row) { Object.assign(row, data); BGS.audit('Partner diubah', 'Partner', row.id, row.name); } else { const id = nextId('PT', D.partners, 2); D.partners.push(Object.assign({ id }, data)); BGS.audit('Partner ditambahkan', 'Partner', id, data.name); }
        ui.toast('Partner disimpan'); ctx.refresh();
      },
    });
  }
  function partnerDrawer(p, ctx) {
    const jos = partnerJOs(p.id);
    const dr = ui.drawer({ title: p.name, size: 'lg', body: h('div', { class: 'stack' },
      ui.kv([['Negara', D.cn(p.country)], ['Status', ui.status('generic', p.status)], ['Kontak', p.contact], ['Email', p.email], ['Telepon', p.phone], ['Jumlah Job Order', jos.length]], 2),
      ui.card({ title: 'Job Order partner ini', icon: 'file-text', flush: true, body: ui.table({ dense: true, rows: jos, empty: ui.emptyState({ icon: 'file-text', title: 'Belum ada Job Order', text: 'Buat Job Order dari menu Job Order.' }), columns: [
        { label: 'No. Job Order', render: j => ui.link(j.id, '/job-orders/' + j.id, 'lnk mono') }, { label: 'Referensi resmi', render: j => j.ref }, { label: 'Profesi', render: j => D.pn(j.profession) }, { label: 'Diminta', render: j => j.requested }, { label: 'Status', render: j => ui.status('generic', j.status) }] }) }),
      canPartner() && h('div', { class: 'row gap-sm' }, ui.btn('Ubah partner', { icon: 'edit', onClick: () => { dr.close(); partnerForm(p, ctx); } }), ui.btn('Buat Job Order', { icon: 'plus', kind: 'primary', disabled: p.status !== 'ACTIVE', title: p.status !== 'ACTIVE' ? 'Partner nonaktif' : '', onClick: () => { dr.close(); jobOrderForm(null, ctx, p.id); } }))) });
  }
  BGS.router.add('/partners', { title: 'Partner', roles: ALL, mvp: 2, render(ctx) {
    const el = ctx.el;
    el.appendChild(head({ title: 'Partner', subtitle: 'Agensi mitra di negara tujuan yang mengirim permintaan tenaga kerja (Job Order).', mvp: 2,
      actions: canPartner() ? ui.btn('Tambah partner', { kind: 'primary', icon: 'plus', onClick: () => partnerForm(null, ctx) }) : ui.btn('Tambah partner', { icon: 'lock', disabled: true, title: 'Hanya Superadmin dan Admin yang dapat menambah partner' }) }));
    if (!canPartner()) el.appendChild(h('div', { style: 'margin-bottom:10px' }, roAlert('Data partner', 'Superadmin dan Admin')));
    el.appendChild(ui.card({ flush: true, body: ui.listView({
      items: () => D.partners, search: p => `${p.id} ${p.name} ${p.contact} ${p.email} ${D.cn(p.country)}`, searchPlaceholder: 'Cari partner, kontak, negara…',
      filters: [{ key: 'country', label: 'Negara', options: countryOpts() }, { key: 'status', label: 'Status', options: [['ACTIVE', 'Aktif'], ['INACTIVE', 'Nonaktif']] }],
      onRowClick: p => partnerDrawer(p, ctx), sortKey: 'name',
      columns: [
        { key: 'name', label: 'Partner', sortable: true, render: p => h('div', null, h('b', null, p.name), h('div', { class: 'muted sm mono' }, p.id)) },
        { label: 'Negara', render: p => D.cn(p.country) },
        { label: 'Kontak', render: p => h('div', null, p.contact, h('div', { class: 'muted sm' }, p.email)) },
        { label: 'Status', render: p => ui.status('generic', p.status) },
        { label: 'Job Order', align: 'right', render: p => partnerJOs(p.id).length },
        { label: '', render: p => canPartner() ? ui.btn('Ubah', { sm: true, icon: 'edit', onClick: () => partnerForm(p, ctx) }) : null }],
    }) }));
  } });

  // ======================================================================
  // Job Order form + list + detail
  // ======================================================================
  function jobOrderForm(row, ctx, presetPartner) {
    const partners = D.partners.filter(p => p.status === 'ACTIVE' || (row && p.id === row.partnerId));
    const p0 = row ? D.partner(row.partnerId) : D.partners.find(p => p.id === presetPartner) || partners[0];
    const minReq = row ? sumTotals(row) : 0;
    const { f } = formModal({
      title: row ? `Ubah Job Order ${row.id}` : 'Buat Job Order', cols: 2, size: 'lg',
      fields: [
        { name: 'partnerId', label: 'Partner', type: 'select', required: true, options: partners.map(p => [p.id, `${p.name} (${D.cn(p.country)})`]), value: p0 && p0.id },
        { name: 'ref', label: 'Nomor referensi resmi permintaan', required: true, value: row && row.ref, hint: 'Isi persis seperti di surat/dokumen resmi. Format baku belum final (OQ-06).' },
        { name: 'country', label: 'Negara tujuan', type: 'select', required: true, options: countryOpts(), value: row ? row.country : (p0 && p0.country) || 'SA' },
        { name: 'profession', label: 'Profesi', type: 'select', required: true, options: profOpts(), value: row ? row.profession : 'DMW' },
        { name: 'route', label: 'Jalur penempatan', type: 'select', required: true, options: [], value: row && row.route, hint: 'Jalur belum final (OQ-02); pilihan mengikuti data master.' },
        { name: 'requested', label: 'Jumlah diminta (orang)', type: 'number', required: true, value: row ? row.requested : '', hint: row && minReq ? `Tidak boleh di bawah total semua Placement Code (${minReq})` : null },
        { name: 'receivedAt', label: 'Tanggal diterima', type: 'date', required: true, value: row ? row.receivedAt : isoDate(BGS.today) },
        { name: 'status', label: 'Status', type: 'select', options: [['DRAFT', 'Draf'], ['ACTIVE', 'Aktif'], ['CLOSED', 'Ditutup']], value: row ? row.status : 'ACTIVE' },
        { name: 'note', label: 'Catatan', type: 'textarea', rows: 2, value: row && row.note, span: 2 }],
      wire: f => {
        const inp = n => getNode(f, n).input; const rt = inp('route');
        const fillRoutes = () => { const keep = rt.value || (row && row.route); BGS.clear(rt); const rs = routesFor(inp('country').value); rs.forEach(r => rt.appendChild(h('option', { value: r.id, selected: r.id === keep }, r.name))); if (!rs.length) rt.appendChild(h('option', { value: '' }, '(belum ada jalur untuk negara ini)')); };
        inp('country').addEventListener('change', fillRoutes);
        inp('partnerId').addEventListener('change', () => { const p = D.partner(inp('partnerId').value); if (p && !row) { inp('country').value = p.country; fillRoutes(); } });
        fillRoutes(); if (row) rt.value = row.route;
      },
      onSubmit: (v, f) => {
        const req = parseInt(v.requested, 10); let bad = false;
        if (!(req >= 1)) { setErr(f, 'requested', 'Isi angka minimal 1'); bad = true; }
        else if (req < minReq) { setErr(f, 'requested', `Tidak boleh di bawah total kuota Placement Code (${minReq})`); bad = true; }
        if (!v.route) { setErr(f, 'route', 'Pilih jalur penempatan'); bad = true; }
        if (D.jobOrders.some(j => j !== row && j.ref.trim().toLowerCase() === v.ref.trim().toLowerCase())) { setErr(f, 'ref', 'Nomor referensi ini sudah dipakai Job Order lain'); bad = true; }
        const pt = D.partner(v.partnerId); if (pt && pt.country !== v.country) { setErr(f, 'country', `Partner ini berada di ${D.cn(pt.country)}`); bad = true; }
        if (row && v.status === 'CLOSED' && row.status !== 'CLOSED' && jobCodes(row).some(c => c.status !== 'CLOSED')) { setErr(f, 'status', 'Tutup dulu semua Placement Code milik Job Order ini'); bad = true; }
        if (bad) return false;
        const data = { partnerId: v.partnerId, ref: v.ref.trim(), country: v.country, profession: v.profession, route: v.route, requested: req, receivedAt: v.receivedAt, status: v.status, note: v.note.trim() };
        if (row) { const codesChanged = (row.country !== data.country || row.profession !== data.profession) && jobCodes(row).length; if (codesChanged) { setErr(f, 'country', 'Negara/profesi tidak bisa diubah karena sudah ada Placement Code'); return false; } Object.assign(row, data); BGS.audit('Job Order diubah', 'Job Order', row.id, data.ref); ui.toast('Job Order diperbarui'); ctx.refresh(); }
        else { const yr = BGS.today.getFullYear(); const n = D.jobOrders.filter(j => j.id.startsWith(`JO-${yr}-`)).length + 1; let id = `JO-${yr}-${pad(n, 4)}`; let k = n; while (D.job(id)) id = `JO-${yr}-${pad(++k, 4)}`; D.jobOrders.push(Object.assign({ id }, data)); BGS.audit('Job Order dibuat', 'Job Order', id, data.ref); ui.toast(`Job Order ${id} dibuat. Lanjutkan dengan membuat Placement Code.`); BGS.go('/job-orders/' + id); }
      },
    });
  }
  D.job = D.job || (id => D.jobOrders.find(j => j.id === id));

  BGS.router.add('/job-orders', { title: 'Job Order', roles: ALL, mvp: 2, render(ctx) {
    const el = ctx.el;
    el.appendChild(head({ title: 'Job Order', subtitle: 'Permintaan tenaga kerja dari partner. Satu Job Order dapat dipecah menjadi beberapa Placement Code (kuota).', mvp: 2,
      actions: canOps() ? ui.btn('Buat Job Order', { kind: 'primary', icon: 'plus', onClick: () => jobOrderForm(null, ctx) }) : ui.btn('Buat Job Order', { icon: 'lock', disabled: true, title: 'Hanya Superadmin dan Admin yang dapat membuat Job Order' }) }));
    const act = D.jobOrders.filter(j => j.status === 'ACTIVE');
    el.appendChild(h('div', { class: 'grid cols-4', style: 'margin-bottom:14px' },
      ui.kpi({ label: 'Job Order aktif', value: act.length, icon: 'file-text', tone: 'blue' }),
      ui.kpi({ label: 'Total diminta', value: fmt.num(act.reduce((a, j) => a + j.requested, 0)), sub: 'orang (Job Order aktif)', icon: 'users', tone: 'purple' }),
      ui.kpi({ label: 'Sudah dibuat kuotanya', value: fmt.num(act.reduce((a, j) => a + sumTotals(j), 0)), sub: 'jumlah Total Placement Code', icon: 'layers', tone: 'teal' }),
      ui.kpi({ label: 'Belum dibuat kuotanya', value: fmt.num(act.reduce((a, j) => a + Math.max(0, j.requested - sumTotals(j)), 0)), sub: 'perlu Placement Code baru', icon: 'alert', tone: 'orange' })));
    el.appendChild(ui.card({ flush: true, body: ui.listView({
      items: () => D.jobOrders, search: j => `${j.id} ${j.ref} ${(D.partner(j.partnerId) || {}).name} ${D.cn(j.country)} ${D.pn(j.profession)}`, searchPlaceholder: 'Cari nomor Job Order, referensi, partner…',
      filters: [{ key: 'status', label: 'Status', options: [['DRAFT', 'Draf'], ['ACTIVE', 'Aktif'], ['CLOSED', 'Ditutup']] }, { key: 'country', label: 'Negara', options: countryOpts() }, { key: 'partnerId', label: 'Partner', options: D.partners.map(p => [p.id, p.name]) }],
      onRowClick: j => BGS.go('/job-orders/' + j.id), sortKey: 'id', sortDir: -1,
      columns: [
        { key: 'id', label: 'No. Job Order', sortable: true, render: j => ui.link(j.id, '/job-orders/' + j.id, 'lnk mono') },
        { label: 'Partner', render: j => (D.partner(j.partnerId) || {}).name },
        { label: 'Referensi resmi', render: j => h('span', { class: 'mono sm' }, j.ref) },
        { label: 'Negara · Profesi · Jalur', render: j => h('div', null, `${D.cn(j.country)} · ${D.pn(j.profession)}`, h('div', { class: 'muted sm' }, routeName(j.route))) },
        { label: 'Diminta', align: 'right', render: j => j.requested },
        { label: 'Total kuota', align: 'right', render: j => { const s = sumTotals(j); return h('span', { style: s > j.requested ? 'color:#B91C1C;font-weight:700' : '' }, `${s} / ${j.requested}`); } },
        { label: 'Status', render: j => ui.status('generic', j.status) }],
    }) }));
  } });

  // ---------- create Placement Code ----------
  function suggestCode(jo, yymm) {
    const prefix = `${jo.country}-${jo.profession}-${yymm}-`; let n = 1;
    while (D.placementCode(prefix + pad(n, 2))) n++;
    return prefix + pad(n, 2);
  }
  function createCodeModal(jo, after) {
    const room = jo.requested - sumTotals(jo);
    const nm = new Date(BGS.today.getFullYear(), BGS.today.getMonth() + 1, 1);
    let yymm = pad(nm.getFullYear() % 100, 2) + pad(nm.getMonth() + 1, 2); let dirty = false;
    const { f } = formModal({
      title: `Buat Placement Code · ${jo.id}`, cols: 2, size: 'lg',
      intro: h('div', { class: 'stack' }, ui.kv([['Partner', (D.partner(jo.partnerId) || {}).name], ['Negara · Profesi', `${D.cn(jo.country)} · ${D.pn(jo.profession)}`], ['Jalur', routeName(jo.route)], ['Sisa permintaan belum dibuat kuotanya', `${Math.max(0, room)} dari ${jo.requested}`]], 2),
        ui.callout('info', 'Kuota dimulai dari nol', 'Setelah dibuat, Dicadangkan = 0 dan Terpakai = 0. Kuota dicadangkan saat worker dialokasikan dan terpakai saat Perjanjian Penempatan ditandatangani (RUL-004/005).')),
      fields: [
        { name: 'code', label: 'Kode Placement Code', required: true, value: suggestCode(jo, yymm), hint: 'Format: {NEGARA}-{PROFESI}-{TAHUN BULAN}-{NO}, contoh SA-DMW-2612-01. Saran otomatis, boleh diubah.' },
        { name: 'total', label: 'Total kuota (orang)', type: 'number', required: true, value: Math.max(1, room) || '', hint: room > 0 ? `Maksimal ${room} (sisa permintaan Job Order)` : 'Permintaan Job Order sudah penuh dibagi' },
        { name: 'yymm', label: 'Bulan keberangkatan (YYMM)', value: yymm, hint: 'Dipakai untuk saran kode. Contoh 2612 = Des 2026' },
        { name: 'batchDate', label: 'Batch: tanggal berangkat (opsional)', type: 'date', hint: 'Isi jika ingin sekaligus membuat Batch untuk kode ini' }],
      wire: f => {
        const inp = n => getNode(f, n).input;
        inp('code').addEventListener('input', () => { dirty = true; });
        const upd = () => { yymm = inp('yymm').value.trim(); if (!dirty && /^\d{4}$/.test(yymm)) inp('code').value = suggestCode(jo, yymm); };
        inp('yymm').addEventListener('input', upd);
        inp('batchDate').addEventListener('change', () => { const v = inp('batchDate').value; if (v) { inp('yymm').value = v.slice(2, 4) + v.slice(5, 7); upd(); } });
      },
      onSubmit: (v, f) => {
        const code = v.code.trim().toUpperCase(); const total = parseInt(v.total, 10); let bad = false;
        if (!/^[A-Z]{2}-[A-Z]{3}-\d{4}-\d{2}$/.test(code)) { setErr(f, 'code', 'Format harus seperti SA-DMW-2612-01'); bad = true; }
        else if (!code.startsWith(`${jo.country}-${jo.profession}-`)) { setErr(f, 'code', `Kode harus diawali ${jo.country}-${jo.profession}- sesuai Job Order`); bad = true; }
        else if (D.placementCode(code)) { setErr(f, 'code', 'Kode sudah dipakai (harus unik)'); bad = true; }
        if (!(total >= 1)) { setErr(f, 'total', 'Isi angka minimal 1'); bad = true; }
        else if (total > room) { setErr(f, 'total', `Melebihi sisa permintaan Job Order (${Math.max(0, room)} orang)`); bad = true; }
        if (jo.status === 'CLOSED') { ui.toast('Job Order sudah ditutup', 'warn'); bad = true; }
        if (bad) return false;
        const pc = { id: code, jobOrderId: jo.id, country: jo.country, profession: jo.profession, route: jo.route, status: 'OPEN', total, legacyReserved: 0, legacyUtilized: 0, batchId: null, createdAt: BGS.today.toISOString(), createdBy: BGS.state.userId, history: [{ at: BGS.today.toISOString(), by: BGS.state.userId, text: `Placement Code dibuat dengan Total ${total}` }] };
        if (v.batchDate) {
          const ym = v.batchDate.slice(2, 4) + v.batchDate.slice(5, 7); const used = D.batches.filter(b => b.id.startsWith('BT-' + ym + '-')).length;
          const bid = `BT-${ym}-${String.fromCharCode(65 + used)}`; const nameM = new Date(v.batchDate);
          D.batches.push({ id: bid, name: `Batch ${D.cn(jo.country)} ${fmt.date(nameM).split(' ').slice(1).join(' ')}`, code, departDate: v.batchDate, capacity: total, status: 'PLANNED' }); pc.batchId = bid; BGS.audit('Batch dibuat', 'Batch', bid, code);
        }
        D.placementCodes.push(pc); syncQuota(); BGS.audit('Placement Code dibuat', 'Placement Code', code, `Total kuota ${total}, Job Order ${jo.id}`);
        ui.toast(`Placement Code ${code} dibuat (Total ${total}, Tersedia ${total})`); after && after(pc);
      },
    });
  }

  BGS.router.add('/job-orders/:id', { title: 'Detail Job Order', roles: ALL, mvp: 2, render(ctx) {
    const el = ctx.el; const jo = D.jobOrder(ctx.params.id);
    if (!jo) { el.appendChild(ui.emptyState({ icon: 'file-text', title: 'Job Order tidak ditemukan', text: ctx.params.id, action: ui.link('Kembali ke daftar', '/job-orders', 'btn btn-primary') })); return; }
    const pt = D.partner(jo.partnerId); const codes = jobCodes(jo); const s = sumTotals(jo);
    el.appendChild(head({ title: jo.id, breadcrumbs: [{ label: 'Job Order', href: '/job-orders' }, { label: jo.id }], mvp: 2, subtitle: `${pt ? pt.name : ''} · ${D.cn(jo.country)} · ${D.pn(jo.profession)}`,
      actions: canOps() ? [ui.btn('Ubah', { icon: 'edit', onClick: () => jobOrderForm(jo, ctx) }), ui.btn('Buat Placement Code', { kind: 'primary', icon: 'plus', disabled: jo.status === 'CLOSED' || room(jo) <= 0, title: jo.status === 'CLOSED' ? 'Job Order sudah ditutup' : room(jo) <= 0 ? 'Seluruh permintaan sudah dibagi menjadi kuota' : '', onClick: () => createCodeModal(jo, () => ctx.refresh()) })] : null }));
    function room(j) { return j.requested - sumTotals(j); }
    el.appendChild(h('div', { class: 'stack' },
      h('div', { class: 'grid cols-4' },
        ui.kpi({ label: 'Jumlah diminta', value: jo.requested, icon: 'users', tone: 'blue' }),
        ui.kpi({ label: 'Total kuota Placement Code', value: s, sub: s > jo.requested ? 'Melebihi permintaan!' : `Sisa belum dibagi ${jo.requested - s}`, icon: 'layers', tone: s > jo.requested ? 'red' : 'teal' }),
        ui.kpi({ label: 'Dicadangkan + Terpakai', value: codes.reduce((a, c) => a + c.reserved + c.utilized, 0), icon: 'clipboard', tone: 'orange' }),
        ui.kpi({ label: 'Tersedia', value: codes.reduce((a, c) => a + c.available, 0), icon: 'check-circle', tone: 'green' })),
      h('div', { class: 'grid cols-21' },
        ui.card({ title: 'Placement Code (kuota)', icon: 'layers', flush: true, body: ui.table({ rows: codes, dense: true, empty: ui.emptyState({ icon: 'layers', title: 'Belum ada Placement Code', text: 'Buat Placement Code agar worker bisa dialokasikan ke Job Order ini.', action: canOps() && jo.status !== 'CLOSED' ? ui.btn('Buat Placement Code', { kind: 'primary', icon: 'plus', onClick: () => createCodeModal(jo, () => ctx.refresh()) }) : null }), columns: [
          { label: 'Kode', render: c => ui.codeLink(c.id) }, { label: 'Status', render: codeStatus }, { label: 'Total', align: 'right', render: c => c.total }, { label: 'Kuota', render: quotaCell }, { label: 'Tersedia', align: 'right', render: c => h('b', null, c.available) }], rowClass: c => c.available <= 0 && c.status !== 'CLOSED' ? 'pl-full' : '', onRowClick: c => BGS.go('/placement-codes/' + c.id) }) }),
        ui.card({ title: 'Informasi Job Order', icon: 'info', body: ui.kv([
          ['Status', ui.status('generic', jo.status)], ['Partner', pt ? ui.link(pt.name, '/partners') : '—'], ['Referensi resmi', h('span', { class: 'mono' }, jo.ref)], ['Negara', D.cn(jo.country)], ['Profesi', D.pn(jo.profession)], ['Jalur', routeName(jo.route)], ['Diterima', fmt.date(jo.receivedAt)], ['Catatan', jo.note]]) })),
      h('div', { class: 'muted sm' }, 'Nomor referensi resmi mengikuti dokumen asli partner/instansi; format baku masih menunggu konfirmasi (OQ-06).')));
  } });

  // ======================================================================
  // /placement-codes
  // ======================================================================
  function codeCases(pc) { return D.cases.filter(c => c.placementCodeId === pc.id); }
  function isUtilized(c) {
    if (c.status === 'DEPARTED' || c.status === 'READY_TO_DEPART' || c.status === 'FINAL_VERIFICATION') return true;
    const tpl = D.template(c.templateId); const ver = tpl && tpl.versions.find(v => v.number === c.templateVersion || v.v === c.templateVersion); const q = ver && ver.steps.find(s => s.consumesQuota);
    return !!(q && c.steps.find(x => x.stepId === q.id && x.status === 'COMPLETED'));
  }
  function ledger(pc) {
    const rows = [];
    codeCases(pc).forEach(c => {
      rows.push({ at: c.createdAt, caseId: c.id, type: 'RESERVE', by: c.ownerId, note: 'Worker dialokasikan' });
      if (c.status === 'CANCELLED') rows.push({ at: c.cancelledAt || c.createdAt, caseId: c.id, type: 'RELEASE', by: c.ownerId, note: c.cancelReason || 'Case dibatalkan, kuota dilepas', seq: 1 });
      else if (isUtilized(c)) {
        const tpl = D.template(c.templateId); const ver = tpl && tpl.versions.find(v => v.number === c.templateVersion || v.v === c.templateVersion); const q = ver && ver.steps.find(s => s.consumesQuota); const inst = q && c.steps.find(x => x.stepId === q.id);
        rows.push({ at: (inst && inst.completedAt) || (c.flight && c.flight.date) || c.createdAt, caseId: c.id, type: 'UTILIZE', by: c.ownerId, note: 'Perjanjian Penempatan ditandatangani', seq: 1 });
      }
    });
    (pc.history || []).filter(x => x.kind === 'TOTAL').forEach(x => rows.push({ at: x.at, caseId: null, type: 'TOTAL', by: x.by, note: x.text }));
    rows.sort((a, b) => String(b.at).localeCompare(String(a.at)) || (b.seq || 0) - (a.seq || 0));
    return rows;
  }
  const LTYPE = { RESERVE: ['Dicadangkan', 'amber', 'Dicadangkan +1'], UTILIZE: ['Terpakai', 'green', 'Dicadangkan −1 → Terpakai +1'], RELEASE: ['Dilepas', 'gray', 'Dicadangkan −1'], TOTAL: ['Ubah Total', 'blue', 'Total berubah'], LEGACY: ['Data lama', 'gray', ''] };

  BGS.router.add('/placement-codes', { title: 'Placement Code & kuota', roles: ALL, mvp: 2, render(ctx) {
    const el = ctx.el;
    el.appendChild(head({ title: 'Placement Code & kuota', subtitle: 'Tersedia = Total − Dicadangkan − Terpakai, tidak pernah di bawah 0 (RUL-006).', mvp: 2,
      actions: [BGS.can('export') && ui.btn('Ekspor CSV', { icon: 'download', onClick: () => BGS.exportCsv(D.placementCodes, [{ label: 'Kode', key: 'id' }, { label: 'Job Order', key: 'jobOrderId' }, { label: 'Status', value: c => c.status }, { label: 'Total', key: 'total' }, { label: 'Dicadangkan', key: 'reserved' }, { label: 'Terpakai', key: 'utilized' }, { label: 'Tersedia', key: 'available' }], 'placement-code-kuota.csv') }),
        canOps() ? ui.btn('Buat Placement Code', { kind: 'primary', icon: 'plus', onClick: () => pickJobOrder(ctx) }) : ui.btn('Buat Placement Code', { icon: 'lock', disabled: true, title: 'Hanya Superadmin dan Admin yang dapat membuat Placement Code' })] }));
    const pcs = D.placementCodes; const sum = k => pcs.filter(c => c.status !== 'CLOSED').reduce((a, c) => a + c[k], 0);
    const full = pcs.filter(c => c.status === 'FULL').length, low = pcs.filter(isLow).length;
    el.appendChild(h('div', { class: 'grid cols-4', style: 'margin-bottom:14px' },
      ui.kpi({ label: 'Total kuota (kode aktif)', value: sum('total'), icon: 'layers', tone: 'blue' }),
      ui.kpi({ label: 'Dicadangkan', value: sum('reserved'), sub: 'menunggu Perjanjian Penempatan', icon: 'clock', tone: 'amber' }),
      ui.kpi({ label: 'Terpakai', value: sum('utilized'), icon: 'check-circle', tone: 'green' }),
      ui.kpi({ label: 'Tersedia', value: sum('available'), sub: `${full} kode penuh · ${low} menipis`, icon: 'flag', tone: full ? 'orange' : 'teal' })));
    el.appendChild(ui.card({ flush: true, body: ui.listView({
      items: () => D.placementCodes, search: c => `${c.id} ${c.jobOrderId} ${D.cn(c.country)} ${D.pn(c.profession)}`, searchPlaceholder: 'Cari kode atau Job Order…',
      filters: [{ key: 'country', label: 'Negara', options: countryOpts() }, { key: 'profession', label: 'Profesi', options: profOpts() }, { key: 'status', label: 'Status', options: [['OPEN', 'Terbuka'], ['FULL', 'Penuh'], ['CLOSED', 'Ditutup']] }],
      onRowClick: c => BGS.go('/placement-codes/' + c.id), sortKey: 'id', rowClass: c => c.status === 'FULL' ? 'pl-full' : '', pageSize: 12,
      columns: [
        { key: 'id', label: 'Placement Code', sortable: true, render: c => h('div', null, ui.codeLink(c.id), h('div', { class: 'muted sm' }, `${D.cn(c.country)} · ${D.pn(c.profession)}`)) },
        { label: 'Job Order', render: c => ui.link(c.jobOrderId, '/job-orders/' + c.jobOrderId, 'lnk mono') },
        { label: 'Status', render: codeStatus },
        { key: 'total', label: 'Total', align: 'right', sortable: true },
        { label: 'Dicadangkan', align: 'right', render: c => c.reserved }, { label: 'Terpakai', align: 'right', render: c => c.utilized },
        { key: 'available', label: 'Tersedia', align: 'right', sortable: true, render: c => h('b', { style: c.available <= 0 && c.status !== 'CLOSED' ? 'color:#B45309' : '' }, c.available) },
        { label: 'Kuota', render: c => ui.quotaBar(c) }],
    }) }));
    el.appendChild(h('div', { class: 'row gap-sm muted sm', style: 'margin-top:8px' }, h('span', { class: 'badge b-green' }, 'Hijau = terpakai'), h('span', { class: 'badge b-amber' }, 'Kuning = dicadangkan'), h('span', { class: 'badge b-blue' }, 'Biru = tersedia')));
  } });
  function pickJobOrder(ctx) {
    const jos = D.jobOrders.filter(j => j.status !== 'CLOSED' && j.requested - sumTotals(j) > 0);
    if (!jos.length) { ui.toast('Tidak ada Job Order dengan sisa permintaan. Buat/ubah Job Order dahulu.', 'warn'); return; }
    formModal({ title: 'Pilih Job Order', cols: 1, submitLabel: 'Lanjut', fields: [{ name: 'jo', label: 'Job Order', type: 'select', required: true, options: jos.map(j => [j.id, `${j.id} · ${D.cn(j.country)} ${D.pn(j.profession)} · sisa ${j.requested - sumTotals(j)}`]) }],
      onSubmit: v => { setTimeout(() => createCodeModal(D.jobOrder(v.jo), pc => BGS.go('/placement-codes/' + pc.id)), 0); } });
  }

  // ---------- change total quota ----------
  function changeTotal(pc, ctx) {
    const floor = pc.reserved + pc.utilized; const superMode = BGS.can('quota.total.change');
    const pending = D.approvals.find(a => a.type === 'UBAH_TOTAL_KUOTA' && a.subject === pc.id && a.status === 'PENDING');
    if (!superMode && pending) { ui.toast('Sudah ada permintaan perubahan yang menunggu Director', 'warn'); return; }
    const jo = D.jobOrder(pc.jobOrderId);
    formModal({
      title: superMode ? `Ubah Total Kuota · ${pc.id}` : `Ajukan perubahan Total Kuota · ${pc.id}`, cols: 2, submitLabel: superMode ? 'Simpan perubahan' : 'Kirim pengajuan ke Director',
      intro: h('div', { class: 'stack' }, ui.kv([['Total saat ini', pc.total], ['Dicadangkan + Terpakai', `${pc.reserved} + ${pc.utilized} = ${floor}`], ['Batas minimum Total baru', h('b', null, floor)]], 3),
        superMode ? ui.callout('info', 'Superadmin dapat mengubah langsung', 'Wajib mengisi alasan dan dokumen rujukan (misalnya surat tambahan dari partner). Perubahan tercatat di audit.') : ui.callout('warn', 'Perlu persetujuan Director', 'Admin tidak dapat mengubah Total Kuota langsung. Pengajuan akan masuk ke daftar Persetujuan Director (A-15b) dan berlaku setelah disetujui.')),
      fields: [
        { name: 'newTotal', label: 'Total kuota baru', type: 'number', required: true, value: pc.total, hint: `Tidak boleh kurang dari ${floor} (RUL-006)` },
        { name: 'ref', label: 'Dokumen rujukan', type: 'file', required: true, hint: 'Contoh: surat permintaan tambahan partner' },
        { name: 'reason', label: 'Alasan perubahan', type: 'textarea', required: true, span: 2, rows: 2 }],
      onSubmit: (v, f) => {
        const nt = parseInt(v.newTotal, 10);
        if (!(nt >= 0)) { setErr(f, 'newTotal', 'Isi angka yang valid'); return false; }
        if (nt < floor) { setErr(f, 'newTotal', `Tidak bisa di bawah ${floor}: ${pc.reserved} sudah dicadangkan dan ${pc.utilized} sudah terpakai. Lepas kuota dari case terlebih dahulu (RUL-006).`); return false; }
        if (nt === pc.total) { setErr(f, 'newTotal', 'Sama dengan Total saat ini'); return false; }
        if (superMode) {
          const from = pc.total; pc.total = nt; (pc.history = pc.history || []).unshift({ kind: 'TOTAL', at: BGS.today.toISOString(), by: BGS.state.userId, text: `Total ${from} → ${nt}. Alasan: ${v.reason.trim()}. Rujukan: ${v.ref}` });
          syncQuota(); BGS.audit('Total kuota diubah', 'Placement Code', pc.id, `${from} → ${nt}; alasan: ${v.reason.trim()}; rujukan: ${v.ref}`);
          ui.toast(`Total kuota ${pc.id} menjadi ${nt} (Tersedia ${pc.available})`); if (jo && sumTotals(jo) > jo.requested) ui.toast('Total kode kini melebihi permintaan Job Order — perbarui Job Order bila perlu', 'warn');
        } else {
          const n = D.approvals.reduce((m, a) => Math.max(m, parseInt((a.id.match(/\d+/) || [0])[0], 10)), 0) + 1; const id = 'AP-' + pad(n, 3);
          D.approvals.unshift({ id, type: 'UBAH_TOTAL_KUOTA', title: `${nt > pc.total ? 'Tambah' : 'Kurangi'} Total Kuota ${pc.id}: ${pc.total} → ${nt}`, subject: pc.id, requestedBy: BGS.state.userId, at: BGS.today.toISOString(), reason: `${v.reason.trim()} (rujukan: ${v.ref})`, status: 'PENDING', expires: BGS.addDays(BGS.today, 3).toISOString(), payload: { newTotal: nt, from: pc.total, ref: v.ref } });
          BGS.audit('Pengajuan ubah total kuota', 'Placement Code', pc.id, `${pc.total} → ${nt}; ${v.reason.trim()}`);
          D.users.filter(u => u.roles.includes('director') && u.active).forEach(u => BGS.notify(u.id, `Permintaan persetujuan: ubah Total Kuota ${pc.id} (${pc.total} → ${nt})`, '#/approvals', 'APPROVAL'));
          ui.toast('Pengajuan dikirim ke Director (status: Menunggu)');
        }
        ctx.refresh();
      },
    });
  }
  async function closeReopen(pc, ctx) {
    if (pc.status === 'CLOSED') {
      const r = await ui.reasonPrompt({ title: `Buka kembali ${pc.id}`, label: 'Alasan membuka kembali', confirmLabel: 'Buka kembali' }); if (!r) return;
      pc.status = 'OPEN'; (pc.history = pc.history || []).unshift({ at: BGS.today.toISOString(), by: BGS.state.userId, text: 'Dibuka kembali. Alasan: ' + r }); syncQuota(); BGS.audit('Placement Code dibuka kembali', 'Placement Code', pc.id, r); ui.toast('Placement Code dibuka kembali');
    } else {
      const r = await ui.reasonPrompt({ title: `Tutup ${pc.id}`, message: pc.reserved ? `Masih ada ${pc.reserved} kuota dicadangkan; case berjalan tetap lanjut, tetapi alokasi baru tidak bisa dilakukan.` : 'Setelah ditutup, tidak ada alokasi baru ke kode ini.', label: 'Alasan menutup', confirmLabel: 'Tutup kode', tone: 'danger' }); if (!r) return;
      pc.status = 'CLOSED'; pc.closeReason = r; (pc.history = pc.history || []).unshift({ at: BGS.today.toISOString(), by: BGS.state.userId, text: 'Ditutup. Alasan: ' + r }); BGS.audit('Placement Code ditutup', 'Placement Code', pc.id, r); ui.toast('Placement Code ditutup');
    }
    ctx.refresh();
  }

  BGS.router.add('/placement-codes/:id', { title: 'Detail Placement Code', roles: ALL, mvp: 2, render(ctx) {
    const el = ctx.el; const pc = D.placementCode(ctx.params.id);
    if (!pc) { el.appendChild(ui.emptyState({ icon: 'layers', title: 'Placement Code tidak ditemukan', text: ctx.params.id, action: ui.link('Kembali ke daftar', '/placement-codes', 'btn btn-primary') })); return; }
    const jo = D.jobOrder(pc.jobOrderId); const pt = jo && D.partner(jo.partnerId); const batch = batchOf(pc.batchId);
    const pending = D.approvals.find(a => a.type === 'UBAH_TOTAL_KUOTA' && a.subject === pc.id && a.status === 'PENDING');
    const superMode = BGS.can('quota.total.change'), reqMode = BGS.can('quota.total.request');
    const totalBtn = superMode ? ui.btn('Ubah Total Kuota', { icon: 'edit', onClick: () => changeTotal(pc, ctx) }) : reqMode ? ui.btn(pending ? 'Pengajuan menunggu Director' : 'Ajukan perubahan', { icon: 'send', disabled: !!pending, title: pending ? 'Sudah ada pengajuan yang menunggu keputusan' : '', onClick: () => changeTotal(pc, ctx) }) : ui.btn('Ubah Total Kuota', { icon: 'lock', disabled: true, title: 'Hanya Superadmin yang dapat mengubah; Admin dapat mengajukan' });
    el.appendChild(head({ title: pc.id, breadcrumbs: [{ label: 'Placement Code', href: '/placement-codes' }, { label: pc.id }], mvp: 2, subtitle: `${D.cn(pc.country)} · ${D.pn(pc.profession)} · ${routeName(pc.route)}`,
      actions: [codeStatus(pc), canOps() ? [totalBtn, ui.btn(pc.status === 'CLOSED' ? 'Buka kembali' : 'Tutup kode', { icon: pc.status === 'CLOSED' ? 'refresh' : 'lock', onClick: () => closeReopen(pc, ctx) })] : null] }));
    const body = h('div', { class: 'stack' });
    if (pc.status === 'FULL') body.appendChild(ui.callout('warn', 'Kuota penuh (Tersedia = 0)', 'Tidak ada alokasi baru sampai ada kuota yang dilepas atau Total Kuota ditambah.'));
    else if (isLow(pc)) body.appendChild(ui.callout('warn', 'Kuota menipis', `Hanya tersisa ${pc.available} dari ${pc.total}.`));
    if (pc.status === 'CLOSED') body.appendChild(ui.callout('info', 'Kode ditutup', pc.closeReason ? 'Alasan: ' + pc.closeReason : 'Tidak menerima alokasi baru.'));
    if (pending) body.appendChild(ui.callout('warn', `Ada pengajuan ubah Total menunggu Director (${pending.id})`, `${pending.title} · diajukan ${(D.user(pending.requestedBy) || {}).name || ''} ${fmt.rel(pending.at)}. Alasan: ${pending.reason}`));
    body.appendChild(h('div', { class: 'grid cols-4' },
      ui.kpi({ label: 'Total', value: pc.total, icon: 'layers', tone: 'blue' }), ui.kpi({ label: 'Dicadangkan', value: pc.reserved, sub: 'sudah dialokasikan', icon: 'clock', tone: 'amber' }),
      ui.kpi({ label: 'Terpakai', value: pc.utilized, sub: 'perjanjian ditandatangani', icon: 'check-circle', tone: 'green' }), ui.kpi({ label: 'Tersedia', value: pc.available, icon: 'flag', tone: pc.available <= 0 ? 'orange' : 'teal' })));
    body.appendChild(ui.callout(pc.total === pc.reserved + pc.utilized + pc.available && pc.available >= 0 ? 'info' : 'danger', 'Rumus kuota (RUL-004..007)', h('div', null, h('span', { class: 'pl-formula' }, 'Tersedia = Total − Dicadangkan − Terpakai ≥ 0'), h('div', { class: 'sm' }, `${pc.total} − ${pc.reserved} − ${pc.utilized} = ${pc.available}. Satu worker hanya memegang satu kuota; dicadangkan saat alokasi, terpakai saat Perjanjian Penempatan, dilepas jika case batal.`), h('div', { style: 'margin-top:8px;max-width:420px' }, ui.quotaBar(pc)))));

    const jobCard = ui.card({ title: 'Informasi', icon: 'info', body: ui.kv([['Job Order', jo ? ui.link(jo.id, '/job-orders/' + jo.id, 'lnk mono') : '—'], ['Partner', pt && pt.name], ['Referensi resmi', jo && h('span', { class: 'mono' }, jo.ref)], ['Batch', batch ? ui.link(`${batch.name} (${fmt.date(batch.departDate)})`, '/batches?open=' + batch.id) : 'Belum ada'], ['Case aktif', codeCases(pc).filter(caseActive).length]]) });
    // cases
    const scoped = BGS.scope.cases(); const cs = codeCases(pc).filter(c => scoped.includes(c));
    const casesCard = ui.card({ title: 'Placement Case pada kode ini', subtitle: BGS.scope.isLimited() ? 'Hanya case yang ditugaskan kepada Anda' : null, icon: 'briefcase', flush: true, body: ui.table({ rows: cs, dense: true, empty: ui.emptyState({ icon: 'briefcase', title: 'Belum ada case', text: 'Case muncul setelah worker dialokasikan.' }), columns: [
      { label: 'Case', render: c => ui.caseLink(c.id) }, { label: 'Worker', render: c => ui.workerLink(c.workerId) }, { label: 'Status', render: c => ui.status('case', c.status) },
      { label: 'Kuota', render: c => c.status === 'CANCELLED' ? ui.badge('Dilepas', 'gray') : isUtilized(c) ? ui.badge('Terpakai', 'green') : ui.badge('Dicadangkan', 'amber') }, { label: 'Pemilik', render: c => ui.userChip(c.ownerId) }] }) });
    // reservations near expiry
    const lim = D.settings.quotaReservationDays;
    const drafts = codeCases(pc).filter(c => c.status === 'DRAFT').map(c => ({ c, age: -fmt.daysFrom(c.createdAt) })).filter(x => x.age >= lim - 3).sort((a, b) => b.age - a.age);
    const releaseCase = async c => { if (!(BGS.domain && BGS.domain.releaseQuota)) { ui.toast('Fitur lepas kuota belum aktif di prototipe ini', 'warn'); return; } const r = await ui.reasonPrompt({ title: `Lepas kuota ${c.id}`, message: 'Kuota yang dicadangkan akan dikembalikan ke Tersedia.', label: 'Alasan', confirmLabel: 'Lepas kuota', tone: 'danger' }); if (!r) return; try { BGS.domain.releaseQuota(c.id, r); syncQuota(); ui.toast('Kuota dilepas'); ctx.refresh(); } catch (e) { ui.toast(e.message, 'danger'); } };
    const expCard = ui.card({ title: 'Cadangan hampir/sudah melewati batas', subtitle: `Case Draf lebih dari ${lim} hari belum diaktifkan (pengaturan sistem)`, icon: 'clock', flush: true, body: ui.table({ rows: drafts, dense: true, empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada cadangan yang hampir kedaluwarsa' }), columns: [
      { label: 'Case', render: x => ui.caseLink(x.c.id) }, { label: 'Dibuat', render: x => fmt.date(x.c.createdAt) },
      { label: 'Umur', render: x => x.age >= lim ? ui.badge(`Lewat ${x.age - lim} hari`, 'red') : ui.badge(`${lim - x.age} hari lagi`, 'amber') },
      { label: '', render: x => canOps() ? ui.btn('Lepas kuota', { sm: true, onClick: () => releaseCase(x.c) }) : null }] }) });
    // waiting list
    const apps = BGS.scope.applications().filter(a => ['SELECTED', 'WAITLISTED'].includes(a.status) && a.country === pc.country && a.profession === pc.profession && !a.caseId)
      .sort((a, b) => String((a.decision && a.decision.at) || a.createdAt).localeCompare(String((b.decision && b.decision.at) || b.createdAt)));
    const canAlloc = BGS.can('case.allocate'); const allocOk = pc.status === 'OPEN' && pc.available > 0;
    const waitCard = ui.card({ title: 'Daftar tunggu (Terpilih & Cadangan)', subtitle: 'Urutan berdasarkan tanggal keputusan (FIFO) — saran saja, bukan aturan wajib (FR-PLC-012)', icon: 'users', flush: true, body: ui.table({ rows: apps, dense: true, empty: ui.emptyState({ icon: 'users', title: 'Tidak ada pelamar menunggu', text: `Belum ada lamaran Terpilih/Cadangan untuk ${D.cn(pc.country)} · ${D.pn(pc.profession)}.` }), columns: [
      { label: 'Saran', render: (a) => h('span', { class: 'badge b-gray', title: 'Saran urutan, bukan aturan' }, '#' + (apps.indexOf(a) + 1)) }, { label: 'Worker', render: a => ui.workerLink(a.workerId) }, { label: 'Lamaran', render: a => ui.appLink(a.id) }, { label: 'Status', render: a => ui.status('application', a.status) }, { label: 'Keputusan', render: a => fmt.date((a.decision && a.decision.at) || a.createdAt) },
      { label: '', render: a => canAlloc ? h('a', { class: 'btn btn-sm btn-primary' + (allocOk ? '' : ' disabled'), href: allocOk ? `#/allocation?app=${a.id}&code=${pc.id}` : null, 'aria-disabled': allocOk ? null : 'true', title: allocOk ? '' : 'Kode penuh atau ditutup', style: allocOk ? '' : 'opacity:.5;pointer-events:none' }, 'Alokasikan') : null }] }) });
    // ledger
    const lg = ledger(pc);
    const legacyRow = (pc.legacyReserved || pc.legacyUtilized) ? [{ at: null, caseId: null, type: 'LEGACY', by: null, note: `Data lama sebelum sistem: ${pc.legacyReserved || 0} dicadangkan, ${pc.legacyUtilized || 0} terpakai` }] : [];
    const ledgerCard = ui.card({ title: 'Buku kuota (ledger)', subtitle: 'Riwayat penambahan, pemakaian, dan pelepasan kuota', icon: 'list', flush: true, body: ui.table({ rows: [...lg, ...legacyRow], dense: true, pageSize: 8, empty: ui.emptyState({ icon: 'list', title: 'Belum ada mutasi kuota' }), columns: [
      { label: 'Tanggal', render: r => r.at ? fmt.date(r.at) : 'Sebelum sistem' }, { label: 'Case', render: r => r.caseId ? ui.caseLink(r.caseId) : '—' },
      { label: 'Jenis', render: r => ui.badge(LTYPE[r.type][0], LTYPE[r.type][1]) }, { label: 'Dampak', render: r => r.type === 'LEGACY' || r.type === 'TOTAL' ? h('span', { class: 'sm' }, r.note) : h('span', { class: 'sm' }, LTYPE[r.type][2]) }, { label: 'Oleh', render: r => r.by ? ui.userChip(r.by) : '—' }] }) });
    const hist = (pc.history || []);
    const histCard = ui.card({ title: 'Riwayat perubahan kode', icon: 'clock', body: hist.length ? ui.timeline(hist.map(x => ({ text: x.text, at: x.at, by: x.by, tone: x.kind === 'TOTAL' ? 'blue' : 'gray' }))) : h('div', { class: 'muted' }, 'Belum ada perubahan Total/status sejak sistem dipakai.') });
    body.appendChild(h('div', { class: 'grid cols-21' }, h('div', { class: 'stack' }, ledgerCard, casesCard, waitCard), h('div', { class: 'stack' }, jobCard, expCard, histCard)));
    el.appendChild(body);
  } });

  // ======================================================================
  // /batches
  // ======================================================================
  const members = b => D.cases.filter(c => c.batchId === b.id);
  const memberActive = b => members(b).filter(caseActive);
  function batchForm(row, ctx) {
    const codes = D.placementCodes.filter(c => c.status !== 'CLOSED' || (row && c.id === row.code));
    const { f } = formModal({
      title: row ? `Ubah batch ${row.id}` : 'Buat batch', cols: 2,
      fields: [
        { name: 'name', label: 'Nama batch', required: true, value: row && row.name, span: 2 },
        { name: 'code', label: 'Placement Code', type: 'select', required: true, options: codes.map(c => [c.id, `${c.id} (Total ${c.total})`]), value: row ? row.code : codes[0] && codes[0].id, readonly: !!row, hint: row ? 'Tidak bisa diganti setelah batch dibuat' : null },
        { name: 'departDate', label: 'Tanggal berangkat', type: 'date', required: true, value: row && row.departDate },
        { name: 'capacity', label: 'Kapasitas (orang)', type: 'number', required: true, value: row ? row.capacity : '', hint: row ? `Minimal ${memberActive(row).length} (jumlah case saat ini)` : 'Biasanya sama dengan Total kuota kode' },
        { name: 'status', label: 'Status', type: 'select', options: [['PLANNED', 'Direncanakan'], ['OPEN', 'Terbuka'], ['CLOSED', 'Ditutup']], value: row ? row.status : 'PLANNED' }],
      wire: f => { if (!row) { const c = getNode(f, 'code').input, cap = getNode(f, 'capacity').input; const set = () => { const pc = D.placementCode(c.value); if (pc) cap.value = pc.total; }; c.addEventListener('change', set); set(); } },
      onSubmit: (v, f) => {
        const cap = parseInt(v.capacity, 10); let bad = false; const min = row ? memberActive(row).length : 0;
        if (!(cap >= 1)) { setErr(f, 'capacity', 'Isi angka minimal 1'); bad = true; } else if (cap < min) { setErr(f, 'capacity', `Sudah ada ${min} case di batch ini`); bad = true; }
        if (D.batches.some(b => b !== row && b.name.trim().toLowerCase() === v.name.trim().toLowerCase())) { setErr(f, 'name', 'Nama batch sudah dipakai'); bad = true; }
        if (bad) return false;
        if (row) { Object.assign(row, { name: v.name.trim(), departDate: v.departDate, capacity: cap, status: v.status }); BGS.audit('Batch diubah', 'Batch', row.id, row.name); }
        else {
          const ym = v.departDate.slice(2, 4) + v.departDate.slice(5, 7); let k = 0, id; do { id = `BT-${ym}-${String.fromCharCode(65 + k++)}`; } while (D.batches.some(b => b.id === id));
          D.batches.push({ id, name: v.name.trim(), code: v.code, departDate: v.departDate, capacity: cap, status: v.status }); const pc = D.placementCode(v.code); if (pc && !pc.batchId) pc.batchId = id; BGS.audit('Batch dibuat', 'Batch', id, v.code);
        }
        ui.toast('Batch disimpan'); ctx.refresh();
      },
    });
  }
  function addCaseDialog(b, ctx, reopen) {
    const cands = D.cases.filter(c => c.placementCodeId === b.code && !c.batchId && caseActive(c));
    const left = b.capacity - memberActive(b).length;
    const picks = new Set();
    const list = cands.length ? h('div', { class: 'stack' }, cands.map(c => h('label', { class: 'row gap-sm', style: 'padding:6px 0;border-bottom:1px dashed var(--line)' }, h('input', { type: 'checkbox', onChange: e => { e.target.checked ? picks.add(c.id) : picks.delete(c.id); } }), h('span', { class: 'mono' }, c.id), (D.worker(c.workerId) || {}).name, ui.status('case', c.status)))) : ui.emptyState({ icon: 'briefcase', title: 'Tidak ada case yang bisa ditambahkan', text: `Semua case ${b.code} sudah punya batch, atau belum ada worker dialokasikan.` });
    const m = ui.modal({ title: `Tambah case ke ${b.name}`, body: h('div', { class: 'stack' }, h('div', { class: 'muted' }, `Sisa kapasitas: ${Math.max(0, left)} dari ${b.capacity}. Hanya case dari ${b.code} tanpa batch yang ditampilkan.`), list),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Tambahkan', { kind: 'primary', disabled: !cands.length, onClick: () => {
        if (!picks.size) { ui.toast('Pilih minimal satu case', 'warn'); return; }
        if (picks.size > left) { ui.toast(`Kapasitas tidak cukup: sisa ${Math.max(0, left)}, dipilih ${picks.size}`, 'danger'); return; }
        picks.forEach(id => { D.case(id).batchId = b.id; BGS.audit('Case dimasukkan ke batch', 'Placement Case', id, b.id); });
        ui.toast(`${picks.size} case ditambahkan ke batch`); m.close(); ctx.refresh(); reopen(); } })] });
  }
  function batchDrawer(b, ctx) {
    const dr = ui.drawer({ title: b.name, size: 'lg', body: h('div') });
    const draw = () => {
      const body = dr.el.querySelector('.drawer-b'); BGS.clear(body);
      const mem = members(b); const act = memberActive(b); const pc = D.placementCode(b.code); const scoped = BGS.scope.cases();
      body.appendChild(h('div', { class: 'stack' },
        ui.kv([['Placement Code', ui.codeLink(b.code)], ['Berangkat', `${fmt.date(b.departDate)} (${fmt.rel(b.departDate)})`], ['Status', ui.status('generic', b.status)], ['Kapasitas', `${act.length} / ${b.capacity} orang`], ['Total kuota kode', pc ? pc.total : '—']], 2),
        ui.progress(fmt.pct(act.length, b.capacity).replace('%', ''), act.length > b.capacity ? 'red' : act.length === b.capacity ? 'green' : 'blue'),
        canOps() && h('div', { class: 'row gap-sm' }, ui.btn('Ubah batch', { icon: 'edit', onClick: () => { dr.close(); batchForm(b, ctx); } }), ui.btn('Tambah case ke batch', { icon: 'plus', kind: 'primary', disabled: b.status === 'CLOSED', title: b.status === 'CLOSED' ? 'Batch sudah ditutup' : '', onClick: () => addCaseDialog(b, ctx, draw) })),
        ui.card({ title: `Case di batch (${mem.length})`, icon: 'briefcase', flush: true, body: ui.table({ rows: mem.filter(c => scoped.includes(c)), dense: true, empty: ui.emptyState({ icon: 'briefcase', title: 'Belum ada case di batch ini' }), columns: [
          { label: 'Case', render: c => ui.caseLink(c.id) }, { label: 'Worker', render: c => ui.workerLink(c.workerId) }, { label: 'Status', render: c => ui.status('case', c.status) },
          { label: '', render: c => canOps() && ['DRAFT', 'IN_PROCESS', 'ON_HOLD'].includes(c.status) ? ui.btn('Keluarkan', { sm: true, onClick: async () => { const r = await ui.reasonPrompt({ title: `Keluarkan ${c.id} dari batch`, label: 'Alasan' }); if (!r) return; c.batchId = null; BGS.audit('Case dikeluarkan dari batch', 'Placement Case', c.id, `${b.id}: ${r}`); ui.toast('Case dikeluarkan dari batch'); draw(); ctx.refresh && 0; } }) : null }] }) })));
    };
    draw();
    return dr;
  }
  BGS.router.add('/batches', { title: 'Batch', roles: ALL, mvp: 2, render(ctx) {
    const el = ctx.el;
    el.appendChild(head({ title: 'Batch keberangkatan', subtitle: 'Pengelompokan worker satu Placement Code untuk jadwal berangkat yang sama.', mvp: 2,
      actions: canOps() ? ui.btn('Buat batch', { kind: 'primary', icon: 'plus', onClick: () => batchForm(null, ctx) }) : ui.btn('Buat batch', { icon: 'lock', disabled: true, title: 'Hanya Superadmin dan Admin yang dapat membuat batch' }) }));
    el.appendChild(ui.card({ flush: true, body: ui.listView({
      items: () => D.batches, search: b => `${b.id} ${b.name} ${b.code}`, searchPlaceholder: 'Cari batch atau kode…',
      filters: [{ key: 'status', label: 'Status', options: [['PLANNED', 'Direncanakan'], ['OPEN', 'Terbuka'], ['CLOSED', 'Ditutup']] }, { key: 'code', label: 'Placement Code', options: D.batches.map(b => b.code).filter((x, i, a) => a.indexOf(x) === i) }],
      onRowClick: b => batchDrawer(b, ctx), sortKey: 'departDate',
      columns: [
        { key: 'name', label: 'Batch', sortable: true, render: b => h('div', null, h('b', null, b.name), h('div', { class: 'muted sm mono' }, b.id)) },
        { label: 'Placement Code', render: b => ui.codeLink(b.code) },
        { key: 'departDate', label: 'Berangkat', sortable: true, render: b => h('div', null, fmt.date(b.departDate), h('div', { class: 'muted sm' }, fmt.rel(b.departDate))) },
        { label: 'Kapasitas vs case', render: b => { const n = memberActive(b).length; return h('div', { style: 'min-width:130px' }, h('div', { class: 'sm' }, `${n} / ${b.capacity} orang`), ui.progress(b.capacity ? Math.round(n / b.capacity * 100) : 0, n > b.capacity ? 'red' : n === b.capacity ? 'green' : 'blue')); } },
        { label: 'Status', render: b => ui.status('generic', b.status) },
        { label: '', render: b => canOps() ? ui.btn('Ubah', { sm: true, icon: 'edit', onClick: () => batchForm(b, ctx) }) : null }],
    }) }));
    if (ctx.query.open) { const b = D.batches.find(x => x.id === ctx.query.open); if (b) setTimeout(() => batchDrawer(b, ctx), 0); }
  } });
})();
