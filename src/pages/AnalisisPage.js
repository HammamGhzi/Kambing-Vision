import React, { useState, useRef } from "react";
import { analisisKambing, getUsageInfo } from "../lib/gemini";
import { supabase } from "../lib/supabase";
import HasilAnalisis from "../components/HasilAnalisis";

const MAX_PHOTOS = 6;
const HEIGHT_API_URL = process.env.REACT_APP_HEIGHT_API_URL || "http://localhost:8000";
const MEASURE_STEPS = [
  {
    key: "goatTop",
    label: "Punggung kambing",
    hint: "Tap titik punggung/pundak tertinggi, jangan tanduk.",
  },
  {
    key: "goatBottom",
    label: "Tanah/kaki",
    hint: "Tap titik tanah tepat di bawah kaki kambing.",
  },
  {
    key: "markerTop",
    label: "Atas marker",
    hint: "Tap ujung atas kertas/marker pembanding.",
  },
  {
    key: "markerBottom",
    label: "Bawah marker",
    hint: "Tap ujung bawah kertas/marker pembanding.",
  },
];

const PHOTO_GUIDE = [
  "Foto dari samping, seluruh badan kambing terlihat.",
  "Taruh kertas A4 berdiri di samping kambing.",
  "Kamera sejajar badan, jangan terlalu dari atas.",
  "Pakai punggung/pundak sebagai tinggi, bukan tanduk.",
];

const MARKER_PRESETS = [
  { label: "A4 berdiri", value: "29.7" },
  { label: "A4 tidur", value: "21" },
  { label: "Penggaris 30 cm", value: "30" },
  { label: "Meteran 50 cm", value: "50" },
];

const INITIAL_MEASURE_POINTS = {
  goatTop: null,
  goatBottom: null,
  markerTop: null,
  markerBottom: null,
};

function getDistance(a, b) {
  if (!a || !b) return 0;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export default function AnalisisPage() {
  const [tab, setTab] = useState("upload");
  const [photos, setPhotos] = useState([]);
  const [jenisKambing, setJenisKambing] = useState("");
  const [cekKurban, setCekKurban] = useState(false);
  const [cekHarga, setCekHarga] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [hasil, setHasil] = useState(null);
  const [error, setError] = useState(null);
  const [tokenHabis, setTokenHabis] = useState(false);
  const [tokenPesan, setTokenPesan] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState("environment");
  const [panduanUkur, setPanduanUkur] = useState(true);
  const [tinggiBadanCm, setTinggiBadanCm] = useState("");
  const [beratBadanKg, setBeratBadanKg] = useState("");
  const [markerHeightCm, setMarkerHeightCm] = useState("29.7");
  const [measurePhotoId, setMeasurePhotoId] = useState(null);
  const [measureStepIndex, setMeasureStepIndex] = useState(0);
  const [measurePoints, setMeasurePoints] = useState(INITIAL_MEASURE_POINTS);
  const [measureStatus, setMeasureStatus] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  function resetStatus() {
    setHasil(null);
    setError(null);
    setTokenHabis(false);
    setTokenPesan("");
  }

  function addPhoto(dataUrl, mimeType = "image/jpeg", source = "upload") {
    if (photos.length >= MAX_PHOTOS) {
      setError(`Maksimal ${MAX_PHOTOS} foto untuk sekali analisis.`);
      return;
    }

    setPhotos((current) => {
      const newPhoto = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        preview: dataUrl,
        base64: dataUrl.split(",")[1],
        mimeType: mimeType || "image/jpeg",
        source,
      };

      if (current.length === 0) {
        setMeasurePhotoId(newPhoto.id);
      }

      return [...current, newPhoto];
    });
    resetStatus();
  }

  function handleFile(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const sisaSlot = MAX_PHOTOS - photos.length;
    if (sisaSlot <= 0) {
      setError(`Maksimal ${MAX_PHOTOS} foto untuk sekali analisis.`);
      e.target.value = "";
      return;
    }

    files.slice(0, sisaSlot).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => addPhoto(ev.target.result, file.type, "upload");
      reader.readAsDataURL(file);
    });

    if (files.length > sisaSlot) {
      setError(`Hanya ${sisaSlot} foto yang ditambahkan. Maksimal ${MAX_PHOTOS} foto.`);
    }
    e.target.value = "";
  }

  function removePhoto(id) {
    setPhotos((current) => {
      const next = current.filter((photo) => photo.id !== id);
      if (measurePhotoId === id) {
        setMeasurePhotoId(next[0]?.id || null);
        resetMeasurePoints();
      }
      return next;
    });
    resetStatus();
  }

  function clearPhotos() {
    setPhotos([]);
    setMeasurePhotoId(null);
    resetMeasurePoints();
    resetStatus();
  }

  function resetMeasurePoints() {
    setMeasurePoints({ ...INITIAL_MEASURE_POINTS });
    setMeasureStepIndex(0);
    setMeasureStatus("");
  }

  function handleMeasurePhotoChange(id) {
    setMeasurePhotoId(id);
    resetMeasurePoints();
    resetStatus();
  }

  function handleMeasureClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const point = {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
    const activeStep = MEASURE_STEPS[measureStepIndex];

    setMeasurePoints((current) => ({
      ...current,
      [activeStep.key]: point,
    }));
    setMeasureStepIndex((current) => Math.min(current + 1, MEASURE_STEPS.length - 1));
    resetStatus();
  }

  async function hitungTinggiDariMarker() {
    const markerCm = Number(markerHeightCm);
    const goatPx = getDistance(measurePoints.goatTop, measurePoints.goatBottom);
    const markerPx = getDistance(measurePoints.markerTop, measurePoints.markerBottom);
    const selectedPhoto = photos.find((photo) => photo.id === measurePhotoId);

    if (!markerCm || markerCm <= 0) {
      setError("Isi tinggi marker pembanding dulu, contoh 29.7 cm untuk kertas A4 berdiri.");
      return;
    }

    if (!goatPx || !markerPx) {
      setError("Lengkapi 4 titik ukur: punggung, tanah, atas marker, dan bawah marker.");
      return;
    }

    const estimated = (goatPx / markerPx) * markerCm;
    setError(null);

    try {
      setMeasureStatus("Menghitung dengan Python...");
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const response = await fetch(`${HEIGHT_API_URL}/estimate-height`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          marker_height_cm: markerCm,
          points: measurePoints,
          photo_id: measurePhotoId,
          image_mime: selectedPhoto?.mimeType || "image/jpeg",
        }),
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error("Python backend tidak memberi response valid.");
      }

      const result = await response.json();
      setTinggiBadanCm(Number(result.tinggi_cm).toFixed(1));
      setMeasureStatus(`Dihitung Python (${result.confidence || "sedang"}).`);
    } catch (err) {
      setTinggiBadanCm(estimated.toFixed(1));
      setMeasureStatus("Python belum aktif, dipakai hitungan browser.");
    }
  }

  async function startCamera(mode) {
    setCameraActive(false);
    setError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const selectedMode = mode || facingMode;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: selectedMode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.style.display = "block";
        setCameraActive(true);
      }
    } catch {
      setError("Kamera tidak dapat diakses. Coba gunakan fitur upload.");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    if (videoRef.current) videoRef.current.style.display = "none";
  }

  async function flipCamera() {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    await startCamera(newMode);
  }

  function switchTab(t) {
    setTab(t);
    resetStatus();
    if (t === "camera") startCamera();
    else stopCamera();
  }

  function ambilFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || photos.length >= MAX_PHOTOS) {
      setError(`Maksimal ${MAX_PHOTOS} foto untuk sekali analisis.`);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg");
    addPhoto(dataUrl, "image/jpeg", "camera");
  }

  async function uploadFotoSupabase(base64, mime) {
    try {
      const ext = mime?.includes("png") ? "png" : "jpg";
      const fileName = `kambing_${Date.now()}.${ext}`;
      const byteString = atob(base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++)
        ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mime || "image/jpeg" });

      const { error: uploadError } = await supabase.storage
        .from("foto-kambing")
        .upload(fileName, blob, { contentType: mime || "image/jpeg" });

      if (uploadError) {
        console.warn("Upload foto gagal:", uploadError.message);
        return null;
      }

      const { data } = supabase.storage
        .from("foto-kambing")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (err) {
      console.warn("Upload foto error:", err);
      return null;
    }
  }

  async function mulaiAnalisis() {
    if (photos.length === 0) return;
    setLoading(true);
    setHasil(null);
    setError(null);
    setTokenHabis(false);
    setTokenPesan("");

    const msgs = [
      `Memindai ${photos.length} foto kambing...`,
      "Membandingkan sudut tubuh, mata, kaki, dan kulit...",
      "Mendeteksi gejala penyakit...",
      "Menghitung estimasi harga pasar...",
      "Menyusun rekomendasi perawatan...",
    ];
    let i = 0;
    setLoadingMsg(msgs[0]);
    const interval = setInterval(() => {
      setLoadingMsg(msgs[++i % msgs.length]);
    }, 1500);

    try {
      const images = photos.map((photo) => ({
        base64: photo.base64,
        mimeType: photo.mimeType,
      }));

      const data = await analisisKambing({
        images,
        jenisKambing,
        cekKurban,
        cekHarga,
        tinggiBadanCm: tinggiBadanCm ? Number(tinggiBadanCm) : null,
        beratBadanKg: beratBadanKg ? Number(beratBadanKg) : null,
      });
      setHasil(data);

      const fotoUtama = photos[0];
      const fotoUrl = await uploadFotoSupabase(fotoUtama.base64, fotoUtama.mimeType);

      await supabase.from("pemeriksaan").insert({
        jenis_kambing: jenisKambing || null,
        status: data.status,
        kepercayaan: data.kepercayaan,
        penyakit: data.nama_penyakit || null,
        harga_min: data.harga_min || null,
        harga_max: data.harga_max || null,
        layak_kurban: cekKurban && typeof data.layak_kurban === "boolean" ? data.layak_kurban : null,
        rekomendasi: data.rekomendasi,
        hasil_lengkap: {
          ...data,
          jumlah_foto: photos.length,
          tinggi_badan_input_cm: tinggiBadanCm ? Number(tinggiBadanCm) : null,
          berat_badan_input_kg: beratBadanKg ? Number(beratBadanKg) : null,
        },
        foto_url: fotoUrl,
      });
    } catch (err) {
      if (err.bukanKambing) {
        setError(err.message);
      } else if (err.isTokenHabis) {
        setTokenHabis(true);
        const usage = getUsageInfo();
        setTokenPesan(
          `Reset jam ${usage.resetJam}, sekitar ${usage.sisaWaktu}.`
        );
      } else {
        setError(
          "Gagal menganalisis gambar. Pastikan foto jelas dan API key sudah benar."
        );
      }
      console.error(err);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  }

  return (
    <div className="grid-2">
      <div>
        <div className="card">
          <p className="section-label">Input foto kambing</p>

          <div className="tab-group">
            <button
              className={`tab-btn ${tab === "upload" ? "active" : ""}`}
              onClick={() => switchTab("upload")}
            >
              Upload
            </button>
            <button
              className={`tab-btn ${tab === "camera" ? "active" : ""}`}
              onClick={() => switchTab("camera")}
            >
              Kamera
            </button>
          </div>

          <div className="photo-guide-card">
            <div className="photo-guide-title">
              <span>Panduan foto agar hasil akurat</span>
              <small>A4 berdiri = 29.7 cm</small>
            </div>
            <ol>
              {PHOTO_GUIDE.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          {tab === "upload" && (
            <>
              <div
                className="upload-zone"
                onClick={() => document.getElementById("file-in").click()}
              >
                <div className="icon"></div>
                <p>Klik untuk tambah satu atau beberapa foto</p>
                <small>JPG, PNG maks. {MAX_PHOTOS} foto per analisis</small>
              </div>
              <input
                id="file-in"
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleFile}
              />
            </>
          )}

          {tab === "camera" && (
            <>
              <div className="camera-wrap">
                <video
                  ref={videoRef}
                  className="camera-feed"
                  autoPlay
                  playsInline
                  style={{ display: "none" }}
                />
                {cameraActive && panduanUkur && (
                  <div className="height-guide" aria-hidden="true">
                    <div className="height-guide-line top">
                      <span>Punggung</span>
                    </div>
                    <div className="height-guide-line bottom">
                      <span>Tanah</span>
                    </div>
                    <div className="height-guide-ruler">
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
                {cameraActive && (
                  <button
                    onClick={flipCamera}
                    title={
                      facingMode === "environment"
                        ? "Ganti ke kamera depan"
                        : "Ganti ke kamera belakang"
                    }
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 10px",
                      fontSize: 13,
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    Putar
                  </button>
                )}
              </div>

              <canvas ref={canvasRef} style={{ display: "none" }} />

              {cameraActive && (
                <div className="height-tool">
                  <div className="height-tool-head">
                    <label htmlFor="tinggi-badan">Ukur tinggi badan</label>
                    <button
                      type="button"
                      onClick={() => setPanduanUkur((current) => !current)}
                    >
                      {panduanUkur ? "Sembunyikan garis" : "Tampilkan garis"}
                    </button>
                  </div>
                  <p>
                    Taruh kertas A4/marker berdiri di samping kambing, foto dari samping, lalu pakai alat ukur foto di bawah. Hasil tingginya akan masuk ke input manual ukuran.
                  </p>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {cameraActive ? (
                  <>
                    <button
                      className="btn-outline"
                      style={{ flex: 1 }}
                      onClick={ambilFoto}
                      disabled={photos.length >= MAX_PHOTOS}
                    >
                      Ambil foto
                    </button>
                    <button
                      className="btn-outline"
                      style={{ flex: 1 }}
                      onClick={stopCamera}
                    >
                      Matikan kamera
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => startCamera()}
                  >
                    Nyalakan kamera
                  </button>
                )}
              </div>

              {cameraActive && (
                <p
                  style={{
                    fontSize: 12,
                    color: "#888",
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  {facingMode === "environment"
                    ? "Kamera belakang aktif"
                    : "Kamera depan aktif"}
                </p>
              )}
            </>
          )}

          {photos.length > 0 && (
            <div className="photo-list-wrap">
              <div className="photo-list-head">
                <span>{photos.length} foto dipilih</span>
                <button type="button" onClick={clearPhotos}>Hapus semua</button>
              </div>
              <div className="photo-grid">
                {photos.map((photo, index) => (
                  <div className="photo-thumb" key={photo.id}>
                    <img src={photo.preview} alt={`Foto kambing ${index + 1}`} />
                    <span>{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      aria-label={`Hapus foto ${index + 1}`}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {photos.length > 0 && (
            <div className="measure-panel">
              <div className="measure-head">
                <div>
                  <p>Estimasi tinggi dari foto</p>
                  <small>Pakai marker A4 atau benda yang ukurannya pasti.</small>
                </div>
                <button type="button" onClick={resetMeasurePoints}>Reset titik</button>
              </div>

              <div className="measure-mini-guide">
                <span>Urutan tap:</span>
                <strong>punggung</strong>
                <strong>tanah</strong>
                <strong>atas marker</strong>
                <strong>bawah marker</strong>
              </div>

              <div className="marker-guide-box">
                <div>
                  <strong>Patokan marker</strong>
                  <p>
                    Marker harus benda nyata yang terlihat di foto dan sejajar dengan kambing. Titik hijau untuk tinggi kambing, titik biru untuk marker.
                  </p>
                </div>
                <div className="marker-presets">
                  {MARKER_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.label}
                      className={markerHeightCm === preset.value ? "active" : ""}
                      onClick={() => setMarkerHeightCm(preset.value)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <select
                className="select-input compact"
                value={measurePhotoId || ""}
                onChange={(e) => handleMeasurePhotoChange(e.target.value)}
              >
                {photos.map((photo, index) => (
                  <option key={photo.id} value={photo.id}>
                    Foto {index + 1} {photo.source === "camera" ? "kamera" : "upload"}
                  </option>
                ))}
              </select>

              <div className="measure-inputs">
                <label>
                  Tinggi marker
                  <div className="height-input-row">
                    <input
                      type="number"
                      min="1"
                      step="0.1"
                      inputMode="decimal"
                      value={markerHeightCm}
                      onChange={(e) => setMarkerHeightCm(e.target.value)}
                    />
                    <span>cm</span>
                  </div>
                </label>
                <label>
                  Tinggi terukur
                  <div className="height-input-row">
                    <input
                      type="number"
                      min="20"
                      max="140"
                      step="0.1"
                      inputMode="decimal"
                      value={tinggiBadanCm}
                      onChange={(e) => setTinggiBadanCm(e.target.value)}
                      placeholder="otomatis/manual"
                    />
                    <span>cm</span>
                  </div>
                </label>
              </div>

              <div className="measure-stage">
                {photos
                  .filter((photo) => photo.id === measurePhotoId)
                  .map((photo) => (
                    <button
                      type="button"
                      className="measure-photo"
                      onClick={handleMeasureClick}
                      key={photo.id}
                    >
                      <img src={photo.preview} alt="Foto untuk ukur tinggi" />
                      {Object.entries(measurePoints).map(([key, point]) => (
                        point && (
                          <span
                            key={key}
                            className={`measure-point ${key}`}
                            style={{ left: `${point.x}%`, top: `${point.y}%` }}
                          />
                        )
                      ))}
                      {measurePoints.goatTop && measurePoints.goatBottom && (
                        <span
                          className="measure-line goat"
                          style={{
                            left: `${measurePoints.goatTop.x}%`,
                            top: `${Math.min(measurePoints.goatTop.y, measurePoints.goatBottom.y)}%`,
                            height: `${Math.abs(measurePoints.goatBottom.y - measurePoints.goatTop.y)}%`,
                          }}
                        />
                      )}
                      {measurePoints.markerTop && measurePoints.markerBottom && (
                        <span
                          className="measure-line marker"
                          style={{
                            left: `${measurePoints.markerTop.x}%`,
                            top: `${Math.min(measurePoints.markerTop.y, measurePoints.markerBottom.y)}%`,
                            height: `${Math.abs(measurePoints.markerBottom.y - measurePoints.markerTop.y)}%`,
                          }}
                        />
                      )}
                    </button>
                  ))}
              </div>

              <div className="measure-step">
                <span>{measureStepIndex + 1}/4</span>
                <div>
                  <strong>{MEASURE_STEPS[measureStepIndex].label}</strong>
                  <p>{MEASURE_STEPS[measureStepIndex].hint}</p>
                </div>
              </div>

              <button
                type="button"
                className="btn-outline"
                onClick={hitungTinggiDariMarker}
              >
                Hitung tinggi dari marker
              </button>
              {measureStatus && (
                <p className="measure-status">{measureStatus}</p>
              )}
            </div>
          )}

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #f0f0eb",
              margin: "12px 0",
            }}
          />
          <p className="section-label">Opsi analisis</p>

          <select
            className="select-input"
            value={jenisKambing}
            onChange={(e) => setJenisKambing(e.target.value)}
          >
            <option value="">Jenis kambing (opsional)</option>
            <option>Etawa</option>
            <option>Boer</option>
            <option>Kacang</option>
            <option>Domba Garut</option>
            <option>Merino</option>
            <option>Peranakan Etawa</option>
          </select>

          <div className="manual-measure-card">
            <div className="manual-measure-title">
              <span>Input manual ukuran</span>
              <small>Opsional, tapi bikin estimasi lebih rapat</small>
            </div>
            <div className="manual-measure-grid">
              <label>
                Tinggi badan
                <div className="height-input-row">
                  <input
                    type="number"
                    min="20"
                    max="140"
                    step="0.1"
                    inputMode="decimal"
                    value={tinggiBadanCm}
                    onChange={(e) => setTinggiBadanCm(e.target.value)}
                    placeholder="contoh 68"
                  />
                  <span>cm</span>
                </div>
              </label>
              <label>
                Berat badan
                <div className="height-input-row">
                  <input
                    type="number"
                    min="1"
                    max="200"
                    step="0.1"
                    inputMode="decimal"
                    value={beratBadanKg}
                    onChange={(e) => setBeratBadanKg(e.target.value)}
                    placeholder="contoh 32"
                  />
                  <span>kg</span>
                </div>
              </label>
            </div>
          </div>

          <div className="check-row">
            <input
              type="checkbox"
              id="chk-kurban"
              checked={cekKurban}
              onChange={(e) => setCekKurban(e.target.checked)}
            />
            <label htmlFor="chk-kurban">Cek kelayakan hewan kurban</label>
          </div>
          <div className="check-row" style={{ marginBottom: 16 }}>
            <input
              type="checkbox"
              id="chk-harga"
              checked={cekHarga}
              onChange={(e) => setCekHarga(e.target.checked)}
            />
            <label htmlFor="chk-harga">Estimasi rentang harga jual</label>
          </div>

          <button
            className="btn-primary"
            onClick={mulaiAnalisis}
            disabled={photos.length === 0 || loading}
          >
            {loading ? "Menganalisis..." : `Analisis ${photos.length || ""} foto sekarang`}
          </button>
        </div>
      </div>

      <div>
        <div className="card" style={{ minHeight: 400 }}>
          <p className="section-label">Hasil analisis AI</p>

          {!loading && !hasil && !error && !tokenHabis && (
            <div className="empty-state">
              <div className="icon"></div>
              <p>Upload atau ambil foto kambing untuk memulai analisis</p>
            </div>
          )}

          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <p style={{ fontSize: 14, color: "#666" }}>{loadingMsg}</p>
            </div>
          )}

          {error && (
            <div className="alert alert-red">
              <div style={{ fontSize: 16, marginBottom: 4 }}>Peringatan</div>
              {error}
            </div>
          )}

          {tokenHabis && (
            <div className="alert alert-red" style={{ lineHeight: 1.7 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
                Kuota Limit Harian Habis
              </div>
              <div>Limit penggunaan harian AI sudah tercapai.</div>
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  background: "rgba(0,0,0,0.05)",
                  borderRadius: 8,
                }}
              >
                <strong>Reset otomatis:</strong>
                <br />
                {tokenPesan}
              </div>
            </div>
          )}

          {hasil && (
            <HasilAnalisis
              data={hasil}
              cekKurban={cekKurban}
              cekHarga={cekHarga}
            />
          )}
        </div>
      </div>
    </div>
  );
}

