import React, { useState, useRef } from "react";
import { analisisKambing, getUsageInfo } from "../lib/gemini";
import { supabase } from "../lib/supabase";
import HasilAnalisis from "../components/HasilAnalisis";

export default function AnalisisPage() {
  const [tab, setTab] = useState("upload");
  const [preview, setPreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
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

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMimeType(file.type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setHasil(null);
      setError(null);
      setTokenHabis(false);
      setTokenPesan("");
    };
    reader.readAsDataURL(file);
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
  }

  async function flipCamera() {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    await startCamera(newMode);
  }

  function switchTab(t) {
    setTab(t);
    setPreview(null);
    setImageBase64(null);
    setHasil(null);
    setError(null);
    setTokenHabis(false);
    setTokenPesan("");
    if (t === "camera") startCamera();
    else stopCamera();
  }

  function ambilFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setPreview(dataUrl);
    setImageBase64(dataUrl.split(",")[1]);
    setMimeType("image/jpeg");
    setCameraActive(false);
    stopCamera();
    video.style.display = "none";
    setHasil(null);
  }

  function ulangi() {
    setPreview(null);
    setImageBase64(null);
    setHasil(null);
    if (videoRef.current) videoRef.current.style.display = "block";
    startCamera();
  }

  async function uploadFotoSupabase(base64, mime) {
    try {
      const fileName = `kambing_${Date.now()}.jpg`;
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
    if (!imageBase64) return;
    setLoading(true);
    setHasil(null);
    setError(null);
    setTokenHabis(false);
    setTokenPesan("");

    const msgs = [
      "Memindai kondisi fisik kambing...",
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
      const data = await analisisKambing({
        imageBase64,
        mimeType,
        jenisKambing,
        cekKurban,
        cekHarga,
      });
      setHasil(data);

      const fotoUrl = await uploadFotoSupabase(imageBase64, mimeType);

      await supabase.from("pemeriksaan").insert({
        jenis_kambing: jenisKambing || null,
        status: data.status,
        kepercayaan: data.kepercayaan,
        penyakit: data.nama_penyakit || null,
        harga_min: data.harga_min || null,
        harga_max: data.harga_max || null,
        layak_kurban: cekKurban ? data.layak_kurban : null,
        rekomendasi: data.rekomendasi,
        hasil_lengkap: data,
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
          <p className="section-label"> Input foto kambing</p>

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

          {tab === "upload" && (
            <>
              {!preview ? (
                <div
                  className="upload-zone"
                  onClick={() => document.getElementById("file-in").click()}
                >
                  <div className="icon"></div>
                  <p>Klik atau seret foto kambing ke sini</p>
                  <small>JPG, PNG maks. 10 MB</small>
                </div>
              ) : (
                <img src={preview} alt="Preview" className="preview-img" />
              )}
              <input
                id="file-in"
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFile}
              />
              {preview && (
                <button
                  className="btn-outline"
                  style={{ marginBottom: 12 }}
                  onClick={() => {
                    setPreview(null);
                    setImageBase64(null);
                    setHasil(null);
                  }}
                >
                  Ganti foto
                </button>
              )}
            </>
          )}

          {tab === "camera" && (
            <>
              <div style={{ position: "relative" }}>
                <video
                  ref={videoRef}
                  className="camera-feed"
                  autoPlay
                  playsInline
                  style={{ display: "none" }}
                />
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
                      fontSize: 18,
                      cursor: "pointer",
                      lineHeight: 1,
                    }}
                  >
                    Putar
                  </button>
                )}
              </div>

              <canvas ref={canvasRef} style={{ display: "none" }} />
              {preview && (
                <img src={preview} alt="Snapshot" className="preview-img" />
              )}

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {!preview && cameraActive && (
                  <button
                    className="btn-outline"
                    style={{ flex: 1 }}
                    onClick={ambilFoto}
                  >
                    Ambil foto
                  </button>
                )}
                {!preview && !cameraActive && !error && (
                  <button
                    className="btn-outline"
                    style={{ flex: 1 }}
                    onClick={() => startCamera()}
                  >
                    Nyalakan kamera
                  </button>
                )}
                {preview && (
                  <button
                    className="btn-outline"
                    style={{ flex: 1 }}
                    onClick={ulangi}
                  >
                    Ulangi
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

          <hr
            style={{
              border: "none",
              borderTop: "1px solid #f0f0eb",
              margin: "12px 0",
            }}
          />
          <p className="section-label"> Opsi analisis</p>

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
            disabled={!imageBase64 || loading}
          >
            {loading ? "Menganalisis..." : "Analisis sekarang"}
          </button>
        </div>
      </div>

      <div>
        <div className="card" style={{ minHeight: 400 }}>
          <p className="section-label"> Hasil analisis AI</p>

          {!loading && !hasil && !error && !tokenHabis && (
            <div className="empty-state">
              <div className="icon"></div>
              <p>Upload foto kambing untuk memulai analisis</p>
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
              <div style={{ fontSize: 16, marginBottom: 4 }}>⚠️</div>
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
                🔄 <strong>Reset otomatis:</strong>
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