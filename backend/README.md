# Backend Python Estimasi Tinggi Kambing

Backend ini dipakai React untuk menghitung tinggi kambing dari foto memakai marker ukuran nyata, misalnya kertas A4 berdiri 29.7 cm.

## Jalankan

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Lalu jalankan frontend seperti biasa:

```bash
npm start
```

Di halaman Analisis, upload/ambil foto, tap 4 titik ukur, lalu klik **Hitung tinggi dari marker**. Kalau backend Python aktif, status akan muncul `Dihitung Python`.

## Akurasi

Metode ini tetap membutuhkan marker ukuran nyata. Kamera HP biasa tidak bisa mengetahui ukuran cm hanya dari pixel tanpa pembanding ukuran.
