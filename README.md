# KambingAI 🐐

Aplikasi web AI untuk mendeteksi penyakit kambing, cek kelayakan kurban, dan estimasi harga jual menggunakan **Google Gemini Vision** + **Supabase**.

---

## Fitur
- Upload foto atau gunakan kamera langsung
- Analisis kondisi kesehatan kambing
- Deteksi penyakit + solusi pengobatan
- Cek kelayakan hewan kurban
- Estimasi rentang harga jual
- Riwayat pemeriksaan tersimpan di Supabase

---

## Cara setup

### 1. Clone dan install

```bash
# Clone atau download project ini, lalu masuk ke foldernya
cd goat-ai

# Install dependencies
npm install
```

### 2. Dapatkan Gemini API Key (gratis)

1. Buka https://aistudio.google.com
2. Klik "Get API key" → "Create API key"
3. Copy API key-nya

### 3. Setup Supabase (gratis)

1. Buka https://supabase.com dan buat akun
2. Buat project baru
3. Masuk ke **SQL Editor**, jalankan query ini:

```sql
create table pemeriksaan (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc', now()),
  jenis_kambing text,
  status text,
  kepercayaan integer,
  penyakit text,
  harga_min integer,
  harga_max integer,
  layak_kurban boolean,
  rekomendasi text,
  hasil_lengkap jsonb,
  foto_base64 text
);

-- Izinkan akses publik (untuk demo)
alter table pemeriksaan enable row level security;
create policy "allow all" on pemeriksaan for all using (true);
```

4. Masuk ke **Settings → API**, copy:
   - Project URL
   - anon/public key

### 4. Isi environment variables

```bash
# Copy file contoh
cp .env.example .env

# Edit .env dan isi dengan key kamu:
REACT_APP_GEMINI_API_KEY=isi_di_sini
REACT_APP_SUPABASE_URL=isi_di_sini
REACT_APP_SUPABASE_ANON_KEY=isi_di_sini
```

### 5. Jalankan

```bash
npm start
```

Buka http://localhost:3000

---

## Deploy ke Vercel (gratis)

1. Push project ke GitHub
2. Buka https://vercel.com → Import repository
3. Tambahkan environment variables (sama seperti .env)
4. Deploy! Vercel otomatis build dan hosting

---

## Struktur project

```
src/
├── lib/
│   ├── gemini.js      ← Integrasi Google Gemini Vision
│   └── supabase.js    ← Koneksi Supabase
├── components/
│   └── HasilAnalisis.js  ← Komponen tampilan hasil
├── pages/
│   ├── AnalisisPage.js   ← Halaman upload & analisis
│   └── RiwayatPage.js    ← Halaman riwayat pemeriksaan
├── App.js             ← Root + navigasi
└── App.css            ← Styling
```

---

## Stack teknologi

| Layer | Teknologi |
|-------|-----------|
| Frontend | React.js |
| AI Vision | Google Gemini 1.5 Flash |
| Database | Supabase (PostgreSQL) |
| Deploy | Vercel |
| Biaya | Gratis semua! |
