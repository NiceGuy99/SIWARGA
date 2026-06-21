import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import LoadingScreen from './LoadingScreen'

export default function ProtectedRoute({ role }) {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingScreen label="Memeriksa sesi..." />

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Profil belum termuat (mis. baru saja dibuat) — tunjukkan opsi keluar jika data profil tidak ada di DB.
  if (!profile) {
    return (
      <div className="center-screen" style={{ flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
        <div style={{ color: 'var(--danger)', fontWeight: 600, fontSize: '18px' }}>Profil Tidak Ditemukan</div>
        <p className="muted" style={{ margin: 0, maxWidth: 360 }}>
          Akun Anda terdaftar di sistem Auth, tetapi data profil warga tidak ditemukan di database.
        </p>
        <button className="btn danger small" style={{ width: 'auto' }} onClick={signOut}>
          Keluar & Kembali
        </button>
      </div>
    )
  }

  // Wajib ganti password di percobaan login pertama.
  if (!profile.sudah_ganti_password && location.pathname !== '/ganti-password') {
    return <Navigate to="/ganti-password" replace />
  }

  if (role && profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/warga'} replace />
  }

  return <Outlet />
}
