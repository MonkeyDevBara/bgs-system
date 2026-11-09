/* Processing (M06) + PIC (M07) pages: /allocation, /cases, /cases/:id. Business logic lives in BGS.domain (domain.js). */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui;
  const R = BGS.ROLES;
  const DOM = () => BGS.domain;

  BGS.addStyle(`
    .pr-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}
    .pr-note{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--muted)}
    .pr-pick{border:2px solid var(--line);border-radius:12px;padding:14px;background:#fff;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:.12s}
    .pr-pick:hover{border-color:#93C5FD} .pr-pick.on{border-color:var(--teal);background:var(--teal-l)}
    .pr-picks{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}
    .pr-radio{width:18px;height:18px;border-radius:50%;border:2px solid var(--line2);display:inline-flex;align-items:center;justify-content:center;flex:none;background:#fff}
    .on>.pr-radio,.pr-radio.on{border-color:var(--teal);background:var(--teal);color:#fff}
    .pr-tpl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
    .pr-tpl li{display:flex;gap:10px;align-items:flex-start;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:#fff}
    .pr-n{width:24px;height:24px;border-radius:50%;background:var(--navy);color:#fff;font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;flex:none}
    .pr-flow{display:flex;flex-direction:column;gap:0}
    .pr-level{display:flex;gap:14px;align-items:stretch}
    .pr-rail{width:70px;flex:none;display:flex;flex-direction:column;align-items:center}
    .pr-rail b{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:4px}
    .pr-rail i{flex:1;width:2px;background:var(--line2);min-height:12px}
    .pr-level:last-child .pr-rail i{display:none}
    .pr-cards{flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:12px;padding-bottom:16px}
    .pr-step{border:1px solid var(--line);border-left:6px solid var(--line2);border-radius:11px;padding:12px 14px;background:#fff;cursor:pointer;display:flex;flex-direction:column;gap:7px;box-shadow:var(--shadow)}
    .pr-step:hover{box-shadow:0 6px 18px rgba(15,23,42,.12)}
    .pr-step.s-COMPLETED{border-left-color:var(--green)} .pr-step.s-IN_PROGRESS{border-left-color:var(--orange)} .pr-step.s-READY{border-left-color:var(--blue)}
    .pr-step.s-SKIPPED{border-left-color:var(--amber)} .pr-step.s-CANCELLED{border-left-color:var(--red);opacity:.7} .pr-step.s-LOCKED{background:#F8FAFC}
    .pr-step.blocked{border-left-color:var(--red);background:#FEF2F2} .pr-step.late{box-shadow:0 0 0 2px #FCA5A5}
    .pr-step h4{font-size:14px;line-height:1.3}
    .pr-meta{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:#475569}
    .pr-meta .ico{margin-right:4px;color:#64748B}
    .pr-chk{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px dashed var(--line)}
    .pr-chk:last-child{border-bottom:0} .pr-chk .ico{margin-top:2px;flex:none}
    .pr-ok{color:var(--green)} .pr-no{color:var(--red)}
    .pr-quota{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center}
    .pr-quota div{border:1px solid var(--line);border-radius:10px;padding:8px}
    .pr-quota b{display:block;font-size:20px} .pr-quota span{font-size:11.5px;color:var(--muted);font-weight:700;text-transform:uppercase}
    @media(max-width:600px){.pr-level{flex-direction:column;gap:4px}.pr-rail{width:auto;flex-direction:row;gap:8px}.pr-rail i{display:none}.pr-quota{grid-template-columns:repeat(2,1fr)}}
  `);

  // ---------- shared helpers ----------
  const attempt = (fn, ok, after) => {
    try { const r = fn(); if (ok) ui.toast(typeof ok === 'function' ? ok(r) : ok); if (after) after(r); return r; }
    catch (e) { ui.toast(e.message, 'danger'); return undefined; }
  };
  const canOps = () => BGS.can('case.allocate');
  const name = id => (D.user(id) || {}).name || '—';
  const workerName = id => (D.worker(id) || {}).name || id;
  const tplOf = c => D.template(c.templateId);
  const ctry = c => `${D.cn(c.country)} · ${D.pn(c.profession)}`;
  const stepName = (c, id) => { const i = c.steps.find(x => x.stepId === id); return i ? i.name : id; };
  const lockNote = text => h('div', { class: 'pr-note' }, BGS.icon('lock', 14), text);
  const tone = t => (['green', 'blue', 'red', 'amber', 'gray'].includes(t) ? t : t === 'teal' ? 'green' : 'blue');
  const userOptions = role => D.users.filter(u => u.active && (role === 'Case Owner' ? (u.roles.includes('admin') || u.roles.includes('superadmin')) : (u.roles.includes('pic') || u.roles.includes('admin') || u.roles.includes('superadmin'))))
    .map(u => [u.id, `${u.name} — ${u.picRole || BGS.roles[u.roles[0]]}`]);
  const select = (opts, value, onChange, extra) => h('select', Object.assign({ class: 'input', onChange: e => onChange(e.target.value) }, extra || {}), opts.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
  const labeled = (label, node, hint) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label), node, hint && h('span', { class: 'hint' }, hint));
  const stepBadges = s => [
    s.required ? ui.badge('Wajib', 'blue') : ui.badge('Opsional', 'gray'),
    s.external && ui.badge('Eksternal · perlu no. ref + bukti', 'amber', { title: 'BR-033' }),
    s.verification === 'VERIFY' && ui.badge('Verifikasi', 'purple'), s.verification === 'APPROVE' && ui.badge('Verifikasi + Approval', 'pink'),
    s.consumesQuota && ui.badge('Memakai kuota', 'teal', { title: 'RUL-007: kuota berpindah Dicadangkan → Terpakai saat langkah ini selesai' }),
  ];
  const openTask = (taskId, onChange) => { if (typeof BGS.taskDrawer === 'function') BGS.taskDrawer(taskId, { onChange }); else fallbackTask(taskId, onChange); };

  // ====================== fallback task modal (used only if BGS.taskDrawer is not defined) ======================
  function fallbackTask(taskId, onChange) {
    const t = D.task(taskId); if (!t) { ui.toast('Tugas tidak ditemukan', 'danger'); return; }
    const body = h('div', { class: 'stack' }), foot = h('div', { class: 'row wrap gap-sm' });
    ui.modal({ title: `Tugas ${t.id}`, size: 'md', body, footer: foot, onClose: () => onChange && onChange() });
    const draw = () => {
      BGS.clear(body); BGS.clear(foot);
      const c = D.case(t.caseId), s = DOM().tplStep(c, t.stepId) || {};
      const file = h('input', { class: 'input', placeholder: 'Nama file bukti, mis. bukti-sisko.pdf' }), ref = h('input', { class: 'input', placeholder: 'Nomor referensi sistem luar' });
      const act = (action, payload, msg) => attempt(() => DOM().taskAction(t.id, action, payload), msg, draw);
      body.append(
        ui.kv([['Langkah', t.title], ['Case', ui.caseLink(c.id)], ['Status tugas', ui.status('task', t.status)], ['Pelaksana', ui.userChip(t.assigneeId)], ['Verifier', t.verifierId ? ui.userChip(t.verifierId) : 'Tidak perlu'], ['Approver', t.approverId ? ui.userChip(t.approverId) : 'Tidak perlu'], ['Tenggat', BGS.fmt.date(t.dueAt)], ['No. referensi', t.refNumber || (DOM().stepInstance(c, t.stepId) || {}).refNumber]]),
        h('div', { class: 'row wrap gap-sm' }, stepBadges(s)),
        t.blockedReason && ui.callout('danger', 'Terhambat', t.blockedReason),
        t.rejectReason && t.status === 'REJECTED' && ui.callout('warn', 'Ditolak — perlu perbaikan', t.rejectReason),
        h('div', null, h('b', null, 'Bukti'), t.evidence.length ? h('ul', null, t.evidence.map(e => h('li', null, `${e.name} · ${BGS.fmt.dateTime(e.at)} · ${name(e.by)}`))) : h('div', { class: 'muted sm' }, 'Belum ada bukti.')),
        ['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'REJECTED'].includes(t.status) && BGS.can('task.execute') && h('div', { class: 'form-grid cols-2' }, labeled('File bukti', file), labeled('Nomor referensi' + (t.external ? ' (wajib, BR-033)' : ''), ref)));
      const b = (label, kind, fn, perm, icon) => foot.appendChild(ui.btn(label, { kind, icon, disabled: !BGS.can(perm), title: BGS.can(perm) ? '' : 'Peran Anda tidak memiliki izin', onClick: fn }));
      const st = t.status;
      if (['TODO', 'REJECTED'].includes(st)) b('Mulai', 'primary', () => act('start', {}, 'Tugas dimulai'), 'task.execute', 'play');
      if (['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'REJECTED'].includes(st)) b('Simpan bukti', '', () => act('submit_evidence', { file: file.value, refNumber: ref.value }, 'Bukti dicatat'), 'task.execute', 'upload');
      if (st === 'IN_PROGRESS' && s.external) b('Menunggu bukti', '', () => act('wait_evidence', {}, 'Ditandai menunggu bukti'), 'task.execute');
      if (st === 'IN_PROGRESS') b(s.verification === 'NONE' ? 'Tandai selesai' : 'Minta verifikasi', 'good', () => act(s.verification === 'NONE' ? 'complete' : 'request_verification', {}, s.verification === 'NONE' ? 'Tugas selesai' : 'Verifikasi diminta'), 'task.execute', 'check');
      if (st === 'PENDING_VERIFICATION') b('Verifikasi', 'good', () => act('verify', {}, 'Terverifikasi'), 'task.verify', 'check');
      if (st === 'PENDING_APPROVAL') b('Setujui', 'good', () => act('approve', {}, 'Disetujui'), 'task.approve', 'check');
      if (['PENDING_VERIFICATION', 'PENDING_APPROVAL'].includes(st)) b('Tolak', 'danger', async () => { const r = await ui.reasonPrompt({ title: 'Tolak tugas', label: 'Alasan penolakan', confirmLabel: 'Tolak', tone: 'danger' }); if (r) act('reject', { reason: r }, 'Tugas ditolak'); }, st === 'PENDING_APPROVAL' ? 'task.approve' : 'task.verify', 'x');
      if (['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'REJECTED'].includes(st)) b('Terhambat', 'warn', async () => { const r = await ui.reasonPrompt({ title: 'Tandai terhambat', label: 'Penyebab hambatan', presets: ['Menunggu pihak eksternal', 'Dokumen kurang', 'Menunggu worker'], confirmLabel: 'Tandai' }); if (r) act('block', { category: 'Lainnya', reason: r }, 'Ditandai terhambat'); }, 'task.execute', 'alert');
      if (st === 'BLOCKED') b('Hambatan selesai', 'primary', () => act('unblock', {}, 'Hambatan diselesaikan'), 'task.execute');
    };
    draw();
  }

  // ====================== /allocation ======================
  function renderAllocation(ctx) {
    const root = ctx.el;
    const st = { step: 0, appId: null, codeId: null, ownerId: null, pics: null, planned: '', batchId: undefined, created: null };
    const appsOk = () => D.applications.filter(a => ['SELECTED', 'WAITLISTED'].includes(a.status)).sort((a, b) => (a.status === b.status ? ((a.decision || {}).at || '').localeCompare((b.decision || {}).at || '') : a.status === 'SELECTED' ? -1 : 1));
    if (ctx.query.app) {
      const a = D.application(ctx.query.app);
      if (a && ['SELECTED', 'WAITLISTED'].includes(a.status)) { st.appId = a.id; st.step = 1; }
    }
    const app = () => D.application(st.appId), code = () => D.placementCode(st.codeId);
    const host = h('div', { class: 'stack' });
    root.append(ui.pageHeader({ title: 'Alokasi penempatan', mvp: 2, breadcrumbs: [{ label: 'Pemrosesan' }, { label: 'Alokasi' }], subtitle: 'Hubungkan lamaran yang lolos seleksi ke Placement Code. Saat dikonfirmasi, sistem membuat Placement Case (Draf) dan mencadangkan 1 kuota.' }), host);
    if (!BGS.can('case.allocate')) { host.appendChild(ui.callout('warn', 'Hanya baca', 'Hanya Admin dan Superadmin yang dapat membuat alokasi.')); return; }

    const initPics = () => {
      const owner = st.ownerId || (BGS.user().roles.some(r => ['admin', 'superadmin'].includes(r)) ? BGS.user().id : 'U04');
      st.ownerId = owner; st.pics = DOM().defaultPics(owner);
      const o = D.placementCode(st.codeId); const b = o && o.batchId ? D.batches.find(x => x.id === o.batchId) : null;
      st.batchId = o ? o.batchId : null; st.planned = (b && b.departDate) || BGS.addDays(BGS.today, 60).toISOString().slice(0, 10);
    };

    const nav = (back, next) => h('div', { class: 'form-actions' }, back, next);
    const stepper = () => ui.stepper(['Pilih lamaran', 'Pilih Placement Code', 'Tinjau & PIC', 'Konfirmasi'], st.step);

    // ----- step 0
    function stepApp() {
      const items = () => appsOk();
      const blocked = a => DOM().activeCaseOfWorker(a.workerId);
      const lv = ui.listView({
        items, pageSize: 8, searchPlaceholder: 'Cari nama worker atau ID lamaran…', search: a => `${workerName(a.workerId)} ${a.id} ${D.cn(a.country)} ${D.pn(a.profession)}`,
        filters: [{ key: 'status', label: 'Status', options: [['SELECTED', 'Terpilih'], ['WAITLISTED', 'Cadangan']] }, { key: 'country', label: 'Negara', options: D.countries.map(c => [c.code, c.name]) }],
        rowClass: a => (blocked(a) ? '' : st.appId === a.id ? 'row-warn' : ''),
        onRowClick: a => { const bl = blocked(a); if (bl) { ui.toast(`Worker ini masih punya case aktif ${bl.id} (RUL-009)`, 'warn'); return; } st.appId = a.id; st.codeId = null; lv.redraw(); btn.disabled = false; },
        columns: [
          { label: '', width: '36px', render: a => h('span', { class: 'pr-radio' + (st.appId === a.id ? ' on' : '') }, st.appId === a.id ? BGS.icon('check', 12) : null) },
          { label: 'Worker', render: a => h('div', null, ui.workerLink(a.workerId), h('div', { class: 'muted xs mono' }, a.id)) },
          { label: 'Tujuan', render: a => `${D.cn(a.country)} · ${D.pn(a.profession)}` },
          { label: 'Jalur', render: a => (D.routes.find(r => r.id === a.route) || {}).name || a.route },
          { label: 'Status', render: a => ui.status('application', a.status) },
          { label: 'Keputusan seleksi', render: a => (a.decision ? BGS.fmt.date(a.decision.at) : '—') },
          { label: 'Catatan', render: a => { const bl = blocked(a); return bl ? ui.badge('Sudah punya case ' + bl.id, 'red', { title: 'RUL-009' }) : a.status === 'WAITLISTED' ? ui.badge('Menunggu kuota', 'amber') : ui.badge('Siap dialokasikan', 'green'); } },
        ],
        empty: ui.emptyState({ icon: 'clipboard', title: 'Belum ada lamaran yang siap dialokasikan', text: 'Lamaran harus berstatus Terpilih atau Cadangan lebih dulu di menu Lamaran & seleksi.', action: h('a', { class: 'btn btn-primary', href: '#/applications' }, 'Buka lamaran & seleksi') }),
      });
      const btn = ui.btn('Lanjut: pilih Placement Code', { kind: 'primary', icon: 'arrow-right', disabled: !st.appId, onClick: () => { if (st.appId) { st.step = 1; draw(); } } });
      return h('div', { class: 'stack' },
        ui.callout('info', 'Kuota hanya berkurang saat alokasi (RUL-004, RUL-005)', 'Registrasi dan lamaran tidak memakai kuota. Kuota baru dicadangkan ketika Placement Case dibuat, dan hanya jika Tersedia ≥ 1.'),
        ui.card({ title: 'Langkah 1 — Pilih lamaran', subtitle: 'Hanya lamaran Terpilih atau Cadangan (RUL-010). Satu worker hanya boleh punya satu case aktif (RUL-009).', flush: true, body: lv }),
        nav(null, btn));
    }

    // ----- step 1
    function stepCode() {
      const a = app(); const opts = DOM().codeOptions(a.id);
      const eligible = opts.filter(o => o.ok), relevant = opts.filter(o => !o.ok && o.code.country === a.country && o.code.profession === a.profession), hidden = opts.length - eligible.length - relevant.length;
      const cards = eligible.map(o => {
        const pc = o.code, jo = D.jobOrder(pc.jobOrderId), pt = jo && D.partner(jo.partnerId), b = pc.batchId && D.batches.find(x => x.id === pc.batchId);
        return h('div', { class: 'pr-pick' + (st.codeId === pc.id ? ' on' : ''), onClick: () => { st.codeId = pc.id; st.pics = null; draw(); } },
          h('div', { class: 'row between' }, h('b', { class: 'mono' }, pc.id), h('span', { class: 'pr-radio' + (st.codeId === pc.id ? ' on' : '') }, st.codeId === pc.id ? BGS.icon('check', 12) : null)),
          h('div', { class: 'muted sm' }, `${pt ? pt.name : '—'} · ${jo ? jo.id : '—'}`),
          h('div', { class: 'muted sm' }, b ? `Batch: ${b.name} · berangkat ${BGS.fmt.date(b.departDate)}` : 'Belum ada batch'),
          ui.quotaBar(pc),
          h('div', { class: 'row between sm' }, h('span', null, 'Total ', h('b', null, pc.total), ' · Terpakai ', h('b', null, pc.utilized), ' · Cadangan ', h('b', null, pc.reserved)), ui.badge(`Tersedia ${pc.available}`, pc.available <= 2 ? 'amber' : 'green')));
      });
      const next = ui.btn('Lanjut: tinjau & PIC', { kind: 'primary', icon: 'arrow-right', disabled: !st.codeId, onClick: () => { if (!st.pics) initPics(); st.step = 2; draw(); } });
      return h('div', { class: 'stack' },
        ui.card({ title: 'Langkah 2 — Pilih Placement Code', subtitle: `${workerName(a.workerId)} · ${D.cn(a.country)} · ${D.pn(a.profession)} · ${a.status === 'WAITLISTED' ? 'Cadangan' : 'Terpilih'}`, body: h('div', { class: 'stack' },
          eligible.length ? h('div', { class: 'pr-picks' }, cards) : ui.emptyState({ icon: 'layers', title: 'Belum ada Placement Code yang bisa dipakai', text: 'Tidak ada kode OPEN dengan negara & profesi yang sama dan kuota Tersedia ≥ 1. Lamaran tetap berstatus ' + (a.status === 'WAITLISTED' ? 'Cadangan' : 'Terpilih') + ' (masuk daftar tunggu) sampai ada kuota atau kode baru dibuka (RUL-005).', action: h('a', { class: 'btn', href: '#/placement-codes' }, 'Lihat Placement Code & kuota') }),
          eligible.length ? h('div', { class: 'pr-note' }, BGS.icon('info', 14), `Kuota akan dicadangkan 1 pada kode yang dipilih; Terpakai baru bertambah saat langkah "Penandatanganan Perjanjian Penempatan" selesai (RUL-007).`) : null) }),
        relevant.length || hidden ? ui.card({ title: 'Kode yang tidak bisa dipilih', subtitle: hidden ? `${hidden} kode lain berbeda negara/profesi tidak ditampilkan.` : undefined, body: relevant.length ? h('ul', { class: 'stack-sm', style: 'margin:0;padding-left:18px' }, relevant.map(o => h('li', null, h('b', { class: 'mono' }, o.code.id), ' — ', h('span', { class: 'muted' }, o.reason)))) : h('div', { class: 'muted' }, 'Tidak ada kode lain untuk negara & profesi ini.') }) : null,
        nav(ui.btn('Kembali', { icon: 'chevron-left', onClick: () => { st.step = 0; draw(); } }), next));
    }

    // ----- step 2
    function stepReview() {
      const a = app(), pc = code(); const rt = DOM().resolveTemplate(a.id, pc.id);
      const picsSel = Object.keys(st.pics).map(role => labeled(role + (role === 'Case Owner' ? ' (tepat satu, RUL-019)' : ''), select([['', '— pilih —']].concat(userOptions(role)), st.pics[role] || '', v => { st.pics[role] = v || null; if (role === 'Case Owner') st.ownerId = v; })));
      const stepsNode = rt ? h('ol', { class: 'pr-tpl' }, rt.ver.steps.map((s, i) => h('li', null, h('span', { class: 'pr-n' }, i + 1), h('div', { class: 'grow' }, h('b', null, s.name), h('div', { class: 'row wrap gap-sm', style: 'margin-top:4px' }, stepBadges(s), ui.badge(D.picByStepRole[s.role], 'gray'), ui.badge(`${s.dueDays} hari`, 'gray')), s.pred.length ? h('div', { class: 'muted xs', style: 'margin-top:3px' }, 'Setelah: ' + s.pred.map(p => (rt.ver.steps.find(x => x.id === p) || {}).name).join(', ')) : h('div', { class: 'muted xs', style: 'margin-top:3px' }, 'Langkah awal')))) ) : ui.callout('danger', 'Template tidak ditemukan', 'Belum ada template PUBLISHED (RUL-011).');
      const date = h('input', { class: 'input', type: 'date', value: st.planned, onChange: e => (st.planned = e.target.value) });
      const batchOpts = [['', '— tanpa batch —']].concat(D.batches.map(b => [b.id, `${b.name} (${BGS.fmt.date(b.departDate)})`]));
      const batchSel = select(batchOpts, st.batchId || '', v => { st.batchId = v || null; const b = D.batches.find(x => x.id === v); if (b) { st.planned = b.departDate; date.value = b.departDate; } });
      const next = ui.btn('Lanjut: konfirmasi', { kind: 'primary', icon: 'arrow-right', onClick: () => {
        if (!st.ownerId) { ui.toast('Pilih Case Owner terlebih dahulu', 'warn'); return; }
        if (Object.entries(st.pics).some(([r, u]) => !u && r !== 'Case Owner')) { ui.toast('Isi semua PIC Role terlebih dahulu', 'warn'); return; }
        if (!st.planned || new Date(st.planned) < BGS.today) { ui.toast('Tanggal rencana berangkat harus hari ini atau setelahnya', 'warn'); return; }
        st.step = 3; draw();
      } });
      return h('div', { class: 'stack' },
        h('div', { class: 'grid cols-21' },
          ui.card({ icon: 'git-branch', title: 'Workflow yang akan dipakai', subtitle: rt ? `${rt.tpl.name} · versi v${rt.ver.v} (PUBLISHED) — terkunci ke case ini (RUL-012)` : '', body: stepsNode }),
          h('div', { class: 'stack' },
            ui.card({ icon: 'users', title: 'Penanggung jawab (PIC)', subtitle: 'Case Owner dipilih dari Admin. PIC lain bisa diubah nanti di tab PIC.', body: h('div', { class: 'stack' }, picsSel) }),
            ui.card({ icon: 'calendar', title: 'Jadwal', body: h('div', { class: 'stack' }, labeled('Batch', batchSel, 'Opsional. Memilih batch mengisi tanggal otomatis.'), labeled('Rencana keberangkatan', date, 'Dipakai pada pengecekan masa berlaku dokumen (RUL-018).')) }))),
        nav(ui.btn('Kembali', { icon: 'chevron-left', onClick: () => { st.step = 1; draw(); } }), next));
    }

    // ----- step 3
    function stepConfirm() {
      const a = app(), pc = code(), rt = DOM().resolveTemplate(a.id, pc.id); const chk = DOM().canAllocate(a.id, pc.id);
      const go = ui.btn('Alokasikan & cadangkan kuota', { kind: 'good', icon: 'check', disabled: !chk.ok, onClick: () => {
        const c = attempt(() => DOM().allocate(a.id, pc.id, { ownerId: st.ownerId, pics: st.pics, plannedDeparture: st.planned, batchId: st.batchId || null }), null);
        if (c) { st.created = c; ui.toast(`Case ${c.id} dibuat · kuota dicadangkan 1`); draw(); }
      } });
      return h('div', { class: 'stack' },
        !chk.ok && ui.callout('danger', 'Alokasi tidak dapat dilanjutkan', chk.reason),
        ui.card({ title: 'Langkah 4 — Konfirmasi', subtitle: 'Periksa ringkasan sebelum membuat Placement Case.', body: h('div', { class: 'stack' },
          ui.kv([['Worker', ui.workerLink(a.workerId)], ['Lamaran', ui.appLink(a.id)], ['Tujuan', `${D.cn(a.country)} · ${D.pn(a.profession)}`], ['Placement Code', ui.codeLink(pc.id)], ['Template', rt ? `${rt.tpl.name} v${rt.ver.v}` : '—'], ['Case Owner', ui.userChip(st.ownerId)], ['Rencana berangkat', BGS.fmt.date(st.planned)], ['Batch', st.batchId ? (D.batches.find(b => b.id === st.batchId) || {}).name : '—']], 2),
          h('div', { class: 'row wrap gap-sm' }, Object.entries(st.pics).filter(([r]) => r !== 'Case Owner').map(([r, u]) => h('span', { class: 'chip static' }, `${r}: ${name(u)}`))),
          ui.callout('good', 'Dampak pada kuota', `Reserved ${pc.reserved} → ${pc.reserved + 1} · Tersedia ${pc.available} → ${pc.available - 1}. Case dibuat berstatus Draf; aktifkan dari halaman case agar langkah dapat dikerjakan.`)) }),
        nav(ui.btn('Kembali', { icon: 'chevron-left', onClick: () => { st.step = 2; draw(); } }), go));
    }

    function success() {
      const c = st.created, pc = D.placementCode(c.placementCodeId);
      return ui.card({ body: h('div', { class: 'stack', style: 'align-items:center;text-align:center;padding:14px' },
        h('div', { style: 'color:var(--green)' }, BGS.icon('check-circle', 54)),
        h('h2', null, 'Alokasi berhasil'),
        h('p', { class: 'muted' }, `${workerName(c.workerId)} sekarang punya Placement Case `, ui.caseLink(c.id), ' (Draf).'),
        ui.callout('good', 'Kuota dicadangkan 1', `${pc.id}: Total ${pc.total} · Terpakai ${pc.utilized} · Dicadangkan ${pc.reserved} · Tersedia ${pc.available}. Kuota otomatis dilepas bila case dibatalkan sebelum terpakai (RUL-007).`),
        h('div', { class: 'row wrap gap-sm', style: 'justify-content:center' },
          h('a', { class: 'btn btn-primary', href: '#/cases/' + c.id }, 'Buka case & aktifkan'),
          ui.btn('Alokasikan lamaran lain', { onClick: () => { Object.assign(st, { step: 0, appId: null, codeId: null, ownerId: null, pics: null, created: null }); history.replaceState(null, '', '#/allocation'); draw(); } }),
          h('a', { class: 'btn', href: '#/placement-codes/' + pc.id }, 'Lihat kuota kode'))) });
    }

    function draw() {
      BGS.clear(host);
      if (st.created) { host.appendChild(ui.stepper(['Pilih lamaran', 'Pilih Placement Code', 'Tinjau & PIC', 'Konfirmasi'], 4)); host.appendChild(success()); return; }
      host.appendChild(stepper());
      try { host.appendChild([stepApp, stepCode, stepReview, stepConfirm][st.step]()); } catch (e) { console.error(e); host.appendChild(ui.callout('danger', 'Terjadi kesalahan', e.message)); }
      window.scrollTo(0, 0);
    }
    draw();
  }

  // ====================== /cases ======================
  function renderCases(ctx) {
    const all = BGS.scope.cases();
    const cnt = s => all.filter(c => c.status === s).length;
    const overdue = all.filter(c => DOM().isCaseOverdue(c)).length;
    const kpis = [['Draf', 'DRAFT', 'gray', 'file'], ['Diproses', 'IN_PROCESS', 'orange', 'activity'], ['Verifikasi akhir', 'FINAL_VERIFICATION', 'pink', 'shield'], ['Siap berangkat', 'READY_TO_DEPART', 'teal', 'plane'], ['Ditahan', 'ON_HOLD', 'amber', 'pause'], ['Berangkat', 'DEPARTED', 'green', 'flag']];
    const lv = ui.listView({
      items: () => BGS.scope.cases().slice().sort((a, b) => b.id.localeCompare(a.id)), pageSize: 10, searchPlaceholder: 'Cari ID case, worker, atau kode…',
      search: c => `${c.id} ${workerName(c.workerId)} ${c.placementCodeId} ${(D.user(c.ownerId) || {}).name || ''}`,
      filters: [
        { key: 'status', label: 'Status', options: Object.entries(BGS.ST.case).map(([k, v]) => [k, v[0]]) },
        { key: 'country', label: 'Negara', options: D.countries.map(c => [c.code, c.name]) },
        { key: 'ownerId', label: 'Case Owner', options: Array.from(new Set(D.cases.map(c => c.ownerId))).map(id => [id, name(id)]) },
        { key: 'late', label: 'Keterlambatan', options: [['yes', 'Terlambat'], ['no', 'Tepat waktu']], match: (c, v) => (v === 'yes') === DOM().isCaseOverdue(c) },
      ],
      onRowClick: c => ctx.go('/cases/' + c.id),
      toolbar: [BGS.can('export') && ui.btn('Ekspor CSV', { icon: 'download', sm: true, onClick: () => BGS.exportCsv(BGS.scope.cases(), [{ label: 'Case', key: 'id' }, { label: 'Worker', value: c => workerName(c.workerId) }, { label: 'Kode', key: 'placementCodeId' }, { label: 'Status', value: c => BGS.ST.case[c.status][0] }, { label: 'Case Owner', value: c => name(c.ownerId) }, { label: 'Rencana berangkat', key: 'plannedDeparture' }], 'placement-case.csv') })],
      columns: [
        { label: 'Case', render: c => h('div', { class: 'nowrap' }, ui.caseLink(c.id), h('div', { class: 'muted xs' }, ctry(c))) },
        { label: 'Worker', render: c => h('span', { class: 'nowrap' }, ui.workerLink(c.workerId)) },
        { label: 'Kode', render: c => h('span', { class: 'nowrap' }, ui.codeLink(c.placementCodeId)) },
        { label: 'Template', render: c => h('span', { class: 'row gap-sm nowrap' }, h('span', { class: 'sm' }, (tplOf(c) || {}).name || '—'), ui.badge('v' + c.templateVersion, 'purple')) },
        { label: 'Status', render: c => h('div', { class: 'stack-sm' }, ui.status('case', c.status), (c.blockers || []).length ? ui.badge('Terhambat', 'red') : null) },
        { label: 'Case Owner', render: c => ui.userChip(c.ownerId) },
        { label: 'Progres', render: c => { const p = DOM().progress(c); return h('div', { class: 'row gap-sm', style: 'min-width:120px' }, h('div', { style: 'flex:1' }, ui.progress(p.pct, c.status === 'DEPARTED' ? 'green' : 'orange', p.pct + '%')), h('span', { class: 'xs muted nowrap' }, `${p.done}/${p.total}`)); } },
        { label: 'Rencana berangkat', render: c => h('div', null, BGS.fmt.date(c.plannedDeparture), h('div', { class: 'muted xs' }, c.status === 'DEPARTED' ? 'sudah berangkat' : BGS.fmt.rel(c.plannedDeparture))) },
        { label: '', render: c => (DOM().isCaseOverdue(c) ? ui.badge('Terlambat', 'red', { title: 'RUL-028' }) : null) },
      ],
      empty: ui.emptyState({ icon: 'briefcase', title: BGS.scope.isLimited() ? 'Belum ada case yang ditugaskan ke Anda' : 'Belum ada Placement Case', text: BGS.scope.isLimited() ? 'PIC hanya melihat case yang ditugaskan kepadanya (RUL-020).' : 'Case dibuat lewat menu Alokasi penempatan.', action: BGS.can('case.allocate') ? h('a', { class: 'btn btn-primary', href: '#/allocation' }, 'Buat alokasi') : null }),
    });
    ctx.el.append(
      ui.pageHeader({ title: 'Placement Case', mvp: 2, breadcrumbs: [{ label: 'Pemrosesan' }, { label: 'Placement Case' }], subtitle: BGS.scope.isLimited() ? 'Menampilkan case yang ditugaskan kepada Anda saja (RUL-020).' : 'Satu worker, satu proses terkendali. Pantau progres langkah, PIC, dan keterlambatan.', actions: BGS.can('case.allocate') ? h('a', { class: 'btn btn-primary', href: '#/allocation' }, BGS.icon('plus', 16), 'Alokasi baru') : null }),
      h('div', { class: 'pr-kpis' }, kpis.map(([l, s, t, i]) => ui.kpi({ label: l, value: cnt(s), tone: t, icon: i, href: '/cases?status=' + s })), ui.kpi({ label: 'Terlambat', value: overdue, tone: 'red', icon: 'alert', sub: 'RUL-028', href: '/cases?late=yes' })),
      ui.card({ flush: true, body: lv }));
    const sels = BGS.$$('select', lv); const keys = ['status', 'country', 'ownerId', 'late'];
    keys.forEach((k, i) => { const v = ctx.query[k]; if (v && sels[i]) { sels[i].value = v; sels[i].dispatchEvent(new Event('change')); } });
  }

  // ====================== /cases/:id ======================
  const lastTab = {};
  function renderCase(ctx) {
    const c = D.case(ctx.params.id);
    if (!c) { ctx.el.append(ui.pageHeader({ title: 'Case tidak ditemukan', breadcrumbs: [{ label: 'Placement Case', href: '/cases' }] }), ui.emptyState({ icon: 'search', title: 'Case tidak ditemukan', text: `ID ${ctx.params.id} tidak ada di sistem.`, action: h('a', { class: 'btn btn-primary', href: '#/cases' }, 'Kembali ke daftar case') })); return; }
    if (BGS.scope.isLimited() && !BGS.scope.cases().includes(c)) { ctx.el.append(ui.pageHeader({ title: c.id }), ui.emptyState({ icon: 'lock', title: 'Case ini tidak ditugaskan kepada Anda', text: 'PIC hanya dapat membuka case yang ditugaskan kepadanya (RUL-020).', action: h('a', { class: 'btn btn-primary', href: '#/cases' }, 'Kembali ke daftar case') })); return; }
    const refresh = ctx.refresh; const w = D.worker(c.workerId), tpl = tplOf(c), app = D.application(c.applicationId), pc = D.placementCode(c.placementCodeId), jo = D.jobOrder(c.jobOrderId);
    const terminal = ['CANCELLED', 'DEPARTED'].includes(c.status);

    // ----- header actions (case-level, reason mandatory: RUL-022)
    const actions = [];
    if (canOps()) {
      if (c.status === 'DRAFT') actions.push(ui.btn('Aktifkan case', { kind: 'primary', icon: 'play', onClick: () => attempt(() => DOM().activate(c.id), 'Case diaktifkan — langkah awal dibuka', refresh) }));
      if (['IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART'].includes(c.status)) actions.push(ui.btn('Tahan case', { kind: 'warn', icon: 'pause', onClick: async () => { const r = await ui.reasonPrompt({ title: 'Tahan case', message: 'Tugas tidak bisa dikerjakan selama case ditahan. Kuota tetap tercatat.', label: 'Alasan menahan', presets: ['Menunggu perpanjangan paspor', 'Worker sakit', 'Menunggu keputusan partner'], confirmLabel: 'Tahan case' }); if (r) attempt(() => DOM().hold(c.id, r), 'Case ditahan', refresh); } }));
      if (c.status === 'ON_HOLD') actions.push(ui.btn('Lanjutkan case', { kind: 'good', icon: 'play', onClick: async () => { const r = await ui.reasonPrompt({ title: 'Lanjutkan case', label: 'Alasan melanjutkan', presets: ['Kendala sudah selesai'], confirmLabel: 'Lanjutkan' }); if (r) attempt(() => DOM().resume(c.id, r), 'Case dilanjutkan', refresh); } }));
      if (DOM().ACTIVE.includes(c.status)) actions.push(ui.btn('Batalkan case', { kind: 'danger', icon: 'x-circle', onClick: () => cancelFlow() }));
    }
    function cancelFlow() {
      const util = DOM().isUtilized(c);
      ui.reasonPrompt({ title: util ? 'Ajukan pembatalan (kuota sudah Terpakai)' : 'Batalkan case', message: util ? 'Kuota sudah Terpakai. Pembatalan tidak langsung dijalankan: sistem membuat permintaan Revert kuota yang harus disetujui Director (RUL-007).' : 'Kuota yang dicadangkan akan dilepas dan lamaran kembali ke daftar siap alokasi.', label: 'Alasan pembatalan', presets: ['Worker mengundurkan diri', 'Dokumen tidak memenuhi syarat', 'Job Order dibatalkan partner'], confirmLabel: util ? 'Ajukan ke Director' : 'Batalkan case', tone: 'danger' })
        .then(r => { if (r) attempt(() => DOM().cancelCase(c.id, r), res => (res.type === 'REVERT_KUOTA' ? `Permintaan Revert kuota ${res.id} dikirim ke Director` : 'Case dibatalkan · kuota dilepas'), refresh); });
    }

    ctx.el.append(ui.pageHeader({
      title: [c.id, ' ', ui.status('case', c.status)], breadcrumbs: [{ label: 'Placement Case', href: '/cases' }, { label: c.id }], mvp: 2,
      subtitle: `${workerName(c.workerId)} · ${ctry(c)}`,
      actions: actions.length ? actions : (BGS.can('case.allocate') ? null : lockNote('Hanya Admin/Superadmin yang bisa mengubah status case.')),
    }));
    if (c.status === 'ON_HOLD') ctx.el.append(ui.callout('warn', 'Case sedang ditahan', c.onHoldReason || 'Tanpa alasan tercatat.'));
    if (c.status === 'CANCELLED') ctx.el.append(ui.callout('danger', 'Case dibatalkan', `${c.cancelReason || 'Tanpa alasan tercatat'} — kuota sudah dilepas.`));
    if ((c.blockers || []).length && !terminal) ctx.el.append(ui.callout('danger', `${c.blockers.length} hambatan aktif`, c.blockers.map(b => `${stepName(c, b.stepId)}: ${b.reason} (${b.category})`).join(' · ')));
    if (c.status === 'DRAFT') ctx.el.append(ui.callout('info', 'Case masih Draf', 'Kuota sudah dicadangkan, tetapi langkah & tugas belum bisa dikerjakan. Klik "Aktifkan case" untuk membuka langkah awal (RUL-011, RUL-014).'));

    ctx.el.append(ui.card({ body: ui.kv([
      ['Worker', w ? ui.workerLink(w.id) : '—'], ['Lamaran', ui.appLink(c.applicationId)], ['Placement Code', ui.codeLink(c.placementCodeId)],
      ['Job Order', jo ? ui.link(jo.id, '/job-orders/' + jo.id, 'lnk mono') : '—'],
      ['Template', h('span', { class: 'row gap-sm' }, tpl ? ui.link(tpl.name, '/workflows/' + tpl.id) : '—', ui.badge('v' + c.templateVersion, 'purple', { title: 'Versi terkunci (RUL-012)' }))],
      ['Case Owner', ui.userChip(c.ownerId)],
      ['Rencana berangkat', h('span', null, BGS.fmt.date(c.plannedDeparture), ' ', h('span', { class: 'muted sm' }, c.status === 'DEPARTED' ? '' : '(' + BGS.fmt.rel(c.plannedDeparture) + ')'))],
      ['Batch', c.batchId ? ((D.batches.find(b => b.id === c.batchId) || {}).name || c.batchId) : '—'],
      ['Dibuat', BGS.fmt.date(c.createdAt)],
    ], 3) }));

    const tabs = [
      { id: 'flow', label: 'Alur kerja', count: DOM().progress(c).done + '/' + DOM().progress(c).total, render: () => flowTab() },
      { id: 'pic', label: 'PIC', render: () => picTab() },
      { id: 'docs', label: 'Dokumen', render: () => docsTab() },
      { id: 'check', label: 'Checklist kepatuhan', count: (c.checklist || []).filter(x => x.mandatory && x.status === 'MET').length + '/' + (c.checklist || []).filter(x => x.mandatory).length, render: () => checklistTab() },
      { id: 'quota', label: 'Kuota', render: () => quotaTab() },
      { id: 'log', label: 'Komentar & riwayat', count: (c.comments || []).length, render: () => logTab() },
    ];
    ctx.el.append(ui.tabs(tabs, { active: lastTab[c.id] || ctx.query.tab || 'flow', onChange: id => { lastTab[c.id] = id; } }));

    // ---------------- Alur kerja ----------------
    function finalCard() {
      if (!['FINAL_VERIFICATION', 'READY_TO_DEPART', 'DEPARTED'].includes(c.status)) return null;
      const fc = DOM().finalChecks(c.id);
      const btns = [];
      if (c.status === 'FINAL_VERIFICATION') btns.push(ui.btn('Jalankan verifikasi akhir', { kind: 'primary', icon: 'shield', disabled: !BGS.can('final.verify'), title: BGS.can('final.verify') ? '' : 'Hanya Admin/Superadmin', onClick: () => attempt(() => DOM().finalVerify(c.id), r => (r.ok ? 'Verifikasi akhir lolos — case Siap berangkat' : `Belum lolos: ${r.failed.length} syarat belum terpenuhi`), refresh) }));
      if (c.status === 'READY_TO_DEPART') btns.push(ui.btn('Catat keberangkatan', { kind: 'good', icon: 'plane', disabled: !BGS.can('departure.record'), onClick: departureModal }));
      return ui.card({ icon: 'shield', title: 'Verifikasi akhir (RUL-018)', subtitle: 'Case baru boleh Siap berangkat bila kelima syarat terpenuhi.', actions: btns,
        body: h('div', null, fc.checks.map(k => h('div', { class: 'pr-chk' }, BGS.icon(k.ok ? 'check-circle' : 'x-circle', 18, k.ok ? 'pr-ok' : 'pr-no'), h('div', null, h('b', null, k.label), h('div', { class: 'muted sm' }, k.detail)))),
          c.flight && h('div', { style: 'margin-top:10px' }, ui.kv([['Penerbangan', `${c.flight.airline} ${c.flight.flightNo}`], ['Tanggal', BGS.fmt.date(c.flight.date)], ['No. tiket', c.flight.ticketNo]], 3))) });
    }
    function departureModal() {
      let m; const fl = c.flight || {};
      const f = ui.form({ cols: 2, submitLabel: 'Catat keberangkatan', cancel: ui.btn('Batal', { onClick: () => m.close() }), fields: [
        { name: 'airline', label: 'Maskapai', required: true, value: fl.airline }, { name: 'flightNo', label: 'Nomor penerbangan', required: true, value: fl.flightNo },
        { name: 'date', label: 'Tanggal berangkat', type: 'date', required: true, value: fl.date || c.plannedDeparture }, { name: 'ticketNo', label: 'Nomor tiket', required: true, value: fl.ticketNo },
      ], onSubmit: v => attempt(() => DOM().recordDeparture(c.id, v), 'Keberangkatan dicatat', () => { m.close(); refresh(); }) });
      m = ui.modal({ title: 'Catat keberangkatan (RUL-030)', body: h('div', { class: 'stack' }, ui.callout('info', 'Data penerbangan wajib lengkap', 'Keberangkatan hanya bisa dicatat setelah verifikasi akhir lolos.'), f.el) });
    }
    function stepCard(r) {
      const late = r.overdue, daysLate = late ? -BGS.fmt.daysFrom(r.dueAt) : 0;
      const canSkip = canOps() && !r.required && !r.legacy && ['LOCKED', 'IN_PROGRESS', 'READY'].includes(r.status) && ['IN_PROCESS', 'DRAFT'].includes(c.status);
      return h('div', { class: `pr-step s-${r.status}${r.blocked ? ' blocked' : ''}${late ? ' late' : ''}`, onClick: e => { if (e.target.closest('button,a')) return; if (r.taskId) openTask(r.taskId, refresh); } },
        h('div', { class: 'row between' }, h('h4', null, r.name), h('div', { class: 'row gap-sm' }, ui.status('step', r.status), r.taskId && ['IN_PROGRESS', 'READY'].includes(r.status) && r.taskStatus !== 'IN_PROGRESS' ? ui.status('task', r.taskStatus) : null)),
        h('div', { class: 'row wrap gap-sm' }, stepBadges({ required: r.required, external: r.external, verification: r.verification, consumesQuota: r.consumesQuota }), r.legacy && ui.badge('Riwayat template lama', 'gray'), late && ui.badge(`Terlambat ${daysLate} hari`, 'red', { title: 'RUL-028' })),
        h('div', { class: 'pr-meta' },
          r.assigneeId && h('div', null, BGS.icon('user', 13), `${r.picRole || '—'}: `, name(r.assigneeId)),
          r.status === 'COMPLETED' ? h('div', null, BGS.icon('check', 13), `Selesai ${BGS.fmt.date(r.completedAt)}`) : r.status === 'SKIPPED' ? h('div', null, BGS.icon('arrow-right', 13), `Dilewati: ${r.skippedReason || '—'}`) : r.status === 'CANCELLED' ? null : h('div', null, BGS.icon('calendar', 13), `Tenggat ${BGS.fmt.date(r.dueAt)}`, r.status !== 'LOCKED' && c.status === 'IN_PROCESS' ? ` (${BGS.fmt.rel(r.dueAt)})` : ''),
          r.preds.length ? h('div', null, BGS.icon('git-branch', 13), 'Setelah: ', r.preds.map((p, i) => h('span', { style: p.status === 'COMPLETED' || p.status === 'SKIPPED' ? 'color:var(--green);font-weight:600' : 'font-weight:600' }, (i ? ', ' : '') + p.name + (p.status === 'COMPLETED' || p.status === 'SKIPPED' ? ' ✓' : '')))) : h('div', null, BGS.icon('git-branch', 13), 'Langkah awal'),
          r.status === 'LOCKED' && h('div', { style: 'color:var(--muted)' }, BGS.icon('lock', 13), 'Terkunci sampai langkah sebelumnya selesai (RUL-014)'),
          !!(r.refNumber || (r.task && r.task.evidence.length)) && h('div', { class: 'row wrap gap-sm' }, r.refNumber && h('span', { class: 'chip static mono' }, 'No. ref: ' + r.refNumber), r.task && r.task.evidence.length ? h('span', { class: 'chip static' }, BGS.icon('file', 12), `${r.task.evidence.length} bukti`) : null),
          r.blocked && h('div', { style: 'color:var(--red);font-weight:600' }, BGS.icon('alert', 13), r.task.blockedReason)),
        h('div', { class: 'row gap-sm' },
          r.taskId && ui.btn(r.status === 'LOCKED' || terminal ? 'Lihat tugas' : 'Buka tugas', { sm: true, icon: 'chevron-right', onClick: () => openTask(r.taskId, refresh) }),
          canSkip && ui.btn('Lewati', { sm: true, title: 'Langkah opsional dapat dilewati dengan alasan (RUL-015)', onClick: async () => { const reason = await ui.reasonPrompt({ title: `Lewati "${r.name}"`, message: 'Hanya langkah opsional yang boleh dilewati (RUL-015).', label: 'Alasan melewati', confirmLabel: 'Lewati langkah', presets: ['Tidak diperlukan untuk worker ini', 'Sudah dipenuhi di luar sistem'] }); if (reason) attempt(() => DOM().skipStep(c.id, r.stepId, reason), 'Langkah dilewati', refresh); } })));
    }
    function flowTab() {
      const rows = DOM().stepGraph(c.id); const p = DOM().progress(c);
      if (!rows.length) return ui.emptyState({ icon: 'git-branch', title: 'Belum ada langkah', text: 'Template workflow belum menghasilkan langkah untuk case ini.' });
      const levels = []; rows.forEach(r => { (levels[r.level] = levels[r.level] || []).push(r); });
      const quotaStep = rows.find(r => r.consumesQuota);
      return h('div', { class: 'stack' },
        finalCard(),
        h('div', { class: 'card' }, h('div', { class: 'card-b' }, h('div', { class: 'row wrap between' },
          h('div', { style: 'flex:1;min-width:220px' }, h('div', { class: 'row between sm' }, h('b', null, 'Progres langkah wajib'), h('span', null, `${p.done} dari ${p.total} selesai (${p.pct}%)`)), ui.progress(p.pct, 'orange')),
          h('div', { class: 'row wrap gap-sm' }, ui.badge(`${(tpl || {}).name || ''} v${c.templateVersion}`, 'purple'), quotaStep && ui.badge(`Kuota Terpakai setelah: ${quotaStep.name}`, 'teal'))))),
        h('div', { class: 'pr-note' }, BGS.icon('info', 14), 'Klik langkah untuk membuka tugas: mulai, unggah bukti & nomor referensi, minta verifikasi/approval. Pelaksana, verifier, dan approver harus orang berbeda (RUL-016).'),
        h('div', { class: 'pr-flow' }, levels.filter(Boolean).map((lv, i) => h('div', { class: 'pr-level' }, h('div', { class: 'pr-rail' }, h('b', null, 'Tahap ' + (i + 1)), h('i')), h('div', { class: 'pr-cards' }, lv.map(stepCard))))));
    }

    // ---------------- PIC ----------------
    function picTab() {
      const can = BGS.can('pic.assign') && !terminal;
      const hist = c.picHistory || [];
      const rows = D.picRoles.map(role => ({ role, userId: c.pics[role] }));
      return h('div', { class: 'stack' },
        ui.callout('info', 'Satu Case Owner, banyak PIC (RUL-019)', 'Setiap case aktif punya tepat satu Case Owner. Satu PIC Role diisi satu orang; satu orang boleh memegang beberapa role. Setiap perubahan butuh alasan dan tercatat di audit.'),
        !can && lockNote(terminal ? 'Case sudah selesai/dibatalkan, PIC tidak bisa diubah.' : 'Hanya Admin/Superadmin yang bisa mengubah penugasan PIC.'),
        ui.card({ flush: true, title: 'PIC pada case ini', body: ui.table({ rows, pageSize: 10, columns: [
          { label: 'PIC Role', render: r => h('div', null, h('b', null, r.role), r.role === 'Case Owner' && h('div', { class: 'muted xs' }, 'Penanggung jawab tunggal')) },
          { label: 'Ditugaskan ke', render: r => (r.userId ? ui.userChip(r.userId) : ui.badge('Belum diisi', 'red')) },
          { label: 'Tugas aktif', render: r => { const n = D.tasks.filter(t => t.caseId === c.id && t.assigneeId === r.userId && !['COMPLETED', 'CANCELLED'].includes(t.status) && (r.role === 'Case Owner' ? t.role === 'owner' : D.picByStepRole[t.role] === r.role)).length; return n ? ui.badge(n + ' tugas', 'orange') : h('span', { class: 'muted' }, '—'); } },
          { label: 'Ubah penugasan', render: r => { if (!can) return h('span', { class: 'muted sm' }, '—'); let sel = r.userId; const s = select(userOptions(r.role), r.userId, v => (sel = v), { style: 'min-width:190px' }); return h('div', { class: 'row gap-sm' }, s, ui.btn('Ubah', { sm: true, onClick: async () => { if (!sel || sel === r.userId) { ui.toast('Pilih orang yang berbeda dahulu', 'warn'); return; } const reason = await ui.reasonPrompt({ title: `Ubah ${r.role}`, message: `${name(r.userId)} → ${name(sel)}. Tugas aktif untuk role ini ikut dialihkan.`, label: 'Alasan penugasan', presets: ['Beban kerja seimbang', 'PIC cuti / tidak tersedia', 'Rotasi tugas'] }); if (reason) attempt(() => DOM().assignPic(c.id, r.role, sel, reason), `${r.role} diubah ke ${name(sel)}`, refresh); } })); } },
        ] }) }),
        ui.card({ title: 'Riwayat penugasan', flush: true, body: hist.length ? ui.table({ rows: hist, pageSize: 6, columns: [{ label: 'Waktu', render: x => BGS.fmt.dateTime(x.at) }, { label: 'Role', render: x => x.role }, { label: 'Dari → ke', render: x => `${x.from ? name(x.from) : '—'} → ${name(x.to)}` }, { label: 'Alasan', render: x => x.reason }, { label: 'Oleh', render: x => name(x.by) }] }) : ui.emptyState({ icon: 'users', title: 'Belum ada perubahan penugasan', text: 'Penugasan awal ditetapkan saat alokasi.' }) }));
    }

    // ---------------- Dokumen ----------------
    function docStateFor(dt, docs) {
      const list = docs.filter(d => d.typeId === dt.id);
      if (!list.length) return { tone: 'red', text: 'Belum diunggah', doc: null };
      const ver = list.find(d => d.status === 'VERIFIED');
      if (!ver) { const d = list[0]; return { tone: d.status === 'UPLOADED' ? 'amber' : 'red', text: BGS.ST.document[d.status][0], doc: d }; }
      const dep = new Date(c.plannedDeparture); const needD = dt.id === 'DT08' ? new Date(new Date(dep).setMonth(dep.getMonth() + D.settings.passportMinMonths)) : dep;
      if (ver.expiresAt && new Date(ver.expiresAt) < needD) return { tone: 'red', text: dt.id === 'DT08' ? `Berlaku < ${D.settings.passportMinMonths} bln saat berangkat` : 'Kedaluwarsa sebelum berangkat', doc: ver };
      return { tone: 'green', text: 'Terverifikasi', doc: ver };
    }
    function revealDoc(d) {
      ui.reasonPrompt({ title: 'Buka dokumen RESTRICTED', message: 'Akses ini tercatat di audit trail (RUL-021).', label: 'Alasan membuka dokumen', presets: ['Verifikasi akhir', 'Pemeriksaan dokumen', 'Pengisian formulir resmi'] }).then(r => { if (!r) return; BGS.audit('Akses dokumen RESTRICTED', 'Document', d.id, `Case ${c.id} · Alasan: ${r}`); ui.toast('Dokumen dibuka (simulasi) — akses tercatat di audit', 'info'); });
    }
    function docsTab() {
      const docs = D.documents.filter(d => d.status !== 'SUPERSEDED' && ((d.ownerType === 'worker' && d.ownerId === c.workerId) || (d.ownerType === 'case' && d.ownerId === c.id)));
      const req = DOM().requiredDocTypes(c);
      const reqRows = req.map(dt => Object.assign({ dt }, docStateFor(dt, docs)));
      const okN = reqRows.filter(r => r.tone === 'green').length;
      const all = docs.slice().sort((a, b) => a.typeId.localeCompare(b.typeId));
      const canView = d => (D.docType(d.typeId).sensitivity !== 'RESTRICTED') || BGS.can('document.restricted.view');
      return h('div', { class: 'stack' },
        ui.callout(okN === req.length ? 'good' : 'warn', `Dokumen wajib verifikasi akhir: ${okN}/${req.length} terpenuhi`, 'Syarat RUL-018: wajib VERIFIED dan tidak kedaluwarsa pada tanggal rencana berangkat (' + BGS.fmt.date(c.plannedDeparture) + '); paspor minimal ' + D.settings.passportMinMonths + ' bulan.'),
        ui.card({ title: 'Kelengkapan dokumen wajib', flush: true, actions: [h('a', { class: 'btn btn-sm', href: '#/documents?owner=' + c.workerId }, 'Dokumen worker'), h('a', { class: 'btn btn-sm', href: '#/documents?owner=' + c.id }, 'Dokumen case')], body: ui.table({ rows: reqRows, pageSize: 12, dense: true, columns: [
          { label: 'Dokumen', render: r => h('b', null, r.dt.name) }, { label: 'Pemilik', render: r => (r.doc ? (r.doc.ownerType === 'case' ? 'Case' : 'Worker') : '—') },
          { label: 'Status', render: r => ui.badge(r.text, r.tone, { dot: true }) }, { label: 'Berlaku sampai', render: r => (r.doc && r.doc.expiresAt ? BGS.fmt.date(r.doc.expiresAt) : '—') },
        ] }) }),
        ui.card({ title: 'Semua dokumen terkait', subtitle: 'Dokumen worker dan dokumen khusus case. Versi lama (SUPERSEDED) disembunyikan.', flush: true, body: ui.table({ rows: all, pageSize: 8, empty: ui.emptyState({ icon: 'folder', title: 'Belum ada dokumen', text: 'Unggah dokumen lewat menu Dokumen.' }), columns: [
          { label: 'Jenis', render: d => { const dt = D.docType(d.typeId); return h('div', null, h('b', null, dt.name), h('div', { class: 'xs' }, ui.badge(BGS.ST.sensitivity[dt.sensitivity][0], BGS.ST.sensitivity[dt.sensitivity][1]))); } },
          { label: 'Berkas', render: d => (canView(d) ? h('span', { class: 'row gap-sm' }, h('span', { class: 'mono' }, D.docType(d.typeId).sensitivity === 'RESTRICTED' ? d.filename.replace(/[^.]+(?=\.)/, m => m.slice(0, 3) + '•••••') : d.filename), D.docType(d.typeId).sensitivity === 'RESTRICTED' && ui.btn('', { icon: 'eye', sm: true, title: 'Buka (tercatat di audit)', onClick: () => revealDoc(d) })) : h('span', { class: 'muted sm' }, BGS.icon('lock', 12), ' Tidak ada akses (RESTRICTED)')) },
          { label: 'Pemilik', render: d => (d.ownerType === 'case' ? 'Case' : 'Worker') }, { label: 'Status', render: d => ui.status('document', d.status) },
          { label: 'Kedaluwarsa', render: d => (d.expiresAt ? h('span', { style: new Date(d.expiresAt) < new Date(c.plannedDeparture) ? 'color:var(--red);font-weight:700' : '' }, BGS.fmt.date(d.expiresAt)) : '—') },
        ] }) }));
    }

    // ---------------- Checklist ----------------
    function checklistTab() {
      const items = c.checklist || []; const mand = items.filter(x => x.mandatory); const met = mand.filter(x => x.status === 'MET').length;
      const can = BGS.can('task.verify') && !terminal;
      return h('div', { class: 'stack' },
        ui.disclaimer(),
        ui.callout(met === mand.length ? 'good' : 'info', `${met}/${mand.length} item wajib terpenuhi`, c.status === 'DRAFT' ? 'Checklist adalah snapshot versi rule aktif; akan disegarkan saat case diaktifkan bila belum ada yang ditandai (RUL-025).' : 'Daftar ini adalah snapshot versi rule saat case diaktifkan; perubahan rule tidak otomatis mengubah checklist ini (RUL-025).'),
        !can && lockNote(terminal ? 'Checklist dikunci karena case sudah selesai/dibatalkan.' : 'Peran Anda hanya dapat melihat checklist.'),
        ui.card({ flush: true, title: 'Checklist kepatuhan case', body: ui.table({ rows: items, pageSize: 12, empty: ui.emptyState({ icon: 'check-square', title: 'Tidak ada item checklist', text: 'Belum ada rule yang berlaku untuk negara/profesi ini.' }), columns: [
          { label: 'Syarat', render: x => h('div', null, h('b', null, x.label), h('div', { class: 'muted xs' }, `${x.source} · rule ${x.ruleId} v${x.ruleVersion}`)) },
          { label: 'Sifat', render: x => (x.mandatory ? ui.badge('Wajib', 'blue') : ui.badge('Opsional', 'gray')) },
          { label: 'Status', render: x => (x.status === 'MET' ? ui.badge('Terpenuhi', 'green', { dot: true }) : ui.badge('Belum terpenuhi', x.mandatory ? 'amber' : 'gray', { dot: true })) },
          { label: 'Diperiksa', render: x => (x.checkedBy ? h('div', null, name(x.checkedBy), h('div', { class: 'muted xs' }, BGS.fmt.dateTime(x.checkedAt))) : h('span', { class: 'muted' }, '—')) },
          { label: '', render: x => (can ? ui.btn(x.status === 'MET' ? 'Tandai belum' : 'Tandai terpenuhi', { sm: true, kind: x.status === 'MET' ? '' : 'good', onClick: () => attempt(() => DOM().markChecklist(c.id, x.ruleId, x.status === 'MET' ? 'NOT_MET' : 'MET'), 'Checklist diperbarui', refresh) }) : null) },
        ] }) }));
    }

    // ---------------- Kuota ----------------
    function quotaTab() {
      const qs = DOM().quotaState(c); const q = c.quota || {}; const ver = DOM().tplVersion(c); const qStep = ver && ver.steps.find(s => s.consumesQuota); const qi = qStep && c.steps.find(x => x.stepId === qStep.id);
      const pend = D.approvals.find(a => a.type === 'REVERT_KUOTA' && a.status === 'PENDING' && a.subject === c.id);
      const until = q.reservedUntil || (c.createdAt && BGS.addDays(new Date(c.createdAt), D.settings.quotaReservationDays).toISOString()); const expired = qs === 'RESERVED' && c.status === 'DRAFT' && until && new Date(until) < BGS.today;
      const stateBadge = qs === 'UTILIZED' ? ui.badge('Terpakai (Utilized)', 'green', { dot: true }) : qs === 'RESERVED' ? ui.badge('Dicadangkan (Reserved)', 'amber', { dot: true }) : ui.badge('Dilepas (Released)', 'gray', { dot: true });
      return h('div', { class: 'stack' },
        ui.callout('info', 'Siklus kuota (RUL-005…007)', 'Dicadangkan saat case dibuat → Terpakai saat langkah penandatanganan Perjanjian Penempatan selesai → Dilepas bila case dibatalkan sebelum terpakai. Membatalkan setelah Terpakai butuh persetujuan Director.'),
        ui.card({ title: 'Status kuota case ini', actions: [stateBadge], body: h('div', { class: 'stack' },
          ui.kv([['Placement Code', pc ? ui.codeLink(pc.id) : '—'], ['Job Order', jo ? ui.link(jo.id, '/job-orders/' + jo.id, 'lnk mono') : '—'], ['Dicadangkan sejak', BGS.fmt.date(q.reservedAt || c.createdAt)], ['Reservasi berlaku s.d.', qs === 'RESERVED' ? h('span', { style: expired ? 'color:var(--red);font-weight:700' : '' }, BGS.fmt.date(until) + (expired ? ' — lewat batas, perlu ditindaklanjuti (RUL-007)' : '')) : '—'], ['Menjadi Terpakai saat', qStep ? `Langkah "${qStep.name}" ${qi && qi.status === 'COMPLETED' ? 'sudah selesai ' + BGS.fmt.date(qi.completedAt) : 'belum selesai'}` : 'Template tidak punya langkah penggunaan kuota'], qs === 'RELEASED' ? ['Dilepas', `${BGS.fmt.date(q.releasedAt || c.cancelledAt)} — ${q.releaseReason || c.cancelReason || ''}`] : null], 2),
          pc && h('div', { class: 'stack-sm' }, h('b', null, 'Kuota pada kode ' + pc.id), ui.quotaBar(pc), h('div', { class: 'pr-quota' }, [['Total', pc.total], ['Terpakai', pc.utilized], ['Dicadangkan', pc.reserved], ['Tersedia', pc.available]].map(([l, v]) => h('div', null, h('b', null, v), h('span', null, l))))),
          pend && ui.callout('warn', 'Menunggu persetujuan Director', `Permintaan ${pend.id}: ${pend.reason}`)) }),
        qs !== 'RELEASED' && !terminal ? ui.card({ title: qs === 'UTILIZED' ? 'Revert kuota Terpakai' : 'Lepas kuota', body: h('div', { class: 'stack' },
          h('p', { class: 'muted' }, qs === 'UTILIZED' ? 'Kuota sudah Terpakai. Pembatalan/revert harus lewat permintaan persetujuan Director dengan alasan (RUL-007).' : 'Melepas kuota akan membatalkan case ini (case tanpa kuota tidak boleh berjalan) dan mengembalikan lamaran ke daftar siap alokasi.'),
          canOps() ? ui.btn(qs === 'UTILIZED' ? 'Ajukan revert kuota' : 'Lepas kuota & batalkan case', { kind: 'danger', icon: 'x-circle', disabled: !!pend, title: pend ? 'Sudah ada permintaan yang menunggu' : '', onClick: async () => { const r = await ui.reasonPrompt({ title: qs === 'UTILIZED' ? 'Ajukan revert kuota' : 'Lepas kuota', message: qs === 'UTILIZED' ? 'Permintaan akan dikirim ke Director.' : 'Case akan dibatalkan dan kuota dilepas.', label: 'Alasan', tone: 'danger', confirmLabel: qs === 'UTILIZED' ? 'Ajukan' : 'Lepas kuota', presets: ['Worker mengundurkan diri', 'Job Order dibatalkan'] }); if (r) attempt(() => DOM().releaseQuota(c.id, r), res => (res.type === 'REVERT_KUOTA' ? `Permintaan ${res.id} dikirim ke Director` : 'Kuota dilepas · case dibatalkan'), refresh); } }) : lockNote('Hanya Admin/Superadmin yang bisa melepas kuota.')) }) : null);
    }

    // ---------------- Komentar & riwayat ----------------
    function logTab() {
      const ta = h('textarea', { class: 'input', rows: 3, placeholder: 'Tulis komentar untuk tim yang menangani case ini…' });
      const canC = BGS.can('task.execute') || BGS.can('task.approve');
      const ev = [];
      (c.history || []).forEach(x => ev.push({ at: x.at, by: x.by, text: x.text, tone: tone(x.tone) }));
      (c.comments || []).forEach(x => ev.push({ at: x.at, by: x.by, text: '💬 ' + x.text, tone: 'gray' }));
      if (!(c.history || []).length) { // seeded cases: reconstruct from step data
        ev.push({ at: c.createdAt, by: c.ownerId, text: `Case dibuat dan kuota dicadangkan pada ${c.placementCodeId}`, tone: 'blue' });
        c.steps.filter(s => s.completedAt).forEach(s => ev.push({ at: s.completedAt, by: null, text: `Langkah "${s.name}" ${s.status === 'SKIPPED' ? 'dilewati' : 'selesai'}${s.refNumber ? ' · ref ' + s.refNumber : ''}`, tone: 'green' }));
        (c.blockers || []).forEach(b => ev.push({ at: b.at, by: b.by, text: `Hambatan (${b.category}): ${b.reason}`, tone: 'red' }));
      }
      ev.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      const taskIds = new Set(D.tasks.filter(t => t.caseId === c.id).map(t => t.id));
      const audit = D.audit.filter(a => a.entityId === c.id || taskIds.has(a.entityId));
      return h('div', { class: 'grid cols-21' },
        ui.card({ title: 'Riwayat case', body: ev.length ? ui.timeline(ev.slice(0, 40)) : ui.emptyState({ icon: 'clock', title: 'Belum ada riwayat' }) }),
        h('div', { class: 'stack' },
          ui.card({ title: 'Tambah komentar', body: canC ? h('div', { class: 'stack' }, ta, ui.btn('Kirim komentar', { kind: 'primary', icon: 'send', onClick: () => attempt(() => DOM().addComment(c.id, ta.value), 'Komentar ditambahkan', refresh) })) : lockNote('Peran Anda hanya dapat melihat (read-only).') }),
          ui.card({ title: 'Komentar', body: (c.comments || []).length ? h('div', { class: 'stack-sm' }, c.comments.map(x => h('div', { class: 'callout c-info', style: 'flex-direction:column;gap:2px' }, h('div', null, x.text), h('div', { class: 'muted xs' }, `${name(x.by)} · ${BGS.fmt.dateTime(x.at)}`)))) : h('div', { class: 'muted' }, 'Belum ada komentar.') }),
          BGS.can('audit.view') ? ui.card({ title: 'Jejak audit', subtitle: 'Append-only (RUL-021)', flush: true, body: ui.table({ rows: audit, pageSize: 5, dense: true, empty: ui.emptyState({ icon: 'shield', title: 'Belum ada entri audit' }), columns: [{ label: 'Waktu', render: a => BGS.fmt.dateTime(a.at) }, { label: 'Aksi', render: a => h('div', null, a.action, a.detail && h('div', { class: 'muted xs' }, a.detail)) }, { label: 'Oleh', render: a => name(a.userId) }] }) }) : null));
    }
  }

  BGS.router.add('/allocation', { title: 'Alokasi penempatan', roles: R.OPS, mvp: 2, render: renderAllocation });
  BGS.router.add('/cases', { title: 'Placement Case', roles: R.ALL, mvp: 2, render: renderCases });
  BGS.router.add('/cases/:id', { title: 'Detail Placement Case', roles: R.ALL, mvp: 2, render: renderCase });
})();
