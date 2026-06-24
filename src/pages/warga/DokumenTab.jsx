import { useEffect, useState } from 'react'
import { supabase, DOKUMEN_BUCKET } from '../../lib/supabaseClient'
import { isValidFile } from '../../utils/validators'
import { compressImage } from '../../utils/imageCompress'
import StatusBadge from '../../components/StatusBadge'

const JENIS_LABEL = { ktp: 'KTP', kk: 'Kartu Keluarga' }

export default function DokumenTab({ profile }) {
  const [dokumen, setDokumen] = useState({ ktp: null, kk: null })
  const [signedUrls, setSignedUrls] = useState({ ktp: null, kk: null })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({ ktp: false, kk: false })
  const [errorMsg, setErrorMsg] = useState({ ktp: '', kk: '' })

  async function loadDokumen() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('dokumen')
        .select('*')
        .eq('warga_id', profile.id)
      if (error) throw error

      const map = { ktp: null, kk: null }
      const urls = { ktp: null, kk: null }

      if (data) {
        data.forEach((d) => { map[d.jenis_dokumen] = d })

        // Dapatkan signed URL untuk pratinjau file privat
        await Promise.all(
          data.map(async (d) => {
            const { data: urlData, error: urlErr } = await supabase.storage
              .from(DOKUMEN_BUCKET)
              .createSignedUrl(d.file_path, 3600)
            if (!urlErr && urlData) {
              urls[d.jenis_dokumen] = urlData.signedUrl
            }
          })
        )
      }
      setDokumen(map)
      setSignedUrls(urls)
    } catch (err) {
      console.error('Gagal memuat dokumen:', err.message)
      setDokumen({ ktp: null, kk: null })
      setSignedUrls({ ktp: null, kk: null })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDokumen()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  async function handleUpload(jenis, file) {
    setErrorMsg((m) => ({ ...m, [jenis]: '' }))

    const check = isValidFile(file)
    if (!check.ok) {
      setErrorMsg((m) => ({ ...m, [jenis]: check.message }))
      return
    }

    setUploading((u) => ({ ...u, [jenis]: true }))

    try {
      const compressed = await compressImage(file)
      const ext = compressed.type === 'application/pdf' ? 'pdf' : 'jpg'
      const path = `${profile.id}/${jenis}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(DOKUMEN_BUCKET)
        .upload(path, compressed, { upsert: true, contentType: compressed.type })

      if (uploadError) throw uploadError

      const { error: upsertError } = await supabase
        .from('dokumen')
        .upsert(
          { warga_id: profile.id, jenis_dokumen: jenis, file_path: path },
          { onConflict: 'warga_id,jenis_dokumen' }
        )

      if (upsertError) throw upsertError

      await loadDokumen()
    } catch (err) {
      setErrorMsg((m) => ({ ...m, [jenis]: 'Gagal mengunggah: ' + err.message }))
    } finally {
      setUploading((u) => ({ ...u, [jenis]: false }))
    }
  }

  async function handleView(path) {
    const { data, error } = await supabase.storage
      .from(DOKUMEN_BUCKET)
      .createSignedUrl(path, 60)
    if (!error && data?.signedUrl) {
      window.open(data.signedUrl, '_blank', 'noopener')
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 80 }} />
      </div>
    )
  }

  return (
    <div>
      {['ktp', 'kk'].map((jenis) => {
        const doc = dokumen[jenis]
        return (
          <div className="card" key={jenis}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{JENIS_LABEL[jenis]}</h3>
              {doc && <StatusBadge status={doc.status} />}
            </div>
            <div className="spacer" />

            {errorMsg[jenis] && <div className="alert error">{errorMsg[jenis]}</div>}

            {doc?.status === 'rejected' && doc.catatan_admin && (
              <div className="alert error">Alasan ditolak: {doc.catatan_admin}</div>
            )}

            {doc && signedUrls[jenis] && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  border: '1px solid var(--line)',
                  maxHeight: 300,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#f8f9fa',
                  position: 'relative'
                }}>
                  {doc.file_path.toLowerCase().endsWith('.pdf') ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', width: '100%' }}>
                      <span style={{ fontSize: '32px', display: 'block', marginBottom: 8 }}>📄</span>
                      <p className="muted" style={{ margin: '0 0 12px 0', fontSize: '13px' }}>Dokumen berformat PDF</p>
                      <button type="button" className="btn secondary small" style={{ width: 'auto' }} onClick={() => handleView(doc.file_path)}>
                        Buka PDF di Tab Baru
                      </button>
                    </div>
                  ) : (
                    <img
                      src={signedUrls[jenis]}
                      alt={`Pratinjau ${JENIS_LABEL[jenis]}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: 300,
                        objectFit: 'contain',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleView(doc.file_path)}
                      title="Klik untuk memperbesar gambar"
                    />
                  )}
                </div>
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <small className="muted">Klik gambar untuk melihat resolusi penuh</small>
                  <button type="button" className="btn link small" style={{ padding: 0, width: 'auto', textDecoration: 'underline', color: 'var(--accent)' }} onClick={() => handleView(doc.file_path)}>
                    Buka Ukuran Penuh
                  </button>
                </div>
              </div>
            )}

            <div className="upload-box">
              <p className="muted" style={{ marginBottom: 10 }}>
                {doc ? 'Unggah ulang jika dokumen ditolak atau ingin diperbarui.' : `Belum ada ${JENIS_LABEL[jenis]} yang diunggah.`}
              </p>
              <label className="btn accent">
                {uploading[jenis] ? 'Mengunggah...' : `Pilih Foto ${JENIS_LABEL[jenis]}`}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={uploading[jenis]}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(jenis, file)
                    e.target.value = ''
                  }}
                />
              </label>
              <div className="spacer" />
              <small className="muted">Foto akan dikecilkan otomatis agar hemat kuota. Maks 3MB sebelum dikompres.</small>
            </div>
          </div>
        )
      })}
    </div>
  )
}
