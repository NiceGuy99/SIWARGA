import { useState } from 'react'
import TopBar from '../../components/TopBar'
import AppFooter from '../../components/AppFooter'
import { useAuth } from '../../contexts/AuthContext'
import ProfilTab from './ProfilTab'
import DokumenTab from './DokumenTab'
import KeluargaTab from './KeluargaTab'

export default function WargaDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [tab, setTab] = useState('profil')

  return (
    <div className="app-shell">
      <TopBar subtitle="Akun Warga" />
      <div className="container">
        <div className="tabs">
          <button className={tab === 'profil' ? 'active' : ''} onClick={() => setTab('profil')}>
            Profil
          </button>
          <button className={tab === 'keluarga' ? 'active' : ''} onClick={() => setTab('keluarga')}>
            Daftar Keluarga
          </button>
          <button className={tab === 'dokumen' ? 'active' : ''} onClick={() => setTab('dokumen')}>
            Dokumen (KTP/KK)
          </button>
        </div>

        {tab === 'profil' && <ProfilTab profile={profile} onUpdated={refreshProfile} />}
        {tab === 'keluarga' && <KeluargaTab profile={profile} />}
        {tab === 'dokumen' && <DokumenTab profile={profile} />}
      </div>
      <AppFooter />
    </div>
  )
}
