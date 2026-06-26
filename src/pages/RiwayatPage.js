import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka)
}

function statusBadge(status) {
  if (status === 'Sehat') return <span className="badge badge-green">Sehat</span>
  if (status === 'Perlu Perhatian') return <span className="badge badge-yellow">Perlu Perhatian</span>
  return <span className="badge badge-red">Sakit</span>
}

export default function RiwayatPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [dipilih, setDipilih] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: rows } = await supabase
        .from('pemeriksaan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setData(rows || [])
      setLoading(false)
    }
    load()
  }, [])

  function formatTanggal(str) {
    return new Date(str).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  if (loading) return (
    <div className="card">
      <div className="spinner-wrap"><div className="spinner" /><p style={{ color: '#888', fontSize: 14 }}>Memuat riwayat...</p></div>
    </div>
  )

  if (data.length === 0) return (
    <div className="card">
      <div className="empty-state">
        <div className="icon"></div>
        <p>Belum ada riwayat pemeriksaan</p>
      </div>
    </div>
  )

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>

      {/* List riwayat */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem 0.5rem' }}>
          <p className="section-label">Riwayat pemeriksaan</p>
          <p style={{ fontSize: 12, color: '#aaa', marginTop: -8 }}>{data.length} data tersimpan</p>
        </div>
        <div style={{ maxHeight: 520, overflowY: 'auto', padding: '0 1.5rem 1rem' }}>
          {data.map(item => (
            <div
              key={item.id}
              onClick={() => setDipilih(item)}
              style={{
                background: dipilih?.id === item.id ? '#f5f5f0' : 'transparent',
                borderRadius: 8,
                padding: '10px 8px',
                margin: '2px -8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {/* Foto thumbnail dari Supabase Storage */}
              <div style={{
                width: 46, height: 46, borderRadius: 8,
                background: '#f0f0eb', flexShrink: 0, overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {item.foto_url
                  ? <img src={item.foto_url} alt="kambing" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 22 }}>🐐</span>
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 14, display: 'block' }}>{item.jenis_kambing || 'Kambing'}</strong>
                <span style={{ fontSize: 12, color: '#888' }}>{formatTanggal(item.created_at)}</span>
              </div>
              <div style={{ flexShrink: 0 }}>{statusBadge(item.status)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="card" style={{ minHeight: 300, position: 'sticky', top: 72 }}>
        <p className="section-label">Detail pemeriksaan</p>
        {!dipilih ? (
          <div className="empty-state">
            <div className="icon"></div>
            <p>Pilih riwayat untuk lihat detail</p>
          </div>
        ) : (
          <div>
            {/* Foto detail dari Supabase Storage */}
            {dipilih.foto_url && (
              <img
                src={dipilih.foto_url}
                alt="kambing"
                style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 16 }}
              />
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0eb' }}>
              <div>
                <p style={{ fontWeight: 600 }}>{dipilih.jenis_kambing || 'Kambing'}</p>
                <p style={{ fontSize: 12, color: '#888' }}>{formatTanggal(dipilih.created_at)}</p>
              </div>
              {statusBadge(dipilih.status)}
            </div>

            <div style={{ marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>Kepercayaan AI</p>
              <p style={{ fontSize: 14 }}>{dipilih.kepercayaan}%</p>
            </div>

            {dipilih.penyakit && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>Penyakit</p>
                <p style={{ fontSize: 14, color: '#991b1b' }}>{dipilih.penyakit}</p>
              </div>
            )}

            {dipilih.layak_kurban !== null && dipilih.layak_kurban !== undefined && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Layak kurban</p>
                {dipilih.layak_kurban
                  ? <span className="badge badge-green">Ya</span>
                  : <span className="badge badge-yellow">Tidak</span>
                }
              </div>
            )}

            {dipilih.harga_min && dipilih.harga_max && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 2 }}>Estimasi harga</p>
                <p style={{ fontSize: 15, fontWeight: 700 }}>{formatRupiah(dipilih.harga_min)} – {formatRupiah(dipilih.harga_max)}</p>
              </div>
            )}

            {dipilih.rekomendasi && (
              <div style={{ marginTop: 14, padding: '12px 14px', background: '#f5f5f0', borderRadius: 8 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Rekomendasi</p>
                <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>{dipilih.rekomendasi}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}