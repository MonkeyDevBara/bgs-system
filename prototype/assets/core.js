/* BGS prototype core: DOM helper, state/roles/permissions, router, shell, UI component library. */
(function () {
  const BGS = window.BGS;
  const D = BGS.data;

  // ====================== DOM helper ======================
  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') typeof v === 'string' ? (el.style.cssText = v) : Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
    const add = kid => { if (kid == null || kid === false) return; if (Array.isArray(kid)) kid.forEach(add); else el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid))); };
    kids.forEach(add);
    return el;
  };
  BGS.h = h;
  BGS.$ = (s, r) => (r || document).querySelector(s);
  BGS.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  BGS.clear = el => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  // ====================== icons ======================
  const P = {
    home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10', users: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8', 'user-plus': 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M19 8v6M22 11h-6',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
    file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6', 'file-text': 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    folder: 'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z', upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12', download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
    check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18M6 6l12 12', alert: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
    bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0', search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', lock: 'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 15a3 3 0 100-6 3 3 0 000 6z', 'eye-off': 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22',
    clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2', calendar: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18',
    briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16', globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', 'git-branch': 'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', 'check-square': 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11', clipboard: 'M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2M9 2h6a1 1 0 011 1v2a1 1 0 01-1 1H9a1 1 0 01-1-1V3a1 1 0 011-1z',
    'bar-chart': 'M12 20V10M18 20V4M6 20v-4', pie: 'M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z', 'trending-up': 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
    plus: 'M12 5v14M5 12h14', edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z', trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2',
    more: 'M12 12h.01M19 12h.01M5 12h.01', 'chevron-right': 'M9 18l6-6-6-6', 'chevron-down': 'M6 9l6 6 6-6', 'chevron-left': 'M15 18l-6-6 6-6', filter: 'M22 3H2l8 9.46V19l4 2v-8.54z', refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
    link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71', mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6',
    phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z',
    flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7', award: 'M12 15a7 7 0 100-14 7 7 0 000 14zM8.21 13.89L7 23l5-3 5 3-1.21-9.12', send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    cpu: 'M18 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3', plug: 'M12 22v-5M9 8V2M15 8V2M18 8v5a6 6 0 01-12 0V8z',
    database: 'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5', key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.78 7.78 5.5 5.5 0 017.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2', plane: 'M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
    'arrow-right': 'M5 12h14M12 5l7 7-7 7', 'arrow-up': 'M12 19V5M5 12l7-7 7 7', 'arrow-down': 'M12 5v14M19 12l-7 7-7-7', 'log-out': 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9', info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
    'x-circle': 'M12 22a10 10 0 100-20 10 10 0 000 20zM15 9l-6 6M9 9l6 6', 'check-circle': 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
    copy: 'M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1', merge: 'M8 6l4-4 4 4M12 2v10.3a4 4 0 01-1.17 2.83L4 22M20 22l-5-5', menu: 'M3 12h18M3 6h18M3 18h18', map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zM8 2v16M16 6v16', pause: 'M6 4h4v16H6zM14 4h4v16h-4z', play: 'M5 3l14 9-14 9V3z', printer: 'M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z',
  };
  BGS.icon = (name, size = 18, cls) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('class', 'ico' + (cls ? ' ' + cls : ''));
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', P[name] || P.info); s.appendChild(p); return s;
  };

  // ====================== formatting ======================
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const toD = v => (v instanceof Date ? v : new Date(v));
  const fmt = (BGS.fmt = {
    date: v => { if (!v) return '—'; const d = toD(v); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; },
    dateTime: v => { if (!v) return '—'; const d = toD(v); return `${fmt.date(d)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; },
    rel: v => { if (!v) return '—'; const days = Math.round((toD(v) - BGS.today) / 86400000); if (days === 0) return 'hari ini'; return days < 0 ? `${-days} hari lalu` : `dalam ${days} hari`; },
    daysFrom: v => Math.round((toD(v) - BGS.today) / 86400000),
    num: n => new Intl.NumberFormat('id-ID').format(n), pct: (a, b) => (b ? Math.round((a / b) * 100) : 0) + '%',
    age: dob => Math.floor((BGS.today - toD(dob)) / (365.25 * 86400000)),
  });
  BGS.nextId = (prefix, list, key = 'id', width = 5) => `${prefix}${String(list.length + 1).padStart(width, '0')}`;
  BGS.download = (filename, text, mime = 'text/csv') => { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: mime + ';charset=utf-8' })), download: filename }); document.body.appendChild(a); a.click(); a.remove(); };
  BGS.exportCsv = (rows, cols, filename) => {
    const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    BGS.download(filename, [cols.map(c => esc(c.label)).join(','), ...rows.map(r => cols.map(c => esc(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))].join('\n'));
    BGS.audit('Ekspor data', 'Laporan', filename, `${rows.length} baris`);
  };

  // ====================== state / roles / permissions ======================
  BGS.roles = { superadmin: 'Superadmin', director: 'Director', admin: 'Admin', pic: 'PIC', viewer: 'Viewer' };
  BGS.roleTone = { superadmin: 'navy', director: 'purple', admin: 'blue', pic: 'orange', viewer: 'teal' };
  const saved = (() => { try { return JSON.parse(sessionStorage.getItem('bgs.state') || 'null'); } catch (e) { return null; } })();
  BGS.state = saved || { loggedIn: false, role: 'admin', userId: 'U04', mvp: 3 };
  BGS.saveState = () => sessionStorage.setItem('bgs.state', JSON.stringify(BGS.state));
  BGS.user = () => D.user(BGS.state.userId);
  BGS.role = () => BGS.state.role;
  BGS.isRole = (...r) => r.includes(BGS.state.role);
  const PERM = {
    'worker.write': ['superadmin', 'admin'], 'registration.review': ['superadmin', 'admin'], import: ['superadmin', 'admin'],
    'application.screen': ['superadmin', 'admin', 'pic'], 'application.decide': ['superadmin', 'admin'], 'document.upload': ['superadmin', 'admin', 'pic'], 'document.verify': ['superadmin', 'admin', 'pic'],
    'master.write': ['superadmin'], 'partner.write': ['superadmin', 'admin'], 'quota.total.change': ['superadmin'], 'quota.total.request': ['admin'],
    'case.allocate': ['superadmin', 'admin'], 'pic.assign': ['superadmin', 'admin'], 'task.execute': ['superadmin', 'admin', 'pic'], 'task.verify': ['superadmin', 'admin', 'pic'], 'task.approve': ['superadmin', 'director', 'admin'],
    'final.verify': ['superadmin', 'admin'], 'workflow.write': ['superadmin'], 'workflow.approve': ['director'], 'rule.write': ['superadmin'], 'user.manage': ['superadmin'], 'audit.view': ['superadmin', 'director'],
    'approval.decide': ['director'], settings: ['superadmin'], 'departure.record': ['superadmin', 'admin', 'pic'], 'export': ['superadmin', 'director', 'admin'], 'merge.worker': ['superadmin', 'admin'], 'dsr.manage': ['superadmin', 'admin'],
  };
  BGS.can = a => (PERM[a] || []).includes(BGS.state.role);
  BGS.perms = PERM;
  // data scope (RUL-020): PIC only sees what is assigned to them
  const me = () => BGS.state.userId;
  BGS.scope = {
    isLimited: () => BGS.state.role === 'pic',
    cases: () => (BGS.scope.isLimited() ? D.cases.filter(c => Object.values(c.pics).includes(me())) : D.cases),
    applications: () => (BGS.scope.isLimited() ? D.applications.filter(a => a.picId === me() || BGS.scope.cases().some(c => c.applicationId === a.id)) : D.applications),
    workers: () => { if (!BGS.scope.isLimited()) return D.workers; const ids = new Set(BGS.scope.applications().map(a => a.workerId)); return D.workers.filter(w => ids.has(w.id)); },
    tasks: () => (BGS.scope.isLimited() ? D.tasks.filter(t => t.assigneeId === me() || t.verifierId === me()) : D.tasks),
  };
  BGS.audit = (action, entityType, entityId, detail) => D.audit.unshift({ id: 'AU-' + String(D.audit.length + 1).padStart(5, '0'), at: new Date().toISOString(), userId: BGS.state.userId, action, entityType, entityId: entityId || '—', detail: detail || '', ip: '10.0.0.21' });
  BGS.notify = (to, text, link, type = 'INFO') => D.notifications.unshift({ id: 'N' + (D.notifications.length + 1), to, type, text, at: BGS.today.toISOString(), read: false, link: link || '#', });
  BGS.myNotifications = () => D.notifications.filter(n => n.to === BGS.state.userId);
  BGS.go = path => { location.hash = '#' + path; };
  BGS.addStyle = css => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); };

  // ====================== status vocabulary ======================
  const ST = {
    worker: { ACTIVE: ['Aktif', 'blue'], IN_PROCESS: ['Dalam proses', 'orange'], DEPLOYED: ['Sudah berangkat', 'green'], INACTIVE: ['Tidak aktif', 'gray'], ARCHIVED: ['Diarsipkan', 'gray'] },
    application: { SUBMITTED: ['Diajukan', 'blue'], SCREENING: ['Screening', 'purple'], REVISION_REQUIRED: ['Perlu revisi', 'amber'], INTERVIEW: ['Wawancara', 'purple'], ASSESSMENT: ['Penilaian', 'purple'], SELECTED: ['Terpilih', 'green'], WAITLISTED: ['Cadangan', 'amber'], ALLOCATED: ['Dialokasikan', 'teal'], REJECTED: ['Ditolak', 'red'], WITHDRAWN: ['Mundur', 'gray'], CANCELLED: ['Dibatalkan', 'gray'] },
    case: { DRAFT: ['Draf', 'gray'], IN_PROCESS: ['Diproses', 'orange'], FINAL_VERIFICATION: ['Verifikasi akhir', 'pink'], READY_TO_DEPART: ['Siap berangkat', 'teal'], DEPARTED: ['Berangkat', 'green'], ON_HOLD: ['Ditahan', 'amber'], CANCELLED: ['Dibatalkan', 'red'] },
    task: { TODO: ['Belum mulai', 'gray'], IN_PROGRESS: ['Dikerjakan', 'blue'], WAITING_EVIDENCE: ['Menunggu bukti', 'amber'], PENDING_VERIFICATION: ['Menunggu verifikasi', 'purple'], PENDING_APPROVAL: ['Menunggu approval', 'pink'], REJECTED: ['Ditolak (revisi)', 'red'], BLOCKED: ['Terhambat', 'red'], COMPLETED: ['Selesai', 'green'], CANCELLED: ['Dibatalkan', 'gray'] },
    step: { LOCKED: ['Terkunci', 'gray'], READY: ['Siap', 'blue'], IN_PROGRESS: ['Berjalan', 'orange'], COMPLETED: ['Selesai', 'green'], SKIPPED: ['Dilewati', 'amber'], CANCELLED: ['Dibatalkan', 'red'] },
    document: { UPLOADED: ['Menunggu verifikasi', 'amber'], VERIFIED: ['Terverifikasi', 'green'], REJECTED: ['Ditolak', 'red'], SUPERSEDED: ['Digantikan', 'gray'], EXPIRED: ['Kedaluwarsa', 'red'] },
    registration: { NEW: ['Baru', 'blue'], ACCEPTED: ['Diterima', 'green'], MERGED: ['Digabung', 'teal'], DISCARDED: ['Dibuang', 'gray'] },
    code: { OPEN: ['Terbuka', 'green'], FULL: ['Penuh', 'amber'], CLOSED: ['Ditutup', 'gray'] },
    approval: { PENDING: ['Menunggu', 'amber'], APPROVED: ['Disetujui', 'green'], REJECTED: ['Ditolak', 'red'], EXPIRED: ['Kedaluwarsa', 'gray'] },
    template: { DRAFT: ['Draf', 'gray'], PUBLISHED: ['PUBLISHED', 'green'], SUPERSEDED: ['Digantikan', 'gray'] },
    legal: { PERLU_VERIFIKASI: ['Perlu verifikasi hukum', 'amber'], TERVERIFIKASI: ['Terverifikasi hukum', 'green'], INTERNAL: ['Aturan internal', 'blue'] },
    generic: { ACTIVE: ['Aktif', 'green'], INACTIVE: ['Nonaktif', 'gray'], DRAFT: ['Draf', 'gray'], CLOSED: ['Ditutup', 'gray'], OPEN: ['Terbuka', 'green'], PLANNED: ['Direncanakan', 'blue'], DIPROSES: ['Diproses', 'amber'], SELESAI: ['Selesai', 'green'] },
  };
  BGS.ST = ST;

  // ====================== UI library ======================
  const ui = (BGS.ui = {});
  ui.badge = (text, tone = 'gray', opt = {}) => h('span', { class: `badge b-${tone}${opt.dot ? ' b-dot' : ''}`, title: opt.title }, text);
  ui.status = (domain, v) => { const [l, t] = (ST[domain] || {})[v] || [v, 'gray']; return ui.badge(l, t, { dot: true }); };
  ui.roleBadge = r => ui.badge(BGS.roles[r] || r, BGS.roleTone[r] || 'gray');
  ui.mvpTag = n => h('span', { class: `mvp-tag mvp-${n}`, title: `Tersedia di MVP ${n}` }, `MVP ${n}`);
  ui.avatar = (name, color, size = 28) => h('span', { class: 'avatar', style: { width: size + 'px', height: size + 'px', background: color || '#475569', fontSize: size * 0.4 + 'px' } }, (name || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase());
  ui.link = (label, href, cls) => h('a', { class: cls || 'lnk', href: '#' + href }, label);
  ui.workerLink = id => { const w = D.worker(id); return w ? h('a', { class: 'lnk', href: `#/workers/${w.id}` }, w.name) : id; };
  ui.caseLink = id => h('a', { class: 'lnk mono', href: `#/cases/${id}` }, id);
  ui.appLink = id => h('a', { class: 'lnk mono', href: `#/applications/${id}` }, id);
  ui.codeLink = id => h('a', { class: 'lnk mono', href: `#/placement-codes/${id}` }, id);
  ui.userChip = id => { const u = D.user(id); return u ? h('span', { class: 'userchip' }, ui.avatar(u.name, '#334155', 22), u.name) : '—'; };
  ui.kv = (pairs, cols = 1) => h('dl', { class: `kv kv-${cols}` }, pairs.filter(Boolean).map(([k, v]) => h('div', { class: 'kv-row' }, h('dt', null, k), h('dd', null, v == null || v === '' ? '—' : v))));
  ui.progress = (pct, tone = 'blue', label) => h('div', { class: 'progress', title: label || pct + '%' }, h('div', { class: `progress-bar p-${tone}`, style: { width: Math.max(0, Math.min(100, pct)) + '%' } }));
  ui.emptyState = ({ icon = 'inbox', title, text, action }) => h('div', { class: 'empty' }, BGS.icon(icon, 36), h('div', { class: 'empty-t' }, title), text && h('div', { class: 'muted' }, text), action);
  ui.btn = (label, o = {}) => h('button', { class: `btn ${o.kind ? 'btn-' + o.kind : ''} ${o.sm ? 'btn-sm' : ''}`, type: o.type || 'button', disabled: o.disabled, title: o.title, onClick: o.onClick }, o.icon && BGS.icon(o.icon, o.sm ? 14 : 16), label);
  ui.callout = (tone, title, body) => h('div', { class: `callout c-${tone}` }, BGS.icon(tone === 'danger' ? 'alert' : tone === 'good' ? 'check-circle' : 'info', 18), h('div', null, title && h('b', null, title), body && h('div', null, body)));
  ui.disclaimer = () => ui.callout('warn', 'Alat kontrol internal', 'Checklist kepatuhan ini bukan bukti resmi pemenuhan persyaratan pemerintah (RUL-024). Rujukan regulasi perlu verifikasi hukum.');

  ui.pageHeader = ({ title, subtitle, actions, breadcrumbs, mvp }) => h('div', { class: 'page-head' },
    h('div', null,
      breadcrumbs && h('div', { class: 'crumbs' }, breadcrumbs.map((c, i) => [i ? BGS.icon('chevron-right', 12) : null, c.href ? h('a', { href: '#' + c.href }, c.label) : h('span', null, c.label)])),
      h('h1', null, title, mvp && ui.mvpTag(mvp)), subtitle && h('p', { class: 'muted' }, subtitle)),
    actions && h('div', { class: 'page-actions' }, actions));
  ui.card = ({ title, subtitle, actions, body, flush, cls, icon }) => h('section', { class: 'card ' + (cls || '') },
    (title || actions) && h('header', { class: 'card-h' }, h('div', { class: 'card-t' }, icon && BGS.icon(icon, 16), h('div', null, h('h3', null, title), subtitle && h('div', { class: 'muted sm' }, subtitle))), actions && h('div', { class: 'row gap-sm' }, actions)),
    h('div', { class: flush ? 'card-b flush' : 'card-b' }, body));
  ui.kpi = ({ label, value, sub, tone = 'blue', icon, href, trend }) => h(href ? 'a' : 'div', { class: `kpi k-${tone}`, href: href && '#' + href },
    h('div', { class: 'kpi-ic' }, BGS.icon(icon || 'activity', 20)), h('div', null, h('div', { class: 'kpi-l' }, label), h('div', { class: 'kpi-v' }, value), sub && h('div', { class: 'kpi-s' }, trend && h('span', { class: trend > 0 ? 'up' : 'down' }, (trend > 0 ? '▲ ' : '▼ ') + Math.abs(trend) + '% '), sub)));

  // ---------- toast / modal / drawer / dialogs ----------
  ui.toast = (msg, tone = 'good') => {
    let box = BGS.$('#toasts'); if (!box) { box = h('div', { id: 'toasts' }); document.body.appendChild(box); }
    const t = h('div', { class: `toast t-${tone}` }, BGS.icon(tone === 'danger' ? 'x-circle' : tone === 'warn' ? 'alert' : 'check-circle', 18), msg);
    box.appendChild(t); setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3600);
  };
  const overlay = (kind, { title, body, footer, size = 'md', onClose }) => {
    const close = () => { ov.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
    const esc = e => e.key === 'Escape' && close();
    const ov = h('div', { class: `overlay ov-${kind}`, onClick: e => e.target === ov && close() },
      h('div', { class: `${kind} ${kind}-${size}`, role: 'dialog', 'aria-label': title },
        h('header', { class: `${kind}-h` }, h('h3', null, title), h('button', { class: 'icon-btn', 'aria-label': 'Tutup', onClick: close }, BGS.icon('x', 18))),
        h('div', { class: `${kind}-b` }, body), footer && h('footer', { class: `${kind}-f` }, footer)));
    document.body.appendChild(ov); document.addEventListener('keydown', esc); return { el: ov, close };
  };
  ui.modal = o => overlay('modal', o);
  ui.drawer = o => overlay('drawer', Object.assign({ size: 'md' }, o));
  ui.confirm = ({ title = 'Konfirmasi', message, confirmLabel = 'Ya, lanjutkan', tone = 'primary' }) => new Promise(res => {
    const m = ui.modal({ title, size: 'sm', body: h('p', null, message), onClose: () => res(false), footer: [ui.btn('Batal', { onClick: () => { res(false); m.close(); } }), ui.btn(confirmLabel, { kind: tone, onClick: () => { res(true); m.el.remove(); } })] });
  });
  // RUL-022: rejections, cancellations, skips, overrides, due-date changes need a reason
  ui.reasonPrompt = ({ title = 'Alasan wajib diisi', message, label = 'Alasan', confirmLabel = 'Simpan', tone = 'primary', presets }) => new Promise(res => {
    const ta = h('textarea', { class: 'input', rows: 3, placeholder: 'Tulis alasan singkat dan jelas…' });
    const err = h('div', { class: 'field-err', style: 'display:none' }, 'Alasan wajib diisi (RUL-022).');
    const m = ui.modal({
      title, size: 'sm', onClose: () => res(null),
      body: h('div', { class: 'stack' }, message && h('p', { class: 'muted' }, message), presets && h('div', { class: 'row wrap gap-sm' }, presets.map(p => h('button', { class: 'chip', type: 'button', onClick: () => (ta.value = p) }, p))), h('label', { class: 'field' }, h('span', { class: 'lbl' }, label, h('i', { class: 'req' }, '*')), ta, err)),
      footer: [ui.btn('Batal', { onClick: () => { res(null); m.close(); } }), ui.btn(confirmLabel, { kind: tone, onClick: () => { if (!ta.value.trim()) { err.style.display = 'block'; return; } res(ta.value.trim()); m.el.remove(); } })],
    });
    setTimeout(() => ta.focus(), 30);
  });

  // ---------- forms ----------
  ui.field = f => {
    const id = 'f_' + f.name; let input;
    const common = { id, name: f.name, class: 'input', placeholder: f.placeholder, disabled: f.readonly || f.disabled, required: f.required };
    if (f.type === 'textarea') input = h('textarea', Object.assign({ rows: f.rows || 3 }, common), f.value || '');
    else if (f.type === 'select') input = h('select', common, (f.options || []).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(f.value) === String(v) }, l); }));
    else if (f.type === 'checkbox') input = h('input', { id, name: f.name, type: 'checkbox', checked: !!f.value, disabled: f.readonly });
    else if (f.type === 'file') input = h('input', Object.assign({}, common, { type: 'file', class: 'input', onChange: e => f.onFile && f.onFile(e.target.files[0]) }));
    else input = h('input', Object.assign({ type: f.type || 'text', value: f.value ?? '' }, common));
    if (f.type !== 'select' && f.type !== 'textarea' && f.type !== 'checkbox' && f.type !== 'file' && f.value != null) input.value = f.value;
    input.__field = f;
    const wrap = h('label', { class: `field ${f.type === 'checkbox' ? 'field-check' : ''} ${f.span ? 'span-' + f.span : ''}`, for: id }, f.type === 'checkbox' ? [input, h('span', null, f.label, f.required && h('i', { class: 'req' }, '*'))] : [h('span', { class: 'lbl' }, f.label, f.required && h('i', { class: 'req' }, '*')), input], f.hint && h('span', { class: 'hint' }, f.hint), h('span', { class: 'field-err', style: 'display:none' }));
    wrap.input = input; return wrap;
  };
  ui.form = ({ fields, cols = 2, onSubmit, submitLabel = 'Simpan', cancel, extra }) => {
    const nodes = fields.map(ui.field);
    const values = () => { const o = {}; nodes.forEach(n => { const i = n.input; o[i.name] = i.type === 'checkbox' ? i.checked : i.type === 'file' ? (i.files[0] ? i.files[0].name : '') : i.value; }); return o; };
    const validate = () => { let ok = true; nodes.forEach(n => { const i = n.input, err = BGS.$('.field-err', n); const bad = i.__field.required && !(i.type === 'checkbox' ? i.checked : String(i.value).trim()); err.style.display = bad ? 'block' : 'none'; err.textContent = bad ? 'Wajib diisi' : ''; i.classList.toggle('invalid', bad); if (bad) ok = false; }); return ok; };
    const el = h('form', { class: 'form', novalidate: true, onSubmit: e => { e.preventDefault(); if (validate()) onSubmit(values()); else ui.toast('Lengkapi kolom yang wajib diisi', 'warn'); } },
      h('div', { class: `form-grid cols-${cols}` }, nodes), extra, h('div', { class: 'form-actions' }, cancel, h('button', { class: 'btn btn-primary', type: 'submit' }, submitLabel)));
    return { el, values, validate, nodes };
  };

  // ---------- tabs ----------
  ui.tabs = (tabs, { active, onChange } = {}) => {
    let cur = active || tabs[0].id; const bar = h('div', { class: 'tabs', role: 'tablist' }); const pane = h('div', { class: 'tab-pane' });
    const draw = () => { BGS.clear(bar); tabs.forEach(t => bar.appendChild(h('button', { class: 'tab' + (t.id === cur ? ' on' : ''), role: 'tab', onClick: () => { cur = t.id; draw(); onChange && onChange(cur); } }, t.label, t.count != null && h('span', { class: 'tab-n' }, t.count)))); BGS.clear(pane); const body = tabs.find(t => t.id === cur).render(); pane.appendChild(body.nodeType ? body : document.createTextNode(body || '')); };
    draw(); return h('div', { class: 'tabs-wrap' }, bar, pane);
  };

  // ---------- table + list view ----------
  ui.table = ({ columns, rows, onRowClick, empty, pageSize = 10, dense, sortKey, sortDir = 1, rowClass }) => {
    let page = 0, sk = sortKey, sd = sortDir; const wrap = h('div', { class: 'tbl-wrap' });
    const draw = () => {
      let data = rows.slice();
      if (sk) { const col = columns.find(c => c.key === sk); const val = r => (col.sortValue ? col.sortValue(r) : r[sk]); data.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * sd; }); }
      const pages = Math.max(1, Math.ceil(data.length / pageSize)); page = Math.min(page, pages - 1); const slice = data.slice(page * pageSize, page * pageSize + pageSize);
      BGS.clear(wrap);
      if (!data.length) { wrap.appendChild(empty || ui.emptyState({ title: 'Tidak ada data', text: 'Coba ubah filter atau kata kunci pencarian.' })); return; }
      wrap.appendChild(h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl' + (dense ? ' dense' : '') },
        h('thead', null, h('tr', null, columns.map(c => h('th', { class: (c.align ? 'al-' + c.align : '') + (c.sortable ? ' sortable' : ''), style: c.width && `width:${c.width}`, onClick: c.sortable ? () => { sd = sk === c.key ? -sd : 1; sk = c.key; draw(); } : null }, c.label, c.sortable && sk === c.key && h('span', { class: 'sort' }, sd > 0 ? '▲' : '▼'))))),
        h('tbody', null, slice.map(r => h('tr', { class: (onRowClick ? 'clickable ' : '') + (rowClass ? rowClass(r) || '' : ''), onClick: onRowClick ? e => { if (!e.target.closest('a,button,input,select')) onRowClick(r); } : null }, columns.map(c => h('td', { class: c.align ? 'al-' + c.align : '' }, c.render ? c.render(r) : r[c.key]))))))));
      if (data.length > pageSize) wrap.appendChild(h('div', { class: 'pager' }, h('span', { class: 'muted sm' }, `${page * pageSize + 1}–${Math.min(data.length, (page + 1) * pageSize)} dari ${data.length}`), h('div', { class: 'row gap-sm' }, ui.btn('', { icon: 'chevron-left', sm: true, disabled: page === 0, onClick: () => { page--; draw(); } }), h('span', { class: 'sm' }, `${page + 1} / ${pages}`), ui.btn('', { icon: 'chevron-right', sm: true, disabled: page >= pages - 1, onClick: () => { page++; draw(); } }))));
      else wrap.appendChild(h('div', { class: 'pager' }, h('span', { class: 'muted sm' }, `${data.length} data`)));
    };
    draw(); wrap.redraw = (newRows) => { if (newRows) rows = newRows; draw(); }; return wrap;
  };
  /* listView: toolbar (search + select filters) + table. items: array or () => array.
     filters: [{key,label,options:[[value,label]],match?:(row,value)=>bool}]; search: row=>string */
  ui.listView = ({ items, columns, search, filters = [], toolbar, onRowClick, pageSize = 10, searchPlaceholder = 'Cari…', rowClass, sortKey, sortDir, empty }) => {
    const state = { q: '', f: {} }; const getItems = () => (typeof items === 'function' ? items() : items);
    const tableHost = h('div'); const apply = () => { const q = state.q.toLowerCase(); return getItems().filter(r => (!q || !search || search(r).toLowerCase().includes(q)) && filters.every(f => !state.f[f.key] || (f.match ? f.match(r, state.f[f.key]) : String(r[f.key]) === state.f[f.key]))); };
    const draw = () => { BGS.clear(tableHost); tableHost.appendChild(ui.table({ columns, rows: apply(), onRowClick, pageSize, rowClass, sortKey, sortDir, empty })); };
    const bar = h('div', { class: 'toolbar' }, search && h('div', { class: 'search' }, BGS.icon('search', 16), h('input', { class: 'input', placeholder: searchPlaceholder, onInput: e => { state.q = e.target.value; draw(); } })),
      filters.map(f => h('select', { class: 'input sel', title: f.label, onChange: e => { state.f[f.key] = e.target.value; draw(); } }, h('option', { value: '' }, f.label + ': semua'), f.options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v }, l); }))), toolbar && h('div', { class: 'toolbar-r' }, toolbar));
    draw(); const el = h('div', null, bar, tableHost); el.redraw = draw; return el;
  };
  ui.timeline = items => h('ol', { class: 'timeline' }, items.map(i => h('li', { class: `tl-${i.tone || 'gray'}` }, h('div', { class: 'tl-dot' }), h('div', null, h('div', null, i.text), h('div', { class: 'muted sm' }, [i.by ? (D.user(i.by) ? D.user(i.by).name : i.by) + ' · ' : '', fmt.dateTime(i.at)])))));
  ui.stepper = (labels, current) => h('ol', { class: 'wizard' }, labels.map((l, i) => h('li', { class: i < current ? 'done' : i === current ? 'cur' : '' }, h('span', { class: 'wz-n' }, i < current ? BGS.icon('check', 14) : i + 1), h('span', null, l))));
  ui.chips = items => h('div', { class: 'row wrap gap-sm' }, items.map(i => h('span', { class: 'chip static' }, i)));

  // ---------- charts (inline SVG) ----------
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, a, ...k) => { const e = document.createElementNS(NS, tag); for (const [x, v] of Object.entries(a || {})) e.setAttribute(x, v); k.forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)); return e; };
  const PAL = ['#1D4ED8', '#C2410C', '#15803D', '#6D28D9', '#BE185D', '#0F766E', '#B45309', '#0369A1'];
  BGS.palette = PAL;
  ui.barChart = ({ data, height = 180, color, valueFmt = v => v, horizontal }) => {
    const max = Math.max(1, ...data.map(d => d.value));
    if (horizontal) return h('div', { class: 'hbars' }, data.map((d, i) => h('div', { class: 'hbar' }, h('div', { class: 'hbar-l' }, d.label), h('div', { class: 'hbar-t' }, h('div', { class: 'hbar-f', style: { width: (d.value / max) * 100 + '%', background: d.color || color || PAL[i % PAL.length] } })), h('div', { class: 'hbar-v' }, valueFmt(d.value)))));
    const W = 420, pad = 26, bw = (W - pad * 2) / data.length; const s = sv('svg', { viewBox: `0 0 ${W} ${height}`, class: 'chart', role: 'img' });
    data.forEach((d, i) => { const bh = ((height - 46) * d.value) / max; const x = pad + i * bw + bw * 0.15; s.appendChild(sv('rect', { x, y: height - 26 - bh, width: bw * 0.7, height: bh, rx: 4, fill: d.color || color || PAL[i % PAL.length] })); s.appendChild(sv('text', { x: x + bw * 0.35, y: height - 30 - bh, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#0F172A' }, String(valueFmt(d.value)))); s.appendChild(sv('text', { x: x + bw * 0.35, y: height - 9, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#475569' }, d.label)); });
    return s;
  };
  ui.donut = ({ data, size = 150, center, thickness = 22 }) => {
    const total = data.reduce((a, d) => a + d.value, 0) || 1; const r = size / 2 - thickness / 2, c = 2 * Math.PI * r; let off = 0;
    const s = sv('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'chart donut' });
    s.appendChild(sv('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: '#E2E8F0', 'stroke-width': thickness }));
    data.forEach((d, i) => { const len = (d.value / total) * c; s.appendChild(sv('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: d.color || PAL[i % PAL.length], 'stroke-width': thickness, 'stroke-dasharray': `${len} ${c - len}`, 'stroke-dashoffset': -off, transform: `rotate(-90 ${size / 2} ${size / 2})` })); off += len; });
    if (center) { s.appendChild(sv('text', { x: size / 2, y: size / 2 + 2, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 800, fill: '#0F172A' }, String(center.value))); s.appendChild(sv('text', { x: size / 2, y: size / 2 + 20, 'text-anchor': 'middle', 'font-size': 10.5, fill: '#475569' }, center.label)); }
    return h('div', { class: 'donut-wrap' }, s, h('ul', { class: 'legend' }, data.map((d, i) => h('li', null, h('i', { style: { background: d.color || PAL[i % PAL.length] } }), `${d.label} `, h('b', null, d.value)))));
  };
  ui.lineChart = ({ series, labels, height = 190 }) => {
    const W = 460, padL = 28, padB = 24, padT = 12; const max = Math.max(1, ...series.flatMap(s => s.points)); const n = labels.length;
    const X = i => padL + (i * (W - padL - 10)) / (n - 1), Y = v => padT + (height - padT - padB) * (1 - v / max);
    const s = sv('svg', { viewBox: `0 0 ${W} ${height}`, class: 'chart', role: 'img' });
    for (let g = 0; g <= 4; g++) { const y = padT + ((height - padT - padB) * g) / 4; s.appendChild(sv('line', { x1: padL, x2: W - 10, y1: y, y2: y, stroke: '#E2E8F0' })); s.appendChild(sv('text', { x: padL - 4, y: y + 3, 'text-anchor': 'end', 'font-size': 9.5, fill: '#64748B' }, String(Math.round(max * (1 - g / 4))))); }
    labels.forEach((l, i) => s.appendChild(sv('text', { x: X(i), y: height - 7, 'text-anchor': 'middle', 'font-size': 10, fill: '#475569' }, l)));
    series.forEach((se, si) => { const col = se.color || PAL[si]; s.appendChild(sv('polyline', { points: se.points.map((v, i) => `${X(i)},${Y(v)}`).join(' '), fill: 'none', stroke: col, 'stroke-width': 2.6, 'stroke-linejoin': 'round' })); se.points.forEach((v, i) => s.appendChild(sv('circle', { cx: X(i), cy: Y(v), r: 3.4, fill: '#fff', stroke: col, 'stroke-width': 2 }))); });
    return h('div', null, s, h('ul', { class: 'legend row' }, series.map((se, si) => h('li', null, h('i', { style: { background: se.color || PAL[si] } }), se.name))));
  };
  ui.funnel = stages => { const max = Math.max(1, stages[0].value); return h('div', { class: 'funnel' }, stages.map((s, i) => h('div', { class: 'fun-row' }, h('div', { class: 'fun-l' }, s.label), h('div', { class: 'fun-bar', style: { width: Math.max(8, (s.value / max) * 100) + '%', background: s.color || PAL[i % PAL.length] } }, s.value)))); };
  ui.quotaBar = pc => { const t = pc.total || 1; return h('div', { class: 'quota-bar', title: `Terpakai ${pc.utilized} · Dicadangkan ${pc.reserved} · Tersedia ${pc.available}` }, h('i', { class: 'q-u', style: { width: (pc.utilized / t) * 100 + '%' } }), h('i', { class: 'q-r', style: { width: (pc.reserved / t) * 100 + '%' } }), h('i', { class: 'q-a', style: { width: (pc.available / t) * 100 + '%' } })); };

  // ====================== router ======================
  const routes = [];
  BGS.router = {
    add(path, def) { const keys = []; const re = new RegExp('^' + path.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$'); routes.push({ path, re, keys, def }); },
    match(p) { for (const r of routes) { const m = r.re.exec(p); if (m) return { r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) }; } return null; },
  };
  BGS.nav = [];
  BGS.refresh = () => render();

  const forbidden = (el, why, title = 'Akses ditolak') => el.appendChild(ui.emptyState({ icon: 'lock', title, text: why, action: h('a', { class: 'btn btn-primary', href: '#/dashboard' }, 'Kembali ke Dashboard') }));
  function render() {
    const main = BGS.$('#main'); if (!main) return;
    const [pathStr, qs] = (location.hash.slice(1) || '/dashboard').split('?'); const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const m = BGS.router.match(pathStr); BGS.clear(main); main.scrollTop = 0; window.scrollTo(0, 0);
    drawNav(pathStr);
    if (!m) { forbidden(main, 'Halaman ini belum tersedia di prototipe.', 'Halaman tidak ditemukan'); return; }
    const def = m.r.def; document.title = `${def.title || 'BGS'} · BGS Workforce Management`;
    if (def.roles && !def.roles.includes(BGS.state.role)) { main.appendChild(ui.pageHeader({ title: def.title || '' })); forbidden(main, `Peran ${BGS.roles[BGS.state.role]} tidak memiliki izin untuk halaman ini (BR-027). Ganti peran lewat menu "Peran demo" di kanan atas.`); return; }
    if (def.mvp && def.mvp > BGS.state.mvp) { forbidden(main, `Modul ini baru tersedia di MVP ${def.mvp}. Ubah selektor Tahap di bar atas untuk melihatnya.`, 'Modul belum diaktifkan'); return; }
    const page = h('div', { class: 'page' }); main.appendChild(page);
    try { const out = def.render({ params: m.params, query, el: page, go: BGS.go, refresh: render }); if (out && out.nodeType) page.appendChild(out); } catch (e) { console.error(e); page.appendChild(ui.callout('danger', 'Terjadi kesalahan saat menampilkan halaman', String(e.message))); }
  }

  // ====================== shell (sidebar / topbar) ======================
  function drawNav(active) {
    const nav = BGS.$('#nav'); if (!nav) return; BGS.clear(nav);
    BGS.nav.forEach(sec => {
      const items = sec.items.filter(i => (!i.roles || i.roles.includes(BGS.state.role)) && (i.mvp || 1) <= BGS.state.mvp); if (!items.length) return;
      nav.appendChild(h('div', { class: 'nav-sec' }, sec.section));
      items.forEach(i => { const on = active === i.path || (i.match && i.match.test(active)) || (i.path !== '/dashboard' && active.startsWith(i.path + '/')); const b = i.badge ? i.badge() : 0; nav.appendChild(h('a', { class: 'nav-i' + (on ? ' on' : ''), href: '#' + i.path }, BGS.icon(i.icon, 18), h('span', null, i.label), (i.mvp || 1) > 1 && h('i', { class: `nav-mvp m${i.mvp}` }, i.mvp), b ? h('em', { class: 'nav-b' }, b) : null)); });
    });
  }
  function drawTop() {
    const top = BGS.$('#top'); if (!top) return; BGS.clear(top);
    const u = BGS.user(); const unread = BGS.myNotifications().filter(n => !n.read).length;
    const results = h('div', { class: 'gs-results', style: 'display:none' });
    const gs = h('input', { class: 'input', placeholder: 'Cari worker, lamaran, case, kode… (tekan /)', onInput: e => {
      const q = e.target.value.trim().toLowerCase(); BGS.clear(results); if (q.length < 2) { results.style.display = 'none'; return; }
      const hits = [...BGS.scope.workers().filter(w => (w.name + w.id + w.phone).toLowerCase().includes(q)).slice(0, 4).map(w => ['Worker', w.name + ' · ' + w.id, '/workers/' + w.id]), ...BGS.scope.cases().filter(c => (c.id + (D.worker(c.workerId) || {}).name).toLowerCase().includes(q)).slice(0, 3).map(c => ['Case', c.id + ' · ' + (D.worker(c.workerId) || {}).name, '/cases/' + c.id]), ...D.placementCodes.filter(p => p.id.toLowerCase().includes(q)).slice(0, 3).map(p => ['Kode', p.id, '/placement-codes/' + p.id])];
      results.style.display = 'block'; if (!hits.length) results.appendChild(h('div', { class: 'gs-i muted' }, 'Tidak ditemukan')); hits.forEach(([t, l, p]) => results.appendChild(h('a', { class: 'gs-i', href: '#' + p, onClick: () => { gs.value = ''; results.style.display = 'none'; } }, h('span', { class: 'badge b-gray' }, t), l)));
    } });
    document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); gs.focus(); } });
    top.append(
      h('button', { class: 'icon-btn menu-btn', 'aria-label': 'Menu', onClick: () => document.body.classList.toggle('nav-open') }, BGS.icon('menu', 20)),
      h('div', { class: 'gs' }, BGS.icon('search', 16), gs, results),
      h('div', { class: 'top-r' },
        h('label', { class: 'mvp-sel', title: 'Simulasikan tahap rilis produk' }, 'Tahap', h('select', { class: 'input sel', onChange: e => { BGS.state.mvp = +e.target.value; BGS.saveState(); drawTop(); render(); } }, [[1, 'MVP 1'], [2, 'MVP 1–2'], [3, 'MVP 1–3']].map(([v, l]) => h('option', { value: v, selected: BGS.state.mvp === v }, l)))),
        h('label', { class: 'role-sel', title: 'Ganti peran untuk melihat perbedaan hak akses' }, 'Peran demo', h('select', { class: 'input sel', onChange: e => { const r = e.target.value; BGS.state.role = r; BGS.state.userId = D.demoUserByRole[r]; BGS.saveState(); drawTop(); render(); ui.toast(`Berganti ke peran ${BGS.roles[r]} (${BGS.user().name})`, 'info'); } }, Object.entries(BGS.roles).map(([k, l]) => h('option', { value: k, selected: BGS.state.role === k }, l)))),
        BGS.state.mvp >= 2 ? h('a', { class: 'icon-btn bell', href: '#/notifications', title: 'Notifikasi' }, BGS.icon('bell', 20), unread ? h('i', { class: 'dot' }, unread) : null) : null,
        h('div', { class: 'me' }, ui.avatar(u.name, '#1D4ED8', 32), h('div', null, h('b', null, u.name), h('div', { class: 'muted sm' }, BGS.roles[BGS.state.role] + (u.picRole && BGS.isRole('pic') ? ' · ' + u.picRole : ''))), h('button', { class: 'icon-btn', title: 'Keluar', onClick: () => { BGS.state.loggedIn = false; BGS.saveState(); boot(); } }, BGS.icon('log-out', 18)))));
  }
  BGS.redrawTop = drawTop;

  // ====================== login ======================
  function login() {
    const root = BGS.$('#app'); BGS.clear(root); document.body.classList.add('is-login');
    let picked = 'admin';
    const card = h('div', { class: 'login-card' }); const draw = () => {
      BGS.clear(card);
      card.appendChild(h('div', { class: 'login-brand' }, h('div', { class: 'logo' }, 'BGS'), h('div', null, h('b', null, 'BGS Workforce Management'), h('div', { class: 'muted sm' }, 'PT Berkah Guna Selaras · Prototipe UI'))));
      card.appendChild(h('h2', null, 'Masuk ke sistem'));
      card.appendChild(h('p', { class: 'muted' }, 'Pilih akun demo untuk melihat tampilan tiap peran. Tidak perlu kata sandi sungguhan.'));
      card.appendChild(h('div', { class: 'role-grid' }, Object.entries(BGS.roles).map(([k, l]) => { const u = D.user(D.demoUserByRole[k]); return h('button', { class: 'role-card' + (picked === k ? ' on' : ''), onClick: () => { picked = k; draw(); } }, ui.avatar(u.name, '#1D4ED8', 36), h('div', { class: 'tl' }, h('b', null, l), h('div', { class: 'muted sm' }, u.name))); })));
      card.appendChild(h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Email'), h('input', { class: 'input', value: D.user(D.demoUserByRole[picked]).email, readonly: true })));
      card.appendChild(h('label', { class: 'field' }, h('span', { class: 'lbl' }, 'Kata sandi'), h('input', { class: 'input', type: 'password', value: 'demo-password', readonly: true })));
      card.appendChild(h('button', { class: 'btn btn-primary btn-block', onClick: done }, 'Masuk'));
      card.appendChild(h('div', { class: 'login-foot muted sm' }, 'Semua data di prototipe ini fiktif dan hanya tersimpan di memori browser.'));
    };
    const done = () => { BGS.state = Object.assign(BGS.state, { loggedIn: true, role: picked, userId: D.demoUserByRole[picked] }); BGS.saveState(); BGS.audit('Login berhasil', 'User', BGS.state.userId, ''); document.body.classList.remove('is-login'); if (!location.hash) location.hash = '#/dashboard'; boot(); };
    draw(); root.appendChild(h('div', { class: 'login' }, h('div', { class: 'login-hero' }, h('h1', null, 'One Worker.', h('br'), 'One Record.', h('br'), 'One Controlled Process.'), h('p', null, 'Sistem manajemen penempatan Pekerja Migran Indonesia untuk PT Berkah Guna Selaras.'), h('a', { class: 'btn btn-light', href: 'register.html', target: '_blank' }, 'Buka website registrasi publik →')), card));
  }

  // ====================== boot ======================
  function boot() {
    const root = BGS.$('#app'); BGS.clear(root);
    if (!BGS.state.loggedIn) { login(); return; }
    document.body.classList.remove('is-login');
    root.appendChild(h('div', { class: 'shell' }, h('aside', { class: 'side' }, h('a', { class: 'brand', href: '#/dashboard' }, h('div', { class: 'logo' }, 'BGS'), h('div', null, h('b', null, 'Workforce Mgmt'), h('div', { class: 'sm' }, 'PT Berkah Guna Selaras'))), h('nav', { id: 'nav' }), h('div', { class: 'side-foot' }, 'Prototipe UI · data fiktif')), h('div', { class: 'col' }, h('header', { id: 'top', class: 'top' }), h('main', { id: 'main', class: 'main' }))));
    drawTop(); render();
  }
  window.addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); if (BGS.state.loggedIn) render(); });
  BGS.boot = boot;
})();
