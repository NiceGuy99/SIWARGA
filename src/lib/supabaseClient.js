import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Pesan ini muncul di console saat env belum diisi —
  // membantu saat development / saat lupa set env di Vercel.
  console.error(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY belum diatur. ' +
    'Salin .env.example menjadi .env dan isi nilainya.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false
  }
})

// Nama bucket Storage tempat file KTP/KK disimpan.
export const DOKUMEN_BUCKET = 'dokumen-warga'
