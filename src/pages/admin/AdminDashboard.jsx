import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase, DOKUMEN_BUCKET } from '../../lib/supabaseClient'
import TopBar from '../../components/TopBar'
import StatusBadge from '../../components/StatusBadge'
import AppFooter from '../../components/AppFooter'

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

  // State tambahan untuk Tampilan Keluarga & Pendaftaran Manual
  const [viewMode, setViewMode] = useState('warga') // 'warga' atau 'keluarga'
  const [allProfiles, setAllProfiles] = useState([])
  const [allAnggota, setAllAnggota] = useState([])
  const [familiesLoading, setFamiliesLoading] = useState(false)
  const [expandedFamilies, setExpandedFamilies] = useState({})

  const [showManualModal, setShowManualModal] = useState(false)
  const [manualForm, setManualForm] = useState({
    nik: '',
    no_kk: '',
    nama_lengkap: '',
    jenis_kelamin: 'Laki-laki',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat: '',
    rt: '',
    rw: '',
    agama: '',
    status_perkawinan: 'Belum Kawin',
    pekerjaan: '',
    hubungan_keluarga: 'Kepala Keluarga',
    no_telepon: ''
  })
  const [manualSaving, setManualSaving] = useState(false)
  const [manualError, setManualError] = useState('')

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

  const loadFamilies = useCallback(async () => {
    setFamiliesLoading(true)
    const [{ data: profiles, error: pErr }, { data: anggota, error: aErr }] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('anggota_keluarga').select('*')
    ])
    if (!pErr && !aErr) {
      setAllProfiles(profiles || [])
      setAllAnggota(anggota || [])
    }
    setFamiliesLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadAnggotaPending() }, [loadAnggotaPending])

  useEffect(() => {
    if (viewMode === 'keluarga') {
      loadFamilies()
    }
  }, [viewMode, loadFamilies])

  const familyList = useMemo(() => {
    const families = {}

    allProfiles.forEach(p => {
      if (!families[p.no_kk]) {
        families[p.no_kk] = { no_kk: p.no_kk, members: [] }
      }
      families[p.no_kk].members.push({ ...p, tipe: 'Akun Utama' })
    })

    allAnggota.forEach(a => {
      if (!families[a.no_kk]) {
        families[a.no_kk] = { no_kk: a.no_kk, members: [] }
      }
      families[a.no_kk].members.push({ ...a, tipe: 'Anggota Baru' })
    })

    return Object.values(families).map(fam => {
      fam.members.sort((a, b) => {
        const order = { 'Kepala Keluarga': 1, 'Istri': 2, 'Anak': 3, 'Cucu': 4, 'Famili Lain': 5 }
        return (order[a.hubungan_keluarga] || 99) - (order[b.hubungan_keluarga] || 99)
      })

      const kepala = fam.members.find(m => m.hubungan_keluarga === 'Kepala Keluarga')
      return {
        ...fam,
        kepala_keluarga: kepala ? kepala.nama_lengkap : 'Belum ditentukan',
        rt: kepala?.rt || fam.members[0]?.rt || '-',
        rw: kepala?.rw || fam.members[0]?.rw || '-',
        alamat: kepala?.alamat || fam.members[0]?.alamat || '-',
        jumlah_anggota: fam.members.length
      }
    })
  }, [allProfiles, allAnggota])

  const filteredFamilies = useMemo(() => {
    if (!search.trim()) return familyList
    const q = search.toLowerCase()
    return familyList.filter(fam =>
      fam.no_kk.includes(q) ||
      fam.kepala_keluarga.toLowerCase().includes(q) ||
      fam.members.some(m => m.nama_lengkap.toLowerCase().includes(q) || m.nik.includes(q))
    )
  }, [familyList, search])

  async function handleManualSubmit(e) {
    e.preventDefault()
    setManualError('')

    if (!/^\d{16}$/.test(manualForm.nik)) {
      setManualError('NIK harus 16 digit angka.')
      return
    }
    if (!/^\d{16}$/.test(manualForm.no_kk)) {
      setManualError('Nomor KK harus 16 digit angka.')
      return
    }
    if (!manualForm.nama_lengkap.trim()) {
      setManualError('Nama lengkap wajib diisi.')
      return
    }
    if (!manualForm.tanggal_lahir) {
      setManualError('Tanggal lahir wajib diisi.')
      return
    }

    setManualSaving(true)
    const emailDomain = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'siwarga.com'

    const { data, error } = await supabase.rpc('admin_create_warga_manual', {
      p_nik: manualForm.nik,
      p_no_kk: manualForm.no_kk,
      p_nama_lengkap: manualForm.nama_lengkap.trim(),
      p_jenis_kelamin: manualForm.jenis_kelamin,
      p_tempat_lahir: manualForm.tempat_lahir.trim(),
      p_tanggal_lahir: manualForm.tanggal_lahir,
      p_alamat: manualForm.alamat.trim(),
      p_rt: manualForm.rt.trim(),
      p_rw: manualForm.rw.trim(),
      p_agama: manualForm.agama.trim(),
      p_status_perkawinan: manualForm.status_perkawinan,
      p_pekerjaan: manualForm.pekerjaan.trim(),
      p_hubungan_keluarga: manualForm.hubungan_keluarga,
      p_no_telepon: manualForm.no_telepon.trim(),
      p_email_domain: emailDomain
    })

    setManualSaving(false)

    if (error) {
      setManualError('Gagal menambahkan warga: ' + error.message)
    } else {
      alert('Warga berhasil didaftarkan secara manual!')
      setShowManualModal(false)
      setManualForm({
        nik: '',
        no_kk: '',
        nama_lengkap: '',
        jenis_kelamin: 'Laki-laki',
        tempat_lahir: '',
        tanggal_lahir: '',
        alamat: '',
        rt: '',
        rw: '',
        agama: '',
        status_perkawinan: 'Belum Kawin',
        pekerjaan: '',
        hubungan_keluarga: 'Kepala Keluarga',
        no_telepon: ''
      })
      loadList()
      loadStats()
      loadFamilies()
    }
  }

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
        const order = { 'Kepala Keluarga': 1, 'Istri': 2, 'Anak': 3, 'Cucu': 4, 'Famili Lain': 5 }
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

        {/* Switcher Tampilan (Warga vs Keluarga) & Tambah Warga Manual */}
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 16px', marginBottom: 14 }}>
          <div className="tabs" style={{ marginBottom: 0, flex: 1 }}>
            <button className={viewMode === 'warga' ? 'active' : ''} onClick={() => setViewMode('warga')} style={{ padding: '8px 10px', fontSize: '13px' }}>
              👥 Daftar Warga
            </button>
            <button className={viewMode === 'keluarga' ? 'active' : ''} onClick={() => setViewMode('keluarga')} style={{ padding: '8px 10px', fontSize: '13px' }}>
              🏠 Daftar Keluarga
            </button>
          </div>
          <button className="btn small" onClick={() => setShowManualModal(true)} style={{ width: 'auto', margin: 0, whiteSpace: 'nowrap' }}>
            ➕ Tambah Warga
          </button>
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
          <div className="field" style={{ marginBottom: viewMode === 'warga' ? 10 : 0 }}>
            <input
              placeholder={viewMode === 'warga' ? "Cari nama atau NIK..." : "Cari No. KK, kepala keluarga, atau anggota..."}
              value={search}
              onChange={(e) => { setPage(0); setSearch(e.target.value) }}
            />
          </div>
          {viewMode === 'warga' && (
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
          )}
        </div>

        {viewMode === 'warga' ? (
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
        ) : (
          <div>
            {familiesLoading ? (
              <div className="card">
                <div className="skeleton" style={{ height: 60, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 60, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 60 }} />
              </div>
            ) : filteredFamilies.length === 0 ? (
              <div className="card">
                <p className="muted">Tidak ada data keluarga yang cocok.</p>
              </div>
            ) : (
              filteredFamilies.map((fam) => {
                const isExpanded = expandedFamilies[fam.no_kk]
                return (
                  <div className="card" key={fam.no_kk} style={{ borderLeft: '4px solid var(--primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '15px' }}>KK: {fam.no_kk}</h4>
                        <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '12.5px' }}>
                          Kepala Keluarga: <strong>{fam.kepala_keluarga}</strong>
                        </p>
                        <p className="muted" style={{ margin: '2px 0 0 0', fontSize: '11.5px' }}>
                          Alamat: {fam.alamat} (RT {fam.rt}/RW {fam.rw})
                        </p>
                      </div>
                      <button
                        className="btn secondary small"
                        onClick={() => setExpandedFamilies(prev => ({ ...prev, [fam.no_kk]: !isExpanded }))}
                        style={{ width: 'auto', padding: '5px 8px', fontSize: '12px', margin: 0 }}
                      >
                        {isExpanded ? '🔼 Tutup' : `🔽 Anggota (${fam.jumlah_anggota})`}
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                        {fam.members.map((m) => (
                          <div key={m.nik} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed var(--line)' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                {m.nama_lengkap}
                                <span className="muted" style={{ fontWeight: 400, fontSize: '11px', marginLeft: 6 }}>
                                  ({m.hubungan_keluarga})
                                </span>
                              </div>
                              <div className="muted" style={{ fontSize: '11px' }}>
                                NIK: {m.nik} · {m.jenis_kelamin} · {m.pekerjaan || '-'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                              <StatusBadge status={m.status_verifikasi} />
                              <span className="muted" style={{ fontSize: '10px' }}>{m.tipe}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {viewMode === 'warga' && totalPages > 1 && (
          <div className="row" style={{ marginBottom: 24 }}>
            <button className="btn secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ← Sebelumnya
            </button>
            <button className="btn secondary" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Berikutnya →
            </button>
          </div>
        )}
        {viewMode === 'warga' && (
          <p className="muted" style={{ textAlign: 'center' }}>Halaman {page + 1} dari {totalPages}</p>
        )}
      </div>

      {/* Modal Pendaftaran Warga Manual */}
      {showManualModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(18, 44, 74, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: 480,
            maxHeight: '90vh',
            overflowY: 'auto',
            marginBottom: 0,
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ marginBottom: 0 }}>Daftar Warga Manual</h2>
              <button className="btn secondary small" onClick={() => setShowManualModal(false)} style={{ width: 'auto', margin: 0 }}>✖ Batal</button>
            </div>

            {manualError && <div className="alert error">{manualError}</div>}

            <form onSubmit={handleManualSubmit}>
              <div className="field">
                <label>NIK (16 digit)</label>
                <input inputMode="numeric" maxLength={16} value={manualForm.nik}
                  onChange={(e) => setManualForm(f => ({ ...f, nik: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div className="field">
                <label>Nomor Kartu Keluarga (16 digit)</label>
                <input inputMode="numeric" maxLength={16} value={manualForm.no_kk}
                  onChange={(e) => setManualForm(f => ({ ...f, no_kk: e.target.value.replace(/\D/g, '') }))} />
              </div>
              <div className="field">
                <label>Nama Lengkap</label>
                <input value={manualForm.nama_lengkap} onChange={(e) => setManualForm(f => ({ ...f, nama_lengkap: e.target.value }))} />
              </div>

              <div className="row">
                <div className="field">
                  <label>Jenis Kelamin</label>
                  <select value={manualForm.jenis_kelamin} onChange={(e) => setManualForm(f => ({ ...f, jenis_kelamin: e.target.value }))}>
                    <option>Laki-laki</option>
                    <option>Perempuan</option>
                  </select>
                </div>
                <div className="field">
                  <label>Hubungan dalam KK</label>
                  <select value={manualForm.hubungan_keluarga} onChange={(e) => setManualForm(f => ({ ...f, hubungan_keluarga: e.target.value }))}>
                    <option>Kepala Keluarga</option>
                    <option>Istri</option>
                    <option>Anak</option>
                    <option>Cucu</option>
                    <option>Famili Lain</option>
                  </select>
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label>Tempat Lahir</label>
                  <input value={manualForm.tempat_lahir} onChange={(e) => setManualForm(f => ({ ...f, tempat_lahir: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Tanggal Lahir</label>
                  <input type="date" value={manualForm.tanggal_lahir} onChange={(e) => setManualForm(f => ({ ...f, tanggal_lahir: e.target.value }))} />
                </div>
              </div>

              <div className="field">
                <label>Alamat</label>
                <textarea rows={2} value={manualForm.alamat} onChange={(e) => setManualForm(f => ({ ...f, alamat: e.target.value }))} />
              </div>

              <div className="row">
                <div className="field">
                  <label>RT</label>
                  <input value={manualForm.rt} onChange={(e) => setManualForm(f => ({ ...f, rt: e.target.value }))} />
                </div>
                <div className="field">
                  <label>RW</label>
                  <input value={manualForm.rw} onChange={(e) => setManualForm(f => ({ ...f, rw: e.target.value }))} />
                </div>
              </div>

              <div className="row">
                <div className="field">
                  <label>Agama</label>
                  <input value={manualForm.agama} onChange={(e) => setManualForm(f => ({ ...f, agama: e.target.value }))} />
                </div>
                <div className="field">
                  <label>Status Perkawinan</label>
                  <select value={manualForm.status_perkawinan} onChange={(e) => setManualForm(f => ({ ...f, status_perkawinan: e.target.value }))}>
                    <option>Belum Kawin</option>
                    <option>Kawin</option>
                    <option>Cerai Hidup</option>
                    <option>Cerai Mati</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Pekerjaan</label>
                <input value={manualForm.pekerjaan} onChange={(e) => setManualForm(f => ({ ...f, pekerjaan: e.target.value }))} />
              </div>
              <div className="field">
                <label>No. Telepon (opsional)</label>
                <input value={manualForm.no_telepon} onChange={(e) => setManualForm(f => ({ ...f, no_telepon: e.target.value }))} />
              </div>

              <button className="btn" type="submit" disabled={manualSaving}>
                {manualSaving ? 'Mendaftarkan Warga...' : 'Simpan Warga Baru'}
              </button>
            </form>
          </div>
        </div>
      )}
      <AppFooter />
    </div>
  )
}
