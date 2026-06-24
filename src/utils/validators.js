// Kumpulan validasi sederhana, dipakai di form registrasi & login.

export function isValidNIK(nik) {
  return /^\d{16}$/.test(String(nik || '').trim())
}

export function isValidNoKK(noKK) {
  return /^\d{16}$/.test(String(noKK || '').trim())
}

export function isValidPhone(phone) {
  if (!phone) return true // opsional
  return /^[\d+\s-]{8,15}$/.test(phone.trim())
}

// NIK -> "email semu" untuk dipakai Supabase Auth (yang mewajibkan
// format email walau kita login pakai NIK).
const AUTH_EMAIL_DOMAIN = import.meta.env.VITE_AUTH_EMAIL_DOMAIN || 'siwarga.com'

export function nikToAuthEmail(nik) {
  return `${String(nik).trim()}@${AUTH_EMAIL_DOMAIN}`
}

export function isValidFile(file, { maxSizeMB = 3, types = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] } = {}) {
  if (!file) return { ok: false, message: 'File belum dipilih.' }
  if (!types.includes(file.type)) {
    return { ok: false, message: 'Format file tidak didukung. Gunakan JPG, PNG, atau PDF.' }
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { ok: false, message: `Ukuran file maksimal ${maxSizeMB}MB.` }
  }
  return { ok: true }
}
