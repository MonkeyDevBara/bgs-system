# BGS Workforce Management — Prototipe UI

Prototipe klikable (HTML/CSS/JS murni, tanpa build, tanpa library). Semua data fiktif dan hanya ada di memori browser; muat ulang halaman = data kembali ke awal.

## Menjalankan

```bash
cd prototype
python3 -m http.server 8765
# buka http://127.0.0.1:8765/index.html   (aplikasi internal)
# buka http://127.0.0.1:8765/register.html (website registrasi publik)
```

Login memakai akun demo per peran (Superadmin, Director, Admin, PIC, Viewer). Superadmin/Director/Admin diminta kode 2FA: isi 6 digit apa saja.

## Kontrol demo (bar atas)
- **Peran demo**: ganti peran untuk melihat perbedaan hak akses.
- **Tahap**: MVP 1 / 1–2 / 1–3 menyembunyikan modul yang belum dirilis.

## Struktur
- `assets/data.js` model data fiktif · `core.js` router, komponen UI, izin · `nav.js` menu dan rute · `app.css` design system
- `assets/pages/domain.js` logika bisnis (kuota, case, tugas, verifikasi akhir) · halaman lain: `dashboard`, `workers`, `recruitment`, `placement`, `processing`, `operations`, `workflow`, `admin`
- `register.html` + `assets/register.js` + `assets/public.css`: website registrasi publik. Pendaftaran masuk ke `localStorage['bgs.publicRegistrations']` dan tampil di Inbox registrasi.
