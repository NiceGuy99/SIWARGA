import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase, DOKUMEN_BUCKET } from '../../lib/supabaseClient'
import TopBar from '../../components/TopBar'
import StatusBadge from '../../components/StatusBadge'

const PAGE_SIZE = 15

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('semua')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // State untuk daftar anggota keluarga pending
  const [anggotaPending, setAnggotaPending] = useState([])
  const [anggotaLoading, setAnggotaLoading] = useState(true)

  const loadStats = useCallback(async () => {
    const [{ count: total }, { count: pending }, { count: dokumenPending }, { count: anggotaPendingCount }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status_verifikasi', 'pending'),
      supabase.from('dokumen').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('anggota_keluarga').select('id', { count: 'exact', head: true }).eq('status_verifikasi', 'pending')
    ])
    setStats({
      total: total || 0,
      pending: pending || 0,
      dokumenPending: dokumenPending || 0,
      anggotaPending: anggotaPendingCount || 0
    })
  }, [])

  const loadList = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('profiles')
      .select('id, nik, nama_lengkap, no_kk, rt, rw, status_verifikasi, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (statusFilter !== 'semua') {
      query = query.eq('status_verifikasi', statusFilter)
    }
    if (search.trim()) {
      query = query.or(`nama_lengkap.ilike.%${search.trim()}%,nik.ilike.%${search.trim()}%`)
    }

    const { data, error, count } = await query
    if (!error) {
      setItems(data || [])
      setTotalCount(count || 0)
    }
    setLoading(false)
  }, [page, search, statusFilter])

  const loadAnggotaPending = useCallback(async () => {
    setAnggotaLoading(true)
    const { data } = await supabase
      .from('anggota_keluarga')
      .select('*')
      .eq('status_verifikasi', 'pending')
      .order('created_at', { ascending: false })
    setAnggotaPending(data || [])
    setAnggotaLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadAnggotaPending() }, [loadAnggotaPending])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  async function handleAnggotaStatus(anggota, status) {
    let catatan = null
    if (status === 'rejected') {
      catatan = window.prompt('Alasan penolakan:')
      if (catatan === null) return
    }
    const { error: updErr } = await supabase
      .from('anggota_keluarga')
      .update({ status_verifikasi: status, catatan_admin: catatan })
      .eq('id', anggota.id)
    if (updErr) {
      alert('Gagal mengubah status: ' + updErr.message)
      return
    }
    loadAnggotaPending()
    loadStats()
  }

  async function handleViewKtp(path) {
    const { data, error } = await supabase.storage
      .from(DOKUMEN_BUCKET)
      .createSignedUrl(path, 60)
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener')
    }
  }

  async function handleExportExcel() {
    try {
      // 1. Ambil data gabungan profiles + anggota_keluarga
      const [{ data: profiles, error: pErr }, { data: anggota, error: aErr }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('anggota_keluarga').select('*')
      ])

      if (pErr) throw pErr
      if (aErr) throw aErr

      const combined = [
        ...(profiles || []).map(w => ({ ...w, sumber: 'Akun Utama' })),
        ...(anggota || []).map(w => ({ ...w, sumber: 'Anggota Baru' }))
      ]

      // Urutkan berdasarkan No. KK lalu hubungan keluarga
      combined.sort((a, b) => {
        if (a.no_kk !== b.no_kk) return a.no_kk.localeCompare(b.no_kk)
        const order = { 'Kepala Keluarga': 1, 'Istri': 2, 'Anak': 3, 'Famili Lain': 4 }
        return (order[a.hubungan_keluarga] || 99) - (order[b.hubungan_keluarga] || 99)
      })

      // 2. Buat header CSV
      const headers = [
        'No', 'No. KK', 'NIK', 'Nama Lengkap', 'Jenis Kelamin', 'Tempat Lahir', 
        'Tanggal Lahir', 'Hubungan Keluarga', 'Alamat', 'RT', 'RW', 'Agama', 
        'Status Perkawinan', 'Pekerjaan', 'No. Telepon', 'Sumber Data', 'Status Verifikasi'
      ]

      // 3. Konversi ke baris CSV
      const rows = combined.map((w, index) => [
        index + 1,
        // Formula Excel agar NIK dan KK terbaca sebagai teks
        `="${w.no_kk}"`,
        `="${w.nik}"`,
        w.nama_lengkap || '',
        w.jenis_kelamin || '',
        w.tempat_lahir || '',
        w.tanggal_lahir || '',
        w.hubungan_keluarga || '',
        w.alamat || '',
        w.rt || '',
        w.rw || '',
        w.agama || '',
        w.status_perkawinan || '',
        w.pekerjaan || '',
        w.no_telepon || '',
        w.sumber,
        w.status_verifikasi
      ])

      // Gabungkan header dan baris
      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(val => {
          let cell = val === null || val === undefined ? '' : String(val)
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            cell = `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        }).join(','))
      ].join('\r\n')

      // 4. Download file menggunakan UTF-8 BOM agar terbaca rapi di Excel
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `Laporan_Kependudukan_SIWARGA_${new Date().toISOString().slice(0,10)}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Ekspor gagal:', err)
      alert('Gagal mengekspor data: ' + err.message)
    }
  }

  return (
    <div className="app-shell">
      <TopBar subtitle="Panel Admin" />
      <div className="container" style={{ maxWidth: 640 }}>
        {stats && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0, flex: 1, minWidth: 100 }}>
              <div className="muted">Total Warga</div>
              <h2 style={{ marginTop: 4 }}>{stats.total}</h2>
            </div>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0, flex: 1, minWidth: 100 }}>
              <div className="muted">Warga Pending</div>
              <h2 style={{ marginTop: 4, color: 'var(--warning)' }}>{stats.pending}</h2>
            </div>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0, flex: 1, minWidth: 100 }}>
              <div className="muted">Dokumen Pending</div>
              <h2 style={{ marginTop: 4, color: 'var(--warning)' }}>{stats.dokumenPending}</h2>
            </div>
            <div className="card" style={{ textAlign: 'center', marginBottom: 0, flex: 1, minWidth: 100 }}>
              <div className="muted">Keluarga Pending</div>
              <h2 style={{ marginTop: 4, color: 'var(--warning)' }}>{stats.anggotaPending}</h2>
            </div>
          </div>
        )}

        {/* Panel Ekspor Laporan */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 20px', marginBottom: 14, background: 'var(--card)', border: '1px solid var(--line)' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '14px' }}>Laporan Kependudukan</h4>
            <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '12px' }}>Ekspor seluruh data warga terdaftar (gabungan utama & anggota baru)</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn secondary small" onClick={handleExportExcel} style={{ width: 'auto', margin: 0 }}>
              📥 Ekspor ke Excel
            </button>
            <button className="btn small" onClick={() => window.open('/admin/laporan', '_blank')} style={{ width: 'auto', margin: 0 }}>
              🖨️ Cetak / Simpan PDF
            </button>
          </div>
        </div>

        {/* Daftar anggota keluarga pending */}
        {!anggotaLoading && anggotaPending.length > 0 && (
          <div className="card" style={{ borderColor: 'var(--accent)', marginBottom: 14 }}>
            <h3 style={{ marginBottom: 8 }}>Anggota Keluarga Menunggu Verifikasi</h3>
            {anggotaPending.map((a) => (
              <div key={a.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="name">{a.nama_lengkap}</div>
                    <div className="meta">NIK {a.nik} · KK {a.no_kk} · {a.hubungan_keluarga}</div>
                    <div className="meta">
                      {a.jenis_kelamin} · {a.tempat_lahir || '-'} · {a.alamat || '-'} RT {a.rt || '-'}/RW {a.rw || '-'}
                    </div>
                  </div>
                  <StatusBadge status={a.status_verifikasi} />
                </div>
                {a.ktp_file_path && (
                  <button className="btn secondary small" style={{ marginTop: 8 }}
                    onClick={() => handleViewKtp(a.ktp_file_path)}>Lihat KTP</button>
                )}
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn small" onClick={() => handleAnggotaStatus(a, 'verified')}>Verifikasi</button>
                  <button className="btn danger small" onClick={() => handleAnggotaStatus(a, 'rejected')}>Tolak</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <div className="field" style={{ marginBottom: 10 }}>
            <input
              placeholder="Cari nama atau NIK..."
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value) }}
            />
          </div>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {['semua', 'pending', 'verified', 'rejected'].map((s) => (
              <button
                key={s}
                className={statusFilter === s ? 'active' : ''}
                onClick={() => { setPage(0); setStatusFilter(s) }}
              >
                {s === 'semua' ? 'Semua' : s === 'pending' ? 'Pending' : s === 'verified' ? 'Terverifikasi' : 'Ditolak'}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? (
            <>
              <div className="skeleton" style={{ height: 50, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 50, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 50 }} />
            </>
          ) : items.length === 0 ? (
            <p className="muted">Tidak ada data warga yang cocok.</p>
          ) : (
            items.map((w) => (
              <Link to={`/admin/warga/${w.id}`} key={w.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="list-item">
                  <div>
                    <div className="name">{w.nama_lengkap}</div>
                    <div className="meta">NIK {w.nik} · RT {w.rt || '-'}/RW {w.rw || '-'}</div>
                  </div>
                  <StatusBadge status={w.status_verifikasi} />
                </div>
              </Link>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="row" style={{ marginBottom: 24 }}>
            <button className="btn secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Sebelumnya
            </button>
            <button className="btn secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Berikutnya →
            </button>
          </div>
        )}
        <p className="muted" style={{ textAlign: 'center' }}>Halaman {page + 1} dari {totalPages}</p>
      </div>
    </div>
  )
}
