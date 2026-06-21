// Mengecilkan foto KTP/KK di sisi browser SEBELUM diupload.
// Ini penting untuk target pengguna dengan internet HP yang lambat:
// foto kamera HP biasanya 3-8MB, setelah dikompres bisa < 400KB
// tanpa mengurangi keterbacaan teks di dokumen.

export async function compressImage(file, { maxWidth = 1280, quality = 0.72 } = {}) {
  // PDF tidak perlu (jarang dipakai) — langsung dikembalikan apa adanya.
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, width, height)

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )

  if (!blob) return file // fallback kalau browser tidak mendukung toBlob

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg'
  })
}
