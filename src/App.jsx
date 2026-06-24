import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoadingScreen from './components/LoadingScreen'
import Login from './pages/Login'
import Register from './pages/Register'
import ChangePassword from './pages/ChangePassword'

// Halaman warga & admin di-lazy-load terpisah: warga tidak perlu
// mengunduh kode panel admin, begitu pula sebaliknya. Ini memperkecil
// JS yang harus diunduh di percobaan pertama lewat koneksi lambat.
const WargaDashboard = lazy(() => import('./pages/warga/WargaDashboard'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminWargaDetail = lazy(() => import('./pages/admin/AdminWargaDetail'))
const AdminReport = lazy(() => import('./pages/admin/AdminReport'))

function Home() {
  const { profile } = useAuth()
  if (!profile) return <LoadingScreen />
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/warga'} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/daftar" element={<Register />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Home />} />
              <Route path="/ganti-password" element={<ChangePassword />} />
            </Route>

            <Route element={<ProtectedRoute role="warga" />}>
              <Route path="/warga" element={<WargaDashboard />} />
            </Route>

            <Route element={<ProtectedRoute role="admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/warga/:id" element={<AdminWargaDetail />} />
              <Route path="/admin/laporan" element={<AdminReport />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
