import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function ChangePassword() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isFirstLogin = profile && !profile.sudah_ganti_password

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password baru minimal 8 karakter.')
      return
    }
    if (password === profile?.nik) {
      setError('Password baru tidak boleh sama dengan NIK.')
      return
    }
    if (password !== confirm) {
      setError('Konfirmasi password tidak cocok.')
      return
    }

    setSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setSubmitting(false)
      setError('Gagal mengubah password: ' + updateError.message)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ sudah_ganti_password: true })
      .eq('id', profile.id)

    setSubmitting(false)

    if (profileError) {
      setError('Password berhasil diubah, tetapi gagal memperbarui status: ' + profileError.message)
      return
    }

    await refreshProfile()
    navigate('/', { replace: true })
  }

  return (
    <div className="center-screen">
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div className="card">
          <h2>{isFirstLogin ? 'Lengkapi Keamanan Akun' : 'Ganti Password'}</h2>
          {isFirstLogin && (
            <div className="alert info">
              Ini adalah login pertama Anda. Untuk keamanan, password (yang saat ini
              sama dengan NIK) wajib diganti terlebih dahulu.
            </div>
          )}
          {error && <div className="alert error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Password Baru</label>
              <input type="password" autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)} />
              <small>Minimal 8 karakter, jangan gunakan NIK.</small>
            </div>
            <div className="field">
              <label>Konfirmasi Password Baru</label>
              <input type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>

          {!isFirstLogin && (
            <>
              <div className="spacer" />
              <button className="btn secondary" onClick={() => navigate(-1)}>Batal</button>
            </>
          )}
          {isFirstLogin && (
            <>
              <div className="spacer" />
              <button className="btn secondary" onClick={signOut}>Keluar</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
