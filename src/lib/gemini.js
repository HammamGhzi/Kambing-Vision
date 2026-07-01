import { GoogleGenerativeAI } from "@google/generative-ai";

// ── API Keys ────────────────────────────────────────────────────────────────
const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;
const OPENROUTER_KEY = process.env.REACT_APP_OPENROUTER_KEY;

// ── Model fallback list ─────────────────────────────────────────────────────
const GEMINI_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
];

const OPENROUTER_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "meta-llama/llama-4-maverick:free",
  "qwen/qwen2.5-vl-72b-instruct:free",
];

// ── Token tracking ──────────────────────────────────────────────────────────
const STORAGE_KEY = "goatai_usage";
const MAX_HARIAN = 20;

function getTodayKey() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - 7 * 60 * 60 * 1000);
  return adjusted.toISOString().slice(0, 10);
}

function getResetInfo() {
  const now = new Date();
  const resetUTC = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    7, 0, 0
  ));
  if (resetUTC <= now) {
    resetUTC.setUTCDate(resetUTC.getUTCDate() + 1);
  }
  const diffMs = resetUTC - now;
  const diffJam = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMenit = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const sisaWaktu = diffJam > 0
    ? `${diffJam} jam ${diffMenit} menit lagi`
    : `${diffMenit} menit lagi`;
  const resetWIB = new Date(resetUTC.getTime() + 7 * 60 * 60 * 1000);
  const jam = resetWIB.getUTCHours().toString().padStart(2, "0");
  const menit = resetWIB.getUTCMinutes().toString().padStart(2, "0");
  return { sisaWaktu, resetJam: `${jam}:${menit} WIB` };
}

export function getUsageInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const today = getTodayKey();
    const count = data[today] || 0;
    const { sisaWaktu, resetJam } = getResetInfo();
    return {
      sudahDipakai: count,
      maksHarian: MAX_HARIAN,
      sisaToken: Math.max(0, MAX_HARIAN - count),
      tokenHabis: count >= MAX_HARIAN,
      sisaWaktu,
      resetJam,
    };
  } catch {
    return {
      sudahDipakai: 0,
      maksHarian: MAX_HARIAN,
      sisaToken: MAX_HARIAN,
      tokenHabis: false,
      sisaWaktu: "-",
      resetJam: "14:00 WIB",
    };
  }
}

function tambahUsage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const today = getTodayKey();
    data[today] = (data[today] || 0) + 1;
    Object.keys(data).forEach((k) => { if (k < today) delete data[k]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ── Prompt ──────────────────────────────────────────────────────────────────
function buildPrompt(jenisKambing, cekKurban, cekHarga, jumlahFoto = 1, tinggiBadanCm, beratBadanKg) {
  const infoTinggi = tinggiBadanCm
    ? `${tinggiBadanCm} cm, diukur dari tanah sampai punggung/pundak hewan saat kamera digunakan`
    : "tidak tersedia";
  const infoBerat = beratBadanKg
    ? `${beratBadanKg} kg, diinput manual oleh pengguna/peternak`
    : "tidak tersedia";

  return `
Kamu adalah dokter hewan berpengalaman yang ahli dalam kesehatan ternak kambing dan domba di Indonesia.

LANGKAH PERTAMA — Validasi gambar:
Periksa dengan teliti apakah foto yang dikirim menampilkan kambing atau domba.
Jika BUKAN kambing atau domba (misalnya foto manusia, kucing, anjing, sapi, kuda, pemandangan, benda, dll), balas HANYA dengan JSON ini:
{
  "bukan_kambing": true,
  "pesan": "Foto yang diunggah bukan kambing atau domba. Mohon upload foto kambing atau domba yang jelas."
}

Jumlah foto yang dikirim: ${jumlahFoto}.
Jika ada lebih dari satu foto, gunakan semua sudut pandang sebagai bahan analisis. Bandingkan kondisi tubuh, mata, mulut, kaki, kulit/bulu, postur, dan tanda luka/gejala dari seluruh foto. Jika kualitas sebagian foto kurang jelas, tetap analisis dari foto yang paling jelas dan sebutkan keterbatasannya di rekomendasi.

Jika foto memang kambing atau domba, lanjutkan analisis lengkap dan balas HANYA dengan JSON berikut:
{
  "bukan_kambing": false,
  "status": "Sehat" | "Perlu Perhatian" | "Sakit",
  "kepercayaan": angka_persen_0_sampai_100,
  "kondisi_fisik": "deskripsi singkat kondisi fisik",
  "perkiraan_tinggi": "rentang tinggi badan atau tinggi terukur, contoh format: 65 - 70 cm",
  "perkiraan_usia": "rentang usia hasil estimasi, contoh format: 1.5 - 2 tahun",
  "perkiraan_berat": "rentang berat hasil estimasi, contoh format: 25 - 30 kg",
  "penyakit_terdeteksi": true | false,
  "nama_penyakit": "nama penyakit atau null jika sehat",
  "gejala": ["gejala 1", "gejala 2"],
  "solusi_pengobatan": "langkah pengobatan atau null jika sehat",
  "layak_kurban": true | false | null,
  "alasan_kurban": "penjelasan kelayakan kurban atau null",
  "harga_min": angka_dalam_rupiah atau null,
  "harga_max": angka_dalam_rupiah atau null,
  "rekomendasi": "saran perawatan atau tindakan selanjutnya"
}

Jenis kambing (jika diketahui): ${jenisKambing || "tidak diketahui"}
Cek kelayakan kurban: ${cekKurban ? "ya" : "tidak"}
Sertakan estimasi harga: ${cekHarga ? "ya" : "tidak"}
Tinggi badan terukur dari kamera/pengguna: ${infoTinggi}
Berat badan terukur/manual dari pengguna: ${infoBerat}

Aturan khusus kelayakan kurban:
- Jika Cek kelayakan kurban = ya, isi "layak_kurban" dengan true atau false, jangan null.
- Jika Cek kelayakan kurban = ya, isi "alasan_kurban" dengan alasan jelas berdasarkan kesehatan, usia/perkiraan usia, kondisi fisik, cacat/luka, dan kecukupan fisik.
- Jika Cek kelayakan kurban = tidak, isi "layak_kurban" dan "alasan_kurban" dengan null.

Aturan khusus estimasi usia dan berat:
- Jangan menyalin contoh. Isi "perkiraan_usia" dan "perkiraan_berat" dengan estimasi nyata dari foto.
- Isi "perkiraan_tinggi" dengan tinggi terukur jika tersedia. Jika tidak tersedia, estimasikan dari foto dengan satuan cm.
- Jika berat badan manual tersedia, isi "perkiraan_berat" dengan berat tersebut atau rentang sangat dekat dari nilai tersebut, lalu gunakan sebagai acuan utama untuk harga dan kelayakan.
- Perkirakan usia dari ukuran tubuh relatif, tinggi badan, proporsi kepala-kaki-badan, kondisi tanduk, gigi/mulut jika terlihat, massa otot, dan kematangan tubuh. Jika jenis kambing diketahui, sesuaikan dengan karakter umum jenis tersebut.
- Perkirakan berat dari tinggi/panjang badan, lebar dada, kepadatan otot, body condition score, perut, dan perbandingan skala dengan objek sekitar. Jika tinggi badan terukur tersedia, jadikan itu acuan utama untuk menyempitkan rentang berat. Gunakan semua foto untuk menyempitkan rentang.
- Jika foto jelas dan seluruh badan terlihat, buat rentang cukup sempit: usia maksimal selisih 0.5 tahun untuk anakan/muda atau 1 tahun untuk dewasa; berat maksimal selisih 5 kg untuk kambing kecil-sedang atau 8 kg untuk kambing besar.
- Jika foto kurang jelas, sebagian tubuh terpotong, atau tidak ada pembanding ukuran, tetap beri estimasi terbaik tetapi rentang boleh lebih lebar dan jelaskan keterbatasannya di "rekomendasi".
- Gunakan satuan "bulan" untuk usia di bawah 1 tahun, dan "tahun" untuk usia 1 tahun ke atas. Gunakan satuan "kg" untuk berat.
- Pastikan estimasi tinggi, usia, dan berat masuk akal satu sama lain serta konsisten dengan kondisi fisik, kelayakan kurban, dan harga.

Balas HANYA dengan JSON, tanpa teks lain, tanpa markdown.
`;
}

// ── Rate limit check ─────────────────────────────────────────────────────────
const isRateLimit = (err) => {
  const msg = err?.message || "";
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("resource has been exhausted") ||
    msg.toLowerCase().includes("high demand") ||
    msg.toLowerCase().includes("try again later")
  );
};

// ── Parse & validasi response ────────────────────────────────────────────────
function parseAndValidate(text) {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (parsed.bukan_kambing === true) {
    const err = new Error(parsed.pesan || "Foto yang diunggah bukan kambing atau domba. Mohon upload foto kambing atau domba yang jelas.");
    err.bukanKambing = true;
    throw err;
  }

  return parsed;
}

function normalizeImages({ images, imageBase64, mimeType }) {
  if (Array.isArray(images) && images.length > 0) {
    return images
      .filter((img) => img?.base64)
      .map((img) => ({
        base64: img.base64,
        mimeType: img.mimeType || "image/jpeg",
      }));
  }

  if (imageBase64) {
    return [{ base64: imageBase64, mimeType: mimeType || "image/jpeg" }];
  }

  return [];
}

// ── Coba via Gemini SDK ──────────────────────────────────────────────────────
async function cobaGemini(modelName, prompt, images) {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([
    prompt,
    ...images.map((img) => ({
      inlineData: { data: img.base64, mimeType: img.mimeType || "image/jpeg" },
    })),
  ]);
  const text = result.response.text();
  return parseAndValidate(text);
}

// ── Coba via OpenRouter ──────────────────────────────────────────────────────
async function cobaOpenRouter(modelName, prompt, images) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": window.location.origin,
      "X-Title": "KambingSehat AI",
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((img) => ({
              type: "image_url",
              image_url: { url: `data:${img.mimeType || "image/jpeg"};base64,${img.base64}` },
            })),
          ],
        },
      ],
    }),
  });

  if (response.status === 429) {
    throw new Error("429 rate limit openrouter");
  }

  const data = await response.json();

  if (data.error) {
    if (data.error.code === 429 || data.error.message?.includes("429")) {
      throw new Error("429 rate limit openrouter");
    }
    throw new Error(data.error.message || "OpenRouter error");
  }

  const text = data.choices?.[0]?.message?.content || "";
  return parseAndValidate(text);
}

// ── Fungsi utama ─────────────────────────────────────────────────────────────
export async function analisisKambing({
  images,
  imageBase64,
  mimeType,
  jenisKambing,
  cekKurban,
  cekHarga,
  tinggiBadanCm,
  beratBadanKg,
}) {
  const usage = getUsageInfo();
  if (usage.tokenHabis) {
    const err = new Error(
      `Kuota harian habis (${usage.sudahDipakai}/${usage.maksHarian}). Reset jam ${usage.resetJam}, sekitar ${usage.sisaWaktu}.`
    );
    err.isTokenHabis = true;
    throw err;
  }

  const imageParts = normalizeImages({ images, imageBase64, mimeType });
  if (imageParts.length === 0) {
    throw new Error("Minimal satu foto kambing wajib dikirim.");
  }

  const prompt = buildPrompt(jenisKambing, cekKurban, cekHarga, imageParts.length, tinggiBadanCm, beratBadanKg);

  // 1. Coba semua model Gemini dulu
  for (const modelName of GEMINI_MODELS) {
    try {
      const data = await cobaGemini(modelName, prompt, imageParts);
      tambahUsage();
      return data;
    } catch (err) {
      if (err.bukanKambing) throw err; // langsung lempar, jangan coba model lain
      if (isRateLimit(err)) continue;
      throw err;
    }
  }

  // 2. Semua Gemini limit, fallback ke OpenRouter
  for (const modelName of OPENROUTER_MODELS) {
    try {
      const data = await cobaOpenRouter(modelName, prompt, imageParts);
      tambahUsage();
      return data;
    } catch (err) {
      if (err.bukanKambing) throw err; // langsung lempar, jangan coba model lain
      if (isRateLimit(err)) continue;
      throw err;
    }
  }

  // 3. Semua model habis
  const { sisaWaktu, resetJam } = getResetInfo();
  const tokenErr = new Error(
    `Semua model AI sedang sibuk. Coba lagi setelah ${resetJam} (${sisaWaktu}).`
  );
  tokenErr.isTokenHabis = true;
  throw tokenErr;
}
