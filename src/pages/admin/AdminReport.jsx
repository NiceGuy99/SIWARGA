import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import StatusBadge from '../../components/StatusBadge'

function formatTanggal(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function AdminReport() {
  const [loading, setLoading] = useState(true)
  const [dataWarga, setDataWarga] = useState([])
  const [stats, setStats] = useState({
    total: 0,
    totalKK: 0,
    laki: 0,
    perempuan: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    perRT: {}
  })

  async function loadData() {
    setLoading(true)
    try {
      // 1. Ambil data profiles (warga utama) dan anggota_keluarga (tanpa akun)
      const [{ data: profiles, error: pErr }, { data: anggota, error: aErr }] = await Promise.all([
        supabase
          .from('profiles')
          .select('nik, no_kk, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, hubungan_keluarga, status_verifikasi, rt, rw, created_at'),
        supabase
          .from('anggota_keluarga')
          .select('nik, no_kk, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, hubungan_keluarga, status_verifikasi, rt, rw, created_at')
      ])

      if (pErr) throw pErr
      if (aErr) throw aErr

      // 2. Gabungkan data
      const combined = [
        ...(profiles || []).map(w => ({ ...w, sumber: 'Akun Utama' })),
        ...(anggota || []).map(w => ({ ...w, sumber: 'Anggota Baru' }))
      ]

      // Urutkan berdasarkan No. KK lalu Hubungan Keluarga
      combined.sort((a, b) => {
        if (a.no_kk !== b.no_kk) return a.no_kk.localeCompare(b.no_kk)

        // Hubungan keluarga order helper
        const order = { 'Kepala Keluarga': 1, 'Istri': 2, 'Anak': 3, 'Cucu': 4, 'Famili Lain': 5 }
        const orderA = order[a.hubungan_keluarga] || 99
        const orderB = order[b.hubungan_keluarga] || 99
        return orderA - orderB
      })

      setDataWarga(combined)

      // 3. Hitung statistik
      const kkSet = new Set()
      let laki = 0, perempuan = 0
      let verified = 0, pending = 0, rejected = 0
      const perRT = {}

      combined.forEach(w => {
        if (w.no_kk) kkSet.add(w.no_kk)
        if (w.jenis_kelamin === 'Laki-laki') laki++
        else if (w.jenis_kelamin === 'Perempuan') perempuan++

        if (w.status_verifikasi === 'verified') verified++
        else if (w.status_verifikasi === 'rejected') rejected++
        else pending++

        const rtKey = `RT ${w.rt || '-'}/RW ${w.rw || '-'}`
        perRT[rtKey] = (perRT[rtKey] || 0) + 1
      })

      setStats({
        total: combined.length,
        totalKK: kkSet.size,
        laki,
        perempuan,
        verified,
        pending,
        rejected,
        perRT
      })

      // Otomatis memicu cetak PDF setelah render data selesai
      setTimeout(() => {
        window.print()
      }, 800)

    } catch (err) {
      console.error('Gagal mengambil laporan:', err)
      alert('Gagal memuat laporan: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f5f5', fontFamily: 'system-ui' }}>
        <div className="spinner" style={{ border: '4px solid rgba(0,0,0,0.1)', width: 36, height: 36, borderRadius: '50%', borderLeftColor: '#3b82f6', animation: 'spin 1s linear infinite' }} />
        <div style={{ marginTop: 16, color: '#666', fontSize: '14px' }}>Menyiapkan Laporan Kependudukan...</div>
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1024, margin: '0 auto', background: '#fff', color: '#000', fontFamily: 'Georgia, serif', lineHeight: 1.5 }}>
      {/* Tombol Kontrol (Hanya muncul di Layar, tersembunyi saat Cetak) */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8f9fa', border: '1px solid #ddd', borderRadius: 6, marginBottom: 24, fontFamily: 'system-ui' }}>
        <div>
          <span style={{ fontWeight: 600 }}>Dokumen Siap Dicetak</span>
          <span className="muted" style={{ display: 'block', fontSize: '12px', color: '#666' }}>Gunakan pilihan "Save as PDF" di menu cetak browser untuk mengekspor ke berkas PDF.</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn secondary small" onClick={() => window.close()} style={{ width: 'auto', margin: 0 }}>Tutup</button>
          <button className="btn small" onClick={() => window.print()} style={{ width: 'auto', margin: 0 }}>Cetak / Ekspor PDF</button>
        </div>
      </div>

      {/* Kop Surat Laporan */}
      <div style={{ textAlign: 'center', borderBottom: '3px double #000', paddingBottom: 16, marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '24px', fontWeight: 'bold' }}>Perumahan Permata Jaya Krian</h1>
        <h2 style={{ margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '20px' }}>Kabupaten Sidoarjo, Kecamatan Krian, Desa Katerungan</h2>
        <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic', fontFamily: 'system-ui', color: '#444' }}>
          Sistem Pendataan Warga Mandiri (SIWARGA) · Laporan Kependudukan Resmi
        </p>
      </div>

      {/* Judul Laporan */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 6px 0', textTransform: 'uppercase', textDecoration: 'underline', fontSize: '18px' }}>Laporan Rekapitulasi Data Kependudukan</h3>
        <p style={{ margin: 0, fontSize: '13px', fontFamily: 'system-ui', color: '#444' }}>
          Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Statistik Ringkas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24, fontFamily: 'system-ui' }}>
        <div style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'center', borderRadius: 4 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#555', fontWeight: 600 }}>Total Jiwa</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: 4 }}>{stats.total}</div>
        </div>
        <div style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'center', borderRadius: 4 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#555', fontWeight: 600 }}>Total Keluarga (KK)</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: 4 }}>{stats.totalKK}</div>
        </div>
        <div style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'center', borderRadius: 4 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#555', fontWeight: 600 }}>Laki-laki / Perempuan</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: 10 }}>{stats.laki} L / {stats.perempuan} P</div>
        </div>
        <div style={{ border: '1px solid #000', padding: '10px 12px', textAlign: 'center', borderRadius: 4 }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#555', fontWeight: 600 }}>Status Verifikasi</div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: 8, display: 'flex', gap: 6, justifyContent: 'center' }}>
            <span style={{ color: 'green' }}>{stats.verified} V</span> ·
            <span style={{ color: 'orange' }}>{stats.pending} P</span> ·
            <span style={{ color: 'red' }}>{stats.rejected} R</span>
          </div>
        </div>
      </div>

      {/* Sebaran Wilayah */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #000', paddingBottom: 4, textTransform: 'uppercase', fontSize: '13px' }}>Sebaran Penduduk Per RT/RW</h4>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '13px', fontFamily: 'system-ui' }}>
          {Object.entries(stats.perRT).map(([rt, count]) => (
            <div key={rt} style={{ background: '#f1f3f5', padding: '4px 10px', borderRadius: 4, border: '1px solid #ccc' }}>
              <strong>{rt}</strong>: {count} Jiwa
            </div>
          ))}
        </div>
      </div>

      {/* Tabel Data Penduduk */}
      <div>
        <h4 style={{ margin: '0 0 8px 0', borderBottom: '1px solid #000', paddingBottom: 4, textTransform: 'uppercase', fontSize: '13px' }}>Daftar Rincian Penduduk Terdaftar</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'system-ui' }}>
          <thead>
            <tr style={{ background: '#f1f1f1', borderBottom: '2px solid #000' }}>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'center', width: '3%' }}>No</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'left', width: '15%' }}>No. KK</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'left', width: '15%' }}>NIK</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 6px', textAlign: 'left', width: '22%' }}>Nama Lengkap</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'center', width: '10%' }}>Hubungan</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'center', width: '6%' }}>JK</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'left', width: '15%' }}>Lahir</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'center', width: '7%' }}>RT/RW</th>
              <th style={{ border: '1px solid #ccc', padding: '6px 4px', textAlign: 'center', width: '7%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {dataWarga.map((w, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px', textAlign: 'center' }}>{index + 1}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px', fontFamily: 'monospace' }}>{w.no_kk}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px', fontFamily: 'monospace' }}>{w.nik}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 6px', fontWeight: 600 }}>{w.nama_lengkap}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px', textAlign: 'center' }}>{w.hubungan_keluarga}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px', textAlign: 'center' }}>{w.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}</td>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px' }}>
                  {w.tempat_lahir || '-'}, {formatTanggal(w.tanggal_lahir)}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px', textAlign: 'center' }}>
                  {w.rt || '-'}/{w.rw || '-'}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '5px 4px', textAlign: 'center' }}>
                  <StatusBadge status={w.status_verifikasi} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lembar Tanda Tangan */}
      <div style={{ marginTop: 48, display: 'flex', justifyContent: 'flex-end', fontFamily: 'system-ui', fontSize: '13px' }}>
        <div style={{ textAlign: 'center', width: 240 }}>
          <p style={{ margin: 0 }}>Mengetahui,</p>
          <p style={{ margin: '4px 0 64px 0', fontWeight: 600 }}>Ketua Rukun Tetangga (RT)</p>
          <div style={{ borderBottom: '1px solid #000', width: '80%', margin: '0 auto' }} />
          <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', fontSize: '11px', color: '#666' }}>Tanda Tangan & Stempel Resmi</p>
        </div>
      </div>

      {/* CSS Cetak Khusus */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }
      `}} />
    </div>
  )
}
