/* Sidebar navigation = single source of truth for all routes (path, roles, MVP).
   Page modules MUST register exactly these paths with BGS.router.add(). */
(function () {
  const BGS = window.BGS, D = BGS.data;
  const ALL = ['superadmin', 'director', 'admin', 'pic', 'viewer'];
  const SA = 'superadmin', DI = 'director', AD = 'admin', PI = 'pic', VI = 'viewer';
  BGS.ROLES = { ALL, OPS: [SA, AD], STAFF: [SA, DI, AD, PI], MGMT: [SA, DI, AD, VI] };
  const newReg = () => D.registrations.filter(r => r.status === 'NEW').length;
  const myTasks = () => D.tasks.filter(t => t.assigneeId === BGS.state.userId && !['COMPLETED', 'CANCELLED'].includes(t.status)).length;
  const pendAp = () => D.approvals.filter(a => a.status === 'PENDING').length;
  BGS.nav = [
    { section: 'Utama', items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'home', roles: ALL, mvp: 1 },
      { path: '/dashboard/advanced', label: 'Analitik lanjutan', icon: 'trending-up', roles: [SA, DI, AD, VI], mvp: 3 },
      { path: '/approvals', label: 'Persetujuan', icon: 'check-square', roles: [SA, DI], mvp: 2, badge: pendAp },
    ] },
    { section: 'Worker & Rekrutmen', items: [
      { path: '/registrations', label: 'Inbox registrasi', icon: 'inbox', roles: [SA, AD], mvp: 1, badge: newReg },
      { path: '/workers', label: 'Worker', icon: 'users', roles: ALL, mvp: 1 },
      { path: '/import', label: 'Impor Excel', icon: 'upload', roles: [SA, AD], mvp: 1 },
      { path: '/applications', label: 'Lamaran & seleksi', icon: 'clipboard', roles: ALL, mvp: 1 },
      { path: '/documents', label: 'Dokumen', icon: 'folder', roles: ALL, mvp: 1 },
    ] },
    { section: 'Penempatan & Kuota', items: [
      { path: '/master', label: 'Data master', icon: 'database', roles: [SA, DI, AD, VI], mvp: 1 },
      { path: '/partners', label: 'Partner', icon: 'briefcase', roles: [SA, DI, AD, PI, VI], mvp: 2 },
      { path: '/job-orders', label: 'Job Order', icon: 'file-text', roles: [SA, DI, AD, PI, VI], mvp: 2 },
      { path: '/placement-codes', label: 'Placement Code & kuota', icon: 'layers', roles: [SA, DI, AD, PI, VI], mvp: 2 },
      { path: '/batches', label: 'Batch', icon: 'calendar', roles: [SA, DI, AD, PI, VI], mvp: 2 },
    ] },
    { section: 'Pemrosesan', items: [
      { path: '/allocation', label: 'Alokasi penempatan', icon: 'git-branch', roles: [SA, AD], mvp: 2 },
      { path: '/cases', label: 'Placement Case', icon: 'briefcase', roles: ALL, mvp: 2 },
      { path: '/tasks', label: 'Tugas', icon: 'check-square', roles: [SA, AD, PI], mvp: 2, badge: myTasks },
      { path: '/monitor', label: 'Hambatan & terlambat', icon: 'alert', roles: ALL, mvp: 2 },
      { path: '/final-verification', label: 'Verifikasi akhir', icon: 'shield', roles: [SA, DI, AD], mvp: 2 },
      { path: '/departures', label: 'Keberangkatan', icon: 'plane', roles: [SA, DI, AD, PI], mvp: 2 },
    ] },
    { section: 'Alur & Kepatuhan', items: [
      { path: '/workflows', label: 'Workflow template', icon: 'git-branch', roles: [SA, DI, AD], mvp: 2 },
      { path: '/compliance/rules', label: 'Aturan syarat', icon: 'list', roles: [SA, DI, AD], mvp: 1 },
      { path: '/compliance/library', label: 'Pustaka regulasi', icon: 'file-text', roles: [SA, DI, AD], mvp: 2 },
      { path: '/compliance/checklists', label: 'Checklist case', icon: 'check-square', roles: [SA, DI, AD, PI], mvp: 2 },
    ] },
    { section: 'Laporan', items: [
      { path: '/reports', label: 'Laporan & ekspor', icon: 'bar-chart', roles: [SA, DI, AD, VI], mvp: 1 },
      { path: '/notifications', label: 'Notifikasi', icon: 'bell', roles: ALL, mvp: 2 },
    ] },
    { section: 'Administrasi', items: [
      { path: '/users', label: 'Pengguna & peran', icon: 'user', roles: [SA], mvp: 1 },
      { path: '/roles', label: 'Matriks izin', icon: 'key', roles: [SA, DI], mvp: 1 },
      { path: '/audit', label: 'Audit trail', icon: 'shield', roles: [SA, DI], mvp: 1 },
      { path: '/data-protection', label: 'Perlindungan data', icon: 'lock', roles: [SA, DI, AD], mvp: 1 },
      { path: '/settings', label: 'Pengaturan sistem', icon: 'settings', roles: [SA], mvp: 1 },
      { path: '/integrations', label: 'Integrasi eksternal', icon: 'plug', roles: [SA], mvp: 3 },
    ] },
  ];
  // Extra (non-sidebar) routes that pages register are listed in each agent's brief:
  //  /registrations/:id /workers/new /workers/:id /applications/:id /job-orders/:id /placement-codes/:id /cases/:id /workflows/:id /workflows/:id/edit
})();
