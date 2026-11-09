/* BGS prototype — M10 Pengguna & Akses, persetujuan, perlindungan data (PDP), pengaturan, asisten AI, integrasi.
   Routes: /users /roles /audit /approvals /data-protection /settings /ai /integrations */
(function () {
  const BGS = window.BGS, D = BGS.data, h = BGS.h, ui = BGS.ui, fmt = BGS.fmt;
  const SA = 'superadmin', DI = 'director', AD = 'admin', PI = 'pic', VI = 'viewer';
  const ROLE_KEYS = [SA, DI, AD, PI, VI];
  const pad = (n, l) => String(n).padStart(l, '0');
  const nowIso = () => new Date().toISOString();
  const DAY = 86400000;
  const PERM_DEFAULT = JSON.parse(JSON.stringify(BGS.perms));

  // ---------------------------------------------------------------- shared helpers
  BGS.addStyle(`
  .adm-matrix{border-collapse:separate;border-spacing:0;width:100%;font-size:13.5px}
  .adm-matrix th,.adm-matrix td{padding:9px 12px;border-bottom:1px solid var(--line)}
  .adm-matrix thead th{background:#F8FAFC;text-align:center;font-size:12px;vertical-align:bottom}
  .adm-matrix thead th:first-child{text-align:left}
  .adm-matrix td.c{text-align:center}
  .adm-matrix tr.grp td{background:#F1F5F9;font-weight:800;font-size:11.5px;text-transform:uppercase;letter-spacing:.5px;color:#475569}
  .adm-matrix .adm-mine{background:#FFFBEB}
  .adm-yes{color:var(--green)} .adm-no{color:#CBD5E1}
  .adm-switch{position:relative;display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:600}
  .adm-switch input{position:absolute;opacity:0;width:0;height:0}
  .adm-sw-t{width:38px;height:22px;border-radius:20px;background:#CBD5E1;position:relative;transition:.15s;flex:none}
  .adm-sw-t:after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s}
  .adm-switch input:checked+.adm-sw-t{background:var(--green)} .adm-switch input:checked+.adm-sw-t:after{left:19px}
  .adm-switch input:focus-visible+.adm-sw-t{outline:2px solid var(--blue)}
  .adm-switch.dis{opacity:.5;cursor:not-allowed}
  .adm-ap{border:1px solid var(--line);border-left:5px solid var(--amber);border-radius:12px;background:#fff;padding:14px 16px;display:grid;grid-template-columns:1fr auto;gap:14px;box-shadow:var(--shadow)}
  .adm-ap.urgent{border-left-color:var(--red)} .adm-ap.done{border-left-color:var(--line2)}
  .adm-ap-act{display:flex;flex-direction:column;gap:8px;min-width:150px;justify-content:center}
  @media(max-width:760px){.adm-ap{grid-template-columns:1fr}.adm-ap-act{flex-direction:row;flex-wrap:wrap}}
  .adm-quote{border-left:3px solid var(--line2);padding:3px 10px;color:#334155;background:#F8FAFC;border-radius:0 8px 8px 0;margin:6px 0}
  .adm-impact{background:#EFF6FF;border:1px solid #BFDBFE;border-radius:9px;padding:8px 12px;margin-top:8px;font-size:13px}
  .adm-impact.bad{background:#FEF2F2;border-color:#FCA5A5}
  .adm-impact ul{margin:4px 0 0;padding-left:18px}
  .adm-chat{display:flex;flex-direction:column;height:560px;border:1px solid var(--line);border-radius:12px;background:#fff;overflow:hidden}
  .adm-chat-log{flex:1;overflow:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background:#F8FAFC}
  .adm-msg{max-width:90%;padding:10px 14px;border-radius:14px;line-height:1.45}
  .adm-msg.u{align-self:flex-end;background:var(--blue);color:#fff;border-bottom-right-radius:4px}
  .adm-msg.a{align-self:flex-start;background:#fff;border:1px solid var(--line2);border-bottom-left-radius:4px}
  .adm-chat-in{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line);background:#fff}
  .adm-rl{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
  .adm-rl li{padding:7px 10px;border:1px solid var(--line);border-radius:9px;background:#F8FAFC;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
  .adm-basis{font-size:11.5px;color:var(--muted);margin-top:8px;border-top:1px dashed var(--line2);padding-top:6px}
  .adm-conf{display:flex;align-items:center;gap:8px;min-width:130px} .adm-conf .progress{width:80px}
  .adm-field-row{display:grid;grid-template-columns:150px 1fr 150px auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}
  .adm-field-row:last-child{border-bottom:0}
  .adm-field-row.acc{background:#F0FDF4} .adm-field-row.rej{background:#F8FAFC;opacity:.75}
  @media(max-width:900px){.adm-field-row{grid-template-columns:1fr}}
  .adm-chips{display:flex;gap:6px;flex-wrap:wrap}
  .adm-doc{border:2px dashed var(--line2);border-radius:12px;padding:24px;text-align:center;color:var(--muted);background:#F8FAFC}
  .adm-perm-chip{display:inline-block;font-size:11.5px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:1px 7px;margin:2px}
  .adm-lock-note{display:flex;align-items:center;gap:8px;font-weight:700;color:#334155}
  .adm-spin{width:22px;height:22px;border-radius:50%;border:3px solid var(--line2);border-top-color:var(--blue);animation:adm-spin .8s linear infinite;display:inline-block}
  @keyframes adm-spin{to{transform:rotate(360deg)}}
  .adm-checks{display:flex;flex-direction:column;gap:4px;font-size:12.5px}
  .adm-checks label{display:flex;gap:6px;align-items:flex-start;cursor:pointer}
  `);

  const fld = (label, input, hint, req, err) => h('label', { class: 'field' }, h('span', { class: 'lbl' }, label, req && h('i', { class: 'req' }, '*')), input, hint && h('span', { class: 'hint' }, hint), err);
  const errBox = () => h('div', { class: 'field-err', style: 'display:none' });
  const showErr = (box, msg) => { box.textContent = msg || ''; box.style.display = msg ? 'block' : 'none'; };
  const sw = (checked, onChange, disabled, label, title) => {
    const i = h('input', { type: 'checkbox', checked: !!checked, disabled, onChange: e => onChange(e.target.checked, i) });
    return h('label', { class: 'adm-switch' + (disabled ? ' dis' : ''), title }, i, h('span', { class: 'adm-sw-t' }), label && h('span', null, label));
  };
  const hint = (text, icon = 'lock') => h('span', { class: 'muted sm', style: 'display:inline-flex;align-items:center;gap:5px' }, BGS.icon(icon, 13), text);
  const toneFor = (n, warn, bad) => (n >= bad ? 'red' : n >= warn ? 'amber' : 'green');
  const hash = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  const localDay = v => { const d = new Date(v); return `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}-${pad(d.getDate(), 2)}`; };
  const userName = id => (D.user(id) || {}).name || id || '—';
  const activeSA = () => D.users.filter(u => u.active && u.roles.includes(SA));
  const header = (o) => ui.pageHeader(o);

  function entHref(id) {
    if (!id || id === '—') return null;
    if (/^BGS-W-/.test(id)) return '/workers/' + id;
    if (/^APP-/.test(id)) return '/applications/' + id;
    if (/^PC-/.test(id)) return '/cases/' + id;
    if (/^JO-/.test(id)) return '/job-orders/' + id;
    if (/^REG-/.test(id)) return '/registrations/' + id;
    if (/^WT-/.test(id)) return '/workflows/' + id;
    if (/^[A-Z]{2}-[A-Z]{3}-\d{4}-\d{2}$/.test(id)) return '/placement-codes/' + id;
    if (/^DOC-/.test(id)) { const d = D.documents.find(x => x.id === id); return d ? '/documents?owner=' + encodeURIComponent(d.ownerId) : null; }
    return null;
  }
  const entLink = id => { const hr = entHref(id); return hr ? h('a', { class: 'lnk mono', href: '#' + hr }, id) : h('span', { class: 'mono' }, id || '—'); };

  const PERM_META = {
    'worker.write': ['Registrasi & worker', 'Tambah / ubah data worker'],
    'registration.review': ['Registrasi & worker', 'Tinjau inbox registrasi publik (terima, gabung, buang)'],
    import: ['Registrasi & worker', 'Impor data worker dari Excel'],
    'merge.worker': ['Registrasi & worker', 'Gabung worker duplikat'],
    'pii.reveal': ['Registrasi & worker', 'Menampilkan NIK / paspor / telepon asli (tercatat di audit)'],
    'application.screen': ['Lamaran & seleksi', 'Screening lamaran (dokumen, interview, assessment)'],
    'application.decide': ['Lamaran & seleksi', 'Keputusan seleksi (terpilih, cadangan, tolak)'],
    'document.upload': ['Dokumen', 'Unggah dokumen'],
    'document.verify': ['Dokumen', 'Verifikasi dokumen'],
    'document.restricted.view': ['Dokumen', 'Membuka dokumen RESTRICTED (paspor, KK, MCU, psikologi)'],
    'master.write': ['Master data, partner & kuota', 'Ubah data master (negara, profesi, jalur, jenis dokumen)'],
    'partner.write': ['Master data, partner & kuota', 'Kelola partner, Job Order, Placement Code, Batch'],
    'quota.total.change': ['Master data, partner & kuota', 'Ubah Total Kuota langsung (dengan alasan + referensi)'],
    'quota.total.request': ['Master data, partner & kuota', 'Ajukan perubahan Total Kuota (perlu approval Director)'],
    'case.allocate': ['Placement Case & tugas', 'Alokasi dan buat Placement Case'],
    'pic.assign': ['Placement Case & tugas', 'Tugaskan / ganti PIC pada case'],
    'task.execute': ['Placement Case & tugas', 'Mengerjakan tugas (upload bukti, isi nomor referensi)'],
    'task.verify': ['Placement Case & tugas', 'Verifikasi tugas (maker-checker)'],
    'task.approve': ['Placement Case & tugas', 'Approval tugas yang butuh persetujuan'],
    'final.verify': ['Placement Case & tugas', 'Final verification sebelum keberangkatan'],
    'departure.record': ['Placement Case & tugas', 'Mencatat keberangkatan'],
    'workflow.write': ['Workflow & aturan', 'Buat / ubah / publish workflow template'],
    'workflow.approve': ['Workflow & aturan', 'Menyetujui migrasi workflow (Director)'],
    'rule.write': ['Workflow & aturan', 'Kelola aturan syarat (requirement rule)'],
    'approval.decide': ['Sistem & kepatuhan', 'Memutuskan persetujuan strategis (setujui / tolak)'],
    'user.manage': ['Sistem & kepatuhan', 'Kelola pengguna, peran, izin, data scope'],
    'audit.view': ['Sistem & kepatuhan', 'Melihat audit trail'],
    settings: ['Sistem & kepatuhan', 'Mengubah pengaturan sistem'],
    export: ['Sistem & kepatuhan', 'Ekspor laporan / data (disamarkan)'],
    'dsr.manage': ['Sistem & kepatuhan', 'Mengelola permintaan subjek data (PDP)'],
  };
  const PERM_CATS = ['Registrasi & worker', 'Lamaran & seleksi', 'Dokumen', 'Master data, partner & kuota', 'Placement Case & tugas', 'Workflow & aturan', 'Sistem & kepatuhan'];
  const permLabel = k => (PERM_META[k] || ['Lainnya', k])[1];
  const LOCKED_SA = ['user.manage', 'settings', 'audit.view'];

  const ROLE_INFO = {
    superadmin: { resp: 'Konfigurasi sistem, user / role / permission / scope, master data, workflow template (satu-satunya yang membuat & publish — RUL-013), requirement rule, ubah Total Quota (dengan alasan + referensi).', scope: 'ALL', note: 'Tetap terikat segregation of duties (RUL-016).' },
    director: { resp: 'Pemantauan eksekutif; approval proses strategis (migrasi workflow, perubahan Total Quota, REVERT quota / cancel setelah utilized, waiver, merge duplikat bila diwajibkan).', scope: 'ALL (baca)', note: 'Daftar proses strategis masih asumsi (A-15b, OQ-08).' },
    admin: { resp: 'Inbox registrasi, input worker, impor, lamaran, screening, keputusan seleksi, alokasi, Job Order / Placement Code / Batch, assign PIC, eksekusi & verifikasi task, final verification, keberangkatan.', scope: 'ALL', note: 'Final verification dilakukan Admin (A-15). Data scope ALL karena satu kantor (A-04b).' },
    pic: { resp: 'Eksekusi task pada case yang di-assign, upload evidence, verifikasi bila ditetapkan; PIC Keberangkatan mencatat departure.', scope: 'ASSIGNED', note: 'Hanya dokumen relevan dengan tugasnya (RUL-020).' },
    viewer: { resp: 'Pemantauan read-only.', scope: 'COUNTRY / ALL tanpa reveal (dikonfigurasi)', note: 'Tidak melihat file RESTRICTED secara default; identitas role Viewer belum ditetapkan (OQ-18).' },
  };
  const SCOPE_L = { ALL: 'Semua data', ASSIGNED: 'Hanya yang ditugaskan', COUNTRY: 'Per negara' };
  const DEF_SCOPE = { superadmin: 'ALL', director: 'ALL', admin: 'ALL', pic: 'ASSIGNED', viewer: 'COUNTRY' };
  const FORCED_2FA = [SA, DI, AD];
  const needs2fa = roles => roles.some(r => FORCED_2FA.includes(r));
  const scopeOf = u => u.scope || DEF_SCOPE[ROLE_KEYS.find(r => u.roles.includes(r))] || 'ALL';
  const allowedScopes = roles => (roles.some(r => FORCED_2FA.includes(r)) ? ['ALL'] : roles.includes(PI) ? ['ASSIGNED'] : roles.includes(VI) ? ['COUNTRY', 'ALL'] : ['ALL']);
  const isTerminalTask = t => ['COMPLETED', 'CANCELLED'].includes(t.status);
  const activeLoad = uid => ({
    tasks: D.tasks.filter(t => t.assigneeId === uid && !isTerminalTask(t)).length,
    cases: D.cases.filter(c => !['DEPARTED', 'CANCELLED'].includes(c.status) && Object.values(c.pics).includes(uid)).length,
  });
  const readOnlyNote = (text) => ui.callout('info', 'Mode lihat saja', text);

  // ================================================================ /users
  function usersPage(ctx) {
    const root = h('div', { class: 'stack' });
    const canManage = BGS.can('user.manage');
    const redraw = () => { draw(); };

    function twofaBadge(u) {
      if (needs2fa(u.roles)) return u.twofa ? ui.badge('Aktif (wajib)', 'green', { dot: true }) : ui.badge('Belum terdaftar (wajib)', 'red', { dot: true });
      return u.twofa ? ui.badge('Aktif', 'green', { dot: true }) : ui.badge('Tidak aktif', 'gray', { dot: true });
    }

    function detail(u) {
      const perms = Object.keys(BGS.perms).filter(k => u.roles.some(r => BGS.perms[k].includes(r)));
      const load = activeLoad(u.id);
      const recent = D.audit.filter(a => a.userId === u.id).slice(0, 5);
      const body = h('div', { class: 'stack' },
        ui.kv([
          ['ID', h('span', { class: 'mono' }, u.id)], ['Email', u.email],
          ['Peran', h('div', { class: 'adm-chips' }, u.roles.map(ui.roleBadge))], ['PIC Role', u.picRole || '—'],
          ['Cakupan data', SCOPE_L[scopeOf(u)] + (scopeOf(u) === 'COUNTRY' ? ' — ' + ((u.scopeCountries || []).map(D.cn).join(', ') || 'belum dipilih') : '')],
          ['Verifikasi 2 langkah', twofaBadge(u)], ['Status', ui.badge(u.active ? 'Aktif' : 'Nonaktif', u.active ? 'green' : 'gray', { dot: true })],
          ['Login terakhir', u.last ? `${fmt.dateTime(u.last)} (${fmt.rel(u.last)})` : 'Belum pernah'],
          !u.active && ['Alasan nonaktif', u.deactivatedReason || '—'],
          ['Beban aktif', `${load.tasks} tugas · ${load.cases} case sebagai PIC`],
        ]),
        h('div', null, h('h4', { style: 'margin-bottom:6px' }, `Izin efektif (${perms.length})`), h('div', null, perms.length ? perms.map(k => h('span', { class: 'adm-perm-chip', title: k }, permLabel(k))) : h('span', { class: 'muted' }, 'Tidak ada izin.')), h('p', { class: 'muted sm', style: 'margin-top:6px' }, 'Gabungan izin dari seluruh peran pengguna (A-04). Lihat Matriks izin untuk detail.')),
        h('div', null, h('h4', { style: 'margin-bottom:6px' }, 'Aktivitas terakhir'), recent.length ? ui.timeline(recent.map(a => ({ text: `${a.action}${a.entityId !== '—' ? ' · ' + a.entityId : ''}`, at: a.at, tone: /RESTRICTED|reveal/i.test(a.action) ? 'red' : 'blue' }))) : h('p', { class: 'muted' }, 'Belum ada aktivitas tercatat.')));
      const d = ui.drawer({ title: u.name, body, footer: [ui.btn('Tutup', { onClick: () => d.close() }), canManage && ui.btn('Ubah pengguna', { kind: 'primary', icon: 'edit', onClick: () => { d.close(); userModal(u); } })] });
    }

    function userModal(u) {
      const isNew = !u;
      const d = { roles: u ? u.roles.slice() : [], scope: u ? scopeOf(u) : 'ALL' };
      const name = h('input', { class: 'input', value: u ? u.name : '', placeholder: 'Nama lengkap' });
      const email = h('input', { class: 'input', type: 'email', value: u ? u.email : '', placeholder: 'nama@bgs.example' });
      const eName = errBox(), eEmail = errBox(), eRoles = errBox(), ePic = errBox(), eScope = errBox();
      const roleDesc = { superadmin: 'Konfigurasi penuh sistem', director: 'Approval strategis & pemantauan', admin: 'Operasional harian', pic: 'Eksekusi tugas pada case yang ditugaskan', viewer: 'Hanya melihat (read-only)' };
      const roleBoxes = ROLE_KEYS.map(r => ({ r, cb: h('input', { type: 'checkbox', checked: d.roles.includes(r), onChange: () => sync(true) }) }));
      const picSel = h('select', { class: 'input' }, h('option', { value: '' }, '— pilih PIC Role —'), D.picRoles.map(p => h('option', { value: p, selected: u && u.picRole === p }, p)));
      const picGroup = fld('PIC Role', picSel, 'Menentukan tugas langkah mana yang otomatis ditujukan ke pengguna ini (A-14).', true, ePic);
      const scopeSel = h('select', { class: 'input', onChange: () => { d.scope = scopeSel.value; sync(false); } });
      const countryBoxes = D.countries.map(c => ({ c, cb: h('input', { type: 'checkbox', checked: !!(u && (u.scopeCountries || []).includes(c.code)) }) }));
      const countryGroup = h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Negara yang boleh dilihat', h('i', { class: 'req' }, '*')), h('div', { class: 'adm-chips' }, countryBoxes.map(x => h('label', { class: 'field-check chip static', style: 'display:inline-flex;gap:6px;align-items:center' }, x.cb, D.cn(x.c.code)))));
      const scopeHint = h('span', { class: 'hint' });
      const twofaCb = h('input', { type: 'checkbox', checked: !!(u && u.twofa) });
      const twofaOpt = h('label', { class: 'field field-check' }, twofaCb, h('span', null, 'Aktifkan verifikasi 2 langkah (opsional untuk peran ini)'));
      const twofaForced = ui.callout('info', '2FA wajib (FR-IAM-002)', 'Superadmin, Director, dan Admin wajib memakai kode 2FA (TOTP). Pengguna mendaftarkan aplikasi autentikator saat login berikutnya; opsi ini tidak bisa dimatikan.');

      function sync(rolesChanged) {
        d.roles = roleBoxes.filter(x => x.cb.checked).map(x => x.r);
        const allowed = allowedScopes(d.roles);
        if (rolesChanged || !allowed.includes(d.scope)) d.scope = allowed.includes(d.scope) && !rolesChanged ? d.scope : allowed[0];
        BGS.clear(scopeSel); allowed.forEach(s => scopeSel.appendChild(h('option', { value: s, selected: s === d.scope }, SCOPE_L[s])));
        scopeSel.disabled = allowed.length === 1;
        scopeHint.textContent = d.roles.some(r => FORCED_2FA.includes(r)) ? 'Peran Superadmin / Director / Admin selalu melihat semua data (A-04b).' : d.roles.includes(PI) ? 'PIC hanya melihat worker, lamaran, dan case yang ditugaskan (RUL-020).' : d.roles.includes(VI) ? 'Cakupan Viewer belum ditetapkan owner (OQ-18); default per negara.' : 'Pilih minimal satu peran.';
        picGroup.style.display = d.roles.includes(PI) ? '' : 'none';
        countryGroup.style.display = d.scope === 'COUNTRY' ? '' : 'none';
        const forced = needs2fa(d.roles); twofaForced.style.display = forced ? '' : 'none'; twofaOpt.style.display = forced ? 'none' : '';
      }

      const body = h('div', { class: 'stack' },
        isNew && ui.callout('info', 'Pengguna baru', 'Akun dibuat aktif. Kata sandi sementara dikirim lewat saluran aman di luar sistem (tidak disimulasikan di prototipe).'),
        h('div', { class: 'form-grid cols-2' }, fld('Nama lengkap', name, null, true, eName), fld('Email kerja', email, 'Dipakai untuk login; harus unik.', true, eEmail)),
        h('div', { class: 'field' }, h('span', { class: 'lbl' }, 'Peran', h('i', { class: 'req' }, '*')), h('div', { class: 'stack-sm' }, roleBoxes.map(x => h('label', { class: 'field-check', style: 'display:flex;gap:8px;align-items:center' }, x.cb, ui.roleBadge(x.r), h('span', { class: 'muted sm' }, roleDesc[x.r])))), h('span', { class: 'hint' }, 'Satu pengguna boleh punya lebih dari satu peran (A-04).'), eRoles),
        picGroup,
        h('div', { class: 'form-grid cols-2' }, fld('Cakupan data (data scope)', scopeSel, null, false, eScope), h('div', { class: 'field' }, h('span', { class: 'lbl' }, ' '), scopeHint)),
        countryGroup, twofaForced, twofaOpt);
      sync(false);
      const m = ui.modal({
        title: isNew ? 'Tambah pengguna' : `Ubah pengguna — ${u.name}`, size: 'md', body,
        footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn(isNew ? 'Buat pengguna' : 'Simpan perubahan', { kind: 'primary', onClick: save })],
      });
      async function save() {
        [eName, eEmail, eRoles, ePic, eScope].forEach(b => showErr(b, ''));
        let ok = true; const nm = name.value.trim(), em = email.value.trim().toLowerCase();
        if (!nm) { showErr(eName, 'Nama wajib diisi'); ok = false; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { showErr(eEmail, 'Isi email yang valid'); ok = false; }
        else if (D.users.some(x => x !== u && x.email.toLowerCase() === em)) { showErr(eEmail, 'Email sudah dipakai pengguna lain'); ok = false; }
        if (!d.roles.length) { showErr(eRoles, 'Pilih minimal satu peran'); ok = false; }
        if (d.roles.includes(PI) && !picSel.value) { showErr(ePic, 'PIC Role wajib dipilih untuk peran PIC'); ok = false; }
        const countries = countryBoxes.filter(x => x.cb.checked).map(x => x.c.code);
        if (d.scope === 'COUNTRY' && !countries.length) { showErr(eScope, 'Pilih minimal satu negara'); ok = false; }
        if (!ok) return;
        if (u && u.roles.includes(SA) && !d.roles.includes(SA) && u.active) {
          if (u.id === BGS.state.userId) { showErr(eRoles, 'Anda tidak dapat mencabut peran Superadmin dari akun Anda sendiri.'); return; }
          const left = activeSA().filter(x => x.id !== u.id).length;
          if (left < 1) { showErr(eRoles, 'Harus selalu ada minimal 1 Superadmin aktif (RSK-10).'); return; }
          if (left < 2) { const go = await ui.confirm({ title: 'Superadmin tinggal 1 akun', message: 'Setelah perubahan ini hanya tersisa 1 Superadmin aktif. Jika akun itu terkunci atau bermasalah, tidak ada yang bisa mengelola sistem (RSK-10). Lanjutkan?', tone: 'danger', confirmLabel: 'Ya, lanjutkan' }); if (!go) return; }
        }
        const forced = needs2fa(d.roles);
        const before = u ? `peran ${u.roles.join('+')}, PIC ${u.picRole || '-'}, scope ${scopeOf(u)}` : '';
        if (isNew) {
          const nu = { id: 'U' + pad(D.users.length + 1, 2), name: nm, email: em, roles: d.roles.slice(), twofa: forced ? false : twofaCb.checked, active: true, last: null, scope: d.scope };
          if (d.roles.includes(PI)) nu.picRole = picSel.value; if (d.scope === 'COUNTRY') nu.scopeCountries = countries;
          D.users.push(nu);
          BGS.audit('Pengguna dibuat', 'User', nu.id, `${nm} (${em}); peran ${nu.roles.join('+')}${nu.picRole ? ', ' + nu.picRole : ''}; scope ${nu.scope}`);
          ui.toast(`Pengguna ${nm} dibuat`);
        } else {
          u.name = nm; u.email = em; u.roles = d.roles.slice(); u.scope = d.scope;
          if (d.roles.includes(PI)) u.picRole = picSel.value; else delete u.picRole;
          if (d.scope === 'COUNTRY') u.scopeCountries = countries; else delete u.scopeCountries;
          if (!forced) u.twofa = twofaCb.checked;
          BGS.audit('Pengguna diubah', 'User', u.id, `${before} → peran ${u.roles.join('+')}, PIC ${u.picRole || '-'}, scope ${u.scope}`);
          ui.toast('Perubahan pengguna disimpan');
        }
        m.close(); redraw();
      }
    }

    async function deactivate(u) {
      if (u.id === BGS.state.userId) { ui.toast('Anda tidak dapat menonaktifkan akun yang sedang dipakai.', 'warn'); return; }
      const isSA = u.roles.includes(SA); const left = activeSA().filter(x => x.id !== u.id).length;
      if (isSA && left < 1) {
        const m = ui.modal({ title: 'Tidak dapat dinonaktifkan', size: 'sm', body: ui.callout('danger', 'Superadmin aktif terakhir', 'Harus selalu ada minimal 1 Superadmin aktif agar sistem tetap bisa dikelola (RSK-10). Tambahkan Superadmin lain terlebih dahulu.'), footer: ui.btn('Mengerti', { kind: 'primary', onClick: () => m.close() }) });
        return;
      }
      if (isSA && left < 2) {
        const go = await ui.confirm({ title: 'Peringatan: Superadmin tinggal 1', message: `Menonaktifkan ${u.name} membuat hanya 1 Superadmin aktif tersisa. Risiko: bila akun itu terkunci atau hilang, tidak ada yang bisa mengelola pengguna dan pengaturan (RSK-10). Disarankan menambah Superadmin lain dulu.`, tone: 'danger', confirmLabel: 'Tetap nonaktifkan' });
        if (!go) return;
      }
      const load = activeLoad(u.id);
      const msg = h('div', { class: 'stack-sm' }, h('p', null, 'Pengguna tidak bisa login lagi. Riwayat dan audit tetap tersimpan.'), (load.tasks || load.cases) ? ui.callout('warn', 'Masih punya pekerjaan aktif', `${load.tasks} tugas dan ${load.cases} case sebagai PIC. Alihkan lebih dulu agar tidak ada tugas tanpa pemilik (BR-018).`) : null);
      const reason = await ui.reasonPrompt({ title: `Nonaktifkan ${u.name}?`, message: msg, confirmLabel: 'Nonaktifkan', tone: 'danger', presets: ['Keluar dari perusahaan', 'Pindah tugas', 'Keamanan akun (dicurigai disalahgunakan)'] });
      if (!reason) return;
      u.active = false; u.deactivatedReason = reason; u.deactivatedAt = nowIso();
      BGS.audit('Pengguna dinonaktifkan', 'User', u.id, `${u.name}. Alasan: ${reason}`);
      ui.toast(`${u.name} dinonaktifkan`, 'warn'); redraw();
    }
    async function reactivate(u) {
      const go = await ui.confirm({ title: `Aktifkan kembali ${u.name}?`, message: 'Pengguna dapat login lagi dengan peran sebelumnya. Mintalah ia mengatur ulang kata sandi.', confirmLabel: 'Aktifkan' });
      if (!go) return;
      u.active = true; delete u.deactivatedReason; delete u.deactivatedAt;
      BGS.audit('Pengguna diaktifkan kembali', 'User', u.id, u.name); ui.toast(`${u.name} diaktifkan kembali`); redraw();
    }
    async function resetTwofa(u) {
      if (u.id === BGS.state.userId) { ui.toast('Reset 2FA akun sendiri tidak diizinkan; minta Superadmin lain.', 'warn'); return; }
      const go = await ui.confirm({ title: `Reset 2FA ${u.name}?`, message: needs2fa(u.roles) ? 'Pengguna wajib mendaftarkan ulang aplikasi autentikator saat login berikutnya.' : '2FA pengguna dimatikan sampai diaktifkan lagi.', tone: 'danger', confirmLabel: 'Reset 2FA' });
      if (!go) return;
      u.twofa = false; u.twofaResetAt = nowIso();
      BGS.audit('2FA di-reset', 'User', u.id, u.name); ui.toast('2FA di-reset'); redraw();
    }

    function draw() {
      BGS.clear(root);
      const act = D.users.filter(u => u.active), sa = activeSA();
      const mand = act.filter(u => needs2fa(u.roles)), mandOk = mand.filter(u => u.twofa).length;
      root.appendChild(header({ title: 'Pengguna & peran', subtitle: 'Kelola akun staf internal: peran (boleh lebih dari satu), PIC Role, cakupan data, dan 2FA. Hanya Superadmin.', mvp: 1, actions: [ui.btn('Tambah pengguna', { kind: 'primary', icon: 'user-plus', disabled: !canManage, onClick: () => userModal(null) })] }));
      root.appendChild(h('div', { class: 'grid cols-4' },
        ui.kpi({ label: 'Pengguna aktif', value: act.length, sub: `dari ${D.users.length} akun`, icon: 'users', tone: 'blue' }),
        ui.kpi({ label: 'Superadmin aktif', value: sa.length, sub: sa.length < 2 ? 'Kurang dari 2 — risiko RSK-10' : 'Aman (≥ 2 akun)', icon: 'key', tone: sa.length < 2 ? 'red' : 'green' }),
        ui.kpi({ label: '2FA wajib terpenuhi', value: `${mandOk}/${mand.length}`, sub: 'Superadmin, Director, Admin', icon: 'shield', tone: mandOk === mand.length ? 'green' : 'amber' }),
        ui.kpi({ label: 'Nonaktif', value: D.users.length - act.length, sub: 'tidak bisa login', icon: 'lock', tone: 'amber' })));
      if (sa.length < 2) root.appendChild(ui.callout('danger', 'Hanya ada 1 Superadmin aktif', 'Tambahkan minimal satu Superadmin lagi agar sistem tetap bisa dikelola jika satu akun bermasalah (RSK-10).'));
      root.appendChild(ui.card({
        flush: true, body: ui.listView({
          items: () => D.users, pageSize: 10, searchPlaceholder: 'Cari nama atau email…', search: u => `${u.name} ${u.email} ${u.picRole || ''}`,
          filters: [
            { key: 'role', label: 'Peran', options: ROLE_KEYS.map(r => [r, BGS.roles[r]]), match: (u, v) => u.roles.includes(v) },
            { key: 'status', label: 'Status', options: [['on', 'Aktif'], ['off', 'Nonaktif']], match: (u, v) => (v === 'on' ? u.active : !u.active) },
            { key: 'f2', label: '2FA', options: [['yes', 'Aktif'], ['no', 'Belum aktif']], match: (u, v) => (v === 'yes' ? u.twofa : !u.twofa) },
          ],
          onRowClick: detail, rowClass: u => (u.active ? '' : 'row-warn'),
          columns: [
            { key: 'name', label: 'Pengguna', render: u => h('div', { class: 'row gap-sm' }, ui.avatar(u.name, '#334155', 30), h('div', null, h('b', null, u.name), h('div', { class: 'muted sm' }, u.email))) },
            { key: 'roles', label: 'Peran', render: u => h('div', { class: 'adm-chips' }, u.roles.map(ui.roleBadge)) },
            { key: 'pic', label: 'PIC Role', render: u => u.picRole || h('span', { class: 'muted' }, '—') },
            { key: 'scope', label: 'Cakupan data', render: u => { const s = scopeOf(u); return h('span', { class: 'sm' }, SCOPE_L[s] + (s === 'COUNTRY' && u.scopeCountries ? ` (${u.scopeCountries.join(', ')})` : '')); } },
            { key: 'twofa', label: '2FA', render: twofaBadge },
            { key: 'active', label: 'Status', render: u => ui.badge(u.active ? 'Aktif' : 'Nonaktif', u.active ? 'green' : 'gray', { dot: true }) },
            { key: 'last', label: 'Login terakhir', render: u => (u.last ? h('div', null, h('div', null, fmt.dateTime(u.last)), h('div', { class: 'muted sm' }, fmt.rel(u.last))) : h('span', { class: 'muted' }, 'Belum pernah')) },
            { key: 'act', label: '', render: u => h('div', { class: 'row gap-sm' },
              ui.btn('', { icon: 'edit', sm: true, title: canManage ? 'Ubah pengguna' : 'Hanya Superadmin', disabled: !canManage, onClick: () => userModal(u) }),
              ui.btn('', { icon: 'refresh', sm: true, title: canManage ? 'Reset 2FA' : 'Hanya Superadmin', disabled: !canManage || !u.active, onClick: () => resetTwofa(u) }),
              u.active ? ui.btn('', { icon: 'lock', sm: true, title: canManage ? 'Nonaktifkan' : 'Hanya Superadmin', disabled: !canManage, onClick: () => deactivate(u) }) : ui.btn('', { icon: 'check', sm: true, title: 'Aktifkan kembali', disabled: !canManage, onClick: () => reactivate(u) })) },
          ],
        }),
      }));
      root.appendChild(h('p', { class: 'muted sm' }, 'Referensi: BR-027 (least privilege), A-04 (multi-role), FR-IAM-002 (2FA TOTP), RUL-021 (perubahan permission tercatat di audit), RSK-10 (kehilangan akses Superadmin).'));
    }
    draw();
    return root;
  }

  // ================================================================ /roles
  function rolesPage() {
    const canEdit = BGS.isRole(SA) && BGS.can('user.manage');
    let editMode = false;
    const root = h('div', { class: 'stack' }); let activeTab = 'matrix';

    function matrixView() {
      const host = h('div', { class: 'stack' });
      const drawM = () => {
        BGS.clear(host);
        const keys = Object.keys(BGS.perms); const me = BGS.role();
        const tbody = h('tbody');
        PERM_CATS.concat(['Lainnya']).forEach(cat => {
          const ks = keys.filter(k => (PERM_META[k] || ['Lainnya'])[0] === cat); if (!ks.length) return;
          tbody.appendChild(h('tr', { class: 'grp' }, h('td', { colspan: 6 }, cat)));
          ks.forEach(k => tbody.appendChild(h('tr', null,
            h('td', null, h('div', { style: 'font-weight:600' }, permLabel(k)), h('div', { class: 'mono muted sm' }, k)),
            ROLE_KEYS.map(r => {
              const has = BGS.perms[k].includes(r); const locked = r === SA && LOCKED_SA.includes(k);
              let cell;
              if (editMode) {
                const cb = h('input', { type: 'checkbox', checked: has, disabled: locked, title: locked ? 'Dikunci agar Superadmin tidak kehilangan akses (RSK-10)' : '', onChange: async () => {
                  const want = cb.checked; const r2 = await ui.reasonPrompt({ title: `${want ? 'Beri' : 'Cabut'} izin — ${BGS.roles[r]}`, message: `${permLabel(k)} (${k})`, label: 'Alasan perubahan izin', confirmLabel: 'Terapkan' });
                  if (!r2) { cb.checked = !want; return; }
                  BGS.perms[k] = want ? BGS.perms[k].concat(r) : BGS.perms[k].filter(x => x !== r);
                  BGS.audit('Izin diubah', 'Permission', k, `${BGS.roles[r]}: ${want ? 'diberikan' : 'dicabut'}. Alasan: ${r2}`);
                  ui.toast('Izin diperbarui'); drawM();
                } }); cell = cb;
              } else cell = has ? h('span', { class: 'adm-yes', title: 'Diizinkan' }, BGS.icon('check-circle', 18)) : h('span', { class: 'adm-no', title: 'Tidak diizinkan' }, '–');
              return h('td', { class: 'c' + (r === me ? ' adm-mine' : '') }, cell);
            }))));
        });
        const diff = Object.keys(PERM_DEFAULT).some(k => JSON.stringify([...PERM_DEFAULT[k]].sort()) !== JSON.stringify([...BGS.perms[k]].sort()));
        host.appendChild(h('div', { class: 'row wrap between' },
          h('div', { class: 'row wrap' }, canEdit ? sw(editMode, v => { editMode = v; drawM(); }, false, 'Mode ubah izin') : hint('Hanya Superadmin yang dapat mengubah izin', 'lock'), diff && ui.badge('Berbeda dari bawaan', 'amber', { dot: true })),
          h('div', { class: 'row gap-sm' }, canEdit && diff && ui.btn('Kembalikan ke bawaan', { icon: 'refresh', onClick: async () => {
            const ok = await ui.confirm({ title: 'Kembalikan izin ke bawaan?', message: 'Semua perubahan izin selama sesi demo ini dibatalkan.', confirmLabel: 'Kembalikan' }); if (!ok) return;
            Object.keys(PERM_DEFAULT).forEach(k => { BGS.perms[k] = PERM_DEFAULT[k].slice(); }); BGS.audit('Izin dikembalikan ke bawaan', 'Permission', '*', 'Reset matriks izin'); ui.toast('Izin dikembalikan'); drawM();
          } }))));
        if (editMode) host.appendChild(ui.callout('warn', 'Hati-hati: perubahan izin berlaku langsung', 'Setiap perubahan wajib alasan dan tercatat di audit trail (RUL-021). Izin kelola pengguna, pengaturan, dan audit untuk Superadmin dikunci (RSK-10).'));
        host.appendChild(h('div', { class: 'card' }, h('div', { class: 'tbl-scroll' }, h('table', { class: 'adm-matrix' }, h('thead', null, h('tr', null, h('th', null, 'Izin'), ROLE_KEYS.map(r => h('th', { class: r === me ? 'adm-mine' : '' }, ui.roleBadge(r), r === me && h('div', { class: 'xs muted' }, 'peran Anda'))))), tbody))));
        host.appendChild(h('p', { class: 'muted sm' }, 'Matriks dibuat dari BGS.perms yang sama dengan yang dipakai tombol dan menu di seluruh aplikasi (BR-027). Director dapat melihat tetapi tidak mengubah.'));
      };
      drawM(); return host;
    }

    function capabilityView() {
      const Y = '✓', N = '–';
      const rows = [
        ['Kelola user, role, permission, data scope', Y, N, N, N, N], ['Master data', Y, 'lihat', 'lihat (usul)', N, 'lihat'],
        ['Partner, Job Order, Placement Code, Batch', Y, 'lihat', '✓ kelola', 'lihat (terkait)', 'lihat'], ['Ubah Total Quota', Y, 'approve', 'ajukan', N, N],
        ['Workflow template (buat, publish, versi, migrasi)', Y, 'approve migrasi', 'lihat', N, N], ['Registration inbox, input worker, impor', Y, N, Y, N, N],
        ['Application & screening', Y, 'lihat', Y, '✓ (assigned)', 'lihat'], ['Buat Placement Case (alokasi)', Y, N, Y, N, N], ['Assign / reassign PIC', Y, N, Y, N, N],
        ['Eksekusi task', Y, N, Y, '✓ (miliknya)', N], ['Verifikasi / approval', Y, '✓ (strategis)', '✓ bila ditetapkan', '✓ verifikasi bila ditetapkan', N],
        ['Final verification', Y, 'approve bila dikonfigurasi', Y, N, N], ['Audit log', Y, 'lihat', N, N, N],
      ];
      const cell = v => h('td', { class: 'c' }, v === Y ? h('span', { class: 'adm-yes' }, BGS.icon('check-circle', 17)) : v === N ? h('span', { class: 'adm-no' }, '–') : ui.badge(v.replace('✓ ', ''), v.startsWith('✓') ? 'green' : v.startsWith('lihat') ? 'teal' : 'amber'));
      return h('div', { class: 'stack' }, h('div', { class: 'card' }, h('div', { class: 'tbl-scroll' }, h('table', { class: 'adm-matrix' }, h('thead', null, h('tr', null, h('th', null, 'Kapabilitas'), ROLE_KEYS.map(r => h('th', null, ui.roleBadge(r))))), h('tbody', null, rows.map(r => h('tr', null, h('td', { style: 'font-weight:600' }, r[0]), r.slice(1).map(cell))))))), h('p', { class: 'muted sm' }, 'Sumber: BRD §12.2 Kapabilitas Ringkas per Role. Matriks granular per permission ada di tab "Matriks izin".'));
    }

    function summaryView() {
      return h('div', { class: 'stack' },
        h('div', { class: 'grid cols-3' }, ROLE_KEYS.map(r => { const n = D.users.filter(u => u.active && u.roles.includes(r)).length; const np = Object.keys(BGS.perms).filter(k => BGS.perms[k].includes(r)).length;
          return ui.card({ title: BGS.roles[r], icon: 'user', actions: [ui.badge(`${n} pengguna`, BGS.roleTone[r] || 'gray')], body: h('div', { class: 'stack-sm' }, h('p', { class: 'sm' }, ROLE_INFO[r].resp), ui.kv([['Data scope default', ui.badge(ROLE_INFO[r].scope, 'blue')], ['Jumlah izin', np]]), h('p', { class: 'muted sm' }, ROLE_INFO[r].note)) }); })),
        h('p', { class: 'muted sm' }, 'Sumber: BRD §12.1. Estimasi 10–30 akun, concurrent ≤ 30 (A-01).'));
    }

    function restrictedView() {
      const rt = D.docTypes.filter(d => d.sensitivity === 'RESTRICTED'), who = ROLE_KEYS.filter(r => BGS.perms['document.restricted.view'].includes(r)), pii = ROLE_KEYS.filter(r => BGS.perms['pii.reveal'].includes(r));
      return h('div', { class: 'stack' },
        ui.callout('warn', 'Dokumen RESTRICTED dilindungi berlapis', 'Setiap pembukaan dokumen RESTRICTED dan setiap reveal NIK / paspor wajib berizin, disertai alasan, dan tercatat di audit trail append-only (RUL-020, RUL-021).'),
        h('div', { class: 'grid cols-2' },
          ui.card({ title: 'Jenis dokumen RESTRICTED', icon: 'lock', body: h('div', { class: 'stack-sm' }, h('div', { class: 'adm-chips' }, rt.map(d => ui.badge(d.name, 'red'))), h('p', { class: 'muted sm' }, 'Daftar awal dari A-18 dan dapat divalidasi (OQ-10). Pengelompokan INTERNAL / CONFIDENTIAL / RESTRICTED ada di Perlindungan data → Klasifikasi data.')) }),
          ui.card({ title: 'Siapa yang boleh', icon: 'key', body: ui.kv([['Buka dokumen RESTRICTED', h('div', { class: 'adm-chips' }, who.map(ui.roleBadge))], ['Reveal NIK / paspor', h('div', { class: 'adm-chips' }, pii.map(ui.roleBadge))], ['Viewer', 'Tidak melihat file RESTRICTED secara default (OQ-18)'], ['PIC', 'Hanya dokumen relevan dengan tugasnya (RUL-020)']]) })),
        ui.card({ title: 'Aturan akses', icon: 'shield', body: h('ul', { class: 'stack-sm', style: 'margin:0;padding-left:18px' }, [
          'Izin khusus document.restricted.view diperlukan — izin ini terpisah dari izin unggah / verifikasi (RUL-020).',
          'NIK, paspor, dan telepon tampil tersamar secara default; reveal meminta alasan dan dicatat (BR-009).',
          'Setiap akses dicatat: siapa, kapan, dokumen apa, alasan — lihat Audit trail → tab "Akses data sensitif" (RUL-021).',
          'Ekspor data selalu memakai masking (FR-RPT-003).', 'Uploader tidak boleh memverifikasi dokumen yang sama bila pengaturan SoD aktif (RUL-016).'].map(t => h('li', null, t))) }));
    }

    function customView() {
      return h('div', { class: 'stack' },
        ui.callout('info', 'Peran khusus (custom role) — rekomendasi', 'BRD menyarankan Superadmin dapat membuat peran khusus (§12.1, [RECOMMENDATION]). Fitur ini belum diimplementasikan; lima peran baku dan kombinasi multi-role (A-04) sudah mencakup kebutuhan MVP 1–3.'),
        ui.card({ title: 'Buat peran khusus', body: h('div', { class: 'row wrap' }, ui.btn('Buat peran khusus', { icon: 'plus', disabled: true, title: 'Belum tersedia — rekomendasi, belum diimplementasikan' }), hint('Belum tersedia: rekomendasi BRD, belum diimplementasikan. Gunakan kombinasi peran pada menu Pengguna.', 'info')) }));
    }

    const draw = () => {
      BGS.clear(root);
      root.appendChild(header({ title: 'Matriks izin & peran', subtitle: 'Siapa boleh melakukan apa, dan data apa yang boleh dilihat (BR-027).', mvp: 1 }));
      if (!canEdit) root.appendChild(readOnlyNote('Anda hanya dapat melihat matriks izin. Perubahan izin dilakukan Superadmin (RUL-021: tercatat di audit).'));
      root.appendChild(ui.tabs([
        { id: 'matrix', label: 'Matriks izin', render: matrixView }, { id: 'sum', label: 'Ringkasan peran & data scope', render: summaryView },
        { id: 'cap', label: 'Kapabilitas (BRD §12.2)', render: capabilityView }, { id: 'rest', label: 'Dokumen RESTRICTED', render: restrictedView }, { id: 'custom', label: 'Peran khusus', render: customView },
      ], { active: activeTab, onChange: t => { activeTab = t; } }));
    };
    draw(); return root;
  }

  // ================================================================ /audit
  function auditPage() {
    const root = h('div', { class: 'stack' });
    const isSens = a => /reveal|restricted|ditampilkan/i.test(a.action);
    const sensCount = () => D.audit.filter(isSens).length;

    function view(sensOnly) {
      const f = { q: '', user: '', entity: '', action: '', from: '', to: '' };
      const base = () => D.audit.filter(a => !sensOnly || isSens(a));
      const filtered = () => base().filter(a => {
        const q = f.q.toLowerCase();
        if (q && !`${a.id} ${a.action} ${a.entityType} ${a.entityId} ${a.detail} ${userName(a.userId)} ${a.ip}`.toLowerCase().includes(q)) return false;
        if (f.user && a.userId !== f.user) return false; if (f.entity && a.entityType !== f.entity) return false;
        if (f.action && !a.action.toLowerCase().includes(f.action.toLowerCase())) return false;
        const ld = localDay(a.at); if (f.from && ld < f.from) return false; if (f.to && ld > f.to) return false; return true;
      });
      const users = [...new Set(base().map(a => a.userId))]; const ents = [...new Set(base().map(a => a.entityType))].sort();
      const counter = h('span', { class: 'muted sm' });
      const table = ui.table({ pageSize: 15, rows: [], onRowClick: openDetail, dense: true, columns: [
        { key: 'at', label: 'Waktu', render: a => h('div', { class: 'nowrap' }, h('div', null, fmt.dateTime(a.at)), h('div', { class: 'muted xs' }, a.id)) },
        { key: 'userId', label: 'Pengguna', render: a => ui.userChip(a.userId) },
        { key: 'action', label: 'Aksi', render: a => isSens(a) ? h('span', { class: 'badge b-red' }, BGS.icon('lock', 12), a.action) : h('span', { style: 'font-weight:600' }, a.action) },
        { key: 'entity', label: 'Entitas', render: a => h('div', null, h('div', { class: 'muted sm' }, a.entityType), entLink(a.entityId)) },
        { key: 'detail', label: 'Detail', render: a => h('span', { class: 'sm' }, (a.detail || '').length > 70 ? a.detail.slice(0, 70) + '…' : a.detail || '—') },
        { key: 'ip', label: 'IP', render: a => h('span', { class: 'mono muted' }, a.ip || '—') },
      ], empty: ui.emptyState({ icon: 'shield', title: 'Tidak ada catatan yang cocok', text: 'Ubah filter atau rentang tanggal.' }) });
      const apply = () => { const rows = filtered(); counter.textContent = `${rows.length} dari ${base().length} catatan`; table.redraw(rows); return rows; };
      const mk = (type, props) => h('input', Object.assign({ class: 'input', type }, props));
      const bar = h('div', { class: 'toolbar', style: 'flex-wrap:wrap' },
        h('div', { class: 'search' }, BGS.icon('search', 16), mk('text', { placeholder: 'Cari ID, entitas, detail…', onInput: e => { f.q = e.target.value; apply(); } })),
        h('select', { class: 'input sel', title: 'Pengguna', onChange: e => { f.user = e.target.value; apply(); } }, h('option', { value: '' }, 'Pengguna: semua'), users.map(id => h('option', { value: id }, userName(id)))),
        h('select', { class: 'input sel', title: 'Tipe entitas', onChange: e => { f.entity = e.target.value; apply(); } }, h('option', { value: '' }, 'Entitas: semua'), ents.map(x => h('option', { value: x }, x))),
        mk('text', { placeholder: 'Teks aksi…', style: 'width:160px', onInput: e => { f.action = e.target.value; apply(); } }),
        h('label', { class: 'row gap-sm sm muted' }, 'Dari', mk('date', { style: 'width:140px', onChange: e => { f.from = e.target.value; apply(); } })),
        h('label', { class: 'row gap-sm sm muted' }, 'Sampai', mk('date', { style: 'width:140px', onChange: e => { f.to = e.target.value; apply(); } })),
        h('div', { class: 'toolbar-r' }, counter, ui.btn('Ekspor CSV', { icon: 'download', disabled: !BGS.can('export'), title: BGS.can('export') ? 'Ekspor hasil filter' : 'Tidak punya izin ekspor', onClick: () => { const rows = apply(); BGS.exportCsv(rows, [
          { label: 'ID', key: 'id' }, { label: 'Waktu', value: a => a.at }, { label: 'Pengguna', value: a => userName(a.userId) }, { label: 'Aksi', key: 'action' }, { label: 'Tipe entitas', key: 'entityType' }, { label: 'ID entitas', key: 'entityId' }, { label: 'Detail', key: 'detail' }, { label: 'IP', key: 'ip' }], `audit-trail${sensOnly ? '-sensitif' : ''}.csv`); ui.toast(`${rows.length} baris diekspor`); } })));
      apply();
      return ui.card({ flush: true, body: h('div', null, bar, table) });
    }

    function openDetail(a) {
      const related = D.audit.filter(x => x !== a && a.entityId !== '—' && x.entityId === a.entityId).slice(0, 6);
      const u = D.user(a.userId);
      const body = h('div', { class: 'stack' },
        h('div', { class: 'adm-lock-note' }, BGS.icon('lock', 16), 'Catatan ini bersifat append-only — tidak dapat diubah atau dihapus (RUL-021).'),
        ui.kv([['ID catatan', h('span', { class: 'mono' }, a.id)], ['Waktu', fmt.dateTime(a.at)], ['Pengguna', u ? h('div', { class: 'row gap-sm' }, ui.userChip(u.id), u.roles.map(ui.roleBadge)) : a.userId],
          ['Aksi', isSens(a) ? ui.badge(a.action, 'red') : a.action], ['Tipe entitas', a.entityType], ['ID entitas', entLink(a.entityId)], ['Detail', a.detail || '—'], ['Alamat IP', h('span', { class: 'mono' }, a.ip || '—')]]),
        related.length ? h('div', null, h('h4', { style: 'margin-bottom:6px' }, 'Catatan lain pada entitas yang sama'), ui.timeline(related.map(x => ({ text: x.action + (x.detail ? ' — ' + x.detail : ''), at: x.at, by: x.userId, tone: isSens(x) ? 'red' : 'blue' })))) : h('p', { class: 'muted sm' }, 'Tidak ada catatan lain untuk entitas ini.'));
      const d = ui.drawer({ title: 'Detail audit', body, footer: ui.btn('Tutup', { onClick: () => d.close() }) });
    }

    const day1 = D.audit.filter(a => new Date(a.at) >= new Date(BGS.today - DAY)).length;
    root.appendChild(header({ title: 'Audit trail', subtitle: 'Jejak semua perubahan penting dan akses data sensitif. Hanya dapat dibaca.', mvp: 1 }));
    root.appendChild(h('div', { class: 'callout c-info' }, BGS.icon('lock', 18), h('div', null, h('b', null, 'Immutable / append-only (RUL-021, BR-028)'), h('div', null, 'Catatan hanya bisa ditambah. Tidak ada tombol ubah atau hapus di sistem ini — termasuk untuk Superadmin.'))));
    root.appendChild(h('div', { class: 'grid cols-4' },
      ui.kpi({ label: 'Total catatan', value: fmt.num(D.audit.length), icon: 'list', tone: 'blue' }), ui.kpi({ label: '24 jam terakhir', value: day1, icon: 'clock', tone: 'teal' }),
      ui.kpi({ label: 'Akses data sensitif', value: sensCount(), sub: 'reveal / RESTRICTED', icon: 'lock', tone: 'red' }), ui.kpi({ label: 'Pengguna tercatat', value: new Set(D.audit.map(a => a.userId)).size, icon: 'users', tone: 'purple' })));
    root.appendChild(ui.tabs([
      { id: 'all', label: 'Semua aktivitas', count: D.audit.length, render: () => view(false) },
      { id: 'sens', label: 'Akses data sensitif', count: sensCount(), render: () => h('div', { class: 'stack' }, ui.callout('warn', 'Akses data sensitif', 'Daftar ini memuat pembukaan dokumen RESTRICTED dan reveal NIK / paspor beserta alasannya (RUL-020, RUL-021).'), view(true)) },
    ]));
    return root;
  }

  // ================================================================ /approvals
  const AP_TYPES = {
    UBAH_TOTAL_KUOTA: ['Ubah Total Kuota', 'layers', 'blue'], REVERT_KUOTA: ['Revert kuota terpakai', 'refresh', 'orange'], MIGRASI_WORKFLOW: ['Migrasi workflow', 'git-branch', 'purple'],
    GABUNG_WORKER: ['Gabung worker duplikat', 'merge', 'teal'], CANCEL_CASE: ['Batalkan case (setelah utilized)', 'x-circle', 'red'], WAIVER_STEP: ['Waiver langkah wajib', 'alert', 'amber'],
  };
  const apType = t => AP_TYPES[t] || [t, 'check-square', 'gray'];
  const apEff = ap => (ap.status === 'PENDING' && ap.expires && new Date(ap.expires) < BGS.today ? 'EXPIRED' : ap.status);
  const apSubjectHref = ap => ({ UBAH_TOTAL_KUOTA: '/placement-codes/', REVERT_KUOTA: '/cases/', CANCEL_CASE: '/cases/', MIGRASI_WORKFLOW: '/workflows/', GABUNG_WORKER: '/workers/' }[ap.type] || null);
  const apSubject = ap => { const p = apSubjectHref(ap); return p && ap.subject ? h('a', { class: 'lnk mono', href: '#' + p + ap.subject }, ap.subject) : h('span', { class: 'mono' }, ap.subject || '—'); };
  const targetTotal = ap => {
    const p = ap.payload || {}; const v = p.newTotal ?? ap.newTotal ?? p.total ?? p.to;
    if (v != null && v !== '' && !isNaN(+v)) return +v;
    const m = /→\s*(\d+)/.exec(ap.title || ''); return m ? +m[1] : null;
  };
  const migrationInfo = ap => {
    const p = ap.payload || {}; let from = p.fromV, to = p.toV;
    if (from == null) { const m = /v(\d+)\s*(?:ke|→|->)\s*v(\d+)(?!\.)/i.exec(ap.title || ''); if (m) { from = +m[1]; to = +m[2]; } }
    const tplId = p.templateId || ap.subject; const tpl = D.template(tplId);
    const ids = p.caseIds || D.cases.filter(c => c.templateId === tplId && c.templateVersion == from && !['DEPARTED', 'CANCELLED'].includes(c.status)).map(c => c.id);
    return { tplId, tpl, from, to, ids };
  };
  function impact(ap) {
    const lines = []; let blocked = null;
    if (ap.type === 'UBAH_TOTAL_KUOTA') {
      const pc = D.placementCode((ap.payload || {}).codeId || ap.subject); const nt = targetTotal(ap);
      if (!pc) blocked = `Placement Code ${ap.subject} tidak ditemukan.`;
      else if (nt == null || !Number.isInteger(nt) || nt < 0) blocked = 'Target Total Kuota tidak terbaca dari permintaan ini.';
      else {
        lines.push(`Total ${pc.total} → ${nt}`, `Reserved ${pc.reserved} · Utilized ${pc.utilized} → Tersedia ${pc.total - pc.reserved - pc.utilized} → ${nt - pc.reserved - pc.utilized}`);
        if (nt < pc.reserved + pc.utilized) blocked = `Ditolak sistem: Total tidak boleh di bawah Reserved + Utilized = ${pc.reserved + pc.utilized} (RUL-006).`;
        else if (nt === pc.total) blocked = 'Target sama dengan Total saat ini — tidak ada perubahan.';
      }
    } else if (ap.type === 'REVERT_KUOTA') {
      const c = D.case((ap.payload || {}).caseId || ap.subject); const pc = c && D.placementCode(c.placementCodeId);
      if (!c || !pc) blocked = `Case ${ap.subject} tidak ditemukan.`;
      else if (c.status === 'CANCELLED') blocked = 'Case sudah dibatalkan; kuota sudah dilepas.';
      else lines.push(`Case ${c.id} (${(D.worker(c.workerId) || {}).name || c.workerId}) status ${(BGS.ST.case[c.status] || [c.status])[0]}`, `Kuota ${pc.id} dilepas: Tersedia ${pc.available} → ${pc.available + 1}`, 'Case akan dibatalkan dan worker kembali dapat dialokasikan.');
    } else if (ap.type === 'MIGRASI_WORKFLOW') {
      const m = migrationInfo(ap);
      if (!m.tpl) blocked = `Template ${ap.subject} tidak ditemukan.`;
      else if (m.to == null || !m.tpl.versions.find(v => v.v == m.to)) blocked = 'Versi tujuan tidak terbaca / tidak ada pada template.';
      else if (m.tpl.versions.find(v => v.v == m.to).status !== 'PUBLISHED') blocked = `Versi tujuan v${m.to} belum PUBLISHED (RUL-012).`;
      else { lines.push(`${m.tpl.name}: v${m.from} → v${m.to}`, m.ids.length ? `${m.ids.length} case berjalan akan dimigrasi (${m.ids.join(', ')})` : `Saat ini tidak ada case berjalan pada v${m.from}; versi PUBLISHED v${m.to} berlaku untuk case berikutnya.`); }
    } else if (ap.type === 'GABUNG_WORKER') {
      const w = D.worker(ap.subject); const rid = (/REG-\d{6}-\d{4}/.exec(ap.title || '') || [])[0]; const r = rid && D.registration(rid);
      lines.push(`Worker ${w ? w.name : ap.subject} dipertahankan sebagai ID utama (RUL-001)`, r ? `Registrasi ${rid} ditandai "Digabung"` : 'Keputusan dicatat di audit');
    } else lines.push('Keputusan dicatat di audit trail.');
    return { lines, blocked };
  }
  function applyEffect(ap) {
    const p = ap.payload || {};
    if (ap.type === 'UBAH_TOTAL_KUOTA') {
      const pc = D.placementCode(p.codeId || ap.subject); if (!pc) throw new Error(`Placement Code ${ap.subject} tidak ditemukan.`);
      const nt = targetTotal(ap); if (nt == null || !Number.isInteger(nt) || nt < 0) throw new Error('Target Total Kuota tidak terbaca dari permintaan.');
      BGS.computeQuota();
      if (nt < pc.reserved + pc.utilized) throw new Error(`Total ${nt} di bawah Reserved + Utilized (${pc.reserved + pc.utilized}) — ditolak sistem (RUL-006).`);
      const old = pc.total; pc.total = nt; BGS.computeQuota();
      if (pc.status === 'FULL' && pc.available > 0) pc.status = 'OPEN'; else if (pc.status === 'OPEN' && pc.available <= 0) pc.status = 'FULL';
      BGS.audit('Total kuota diubah (disetujui Director)', 'Placement Code', pc.id, `Total ${old} → ${nt}; Tersedia ${pc.available}; ref ${ap.id}; alasan pengaju: ${ap.reason}`);
      return `Total ${pc.id}: ${old} → ${nt} (Tersedia ${pc.available})`;
    }
    if (ap.type === 'REVERT_KUOTA') {
      const cid = p.caseId || ap.subject; const c = D.case(cid); if (!c) throw new Error(`Case ${cid} tidak ditemukan.`);
      const pc = D.placementCode(c.placementCodeId); BGS.computeQuota(); const before = pc ? pc.available : 0; const reason = `Revert kuota disetujui Director (${ap.id}): ${ap.reason}`;
      const dom = BGS.domain || {}; const rel = dom.applyRevertQuota || dom.releaseQuota; // applyRevertQuota = jalur resmi untuk revert yang disetujui Director
      if (typeof rel === 'function') { rel.call(dom, cid, reason); BGS.computeQuota(); }
      if (typeof rel !== 'function' || (pc && pc.available <= before && c.status !== 'CANCELLED')) {
        c.status = 'CANCELLED'; c.cancelReason = reason; c.quotaReverted = { at: nowIso(), by: BGS.state.userId, approval: ap.id }; BGS.computeQuota();
      }
      BGS.deriveWorkerStatus();
      BGS.audit('Kuota di-revert (disetujui Director)', 'Placement Case', cid, `${reason}. ${pc ? pc.id + ' Tersedia ' + before + ' → ' + pc.available : ''}`);
      return `Kuota ${pc ? pc.id : ''} dilepas dari ${cid}` + (pc ? ` (Tersedia ${before} → ${pc.available})` : '');
    }
    if (ap.type === 'MIGRASI_WORKFLOW') {
      const m = migrationInfo(ap); if (!m.tpl) throw new Error(`Template ${m.tplId} tidak ditemukan.`);
      const tv = m.tpl.versions.find(v => v.v == m.to); if (!tv) throw new Error('Versi tujuan migrasi tidak terbaca / tidak ada.'); if (tv.status !== 'PUBLISHED') throw new Error(`Versi tujuan v${m.to} belum PUBLISHED.`);
      if (m.ids.length) {
        if (BGS.domain && typeof BGS.domain.migrateCases === 'function') BGS.domain.migrateCases(m.tplId, m.from, m.to, m.ids);
        else m.ids.forEach(id => { const c = D.case(id); if (c) c.templateVersion = m.to; });
      }
      BGS.audit('Migrasi workflow disetujui Director', 'Workflow Template', m.tplId, `v${m.from} → v${m.to}; ${m.ids.length} case; ref ${ap.id}`);
      return m.ids.length ? `${m.ids.length} case dimigrasi ke v${m.to}` : `Tidak ada case berjalan pada v${m.from}; v${m.to} berlaku untuk case berikutnya`;
    }
    if (ap.type === 'GABUNG_WORKER') {
      const rid = (/REG-\d{6}-\d{4}/.exec(ap.title || '') || [])[0]; const r = rid && D.registration(rid);
      if (r && r.status === 'NEW') { r.status = 'MERGED'; r.resultWorkerId = ap.subject; r.reviewedBy = ap.requestedBy; }
      BGS.audit('Gabung worker disetujui Director', 'Worker', ap.subject, `${ap.title}; ref ${ap.id}`);
      return r ? `Registrasi ${rid} digabung ke ${ap.subject}` : 'Keputusan penggabungan dicatat';
    }
    BGS.audit('Persetujuan diberikan', 'Approval', ap.id, ap.title); return 'Keputusan dicatat';
  }
  function sweepExpired() {
    D.approvals.forEach(ap => { if (ap.status === 'PENDING' && apEff(ap) === 'EXPIRED') { ap.status = 'EXPIRED'; ap.decidedAt = ap.expires; BGS.audit('Permintaan persetujuan kedaluwarsa', 'Approval', ap.id, ap.title); } });
  }
  const countdown = iso => {
    const ms = new Date(iso) - BGS.today; if (ms <= 0) return { text: 'Sudah kedaluwarsa', tone: 'red' };
    const hrs = Math.floor(ms / 3600000); const dd = Math.floor(hrs / 24);
    return { text: hrs < 24 ? `Kedaluwarsa dalam ${hrs} jam` : `Kedaluwarsa dalam ${dd} hari${hrs % 24 ? ' ' + (hrs % 24) + ' jam' : ''}`, tone: hrs <= 24 ? 'red' : hrs <= 72 ? 'amber' : 'gray' };
  };

  let apTab = 'pending';
  function approvalsPage(ctx) {
    sweepExpired();
    const canDecide = BGS.can('approval.decide');
    const pending = D.approvals.filter(a => a.status === 'PENDING').sort((a, b) => new Date(a.expires) - new Date(b.expires));
    const history = D.approvals.filter(a => a.status !== 'PENDING');
    const root = h('div', { class: 'stack' });

    async function approve(ap) {
      const imp = impact(ap); if (imp.blocked) { ui.toast(imp.blocked, 'danger'); return; }
      const note = h('textarea', { class: 'input', rows: 2, placeholder: 'Catatan keputusan (opsional)…' });
      const m = ui.modal({
        title: `Setujui: ${apType(ap.type)[0]}`, size: 'md',
        body: h('div', { class: 'stack' }, h('div', null, h('b', null, ap.title), h('div', { class: 'muted sm' }, `Diajukan ${userName(ap.requestedBy)} · ${fmt.dateTime(ap.at)}`)), h('div', { class: 'adm-quote' }, ap.reason),
          h('div', { class: 'adm-impact' }, h('b', null, 'Dampak yang akan diterapkan:'), h('ul', null, imp.lines.map(l => h('li', null, l)))), fld('Catatan', note)),
        footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Setujui & terapkan', { kind: 'good', icon: 'check', onClick: () => {
          try {
            const eff = applyEffect(ap);
            ap.status = 'APPROVED'; ap.decidedBy = BGS.state.userId; ap.decidedAt = nowIso(); ap.effectNote = eff; if (note.value.trim()) ap.decisionReason = note.value.trim();
            BGS.audit('Persetujuan disetujui', 'Approval', ap.id, `${ap.title}. Hasil: ${eff}${note.value.trim() ? '. Catatan: ' + note.value.trim() : ''}`);
            BGS.notify(ap.requestedBy, `Permintaan ${ap.id} disetujui Director: ${ap.title}`, '#/approvals', 'APPROVAL');
            m.close(); ui.toast(`${ap.id} disetujui. ${eff}`); apTab = 'pending'; ctx.refresh();
          } catch (e) { ui.toast(e.message, 'danger'); }
        } })],
      });
    }
    async function reject(ap) {
      const reason = await ui.reasonPrompt({ title: `Tolak ${ap.id}`, message: ap.title, label: 'Alasan penolakan', confirmLabel: 'Tolak permintaan', tone: 'danger', presets: ['Belum ada dasar yang cukup', 'Menunggu verifikasi hukum', 'Tidak sesuai kebijakan'] });
      if (!reason) return;
      ap.status = 'REJECTED'; ap.decidedBy = BGS.state.userId; ap.decidedAt = nowIso(); ap.decisionReason = reason;
      BGS.audit('Persetujuan ditolak', 'Approval', ap.id, `${ap.title}. Alasan: ${reason}`);
      BGS.notify(ap.requestedBy, `Permintaan ${ap.id} ditolak Director: ${reason}`, '#/approvals', 'APPROVAL');
      ui.toast(`${ap.id} ditolak`, 'warn'); ctx.refresh();
    }

    function card(ap) {
      const [label, icon, tone] = apType(ap.type); const cd = countdown(ap.expires); const imp = impact(ap);
      const own = ap.requestedBy === BGS.state.userId;
      const why = !canDecide ? 'Hanya Director yang dapat memutuskan persetujuan strategis (BR-027).' : own ? 'Anda pengaju permintaan ini — tidak boleh menyetujui sendiri (RUL-016).' : null;
      return h('div', { class: 'adm-ap' + (cd.tone === 'red' ? ' urgent' : '') },
        h('div', { class: 'stack-sm' },
          h('div', { class: 'row wrap gap-sm' }, ui.badge(label, tone), h('span', { class: 'mono muted' }, ap.id), ui.badge(cd.text, cd.tone, { dot: true })),
          h('div', { style: 'font-weight:800;font-size:15px' }, ap.title),
          h('div', { class: 'row wrap sm muted' }, h('span', null, 'Subjek: ', apSubject(ap)), h('span', null, 'Pengaju: ', ui.userChip(ap.requestedBy)), h('span', null, `${fmt.dateTime(ap.at)} (${fmt.rel(ap.at)})`)),
          h('div', { class: 'adm-quote' }, h('span', { class: 'muted sm' }, 'Alasan pengaju: '), ap.reason),
          h('div', { class: 'adm-impact' + (imp.blocked ? ' bad' : '') }, h('b', null, imp.blocked ? 'Tidak dapat disetujui: ' : 'Jika disetujui: '), imp.blocked ? imp.blocked : h('ul', null, imp.lines.map(l => h('li', null, l))))),
        h('div', { class: 'adm-ap-act' },
          ui.btn('Setujui', { kind: 'good', icon: 'check', disabled: !!why || !!imp.blocked, title: why || imp.blocked || 'Setujui dan terapkan efeknya', onClick: () => approve(ap) }),
          ui.btn('Tolak', { kind: 'danger', icon: 'x', disabled: !!why, title: why || 'Tolak (alasan wajib)', onClick: () => reject(ap) }),
          why && h('div', { class: 'muted xs', style: 'max-width:170px' }, why)));
    }

    function pendingView() {
      if (!pending.length) return ui.card({ body: ui.emptyState({ icon: 'check-circle', title: 'Tidak ada permintaan menunggu', text: 'Semua permintaan persetujuan sudah diputuskan. Lihat tab Riwayat.' }) });
      return h('div', { class: 'stack' }, !canDecide && ui.callout('info', 'Mode lihat saja', 'Persetujuan strategis hanya diputuskan oleh Director (BR-027). Anda dapat memantau antriannya di sini.'), pending.map(card));
    }
    function historyView() {
      return ui.card({ flush: true, body: ui.listView({
        items: () => D.approvals.filter(a => a.status !== 'PENDING').map(a => Object.assign({}, a)), search: a => `${a.id} ${a.title} ${a.subject} ${a.reason} ${userName(a.requestedBy)}`, searchPlaceholder: 'Cari permintaan…', pageSize: 8,
        filters: [{ key: 'type', label: 'Jenis', options: Object.keys(AP_TYPES).map(k => [k, AP_TYPES[k][0]]) }, { key: 'status', label: 'Status', options: [['APPROVED', 'Disetujui'], ['REJECTED', 'Ditolak'], ['EXPIRED', 'Kedaluwarsa']] }],
        empty: ui.emptyState({ icon: 'clock', title: 'Belum ada riwayat', text: 'Keputusan akan tampil di sini.' }),
        columns: [
          { key: 'id', label: 'ID', render: a => h('span', { class: 'mono nowrap' }, a.id) },
          { key: 'type', label: 'Jenis', render: a => ui.badge(apType(a.type)[0], apType(a.type)[2]) },
          { key: 'title', label: 'Permintaan', render: a => h('div', null, h('div', { style: 'font-weight:600' }, a.title), h('div', { class: 'sm' }, apSubject(a))) },
          { key: 'req', label: 'Pengaju', render: a => ui.userChip(a.requestedBy) },
          { key: 'status', label: 'Status', render: a => ui.status('approval', a.status) },
          { key: 'by', label: 'Diputuskan', render: a => (a.decidedBy ? h('div', null, ui.userChip(a.decidedBy), h('div', { class: 'muted sm' }, fmt.dateTime(a.decidedAt))) : h('span', { class: 'muted' }, a.status === 'EXPIRED' ? 'Tidak diputuskan (kedaluwarsa ' + fmt.date(a.expires) + ')' : '—')) },
          { key: 'note', label: 'Alasan / hasil', render: a => h('div', { class: 'sm' }, a.decisionReason && h('div', null, a.decisionReason), a.effectNote && h('div', { class: 'muted' }, 'Hasil: ' + a.effectNote), !a.decisionReason && !a.effectNote && '—') },
        ] }) });
    }
    root.appendChild(header({ title: 'Persetujuan', subtitle: 'Permintaan proses strategis yang menunggu keputusan Director: ubah Total Kuota, revert kuota, migrasi workflow, gabung worker.', mvp: 2 }));
    root.appendChild(h('div', { class: 'grid cols-3' },
      ui.kpi({ label: 'Menunggu', value: pending.length, sub: pending.some(a => countdown(a.expires).tone === 'red') ? 'Ada yang hampir kedaluwarsa' : 'antrian aktif', icon: 'clock', tone: 'amber' }),
      ui.kpi({ label: 'Disetujui', value: history.filter(a => a.status === 'APPROVED').length, icon: 'check-circle', tone: 'green' }),
      ui.kpi({ label: 'Ditolak / kedaluwarsa', value: history.filter(a => a.status !== 'APPROVED').length, icon: 'x-circle', tone: 'red' })));
    root.appendChild(ui.tabs([
      { id: 'pending', label: 'Menunggu', count: pending.length, render: pendingView }, { id: 'history', label: 'Riwayat', count: history.length, render: historyView },
    ], { active: apTab, onChange: t => { apTab = t; } }));
    root.appendChild(h('p', { class: 'muted sm' }, 'Aturan: penolakan wajib alasan (RUL-022); pengaju tidak boleh menyetujui sendiri (RUL-016); perubahan Total tidak boleh di bawah Reserved + Utilized (RUL-006); REVERT kuota utilized hanya via approval Director (RUL-007).'));
    return root;
  }

  // ================================================================ /data-protection
  const DSR_TYPES = { AKSES: ['Akses data', 'blue'], KOREKSI: ['Koreksi data', 'amber'], PENGHAPUSAN: ['Penghapusan data', 'red'] };
  const DSR_STATUS = { DITERIMA: ['Diterima', 'blue'], DIPROSES: ['Diproses', 'amber'], SELESAI: ['Selesai', 'green'], DITOLAK: ['Ditolak', 'red'] };
  const DSR_DEFAULT_DAYS = 14;
  const activeApp = w => D.applications.some(a => a.workerId === w.id && !['REJECTED', 'WITHDRAWN', 'CANCELLED'].includes(a.status));
  const activeCase = w => D.cases.some(c => c.workerId === w.id && !['DEPARTED', 'CANCELLED'].includes(c.status));
  const lastActivity = w => Math.max(new Date(w.createdAt), ...D.applications.filter(a => a.workerId === w.id).map(a => new Date(a.createdAt)), ...D.cases.filter(c => c.workerId === w.id).map(c => new Date(c.createdAt)));
  let dpTab = 'consent';

  function dataProtectionPage(ctx) {
    D.retentionPolicy = D.retentionPolicy || { decided: false, workerInactiveMonths: '', rejectedAppMonths: '', restrictedDocsMonths: '', ref: '' };
    const root = h('div', { class: 'stack' });
    const canDsr = BGS.can('dsr.manage'); const canLegal = BGS.isRole(SA, DI);
    const cur = () => D.consentVersions.find(v => v.current);
    const liveWorkers = () => D.workers.filter(w => w.status !== 'ARCHIVED');

    // ---------- consent
    function publishConsent() {
      const code = h('input', { class: 'input', placeholder: 'PN-2027.1' }), date = h('input', { class: 'input', type: 'date', value: BGS.today.toISOString().slice(0, 10) }), note = h('textarea', { class: 'input', rows: 3, placeholder: 'Ringkasan perubahan isi pemberitahuan privasi…' });
      const e1 = errBox(), e2 = errBox();
      const m = ui.modal({
        title: 'Publikasikan versi consent baru', size: 'md',
        body: h('div', { class: 'stack' }, ui.callout('warn', 'Perlu verifikasi hukum', 'Isi pemberitahuan privasi harus ditinjau konsultan hukum sebelum dipublikasikan (BR-030). Versi sebelumnya otomatis menjadi "bukan versi berlaku" dan tidak dihapus.'),
          h('div', { class: 'form-grid cols-2' }, fld('Kode versi', code, 'Format PN-TTTT.N, mis. PN-2027.1', true, e1), fld('Tanggal berlaku', date, null, true)), fld('Ringkasan perubahan', note, null, true, e2)),
        footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Publikasikan', { kind: 'primary', onClick: () => {
          showErr(e1, ''); showErr(e2, ''); let ok = true; const c = code.value.trim().toUpperCase();
          if (!/^PN-\d{4}\.\d+$/.test(c)) { showErr(e1, 'Gunakan format PN-TTTT.N, mis. PN-2027.1'); ok = false; } else if (D.consentVersions.some(v => v.version === c)) { showErr(e1, 'Kode versi sudah ada'); ok = false; }
          if (!note.value.trim()) { showErr(e2, 'Ringkasan wajib diisi'); ok = false; } if (!ok) return;
          const prev = cur(); D.consentVersions.forEach(v => { v.current = false; });
          D.consentVersions.unshift({ version: c, publishedAt: date.value, current: true, note: note.value.trim(), accepted: 0 });
          BGS.audit('Versi consent dipublikasikan', 'Consent', c, `Menggantikan ${prev ? prev.version : '—'}; ${note.value.trim()}`);
          m.close(); ui.toast(`Versi ${c} dipublikasikan`); dpTab = 'consent'; ctx.refresh();
        } })],
      });
    }
    async function recordConsent(w) {
      const ref = await ui.reasonPrompt({ title: `Catat consent ulang — ${w.name}`, message: `Versi berlaku: ${cur().version}. Input manual wajib disertai bukti consent (RUL-029).`, label: 'Bukti consent (mis. nomor formulir bertanda tangan)', confirmLabel: 'Catat consent' });
      if (!ref) return;
      w.consent = { version: cur().version, at: BGS.today.toISOString(), channel: 'Formulir bertanda tangan (Admin)', evidence: ref };
      BGS.audit('Consent dicatat ulang', 'Worker', w.id, `Versi ${cur().version}; bukti: ${ref}`); ui.toast('Consent tercatat'); ctx.refresh();
    }
    function consentView() {
      const c = cur(); const lw = liveWorkers(); const withC = lw.filter(w => c && w.consent && w.consent.version === c.version); const lacking = lw.filter(w => !(c && w.consent && w.consent.version === c.version));
      const pct = lw.length ? Math.round((withC.length / lw.length) * 100) : 0;
      const channels = {}; lw.forEach(w => { const k = (w.consent && w.consent.channel) || 'Tidak tercatat'; channels[k] = (channels[k] || 0) + 1; });
      return h('div', { class: 'stack' },
        h('div', { class: 'grid cols-3' },
          ui.kpi({ label: 'Versi berlaku', value: c ? c.version : '—', sub: c ? 'terbit ' + fmt.date(c.publishedAt) : '', icon: 'file-text', tone: 'blue' }),
          ui.kpi({ label: 'Cakupan consent terbaru', value: pct + '%', sub: `${withC.length} dari ${lw.length} worker`, icon: 'shield', tone: pct >= 95 ? 'green' : pct >= 70 ? 'amber' : 'red' }),
          ui.kpi({ label: 'Belum pada versi terbaru', value: lacking.length, sub: 'perlu consent ulang', icon: 'alert', tone: lacking.length ? 'amber' : 'green' })),
        ui.card({ title: 'Versi pemberitahuan privasi', icon: 'file-text', actions: [ui.btn('Publikasikan versi baru', { kind: 'primary', icon: 'plus', disabled: !canLegal, title: canLegal ? '' : 'Hanya Superadmin / Director', onClick: publishConsent })], flush: true,
          body: ui.table({ pageSize: 6, rows: D.consentVersions, columns: [
            { key: 'version', label: 'Versi', render: v => h('span', { class: 'mono', style: 'font-weight:700' }, v.version) }, { key: 'publishedAt', label: 'Terbit', render: v => fmt.date(v.publishedAt) },
            { key: 'current', label: 'Status', render: v => (v.current ? ui.badge('Berlaku', 'green', { dot: true }) : ui.badge('Sebelumnya', 'gray')) }, { key: 'note', label: 'Catatan', render: v => v.note },
            { key: 'n', label: 'Worker pada versi ini', align: 'right', render: v => D.workers.filter(w => w.consent && w.consent.version === v.version).length },
          ] }) }),
        h('div', { class: 'grid cols-2' },
          ui.card({ title: 'Kanal consent', icon: 'inbox', body: ui.barChart({ horizontal: true, data: Object.entries(channels).map(([label, value]) => ({ label, value })) }) }),
          ui.card({ title: 'Aturan consent', icon: 'info', body: h('ul', { style: 'margin:0;padding-left:18px', class: 'stack-sm' }, ['Registrasi publik: consent berversi, waktu, dan kanal wajib tercatat sebelum data disimpan (RUL-029).', 'Input manual Admin wajib menyimpan bukti consent (formulir bertanda tangan / rekaman).', 'Versi lama tidak dihapus; hanya ditandai bukan versi berlaku.', 'Teks pemberitahuan privasi masih menunggu verifikasi hukum (BR-030).'].map(t => h('li', null, t))) })),
        lacking.length ? ui.card({ title: `Worker belum pada versi ${c ? c.version : ''}`, subtitle: 'Mintalah consent ulang saat berkomunikasi berikutnya, lalu catat bukti.', icon: 'users', flush: true,
          body: ui.table({ pageSize: 6, rows: lacking, columns: [{ key: 'name', label: 'Worker', render: w => ui.workerLink(w.id) }, { key: 'v', label: 'Versi tercatat', render: w => (w.consent ? w.consent.version : '—') }, { key: 'ch', label: 'Kanal', render: w => (w.consent ? w.consent.channel : '—') },
            { key: 'a', label: '', render: w => ui.btn('Catat consent ulang', { sm: true, disabled: !BGS.can('worker.write'), title: BGS.can('worker.write') ? '' : 'Hanya Superadmin / Admin', onClick: () => recordConsent(w) }) }] }) }) : null);
    }

    // ---------- subject requests
    function srDue(r) {
      if (['SELESAI', 'DITOLAK'].includes(r.status)) return h('span', { class: 'muted' }, r.closedAt ? 'Ditutup ' + fmt.date(r.closedAt) : 'Selesai');
      const d = fmt.daysFrom(r.due); return ui.badge(d < 0 ? `Terlambat ${-d} hari` : d === 0 ? 'Jatuh tempo hari ini' : `${d} hari lagi`, d < 0 ? 'red' : d <= 3 ? 'amber' : 'green', { dot: true });
    }
    function srLog(r, text) { (r.history = r.history || []).push({ at: nowIso(), by: BGS.state.userId, text }); }
    function newSr() {
      const sel = h('select', { class: 'input' }, h('option', { value: '' }, '— pilih worker —'), liveWorkers().map(w => h('option', { value: w.id }, `${w.name} (${w.id})`)));
      const type = h('select', { class: 'input' }, Object.entries(DSR_TYPES).map(([k, [l]]) => h('option', { value: k }, l)));
      const note = h('textarea', { class: 'input', rows: 3, placeholder: 'Ringkas permintaan dari subjek data…' }); const days = h('input', { class: 'input', type: 'number', min: 1, max: 60, value: DSR_DEFAULT_DAYS });
      const e1 = errBox(), e2 = errBox();
      const m = ui.modal({
        title: 'Catat permintaan subjek data', size: 'md',
        body: h('div', { class: 'stack' }, ui.callout('info', 'Hak subjek data (FR-PDP-002)', 'Catat permintaan akses, koreksi, atau penghapusan dari worker. Penghapusan hanya berarti arsip (soft delete); hard delete menunggu kebijakan retensi (RUL-026, OQ-15).'),
          h('div', { class: 'form-grid cols-2' }, fld('Worker (subjek data)', sel, null, true, e1), fld('Jenis permintaan', type, null, true)), fld('Catatan permintaan', note, null, true, e2), fld('Batas waktu (hari)', days, `Default ${DSR_DEFAULT_DAYS} hari — angka resmi belum ditetapkan owner / DPO (OQ-15).`)),
        footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn('Simpan permintaan', { kind: 'primary', onClick: () => {
          showErr(e1, ''); showErr(e2, ''); let ok = true; if (!sel.value) { showErr(e1, 'Pilih worker'); ok = false; } if (!note.value.trim()) { showErr(e2, 'Catatan wajib diisi'); ok = false; } if (!ok) return;
          const w = D.worker(sel.value); const n = Math.max(1, Math.min(60, +days.value || DSR_DEFAULT_DAYS));
          const r = { id: 'SR-' + pad(D.subjectRequests.length + 1, 3), type: type.value, subject: w.id, requester: w.name, at: BGS.today.toISOString(), due: new Date(BGS.today.getTime() + n * DAY).toISOString(), status: 'DITERIMA', note: note.value.trim(), history: [] };
          srLog(r, 'Permintaan dicatat'); D.subjectRequests.unshift(r); BGS.audit('Permintaan subjek data dicatat', 'Subject Request', r.id, `${DSR_TYPES[r.type][0]} — ${w.name} (${w.id})`);
          m.close(); ui.toast(`Permintaan ${r.id} dicatat`); dpTab = 'sr'; ctx.refresh();
        } })],
      });
    }
    function startSr(r) { r.status = 'DIPROSES'; srLog(r, 'Mulai diproses'); BGS.audit('Permintaan subjek data diproses', 'Subject Request', r.id, r.type); ui.toast(`${r.id} mulai diproses`); dpTab = 'sr'; ctx.refresh(); }
    async function rejectSr(r) {
      const reason = await ui.reasonPrompt({ title: `Tolak permintaan ${r.id}`, label: 'Alasan penolakan', tone: 'danger', confirmLabel: 'Tolak', presets: ['Identitas pemohon belum terverifikasi', 'Data diwajibkan disimpan oleh peraturan'] }); if (!reason) return;
      r.status = 'DITOLAK'; r.closedAt = nowIso(); r.closeNote = reason; srLog(r, 'Ditolak: ' + reason); BGS.audit('Permintaan subjek data ditolak', 'Subject Request', r.id, reason); ui.toast(`${r.id} ditolak`, 'warn'); dpTab = 'sr'; ctx.refresh();
    }
    function completeSr(r) {
      const w = D.worker(r.subject); const note = h('textarea', { class: 'input', rows: 3, placeholder: 'Contoh: salinan data diserahkan langsung ke worker pada …' }); const e = errBox();
      const blockers = r.type === 'PENGHAPUSAN' && w ? [activeCase(w) && 'masih punya Placement Case aktif', activeApp(w) && 'masih punya lamaran aktif'].filter(Boolean) : [];
      const m = ui.modal({
        title: `Selesaikan ${r.id} — ${DSR_TYPES[r.type][0]}`, size: 'md',
        body: h('div', { class: 'stack' },
          r.type === 'PENGHAPUSAN' && ui.callout(blockers.length ? 'danger' : 'warn', 'Penghapusan = arsip (soft delete)', blockers.length ? `Worker ${blockers.join(' dan ')}. Selesaikan atau batalkan proses itu dulu sebelum mengarsipkan.` : 'Worker akan berstatus ARCHIVED dan tidak lagi dihitung pada keunikan NIK. Data tidak dihapus permanen; hard delete menunggu kebijakan retensi (RUL-026, OQ-15).'),
          r.type === 'KOREKSI' && ui.callout('info', 'Koreksi data', h('span', null, 'Lakukan koreksi di ', w ? h('a', { class: 'lnk', href: '#/workers/' + w.id }, 'profil worker') : 'profil worker', ' terlebih dahulu, lalu tulis ringkasan koreksi di bawah.')),
          r.type === 'AKSES' && h('div', { class: 'row' }, ui.btn('Siapkan salinan data (CSV)', { icon: 'download', disabled: !w || !BGS.can('export'), title: BGS.can('export') ? '' : 'Tidak punya izin ekspor', onClick: () => w && BGS.exportCsv([w], [{ label: 'Worker ID', key: 'id' }, { label: 'Nama', key: 'name' }, { label: 'NIK (tersamar)', value: x => BGS.mask.nik(x.nik) }, { label: 'Paspor (tersamar)', value: x => BGS.mask.passport(x.passport) }, { label: 'Telepon (tersamar)', value: x => BGS.mask.phone(x.phone) }, { label: 'Kota', key: 'city' }, { label: 'Pendidikan', key: 'education' }, { label: 'Consent', value: x => (x.consent ? x.consent.version : '') }], `salinan-data-${w.id}.csv`) }), h('span', { class: 'muted sm' }, 'Data sensitif disamarkan; serahkan versi lengkap secara langsung setelah verifikasi identitas.')),
          fld('Catatan penyelesaian', note, 'Wajib: apa yang dilakukan dan kapan diserahkan.', true, e)),
        footer: [ui.btn('Batal', { onClick: () => m.close() }), ui.btn(r.type === 'PENGHAPUSAN' ? 'Arsipkan & selesaikan' : 'Selesaikan', { kind: 'good', disabled: blockers.length > 0, onClick: () => {
          if (!note.value.trim()) { showErr(e, 'Catatan penyelesaian wajib diisi'); return; }
          if (r.type === 'PENGHAPUSAN' && w) { w.status = 'ARCHIVED'; w.archivedAt = nowIso(); w.archiveReason = `Permintaan subjek data ${r.id}`; BGS.audit('Worker diarsipkan (soft delete)', 'Worker', w.id, `Permintaan ${r.id}; tanpa hard delete (RUL-026)`); }
          r.status = 'SELESAI'; r.closedAt = nowIso(); r.closeNote = note.value.trim(); srLog(r, 'Selesai: ' + note.value.trim());
          BGS.audit('Permintaan subjek data selesai', 'Subject Request', r.id, `${DSR_TYPES[r.type][0]}: ${note.value.trim()}`); m.close(); ui.toast(`${r.id} selesai`); dpTab = 'sr'; ctx.refresh();
        } })],
      });
    }
    function srDetail(r) {
      const w = D.worker(r.subject); const steps = ['Diterima', 'Diproses', 'Selesai']; const idx = r.status === 'DITERIMA' ? 0 : r.status === 'DIPROSES' ? 1 : 3;
      const open = !['SELESAI', 'DITOLAK'].includes(r.status);
      const body = h('div', { class: 'stack' }, ui.stepper(steps, idx), r.status === 'DITOLAK' && ui.callout('danger', 'Permintaan ditolak', r.closeNote),
        ui.kv([['ID', h('span', { class: 'mono' }, r.id)], ['Jenis', ui.badge(DSR_TYPES[r.type][0], DSR_TYPES[r.type][1])], ['Subjek data', w ? ui.workerLink(w.id) : r.subject], ['Pemohon', r.requester], ['Diterima', fmt.dateTime(r.at)], ['Batas waktu', fmt.date(r.due)], ['Status', ui.badge(DSR_STATUS[r.status][0], DSR_STATUS[r.status][1], { dot: true })], ['Catatan', r.note], r.closeNote && r.status === 'SELESAI' && ['Catatan penyelesaian', r.closeNote]]),
        r.type === 'PENGHAPUSAN' && ui.callout('info', 'Soft delete saja', 'Penghapusan berarti arsip. Hard delete / anonimisasi hanya via proses retensi PDP terdokumentasi (RUL-026, FR-PDP-003).'),
        (r.history && r.history.length) ? h('div', null, h('h4', { style: 'margin-bottom:6px' }, 'Riwayat'), ui.timeline(r.history.map(x => ({ text: x.text, at: x.at, by: x.by, tone: 'blue' })))) : null);
      const d = ui.drawer({ title: `${r.id} — ${DSR_TYPES[r.type][0]}`, body, footer: [ui.btn('Tutup', { onClick: () => d.close() }), open && canDsr && r.status === 'DITERIMA' && ui.btn('Mulai proses', { kind: 'primary', onClick: () => { d.close(); startSr(r); } }), open && canDsr && ui.btn('Selesaikan', { kind: 'good', onClick: () => { d.close(); completeSr(r); } })] });
    }
    function srView() {
      const open = D.subjectRequests.filter(r => !['SELESAI', 'DITOLAK'].includes(r.status)); const late = open.filter(r => fmt.daysFrom(r.due) < 0);
      return h('div', { class: 'stack' },
        h('div', { class: 'grid cols-3' }, ui.kpi({ label: 'Terbuka', value: open.length, icon: 'inbox', tone: 'blue' }), ui.kpi({ label: 'Terlambat', value: late.length, icon: 'alert', tone: late.length ? 'red' : 'green' }), ui.kpi({ label: 'Selesai', value: D.subjectRequests.length - open.length, icon: 'check-circle', tone: 'green' })),
        ui.callout('info', 'Penghapusan = arsip', 'Permintaan penghapusan hanya mengarsipkan worker (soft delete). Tidak ada hard delete sampai kebijakan retensi ditetapkan (RUL-026, A-21, OQ-15).'),
        ui.card({ flush: true, body: ui.listView({
          items: () => D.subjectRequests, pageSize: 8, search: r => `${r.id} ${r.requester} ${r.subject} ${r.note}`, searchPlaceholder: 'Cari permintaan…', onRowClick: srDetail,
          filters: [{ key: 'type', label: 'Jenis', options: Object.entries(DSR_TYPES).map(([k, v]) => [k, v[0]]) }, { key: 'status', label: 'Status', options: Object.entries(DSR_STATUS).map(([k, v]) => [k, v[0]]) }],
          toolbar: ui.btn('Catat permintaan', { kind: 'primary', icon: 'plus', disabled: !canDsr, title: canDsr ? '' : 'Hanya Superadmin / Admin', onClick: newSr }),
          empty: ui.emptyState({ icon: 'inbox', title: 'Belum ada permintaan subjek data', text: 'Catat permintaan akses, koreksi, atau penghapusan dari worker.' }),
          rowClass: r => (!['SELESAI', 'DITOLAK'].includes(r.status) && fmt.daysFrom(r.due) < 0 ? 'row-danger' : ''),
          columns: [
            { key: 'id', label: 'ID', render: r => h('span', { class: 'mono nowrap' }, r.id) }, { key: 'type', label: 'Jenis', render: r => ui.badge(DSR_TYPES[r.type][0], DSR_TYPES[r.type][1]) },
            { key: 'who', label: 'Subjek data', render: r => h('div', null, ui.workerLink(r.subject), h('div', { class: 'muted sm' }, r.note)) }, { key: 'at', label: 'Diterima', render: r => fmt.date(r.at) },
            { key: 'due', label: 'Batas waktu', render: r => h('div', null, h('div', null, fmt.date(r.due)), srDue(r)) }, { key: 'status', label: 'Status', render: r => ui.badge(DSR_STATUS[r.status][0], DSR_STATUS[r.status][1], { dot: true }) },
            { key: 'a', label: '', render: r => (['SELESAI', 'DITOLAK'].includes(r.status) ? null : h('div', { class: 'row gap-sm' }, r.status === 'DITERIMA' && ui.btn('Proses', { sm: true, disabled: !canDsr, title: canDsr ? '' : 'Hanya Superadmin / Admin', onClick: () => startSr(r) }), ui.btn('Selesaikan', { sm: true, kind: 'good', disabled: !canDsr, title: canDsr ? '' : 'Hanya Superadmin / Admin', onClick: () => completeSr(r) }), ui.btn('Tolak', { sm: true, disabled: !canDsr, title: canDsr ? '' : 'Hanya Superadmin / Admin', onClick: () => rejectSr(r) }))) },
          ] }) }));
    }

    // ---------- retention
    function retentionView() {
      const pol = D.retentionPolicy; const canSave = BGS.isRole(SA); let months = 12;
      const mkNum = (key, ph) => h('input', { class: 'input', type: 'number', min: 1, value: pol[key], placeholder: ph, disabled: !canSave, onInput: updSave });
      const f1 = mkNum('workerInactiveMonths', 'belum ditetapkan'), f2 = mkNum('rejectedAppMonths', 'belum ditetapkan'), f3 = mkNum('restrictedDocsMonths', 'belum ditetapkan');
      const decided = h('input', { type: 'checkbox', checked: pol.decided, disabled: !canSave, onChange: updSave }); const ref = h('input', { class: 'input', value: pol.ref, placeholder: 'Nomor / tanggal keputusan owner', disabled: !canSave, onInput: updSave });
      const saveBtn = ui.btn('Simpan kebijakan', { kind: 'primary', disabled: true, onClick: () => {
        Object.assign(pol, { workerInactiveMonths: +f1.value, rejectedAppMonths: +f2.value, restrictedDocsMonths: +f3.value, decided: true, ref: ref.value.trim(), decidedAt: nowIso(), decidedBy: BGS.state.userId });
        BGS.audit('Kebijakan retensi ditetapkan', 'Kebijakan retensi', 'RET-001', `Arsip worker nonaktif ${pol.workerInactiveMonths} bln; lamaran ditolak ${pol.rejectedAppMonths} bln; dokumen RESTRICTED ${pol.restrictedDocsMonths} bln; ref ${pol.ref}`);
        ui.toast('Kebijakan retensi disimpan'); dpTab = 'ret'; ctx.refresh();
      } });
      function updSave() { saveBtn.disabled = !(canSave && decided.checked && ref.value.trim() && +f1.value > 0 && +f2.value > 0 && +f3.value > 0); }
      updSave();
      const dry = h('div'); const archBtn = ui.btn('', { kind: 'danger', icon: 'trash' });
      const drawDry = () => {
        BGS.clear(dry); const cutoff = BGS.today.getTime() - months * 30 * DAY;
        const cands = D.workers.filter(w => w.status === 'INACTIVE' && !activeApp(w) && !activeCase(w) && lastActivity(w) < cutoff);
        dry.appendChild(cands.length ? ui.table({ pageSize: 6, dense: true, rows: cands, columns: [{ key: 'name', label: 'Worker', render: w => ui.workerLink(w.id) }, { key: 'last', label: 'Aktivitas terakhir', render: w => fmt.date(new Date(lastActivity(w))) }, { key: 'why', label: 'Alasan masuk daftar', render: w => h('span', { class: 'sm' }, `Tidak ada lamaran / case aktif > ${months} bulan`) }, { key: 'act', label: 'Tindakan', render: () => ui.badge('Arsip (soft delete)', 'gray') }] })
          : ui.emptyState({ icon: 'check-circle', title: 'Tidak ada kandidat', text: `Tidak ada worker nonaktif tanpa aktivitas lebih dari ${months} bulan.` }));
        archBtn.textContent = ''; archBtn.appendChild(BGS.icon('trash', 16)); archBtn.append(`Arsipkan ${cands.length} kandidat`);
        const ok = pol.decided && canSave && cands.length > 0; archBtn.disabled = !ok; archBtn.title = !pol.decided ? 'Terkunci: kebijakan retensi belum ditetapkan owner (OQ-15)' : !canSave ? 'Hanya Superadmin' : '';
        archBtn.onclick = async () => { const go = await ui.confirm({ title: 'Arsipkan kandidat?', message: `${cands.length} worker akan berstatus ARCHIVED (soft delete). Tidak ada data yang dihapus permanen.`, tone: 'danger', confirmLabel: 'Arsipkan' }); if (!go) return; cands.forEach(w => { w.status = 'ARCHIVED'; w.archivedAt = nowIso(); w.archiveReason = 'Retensi ' + pol.ref; BGS.audit('Worker diarsipkan (retensi)', 'Worker', w.id, `Soft delete; ref ${pol.ref}`); }); ui.toast(`${cands.length} worker diarsipkan`); dpTab = 'ret'; ctx.refresh(); };
      };
      const mSel = h('select', { class: 'input sel', onChange: e => { months = +e.target.value; drawDry(); } }, [6, 12, 24, 36].map(m => h('option', { value: m, selected: m === months }, `${m} bulan`)));
      drawDry();
      return h('div', { class: 'stack' },
        ui.callout('warn', 'Kebijakan retensi belum ditetapkan (OQ-15)', 'Owner dan konsultan hukum belum memutuskan berapa lama data disimpan. Sampai itu terjadi, tidak ada penghapusan data (A-21).'),
        ui.callout('good', 'Tidak ada hard delete', 'Penghapusan di sistem ini selalu soft delete / arsip. Hard delete atau anonimisasi hanya lewat proses retensi PDP terdokumentasi (RUL-026, FR-PDP-003) — belum tersedia.'),
        h('div', { class: 'grid cols-2' },
          ui.card({ title: 'Formulir kebijakan retensi', icon: 'clock', body: h('div', { class: 'stack' },
            !canSave && readOnlyNote('Hanya Superadmin yang dapat mengisi kebijakan setelah owner memutuskan.'),
            fld('Arsipkan worker nonaktif setelah (bulan)', f1, 'Tanpa lamaran / case aktif.'), fld('Simpan data lamaran ditolak selama (bulan)', f2), fld('Simpan dokumen RESTRICTED setelah arsip (bulan)', f3),
            fld('Audit trail', h('input', { class: 'input', value: 'Tidak pernah dihapus (append-only)', disabled: true }), 'Tetap sesuai RUL-021.'),
            h('label', { class: 'field field-check' }, decided, h('span', null, 'Kebijakan ini sudah diputuskan owner (Direktur + konsultan hukum)')), fld('Referensi keputusan', ref),
            h('div', { class: 'row between' }, hint(pol.decided ? `Ditetapkan: ${pol.ref}` : 'Tombol simpan aktif setelah semua kolom terisi dan owner memutuskan.', 'info'), saveBtn))
          }),
          ui.card({ title: 'Simulasi (dry-run) kandidat arsip', icon: 'list', subtitle: 'Hanya simulasi — tidak ada data yang diubah.', actions: [h('label', { class: 'row gap-sm sm muted' }, 'Tanpa aktivitas lebih dari', mSel)], body: h('div', { class: 'stack' }, dry, h('div', { class: 'row between wrap' }, hint('Arsip dikunci sampai kebijakan ditetapkan.', 'lock'), archBtn)) })));
    }

    // ---------- incident & DPO
    function incidentView() {
      const placeholder = (label, text) => h('div', { class: 'row between wrap', style: 'padding:10px 0;border-bottom:1px dashed var(--line)' }, h('div', null, h('b', null, label), h('div', { class: 'muted sm' }, text)), ui.badge('Belum ditetapkan', 'amber', { dot: true }));
      return h('div', { class: 'stack' },
        ui.callout('warn', 'Belum ditetapkan owner (OQ-15)', 'Penanggung jawab PDP (DPO) dan prosedur penanganan insiden belum ada. Halaman ini hanya kerangka agar bisa diisi setelah keputusan owner; isinya bukan nasihat hukum.'),
        h('div', { class: 'grid cols-2' },
          ui.card({ title: 'Penanggung jawab PDP (DPO)', icon: 'user', body: h('div', null, placeholder('Nama DPO / penanggung jawab', 'Belum ada yang ditunjuk'), placeholder('Kontak resmi (email / telepon)', 'Dipakai di pemberitahuan privasi'), placeholder('Tanggal penetapan & dasar penunjukan', 'Surat keputusan Direksi'), h('div', { class: 'row', style: 'margin-top:10px' }, ui.btn('Tetapkan DPO', { disabled: true, title: 'Menunggu keputusan owner (OQ-15)' }))) }),
          ui.card({ title: 'Prosedur insiden data pribadi', icon: 'alert', body: h('div', null, [['1. Deteksi & laporan internal', 'Siapa yang menerima laporan pertama'], ['2. Penilaian dampak', 'Kriteria tingkat keparahan'], ['3. Pemberitahuan', 'Kepada pihak terdampak dan otoritas — batas waktu perlu verifikasi hukum'], ['4. Penanganan & pemulihan', 'Penutupan celah, penggantian kredensial'], ['5. Evaluasi', 'Pelajaran dan perbaikan']].map(([a, b]) => placeholder(a, b))) })),
        ui.card({ title: 'Catatan insiden', icon: 'list', actions: [ui.btn('Catat insiden', { icon: 'plus', disabled: true, title: 'Belum tersedia sampai prosedur insiden ditetapkan' })], body: ui.emptyState({ icon: 'shield', title: 'Belum ada insiden tercatat', text: 'Pencatatan insiden aktif setelah prosedur ditetapkan.' }) }));
    }

    // ---------- classification
    function classificationView() {
      const cls = [
        ['INTERNAL', 'Data operasional umum', ['Tidak', 'Login & izin peran', 'Enkripsi penyimpanan standar', 'Ya', 'Aktivitas umum'], 'gray'],
        ['CONFIDENTIAL', 'Dokumen pribadi / kontrak', ['Sebagian (pratinjau)', 'Ya — berumur pendek', 'Ya', 'Ya', 'Setiap unduh'], 'amber'],
        ['RESTRICTED', 'Identitas, paspor, KK, medis, psikologi', ['Ya, default tersamar; reveal berizin + alasan', 'Ya — berumur sangat pendek', 'Ya + enkripsi field NIK / paspor', 'Ya', 'Setiap akses (RUL-021)'], 'red'],
      ];
      const labels = ['Masking', 'Signed URL', 'Enkripsi', 'Scan malware', 'Log akses'];
      const sensAccess = D.audit.filter(a => /reveal|restricted/i.test(a.action)).length;
      return h('div', { class: 'stack' },
        ui.callout('info', 'Kontrol per klasifikasi', 'Rincian teknis (mis. umur signed URL) adalah usulan arsitektur dan belum dikonfirmasi (FR-DOC-009, BR-009).'),
        ui.card({ title: 'Matriks kontrol', icon: 'shield', flush: true, body: h('div', { class: 'tbl-scroll' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, h('th', null, 'Klasifikasi'), labels.map(l => h('th', null, l)))), h('tbody', null, cls.map(([k, d, ctl, t]) => h('tr', null, h('td', null, h('div', null, ui.badge(k, t)), h('div', { class: 'muted sm' }, d)), ctl.map(x => h('td', { class: 'sm' }, x))))))) }),
        h('div', { class: 'grid cols-3' }, ['INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'].map(k => ui.card({ title: `${BGS.ST.sensitivity[k][0]} (${D.docTypes.filter(d => d.sensitivity === k).length})`, body: h('div', { class: 'adm-chips' }, D.docTypes.filter(d => d.sensitivity === k).map(d => h('span', { class: 'chip static', title: d.required ? 'Wajib' : 'Opsional' }, d.name))) }))),
        ui.card({ title: 'Data pribadi pada profil worker', icon: 'database', flush: true, body: ui.table({ pageSize: 10, dense: true, rows: [
          ['NIK', 'RESTRICTED', 'Tersamar default; reveal berizin + alasan; unik (RUL-002)'], ['Nomor paspor', 'RESTRICTED', 'Tersamar default; reveal berizin; unik'], ['Nomor telepon', 'CONFIDENTIAL', 'Tersamar default'],
          ['Alamat & tanggal lahir', 'CONFIDENTIAL', 'Tampil untuk peran berizin'], ['Hasil MCU / psikologi', 'RESTRICTED', 'Hanya via dokumen RESTRICTED'], ['Consent', 'INTERNAL', 'Berversi (RUL-029)'],
        ].map(([f, c, n]) => ({ f, c, n })), columns: [{ key: 'f', label: 'Data' }, { key: 'c', label: 'Klasifikasi', render: r => ui.status('sensitivity', r.c) }, { key: 'n', label: 'Perlindungan' }] }) }),
        h('p', { class: 'muted sm' }, `Akses RESTRICTED / reveal tercatat: ${sensAccess} kejadian di audit trail.`, ' ', h('a', { class: 'lnk', href: '#/audit' }, 'Lihat audit'), '.'));
    }

    const open = D.subjectRequests.filter(r => !['SELESAI', 'DITOLAK'].includes(r.status));
    root.appendChild(header({ title: 'Perlindungan data (PDP)', subtitle: 'Consent berversi, hak subjek data, retensi, insiden, dan klasifikasi data (BR-030, RUL-026, RUL-029). Perlu verifikasi hukum.', mvp: 1 }));
    root.appendChild(ui.tabs([
      { id: 'consent', label: 'Consent', render: consentView }, { id: 'sr', label: 'Permintaan subjek data', count: open.length, render: srView }, { id: 'ret', label: 'Retensi', render: retentionView },
      { id: 'inc', label: 'Insiden & DPO', render: incidentView }, { id: 'cls', label: 'Klasifikasi data', render: classificationView },
    ], { active: dpTab, onChange: t => { dpTab = t; } }));
    return root;
  }

  // ================================================================ /settings
  function settingsPage(ctx) {
    const S = D.settings; const root = h('div', { class: 'stack' });
    const num = (v, min, max) => h('input', { class: 'input', type: 'number', min, max, value: v });
    const quota = num(S.quotaReservationDays, 1, 90), expiry = num(S.expiryWarningDays, 1, 365), pass = num(S.passportMinMonths, 1, 60);
    const eQ = errBox(), eE = errBox(), eP = errBox();
    const state = { sod: S.sodEnabled, up: S.uploaderCannotVerify, dir: S.directorApprovesFinal };
    const saveBtn = ui.btn('Simpan pengaturan', { kind: 'primary', icon: 'check', disabled: true, onClick: save });
    const sodWarn = h('div', { style: 'display:none' }, ui.callout('danger', 'Risiko: segregation of duties dimatikan', 'Executor, verifier, dan approver dapat orang yang sama. Kontrol maker-checker (RUL-016) melemah dan risiko kecurangan naik. Hanya matikan bila staf sangat terbatas (OQ-07); alasan wajib dan tercatat di audit.'));
    const dirty = () => +quota.value !== S.quotaReservationDays || +expiry.value !== S.expiryWarningDays || +pass.value !== S.passportMinMonths || state.sod !== S.sodEnabled || state.up !== S.uploaderCannotVerify || state.dir !== S.directorApprovesFinal;
    const upd = () => { saveBtn.disabled = !dirty(); sodWarn.style.display = !state.sod ? '' : 'none'; };
    [quota, expiry, pass].forEach(i => i.addEventListener('input', upd));
    const swSod = sw(state.sod, v => { state.sod = v; upd(); }, false, 'Segregation of duties aktif (RUL-016)'); const swUp = sw(state.up, v => { state.up = v; upd(); }, false, 'Uploader tidak boleh memverifikasi dokumen yang sama'); const swDir = sw(state.dir, v => { state.dir = v; upd(); }, false, 'Final verification perlu approval Director');
    async function save() {
      [eQ, eE, eP].forEach(b => showErr(b, '')); let ok = true;
      const chk = (i, b, lo, hi, nm) => { const v = +i.value; if (!Number.isInteger(v) || v < lo || v > hi) { showErr(b, `${nm} harus bilangan bulat ${lo}–${hi}`); ok = false; } };
      chk(quota, eQ, 1, 90, 'Hari reservasi'); chk(expiry, eE, 1, 365, 'Hari peringatan'); chk(pass, eP, 1, 60, 'Bulan paspor'); if (!ok) return;
      let sodReason = null;
      if (S.sodEnabled && !state.sod) {
        sodReason = await ui.reasonPrompt({ title: 'Matikan segregation of duties?', message: ui.callout('danger', 'Kontrol maker-checker akan melemah', 'Aksi ini dicatat di audit trail dan terlihat oleh Director.'), label: 'Alasan mematikan SoD', confirmLabel: 'Matikan SoD', tone: 'danger', presets: ['Staf terbatas — satu orang memegang beberapa tahap (OQ-07)'] });
        if (!sodReason) return;
      }
      const changes = [];
      const set = (k, v, label) => { if (S[k] !== v) { changes.push(`${label}: ${S[k]} → ${v}`); S[k] = v; } };
      set('quotaReservationDays', +quota.value, 'Masa reservasi kuota (hari)'); set('expiryWarningDays', +expiry.value, 'Peringatan kedaluwarsa (hari)'); set('passportMinMonths', +pass.value, 'Masa paspor minimal (bulan)');
      set('sodEnabled', state.sod, 'SoD aktif'); set('uploaderCannotVerify', state.up, 'Uploader ≠ verifier'); set('directorApprovesFinal', state.dir, 'Final verification perlu Director');
      BGS.audit('Pengaturan sistem diubah', 'Pengaturan', 'system-settings', changes.join('; ') + (sodReason ? `. Alasan mematikan SoD: ${sodReason}` : ''));
      if (sodReason) BGS.audit('PERINGATAN: segregation of duties dimatikan', 'Pengaturan', 'sodEnabled', `Alasan: ${sodReason}`);
      ui.toast('Pengaturan disimpan'); ctx.refresh();
    }
    async function resetDemo() {
      const go = await ui.confirm({ title: 'Reset data demo?', message: 'Semua perubahan pada sesi ini dibuang dan data kembali ke kondisi awal. Anda akan keluar dan harus login lagi.', tone: 'danger', confirmLabel: 'Reset data demo' });
      if (!go) return; sessionStorage.clear(); location.hash = '#/dashboard'; location.reload();
    }
    root.appendChild(header({ title: 'Pengaturan sistem', subtitle: 'Parameter operasional yang memengaruhi aturan bisnis. Hanya Superadmin; setiap perubahan tercatat di audit.', mvp: 1 }));
    root.appendChild(h('div', { class: 'grid cols-21' },
      h('div', { class: 'stack' },
        ui.card({ title: 'Aturan & parameter', icon: 'settings', body: h('div', { class: 'stack' },
          h('div', { class: 'form-grid cols-3' }, fld('Masa reservasi kuota (hari)', quota, 'Case DRAFT lewat batas ini melepas kuota (RUL-007, A-05).', true, eQ), fld('Peringatan dokumen kedaluwarsa (hari)', expiry, 'Dokumen dengan masa berlaku ≤ ini diberi tanda.', true, eE), fld('Masa berlaku paspor minimal (bulan)', pass, 'Dipakai di final verification (RUL-018, OQ-10).', true, eP)),
          h('div', { class: 'stack-sm' }, swSod, h('span', { class: 'hint' }, 'Rekomendasi: aktif. Berlaku untuk executor / verifier / approver task (BR-019).'), sodWarn, swUp, h('span', { class: 'hint' }, 'Rekomendasi BRD; dapat dimatikan bila staf terbatas (OQ-07).'), swDir, h('span', { class: 'hint' }, 'Default tidak aktif: Admin melakukan final verification (A-15).')),
          h('div', { class: 'row between wrap' }, hint('Perubahan baru berlaku setelah disimpan.', 'info'), saveBtn)) })),
      h('div', { class: 'stack' },
        ui.card({ title: 'Format ID (tetap)', icon: 'list', body: ui.kv([['Worker', h('span', { class: 'mono' }, S.workerIdFormat)], ['Lamaran', h('span', { class: 'mono' }, 'APP-{YYYY}-{NNNNN}')], ['Placement Case', h('span', { class: 'mono' }, 'PC-{YYYY}-{NNNNN}')], ['Job Order', h('span', { class: 'mono' }, 'JO-{YYYY}-{NNNN}')], ['Registrasi', h('span', { class: 'mono' }, 'REG-{YYMMDD}-{NNNN}')], ['Placement Code', h('span', { class: 'mono' }, '{ISO2}-{3 huruf profesi}-{YYMM}-{NN}')], ['Tugas', h('span', { class: 'mono' }, 'TSK-NNNNN')]]) }),
        ui.card({ title: 'Asumsi hosting & operasional', icon: 'database', body: h('div', { class: 'stack-sm' }, ui.kv([['Hosting', 'Cloud / VPS; lokasi pusat data belum ditetapkan (A-16, OQ-16)'], ['Backup', 'Harian (A-16)'], ['Ketersediaan', 'Target 99,5% per bulan, jam kerja utama (A-17)'], ['Teknologi', 'Prototipe: HTML / CSS / JS tanpa framework; data di memori browser. Teknologi produksi belum ditetapkan.']]), ui.badge('Asumsi — belum divalidasi owner', 'amber')) }),
        ui.card({ title: 'Reset data demo', icon: 'refresh', body: h('div', { class: 'stack-sm' }, h('p', { class: 'muted sm' }, 'Mengembalikan semua data prototipe ke kondisi awal dan mengeluarkan Anda dari sesi.'), ui.btn('Reset data demo', { kind: 'danger', icon: 'refresh', onClick: resetDemo })) }))));
    return root;
  }

  // ================================================================ /ai
  const aiLog = () => (D.aiLog = D.aiLog || []);
  const logAi = (kind, summary, decision) => { const e = { id: 'AI-' + pad(aiLog().length + 1, 4), kind, at: nowIso(), userId: BGS.state.userId, summary, decision: decision || 'Menunggu keputusan manusia', rating: null }; aiLog().unshift(e); return e; };
  const AI_NOTICE = () => ui.callout('warn', 'AI hanya menyarankan, keputusan tetap oleh manusia', 'Hasil asisten tidak disimpan otomatis dan tidak mengubah data tanpa konfirmasi Anda (BR-034). Jawaban hanya memakai data dalam cakupan akses Anda.');

  const EXTRACTORS = {
    DT02: (w) => [['NIK', 'nik', w.nik, 'nik'], ['Nama sesuai KTP', 'name', w.name, 'name'], ['Tanggal lahir', 'dob', w.dob, 'dob'], ['Alamat', 'address', w.address, 'address'], ['Jenis kelamin', 'gender', w.gender === 'P' ? 'Perempuan' : 'Laki-laki', null], ['Status perkawinan', 'marital', w.maritalStatus, 'maritalStatus']],
    DT03: (w) => [['Nama anggota keluarga', 'name', w.name, null], ['Alamat', 'address', w.address, 'address'], ['Status perkawinan', 'marital', w.maritalStatus, 'maritalStatus'], ['NIK', 'nik', w.nik, 'nik']],
    DT08: (w, d) => [['Nomor paspor', 'passport', w.passport || '—', 'passport'], ['Nama pemegang', 'name', w.name, 'name'], ['Tanggal lahir', 'dob', w.dob, 'dob'], ['Berlaku sampai', 'expires', d.expiresAt || '—', 'docExpires']],
    DT05: (w) => [['Nama', 'name', w.name, 'name'], ['Jenjang pendidikan', 'edu', w.education, 'education'], ['Tahun lulus', 'year', String(new Date(w.dob).getFullYear() + 18), null]],
    DT04: (w) => [['Nama', 'name', w.name, 'name'], ['Tanggal lahir', 'dob', w.dob, 'dob'], ['Tempat lahir', 'city', w.city, null]],
    DT11: (w, d) => [['Nama peserta', 'name', w.name, 'name'], ['Tanggal pemeriksaan', 'date', String(d.uploadedAt).slice(0, 10), null], ['Kesimpulan (perlu dinilai manusia)', 'result', 'FIT — tanpa catatan khusus', null], ['Berlaku sampai', 'expires', d.expiresAt || '—', 'docExpires']],
    DT14: (w, d) => [['Nama', 'name', w.name, 'name'], ['Tanggal terbit', 'date', String(d.uploadedAt).slice(0, 10), null], ['Berlaku sampai', 'expires', d.expiresAt || '—', 'docExpires']],
  };
  const noisy = (val, n) => {
    const s = String(val); if (!s || s === '—') return s; const digits = [...s.matchAll(/\d/g)].map(m => m.index);
    if (digits.length) { const i = digits[n % digits.length]; return s.slice(0, i) + String((+s[i] + 3) % 10) + s.slice(i + 1); }
    if (s.length < 4) return s; const i = 1 + (n % (s.length - 2)); return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
  };

  function docAssistant() {
    const host = h('div', { class: 'stack' }); const out = h('div');
    const workers = BGS.scope.workers().filter(w => D.documents.some(d => d.status !== 'SUPERSEDED' && ((d.ownerType === 'worker' && d.ownerId === w.id) || (d.ownerType === 'case' && (D.case(d.ownerId) || {}).workerId === w.id)))).sort((a, b) => a.name.localeCompare(b.name));
    const docsOf = wid => D.documents.filter(d => d.status !== 'SUPERSEDED' && ((d.ownerType === 'worker' && d.ownerId === wid) || (d.ownerType === 'case' && (D.case(d.ownerId) || {}).workerId === wid)));
    const defW = (workers.find(w => w.id === 'BGS-W-2026-00123') || workers[0] || {}).id;
    const wSel = h('select', { class: 'input', onChange: () => fillDocs() }, workers.map(w => h('option', { value: w.id, selected: w.id === defW }, `${w.name} — ${w.id}`)));
    const dSel = h('select', { class: 'input' });
    function fillDocs() { BGS.clear(dSel); docsOf(wSel.value).forEach(d => { const dt = D.docType(d.typeId); dSel.appendChild(h('option', { value: d.id }, `${dt.name} · ${d.id}${dt.sensitivity === 'RESTRICTED' ? ' 🔒' : ''}`)); }); }
    if (workers.length) fillDocs();

    async function extract() {
      const doc = D.documents.find(d => d.id === dSel.value); if (!doc) { ui.toast('Pilih dokumen dulu', 'warn'); return; }
      const dt = D.docType(doc.typeId); const w = D.worker(doc.ownerType === 'worker' ? doc.ownerId : (D.case(doc.ownerId) || {}).workerId);
      if (dt.sensitivity === 'RESTRICTED') {
        if (!BGS.can('document.restricted.view')) { ui.toast('Peran Anda tidak boleh membuka dokumen RESTRICTED (RUL-020).', 'danger'); return; }
        const r = await ui.reasonPrompt({ title: 'Buka dokumen RESTRICTED', message: 'Asisten membaca isi dokumen ini. Akses tercatat di audit trail (RUL-021).', label: 'Alasan membuka dokumen', confirmLabel: 'Buka & ekstrak', presets: ['Pemeriksaan kelengkapan dokumen', 'Verifikasi identitas'] });
        if (!r) return; BGS.audit('Akses dokumen RESTRICTED (asisten AI)', 'Document', doc.id, 'Alasan: ' + r);
      } else BGS.audit('Dokumen dibaca asisten AI', 'Document', doc.id, dt.name);
      BGS.clear(out); out.appendChild(h('div', { class: 'card' }, h('div', { class: 'card-b row' }, h('span', { class: 'adm-spin' }), 'Membaca dokumen dan mengekstrak kolom…')));
      setTimeout(() => render(doc, dt, w), 700);
    }
    function render(doc, dt, w) {
      BGS.clear(out);
      const ext = EXTRACTORS[doc.typeId];
      if (!ext) { out.appendChild(ui.card({ body: ui.emptyState({ icon: 'info', title: `Tidak ada ekstraksi untuk "${dt.name}"`, text: 'Jenis dokumen ini berupa gambar / tidak berisi kolom teks yang dapat diekstrak. Pilih dokumen lain.' }) })); return; }
      const raw = ext(w, doc); const noiseIdx = hash(doc.id) % raw.length;
      const fields = raw.map(([label, key, value, mapTo], i) => {
        const n = i === noiseIdx && value !== '—' ? noisy(value, hash(doc.id + key)) : value;
        const conf = i === noiseIdx && n !== value ? 48 + (hash(doc.id + key) % 24) : 90 + (hash(doc.id + key) % 10);
        return { label, key, mapTo, value: n, current: value, conf, decision: null, edited: null };
      });
      const entry = logAi('Dokumen', `${dt.name} ${doc.id} — ${fields.length} kolom diekstrak`);
      const rowsHost = h('div'); const bar = h('div', { class: 'row between wrap' }); const msg = h('div');
      const counts = () => ({ p: fields.filter(f => !f.decision).length, a: fields.filter(f => f.decision === 'accepted').length, e: fields.filter(f => f.decision === 'edited').length, r: fields.filter(f => f.decision === 'rejected').length });
      const canWrite = BGS.can('worker.write');
      function drawBar() {
        const c = counts(); BGS.clear(bar);
        const saveable = fields.filter(f => ['accepted', 'edited'].includes(f.decision));
        bar.append(h('div', { class: 'adm-chips' }, ui.badge(`${c.p} menunggu`, 'amber'), ui.badge(`${c.a} diterima`, 'green'), ui.badge(`${c.e} diubah`, 'blue'), ui.badge(`${c.r} ditolak`, 'gray')),
          h('div', { class: 'row gap-sm' }, ui.btn('Buang hasil', { onClick: () => finish('Dibuang tanpa menyimpan') }),
            ui.btn('Simpan field terkonfirmasi', { kind: 'primary', icon: 'check', disabled: c.p > 0 || !saveable.length || !canWrite, title: !canWrite ? 'Hanya Superadmin / Admin yang boleh mengubah profil' : c.p > 0 ? 'Putuskan semua field dulu' : !saveable.length ? 'Tidak ada field diterima' : '', onClick: apply })));
      }
      function drawRows() {
        BGS.clear(rowsHost);
        fields.forEach(f => {
          const inp = h('input', { class: 'input', value: f.edited != null ? f.edited : f.value, disabled: f.decision === 'rejected' || f.decision === 'accepted' || f.decision === 'edited' });
          const same = String(f.value) === String(f.current);
          const tone = f.conf >= 90 ? 'green' : f.conf >= 70 ? 'amber' : 'red';
          rowsHost.appendChild(h('div', { class: 'adm-field-row' + (f.decision === 'rejected' ? ' rej' : f.decision ? ' acc' : '') },
            h('div', null, h('b', null, f.label), h('div', { class: 'muted xs' }, f.mapTo ? 'dapat disimpan ke profil' : 'hanya informasi')),
            h('div', { class: 'stack-sm' }, inp, h('div', { class: 'row wrap gap-sm' }, same ? ui.badge('Cocok dengan data sistem', 'green') : ui.badge(`Berbeda dari sistem: ${f.current}`, 'amber'), f.conf < 75 && ui.badge('Periksa teliti', 'red'))),
            h('div', { class: 'adm-conf', title: `Keyakinan ${f.conf}%` }, ui.progress(f.conf, tone), h('b', { class: 'sm' }, f.conf + '%')),
            f.decision ? h('div', { class: 'row gap-sm' }, ui.badge({ accepted: 'Diterima', edited: 'Diubah & diterima', rejected: 'Ditolak' }[f.decision], f.decision === 'rejected' ? 'gray' : 'green'), ui.btn('Batalkan', { sm: true, onClick: () => { f.decision = null; drawRows(); drawBar(); } }))
              : h('div', { class: 'row gap-sm' }, ui.btn('Terima', { sm: true, kind: 'good', icon: 'check', onClick: () => { const v = inp.value.trim(); if (!v) { ui.toast('Nilai tidak boleh kosong', 'warn'); return; } f.decision = v !== String(f.value) ? 'edited' : 'accepted'; f.edited = v; drawRows(); drawBar(); } }), ui.btn('Tolak', { sm: true, icon: 'x', onClick: () => { f.decision = 'rejected'; drawRows(); drawBar(); } }))));
        });
      }
      function finish(decision) { const c = counts(); entry.decision = `${decision} (${c.a} diterima, ${c.e} diubah, ${c.r} ditolak, ${c.p} belum diputuskan)`; BGS.clear(out); out.appendChild(ui.callout(decision.startsWith('Disimpan') ? 'good' : 'info', decision, 'Keputusan dicatat di Log saran.')); }
      async function apply() {
        const changes = []; let err = null;
        fields.filter(f => ['accepted', 'edited'].includes(f.decision) && f.mapTo).forEach(f => {
          const nv = f.decision === 'edited' ? f.edited : f.value; if (String(nv) === String(f.current)) return;
          if (f.mapTo === 'nik') { if (!/^\d{16}$/.test(nv)) err = 'NIK harus 16 digit.'; else if (D.workers.some(x => x.id !== w.id && x.status !== 'ARCHIVED' && x.nik === nv)) err = 'NIK sudah dipakai worker lain (RUL-002).'; }
          if (f.mapTo === 'passport') { if (!/^[A-Za-z]\d{6,8}$/.test(nv)) err = 'Format nomor paspor tidak valid.'; else if (D.workers.some(x => x.id !== w.id && x.passport === nv)) err = 'Nomor paspor sudah dipakai worker lain (RUL-002).'; }
          if (['dob', 'docExpires'].includes(f.mapTo) && (!/^\d{4}-\d{2}-\d{2}$/.test(nv) || isNaN(new Date(nv)))) err = `Tanggal "${f.label}" harus berformat TTTT-BB-HH.`;
          if (f.mapTo === 'education' && !['SD', 'SMP', 'SMA/SMK', 'D3', 'S1'].includes(nv)) err = 'Jenjang pendidikan tidak dikenal (SD, SMP, SMA/SMK, D3, S1).';
          changes.push({ f, nv });
        });
        if (err) { ui.toast(err, 'danger'); return; }
        if (changes.length) {
          const go = await ui.confirm({ title: 'Simpan ke profil?', message: changes.map(c => `${c.f.label}: ${c.f.current} → ${c.nv}`).join(' · '), confirmLabel: 'Ya, simpan' }); if (!go) return;
          changes.forEach(({ f, nv }) => { if (f.mapTo === 'docExpires') doc.expiresAt = nv; else w[f.mapTo] = nv; });
          BGS.audit('Hasil asisten AI dikonfirmasi manusia', 'Worker', w.id, `${dt.name} ${doc.id}: ` + changes.map(c => `${c.f.label} ${c.f.current} → ${c.nv}`).join('; '));
          ui.toast(`${changes.length} field disimpan ke profil`); finish('Disimpan ke profil');
        } else { BGS.audit('Hasil asisten AI dikonfirmasi (tanpa perubahan data)', 'Document', doc.id, dt.name); ui.toast('Semua nilai sama dengan data sistem; keputusan dicatat.', 'info'); finish('Dikonfirmasi tanpa perubahan data'); }
      }
      out.appendChild(ui.card({ title: `Hasil ekstraksi — ${dt.name}`, icon: 'sparkle', actions: [ui.status('sensitivity', dt.sensitivity), ui.badge('Simulasi', 'purple')],
        body: h('div', { class: 'stack' },
          ui.callout('info', 'Ini simulasi ekstraksi', 'Prototipe tidak memanggil model AI sungguhan. Nilai dibuat dari data sistem dengan sedikit "kesalahan baca" agar alur konfirmasi terlihat. Tidak ada yang disimpan sebelum Anda memutuskan tiap field.'),
          h('div', { class: 'grid cols-12' }, h('div', { class: 'adm-doc' }, BGS.icon('file-text', 34), h('div', { class: 'b' }, doc.filename), h('div', { class: 'sm' }, `${doc.id} · ${doc.sizeKb} KB`), h('div', { class: 'sm' }, 'Pratinjau file tidak tersedia di prototipe'), h('div', { class: 'sm', style: 'margin-top:6px' }, 'Pemilik: ', ui.workerLink(w.id))), h('div', null, rowsHost)),
          bar, msg) }));
      drawRows(); drawBar();
    }
    host.appendChild(AI_NOTICE());
    host.appendChild(ui.card({ title: 'Asisten dokumen', icon: 'file-text', subtitle: 'Pilih dokumen, lihat kolom yang terbaca beserta tingkat keyakinan, lalu putuskan per field.', body: workers.length ? h('div', { class: 'row wrap', style: 'align-items:flex-end' }, h('div', { style: 'flex:1;min-width:240px' }, fld('Worker', wSel)), h('div', { style: 'flex:1;min-width:240px' }, fld('Dokumen', dSel, '🔒 = RESTRICTED: butuh alasan dan tercatat di audit.')), ui.btn('Ekstrak dokumen', { kind: 'primary', icon: 'sparkle', onClick: extract })) : ui.emptyState({ icon: 'folder', title: 'Tidak ada dokumen dalam cakupan Anda' }) }));
    host.appendChild(out); return host;
  }

  // ---- operational assistant
  const caseOf = id => D.case(id);
  const wName = id => (D.worker(id) || {}).name || id;
  const scopeLabel = () => (BGS.scope.isLimited() ? 'hanya data yang ditugaskan kepada Anda' : 'semua data');
  const rlist = items => h('ul', { class: 'adm-rl' }, items.map(i => h('li', null, i)));
  const more = (n, shown) => (n > shown ? h('div', { class: 'muted sm' }, `…dan ${n - shown} lainnya`) : null);
  const INTENTS = [
    { id: 'passport', q: 'Worker mana yang paspornya kedaluwarsa dalam 60 hari?', re: /paspor|passport/i, run(q) {
      const m = /(\d+)\s*hari/.exec(q); const days = m ? +m[1] : D.settings.expiryWarningDays; const ids = new Set(BGS.scope.workers().map(w => w.id));
      const docs = D.documents.filter(d => d.typeId === 'DT08' && d.ownerType === 'worker' && ids.has(d.ownerId) && d.status !== 'SUPERSEDED' && d.expiresAt).map(d => ({ d, left: fmt.daysFrom(d.expiresAt) }));
      const soon = docs.filter(r => r.left >= 0 && r.left <= days).sort((a, b) => a.left - b.left); const exp = docs.filter(r => r.left < 0).sort((a, b) => b.left - a.left);
      const risk = BGS.scope.cases().filter(c => !['DEPARTED', 'CANCELLED'].includes(c.status)).map(c => { const pd = D.documents.find(d => d.typeId === 'DT08' && d.ownerId === c.workerId && d.status !== 'SUPERSEDED' && d.expiresAt); if (!pd) return null; const months = (new Date(pd.expiresAt) - new Date(c.plannedDeparture)) / (30.44 * DAY); return months < D.settings.passportMinMonths ? { c, pd, months } : null; }).filter(Boolean);
      const row = r => [ui.workerLink(r.d.ownerId), h('span', { class: 'muted sm' }, `berlaku sampai ${fmt.date(r.d.expiresAt)} (${r.left < 0 ? -r.left + ' hari lalu' : r.left + ' hari lagi'})`), r.left < 0 && ui.badge('Sudah kedaluwarsa', 'red')];
      const node = h('div', null, h('p', null, `${soon.length} worker punya paspor yang habis dalam ${days} hari ke depan, dan ${exp.length} sudah kedaluwarsa.`),
        soon.length ? rlist(soon.slice(0, 8).map(row)) : null, more(soon.length, 8), exp.length ? h('p', { style: 'margin-top:8px' }, h('b', null, 'Sudah kedaluwarsa:')) : null, exp.length ? rlist(exp.slice(0, 5).map(row)) : null, more(exp.length, 5),
        risk.length ? h('div', { style: 'margin-top:8px' }, h('b', null, `Berisiko gagal syarat paspor ≥ ${D.settings.passportMinMonths} bulan saat berangkat (RUL-018):`), rlist(risk.slice(0, 5).map(r => [ui.caseLink(r.c.id), ui.workerLink(r.c.workerId), h('span', { class: 'muted sm' }, `sisa ${Math.max(0, Math.round(r.months))} bulan saat ${fmt.date(r.c.plannedDeparture)}`)]))) : null,
        h('p', { class: 'sm', style: 'margin-top:8px' }, 'Saran: hubungi worker untuk perpanjangan paspor sebelum memproses visa.'));
      return { node, count: soon.length + exp.length, summary: `Paspor: ${soon.length} akan habis, ${exp.length} kedaluwarsa`, basis: `${docs.length} dokumen paspor` };
    } },
    { id: 'late', q: 'Case mana yang terlambat?', re: /terlambat|overdue|telat/i, run() {
      const tasks = BGS.scope.tasks().filter(t => !isTerminalTask(t) && new Date(t.dueAt) < BGS.today); const by = {};
      tasks.forEach(t => { const c = caseOf(t.caseId); if (!c || ['DEPARTED', 'CANCELLED'].includes(c.status)) return; (by[c.id] = by[c.id] || []).push(t); });
      const rows = Object.entries(by).map(([id, ts]) => ({ id, ts, late: Math.max(...ts.map(t => Math.ceil((BGS.today - new Date(t.dueAt)) / DAY))) })).sort((a, b) => b.late - a.late);
      const node = h('div', null, h('p', null, rows.length ? `${rows.length} case punya tugas terlambat (RUL-028).` : 'Tidak ada case yang terlambat dalam cakupan Anda.'), rows.length ? rlist(rows.slice(0, 8).map(r => [ui.caseLink(r.id), ui.workerLink(caseOf(r.id).workerId), h('span', { class: 'sm' }, r.ts.map(t => t.title).join(', ')), ui.badge(`terlambat ${r.late} hari`, r.late > 3 ? 'red' : 'amber')])) : null, more(rows.length, 8), rows.length ? h('p', { class: 'sm', style: 'margin-top:8px' }, 'Saran: tinjau di Hambatan & terlambat, hubungi PIC terkait, dan ubah due date hanya dengan alasan.') : null);
      return { node, count: rows.length, summary: `${rows.length} case terlambat`, basis: `${BGS.scope.tasks().length} tugas` };
    } },
    { id: 'quota', q: 'Kuota mana yang hampir habis?', re: /kuota|quota/i, run() {
      BGS.computeQuota(); const rows = D.placementCodes.filter(p => p.status !== 'CLOSED' && (p.available <= 2 || p.available / (p.total || 1) <= 0.2)).sort((a, b) => a.available / a.total - b.available / b.total);
      const node = h('div', null, h('p', null, rows.length ? `${rows.length} Placement Code hampir atau sudah penuh.` : 'Semua Placement Code terbuka masih punya kuota longgar.'), rows.length ? rlist(rows.map(p => [ui.codeLink(p.id), ui.quotaBar(p), h('span', { class: 'sm' }, `Tersedia ${p.available} dari ${p.total}`), ui.status('code', p.status)])) : null, rows.length ? h('p', { class: 'sm', style: 'margin-top:8px' }, 'Saran: Admin dapat mengajukan perubahan Total Kuota; Director memutuskan di Persetujuan.') : null);
      return { node, count: rows.length, summary: `${rows.length} kuota hampir habis`, basis: `${D.placementCodes.length} Placement Code` };
    } },
    { id: 'blocked', q: 'Apa saja hambatan (blocked) saat ini?', re: /hambat|blocked|terhambat|ditahan|hold/i, run() {
      const bt = BGS.scope.tasks().filter(t => t.status === 'BLOCKED'); const hold = BGS.scope.cases().filter(c => c.status === 'ON_HOLD');
      const node = h('div', null, h('p', null, `${bt.length} tugas terhambat dan ${hold.length} case ditahan.`), bt.length || hold.length ? rlist([...bt.map(t => [ui.caseLink(t.caseId), h('span', { class: 'sm' }, `${t.title}: ${t.blockedReason || '—'}`), ui.badge('Terhambat', 'red')]), ...hold.map(c => [ui.caseLink(c.id), ui.workerLink(c.workerId), h('span', { class: 'sm' }, c.onHoldReason || '—'), ui.badge('Ditahan', 'amber')])]) : null);
      return { node, count: bt.length + hold.length, summary: `${bt.length} terhambat, ${hold.length} ditahan`, basis: `${BGS.scope.cases().length} case` };
    } },
    { id: 'unalloc', q: 'Siapa yang sudah terpilih tapi belum dialokasikan?', re: /alokasi|terpilih|cadangan|dialokasikan/i, run() {
      const apps = BGS.scope.applications().filter(a => ['SELECTED', 'WAITLISTED'].includes(a.status) && !a.caseId);
      const node = h('div', null, h('p', null, `${apps.length} lamaran berstatus Terpilih / Cadangan belum punya Placement Case.`), apps.length ? rlist(apps.slice(0, 8).map(a => [ui.workerLink(a.workerId), ui.appLink(a.id), h('span', { class: 'sm' }, `${D.cn(a.country)} · ${D.pn(a.profession)}`), ui.status('application', a.status), BGS.can('case.allocate') && h('a', { class: 'lnk sm', href: '#/allocation?app=' + a.id }, 'Alokasikan →')])) : null, more(apps.length, 8));
      return { node, count: apps.length, summary: `${apps.length} lamaran belum dialokasikan`, basis: `${BGS.scope.applications().length} lamaran` };
    } },
    { id: 'verify', q: 'Dokumen apa yang menunggu verifikasi?', re: /verifikasi|dokumen/i, run() {
      const ids = new Set(BGS.scope.workers().map(w => w.id)); const docs = D.documents.filter(d => d.status === 'UPLOADED' && d.ownerType === 'worker' && ids.has(d.ownerId));
      const node = h('div', null, h('p', null, `${docs.length} dokumen worker menunggu verifikasi.`), docs.length ? rlist(docs.slice(0, 8).map(d => [ui.workerLink(d.ownerId), h('span', { class: 'sm' }, (D.docType(d.typeId) || {}).name), h('span', { class: 'muted sm' }, 'diunggah ' + fmt.rel(d.uploadedAt))])) : null, more(docs.length, 8), h('p', { class: 'sm', style: 'margin-top:8px' }, 'Pengingat: pengunggah tidak boleh memverifikasi dokumen yang sama (RUL-016).'));
      return { node, count: docs.length, summary: `${docs.length} dokumen menunggu verifikasi`, basis: `${D.documents.length} dokumen` };
    } },
    { id: 'depart', q: 'Siapa yang akan berangkat dalam 30 hari?', re: /berangkat|keberangkatan|departure/i, run() {
      const cs = BGS.scope.cases().filter(c => ['IN_PROCESS', 'FINAL_VERIFICATION', 'READY_TO_DEPART'].includes(c.status) && c.plannedDeparture && fmt.daysFrom(c.plannedDeparture) <= 30).sort((a, b) => a.plannedDeparture.localeCompare(b.plannedDeparture));
      const node = h('div', null, h('p', null, `${cs.length} case direncanakan berangkat dalam 30 hari.`), cs.length ? rlist(cs.slice(0, 8).map(c => [ui.caseLink(c.id), ui.workerLink(c.workerId), h('span', { class: 'sm' }, fmt.date(c.plannedDeparture) + ' (' + fmt.rel(c.plannedDeparture) + ')'), ui.status('case', c.status)])) : null);
      return { node, count: cs.length, summary: `${cs.length} case akan berangkat ≤ 30 hari`, basis: `${BGS.scope.cases().length} case` };
    } },
    { id: 'approval', q: 'Persetujuan apa yang masih menunggu?', re: /persetujuan|approval|setuju/i, roles: [SA, DI], run() {
      const ps = D.approvals.filter(a => a.status === 'PENDING');
      const node = h('div', null, h('p', null, `${ps.length} permintaan menunggu keputusan Director.`), ps.length ? rlist(ps.map(a => [ui.badge(apType(a.type)[0], apType(a.type)[2]), h('span', { class: 'sm' }, a.title), h('span', { class: 'muted sm' }, countdown(a.expires).text)])) : null, ps.length ? h('a', { class: 'lnk', href: '#/approvals' }, 'Buka Persetujuan →') : null);
      return { node, count: ps.length, summary: `${ps.length} persetujuan menunggu`, basis: `${D.approvals.length} permintaan` };
    } },
  ];

  function opsAssistant() {
    const host = h('div', { class: 'stack' }); const log = h('div', { class: 'adm-chat-log' });
    const intents = INTENTS.filter(i => !i.roles || i.roles.includes(BGS.role()));
    const add = (cls, node) => { const m = h('div', { class: 'adm-msg ' + cls }, node); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; };
    const greet = () => add('a', h('div', null, h('b', null, 'Halo! Saya asisten operasional BGS.'), h('div', null, `Saya menjawab dengan menghitung data sistem (${scopeLabel()}). Pilih pertanyaan di bawah atau ketik sendiri.`)));
    function ask(q) {
      q = q.trim(); if (!q) return; add('u', q);
      const it = intents.find(i => i.re.test(q));
      const typing = add('a', h('span', { class: 'row gap-sm' }, h('span', { class: 'adm-spin' }), 'Menghitung…'));
      setTimeout(() => {
        typing.remove();
        if (!it) { add('a', h('div', null, h('p', null, 'Maaf, saya belum bisa menjawab pertanyaan itu. Coba salah satu pertanyaan berikut:'), chips())); logAi('Operasional', `Pertanyaan tidak dikenali: "${q}"`, 'Tidak ada jawaban'); renderLog(); return; }
        const r = it.run(q); const entry = logAi('Operasional', `${q} → ${r.summary}`, 'Menunggu penilaian pengguna');
        const rate = (v, b1, b2) => { entry.rating = v; entry.decision = v === 'up' ? 'Dinilai berguna' : 'Dinilai kurang tepat'; b1.disabled = b2.disabled = true; renderLog(); };
        const b1 = ui.btn('Berguna', { sm: true, onClick: () => rate('up', b1, b2) }), b2 = ui.btn('Kurang tepat', { sm: true, onClick: () => rate('down', b1, b2) });
        add('a', h('div', null, r.node, h('div', { class: 'adm-basis' }, `Dasar: ${r.basis}, cakupan ${scopeLabel()}. Ini saran — keputusan tetap oleh manusia.`), h('div', { class: 'row gap-sm', style: 'margin-top:6px' }, b1, b2)));
        renderLog();
      }, 450);
    }
    const chips = () => h('div', { class: 'adm-chips', style: 'margin-top:6px' }, intents.map(i => h('button', { class: 'chip', type: 'button', onClick: () => ask(i.q) }, i.q)));
    const inp = h('input', { class: 'input', placeholder: 'Ketik pertanyaan, mis. "kuota hampir habis" atau "case terlambat"…', onKeydown: e => { if (e.key === 'Enter') { ask(inp.value); inp.value = ''; } } });
    const logHost = h('div'); const renderLog = () => { BGS.clear(logHost); logHost.appendChild(logTable()); };
    greet();
    host.appendChild(AI_NOTICE());
    host.appendChild(ui.card({ title: 'Asisten operasional', icon: 'sparkle', subtitle: 'Jawaban dihitung langsung dari data BGS sesuai cakupan akses Anda.',
      actions: [ui.btn('Bersihkan percakapan', { sm: true, onClick: () => { BGS.clear(log); greet(); } })],
      body: h('div', { class: 'stack' }, h('div', { class: 'adm-chips' }, intents.map(i => h('button', { class: 'chip', type: 'button', onClick: () => ask(i.q) }, i.q))), h('div', { class: 'adm-chat' }, log, h('div', { class: 'adm-chat-in' }, inp, ui.btn('Kirim', { kind: 'primary', icon: 'send', onClick: () => { ask(inp.value); inp.value = ''; } })))) }));
    return host;
  }

  function logTable() {
    const rows = aiLog().filter(e => BGS.isRole(SA, DI) || e.userId === BGS.state.userId);
    return ui.table({ pageSize: 8, rows, empty: ui.emptyState({ icon: 'list', title: 'Belum ada saran AI', text: 'Saran yang dibuat asisten dokumen dan operasional dicatat di sini.' }), columns: [
      { key: 'id', label: 'ID', render: e => h('span', { class: 'mono' }, e.id) }, { key: 'at', label: 'Waktu', render: e => fmt.dateTime(e.at) }, { key: 'kind', label: 'Jenis', render: e => ui.badge(e.kind, e.kind === 'Dokumen' ? 'blue' : 'purple') },
      { key: 'summary', label: 'Saran / pertanyaan', render: e => h('span', { class: 'sm' }, e.summary) }, { key: 'userId', label: 'Pengguna', render: e => ui.userChip(e.userId) },
      { key: 'decision', label: 'Keputusan manusia', render: e => h('span', { class: 'sm' }, e.decision) },
    ] });
  }

  function aiPage() {
    const root = h('div', { class: 'stack' });
    root.appendChild(header({ title: 'Asisten AI', subtitle: 'Bantuan baca dokumen dan pemantauan operasional. Selalu dengan konfirmasi manusia (BR-034).', mvp: 3 }));
    root.appendChild(ui.tabs([
      { id: 'doc', label: 'Asisten dokumen', render: docAssistant }, { id: 'ops', label: 'Asisten operasional', render: opsAssistant },
      { id: 'log', label: 'Log saran', count: aiLog().length, render: () => h('div', { class: 'stack' }, AI_NOTICE(), ui.card({ title: 'Log saran AI', icon: 'list', subtitle: BGS.isRole(SA, DI) ? 'Semua pengguna' : 'Hanya saran Anda', flush: true, body: logTable() })) },
    ], { active: 'doc' }));
    return root;
  }

  // ================================================================ /integrations
  const SYSTEMS = [
    { id: 'SISKO', name: 'SISKO / Sisko P2MI', purpose: 'Pendaftaran penempatan PMI di sistem pemerintah', kw: 'SISKO' },
    { id: 'ENJAZ', name: 'ENJAZ (Arab Saudi)', purpose: 'Visa / pengurusan kerja Arab Saudi', kw: 'ENJAZ' },
    { id: 'BASMA', name: 'BASMA', purpose: 'Orientasi / pendaftaran pekerja Arab Saudi', kw: 'BASMA' },
    { id: 'PROMETRIC', name: 'Prometric', purpose: 'Ujian kompetensi (bila dipersyaratkan)', kw: null },
    { id: 'IMIGRASI', name: 'Imigrasi', purpose: 'Paspor dan biometrik', kw: 'Biometrik' },
    { id: 'MCU', name: 'Klinik MCU terdaftar', purpose: 'Hasil pemeriksaan kesehatan', kw: 'Medical' },
    { id: 'WA', name: 'WhatsApp Business', purpose: 'Notifikasi ke worker / staf (OQ-13)', kw: null },
  ];
  const CONDS = ['Akses resmi terdokumentasi', 'Kredensial resmi tersedia', 'Persetujuan hukum'];
  function integrationsPage(ctx) {
    D.integrationChecks = D.integrationChecks || {}; const root = h('div', { class: 'stack' }); const canEdit = BGS.isRole(SA);
    const st = id => (D.integrationChecks[id] = D.integrationChecks[id] || { cond: [false, false, false], refs: [], ready: false });
    const usage = s => { if (!s.kw) return { steps: 0, refs: 0 }; const k = s.kw.toLowerCase(); let refs = 0; D.cases.forEach(c => c.steps.forEach(x => { if (x.name.toLowerCase().includes(k) && x.refNumber) refs++; }));
      const steps = D.templates.reduce((n, t) => n + (t.versions.find(v => v.status === 'PUBLISHED') || { steps: [] }).steps.filter(x => x.external && x.name.toLowerCase().includes(k)).length, 0); return { steps, refs }; };
    async function tick(s, i, cb) {
      const state = st(s.id); const want = cb.checked;
      if (want) { const ref = await ui.reasonPrompt({ title: `Catat bukti: ${CONDS[i]}`, message: s.name, label: 'Referensi dokumen bukti (nomor surat / tautan)', confirmLabel: 'Tandai terpenuhi' }); if (!ref) { cb.checked = false; return; } state.cond[i] = true; state.refs[i] = ref; BGS.audit('Syarat integrasi dipenuhi', 'Integrasi', s.id, `${CONDS[i]}. Bukti: ${ref}`); }
      else { const go = await ui.confirm({ title: 'Batalkan centang syarat?', message: `${CONDS[i]} untuk ${s.name} akan ditandai belum terpenuhi.`, confirmLabel: 'Batalkan centang' }); if (!go) { cb.checked = true; return; } state.cond[i] = false; state.refs[i] = null; state.ready = false; BGS.audit('Syarat integrasi dicabut', 'Integrasi', s.id, CONDS[i]); }
      ctx.refresh();
    }
    root.appendChild(header({ title: 'Integrasi eksternal', subtitle: 'Hubungan ke sistem pemerintah / pihak ketiga hanya boleh dibangun bila ada akses resmi terdokumentasi (BR-035).', mvp: 3 }));
    root.appendChild(ui.callout('warn', 'Tidak ada integrasi yang aktif', 'Tidak ada API, kredensial, atau endpoint pemerintah yang diasumsikan (A-08). Semua sistem di bawah dicatat manual oleh staf. Halaman ini tidak pernah menampilkan status "terhubung" palsu.'));
    if (!canEdit) root.appendChild(readOnlyNote('Hanya Superadmin yang dapat mencatat pemenuhan syarat.'));
    const rows = SYSTEMS.map(s => ({ s, st: st(s.id), u: usage(s) }));
    root.appendChild(ui.card({ flush: true, body: ui.table({ pageSize: 10, rows, columns: [
      { key: 'name', label: 'Sistem', render: r => h('div', null, h('b', null, r.s.name), h('div', { class: 'muted sm' }, r.s.purpose)) },
      { key: 'mode', label: 'Mode saat ini', render: r => { const done = r.st.cond.every(Boolean); return h('div', { class: 'stack-sm' }, ui.badge('Manual — belum ada akses resmi', 'gray', { dot: true }), done && ui.badge(r.st.ready ? 'Ditandai siap dikembangkan' : 'Syarat lengkap', r.st.ready ? 'blue' : 'teal')); } },
      { key: 'cond', label: 'Syarat integrasi', render: r => h('div', { class: 'adm-checks' }, CONDS.map((c, i) => { const cb = h('input', { type: 'checkbox', checked: r.st.cond[i], disabled: !canEdit, onChange: () => tick(r.s, i, cb) }); return h('label', { title: r.st.refs[i] ? 'Bukti: ' + r.st.refs[i] : '' }, cb, h('span', null, c, r.st.refs[i] && h('span', { class: 'muted xs' }, ' — ' + r.st.refs[i]))); })) },
      { key: 'use', label: 'Pemakaian manual', render: r => (r.s.kw ? h('div', { class: 'sm' }, h('div', null, `${r.u.steps} langkah eksternal di template`), h('div', { class: 'muted' }, `${r.u.refs} nomor referensi tercatat`)) : h('span', { class: 'muted sm' }, 'Belum ada langkah terkait')) },
      { key: 'on', label: 'Integrasi', render: r => { const done = r.st.cond.every(Boolean); return sw(r.st.ready, (v, i) => { r.st.ready = v; BGS.audit(v ? 'Integrasi ditandai siap dikembangkan' : 'Tanda siap integrasi dicabut', 'Integrasi', r.s.id, 'Konektor belum dibangun'); ui.toast(v ? 'Ditandai siap dikembangkan. Konektor BELUM dibuat — tidak ada koneksi nyata.' : 'Tanda dicabut', 'info'); ctx.refresh(); }, !done || !canEdit, 'Siap dikembangkan', !done ? 'Terkunci sampai ketiga syarat terpenuhi' : 'Menandai kesiapan saja, bukan koneksi'); } },
    ] }) }));
    root.appendChild(h('div', { class: 'grid cols-2' },
      ui.card({ title: 'Alur manual saat ini (FR-PRC-015)', icon: 'clipboard', body: h('div', { class: 'stack-sm' }, ui.stepper(['Staf proses di sistem eksternal', 'Catat nomor referensi', 'Unggah file bukti', 'Verifikasi'], 4), h('ul', { class: 'stack-sm', style: 'margin:0;padding-left:18px' }, ['Staf BGS memproses langsung di SISKO, ENJAZ, BASMA, klinik, atau imigrasi.', 'Langkah eksternal pada Placement Case mensyaratkan nomor referensi + file bukti sebelum bisa selesai (BR-033).', 'Sistem BGS tidak menarik atau mengirim data ke sistem tersebut.'].map(t => h('li', null, t)))) }),
      ui.card({ title: 'Ekspor data pelaporan (OQ-14)', icon: 'download', body: h('div', { class: 'stack-sm' }, ui.callout('warn', 'Format wajib belum ditetapkan', 'Format laporan keberangkatan ke instansi belum diketahui (OQ-14). Sementara, data diekspor sebagai CSV generik dan dikirim manual.'), h('div', { class: 'row wrap' }, h('select', { class: 'input sel', disabled: true }, h('option', null, 'Format instansi: belum ditetapkan')), h('a', { class: 'btn', href: '#/reports' }, 'Ke Laporan & ekspor'))) })));
    return root;
  }

  // ================================================================ registration
  const add = (path, title, roles, mvp, fn) => BGS.router.add(path, { title, roles, mvp, render: ctx => fn(ctx) });
  add('/users', 'Pengguna & peran', [SA], 1, usersPage);
  add('/roles', 'Matriks izin', [SA, DI], 1, rolesPage);
  add('/audit', 'Audit trail', [SA, DI], 1, auditPage);
  add('/approvals', 'Persetujuan', [SA, DI], 2, approvalsPage);
  add('/data-protection', 'Perlindungan data', [SA, DI, AD], 1, dataProtectionPage);
  add('/settings', 'Pengaturan sistem', [SA], 1, settingsPage);
  add('/ai', 'Asisten AI', [SA, DI, AD], 3, aiPage);
  add('/integrations', 'Integrasi eksternal', [SA], 3, integrationsPage);
})();
