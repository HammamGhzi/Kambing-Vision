import React from 'react'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka)
}

function statusBadge(status) {
  if (status === 'Sehat') return <span className="badge badge-green">✓ Sehat</span>
  if (status === 'Perlu Perhatian') return <span className="badge badge-yellow"> Perlu Perhatian</span>
  return <span className="badge badge-red"> Sakit</span>
}

function InfoRow({ label, children }) {
  return (
    <div style={{
      padding: '10px 0',
      borderBottom: '1px solid #f0f0eb',
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>
        {label}
      </p>
      <div style={{ fontSize: 14, color: '#1a1a1a', lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}

export default function HasilAnalisis({ data, cekKurban, cekHarga }) {
  const hargaFill = data.harga_max
    ? Math.min(100, Math.round((data.harga_max / 10000000) * 100))
    : 0

  return (
    <div>
      {/* Status utama */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0eb'
      }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: 16 }}>{data.status}</p>
          <p style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Kepercayaan AI: {data.kepercayaan}%</p>
        </div>
        {statusBadge(data.status)}
      </div>

      {/* Data fisik */}
      <InfoRow label="Kondisi fisik">{data.kondisi_fisik}</InfoRow>
      <InfoRow label="Perkiraan usia">{data.perkiraan_usia}</InfoRow>
      <InfoRow label="Perkiraan berat">{data.perkiraan_berat}</InfoRow>
      <InfoRow label="Indikasi penyakit">
        {data.penyakit_terdeteksi
          ? <span className="badge badge-red">Terdeteksi</span>
          : <span className="badge badge-green">Tidak ada</span>
        }
      </InfoRow>

      {/* Detail penyakit */}
      {data.penyakit_terdeteksi && (
        <div className="alert alert-warning" style={{ marginTop: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 6 }}> {data.nama_penyakit}</p>
          {data.gejala?.length > 0 && (
            <ul style={{ fontSize: 13, paddingLeft: 16, marginBottom: 8, lineHeight: 1.7 }}>
              {data.gejala.map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          )}
          <p style={{ fontSize: 13 }}> <strong>Solusi:</strong> {data.solusi_pengobatan}</p>
        </div>
      )}

      {/* Kurban */}
      {cekKurban && data.layak_kurban !== null && (
        <div className={`alert ${data.layak_kurban ? 'alert-green' : 'alert-warning'}`} style={{ marginTop: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>
            {data.layak_kurban ? ' Layak kurban' : ' Belum layak kurban'}
          </p>
          <p style={{ fontSize: 13, lineHeight: 1.6 }}>{data.alasan_kurban}</p>
        </div>
      )}

      {/* Harga */}
      {cekHarga && data.harga_min && data.harga_max && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0eb' }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
            Estimasi harga jual
          </p>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>
            {formatRupiah(data.harga_min)} – {formatRupiah(data.harga_max)}
          </p>
          <div className="price-bar" style={{ marginTop: 8 }}>
            <div className="price-fill" style={{ width: hargaFill + '%' }} />
          </div>
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            Berdasarkan kondisi, usia, berat, dan harga pasar ternak
          </p>
        </div>
      )}

      {/* Rekomendasi */}
      <div style={{ marginTop: 16, padding: '12px 14px', background: '#f5f5f0', borderRadius: 8 }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
           Rekomendasi
        </p>
        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.7 }}>{data.rekomendasi}</p>
      </div>
    </div>
  )
}