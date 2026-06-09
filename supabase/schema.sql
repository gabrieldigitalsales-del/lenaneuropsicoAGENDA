-- ============================================================
-- AGENDA LENA NEUROPSICÓLOGA - SUPABASE SCHEMA ÚNICO
-- Prefixo exclusivo para não interagir com outros projetos:
-- lena_neuro_2026_
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.lena_neuro_2026_patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  birth_date date,
  age text,
  guardian_name text,
  email text,
  notes text,
  status text not null default 'ativo' check (status in ('ativo','em_avaliacao','finalizado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lena_neuro_2026_appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.lena_neuro_2026_patients(id) on delete set null,
  patient_name text not null,
  patient_phone text,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null default 50,
  service_type text not null default 'Avaliação',
  status text not null default 'agendada' check (status in ('agendada','confirmada','realizada','faltou','cancelada')),
  payment_status text not null default 'pendente' check (payment_status in ('pago','pendente','cortesia')),
  price numeric(10,2) default 200,
  room text default 'Sala 1',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lena_neuro_2026_settings (
  id text primary key default 'main',
  clinic_name text not null default 'Lena Neuropsicóloga',
  start_time text not null default '08:00',
  end_time text not null default '18:00',
  default_duration integer not null default 50,
  default_price numeric(10,2) not null default 200,
  updated_at timestamptz not null default now()
);

insert into public.lena_neuro_2026_settings (id, clinic_name, start_time, end_time, default_duration, default_price)
values ('main', 'Lena Neuropsicóloga', '08:00', '18:00', 50, 200)
on conflict (id) do nothing;

create or replace function public.lena_neuro_2026_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists lena_neuro_2026_patients_updated_at on public.lena_neuro_2026_patients;
create trigger lena_neuro_2026_patients_updated_at
before update on public.lena_neuro_2026_patients
for each row execute function public.lena_neuro_2026_set_updated_at();

drop trigger if exists lena_neuro_2026_appointments_updated_at on public.lena_neuro_2026_appointments;
create trigger lena_neuro_2026_appointments_updated_at
before update on public.lena_neuro_2026_appointments
for each row execute function public.lena_neuro_2026_set_updated_at();

alter table public.lena_neuro_2026_patients enable row level security;
alter table public.lena_neuro_2026_appointments enable row level security;
alter table public.lena_neuro_2026_settings enable row level security;

-- Políticas abertas para uso com senha simples no front-end.
-- A proteção real fica pela senha do app + URL/chaves do Supabase.
-- Para segurança mais forte, use Supabase Auth.
drop policy if exists "lena_neuro_2026_patients_all" on public.lena_neuro_2026_patients;
create policy "lena_neuro_2026_patients_all" on public.lena_neuro_2026_patients
for all using (true) with check (true);

drop policy if exists "lena_neuro_2026_appointments_all" on public.lena_neuro_2026_appointments;
create policy "lena_neuro_2026_appointments_all" on public.lena_neuro_2026_appointments
for all using (true) with check (true);

drop policy if exists "lena_neuro_2026_settings_all" on public.lena_neuro_2026_settings;
create policy "lena_neuro_2026_settings_all" on public.lena_neuro_2026_settings
for all using (true) with check (true);

create index if not exists lena_neuro_2026_appointments_date_idx on public.lena_neuro_2026_appointments(appointment_date);
create index if not exists lena_neuro_2026_appointments_patient_idx on public.lena_neuro_2026_appointments(patient_id);
create index if not exists lena_neuro_2026_patients_name_idx on public.lena_neuro_2026_patients(full_name);
