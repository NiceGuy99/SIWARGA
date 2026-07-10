import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, DOKUMEN_BUCKET } from '../../lib/supabaseClient'
import TopBar from '../../components/TopBar'
import StatusBadge from '../../components/StatusBadge'
import AppFooter from '../../components/AppFooter'

const JENIS_LABEL = { ktp: 'KTP', kk: 'Kartu Keluarga' }

export default function AdminWargaDetail() {
  const { id } = useParams()

  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(null)
  const [dokumen, setDokumen] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p, error: pErr }, { data: docs }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('dokumen').select('*').eq('warga_id', id)
    ])
    if (pErr) {
      setError('Data warga tidak ditemukan.')
    } else {
      setProfile(p)
      setForm(p)
    }
    setDokumen(docs || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSaveData(e) {
    e.preventDefault()
    if (form.nik && !/^\d{16}$/.test(form.nik)) {
      setMessage('Gagal menyimpan: NIK harus terdiri dari 16 digit angka.')
      return
    }
    if (form.no_kk && !/^\d{16}$/.test(form.no_kk)) {
      setMessage('Gagal menyimpan: Nomor KK harus terdiri dari 16 digit angka.')
      return
    }
    setSaving(true)
    setMessage('')
    const { data, error: updErr } = await supabase.from('profiles').update({
      nik: form.nik,
      nama_lengkap: form.nama_lengkap,
      no_kk: form.no_kk,
      jenis_kelamin: form.jenis_kelamin,
      tempat_lahir: form.tempat_lahir,
      tanggal_lahir: form.tanggal_lahir,
      alamat: form.alamat,
      rt: form.rt,
      rw: form.rw,
      agama: form.agama,
      status_perkawinan: form.status_perkawinan,
      pekerjaan: form.pekerjaan,
      hubungan_keluarga: form.hubungan_keluarga,
      no_telepon: form.no_telepon,
      role: form.role
    }).eq('id', id).select()
    setSaving(false)
    if (updErr || !data || data.length === 0) {
      setMessage('Gagal menyimpan: ' + (updErr?.message || 'Anda tidak memiliki izin atau data tidak ditemukan.'))
      return
    }
    setMessage('Data warga berhasil diperbarui.')
    load()
  }

  async function handleSetStatus(status) {
    let catatan = null
    if (status === 'rejected') {
      catatan = window.prompt('Alasan penolakan (akan dilihat warga):')
      if (catatan === null) return
    }
    setSaving(true)
    const { error: updErr } = await supabase.from('profiles')
      .update({ status_verifikasi: status, catatan_admin: catatan })
      .eq('id', id)
    setSaving(false)
    if (updErr) { setMessage('Gagal mengubah status: ' + updErr.message); return }
    load()
  }

  async function handleDokumenStatus(doc, status) {
    let catatan = null
    if (status === 'rejected') {
      catatan = window.prompt('Alasan dokumen ditolak (akan dilihat warga):')
      if (catatan === null) return
    }
    const { error: updErr } = await supabase.from('dokumen')
      .update({ status, catatan_admin: catatan })
      .eq('id', doc.id)
    if (updErr) { setMessage('Gagal memperbarui dokumen: ' + updErr.message); return }
    load()
  }

  async function handleViewDokumen(path) {
    const { data, error: urlErr } = await supabase.storage
      .from(DOKUMEN_BUCKET)
      .createSignedUrl(path, 60)
    if (!urlErr && data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener')
  }

  async function handleResetPassword() {
    if (!window.confirm(`Apakah Anda yakin ingin mengatur ulang kata sandi ${profile.nama_lengkap} ke default (NIK: ${profile.nik})?`)) {
      return
    }
    setSaving(true)
    setMessage('')
    const { data, error: rpcErr } = await supabase.rpc('admin_reset_user_password', {
      user_id: id,
      new_password: profile.nik
    })
    setSaving(false)
    if (rpcErr) {
      setMessage('Gagal mereset kata sandi: ' + rpcErr.message)
    } else {
      setMessage('Kata sandi berhasil direset ke default (NIK).')
    }
  }

  if (loading) {
    return (
      <div className="app-shell">
        <TopBar subtitle="Panel Admin" />
        <div className="container"><div className="skeleton" style={{ height: 200 }} /></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app-shell">
        <TopBar subtitle="Panel Admin" />
        <div className="container">
          <div className="alert error">{error}</div>
          <Link to="/admin">← Kembali ke daftar</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopBar subtitle="Panel Admin" />
      <div className="container">
        <Link to="/admin" className="muted">← Kembali ke daftar</Link>
        <div className="spacer" />

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginBottom: 0 }}>{profile.nama_lengkap}</h2>
            <StatusBadge status={profile.status_verifikasi} />
          </div>
          <p className="muted">NIK {profile.nik} · No. KK {profile.no_kk}</p>

          {message && (
            <div className={`alert ${message.startsWith('Gagal') ? 'error' : 'success'}`}>
              {message}
            </div>
          )}

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="btn small" disabled={saving || profile.status_verifikasi === 'verified'}
              onClick={() => handleSetStatus('verified')}>Verifikasi Warga</button>
            <button className="btn danger small" disabled={saving || profile.status_verifikasi === 'rejected'}
              onClick={() => handleSetStatus('rejected')}>Tolak</button>
            <button className="btn secondary small" disabled={saving}
              onClick={handleResetPassword}>🔑 Reset Password ke NIK</button>
          </div>
        </div>

        <div className="card">
          <h3>Dokumen</h3>
          {dokumen.length === 0 && <p className="muted">Warga belum mengunggah dokumen apa pun.</p>}
          {dokumen.map((doc) => (
            <div className="list-item" key={doc.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="name">{JENIS_LABEL[doc.jenis_dokumen]}</span>
                <StatusBadge status={doc.status} />
              </div>
              <div className="row">
                <button className="btn secondary small" onClick={() => handleViewDokumen(doc.file_path)}>Lihat File</button>
                <button className="btn small" disabled={doc.status === 'verified'}
                  onClick={() => handleDokumenStatus(doc, 'verified')}>Verifikasi</button>
                <button className="btn danger small" disabled={doc.status === 'rejected'}
                  onClick={() => handleDokumenStatus(doc, 'rejected')}>Tolak</button>
              </div>
            </div>
          ))}
        </div>

        <form className="card" onSubmit={handleSaveData}>
          <h3>Ubah Data Warga</h3>
          <div className="field">
            <label>Nama Lengkap</label>
            <input value={form.nama_lengkap || ''} onChange={(e) => update('nama_lengkap', e.target.value)} />
          </div>
          <div className="field">
            <label>NIK</label>
            <input value={form.nik || ''} maxLength={16}
              onChange={(e) => update('nik', e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="field">
            <label>No. KK</label>
            <input value={form.no_kk || ''} maxLength={16}
              onChange={(e) => update('no_kk', e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="row">
            <div className="field">
              <label>Jenis Kelamin</label>
              <select value={form.jenis_kelamin || ''} onChange={(e) => update('jenis_kelamin', e.target.value)}>
                <option value="">-</option>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </div>
            <div className="field">
              <label>Hubungan dalam KK</label>
              <select value={form.hubungan_keluarga || ''} onChange={(e) => update('hubungan_keluarga', e.target.value)}>
                <option value="">-</option>
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
              <input value={form.tempat_lahir || ''} onChange={(e) => update('tempat_lahir', e.target.value)} />
            </div>
            <div className="field">
              <label>Tanggal Lahir</label>
              <input type="date" value={form.tanggal_lahir || ''} onChange={(e) => update('tanggal_lahir', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Alamat</label>
            <textarea rows={2} value={form.alamat || ''} onChange={(e) => update('alamat', e.target.value)} />
          </div>
          <div className="row">
            <div className="field">
              <label>RT</label>
              <input value={form.rt || ''} onChange={(e) => update('rt', e.target.value)} />
            </div>
            <div className="field">
              <label>RW</label>
              <input value={form.rw || ''} onChange={(e) => update('rw', e.target.value)} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Agama</label>
              <input value={form.agama || ''} onChange={(e) => update('agama', e.target.value)} />
            </div>
            <div className="field">
              <label>Status Perkawinan</label>
              <input value={form.status_perkawinan || ''} onChange={(e) => update('status_perkawinan', e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Pekerjaan</label>
            <input value={form.pekerjaan || ''} onChange={(e) => update('pekerjaan', e.target.value)} />
          </div>
          <div className="field">
            <label>No. Telepon</label>
            <input value={form.no_telepon || ''} onChange={(e) => update('no_telepon', e.target.value)} />
          </div>
          <div className="field">
            <label>Peran (Role)</label>
            <select value={form.role || 'warga'} onChange={(e) => update('role', e.target.value)}>
              <option value="warga">Warga</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button className="btn" type="submit" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
        </form>
      </div>
      <AppFooter />
    </div>
  )
}
