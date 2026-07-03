import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { isValidNIK, nikToAuthEmail } from '../utils/validators'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const successMessage = location.state?.successMessage
  const [nik, setNik] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!isValidNIK(nik)) {
      setError('NIK harus terdiri dari 16 digit angka.')
      return
    }
    if (!password) {
      setError('Password wajib diisi.')
      return
    }

    setSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: nikToAuthEmail(nik),
      password
    })
    setSubmitting(false)

    if (signInError) {
      setError('NIK atau password salah. Periksa kembali data Anda.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="center-screen">
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <div className="brand-mark">SW</div>
          <div>
            <h1 style={{ marginBottom: 0 }}>SIWARGA</h1>
            <h2 style={{ marginBottom: 0 }}> Sistem Informasi Warga</h2>
            <p className="muted" style={{ margin: 0 }}>Permata Jaya Krian</p>
          </div>
        </div>

        <div className="card">
          <h2>Masuk</h2>
          <p className="muted">Gunakan NIK dan password Anda.</p>
          <div className="spacer" />

          {successMessage && <div className="alert success" style={{ marginBottom: 16 }}>{successMessage}</div>}
          {error && <div className="alert error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="nik">NIK (16 digit)</label>
              <input
                id="nik"
                inputMode="numeric"
                maxLength={16}
                autoComplete="username"
                placeholder="contoh: 3578xxxxxxxxxxxx"
                value={nik}
                onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password Anda"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>Pengguna baru: password awal sama dengan NIK Anda.</small>
            </div>
            <button className="btn" type="submit" disabled={submitting}>
              {submitting ? 'Memproses...' : 'Masuk'}
            </button>
          </form>
        </div>

        <p className="muted" style={{ textAlign: 'center' }}>
          Belum punya akun? <Link to="/daftar">Daftar sebagai warga</Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--ink-soft)', fontSize: '11.5px' }}>
          SIWARGA — Permata Jaya Krian &nbsp;·&nbsp; &copy; {new Date().getFullYear()}{' '}
          <a href="https://github.com/NiceGuy99" target="_blank" rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}>NiceGuy99</a>
        </p>
      </div>
    </div>
  )
}
