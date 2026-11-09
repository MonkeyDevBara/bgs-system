/* BGS public registration site (BR-002, BR-030, RUL-003, RUL-029, PS-06). Vanilla JS. */
(function () {
  'use strict';
  const BGS = window.BGS || {}, D = BGS.data || { countries: [], professions: [], workers: [] };
  const PN_VERSION = 'PN-2026.1', DRAFT_KEY = 'bgs.regDraft', STORE_KEY = 'bgs.publicRegistrations', RATE_KEY = 'bgs.publicRegTimes';
  const DEMO_DATE = '2026-11-06';
  const app = document.getElementById('app');

  const h = (tag, attrs, ...kids) => {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list' && k !== 'form') { try { el[k] = v; } catch (e) { el.setAttribute(k, v); } }
      else el.setAttribute(k, v === true ? '' : v);
    });
    const add = k => { if (k == null || k === false) return; if (Array.isArray(k)) k.forEach(add); else el.append(k.nodeType ? k : document.createTextNode(k)); };
    kids.forEach(add);
    return el;
  };

  // ---------- master data (friendly wording) ----------
  const PROF_LABEL = { DMW: 'Asisten rumah tangga (Domestic Worker)', CGV: 'Perawat lansia / Caregiver', FAC: 'Operator pabrik', DRV: 'Sopir keluarga', HSK: 'Petugas kebersihan hotel (Housekeeping)' };
  const COUNTRY_ORDER = ['TW', 'JP', 'KR', 'SA', 'AE'];
  const countries = (D.countries || []).slice().sort((a, b) => (COUNTRY_ORDER.indexOf(a.code) + 99) % 99 - (COUNTRY_ORDER.indexOf(b.code) + 99) % 99);
  const professions = D.professions || [];
  const PROVINCES = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Bangka Belitung', 'Bengkulu', 'Lampung', 'DKI Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'DI Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Selatan', 'Papua Tengah', 'Papua Pegunungan', 'Papua Barat Daya'];
  const EDU = ['SD', 'SMP', 'SMA/SMK', 'D3', 'S1'];
  const MARITAL = ['Belum menikah', 'Menikah', 'Cerai'];
  const cName = c => (countries.find(x => x.code === c) || {}).name || c;
  const pName = c => PROF_LABEL[c] || (professions.find(x => x.code === c) || {}).name || c;

  // ---------- state ----------
  const blank = () => ({ name: '', nik: '', dob: '', gender: '', phone: '', city: '', province: '', education: '', marital: '', country: '', profession: '', experience: '', photoName: '', cvName: '' });
  const state = { step: 0, consent: false, data: blank(), done: null, errors: {} };
  const quiz = { a: 0, b: 0, ans: '' };
  const newQuiz = () => { quiz.a = 2 + Math.floor(Math.random() * 7); quiz.b = 2 + Math.floor(Math.random() * 7); quiz.ans = ''; };
  newQuiz();
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.consent) { state.consent = true; Object.assign(state.data, d.data || {}); state.step = Math.min(d.step || 1, 3); state.restored = true; }
  } catch (e) { /* ignore */ }
  // RUL-029: nothing is stored before consent
  const saveDraft = () => { try { if (state.consent) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ consent: true, step: state.step, data: state.data })); } catch (e) { /* ignore */ } };

  // ---------- validation ----------
  const digits = s => String(s || '').replace(/\D/g, '');
  const validators = {
    name: v => (v.trim().length < 3 ? 'Tulis nama lengkap sesuai KTP (minimal 3 huruf).' : /[0-9]/.test(v) ? 'Nama tidak boleh berisi angka.' : ''),
    nik: v => (!v ? 'NIK wajib diisi.' : !/^\d+$/.test(v) ? 'NIK hanya boleh berisi angka.' : v.length !== 16 ? `NIK harus 16 angka. Sekarang baru ${v.length} angka.` : /^(\d)\1{15}$/.test(v) ? 'NIK ini tidak wajar. Mohon cek lagi KTP Anda.' : ''),
    dob: v => {
      if (!v) return 'Pilih tanggal lahir Anda.';
      const d = new Date(v + 'T00:00:00'), t = new Date(DEMO_DATE + 'T00:00:00');
      if (isNaN(d)) return 'Tanggal lahir tidak benar.';
      let age = t.getFullYear() - d.getFullYear(); if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) age--;
      if (age < 0 || age > 80) return 'Tanggal lahir tidak benar. Mohon cek lagi.';
      return age < 18 ? 'Maaf, pendaftar harus berusia minimal 18 tahun.' : '';
    },
    gender: v => (v ? '' : 'Pilih jenis kelamin.'),
    phone: v => { const d = digits(v); return !d ? 'Nomor WhatsApp/telepon wajib diisi.' : !/^(0|62)8?\d+$/.test(d) || d.length < 9 || d.length > 15 ? 'Nomor tidak benar. Contoh: 081234567890' : ''; },
    city: v => (v.trim().length < 3 ? 'Tulis kota atau kabupaten tempat tinggal Anda.' : ''),
    province: v => (v ? '' : 'Pilih provinsi.'),
    education: v => (v ? '' : 'Pilih pendidikan terakhir.'),
    marital: v => (v ? '' : 'Pilih status pernikahan.'),
    country: v => (v ? '' : 'Pilih negara tujuan.'),
    profession: v => (v ? '' : 'Pilih pekerjaan yang diminati.'),
  };
  const stepFields = [[], ['name', 'nik', 'dob', 'gender', 'phone', 'city', 'province', 'education', 'marital'], ['country', 'profession'], []];
  const validateStep = s => {
    state.errors = {};
    stepFields[s].forEach(k => { const m = validators[k](state.data[k]); if (m) state.errors[k] = m; });
    return Object.keys(state.errors).length === 0;
  };
  const dupWorker = () => { const n = state.data.nik; return n && n.length === 16 ? (D.workers || []).find(w => w.nik === n) || null : null; };

  // ---------- helpers ----------
  const live = h('div', { class: 'hp', 'aria-live': 'assertive', role: 'alert' });
  document.body.append(live);
  const announce = m => { live.textContent = ''; setTimeout(() => (live.textContent = m), 30); };
  const focusHeading = () => { const e = app.querySelector('h1'); if (e) { e.setAttribute('tabindex', '-1'); e.focus({ preventScroll: true }); } window.scrollTo({ top: 0 }); };
  const firstError = () => {
    const k = Object.keys(state.errors)[0]; if (!k) return;
    const el = app.querySelector(`[name="${k}"]`) || app.querySelector(`#f-${k}`);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    announce('Ada isian yang belum benar: ' + state.errors[k]);
  };
  const setErr = (k, wrap) => {
    const msg = state.errors[k]; wrap.classList.toggle('err', !!msg);
    const e = wrap.querySelector('.pb-error'); if (e) e.textContent = msg || '';
  };

  function field(k, label, input, opts) {
    opts = opts || {};
    const id = 'f-' + k;
    const wrap = h('div', { class: 'pb-f' + (state.errors[k] ? ' err' : '') });
    wrap.append(h('label', { for: id }, label, ' ', opts.optional ? h('span', { class: 'opt' }, '(boleh dikosongkan)') : h('span', { class: 'req', 'aria-hidden': 'true' }, '*')));
    input.id = id; input.name = k;
    input.setAttribute('aria-describedby', `${id}-e ${id}-h`);
    if (!opts.optional) input.setAttribute('aria-required', 'true');
    if (state.errors[k]) input.setAttribute('aria-invalid', 'true');
    wrap.append(input);
    if (opts.hint) wrap.append(h('p', { class: 'pb-hint', id: id + '-h' }, opts.hint));
    wrap.append(h('p', { class: 'pb-error', id: id + '-e' }, state.errors[k] || ''));
    return wrap;
  }
  const textIn = (k, o) => h('input', Object.assign({ type: 'text', value: state.data[k], autocomplete: 'off', oninput: e => { state.data[k] = e.target.value; saveDraft(); } }, o || {}));
  const selectIn = (k, opts, ph) => {
    const s = h('select', { onchange: e => { state.data[k] = e.target.value; saveDraft(); } }, h('option', { value: '' }, ph), opts.map(([v, l]) => h('option', { value: v, selected: state.data[k] === v }, l)));
    return s;
  };
  const radios = (k, opts) => {
    const wrap = h('div', { class: 'pb-f' + (state.errors[k] ? ' err' : ''), id: 'f-' + k });
    const fs = h('fieldset', { style: 'border:0;padding:0;margin:0', 'aria-describedby': `f-${k}-e` });
    fs.append(h('legend', { style: 'font-weight:700;margin-bottom:6px;padding:0' }, opts.label, ' ', h('span', { class: 'req', 'aria-hidden': 'true' }, '*')));
    fs.append(h('div', { class: 'pb-radios' }, opts.items.map(([v, l], i) => h('label', {}, h('input', { type: 'radio', name: k, value: v, checked: state.data[k] === v, 'aria-required': 'true', onchange: () => { state.data[k] = v; delete state.errors[k]; saveDraft(); setErr(k, wrap); } }), l))));
    wrap.append(fs, h('p', { class: 'pb-error', id: `f-${k}-e` }, state.errors[k] || ''));
    return wrap;
  };

  function stepper() {
    const labels = ['Persetujuan', 'Data diri', 'Tujuan kerja', 'Kirim'];
    return h('div', {},
      h('ol', { class: 'pb-steps', 'aria-label': 'Langkah pendaftaran' }, labels.map((l, i) =>
        h('li', { class: i === state.step ? 'on' : i < state.step ? 'done' : '', 'aria-current': i === state.step ? 'step' : null }, h('span', {}, i < state.step ? '✓' : String(i + 1)), l))),
      h('div', { class: 'pb-bar', role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': 4, 'aria-valuenow': state.step + 1, 'aria-label': `Langkah ${state.step + 1} dari 4` }, h('i', { style: `width:${(state.step + 1) * 25}%` })));
  }

  function go(n, focus) { state.step = n; state.errors = {}; saveDraft(); render(); if (focus !== false) focusHeading(); }
  const nextBtn = (label, fn) => h('button', { type: 'button', class: 'btn btn-p', onclick: fn }, label);
  const backBtn = n => h('button', { type: 'button', class: 'btn btn-s', onclick: () => go(n) }, '← Kembali');

  // ---------- step 0: welcome & consent ----------
  function stepWelcome() {
    const c = h('div', { class: 'pb-consent' + (state.errors.consent ? ' err' : ''), onclick: e => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'A') cb.click(); } });
    const cb = h('input', { type: 'checkbox', id: 'f-consent', name: 'consent', checked: state.consent, 'aria-describedby': 'f-consent-e', 'aria-required': 'true', onchange: e => { state.consent = e.target.checked; if (state.consent) { delete state.errors.consent; } else { try { sessionStorage.removeItem(DRAFT_KEY); } catch (x) { /* */ } } c.classList.remove('err'); err.classList.remove('show'); } });
    const err = h('p', { class: 'pb-error', id: 'f-consent-e' }, 'Anda perlu menyetujui dulu sebelum bisa lanjut. Tanpa persetujuan, data Anda tidak kami simpan.');
    c.append(cb, h('span', {}, h('b', {}, 'Saya sudah membaca dan setuju '), 'data saya dipakai BGS untuk proses pendaftaran kerja ini. Saya tahu persetujuan ini tercatat (versi ', h('b', {}, PN_VERSION), ').'));
    return h('div', { class: 'pb-card' },
      h('h1', {}, 'Selamat datang! Daftar kerja ke luar negeri'),
      h('p', { class: 'pb-lead' }, 'Isi formulir singkat ini sekitar 3–5 menit. Gratis, dan tidak perlu membuat akun.'),
      state.restored ? h('div', { class: 'pb-warn' }, 'Isian Anda sebelumnya masih tersimpan di HP ini, jadi Anda bisa melanjutkan.') : null,
      h('h2', {}, 'Siapa kami?'),
      h('p', {}, h('b', {}, 'PT Berkah Guna Selaras (BGS)'), ' adalah perusahaan penempatan pekerja migran Indonesia di Jakarta Timur. Kami membantu Anda mulai dari seleksi sampai berangkat bekerja ke luar negeri.'),
      h('h2', {}, 'Data apa yang kami minta?'),
      h('ul', { class: 'pb-list' },
        h('li', {}, 'Data diri: nama, NIK, tanggal lahir, nomor HP/WhatsApp, tempat tinggal.'),
        h('li', {}, 'Negara dan pekerjaan yang Anda minati.'),
        h('li', {}, 'Pengalaman kerja, foto, dan CV (boleh dikosongkan).')),
      h('p', {}, 'Kami hanya meminta data yang perlu. Gunanya agar tim BGS bisa menghubungi Anda dan menilai apakah Anda cocok dengan lowongan yang ada.'),
      h('div', { class: 'pb-info' }, h('span', { class: 'ic', 'aria-hidden': 'true' }, 'ℹ️'), h('div', {}, h('b', {}, 'Belum perlu kirim KTP, KK, atau paspor. '), 'Dokumen itu akan diminta langsung oleh petugas BGS nanti, setelah Anda dihubungi.')),
      h('details', {},
        h('summary', {}, 'Baca ringkasan Pemberitahuan Privasi (' + PN_VERSION + ')'),
        h('ul', {},
          h('li', {}, 'Siapa yang mengolah data: PT Berkah Guna Selaras.'),
          h('li', {}, 'Untuk apa: menghubungi Anda, seleksi awal, dan membuat catatan calon pekerja jika Anda lanjut.'),
          h('li', {}, 'Siapa yang bisa melihat: hanya tim petugas BGS.'),
          h('li', {}, 'Berapa lama disimpan: sesuai aturan perusahaan dan hukum; data pendaftaran yang tidak dilanjutkan akan dihapus atau dianonimkan.'),
          h('li', {}, 'Hak Anda: meminta melihat, memperbaiki, atau menghapus data Anda dengan menghubungi BGS.'),
          h('li', {}, 'Data tidak dijual dan tidak dibagikan ke pihak luar tanpa dasar yang sah.')),
        h('p', { class: 'pb-hint' }, 'Pemberitahuan privasi sedang menunggu verifikasi hukum. Isi final dapat berubah.')),
      h('div', { class: 'pb-warn' }, '⚠️ Pemberitahuan privasi sedang menunggu verifikasi hukum.'),
      c, err,
      state.errors.consent ? (err.classList.add('show'), null) : null,
      h('div', { class: 'pb-nav' }, nextBtn('Setuju & Mulai →', () => {
        if (!state.consent) { state.errors.consent = 'x'; c.classList.add('err'); err.classList.add('show'); cb.focus(); announce('Centang persetujuan dulu untuk melanjutkan.'); return; }
        go(1);
      })));
  }

  // ---------- step 1: personal data ----------
  function stepPersonal() {
    const d = state.data;
    const nikIn = textIn('nik', { inputMode: 'numeric', maxLength: 16, placeholder: '16 angka di KTP', autocomplete: 'off' });
    const cnt = h('span', { class: 'pb-count', 'aria-hidden': 'true' }, `${d.nik.length}/16`);
    const dup = h('div', { class: 'pb-warn', style: 'display:none' });
    const upd = () => {
      cnt.textContent = `${d.nik.length}/16`;
      const w = dupWorker();
      dup.style.display = w ? '' : 'none';
      dup.textContent = w ? 'NIK ini sudah pernah terdaftar di BGS. Anda tetap bisa mengirim; petugas akan mengecek dan menggabungkan data supaya tidak dobel.' : '';
    };
    nikIn.addEventListener('input', e => { const v = digits(e.target.value); if (v !== e.target.value) e.target.value = v; d.nik = v; saveDraft(); upd(); });
    const nikField = field('nik', 'NIK (Nomor KTP)', nikIn, { hint: 'Lihat di KTP, 16 angka tanpa spasi.' });
    nikField.querySelector('label').append(cnt);
    nikField.insertBefore(dup, nikField.querySelector('.pb-error'));
    setTimeout(upd, 0);
    const phoneIn = textIn('phone', { type: 'tel', inputMode: 'tel', placeholder: 'Contoh: 081234567890', autocomplete: 'tel' });
    return h('div', { class: 'pb-card' },
      h('h1', {}, 'Data diri Anda'),
      h('p', { class: 'pb-lead' }, 'Isi sesuai KTP. Tanda * artinya wajib diisi.'),
      field('name', 'Nama lengkap', textIn('name', { autocomplete: 'name', placeholder: 'Sesuai KTP' }), { hint: 'Tulis lengkap tanpa singkatan.' }),
      nikField,
      h('div', { class: 'pb-row two' },
        field('dob', 'Tanggal lahir', h('input', { type: 'date', value: d.dob, max: '2008-11-06', onchange: e => { d.dob = e.target.value; saveDraft(); } })),
        radios('gender', { label: 'Jenis kelamin', items: [['P', 'Perempuan'], ['L', 'Laki-laki']] })),
      field('phone', 'Nomor WhatsApp / telepon', phoneIn, { hint: 'Nomor yang aktif. Tim BGS akan menghubungi lewat nomor ini.' }),
      h('div', { class: 'pb-row two' },
        field('city', 'Kota / Kabupaten', textIn('city', { placeholder: 'Contoh: Indramayu', autocomplete: 'address-level2' })),
        field('province', 'Provinsi', selectIn('province', PROVINCES.map(p => [p, p]), '— Pilih provinsi —'))),
      h('div', { class: 'pb-row two' },
        field('education', 'Pendidikan terakhir', selectIn('education', EDU.map(p => [p, p]), '— Pilih —')),
        field('marital', 'Status pernikahan', selectIn('marital', MARITAL.map(p => [p, p]), '— Pilih —'))),
      h('div', { class: 'pb-nav' }, nextBtn('Lanjut →', () => { if (validateStep(1)) go(2); else { render(); firstError(); } }), backBtn(0)));
  }

  // ---------- step 2: destination ----------
  function stepJob() {
    const d = state.data;
    const fileIn = (k, label, accept) => {
      const i = h('input', { type: 'file', accept, id: 'f-' + k, onchange: e => { d[k] = e.target.files[0] ? e.target.files[0].name : ''; saveDraft(); } });
      return h('div', { class: 'pb-f' }, h('label', { for: 'f-' + k }, label, ' ', h('span', { class: 'opt' }, '(boleh dikosongkan)')), i,
        d[k] ? h('p', { class: 'pb-hint' }, 'Tersimpan: ' + d[k] + ' (jika ingin ganti, pilih file lagi)') : null);
    };
    return h('div', { class: 'pb-card' },
      h('h1', {}, 'Tujuan kerja Anda'),
      h('p', { class: 'pb-lead' }, 'Pilih negara dan pekerjaan yang paling Anda minati. Petugas akan membantu mencarikan yang cocok.'),
      field('country', 'Negara tujuan', selectIn('country', countries.map(c => [c.code, c.name]), '— Pilih negara —')),
      field('profession', 'Pekerjaan yang diminati', selectIn('profession', professions.map(p => [p.code, pName(p.code)]), '— Pilih pekerjaan —')),
      field('experience', 'Pengalaman kerja', h('textarea', { rows: 4, maxLength: 600, placeholder: 'Contoh: 2 tahun bekerja di pabrik garmen di Bekasi.', oninput: e => { d.experience = e.target.value; saveDraft(); } }, d.experience), { optional: true, hint: 'Ceritakan singkat pekerjaan yang pernah Anda lakukan.' }),
      fileIn('photoName', 'Pas foto', 'image/*'),
      fileIn('cvName', 'CV / Riwayat hidup', '.pdf,.doc,.docx,image/*'),
      h('p', { class: 'pb-hint' }, 'Foto dan CV tidak wajib. Dokumen resmi (KTP, KK, paspor) belum perlu dikirim di sini.'),
      h('div', { class: 'pb-nav' }, nextBtn('Lanjut ke Tinjau →', () => { if (validateStep(2)) go(3); else { render(); firstError(); } }), backBtn(1)));
  }

  // ---------- step 3: review & submit ----------
  function stepReview() {
    const d = state.data, g = { P: 'Perempuan', L: 'Laki-laki' };
    const fmtDob = v => { const [y, m, dd] = v.split('-'); return `${dd}-${m}-${y}`; };
    const sec = (title, step, rows) => h('section', { class: 'pb-sum' }, h('header', {}, title, h('a', { href: '#', onclick: e => { e.preventDefault(); go(step); } }, 'Ubah')), h('dl', {}, rows.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v || '–')))));
    const ansIn = h('input', { type: 'text', inputMode: 'numeric', autocomplete: 'off', value: quiz.ans, oninput: e => { quiz.ans = e.target.value; } });
    const w = dupWorker();
    return h('div', { class: 'pb-card' },
      h('h1', {}, 'Periksa lagi, lalu kirim'),
      h('p', { class: 'pb-lead' }, 'Pastikan semua data sudah benar. Jika ada yang salah, tekan “Ubah”.'),
      sec('Data diri', 1, [['Nama lengkap', d.name], ['NIK', d.nik], ['Tanggal lahir', fmtDob(d.dob)], ['Jenis kelamin', g[d.gender]], ['WhatsApp / telepon', d.phone], ['Tempat tinggal', `${d.city}, ${d.province}`], ['Pendidikan terakhir', d.education], ['Status pernikahan', d.marital]]),
      sec('Tujuan kerja', 2, [['Negara tujuan', cName(d.country)], ['Pekerjaan', pName(d.profession)], ['Pengalaman kerja', d.experience], ['Pas foto', d.photoName], ['CV', d.cvName]]),
      w ? h('div', { class: 'pb-warn' }, 'NIK ini sudah pernah terdaftar di BGS. Anda tetap bisa mengirim; petugas akan mengecek supaya data tidak dobel.') : null,
      h('div', { class: 'pb-f' + (state.errors.quiz ? ' err' : '') },
        h('label', { for: 'f-quiz' }, `Soal pengaman: ${quiz.a} + ${quiz.b} = ?`, ' ', h('span', { class: 'req', 'aria-hidden': 'true' }, '*')),
        Object.assign(ansIn, { id: 'f-quiz', name: 'quiz' }),
        h('p', { class: 'pb-hint' }, 'Ini untuk memastikan Anda bukan robot.'),
        h('p', { class: 'pb-error', id: 'f-quiz-e', role: 'alert' }, state.errors.quiz || '')),
      h('div', { class: 'hp', 'aria-hidden': 'true' }, h('label', {}, 'Jangan isi kolom ini', h('input', { type: 'text', name: 'website', id: 'hp-website', tabIndex: -1, autocomplete: 'off' }))),
      h('p', { class: 'pb-hint' }, `Dengan menekan “Kirim”, data dikirim ke BGS sesuai persetujuan Anda (${PN_VERSION}).`),
      h('div', { class: 'pb-nav' }, h('button', { type: 'button', class: 'btn btn-p', id: 'btn-submit', onclick: submit }, 'Kirim pendaftaran ✓'), backBtn(2)));
  }

  // ---------- submit ----------
  const readJson = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (e) { return def; } };
  function quizFail(msg) { state.errors.quiz = msg; const wrap = app.querySelector('#f-quiz').parentNode; setErr('quiz', wrap); app.querySelector('#f-quiz').focus(); announce(msg); }
  function submit() {
    if (!state.consent) { go(0); return; }
    // revalidate everything (RUL-029 + data quality)
    for (const s of [1, 2]) if (!validateStep(s)) { go(s, false); firstError(); return; }
    if (String(quiz.ans).trim() !== String(quiz.a + quiz.b)) return quizFail('Jawaban belum tepat. Coba hitung lagi.');
    // honeypot (RSK-11): bots fill hidden field → pretend success, store nothing
    const hp = app.querySelector('#hp-website');
    if (hp && hp.value) { state.done = { id: 'REG-' + DEMO_DATE.slice(2).replace(/-/g, '') + '-0000', name: state.data.name }; render(); focusHeading(); return; }
    // rate limit: max 3 per 10 minutes
    const now = Date.now(), times = readJson(RATE_KEY, []).filter(t => now - t < 10 * 60 * 1000);
    if (times.length >= 3) {
      const wait = Math.max(1, Math.ceil((10 * 60 * 1000 - (now - Math.min(...times))) / 60000));
      return quizFail(`Terlalu banyak pendaftaran dari perangkat ini. Coba lagi sekitar ${wait} menit lagi.`);
    }
    const list = readJson(STORE_KEY, []);
    const d = state.data, w = dupWorker();
    const ymd = DEMO_DATE.slice(2).replace(/-/g, '');
    let seq = 9001 + list.length; while (list.some(r => r.id === `REG-${ymd}-${seq}`)) seq++;
    const at = DEMO_DATE + 'T' + new Date().toTimeString().slice(0, 8) + '+07:00';
    const reg = {
      id: `REG-${ymd}-${seq}`, name: d.name.trim().replace(/\s+/g, ' '), nik: d.nik, phone: digits(d.phone).replace(/^62/, '0'), country: d.country, profession: d.profession,
      gender: d.gender, dob: d.dob, city: `${d.city.trim()}, ${d.province}`, province: d.province, education: d.education, maritalStatus: d.marital,
      submittedAt: at, status: 'NEW', consent: { version: PN_VERSION, at, channel: 'Website' }, reviewedBy: null, reason: null, resultWorkerId: null,
      dupOf: w ? w.id : null, userAgent: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
      photoName: d.photoName || '', cvName: d.cvName || '', experience: d.experience.trim(),
    };
    list.push(reg);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); times.push(now); localStorage.setItem(RATE_KEY, JSON.stringify(times)); }
    catch (e) { return quizFail('Maaf, data belum bisa disimpan di perangkat ini. Coba lagi.'); }
    try { sessionStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    state.done = reg; render(); focusHeading();
  }

  // ---------- success ----------
  function stepDone() {
    return h('div', { class: 'pb-card pb-done' },
      h('div', { class: 'tick', 'aria-hidden': 'true' }, '✓'),
      h('h1', {}, 'Pendaftaran terkirim. Terima kasih!'),
      h('p', { class: 'pb-lead' }, 'Halo ' + state.done.name.split(' ')[0] + ', data Anda sudah kami terima. Simpan nomor ini:'),
      h('div', { class: 'pb-regno' }, state.done.id),
      h('h2', {}, 'Apa selanjutnya?'),
      h('ol', { class: 'pb-next' },
        h('li', {}, 'Tim BGS akan menghubungi Anda lewat WhatsApp/telepon. Tidak perlu membuat akun.'),
        h('li', {}, 'Petugas akan meminta dokumen (KTP, KK, paspor) langsung, bukan lewat situs ini.'),
        h('li', {}, 'Jika cocok, Anda diundang wawancara dan seleksi.')),
      h('div', { class: 'pb-warn' }, 'Hati-hati penipuan: BGS tidak pernah meminta uang lewat pesan singkat sebelum Anda bertemu petugas resmi.'),
      h('div', { class: 'pb-contact' }, h('b', {}, 'Hubungi BGS'), h('br'),
        'Telepon: ', h('a', { href: 'tel:0218584577' }, '021-8584577'), h('br'),
        'WhatsApp: ', h('a', { href: 'https://wa.me/6285280944939' }, '+62 852-8094-4939'), ' / ', h('a', { href: 'https://wa.me/6285177823970' }, '+62 851-7782-3970'), h('br'),
        'Email: ', h('a', { href: 'mailto:berkahguna.selaras@yahoo.com' }, 'berkahguna.selaras@yahoo.com'), h('br'),
        'Alamat: Jl. Bekasi Timur XI No. 17/12, Rawa Bunga, Jatinegara, Jakarta Timur'),
      h('div', { class: 'pb-nav', style: 'flex-direction:column' }, h('button', { type: 'button', class: 'btn btn-a', onclick: () => { state.data = blank(); state.step = 0; state.consent = false; state.restored = false; state.done = null; state.errors = {}; newQuiz(); render(); focusHeading(); } }, 'Daftar orang lain')));
  }

  function render() {
    app.replaceChildren();
    if (state.done) { app.append(stepDone()); return; }
    app.append(stepper(), [stepWelcome, stepPersonal, stepJob, stepReview][state.step]());
  }

  render();
  if (state.restored) { /* resumed draft: keep focus natural */ }
})();
