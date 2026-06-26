import { GoogleGenerativeAI } from "@google/generative-ai";

// ── API Keys ────────────────────────────────────────────────────────────────
const GEMINI_KEY = process.env.REACT_APP_GEMINI_KEY;
const OPENROUTER_KEY = process.env.REACT_APP_OPENROUTER_KEY;

// ── Model fallback list ─────────────────────────────────────────────────────
// Coba Gemini dulu, kalau semua limit baru pindah ke OpenRouter
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

// ── Coba via Gemini SDK ─────────────────────────────────────────────────────
async function cobaGemini(modelName, prompt, imageBase64, mimeType) {
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } },
  ]);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ── Coba via OpenRouter ─────────────────────────────────────────────────────
async function cobaOpenRouter(modelName, prompt, imageBase64, mimeType) {
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
            {
              type: "image_url",
              image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` },
            },
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
  const cleaned = text.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

// ── Fungsi utama ────────────────────────────────────────────────────────────
export async function analisisKambing({
  imageBase64,
  mimeType,
  jenisKambing,
  cekKurban,
  cekHarga,
}) {
  const usage = getUsageInfo();
  if (usage.tokenHabis) {
    const err = new Error(
      `Kuota harian habis (${usage.sudahDipakai}/${usage.maksHarian}). Reset jam ${usage.resetJam}, sekitar ${usage.sisaWaktu}.`
    );
    err.isTokenHabis = true;
    throw err;
  }

  const prompt = `
Kamu adalah dokter hewan berpengalaman yang ahli dalam kesehatan ternak kambing dan domba di Indonesia.

Analisis foto kambing ini secara menyeluruh dan berikan hasil dalam format JSON yang valid.

Jenis kambing (jika diketahui): ${jenisKambing || "tidak diketahui"}
Cek kelayakan kurban: ${cekKurban ? "ya" : "tidak"}
Sertakan estimasi harga: ${cekHarga ? "ya" : "tidak"}

Balas HANYA dengan JSON berikut, tanpa teks lain:
{
  "status": "Sehat" | "Perlu Perhatian" | "Sakit",
  "kepercayaan": angka_persen_0_sampai_100,
  "kondisi_fisik": "deskripsi singkat kondisi fisik",
  "perkiraan_usia": "contoh: 1.5 - 2 tahun",
  "perkiraan_berat": "contoh: 25 - 30 kg",
  "penyakit_terdeteksi": true | false,
  "nama_penyakit": "nama penyakit atau null jika sehat",
  "gejala": ["gejala 1", "gejala 2"] atau [],
  "solusi_pengobatan": "langkah pengobatan atau null jika sehat",
  "layak_kurban": true | false | null,
  "alasan_kurban": "penjelasan kelayakan kurban atau null",
  "harga_min": angka_dalam_rupiah atau null,
  "harga_max": angka_dalam_rupiah atau null,
  "rekomendasi": "saran perawatan atau tindakan selanjutnya"
}
`;

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

  // 1. Coba semua model Gemini dulu
  for (const modelName of GEMINI_MODELS) {
    try {
      const data = await cobaGemini(modelName, prompt, imageBase64, mimeType);
      tambahUsage();
      return data;
    } catch (err) {
      if (isRateLimit(err)) continue;
      throw err;
    }
  }

  // 2. Semua Gemini limit, fallback ke OpenRouter
  for (const modelName of OPENROUTER_MODELS) {
    try {
      const data = await cobaOpenRouter(modelName, prompt, imageBase64, mimeType);
      tambahUsage();
      return data;
    } catch (err) {
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