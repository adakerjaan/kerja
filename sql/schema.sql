-- APLIKASI TASK WORKER / RATING
-- Jalankan file ini di Supabase SQL Editor.
-- Setelah itu buat user admin di Supabase Auth, lalu insert profile admin sesuai auth_user_id.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  nama text not null,
  email text,
  no_hp text,
  e_money text,
  role text not null default 'worker' check (role in ('admin','worker')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  instruction text,
  target_link text,
  reward_amount numeric not null default 0,
  quota integer not null default 1,
  deadline date,
  status text not null default 'active' check (status in ('active','inactive','closed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.task_claims (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','cancelled')),
  claimed_at timestamptz default now(),
  unique(task_id, worker_id)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  claim_id uuid not null references public.task_claims(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  screenshot_url text,
  result_note text,
  proof_link text,
  status text not null default 'submitted' check (status in ('submitted','revision','rejected','approved')),
  admin_note text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  unique(claim_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid unique not null references public.submissions(id) on delete cascade,
  worker_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','paid')),
  paid_at timestamptz,
  paid_by uuid references public.profiles(id),
  payment_note text,
  created_at timestamptz default now()
);

-- Helper agar policy tidak recursive
create or replace function public.my_profile_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.is_worker_active()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid()
      and role = 'worker'
      and status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_claims enable row level security;
alter table public.submissions enable row level security;
alter table public.payments enable row level security;

-- PROFILES
create policy "profiles_select_own_or_admin" on public.profiles
for select using (public.is_admin() or auth_user_id = auth.uid());

create policy "profiles_admin_update" on public.profiles
for update using (public.is_admin()) with check (public.is_admin());

-- Insert profile worker dilakukan via Cloudflare Function pakai service role.

-- TASKS
create policy "tasks_select_active_or_admin" on public.tasks
for select using (public.is_admin() or status = 'active');

create policy "tasks_admin_insert" on public.tasks
for insert with check (public.is_admin());

create policy "tasks_admin_update" on public.tasks
for update using (public.is_admin()) with check (public.is_admin());

create policy "tasks_admin_delete" on public.tasks
for delete using (public.is_admin());

-- TASK CLAIMS
create policy "claims_select_own_or_admin" on public.task_claims
for select using (public.is_admin() or worker_id = public.my_profile_id());

create policy "claims_worker_insert_own" on public.task_claims
for insert with check (public.is_worker_active() and worker_id = public.my_profile_id());

create policy "claims_worker_update_own_or_admin" on public.task_claims
for update using (public.is_admin() or worker_id = public.my_profile_id())
with check (public.is_admin() or worker_id = public.my_profile_id());

-- SUBMISSIONS
create policy "submissions_select_own_or_admin" on public.submissions
for select using (public.is_admin() or worker_id = public.my_profile_id());

create policy "submissions_worker_insert_own" on public.submissions
for insert with check (public.is_worker_active() and worker_id = public.my_profile_id());

create policy "submissions_worker_update_revision_or_admin" on public.submissions
for update using (public.is_admin() or worker_id = public.my_profile_id())
with check (public.is_admin() or worker_id = public.my_profile_id());

-- PAYMENTS
create policy "payments_select_own_or_admin" on public.payments
for select using (public.is_admin() or worker_id = public.my_profile_id());

create policy "payments_admin_insert" on public.payments
for insert with check (public.is_admin());

create policy "payments_admin_update" on public.payments
for update using (public.is_admin()) with check (public.is_admin());

-- STORAGE BUCKET
insert into storage.buckets (id, name, public)
values ('submission-screenshots', 'submission-screenshots', true)
on conflict (id) do nothing;

create policy "screenshots_select_public" on storage.objects
for select using (bucket_id = 'submission-screenshots');

create policy "screenshots_worker_upload" on storage.objects
for insert with check (
  bucket_id = 'submission-screenshots'
  and auth.role() = 'authenticated'
);

-- CONTOH MEMBUAT PROFILE ADMIN
-- 1. Buat user admin manual di Supabase Authentication.
-- 2. Ambil ID user tersebut.
-- 3. Jalankan contoh ini dengan mengganti auth_user_id dan email:
-- Jika database sudah terlanjur dibuat, jalankan ini sekali untuk menambah kolom E-money:
-- alter table public.profiles add column if not exists e_money text;

-- insert into public.profiles (auth_user_id, nama, email, role, status)
-- values ('ISI_AUTH_USER_ID_ADMIN', 'Admin', 'admin@email.com', 'admin', 'active');
