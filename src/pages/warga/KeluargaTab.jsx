import { useEffect, useState } from 'react'
import { supabase, DOKUMEN_BUCKET } from '../../lib/supabaseClient'
import StatusBadge from '../../components/StatusBadge'
import { compressImage } from '../../utils/imageCompress'
import { isValidFile } from '../../utils/validators'

function formatTanggal(d) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function KeluargaTab({ profile }) {
  const [loading, setLoading] = useState(true)
  const [profileMembers, setProfileMembers] = useState([])
  const [anggotaMembers, setAnggotaMembers] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // State khusus Famili Lain
  const [tergabungKK, setTergabungKK] = useState(true)
  const [ktpFile, setKtpFile] = useState(null)

  const initialForm = {
    nik: '',
    nama_lengkap: '',
    jenis_kelamin: 'Laki-laki',
    tempat_lahir: '',
    tanggal_lahir: '',
    alamat: profile?.alamat || '',
    rt: profile?.rt || '',
    rw: profile?.rw || '',
    agama: '',
    status_perkawinan: 'Belum Kawin',
    pekerjaan: '',
    hubungan_keluarga: 'Anak',
    no_telepon: ''
  }

  const [form, setForm] = useState(initialForm)

  async function loadKeluarga() {
    setLoading(true)

    // Load dari kedua tabel: profiles (warga dengan akun) + anggota_keluarga (tanpa akun)
    const [{ data: profiles }, { data: anggota }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, nik, no_kk, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, hubungan_keluarga, status_verifikasi, created_at')
        .eq('no_kk', profile.no_kk)
        .order('created_at', { ascending: true }),
      supabase
        .from('anggota_keluarga')
        .select('*')
        .eq('no_kk', profile.no_kk)
        .order('created_at', { ascending: true })
    ])

    setProfileMembers(profiles || [])
    setAnggotaMembers(anggota || [])
    setLoading(false)
  }

  useEffect(() => {
    if (profile?.no_kk) {
      loadKeluarga()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.no_kk])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function validate() {
    if (!/^\d{16}$/.test(form.nik)) return 'NIK harus terdiri dari 16 digit angka.'
    if (!form.nama_lengkap.trim()) return 'Nama lengkap wajib diisi.'
    if (!form.tanggal_lahir) return 'Tanggal lahir wajib diisi.'
    if (!form.alamat.trim()) return 'Alamat wajib diisi.'

    // Validasi file KTP jika Famili Lain & tidak satu KK
    if (form.hubungan_keluarga === 'Famili Lain' && !tergabungKK) {
      if (!ktpFile) return 'File KTP wajib diunggah untuk Famili Lain yang tidak terdaftar dalam satu KK.'
      const check = isValidFile(ktpFile)
      if (!check.ok) return check.message
    }

    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const valError = validate()
    if (valError) {
      setError(valError)
      return
    }

    setSubmitting(true)

    try {
      let ktpPath = null

      // Upload KTP terlebih dahulu jika Famili Lain beda KK
      if (form.hubungan_keluarga === 'Famili Lain' && !tergabungKK && ktpFile) {
        const compressed = await compressImage(ktpFile)
        const ext = compressed.type === 'application/pdf' ? 'pdf' : 'jpg'
        // Simpan di folder milik pendaftar agar sesuai storage policy
        const path = `${profile.id}/keluarga-ktp-${form.nik}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(DOKUMEN_BUCKET)
          .upload(path, compressed, { upsert: true, contentType: compressed.type })

        if (uploadError) {
          throw new Error('Gagal mengunggah berkas KTP: ' + uploadError.message)
        }
        ktpPath = path
      }

      // Simpan data anggota keluarga langsung ke database (TANPA signUp)
      const { error: insertError } = await supabase.from('anggota_keluarga').insert({
        didaftarkan_oleh: profile.id,
        no_kk: profile.no_kk,
        nik: form.nik,
        nama_lengkap: form.nama_lengkap.trim(),
        jenis_kelamin: form.jenis_kelamin,
        tempat_lahir: form.tempat_lahir.trim(),
        tanggal_lahir: form.tanggal_lahir,
        alamat: form.alamat.trim(),
        rt: form.rt.trim(),
        rw: form.rw.trim(),
        agama: form.agama.trim(),
        status_perkawinan: form.status_perkawinan,
        pekerjaan: form.pekerjaan.trim(),
        hubungan_keluarga: form.hubungan_keluarga,
        no_telepon: form.no_telepon.trim(),
        ktp_file_path: ktpPath
      })

      if (insertError) {
        throw insertError
      }

      setSuccess('Anggota keluarga berhasil diajukan! Menunggu verifikasi dari admin RT/RW.')
      setForm({
        ...initialForm,
        alamat: profile.alamat || '',
        rt: profile.rt || '',
        rw: profile.rw || ''
      })
      setTergabungKK(true)
      setKtpFile(null)
      setShowAddForm(false)
      loadKeluarga()
    } catch (err) {
      console.error(err)
      setError(err.message || 'Terjadi kesalahan internal.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ height: 20, width: '40%', marginBottom: 15 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    )
  }

  const isVerified = profile?.status_verifikasi === 'verified'

  // Gabungkan kedua sumber data ke satu daftar tampilan
  const allMembers = [
    ...profileMembers.map((m) => ({ ...m, _source: 'profile' })),
    ...anggotaMembers.map((m) => ({ ...m, _source: 'anggota' }))
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>Daftar Keluarga</h2>
          <p className="muted" style={{ margin: '4px 0 0 0' }}>Nomor Kartu Keluarga: <strong>{profile?.no_kk}</strong></p>
        </div>
        {!showAddForm && (
          <button
            className="btn small"
            disabled={!isVerified}
            onClick={() => setShowAddForm(true)}
            style={{ width: 'auto' }}
          >
            + Tambah Anggota
          </button>
        )}
      </div>

      {!isVerified && (
        <div className="alert info" style={{ marginBottom: 16 }}>
          Anda baru dapat mengajukan penambahan anggota keluarga setelah profil Anda sendiri telah diverifikasi oleh admin RT/RW.
        </div>
      )}

      {error && <div className="alert error">{error}</div>}
      {success && <div className="alert success">{success}</div>}

      {showAddForm && (
        <form className="card" onSubmit={handleSubmit} style={{ border: '1px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Form Anggota Keluarga Baru</h3>
            <button type="button" className="btn secondary small" onClick={() => setShowAddForm(false)}>Batal</button>
          </div>

          <div className="field">
            <label>NIK Anggota Baru (16 digit)</label>
            <input
              inputMode="numeric"
              maxLength={16}
              value={form.nik}
              onChange={(e) => update('nik', e.target.value.replace(/\D/g, ''))}
              placeholder="Masukkan NIK 16 digit"
              required
            />
          </div>

          <div className="field">
            <label>Nama Lengkap</label>
            <input
              value={form.nama_lengkap}
              onChange={(e) => update('nama_lengkap', e.target.value)}
              placeholder="Nama lengkap sesuai identitas"
              required
            />
          </div>

          <div className="row">
            <div className="field">
              <label>Jenis Kelamin</label>
              <select value={form.jenis_kelamin} onChange={(e) => update('jenis_kelamin', e.target.value)}>
                <option>Laki-laki</option>
                <option>Perempuan</option>
              </select>
            </div>
            <div className="field">
              <label>Hubungan dalam Keluarga</label>
              <select value={form.hubungan_keluarga} onChange={(e) => update('hubungan_keluarga', e.target.value)}>
                <option>Istri</option>
                <option>Anak</option>
                <option>Famili Lain</option>
                <option>Kepala Keluarga</option>
              </select>
            </div>
          </div>

          {/* Pertanyaan kondisional untuk Famili Lain */}
          {form.hubungan_keluarga === 'Famili Lain' && (
            <div style={{ border: '1px solid var(--line)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 14, background: '#faf9f6' }}>
              <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: 8 }}>
                Apakah Famili Lain ini tergabung dalam satu dokumen KK fisik yang sama?
              </label>
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="tergabungKK"
                    checked={tergabungKK === true}
                    onChange={() => { setTergabungKK(true); setKtpFile(null) }}
                    style={{ width: 'auto' }}
                  />
                  Ya, satu KK
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="tergabungKK"
                    checked={tergabungKK === false}
                    onChange={() => setTergabungKK(false)}
                    style={{ width: 'auto' }}
                  />
                  Tidak, beda KK
                </label>
              </div>
            </div>
          )}

          {/* Upload KTP wajib jika Famili Lain & beda KK */}
          {form.hubungan_keluarga === 'Famili Lain' && !tergabungKK && (
            <div className="field" style={{ border: '1px dashed var(--accent)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 14 }}>
              <label style={{ fontWeight: 600, color: 'var(--accent)' }}>Unggah Berkas KTP Anggota (Wajib)</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                <label className="btn accent small" style={{ cursor: 'pointer', display: 'inline-flex', width: 'auto', margin: 0 }}>
                  {ktpFile ? 'Ubah File' : 'Pilih File KTP'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setKtpFile(file)
                    }}
                  />
                </label>
                <span className="muted" style={{ fontSize: '13px' }}>
                  {ktpFile ? ktpFile.name : 'Belum ada berkas terpilih'}
                </span>
              </div>
              <small style={{ display: 'block', marginTop: 4 }}>Format berkas: JPG, PNG, atau PDF. Maksimal 3MB.</small>
            </div>
          )}

          <div className="row">
            <div className="field">
              <label>Tempat Lahir</label>
              <input
                value={form.tempat_lahir}
                onChange={(e) => update('tempat_lahir', e.target.value)}
                placeholder="Tempat lahir"
                required
              />
            </div>
            <div className="field">
              <label>Tanggal Lahir</label>
              <input
                type="date"
                value={form.tanggal_lahir}
                onChange={(e) => update('tanggal_lahir', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Alamat</label>
            <textarea
              rows={2}
              value={form.alamat}
              onChange={(e) => update('alamat', e.target.value)}
              required
            />
          </div>

          <div className="row">
            <div className="field">
              <label>RT</label>
              <input value={form.rt} onChange={(e) => update('rt', e.target.value)} required />
            </div>
            <div className="field">
              <label>RW</label>
              <input value={form.rw} onChange={(e) => update('rw', e.target.value)} required />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Agama</label>
              <input
                value={form.agama}
                onChange={(e) => update('agama', e.target.value)}
                placeholder="Agama"
                required
              />
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
          </div>

          <div className="field">
            <label>Pekerjaan</label>
            <input
              value={form.pekerjaan}
              onChange={(e) => update('pekerjaan', e.target.value)}
              placeholder="Pekerjaan"
              required
            />
          </div>

          <div className="field">
            <label>No. Telepon (Opsional)</label>
            <input
              value={form.no_telepon}
              onChange={(e) => update('no_telepon', e.target.value)}
              placeholder="No. Telepon"
            />
          </div>

          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Ajukan Anggota Keluarga'}
          </button>
        </form>
      )}

      <div className="card" style={{ padding: '8px 16px' }}>
        {allMembers.length === 0 && (
          <div style={{ padding: '20px 0', textAlign: 'center' }} className="muted">
            Tidak ada data anggota keluarga.
          </div>
        )}
        {allMembers.map((member) => (
          <div className="list-item" key={member.id} style={{ alignItems: 'flex-start', padding: '12px 0' }}>
            <div style={{ flex: 1, paddingRight: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="name" style={{ fontSize: '15px' }}>{member.nama_lengkap}</span>
                {member._source === 'profile' && member.id === profile.id && (
                  <span className="badge verified" style={{ fontSize: '9px', padding: '2px 6px' }}>Anda</span>
                )}
                {member._source === 'anggota' && (
                  <span className="badge pending" style={{ fontSize: '9px', padding: '2px 6px' }}>Anggota Baru</span>
                )}
              </div>
              <div className="meta" style={{ marginTop: 4 }}>
                NIK {member.nik} · {member.hubungan_keluarga || '-'} ({member.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'})
              </div>
              <div className="meta" style={{ fontSize: '11px', marginTop: 2 }}>
                Lahir: {member.tempat_lahir || '-'}, {formatTanggal(member.tanggal_lahir)}
              </div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <StatusBadge status={member.status_verifikasi} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
