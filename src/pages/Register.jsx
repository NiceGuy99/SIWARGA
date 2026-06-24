import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { isValidNIK, isValidNoKK, isValidPhone, nikToAuthEmail } from '../utils/validators'

const emptyForm = {
  no_kk: '',
  nik: '',
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
}

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [setuju, setSetuju] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function validate() {
    if (!isValidNoKK(form.no_kk)) return 'Nomor KK harus 16 digit angka.'
    if (!isValidNIK(form.nik)) return 'NIK harus 16 digit angka.'
    if (!form.nama_lengkap.trim()) return 'Nama lengkap wajib diisi.'
    if (!form.tanggal_lahir) return 'Tanggal lahir wajib diisi.'
    if (!form.alamat.trim()) return 'Alamat wajib diisi.'
    if (!isValidPhone(form.no_telepon)) return 'Nomor telepon tidak valid.'
    if (!setuju) return 'Anda harus menyetujui penggunaan data untuk melanjutkan.'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSubmitting(true)

    const email = nikToAuthEmail(form.nik)

    // Password awal otomatis = NIK. Warga WAJIB menggantinya
    // saat login pertama (lihat ProtectedRoute + halaman GantiPassword).
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.nik
    })

    if (signUpError) {
      setSubmitting(false)
      console.error('Sign up error:', signUpError)
      if (signUpError.message?.toLowerCase().includes('already registered')) {
        setError('NIK ini sudah terdaftar. Silakan masuk, atau hubungi admin RT/RW jika lupa password.')
      } else if (signUpError.message?.toLowerCase().includes('rate limit exceeded')) {
        setError('Terlalu banyak mencoba mendaftar (rate limit terlampaui). Silakan tunggu beberapa menit, atau sesuaikan batasan rate limit di dashboard Supabase Auth.')
      } else {
        const errMsg = signUpError.message || (typeof signUpError === 'object' ? JSON.stringify(signUpError) : String(signUpError))
        setError('Gagal mendaftar: ' + (errMsg === '{}' ? 'Terjadi kesalahan sistem Supabase Auth. Silakan periksa Console Developer (F12) untuk detailnya.' : errMsg))
      }
      return
    }

    let userId = signUpData.user?.id

    // Jika konfirmasi email aktif di project Supabase, signUp tidak
    // langsung memberi session. Coba sign-in manual sebagai fallback.
    if (!signUpData.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: form.nik
      })
      if (signInError) {
        setSubmitting(false)
        setError(
          'Akun dibuat, tetapi gagal masuk otomatis. Pastikan opsi "Confirm email" ' +
          'dimatikan di pengaturan Supabase Auth, lalu coba masuk manual.'
        )
        return
      }
      userId = signInData.user.id
    }

    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      no_kk: form.no_kk,
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
      no_telepon: form.no_telepon.trim()
    })

    setSubmitting(false)

    if (profileError) {
      setError('Akun berhasil dibuat, tetapi data profil gagal disimpan: ' + profileError.message)
      return
    }

    // Keluar otomatis agar warga harus login secara manual
    await supabase.auth.signOut()

    navigate('/login', {
      replace: true,
      state: {
        successMessage: 'Pendaftaran berhasil! Password default Anda adalah NIK Anda. Anda wajib mengganti password setelah masuk pertama kali.'
      }
    })
  }

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
      <h1>Daftar Warga Baru</h1>
      <p className="muted">
        Data Anda akan diverifikasi oleh admin RT/RW setelah pendaftaran.
        Password awal Anda otomatis sama dengan NIK.
      </p>
      <div className="spacer" />

      {error && <div className="alert error">{error}</div>}

      <form onSubmit={handleSubmit} className="card">
        <div className="field">
          <label>Nomor Kartu Keluarga (16 digit)</label>
          <input inputMode="numeric" maxLength={16} value={form.no_kk}
            onChange={(e) => update('no_kk', e.target.value.replace(/\D/g, ''))} />
          <small>Warga dengan No. KK yang sama akan terhubung sebagai satu keluarga.</small>
        </div>
        <div className="field">
          <label>NIK (16 digit)</label>
          <input inputMode="numeric" maxLength={16} value={form.nik}
            onChange={(e) => update('nik', e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="field">
          <label>Nama Lengkap</label>
          <input value={form.nama_lengkap} onChange={(e) => update('nama_lengkap', e.target.value)} />
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
            <label>Hubungan dalam KK</label>
            <select value={form.hubungan_keluarga} onChange={(e) => update('hubungan_keluarga', e.target.value)}>
              <option>Kepala Keluarga</option>
              <option>Istri</option>
              <option>Anak</option>
              <option>Famili Lain</option>
            </select>
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Tempat Lahir</label>
            <input value={form.tempat_lahir} onChange={(e) => update('tempat_lahir', e.target.value)} />
          </div>
          <div className="field">
            <label>Tanggal Lahir</label>
            <input type="date" value={form.tanggal_lahir} onChange={(e) => update('tanggal_lahir', e.target.value)} />
          </div>
        </div>

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

        <div className="row">
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
        </div>

        <div className="field">
          <label>Pekerjaan</label>
          <input value={form.pekerjaan} onChange={(e) => update('pekerjaan', e.target.value)} />
        </div>
        <div className="field">
          <label>No. Telepon (opsional)</label>
          <input value={form.no_telepon} onChange={(e) => update('no_telepon', e.target.value)} />
        </div>

        <div className="field" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <input type="checkbox" id="setuju" style={{ width: 'auto', marginTop: 3 }}
            checked={setuju} onChange={(e) => setSetuju(e.target.checked)} />
          <label htmlFor="setuju" style={{ marginBottom: 0, fontWeight: 400 }}>
            Saya menyetujui data ini digunakan untuk keperluan administrasi kependudukan RT/RW.
          </label>
        </div>

        <button className="btn" type="submit" disabled={submitting}>
          {submitting ? 'Mendaftarkan...' : 'Daftar'}
        </button>
      </form>

      <p className="muted" style={{ textAlign: 'center' }}>
        Sudah punya akun? <Link to="/login">Masuk di sini</Link>
      </p>
    </div>
  )
}
