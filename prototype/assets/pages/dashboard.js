/* M01 Dashboard · M11 Laporan · M12 Notifikasi
   Routes: /dashboard, /dashboard/advanced, /reports, /notifications
   Semua angka dihitung dari BGS.data (tidak ada angka tetap). */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui, fmt = BGS.fmt;
  const DAY = 86400000;
  const NOW = () => BGS.today;
  const MVP = () => BGS.state.mvp;
  const ME = () => BGS.state.userId;
  const num = n => fmt.num(n);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const SHORT = { SA: 'Saudi', AE: 'UEA', JP: 'Jepang', KR: 'Korea', TW: 'Taiwan' };
  const HEX = { blue: '#1D4ED8', purple: '#6D28D9', teal: '#0F766E', orange: '#C2410C', pink: '#BE185D', green: '#15803D', red: '#B91C1C', amber: '#B45309', gray: '#94A3B8', navy: '#1E293B' };
  const stTone = (d, v) => ((BGS.ST[d] || {})[v] || [])[1] || 'gray';
  const stHex = (d, v) => HEX[stTone(d, v)] || HEX.gray;
  const stLabel = (d, v) => ((BGS.ST[d] || {})[v] || [v])[0];
  const uname = id => (D.user(id) || {}).name || id || '—';
  const wname = id => (D.worker(id) || {}).name || id;
  const routeName = id => (D.routes.find(r => r.id === id) || {}).name || id || '—';

  // ---------- akses link berdasarkan nav.js (role + MVP) ----------
  const navItem = p => { for (const s of BGS.nav) for (const i of s.items) if (i.path === p) return i; return null; };
  const allowed = href => { const i = navItem(href.split('?')[0]); if (!i) return true; return (!i.roles || i.roles.includes(BGS.state.role)) && (i.mvp || 1) <= MVP(); };
  const lnk = (label, href, cls) => (allowed(href) ? h('a', { class: cls || 'lnk', href: '#' + href }, label) : h('span', null, label));
  const kpi = o => ui.kpi(Object.assign({}, o, { href: o.href && allowed(o.href) ? o.href : null }));
  const abtn = (label, href, kind, icon) => (allowed(href) ? h('a', { class: 'btn' + (kind ? ' btn-' + kind : ''), href: '#' + href }, icon && BGS.icon(icon, 16), label) : null);

  // ---------- definisi status ----------
  const ACTIVE_CASE = ['IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART', 'ON_HOLD'];
  const OPEN_TASK = ['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'REJECTED', 'BLOCKED'];
  const PIPELINE = ['SUBMITTED', 'SCREENING', 'REVISION_REQUIRED', 'INTERVIEW', 'ASSESSMENT', 'SELECTED', 'WAITLISTED'];
  const POST_FV = ['FINAL_VERIFICATION', 'READY_TO_DEPART', 'DEPARTED'];
  const inst = (c, sid) => (c ? c.steps.find(s => s.stepId === sid) : null);

  // Jatuh tempo efektif = yang paling awal antara due task dan due langkah (step instance).
  function taskDue(t) {
    const i = inst(D.case(t.caseId), t.stepId);
    return new Date(Math.min(...[t.dueAt, i && i.dueAt].filter(Boolean).map(x => +new Date(x))));
  }
  // Task "aktif" = status terbuka, case berjalan (bukan draf/selesai/batal), langkahnya sudah terbuka.
  function actionable(t) {
    if (!OPEN_TASK.includes(t.status)) return false;
    const c = D.case(t.caseId); if (!c || !ACTIVE_CASE.includes(c.status)) return false;
    const i = inst(c, t.stepId); return !i || ['READY', 'IN_PROGRESS'].includes(i.status);
  }
  // Terlambat = task aktif, case tidak ditahan, jatuh tempo sudah lewat.
  const overdue = t => actionable(t) && D.case(t.caseId).status !== 'ON_HOLD' && taskDue(t) < NOW();
  const lateDays = t => Math.max(1, Math.ceil((NOW() - taskDue(t)) / DAY));

  const dueBadge = due => {
    const diff = (new Date(due) - NOW()) / DAY;
    if (diff < 0) return ui.badge(`Terlambat ${Math.ceil(-diff)} hari`, 'red', { dot: true });
    if (diff < 1) return ui.badge('Hari ini', 'amber', { dot: true });
    const d = Math.ceil(diff); return ui.badge(`${d} hari lagi`, d <= 3 ? 'amber' : 'gray', { dot: true });
  };

  // ---------- metrik (sesuai scope role) ----------
  function metrics() {
    const S = BGS.scope;
    const workers = S.workers(), apps = S.applications(), cases = S.cases(), tasks = S.tasks();
    const wIds = new Set(workers.map(w => w.id)), cIds = new Set(cases.map(c => c.id));
    const docs = D.documents.filter(d => d.status !== 'SUPERSEDED' && (d.ownerType === 'worker' ? wIds.has(d.ownerId) : cIds.has(d.ownerId)));
    const openTasks = tasks.filter(actionable);
    const overdueTasks = openTasks.filter(overdue);
    const blockedTasks = tasks.filter(t => t.status === 'BLOCKED');
    const risk = new Set([...overdueTasks, ...blockedTasks].map(t => t.id));
    const codes = D.placementCodes.filter(p => p.status !== 'CLOSED');
    if (codes.some(p => p.available == null)) BGS.computeQuota();
    return {
      workers, apps, cases, tasks, docs, openTasks, overdueTasks, blockedTasks,
      riskTasks: [...overdueTasks, ...blockedTasks.filter(t => !overdueTasks.includes(t))],
      riskCount: risk.size,
      workerActive: workers.filter(w => ['ACTIVE', 'IN_PROCESS'].includes(w.status)),
      pipeline: apps.filter(a => PIPELINE.includes(a.status)),
      activeCases: cases.filter(c => ACTIVE_CASE.includes(c.status)),
      overdueCases: cases.filter(c => overdueTasks.some(t => t.caseId === c.id)),
      newRegs: D.registrations.filter(r => r.status === 'NEW'),
      docsPending: docs.filter(d => d.status === 'UPLOADED'),
      appsDecide: apps.filter(a => a.status === 'ASSESSMENT'),
      appsScreen: apps.filter(a => a.status === 'SUBMITTED'),
      candidates: apps.filter(a => ['SELECTED', 'WAITLISTED'].includes(a.status) && !a.caseId),
      verifyTasks: tasks.filter(t => t.status === 'PENDING_VERIFICATION'),
      approvals: D.approvals.filter(a => a.status === 'PENDING'),
      codes, quotaAvail: codes.reduce((a, p) => a + (p.available || 0), 0), quotaTotal: codes.reduce((a, p) => a + p.total, 0), quotaUsed: codes.reduce((a, p) => a + (p.utilized || 0), 0),
    };
  }

  // ---------- funnel kumulatif ----------
  const RANK = { SUBMITTED: 0, SCREENING: 1, REVISION_REQUIRED: 1, INTERVIEW: 2, ASSESSMENT: 3, SELECTED: 4, WAITLISTED: 4, ALLOCATED: 5 };
  const STAGES = [['Diajukan', 0, '#1D4ED8'], ['Screening dokumen', 1, '#6D28D9'], ['Wawancara', 2, '#7C3AED'], ['Penilaian skill', 3, '#0F766E'], ['Terpilih / cadangan', 4, '#15803D'], ['Dialokasikan', 5, '#C2410C']];
  const funnelData = apps => { const live = apps.filter(a => a.status in RANK); return STAGES.map(([label, r, color]) => ({ label, value: live.filter(a => RANK[a.status] >= r).length, color })); };

  function trendMonths(n = 6) { return Array.from({ length: n }, (_, i) => { const d = new Date(NOW().getFullYear(), NOW().getMonth() - (n - 1) + i, 1); return { y: d.getFullYear(), m: d.getMonth(), label: MONTHS[d.getMonth()] }; }); }
  const countByMonth = (arr, get, months) => months.map(({ y, m }) => arr.filter(x => { const v = get(x); if (!v) return false; const d = new Date(v); return d.getFullYear() === y && d.getMonth() === m; }).length);

  // ---------- CSS ----------
  BGS.addStyle(`
  .db-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(235px,1fr));gap:14px}
  .db-qs{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
  .db-q{display:flex;gap:12px;align-items:center;background:#fff;border:1px solid var(--line);border-top:4px solid var(--blue);border-radius:12px;padding:12px 14px;color:var(--ink);text-decoration:none!important;box-shadow:var(--shadow);min-width:0}
  a.db-q:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(15,23,42,.1)}
  .db-q .n{font-size:30px;font-weight:800;line-height:1;min-width:44px;text-align:center}
  .db-q.zero .n{color:#94A3B8} .db-q .t{font-weight:800;font-size:13.5px;line-height:1.25} .db-q .d{font-size:12px;color:var(--muted);line-height:1.3;margin-top:2px} .db-q .go{margin-left:auto;color:#94A3B8}
  .db-qrow{display:grid;grid-template-columns:minmax(120px,170px) 1fr minmax(110px,150px);gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed var(--line);font-size:12.5px}
  .db-qrow:last-child{border-bottom:0} .db-qrow .num{text-align:right;font-weight:700;white-space:nowrap}
  @media(max-width:600px){.db-qrow{grid-template-columns:1fr;gap:4px}.db-qrow .num{text-align:left}}
  .db-qleg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-bottom:6px} .db-qleg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px}
  .db-li{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px dashed var(--line)} .db-li:last-child{border-bottom:0} .db-li .grow{min-width:0}
  .db-ap .tt{font-weight:700;line-height:1.3}
  .db-mini{font-size:12px;color:var(--muted)}
  .db-note{font-size:12px;color:var(--muted);margin-top:8px}
  .db-sw{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px dashed var(--line)} .db-sw:last-child{border-bottom:0} .db-sw .grow{min-width:0}
  .db-sw input[type=checkbox]{appearance:none;width:38px;height:22px;border-radius:20px;background:#CBD5E1;position:relative;cursor:pointer;flex:none;transition:.15s;border:0}
  .db-sw input[type=checkbox]:after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.15s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
  .db-sw input[type=checkbox]:checked{background:var(--green)} .db-sw input[type=checkbox]:checked:after{left:18px} .db-sw input[type=checkbox]:disabled{opacity:.5;cursor:not-allowed}
  .nt-item{display:flex;gap:12px;align-items:flex-start;padding:12px 16px;border-bottom:1px solid var(--line);cursor:pointer;background:#fff} .nt-item:hover{background:#F8FAFC} .nt-item.unread{background:#EFF6FF;box-shadow:inset 4px 0 0 var(--blue)} .nt-item.unread:hover{background:#E0ECFF}
  .nt-ic{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none}
  .nt-day{padding:7px 16px;background:#F8FAFC;font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:#64748B;border-bottom:1px solid var(--line)}
  .nt-txt{font-weight:600;line-height:1.35} .nt-item:not(.unread) .nt-txt{font-weight:500}
  .rp-grid{display:grid;grid-template-columns:310px minmax(0,1fr);gap:16px;align-items:start} .rp-grid>*{min-width:0} @media(max-width:1000px){.rp-grid{grid-template-columns:minmax(0,1fr)}}
  .rp-cat{display:flex;flex-direction:column;gap:3px} .rp-grp{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;color:#64748B;margin:12px 0 4px;display:flex;align-items:center;gap:6px} .rp-grp:first-child{margin-top:0}
  .rp-item{display:flex;gap:10px;align-items:flex-start;text-align:left;border:1px solid transparent;background:transparent;padding:9px 10px;border-radius:10px;width:100%} .rp-item:hover{background:#F8FAFC} .rp-item.on{background:var(--blue-l);border-color:#93C5FD}
  .rp-item .ic{width:30px;height:30px;border-radius:8px;background:var(--gray-l);color:#334155;display:flex;align-items:center;justify-content:center;flex:none} .rp-item.on .ic{background:var(--blue);color:#fff}
  .rp-item b{display:block;font-size:13.5px;line-height:1.25} .rp-item span.d{font-size:11.5px;color:var(--muted);line-height:1.3;display:block;margin-top:1px}
  .rp-filters{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;padding:12px 16px;border-bottom:1px solid var(--line);background:#F8FAFC} .rp-filters .field{min-width:150px;flex:0 1 190px}
  .rp-sum{display:flex;gap:18px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line);font-size:12.5px;color:var(--muted)} .rp-sum b{color:var(--ink);font-size:15px}
  .rp-printhead{display:none}
  @media print{.rp-noprint{display:none!important}.rp-printhead{display:block;margin-bottom:10px}.rp-grid{display:block}.tbl-scroll{overflow:visible}.tbl th{position:static}.pager{display:none}.nav-open .side{display:none}}
  .adv-trend{font-weight:800;white-space:nowrap} .adv-up{color:var(--green)} .adv-down{color:var(--red)} .adv-flat{color:var(--muted)}
  `);

  // ---------- blok pembangun ----------
  const miniTable = (columns, rows, { pageSize = 5, empty } = {}) => ui.table({ columns, rows, pageSize, dense: true, empty: empty || ui.emptyState({ icon: 'check-circle', title: 'Tidak ada data', text: 'Semua beres untuk saat ini.' }) });
  const moreLink = (label, href) => (allowed(href) ? h('a', { class: 'btn btn-sm btn-ghost', href: '#' + href }, label, BGS.icon('arrow-right', 14)) : null);
  const greet = () => { const hr = NOW().getHours(); return `Selamat ${hr < 11 ? 'pagi' : hr < 15 ? 'siang' : hr < 18 ? 'sore' : 'malam'}, ${BGS.user().name.split(' ')[0]}`; };
  const mvpNote = () => (MVP() === 1 ? ui.callout('info', 'Tahap MVP 1 aktif', 'Dashboard menampilkan data worker & rekrutmen. Widget pemrosesan, kuota, dan persetujuan muncul di MVP 2 — ubah selektor "Tahap" di bar atas untuk melihatnya.') : null);
  const taskOpen = (t, refresh) => (BGS.taskDrawer ? ui.btn('Buka', { sm: true, onClick: () => BGS.taskDrawer(t.id, { onChange: refresh }) }) : abtn('Buka', '/tasks', 'sm'));
  const tag = (t, tone) => ui.badge(t, tone || 'gray');
  const dest = x => `${SHORT[x.country] || x.country} · ${D.pn(x.profession)}`;

  const queueCard = q => {
    const el = h(q.href && allowed(q.href) ? 'a' : 'div', { class: 'db-q' + (q.n === 0 ? ' zero' : ''), style: { borderTopColor: HEX[q.tone] || HEX.blue }, href: q.href && allowed(q.href) ? '#' + q.href : null },
      h('div', { class: 'n' }, num(q.n)), h('div', null, h('div', { class: 't' }, q.label), h('div', { class: 'd' }, q.text)), q.href && allowed(q.href) ? h('span', { class: 'go' }, BGS.icon('chevron-right', 18)) : null);
    return el;
  };
  function queueDefs(M) {
    const q = [
      { label: 'Registrasi baru', n: M.newRegs.length, text: 'Dari website publik, belum ditinjau', href: '/registrations', tone: 'blue' },
      { label: 'Dokumen menunggu verifikasi', n: M.docsPending.length, text: 'Status "Menunggu verifikasi"', href: '/documents?status=UPLOADED', tone: 'amber' },
      { label: 'Lamaran perlu screening', n: M.appsScreen.length, text: 'Baru diajukan, belum diperiksa', href: '/applications?status=SUBMITTED', tone: 'purple' },
      { label: 'Lamaran perlu keputusan', n: M.appsDecide.length, text: 'Penilaian selesai, tinggal putuskan', href: '/applications?status=ASSESSMENT', tone: 'purple' },
    ];
    if (MVP() >= 2) q.push(
      { label: 'Kandidat siap alokasi', n: M.candidates.length, text: 'Terpilih / cadangan, belum punya case', href: '/allocation', tone: 'teal' },
      { label: 'Case terlambat', n: M.overdueCases.length, text: `${M.overdueTasks.length} tugas lewat jatuh tempo`, href: '/monitor', tone: 'red' },
      { label: 'Tugas menunggu verifikasi', n: M.verifyTasks.length, text: 'Perlu dicek verifier', href: '/tasks?status=PENDING_VERIFICATION', tone: 'orange' });
    return q;
  }

  // ---------- widget umum ----------
  function wFunnel(M) {
    const data = funnelData(M.apps);
    const rej = M.apps.filter(a => a.status === 'REJECTED').length, wd = M.apps.filter(a => ['WITHDRAWN', 'CANCELLED'].includes(a.status)).length;
    return ui.card({ title: 'Pipeline rekrutmen', subtitle: 'Lamaran yang sudah mencapai tiap tahap (kumulatif)', icon: 'clipboard', actions: moreLink('Lamaran', '/applications'),
      body: M.apps.length ? [ui.funnel(data), h('div', { class: 'db-note' }, `Tidak dihitung: ${rej} ditolak · ${wd} mundur/batal. Sedang di pipeline: ${M.pipeline.length} lamaran.`)] : ui.emptyState({ title: 'Belum ada lamaran' }) });
  }
  function wWorkerDonut(M) {
    const keys = ['ACTIVE', 'IN_PROCESS', 'DEPLOYED', 'INACTIVE', 'ARCHIVED'];
    const data = keys.map(k => ({ label: stLabel('worker', k), value: M.workers.filter(w => w.status === k).length, color: stHex('worker', k) })).filter(d => d.value);
    return ui.card({ title: 'Worker per status', subtitle: 'Status diturunkan otomatis dari lamaran & case (RUL-027)', icon: 'users', actions: moreLink('Worker', '/workers'),
      body: data.length ? ui.donut({ data, center: { value: M.workers.length, label: 'worker' } }) : ui.emptyState({ title: 'Belum ada worker' }) });
  }
  function wCaseDonut(M) {
    const keys = ['DRAFT', 'IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART', 'DEPARTED', 'ON_HOLD', 'CANCELLED'];
    const data = keys.map(k => ({ label: stLabel('case', k), value: M.cases.filter(c => c.status === k).length, color: stHex('case', k) })).filter(d => d.value);
    return ui.card({ title: 'Status Placement Case', subtitle: `${M.activeCases.length} case aktif dari ${M.cases.length}`, icon: 'briefcase', actions: moreLink('Case', '/cases'),
      body: data.length ? ui.donut({ data, center: { value: M.cases.length, label: 'case' } }) : ui.emptyState({ title: 'Belum ada case' }) });
  }
  function wTrend() {
    const months = trendMonths(6);
    const series = [{ name: 'Worker terdaftar', color: HEX.blue, points: countByMonth(D.workers, w => w.createdAt, months) }, { name: 'Registrasi website', color: HEX.orange, points: countByMonth(D.registrations, r => r.submittedAt, months) }];
    const tot = series[0].points.reduce((a, b) => a + b, 0);
    return ui.card({ title: 'Tren registrasi 6 bulan', subtitle: `${months[0].label} – ${months[5].label} ${months[5].y} · ${tot} worker terdaftar`, icon: 'trending-up', body: ui.lineChart({ series, labels: months.map(m => m.label) }) });
  }
  function wCountryBars(M) {
    const data = D.countries.map(c => ({ label: SHORT[c.code] || c.code, value: M.apps.filter(a => a.country === c.code).length })).filter(d => d.value);
    return ui.card({ title: 'Lamaran per negara tujuan', subtitle: `${M.apps.length} lamaran`, icon: 'globe', body: data.length ? ui.barChart({ data, height: 190 }) : ui.emptyState({ title: 'Belum ada lamaran' }) });
  }
  function wQuota(M) {
    const rows = M.codes.slice().sort((a, b) => (b.utilized + b.reserved) / b.total - (a.utilized + a.reserved) / a.total);
    return ui.card({ title: 'Utilisasi kuota per Placement Code', subtitle: 'Tersedia = Total − Dicadangkan − Terpakai (tidak pernah < 0, RUL-006)', icon: 'layers', actions: moreLink('Semua kode', '/placement-codes'),
      body: rows.length ? [
        h('div', { class: 'db-qleg' }, h('span', null, h('i', { style: 'background:var(--green)' }), 'Terpakai'), h('span', null, h('i', { style: 'background:var(--amber)' }), 'Dicadangkan'), h('span', null, h('i', { style: 'background:var(--blue)' }), 'Tersedia')),
        rows.map(p => h('div', { class: 'db-qrow' }, h('div', null, allowed('/placement-codes') ? ui.codeLink(p.id) : h('span', { class: 'mono' }, p.id), h('div', { class: 'db-mini' }, dest(p), p.status === 'FULL' ? ' · ' : '', p.status === 'FULL' ? ui.badge('Penuh', 'amber') : '')), ui.quotaBar(p), h('div', { class: 'num' }, `${p.utilized}/${p.reserved}/${p.available}`, h('span', { class: 'db-mini' }, ` dari ${p.total}`)))),
        h('div', { class: 'db-note' }, 'Angka: terpakai / dicadangkan / tersedia.')] : ui.emptyState({ title: 'Belum ada Placement Code aktif' }) });
  }
  function wRisk(M, names = true) {
    const rows = M.riskTasks.slice().sort((a, b) => (b.status === 'BLOCKED') - (a.status === 'BLOCKED') || +taskDue(a) - +taskDue(b));
    const cols = [
      { key: 'caseId', label: 'Case', render: t => (allowed('/cases') ? ui.caseLink(t.caseId) : h('span', { class: 'mono' }, t.caseId)) },
      names && { key: 'w', label: 'Worker', render: t => h('span', null, wname((D.case(t.caseId) || {}).workerId)) },
      { key: 'title', label: 'Langkah', render: t => t.title },
      { key: 'a', label: 'PIC', render: t => ui.userChip(t.assigneeId) },
      { key: 's', label: 'Kondisi', render: t => (t.status === 'BLOCKED' ? h('span', { class: 'row gap-sm' }, ui.badge('Terhambat', 'red', { dot: true }), overdue(t) ? ui.badge(`${lateDays(t)} hr`, 'amber') : null) : dueBadge(taskDue(t))) },
    ].filter(Boolean);
    return ui.card({ title: 'Terlambat & terhambat teratas', subtitle: `${M.overdueTasks.length} tugas terlambat · ${M.blockedTasks.length} terhambat`, icon: 'alert', actions: moreLink('Monitor', '/monitor'), flush: true,
      body: miniTable(cols, rows, { pageSize: 6, empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada yang terlambat atau terhambat', text: 'Semua tugas aktif berjalan sesuai jadwal.' }) }) });
  }
  function wApprovals(M) {
    return ui.card({ title: 'Persetujuan menunggu', subtitle: `${M.approvals.length} permintaan`, icon: 'check-square', actions: moreLink('Buka Persetujuan', '/approvals'),
      body: M.approvals.length ? h('div', null, M.approvals.map(a => h('div', { class: 'db-li db-ap' }, h('div', { class: 'grow' }, h('div', { class: 'tt' }, a.title), h('div', { class: 'db-mini' }, `Diminta ${uname(a.requestedBy)} · ${fmt.rel(a.at)} · batas ${fmt.rel(a.expires)}`)), allowed('/approvals') ? h('a', { class: 'btn btn-sm', href: '#/approvals' }, BGS.isRole('director') ? 'Tinjau' : 'Lihat') : null)))
        : ui.emptyState({ icon: 'check-circle', title: 'Tidak ada persetujuan menunggu' }) });
  }
  function wNotif() {
    const all = BGS.myNotifications(), un = all.filter(n => !n.read).length;
    return ui.card({ title: 'Notifikasi terbaru', subtitle: un ? `${un} belum dibaca` : 'Semua sudah dibaca', icon: 'bell', actions: moreLink('Semua', '/notifications'),
      body: all.length ? all.slice(0, 4).map(n => h('a', { class: 'db-li', href: n.link || '#/notifications', style: 'text-decoration:none;color:inherit' }, h('span', { class: 'badge b-' + (n.read ? 'gray' : 'blue'), style: 'padding:0;width:8px;height:8px;margin-top:6px;flex:none' }), h('div', { class: 'grow' }, h('div', { style: n.read ? '' : 'font-weight:700' }, n.text), h('div', { class: 'db-mini' }, fmt.rel(n.at))))) : ui.emptyState({ icon: 'bell', title: 'Belum ada notifikasi' }) });
  }

  // ---------- tabel kerja ----------
  const T = {
    regs: rows => miniTable([
      { key: 'name', label: 'Pendaftar', render: r => h('div', null, h('b', null, r.name), r.dupOf ? h('div', null, ui.badge('Kemungkinan duplikat', 'amber')) : null) },
      { key: 'd', label: 'Tujuan', render: r => dest(r) },
      { key: 'at', label: 'Masuk', render: r => fmt.rel(r.submittedAt) },
      { key: 'x', label: '', render: r => (allowed('/registrations') ? h('a', { class: 'btn btn-sm', href: '#/registrations/' + r.id }, 'Tinjau') : null) },
    ], rows, { empty: ui.emptyState({ icon: 'inbox', title: 'Inbox kosong', text: 'Tidak ada registrasi baru.' }) }),
    apps: (rows, extra) => miniTable([
      { key: 'w', label: 'Worker', render: a => ui.workerLink(a.workerId) },
      { key: 'd', label: 'Tujuan', render: a => dest(a) },
      { key: 's', label: 'Status', render: a => ui.status('application', a.status) },
      extra,
      { key: 'x', label: '', render: a => h('a', { class: 'btn btn-sm', href: '#/applications/' + a.id }, 'Buka') },
    ].filter(Boolean), rows, { empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada lamaran', text: 'Antrean kosong.' }) }),
    cand: rows => miniTable([
      { key: 'w', label: 'Kandidat', render: a => ui.workerLink(a.workerId) },
      { key: 'd', label: 'Tujuan', render: a => dest(a) },
      { key: 's', label: 'Status', render: a => ui.status('application', a.status) },
      { key: 'x', label: '', render: a => (BGS.can('case.allocate') ? h('a', { class: 'btn btn-sm btn-primary', href: '#/allocation?app=' + a.id }, 'Alokasikan') : null) },
    ], rows, { empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada kandidat menunggu', text: 'Belum ada lamaran terpilih/cadangan tanpa case.' }) }),
    docs: rows => miniTable([
      { key: 't', label: 'Dokumen', render: d => h('div', null, h('b', null, (D.docType(d.typeId) || {}).name), h('div', { class: 'db-mini' }, d.filename)) },
      { key: 'o', label: 'Pemilik', render: d => (d.ownerType === 'worker' ? ui.workerLink(d.ownerId) : ui.caseLink(d.ownerId)) },
      { key: 'u', label: 'Diunggah', render: d => `${fmt.rel(d.uploadedAt)} · ${uname(d.uploadedBy).split(' ')[0]}` },
      { key: 'x', label: '', render: d => h('a', { class: 'btn btn-sm', href: '#/documents?owner=' + d.ownerId }, 'Periksa') },
    ], rows, { empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada dokumen menunggu' }) }),
    cases: (M, rows) => miniTable([
      { key: 'id', label: 'Case', render: c => ui.caseLink(c.id) },
      { key: 'w', label: 'Worker', render: c => ui.workerLink(c.workerId) },
      { key: 'st', label: 'Langkah terlambat', render: c => { const t = M.overdueTasks.filter(x => x.caseId === c.id).sort((a, b) => +taskDue(a) - +taskDue(b))[0]; return t ? h('div', null, t.title, h('div', null, dueBadge(taskDue(t)))) : '—'; } },
      { key: 'p', label: 'PIC', render: c => { const t = M.overdueTasks.find(x => x.caseId === c.id); return t ? ui.userChip(t.assigneeId) : '—'; } },
    ], rows, { empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada case terlambat', text: 'Semua case berjalan sesuai jadwal.' }) }),
    verify: (rows, refresh) => miniTable([
      { key: 'tt', label: 'Tugas', render: t => h('div', null, h('b', null, t.title), h('div', null, ui.caseLink(t.caseId))) },
      { key: 'a', label: 'Dikerjakan', render: t => ui.userChip(t.assigneeId) },
      { key: 'v', label: 'Verifier', render: t => (t.verifierId ? ui.userChip(t.verifierId) : '—') },
      { key: 'due', label: 'Jatuh tempo', render: t => dueBadge(taskDue(t)) },
      { key: 'x', label: '', render: t => taskOpen(t, refresh) },
    ], rows, { empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada tugas menunggu verifikasi' }) }),
  };
  const card = (title, icon, body, o = {}) => ui.card(Object.assign({ title, icon, body, flush: true }, o));

  // ====================================================================
  // /dashboard — adaptif per role
  // ====================================================================
  function dashExec(ctx, viewer) {
    const M = metrics(), mv = MVP(), out = [];
    out.push(ui.pageHeader({ title: greet(), subtitle: viewer ? 'Ringkasan hanya-baca. Data pribadi (NIK, paspor, telepon) tidak ditampilkan untuk Viewer.' : `Ringkasan eksekutif per ${fmt.date(NOW())}: pipeline, case, kuota, dan risiko — tanpa rekap manual.`,
      actions: [abtn('Laporan', '/reports', null, 'bar-chart'), abtn('Analitik lanjutan', '/dashboard/advanced', 'primary', 'trending-up')] }));
    out.push(mvpNote());
    if (viewer) out.push(ui.callout('info', 'Mode baca-saja (Viewer)', 'Anda dapat melihat ringkasan dan laporan terbatas. Tombol ubah/ekspor data sensitif dinonaktifkan (BR-027).'));
    const k = [
      kpi({ label: 'Worker aktif', value: num(M.workerActive.length), sub: `${num(M.workers.length)} total · ${M.workers.filter(w => w.status === 'DEPLOYED').length} sudah berangkat`, tone: 'blue', icon: 'users', href: '/workers' }),
      kpi({ label: 'Lamaran di pipeline', value: num(M.pipeline.length), sub: `${M.apps.filter(a => a.status === 'ALLOCATED').length} dialokasikan · ${M.apps.filter(a => a.status === 'REJECTED').length} ditolak`, tone: 'purple', icon: 'clipboard', href: '/applications' }),
    ];
    if (mv === 1) k.push(
      kpi({ label: 'Registrasi baru', value: num(M.newRegs.length), sub: 'Menunggu tinjauan Admin', tone: 'blue', icon: 'inbox', href: '/registrations' }),
      kpi({ label: 'Dokumen menunggu verifikasi', value: num(M.docsPending.length), sub: `${M.docs.length} dokumen aktif`, tone: 'amber', icon: 'folder', href: '/documents?status=UPLOADED' }));
    else {
      k.push(
        kpi({ label: 'Case aktif', value: num(M.activeCases.length), sub: `${M.cases.filter(c => c.status === 'DRAFT').length} draf · ${M.cases.filter(c => c.status === 'DEPARTED').length} berangkat`, tone: 'orange', icon: 'briefcase', href: '/cases' }),
        kpi({ label: 'Terlambat / terhambat', value: num(M.riskCount), sub: `${M.overdueTasks.length} terlambat · ${M.blockedTasks.length} terhambat`, tone: M.riskCount ? 'red' : 'green', icon: 'alert', href: '/monitor' }),
        kpi({ label: 'Kuota tersedia', value: num(M.quotaAvail), sub: `dari ${num(M.quotaTotal)} · ${num(M.quotaUsed)} terpakai`, tone: 'teal', icon: 'layers', href: '/placement-codes' }));
      if (!viewer) k.push(kpi({ label: 'Persetujuan menunggu', value: num(M.approvals.length), sub: M.approvals.length ? `Terdekat batas ${fmt.rel(M.approvals.slice().sort((a, b) => a.expires.localeCompare(b.expires))[0].expires)}` : 'Tidak ada antrean', tone: 'amber', icon: 'check-square', href: '/approvals' }));
    }
    out.push(h('div', { class: 'db-kpis' }, k));
    out.push(h('div', { class: 'grid cols-2' }, wFunnel(M), mv >= 2 ? wCaseDonut(M) : wWorkerDonut(M)));
    out.push(h('div', { class: 'grid cols-21' }, wTrend(), wCountryBars(M)));
    if (mv >= 2) {
      out.push(h('div', { class: viewer ? '' : 'grid cols-32' }, wQuota(M), viewer ? null : h('div', { class: 'stack' }, wApprovals(M), wNotif())));
      out.push(wRisk(M, !viewer));
    }
    return out;
  }

  function dashAdmin(ctx) {
    const M = metrics(), mv = MVP(), out = [];
    out.push(ui.pageHeader({ title: greet(), subtitle: `Antrean kerja Admin per ${fmt.date(NOW())}. Klik kartu untuk membuka daftar terkait.`,
      actions: [abtn('Worker baru', '/workers/new', 'primary', 'plus'), abtn('Impor Excel', '/import', null, 'upload'), abtn('Inbox registrasi', '/registrations', null, 'inbox'), mv >= 2 ? abtn('Alokasi', '/allocation', null, 'git-branch') : null] }));
    out.push(mvpNote());
    out.push(h('div', { class: 'db-qs' }, queueDefs(M).map(queueCard)));
    out.push(h('div', { class: 'grid cols-2' },
      card(`Registrasi baru (${M.newRegs.length})`, 'inbox', T.regs(M.newRegs.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))), { subtitle: 'Cek duplikat NIK sebelum diterima (RUL-002/003)', actions: moreLink('Inbox', '/registrations') }),
      card(`Dokumen menunggu verifikasi (${M.docsPending.length})`, 'folder', T.docs(M.docsPending.slice().sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))), { subtitle: 'Yang menunggu paling lama di atas · pengunggah tidak boleh memverifikasi (RUL-016)', actions: moreLink('Dokumen', '/documents') })));
    out.push(h('div', { class: 'grid cols-2' },
      card(`Lamaran perlu keputusan (${M.appsDecide.length})`, 'clipboard', T.apps(M.appsDecide, { key: 'iv', label: 'Skor wawancara', render: a => (a.screening.interview.score != null ? a.screening.interview.score : '—') }), { subtitle: 'Keputusan wajib disertai alasan (RUL-022)', actions: moreLink('Lamaran', '/applications') }),
      mv >= 2 ? card(`Kandidat siap alokasi (${M.candidates.length})`, 'git-branch', T.cand(M.candidates), { subtitle: 'Kuota dicadangkan saat case dibuat (RUL-004)', actions: moreLink('Alokasi', '/allocation') })
        : card(`Lamaran perlu screening (${M.appsScreen.length})`, 'clipboard', T.apps(M.appsScreen), { actions: moreLink('Lamaran', '/applications') })));
    if (mv >= 2) {
      out.push(h('div', { class: 'grid cols-2' },
        card(`Case terlambat (${M.overdueCases.length})`, 'alert', T.cases(M, M.overdueCases), { subtitle: 'Ada tugas aktif yang lewat jatuh tempo', actions: moreLink('Monitor', '/monitor') }),
        card(`Tugas menunggu verifikasi (${M.verifyTasks.length})`, 'shield', T.verify(M.verifyTasks, ctx.refresh), { actions: moreLink('Tugas', '/tasks') })));
      out.push(h('div', { class: 'grid cols-21' }, wQuota(M), wNotif()));
    }
    return out;
  }

  function dashPic(ctx) {
    const M = metrics(), mv = MVP(), me = ME(), out = [], u = BGS.user();
    const mine = M.tasks.filter(t => OPEN_TASK.includes(t.status) && (t.assigneeId === me || (t.verifierId === me && t.status === 'PENDING_VERIFICATION')));
    const myDo = mine.filter(t => t.assigneeId === me);   // sama dengan badge "Tugas" di sidebar
    const myReady = myDo.filter(actionable);
    const soon = myReady.filter(t => { const d = (taskDue(t) - NOW()) / DAY; return d >= 0 && d <= 3; });
    const late = myReady.filter(overdue);
    const verifyDocs = M.docsPending.filter(d => d.uploadedBy !== me);
    const myApps = M.apps.filter(a => a.picId === me && ['SUBMITTED', 'SCREENING', 'REVISION_REQUIRED'].includes(a.status));
    out.push(ui.pageHeader({ title: greet(), subtitle: `${u.picRole || 'PIC'} · Hanya data yang ditugaskan kepada Anda yang tampil (RUL-020).`, actions: [mv >= 2 ? abtn('Semua tugas saya', '/tasks', 'primary', 'check-square') : null, abtn('Dokumen', '/documents', null, 'folder')] }));
    out.push(mvpNote());
    const k = [];
    if (mv >= 2) k.push(
      kpi({ label: 'Tugas saya', value: num(myDo.length), sub: `${myReady.length} siap dikerjakan · ${myDo.length - myReady.length} menunggu langkah sebelumnya · ${mine.length - myDo.length} untuk saya verifikasi`, tone: 'blue', icon: 'check-square', href: '/tasks' }),
      kpi({ label: 'Jatuh tempo ≤ 3 hari', value: num(soon.length), sub: 'Segera kerjakan', tone: 'amber', icon: 'clock', href: '/tasks' }),
      kpi({ label: 'Terlambat', value: num(late.length), sub: late.length ? 'Perlu tindakan hari ini' : 'Tidak ada tugas terlambat', tone: late.length ? 'red' : 'green', icon: 'alert', href: '/tasks' }),
      kpi({ label: 'Case ditugaskan', value: num(M.activeCases.length), sub: `${M.cases.length} case total dalam scope`, tone: 'orange', icon: 'briefcase', href: '/cases' }));
    k.push(
      kpi({ label: 'Dokumen untuk diverifikasi', value: num(verifyDocs.length), sub: `${M.docsPending.length - verifyDocs.length} unggahan saya sendiri tidak dihitung`, tone: 'purple', icon: 'folder', href: '/documents?status=UPLOADED' }),
      kpi({ label: 'Lamaran untuk di-screening', value: num(myApps.length), sub: 'Ditugaskan ke saya', tone: 'teal', icon: 'clipboard', href: '/applications' }));
    out.push(h('div', { class: 'db-kpis' }, k));
    if (mv >= 2) {
      const rows = mine.slice().sort((a, b) => (actionable(b) - actionable(a)) || +taskDue(a) - +taskDue(b));
      out.push(card(`Tugas saya (${mine.length})`, 'check-square', miniTable([
        { key: 'due', label: 'Jatuh tempo', render: t => (actionable(t) ? dueBadge(taskDue(t)) : ui.badge('Menunggu langkah sebelumnya', 'gray')) },
        { key: 'tt', label: 'Tugas', render: t => h('div', null, h('b', null, t.title), h('div', { class: 'db-mini' }, t.assigneeId === me ? 'Saya kerjakan' : 'Saya verifikasi')) },
        { key: 'c', label: 'Case', render: t => h('div', null, ui.caseLink(t.caseId), h('div', { class: 'db-mini' }, wname((D.case(t.caseId) || {}).workerId))) },
        { key: 's', label: 'Status', render: t => ui.status('task', t.status) },
        { key: 'x', label: '', render: t => taskOpen(t, ctx.refresh) },
      ], rows, { pageSize: 8, empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada tugas aktif', text: 'Anda sudah menyelesaikan semua tugas yang ditugaskan.' }) }), { subtitle: 'Urut dari jatuh tempo terdekat', actions: moreLink('Semua tugas', '/tasks') }));
      out.push(h('div', { class: 'grid cols-2' },
        card(`Case yang ditugaskan (${M.cases.length})`, 'briefcase', miniTable([
          { key: 'id', label: 'Case', render: c => ui.caseLink(c.id) },
          { key: 'w', label: 'Worker', render: c => ui.workerLink(c.workerId) },
          { key: 'st', label: 'Status', render: c => ui.status('case', c.status) },
          { key: 'p', label: 'Progres', render: c => { const done = c.steps.filter(s => s.status === 'COMPLETED').length; return h('div', { style: 'min-width:90px' }, ui.progress(c.steps.length ? (done / c.steps.length) * 100 : 0, 'green'), h('div', { class: 'db-mini' }, `${done}/${c.steps.length} langkah`)); } },
        ], M.cases, { empty: ui.emptyState({ icon: 'briefcase', title: 'Belum ada case', text: 'Case akan muncul setelah Admin menugaskan Anda.' }) }), { actions: moreLink('Semua case', '/cases') }),
        card(`Dokumen untuk diverifikasi (${verifyDocs.length})`, 'folder', T.docs(verifyDocs), { subtitle: 'Unggahan sendiri tidak ditampilkan (RUL-016)', actions: moreLink('Dokumen', '/documents') })));
      out.push(h('div', { class: 'grid cols-2' }, card(`Lamaran untuk di-screening (${myApps.length})`, 'clipboard', T.apps(myApps)), wNotif()));
    } else {
      out.push(h('div', { class: 'grid cols-2' }, card(`Lamaran untuk di-screening (${myApps.length})`, 'clipboard', T.apps(myApps), { actions: moreLink('Lamaran', '/applications') }), card(`Dokumen untuk diverifikasi (${verifyDocs.length})`, 'folder', T.docs(verifyDocs), { subtitle: 'Unggahan sendiri tidak ditampilkan (RUL-016)', actions: moreLink('Dokumen', '/documents') })));
    }
    return out;
  }

  function dashSuper(ctx) {
    const M = metrics(), mv = MVP(), out = [];
    const users = D.users.filter(u => u.active);
    const need2fa = users.filter(u => u.roles.some(r => ['superadmin', 'director', 'admin'].includes(r)));
    const ok2fa = need2fa.filter(u => u.twofa);
    const tplPub = D.templates.filter(t => t.versions.some(v => v.status === 'PUBLISHED')), tplDraft = D.templates.filter(t => t.versions.some(v => v.status === 'DRAFT'));
    const rulesLegal = D.requirements.filter(r => r.legal === 'PERLU_VERIFIKASI'), refsLegal = D.regRefs.filter(r => r.legal === 'PERLU_VERIFIKASI');
    out.push(ui.pageHeader({ title: greet(), subtitle: `Tampilan sistem per ${fmt.date(NOW())}: keamanan akun, template, aturan, dan antrean operasional.`, actions: [abtn('Pengguna', '/users', 'primary', 'user'), abtn('Audit trail', '/audit', null, 'shield'), abtn('Pengaturan', '/settings', null, 'settings')] }));
    out.push(mvpNote());
    const k = [
      kpi({ label: 'Pengguna aktif', value: num(users.length), sub: `${D.users.length - users.length} nonaktif · ${users.filter(u => u.roles.includes('pic')).length} PIC`, tone: 'blue', icon: 'user', href: '/users' }),
      kpi({ label: '2FA wajib aktif', value: `${ok2fa.length}/${need2fa.length}`, sub: ok2fa.length === need2fa.length ? 'Semua akun wajib sudah 2FA' : `${need2fa.length - ok2fa.length} akun belum 2FA`, tone: ok2fa.length === need2fa.length ? 'green' : 'red', icon: 'lock', href: '/users' }),
      kpi({ label: 'Aturan perlu verifikasi hukum', value: num(rulesLegal.length), sub: `${refsLegal.length} rujukan regulasi juga menunggu (RUL-024)`, tone: 'amber', icon: 'list', href: '/compliance/rules' }),
    ];
    if (mv >= 2) k.push(
      kpi({ label: 'Template workflow', value: `${tplPub.length} / ${tplDraft.length}`, sub: 'PUBLISHED / punya versi DRAFT', tone: 'purple', icon: 'git-branch', href: '/workflows' }),
      kpi({ label: 'Persetujuan menunggu', value: num(M.approvals.length), sub: 'Menunggu keputusan Director', tone: 'amber', icon: 'check-square', href: '/approvals' }));
    out.push(h('div', { class: 'db-kpis' }, k));
    out.push(h('div', { class: 'grid cols-2' },
      card('Akun & status 2FA', 'lock', miniTable([
        { key: 'name', label: 'Pengguna', render: u => h('div', null, h('b', null, u.name), h('div', { class: 'db-mini' }, u.email)) },
        { key: 'r', label: 'Peran', render: u => h('div', { class: 'row wrap gap-sm' }, u.roles.map(r => ui.roleBadge(r))) },
        { key: 'f', label: '2FA', render: u => { const req = u.roles.some(r => ['superadmin', 'director', 'admin'].includes(r)); return u.twofa ? ui.badge('Aktif', 'green', { dot: true }) : req ? ui.badge('Belum aktif!', 'red', { dot: true }) : ui.badge('Tidak wajib', 'gray'); } },
        { key: 'l', label: 'Login terakhir', render: u => fmt.rel(u.last) },
      ], users, { pageSize: 6 }), { subtitle: 'Superadmin, Director, Admin wajib 2FA (BAC-08)', actions: moreLink('Kelola', '/users') }),
      card(`Aturan perlu verifikasi hukum (${rulesLegal.length})`, 'list', miniTable([
        { key: 'name', label: 'Aturan', render: r => h('div', null, r.name, h('div', { class: 'db-mini' }, `${r.type} · ${r.scope.country === '*' ? 'Semua negara' : D.cn(r.scope.country)}`)) },
        { key: 'l', label: 'Status', render: r => ui.status('legal', r.legal) },
        { key: 's', label: 'Rule', render: r => ui.status('generic', r.status) },
      ], rulesLegal, { pageSize: 5, empty: ui.emptyState({ icon: 'check-circle', title: 'Semua aturan terverifikasi' }) }), { subtitle: 'Checklist bukan bukti resmi kepatuhan (RUL-024)', actions: moreLink('Aturan', '/compliance/rules') })));
    if (mv >= 2) out.push(h('div', { class: 'grid cols-2' },
      card('Template workflow: DRAFT vs PUBLISHED', 'git-branch', miniTable([
        { key: 'name', label: 'Template', render: t => (allowed('/workflows') ? h('a', { class: 'lnk', href: '#/workflows/' + t.id }, t.name) : t.name) },
        { key: 'v', label: 'Versi', render: t => h('div', { class: 'row wrap gap-sm' }, t.versions.slice().reverse().map(v => h('span', { title: `v${v.v}` }, ui.badge(`v${v.v} ${stLabel('template', v.status)}`, stTone('template', v.status))))) },
        { key: 'u', label: 'Case berjalan', render: t => D.cases.filter(c => c.templateId === t.id && ACTIVE_CASE.includes(c.status)).length },
      ], D.templates, { pageSize: 6 }), { subtitle: 'Hanya Superadmin yang membangun template (RUL-013); publish perlu approval Director', actions: moreLink('Workflow', '/workflows') }),
      wApprovals(M)));
    out.push(card('Aktivitas audit terbaru', 'shield', miniTable([
      { key: 'at', label: 'Waktu', render: a => fmt.dateTime(a.at) },
      { key: 'u', label: 'Pengguna', render: a => uname(a.userId) },
      { key: 'a', label: 'Aksi', render: a => a.action },
      { key: 'e', label: 'Objek', render: a => h('span', { class: 'mono' }, a.entityId) },
    ], D.audit.slice(0, 30), { pageSize: 6 }), { subtitle: 'Append-only; tidak dapat diubah (BR-028)', actions: moreLink('Audit trail', '/audit') }));
    out.push(ui.pageHeader({ title: 'Ringkasan antrean operasional', subtitle: 'Sama seperti dashboard Admin — agar Superadmin bisa menggantikan Admin bila perlu.' }));
    out.push(h('div', { class: 'db-qs' }, queueDefs(M).map(queueCard)));
    out.push(h('div', { class: 'grid cols-2' }, wFunnel(M), mv >= 2 ? wCaseDonut(M) : wWorkerDonut(M)));
    if (mv >= 2) out.push(wNotif());
    return out;
  }

  BGS.router.add('/dashboard', { title: 'Dashboard', roles: BGS.ROLES.ALL, mvp: 1, render(ctx) {
    const fn = { director: c => dashExec(c, false), viewer: c => dashExec(c, true), admin: dashAdmin, pic: dashPic, superadmin: dashSuper }[BGS.role()] || dashAdmin;
    fn(ctx).filter(Boolean).forEach(n => ctx.el.appendChild(n));
  } });

  // ====================================================================
  // Analitik bersama (dipakai /dashboard/advanced dan /reports)
  // ====================================================================
  const EXPORTS = [
    { at: new Date(NOW() - 2 * DAY).toISOString(), userId: 'U04', report: 'Daftar worker', rows: 42, fmt: 'CSV', note: 'Data sensitif disamarkan' },
    { at: new Date(NOW() - 5 * DAY).toISOString(), userId: 'U03', report: 'Funnel rekrutmen', rows: 8, fmt: 'CSV', note: 'Data sensitif disamarkan' },
    { at: new Date(NOW() - 9 * DAY).toISOString(), userId: 'U01', report: 'Dokumen worker', rows: 218, fmt: 'Cetak/PDF', note: 'Data sensitif disamarkan' },
  ];
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const r1 = v => (v == null ? null : Math.round(v * 10) / 10);
  const dayDiff = (a, b) => (new Date(a) - new Date(b)) / DAY;
  const taskOfStep = (c, s) => D.tasks.find(t => t.caseId === c.id && t.stepId === s.stepId);
  const pctOf = (a, b) => (b ? Math.round((a / b) * 100) : null);

  function bottleneckRows() {
    const map = {};
    D.cases.filter(c => c.status !== 'CANCELLED').forEach(c => c.steps.forEach(s => {
      const m = map[s.name] || (map[s.name] = { name: s.name, cases: 0, active: 0, overdue: 0, lateSum: 0, blocked: 0, done: 0, onTime: 0 });
      m.cases++;
      const t = taskOfStep(c, s);
      if (s.status === 'COMPLETED') { m.done++; if (!s.completedAt || !s.dueAt || new Date(s.completedAt) <= new Date(s.dueAt)) m.onTime++; }
      if (['READY', 'IN_PROGRESS'].includes(s.status) && ACTIVE_CASE.includes(c.status)) {
        m.active++;
        if (t && overdue(t)) { m.overdue++; m.lateSum += lateDays(t); }
        if (t && t.status === 'BLOCKED') m.blocked++;
      }
    }));
    return Object.values(map).map(m => Object.assign(m, { avgLate: m.overdue ? m.lateSum / m.overdue : 0, onTimePct: pctOf(m.onTime, m.done) })).sort((a, b) => b.overdue - a.overdue || b.avgLate - a.avgLate || b.active - a.active);
  }
  function durationRows(key) {
    return [...new Set(D.cases.map(c => c[key]))].map(k => {
      const cs = D.cases.filter(c => c[key] === k && c.status !== 'CANCELLED');
      const dep = cs.filter(c => c.status === 'DEPARTED'), run = cs.filter(c => c.status !== 'DEPARTED');
      const durs = dep.map(c => dayDiff(c.flight ? c.flight.date : NOW(), (D.worker(c.workerId) || {}).createdAt));
      const ages = run.map(c => dayDiff(NOW(), (D.worker(c.workerId) || {}).createdAt));
      return { key: k, label: key === 'country' ? D.cn(k) : D.pn(k), short: key === 'country' ? SHORT[k] || k : D.pn(k), n: cs.length, nDep: dep.length, nRun: run.length, avgDep: r1(avg(durs)), avgRun: r1(avg(ages)) };
    }).sort((a, b) => b.n - a.n);
  }
  function appDurations() {
    return D.applications.filter(a => a.decision && a.decision.at).map(a => ({ a, d: dayDiff(a.decision.at, a.createdAt) }));
  }
  function picRows() {
    return D.users.filter(u => D.tasks.some(t => t.assigneeId === u.id || t.verifierId === u.id)).map(u => {
      const mine = D.tasks.filter(t => t.assigneeId === u.id);
      const active = mine.filter(actionable), od = active.filter(overdue);
      const done = mine.filter(t => t.status === 'COMPLETED');
      const onTime = done.filter(t => { const s = inst(D.case(t.caseId), t.stepId); const due = s && s.dueAt ? s.dueAt : t.dueAt; return !s || !s.completedAt || new Date(s.completedAt) <= new Date(due); });
      return { u, role: u.picRole || BGS.roles[u.roles[0]], active: active.length, overdue: od.length, blocked: active.filter(t => t.status === 'BLOCKED').length, verifyQ: D.tasks.filter(t => t.verifierId === u.id && t.status === 'PENDING_VERIFICATION').length, cases: D.cases.filter(c => ACTIVE_CASE.includes(c.status) && Object.values(c.pics).includes(u.id)).length, done: done.length, onTime: onTime.length, rate: pctOf(onTime.length, done.length) };
    }).sort((a, b) => b.active - a.active);
  }
  const PIC_CAP = 8;
  function firstPass() {
    const returned = c => (c.finalReturns || 0) > 0 || D.audit.some(a => a.entityId === c.id && /verifikasi akhir/i.test(a.action + ' ' + a.detail) && /(dikembalikan|ditolak|gagal)/i.test(a.action + ' ' + a.detail));
    const base = D.cases.filter(c => ['READY_TO_DEPART', 'DEPARTED'].includes(c.status) || (c.status === 'FINAL_VERIFICATION' && returned(c)));
    const clean = base.filter(c => !returned(c));
    return { base, clean, rate: pctOf(clean.length, base.length), waiting: D.cases.filter(c => c.status === 'FINAL_VERIFICATION') };
  }
  function docsReadiness() {
    const req = D.docTypes.filter(t => t.required && D.documents.some(d => d.typeId === t.id && d.ownerType === 'worker'));
    const cs = D.cases.filter(c => POST_FV.includes(c.status));
    let ok = 0, tot = 0;
    cs.forEach(c => req.forEach(t => { tot++; if (D.documents.some(d => d.ownerType === 'worker' && d.ownerId === c.workerId && d.typeId === t.id && d.status === 'VERIFIED')) ok++; }));
    return { ok, tot, pct: pctOf(ok, tot), cases: cs.length };
  }
  function trendOf(items, dateOf, valOf, higherBetter) {
    const w = (from, to) => items.filter(i => { const d = dayDiff(NOW(), dateOf(i)); return d >= from && d < to; }).map(valOf);
    const cur = w(0, 30), prev = w(30, 60);
    return { cur: avg(cur), prev: avg(prev), nCur: cur.length, nPrev: prev.length, higherBetter };
  }
  const trendNode = t => {
    if (!t || t.cur == null || t.prev == null) return h('span', { class: 'adv-trend adv-flat', title: 'Belum ada data pembanding 30 hari sebelumnya' }, '—');
    const d = t.cur - t.prev;
    if (Math.abs(d) < 0.05) return h('span', { class: 'adv-trend adv-flat', title: '30 hari terakhir vs 30 hari sebelumnya' }, '▬ stabil');
    const good = t.higherBetter ? d > 0 : d < 0;
    return h('span', { class: 'adv-trend ' + (good ? 'adv-up' : 'adv-down'), title: `30 hari terakhir ${r1(t.cur)} (n=${t.nCur}) vs sebelumnya ${r1(t.prev)} (n=${t.nPrev})` }, (d > 0 ? '▲ +' : '▼ ') + r1(d));
  };

  // 17 KPI dari BRD §20
  function kpiRows() {
    const workers = D.workers.filter(w => !w.aliasOf);
    const nikCount = {}; workers.forEach(w => { nikCount[w.nik] = (nikCount[w.nik] || 0) + 1; });
    const dupNik = Object.values(nikCount).filter(n => n > 1).length;
    const fields = ['name', 'gender', 'dob', 'nik', 'phone', 'city', 'address', 'education', 'maritalStatus'];
    const filled = workers.reduce((a, w) => a + fields.filter(f => w[f]).length, 0);
    const newRegs = D.registrations.filter(r => r.status === 'NEW');
    const waitNew = avg(newRegs.map(r => dayDiff(NOW(), r.submittedAt)));
    const ad = appDurations();
    const dr = docsReadiness();
    const dep = D.cases.filter(c => c.status === 'DEPARTED');
    const depDur = dep.map(c => ({ c, d: dayDiff(c.flight ? c.flight.date : NOW(), (D.worker(c.workerId) || {}).createdAt) }));
    const cases = D.cases.filter(c => c.status !== 'CANCELLED');
    const doneT = D.tasks.filter(t => t.status === 'COMPLETED');
    const onTimeT = doneT.filter(t => { const s = inst(D.case(t.caseId), t.stepId); return !s || !s.completedAt || !s.dueAt || new Date(s.completedAt) <= new Date(s.dueAt); });
    const act = D.tasks.filter(actionable);
    const codes = D.placementCodes.filter(p => p.status !== 'CLOSED');
    const activeCases = D.cases.filter(c => ACTIVE_CASE.includes(c.status));
    const fp = firstPass();
    const actU = D.users.filter(u => u.active), weekly = actU.filter(u => dayDiff(NOW(), u.last) <= 7);
    const srDone = D.subjectRequests.filter(s => s.status === 'SELESAI'), srLate = D.subjectRequests.filter(s => s.status !== 'SELESAI' && new Date(s.due) < NOW());
    const util = codes.length ? Math.round((codes.reduce((a, p) => a + p.utilized + p.reserved, 0) / codes.reduce((a, p) => a + p.total, 0)) * 100) : 0;
    const pc = v => (v == null ? 'n/a' : v + '%');
    const B = 'Belum diukur';
    return [
      { id: 'KPI-01', m: '% worker aktif tercatat di sistem', b: B, t: '100% pada akhir cutover', mvp: '1', v: `${workers.filter(w => ['ACTIVE', 'IN_PROCESS'].includes(w.status)).length} worker aktif tercatat`, note: 'Penyebut (jumlah di Excel lama) belum diinput', ok: null },
      { id: 'KPI-02', m: 'Jumlah NIK ganda aktif', b: B, t: '0', mvp: '1', v: `${dupNik} NIK ganda`, note: 'NIK unik dijaga sistem (RUL-002)', ok: dupNik === 0 },
      { id: 'KPI-03', m: 'Kelengkapan profil worker (field wajib)', b: B, t: '≥ 95%', mvp: '1', v: pc(pctOf(filled, workers.length * fields.length)), note: `${fields.length} field wajib × ${workers.length} worker`, ok: pctOf(filled, workers.length * fields.length) >= 95 },
      { id: 'KPI-04', m: 'Waktu rata-rata review Registration Submission', b: B, t: 'Mengikuti SLA owner (§16.3)', mvp: '1', v: waitNew == null ? 'Tidak ada antrean' : `Antrean rata-rata ${r1(waitNew)} hari`, note: `${newRegs.length} registrasi baru menunggu`, ok: null },
      { id: 'KPI-05', m: 'Durasi application: SUBMITTED → keputusan seleksi', b: B, t: 'Turun dari baseline (ditetapkan owner)', mvp: '1', v: ad.length ? `${r1(avg(ad.map(x => x.d)))} hari (n=${ad.length})` : 'n/a', trend: trendOf(ad, x => x.a.decision.at, x => x.d, false), ok: null },
      { id: 'KPI-06', m: '% dokumen required VERIFIED saat final verification', b: B, t: '100% (syarat RUL-018)', mvp: '2', v: dr.tot ? `${dr.pct}% (${dr.ok}/${dr.tot})` : 'n/a', note: `${dr.cases} case pada/lewat verifikasi akhir`, ok: dr.tot ? dr.pct === 100 : null },
      { id: 'KPI-07', m: 'Durasi rata-rata registrasi → keberangkatan per negara/profesi', b: B, t: 'Turun dari baseline', mvp: '2 / 3', v: depDur.length ? `${r1(avg(depDur.map(x => x.d)))} hari (n=${depDur.length})` : 'Belum ada keberangkatan', trend: trendOf(depDur, x => (x.c.flight ? x.c.flight.date : NOW()), x => x.d, false), note: 'Rincian per negara/profesi di tab Durasi', ok: null },
      { id: 'KPI-08', m: '% Placement Case berjalan di bawah Workflow Template ber-versi', b: '0%', t: '100%', mvp: '2', v: pc(pctOf(cases.filter(c => c.templateId && c.templateVersion).length, cases.length)), note: `${cases.length} case`, ok: cases.every(c => c.templateId && c.templateVersion) },
      { id: 'KPI-09', m: '% task selesai tepat waktu (on-time rate)', b: B, t: 'Ditetapkan setelah baseline', mvp: '2', v: doneT.length ? `${pc(pctOf(onTimeT.length, doneT.length))} (${onTimeT.length}/${doneT.length})` : 'n/a', trend: trendOf(doneT.map(t => ({ t, s: inst(D.case(t.caseId), t.stepId) })).filter(x => x.s && x.s.completedAt), x => x.s.completedAt, x => (!x.s.dueAt || new Date(x.s.completedAt) <= new Date(x.s.dueAt) ? 100 : 0), true), ok: null },
      { id: 'KPI-10', m: '% task aktif dengan owner dan due date', b: B, t: '100%', mvp: '2', v: act.length ? `${pc(pctOf(act.filter(t => t.assigneeId && t.dueAt).length, act.length))} (${act.filter(t => t.assigneeId && t.dueAt).length}/${act.length})` : 'n/a', ok: act.every(t => t.assigneeId && t.dueAt) },
      { id: 'KPI-11', m: 'Kejadian Available < 0; utilisasi kuota per Placement Code', b: B, t: '0 kejadian; utilisasi dipantau', mvp: '2', v: `${D.placementCodes.filter(p => p.available < 0).length} kejadian · utilisasi ${util}%`, note: `${codes.length} kode aktif`, ok: D.placementCodes.every(p => p.available >= 0) },
      { id: 'KPI-12', m: 'First-pass rate final verification', b: B, t: 'Meningkat dari baseline', mvp: '2', v: fp.base.length ? `${fp.rate}% (${fp.clean.length}/${fp.base.length})` : 'n/a', note: `${fp.waiting.length} case sedang diverifikasi akhir`, ok: null },
      { id: 'KPI-13', m: 'Waktu penyusunan laporan manajemen bulanan', b: B, t: 'Turun signifikan (dashboard/ekspor langsung)', mvp: '1 / 2', v: `${EXPORTS.length} ekspor langsung tercatat`, note: 'Laporan dibuat langsung dari menu Laporan; durasi manual perlu diukur owner', ok: null },
      { id: 'KPI-14', m: '% perubahan penting dengan jejak audit', b: 'Tidak ada', t: '100%', mvp: '1', v: `${D.audit.length} catatan audit`, note: `${D.audit.filter(a => dayDiff(NOW(), a.at) <= 7).length} dalam 7 hari terakhir`, ok: D.audit.length > 0 },
      { id: 'KPI-15', m: '% case aktif dengan compliance checklist', b: '0%', t: '100%', mvp: '2', v: activeCases.length ? `${pc(pctOf(activeCases.filter(c => c.checklist.length).length, activeCases.length))} (${activeCases.filter(c => c.checklist.length).length}/${activeCases.length})` : 'n/a', ok: activeCases.every(c => c.checklist.length) },
      { id: 'KPI-16', m: 'Adopsi: % user aktif mingguan dari akun terdaftar', b: 'Tidak berlaku', t: '≥ 80% setelah 3 bulan go-live', mvp: '1 / 2', v: `${pc(pctOf(weekly.length, actU.length))} (${weekly.length}/${actU.length})`, ok: pctOf(weekly.length, actU.length) >= 80 },
      { id: 'KPI-17', m: 'Permintaan subjek data selesai dalam batas waktu internal', b: 'Tidak berlaku', t: 'Batas ditetapkan owner', mvp: '2 / 3', v: `${srDone.length} selesai · ${srLate.length} lewat batas`, note: `${D.subjectRequests.length} permintaan tercatat`, ok: srLate.length === 0 },
    ];
  }

  // ====================================================================
  // /dashboard/advanced — MVP 3
  // ====================================================================
  BGS.router.add('/dashboard/advanced', { title: 'Analitik lanjutan', roles: ['superadmin', 'director', 'admin', 'viewer'], mvp: 3, render(ctx) {
    const bn = bottleneckRows(), pic = picRows(), fp = firstPass(), ad = appDurations(), ks = kpiRows();
    const totalOverdue = bn.reduce((a, m) => a + m.overdue, 0), lateSum = bn.reduce((a, m) => a + m.lateSum, 0);
    const doneT = D.tasks.filter(t => t.status === 'COMPLETED');
    const onTimeAll = pic.reduce((a, p) => a + p.onTime, 0), doneAll = pic.reduce((a, p) => a + p.done, 0);
    const viewer = BGS.isRole('viewer');
    ctx.el.appendChild(ui.pageHeader({ title: 'Analitik lanjutan', mvp: 3, subtitle: 'Bottleneck, beban PIC, durasi per negara/profesi, dan 17 KPI. Semua angka dihitung langsung dari data saat ini.', breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'Analitik lanjutan' }], actions: [abtn('Laporan lanjutan', '/reports?r=R-BTL', null, 'bar-chart')] }));
    ctx.el.appendChild(ui.callout('warn', 'Baseline belum diukur', 'Target pada tabel KPI adalah usulan dan harus dikalibrasi setelah baseline didapat (BRD §20). Tren dihitung dari perbandingan 30 hari terakhir vs 30 hari sebelumnya; bila data pembanding belum ada, tren tidak ditampilkan.'));
    ctx.el.appendChild(h('div', { class: 'db-kpis' },
      kpi({ label: 'Tugas terlambat', value: num(totalOverdue), sub: totalOverdue ? `rata-rata ${r1(lateSum / totalOverdue)} hari terlambat` : 'Tidak ada', tone: totalOverdue ? 'red' : 'green', icon: 'alert', href: '/monitor' }),
      kpi({ label: 'On-time rate task', value: doneAll ? pctOf(onTimeAll, doneAll) + '%' : 'n/a', sub: `${onTimeAll} dari ${doneAll} task selesai tepat waktu`, tone: 'green', icon: 'check-circle' }),
      kpi({ label: 'First-pass verifikasi akhir', value: fp.base.length ? fp.rate + '%' : 'n/a', sub: `${fp.clean.length} dari ${fp.base.length} case lolos tanpa dikembalikan`, tone: 'pink', icon: 'shield', href: '/final-verification' }),
      kpi({ label: 'Durasi seleksi (rata-rata)', value: ad.length ? r1(avg(ad.map(x => x.d))) + ' hr' : 'n/a', sub: `diajukan → keputusan, ${ad.length} lamaran`, tone: 'purple', icon: 'clock', href: '/applications' })));

    // --- tab 1: bottleneck ---
    const tabBottleneck = () => {
      const withLate = bn.filter(m => m.overdue || m.blocked);
      return h('div', { class: 'stack' },
        h('div', { class: 'grid cols-2' },
          ui.card({ title: 'Langkah paling terlambat', subtitle: 'Rata-rata hari terlambat per langkah (case aktif)', icon: 'alert', body: withLate.length ? ui.barChart({ horizontal: true, data: withLate.filter(m => m.overdue).slice(0, 8).map(m => ({ label: m.name.length > 22 ? m.name.slice(0, 21) + '…' : m.name, value: r1(m.avgLate), color: HEX.red })), valueFmt: v => v + ' hr' }) : ui.emptyState({ icon: 'check-circle', title: 'Tidak ada bottleneck', text: 'Tidak ada langkah aktif yang terlambat.' }) }),
          ui.card({ title: 'Jumlah terlambat per langkah', subtitle: 'Berapa case tertahan di tiap langkah', icon: 'bar-chart', body: withLate.length ? ui.barChart({ horizontal: true, data: withLate.slice(0, 8).map(m => ({ label: m.name.length > 22 ? m.name.slice(0, 21) + '…' : m.name, value: m.overdue + m.blocked, color: HEX.orange })), valueFmt: v => v + ' case' }) : ui.emptyState({ icon: 'check-circle', title: 'Tidak ada data' }) })),
        ui.card({ title: 'Monitoring bottleneck per langkah', subtitle: 'Terlambat = langkah aktif lewat jatuh tempo (case ditahan tidak dihitung)', icon: 'git-branch', flush: true,
          body: ui.table({ pageSize: 12, sortKey: 'overdue', sortDir: -1, rows: bn, columns: [
            { key: 'name', label: 'Langkah', sortable: true, render: m => h('b', null, m.name) },
            { key: 'active', label: 'Sedang aktif', sortable: true, align: 'right' },
            { key: 'overdue', label: 'Terlambat', sortable: true, align: 'right', render: m => (m.overdue ? ui.badge(m.overdue, 'red') : '0') },
            { key: 'avgLate', label: 'Rata-rata hari terlambat', sortable: true, align: 'right', render: m => (m.overdue ? r1(m.avgLate) : '—') },
            { key: 'blocked', label: 'Terhambat', sortable: true, align: 'right', render: m => (m.blocked ? ui.badge(m.blocked, 'amber') : '0') },
            { key: 'done', label: 'Selesai', sortable: true, align: 'right' },
            { key: 'onTimePct', label: 'Tepat waktu', sortable: true, align: 'right', sortValue: m => m.onTimePct == null ? -1 : m.onTimePct, render: m => (m.onTimePct == null ? '—' : m.onTimePct + '%') },
          ] }) }));
    };

    // --- tab 2: PIC workload ---
    const tabPic = () => h('div', { class: 'stack' },
      ui.card({ title: 'Beban kerja PIC', subtitle: `Beban aktif = tugas terbuka yang dikerjakan; batas wajar ${PIC_CAP} tugas (BR-031)`, icon: 'users', flush: true,
        body: ui.table({ pageSize: 12, sortKey: 'active', sortDir: -1, rows: pic, columns: [
          { key: 'u', label: 'Staf', sortValue: p => p.u.name, sortable: true, render: p => h('div', null, ui.userChip(p.u.id), h('div', { class: 'db-mini' }, p.role)) },
          { key: 'active', label: 'Beban aktif', sortable: true, render: p => h('div', { style: 'min-width:130px' }, h('b', null, p.active), ui.progress((p.active / PIC_CAP) * 100, p.active > PIC_CAP ? 'red' : p.active > PIC_CAP * 0.7 ? 'amber' : 'green')) },
          { key: 'overdue', label: 'Terlambat', sortable: true, align: 'right', render: p => (p.overdue ? ui.badge(p.overdue, 'red') : '0') },
          { key: 'blocked', label: 'Terhambat', sortable: true, align: 'right' },
          { key: 'verifyQ', label: 'Antre verifikasi', sortable: true, align: 'right' },
          { key: 'cases', label: 'Case aktif', sortable: true, align: 'right' },
          { key: 'done', label: 'Selesai', sortable: true, align: 'right' },
          { key: 'rate', label: 'On-time rate', sortable: true, align: 'right', sortValue: p => (p.rate == null ? -1 : p.rate), render: p => (p.rate == null ? '—' : ui.badge(p.rate + '%', p.rate >= 90 ? 'green' : p.rate >= 70 ? 'amber' : 'red')) },
        ] }) }),
      ui.callout('info', 'Cara membaca', 'On-time rate = task selesai sebelum/di jatuh tempo langkahnya ÷ semua task selesai milik staf tersebut. Staf dengan beban tinggi dan banyak terlambat adalah kandidat untuk pemerataan penugasan oleh Admin.'));

    // --- tab 3: durasi + negara/profesi ---
    const tabDur = () => {
      const byC = durationRows('country'), byP = durationRows('profession');
      const durCols = lbl => [
        { key: 'label', label: lbl, render: r => h('b', null, r.label) },
        { key: 'n', label: 'Case', align: 'right' },
        { key: 'nDep', label: 'Sudah berangkat', align: 'right' },
        { key: 'avgDep', label: 'Registrasi → berangkat (hari)', align: 'right', render: r => (r.avgDep == null ? h('span', { class: 'muted' }, 'belum ada') : h('span', null, h('b', null, r.avgDep), h('span', { class: 'db-mini' }, ` (n=${r.nDep})`))) },
        { key: 'avgRun', label: 'Umur case berjalan (hari)', align: 'right', render: r => (r.avgRun == null ? '—' : r.avgRun) },
      ];
      const apps = D.applications;
      const conv = D.countries.map(c => { const a = apps.filter(x => x.country === c.code); const sel = a.filter(x => ['SELECTED', 'WAITLISTED', 'ALLOCATED'].includes(x.status)).length; const codes = D.placementCodes.filter(p => p.country === c.code && p.status !== 'CLOSED'); return { c, n: a.length, sel, alloc: a.filter(x => x.status === 'ALLOCATED').length, rej: a.filter(x => x.status === 'REJECTED').length, tot: codes.reduce((s, p) => s + p.total, 0), used: codes.reduce((s, p) => s + p.utilized + p.reserved, 0) }; }).filter(x => x.n || x.tot);
      return h('div', { class: 'stack' },
        h('div', { class: 'stack' },
          ui.card({ title: 'Durasi per negara', subtitle: 'KPI-07 · dihitung dari tanggal registrasi worker', icon: 'globe', flush: true, body: ui.table({ rows: byC, columns: durCols('Negara'), pageSize: 8 }) }),
          ui.card({ title: 'Durasi per profesi', icon: 'briefcase', flush: true, body: ui.table({ rows: byP, columns: durCols('Profesi'), pageSize: 8 }) })),
        ui.callout('warn', 'Sampel kecil', `Baru ${D.cases.filter(c => c.status === 'DEPARTED').length} case berangkat, sehingga rata-rata durasi belum stabil. Gunakan sebagai indikasi awal, bukan target.`),
        h('div', { class: 'grid cols-3' },
          ui.card({ title: 'Lamaran per negara', icon: 'bar-chart', body: ui.barChart({ data: D.countries.map(c => ({ label: SHORT[c.code] || c.code, value: apps.filter(a => a.country === c.code).length })), height: 180 }) }),
          ui.card({ title: 'Lamaran per profesi', icon: 'pie', body: ui.donut({ data: D.professions.map((p, i) => ({ label: p.name, value: apps.filter(a => a.profession === p.code).length })).filter(d => d.value), center: { value: apps.length, label: 'lamaran' } }) }),
          ui.card({ title: 'Umur case berjalan per negara', subtitle: 'Hari sejak registrasi worker', icon: 'clock', body: ui.barChart({ data: byC.filter(r => r.avgRun != null).map(r => ({ label: r.short, value: r.avgRun, color: HEX.orange })), height: 180 }) })),
        ui.card({ title: 'Konversi seleksi & utilisasi kuota per negara', icon: 'globe', flush: true, body: ui.table({ rows: conv, pageSize: 8, columns: [
          { key: 'c', label: 'Negara', render: x => h('b', null, x.c.name) },
          { key: 'n', label: 'Lamaran', align: 'right' },
          { key: 'sel', label: 'Lolos seleksi', align: 'right', render: x => `${x.sel} (${pctOf(x.sel, x.n) || 0}%)` },
          { key: 'alloc', label: 'Dialokasikan', align: 'right' },
          { key: 'rej', label: 'Ditolak', align: 'right' },
          { key: 'tot', label: 'Total kuota', align: 'right' },
          { key: 'used', label: 'Utilisasi', render: x => (x.tot ? h('div', { style: 'min-width:120px' }, ui.progress((x.used / x.tot) * 100, 'teal'), h('span', { class: 'db-mini' }, `${x.used}/${x.tot} (${pctOf(x.used, x.tot)}%)`)) : '—') },
        ] }) }));
    };

    // --- tab 4: verifikasi akhir ---
    const tabFinal = () => {
      const rows = fp.waiting.map(c => { let checks = null; try { checks = BGS.domain && BGS.domain.finalChecks ? BGS.domain.finalChecks(c.id) : null; } catch (e) { checks = null; } return { c, checks }; });
      return h('div', { class: 'stack' },
        h('div', { class: 'grid cols-2' },
          ui.card({ title: 'First-pass rate verifikasi akhir', subtitle: 'KPI-12 · lolos tanpa kembali ke pemrosesan', icon: 'shield', body: fp.base.length ? ui.donut({ data: [{ label: 'Lolos pertama kali', value: fp.clean.length, color: HEX.green }, { label: 'Pernah dikembalikan', value: fp.base.length - fp.clean.length, color: HEX.red }], center: { value: fp.rate + '%', label: 'first-pass' } }) : ui.emptyState({ title: 'Belum ada data', text: 'Belum ada case yang selesai verifikasi akhir.' }) }),
          ui.card({ title: 'Kesiapan dokumen saat verifikasi akhir', subtitle: 'KPI-06 · dokumen required berstatus VERIFIED', icon: 'folder', body: (() => { const d = docsReadiness(); return d.tot ? h('div', { class: 'stack-sm' }, h('div', { class: 'kpi-v' }, d.pct + '%'), ui.progress(d.pct, d.pct === 100 ? 'green' : 'amber'), h('div', { class: 'muted sm' }, `${d.ok} dari ${d.tot} dokumen wajib terverifikasi pada ${d.cases} case yang sudah/sedang verifikasi akhir. Syarat RUL-018: wajib 100%.`)) : ui.emptyState({ title: 'Belum ada data' }); })() })),
        ui.card({ title: `Case menunggu verifikasi akhir (${rows.length})`, subtitle: '5 syarat RUL-018 diperiksa otomatis bila modul Pemrosesan aktif', icon: 'check-square', actions: moreLink('Verifikasi akhir', '/final-verification'), flush: true,
          body: ui.table({ rows, pageSize: 6, empty: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada antrean', text: 'Tidak ada case di tahap verifikasi akhir.' }), columns: [
            { key: 'c', label: 'Case', render: r => ui.caseLink(r.c.id) },
            { key: 'w', label: 'Worker', render: r => (viewer ? '—' : ui.workerLink(r.c.workerId)) },
            { key: 'd', label: 'Tujuan', render: r => dest(r.c) },
            { key: 'k', label: 'Syarat terpenuhi', render: r => (r.checks && r.checks.checks ? h('span', null, ui.badge(`${r.checks.checks.filter(x => x.ok).length}/${r.checks.checks.length}`, r.checks.ok ? 'green' : 'amber', { dot: true })) : h('span', { class: 'muted' }, 'Buka halaman verifikasi')) },
          ] }) }));
    };

    // --- tab 5: KPI ---
    const tabKpi = () => ui.card({ title: 'Tabel KPI — BRD §20', subtitle: '17 indikator, baseline belum diukur · target adalah usulan', icon: 'trending-up', flush: true,
      body: ui.table({ rows: ks, pageSize: 20, rowClass: r => (r.ok === false ? 'row-warn' : ''), columns: [
        { key: 'id', label: 'KPI', render: r => h('b', { class: 'nowrap' }, r.id) },
        { key: 'm', label: 'Metrik', render: r => h('div', { style: 'min-width:220px' }, r.m, r.note ? h('div', { class: 'db-mini' }, r.note) : null) },
        { key: 'b', label: 'Baseline', render: r => ui.badge(r.b, 'gray') },
        { key: 't', label: 'Target usulan', render: r => h('span', { style: 'min-width:130px;display:inline-block' }, r.t) },
        { key: 'mvp', label: 'MVP ukur', render: r => ui.badge('MVP ' + r.mvp, 'blue') },
        { key: 'v', label: 'Nilai saat ini', render: r => h('b', null, r.v) },
        { key: 's', label: 'Status', render: r => (r.ok == null ? ui.badge('Menunggu baseline', 'gray') : r.ok ? ui.badge('Sesuai target', 'green', { dot: true }) : ui.badge('Perlu perhatian', 'amber', { dot: true })) },
        { key: 'tr', label: 'Tren', render: r => (r.trend ? trendNode(r.trend) : h('span', { class: 'adv-trend adv-flat' }, '—')) },
      ] }) });

    ctx.el.appendChild(ui.tabs([
      { id: 'bn', label: 'Bottleneck', count: totalOverdue, render: tabBottleneck },
      { id: 'pic', label: 'Beban PIC', count: pic.length, render: tabPic },
      { id: 'dur', label: 'Durasi & negara/profesi', render: tabDur },
      { id: 'fp', label: 'Verifikasi akhir', render: tabFinal },
      { id: 'kpi', label: 'KPI (17)', count: ks.length, render: tabKpi },
    ], { active: ctx.query.tab }));
  } });

  // ====================================================================
  // /reports — katalog laporan (BR-026)
  // ====================================================================
  BGS.addStyle(`.rp-printonly{display:none}@media print{.rp-printonly{display:block!important}.rp-screen{display:none!important}.card{border:0}.card-h .row{display:none}.page-head{margin-bottom:6px}}`);
  const C = (label, value, sens, extra) => Object.assign({ label, value, sens }, extra);
  const stOpts = d => Object.entries(BGS.ST[d]).map(([k, v]) => [k, v[0]]);
  const cOpts = () => D.countries.map(c => [c.code, c.name]);
  const pOpts = () => D.professions.map(p => [p.code, p.name]);
  const uniq = (arr, fn) => [...new Set(arr.map(fn).filter(Boolean))].sort().map(x => [x, x]);
  const inR = (d, f) => { if (!f.from && !f.to) return true; if (!d) return false; const t = new Date(d); if (f.from && t < new Date(f.from + 'T00:00:00')) return false; if (f.to && t > new Date(f.to + 'T23:59:59')) return false; return true; };
  const FX = { country: { key: 'country', label: 'Negara', options: cOpts }, profession: { key: 'profession', label: 'Profesi', options: pOpts } };
  const caseSteps = c => c.steps.filter(s => s.status === 'COMPLETED').length;
  const docOwner = d => (d.ownerType === 'worker' ? wname(d.ownerId) : `${d.ownerId} (${wname((D.case(d.ownerId) || {}).workerId)})`);
  const docDays = d => (d.expiresAt ? dayDiff(d.expiresAt, NOW()) : null);
  const GROUPS = { 1: 'MVP 1 · Worker & rekrutmen', 2: 'MVP 2 · Pemrosesan, kuota & kepatuhan', 3: 'MVP 3 · Laporan lanjutan & terjadwal' };

  const REPORTS = [
    { id: 'R-WRK', group: 1, icon: 'users', title: 'Daftar worker', desc: 'Seluruh worker dengan status, sumber, dan tanggal daftar.', dateFilter: 'Tanggal daftar',
      filters: [{ key: 'status', label: 'Status', options: () => stOpts('worker') }, { key: 'province', label: 'Provinsi', options: () => uniq(D.workers, w => w.province) }, { key: 'source', label: 'Sumber', options: () => uniq(D.workers, w => w.source) }],
      rows: f => D.workers.filter(w => (!f.status || w.status === f.status) && (!f.province || w.province === f.province) && (!f.source || w.source === f.source) && inR(w.createdAt, f)),
      cols: [C('ID Worker', w => w.id), C('Nama', w => w.name), C('Jenis kelamin', w => (w.gender === 'P' ? 'Perempuan' : 'Laki-laki')), C('Usia', w => fmt.age(w.dob)), C('Kota', w => w.city), C('Provinsi', w => w.province), C('Status', w => stLabel('worker', w.status)), C('Sumber', w => w.source), C('Tanggal daftar', w => fmt.date(w.createdAt), null, { sortValue: w => w.createdAt }), C('Jumlah lamaran', w => D.applications.filter(a => a.workerId === w.id).length), C('NIK', w => w.nik, 'nik'), C('No. paspor', w => w.passport, 'passport'), C('Telepon', w => w.phone, 'phone')],
      summary: rows => [['Worker', rows.length], ['Perempuan', rows.filter(w => w.gender === 'P').length], ['Punya paspor', rows.filter(w => w.passport).length]] },
    { id: 'R-FUN', group: 1, icon: 'trending-up', title: 'Funnel rekrutmen', desc: 'Jumlah lamaran di tiap tahap seleksi beserta konversinya.', dateFilter: 'Tanggal lamaran', filters: [FX.country, FX.profession],
      rows: f => { const apps = D.applications.filter(a => (!f.country || a.country === f.country) && (!f.profession || a.profession === f.profession) && inR(a.createdAt, f)); const live = apps.filter(a => a.status in RANK); const base = live.length;
        return [...STAGES.map(([label, r]) => ({ label, now: live.filter(a => RANK[a.status] === r).length, reached: live.filter(a => RANK[a.status] >= r).length, base })), { label: 'Ditolak', now: apps.filter(a => a.status === 'REJECTED').length, reached: null, base }, { label: 'Mundur / dibatalkan', now: apps.filter(a => ['WITHDRAWN', 'CANCELLED'].includes(a.status)).length, reached: null, base }]; },
      cols: [C('Tahap', r => r.label), C('Sedang di tahap ini', r => r.now, null, { num: 1 }), C('Pernah mencapai tahap (kumulatif)', r => (r.reached == null ? '—' : r.reached), null, { num: 1 }), C('% dari lamaran aktif', r => (r.reached == null || !r.base ? '—' : Math.round((r.reached / r.base) * 100) + '%'), null, { num: 1 })],
      summary: rows => [['Lamaran aktif', rows[0] ? rows[0].base : 0], ['Dialokasikan', rows[5] ? rows[5].now : 0]] },
    { id: 'R-APP', group: 1, icon: 'clipboard', title: 'Lamaran & seleksi', desc: 'Daftar lamaran lengkap dengan skor dan keputusan seleksi.', dateFilter: 'Tanggal lamaran',
      filters: [{ key: 'status', label: 'Status', options: () => stOpts('application') }, FX.country, FX.profession],
      rows: f => D.applications.filter(a => (!f.status || a.status === f.status) && (!f.country || a.country === f.country) && (!f.profession || a.profession === f.profession) && inR(a.createdAt, f)),
      cols: [C('ID Lamaran', a => a.id), C('Worker', a => wname(a.workerId)), C('Negara', a => D.cn(a.country)), C('Profesi', a => D.pn(a.profession)), C('Jalur', a => routeName(a.route)), C('Status', a => stLabel('application', a.status)), C('Tanggal diajukan', a => fmt.date(a.createdAt), null, { sortValue: a => a.createdAt }), C('Skor wawancara', a => (a.screening.interview.score != null ? a.screening.interview.score : '—')), C('Skor assessment', a => (a.screening.assessment.score != null ? a.screening.assessment.score : '—')), C('Alasan keputusan', a => (a.decision ? a.decision.reason : '—')), C('PIC', a => uname(a.picId))],
      summary: rows => [['Lamaran', rows.length], ['Di pipeline', rows.filter(a => PIPELINE.includes(a.status)).length], ['Ditolak', rows.filter(a => a.status === 'REJECTED').length]] },
    { id: 'R-DOC', group: 1, icon: 'folder', title: 'Dokumen worker', desc: 'Status verifikasi, masa berlaku, dan sensitivitas dokumen.', dateFilter: 'Tanggal unggah',
      filters: [{ key: 'status', label: 'Status', options: () => stOpts('document') }, { key: 'type', label: 'Jenis dokumen', options: () => D.docTypes.map(t => [t.id, t.name]) }, { key: 'sens', label: 'Sensitivitas', options: () => stOpts('sensitivity') }, { key: 'exp', label: 'Masa berlaku', options: () => [['SOON', `Segera kedaluwarsa (≤ ${D.settings.expiryWarningDays} hari)`], ['EXPIRED', 'Sudah kedaluwarsa']] }],
      rows: f => D.documents.filter(d => (!f.status || d.status === f.status) && (!f.type || d.typeId === f.type) && (!f.sens || (D.docType(d.typeId) || {}).sensitivity === f.sens) && inR(d.uploadedAt, f) && (!f.exp || (f.exp === 'SOON' ? docDays(d) != null && docDays(d) >= 0 && docDays(d) <= D.settings.expiryWarningDays : d.status === 'EXPIRED' || (docDays(d) != null && docDays(d) < 0)))),
      cols: [C('ID Dokumen', d => d.id), C('Pemilik', docOwner), C('Jenis', d => (D.docType(d.typeId) || {}).name), C('Sensitivitas', d => stLabel('sensitivity', (D.docType(d.typeId) || {}).sensitivity)), C('Status', d => stLabel('document', d.status)), C('Versi', d => d.version), C('Diunggah', d => fmt.date(d.uploadedAt), null, { sortValue: d => d.uploadedAt }), C('Pengunggah', d => uname(d.uploadedBy)), C('Diverifikasi oleh', d => (d.verifiedBy ? uname(d.verifiedBy) : '—')), C('Kedaluwarsa', d => (d.expiresAt ? fmt.date(d.expiresAt) : '—'), null, { sortValue: d => d.expiresAt || '' })],
      note: 'Daftar ini hanya memuat metadata dokumen. Isi berkas RESTRICTED tidak ikut diekspor (RUL-020).',
      summary: rows => [['Dokumen', rows.length], ['Menunggu verifikasi', rows.filter(d => d.status === 'UPLOADED').length], ['Ditolak', rows.filter(d => d.status === 'REJECTED').length], ['Kedaluwarsa', rows.filter(d => d.status === 'EXPIRED').length]] },
    { id: 'R-REG', group: 1, icon: 'inbox', title: 'Registrasi publik', desc: 'Pendaftaran dari website dan hasil tinjauan Admin.', dateFilter: 'Tanggal masuk',
      filters: [{ key: 'status', label: 'Status', options: () => stOpts('registration') }, FX.country],
      rows: f => D.registrations.filter(r => (!f.status || r.status === f.status) && (!f.country || r.country === f.country) && inR(r.submittedAt, f)),
      cols: [C('ID Registrasi', r => r.id), C('Nama', r => r.name), C('NIK', r => r.nik, 'nik'), C('Telepon', r => r.phone, 'phone'), C('Negara tujuan', r => D.cn(r.country)), C('Profesi', r => D.pn(r.profession)), C('Masuk', r => fmt.dateTime(r.submittedAt), null, { sortValue: r => r.submittedAt }), C('Status', r => stLabel('registration', r.status)), C('Indikasi duplikat', r => (r.dupOf ? 'Ya (' + r.dupOf + ')' : 'Tidak')), C('Ditinjau oleh', r => (r.reviewedBy ? uname(r.reviewedBy) : '—'))],
      summary: rows => [['Registrasi', rows.length], ['Baru', rows.filter(r => r.status === 'NEW').length], ['Indikasi duplikat', rows.filter(r => r.dupOf).length]] },

    { id: 'R-CAS', group: 2, icon: 'briefcase', title: 'Status pemrosesan', desc: 'Posisi tiap Placement Case: langkah selesai, terlambat, dan rencana berangkat.',
      filters: [{ key: 'status', label: 'Status case', options: () => stOpts('case') }, FX.country, FX.profession],
      rows: f => D.cases.filter(c => (!f.status || c.status === f.status) && (!f.country || c.country === f.country) && (!f.profession || c.profession === f.profession)),
      cols: [C('Case', c => c.id), C('Worker', c => wname(c.workerId)), C('Negara', c => D.cn(c.country)), C('Profesi', c => D.pn(c.profession)), C('Placement Code', c => c.placementCodeId), C('Template', c => `${c.templateId} v${c.templateVersion}`), C('Status', c => stLabel('case', c.status)), C('Langkah selesai', c => `${caseSteps(c)}/${c.steps.length}`), C('Langkah berjalan', c => c.steps.filter(s => s.status === 'IN_PROGRESS').map(s => s.name).join('; ') || '—'), C('Tugas terlambat', c => D.tasks.filter(t => t.caseId === c.id && overdue(t)).length), C('Case owner', c => uname(c.ownerId)), C('Rencana berangkat', c => fmt.date(c.plannedDeparture), null, { sortValue: c => c.plannedDeparture })],
      summary: rows => [['Case', rows.length], ['Aktif', rows.filter(c => ACTIVE_CASE.includes(c.status)).length], ['Punya tugas terlambat', rows.filter(c => D.tasks.some(t => t.caseId === c.id && overdue(t))).length]] },
    { id: 'R-QUO', group: 2, icon: 'layers', title: 'Kuota per Placement Code', desc: 'Total, dicadangkan, terpakai, tersedia, dan utilisasi tiap kode.',
      filters: [FX.country, { key: 'status', label: 'Status kode', options: () => stOpts('code') }],
      rows: f => D.placementCodes.filter(p => (!f.country || p.country === f.country) && (!f.status || p.status === f.status)),
      cols: [C('Placement Code', p => p.id), C('Job Order', p => p.jobOrderId), C('Partner', p => ((D.partner((D.jobOrder(p.jobOrderId) || {}).partnerId) || {}).name) || '—'), C('Negara', p => D.cn(p.country)), C('Profesi', p => D.pn(p.profession)), C('Total', p => p.total, null, { num: 1 }), C('Dicadangkan', p => p.reserved, null, { num: 1 }), C('Terpakai', p => p.utilized, null, { num: 1 }), C('Tersedia', p => p.available, null, { num: 1 }), C('Utilisasi', p => Math.round(((p.reserved + p.utilized) / p.total) * 100) + '%', null, { num: 1, sortValue: p => (p.reserved + p.utilized) / p.total }), C('Status', p => stLabel('code', p.status))],
      summary: rows => [['Kode', rows.length], ['Total kuota', rows.reduce((a, p) => a + p.total, 0)], ['Tersedia', rows.reduce((a, p) => a + p.available, 0)]] },
    { id: 'R-DEP', group: 2, icon: 'plane', title: 'Keberangkatan', desc: 'Case siap berangkat dan yang sudah berangkat (RUL-030).',
      note: 'Format laporan resmi ke instansi belum ditetapkan (OQ-14); laporan ini adalah ringkasan internal.',
      filters: [{ key: 'status', label: 'Status', options: () => [['READY_TO_DEPART', 'Siap berangkat'], ['DEPARTED', 'Berangkat']] }, FX.country],
      rows: f => D.cases.filter(c => ['READY_TO_DEPART', 'DEPARTED'].includes(c.status) && (!f.status || c.status === f.status) && (!f.country || c.country === f.country)),
      cols: [C('Case', c => c.id), C('Worker', c => wname(c.workerId)), C('Negara', c => D.cn(c.country)), C('Profesi', c => D.pn(c.profession)), C('Batch', c => c.batchId || '—'), C('Maskapai', c => (c.flight ? c.flight.airline : '—')), C('No. penerbangan', c => (c.flight ? c.flight.flightNo : '—')), C('Tanggal terbang', c => (c.flight ? fmt.date(c.flight.date) : '—'), null, { sortValue: c => (c.flight ? c.flight.date : '') }), C('No. tiket', c => (c.flight ? c.flight.ticketNo : '—')), C('Status', c => stLabel('case', c.status))],
      summary: rows => [['Case', rows.length], ['Sudah berangkat', rows.filter(c => c.status === 'DEPARTED').length], ['Siap berangkat', rows.filter(c => c.status === 'READY_TO_DEPART').length]] },
    { id: 'R-CMP', group: 2, icon: 'check-square', title: 'Kepatuhan (checklist case)', desc: 'Kelengkapan checklist persyaratan tiap case. Alat kontrol internal.', disclaimer: true,
      filters: [{ key: 'status', label: 'Status case', options: () => stOpts('case') }, FX.country],
      rows: f => D.cases.filter(c => c.status !== 'CANCELLED' && (!f.status || c.status === f.status) && (!f.country || c.country === f.country)),
      cols: [C('Case', c => c.id), C('Worker', c => wname(c.workerId)), C('Negara', c => D.cn(c.country)), C('Status case', c => stLabel('case', c.status)), C('Total syarat', c => c.checklist.length, null, { num: 1 }), C('Wajib', c => c.checklist.filter(x => x.mandatory).length, null, { num: 1 }), C('Wajib terpenuhi', c => c.checklist.filter(x => x.mandatory && x.status === 'MET').length, null, { num: 1 }), C('Wajib belum terpenuhi', c => c.checklist.filter(x => x.mandatory && x.status !== 'MET').length, null, { num: 1 }), C('% terpenuhi', c => (c.checklist.length ? Math.round((c.checklist.filter(x => x.status === 'MET').length / c.checklist.length) * 100) + '%' : '—'), null, { num: 1 })],
      summary: rows => [['Case', rows.length], ['Wajib terpenuhi semua', rows.filter(c => c.checklist.filter(x => x.mandatory).every(x => x.status === 'MET')).length]] },
    { id: 'R-PIC', group: 2, icon: 'user', title: 'Beban kerja PIC', desc: 'Tugas aktif, terlambat, dan on-time rate per staf (BR-031).',
      filters: [],
      rows: () => picRows(),
      cols: [C('Staf', p => p.u.name), C('Peran', p => p.role), C('Tugas aktif', p => p.active, null, { num: 1 }), C('Terlambat', p => p.overdue, null, { num: 1 }), C('Terhambat', p => p.blocked, null, { num: 1 }), C('Antre verifikasi', p => p.verifyQ, null, { num: 1 }), C('Case aktif', p => p.cases, null, { num: 1 }), C('Task selesai', p => p.done, null, { num: 1 }), C('On-time rate', p => (p.rate == null ? '—' : p.rate + '%'), null, { num: 1, sortValue: p => (p.rate == null ? -1 : p.rate) })],
      summary: rows => [['Staf', rows.length], ['Total tugas aktif', rows.reduce((a, p) => a + p.active, 0)], ['Total terlambat', rows.reduce((a, p) => a + p.overdue, 0)]] },
    { id: 'R-OVD', group: 2, icon: 'alert', title: 'Terlambat & terhambat', desc: 'Semua tugas aktif yang lewat jatuh tempo atau sedang terhambat.',
      filters: [{ key: 'kind', label: 'Kondisi', options: () => [['LATE', 'Terlambat'], ['BLOCKED', 'Terhambat']] }, FX.country],
      rows: f => D.tasks.filter(t => actionable(t) && (overdue(t) || t.status === 'BLOCKED')).filter(t => (!f.kind || (f.kind === 'LATE' ? overdue(t) : t.status === 'BLOCKED')) && (!f.country || (D.case(t.caseId) || {}).country === f.country)),
      cols: [C('Tugas', t => t.id), C('Langkah', t => t.title), C('Case', t => t.caseId), C('Worker', t => wname((D.case(t.caseId) || {}).workerId)), C('Negara', t => D.cn((D.case(t.caseId) || {}).country)), C('PIC', t => uname(t.assigneeId)), C('Jatuh tempo', t => fmt.date(taskDue(t)), null, { sortValue: t => +taskDue(t) }), C('Terlambat (hari)', t => (overdue(t) ? lateDays(t) : 0), null, { num: 1 }), C('Status', t => stLabel('task', t.status)), C('Alasan hambatan', t => t.blockedReason || '—')],
      summary: rows => [['Tugas', rows.length], ['Terlambat', rows.filter(overdue).length], ['Terhambat', rows.filter(t => t.status === 'BLOCKED').length]] },

    { id: 'R-BTL', group: 3, icon: 'git-branch', title: 'Bottleneck per langkah', desc: 'Langkah mana yang paling sering terlambat atau terhambat.', filters: [], rows: () => bottleneckRows(),
      cols: [C('Langkah', m => m.name), C('Sedang aktif', m => m.active, null, { num: 1 }), C('Terlambat', m => m.overdue, null, { num: 1 }), C('Rata-rata hari terlambat', m => (m.overdue ? r1(m.avgLate) : 0), null, { num: 1 }), C('Terhambat', m => m.blocked, null, { num: 1 }), C('Selesai', m => m.done, null, { num: 1 }), C('Tepat waktu', m => (m.onTimePct == null ? '—' : m.onTimePct + '%'), null, { num: 1 })],
      summary: rows => [['Langkah', rows.length], ['Total terlambat', rows.reduce((a, m) => a + m.overdue, 0)]] },
    { id: 'R-DUR', group: 3, icon: 'clock', title: 'Durasi per negara & profesi', desc: 'Registrasi → berangkat (KPI-07) dan umur case berjalan.', filters: [],
      rows: () => [...durationRows('country').map(r => Object.assign({ dim: 'Negara' }, r)), ...durationRows('profession').map(r => Object.assign({ dim: 'Profesi' }, r))],
      cols: [C('Dimensi', r => r.dim), C('Nama', r => r.label), C('Case', r => r.n, null, { num: 1 }), C('Sudah berangkat', r => r.nDep, null, { num: 1 }), C('Durasi registrasi → berangkat (hari)', r => (r.avgDep == null ? '—' : r.avgDep), null, { num: 1 }), C('Umur case berjalan (hari)', r => (r.avgRun == null ? '—' : r.avgRun), null, { num: 1 })],
      note: 'Sampel keberangkatan masih kecil; gunakan sebagai indikasi awal.', summary: rows => [['Baris', rows.length]] },
    { id: 'R-KPI', group: 3, icon: 'trending-up', title: 'Ringkasan 17 KPI', desc: 'KPI BRD §20 dengan baseline, target usulan, dan nilai saat ini.', filters: [], rows: () => kpiRows(),
      cols: [C('KPI', k => k.id), C('Metrik', k => k.m), C('Baseline', k => k.b), C('Target usulan', k => k.t), C('MVP ukur', k => k.mvp), C('Nilai saat ini', k => k.v), C('Status', k => (k.ok == null ? 'Menunggu baseline' : k.ok ? 'Sesuai target' : 'Perlu perhatian'))],
      summary: rows => [['KPI', rows.length], ['Perlu perhatian', rows.filter(k => k.ok === false).length]] },
    { id: 'R-ACC', group: 3, icon: 'lock', title: 'Log akses data sensitif', desc: 'Pembukaan NIK/paspor, dokumen RESTRICTED, dan ekspor (RUL-021).', dateFilter: 'Tanggal', perm: 'audit.view', filters: [],
      rows: f => D.audit.filter(a => /reveal|RESTRICTED|ditampilkan|Ekspor|Cetak/i.test(a.action) && inR(a.at, f)),
      cols: [C('Waktu', a => fmt.dateTime(a.at), null, { sortValue: a => a.at }), C('Pengguna', a => uname(a.userId)), C('Aksi', a => a.action), C('Objek', a => `${a.entityType} ${a.entityId}`), C('Keterangan', a => a.detail || '—'), C('IP', a => a.ip)],
      summary: rows => [['Catatan', rows.length], ['Pengguna berbeda', new Set(rows.map(a => a.userId)).size]] },
  ];
  const visibleReports = () => REPORTS.filter(r => r.group <= MVP() && (!r.perm || BGS.can(r.perm)));

  // ---------- laporan terjadwal (MVP 3) ----------
  const DOW = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const FREQ = { HARIAN: 'Harian', MINGGUAN: 'Mingguan', BULANAN: 'Bulanan' };
  const SCHEDULES = [
    { id: 'SCH-01', reportId: 'R-FUN', freq: 'MINGGUAN', day: 'Senin', date: 1, time: '08:00', fmt: 'CSV', recipients: ['U03'], active: true, last: new Date(NOW() - 4 * DAY).toISOString(), by: 'U01' },
    { id: 'SCH-02', reportId: 'R-QUO', freq: 'BULANAN', day: 'Senin', date: 1, time: '07:30', fmt: 'CSV', recipients: ['U03', 'U04'], active: true, last: new Date(NOW() - 5 * DAY).toISOString(), by: 'U04' },
    { id: 'SCH-03', reportId: 'R-OVD', freq: 'HARIAN', day: 'Senin', date: 1, time: '17:00', fmt: 'PDF', recipients: ['U04'], active: false, last: null, by: 'U04' },
  ];
  function nextRun(s) {
    const [hh, mm] = s.time.split(':').map(Number), n = NOW();
    let d = new Date(n.getFullYear(), n.getMonth(), n.getDate(), hh, mm);
    if (s.freq === 'HARIAN') { if (d <= n) d = new Date(+d + DAY); }
    else if (s.freq === 'MINGGUAN') { d = new Date(+d + ((DOW.indexOf(s.day) - d.getDay() + 7) % 7) * DAY); if (d <= n) d = new Date(+d + 7 * DAY); }
    else { d = new Date(n.getFullYear(), n.getMonth(), s.date, hh, mm); if (d <= n) d = new Date(n.getFullYear(), n.getMonth() + 1, s.date, hh, mm); }
    return d;
  }
  const schedWhen = s => `${FREQ[s.freq]}${s.freq === 'MINGGUAN' ? ' · ' + s.day : s.freq === 'BULANAN' ? ' · tanggal ' + s.date : ''} · ${s.time}`;
  const repTitle = id => (REPORTS.find(r => r.id === id) || {}).title || id;

  function logExport(rep, rows, fmtName, note) { EXPORTS.unshift({ at: new Date().toISOString(), userId: ME(), report: rep.title, rows, fmt: fmtName, note }); }
  const stamp = () => { const d = NOW(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };

  function reportPanel(rep, state, onChange) {
    const f = state.f[rep.id] || (state.f[rep.id] = {});
    const hasSens = rep.cols.some(c => c.sens);
    const canExport = BGS.can('export');
    const host = h('div'); let cur = [];
    const cell = (c, r) => { const v = c.value(r); if (c.sens) return h('span', { class: 'mono' }, BGS.mask[c.sens](v)); return v == null || v === '' ? '—' : v; };
    const columns = rep.cols.map((c, i) => ({ key: 'c' + i, label: c.label, sortable: true, align: c.num ? 'right' : undefined, sortValue: r => (c.sortValue ? c.sortValue(r) : c.value(r)), render: r => cell(c, r) }));
    const fullCheck = h('input', { type: 'checkbox', id: 'rp_full' });
    const exportCols = full => rep.cols.map(c => ({ label: c.label, value: r => { const v = c.value(r); return c.sens && !full ? BGS.mask[c.sens](v) : v == null ? '' : v; } }));
    const doExport = async () => {
      if (!canExport) return;
      if (!cur.length) { ui.toast('Tidak ada data untuk diekspor. Ubah filter dulu.', 'warn'); return; }
      let full = false;
      if (hasSens && fullCheck.checked && BGS.can('pii.reveal')) {
        const why = await ui.reasonPrompt({ title: 'Ekspor dengan data sensitif lengkap', message: 'NIK, paspor, dan telepon akan ikut diekspor tanpa disamarkan. Tindakan ini tercatat di audit (BR-009, RUL-021).', label: 'Alasan ekspor data lengkap', confirmLabel: 'Ekspor', presets: ['Laporan resmi ke instansi', 'Pemeriksaan internal'] });
        if (!why) return; full = true; BGS.audit('Ekspor data sensitif lengkap', 'Laporan', rep.id, `Alasan: ${why}`);
      }
      BGS.exportCsv(cur, exportCols(full), `${rep.id.toLowerCase()}-${stamp()}.csv`);
      logExport(rep, cur.length, 'CSV', full ? 'Data sensitif LENGKAP' : hasSens ? 'Data sensitif disamarkan' : '—');
      ui.toast(`Ekspor ${rep.title} (${cur.length} baris) diunduh${hasSens && !full ? ' — data sensitif disamarkan' : ''}`);
    };
    const doPrint = () => { BGS.audit('Cetak laporan', 'Laporan', rep.id, `${cur.length} baris (data sensitif disamarkan)`); logExport(rep, cur.length, 'Cetak/PDF', hasSens ? 'Data sensitif disamarkan' : '—'); window.print(); };

    const fields = [];
    rep.filters.forEach(fl => { const fld = ui.field({ name: `${rep.id}_${fl.key}`, label: fl.label, type: 'select', value: f[fl.key] || '', options: [['', 'Semua'], ...fl.options()] }); fld.input.addEventListener('change', e => { f[fl.key] = e.target.value; draw(); }); fields.push(fld); });
    if (rep.dateFilter) ['from', 'to'].forEach(k => { const fld = ui.field({ name: `${rep.id}_${k}`, label: `${rep.dateFilter} ${k === 'from' ? 'dari' : 'sampai'}`, type: 'date', value: f[k] || '' }); fld.input.addEventListener('change', e => { f[k] = e.target.value; draw(); }); fields.push(fld); });
    if (rep.filters.length || rep.dateFilter) fields.push(h('div', { class: 'field' }, h('span', { class: 'lbl' }, '\u00a0'), ui.btn('Reset filter', { sm: true, onClick: () => { state.f[rep.id] = {}; onChange(); } })));

    function draw() {
      cur = rep.rows(f);
      BGS.clear(host);
      const sum = (rep.summary ? rep.summary(cur) : [['Jumlah baris', cur.length]]);
      host.appendChild(h('div', { class: 'rp-sum rp-noprint' }, sum.map(([l, v]) => h('span', null, l + ': ', h('b', null, num(v)))), h('span', { class: 'muted' }, `Pratinjau langsung · ${cur.length} baris`)));
      const notes = [];
      if (hasSens) notes.push(ui.callout('warn', 'Data sensitif disamarkan', `Kolom ${rep.cols.filter(c => c.sens).map(c => c.label).join(', ')} ditampilkan ter-mask dan diekspor ter-mask secara default (BR-009).${BGS.can('pii.reveal') && canExport ? ' Anda dapat mencentang "sertakan data lengkap" saat ekspor — wajib alasan dan tercatat di audit.' : ' Peran Anda tidak dapat membuka data lengkap.'}`));
      if (rep.disclaimer) notes.push(ui.disclaimer());
      if (rep.note) notes.push(ui.callout('info', null, rep.note));
      if (notes.length) host.appendChild(h('div', { class: 'stack-sm rp-noprint', style: 'padding:12px 16px 0' }, notes));
      host.appendChild(h('div', { class: 'rp-screen' }, ui.table({ columns, rows: cur, pageSize: 10, dense: true, empty: ui.emptyState({ icon: 'search', title: 'Tidak ada data pada filter ini', text: 'Ubah atau reset filter untuk melihat data.' }) })));
      const pr = cur.slice(0, 1000);
      host.appendChild(h('div', { class: 'rp-printonly' }, h('table', { class: 'tbl dense' }, h('thead', null, h('tr', null, rep.cols.map(c => h('th', null, c.label)))), h('tbody', null, pr.map(r => h('tr', null, rep.cols.map(c => h('td', null, cell(c, r)))))))));
    }
    draw();
    const exportBox = h('div', { class: 'row wrap gap-sm' },
      hasSens && canExport && BGS.can('pii.reveal') ? h('label', { class: 'row gap-sm sm', style: 'font-weight:600' }, fullCheck, 'Sertakan data sensitif lengkap') : null,
      ui.btn('Ekspor Excel (CSV)', { icon: 'download', kind: 'primary', sm: true, disabled: !canExport, title: canExport ? 'Unduh sebagai CSV yang bisa dibuka di Excel' : 'Peran Viewer tidak boleh mengekspor data (BR-027)', onClick: doExport }),
      ui.btn('Cetak / PDF', { icon: 'printer', sm: true, onClick: doPrint }));
    return h('div', null,
      h('div', { class: 'rp-printhead' }, h('h2', null, `BGS Workforce Management — ${rep.title}`), h('div', { class: 'muted sm' }, `Dicetak ${fmt.dateTime(NOW())} oleh ${BGS.user().name} (${BGS.roles[BGS.role()]})${hasSens ? ' · Data sensitif disamarkan' : ''}`)),
      ui.card({ title: rep.title, subtitle: rep.desc, icon: rep.icon, actions: exportBox, flush: true,
        body: h('div', null,
          fields.length ? h('div', { class: 'rp-filters rp-noprint' }, fields) : null,
          !canExport ? h('div', { style: 'padding:10px 16px 0' }, ui.callout('info', 'Ekspor dinonaktifkan untuk Viewer', 'Viewer hanya dapat melihat pratinjau dan mencetak. Data sensitif tetap disamarkan (BR-027).')) : null,
          host) }));
  }

  function tabCatalog(ctx, state) {
    const reps = visibleReports();
    if (!reps.some(r => r.id === state.sel)) state.sel = null;
    const wrap = h('div', { class: 'rp-grid' });
    const draw = () => {
      BGS.clear(wrap);
      const cat = h('div', { class: 'card rp-noprint' }, h('div', { class: 'card-b' }, h('div', { class: 'rp-cat' }, [1, 2, 3].filter(g => g <= MVP()).map(g => [
        h('div', { class: 'rp-grp' }, GROUPS[g]),
        reps.filter(r => r.group === g).map(r => h('button', { class: 'rp-item' + (state.sel === r.id ? ' on' : ''), type: 'button', onClick: () => { state.sel = r.id; draw(); } }, h('span', { class: 'ic' }, BGS.icon(r.icon, 16)), h('span', null, h('b', null, r.title), h('span', { class: 'd' }, r.desc)))),
      ]))));
      wrap.appendChild(cat);
      const rep = reps.find(r => r.id === state.sel);
      wrap.appendChild(rep ? reportPanel(rep, state, draw) : ui.card({ title: 'Pilih laporan', icon: 'bar-chart', body: ui.emptyState({ icon: 'bar-chart', title: 'Belum ada laporan dipilih', text: 'Pilih salah satu laporan di sebelah kiri untuk melihat pratinjau, memberi filter, lalu mengekspor atau mencetaknya.' }) }));
    };
    draw(); return wrap;
  }

  function tabHistory() {
    const rows = EXPORTS.slice();
    return ui.card({ title: 'Riwayat ekspor & cetak', subtitle: 'Tercatat di memori sesi ini dan di audit trail (RUL-021). Termasuk ekspor yang Anda lakukan sekarang.', icon: 'clock', flush: true,
      body: ui.table({ rows, pageSize: 10, empty: ui.emptyState({ icon: 'download', title: 'Belum ada ekspor', text: 'Ekspor atau cetak laporan dari tab Katalog; riwayatnya muncul di sini.' }), columns: [
        { key: 'at', label: 'Waktu', render: e => fmt.dateTime(e.at) },
        { key: 'u', label: 'Pengguna', render: e => ui.userChip(e.userId) },
        { key: 'report', label: 'Laporan', render: e => h('b', null, e.report) },
        { key: 'fmt', label: 'Format', render: e => ui.badge(e.fmt, e.fmt === 'CSV' ? 'green' : 'blue') },
        { key: 'rows', label: 'Baris', align: 'right' },
        { key: 'note', label: 'Catatan', render: e => (/LENGKAP/.test(e.note) ? ui.badge(e.note, 'red') : h('span', { class: 'muted' }, e.note)) },
      ] }) });
  }

  function tabSchedules() {
    const host = h('div');
    const canEdit = BGS.can('export');
    const draw = () => {
      BGS.clear(host);
      host.appendChild(ui.card({ title: 'Laporan terjadwal', subtitle: 'Hasil dikirim sebagai notifikasi dalam aplikasi. Pengiriman WhatsApp/email belum tersedia (OQ-13).', icon: 'calendar',
        actions: ui.btn('Buat jadwal', { icon: 'plus', kind: 'primary', sm: true, disabled: !canEdit, title: canEdit ? '' : 'Hanya Superadmin, Director, dan Admin yang dapat membuat jadwal', onClick: () => openForm() }), flush: true,
        body: ui.table({ rows: SCHEDULES, pageSize: 8, empty: ui.emptyState({ icon: 'calendar', title: 'Belum ada jadwal', text: 'Buat jadwal agar laporan dibuat otomatis.' }), columns: [
          { key: 'r', label: 'Laporan', render: s => h('div', null, h('b', null, repTitle(s.reportId)), h('div', { class: 'db-mini' }, `${s.id} · dibuat ${uname(s.by)}`)) },
          { key: 'w', label: 'Jadwal', render: s => schedWhen(s) },
          { key: 'f', label: 'Format', render: s => ui.badge(s.fmt, s.fmt === 'CSV' ? 'green' : 'blue') },
          { key: 'p', label: 'Penerima', render: s => h('div', { class: 'stack-sm' }, s.recipients.map(id => ui.userChip(id))) },
          { key: 'n', label: 'Berikutnya', render: s => (s.active ? fmt.dateTime(nextRun(s)) : h('span', { class: 'muted' }, 'Dijeda')) },
          { key: 'l', label: 'Terakhir', render: s => (s.last ? fmt.rel(s.last) : '—') },
          { key: 'a', label: 'Aktif', render: s => { const cb = h('input', { type: 'checkbox', checked: s.active, disabled: !canEdit, onChange: e => { s.active = e.target.checked; BGS.audit(s.active ? 'Jadwal laporan diaktifkan' : 'Jadwal laporan dijeda', 'Jadwal laporan', s.id, repTitle(s.reportId)); draw(); } }); return h('label', { class: 'db-sw', style: 'border:0;padding:0' }, cb); } },
          { key: 'x', label: '', render: s => h('div', { class: 'row gap-sm' },
            ui.btn('Jalankan sekarang', { sm: true, disabled: !canEdit, onClick: () => runNow(s) }),
            ui.btn('', { icon: 'trash', sm: true, disabled: !canEdit, title: 'Hapus jadwal', onClick: async () => { if (await ui.confirm({ title: 'Hapus jadwal?', message: `Jadwal "${repTitle(s.reportId)}" (${schedWhen(s)}) akan dihapus.`, confirmLabel: 'Hapus', tone: 'danger' })) { SCHEDULES.splice(SCHEDULES.indexOf(s), 1); BGS.audit('Jadwal laporan dihapus', 'Jadwal laporan', s.id, repTitle(s.reportId)); draw(); ui.toast('Jadwal dihapus'); } } })) },
        ] }) }));
      if (!canEdit) host.appendChild(h('div', { style: 'margin-top:12px' }, ui.callout('info', 'Hanya-baca', 'Peran Viewer dapat melihat jadwal tetapi tidak dapat membuat atau mengubahnya.')));
    };
    function runNow(s) {
      const rep = REPORTS.find(r => r.id === s.reportId); const n = rep ? rep.rows({}).length : 0;
      s.last = new Date().toISOString();
      EXPORTS.unshift({ at: s.last, userId: ME(), report: repTitle(s.reportId), rows: n, fmt: `Terjadwal · ${s.fmt}`, note: 'Data sensitif disamarkan' });
      s.recipients.forEach(id => BGS.notify(id, `Laporan terjadwal "${repTitle(s.reportId)}" siap (${n} baris)`, `#/reports?r=${s.reportId}`, 'INFO'));
      BGS.audit('Laporan terjadwal dijalankan', 'Jadwal laporan', s.id, `${repTitle(s.reportId)} → ${s.recipients.map(uname).join(', ')}`);
      BGS.redrawTop && BGS.redrawTop(); draw(); ui.toast(`Laporan dibuat dan dikirim ke ${s.recipients.length} penerima (notifikasi dalam aplikasi)`);
    }
    function openForm() {
      let m;
      const recChecks = ['U01', 'U03', 'U04', 'U05', 'U12'].map(id => ({ id, cb: h('input', { type: 'checkbox', checked: id === ME() }) }));
      const form = ui.form({ cols: 2, submitLabel: 'Simpan jadwal', cancel: ui.btn('Batal', { onClick: () => m.close() }),
        fields: [
          { name: 'reportId', label: 'Laporan', type: 'select', required: true, span: 2, options: visibleReports().map(r => [r.id, r.title]), value: 'R-FUN' },
          { name: 'freq', label: 'Frekuensi', type: 'select', required: true, options: Object.entries(FREQ), value: 'MINGGUAN' },
          { name: 'time', label: 'Jam', type: 'time', required: true, value: '08:00' },
          { name: 'day', label: 'Hari (untuk mingguan)', type: 'select', options: DOW.slice(1).concat(DOW[0]), value: 'Senin' },
          { name: 'date', label: 'Tanggal (untuk bulanan, 1–28)', type: 'number', value: 1 },
          { name: 'fmt', label: 'Format', type: 'select', options: [['CSV', 'Excel (CSV)'], ['PDF', 'PDF']], value: 'CSV' },
        ],
        extra: h('div', { class: 'field', style: 'margin-top:14px' }, h('span', { class: 'lbl' }, 'Penerima', h('i', { class: 'req' }, '*')), h('div', { class: 'row wrap' }, recChecks.map(r => h('label', { class: 'row gap-sm sm', style: 'font-weight:600' }, r.cb, uname(r.id)))), h('span', { class: 'hint' }, 'Penerima mendapat notifikasi dalam aplikasi. WhatsApp/email belum tersedia (OQ-13).')),
        onSubmit: v => {
          const recipients = recChecks.filter(r => r.cb.checked).map(r => r.id);
          if (!recipients.length) { ui.toast('Pilih minimal satu penerima', 'warn'); return; }
          const date = Math.round(+v.date || 1);
          if (v.freq === 'BULANAN' && (date < 1 || date > 28)) { ui.toast('Tanggal bulanan harus antara 1 dan 28', 'warn'); return; }
          const s = { id: 'SCH-' + String(SCHEDULES.length + 1).padStart(2, '0'), reportId: v.reportId, freq: v.freq, day: v.day || 'Senin', date, time: v.time, fmt: v.fmt, recipients, active: true, last: null, by: ME() };
          SCHEDULES.push(s); BGS.audit('Jadwal laporan dibuat', 'Jadwal laporan', s.id, `${repTitle(s.reportId)} · ${schedWhen(s)}`);
          m.close(); draw(); ui.toast(`Jadwal dibuat. Eksekusi berikutnya ${fmt.dateTime(nextRun(s))}`);
        } });
      m = ui.modal({ title: 'Buat laporan terjadwal', size: 'md', body: form.el });
    }
    draw(); return host;
  }

  BGS.router.add('/reports', { title: 'Laporan & ekspor', roles: ['superadmin', 'director', 'admin', 'viewer'], mvp: 1, render(ctx) {
    const state = { sel: ctx.query.r || null, f: {} };
    const hd = ui.pageHeader({ title: 'Laporan & ekspor', subtitle: 'Pilih laporan, beri filter, lihat pratinjau langsung, lalu ekspor ke Excel atau cetak. Data sensitif selalu disamarkan secara default.' });
    hd.classList.add('rp-noprint'); ctx.el.appendChild(hd);
    const tabs = [{ id: 'cat', label: 'Katalog laporan', count: visibleReports().length, render: () => tabCatalog(ctx, state) }, { id: 'hist', label: 'Riwayat ekspor', count: EXPORTS.length, render: tabHistory }];
    if (MVP() >= 3) tabs.push({ id: 'sch', label: 'Laporan terjadwal', count: SCHEDULES.length, render: tabSchedules });
    if (MVP() < 3) ctx.el.appendChild(h('div', { class: 'rp-noprint' }, ui.callout('info', `Laporan MVP ${MVP() + 1}+ belum aktif`, MVP() === 1 ? 'Laporan pemrosesan, kuota, keberangkatan, dan kepatuhan muncul di MVP 2; laporan lanjutan & terjadwal di MVP 3.' : 'Laporan lanjutan dan penjadwalan laporan muncul di MVP 3.')));
    ctx.el.appendChild(ui.tabs(tabs));
  } });

  // ====================================================================
  // /notifications — notifikasi in-app (BR-029)
  // ====================================================================
  const NTYPE = {
    TASK_ASSIGNED: ['Tugas baru', 'blue', 'check-square'], VERIFY_REQUEST: ['Permintaan verifikasi', 'purple', 'shield'], APPROVAL: ['Persetujuan', 'pink', 'check-circle'],
    OVERDUE: ['Tugas terlambat', 'red', 'alert'], ESCALATION: ['Eskalasi', 'red', 'alert'], DOC_EXPIRY: ['Dokumen kedaluwarsa', 'amber', 'file'], QUOTA: ['Kuota', 'teal', 'layers'], RULE_CHANGE: ['Perubahan aturan', 'orange', 'list'], INFO: ['Info', 'gray', 'info'],
  };
  const ntype = t => NTYPE[t] || [t, 'gray', 'info'];
  const prefs = () => { D.notifPrefs = D.notifPrefs || {}; return D.notifPrefs[ME()] || (D.notifPrefs[ME()] = { show: Object.fromEntries(Object.keys(NTYPE).map(k => [k, true])), auto: { overdue: true, overdueDays: 2, docExpiry: true, quota: true, quotaPct: 20, dueSoon: true } }); };
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  const dayLabel = d => (sameDay(d, NOW()) ? 'Hari ini' : sameDay(d, new Date(+NOW() - DAY)) ? 'Kemarin' : 'Lebih lama');

  function runReminders(P) {
    const made = [];
    const add = (type, text, link) => { if (BGS.myNotifications().some(n => n.text === text)) return; BGS.notify(ME(), text, link, type); made.push(text); };
    const mgmt = ['superadmin', 'director', 'admin'].includes(BGS.role());
    if (P.auto.overdue) {
      D.tasks.filter(t => t.assigneeId === ME() && actionable(t) && overdue(t) && lateDays(t) >= P.auto.overdueDays).slice(0, 5).forEach(t => add('OVERDUE', `Tugas "${t.title}" pada ${t.caseId} terlambat ${lateDays(t)} hari`, '#/cases/' + t.caseId));
      if (mgmt) { const esc = D.tasks.filter(t => actionable(t) && overdue(t) && lateDays(t) > P.auto.overdueDays); if (esc.length) add('ESCALATION', `Eskalasi: ${esc.length} tugas terlambat lebih dari ${P.auto.overdueDays} hari belum selesai`, '#/monitor'); }
    }
    if (P.auto.dueSoon) D.tasks.filter(t => t.assigneeId === ME() && actionable(t) && !overdue(t) && (taskDue(t) - NOW()) / DAY <= 1).slice(0, 5).forEach(t => add('TASK_ASSIGNED', `Pengingat: "${t.title}" (${t.caseId}) jatuh tempo ≤ 1 hari`, '#/cases/' + t.caseId));
    if (P.auto.docExpiry && BGS.can('document.restricted.view')) {
      const n = D.documents.filter(d => d.status !== 'SUPERSEDED' && d.expiresAt && dayDiff(d.expiresAt, NOW()) >= 0 && dayDiff(d.expiresAt, NOW()) <= D.settings.expiryWarningDays).length;
      if (n) add('DOC_EXPIRY', `${n} dokumen akan kedaluwarsa dalam ${D.settings.expiryWarningDays} hari`, '#/documents');
    }
    if (P.auto.quota && mgmt) D.placementCodes.filter(p => p.status !== 'CLOSED' && p.available != null && (p.available / p.total) * 100 <= P.auto.quotaPct).forEach(p => add('QUOTA', `Kuota ${p.id} menipis: tersedia ${p.available} dari ${p.total}`, '#/placement-codes/' + p.id));
    return made;
  }

  BGS.router.add('/notifications', { title: 'Notifikasi', roles: BGS.ROLES.ALL, mvp: 2, render(ctx) {
    const P = prefs(); const st = { type: '', unread: false };
    const listHost = h('div'), chipHost = h('div', { class: 'row wrap gap-sm' });
    const mine = () => BGS.myNotifications().slice().sort((a, b) => b.at.localeCompare(a.at));
    const visible = () => mine().filter(n => P.show[n.type] !== false);
    const syncTop = () => BGS.redrawTop && BGS.redrawTop();
    const open = n => { if (!n.read) { n.read = true; syncTop(); } const link = n.link && n.link !== '#' ? n.link : null; if (link) { if (location.hash === link) ctx.refresh(); else location.hash = link; } else draw(); };
    const unreadCount = () => visible().filter(n => !n.read).length;
    const markAll = document.createElement('span');

    const markAllBtn = ui.btn('Tandai semua dibaca', { icon: 'check', onClick: () => { const u = mine().filter(n => !n.read); if (!u.length) { ui.toast('Semua notifikasi sudah dibaca', 'info'); return; } u.forEach(n => (n.read = true)); syncTop(); draw(); ui.toast(`${u.length} notifikasi ditandai dibaca`); } });

    function draw() {
      const all = visible(), hidden = mine().length - all.length;
      BGS.clear(chipHost);
      const types = [...new Set(all.map(n => n.type))];
      const chip = (label, val, n) => h('button', { class: 'chip' + (st.type === val ? ' on' : ''), type: 'button', style: st.type === val ? 'background:var(--blue);color:#fff;border-color:var(--blue)' : '', onClick: () => { st.type = val; draw(); } }, `${label} (${n})`);
      chipHost.appendChild(chip('Semua', '', all.length));
      types.forEach(t => chipHost.appendChild(chip(ntype(t)[0], t, all.filter(n => n.type === t).length)));
      const rows = all.filter(n => (!st.type || n.type === st.type) && (!st.unread || !n.read));
      BGS.clear(listHost);
      if (!rows.length) { listHost.appendChild(ui.emptyState({ icon: 'bell', title: all.length ? 'Tidak ada notifikasi pada filter ini' : 'Belum ada notifikasi', text: all.length ? 'Ubah filter atau matikan "Belum dibaca saja".' : 'Notifikasi tugas, persetujuan, dan pengingat akan muncul di sini.' })); }
      let lastDay = null;
      rows.forEach(n => {
        const dl = dayLabel(n.at); if (dl !== lastDay) { listHost.appendChild(h('div', { class: 'nt-day' }, dl)); lastDay = dl; }
        const [tl, tone, ic] = ntype(n.type);
        listHost.appendChild(h('div', { class: 'nt-item' + (n.read ? '' : ' unread'), role: 'button', tabindex: 0, onClick: e => { if (!e.target.closest('button')) open(n); }, onKeydown: e => { if (e.key === 'Enter') open(n); } },
          h('span', { class: 'nt-ic badge b-' + tone }, BGS.icon(ic, 18)),
          h('div', { class: 'grow', style: 'min-width:0' }, h('div', { class: 'nt-txt' }, n.text), h('div', { class: 'row wrap gap-sm', style: 'margin-top:4px' }, ui.badge(tl, tone), h('span', { class: 'db-mini' }, `${fmt.dateTime(n.at)} · ${fmt.rel(n.at)}`), n.read ? null : ui.badge('Baru', 'blue'))),
          h('div', { class: 'row gap-sm' }, n.read ? null : ui.btn('Tandai dibaca', { sm: true, onClick: () => { n.read = true; syncTop(); draw(); } }), n.link && n.link !== '#' ? ui.btn('Buka', { sm: true, icon: 'arrow-right', onClick: () => open(n) }) : null)));
      });
      if (hidden) listHost.appendChild(h('div', { class: 'db-note', style: 'padding:10px 16px' }, `${hidden} notifikasi dari jenis yang Anda matikan di Preferensi disembunyikan dari daftar ini.`));
      cnt.textContent = unreadCount() ? `${unreadCount()} belum dibaca` : 'Semua sudah dibaca';
      markAllBtn.disabled = !mine().some(n => !n.read);
    }
    const cnt = h('span', { class: 'muted sm' });

    ctx.el.appendChild(ui.pageHeader({ title: 'Notifikasi', subtitle: 'Pemberitahuan tugas, verifikasi, persetujuan, dan pengingat untuk akun Anda. Klik notifikasi untuk langsung membuka halaman terkait.', actions: [markAllBtn] }));

    const listCard = ui.card({ title: 'Kotak masuk', icon: 'bell', subtitle: 'Hanya notifikasi untuk Anda', actions: [cnt, h('label', { class: 'row gap-sm sm', style: 'font-weight:600' }, h('input', { type: 'checkbox', onChange: e => { st.unread = e.target.checked; draw(); } }), 'Belum dibaca saja')], flush: true,
      body: h('div', null, h('div', { class: 'toolbar' }, chipHost), listHost) });

    // ---- preferensi ----
    const sw = (label, desc, checked, onChange, disabled) => h('label', { class: 'db-sw' }, h('div', { class: 'grow' }, h('div', { style: 'font-weight:700' }, label), desc ? h('div', { class: 'db-mini' }, desc) : null), h('input', { type: 'checkbox', checked, disabled, onChange: e => onChange(e.target.checked) }));
    const save = () => { BGS.audit('Ubah preferensi notifikasi', 'User', ME(), ''); ui.toast('Preferensi disimpan'); };
    const prefBody = h('div', null,
      ui.callout('info', 'WhatsApp & email belum tersedia', 'Notifikasi saat ini hanya tampil di dalam aplikasi (lonceng di bar atas). Pengiriman WhatsApp/email menunggu keputusan OQ-13.'),
      h('div', { class: 'lbl', style: 'margin:14px 0 2px' }, 'Tampilkan jenis notifikasi'),
      Object.entries(NTYPE).map(([k, [l]]) => sw(l, null, P.show[k] !== false, v => { P.show[k] = v; draw(); save(); })),
      MVP() >= 3 ? [
        h('div', { class: 'lbl', style: 'margin:16px 0 2px' }, 'Pengingat otomatis ', ui.mvpTag(3)),
        sw('Tugas terlambat + eskalasi', `Beri tahu PIC; setelah lewat batas di bawah, eskalasi ke Admin/Director.`, P.auto.overdue, v => { P.auto.overdue = v; save(); }),
        h('label', { class: 'field', style: 'padding:6px 0 10px' }, h('span', { class: 'hint' }, 'Eskalasi setelah terlambat (hari)'), h('select', { class: 'input', onChange: e => { P.auto.overdueDays = +e.target.value; save(); } }, [1, 2, 3, 5].map(n => h('option', { value: n, selected: P.auto.overdueDays === n }, `${n} hari`)))),
        sw('Tugas jatuh tempo besok', 'Pengingat H-1 untuk tugas yang Anda kerjakan.', P.auto.dueSoon, v => { P.auto.dueSoon = v; save(); }),
        sw('Dokumen akan kedaluwarsa', `Peringatan ${D.settings.expiryWarningDays} hari sebelum masa berlaku habis (diatur Superadmin di Pengaturan).`, P.auto.docExpiry, v => { P.auto.docExpiry = v; save(); }, !BGS.can('document.restricted.view')),
        sw('Kuota menipis', 'Beri tahu saat sisa kuota Placement Code di bawah ambang.', P.auto.quota, v => { P.auto.quota = v; save(); }, !['superadmin', 'director', 'admin'].includes(BGS.role())),
        h('label', { class: 'field', style: 'padding:6px 0 10px' }, h('span', { class: 'hint' }, 'Ambang kuota menipis (% tersedia)'), h('select', { class: 'input', onChange: e => { P.auto.quotaPct = +e.target.value; save(); } }, [10, 20, 30, 50].map(n => h('option', { value: n, selected: P.auto.quotaPct === n }, `≤ ${n}%`)))),
        ui.btn('Jalankan pengingat otomatis sekarang', { icon: 'play', onClick: () => { const made = runReminders(P); syncTop(); draw(); ui.toast(made.length ? `${made.length} pengingat baru dibuat` : 'Tidak ada pengingat baru — semua kondisi aman atau sudah pernah diingatkan', made.length ? 'good' : 'info'); } }),
        h('div', { class: 'db-note' }, 'Simulasi: di sistem nyata pengingat berjalan otomatis terjadwal (BR-029, RUL-028).'),
      ] : h('div', { class: 'db-note' }, 'Pengingat otomatis (tugas terlambat dengan eskalasi, dokumen kedaluwarsa, kuota menipis) tersedia di MVP 3.'));
    const prefCard = ui.card({ title: 'Preferensi notifikasi', icon: 'settings', body: prefBody });
    ctx.el.appendChild(h('div', { class: 'grid cols-21', style: 'align-items:start' }, listCard, prefCard));
    draw();
  } });

})();
