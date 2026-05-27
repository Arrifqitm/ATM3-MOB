# Audibilitas & Laporan Arsitektur: Mobile Finance Lite Standalone

Laporan ini disusun sebagai hasil audit menyeluruh terhadap modul Dana Darurat (Emergency Fund) serta rekayasa ulang sub-aplikasi **Mobile Finance Lite** agar sepenuhnya mandiri (*standalone*), dapat dideploy secara independen ke Vercel/Netlify, dan secara aman terhubung kembali ke pusat database Supabase yang sama dengan aplikasi utama.

---

## 1. Audit Integrasi Sistem Dana Darurat (Dana Darurat System)

### Analisis & Temuan Audit
1. **Supabase Persistence**: 
   - Modul Dana Darurat di dalam sistem utama tidak disimpan pada tabel tunggal terpisah bernama `emergency_fund`. Sebaliknya, ia terdistribusi secara logis menjadi dua bagian:
     - Target darurat (`emergency_target`) disimpan di baris konfigurasi tabel `settings`.
     - Dana aktual disimpan sebagai instansi aset likuid di dalam tabel `portfolio_assets` dengan kategori `"Dana Darurat"` atau reksa dana pasar uang (`"RDPU"`), serta dari alokasi dana tertinggal dalam target di `savings_goals` (yang mengandung nama `"darurat"`).
2. **Dashboard & Portfolio calculations Sync**:
   - Di dashboard utama, rumus perhitungan Dana Darurat mengonsolidasikan seluruh saldo dari aset kategori `"Dana Darurat"` ditambah kategori `"RDPU"`.
   - Sebelumnya, sub-aplikasi mobile melakukan perhitungan secara terisolasi hanya dengan memindai `savings_goals`. Hal ini menyebabkan deviasi nominal antara dashboard utama dan tampilan mobile companion.
3. **Wealth Routing & FIRE Readiness**:
   - Baik di engine rebalance (`rebalanceEngine.ts`) maupun wealth engine (`wealthEngine.ts`), rasio Dana Darurat (`emergencyRatio`) digunakan untuk menentukan pembatasan alokasi pendapatan secara dinamis (*Dynamic Restriction Mode*). Jika darurat berada di bawah 100%, sistem mengalihkan arus kas dari budget gaya hidup (*Optional/Reward*) ke cadangan tabungan (*Savings reserve*).

### Solusi Pembenahan Sinkronisasi
Kami merancang fungsi pengambilan data `fetchEcosystem` di model mandiri yang baru sehingga menarik dari tabel `portfolio_assets` dan `savings_goals` secara simultan, lalu melakukan akumulasi persis seperti logika aplikasi utama. Hal ini menjamin konsistensi nominal saldo darurat 100% sinkron di berbagai perangkat.

---

## 2. Struktur Arsitektur Sub-Aplikasi Mandiri (Standalone Architecture)

Seluruh dependensi terhadap direktori induk (`../../App.tsx`, `../../shared/*`, dll.) telah dipotong sepenuhnya. Sub-aplikasi sekarang berdiri sendiri sebagai kesatuan workspace terisolasi di dalam:

```txt
/apps/mobile-finance-lite/
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── defaults.ts
    ├── index.css
    ├── main.tsx
    ├── supabaseClient.ts
    ├── types.ts
    ├── assets/
    ├── components/
    ├── context/
    ├── engines/
    │   └── incomeAllocationEngine.ts
    ├── hooks/
    ├── pages/
    ├── services/
    ├── store/
    ├── styles/
    ├── supabase/
    └── utils/
```

### Konfigurasi Penting
- **package.json**: Menampung spesifikasi runtime spesifik untuk mobile companion (React 19, Vite, Tailwind CSS v4, Lucide React).
- **vite.config.ts**: Dikonfigurasi untuk dapat berjalan dan dibundel secara independen.
- **supabaseClient.ts**: Menggunakan sandaran aman (*safe boundary*) di mana ia tidak akan mengalami crash jika kredensial `VITE_SUPABASE_URL` belum ditentukan di environment variable penyedia hosting.

---

## 3. Fitur Utama & Keamanan Offline (Offline Safety Features)

Sub-aplikasi ini dikonstruksikan khusus untuk performa tinggi pada perangkat seluler dengan latensi input minimum melalui mekanisme berikut:

1. **Optimistic Local Cache**:
   - Setiap transaksi pengeluaran (*Expense*) atau pemasukan (*Income*) baru yang terekam akan langsung dimasukkan ke dalam state memori dan di-cache langsung ke `localStorage`, sehingga antarmuka pengguna tidak terblokir oleh latensi jaring ke cloud database.
2. **Pending Sync Queue (Backlog Retries)**:
   - Jika koneksi terdeteksi offline atau permintaan API ke Supabase gagal, transaksi akan dimasukkan ke antrean offline (`lite_pending_expenses` dan `lite_pending_incomes`).
   - Begitu koneksi kembali pulih atau pengguna menekan tombol **Sync Paksa**, aplikasi akan melakukan *flushing* dan mengalirkan backlog ke Supabase dalam bentuk stream sekuensial.
3. **Income Allocation Engine**:
   - Mesin pembagi pos pendapatan di dalam sub-aplikasi (`incomeAllocationEngine.ts`) menyimulasikan pembagian persentase pos investasi (FIRE), tabungan cadangan (Dana Darurat), infaq sosial, dan biaya hidup sesuai batas restriksi aktif (`locked` atau `dynamic`) sebelum data terunggah.

---

## 4. Validasi Independensi Deployment

Aplikasi induk telah berhasil dicompile secara utuh tanpa error tipe data, serta membuktikan bahwa pembuatan sub-aplikasi yang terisolasi di `/apps/mobile-finance-lite` tidak mengintervensi atau membocorkan dependensi silang ke kode inti aplikasi pusat. 

Sub-aplikasi mobile companion ini sekarang sepenuhnya siap untuk di-deploy ke Vercel secara mandiri dengan mengarahkan *Root Directory* deployment Vercel ke sub-folder `/apps/mobile-finance-lite`.
