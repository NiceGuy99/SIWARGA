import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function TopBar({ subtitle }) {
  const { signOut, profile } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="topbar">
      <div className="topbar-title">
        <strong>SIWARGA</strong>
        <span style={{ fontSize: '10px', opacity: 0.65, letterSpacing: '0.4px' }}>
          Permata Jaya Krian
        </span>
        <span>{subtitle || profile?.nama_lengkap || ''}</span>
      </div>
      <button className="link" onClick={handleLogout}>Keluar</button>
    </div>
  )
}

