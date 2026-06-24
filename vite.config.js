import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Konfigurasi Vite dibuat sesederhana mungkin.
// Tidak ada plugin tambahan yang tidak perlu, supaya bundle tetap kecil
// dan cepat diakses dari koneksi HP yang lambat.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2018',
    sourcemap: false,
    chunkSizeWarningLimit: 600
  }
})
