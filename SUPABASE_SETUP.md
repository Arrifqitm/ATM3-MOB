# 🚀 PENYIAPAN SUPABASE POSTGRESQL (LIVE REAL-TIME ENGINE)

Panduan lengkap ini akan menuntun Anda langkah demi langkah dalam menyiapkan cloud database PostgreSQL di **Supabase** secara gratis, mengunggah struktur tabel data ledger otomatis, serta menghubungkannya ke aplikasi **Finance Freedom OS** Anda.

---

## 📅 DAFTAR LANGKAH CEPAT (5 MENIT)

1. **Daftar Akun**: Kunjungi [Supabase.com](https://supabase.com) dan buat akun gratis menggunakan GitHub atau Email.
2. **Buat Proyek Baru**: Klik **"New Project"**, beri nama (misal: `finance-freedom-os`), pilih Cloud Region terdekat (`Singapore / ap-southeast-1` untuk konektivitas tercepat dari Indonesia), dan tentukan kata sandi database Anda.
3. **Eksekusi SQL**: Salin seluruh isi file pendukung `supabase_setup_v2.sql` dan eksekusi di menu SQL Editor Supabase untuk membuat tabel dan indeks secara instan.
4. **Konfigurasi Kunci Akses**: Dapatkan `URL` dan `Anon Key` dari dashboard Supabase, lalu masukkan sebagai Environment Variables.

---

## 🛠️ LANGKAH 1: MENJALANKAN SKEMA SQL DATABASE (MIGRASI KILAT)

Setelah proyek Supabase Anda aktif (biasanya memakan waktu 1–2 menit untuk provisi):

1. Masuk ke dashboard proyek Supabase Anda.
2. Pada bilah navigasi kiri, cari ikon kode terminal berkepala **`SQL Editor`** (tepat di bawah ikon tabel editor).
3. Klik tombol **`New Query`** (+).
4. Beri nama query Anda, misalnya: `Initialize Finance Database`.
5. Buka file **`supabase_setup_v2.sql`** yang tersedia di direktori utama, lalu salin seluruh baris kodenya (dari baris 1 sampai akhir).
6. Tempel (paste) kode SQL tersebut di editor Supabase.
7. Klik tombol **`Run`** di ujung kanan bawah atau tekan pintasan keyboard `Cmd + Enter` / `Ctrl + Enter`.
8. Pastikan muncul pesan sukses: `Success. No rows returned.`

> **Apa yang Baru Saja Dibuat?**
> Supabase baru saja membuat tabel terindeks dengan performa tinggi yang saling berelasi:
> - `settings` (Konfigurasi global, batas darurat, mode alokasi, platform, dan daftar ID aset pilihan FIRE)
> - `income_ledger` (Ledger pemasukan, gaji, insentif)
> - `savings_goals` (Bucket tabungan berencana & target prioritas)
> - `savings_ledger` (Log mutasi setoran dan penarikan tabungan)
> - `transactions` (Ledger pengeluaran harian berbasis Kakeibo)
> - `allocation_posts` (Plafon anggaran bulanan per kategori Kakeibo)
> - `portfolio_assets` (Portofolio investasi, saldo multi-platform, dan status instrumen dengan penanda `is_fire_included` untuk kalkulasi FIRE)
> - `fixed_expense_templates` (Template tagihan berulang)
> - `fixed_expense_instances` (Instansiasi bulanan dari tagihan)
> - `operational_transactions` (Ledger pengeluaran operasional / realisasi tagihan)

---

## 🔑 LANGKAH 2: CARA MENDAPATKAN SUPABASE API CREDENTIALS

Agar aplikasi Anda dapat membaca dan menulis data ke database Supabase secara real-time:

1. Di dashboard Supabase Anda, buka menu **`Project Settings`** (ikon roda gigi ⚙️ di bagian paling bawah bilah navigasi kiri).
2. Pilih submenu **`API`**.
3. Cari bagian **`Project API keys`** dan **`API Settings`**:
   - **`Project URL`**: Salin string URL panjang yang berawalan `https://...`
   - **`Project API anon key`**: Salin string token panjang berlabel `anon` (aman digunakan di browser client-side).

---

## 🔒 LANGKAH 3: MELINDUNGI KEAMANAN DENGAN ENVIRONMENT VARIABLES

### A. Untuk Pengembangan Lokal (Local Development)
Di komputer Anda, buat file bernama **`.env`** di dalam folder utama proyek (sejajar dengan `package.json`). Isi file tersebut dengan format berikut:

```env
VITE_SUPABASE_URL=Masukkan_Project_URL_Supabase_Anda
VITE_SUPABASE_ANON_KEY=Masukkan_Project_Anon_Key_Supabase_Anda
```

### B. Untuk Server Produksi / Vercel ("Venner Deployment")
Saat Anda mengunggah aplikasi ke penyedia layanan hosting seperti **Vercel** / **Netlify** / **Cloud Run**:
1. Masuk ke dashboard Vercel milik proyek Anda.
2. Buka menu **Settings** > **Environment Variables**.
3. Tambahkan 2 pasangan name-value:
   - Name: `VITE_SUPABASE_URL` | Value: `[Project URL Anda]`
   - Name: `VITE_SUPABASE_ANON_KEY` | Value: `[Anon Key Anda]`
4. Klik **Save** dan jalankan deploy ulang (*Redeploy*). Aplikasi Anda kini langsung terkoneksi murni ke cloud PostgreSQL Supabase secara realtime!

---

## 💡 PERBEDAAN DATA FLOW (OFFLINE VS CLOUD SUPABASE)

- **Mode Offline (Local)**: Seluruh data Anda disimpan terenkripsi di `localStorage` peramban Anda.
- **Mode Supabase (Cloud)**:
  - Setiap Anda mencatat pemasukan, menambah alokasi kas, memotong kas Kakeibo, atau merubah strategi FIRE, database Zustand akan memperbarui state aplikasi dan secara asinkron mengirimkan mutasi ke database Supabase Cloud.
  - Saat Anda membuka aplikasi di laptop lain, cukup klik tombol **`Pull Data dari Supabase`** di tab **Sync** untuk menarik data terbaru Anda secara instan dan aman.

---

Selamat berasimilasi dengan infrastruktur database modern! Aplikasi Anda kini siap berjalan secara multi-device, mandiri, dan 100% cloud-native! 🚀
