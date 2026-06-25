# Aplikasi Task Worker / Rating

Starter aplikasi berbasis Supabase + Cloudflare Pages.

## Isi paket

- `index.html` — halaman utama aplikasi
- `style.css` — desain tampilan
- `app.js` — logic frontend admin dan worker
- `functions/create-worker.js` — function aman untuk admin membuat akun worker
- `functions/reset-worker-password.js` — function aman untuk reset password worker
- `sql/schema.sql` — struktur database Supabase + RLS policy + storage bucket

## Alur aplikasi

Admin membuat task → worker ambil task → worker submit screenshot dan keterangan → admin review → admin approve/reject/revisi → admin tandai pembayaran paid.

## Setup Supabase

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan isi file `sql/schema.sql`.
4. Buka Authentication, buat user admin secara manual.
5. Copy UUID user admin.
6. Insert profile admin dengan contoh query di bagian bawah file `schema.sql`.
7. Buka Project Settings → API, copy:
   - Project URL
   - anon public key
   - service_role key

## Konfigurasi frontend

Buka `app.js`, ganti:

```js
const SUPABASE_URL = 'ISI_SUPABASE_URL_ANDA';
const SUPABASE_ANON_KEY = 'ISI_SUPABASE_ANON_KEY_ANDA';
```

## Setup Cloudflare Pages

Upload folder project ini ke Cloudflare Pages.

Tambahkan environment variables di Cloudflare Pages:

```text
SUPABASE_URL=isi_project_url_supabase
SUPABASE_SERVICE_ROLE_KEY=isi_service_role_key_supabase
```

Penting: jangan masukkan `SUPABASE_SERVICE_ROLE_KEY` ke file frontend seperti `app.js`. Key tersebut hanya boleh disimpan di environment Cloudflare Pages.

## Catatan keamanan

- Worker tidak bisa daftar sendiri.
- Akun worker dibuat admin melalui menu Data Worker.
- Service role key hanya dipakai di Cloudflare Pages Function.
- Worker hanya bisa melihat data miliknya sendiri.
- Admin bisa melihat semua data.

## Fitur MVP

Admin:
- Login
- Dashboard
- Buat task
- Kelola task
- Buat akun worker
- Nonaktifkan worker
- Reset password worker
- Review submission
- Approve/reject/revisi
- Tandai pembayaran paid

Worker:
- Login
- Lihat task tersedia
- Ambil task
- Submit screenshot dan keterangan
- Lihat status pembayaran


Update field worker:
- Data worker sekarang memiliki field tambahan `E-money` untuk menyimpan nomor/metode pembayaran seperti DANA, OVO, GoPay, ShopeePay, atau rekening e-wallet lain.
- Jika database sudah dibuat sebelumnya, jalankan SQL: `alter table public.profiles add column if not exists e_money text;`
