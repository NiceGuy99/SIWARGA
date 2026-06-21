import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import StatusBadge from '../../components/StatusBadge'

function formatTanggal(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ProfilTab({ profile, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    alamat: profile.alamat || '',
    rt: profile.rt || '',
    rw: profile.rw || '',
    agama: profile.agama || '',
    status_perkawinan: profile.status_perkawinan || '',
    pekerjaan: profile.pekerjaan || '',
    no_telepon: profile.no_telepon || ''
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const { error } = await supabase.from('profiles').update(form).eq('id', profile.id)
    setSaving(false)
    if (error) {
      setMessage('Gagal menyimpan: ' + error.message)
      return
    }
    setEditing(false)
    setMessage('Perubahan tersimpan.')
    onUpdated?.()
  }

  return (
    <div>
      <div className="id-card">
        <div className="id-eyebrow">Kartu Identitas Digital</div>
        <h2>{profile.nama_lengkap}</h2>
        <div className="id-row"><span>NIK</span><span>{profile.nik}</span></div>
        <div className="id-row"><span>No. KK</span><span>{profile.no_kk}</span></div>
        <div className="id-row"><span>Status</span><span><StatusBadge status={profile.status_verifikasi} /></span></div>
      </div>

      {profile.status_verifikasi === 'pending' && (
        <div className="alert info">Data Anda sedang menunggu verifikasi admin RT/RW.</div>
      )}
      {profile.status_verifikasi === 'rejected' && (
        <div className="alert error">
          Data Anda ditolak admin.{profile.catatan_admin ? ` Alasan: ${profile.catatan_admin}` : ''} Silakan perbarui data Anda.
        </div>
      )}
      {message && <div className="alert success">{message}</div>}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Data Diri</h3>
          {!editing && (
            <button className="btn secondary small" onClick={() => setEditing(true)}>Ubah</button>
          )}
        </div>
        <div className="spacer" />

        <div className="muted" style={{ marginBottom: 10 }}>
          Jenis Kelamin: <strong>{profile.jenis_kelamin || '-'}</strong><br />
          Tempat, Tgl Lahir: <strong>{profile.tempat_lahir || '-'}, {formatTanggal(profile.tanggal_lahir)}</strong><br />
          Hubungan dalam KK: <strong>{profile.hubungan_keluarga || '-'}</strong>
        </div>
        <small className="muted">
          NIK, No. KK, nama, tempat/tanggal lahir, dan hubungan keluarga hanya bisa
          diubah oleh admin (sesuai dokumen resmi). Hubungi admin RT/RW bila ada kesalahan.
        </small>

        <div className="spacer" />

        {editing ? (
          <form onSubmit={handleSave}>
            <div className="field">
              <label>Alamat</label>
              <textarea rows={2} value={form.alamat} onChange={(e) => update('alamat', e.target.value)} />
            </div>
            <div className="row">
              <div className="field">
                <label>RT</label>
                <input value={form.rt} onChange={(e) => update('rt', e.target.value)} />
              </div>
              <div className="field">
                <label>RW</label>
                <input value={form.rw} onChange={(e) => update('rw', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Agama</label>
              <input value={form.agama} onChange={(e) => update('agama', e.target.value)} />
            </div>
            <div className="field">
              <label>Status Perkawinan</label>
              <select value={form.status_perkawinan} onChange={(e) => update('status_perkawinan', e.target.value)}>
                <option>Belum Kawin</option>
                <option>Kawin</option>
                <option>Cerai Hidup</option>
                <option>Cerai Mati</option>
              </select>
            </div>
            <div className="field">
              <label>Pekerjaan</label>
              <input value={form.pekerjaan} onChange={(e) => update('pekerjaan', e.target.value)} />
            </div>
            <div className="field">
              <label>No. Telepon</label>
              <input value={form.no_telepon} onChange={(e) => update('no_telepon', e.target.value)} />
            </div>
            <div className="row">
              <button type="button" className="btn secondary" onClick={() => setEditing(false)}>Batal</button>
              <button type="submit" className="btn" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="list-item"><span className="muted">Alamat</span><span>{profile.alamat || '-'}</span></div>
            <div className="list-item"><span className="muted">RT/RW</span><span>{profile.rt || '-'}/{profile.rw || '-'}</span></div>
            <div className="list-item"><span className="muted">Agama</span><span>{profile.agama || '-'}</span></div>
            <div className="list-item"><span className="muted">Status Perkawinan</span><span>{profile.status_perkawinan || '-'}</span></div>
            <div className="list-item"><span className="muted">Pekerjaan</span><span>{profile.pekerjaan || '-'}</span></div>
            <div className="list-item"><span className="muted">No. Telepon</span><span>{profile.no_telepon || '-'}</span></div>
          </div>
        )}
      </div>
    </div>
  )
}
