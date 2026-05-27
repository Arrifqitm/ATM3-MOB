# 💎 FINANCE FREEDOM OS: ENTERPRISE EDITION

Selamat datang di **Finance Freedom OS** — ekosistem pencatatan keuangan premium, pelacak strategi pensiun dini (FIRE), dan pengelolaan ledger belanja Kakeibo bulanan yang tangguh.

Sistem ini didesain secara modular untuk memberikan kebebasan mutlak bagi Anda: bekerja 100% luring (offline lokal) maupun terhubung langsung secara cloud-native ke database aman di Postgres Supabase.

---

## 🏗️ STRUKTUR EKOSISTEM DAN DISTRIBUSI PROJECT

Proyek Anda saat ini telah diorganisasi secara rapi ke dalam tiga jalur terpisah untuk berbagai kebutuhan lingkungan rilis Anda:

```text
├── 📂 src/                          # SOURCE CODE UTAMA (React 19 + TypeScript + Zustand)
├── 📂 public/                       # Aset statis & logo resolusi tinggi
├── 📂 financialfreedom-local/       # DISTRIBUSI OFFLINE-FIRST (POCKET VERSION)
│   ├── 📄 FinanceFreedom-Local.html # Aplikasi satu halaman HTML portabel (Vue.JS CDN)
│   ├── 📄 supabase_schema.sql       # Struktur tabel PostgreSQL database mentah
│   └── 📄 SUPABASE_SETUP.md         # Panduan konfigurasi Supabase bahasa Indonesia
├── 📂 production-deployment/        # DISTRIBUSI STAGING SERVER ("UP KE VENNER / VERCEL")
│   ├── 📄 VERCEL_SETUP.md           # Panduan deployment Vercel / Netlify
│   ├── 📄 .env.production.example   # Cetak biru variabel lingkungan produksi
│   └── 📄 supabase_schema.sql       # Salinan skema SQL siap impor
├── 📄 supabase_schema.sql           # Skema SQL Supabase tingkat root
├── 📄 SUPABASE_SETUP.md             # Panduan Supabase tingkat root
├── 📄 package.json                  # Konfigurasi dependensi project npm standar
└── 📄 vite.config.ts                # Konfigurasi optimalisasi kompilasi Vite
```

---

## ⚡ PENJELASAN JALUR DISTRIBUSI

### 1. Pengembangan & Produksi (React 19 Core)
Aplikasi utama Anda di tingkat root dikembangkan menggunakan **React 19**, **Zustand**, dan **TypeScript**. 
- **Penyimpanan Lokal**: Seluruh data disimpan secara instan di `localStorage` peramban Anda.
- **Penyimpanan Cloud**: Jika dikonfigurasi, sistem asinkron akan mendistribusikan data mutasi mutakhir secara otomatis ke **Supabase Cloud**.
- **Cara Deploy ke Vercel**: Harap ikuti panduan lengkap di dalam folder `production-deployment/VERCEL_SETUP.md`.

### 2. Versi Luring Mandiri (Pocket Edition)
Tersedia di folder `financialfreedom-local/`. Cukup klik ganda **`FinanceFreedom-Local.html`** untuk langsung melacak keuangan Anda di browser apa saja, bahkan tanpa akses internet ataupun proses instalasi sama sekali.

### 3. Integrasi Database Supabase Cloud (PostgreSQL Engine)
Tabel terenkripsi berkinerja tinggi dapat Anda buat instan menggunakan berkas SQL yang kami sertakan di folder lokal maupun root. Panduan migrasi lengkap tersedia dalam dokumen **`SUPABASE_SETUP.md`**.

---

Miliki kendali penuh atas kekayaan dan masa depan finansial Anda di bawah komando sistem operasi yang andal ini! 🚀
