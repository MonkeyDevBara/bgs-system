// Generates docs/prd-workflow-utama.html (flowcharts are computed so coordinates stay consistent).
import { writeFileSync } from "node:fs";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------- shared svg helpers ----------
const node = (x, y, w, h, lead, tags, title, sub, extra = "") =>
  `<g><rect class="n o-${lead}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>` +
  `<text class="tag tg-${lead}" x="${x + 12}" y="${y + 16}">${esc(tags)}</text>` +
  `<text class="t" x="${x + 12}" y="${y + 34}">${esc(title)}</text>` +
  (sub ? `<text class="s" x="${x + 12}" y="${y + 51}">${esc(sub)}</text>` : "") +
  extra +
  `</g>`;

const diamond = (cx, cy, w, h, l1, l2) =>
  `<g><polygon class="n dm" points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}"/>` +
  `<text class="t mid" x="${cx}" y="${cy - 3}">${esc(l1)}</text>` +
  `<text class="t mid" x="${cx}" y="${cy + 14}">${esc(l2)}</text></g>`;

const path = (d, dash = false) =>
  `<path class="ln${dash ? " dash" : ""}" d="${d}" marker-end="url(#ah)"/>`;
const label = (x, y, t) => `<text class="lbl" x="${x}" y="${y}">${esc(t)}</text>`;

const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path class="ah" d="M0,0 L10,5 L0,10 z"/></marker></defs>`;

// ---------- diagram 1: end-to-end ----------
function diagram1() {
  const cx = 270, w = 300, x = cx - w / 2, H = 62;
  const sx = 500, sw = 250; // side column
  const Y = { s0: 10, s1: 106, d1: 202, s2: 312, d2: 408, s3: 518, s4: 614, d3: 710, s5: 820, s6: 916, s7: 1012, s8: 1108, s9: 1204 };
  const DH = 76;
  let o = defs;

  // phase rails
  const phases = [
    ["1 FORM CV", 10, 278],
    ["2 SCREENING", 312, 484],
    ["3 PROCESSING", 518, 882],
    ["4 OUTPUT", 916, 1074],
    ["5 PASCA-BERANGKAT", 1108, 1266],
  ];
  for (const [t, a, b] of phases) {
    o += `<line class="rail" x1="100" y1="${a}" x2="100" y2="${b}"/>`;
    o += `<text class="phase" transform="translate(86 ${(a + b) / 2}) rotate(-90)">${t}</text>`;
  }

  // main nodes
  o += node(x, Y.s0, w, H, "cpmi", "CPMI", "Calon worker membuka form", "via link / QR, atau diinput Admin");
  o += node(x, Y.s1, w, H, "cpmi", "CPMI", "Isi Form CV + data diri", "pilih negara & profesi, unggah dokumen awal");
  o += diamond(cx, Y.d1 + DH / 2, w, DH, "Kuota kode unik", "negara-profesi ada?");
  o += node(x, Y.s2, w, H, "pic", "PIC · ADMIN", "Screening skill + dokumen", "cek dokumen, tes skill (Zoom / tatap muka)");
  o += diamond(cx, Y.d2 + DH / 2, w, DH, "Lolos screening?", "");
  o += node(x, Y.s3, w, H, "admin", "ADMIN · CPMI", "Perjanjian Penempatan", "TTD Direktur & CPMI; kuota jadi terpakai");
  o += node(x, Y.s4, w, H, "pic", "PIC · CPMI", "Fase A: pemenuhan dokumen", "9 langkah paralel (lihat diagram 2)");
  o += diamond(cx, Y.d3 + DH / 2, w, DH, "Semua langkah wajib", "sudah selesai?");
  o += node(x, Y.s5, w, H, "pic", "PIC · CPMI", "Fase B: OPP, biometrik, E-KPMI", "berurutan (lihat diagram 2)");
  o += node(x, Y.s6, w, H, "pic", "PIC · CPMI", "Pemberangkatan", "tiket, jadwal, antar ke bandara");
  o += node(x, Y.s7, w, H, "admin", "ADMIN", "OUTPUT: laporan keberangkatan", "ke KP2MI, tembusan Perwakilan RI / KDEI");
  o += node(x, Y.s8, w, H, "pic", "PIC", "Monitoring selama bekerja", "check-in berkala, laporan min. 1x");
  o += node(x, Y.s9, w, H, "pic", "PIC · ADMIN", "Kepulangan / perpanjangan → Selesai", "lapor data pulang atau perpanjang kontrak");

  // main arrows
  const down = (a, b, yes) => {
    o += path(`M${cx},${a} L${cx},${b}`);
    if (yes) o += label(cx + 8, a + 21, "Ya");
  };
  down(Y.s0 + H, Y.s1);
  down(Y.s1 + H, Y.d1);
  down(Y.d1 + DH, Y.s2, true);
  down(Y.s2 + H, Y.d2);
  down(Y.d2 + DH, Y.s3, true);
  down(Y.s3 + H, Y.s4);
  down(Y.s4 + H, Y.d3);
  down(Y.d3 + DH, Y.s5, true);
  down(Y.s5 + H, Y.s6);
  down(Y.s6 + H, Y.s7);
  down(Y.s7 + H, Y.s8);
  down(Y.s8 + H, Y.s9);
  o += label(cx + 8, Y.d2 + DH + 21, "Ya · kuota di-reserve");

  // side: no quota
  o += node(sx, Y.d1 + 7, sw, H, "sys", "SISTEM", "Waiting list", "antre FIFO; ditawari saat kuota dibuka");
  o += path(`M${cx + w / 2},${Y.d1 + DH / 2} L${sx},${Y.d1 + DH / 2}`);
  o += label(cx + w / 2 + 8, Y.d1 + DH / 2 - 6, "Tidak");
  o += path(`M${sx + sw / 2},${Y.d1 + 7 + H} L${sx + sw / 2},${Y.s2 + H / 2} L${x + w},${Y.s2 + H / 2}`, true);

  // side: not pass
  o += node(sx, Y.d2 + 7, sw, H, "pic", "PIC · ADMIN", "Revisi / tolak", "kurang dok → revisi; gagal → Talent Pool");
  o += path(`M${cx + w / 2},${Y.d2 + DH / 2} L${sx},${Y.d2 + DH / 2}`);
  o += label(cx + w / 2 + 8, Y.d2 + DH / 2 - 6, "Tidak");
  o += path(`M${sx + sw / 2},${Y.d2 + 7} L${sx + sw / 2},${Y.s2 + H / 2 + 12} L${x + w},${Y.s2 + H / 2 + 12}`, true);
  o += label(sx + sw / 2 + 6, Y.d2 - 14, "revisi: ulang screening");

  // side: gate not ready
  o += node(sx, Y.d3 + 7, sw, H, "sys", "SISTEM", "Pengingat + eskalasi ke PIC", "langkah wajib belum selesai");
  o += path(`M${cx + w / 2},${Y.d3 + DH / 2} L${sx},${Y.d3 + DH / 2}`);
  o += label(cx + w / 2 + 8, Y.d3 + DH / 2 - 6, "Belum");
  o += path(`M${sx + sw / 2},${Y.d3 + 7} L${sx + sw / 2},${Y.s4 + H / 2} L${x + w},${Y.s4 + H / 2}`, true);

  return `<svg class="fc" viewBox="0 0 770 1290" width="720" height="${Math.round(1290*720/770)}" role="img" aria-label="Flowchart alur utama CPMI dari form CV sampai selesai">${o}</svg>`;
}

// ---------- diagram 2: processing detail ----------
function diagram2() {
  const cw = 350, ch = 80, pitch = 100;
  const c1 = 20, c2 = 400;
  let o = defs;
  const badge = (cx, cy, t) =>
    `<circle class="bd" cx="${cx}" cy="${cy}" r="12"/><text class="bdt" x="${cx}" y="${cy + 4}">${t}</text>`;
  const card = (x, y, lead, tags, n, title, desc, dep) =>
    `<g><rect class="n o-${lead}" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="10"/>` +
    badge(x + 22, y + 24, n) +
    `<text class="tag tg-${lead}" x="${x + 44}" y="${y + 16}">${esc(tags)}</text>` +
    `<text class="t" x="${x + 44}" y="${y + 34}">${esc(title)}</text>` +
    `<text class="s" x="${x + 44}" y="${y + 52}">${esc(desc)}</text>` +
    `<text class="s dep" x="${x + 44}" y="${y + 68}">${esc(dep)}</text></g>`;

  o += `<text class="phase2" x="20" y="20">FASE A · PEMENUHAN DOKUMEN (PARALEL, SESUAI TEMPLATE NEGARA)</text>`;
  const top = 36;
  o += `<line class="bar" x1="10" y1="${top}" x2="760" y2="${top}"/>`;

  const A = [
    ["admin", "ADMIN · CPMI", "1", "Perjanjian Penempatan", "Admin siapkan di Sisko; Direktur & CPMI TTD", "Syarat: lulus screening, kuota ter-reserve"],
    ["cpmi", "CPMI · PIC", "2", "Daftar akun Sisko P2MI", "CPMI buat akun & unggah dokumen; PIC bantu", "Syarat: dokumen screening valid"],
    ["cpmi", "CPMI · PIC", "3", "Medical check-up + psikologi", "CPMI hadir di klinik; PIC jadwalkan & unggah", "Syarat: jadwal klinik; hasil = surat keterangan"],
    ["cpmi", "CPMI · PIC", "4", "Paspor RI", "CPMI urus ke imigrasi; PIC mendampingi", "Syarat: KTP, KK valid"],
    ["pic", "PIC", "5", "BPJS Ketenagakerjaan", "PIC daftarkan & bayar iuran", "Syarat: setelah (1) TTD Perjanjian Penempatan"],
    ["pic", "PIC", "6", "Apostil / legalisir dokumen", "PIC kirim ke instansi, lacak resi", "Syarat: jika diminta negara tujuan"],
    ["cpmi", "CPMI · PIC", "7", "Prometrik / uji kompetensi", "PIC jadwalkan; CPMI ikut ujian", "Syarat: jika diminta negara & profesi"],
    ["pic", "PIC", "8", "Persiapan Visa kerja", "PIC proses; Saudi lewat Enjaz & Basma", "Syarat: (3) medical dan (4) paspor selesai"],
    ["pic", "PIC · CPMI", "9", "Perjanjian Kerja", "Pemberi kerja & CPMI TTD; PIC fasilitasi", "Syarat: demand letter / job order aktif"],
  ];
  const y0 = top + 20;
  A.forEach((a, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    o += card(col ? c2 : c1, y0 + row * pitch, ...a);
  });
  const lastBottom = y0 + 4 * pitch + ch; // 5 rows
  // legend in the empty slot
  const lx = c2, ly = y0 + 4 * pitch;
  o += `<g><rect class="legend" x="${lx}" y="${ly}" width="${cw}" height="${ch}" rx="10"/>` +
    `<text class="tag" x="${lx + 14}" y="${ly + 18}" fill="var(--gx-muted)">PEMILIK LANGKAH</text>` +
    `<rect class="o-cpmi sw" x="${lx + 14}" y="${ly + 30}" width="14" height="14" rx="3"/><text class="s" x="${lx + 34}" y="${ly + 42}">CPMI</text>` +
    `<rect class="o-admin sw" x="${lx + 84}" y="${ly + 30}" width="14" height="14" rx="3"/><text class="s" x="${lx + 104}" y="${ly + 42}">Admin</text>` +
    `<rect class="o-pic sw" x="${lx + 164}" y="${ly + 30}" width="14" height="14" rx="3"/><text class="s" x="${lx + 184}" y="${ly + 42}">PIC</text>` +
    `<rect class="o-sys sw" x="${lx + 224}" y="${ly + 30}" width="14" height="14" rx="3"/><text class="s" x="${lx + 244}" y="${ly + 42}">Sistem</text>` +
    `<text class="s" x="${lx + 14}" y="${ly + 66}">Warna = pemilik utama; label = yang terlibat</text></g>`;

  const join = lastBottom + 18;
  o += `<line class="rail" x1="10" y1="${top}" x2="10" y2="${join}"/><line class="rail" x1="760" y1="${top}" x2="760" y2="${join}"/>`;
  o += `<line class="bar" x1="10" y1="${join}" x2="760" y2="${join}"/>`;

  const gcy = join + 70, gw = 420, gh = 80, gcx = 385;
  o += path(`M${gcx},${join} L${gcx},${gcy - gh / 2}`);
  o += diamond(gcx, gcy, gw, gh, "GATE A: semua langkah", "wajib 1-9 selesai?");
  const gb = gcy + gh / 2;
  o += label(gcx + 8, gb + 16, "Ya");
  // not ready loop (left)
  o += path(`M${gcx - gw / 2},${gcy} L${14},${gcy} L${14},${join - 10}`, true);
  o += label(24, gcy - 8, "Belum: kembali");

  const bt = gb + 60;
  o += `<text class="phase2" x="${c2}" y="${bt - 8}">FASE B · PRA-BERANGKAT (BERURUTAN)</text>`;
  const by1 = bt + 6, by2 = by1 + pitch;
  o += card(c1, by1, "pic", "PIC · CPMI", "B1", "OPP (Orientasi Pra Pemberangkatan)", "PIC daftarkan via Sisko; CPMI hadir sesuai jadwal", "Syarat: paspor + visa + PK; BPJS selama/purna");
  o += card(c2, by1, "cpmi", "CPMI · PIC", "B2", "Pencocokan biometrik", "CPMI hadir langsung; dicatat di Sisko", "Syarat: OPP selesai");
  o += card(c2, by2, "pic", "PIC", "B3", "E-KPMI terbit", "PIC cek & simpan E-KPMI (tanpa biaya)", "Syarat: biometrik tercatat");
  o += card(c1, by2, "pic", "PIC · CPMI", "B4", "Tiket, jadwal, keberangkatan", "PIC informasikan jadwal; CPMI berangkat", "Syarat: E-KPMI sudah ada");
  o += path(`M${c1 + cw},${by1 + ch / 2} L${c2},${by1 + ch / 2}`);
  o += path(`M${c2 + cw / 2},${by1 + ch} L${c2 + cw / 2},${by2}`);
  o += path(`M${c2},${by2 + ch / 2} L${c1 + cw},${by2 + ch / 2}`);
  o += path(`M${gcx},${gb} L${gcx},${gb + 24} L${c1 + cw / 2},${gb + 24} L${c1 + cw / 2},${by1}`);

  const Hh = by2 + ch + 20;
  return `<svg class="fc" viewBox="0 0 770 ${Hh}" width="720" height="${Math.round(Hh*720/770)}" role="img" aria-label="Flowchart detail tahap processing">${o}</svg>`;
}

const d1 = diagram1();
const d2 = diagram2();

const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="ghostex-page" content="v2">
<title>PRD BGS App: workflow utama CPMI</title>
<style>
  .fc { display:block; }
  .fc text { font-family: var(--font-sans); }
  .fc .n { fill: var(--gx-surface); stroke-width: 1.6; }
  .fc .dm { stroke: var(--gx-warn); }
  .fc .t { font-size: 13px; font-weight: 600; fill: var(--gx-fg); }
  .fc .mid { text-anchor: middle; }
  .fc .s { font-size: 11px; fill: var(--gx-muted); }
  .fc .dep { font-style: italic; font-size: 10.5px; }
  .fc .tag { font-size: 10px; font-weight: 700; letter-spacing: .06em; }
  .fc .ln { stroke: var(--gx-muted); stroke-width: 1.5; fill: none; }
  .fc .dash { stroke-dasharray: 5 4; }
  .fc .ah { fill: var(--gx-muted); }
  .fc .lbl { font-size: 11px; font-weight: 600; fill: var(--gx-muted); }
  .fc .rail { stroke: var(--gx-line-strong); stroke-width: 2; }
  .fc .bar { stroke: var(--gx-fg); stroke-width: 3; opacity: .55; }
  .fc .phase { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-anchor: middle; fill: var(--gx-muted); }
  .fc .phase2 { font-size: 11px; font-weight: 700; letter-spacing: .08em; fill: var(--gx-muted); }
  .fc .bd { fill: var(--gx-raised); stroke: var(--gx-line-strong); stroke-width: 1; }
  .fc .bdt { font-size: 10px; font-weight: 700; fill: var(--gx-fg); text-anchor: middle; }
  .fc .legend { fill: none; stroke: var(--gx-line-strong); stroke-dasharray: 3 3; }
  .fc .sw { fill: var(--gx-surface); stroke-width: 2; }
  .fc .o-cpmi { stroke: var(--chart-1); } .fc .tg-cpmi { fill: var(--chart-1); }
  .fc .o-admin { stroke: var(--chart-2); } .fc .tg-admin { fill: var(--chart-2); }
  .fc .o-pic { stroke: var(--chart-3); } .fc .tg-pic { fill: var(--chart-3); }
  .fc .o-sys { stroke: var(--chart-4); stroke-dasharray: 4 3; } .fc .tg-sys { fill: var(--chart-4); }
  .fc .o-sys.sw { stroke-dasharray: none; }
  gx-wide, .gx-figure { min-width: 0; max-width: 100%; }
  td code, th code { white-space: nowrap; }
  .nw { white-space: nowrap; }
  .tbl { overflow-x: auto; }
  .tbl table { min-width: 560px; }
</style>
</head>
<body>
<gx-page>
  <header>
    <span class="gx-eyebrow">PRD · BGS App · v0.1 draft</span>
    <h1>PRD BGS App: workflow utama CPMI</h1>
    <p class="gx-lede">Dari Form CV sampai berangkat dan dipantau, siapa mengerjakan apa (CPMI, PIC, Admin), bagaimana kuota per negara-profesi dikunci, dan apa yang harus terlihat di dashboard.</p>
    <div class="gx-chips">
      <span class="gx-chip"><b>4</b> role</span>
      <span class="gx-chip"><b>5</b> fase</span>
      <span class="gx-chip"><b>9+4</b> langkah processing</span>
      <span class="gx-chip">Basis: Permen KP2MI 2/2026</span>
    </div>
  </header>

  <h2>1. Ringkasan</h2>
  <div class="gx-callout">
    <b>Masalah.</b> BGS menangani banyak CPMI ke banyak negara, dengan langkah yang dikerjakan dua pihak (PIC dan calon worker) dan tiap negara punya syarat berbeda. Tanpa satu sistem, sulit tahu <b>siapa memegang worker mana</b>, langkah mana yang macet, sisa kuota, dan laporan wajib ke KP2MI. <i>(Asumsi dari interview; kondisi proses sekarang belum dikonfirmasi.)</i>
  </div>

  <h3>Tujuan</h3>
  <ul>
    <li><b>G1</b> Satu alur baku Form CV → Screening → Processing → Output, dapat dikonfigurasi per negara-profesi.</li>
    <li><b>G2</b> Setiap worker punya <b>satu PIC penanggung jawab</b> dan setiap langkah punya pemilik jelas (PIC atau CPMI).</li>
    <li><b>G3</b> Kuota per kode unik negara-profesi tidak bisa terlampaui.</li>
    <li><b>G4</b> Dashboard memperlihatkan kondisi keseluruhan dan kewajiban lapor ke regulator.</li>
  </ul>
  <h3>Bukan tujuan (PRD ini)</h3>
  <p>Biaya penempatan dan pembayaran, payroll, integrasi API ke Sisko P2MI, tanda tangan elektronik, aplikasi native. Alasan: butuh keputusan terpisah (lihat pertanyaan terbuka).</p>

  <h3>Ukuran keberhasilan</h3>
  <div class="tbl"><table>
    <thead><tr><th>Metrik</th><th>Target</th></tr></thead>
    <tbody>
      <tr><td>Worker aktif tanpa PIC</td><td>0</td></tr>
      <tr><td>Penerimaan melebihi kuota</td><td>0</td></tr>
      <tr><td>Keberangkatan yang sudah dilaporkan ke KP2MI</td><td>100%</td></tr>
      <tr><td>Median waktu Form CV → berangkat</td><td>Baseline diukur 1 bulan pertama, target ditetapkan setelahnya</td></tr>
      <tr><td>Langkah melewati batas waktu (SLA)</td><td>Diusulkan &lt; 10%; batas waktu per langkah ditentukan owner</td></tr>
    </tbody>
  </table></div>

  <h2>2. Role dan akses</h2>
  <p>CPMI memakai portal sendiri di HP. Tiga role internal sesuai interview: Superadmin, Admin, PIC.</p>
  <div class="tbl"><table>
    <thead><tr><th>Kemampuan</th><th>Superadmin</th><th>Admin</th><th>PIC</th><th>CPMI</th></tr></thead>
    <tbody>
      <tr><td>Kelola user dan role</td><td>✓</td><td>–</td><td>–</td><td>–</td></tr>
      <tr><td>Kode unik dan kuota</td><td>✓ aktifkan, ubah</td><td>buat draf</td><td>lihat</td><td>–</td></tr>
      <tr><td>Template langkah per negara</td><td>✓</td><td>✓</td><td>–</td><td>–</td></tr>
      <tr><td>Lihat data worker</td><td>semua</td><td>semua</td><td>miliknya</td><td>dirinya</td></tr>
      <tr><td>Verifikasi dokumen, nilai skill</td><td>✓</td><td>✓</td><td>worker miliknya</td><td>–</td></tr>
      <tr><td>Putuskan lulus / tolak</td><td>✓</td><td>✓</td><td>usul</td><td>–</td></tr>
      <tr><td>Tetapkan / ganti PIC</td><td>✓</td><td>✓</td><td>–</td><td>–</td></tr>
      <tr><td>Kerjakan langkah processing</td><td>✓</td><td>✓</td><td>bagian PIC</td><td>bagian CPMI</td></tr>
      <tr><td>Override gate / kuota (wajib alasan)</td><td>✓</td><td>–</td><td>–</td><td>–</td></tr>
      <tr><td>Dashboard penuh + laporan regulator</td><td>✓</td><td>✓</td><td>beban sendiri</td><td>status sendiri</td></tr>
      <tr><td>Audit log</td><td>✓</td><td>lihat</td><td>–</td><td>–</td></tr>
    </tbody>
  </table></div>

  <h2>3. Alur utama (diagram 1)</h2>
  <p>Satu jalur utama, tiga cabang keputusan. Garis putus-putus = kembali ke langkah sebelumnya. Warna = pemilik utama langkah.</p>
  <figure class="gx-figure">
    <div style="overflow-x:auto;max-width:100%">${d1}</div>
    <figcaption>Diagram 1. Alur utama CPMI. Biru CPMI, oranye Admin, hijau PIC, putus-putus Sistem (otomatis).</figcaption>
  </figure>
  <div class="gx-callout" data-tone="warn">
    <b>Urutan resmi berbeda dari urutan interview.</b> Permen KP2MI 2/2026 Pasal 27 menyebut: pendaftaran (akun Sisko, pilih P3MI, jabatan, tempat seleksi, unggah dokumen) → seleksi → pemenuhan dokumen → OPP → pemberangkatan. Interview menaruh "daftar Sisko" <i>setelah</i> screening. Usulan: screening BGS diperlakukan sebagai <b>pra-seleksi internal</b>, dan urutan tiap langkah dikunci lewat template yang bisa diubah Admin. Perlu dikonfirmasi ke owner / Disnaker.
  </div>

  <h2>4. Tahap, status, dan syarat lanjut</h2>
  <div class="tbl"><table>
    <thead><tr><th>Fase</th><th>Status</th><th>Pemilik</th><th>Syarat lanjut</th></tr></thead>
    <tbody>
      <tr><td class="nw">1 Form CV</td><td><code>DRAFT</code> → <code>SUBMITTED</code></td><td>CPMI (Admin boleh input)</td><td>Data wajib + dokumen awal lengkap; NIK tidak duplikat; kode negara-profesi dipilih</td></tr>
      <tr><td class="nw">2 Screening</td><td><code>DOKUMEN_REVIEW</code> → <code>SKILL_TEST</code> → <code>LULUS</code> / <code>REVISI</code> / <code>DITOLAK</code> / <code>WAITING_LIST</code></td><td>PIC verifikasi, Admin putuskan</td><td>Semua dokumen valid, skor skill memenuhi ambang profesi, PIC ditetapkan, kuota ter-reserve</td></tr>
      <tr><td class="nw">3 Processing A</td><td><code>DOKUMEN_PROSES</code></td><td>PIC + CPMI</td><td>Gate A: semua langkah wajib template selesai dan bukti terverifikasi</td></tr>
      <tr><td class="nw">3 Processing B</td><td><code>PRA_BERANGKAT</code> (OPP → biometrik → E-KPMI)</td><td>PIC + CPMI</td><td>E-KPMI sudah ada</td></tr>
      <tr><td class="nw">4 Output</td><td><code>SIAP_BERANGKAT</code> → <code>BERANGKAT</code></td><td>PIC, Admin</td><td>Tanggal, tiket, pemberi kerja terisi; laporan keberangkatan dibuat</td></tr>
      <tr><td class="nw">5 Pasca</td><td><code>BEKERJA</code> → <code>PULANG</code> / <code>PERPANJANG</code> → <code>SELESAI</code></td><td>PIC</td><td>Pemantauan min. 1x tercatat; kepulangan / perpanjangan dilaporkan</td></tr>
      <tr><td class="nw">Kapan saja</td><td><code>MUNDUR</code> / <code>DITUNDA</code></td><td>Admin</td><td>Alasan wajib; kuota dilepas otomatis</td></tr>
    </tbody>
  </table></div>
</gx-page>

<gx-page>
  <h2>5. Processing: langkah dan pemilik (diagram 2)</h2>
  <p>Inti permintaan owner: sebagian langkah dikerjakan PIC, sebagian CPMI. Setiap langkah di template punya <b>eksekutor</b>, <b>syarat (dependensi)</b>, wajib / opsional, dan <b>bukti</b> (file atau nomor) yang diverifikasi PIC.</p>
  <figure class="gx-figure">
    <div style="overflow-x:auto;max-width:100%">${d2}</div>
    <figcaption>Diagram 2. Detail processing. Dependensi OPP, biometrik, dan E-KPMI mengikuti Permen KP2MI 2/2026 Pasal 35, 39, 40. Dependensi visa dan sisanya adalah usulan default.</figcaption>
  </figure>
  <h3>Aturan template</h3>
  <ul>
    <li>Template dipilih berdasarkan kode unik (negara + profesi). Langkah di luar daftar default, misalnya <b>Enjaz &amp; Basma</b> untuk Saudi, ditambahkan Admin sebagai langkah kustom.</li>
    <li>Langkah yang dikerjakan CPMI muncul di portal CPMI sebagai tugas dengan tenggat; langkah PIC muncul di inbox PIC.</li>
    <li>Gate menolak lanjut ke OPP atau berangkat bila ada langkah wajib belum selesai. Override hanya Superadmin dengan alasan tercatat.</li>
    <li>Template v1 yang diisi lengkap hanya Saudi (dari contoh Instagram). Taiwan, Jepang, Korea Selatan, Dubai menunggu daftar langkah dari owner.</li>
  </ul>

  <h2>6. Kode unik dan kuota</h2>
  <ul>
    <li>Format usulan: <code>{NEGARA}-{PROFESI}-{YYMM}-{NN}</code>, contoh <code>TW-CGV-2611-01</code>. Satu kode = satu negara + satu profesi + satu batch.</li>
    <li>Sumber kuota: surat permintaan (demand letter) yang tercantum di SIP2MI. Kode wajib menyimpan nomor SIP2MI, mitra usaha / pemberi kerja, dan tanggal tutup. Seleksi harus sesuai kualifikasi jabatan di surat permintaan (Permen 2/2026 Pasal 25, 31).</li>
    <li>Invarian: <code>Kuota = Reserved + Terpakai + Sisa</code>, <code>Sisa ≥ 0</code>.</li>
    <li><b>Reserved</b> saat status <code>LULUS</code>. <b>Terpakai</b> saat Perjanjian Penempatan ditandatangani. <b>Dilepas</b> saat <code>MUNDUR</code> / <code>DITOLAK</code> / lewat batas waktu tanpa progres (usulan 14 hari).</li>
    <li>Sisa = 0 → pendaftar baru masuk waiting list FIFO. Saat kuota dilepas, sistem menawarkan ke antrean teratas.</li>
    <li>Kode yang ditutup atau kedaluwarsa hilang dari pilihan form CPMI.</li>
  </ul>
  <div class="tbl"><table>
    <thead><tr><th>Kode</th><th>Negara</th><th>Profesi</th><th>Kuota</th><th>Terpakai</th><th>Reserved</th><th>Sisa</th></tr></thead>
    <tbody>
      <tr><td><code>TW-CGV-2611-01</code></td><td>Taiwan</td><td>Caregiver</td><td>20</td><td>6</td><td>4</td><td>10</td></tr>
      <tr><td><code>SA-DOM-2611-01</code></td><td>Arab Saudi</td><td>Domestik</td><td>30</td><td>12</td><td>9</td><td>9</td></tr>
      <tr><td><code>JP-CGV-2612-01</code></td><td>Jepang</td><td>Caregiver</td><td>10</td><td>0</td><td>10</td><td>0</td></tr>
    </tbody>
  </table></div>
  <p class="gx-lede" style="font-size:13px">Data contoh ilustrasi, bukan data BGS. Baris ketiga: sisa 0, pendaftar berikutnya masuk waiting list.</p>

  <h2>7. Dashboard</h2>
  <div class="tbl"><table>
    <thead><tr><th>Widget</th><th>Menjawab</th></tr></thead>
    <tbody>
      <tr><td>Funnel per fase</td><td>Berapa worker di tiap status, filter negara / profesi / PIC / periode</td></tr>
      <tr><td>Kuota per kode</td><td>Total, reserved, terpakai, sisa; kode hampir penuh atau hampir tutup</td></tr>
      <tr><td>Worker macet</td><td>Tidak ada progres lebih dari N hari, per langkah dan PIC</td></tr>
      <tr><td>Beban PIC</td><td>Jumlah worker aktif dan tugas terlambat per PIC</td></tr>
      <tr><td>Kepatuhan pelaporan</td><td>Keberangkatan belum dilapor, pemantauan belum 1x, kepulangan belum dilapor</td></tr>
      <tr><td>Dokumen hampir kedaluwarsa</td><td>Hasil medical, paspor, visa</td></tr>
      <tr><td>Output</td><td>Jumlah berangkat per bulan per negara</td></tr>
    </tbody>
  </table></div>
  <div class="gx-callout">
    <b>Kewajiban lapor P3MI (Permen KP2MI 2/2026).</b> Tiap keberangkatan dilaporkan ke Menteri/Kepala, tembusan Perwakilan RI atau KDEI (Ps. 41). Hasil pemantauan selama bekerja dilaporkan minimal 1 kali (Ps. 43). Kepulangan dan perpanjangan Perjanjian Kerja dilaporkan; tidak lapor dapat kena sanksi administratif (Ps. 44). Aplikasi ini menyiapkan datanya; input resmi tetap di Sisko P2MI.
  </div>
  <p>Format laporan yang diminta KP2MI / Disnaker belum saya lihat; widget kepatuhan ditetapkan dari pasal di atas dan disesuaikan setelah owner memberi contoh.</p>

  <h2>8. Kebutuhan fungsional</h2>
  <div class="tbl"><table>
    <thead><tr><th>ID</th><th>Kebutuhan</th><th>Prioritas</th></tr></thead>
    <tbody>
      <tr><td>FR-01</td><td>Form CV publik, mobile-first, via link / QR; simpan draf. Data identitas mengikuti Sisko (NIK, nama, tanggal lahir, nama ibu kandung, email, telepon), orang tua, domisili, pendidikan, pengalaman, skill, bahasa, negara + profesi minat.</td><td>P0</td></tr>
      <tr><td>FR-02</td><td>Unggah dokumen: pas foto, KTP, KK, status kawin / izin keluarga, sertifikat kompetensi (atau ijazah / portofolio bila skema belum ada), kartu BPJS Kesehatan. Validasi tipe dan ukuran.</td><td>P0</td></tr>
      <tr><td>FR-03</td><td>Admin dapat menginput atas nama CPMI (datang langsung atau via WhatsApp). Deteksi duplikat NIK.</td><td>P0</td></tr>
      <tr><td>FR-04</td><td>Screening: checklist per dokumen (valid / revisi + catatan), jadwal dan hasil interview (Zoom atau tatap muka), skor skill per profesi, keputusan dengan alasan.</td><td>P0</td></tr>
      <tr><td>FR-05</td><td>Satu PIC wajib per worker sejak <code>LULUS</code>; ganti PIC tercatat di riwayat.</td><td>P0</td></tr>
      <tr><td>FR-06</td><td>Master kode unik: negara, profesi, batch, kuota, nomor SIP2MI, mitra usaha, tanggal tutup.</td><td>P0</td></tr>
      <tr><td>FR-07</td><td>Reserve / terpakai / lepas kuota otomatis; tolak bila melebihi; waiting list FIFO.</td><td>P0</td></tr>
      <tr><td>FR-08</td><td>Template langkah per kode: pemilik, dependensi, wajib / opsional, jenis bukti, tenggat.</td><td>P0</td></tr>
      <tr><td>FR-09</td><td>Inbox tugas PIC dan portal tugas CPMI; unggah bukti; PIC verifikasi.</td><td>P0</td></tr>
      <tr><td>FR-10</td><td>Gate Fase A dan OPP; override hanya Superadmin dengan alasan.</td><td>P0</td></tr>
      <tr><td>FR-11</td><td>Penetapan keberangkatan (tanggal, tiket, pemberi kerja) dan paket data laporan keberangkatan siap ekspor.</td><td>P0</td></tr>
      <tr><td>FR-12</td><td>Role-based access; PIC hanya melihat worker miliknya; CPMI hanya data sendiri.</td><td>P0</td></tr>
      <tr><td>FR-13</td><td>Audit log: status, dokumen, kuota, PIC, override.</td><td>P0</td></tr>
      <tr><td>FR-14</td><td>Dashboard sesuai bagian 7 (funnel, kuota, macet, beban PIC).</td><td>P0</td></tr>
      <tr><td>FR-15</td><td>Pengingat WhatsApp / email ke CPMI dan PIC; eskalasi langkah macet.</td><td>P1</td></tr>
      <tr><td>FR-16</td><td>Pemantauan selama bekerja, kepulangan, perpanjangan; widget kepatuhan pelaporan.</td><td>P1</td></tr>
      <tr><td>FR-17</td><td>Peringatan dokumen hampir kedaluwarsa.</td><td>P2</td></tr>
    </tbody>
  </table></div>

  <h2>9. Non-fungsional</h2>
  <ul>
    <li><b>Data pribadi sensitif</b> (NIK, paspor, hasil medical): akses per role, enkripsi penyimpanan dan transit, retensi ditetapkan, sesuai UU Pelindungan Data Pribadi.</li>
    <li><b>Mobile-first</b>, hemat kuota (CPMI sering di daerah), unggah foto dikompres, Bahasa Indonesia.</li>
    <li>Audit log tidak dapat diubah dari UI. Backup harian.</li>
  </ul>

  <h2>10. Pertanyaan terbuka</h2>
  <div class="tbl"><table>
    <thead><tr><th>#</th><th>Pertanyaan ke owner</th><th>Asumsi sementara</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Urutan Sisko vs screening (lihat peringatan bagian 3)</td><td>Screening = pra-seleksi internal</td></tr>
      <tr><td>2</td><td>Kapan kuota di-reserve?</td><td>Saat <code>LULUS</code>, lepas otomatis setelah 14 hari tanpa progres</td></tr>
      <tr><td>3</td><td>Jalur Korea Selatan dan Jepang lewat P3MI atau jalur pemerintah (EPS TOPIK Korea adalah penempatan pemerintah, bukan P3MI)?</td><td>Hanya jalur yang dikerjakan BGS sebagai P3MI</td></tr>
      <tr><td>4</td><td>Daftar langkah tiap negara (Taiwan, Jepang, Korea, Dubai)</td><td>Template default + Saudi</td></tr>
      <tr><td>5</td><td>PIC satu orang per worker, atau beda PIC per langkah?</td><td>Satu PIC utama, boleh ada penanggung per tugas</td></tr>
      <tr><td>6</td><td>Lapor ke Sisko: input manual atau ada akses integrasi?</td><td>Manual dari data hasil ekspor</td></tr>
      <tr><td>7</td><td>Biaya penempatan dan pembayaran masuk aplikasi?</td><td>Di luar PRD ini</td></tr>
      <tr><td>8</td><td>Perlu role tambahan: keuangan, auditor, sponsor lapangan?</td><td>Hanya 4 role</td></tr>
      <tr><td>9</td><td>Contoh laporan yang diminta KP2MI / Disnaker</td><td>Dari pasal pelaporan di atas</td></tr>
    </tbody>
  </table></div>

  <h2>11. Fase rilis</h2>
  <ul>
    <li><b>Fase 1 (P0)</b> Form CV, screening, kode dan kuota, role, processing + gate, output keberangkatan, dashboard dasar.</li>
    <li><b>Fase 2 (P1)</b> Pengingat WhatsApp, pasca-berangkat dan kepatuhan pelaporan.</li>
    <li><b>Fase 3</b> Peringatan kedaluwarsa, biaya penempatan, integrasi bila tersedia.</li>
  </ul>

  <h2>Referensi</h2>
  <ul>
    <li><a href="https://jdih.bp2mi.go.id/uploads/20260306/20260306210030_889000740_Salinan_Peraturan_Menteri_Nomor_2_Tahun_2026_tentang_Tata_Cara_Penempatan_oleh_Pelaksana_Penempatan_preview.pdf">Permen KP2MI/BP2MI No. 2 Tahun 2026, Tata Cara Penempatan PMI oleh Pelaksana Penempatan</a>: Ps. 27-41 (tahapan P3MI), 25 (SIP2MI), 43-44 (pelaporan).</li>
    <li><a href="https://sipena.bp2mi.go.id/assets/uploads/kp2mi/mikro/FIX_SOP_Mikro_-_Pendaftaran_Seleksi_dan_Penandatangan_Perjanjian_Penempatan.pdf">SOP Mikro KP2MI: Pendaftaran, Seleksi, dan Penandatanganan Perjanjian Penempatan oleh P3MI</a>.</li>
    <li><a href="https://siskop2mi.bp2mi.go.id/publik/faq">SISKOP2MI FAQ</a> (kewajiban BPJS Ketenagakerjaan).</li>
    <li>Profil perusahaan, interview owner, dan contoh langkah Instagram BGS (dari brief).</li>
  </ul>
  <p>Ringkasan regulasi di atas bukan nasihat hukum; validasi dengan penanggung jawab kepatuhan BGS sebelum dikunci di template.</p>
</gx-page>
</body>
</html>
`;

writeFileSync(new URL("./prd-workflow-utama.html", import.meta.url), html);
console.log("ok", html.length);
