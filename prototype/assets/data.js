/* BGS Workforce Management System — prototype mock data (deterministic, in-memory).
   All people/IDs are fictional. "Today" is fixed so the demo always looks the same. */
(function () {
  const BGS = (window.BGS = window.BGS || {});
  BGS.today = new Date('2026-11-06T09:30:00+07:00');

  // ---------- seeded RNG ----------
  let seed = 20261106;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const pad = (n, l) => String(n).padStart(l, '0');
  const day = 86400000;
  const addDays = (d, n) => new Date(d.getTime() + n * day);
  const iso = d => d.toISOString();
  BGS.addDays = addDays;

  const D = (BGS.data = {});

  // ---------- master data ----------
  D.countries = [
    { code: 'SA', name: 'Arab Saudi' }, { code: 'AE', name: 'Uni Emirat Arab (Dubai)' },
    { code: 'JP', name: 'Jepang' }, { code: 'KR', name: 'Korea Selatan' }, { code: 'TW', name: 'Taiwan' },
  ];
  D.professions = [
    { code: 'DMW', name: 'Domestic Worker', sector: 'Informal' }, { code: 'CGV', name: 'Caregiver', sector: 'Formal' },
    { code: 'FAC', name: 'Operator Pabrik', sector: 'Formal' }, { code: 'DRV', name: 'Sopir Keluarga', sector: 'Informal' },
    { code: 'HSK', name: 'Housekeeping Hotel', sector: 'Formal' },
  ];
  D.routes = [
    { id: 'RT-P3MI', name: 'P3MI (swasta)', countries: ['SA', 'AE', 'JP', 'TW'] },
    { id: 'RT-G2G', name: 'Government-to-Government (G-to-G)', countries: ['KR', 'JP'] },
    { id: 'RT-MANDIRI', name: 'Mandiri (dengan pendampingan)', countries: ['TW'] },
  ];
  D.docTypes = [
    ['DT01', 'Pas foto', true, 0], ['DT02', 'KTP', true, 0], ['DT03', 'Kartu Keluarga (KK)', true, 0],
    ['DT04', 'Akta lahir', true, 0], ['DT05', 'Ijazah', true, 0], ['DT06', 'Buku nikah / akta cerai', false, 0],
    ['DT07', 'Surat izin keluarga / wali', true, 0], ['DT08', 'Paspor', true, 60], ['DT09', 'Sertifikat kompetensi', false, 0],
    ['DT10', 'Sertifikat bahasa', false, 0], ['DT11', 'Hasil MCU', true, 6], ['DT12', 'Hasil psikologi', false, 12],
    ['DT13', 'Kartu BPJS', true, 0], ['DT14', 'SKCK', true, 6], ['DT15', 'Perjanjian Penempatan', true, 0],
    ['DT16', 'Perjanjian Kerja', true, 0], ['DT17', 'Visa', true, 12], ['DT18', 'Tiket', true, 0],
  ].map(([id, name, required, validMonths]) => ({ id, name, required, validMonths }));
  D.cn = c => (D.countries.find(x => x.code === c) || {}).name || c;
  D.pn = c => (D.professions.find(x => x.code === c) || {}).name || c;

  // ---------- staff users (the 5 baseline roles; roles can be combined: A-04) ----------
  D.users = [
    { id: 'U01', name: 'Rina Wulandari', roles: ['superadmin'], email: 'rina@bgs.example', active: true, last: '2026-11-06T08:41' },
    { id: 'U02', name: 'Teguh Prasetyo', roles: ['superadmin'], email: 'teguh@bgs.example', active: true, last: '2026-11-05T16:20' },
    { id: 'U03', name: 'Muhamad Rizal', roles: ['director'], email: 'rizal@bgs.example', active: true, last: '2026-11-06T07:55' },
    { id: 'U04', name: 'Dewi Kartika', roles: ['admin'], email: 'dewi@bgs.example', active: true, last: '2026-11-06T08:30' },
    { id: 'U05', name: 'Sari Rahmawati', roles: ['admin'], email: 'sari@bgs.example', active: true, last: '2026-11-06T08:02' },
    { id: 'U06', name: 'Andi Firmansyah', roles: ['admin', 'pic'], email: 'andi@bgs.example', active: true, last: '2026-11-05T17:10' },
    { id: 'U07', name: 'Bagus Santoso', roles: ['pic'], picRole: 'PIC Dokumen', email: 'bagus@bgs.example', active: true, last: '2026-11-06T08:15' },
    { id: 'U08', name: 'Maya Anggraini', roles: ['pic'], picRole: 'PIC Medical', email: 'maya@bgs.example', active: true, last: '2026-11-06T08:50' },
    { id: 'U09', name: 'Joko Susilo', roles: ['pic'], picRole: 'PIC Visa', email: 'joko@bgs.example', active: true, last: '2026-11-05T15:45' },
    { id: 'U10', name: 'Lina Marlina', roles: ['pic'], picRole: 'PIC Keberangkatan', email: 'lina@bgs.example', active: true, last: '2026-11-06T07:40' },
    { id: 'U11', name: 'Fajar Nugroho', roles: ['pic'], picRole: 'PIC Dokumen', email: 'fajar@bgs.example', active: true, last: '2026-11-04T14:00' },
    { id: 'U12', name: 'Hendra Gunawan', roles: ['viewer'], email: 'hendra@bgs.example', active: true, last: '2026-11-03T10:30' },
    { id: 'U13', name: 'Eko Purnomo', roles: ['pic'], picRole: 'PIC Medical', email: 'eko@bgs.example', active: false, last: '2026-08-12T09:00' },
  ];
  D.user = id => D.users.find(u => u.id === id);
  D.demoUserByRole = { superadmin: 'U01', director: 'U03', admin: 'U04', pic: 'U07', viewer: 'U12' };
  D.picRoles = ['Case Owner', 'PIC Dokumen', 'PIC Medical', 'PIC Visa', 'PIC Keberangkatan'];
  D.picByStepRole = { docs: 'PIC Dokumen', medical: 'PIC Medical', visa: 'PIC Visa', departure: 'PIC Keberangkatan', owner: 'Case Owner' };

  // ---------- workers ----------
  const first = ['Siti', 'Nur', 'Dewi', 'Rina', 'Yuni', 'Lestari', 'Wati', 'Ani', 'Sri', 'Fitri', 'Maya', 'Indah', 'Tuti', 'Ratna', 'Eka', 'Aisyah', 'Budi', 'Agus', 'Slamet', 'Hendra', 'Joko', 'Eko', 'Rudi', 'Dedi', 'Yanto', 'Ahmad', 'Wahyu', 'Iwan', 'Teguh', 'Bambang'];
  const last = ['Handayani', 'Rahayu', 'Kusuma', 'Wijaya', 'Saputri', 'Hidayati', 'Permata', 'Lestari', 'Setiawan', 'Pratama', 'Nugraha', 'Santoso', 'Hartono', 'Susanti', 'Maulana', 'Firmansyah', 'Utami', 'Purnama', 'Ramadhani', 'Syahputra'];
  const regions = [['Indramayu', 'Jawa Barat', '32'], ['Cianjur', 'Jawa Barat', '32'], ['Cirebon', 'Jawa Barat', '32'], ['Brebes', 'Jawa Tengah', '33'], ['Cilacap', 'Jawa Tengah', '33'], ['Malang', 'Jawa Timur', '35'], ['Blitar', 'Jawa Timur', '35'], ['Lombok Timur', 'NTB', '52'], ['Lampung Tengah', 'Lampung', '18'], ['Karawang', 'Jawa Barat', '32'], ['Bekasi', 'Jawa Barat', '32'], ['Sukabumi', 'Jawa Barat', '32']];
  const sources = ['Walk-in', 'WhatsApp', 'Referensi', 'Website'];
  const tones = ['#1D4ED8', '#6D28D9', '#0F766E', '#C2410C', '#BE185D', '#15803D', '#B45309', '#0369A1'];
  const usedNames = new Set();
  const makeName = () => { for (;;) { const n = pick(first) + ' ' + pick(last); if (!usedNames.has(n)) { usedNames.add(n); return n; } } };
  const nikOf = (reg, female, dob) => reg + pad(int(1, 79), 2) + pad(int(1, 20), 2) + pad(dob.getUTCDate() + (female ? 40 : 0), 2) + pad(dob.getUTCMonth() + 1, 2) + pad(dob.getUTCFullYear() % 100, 2) + pad(int(1, 9999), 4);

  D.workers = [];
  for (let i = 1; i <= 42; i++) {
    const female = rnd() < 0.7;
    const [city, prov, pc] = pick(regions);
    const dob = new Date(Date.UTC(int(1986, 2003), int(0, 11), int(1, 28)));
    const created = addDays(BGS.today, -int(5, 300));
    const y = created.getUTCFullYear();
    D.workers.push({
      id: `BGS-W-${y}-${pad(i, 5)}`, name: makeName(), gender: female ? 'P' : 'L', dob: iso(dob).slice(0, 10), nik: nikOf(pc, female, dob),
      passport: rnd() < 0.75 ? 'C' + pad(int(1000000, 9999999), 7) : null, phone: '08' + pad(int(1000000000, 9999999999), 10).slice(0, 10),
      city, province: prov, address: `Dsn. ${pick(['Mekarjaya', 'Sukamaju', 'Karangsari', 'Sidomulyo', 'Cipta Karya'])} RT ${pad(int(1, 9), 2)}/${pad(int(1, 9), 2)}, ${city}`,
      education: pick(['SD', 'SMP', 'SMA/SMK', 'SMA/SMK', 'D3']), maritalStatus: pick(['Belum menikah', 'Menikah', 'Cerai']),
      source: pick(sources), createdAt: iso(created), color: pick(tones), status: 'ACTIVE', aliasOf: null, aliases: [],
      consent: { version: 'PN-2026.1', at: iso(created), channel: i % 4 === 0 ? 'Website' : 'Formulir bertanda tangan (Admin)' },
      recruiterId: pick(['U04', 'U05', 'U06']), tags: [],
    });
  }
  D.workers[0].name = 'Siti Nurhaliza'; D.workers[0].id = 'BGS-W-2026-00123'; D.workers[0].recruiterId = 'U04';
  usedNames.add('Siti Nurhaliza');
  D.worker = id => D.workers.find(w => w.id === id);

  // ---------- applications ----------
  const appCombos = [['SA', 'DMW', 'RT-P3MI'], ['SA', 'DMW', 'RT-P3MI'], ['AE', 'DMW', 'RT-P3MI'], ['JP', 'CGV', 'RT-P3MI'], ['TW', 'CGV', 'RT-P3MI'], ['KR', 'FAC', 'RT-G2G'], ['SA', 'DRV', 'RT-P3MI'], ['TW', 'HSK', 'RT-P3MI']];
  // distribution of statuses (first N are allocated -> become cases)
  const appStatuses = ['ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED', 'ALLOCATED',
    'SELECTED', 'SELECTED', 'SELECTED', 'WAITLISTED', 'WAITLISTED', 'WAITLISTED', 'ASSESSMENT', 'ASSESSMENT', 'INTERVIEW', 'INTERVIEW', 'INTERVIEW', 'SCREENING', 'SCREENING', 'SCREENING', 'SCREENING', 'REVISION_REQUIRED', 'REVISION_REQUIRED',
    'SUBMITTED', 'SUBMITTED', 'SUBMITTED', 'SUBMITTED', 'REJECTED', 'REJECTED', 'REJECTED', 'WITHDRAWN'];
  D.applications = [];
  const mkApp = (w, st, combo) => {
    const n = D.applications.length + 1;
    const created = addDays(new Date(w.createdAt), int(0, 5));
    const [c, p, r] = combo;
    const stIdx = ['SUBMITTED', 'SCREENING', 'REVISION_REQUIRED', 'INTERVIEW', 'ASSESSMENT', 'SELECTED', 'WAITLISTED', 'REJECTED', 'ALLOCATED', 'WITHDRAWN'].indexOf(st);
    const passedDoc = !['SUBMITTED', 'SCREENING', 'REVISION_REQUIRED'].includes(st) && st !== 'REJECTED' && st !== 'WITHDRAWN';
    const app = {
      id: `APP-${created.getUTCFullYear()}-${pad(n, 5)}`, workerId: w.id, country: c, profession: p, route: r, status: st, createdAt: iso(created),
      recruiterId: w.recruiterId, picId: pick(['U07', 'U11']), caseId: null,
      screening: {
        documents: { status: passedDoc || st === 'REJECTED' ? 'PASSED' : st === 'REVISION_REQUIRED' ? 'REVISION' : 'PENDING', note: st === 'REVISION_REQUIRED' ? 'Foto KTP buram, mohon unggah ulang.' : '' },
        interview: ['ASSESSMENT', 'SELECTED', 'WAITLISTED', 'ALLOCATED'].includes(st) ? { status: 'DONE', at: iso(addDays(created, 6)), by: 'U04', score: int(70, 95), note: 'Komunikasi baik, motivasi jelas.' } : st === 'INTERVIEW' ? { status: 'SCHEDULED', at: iso(addDays(BGS.today, int(1, 4))), by: 'U04' } : { status: 'PENDING' },
        assessment: ['SELECTED', 'WAITLISTED', 'ALLOCATED'].includes(st) ? { status: 'DONE', score: int(65, 98), threshold: 70, note: 'Praktik kerja sesuai standar.' } : { status: 'PENDING' },
      },
      decision: ['SELECTED', 'WAITLISTED', 'REJECTED', 'ALLOCATED'].includes(st) ? { result: st === 'ALLOCATED' ? 'SELECTED' : st, reason: st === 'REJECTED' ? pick(['Nilai assessment di bawah ambang', 'Dokumen tidak lengkap setelah dua kali revisi', 'Tidak lolos pemeriksaan kesehatan awal']) : st === 'WAITLISTED' ? 'Lolos, menunggu kuota Placement Code' : 'Memenuhi kriteria seleksi', by: 'U04', at: iso(addDays(created, 10)) } : null,
      history: [{ at: iso(created), by: w.recruiterId, text: 'Lamaran dibuat (SUBMITTED)' }],
    };
    if (stIdx > 0) app.history.push({ at: iso(addDays(created, 2)), by: w.recruiterId, text: `Status menjadi ${st}` });
    D.applications.push(app);
    return app;
  };
  appStatuses.forEach((st, i) => mkApp(D.workers[i], st, st === 'ALLOCATED' ? appCombos[i % 4 === 3 ? 3 : i % 3 === 0 ? 0 : i % 5 === 0 ? 4 : i % 2 ? 2 : 1] : pick(appCombos)));
  // Siti example: one worker with two applications
  const siti = D.workers[0];
  D.applications.find(a => a.workerId === D.workers[0].id).country = 'SA';
  mkApp(siti, 'WAITLISTED', ['TW', 'CGV', 'RT-P3MI']);
  // a few extra second applications for other workers
  [[14, 'SUBMITTED', ['JP', 'CGV', 'RT-P3MI']], [20, 'SCREENING', ['AE', 'DMW', 'RT-P3MI']], [25, 'REJECTED', ['TW', 'HSK', 'RT-P3MI']]].forEach(([wi, st, c]) => { if (D.workers[wi]) mkApp(D.workers[wi], st, c); });
  D.application = id => D.applications.find(a => a.id === id);

  // remaining unassigned workers get no application ("ACTIVE" w/o app => INACTIVE per RUL-027)

  // ---------- partners, job orders, placement codes, batches ----------
  D.partners = [
    { id: 'PT01', name: 'Al-Rajhi Manpower Services', country: 'SA', contact: 'Khalid Al-Harbi', email: 'khalid@alrajhi-mp.example', phone: '+966 11 000 1001', status: 'ACTIVE' },
    { id: 'PT02', name: 'Gulf Star Recruitment', country: 'AE', contact: 'Fatima Al-Mansoori', email: 'fatima@gulfstar.example', phone: '+971 4 000 2002', status: 'ACTIVE' },
    { id: 'PT03', name: 'Sakura Kaigo Kyokai', country: 'JP', contact: 'Tanaka Hiroshi', email: 'tanaka@sakura-kaigo.example', phone: '+81 3 0000 3003', status: 'ACTIVE' },
    { id: 'PT04', name: 'Formosa Care Agency', country: 'TW', contact: 'Chen Mei-Ling', email: 'meiling@formosacare.example', phone: '+886 2 0000 4004', status: 'ACTIVE' },
    { id: 'PT05', name: 'Hanbit Industrial Co.', country: 'KR', contact: 'Kim Min-jun', email: 'minjun@hanbit.example', phone: '+82 2 000 5005', status: 'ACTIVE' },
    { id: 'PT06', name: 'Najd Family Services', country: 'SA', contact: 'Omar Al-Qahtani', email: 'omar@najd.example', phone: '+966 12 000 6006', status: 'INACTIVE' },
  ];
  D.jobOrders = [
    { id: 'JO-2026-0001', partnerId: 'PT01', ref: 'SIP2MI/DL/0912/2026', country: 'SA', profession: 'DMW', route: 'RT-P3MI', requested: 40, receivedAt: '2026-08-14', status: 'ACTIVE', note: 'Permintaan tahap 1, pengiriman Des 2026' },
    { id: 'JO-2026-0002', partnerId: 'PT02', ref: 'GS-DL-2026-118', country: 'AE', profession: 'DMW', route: 'RT-P3MI', requested: 20, receivedAt: '2026-09-02', status: 'ACTIVE', note: '' },
    { id: 'JO-2026-0003', partnerId: 'PT03', ref: 'SKK-2026-044', country: 'JP', profession: 'CGV', route: 'RT-P3MI', requested: 15, receivedAt: '2026-09-20', status: 'ACTIVE', note: 'Perlu sertifikat bahasa N4' },
    { id: 'JO-2026-0004', partnerId: 'PT04', ref: 'FCA-2026-077', country: 'TW', profession: 'CGV', route: 'RT-P3MI', requested: 12, receivedAt: '2026-10-05', status: 'ACTIVE', note: '' },
    { id: 'JO-2026-0005', partnerId: 'PT05', ref: 'HIC-EPS-2026-02', country: 'KR', profession: 'FAC', route: 'RT-G2G', requested: 10, receivedAt: '2026-10-10', status: 'DRAFT', note: 'Jalur belum dikonfirmasi (OQ-02)' },
    { id: 'JO-2026-0006', partnerId: 'PT01', ref: 'SIP2MI/DL/1021/2026', country: 'SA', profession: 'DRV', route: 'RT-P3MI', requested: 8, receivedAt: '2026-10-21', status: 'ACTIVE', note: '' },
    { id: 'JO-2026-0007', partnerId: 'PT04', ref: 'FCA-2026-090', country: 'TW', profession: 'HSK', route: 'RT-P3MI', requested: 6, receivedAt: '2026-10-28', status: 'ACTIVE', note: '' },
    { id: 'JO-2026-0008', partnerId: 'PT06', ref: 'NFS-2026-011', country: 'SA', profession: 'DMW', route: 'RT-P3MI', requested: 10, receivedAt: '2026-06-12', status: 'CLOSED', note: 'Ditutup, partner nonaktif' },
  ];
  // total quota; reserved/utilized are computed after cases are generated, plus legacy counts (pre-system)
  D.placementCodes = [
    { id: 'SA-DMW-2612-01', jobOrderId: 'JO-2026-0001', country: 'SA', profession: 'DMW', route: 'RT-P3MI', status: 'OPEN', total: 20, legacyReserved: 2, legacyUtilized: 4, batchId: 'BT-2612-A' },
    { id: 'SA-DMW-2612-02', jobOrderId: 'JO-2026-0001', country: 'SA', profession: 'DMW', route: 'RT-P3MI', status: 'OPEN', total: 20, legacyReserved: 0, legacyUtilized: 0, batchId: 'BT-2612-B' },
    { id: 'AE-DMW-2701-01', jobOrderId: 'JO-2026-0002', country: 'AE', profession: 'DMW', route: 'RT-P3MI', status: 'OPEN', total: 20, legacyReserved: 3, legacyUtilized: 5, batchId: 'BT-2701-A' },
    { id: 'JP-CGV-2702-01', jobOrderId: 'JO-2026-0003', country: 'JP', profession: 'CGV', route: 'RT-P3MI', status: 'OPEN', total: 15, legacyReserved: 1, legacyUtilized: 2, batchId: 'BT-2702-A' },
    { id: 'TW-CGV-2612-01', jobOrderId: 'JO-2026-0004', country: 'TW', profession: 'CGV', route: 'RT-P3MI', status: 'FULL', total: 6, legacyReserved: 2, legacyUtilized: 4, batchId: 'BT-2612-C' },
    { id: 'TW-CGV-2701-01', jobOrderId: 'JO-2026-0004', country: 'TW', profession: 'CGV', route: 'RT-P3MI', status: 'OPEN', total: 6, legacyReserved: 0, legacyUtilized: 0, batchId: 'BT-2701-B' },
    { id: 'SA-DRV-2702-01', jobOrderId: 'JO-2026-0006', country: 'SA', profession: 'DRV', route: 'RT-P3MI', status: 'OPEN', total: 8, legacyReserved: 0, legacyUtilized: 0, batchId: null },
    { id: 'TW-HSK-2702-01', jobOrderId: 'JO-2026-0007', country: 'TW', profession: 'HSK', route: 'RT-P3MI', status: 'OPEN', total: 6, legacyReserved: 0, legacyUtilized: 0, batchId: null },
    { id: 'SA-DMW-2606-01', jobOrderId: 'JO-2026-0008', country: 'SA', profession: 'DMW', route: 'RT-P3MI', status: 'CLOSED', total: 10, legacyReserved: 0, legacyUtilized: 10, batchId: null },
  ];
  D.batches = [
    { id: 'BT-2612-A', name: 'Batch Saudi Des 2026 A', code: 'SA-DMW-2612-01', departDate: '2026-12-14', capacity: 20, status: 'OPEN' },
    { id: 'BT-2612-B', name: 'Batch Saudi Des 2026 B', code: 'SA-DMW-2612-02', departDate: '2026-12-28', capacity: 20, status: 'PLANNED' },
    { id: 'BT-2612-C', name: 'Batch Taiwan Des 2026', code: 'TW-CGV-2612-01', departDate: '2026-12-10', capacity: 6, status: 'OPEN' },
    { id: 'BT-2701-A', name: 'Batch Dubai Jan 2027', code: 'AE-DMW-2701-01', departDate: '2027-01-18', capacity: 20, status: 'PLANNED' },
    { id: 'BT-2701-B', name: 'Batch Taiwan Jan 2027', code: 'TW-CGV-2701-01', departDate: '2027-01-25', capacity: 6, status: 'PLANNED' },
    { id: 'BT-2702-A', name: 'Batch Jepang Feb 2027', code: 'JP-CGV-2702-01', departDate: '2027-02-15', capacity: 15, status: 'PLANNED' },
  ];
  D.placementCode = id => D.placementCodes.find(c => c.id === id);
  D.jobOrder = id => D.jobOrders.find(j => j.id === id);
  D.partner = id => D.partners.find(p => p.id === id);

  // ---------- workflow templates (Superadmin only, RUL-013) ----------
  const S = (id, name, role, dueDays, pred, o = {}) => Object.assign({ id, name, role, dueDays, pred, required: true, verification: 'NONE', external: false, consumesQuota: false }, o);
  const saSteps = [
    S('s1', 'Pendaftaran SISKO', 'docs', 3, [], { external: true, verification: 'VERIFY' }),
    S('s2', 'Penandatanganan Perjanjian Penempatan', 'owner', 3, ['s1'], { consumesQuota: true, verification: 'APPROVE' }),
    S('s3', 'Medical Check Up', 'medical', 7, ['s2'], { external: true, verification: 'VERIFY' }),
    S('s4', 'Biometrik', 'docs', 5, ['s3'], { external: true }),
    S('s5', 'Apostille dokumen', 'docs', 7, ['s2'], { external: true, verification: 'VERIFY' }),
    S('s6', 'ENJAZ', 'visa', 5, ['s4', 's5'], { external: true, verification: 'VERIFY' }),
    S('s7', 'BASMA', 'visa', 5, ['s6'], { external: true }),
    S('s8', 'Persiapan Visa', 'visa', 10, ['s7'], { external: true, verification: 'VERIFY' }),
    S('s9', 'OPP (Orientasi Pra Pemberangkatan)', 'departure', 3, ['s8'], { verification: 'VERIFY' }),
  ];
  const jpSteps = [
    S('s1', 'Pendaftaran SISKO', 'docs', 3, [], { external: true, verification: 'VERIFY' }),
    S('s2', 'Penandatanganan Perjanjian Penempatan', 'owner', 3, ['s1'], { consumesQuota: true, verification: 'APPROVE' }),
    S('s3', 'Pelatihan / sertifikasi bahasa', 'docs', 30, ['s2'], { required: false }),
    S('s4', 'Medical Check Up', 'medical', 7, ['s2'], { external: true, verification: 'VERIFY' }),
    S('s5', 'Apostille / legalisasi dokumen', 'docs', 10, ['s2'], { external: true, verification: 'VERIFY' }),
    S('s6', 'Persiapan Visa', 'visa', 14, ['s4', 's5'], { external: true, verification: 'VERIFY' }),
    S('s7', 'OPP (Orientasi Pra Pemberangkatan)', 'departure', 3, ['s6'], { verification: 'VERIFY' }),
  ];
  const twSteps = [
    S('s1', 'Pendaftaran SISKO', 'docs', 3, [], { external: true, verification: 'VERIFY' }),
    S('s2', 'Penandatanganan Perjanjian Penempatan', 'owner', 3, ['s1'], { consumesQuota: true, verification: 'APPROVE' }),
    S('s3', 'Medical Check Up', 'medical', 7, ['s2'], { external: true, verification: 'VERIFY' }),
    S('s4', 'Legalisasi dokumen', 'docs', 7, ['s2'], { external: true }),
    S('s5', 'Persiapan Visa', 'visa', 14, ['s3', 's4'], { external: true, verification: 'VERIFY' }),
    S('s6', 'OPP (Orientasi Pra Pemberangkatan)', 'departure', 3, ['s5'], { verification: 'VERIFY' }),
  ];
  const aeSteps = saSteps.filter(s => !['s6', 's7'].includes(s.id)).map(s => Object.assign({}, s, { pred: s.pred.map(p => (p === 's6' || p === 's7' ? 's5' : p)) }));
  aeSteps.find(s => s.id === 's8').pred = ['s4', 's5'];
  D.templates = [
    { id: 'WT-SA-DMW', name: 'Arab Saudi — Domestic Worker', country: 'SA', profession: 'DMW', route: null, jobOrderId: null, versions: [
      { v: 1, status: 'SUPERSEDED', publishedAt: '2026-03-10', publishedBy: 'U01', steps: saSteps.filter(s => s.id !== 's7').map(s => Object.assign({}, s, { pred: s.pred.map(p => (p === 's7' ? 's6' : p)) })) },
      { v: 2, status: 'PUBLISHED', publishedAt: '2026-07-01', publishedBy: 'U01', steps: saSteps },
      { v: 3, status: 'DRAFT', publishedAt: null, publishedBy: null, steps: saSteps.concat([S('s10', 'Pemeriksaan kesiapan keberangkatan', 'departure', 2, ['s9'], { verification: 'VERIFY' })]) },
    ] },
    { id: 'WT-AE-DMW', name: 'UEA — Domestic Worker', country: 'AE', profession: 'DMW', route: null, jobOrderId: null, versions: [{ v: 1, status: 'PUBLISHED', publishedAt: '2026-04-02', publishedBy: 'U01', steps: aeSteps }] },
    { id: 'WT-JP-CGV', name: 'Jepang — Caregiver', country: 'JP', profession: 'CGV', route: 'RT-P3MI', jobOrderId: null, versions: [{ v: 1, status: 'PUBLISHED', publishedAt: '2026-05-20', publishedBy: 'U02', steps: jpSteps }] },
    { id: 'WT-TW-CGV', name: 'Taiwan — Caregiver', country: 'TW', profession: 'CGV', route: null, jobOrderId: null, versions: [{ v: 1, status: 'PUBLISHED', publishedAt: '2026-05-25', publishedBy: 'U02', steps: twSteps }] },
    { id: 'WT-KR-FAC', name: 'Korea Selatan — Operator Pabrik (G-to-G)', country: 'KR', profession: 'FAC', route: 'RT-G2G', jobOrderId: null, versions: [{ v: 1, status: 'DRAFT', publishedAt: null, publishedBy: null, steps: twSteps.slice(0, 4) }] },
  ];
  D.template = id => D.templates.find(t => t.id === id);
  D.findTemplate = (country, profession, route, jobOrderId) => {
    const pub = t => t.versions.find(v => v.status === 'PUBLISHED');
    const m = D.templates.filter(t => t.country === country && t.profession === profession && pub(t));
    return m.find(t => t.jobOrderId && t.jobOrderId === jobOrderId) || m.find(t => t.route === route) || m.find(t => !t.route && !t.jobOrderId) || null;
  };

  // ---------- placement cases, step instances, tasks ----------
  D.cases = [];
  D.tasks = [];
  const caseStatuses = ['IN_PROCESS', 'IN_PROCESS', 'IN_PROCESS', 'IN_PROCESS', 'IN_PROCESS', 'DRAFT', 'DRAFT', 'FINAL_VERIFICATION', 'READY_TO_DEPART', 'DEPARTED', 'DEPARTED', 'ON_HOLD'];
  const taskStatuses = ['TODO', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'PENDING_VERIFICATION', 'PENDING_APPROVAL', 'REJECTED', 'BLOCKED', 'COMPLETED', 'CANCELLED'];
  D.taskStatuses = taskStatuses;
  const picForRole = { docs: ['U07', 'U11'], medical: ['U08'], visa: ['U09'], departure: ['U10'], owner: ['U04', 'U05'] };
  const codeFor = (c, p) => D.placementCodes.find(x => x.country === c && x.profession === p && x.status !== 'CLOSED' && x.status !== 'FULL') || D.placementCodes.find(x => x.country === c && x.profession === p);
  let taskN = 1;
  D.applications.filter(a => a.status === 'ALLOCATED').forEach((app, idx) => {
    const st = caseStatuses[idx % caseStatuses.length];
    const code = codeFor(app.country, app.profession);
    const tpl = D.findTemplate(app.country, app.profession, app.route, code && code.jobOrderId);
    if (!tpl) return;
    const ver = tpl.versions.find(v => v.status === 'PUBLISHED');
    const created = addDays(BGS.today, -int(20, 90));
    const n = D.cases.length + 1;
    const owner = pick(['U04', 'U05', 'U06']);
    const kase = {
      id: `PC-2026-${pad(n, 5)}`, applicationId: app.id, workerId: app.workerId, placementCodeId: code.id, jobOrderId: code.jobOrderId, batchId: code.batchId,
      templateId: tpl.id, templateVersion: ver.v, status: st, ownerId: owner, createdAt: iso(created), country: app.country, profession: app.profession,
      pics: { 'Case Owner': owner, 'PIC Dokumen': pick(picForRole.docs), 'PIC Medical': 'U08', 'PIC Visa': 'U09', 'PIC Keberangkatan': 'U10' },
      plannedDeparture: iso(addDays(BGS.today, int(15, 70))).slice(0, 10), blockers: [], steps: [], onHoldReason: st === 'ON_HOLD' ? 'Menunggu perpanjangan paspor worker' : null,
      flight: st === 'DEPARTED' || st === 'READY_TO_DEPART' ? { airline: 'Saudia', flightNo: 'SV' + int(800, 899), date: iso(addDays(BGS.today, st === 'DEPARTED' ? -int(3, 20) : int(5, 12))).slice(0, 10), ticketNo: 'TKT-' + int(100000, 999999) } : null,
      comments: [], checklist: [], documentsReady: st !== 'DRAFT',
    };
    app.caseId = kase.id;
    // how many steps are done
    const total = ver.steps.length;
    let done = st === 'DRAFT' ? 0 : st === 'IN_PROCESS' ? int(1, total - 2) : total;
    if (st === 'ON_HOLD') done = int(2, 4);
    const completed = new Set();
    ver.steps.forEach((s, si) => {
      const preds = s.pred.every(p => completed.has(p));
      let status = 'LOCKED';
      if (si < done && preds) { status = 'COMPLETED'; completed.add(s.id); } else if (st !== 'DRAFT' && preds) status = 'IN_PROGRESS';
      if (st === 'ON_HOLD' && status === 'IN_PROGRESS') status = 'IN_PROGRESS';
      const dueAt = iso(addDays(created, 4 + s.dueDays * (si + 1) * 0.6));
      const inst = { stepId: s.id, name: s.name, status, dueAt, completedAt: status === 'COMPLETED' ? iso(addDays(created, 3 + si * 4)) : null, refNumber: status === 'COMPLETED' && s.external ? `${s.name.split(' ')[0].toUpperCase().slice(0, 5)}-${int(100000, 999999)}` : null, skippedReason: null };
      kase.steps.push(inst);
      // task per step instance
      const roleName = D.picByStepRole[s.role];
      const assignee = s.role === 'owner' ? owner : kase.pics[roleName];
      let ts = status === 'COMPLETED' ? 'COMPLETED' : status === 'LOCKED' ? 'TODO' : 'IN_PROGRESS';
      if (status === 'IN_PROGRESS') ts = pick(['IN_PROGRESS', 'IN_PROGRESS', 'WAITING_EVIDENCE', 'PENDING_VERIFICATION', 'TODO']);
      if (status === 'IN_PROGRESS' && s.verification === 'APPROVE') ts = 'PENDING_APPROVAL';
      D.tasks.push({
        id: `TSK-${pad(taskN++, 5)}`, caseId: kase.id, stepId: s.id, title: s.name, assigneeId: assignee, status: ts, dueAt, executorId: assignee,
        verifierId: s.verification !== 'NONE' ? (assignee === 'U04' ? 'U05' : 'U04') : null, approverId: s.verification === 'APPROVE' ? 'U03' : null,
        evidence: status === 'COMPLETED' && s.external ? [{ name: `bukti-${s.id}-${kase.id}.pdf`, at: inst.completedAt, by: assignee }] : [], comments: [], blockedReason: null, external: s.external, role: s.role,
      });
    });
    // inject an overdue + a blocked example
    if (st === 'IN_PROCESS') {
      const ip = kase.steps.find(x => x.status === 'IN_PROGRESS');
      if (ip && idx % 2 === 0) { ip.dueAt = iso(addDays(BGS.today, -int(1, 6))); }
      if (ip && idx === 3) { const t = D.tasks.find(t => t.caseId === kase.id && t.stepId === ip.stepId); t.status = 'BLOCKED'; t.blockedReason = 'Menunggu jadwal slot dari klinik MCU'; kase.blockers.push({ stepId: ip.stepId, category: 'Pihak eksternal', reason: t.blockedReason, at: iso(addDays(BGS.today, -2)), by: t.assigneeId }); }
    }
    D.cases.push(kase);
  });
  D.case = id => D.cases.find(c => c.id === id);
  D.task = id => D.tasks.find(t => t.id === id);

  // ---------- quota computation (RUL-004..007) ----------
  BGS.computeQuota = () => {
    D.placementCodes.forEach(pc => { pc.reserved = pc.legacyReserved; pc.utilized = pc.legacyUtilized; });
    D.cases.forEach(c => {
      const pc = D.placementCode(c.placementCodeId); if (!pc || c.status === 'CANCELLED') return;
      const tpl = D.template(c.templateId); const ver = tpl.versions.find(v => v.number === c.templateVersion || v.v === c.templateVersion);
      const qStep = ver.steps.find(s => s.consumesQuota);
      const utilized = c.status === 'DEPARTED' || c.status === 'READY_TO_DEPART' || c.status === 'FINAL_VERIFICATION' || (qStep && c.steps.find(x => x.stepId === qStep.id && x.status === 'COMPLETED'));
      if (utilized) pc.utilized++; else pc.reserved++;
    });
    D.placementCodes.forEach(pc => { pc.available = pc.total - pc.reserved - pc.utilized; });
  };
  BGS.computeQuota();
  // keep TW-CGV-2612-01 FULL (Siti example)
  const twfull = D.placementCode('TW-CGV-2612-01'); twfull.legacyReserved += Math.max(0, twfull.available); BGS.computeQuota();

  // ---------- compliance checklist snapshot per case (RUL-025) ----------
  D.requirements = [
    { id: 'RQ01', name: 'Paspor berlaku minimal 18 bulan saat keberangkatan', scope: { country: 'SA' }, type: 'DOKUMEN', source: 'Pemerintah', mandatory: true, ref: 'REF-02', version: 1, effective: '2026-03-05', legal: 'PERLU_VERIFIKASI', status: 'DRAFT' },
    { id: 'RQ02', name: 'Hasil MCU dari klinik terdaftar masih berlaku', scope: { country: '*' }, type: 'DOKUMEN', source: 'Pemerintah', mandatory: true, ref: 'REF-02', version: 2, effective: '2026-03-05', legal: 'PERLU_VERIFIKASI', status: 'DRAFT' },
    { id: 'RQ03', name: 'Nomor referensi SISKO tercatat beserta file bukti', scope: { country: '*' }, type: 'PROSES', source: 'Pemerintah', mandatory: true, ref: 'REF-02', version: 1, effective: '2026-03-05', legal: 'PERLU_VERIFIKASI', status: 'DRAFT' },
    { id: 'RQ04', name: 'Perjanjian Penempatan ditandatangani (scan tersimpan)', scope: { country: '*' }, type: 'DOKUMEN', source: 'Pemerintah', mandatory: true, ref: 'REF-02', version: 1, effective: '2026-03-05', legal: 'PERLU_VERIFIKASI', status: 'DRAFT' },
    { id: 'RQ05', name: 'Surat izin keluarga / wali untuk worker menikah', scope: { country: '*' }, type: 'DOKUMEN', source: 'Internal', mandatory: true, ref: null, version: 1, effective: '2026-01-01', legal: 'INTERNAL', status: 'ACTIVE' },
    { id: 'RQ06', name: 'Sertifikat bahasa minimal N4 (Jepang)', scope: { country: 'JP', profession: 'CGV' }, type: 'DOKUMEN', source: 'Internal', mandatory: true, ref: null, version: 1, effective: '2026-05-20', legal: 'INTERNAL', status: 'ACTIVE' },
    { id: 'RQ07', name: 'Usia pelamar sesuai batas negara tujuan', scope: { country: '*' }, type: 'ELIGIBILITAS', source: 'Pemerintah', mandatory: true, ref: 'REF-01', version: 1, effective: '2026-01-01', legal: 'PERLU_VERIFIKASI', status: 'DRAFT' },
    { id: 'RQ08', name: 'Consent data pribadi berversi tercatat', scope: { country: '*' }, type: 'PERLINDUNGAN DATA', source: 'Pemerintah', mandatory: true, ref: 'REF-03', version: 1, effective: '2026-01-01', legal: 'PERLU_VERIFIKASI', status: 'ACTIVE' },
    { id: 'RQ09', name: 'Laporan keberangkatan siap diekspor', scope: { country: '*' }, type: 'LAPORAN', source: 'Pemerintah', mandatory: false, ref: 'REF-02', version: 1, effective: '2026-03-05', legal: 'PERLU_VERIFIKASI', status: 'DRAFT' },
    { id: 'RQ10', name: 'Pemeriksaan psikologi untuk Caregiver', scope: { country: '*', profession: 'CGV' }, type: 'DOKUMEN', source: 'Internal', mandatory: false, ref: null, version: 1, effective: '2026-01-01', legal: 'INTERNAL', status: 'ACTIVE' },
  ];
  D.regRefs = [
    { id: 'REF-01', title: 'UU No. 18 Tahun 2017 tentang Pelindungan Pekerja Migran Indonesia (dan perubahannya, termasuk UU 6/2023 — perlu verifikasi)', type: 'Undang-undang', link: '', legal: 'PERLU_VERIFIKASI' },
    { id: 'REF-02', title: 'Peraturan Menteri P2MI / Kepala BP2MI No. 2 Tahun 2026 tentang Tata Cara Penempatan PMI oleh Pelaksana Penempatan', type: 'Peraturan Menteri', link: 'https://jdih.bp2mi.go.id/index.php/Content/produk/8/889000740', legal: 'PERLU_VERIFIKASI' },
    { id: 'REF-03', title: 'UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (PDP)', type: 'Undang-undang', link: '', legal: 'PERLU_VERIFIKASI' },
    { id: 'REF-04', title: 'PP No. 59 Tahun 2021 tentang Pelindungan Pekerja Migran Indonesia', type: 'Peraturan Pemerintah', link: '', legal: 'PERLU_VERIFIKASI' },
  ];
  D.cases.forEach(c => {
    D.requirements.filter(r => (r.scope.country === '*' || r.scope.country === c.country) && (!r.scope.profession || r.scope.profession === c.profession)).forEach(r => {
      const doneCase = ['READY_TO_DEPART', 'DEPARTED', 'FINAL_VERIFICATION'].includes(c.status);
      c.checklist.push({ ruleId: r.id, label: r.name, mandatory: r.mandatory, source: r.source, ruleVersion: r.version, status: doneCase || rnd() < 0.4 ? 'MET' : 'NOT_MET', checkedBy: null });
    });
  });

  // ---------- documents ----------
  D.documents = [];
  let docN = 1;
  const docStates = ['VERIFIED', 'VERIFIED', 'VERIFIED', 'UPLOADED', 'REJECTED'];
  D.workers.forEach((w, wi) => {
    const hasApp = D.applications.some(a => a.workerId === w.id);
    if (!hasApp) return;
    D.docTypes.slice(0, 8).forEach(dt => {
      if (rnd() < 0.15) return;
      const uploaded = addDays(new Date(w.createdAt), int(1, 12));
      let status = pick(docStates);
      let expiresAt = null;
      if (dt.id === 'DT08') expiresAt = iso(addDays(BGS.today, pick([-20, 45, 120, 300, 700, 900, 1200]))).slice(0, 10);
      if (dt.id === 'DT08' && new Date(expiresAt) < BGS.today) status = 'EXPIRED';
      D.documents.push({ id: `DOC-${pad(docN++, 5)}`, ownerType: 'worker', ownerId: w.id, typeId: dt.id, filename: `${dt.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${w.id.slice(-5)}.${dt.id === 'DT01' ? 'jpg' : 'pdf'}`, version: 1, status, uploadedBy: pick(['U04', 'U05', 'U07', 'U11']), uploadedAt: iso(uploaded), verifiedBy: status === 'VERIFIED' ? pick(['U05', 'U04', 'U07']) : null, verifiedAt: status === 'VERIFIED' ? iso(addDays(uploaded, 1)) : null, rejectReason: status === 'REJECTED' ? 'Gambar buram / terpotong' : null, expiresAt, sizeKb: int(120, 2400) });
    });
    if (wi % 5 === 0) { // a superseded old version
      D.documents.push({ id: `DOC-${pad(docN++, 5)}`, ownerType: 'worker', ownerId: w.id, typeId: 'DT02', filename: `ktp-lama-${w.id.slice(-5)}.pdf`, version: 1, status: 'SUPERSEDED', uploadedBy: 'U05', uploadedAt: w.createdAt, verifiedBy: 'U05', verifiedAt: w.createdAt, rejectReason: null, expiresAt: null, sizeKb: 800 });
    }
  });
  D.cases.forEach(c => {
    if (c.status === 'DRAFT') return;
    ['DT11', 'DT15', 'DT14'].forEach(t => D.documents.push({ id: `DOC-${pad(docN++, 5)}`, ownerType: 'case', ownerId: c.id, typeId: t, filename: `${t.toLowerCase()}-${c.id}.pdf`, version: 1, status: pick(['VERIFIED', 'VERIFIED', 'UPLOADED']), uploadedBy: 'U07', uploadedAt: iso(addDays(BGS.today, -int(2, 40))), verifiedBy: 'U04', verifiedAt: iso(addDays(BGS.today, -int(1, 20))), rejectReason: null, expiresAt: t === 'DT11' ? iso(addDays(BGS.today, int(30, 150))).slice(0, 10) : null, sizeKb: int(200, 900) }));
  });
  D.docType = id => D.docTypes.find(d => d.id === id);

  // ---------- registrations inbox (public website, RUL-003) ----------
  const reg = (n, name, nik, phone, c, p, daysAgo, st, extra) => Object.assign({
    id: `REG-${iso(addDays(BGS.today, -daysAgo)).slice(2, 10).replace(/-/g, '')}-${pad(n, 4)}`, name, nik, phone, country: c, profession: p, gender: 'P', dob: '1996-03-14', city: pick(regions)[0], education: 'SMA/SMK',
    submittedAt: iso(addDays(BGS.today, -daysAgo)), status: st, consent: { version: 'PN-2026.1', at: iso(addDays(BGS.today, -daysAgo)), channel: 'Website' }, reviewedBy: null, reason: null, resultWorkerId: null, dupOf: null, userAgent: 'Mobile',
  }, extra || {});
  const dupW1 = D.workers[3], dupW2 = D.workers[9];
  D.registrations = [
    reg(1, 'Ayu Lestari', '3209016403960003', '081234560001', 'SA', 'DMW', 0, 'NEW'),
    reg(2, 'Nuraini Putri', '3301024509940002', '081234560002', 'TW', 'CGV', 0, 'NEW'),
    reg(3, dupW1.name, dupW1.nik, '081234560003', 'AE', 'DMW', 1, 'NEW', { dupOf: dupW1.id }),
    reg(4, 'Sri Wahyuni', '3578015508000004', '081234560004', 'JP', 'CGV', 1, 'NEW'),
    reg(5, dupW2.name.replace(/[aeiou]$/, 'a'), dupW2.nik, '081234560005', 'SA', 'DMW', 2, 'NEW', { dupOf: dupW2.id }),
    reg(6, 'Eni Marlina', '3201026007970006', '081234560006', 'SA', 'DRV', 2, 'NEW'),
    reg(7, 'Karmila Sari', '3275016709920007', '081234560007', 'TW', 'HSK', 3, 'NEW'),
    reg(8, 'Rohmah Fadilah', '3204014811980008', '081234560008', 'SA', 'DMW', 4, 'NEW'),
    reg(9, 'Maryati', '3301015512910009', '081234560009', 'AE', 'DMW', 6, 'ACCEPTED', { reviewedBy: 'U04', resultWorkerId: D.workers[12].id }),
    reg(10, 'Winarti', '3310014407950010', '081234560010', 'SA', 'DMW', 7, 'ACCEPTED', { reviewedBy: 'U05', resultWorkerId: D.workers[13].id }),
    reg(11, 'Dian Pertiwi', '3174015002990011', '081234560011', 'JP', 'CGV', 9, 'MERGED', { reviewedBy: 'U04', resultWorkerId: D.workers[5].id }),
    reg(12, 'Asep Suryana', '3204012302930012', '081234560012', 'SA', 'DRV', 10, 'DISCARDED', { reviewedBy: 'U05', reason: 'Data tidak valid (nomor telepon tidak aktif)' }),
    reg(13, 'Test Test', '1111111111111111', '0800000000', 'SA', 'DMW', 11, 'DISCARDED', { reviewedBy: 'U04', reason: 'Spam / data uji' }),
  ];
  // public website submissions (register.html) land in localStorage
  try { (JSON.parse(localStorage.getItem('bgs.publicRegistrations') || '[]')).forEach(r => D.registrations.unshift(r)); } catch (e) { /* ignore */ }
  D.registration = id => D.registrations.find(r => r.id === id);

  // ---------- approvals (Director), notifications, audit ----------
  D.approvals = [
    { id: 'AP-001', type: 'MIGRASI_WORKFLOW', title: 'Migrasi 4 case berjalan SA-DMW dari v1 ke v2', subject: 'WT-SA-DMW', requestedBy: 'U01', at: iso(addDays(BGS.today, -1)), reason: 'Menambah langkah BASMA sesuai prosedur terbaru', status: 'PENDING', expires: iso(addDays(BGS.today, 2)) },
    { id: 'AP-002', type: 'UBAH_TOTAL_KUOTA', title: 'Tambah Total Kuota SA-DMW-2612-01: 20 → 25', subject: 'SA-DMW-2612-01', requestedBy: 'U04', at: iso(addDays(BGS.today, -2)), reason: 'Partner menambah permintaan 5 orang (surat tambahan terlampir)', status: 'PENDING', expires: iso(addDays(BGS.today, 1)) },
    { id: 'AP-003', type: 'REVERT_KUOTA', title: 'Revert kuota TERPAKAI pada PC-2026-00007', subject: 'PC-2026-00007', requestedBy: 'U05', at: iso(addDays(BGS.today, -3)), reason: 'Worker mundur setelah perjanjian ditandatangani', status: 'PENDING', expires: iso(addDays(BGS.today, 3)) },
    { id: 'AP-004', type: 'GABUNG_WORKER', title: 'Gabung duplikat BGS-W-2026-00004 ← REG-261105-0003', subject: 'BGS-W-2026-00004', requestedBy: 'U04', at: iso(addDays(BGS.today, -5)), reason: 'NIK sama, nama sedikit berbeda', status: 'APPROVED', decidedBy: 'U03', decidedAt: iso(addDays(BGS.today, -4)) },
    { id: 'AP-005', type: 'MIGRASI_WORKFLOW', title: 'Migrasi 2 case TW-CGV ke v1.1', subject: 'WT-TW-CGV', requestedBy: 'U02', at: iso(addDays(BGS.today, -8)), reason: 'Perbaikan urutan', status: 'REJECTED', decidedBy: 'U03', decidedAt: iso(addDays(BGS.today, -7)), decisionReason: 'Tunggu verifikasi hukum OQ-04' },
  ];
  D.notifications = [
    { id: 'N01', to: 'U07', type: 'TASK_ASSIGNED', text: 'Tugas baru: Pendaftaran SISKO untuk PC-2026-00006', at: iso(addDays(BGS.today, 0)), read: false, link: '#/cases/PC-2026-00006' },
    { id: 'N02', to: 'U04', type: 'VERIFY_REQUEST', text: '3 tugas menunggu verifikasi Anda', at: iso(addDays(BGS.today, 0)), read: false, link: '#/tasks' },
    { id: 'N03', to: 'U03', type: 'APPROVAL', text: 'Permintaan persetujuan: Migrasi workflow SA-DMW', at: iso(addDays(BGS.today, -1)), read: false, link: '#/approvals' },
    { id: 'N04', to: 'U04', type: 'OVERDUE', text: 'Tugas "Biometrik" PC-2026-00003 terlambat 3 hari', at: iso(addDays(BGS.today, -1)), read: true, link: '#/monitor' },
    { id: 'N05', to: 'U04', type: 'DOC_EXPIRY', text: 'Paspor 2 worker akan kedaluwarsa dalam 60 hari', at: iso(addDays(BGS.today, -2)), read: true, link: '#/documents' },
    { id: 'N06', to: 'U03', type: 'QUOTA', text: 'Kuota TW-CGV-2612-01 habis (Tersedia 0)', at: iso(addDays(BGS.today, -2)), read: false, link: '#/placement-codes/TW-CGV-2612-01' },
    { id: 'N07', to: 'U01', type: 'RULE_CHANGE', text: 'Rujukan regulasi REF-02 menunggu verifikasi hukum', at: iso(addDays(BGS.today, -3)), read: true, link: '#/compliance/library' },
  ];
  D.audit = [];
  const actions = [['Status lamaran berubah', 'Application'], ['Dokumen diverifikasi', 'Document'], ['Dokumen dibuka', 'Document'], ['Kuota dicadangkan', 'Placement Code'], ['PIC ditugaskan', 'Placement Case'], ['Template dipublikasikan', 'Workflow Template'], ['Data worker diubah', 'Worker'], ['Registrasi diterima', 'Registration'], ['Task selesai', 'Task'], ['Login berhasil', 'User']];
  for (let i = 0; i < 60; i++) {
    const [a, e] = actions[i % actions.length]; const u = pick(D.users.filter(x => x.active));
    D.audit.push({ id: 'AU-' + pad(i + 1, 5), at: iso(addDays(BGS.today, -i * 0.35)), userId: u.id, action: a, entityType: e, entityId: e === 'Worker' ? pick(D.workers).id : e === 'Placement Case' ? pick(D.cases).id : e === 'Document' ? 'DOC-' + pad(int(1, 120), 5) : e === 'Placement Code' ? pick(D.placementCodes).id : '—', detail: '', ip: '10.0.0.' + int(10, 80) });
  }
  D.audit.sort((a, b) => b.at.localeCompare(a.at));
  D.subjectRequests = [
    { id: 'SR-001', type: 'AKSES', subject: D.workers[7].id, requester: D.workers[7].name, at: iso(addDays(BGS.today, -6)), due: iso(addDays(BGS.today, 8)), status: 'DIPROSES', note: 'Meminta salinan data pribadi' },
    { id: 'SR-002', type: 'KOREKSI', subject: D.workers[11].id, requester: D.workers[11].name, at: iso(addDays(BGS.today, -12)), due: iso(addDays(BGS.today, 2)), status: 'DIPROSES', note: 'Koreksi ejaan nama di KK' },
    { id: 'SR-003', type: 'PENGHAPUSAN', subject: D.workers[30].id, requester: D.workers[30].name, at: iso(addDays(BGS.today, -30)), due: iso(addDays(BGS.today, -2)), status: 'SELESAI', note: 'Diarsipkan (soft delete); hard delete menunggu kebijakan retensi (OQ-15)' },
  ];
  D.consentVersions = [
    { version: 'PN-2026.1', publishedAt: '2026-01-05', current: true, note: 'Pemberitahuan privasi v2026.1 (menunggu verifikasi hukum)', accepted: 31 },
    { version: 'PN-2025.2', publishedAt: '2025-06-01', current: false, note: 'Versi sebelumnya', accepted: 11 },
  ];
  D.settings = { quotaReservationDays: 14, sodEnabled: true, uploaderCannotVerify: true, expiryWarningDays: 60, directorApprovesFinal: false, workerIdFormat: 'BGS-W-{YYYY}-{NNNNN}', passportMinMonths: 18 };

  // ---------- derived worker status (RUL-027) ----------
  BGS.deriveWorkerStatus = () => D.workers.forEach(w => {
    const apps = D.applications.filter(a => a.workerId === w.id);
    const active = apps.filter(a => !['REJECTED', 'WITHDRAWN', 'CANCELLED'].includes(a.status));
    const cases = D.cases.filter(c => c.workerId === w.id);
    if (w.status === 'ARCHIVED') return;
    if (cases.some(c => ['DRAFT', 'IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART', 'ON_HOLD'].includes(c.status))) w.status = 'IN_PROCESS';
    else if (cases.length && cases.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].status === 'DEPARTED') w.status = 'DEPLOYED';
    else if (active.length) w.status = 'ACTIVE';
    else w.status = 'INACTIVE';
  });
  BGS.deriveWorkerStatus();
  D.workers.find(w => w.id === 'BGS-W-2026-00123').tags = ['Contoh 1 worker 2 lamaran'];
})();
