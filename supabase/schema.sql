-- =========================================================
-- SIWARGA — Skema Database Supabase
-- Jalankan file ini di: Supabase Dashboard > SQL Editor > New query
-- Aman dijalankan ulang (pakai IF NOT EXISTS / DROP ... IF EXISTS).
-- =========================================================

-- ---------------------------------------------------------
-- 1. TABEL PROFILES (data warga, 1 baris = 1 auth.users)
-- ---------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nik varchar(16) unique not null check (nik ~ '^\d{16}$'),
  no_kk varchar(16) not null check (no_kk ~ '^\d{16}$'),
  nama_lengkap text not null,
  jenis_kelamin text check (jenis_kelamin in ('Laki-laki', 'Perempuan')),
  tempat_lahir text,
  tanggal_lahir date,
  alamat text,
  rt text,
  rw text,
  agama text,
  status_perkawinan text,
  pekerjaan text,
  hubungan_keluarga text,
  no_telepon text,

  role text not null default 'warga' check (role in ('warga', 'admin')),
  status_verifikasi text not null default 'pending' check (status_verifikasi in ('pending', 'verified', 'rejected')),
  catatan_admin text,
  sudah_ganti_password boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_no_kk on public.profiles (no_kk);
create index if not exists idx_profiles_status on public.profiles (status_verifikasi);

-- ---------------------------------------------------------
-- 2. TABEL DOKUMEN (upload KTP / KK)
-- ---------------------------------------------------------
create table if not exists public.dokumen (
  id uuid primary key default gen_random_uuid(),
  warga_id uuid not null references public.profiles (id) on delete cascade,
  jenis_dokumen text not null check (jenis_dokumen in ('ktp', 'kk')),
  file_path text not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  catatan_admin text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  uploaded_at timestamptz not null default now(),

  -- satu warga hanya punya satu dokumen "aktif" per jenis (ktp / kk)
  unique (warga_id, jenis_dokumen)
);

create index if not exists idx_dokumen_warga on public.dokumen (warga_id);
create index if not exists idx_dokumen_status on public.dokumen (status);

-- ---------------------------------------------------------
-- 2.5 TABEL ANGGOTA KELUARGA (tanpa akun auth.users)
-- ---------------------------------------------------------
-- Tabel ini menyimpan data anggota keluarga yang didaftarkan oleh
-- warga terverifikasi. TIDAK memerlukan akun di auth.users sehingga
-- tidak memicu signUp/email dari Supabase Auth.
create table if not exists public.anggota_keluarga (
  id uuid primary key default gen_random_uuid(),
  didaftarkan_oleh uuid not null references public.profiles (id) on delete cascade,
  no_kk varchar(16) not null check (no_kk ~ '^\d{16}$'),
  nik varchar(16) not null check (nik ~ '^\d{16}$'),
  nama_lengkap text not null,
  jenis_kelamin text check (jenis_kelamin in ('Laki-laki', 'Perempuan')),
  tempat_lahir text,
  tanggal_lahir date,
  alamat text,
  rt text,
  rw text,
  agama text,
  status_perkawinan text,
  pekerjaan text,
  hubungan_keluarga text,
  no_telepon text,

  status_verifikasi text not null default 'pending' check (status_verifikasi in ('pending', 'verified', 'rejected')),
  catatan_admin text,
  ktp_file_path text, -- path file KTP di storage (wajib untuk Famili Lain beda KK)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_anggota_keluarga_no_kk on public.anggota_keluarga (no_kk);
create index if not exists idx_anggota_keluarga_status on public.anggota_keluarga (status_verifikasi);

-- updated_at trigger untuk anggota_keluarga
drop trigger if exists trg_anggota_keluarga_updated_at on public.anggota_keluarga;
create trigger trg_anggota_keluarga_updated_at
  before update on public.anggota_keluarga
  for each row execute function public.set_updated_at();

-- RLS untuk anggota_keluarga
alter table public.anggota_keluarga enable row level security;

drop policy if exists "anggota_keluarga_select" on public.anggota_keluarga;
create policy "anggota_keluarga_select"
  on public.anggota_keluarga for select
  using (
    didaftarkan_oleh = auth.uid()
    or no_kk = public.get_my_no_kk()
    or public.is_admin()
  );

drop policy if exists "anggota_keluarga_insert" on public.anggota_keluarga;
create policy "anggota_keluarga_insert"
  on public.anggota_keluarga for insert
  with check (
    didaftarkan_oleh = auth.uid()
    and public.is_my_profile_verified()
  );

drop policy if exists "anggota_keluarga_update_admin" on public.anggota_keluarga;
create policy "anggota_keluarga_update_admin"
  on public.anggota_keluarga for update
  using (public.is_admin());

drop policy if exists "anggota_keluarga_update_owner" on public.anggota_keluarga;
create policy "anggota_keluarga_update_owner"
  on public.anggota_keluarga for update
  using (
    didaftarkan_oleh = auth.uid()
    and public.is_my_profile_verified()
  )
  with check (
    didaftarkan_oleh = auth.uid()
    and status_verifikasi = 'pending'
    and catatan_admin is null
  );

drop policy if exists "anggota_keluarga_delete_admin" on public.anggota_keluarga;
create policy "anggota_keluarga_delete_admin"
  on public.anggota_keluarga for delete
  using (public.is_admin());


-- ---------------------------------------------------------
-- 3. FUNGSI BANTUAN
-- ---------------------------------------------------------

-- is_admin(): dipakai berulang kali di RLS. SECURITY DEFINER supaya
-- query ke tabel profiles di sini tidak terkena RLS itu sendiri
-- (mencegah infinite recursion).
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- updated_at otomatis terisi setiap kali baris profiles berubah.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Mencegah warga (non-admin) menaikkan role sendiri menjadi admin
-- atau mengubah status_verifikasi sendiri lewat request langsung ke API.
create or replace function public.guard_profiles_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.status_verifikasi := old.status_verifikasi;
    new.catatan_admin := old.catatan_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profiles_self_update on public.profiles;
create trigger trg_guard_profiles_self_update
  before update on public.profiles
  for each row execute function public.guard_profiles_self_update();

-- Mencegah warga "menyetujui sendiri" dokumennya: jika yang meng-update
-- adalah pemilik dokumen (bukan admin), status dipaksa balik ke pending
-- (dipakai untuk alur upload ulang setelah ditolak).
-- Jika admin yang meng-update dan mengubah status, verified_by/verified_at
-- diisi otomatis oleh server, bukan dari payload klien.
create or replace function public.guard_dokumen_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    if new.status is distinct from old.status and new.status in ('verified', 'rejected') then
      new.verified_by := auth.uid();
      new.verified_at := now();
    end if;
  else
    new.status := 'pending';
    new.verified_by := null;
    new.verified_at := null;
    new.catatan_admin := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_dokumen_update on public.dokumen;
create trigger trg_guard_dokumen_update
  before update on public.dokumen
  for each row execute function public.guard_dokumen_update();

-- ---------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.dokumen enable row level security;

-- PROFILES -------------------------------------------------

-- Helper untuk mengambil no_kk user saat ini tanpa memicu infinite recursion di RLS
create or replace function public.get_my_no_kk()
returns varchar
language sql
security definer
set search_path = public
stable
as $$
  select no_kk from public.profiles where id = auth.uid();
$$;

-- Helper untuk mengecek status verifikasi user saat ini tanpa memicu infinite recursion di RLS
create or replace function public.is_my_profile_verified()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select status_verifikasi = 'verified' from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin()
    or (no_kk = public.get_my_no_kk() and public.is_my_profile_verified())
  );

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert
  with check (id = auth.uid());

drop policy if exists "profiles_insert_family" on public.profiles;
create policy "profiles_insert_family"
  on public.profiles for insert
  with check (
    exists (
      select 1 from public.profiles parent
      where parent.id = auth.uid()
      and parent.no_kk = public.profiles.no_kk
      and parent.status_verifikasi = 'verified'
    )
  );

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
  on public.profiles for update
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only"
  on public.profiles for delete
  using (public.is_admin());

-- DOKUMEN --------------------------------------------------
drop policy if exists "dokumen_select_own_or_admin" on public.dokumen;
create policy "dokumen_select_own_or_admin"
  on public.dokumen for select
  using (
    warga_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.profiles target
      join public.profiles parent on parent.no_kk = target.no_kk
      where target.id = public.dokumen.warga_id
      and parent.id = auth.uid()
      and parent.status_verifikasi = 'verified'
    )
  );

drop policy if exists "dokumen_insert_own" on public.dokumen;
create policy "dokumen_insert_own"
  on public.dokumen for insert
  with check (warga_id = auth.uid());

drop policy if exists "dokumen_insert_family" on public.dokumen;
create policy "dokumen_insert_family"
  on public.dokumen for insert
  with check (
    exists (
      select 1 from public.profiles target
      join public.profiles parent on parent.no_kk = target.no_kk
      where target.id = public.dokumen.warga_id
      and parent.id = auth.uid()
      and parent.status_verifikasi = 'verified'
    )
  );

drop policy if exists "dokumen_update_own_or_admin" on public.dokumen;
create policy "dokumen_update_own_or_admin"
  on public.dokumen for update
  using (warga_id = auth.uid() or public.is_admin());

drop policy if exists "dokumen_delete_admin_only" on public.dokumen;
create policy "dokumen_delete_admin_only"
  on public.dokumen for delete
  using (public.is_admin());

-- ---------------------------------------------------------
-- 5. STORAGE BUCKET + POLICY (file KTP/KK)
-- ---------------------------------------------------------
-- Bucket dibuat PRIVATE (public = false) karena berisi data
-- pribadi sensitif (foto KTP/KK).
insert into storage.buckets (id, name, public)
values ('dokumen-warga', 'dokumen-warga', false)
on conflict (id) do nothing;

drop policy if exists "dokumen_warga_select" on storage.objects;
create policy "dokumen_warga_select"
  on storage.objects for select
  using (
    bucket_id = 'dokumen-warga'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.profiles target
        join public.profiles parent on parent.no_kk = target.no_kk
        where target.id::text = (storage.foldername(name))[1]
        and parent.id = auth.uid()
        and parent.status_verifikasi = 'verified'
      )
    )
  );

drop policy if exists "dokumen_warga_insert" on storage.objects;
create policy "dokumen_warga_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'dokumen-warga'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles target
        join public.profiles parent on parent.no_kk = target.no_kk
        where target.id::text = (storage.foldername(name))[1]
        and parent.id = auth.uid()
        and parent.status_verifikasi = 'verified'
      )
    )
  );

drop policy if exists "dokumen_warga_update" on storage.objects;
create policy "dokumen_warga_update"
  on storage.objects for update
  using (
    bucket_id = 'dokumen-warga'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "dokumen_warga_delete" on storage.objects;
create policy "dokumen_warga_delete"
  on storage.objects for delete
  using (
    bucket_id = 'dokumen-warga'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- ---------------------------------------------------------
-- 5.5 TRIGGER SINKRONISASI NIK ↔ AUTH EMAIL
-- ---------------------------------------------------------
-- Jika admin mengubah NIK warga di tabel profiles, trigger ini akan otomatis
-- mengubah email di tabel auth.users agar warga tetap bisa login menggunakan NIK baru.
create or replace function public.sync_profile_nik_to_auth_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_email text;
  domain_part text;
begin
  if new.nik <> old.nik then
    select email into current_email from auth.users where id = new.id;
    if current_email is not null and current_email like '%@%' then
      domain_part := split_part(current_email, '@', 2);
      update auth.users
      set email = new.nik || '@' || domain_part
      where id = new.id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_nik_to_auth_email on public.profiles;
create trigger trg_sync_profile_nik_to_auth_email
  after update of nik on public.profiles
  for each row execute function public.sync_profile_nik_to_auth_email();

-- ---------------------------------------------------------
-- 6. MEMBUAT AKUN ADMIN PERTAMA (jalankan manual, sekali saja)
-- ---------------------------------------------------------
-- Langkah membuat admin pertama (TIDAK bisa lewat halaman daftar warga,
-- karena form pendaftaran publik selalu membuat role='warga'):
--
-- 1. Buka Supabase Dashboard > Authentication > Users > Add user
--    Email   : 0000000000000001@siwarga.com
--              (NIK admin diikuti @ + domain sesuai VITE_AUTH_EMAIL_DOMAIN
--               di file .env — harus SAMA persis dengan yang dipakai frontend,
--               supaya admin bisa login lewat form NIK seperti warga biasa)
--    Password: tentukan sendiri, password yang kuat
--    -> centang "Auto Confirm User"
--
-- 2. Catat "User UID" yang muncul, lalu jalankan query berikut
--    (ganti UID-DARI-LANGKAH-1 dan data di bawah):
--
-- insert into public.profiles
--   (id, nik, no_kk, nama_lengkap, role, status_verifikasi, sudah_ganti_password)
-- values
--   ('UID-DARI-LANGKAH-1', '0000000000000001', '0000000000000001',
--    'Admin RT/RW', 'admin', 'verified', true);
--
-- Setelah ini, admin login di halaman /login dengan NIK "0000000000000001"
-- dan password yang ditentukan di langkah 1.


-- ---------------------------------------------------------
-- 7. FUNGSI ADMIN TAMBAHAN (RESET PASSWORD & DAFTAR MANUAL)
-- ---------------------------------------------------------

-- Function untuk Reset Password Warga ke NIK
create or replace function public.admin_reset_user_password(
  user_id uuid,
  new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  -- Pastikan hanya admin yang bisa memanggil
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat menyetel ulang password.';
  end if;

  -- Update password di auth.users menggunakan bcrypt
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf', 10)),
      updated_at = now()
  where id = user_id;

  -- Reset status agar warga wajib ganti password saat login berikutnya
  update public.profiles
  set sudah_ganti_password = false
  where id = user_id;

  return true;
end;
$$;

-- Function untuk Mendaftarkan Warga Secara Manual (Tanpa SignUp Klien)
create or replace function public.admin_create_warga_manual(
  p_nik varchar(16),
  p_no_kk varchar(16),
  p_nama_lengkap text,
  p_jenis_kelamin text,
  p_tempat_lahir text,
  p_tanggal_lahir date,
  p_alamat text,
  p_rt text,
  p_rw text,
  p_agama text,
  p_status_perkawinan text,
  p_pekerjaan text,
  p_hubungan_keluarga text,
  p_no_telepon text,
  p_email_domain text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
  v_encrypted_password text;
begin
  -- Pastikan hanya admin yang bisa memanggil
  if not public.is_admin() then
    raise exception 'Hanya admin yang dapat mendaftarkan warga secara manual.';
  end if;

  -- Format email semu
  v_email := p_nik || '@' || p_email_domain;

  -- Validasi keunikan NIK di profiles
  if exists (select 1 from public.profiles where nik = p_nik) then
    raise exception 'NIK % sudah terdaftar.', p_nik;
  end if;

  -- Validasi keunikan email di auth.users
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Email % sudah terdaftar di sistem auth.', v_email;
  end if;

  -- Generate default password = NIK
  v_encrypted_password := crypt(p_nik, gen_salt('bf', 10));

  -- Insert ke auth.users
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    role,
    aud,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    is_sso_user
  )
  values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    v_email,
    v_encrypted_password,
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false
  )
  returning id into v_user_id;

  -- Insert ke profiles langsung sebagai VERIFIED
  insert into public.profiles (
    id,
    nik,
    no_kk,
    nama_lengkap,
    jenis_kelamin,
    tempat_lahir,
    tanggal_lahir,
    alamat,
    rt,
    rw,
    agama,
    status_perkawinan,
    pekerjaan,
    hubungan_keluarga,
    no_telepon,
    role,
    status_verifikasi,
    sudah_ganti_password
  )
  values (
    v_user_id,
    p_nik,
    p_no_kk,
    p_nama_lengkap,
    p_jenis_kelamin,
    p_tempat_lahir,
    p_tanggal_lahir,
    p_alamat,
    p_rt,
    p_rw,
    p_agama,
    p_status_perkawinan,
    p_pekerjaan,
    p_hubungan_keluarga,
    p_no_telepon,
    'warga',
    'verified',
    false
  );

  return v_user_id;
end;
$$;

