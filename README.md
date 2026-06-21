# SIWARGA — Sistem Informasi Warga

Aplikasi pendataan warga berbasis web: warga mendaftar & mengunggah KTP/KK
secara mandiri, admin RT/RW memverifikasi data dari satu panel.

## 1. Kenapa stack ini ringan?

| Pilihan | Alasan |
|---|---|
| **Vite + React** (bukan CRA) | Build lebih cepat, bundle JS lebih kecil secara default. |
| **Tanpa UI library besar** (tanpa MUI/AntD) | CSS murni ~6KB (gzip ~2KB) di `src/styles/index.css`. |
| **Font sistem** (bukan Google Fonts) | Nol request tambahan untuk font — penting di internet lambat. |
| **Tanpa backend custom** | Frontend bicara langsung ke Supabase (Auth, Database, Storage). Tidak ada server Node tambahan yang perlu di-hosting/dipanggil bolak-balik. |
| **Code-splitting per peran** | Halaman admin & halaman warga dipisah (`React.lazy`), jadi warga tidak mengunduh kode panel admin, begitu juga sebaliknya. |
| **Kompresi gambar di browser** | Foto KTP/KK dikecilkan (resize + JPEG quality 0.72) sebelum diunggah, lihat `src/utils/imageCompress.js`. |
| **Paginasi di panel admin** | List warga dimuat 15 per halaman, bukan sekaligus semua. |

Hasil build produksi (`npm run build`):
- Chunk utama (React + Router + Supabase client): **~113 KB gzip**
- Chunk warga: **~3 KB gzip**, chunk admin: **~1.3–2 KB gzip**
- CSS: **~2 KB gzip**

Ini jauh lebih kecil dibanding aplikasi serupa yang dibuat dengan CRA + library UI berat.

## 2. Struktur proyek

```
siwarga/
├─ src/
│  ├─ pages/
│  │  ├─ Login.jsx, Register.jsx, ChangePassword.jsx
│  │  ├─ warga/        (WargaDashboard, ProfilTab, DokumenTab)
│  │  └─ admin/        (AdminDashboard, AdminWargaDetail)
│  ├─ components/      (ProtectedRoute, TopBar, StatusBadge, LoadingScreen)
│  ├─ contexts/AuthContext.jsx
│  ├─ utils/           (validators, imageCompress)
│  ├─ lib/supabaseClient.js
│  └─ styles/index.css
├─ supabase/schema.sql   ⟵ jalankan ini di Supabase
├─ vercel.json
└─ .env.example
```

## 3. Setup Supabase (cara konek & pakai)

### a. Buat project
1. Buka [supabase.com](https://supabase.com) → **New project**.
2. Catat **Project URL** dan **anon public key** di *Project Settings → API*.

### b. Jalankan skema database
1. Buka **SQL Editor** di dashboard Supabase.
2. Copy seluruh isi `supabase/schema.sql`, paste, lalu **Run**.
   File ini akan membuat:
   - Tabel `profiles` (data warga) & `dokumen` (upload KTP/KK)
   - Trigger keamanan (warga tidak bisa menaikkan role/status sendiri)
   - Row Level Security (warga hanya lihat data sendiri, admin lihat semua)
   - Storage bucket privat `dokumen-warga` + policy aksesnya

### c. Matikan konfirmasi email
Karena login memakai **NIK** (bukan email asli), email warga sebenarnya
adalah email semu (`{nik}@siwarga.com`) yang tidak bisa menerima pesan.
1. **Authentication → Providers → Email**
2. Matikan **"Confirm email"**

Tanpa langkah ini, akun warga tidak akan otomatis aktif setelah daftar.

### d. Sesuaikan batasan Rate Limit (Opsional)
Supabase membatasi jumlah pendaftaran per jam dari IP yang sama. Jika Anda sering mendapat error `email rate limit exceeded` saat uji coba pendaftaran:
1. Buka **Authentication → Rate Limits** di dashboard Supabase.
2. Cari opsi **Signups** (pendaftaran per jam) atau **Rate limit (SMS/Email)**.
3. Naikkan batasnya (misal dari default 3 per jam menjadi 30 atau lebih) agar lebih leluasa saat menguji aplikasi.
*Catatan: Supabase mewajibkan pengaturan Custom SMTP (seperti menggunakan Resend, Mailgun, atau Brevo) di menu **Authentication → SMTP** agar Anda dapat menyimpan perubahan batas rate limit ini.*

### e. Buat akun admin pertama
Ikuti instruksi lengkap di bagian bawah `supabase/schema.sql` (bagian 6):
buat 1 user lewat **Authentication → Users → Add user** dengan email
`{NIK-ADMIN}@siwarga.com`, lalu insert satu baris ke tabel `profiles`
dengan `role = 'admin'`. Tidak ada cara mendaftar admin lewat halaman publik
— ini sengaja, supaya role admin tidak bisa diklaim sendiri oleh warga.

### f. Koneksi dari frontend
Cukup isi 2 nilai di `.env` (lihat `.env.example`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AUTH_EMAIL_DOMAIN=siwarga.com
```
`src/lib/supabaseClient.js` langsung memakai nilai ini untuk membuat
satu client Supabase yang dipakai di seluruh aplikasi — tidak perlu backend
perantara.

## 4. Menjalankan secara lokal

```bash
npm install
cp .env.example .env   # lalu isi dengan kredensial Supabase Anda
npm run dev
```

## 5. Deploy ke Vercel — PENTING soal preset

Anda sempat menyebut preset **Create React App**, tapi proyek ini sekarang
pakai **Vite**, jadi saat import project di Vercel, pilih preset **"Vite"**,
bukan "Create React App". Bedanya:

| | Create React App | Vite (proyek ini) |
|---|---|---|
| Build command | `react-scripts build` | `vite build` |
| Output folder | `build` | `dist` |

Jika preset CRA dipaksakan, Vercel akan mencari folder `build` yang tidak
pernah dihasilkan oleh proyek ini, sehingga deploy gagal.

Langkah deploy:
1. Push folder ini ke GitHub.
2. Di Vercel: **New Project → Import** repo tersebut.
3. Framework Preset akan otomatis terdeteksi sebagai **Vite** (build:
   `vite build`, output: `dist`) — biarkan default ini, tidak perlu diubah manual.
4. Tambahkan environment variables (sama seperti `.env`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_AUTH_EMAIL_DOMAIN`.
5. Deploy. `vercel.json` sudah menyertakan rewrite rule supaya
   routing React Router (mis. `/admin/warga/123`) tidak 404 saat di-refresh.

## 6. Alur fitur yang sudah dibuat

- **Daftar mandiri** (`/daftar`): warga isi data + NIK 16 digit; password awal
  otomatis = NIK; status awal `pending`.
- **Login** (`/login`): pakai NIK + password. NIK diubah ke email semu di
  belakang layar untuk dikirim ke Supabase Auth.
- **Wajib ganti password di login pertama**: dipaksa oleh `ProtectedRoute`
  via kolom `sudah_ganti_password`.
- **Warga**: lihat & ubah data kontak sendiri (alamat, RT/RW, pekerjaan, dst —
  field identitas seperti NIK/nama dikunci, hanya admin yang boleh ubah),
  upload KTP & KK (dengan kompresi otomatis), lihat status verifikasi.
- **Admin**: dashboard ringkasan (total warga, pending warga, pending dokumen),
  cari & filter warga, lihat detail, ubah data, verifikasi/tolak warga &
  dokumen masing-masing dengan catatan alasan.
- **RLS Supabase** memastikan, walau frontend "dibobol", warga tetap tidak
  bisa membaca/mengubah data warga lain atau menaikkan role sendiri.

## 7. Requirement yang masih kurang / saran penyempurnaan

Ini fitur/aspek yang belum ada di MVP ini, layak dipertimbangkan untuk versi berikutnya:

1. **Lupa password.** Karena email warga semu (bukan email asli), reset
   password lewat email standar Supabase tidak bisa dipakai. Perlu fitur
   "Reset oleh Admin" (admin set password baru lewat Supabase Admin API,
   butuh server kecil/Edge Function karena perlu *service role key* yang
   tidak boleh ada di frontend) atau alternatif verifikasi via WhatsApp/SMS OTP.
2. **Anti-spam pendaftaran.** Form daftar publik sebaiknya ditambah CAPTCHA
   (mis. Cloudflare Turnstile) supaya tidak dibanjiri pendaftaran palsu.
3. **Validasi nomor KK ↔ NIK secara otomatis.** Saat ini hanya format (16
   digit) yang divalidasi; kecocokan dengan dokumen asli tetap dicek manual
   oleh admin saat membuka file KTP/KK.
4. **Manajemen banyak admin / hak akses bertingkat** (mis. admin RW vs admin
   RT) — saat ini hanya ada satu level `admin`.
5. **Log aktivitas/audit trail** — siapa memverifikasi/menolak data kapan,
   untuk akuntabilitas.
6. **Notifikasi ke warga** (WhatsApp/email/push) saat status berubah, supaya
   warga tidak perlu cek manual.
7. **Export data** (CSV/Excel) untuk admin, mis. untuk laporan RT/RW.
8. **Kebijakan retensi & perlindungan data pribadi** sesuai UU PDP — perlu
   halaman kebijakan privasi dan mekanisme warga meminta hapus data.
9. **Rate limiting / brute-force protection** di endpoint login (Supabase
   Auth punya proteksi dasar, tapi pertimbangkan aturan tambahan untuk
   skala besar).
10. **Tampilan PWA / offline-friendly** (opsional) — bisa ditambah `manifest.json`
    + service worker ringan agar bisa "Add to Home Screen" di HP warga.
11. **Pengelompokan per Kartu Keluarga** — saat ini anggota keluarga hanya
    terhubung lewat kesamaan No. KK (bisa dicari manual oleh admin); belum
    ada tampilan "lihat semua anggota dalam 1 KK" yang otomatis dikelompokkan.
12. **Backup database** terjadwal (Supabase Pro punya Point-in-Time Recovery;
    di tier gratis sebaiknya export berkala manual).

## 8. Catatan keamanan penting

- **Jangan pernah** menaruh *service role key* Supabase di kode frontend —
  hanya `anon public key` yang dipakai di sini, dan itu sudah benar/aman
  karena semua akses sesungguhnya dibatasi oleh Row Level Security, bukan
  oleh key-nya.
- Bucket `dokumen-warga` dibuat **privat**; file KTP/KK diakses lewat
  *signed URL* berumur 60 detik, bukan URL publik permanen.
