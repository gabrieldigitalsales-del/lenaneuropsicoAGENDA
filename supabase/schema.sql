-- ============================================================
-- AGENDA LENA NEUROPSICÓLOGA - SUPABASE SCHEMA CORRIGIDO
-- Prefixo único: lena_neuro_2026_
-- Campos numéricos de 0 ao infinito e app pronto para salvar no Supabase
-- ============================================================

create extension if not exists pgcrypto;

-- Remove triggers antigos que podem bloquear atualização da função
drop trigger if exists lena_neuro_2026_patients_updated_at on public.lena_neuro_2026_patients;
drop trigger if exists lena_neuro_2026_appointments_updated_at on public.lena_neuro_2026_appointments;
drop trigger if exists lena_neuro_2026_tasks_updated_at on public.lena_neuro_2026_tasks;
drop trigger if exists trg_lena_neuro_2026_patients_updated_at on public.lena_neuro_2026_patients;
drop trigger if exists trg_lena_neuro_2026_appointments_updated_at on public.lena_neuro_2026_appointments;
drop trigger if exists trg_lena_neuro_2026_tasks_updated_at on public.lena_neuro_2026_tasks;

drop function if exists public.lena_neuro_2026_set_updated_at() cascade;

-- Pacientes
create table if not exists public.lena_neuro_2026_patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  birth_date date,
  age text,
  guardian_name text,
  email text,
  notes text,
  status text not null default 'ativo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Consultas
create table if not exists public.lena_neuro_2026_appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.lena_neuro_2026_patients(id) on delete set null,
  patient_name text not null,
  patient_phone text,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null default 50,
  service_type text not null default 'Avaliação',
  status text not null default 'agendada',
  payment_status text not null default 'pendente',
  price numeric default 0,
  room text default 'Sala 1',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Configurações
create table if not exists public.lena_neuro_2026_settings (
  id text primary key default 'main',
  clinic_name text not null default 'Lena Neuropsicóloga',
  start_time text not null default '08:00',
  end_time text not null default '18:00',
  default_duration integer not null default 50,
  default_price numeric,
  updated_at timestamptz not null default now()
);

-- Ajustes em projetos que já tinham schema antigo
alter table public.lena_neuro_2026_appointments
  alter column price type numeric,
  alter column price set default 0;

alter table public.lena_neuro_2026_settings
  alter column default_price type numeric,
  alter column default_price drop not null,
  alter column default_price drop default;

-- Regras: números nunca negativos, sem limite máximo
alter table public.lena_neuro_2026_appointments drop constraint if exists lena_neuro_2026_appointments_price_nonnegative;
alter table public.lena_neuro_2026_appointments add constraint lena_neuro_2026_appointments_price_nonnegative check (price is null or price >= 0);

alter table public.lena_neuro_2026_appointments drop constraint if exists lena_neuro_2026_appointments_duration_nonnegative;
alter table public.lena_neuro_2026_appointments add constraint lena_neuro_2026_appointments_duration_nonnegative check (duration_minutes >= 0);

alter table public.lena_neuro_2026_settings drop constraint if exists lena_neuro_2026_settings_default_price_nonnegative;
alter table public.lena_neuro_2026_settings add constraint lena_neuro_2026_settings_default_price_nonnegative check (default_price is null or default_price >= 0);

alter table public.lena_neuro_2026_settings drop constraint if exists lena_neuro_2026_settings_default_duration_nonnegative;
alter table public.lena_neuro_2026_settings add constraint lena_neuro_2026_settings_default_duration_nonnegative check (default_duration >= 0);

-- Função updated_at
create or replace function public.lena_neuro_2026_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger lena_neuro_2026_patients_updated_at
before update on public.lena_neuro_2026_patients
for each row execute function public.lena_neuro_2026_set_updated_at();

create trigger lena_neuro_2026_appointments_updated_at
before update on public.lena_neuro_2026_appointments
for each row execute function public.lena_neuro_2026_set_updated_at();

-- Configuração inicial: valor padrão fica vazio no banco; no app aparece placeholder Ex: 500
insert into public.lena_neuro_2026_settings
(id, clinic_name, start_time, end_time, default_duration, default_price)
values
('main', 'Lena Neuropsicóloga', '08:00', '18:00', 50, null)
on conflict (id) do update set
  clinic_name = excluded.clinic_name,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  default_duration = excluded.default_duration,
  default_price = excluded.default_price,
  updated_at = now();

-- RLS
alter table public.lena_neuro_2026_patients enable row level security;
alter table public.lena_neuro_2026_appointments enable row level security;
alter table public.lena_neuro_2026_settings enable row level security;

drop policy if exists "lena_neuro_2026_patients_all" on public.lena_neuro_2026_patients;
drop policy if exists "lena_neuro_2026_appointments_all" on public.lena_neuro_2026_appointments;
drop policy if exists "lena_neuro_2026_settings_all" on public.lena_neuro_2026_settings;

create policy "lena_neuro_2026_patients_all"
on public.lena_neuro_2026_patients
for all
using (true)
with check (true);

create policy "lena_neuro_2026_appointments_all"
on public.lena_neuro_2026_appointments
for all
using (true)
with check (true);

create policy "lena_neuro_2026_settings_all"
on public.lena_neuro_2026_settings
for all
using (true)
with check (true);

-- Índices
create index if not exists lena_neuro_2026_appointments_date_idx on public.lena_neuro_2026_appointments(appointment_date);
create index if not exists lena_neuro_2026_appointments_patient_idx on public.lena_neuro_2026_appointments(patient_id);
create index if not exists lena_neuro_2026_patients_name_idx on public.lena_neuro_2026_patients(full_name);
