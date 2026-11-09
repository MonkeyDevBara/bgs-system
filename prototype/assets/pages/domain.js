/* BGS.domain — business-logic layer for Processing (M06) and PIC/Task (M07).
   No UI here: every violation throws Error('<pesan Indonesia>'). Mutates BGS.data directly and keeps
   BGS.computeQuota() / BGS.deriveWorkerStatus() consistent (RUL-004..007, RUL-009..019, RUL-025, RUL-028, BR-033). */
(function () {
  const BGS = window.BGS, D = BGS.data;
  const DAY = 86400000;
  const ACTIVE = ['DRAFT', 'IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART', 'ON_HOLD'];
  const OPEN_STEP = ['IN_PROGRESS', 'READY'];
  const DONE_STEP = ['COMPLETED', 'SKIPPED', 'CANCELLED'];

  // domain clock: starts at BGS.today and ticks forward so new events look "just now" and stay consistent with due-date logic
  const t0 = Date.now();
  const now = () => new Date(BGS.today.getTime() + (Date.now() - t0));
  const nowIso = () => now().toISOString();
  const addDays = (d, n) => new Date(new Date(d).getTime() + n * DAY);
  const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
  const fail = msg => { throw new Error(msg); };
  const actor = () => BGS.state.userId;
  const userName = id => (D.user(id) || {}).name || id;
  const need = (perm, msg) => { if (!BGS.can(perm)) fail(msg || 'Peran Anda tidak memiliki izin untuk tindakan ini (BR-027).'); };
  const reasonOf = (r, label) => { r = String(r == null ? '' : r).trim(); if (!r) fail(`${label || 'Alasan'} wajib diisi (RUL-022).`); return r; };
  const isAdminUser = u => !!u && u.active && (u.roles.includes('admin') || u.roles.includes('superadmin'));

  // ---------- lookups ----------
  const getCase = id => D.case(id) || fail('Placement Case tidak ditemukan.');
  const verOf = c => { const tpl = D.template(c.templateId); return tpl ? tpl.versions.find(v => v.v === c.templateVersion) : null; };
  const tplStep = (c, stepId) => {
    const tpl = D.template(c.templateId); if (!tpl) return null;
    const pref = tpl.versions.find(v => v.v === c.templateVersion); let s = pref && pref.steps.find(x => x.id === stepId);
    if (!s) [...tpl.versions].sort((a, b) => b.v - a.v).some(v => (s = v.steps.find(x => x.id === stepId)));
    return s || null;
  };
  const inst = (c, stepId) => c.steps.find(x => x.stepId === stepId);
  const taskOf = (c, stepId) => D.tasks.find(t => t.caseId === c.id && t.stepId === stepId);
  const pad = (n, l) => String(n).padStart(l, '0');
  const nextCaseId = () => { const y = BGS.today.getFullYear(); const mx = D.cases.reduce((m, c) => { const x = /^PC-(\d{4})-(\d+)$/.exec(c.id); return x && +x[1] === y ? Math.max(m, +x[2]) : m; }, 0); return `PC-${y}-${pad(mx + 1, 5)}`; };
  const nextTaskNo = () => D.tasks.reduce((m, t) => { const x = /^TSK-(\d+)$/.exec(t.id); return x ? Math.max(m, +x[1]) : m; }, 0);
  const log = (c, text, tone) => { (c.history = c.history || []).unshift({ at: nowIso(), by: actor(), text, tone: tone || 'blue' }); };
  const taskLog = (t, text) => { (t.history = t.history || []).push({ at: nowIso(), by: actor(), text }); };
  const notifyUser = (to, text, caseId) => { if (to && to !== actor()) BGS.notify(to, text, '#/cases/' + caseId); };

  // ---------- derived helpers (also used by UI) ----------
  const isUtilized = c => {
    if (!c || c.status === 'CANCELLED') return false;
    if (['DEPARTED', 'READY_TO_DEPART', 'FINAL_VERIFICATION'].includes(c.status)) return true;
    const ver = verOf(c); const q = ver && ver.steps.find(s => s.consumesQuota); const i = q && inst(c, q.id);
    return !!(i && i.status === 'COMPLETED');
  };
  const quotaState = c => (c.status === 'CANCELLED' ? 'RELEASED' : isUtilized(c) ? 'UTILIZED' : 'RESERVED');
  const requiredSteps = c => { const ver = verOf(c); if (!ver) return []; return ver.steps.filter(s => s.required).map(s => ({ tpl: s, inst: inst(c, s.id) })).filter(x => x.inst && x.inst.status !== 'CANCELLED'); };
  const progress = c => {
    const rs = requiredSteps(c); const done = rs.filter(x => x.inst.status === 'COMPLETED').length;
    return { done, total: rs.length, pct: rs.length ? Math.round((done / rs.length) * 100) : 0 };
  };
  // RUL-028: a step is overdue when its due date has passed and it is open (paused/draft/cancelled cases are not counted)
  const isStepOverdue = (c, si) => !!si && c.status === 'IN_PROCESS' && OPEN_STEP.includes(si.status) && !!si.dueAt && new Date(si.dueAt) < BGS.today;
  const isCaseOverdue = c => c.steps.some(si => isStepOverdue(c, si));
  const activeCaseOfWorker = (workerId, exceptCaseId) => D.cases.find(c => c.workerId === workerId && ACTIVE.includes(c.status) && c.id !== exceptCaseId);

  function cumDue(steps) {
    const cum = {}; const get = (s, depth = 0) => {
      if (cum[s.id] != null) return cum[s.id]; if (depth > 40) return s.dueDays;
      return (cum[s.id] = Math.max(0, ...s.pred.map(p => { const ps = steps.find(x => x.id === p); return ps ? get(ps, depth + 1) : 0; })) + s.dueDays);
    };
    steps.forEach(s => get(s)); return cum;
  }
  const pickPicUser = role => D.users.find(u => u.active && u.picRole === role);
  const defaultPics = ownerId => { const p = { 'Case Owner': ownerId }; D.picRoles.filter(r => r !== 'Case Owner').forEach(r => { const u = pickPicUser(r); p[r] = u ? u.id : null; }); return p; };
  const verifierFor = (c, assignee) => {
    const pool = [c.ownerId, 'U04', 'U05', 'U06'].filter(id => id && D.user(id) && D.user(id).active && id !== assignee);
    return pool[0] || null;
  };
  const assigneeFor = (c, s) => (s.role === 'owner' ? c.ownerId : c.pics[D.picByStepRole[s.role]] || c.ownerId);

  function makeTask(c, s, i, no) {
    const assignee = assigneeFor(c, s);
    return {
      id: `TSK-${pad(no, 5)}`, caseId: c.id, stepId: s.id, title: s.name, assigneeId: assignee, status: 'TODO', dueAt: i.dueAt, executorId: assignee,
      verifierId: s.verification !== 'NONE' ? verifierFor(c, assignee) : null, approverId: s.verification === 'APPROVE' ? 'U03' : null,
      evidence: [], comments: [], blockedReason: null, external: !!s.external, role: s.role, history: [],
    };
  }
  // BR-016: build step instances + one task per step from a template version (all LOCKED, due dates relative to now)
  function buildWorkflow(c, ver) {
    D.tasks = D.tasks.filter(t => t.caseId !== c.id);
    const cum = cumDue(ver.steps); const base = now(); let no = nextTaskNo();
    c.steps = ver.steps.map(s => ({ stepId: s.id, name: s.name, status: 'LOCKED', dueAt: addDays(base, cum[s.id]).toISOString(), completedAt: null, refNumber: null, skippedReason: null }));
    c.steps.forEach(i => D.tasks.push(makeTask(c, ver.steps.find(s => s.id === i.stepId), i, ++no)));
  }
  function snapshotChecklist(c) {
    c.checklist = D.requirements.filter(r => (r.scope.country === '*' || r.scope.country === c.country) && (!r.scope.profession || r.scope.profession === c.profession))
      .map(r => ({ ruleId: r.id, label: r.name, mandatory: r.mandatory, source: r.source, ruleVersion: r.version, status: 'NOT_MET', checkedBy: null }));
  }
  function syncCodeStatus(c) {
    const pc = D.placementCode(c.placementCodeId); if (!pc) return;
    if (pc.status === 'OPEN' && pc.available <= 0) pc.status = 'FULL'; else if (pc.status === 'FULL' && pc.available > 0) pc.status = 'OPEN';
  }
  const refreshAll = c => { BGS.computeQuota(); if (c) syncCodeStatus(c); BGS.deriveWorkerStatus(); };

  // ====================== allocation (RUL-004..006, 009, 010, BR-013) ======================
  function resolveTemplate(appId, codeId) {
    const app = D.application(appId), code = D.placementCode(codeId); if (!app || !code) return null;
    const tpl = D.findTemplate(app.country, app.profession, app.route, code.jobOrderId); if (!tpl) return null;
    const ver = tpl.versions.find(v => v.status === 'PUBLISHED'); return ver ? { tpl, ver } : null;
  }
  function canAllocate(appId, codeId) {
    const app = D.application(appId); if (!app) return { ok: false, reason: 'Lamaran tidak ditemukan.' };
    const code = D.placementCode(codeId); if (!code) return { ok: false, reason: 'Placement Code tidak ditemukan.' };
    BGS.computeQuota();
    if (!['SELECTED', 'WAITLISTED'].includes(app.status)) return { ok: false, reason: `Lamaran berstatus "${(BGS.ST.application[app.status] || [app.status])[0]}". Hanya lamaran Terpilih atau Cadangan yang bisa dialokasikan (RUL-010).` };
    const other = activeCaseOfWorker(app.workerId);
    if (other) return { ok: false, reason: `Worker masih punya Placement Case aktif ${other.id}. Satu worker hanya boleh punya satu case aktif (RUL-009).` };
    if (code.status !== 'OPEN') return { ok: false, reason: `Placement Code berstatus ${(BGS.ST.code[code.status] || [code.status])[0]}; hanya kode Terbuka yang bisa dipakai (RUL-010).` };
    if (code.country !== app.country || code.profession !== app.profession) return { ok: false, reason: `Negara/profesi kode (${D.cn(code.country)} · ${D.pn(code.profession)}) tidak sama dengan lamaran (${D.cn(app.country)} · ${D.pn(app.profession)}) (RUL-010).` };
    if (code.route && app.route && code.route !== app.route) return { ok: false, reason: 'Jalur penempatan pada kode berbeda dengan jalur lamaran.' };
    const jo = D.jobOrder(code.jobOrderId); if (jo && jo.status === 'CLOSED') return { ok: false, reason: 'Job Order untuk kode ini sudah ditutup.' };
    if (!(code.available >= 1)) return { ok: false, reason: 'Kuota Tersedia 0. Kuota tidak boleh kurang dari 0 (RUL-005, RUL-006) — lamaran tetap Cadangan sampai ada kuota.' };
    const rt = resolveTemplate(appId, codeId);
    if (!rt) return { ok: false, reason: 'Belum ada Workflow Template berstatus PUBLISHED untuk kombinasi negara + profesi + jalur ini (RUL-011). Hubungi Superadmin.' };
    return { ok: true, reason: '', template: rt.tpl, version: rt.ver, available: code.available };
  }
  // every code with eligibility for a given application (used by the wizard to explain exclusions)
  function codeOptions(appId) { return D.placementCodes.map(code => Object.assign({ code }, canAllocate(appId, code.id))); }

  function allocate(appId, codeId, opts = {}) {
    need('case.allocate', 'Hanya Admin atau Superadmin yang boleh membuat alokasi penempatan.');
    const chk = canAllocate(appId, codeId); if (!chk.ok) fail(chk.reason);
    const app = D.application(appId), code = D.placementCode(codeId), { template: tpl, version: ver } = chk;
    const me = D.user(actor());
    const ownerId = opts.ownerId || (isAdminUser(me) ? me.id : null) || ['U04', 'U05', 'U06'].find(id => isAdminUser(D.user(id)));
    if (!isAdminUser(D.user(ownerId))) fail('Case Owner harus pengguna aktif berperan Admin atau Superadmin (RUL-019).');
    const pics = Object.assign(defaultPics(ownerId), opts.pics || {}, { 'Case Owner': ownerId });
    D.picRoles.forEach(r => { if (pics[r] && !(D.user(pics[r]) && D.user(pics[r]).active)) fail(`PIC untuk "${r}" tidak valid atau sudah nonaktif.`); });
    const batchId = opts.batchId !== undefined ? opts.batchId || null : code.batchId;
    const batch = batchId ? D.batches.find(b => b.id === batchId) : null;
    const planned = opts.plannedDeparture || (batch && batch.departDate) || addDays(BGS.today, 60).toISOString().slice(0, 10);
    if (isNaN(new Date(planned))) fail('Tanggal rencana keberangkatan tidak valid.');
    if (new Date(planned) < BGS.today) fail('Tanggal rencana keberangkatan tidak boleh di masa lalu.');
    const created = nowIso();
    const c = {
      id: nextCaseId(), applicationId: app.id, workerId: app.workerId, placementCodeId: code.id, jobOrderId: code.jobOrderId, batchId,
      templateId: tpl.id, templateVersion: ver.v, status: 'DRAFT', ownerId, createdAt: created, country: app.country, profession: app.profession,
      pics, plannedDeparture: planned, blockers: [], steps: [], onHoldReason: null, flight: null, comments: [], checklist: [], documentsReady: false,
      history: [], picHistory: [], quota: { reservedAt: created, reservedUntil: addDays(created, D.settings.quotaReservationDays).toISOString() },
    };
    buildWorkflow(c, ver); snapshotChecklist(c);
    D.cases.push(c);
    const prevStatus = app.status; app.status = 'ALLOCATED'; app.caseId = c.id;
    app.history.push({ at: created, by: actor(), text: `Dialokasikan ke ${code.id} → ${c.id}` });
    BGS.computeQuota();
    if (code.available < 0) { // atomic rollback (RUL-006) — should never happen because canAllocate checked Available ≥ 1
      D.cases.pop(); D.tasks = D.tasks.filter(t => t.caseId !== c.id); app.status = prevStatus; app.caseId = null; app.history.pop(); BGS.computeQuota();
      fail('Kuota tidak mencukupi. Alokasi dibatalkan agar kuota tidak kurang dari 0 (RUL-006).');
    }
    syncCodeStatus(c); BGS.deriveWorkerStatus();
    log(c, `Case dibuat dari ${app.id} ke ${code.id}; kuota dicadangkan 1 (RUL-005)`, 'blue');
    log(c, `Workflow dikunci ke ${tpl.name} v${ver.v} (RUL-012)`, 'blue');
    BGS.audit('Kuota dicadangkan', 'Placement Code', code.id, `+1 Reserved untuk ${c.id} (${(D.worker(app.workerId) || {}).name})`);
    BGS.audit('Placement Case dibuat (alokasi)', 'Placement Case', c.id, `Dari ${app.id} → ${code.id}; template ${tpl.id} v${ver.v}; Case Owner ${userName(ownerId)}`);
    BGS.audit('Status lamaran berubah', 'Application', app.id, `${prevStatus} → ALLOCATED`);
    Object.entries(pics).forEach(([role, uid]) => { if (uid) { BGS.audit('PIC ditugaskan', 'Placement Case', c.id, `${role}: ${userName(uid)}`); notifyUser(uid, `Anda ditugaskan sebagai ${role} untuk ${c.id}`, c.id); } });
    return c;
  }

  // ====================== activation (RUL-011, 014, 025, BR-016) ======================
  function unlockSuccessors(c) {
    const ver = verOf(c); if (!ver) return [];
    const unlocked = [];
    ver.steps.forEach(s => {
      const i = inst(c, s.id); if (!i || i.status !== 'LOCKED') return;
      const ok = s.pred.every(p => { const pi = inst(c, p); return !pi || DONE_STEP.includes(pi.status); });
      if (!ok) return;
      i.status = 'IN_PROGRESS'; i.dueAt = addDays(now(), s.dueDays).toISOString();
      const t = taskOf(c, s.id); if (t) { t.dueAt = i.dueAt; if (t.status !== 'CANCELLED') notifyUser(t.assigneeId, `Tugas baru: ${s.name} untuk ${c.id}`, c.id); }
      unlocked.push(s.id);
    });
    return unlocked;
  }
  function activate(caseId) {
    need('case.allocate', 'Hanya Admin atau Superadmin yang boleh mengaktifkan case.');
    const c = getCase(caseId);
    if (c.status !== 'DRAFT') fail(`Case berstatus ${(BGS.ST.case[c.status] || [c.status])[0]}; hanya case Draf yang bisa diaktifkan.`);
    if (!D.user(c.ownerId)) fail('Case belum punya Case Owner (RUL-019).');
    const tpl = D.template(c.templateId); const pub = tpl && tpl.versions.find(v => v.status === 'PUBLISHED');
    if (!pub) fail('Tidak ada template PUBLISHED yang cocok untuk case ini, sehingga case belum bisa diaktifkan (RUL-011).');
    if (pub.v !== c.templateVersion) { // draft case has no running work yet → adopt the current PUBLISHED version
      log(c, `Versi workflow diperbarui v${c.templateVersion} → v${pub.v} saat aktivasi (belum ada pekerjaan berjalan)`, 'amber');
      c.templateVersion = pub.v; buildWorkflow(c, pub);
    }
    const ver = verOf(c);
    const cum = cumDue(ver.steps); const base = now();
    c.steps.forEach(i => { const s = ver.steps.find(x => x.id === i.stepId); i.dueAt = addDays(base, cum[i.stepId]).toISOString(); const t = taskOf(c, i.stepId); if (t) t.dueAt = i.dueAt; if (s && !s.pred.length) i.status = 'IN_PROGRESS'; });
    const untouched = !c.checklist.length || c.checklist.every(x => !x.checkedBy && x.status === 'NOT_MET');
    if (untouched) snapshotChecklist(c); // RUL-025: snapshot rule version aktif saat case diaktifkan
    c.status = 'IN_PROCESS'; c.activatedAt = nowIso();
    log(c, `Case diaktifkan: ${c.steps.length} langkah & tugas dibuat dari ${tpl.name} v${c.templateVersion}`, 'green');
    BGS.audit('Placement Case diaktifkan', 'Placement Case', c.id, `DRAFT → IN_PROCESS; template ${tpl.id} v${c.templateVersion}; checklist ${c.checklist.length} item (snapshot)`);
    ver.steps.filter(s => !s.pred.length).forEach(s => { const t = taskOf(c, s.id); if (t) notifyUser(t.assigneeId, `Tugas baru: ${s.name} untuk ${c.id}`, c.id); });
    refreshAll(c); return c;
  }

  // ====================== recompute / graph ======================
  function recompute(caseId) {
    const c = getCase(caseId);
    if (['IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART'].includes(c.status)) {
      unlockSuccessors(c);
      const allDone = requiredSteps(c).every(x => x.inst.status === 'COMPLETED');
      if (c.status === 'IN_PROCESS' && allDone) { c.status = 'FINAL_VERIFICATION'; log(c, 'Semua langkah wajib selesai → masuk Verifikasi akhir (RUL-018)', 'pink'); BGS.audit('Status case berubah', 'Placement Case', c.id, 'IN_PROCESS → FINAL_VERIFICATION'); }
      else if (c.status !== 'IN_PROCESS' && !allDone) { const was = c.status; c.status = 'IN_PROCESS'; log(c, 'Ada langkah wajib yang belum selesai → kembali ke Diproses', 'amber'); BGS.audit('Status case berubah', 'Placement Case', c.id, `${was} → IN_PROCESS`); }
    }
    refreshAll(c); return c;
  }
  function stepGraph(caseId) {
    const c = getCase(caseId); const ver = verOf(c);
    const tplSteps = ver ? ver.steps : [];
    const rows = c.steps.map(i => {
      const s = tplStep(c, i.stepId) || { id: i.stepId, name: i.name, role: 'docs', dueDays: 0, pred: [], required: false, verification: 'NONE', external: false, consumesQuota: false };
      const t = taskOf(c, i.stepId);
      const legacy = !tplSteps.some(x => x.id === i.stepId);
      return {
        stepId: i.stepId, name: i.name, status: i.status, inst: i, tpl: s, task: t || null, taskId: t ? t.id : null, taskStatus: t ? t.status : null, legacy,
        required: !!s.required, external: !!s.external, consumesQuota: !!s.consumesQuota, verification: s.verification, role: s.role, picRole: D.picByStepRole[s.role],
        assigneeId: t ? t.assigneeId : null, dueAt: i.dueAt, completedAt: i.completedAt, refNumber: i.refNumber, skippedReason: i.skippedReason,
        overdue: isStepOverdue(c, i), blocked: !!(t && t.status === 'BLOCKED'),
        preds: s.pred.map(p => { const pi = inst(c, p); return { stepId: p, name: pi ? pi.name : p, status: pi ? pi.status : 'COMPLETED' }; }),
        succ: [], level: 0,
      };
    });
    const by = Object.fromEntries(rows.map(r => [r.stepId, r]));
    rows.forEach(r => r.preds.forEach(p => { if (by[p.stepId]) by[p.stepId].succ.push(r.stepId); }));
    const lv = (r, d = 0) => (d > 40 ? 0 : r.preds.length ? 1 + Math.max(...r.preds.map(p => (by[p.stepId] ? lv(by[p.stepId], d + 1) : -1))) : 0);
    rows.forEach(r => { r.level = Math.max(0, lv(r)); });
    return rows;
  }

  // ====================== task state machine (RUL-014, 016, 017, 022, BR-019, BR-033) ======================
  const CAP = { start: 'task.execute', submit_evidence: 'task.execute', wait_evidence: 'task.execute', request_verification: 'task.execute', block: 'task.execute', unblock: 'task.execute', complete: 'task.execute', verify: 'task.verify', approve: 'task.approve' };
  const SOD_MSG = {
    verify: 'Pemisahan tugas (RUL-016): Anda adalah pelaksana tugas ini sehingga tidak boleh memverifikasinya. Minta Admin/PIC lain yang berwenang.',
    approve_exec: 'Pemisahan tugas (RUL-016): Anda adalah pelaksana tugas ini sehingga tidak boleh menyetujuinya.',
    approve_ver: 'Pemisahan tugas (RUL-016): Anda sudah memverifikasi tugas ini sehingga tidak boleh menyetujuinya. Approval harus oleh orang lain (mis. Director).',
    reject: 'Pemisahan tugas (RUL-016): Anda adalah pelaksana tugas ini sehingga tidak boleh menolaknya sebagai pemeriksa.',
  };
  const stepLabel = (si) => `"${si.name}"`;

  function taskAction(taskId, action, payload) {
    payload = payload || {};
    const t = D.task(taskId) || fail('Tugas tidak ditemukan.');
    const c = getCase(t.caseId); const s = tplStep(c, t.stepId) || { verification: 'NONE', external: !!t.external, consumesQuota: false, pred: [] }; const si = inst(c, t.stepId) || fail('Langkah untuk tugas ini tidak ditemukan.');
    const me = actor(); const sod = !!D.settings.sodEnabled;
    if (!CAP[action] && action !== 'reject') fail(`Tindakan "${action}" tidak dikenal.`);
    const perm = action === 'reject' ? (t.status === 'PENDING_APPROVAL' ? 'task.approve' : 'task.verify') : CAP[action];
    need(perm, `Peran Anda tidak boleh melakukan tindakan ini (${action === 'approve' ? 'approve' : action === 'verify' || action === 'reject' ? 'verifikasi' : 'eksekusi tugas'}).`);
    if (BGS.isRole('pic')) {
      const isExecAction = ['start', 'submit_evidence', 'wait_evidence', 'request_verification', 'block', 'unblock', 'complete'].includes(action);
      if (isExecAction && t.assigneeId !== me) fail('Tugas ini ditugaskan ke PIC lain. PIC hanya mengerjakan tugasnya sendiri (RUL-020).');
      if (!isExecAction && t.verifierId !== me && t.assigneeId !== me) fail('Anda bukan verifier tugas ini (RUL-020).');
    }
    if (c.status === 'DRAFT') fail('Case masih Draf. Aktifkan case dulu sebelum mengerjakan tugas (RUL-011).');
    if (c.status === 'ON_HOLD') fail('Case sedang ditahan. Lanjutkan case dulu sebelum mengerjakan tugas.');
    if (!['IN_PROCESS', 'FINAL_VERIFICATION'].includes(c.status)) fail(`Case berstatus ${(BGS.ST.case[c.status] || [c.status])[0]}; tugas tidak dapat diubah lagi.`);
    if (t.status === 'COMPLETED') fail('Tugas ini sudah selesai.');
    if (t.status === 'CANCELLED') fail('Tugas ini sudah dibatalkan.');
    if (si.status === 'LOCKED') { const waiting = s.pred.map(p => inst(c, p)).filter(x => x && !DONE_STEP.includes(x.status)).map(x => x.name).join(', '); fail(`Langkah ${stepLabel(si)} masih terkunci sampai langkah sebelumnya selesai (RUL-014)${waiting ? ': ' + waiting : ''}.`); }
    if (!OPEN_STEP.includes(si.status)) fail(`Langkah ${stepLabel(si)} berstatus ${(BGS.ST.step[si.status] || [si.status])[0]} dan tidak bisa dikerjakan.`);

    const from = t.status; const label = BGS.ST.task[from] ? BGS.ST.task[from][0] : from;
    const bad = () => fail(`Tindakan ini tidak bisa dilakukan saat tugas berstatus "${label}".`);
    const evidenceFile = f => (f && typeof f === 'object' && f.name ? f.name : String(f || '').trim());
    const ensureExternal = () => { // BR-033
      if (!s.external) return;
      if (!t.evidence.length) fail('Langkah eksternal wajib punya file bukti (BR-033). Unggah bukti terlebih dahulu.');
      if (!String(si.refNumber || t.refNumber || '').trim()) fail('Langkah eksternal wajib mencatat nomor referensi dari sistem pihak luar (BR-033).');
    };
    let msg = '';
    switch (action) {
      case 'start':
        if (!['TODO', 'REJECTED'].includes(from)) bad();
        t.status = 'IN_PROGRESS'; t.executorId = me; si.startedAt = si.startedAt || nowIso(); msg = from === 'REJECTED' ? 'Mulai memperbaiki setelah ditolak' : 'Tugas dimulai'; break;
      case 'wait_evidence':
        if (from !== 'IN_PROGRESS') bad();
        t.status = 'WAITING_EVIDENCE'; msg = 'Menunggu bukti dari pihak luar'; break;
      case 'submit_evidence': {
        if (!['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'REJECTED'].includes(from)) bad();
        const file = evidenceFile(payload.file); const ref = String(payload.refNumber || '').trim();
        if (s.external && !file) fail('Langkah eksternal wajib punya file bukti (BR-033). Pilih file bukti terlebih dahulu.');
        if (s.external && !ref && !String(si.refNumber || t.refNumber || '').trim()) fail('Langkah eksternal wajib mencatat nomor referensi (BR-033). Isi nomor referensi dari sistem pihak luar.');
        if (!file && !ref) fail('Isi file bukti atau nomor referensi.');
        if (file) t.evidence.push({ name: file, at: nowIso(), by: me, refNumber: ref || null });
        if (ref) { t.refNumber = ref; si.refNumber = ref; }
        t.status = 'IN_PROGRESS'; t.executorId = me; si.startedAt = si.startedAt || nowIso();
        msg = `Bukti dicatat${file ? ': ' + file : ''}${ref ? ' · No. ref ' + ref : ''}`; break;
      }
      case 'request_verification':
        if (from !== 'IN_PROGRESS') fail(from === 'TODO' ? 'Mulai tugas terlebih dahulu.' : `Tindakan ini tidak bisa dilakukan saat tugas berstatus "${label}".`);
        if (s.verification === 'NONE') fail('Langkah ini tidak memerlukan verifikasi. Langsung tandai selesai.');
        ensureExternal();
        t.status = 'PENDING_VERIFICATION'; t.executorId = me; msg = 'Meminta verifikasi';
        notifyUser(t.verifierId, `Verifikasi diperlukan: ${si.name} (${c.id})`, c.id); break;
      case 'verify': {
        if (from !== 'PENDING_VERIFICATION') bad();
        if (sod && me === t.executorId) fail(SOD_MSG.verify);
        t.verifierId = me; t.verifiedBy = me; t.verifiedAt = nowIso();
        if (s.verification === 'APPROVE') { t.status = 'PENDING_APPROVAL'; msg = 'Diverifikasi · menunggu approval'; notifyUser(t.approverId, `Approval diperlukan: ${si.name} (${c.id})`, c.id); }
        else { taskLog(t, `Diverifikasi oleh ${userName(me)}${payload.note ? ': ' + payload.note : ''}`); completeTask(c, t, s, si); return t; }
        break;
      }
      case 'approve': {
        if (from !== 'PENDING_APPROVAL') bad();
        const verifier = t.verifiedBy || t.verifierId;
        if (sod && me === t.executorId) fail(SOD_MSG.approve_exec);
        if (sod && verifier && me === verifier) fail(SOD_MSG.approve_ver);
        t.approverId = me; t.approvedBy = me; t.approvedAt = nowIso();
        taskLog(t, `Disetujui oleh ${userName(me)}${payload.note ? ': ' + payload.note : ''}`); completeTask(c, t, s, si); return t;
      }
      case 'reject': {
        if (!['PENDING_VERIFICATION', 'PENDING_APPROVAL'].includes(from)) bad();
        const reason = reasonOf(payload.reason, 'Alasan penolakan');
        if (sod && me === t.executorId) fail(SOD_MSG.reject);
        t.status = 'REJECTED'; t.rejectReason = reason; t.rejectedBy = me; t.rejectedAt = nowIso(); t.comments.push({ at: nowIso(), by: me, text: 'Ditolak: ' + reason });
        msg = 'Ditolak: ' + reason; notifyUser(t.executorId, `Tugas ditolak: ${si.name} (${c.id}) — ${reason}`, c.id);
        BGS.audit('Task ditolak', 'Task', t.id, `Alasan: ${reason}`); break;
      }
      case 'block': {
        if (!['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'REJECTED'].includes(from)) bad();
        const reason = reasonOf(payload.reason, 'Alasan hambatan'); const category = String(payload.category || 'Lainnya').trim();
        t.prevStatus = from; t.status = 'BLOCKED'; t.blockedReason = reason; t.blockedCategory = category;
        c.blockers = c.blockers || []; c.blockers.push({ stepId: t.stepId, category, reason, at: nowIso(), by: me });
        msg = `Terhambat (${category}): ${reason}`; BGS.audit('Task terhambat', 'Task', t.id, `${category} — ${reason}`);
        notifyUser(c.ownerId, `Tugas terhambat: ${si.name} (${c.id}) — ${reason}`, c.id); break;
      }
      case 'unblock': {
        if (from !== 'BLOCKED') bad();
        const resolved = (c.blockers || []).filter(b => b.stepId === t.stepId);
        c.blockerHistory = (c.blockerHistory || []).concat(resolved.map(b => Object.assign({}, b, { resolvedAt: nowIso(), resolvedBy: me, resolution: payload.note || '' })));
        c.blockers = (c.blockers || []).filter(b => b.stepId !== t.stepId);
        t.status = t.prevStatus && t.prevStatus !== 'BLOCKED' ? t.prevStatus : 'IN_PROGRESS'; t.prevStatus = null; t.blockedReason = null; t.blockedCategory = null;
        msg = 'Hambatan diselesaikan' + (payload.note ? ': ' + payload.note : ''); BGS.audit('Hambatan selesai', 'Task', t.id, payload.note || ''); break;
      }
      case 'complete':
        if (from !== 'IN_PROGRESS') fail(from === 'TODO' ? 'Mulai tugas terlebih dahulu.' : `Tindakan ini tidak bisa dilakukan saat tugas berstatus "${label}".`);
        if (s.verification !== 'NONE') fail(`Langkah ini butuh ${s.verification === 'APPROVE' ? 'verifikasi lalu approval' : 'verifikasi'} sebelum selesai (RUL-017). Gunakan "Minta verifikasi".`);
        ensureExternal();
        t.executorId = me; completeTask(c, t, s, si); return t;
    }
    taskLog(t, msg);
    log(c, `${si.name}: ${msg}`, t.status === 'REJECTED' || t.status === 'BLOCKED' ? 'red' : 'blue');
    if (!['reject', 'block', 'unblock'].includes(action)) BGS.audit('Status task berubah', 'Task', t.id, `${label} → ${(BGS.ST.task[t.status] || [t.status])[0]} · ${msg}`);
    recompute(c.id); return t;
  }
  function completeTask(c, t, s, si) {
    t.status = 'COMPLETED'; t.completedAt = nowIso(); si.status = 'COMPLETED'; si.completedAt = t.completedAt; if (t.refNumber && !si.refNumber) si.refNumber = t.refNumber;
    taskLog(t, 'Tugas selesai');
    log(c, `Langkah "${si.name}" selesai`, 'green');
    BGS.audit('Task selesai', 'Task', t.id, `${si.name} (${c.id})`);
    if (s.consumesQuota) {
      log(c, 'Kuota berpindah dari Dicadangkan ke Terpakai (RUL-007)', 'green');
      BGS.audit('Kuota terpakai', 'Placement Code', c.placementCodeId, `${c.id}: Reserved → Utilized (langkah "${si.name}" selesai)`);
    }
    recompute(c.id);
  }

  // ====================== final verification (RUL-018) ======================
  // Required documents for the final gate (prototype set; passport minimum validity from D.settings.passportMinMonths)
  const FINAL_DOCS = ['DT01', 'DT02', 'DT03', 'DT04', 'DT05', 'DT08', 'DT11', 'DT14', 'DT15'];
  const requiredDocTypes = c => { const w = D.worker(c.workerId); const ids = FINAL_DOCS.slice(); if (w && w.maritalStatus === 'Menikah') ids.push('DT07'); return ids.map(id => D.docType(id)).filter(Boolean); };
  function docsFor(c) { return D.documents.filter(d => d.status !== 'SUPERSEDED' && ((d.ownerType === 'worker' && d.ownerId === c.workerId) || (d.ownerType === 'case' && d.ownerId === c.id))); }
  function docProblems(c) {
    const dep = new Date(c.plannedDeparture); const docs = docsFor(c); const out = [];
    requiredDocTypes(c).forEach(dt => {
      const list = docs.filter(d => d.typeId === dt.id);
      if (!list.length) { out.push(`${dt.name}: belum diunggah`); return; }
      const ver = list.filter(d => d.status === 'VERIFIED');
      if (!ver.length) { const st = list[0].status; out.push(`${dt.name}: ${st === 'UPLOADED' ? 'belum diverifikasi' : st === 'REJECTED' ? 'ditolak' : st === 'EXPIRED' ? 'kedaluwarsa' : st}`); return; }
      const need = dt.id === 'DT08' ? addMonths(dep, D.settings.passportMinMonths) : dep;
      const okDoc = ver.some(d => {
        let exp = d.expiresAt ? new Date(d.expiresAt) : null;
        if (!exp && dt.validMonths) exp = addMonths(d.verifiedAt || d.uploadedAt, dt.validMonths);
        if (!exp) return dt.id !== 'DT08'; return exp >= need;
      });
      if (!okDoc) out.push(dt.id === 'DT08' ? `${dt.name}: masa berlaku kurang dari ${D.settings.passportMinMonths} bulan pada tanggal berangkat` : `${dt.name}: kedaluwarsa sebelum tanggal berangkat`);
    });
    return out;
  }
  function finalChecks(caseId) {
    const c = getCase(caseId); const checks = [];
    const rs = requiredSteps(c); const pend = rs.filter(x => x.inst.status !== 'COMPLETED');
    checks.push({ key: 'steps', label: 'Semua langkah wajib selesai', ok: pend.length === 0, detail: pend.length ? `${rs.length - pend.length}/${rs.length} selesai. Belum: ${pend.map(x => x.inst.name).join(', ')}` : `${rs.length}/${rs.length} langkah wajib selesai` });
    const dp = docProblems(c); const total = requiredDocTypes(c).length;
    checks.push({ key: 'docs', label: 'Dokumen wajib terverifikasi & belum kedaluwarsa pada tanggal berangkat', ok: dp.length === 0, detail: dp.length ? `${total - dp.length}/${total} dokumen OK. ${dp.slice(0, 4).join('; ')}${dp.length > 4 ? ` (+${dp.length - 4} lagi)` : ''}` : `${total}/${total} dokumen wajib terverifikasi dan berlaku sampai ${BGS.fmt.date(c.plannedDeparture)}` });
    const mand = (c.checklist || []).filter(x => x.mandatory); const notMet = mand.filter(x => x.status !== 'MET');
    checks.push({ key: 'checklist', label: 'Checklist kepatuhan wajib terpenuhi', ok: notMet.length === 0, detail: notMet.length ? `${mand.length - notMet.length}/${mand.length} item wajib terpenuhi. Belum: ${notMet.slice(0, 3).map(x => x.label).join('; ')}${notMet.length > 3 ? ` (+${notMet.length - 3} lagi)` : ''}` : `${mand.length}/${mand.length} item wajib terpenuhi (alat kontrol internal, RUL-024)` });
    const bl = (c.blockers || []).length + D.tasks.filter(t => t.caseId === c.id && t.status === 'BLOCKED' && !(c.blockers || []).some(b => b.stepId === t.stepId)).length;
    checks.push({ key: 'blockers', label: 'Tidak ada hambatan aktif', ok: bl === 0, detail: bl ? `${bl} hambatan aktif: ${(c.blockers || []).map(b => b.reason).join('; ')}` : 'Tidak ada hambatan aktif' });
    const u = isUtilized(c);
    checks.push({ key: 'quota', label: 'Kuota sudah Terpakai (utilized)', ok: u, detail: u ? 'Kuota berstatus Terpakai' : 'Kuota masih Dicadangkan — langkah penandatanganan Perjanjian Penempatan belum selesai (RUL-007)' });
    return { ok: checks.every(x => x.ok), checks };
  }
  function finalVerify(caseId) {
    need('final.verify', 'Hanya Admin atau Superadmin yang boleh melakukan verifikasi akhir.');
    const c = getCase(caseId);
    if (c.status !== 'FINAL_VERIFICATION') fail(`Case berstatus ${(BGS.ST.case[c.status] || [c.status])[0]}; verifikasi akhir hanya untuk case berstatus Verifikasi akhir.`);
    const r = finalChecks(caseId);
    if (!r.ok) { BGS.audit('Verifikasi akhir gagal', 'Placement Case', c.id, r.checks.filter(x => !x.ok).map(x => x.label).join('; ')); return Object.assign({ case: c, failed: r.checks.filter(x => !x.ok) }, r); }
    c.status = 'READY_TO_DEPART'; c.finalVerifiedBy = actor(); c.finalVerifiedAt = nowIso();
    log(c, 'Verifikasi akhir lolos (RUL-018) → Siap berangkat', 'teal');
    BGS.audit('Verifikasi akhir lolos', 'Placement Case', c.id, 'FINAL_VERIFICATION → READY_TO_DEPART');
    refreshAll(c); return Object.assign({ case: c, failed: [] }, r);
  }
  function recordDeparture(caseId, flight) {
    need('departure.record', 'Peran Anda tidak boleh mencatat keberangkatan.');
    const c = getCase(caseId);
    if (c.status !== 'READY_TO_DEPART') fail('Keberangkatan hanya bisa dicatat untuk case berstatus Siap berangkat, setelah verifikasi akhir lolos (RUL-030).');
    flight = flight || {}; const miss = [['airline', 'maskapai'], ['flightNo', 'nomor penerbangan'], ['date', 'tanggal berangkat'], ['ticketNo', 'nomor tiket']].filter(([k]) => !String(flight[k] || '').trim()).map(x => x[1]);
    if (miss.length) fail(`Data penerbangan belum lengkap: ${miss.join(', ')} wajib diisi (RUL-030).`);
    if (isNaN(new Date(flight.date))) fail('Tanggal berangkat tidak valid.');
    c.flight = { airline: String(flight.airline).trim(), flightNo: String(flight.flightNo).trim().toUpperCase(), date: String(flight.date).slice(0, 10), ticketNo: String(flight.ticketNo).trim() };
    c.status = 'DEPARTED'; c.departedAt = nowIso();
    log(c, `Berangkat: ${c.flight.airline} ${c.flight.flightNo}, ${BGS.fmt.date(c.flight.date)}`, 'green');
    BGS.audit('Keberangkatan dicatat', 'Placement Case', c.id, `${c.flight.airline} ${c.flight.flightNo} · ${c.flight.date} · tiket ${c.flight.ticketNo}`);
    refreshAll(c); return c;
  }

  // ====================== hold / resume / cancel / release ======================
  function hold(caseId, reason) {
    need('case.allocate', 'Hanya Admin atau Superadmin yang boleh menahan case.');
    const c = getCase(caseId); reason = reasonOf(reason, 'Alasan menahan case');
    if (!['IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART'].includes(c.status)) fail('Hanya case yang sedang berjalan yang bisa ditahan.');
    c.prevStatus = c.status; c.status = 'ON_HOLD'; c.onHoldReason = reason;
    log(c, `Case ditahan: ${reason}`, 'amber'); BGS.audit('Case ditahan', 'Placement Case', c.id, `Alasan: ${reason}`); refreshAll(c); return c;
  }
  function resume(caseId, reason) {
    need('case.allocate', 'Hanya Admin atau Superadmin yang boleh melanjutkan case.');
    const c = getCase(caseId); reason = reasonOf(reason, 'Alasan melanjutkan case');
    if (c.status !== 'ON_HOLD') fail('Case tidak sedang ditahan.');
    c.status = c.prevStatus && c.prevStatus !== 'ON_HOLD' ? c.prevStatus : 'IN_PROCESS'; c.prevStatus = null; c.onHoldReason = null;
    log(c, `Case dilanjutkan: ${reason}`, 'green'); BGS.audit('Case dilanjutkan', 'Placement Case', c.id, `Alasan: ${reason}`);
    return recompute(caseId);
  }
  function doCancel(c, reason, kind) {
    const wasUtil = isUtilized(c);
    c.status = 'CANCELLED'; c.cancelReason = reason; c.cancelledAt = nowIso(); c.onHoldReason = null; c.prevStatus = null;
    c.steps.forEach(i => { if (!['COMPLETED', 'SKIPPED'].includes(i.status)) i.status = 'CANCELLED'; });
    D.tasks.filter(t => t.caseId === c.id && !['COMPLETED', 'CANCELLED'].includes(t.status)).forEach(t => { t.status = 'CANCELLED'; taskLog(t, 'Dibatalkan karena case dibatalkan: ' + reason); });
    c.blockers = [];
    c.quota = Object.assign(c.quota || {}, { releasedAt: c.cancelledAt, releaseReason: reason });
    const app = D.application(c.applicationId);
    if (app) { const back = (app.decision && app.decision.result === 'WAITLISTED') ? 'WAITLISTED' : 'SELECTED'; app.status = back; app.caseId = null; app.history.push({ at: nowIso(), by: actor(), text: `Case ${c.id} dibatalkan (${reason}); lamaran kembali ${back}` }); }
    log(c, `${kind === 'release' ? 'Kuota dilepas & case dibatalkan' : 'Case dibatalkan'}: ${reason}`, 'red');
    BGS.audit(kind === 'release' ? 'Kuota dilepas' : 'Case dibatalkan', 'Placement Case', c.id, `${wasUtil ? 'Revert Terpakai · ' : 'Release Reserved · '}Alasan: ${reason}`);
    if (kind !== 'release') BGS.audit('Kuota dilepas', 'Placement Code', c.placementCodeId, `-1 dari ${c.id} (${wasUtil ? 'Utilized' : 'Reserved'})`);
    refreshAll(c); return c;
  }
  function revertApproval(c, reason) {
    const dup = D.approvals.find(a => a.type === 'REVERT_KUOTA' && a.status === 'PENDING' && a.subject === c.id);
    if (dup) fail(`Sudah ada permintaan Revert kuota (${dup.id}) untuk case ini yang menunggu keputusan Director.`);
    const n = D.approvals.reduce((m, a) => { const x = /^AP-(\d+)$/.exec(a.id); return x ? Math.max(m, +x[1]) : m; }, 0) + 1;
    const ap = { id: `AP-${pad(n, 3)}`, type: 'REVERT_KUOTA', title: `Revert kuota TERPAKAI pada ${c.id}`, subject: c.id, caseId: c.id, requestedBy: actor(), at: nowIso(), reason, status: 'PENDING', expires: addDays(now(), 3).toISOString() };
    D.approvals.unshift(ap); log(c, `Permintaan pembatalan setelah kuota Terpakai diajukan ke Director (${ap.id}): ${reason}`, 'amber');
    BGS.audit('Permintaan Revert kuota diajukan', 'Placement Case', c.id, `${ap.id} · Alasan: ${reason}`); BGS.notify('U03', `Permintaan persetujuan: ${ap.title}`, '#/approvals', 'APPROVAL');
    return ap;
  }
  function cancelCase(caseId, reason) {
    need('case.allocate', 'Hanya Admin atau Superadmin yang boleh membatalkan case.');
    const c = getCase(caseId); reason = reasonOf(reason, 'Alasan pembatalan');
    if (!ACTIVE.includes(c.status)) fail(`Case berstatus ${(BGS.ST.case[c.status] || [c.status])[0]} dan tidak bisa dibatalkan.`);
    if (isUtilized(c)) return revertApproval(c, reason); // RUL-007: revert Utilized only via Director approval
    return doCancel(c, reason, 'cancel');
  }
  function releaseQuota(caseId, reason) {
    need('case.allocate', 'Hanya Admin atau Superadmin yang boleh melepas kuota.');
    const c = getCase(caseId); reason = reasonOf(reason, 'Alasan melepas kuota');
    if (!ACTIVE.includes(c.status)) fail('Kuota case ini sudah tidak aktif (case selesai atau dibatalkan).');
    if (isUtilized(c)) return revertApproval(c, reason);
    return doCancel(c, reason, 'release');
  }
  // executed after the Director approves a REVERT_KUOTA request (RUL-007)
  function applyRevertQuota(caseId, reason) {
    const c = getCase(caseId); if (!ACTIVE.includes(c.status)) fail('Case sudah tidak aktif.');
    return doCancel(c, reasonOf(reason || 'Revert kuota disetujui Director', 'Alasan'), 'cancel');
  }

  // ====================== skip step (RUL-015) ======================
  function skipStep(caseId, stepId, reason) {
    need('case.allocate', 'Hanya Admin atau Case Owner yang boleh melewati langkah.');
    const c = getCase(caseId); reason = reasonOf(reason, 'Alasan melewati langkah');
    const s = tplStep(c, stepId), si = inst(c, stepId); if (!si) fail('Langkah tidak ditemukan.');
    if (s && s.required) fail('Langkah wajib tidak boleh dilewati (RUL-015). Hanya langkah opsional.');
    if (!['LOCKED', 'IN_PROGRESS', 'READY'].includes(si.status)) fail('Hanya langkah yang belum selesai yang bisa dilewati.');
    if (!['IN_PROCESS', 'DRAFT'].includes(c.status)) fail('Langkah hanya bisa dilewati saat case Draf atau Diproses.');
    si.status = 'SKIPPED'; si.skippedReason = reason; si.completedAt = nowIso();
    const t = taskOf(c, stepId); if (t && !['COMPLETED', 'CANCELLED'].includes(t.status)) { t.status = 'CANCELLED'; taskLog(t, 'Langkah dilewati: ' + reason); c.blockers = (c.blockers || []).filter(b => b.stepId !== stepId); }
    log(c, `Langkah opsional "${si.name}" dilewati: ${reason}`, 'amber'); BGS.audit('Langkah dilewati', 'Placement Case', c.id, `${si.name} · Alasan: ${reason}`);
    return recompute(caseId);
  }

  // ====================== PIC assignment (RUL-019, RUL-021) ======================
  function assignPic(caseId, picRoleName, userId, reason) {
    need('pic.assign', 'Hanya Admin atau Superadmin yang boleh mengubah penugasan PIC.');
    const c = getCase(caseId); reason = reasonOf(reason, 'Alasan penugasan');
    if (!D.picRoles.includes(picRoleName)) fail('PIC Role tidak dikenal.');
    if (['CANCELLED', 'DEPARTED'].includes(c.status)) fail('Case sudah selesai/dibatalkan; PIC tidak bisa diubah.');
    const u = D.user(userId); if (!u || !u.active) fail('Pengguna tidak ditemukan atau sudah nonaktif.');
    if (picRoleName === 'Case Owner' && !isAdminUser(u)) fail('Case Owner harus berperan Admin atau Superadmin (RUL-019).');
    if (picRoleName !== 'Case Owner' && !(u.roles.includes('pic') || isAdminUser(u))) fail('Pengguna ini tidak berperan PIC maupun Admin.');
    const prev = c.pics[picRoleName]; if (prev === userId) fail(`${u.name} sudah menjadi ${picRoleName} pada case ini.`);
    c.pics[picRoleName] = userId; if (picRoleName === 'Case Owner') c.ownerId = userId;
    (c.picHistory = c.picHistory || []).unshift({ at: nowIso(), by: actor(), role: picRoleName, from: prev || null, to: userId, reason });
    const ver = verOf(c);
    D.tasks.filter(t => t.caseId === c.id && !['COMPLETED', 'CANCELLED'].includes(t.status)).forEach(t => {
      const s = ver && ver.steps.find(x => x.id === t.stepId); if (!s) return;
      const role = s.role === 'owner' ? 'Case Owner' : D.picByStepRole[s.role];
      if (role === picRoleName) { t.assigneeId = userId; if (!['PENDING_VERIFICATION', 'PENDING_APPROVAL'].includes(t.status)) t.executorId = userId; }
      if (t.verifierId && t.verifierId === t.assigneeId) t.verifierId = verifierFor(c, t.assigneeId);
    });
    log(c, `${picRoleName}: ${prev ? userName(prev) + ' → ' : ''}${u.name} (${reason})`, 'blue');
    BGS.audit('PIC ditugaskan', 'Placement Case', c.id, `${picRoleName}: ${prev ? userName(prev) : '—'} → ${u.name}. Alasan: ${reason}`);
    notifyUser(userId, `Anda ditugaskan sebagai ${picRoleName} untuk ${c.id}`, c.id);
    return c;
  }

  // ====================== workflow migration (RUL-012) ======================
  function migrateCases(templateId, fromV, toV, caseIds) {
    const tpl = D.template(templateId) || fail('Template tidak ditemukan.');
    const to = tpl.versions.find(v => v.v === toV); if (!to) fail(`Versi v${toV} tidak ditemukan.`);
    if (to.status !== 'PUBLISHED') fail(`Hanya bisa migrasi ke versi PUBLISHED (v${toV} berstatus ${to.status}).`);
    const migrated = [], skipped = [];
    (caseIds || []).forEach(id => {
      const c = D.case(id);
      if (!c) { skipped.push({ id, reason: 'Case tidak ditemukan' }); return; }
      if (c.templateId !== templateId || c.templateVersion !== fromV) { skipped.push({ id, reason: `Bukan case ${templateId} v${fromV}` }); return; }
      if (!ACTIVE.includes(c.status)) { skipped.push({ id, reason: 'Case sudah selesai/dibatalkan' }); return; }
      const added = [], cancelled = [], kept = [];
      let no = nextTaskNo();
      to.steps.forEach(s => {
        const i = inst(c, s.id);
        if (i) { if (i.status === 'LOCKED' || i.status === 'IN_PROGRESS') i.name = s.name; return; }
        const ni = { stepId: s.id, name: s.name, status: 'LOCKED', dueAt: addDays(now(), s.dueDays).toISOString(), completedAt: null, refNumber: null, skippedReason: null };
        c.steps.push(ni); D.tasks.push(makeTask(c, s, ni, ++no)); added.push(s.name);
      });
      c.steps.forEach(i => {
        if (to.steps.some(s => s.id === i.stepId)) return;
        const t = taskOf(c, i.stepId);
        if (i.status === 'COMPLETED' || i.status === 'SKIPPED' || i.status === 'CANCELLED') { i.legacy = true; if (i.status === 'COMPLETED') kept.push(i.name); return; }
        if (i.status === 'LOCKED' || !t || t.status === 'TODO') { i.status = 'CANCELLED'; i.legacy = true; if (t) { t.status = 'CANCELLED'; taskLog(t, `Langkah dihapus pada template v${toV}`); } c.blockers = (c.blockers || []).filter(b => b.stepId !== i.stepId); cancelled.push(i.name); }
        else { i.legacy = true; kept.push(i.name + ' (sedang berjalan)'); }
      });
      c.templateVersion = toV;
      log(c, `Migrasi workflow v${fromV} → v${toV}: +${added.length} langkah baru, ${cancelled.length} dibatalkan, ${kept.length} dipertahankan sebagai riwayat`, 'purple');
      BGS.audit('Case dimigrasikan', 'Placement Case', c.id, `${templateId} v${fromV} → v${toV}; tambah: ${added.join(', ') || '—'}; batal: ${cancelled.join(', ') || '—'}; riwayat: ${kept.join(', ') || '—'}`);
      recompute(c.id); migrated.push(c.id);
    });
    return { migrated, skipped };
  }

  // ====================== checklist / comments helpers ======================
  function markChecklist(caseId, ruleId, status, note) {
    need('task.verify', 'Peran Anda tidak boleh mengubah checklist kepatuhan.');
    const c = getCase(caseId); const it = (c.checklist || []).find(x => x.ruleId === ruleId); if (!it) fail('Item checklist tidak ditemukan.');
    if (!['MET', 'NOT_MET'].includes(status)) fail('Status checklist tidak valid.');
    if (['CANCELLED', 'DEPARTED'].includes(c.status)) fail('Case sudah selesai/dibatalkan; checklist dikunci.');
    it.status = status; it.checkedBy = actor(); it.checkedAt = nowIso(); it.note = note || '';
    log(c, `Checklist "${it.label}" → ${status === 'MET' ? 'Terpenuhi' : 'Belum terpenuhi'}`, status === 'MET' ? 'green' : 'amber');
    BGS.audit('Checklist kepatuhan diperbarui', 'Placement Case', c.id, `${it.ruleId} v${it.ruleVersion} → ${status}`); return it;
  }
  function addComment(caseId, text) {
    const c = getCase(caseId); text = String(text || '').trim(); if (!text) fail('Komentar tidak boleh kosong.');
    if (!BGS.can('task.execute') && !BGS.can('task.approve')) fail('Peran Anda hanya bisa melihat (read-only).');
    const cm = { at: nowIso(), by: actor(), text }; (c.comments = c.comments || []).unshift(cm);
    BGS.audit('Komentar case', 'Placement Case', c.id, text.slice(0, 120)); return cm;
  }

  BGS.domain = {
    // contract
    canAllocate, allocate, activate, taskAction, recompute, finalChecks, finalVerify, recordDeparture, hold, resume, cancelCase, releaseQuota, skipStep, assignPic, migrateCases, stepGraph,
    // extras (stable)
    codeOptions, resolveTemplate, defaultPics, isUtilized, quotaState, progress, requiredSteps, requiredDocTypes, isStepOverdue, isCaseOverdue, activeCaseOfWorker, applyRevertQuota, markChecklist, addComment,
    tplVersion: verOf, tplStep, stepInstance: inst, taskOfStep: taskOf, now, ACTIVE,
  };
})();
