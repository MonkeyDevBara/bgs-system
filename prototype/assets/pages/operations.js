/* Operations: M07 Task (drawer + /tasks) and M06 monitor / final verification / departures.
   Business logic lives in BGS.domain (domain.js); this file is UI only and guards when BGS.domain is missing. */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui, fmt = BGS.fmt;
  const DAY = 86400000;
  const DONE = ['COMPLETED', 'CANCELLED'];
  const LIVE_CASE = ['IN_PROCESS', 'FINAL_VERIFICATION'];
  const ROLE_LABEL = { docs: 'PIC Dokumen', medical: 'PIC Medical', visa: 'PIC Visa', departure: 'PIC Keberangkatan', owner: 'Case Owner' };
  const BLOCK_CATS = ['Pihak eksternal', 'Dokumen worker kurang', 'Menunggu worker', 'Menunggu biaya / pembayaran', 'Sistem eksternal bermasalah', 'Menunggu langkah lain', 'Lainnya'];
  const me = () => BGS.state.userId;
  const nameOf = id => (D.user(id) || {}).name || '—';
  const stamp = () => BGS.today.toISOString();
  const roleName = () => BGS.roles[BGS.state.role];
  const noDomain = () => ui.toast('Mesin proses (domain.js) belum dimuat — aksi belum bisa dijalankan.', 'danger');

  BGS.addStyle(`
    .tk-actors{display:grid;grid-template-columns:repeat(3,1fr);gap:8px} @media(max-width:520px){.tk-actors{grid-template-columns:1fr}}
    .tk-actor{border:1.5px solid var(--line2);border-radius:10px;padding:9px 10px;background:#fff;display:flex;flex-direction:column;gap:5px;min-width:0}
    .tk-actor .tk-al{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;color:#475569}
    .tk-actor .tk-an{font-size:11.5px;line-height:1.35}
    .tk-actor.tk-good{border-color:#86EFAC;background:#F0FDF4} .tk-actor.tk-danger{border-color:#FCA5A5;background:#FEF2F2} .tk-actor.tk-me{box-shadow:0 0 0 2px #93C5FD}
    .tk-sec{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
    .tk-sec h4{margin:0 0 8px;font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px}
    .tk-ev{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed var(--line);font-size:13px} .tk-ev:last-child{border-bottom:0}
    .tk-cm{display:flex;gap:8px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13px} .tk-cm:last-child{border-bottom:0}
    .tk-od{color:var(--red);font-weight:700} .tk-soon{color:#92400E;font-weight:700}
    .tk-why{font-size:12px;color:#92400E;background:#FFFBEB;border:1px solid #FCD34D;border-radius:8px;padding:6px 10px}
    .fv-queue{display:flex;flex-direction:column;gap:8px}
    .fv-grp{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;color:#475569;margin:6px 0 0}
    .fv-item{display:flex;flex-direction:column;gap:6px;text-align:left;border:1.5px solid var(--line2);background:#fff;border-radius:10px;padding:10px 12px;width:100%}
    .fv-item:hover{border-color:var(--blue);background:#F8FAFF} .fv-item.on{border-color:var(--blue);background:#EFF6FF;box-shadow:0 0 0 2px #BFDBFE}
    .fv-check{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:12px;border:2px solid}
    .fv-check.ok{border-color:#86EFAC;background:#F0FDF4} .fv-check.bad{border-color:#FCA5A5;background:#FEF2F2}
    .fv-check .fv-ic{flex:none;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff}
    .fv-check.ok .fv-ic{background:var(--green)} .fv-check.bad .fv-ic{background:var(--red)}
    .fv-check .fv-t{font-weight:800;font-size:14.5px} .fv-check .fv-d{font-size:13px;color:#334155;margin-top:2px}
    .dp-note{font-size:12px}
  `);

  // ====================== shared helpers ======================
  const tplStep = (c, stepId) => { const tp = D.template(c.templateId); const v = tp && tp.versions.find(x => x.v === c.templateVersion); return (v && v.steps.find(s => s.id === stepId)) || null; };
  const stepInst = (c, stepId) => (c ? c.steps.find(s => s.stepId === stepId) : null) || null;
  const info = t => { const c = D.case(t.caseId); return { t, c, w: c && D.worker(c.workerId), si: c && stepInst(c, t.stepId), sd: c && tplStep(c, t.stepId) }; };
  // effective due date: earliest of task and step due date (they are kept in sync by "ubah tenggat")
  const dueOf = t => { const c = D.case(t.caseId); const si = c && stepInst(c, t.stepId); const a = +new Date(t.dueAt); const b = si && si.dueAt ? +new Date(si.dueAt) : a; return new Date(Math.min(a, b)).toISOString(); };
  const isLive = t => { const c = D.case(t.caseId); if (!c || !LIVE_CASE.includes(c.status) || DONE.includes(t.status)) return false; const si = stepInst(c, t.stepId); return !si || si.status !== 'LOCKED'; };
  const isOverdue = t => isLive(t) && new Date(dueOf(t)) < BGS.today;                       // RUL-028
  const daysLate = t => Math.max(1, Math.ceil((BGS.today - new Date(dueOf(t))) / DAY));
  const isSoon = t => { if (!isLive(t) || isOverdue(t)) return false; const d = new Date(dueOf(t)) - BGS.today; return d >= 0 && d <= 3 * DAY; };
  const activeBlocker = t => { const c = D.case(t.caseId); if (!c) return null; return [...c.blockers].reverse().find(b => b.stepId === t.stepId && !b.resolvedAt && !b.clearedAt) || null; };
  const ymd = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const scopeCaseIds = () => new Set(BGS.scope.cases().map(c => c.id));
  const dueCell = t => {
    const due = dueOf(t), od = isOverdue(t);
    return h('div', null, h('div', { class: od ? 'tk-od' : isSoon(t) ? 'tk-soon' : '' }, fmt.date(due)),
      h('div', { class: 'sm ' + (od ? 'tk-od' : 'muted'), title: isLive(t) || DONE.includes(t.status) ? null : 'Langkah masih terkunci atau case belum berjalan' }, DONE.includes(t.status) ? 'selesai/ditutup' : od ? `Terlambat ${daysLate(t)} hari` : isLive(t) ? fmt.rel(due) : 'belum aktif'));
  };
  const userCell = id => { const u = D.user(id); return u ? h('div', null, ui.userChip(id), u.picRole && h('div', { class: 'muted sm' }, u.picRole)) : '—'; };
  const refChip = x => {
    if (!x.t.external) return h('span', { class: 'muted sm' }, '—');
    const ref = x.si && x.si.refNumber;
    return ref ? h('span', { class: 'chip static mono', title: 'Nomor referensi eksternal (BR-033)' }, BGS.icon('link', 12), ref) : ui.badge('Perlu no. referensi', 'amber', { title: 'Langkah eksternal wajib punya nomor referensi + bukti (BR-033)' });
  };
  const caseCell = x => h('div', null, x.c ? ui.caseLink(x.c.id) : '—', h('div', { class: 'sm' }, x.w ? ui.workerLink(x.w.id) : '—'));

  // ---- segregation of duties / permission checks (RUL-016). Final enforcement is in BGS.domain. ----
  const OK = { ok: true };
  const NO = why => ({ ok: false, why });
  const sodOn = () => !!D.settings.sodEnabled;
  function canExec(x) {
    const { t, c } = x;
    if (!BGS.can('task.execute')) return NO(`Peran ${roleName()} hanya bisa melihat task, tidak bisa mengerjakannya.`);
    if (BGS.isRole('pic') && t.assigneeId !== me()) return NO(`Task ini milik ${nameOf(t.assigneeId)}. PIC hanya mengerjakan task miliknya (RUL-020).`);
    if (c && !['IN_PROCESS', 'FINAL_VERIFICATION'].includes(c.status)) return NO(`Case berstatus "${BGS.ST.case[c.status] ? BGS.ST.case[c.status][0] : c.status}" — task hanya bisa dikerjakan saat case Diproses.`);
    return OK;
  }
  function canVerify(x) {
    const { t } = x;
    if (!BGS.can('task.verify')) return NO(`Peran ${roleName()} tidak boleh memverifikasi task.`);
    if (sodOn() && t.executorId === me()) return NO('Anda pelaksana task ini. Pelaksana tidak boleh memverifikasi pekerjaannya sendiri (RUL-016).');
    if (BGS.isRole('pic') && t.verifierId !== me()) return NO(`PIC hanya memverifikasi task yang ditunjuk kepadanya. Pemeriksa: ${nameOf(t.verifierId)} (RUL-020).`);
    return OK;
  }
  function canApprove(x) {
    const { t } = x, verifier = t.verifiedBy || t.verifierId;
    if (!BGS.can('task.approve')) return NO(`Peran ${roleName()} tidak boleh menyetujui task.`);
    if (sodOn() && t.executorId === me()) return NO('Anda pelaksana task ini. Pelaksana tidak boleh menyetujui pekerjaannya sendiri (RUL-016).');
    if (sodOn() && verifier === me()) return NO('Anda pemeriksa task ini. Pemeriksa dan penyetuju harus orang berbeda (RUL-016).');
    return OK;
  }

  // ====================== TASK DRAWER ======================
  BGS.taskDrawer = function (taskId, opts) {
    opts = opts || {};
    if (!D.task(taskId)) { ui.toast('Task tidak ditemukan', 'danger'); return null; }
    const body = h('div', { class: 'stack' });
    const foot = h('div', { class: 'row wrap gap-sm', style: 'width:100%;justify-content:flex-end' });
    const drawer = ui.drawer({ title: D.task(taskId).title, size: 'md', body, footer: foot });

    const changed = () => { if (opts.onChange) opts.onChange(); draw(); };
    const exec = async (action, payload, okMsg) => {
      if (!BGS.domain || !BGS.domain.taskAction) return noDomain();
      try { await BGS.domain.taskAction(taskId, action, payload || {}); ui.toast(okMsg); changed(); } catch (e) { ui.toast(e.message || String(e), 'danger'); }
    };
    const reject = async () => {
      const reason = await ui.reasonPrompt({ title: 'Tolak & minta revisi', message: 'Task akan kembali ke pelaksana untuk diperbaiki. Alasan akan terlihat oleh pelaksana.', label: 'Alasan penolakan', confirmLabel: 'Tolak task', tone: 'danger', presets: ['Bukti tidak jelas / buram', 'Nomor referensi tidak sesuai bukti', 'Data tidak lengkap'] });
      if (reason) exec('reject', { reason }, 'Task ditolak dan dikembalikan ke pelaksana');
    };
    const block = () => {
      let m;
      const f = ui.form({
        cols: 1, submitLabel: 'Tandai terhambat', cancel: ui.btn('Batal', { onClick: () => m.close() }),
        fields: [
          { name: 'category', label: 'Kategori hambatan', type: 'select', options: BLOCK_CATS, required: true },
          { name: 'reason', label: 'Alasan / keterangan', type: 'textarea', required: true, placeholder: 'Contoh: klinik belum memberi jadwal MCU', hint: 'Alasan wajib diisi (RUL-022).' },
        ],
        onSubmit: async v => { m.close(); await exec('block', { category: v.category, reason: v.reason.trim() }, 'Task ditandai terhambat'); },
      });
      m = ui.modal({ title: 'Tandai task terhambat', size: 'sm', body: f.el });
    };

    function draw() {
      BGS.clear(body); BGS.clear(foot);
      const t = D.task(taskId), x = info(t), { c, w, si, sd } = x;
      const od = isOverdue(t), blk = t.status === 'BLOCKED' ? activeBlocker(t) : null;
      const ex = canExec(x), vf = canVerify(x), ap = canApprove(x);
      const needEvidence = !!(sd && sd.external) && !(t.evidence.length && si && si.refNumber);
      const verif = sd ? sd.verification : (t.verifierId ? 'VERIFY' : 'NONE');
      const locked = si && si.status === 'LOCKED';
      const whys = [];

      // --- header facts
      body.append(
        h('div', { class: 'row wrap gap-sm' }, ui.status('task', t.status), od && ui.badge(`Terlambat ${daysLate(t)} hari`, 'red', { title: 'RUL-028: tenggat lewat & belum selesai' }),
          t.external && ui.badge('Langkah eksternal', 'orange'), sd && sd.consumesQuota && ui.badge('Memakai kuota', 'teal', { title: 'Saat selesai, kuota berpindah dari Dicadangkan ke Terpakai' }),
          sd && !sd.required && ui.badge('Opsional', 'gray'), locked && ui.badge('Langkah terkunci', 'gray')),
        ui.kv([
          ['Task', h('span', null, h('b', null, t.title), ' ', h('span', { class: 'muted mono' }, t.id))],
          ['Placement Case', c ? ui.caseLink(c.id) : '—'],
          ['Worker', w ? ui.workerLink(w.id) : '—'],
          ['Negara · profesi', c ? `${D.cn(c.country)} · ${D.pn(c.profession)}` : '—'],
          ['Langkah proses', si ? h('span', null, si.name, ' ', ui.status('step', si.status)) : '—'],
          ['Tenggat', h('span', { class: od ? 'tk-od' : '' }, fmt.dateTime(dueOf(t)), ' · ', od ? `terlambat ${daysLate(t)} hari` : fmt.rel(dueOf(t)))],
          t.external ? ['Nomor referensi eksternal', si && si.refNumber ? h('span', { class: 'mono b' }, si.refNumber) : h('span', { class: 'muted' }, 'Belum dicatat (BR-033)')] : null,
        ]));

      if (locked) body.append(ui.callout('warn', 'Langkah ini masih terkunci', 'Langkah baru terbuka setelah semua langkah sebelumnya selesai atau dilewati (RUL-014).'));
      if (t.status === 'REJECTED') {
        const rj = [...t.comments].reverse().find(cm => /ditolak|tolak/i.test(cm.text || ''));
        body.append(ui.callout('danger', 'Task ditolak — perlu revisi', rj ? rj.text : 'Perbaiki bukti atau data sesuai catatan pemeriksa, lalu ajukan verifikasi lagi.'));
      }
      if (t.status === 'BLOCKED') body.append(ui.callout('danger', 'Task terhambat' + (blk ? ` — ${blk.category}` : ''), h('div', null, (blk && blk.reason) || t.blockedReason || 'Tidak ada alasan tercatat.', blk && h('div', { class: 'sm' }, `Sejak ${fmt.date(blk.at)} (${fmt.rel(blk.at)}) · dicatat oleh ${nameOf(blk.by)}`))));

      // --- actors + segregation of duties
      const youExec = t.executorId === me(), youVer = t.verifierId === me(), youApp = t.approverId === me();
      const actor = (label, uid, mine, tone, note) => h('div', { class: `tk-actor ${tone ? 'tk-' + tone : ''} ${mine ? 'tk-me' : ''}` }, h('div', { class: 'tk-al' }, label),
        uid ? h('div', null, ui.userChip(uid), mine && h('span', { style: 'margin-left:6px' }, ui.badge('Anda', 'blue'))) : h('div', { class: 'muted sm' }, 'Tidak diperlukan'), note && h('div', { class: 'tk-an' }, note));
      const verNote = verif === 'NONE' && !t.verifierId ? null : youExec && sodOn() ? 'Anda pelaksana — tidak boleh memeriksa (RUL-016)' : youVer ? 'Anda yang memeriksa task ini' : null;
      const appNote = verif !== 'APPROVE' && !t.approverId ? null : youExec && sodOn() ? 'Anda pelaksana — tidak boleh menyetujui (RUL-016)' : youVer && sodOn() ? 'Anda pemeriksa — tidak boleh menyetujui' : youApp ? 'Anda yang menyetujui task ini' : null;
      body.append(h('div', { class: 'tk-sec' }, h('h4', null, BGS.icon('shield', 15), 'Pelaksana · Pemeriksa · Penyetuju', h('span', { class: 'muted sm', style: 'font-weight:600' }, 'RUL-016')),
        h('div', { class: 'tk-actors' },
          actor('Pelaksana', t.executorId, youExec, youExec ? 'good' : '', youExec ? 'Anda mengerjakan task ini' : null),
          actor('Pemeriksa', verif === 'NONE' && !t.verifierId ? null : t.verifierId, youVer, youExec && sodOn() && (verif !== 'NONE' || t.verifierId) ? 'danger' : youVer ? 'good' : '', verNote),
          actor('Penyetuju', verif !== 'APPROVE' && !t.approverId ? null : t.approverId, youApp, (youExec || youVer) && sodOn() && (verif === 'APPROVE' || t.approverId) ? 'danger' : youApp ? 'good' : '', appNote)),
        !sodOn() ? h('div', { class: 'muted sm', style: 'margin-top:8px' }, 'Segregation of duties sedang dinonaktifkan di pengaturan sistem (OQ-07).') : youExec && (verif !== 'NONE' || t.verifierId) ? h('div', { class: 'tk-why', style: 'margin-top:8px' }, 'Anda pelaksana task ini, jadi tombol Verifikasi/Setujui akan nonaktif untuk Anda. Pemeriksa harus orang lain.') : h('div', { class: 'muted sm', style: 'margin-top:8px' }, 'Pelaksana, pemeriksa, dan penyetuju harus orang yang berbeda — berlaku juga untuk Superadmin.')));

      // --- evidence
      const canUpload = ['IN_PROGRESS', 'WAITING_EVIDENCE', 'REJECTED'].includes(t.status) && ex.ok && !locked;
      const evSec = h('div', { class: 'tk-sec' }, h('h4', null, BGS.icon('upload', 15), `Bukti (${t.evidence.length})`, t.external && h('span', { class: 'muted sm', style: 'font-weight:600' }, 'BR-033')),
        t.evidence.length ? t.evidence.map(e => h('div', { class: 'tk-ev' }, BGS.icon('file-text', 16), h('div', { class: 'grow' }, h('div', { class: 'b mono', style: 'word-break:break-all' }, e.name), h('div', { class: 'muted sm' }, `${nameOf(e.by)} · ${fmt.dateTime(e.at)}`)),
          h('button', { class: 'icon-btn', title: 'Pratinjau (simulasi)', onClick: () => ui.toast('Pratinjau file hanya simulasi di prototipe', 'info') }, BGS.icon('eye', 16)))) : h('div', { class: 'muted sm' }, t.external ? 'Belum ada bukti. Langkah eksternal wajib punya file bukti dan nomor referensi dari sistem eksternal (SISKO/ENJAZ/dll).' : 'Belum ada bukti diunggah.'));
      if (canUpload) {
        const nameIn = h('input', { class: 'input', placeholder: `bukti-${t.stepId}-${t.caseId}.pdf` });
        const fileIn = h('input', { class: 'input', type: 'file', onChange: e => { if (e.target.files[0]) nameIn.value = e.target.files[0].name; } });
        const refIn = h('input', { class: 'input', placeholder: 'mis. SISKO-123456', value: (si && si.refNumber) || '' });
        const err = h('div', { class: 'field-err', style: 'display:none' });
        evSec.append(h('div', { class: 'stack-sm', style: 'margin-top:10px;padding-top:10px;border-top:1px solid var(--line)' },
          h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Pilih file bukti'), fileIn, h('span', { class: 'hint' }, 'Hanya simulasi: file tidak diunggah ke server.')),
          h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Nama file'), nameIn),
          t.external && h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Nomor referensi eksternal', h('i', { class: 'req' }, '*')), refIn, h('span', { class: 'hint' }, 'Salin nomor dari SISKO/ENJAZ/BASMA/klinik. Dicatat manual — tidak ada integrasi (BR-033).')),
          err,
          h('div', null, ui.btn('Unggah bukti', { kind: 'primary', icon: 'upload', onClick: () => {
            const file = nameIn.value.trim() || nameIn.placeholder, ref = refIn.value.trim();
            if (t.external && !ref) { err.textContent = 'Nomor referensi eksternal wajib diisi untuk langkah eksternal (BR-033).'; err.style.display = 'block'; refIn.classList.add('invalid'); return; }
            exec('submit_evidence', { file, refNumber: ref || null }, 'Bukti berhasil dicatat');
          } }))));
      }
      body.append(evSec);

      // --- comments
      const cm = h('input', { class: 'input', placeholder: 'Tulis komentar…', disabled: BGS.isRole('viewer') });
      const send = () => { const v = cm.value.trim(); if (!v) return; t.comments.push({ by: me(), at: stamp(), text: v }); BGS.audit('Komentar task', 'Task', t.id, v.slice(0, 80)); [t.assigneeId, t.verifierId].filter(u => u && u !== me()).forEach(u => BGS.notify(u, `Komentar baru pada task "${t.title}" (${t.caseId})`, '#/tasks')); draw(); };
      body.append(h('div', { class: 'tk-sec' }, h('h4', null, BGS.icon('mail', 15), `Komentar (${t.comments.length})`),
        t.comments.length ? t.comments.map(k => h('div', { class: 'tk-cm' }, ui.avatar(nameOf(k.by), '#334155', 26), h('div', null, h('div', null, h('b', null, nameOf(k.by)), ' ', h('span', { class: 'muted sm' }, fmt.dateTime(k.at))), h('div', null, k.text)))) : h('div', { class: 'muted sm' }, 'Belum ada komentar.'),
        h('div', { class: 'row gap-sm', style: 'margin-top:8px' }, cm, ui.btn('Kirim', { icon: 'send', sm: true, disabled: BGS.isRole('viewer'), title: BGS.isRole('viewer') ? 'Viewer hanya dapat melihat' : null, onClick: send }))));

      // --- history from audit
      const hist = (t.history && t.history.length ? t.history.slice(-8).reverse().map(a => ({ text: a.text, by: a.by, at: a.at, tone: /tolak|terhambat/i.test(a.text) ? 'red' : /selesai|setuju|verifikasi/i.test(a.text) ? 'green' : 'blue' }))
        : D.audit.filter(a => a.entityId === t.id).slice(0, 8).map(a => ({ text: a.action + (a.detail ? ' — ' + a.detail : ''), by: a.userId, at: a.at, tone: /tolak|terhambat/i.test(a.action) ? 'red' : /selesai|setuju|verifikasi/i.test(a.action) ? 'green' : 'blue' })));
      if (hist.length) body.append(h('div', { class: 'tk-sec' }, h('h4', null, BGS.icon('clock', 15), 'Riwayat aktivitas'), ui.timeline(hist)));

      // --- actions
      const act = (label, o) => {
        if (o.chk && !o.chk.ok) whys.push(`${label}: ${o.chk.why}`);
        const why = o.why || (o.chk && !o.chk.ok ? o.chk.why : null);
        foot.append(ui.btn(label, { kind: o.kind, icon: o.icon, disabled: !!why, title: why || o.title, onClick: o.fn }));
      };
      const st = t.status;
      if (st === 'TODO') act('Mulai', { kind: 'primary', icon: 'play', chk: ex, why: ex.ok && locked ? 'Langkah masih terkunci: selesaikan langkah sebelumnya dulu (RUL-014).' : null, fn: () => exec('start', {}, 'Task dimulai') });
      if (st === 'REJECTED') act('Kerjakan ulang', { kind: 'primary', icon: 'play', chk: ex, fn: () => exec('start', {}, 'Task dikerjakan ulang') });
      if (['IN_PROGRESS', 'WAITING_EVIDENCE'].includes(st)) {
        if (verif !== 'NONE') act('Ajukan verifikasi', { kind: 'primary', icon: 'send', chk: ex, why: ex.ok && needEvidence ? 'Langkah eksternal butuh file bukti + nomor referensi dulu (BR-033).' : null, fn: () => exec('request_verification', {}, 'Diajukan ke pemeriksa') });
        else act('Selesai', { kind: 'good', icon: 'check', chk: ex, why: ex.ok && needEvidence ? 'Langkah eksternal butuh file bukti + nomor referensi dulu (BR-033).' : null, fn: () => exec('complete', {}, 'Task selesai') });
      }
      if (st === 'PENDING_VERIFICATION') {
        act('Tolak', { kind: 'danger', icon: 'x', chk: vf, fn: reject });
        act('Verifikasi', { kind: 'good', icon: 'check', chk: vf, fn: () => exec('verify', {}, 'Task diverifikasi') });
      }
      if (st === 'PENDING_APPROVAL') {
        act('Tolak', { kind: 'danger', icon: 'x', chk: ap, fn: reject });
        act('Setujui', { kind: 'good', icon: 'check', chk: ap, fn: () => exec('approve', {}, 'Task disetujui') });
      }
      if (['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'REJECTED'].includes(st) && !locked) act('Tandai terhambat', { icon: 'alert', chk: ex, fn: block });
      if (st === 'BLOCKED') act('Buka hambatan', { kind: 'warn', icon: 'refresh', chk: ex, fn: () => exec('unblock', {}, 'Hambatan dibuka, task berjalan lagi') });
      if (st === 'COMPLETED') { act('Selesai', { icon: 'check', why: 'Task sudah selesai.', fn: null }); whys.length = 0; }
      if (st === 'CANCELLED') foot.append(h('span', { class: 'muted' }, 'Task dibatalkan.'));
      // viewer note
      if (whys.length) body.append(h('div', { class: 'tk-why' }, h('b', null, 'Kenapa ada tombol nonaktif? '), [...new Set(whys)].join(' · ')));
      if (!foot.childNodes.length) foot.append(h('span', { class: 'muted sm' }, 'Tidak ada aksi untuk status ini.'));
    }
    draw();
    return drawer;
  };

  // ====================== /tasks ======================
  let tkTab = 'mine';
  const taskStatusOptions = () => D.taskStatuses.map(s => [s, BGS.ST.task[s][0]]);
  function workload(list) {
    const live = list.filter(isLive), done = list.filter(t => t.status === 'COMPLETED');
    const onTime = done.filter(t => { const si = stepInst(D.case(t.caseId), t.stepId); return !si || !si.completedAt || new Date(si.completedAt) <= new Date(t.dueAt); }).length;
    return { active: live.length, overdue: live.filter(isOverdue).length, soon: live.filter(isSoon).length, blocked: live.filter(t => t.status === 'BLOCKED').length, done: done.length, onTime, rate: done.length ? Math.round(onTime / done.length * 100) : null };
  }

  BGS.router.add('/tasks', {
    title: 'Tugas', roles: BGS.ROLES.OPS.concat(['pic']), mvp: 2,
    render(ctx) {
      const el = ctx.el, isOps = BGS.isRole('superadmin', 'admin');
      const open = t => BGS.taskDrawer(t.id, { onChange: ctx.refresh });
      const all = BGS.scope.tasks();
      const mine = all.filter(t => t.assigneeId === me() && !DONE.includes(t.status));
      const toVerify = all.filter(t => t.status === 'PENDING_VERIFICATION' && canVerify(info(t)).ok && t.executorId !== me());
      const toApprove = all.filter(t => t.status === 'PENDING_APPROVAL' && canApprove(info(t)).ok);
      const scopeForLoad = isOps ? all : all.filter(t => t.assigneeId === me());
      const wl = workload(scopeForLoad);

      el.append(ui.pageHeader({ title: 'Tugas', subtitle: BGS.isRole('pic') ? 'Tugas yang ditugaskan kepada Anda dan yang perlu Anda periksa.' : 'Kerjakan, verifikasi, dan setujui tugas proses penempatan.', mvp: 2 }));
      el.append(h('div', { class: 'grid cols-4', style: 'margin-bottom:14px' },
        ui.kpi({ label: isOps ? 'Tugas aktif (semua)' : 'Tugas aktif saya', value: wl.active, sub: `${wl.blocked} terhambat`, tone: 'blue', icon: 'check-square' }),
        ui.kpi({ label: 'Terlambat', value: wl.overdue, sub: 'tenggat lewat (RUL-028)', tone: 'red', icon: 'alert' }),
        ui.kpi({ label: 'Jatuh tempo ≤ 3 hari', value: wl.soon, sub: 'segera dikerjakan', tone: 'amber', icon: 'clock' }),
        ui.kpi({ label: 'Tepat waktu', value: wl.rate == null ? '—' : wl.rate + '%', sub: `${wl.onTime} dari ${wl.done} tugas selesai · BR-031`, tone: 'green', icon: 'award' })));

      const columns = [
        { key: 'title', label: 'Tugas', sortable: true, sortValue: t => t.title, render: t => h('div', null, h('div', { class: 'b' }, t.title), h('div', { class: 'muted sm mono' }, t.id)) },
        { key: 'case', label: 'Case / Worker', render: t => caseCell(info(t)) },
        { key: 'assignee', label: 'Pelaksana', render: t => userCell(t.assigneeId) },
        { key: 'status', label: 'Status', render: t => ui.status('task', t.status) },
        { key: 'due', label: 'Tenggat', sortable: true, sortValue: t => +new Date(dueOf(t)), render: dueCell },
        { key: 'ref', label: 'Ref. eksternal', render: t => refChip(info(t)) },
        { key: 'go', label: '', align: 'right', render: t => ui.btn('Buka', { sm: true, icon: 'chevron-right', onClick: () => open(t) }) },
      ];
      const list = (rows, emptyMsg) => ui.listView({
        items: () => rows, columns, onRowClick: open, pageSize: 10, sortKey: 'due', sortDir: 1, searchPlaceholder: 'Cari tugas, case, atau nama worker…',
        search: t => { const x = info(t); return [t.title, t.id, t.caseId, x.w && x.w.name, nameOf(t.assigneeId)].join(' '); },
        rowClass: t => (t.status === 'BLOCKED' ? 'row-danger' : ''),
        filters: [
          { key: 'status', label: 'Status', options: taskStatusOptions() },
          { key: 'role', label: 'PIC role', options: Object.entries(ROLE_LABEL) },
          { key: 'due', label: 'Tenggat', options: [['late', 'Terlambat'], ['soon', 'Jatuh tempo ≤ 3 hari'], ['ok', 'Belum jatuh tempo']], match: (t, v) => (v === 'late' ? isOverdue(t) : v === 'soon' ? isSoon(t) : !isOverdue(t) && !isSoon(t)) },
        ],
        empty: ui.emptyState({ icon: 'check-circle', title: emptyMsg.t, text: emptyMsg.d }),
      });
      const tabs = [
        { id: 'mine', label: 'Milik saya', count: mine.length, render: () => list(mine, { t: 'Tidak ada tugas aktif untuk Anda', d: 'Tugas baru akan muncul saat langkah proses sampai ke giliran Anda.' }) },
        { id: 'verify', label: 'Perlu saya verifikasi', count: toVerify.length, render: () => h('div', null, ui.callout('info', null, 'Hanya task yang bukan Anda kerjakan sendiri (RUL-016). Admin/Superadmin dapat memeriksa task mana pun selama bukan pelaksananya.'), list(toVerify, { t: 'Tidak ada yang menunggu verifikasi Anda', d: 'Task yang diajukan pelaksana untuk diperiksa akan tampil di sini.' })) },
        { id: 'approve', label: 'Perlu approval', count: toApprove.length, render: () => list(toApprove, { t: 'Tidak ada yang menunggu approval Anda', d: 'Approval hanya untuk langkah yang diatur butuh persetujuan, dan oleh orang selain pelaksana/pemeriksa.' }) },
      ];
      if (isOps) tabs.push({ id: 'all', label: 'Semua', count: all.length, render: () => list(all, { t: 'Belum ada task', d: 'Task dibuat otomatis saat case diaktifkan.' }) });
      if (!tabs.some(t => t.id === tkTab)) tkTab = 'mine';
      el.append(h('section', { class: 'card' }, h('div', { class: 'card-b flush' }, ui.tabs(tabs, { active: tkTab, onChange: id => { tkTab = id; } }))));

      if (isOps) {
        const pics = D.users.filter(u => u.active && u.roles.includes('pic'));
        const rows = pics.map(u => ({ u, w: workload(D.tasks.filter(t => t.assigneeId === u.id)) }));
        el.append(h('details', { class: 'card', style: 'margin-top:14px' }, h('summary', { style: 'padding:14px 16px;cursor:pointer;font-weight:800' }, 'Beban kerja per PIC (BR-031)'),
          h('div', { class: 'card-b flush' }, ui.table({ pageSize: 20, dense: true, rows, columns: [
            { label: 'PIC', render: r => userCell(r.u.id) },
            { label: 'Aktif', align: 'right', render: r => r.w.active },
            { label: 'Terlambat', align: 'right', render: r => (r.w.overdue ? h('span', { class: 'tk-od' }, r.w.overdue) : 0) },
            { label: '≤ 3 hari', align: 'right', render: r => r.w.soon },
            { label: 'Terhambat', align: 'right', render: r => r.w.blocked },
            { label: 'Tepat waktu', render: r => (r.w.rate == null ? h('span', { class: 'muted' }, '—') : h('div', { class: 'row gap-sm' }, ui.progress(r.w.rate, r.w.rate >= 80 ? 'green' : r.w.rate >= 60 ? 'amber' : 'red'), h('span', { class: 'sm b' }, r.w.rate + '%'))) },
          ] }))));
      }
    },
  });

  // ====================== /monitor ======================
  let monTab = 'late';
  function changeDue(x, done) {
    const { t, c, si } = x; const cur = dueOf(t);
    let m;
    const dateIn = h('input', { class: 'input', type: 'date', value: ymd(cur) });
    const reasonIn = h('textarea', { class: 'input', rows: 3, placeholder: 'Mis. menunggu jadwal klinik yang baru' });
    const err = h('div', { class: 'field-err', style: 'display:none' });
    const preview = h('div', { class: 'muted sm' });
    const upd = () => { const v = dateIn.value; preview.textContent = v ? `Tenggat berubah dari ${fmt.date(cur)} ke ${fmt.date(v + 'T12:00:00')} (${fmt.rel(v + 'T12:00:00')}).` : ''; };
    dateIn.addEventListener('input', upd); upd();
    const save = () => {
      err.style.display = 'none';
      if (!dateIn.value) { err.textContent = 'Tanggal baru wajib diisi.'; err.style.display = 'block'; return; }
      if (dateIn.value === ymd(cur)) { err.textContent = 'Tanggal sama dengan tenggat sekarang.'; err.style.display = 'block'; return; }
      if (!reasonIn.value.trim()) { err.textContent = 'Alasan wajib diisi (RUL-022).'; err.style.display = 'block'; reasonIn.classList.add('invalid'); return; }
      const iso = new Date(`${dateIn.value}T17:00:00+07:00`).toISOString(), reason = reasonIn.value.trim(), old = cur;
      t.dueAt = iso; if (si) si.dueAt = iso;
      t.comments.push({ by: me(), at: stamp(), text: `Tenggat diubah ke ${fmt.date(iso)}. Alasan: ${reason}` });
      BGS.audit('Tenggat diubah', 'Task', t.id, `${fmt.date(old)} → ${fmt.date(iso)} (${t.caseId}). Alasan: ${reason}`);
      if (t.assigneeId !== me()) BGS.notify(t.assigneeId, `Tenggat "${t.title}" (${t.caseId}) diubah ke ${fmt.date(iso)}`, '#/tasks');
      m.close(); ui.toast('Tenggat berhasil diubah dan tercatat di audit'); done();
    };
    m = ui.modal({
      title: 'Ubah tenggat', size: 'sm',
      body: h('div', { class: 'stack' }, h('div', null, h('b', null, t.title), h('div', { class: 'muted sm' }, `${c.id} · tenggat sekarang ${fmt.date(cur)}`)),
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Tenggat baru', h('i', { class: 'req' }, '*')), dateIn, preview),
        h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Alasan perubahan', h('i', { class: 'req' }, '*')), reasonIn, h('span', { class: 'hint' }, 'Perubahan tenggat wajib beralasan dan masuk audit (RUL-022).')), err),
      footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Simpan tenggat', { kind: 'primary', onClick: save })],
    });
  }

  BGS.router.add('/monitor', {
    title: 'Hambatan & terlambat', roles: BGS.ROLES.ALL, mvp: 2,
    render(ctx) {
      const el = ctx.el, canEdit = BGS.isRole('superadmin', 'admin');
      const ids = scopeCaseIds();
      const infos = D.tasks.filter(t => ids.has(t.caseId)).map(info).filter(x => x.c);
      const late = infos.filter(x => isOverdue(x.t)).sort((a, b) => +new Date(dueOf(a.t)) - +new Date(dueOf(b.t)));
      const blocked = infos.filter(x => isLive(x.t) && x.t.status === 'BLOCKED').sort((a, b) => +new Date((activeBlocker(a.t) || { at: a.t.dueAt }).at) - +new Date((activeBlocker(b.t) || { at: b.t.dueAt }).at));
      const soon = infos.filter(x => isSoon(x.t)).sort((a, b) => +new Date(dueOf(a.t)) - +new Date(dueOf(b.t)));
      const affected = new Set([...late, ...blocked].map(x => x.c.id)).size;
      const refresh = ctx.refresh, open = x => BGS.taskDrawer(x.t.id, { onChange: refresh });

      el.append(ui.pageHeader({ title: 'Hambatan & terlambat', subtitle: 'Pantau task yang terlambat, terhambat, atau hampir jatuh tempo — lalu tindak lanjuti.', mvp: 2 }));
      el.append(h('div', { class: 'grid cols-4', style: 'margin-bottom:14px' },
        ui.kpi({ label: 'Task terlambat', value: late.length, sub: 'tenggat sudah lewat', tone: 'red', icon: 'clock' }),
        ui.kpi({ label: 'Task terhambat', value: blocked.length, sub: 'ditandai dengan alasan', tone: 'orange', icon: 'alert' }),
        ui.kpi({ label: 'Jatuh tempo ≤ 3 hari', value: soon.length, sub: 'perlu perhatian', tone: 'amber', icon: 'calendar' }),
        ui.kpi({ label: 'Case terdampak', value: affected, sub: 'ada task terlambat/terhambat', tone: 'purple', icon: 'briefcase' })));
      el.append(ui.callout('info', 'Definisi terlambat (RUL-028)', 'Task terlambat bila tenggatnya sudah lewat dan statusnya bukan Selesai/Dibatalkan. Langkah proses dianggap terlambat bila ada task-nya yang terlambat. "Terhambat" adalah penanda manual dengan kategori dan alasan (RUL-022).'));

      const actions = x => h('div', { class: 'row gap-sm', style: 'justify-content:flex-end;flex-wrap:nowrap;white-space:nowrap' },
        ui.btn('Buka', { sm: true, icon: 'eye', onClick: () => open(x) }),
        ui.btn('Ubah tenggat', { sm: true, icon: 'calendar', disabled: !canEdit, title: canEdit ? 'Ubah tenggat (alasan wajib)' : 'Hanya Admin/Superadmin yang dapat mengubah tenggat', onClick: () => changeDue(x, refresh) }),
        h('a', { class: 'btn btn-sm', href: `#/cases/${x.c.id}`, title: 'Buka case untuk mengganti PIC' }, BGS.icon('user', 14), 'Ganti PIC'));
      const stepCell = x => h('div', null, h('div', { class: 'b' }, x.t.title), h('div', { class: 'row gap-sm', style: 'margin-top:2px' }, ui.status('task', x.t.status), h('span', { class: 'muted sm mono' }, x.t.id)));
      const picOpts = [...new Set(infos.map(x => x.t.assigneeId))].map(u => [u, nameOf(u)]);
      const filters = [
        { key: 'pic', label: 'PIC', options: picOpts, match: (x, v) => x.t.assigneeId === v },
        { key: 'country', label: 'Negara', options: D.countries.map(c => [c.code, c.name]), match: (x, v) => x.c.country === v },
      ];
      const base = { search: x => [x.t.title, x.c.id, x.w && x.w.name, nameOf(x.t.assigneeId)].join(' '), filters, onRowClick: open, searchPlaceholder: 'Cari case, worker, atau langkah…', pageSize: 10 };
      const common = { caseCol: { label: 'Case / Worker', render: caseCell }, step: { label: 'Langkah / task', render: stepCell }, pic: { label: 'PIC', render: x => userCell(x.t.assigneeId) } };
      const tabs = [
        { id: 'late', label: 'Terlambat', count: late.length, render: () => ui.listView(Object.assign({ items: () => late, columns: [common.caseCol, common.step, common.pic,
          { label: 'Tenggat', render: x => fmt.date(dueOf(x.t)) },
          { label: 'Terlambat', render: x => ui.badge(`${daysLate(x.t)} hari`, daysLate(x.t) > 5 ? 'red' : 'amber') },
          { label: 'Hambatan', render: x => (x.t.status === 'BLOCKED' ? h('span', { class: 'sm' }, (activeBlocker(x.t) || {}).reason || x.t.blockedReason || 'Terhambat') : h('span', { class: 'muted sm' }, '—')) },
          { label: '', align: 'right', render: actions }],
          empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada task terlambat', text: 'Semua task aktif masih dalam tenggat.' }) }, base)) },
        { id: 'blocked', label: 'Terhambat', count: blocked.length, render: () => ui.listView(Object.assign({ items: () => blocked, columns: [common.caseCol, common.step, common.pic,
          { label: 'Kategori', render: x => ui.badge((activeBlocker(x.t) || {}).category || 'Tidak dikategorikan', 'red') },
          { label: 'Alasan', render: x => h('div', { style: 'max-width:280px' }, (activeBlocker(x.t) || {}).reason || x.t.blockedReason || '—') },
          { label: 'Sejak', render: x => { const b = activeBlocker(x.t); return b ? h('div', null, fmt.date(b.at), h('div', { class: 'sm muted' }, fmt.rel(b.at))) : '—'; } },
          { label: '', align: 'right', render: actions }],
          empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada task terhambat', text: 'Task yang ditandai terhambat akan muncul di sini beserta kategori dan alasannya.' }) }, base)) },
        { id: 'soon', label: 'Mendekati tenggat', count: soon.length, render: () => ui.listView(Object.assign({ items: () => soon, columns: [common.caseCol, common.step, common.pic,
          { label: 'Tenggat', render: x => h('div', null, h('span', { class: 'tk-soon' }, fmt.date(dueOf(x.t))), h('div', { class: 'sm muted' }, fmt.rel(dueOf(x.t)))) },
          { label: '', align: 'right', render: actions }],
          empty: ui.emptyState({ icon: 'calendar', title: 'Tidak ada yang jatuh tempo dalam 3 hari', text: 'Bagus! Tidak ada task aktif yang mendekati tenggat.' }) }, base)) },
      ];
      el.append(h('section', { class: 'card' }, h('div', { class: 'card-b flush' }, ui.tabs(tabs, { active: monTab, onChange: id => { monTab = id; } }))));
    },
  });

  // ====================== /final-verification ======================
  let fvSel = null, fvLast = null;
  const progOf = c => { const n = c.steps.filter(s => s.status !== 'SKIPPED').length || 1; return Math.round(c.steps.filter(s => s.status === 'COMPLETED').length / n * 100); };
  const failing = r => (r && r.checks ? r.checks.filter(k => !k.ok) : []);
  function fixLinks(chk, c) {
    const key = String(chk.key || '').toLowerCase() || String(chk.label || '').toLowerCase(), out = [];
    if (/step|langkah|task|tugas/.test(key)) out.push(['Buka case & langkah', `#/cases/${c.id}`]);
    if (/dok|doc|berkas|paspor/.test(key)) out.push(['Periksa dokumen', `#/documents?owner=${c.workerId}`], ['Dokumen case', `#/documents?owner=${c.id}`]);
    if (/checklist|compliance/.test(key)) out.push(['Buka checklist', `#/compliance/checklists`]);
    if (/blocker|hambat/.test(key)) out.push(['Lihat hambatan', `#/monitor`]);
    if (/quota|kuota/.test(key)) out.push(['Lihat kuota', `#/placement-codes/${c.placementCodeId}`]);
    if (!out.length) out.push(['Buka case', `#/cases/${c.id}`]);
    return out;
  }

  BGS.router.add('/final-verification', {
    title: 'Verifikasi akhir', roles: ['superadmin', 'director', 'admin'], mvp: 2,
    render(ctx) {
      const el = ctx.el, scoped = BGS.scope.cases();
      const near = scoped.filter(c => c.status === 'IN_PROCESS' && c.steps.some(s => s.status === 'COMPLETED')).sort((a, b) => progOf(b) - progOf(a));
      const fin = scoped.filter(c => c.status === 'FINAL_VERIFICATION'), ready = scoped.filter(c => c.status === 'READY_TO_DEPART');
      const queue = [...fin, ...near, ...ready];
      if (ctx.query.case && queue.some(c => c.id === ctx.query.case)) fvSel = ctx.query.case;
      if (!fvSel || !queue.some(c => c.id === fvSel)) fvSel = (queue[0] || {}).id || null;
      const dirOn = !!D.settings.directorApprovesFinal;

      el.append(ui.pageHeader({ title: 'Verifikasi akhir', subtitle: 'Gerbang terakhir sebelum worker boleh berangkat. Semua 5 syarat harus terpenuhi (RUL-018).', mvp: 2 }));
      if (!BGS.domain) el.append(ui.callout('danger', 'Mesin proses belum dimuat', 'Pemeriksaan syarat membutuhkan domain.js. Muat ulang halaman.'));

      const item = c => { const w = D.worker(c.workerId); return h('button', { class: 'fv-item' + (c.id === fvSel ? ' on' : ''), onClick: () => { fvSel = c.id; fvLast = null; ctx.refresh(); } },
        h('div', { class: 'row between' }, h('span', { class: 'mono b' }, c.id), ui.status('case', c.status)),
        h('div', null, w ? w.name : '—', h('span', { class: 'muted sm' }, ` · ${D.cn(c.country)} · ${D.pn(c.profession)}`)),
        h('div', { class: 'row gap-sm' }, ui.progress(progOf(c), progOf(c) === 100 ? 'green' : 'orange'), h('span', { class: 'sm b' }, progOf(c) + '%'))); };
      const grp = (title, hint, list) => [h('div', { class: 'fv-grp' }, `${title} (${list.length})`), list.length ? list.map(item) : h('div', { class: 'muted sm' }, hint)];
      const left = h('div', { class: 'fv-queue' }, grp('Hampir selesai', 'Belum ada case dengan langkah selesai.', near), grp('Sedang verifikasi akhir', 'Tidak ada case di tahap ini.', fin), grp('Siap berangkat', 'Belum ada case siap berangkat.', ready));
      const panel = h('div', { class: 'stack' });
      el.append(h('div', { class: 'grid cols-12', style: 'align-items:start' }, ui.card({ title: 'Antrean case', subtitle: `${queue.length} case`, icon: 'list', body: left }), panel));

      const c = fvSel && D.case(fvSel);
      if (!c) { panel.append(ui.emptyState({ icon: 'shield', title: 'Belum ada case untuk diverifikasi', text: 'Case muncul di sini setelah ada langkah proses yang selesai.' })); return; }
      const w = D.worker(c.workerId), canFinal = BGS.can('final.verify'), isDir = BGS.isRole('director');
      let res = null, err = null;
      if (BGS.domain && BGS.domain.finalChecks) { try { res = BGS.domain.finalChecks(c.id); } catch (e) { err = e; } }
      const bad = failing(res), ok = !!(res && res.ok);
      const pending = c.finalApproval && c.finalApproval.status === 'PENDING';

      panel.append(ui.card({ title: `Verifikasi akhir — ${c.id}`, icon: 'shield', actions: ui.status('case', c.status), body: h('div', { class: 'stack' },
        ui.kv([['Worker', w ? ui.workerLink(w.id) : '—'], ['Negara · profesi', `${D.cn(c.country)} · ${D.pn(c.profession)}`], ['Placement Code', ui.codeLink(c.placementCodeId)], ['Rencana berangkat', fmt.date(c.plannedDeparture)], ['Case Owner', ui.userChip(c.ownerId)], ['Progres langkah', h('div', { class: 'row gap-sm' }, ui.progress(progOf(c), 'green'), progOf(c) + '%')]], 2),
      ) }));

      if (err) panel.append(ui.callout('danger', 'Pemeriksaan syarat gagal dijalankan', err.message));
      if (res) {
        panel.append(ui.card({ title: 'Lima syarat (RUL-018)', subtitle: ok ? 'Semua syarat terpenuhi' : `${bad.length} syarat belum terpenuhi`, icon: ok ? 'check-circle' : 'alert', body: h('div', { class: 'stack' },
          res.checks.map(k => h('div', { class: 'fv-check ' + (k.ok ? 'ok' : 'bad') }, h('div', { class: 'fv-ic' }, BGS.icon(k.ok ? 'check' : 'x', 20)),
            h('div', { class: 'grow' }, h('div', { class: 'fv-t' }, k.label), k.detail && h('div', { class: 'fv-d' }, k.detail),
              !k.ok && h('div', { class: 'row wrap gap-sm', style: 'margin-top:8px' }, fixLinks(k, c).map(([l, href]) => h('a', { class: 'btn btn-sm', href }, BGS.icon('arrow-right', 14), l)))))),
          ui.disclaimer()) }));
      }

      // --- decision / actions
      const decision = h('div', { class: 'stack' });
      if (fvLast && fvLast.caseId === c.id && fvLast.failing.length) decision.append(ui.callout('danger', 'Verifikasi akhir tidak lolos', h('div', null, 'Syarat berikut belum terpenuhi:', h('ul', { style: 'margin:6px 0 0 18px;padding:0' }, fvLast.failing.map(k => h('li', null, h('b', null, k.label), k.detail ? ' — ' + k.detail : ''))), 'Case belum bisa ke Siap berangkat. Lengkapi kekurangan di atas, atau kembalikan case ke Diproses dengan alasan.')));
      if (c.status === 'READY_TO_DEPART') decision.append(ui.callout('good', 'Lolos verifikasi akhir — siap berangkat', h('span', null, 'Lanjutkan ke ', h('a', { class: 'lnk', href: '#/departures' }, 'halaman Keberangkatan'), ' untuk mencatat data penerbangan (RUL-030).')));
      if (c.status === 'DRAFT' || c.status === 'ON_HOLD') decision.append(ui.callout('warn', 'Case belum aktif', 'Case harus berstatus Diproses untuk verifikasi akhir.'));
      const fa = c.finalApproval || null, faSt = fa && fa.status;
      if (dirOn && faSt === 'PENDING') decision.append(ui.callout('info', 'Menunggu persetujuan Director', `Diajukan oleh ${nameOf(fa.by)} pada ${fmt.dateTime(fa.at)}. Persetujuan Director diaktifkan di pengaturan (A-15).`));
      if (dirOn && faSt === 'APPROVED' && c.status !== 'READY_TO_DEPART') decision.append(ui.callout('good', 'Director sudah menyetujui', `Disetujui ${nameOf(fa.decidedBy)} pada ${fmt.dateTime(fa.decidedAt)}. Admin dapat menjalankan verifikasi akhir.`));
      if (dirOn && faSt === 'REJECTED') decision.append(ui.callout('danger', 'Ditolak Director', `${fa.reason || ''} — ${nameOf(fa.decidedBy)}, ${fmt.dateTime(fa.decidedAt)}`));

      const btns = [];
      const stateOk = ['IN_PROCESS', 'FINAL_VERIFICATION'].includes(c.status);
      const runFinal = async () => {
        if (!BGS.domain || !BGS.domain.finalVerify) return noDomain();
        if (c.status !== 'FINAL_VERIFICATION') { // case still in processing: show what is missing
          fvLast = { caseId: c.id, failing: bad.length ? bad : [{ label: 'Langkah wajib belum selesai', detail: 'Case otomatis masuk Verifikasi akhir saat semua langkah wajib selesai.' }] };
          ui.toast('Case belum bisa lolos — masih ada syarat yang kurang', 'warn'); return ctx.refresh();
        }
        try {
          const r = await BGS.domain.finalVerify(c.id);
          if (r && r.ok === false) { fvLast = { caseId: c.id, failing: failing(r) }; ui.toast('Verifikasi akhir tidak lolos', 'warn'); }
          else { fvLast = null; ui.toast('Lolos verifikasi akhir — case siap berangkat'); }
        } catch (e) {
          let f = []; try { f = failing(BGS.domain.finalChecks(c.id)); } catch (x) { /* ignore */ }
          fvLast = { caseId: c.id, failing: f.length ? f : [{ label: 'Verifikasi ditolak', detail: e.message }] }; ui.toast(e.message || 'Verifikasi akhir tidak lolos', 'danger');
        }
        ctx.refresh();
      };
      const submitToDirector = () => {
        if (!ok || c.status !== 'FINAL_VERIFICATION') { fvLast = { caseId: c.id, failing: bad.length ? bad : [{ label: 'Case belum di tahap Verifikasi akhir', detail: 'Selesaikan semua langkah wajib dulu.' }] }; ui.toast('Masih ada syarat yang belum terpenuhi', 'warn'); return ctx.refresh(); }
        c.finalApproval = { status: 'PENDING', by: me(), at: stamp() };
        BGS.audit('Verifikasi akhir diajukan ke Director', 'Placement Case', c.id, 'Semua syarat RUL-018 terpenuhi');
        BGS.notify('U03', `Persetujuan verifikasi akhir ${c.id} menunggu Anda`, '#/final-verification?case=' + c.id);
        fvLast = null; ui.toast('Diajukan ke Director'); ctx.refresh();
      };
      const directorDecide = async approve => {
        let reason = null;
        if (!approve) { reason = await ui.reasonPrompt({ title: 'Tolak verifikasi akhir', label: 'Alasan penolakan', confirmLabel: 'Tolak', tone: 'danger' }); if (!reason) return; }
        c.finalApproval = Object.assign({}, fa, { status: approve ? 'APPROVED' : 'REJECTED', decidedBy: me(), decidedAt: stamp(), reason });
        BGS.audit(approve ? 'Verifikasi akhir disetujui Director' : 'Verifikasi akhir ditolak Director', 'Placement Case', c.id, approve ? '' : 'Alasan: ' + reason);
        BGS.notify(fa.by, approve ? `Director menyetujui verifikasi akhir ${c.id}` : `Director menolak verifikasi akhir ${c.id}: ${reason}`, '#/final-verification?case=' + c.id);
        ui.toast(approve ? 'Disetujui — Admin dapat menyelesaikan verifikasi akhir' : 'Ditolak dan dikembalikan ke Admin', approve ? 'good' : 'warn'); ctx.refresh();
      };
      const sendBack = async () => {
        const reason = await ui.reasonPrompt({ title: 'Kembalikan ke Diproses', message: 'Case kembali ke tahap Diproses agar kekurangan dilengkapi.', label: 'Alasan', confirmLabel: 'Kembalikan', tone: 'warn', presets: ['Dokumen belum lengkap', 'Masih ada langkah belum selesai', 'Ada hambatan aktif'] });
        if (!reason) return;
        c.status = 'IN_PROCESS'; delete c.finalApproval; c.comments.push({ at: stamp(), by: me(), text: 'Dikembalikan ke Diproses dari verifikasi akhir: ' + reason });
        BGS.audit('Case dikembalikan ke Diproses', 'Placement Case', c.id, 'Alasan: ' + reason); BGS.notify(c.ownerId, `Case ${c.id} dikembalikan ke Diproses: ${reason}`, '#/cases/' + c.id);
        BGS.computeQuota(); BGS.deriveWorkerStatus(); fvLast = null; ui.toast('Case dikembalikan ke Diproses', 'warn'); ctx.refresh();
      };
      if (canFinal && c.status !== 'READY_TO_DEPART') {
        if (dirOn && faSt !== 'APPROVED') btns.push(ui.btn('Ajukan ke Director', { kind: 'primary', icon: 'send', disabled: !stateOk || faSt === 'PENDING', title: !stateOk ? 'Case harus berstatus Diproses/Verifikasi akhir' : faSt === 'PENDING' ? 'Sudah diajukan, menunggu Director' : 'Memeriksa syarat lalu meminta persetujuan Director', onClick: submitToDirector }));
        else btns.push(ui.btn('Jalankan verifikasi akhir', { kind: 'primary', icon: 'shield', disabled: !stateOk, title: !stateOk ? 'Case harus berstatus Diproses/Verifikasi akhir' : null, onClick: runFinal }));
      }
      if (canFinal && c.status === 'FINAL_VERIFICATION') btns.push(ui.btn('Kembalikan ke Diproses', { icon: 'refresh', onClick: sendBack }));
      if (isDir && dirOn && faSt === 'PENDING') btns.push(ui.btn('Tolak', { kind: 'danger', icon: 'x', onClick: () => directorDecide(false) }), ui.btn('Setujui verifikasi akhir', { kind: 'good', icon: 'check', disabled: !ok, title: !ok ? 'Masih ada syarat yang belum terpenuhi' : null, onClick: () => directorDecide(true) }));
      if (!canFinal && !(isDir && dirOn)) decision.append(h('div', { class: 'muted sm' }, `Peran ${roleName()} hanya dapat melihat hasil pemeriksaan. Verifikasi akhir dilakukan Admin/Superadmin (A-15).`));
      if (isDir && dirOn && faSt !== 'PENDING' && c.status !== 'READY_TO_DEPART') decision.append(h('div', { class: 'muted sm' }, 'Director menyetujui setelah Admin menjalankan pemeriksaan dan semua syarat terpenuhi.'));
      if (isDir && !dirOn) decision.append(h('div', { class: 'muted sm' }, 'Persetujuan Director untuk verifikasi akhir sedang tidak diwajibkan (pengaturan sistem).'));
      decision.append(h('div', { class: 'row wrap gap-sm' }, btns, ui.btn('Ajukan waiver langkah wajib', { icon: 'lock', disabled: true, title: 'Waiver langkah wajib tidak diperbolehkan secara default (A-15b). Hanya bisa diaktifkan sebagai proses strategis dengan persetujuan Director.' })));
      decision.append(h('div', { class: 'muted sm' }, 'Waiver langkah wajib tidak diperbolehkan secara default (A-15b). Kekurangan harus dilengkapi lewat proses normal.'));
      panel.append(ui.card({ title: 'Keputusan', icon: 'check-square', body: decision }));
    },
  });

  // ====================== /departures ======================
  let depTab = 'ready', mfBatch = null;
  const flightOf = c => c.flight || {};
  const canRecord = c => BGS.can('departure.record') && (!BGS.isRole('pic') || (c.pics || {})['PIC Keberangkatan'] === me());
  const recordWhy = c => !BGS.can('departure.record') ? `Peran ${roleName()} tidak dapat mencatat keberangkatan.` : BGS.isRole('pic') && (c.pics || {})['PIC Keberangkatan'] !== me() ? `Hanya PIC Keberangkatan case ini (${nameOf(c.pics['PIC Keberangkatan'])}) yang dapat mencatat.` : null;
  const batchName = id => (D.batches.find(b => b.id === id) || {}).name || '—';
  const DEP_COLS = [
    { label: 'Case ID', value: c => c.id }, { label: 'Worker ID', value: c => c.workerId }, { label: 'Nama worker', value: c => (D.worker(c.workerId) || {}).name },
    { label: 'Negara', value: c => D.cn(c.country) }, { label: 'Profesi', value: c => D.pn(c.profession) }, { label: 'Placement Code', value: c => c.placementCodeId }, { label: 'Batch', value: c => batchName(c.batchId) },
    { label: 'Maskapai', value: c => flightOf(c).airline }, { label: 'No. penerbangan', value: c => flightOf(c).flightNo }, { label: 'Tanggal berangkat', value: c => flightOf(c).date }, { label: 'No. tiket', value: c => flightOf(c).ticketNo },
  ];

  function departureForm(c, done) {
    const f0 = flightOf(c); let m;
    const form = ui.form({
      cols: 2, submitLabel: 'Catat keberangkatan', cancel: ui.btn('Batal', { onClick: () => m.close() }),
      fields: [
        { name: 'airline', label: 'Maskapai', required: true, value: f0.airline || '', placeholder: 'mis. Saudia' },
        { name: 'flightNo', label: 'Nomor penerbangan', required: true, value: f0.flightNo || '', placeholder: 'mis. SV 818' },
        { name: 'date', label: 'Tanggal berangkat', type: 'date', required: true, value: f0.date || '' },
        { name: 'ticketNo', label: 'Nomor tiket', required: true, value: f0.ticketNo || '', placeholder: 'mis. TKT-123456' },
      ],
      extra: ui.callout('info', 'Syarat keberangkatan (RUL-030)', 'Keberangkatan hanya bisa dicatat untuk case yang sudah lolos verifikasi akhir, dan semua data penerbangan wajib lengkap. Status worker otomatis menjadi "Sudah berangkat".'),
      onSubmit: async v => {
        if (!BGS.domain || !BGS.domain.recordDeparture) return noDomain();
        try { await BGS.domain.recordDeparture(c.id, { airline: v.airline.trim(), flightNo: v.flightNo.trim(), date: v.date, ticketNo: v.ticketNo.trim() }); BGS.computeQuota(); BGS.deriveWorkerStatus(); m.close(); ui.toast(`Keberangkatan ${(D.worker(c.workerId) || {}).name || c.id} tercatat`); done(); }
        catch (e) { ui.toast(e.message || String(e), 'danger'); }
      },
    });
    m = ui.modal({ title: `Catat keberangkatan — ${(D.worker(c.workerId) || {}).name || c.id}`, size: 'md', body: form.el });
  }

  BGS.router.add('/departures', {
    title: 'Keberangkatan', roles: ['superadmin', 'director', 'admin', 'pic'], mvp: 2,
    render(ctx) {
      const el = ctx.el, scoped = BGS.scope.cases();
      const ready = scoped.filter(c => c.status === 'READY_TO_DEPART').sort((a, b) => String(flightOf(a).date || a.plannedDeparture).localeCompare(String(flightOf(b).date || b.plannedDeparture)));
      const dep = scoped.filter(c => c.status === 'DEPARTED').sort((a, b) => String(flightOf(b).date).localeCompare(String(flightOf(a).date)));
      const canExport = BGS.can('export');
      const exportBtn = (rows, name) => ui.btn('Ekspor CSV', { icon: 'download', disabled: !canExport || !rows.length, title: !canExport ? 'Hanya Superadmin/Director/Admin yang dapat mengekspor' : !rows.length ? 'Belum ada data' : null, onClick: () => { BGS.exportCsv(rows, DEP_COLS, name); ui.toast(`${rows.length} baris diekspor`); } });
      const fmtNote = ui.callout('warn', 'Format laporan belum ditetapkan', 'Format wajib laporan keberangkatan ke instansi belum ditetapkan — kolom ekspor di bawah hanya usulan sementara (OQ-14). Pengiriman ke instansi dilakukan manual.');

      el.append(ui.pageHeader({ title: 'Keberangkatan', subtitle: 'Catat penerbangan worker yang sudah lolos verifikasi akhir, lalu ekspor data untuk pelaporan.', mvp: 2 }));
      el.append(h('div', { class: 'grid cols-3', style: 'margin-bottom:14px' },
        ui.kpi({ label: 'Siap berangkat', value: ready.length, sub: 'lolos verifikasi akhir', tone: 'teal', icon: 'plane' }),
        ui.kpi({ label: 'Sudah berangkat', value: dep.length, sub: 'tercatat di sistem', tone: 'green', icon: 'check-circle' }),
        ui.kpi({ label: 'Berangkat ≤ 7 hari ke depan', value: ready.filter(c => { const d = fmt.daysFrom(flightOf(c).date || c.plannedDeparture); return d >= 0 && d <= 7; }).length, sub: 'perlu persiapan akhir', tone: 'amber', icon: 'calendar' })));
      if (BGS.isRole('pic')) el.append(ui.callout('info', null, 'Anda hanya melihat case yang Anda tangani. PIC Keberangkatan hanya dapat mencatat keberangkatan untuk case miliknya sendiri.'));

      const readyTable = () => ui.listView({
        items: () => ready, pageSize: 10, searchPlaceholder: 'Cari worker atau case…', search: c => [c.id, (D.worker(c.workerId) || {}).name, c.placementCodeId].join(' '),
        filters: [{ key: 'country', label: 'Negara', options: D.countries.map(x => [x.code, x.name]) }],
        columns: [
          { label: 'Case / Worker', render: c => h('div', null, ui.caseLink(c.id), h('div', { class: 'sm' }, ui.workerLink(c.workerId))) },
          { label: 'Tujuan', render: c => h('div', null, `${D.cn(c.country)} · ${D.pn(c.profession)}`, h('div', { class: 'sm' }, ui.codeLink(c.placementCodeId))) },
          { label: 'Batch', render: c => batchName(c.batchId) },
          { label: 'Rencana penerbangan', render: c => { const f = flightOf(c); return f.flightNo ? h('div', null, h('div', null, `${f.airline} ${f.flightNo}`), h('div', { class: 'sm muted' }, `${fmt.date(f.date)} · ${fmt.rel(f.date)}`)) : h('div', null, fmt.date(c.plannedDeparture), h('div', { class: 'sm muted' }, 'penerbangan belum diisi')); } },
          { label: 'PIC Keberangkatan', render: c => ui.userChip(c.pics['PIC Keberangkatan']) },
          { label: '', align: 'right', render: c => ui.btn('Catat keberangkatan', { kind: 'primary', sm: true, icon: 'plane', disabled: !canRecord(c), title: recordWhy(c), onClick: () => departureForm(c, ctx.refresh) }) },
        ],
        empty: ui.emptyState({ icon: 'plane', title: 'Belum ada case siap berangkat', text: 'Case muncul di sini setelah lolos verifikasi akhir.', action: BGS.can('final.verify') || BGS.isRole('director') ? h('a', { class: 'btn btn-primary', href: '#/final-verification' }, 'Buka verifikasi akhir') : null }),
      });
      const departedTable = () => h('div', null, h('div', { style: 'padding:12px 16px;border-bottom:1px solid var(--line)' }, fmtNote),
        ui.listView({
          items: () => dep, pageSize: 10, searchPlaceholder: 'Cari worker, case, atau no. penerbangan…', search: c => [c.id, (D.worker(c.workerId) || {}).name, flightOf(c).flightNo, flightOf(c).ticketNo].join(' '),
          filters: [{ key: 'country', label: 'Negara', options: D.countries.map(x => [x.code, x.name]) }],
          toolbar: exportBtn(dep, `keberangkatan-${ymd(BGS.today)}.csv`),
          columns: [
            { label: 'Case / Worker', render: c => h('div', null, ui.caseLink(c.id), h('div', { class: 'sm' }, ui.workerLink(c.workerId))) },
            { label: 'Tujuan', render: c => `${D.cn(c.country)} · ${D.pn(c.profession)}` },
            { label: 'Maskapai / No.', render: c => `${flightOf(c).airline || '—'} ${flightOf(c).flightNo || ''}` },
            { label: 'Tanggal berangkat', render: c => h('div', null, fmt.date(flightOf(c).date), h('div', { class: 'sm muted' }, fmt.rel(flightOf(c).date))) },
            { label: 'No. tiket', render: c => h('span', { class: 'mono' }, flightOf(c).ticketNo || '—') },
            { label: 'Batch', render: c => batchName(c.batchId) },
            { label: 'Status', render: c => ui.status('case', c.status) },
          ],
          empty: ui.emptyState({ icon: 'plane', title: 'Belum ada keberangkatan tercatat', text: 'Keberangkatan yang sudah dicatat akan tampil di sini.' }),
        }));
      const manifest = () => {
        const withCases = [...D.batches, { id: '__none', name: 'Tanpa batch', code: null, capacity: null, status: 'OPEN' }];
        if (!mfBatch || !withCases.some(b => b.id === mfBatch)) mfBatch = (D.batches.find(b => scoped.some(c => c.batchId === b.id)) || D.batches[0]).id;
        const host = h('div');
        const draw = () => {
          BGS.clear(host);
          const b = withCases.find(x => x.id === mfBatch);
          const rows = scoped.filter(c => (mfBatch === '__none' ? !c.batchId : c.batchId === mfBatch));
          const cnt = s => rows.filter(c => c.status === s).length;
          host.append(h('div', { class: 'stack' },
            h('div', { class: 'row wrap between' }, h('div', { class: 'row wrap gap-sm' }, ui.kv([['Batch', h('b', null, b.name)], b.code && ['Placement Code', ui.codeLink(b.code)], b.departDate && ['Rencana berangkat', `${fmt.date(b.departDate)} (${fmt.rel(b.departDate)})`], b.capacity && ['Kapasitas', `${rows.filter(c => c.status !== 'CANCELLED').length} / ${b.capacity} worker`]].filter(Boolean), 2)), exportBtn(rows, `manifest-${b.id}.csv`)),
            h('div', { class: 'row wrap gap-sm' }, ui.badge(`${cnt('DEPARTED')} berangkat`, 'green'), ui.badge(`${cnt('READY_TO_DEPART')} siap`, 'teal'), ui.badge(`${cnt('FINAL_VERIFICATION')} verifikasi akhir`, 'pink'), ui.badge(`${cnt('IN_PROCESS') + cnt('DRAFT') + cnt('ON_HOLD')} masih diproses`, 'orange')),
            ui.table({ rows, pageSize: 15, empty: ui.emptyState({ icon: 'users', title: 'Belum ada worker di batch ini', text: 'Worker masuk batch lewat Placement Code yang terhubung ke batch ini.' }), columns: [
              { label: 'Worker', render: c => h('div', null, ui.workerLink(c.workerId), h('div', { class: 'sm' }, ui.caseLink(c.id))) },
              { label: 'Profesi', render: c => D.pn(c.profession) },
              { label: 'Status case', render: c => ui.status('case', c.status) },
              { label: 'Penerbangan', render: c => { const f = flightOf(c); return f.flightNo ? h('div', null, `${f.airline} ${f.flightNo}`, h('div', { class: 'sm muted' }, `${fmt.date(f.date)} · ${f.ticketNo}`)) : h('span', { class: 'muted sm' }, 'Belum diisi'); } },
              { label: 'Progres', render: c => h('div', { class: 'row gap-sm' }, ui.progress(progOf(c), progOf(c) === 100 ? 'green' : 'orange'), h('span', { class: 'sm' }, progOf(c) + '%')) },
            ] })));
        };
        draw();
        const sel = h('select', { class: 'input sel', title: 'Pilih batch', onChange: e => { mfBatch = e.target.value; draw(); } }, withCases.map(b => h('option', { value: b.id, selected: b.id === mfBatch }, b.name + (b.departDate ? ` · ${fmt.date(b.departDate)}` : ''))));
        return h('div', null, h('div', { class: 'toolbar' }, h('label', { class: 'row gap-sm' }, h('span', { class: 'lbl' }, 'Batch'), sel)), h('div', { style: 'padding:14px 16px' }, h('div', { style: 'margin-bottom:12px' }, fmtNote), host));
      };
      const tabs = [
        { id: 'ready', label: 'Siap berangkat', count: ready.length, render: readyTable },
        { id: 'departed', label: 'Sudah berangkat', count: dep.length, render: departedTable },
        { id: 'manifest', label: 'Manifest per batch', render: manifest },
      ];
      el.append(h('section', { class: 'card' }, h('div', { class: 'card-b flush' }, ui.tabs(tabs, { active: depTab, onChange: id => { depTab = id; } }))));
    },
  });
})();
