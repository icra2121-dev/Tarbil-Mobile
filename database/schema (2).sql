create extension if not exists "pgcrypto";

create table if not exists producers (
  id uuid primary key default gen_random_uuid(),
  tc_no text unique,
  full_name text not null,
  phone text,
  city text,
  district text,
  village text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cbs_units (
  id uuid primary key default gen_random_uuid(),
  city text,
  district text,
  village text,
  ada_no text,
  parcel_no text,
  parcel_polygon jsonb,
  source text not null default 'cbs',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists greenhouse_units (
  id uuid primary key default gen_random_uuid(),
  cbs_unit_id uuid references cbs_units(id) on delete set null,
  producer_id uuid references producers(id) on delete set null,
  unit_no text unique not null,
  registration_no text,
  greenhouse_area numeric,
  greenhouse_polygon jsonb,
  latitude numeric,
  longitude numeric,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists unit_crops (
  id uuid primary key default gen_random_uuid(),
  greenhouse_unit_id uuid references greenhouse_units(id) on delete cascade,
  crop_name text not null,
  season text,
  planted_at date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists inspection_history (
  id uuid primary key default gen_random_uuid(),
  greenhouse_unit_id uuid references greenhouse_units(id) on delete set null,
  producer_id uuid references producers(id) on delete set null,
  inspector_user_id uuid,
  task_id uuid,
  unit_no text,
  status text not null default 'Sahada',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  result text,
  latitude numeric,
  longitude numeric,
  created_at timestamptz not null default now()
);

create table if not exists unit_crop_history (
  id uuid primary key default gen_random_uuid(),
  greenhouse_unit_id uuid references greenhouse_units(id) on delete cascade,
  crop_name text not null,
  previous_crop_name text,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  note text
);

create table if not exists ek8_reports (
  id uuid primary key default gen_random_uuid(),
  greenhouse_unit_id uuid references greenhouse_units(id) on delete set null,
  inspection_id uuid references inspection_history(id) on delete set null,
  task_id text,
  unit_no text,
  producer_name text,
  ada_no text,
  parcel_no text,
  crop_name text,
  report_payload jsonb not null default '{}'::jsonb,
  pdf_uri text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid references inspection_history(id) on delete cascade,
  greenhouse_unit_id uuid references greenhouse_units(id) on delete set null,
  file_url text not null,
  latitude numeric,
  longitude numeric,
  taken_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  image_url text not null,
  latitude numeric,
  longitude numeric,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists live_locations (
  user_id uuid primary key,
  full_name text,
  role text,
  latitude numeric not null,
  longitude numeric not null,
  heading numeric,
  accuracy numeric,
  updated_at timestamptz not null default now()
);

create table if not exists kobuks_sync_queue (
  id uuid primary key default gen_random_uuid(),
  task_id text,
  unit_no text,
  sync_type text not null,
  status text not null default 'queued',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  synced_at timestamptz
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  push_token text,
  title text not null,
  body text not null,
  task_id uuid,
  type text not null default 'task_assigned',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists cbs_units_ada_parcel_idx on cbs_units(ada_no, parcel_no);
create index if not exists greenhouse_units_unit_no_idx on greenhouse_units(unit_no);
create index if not exists unit_crops_greenhouse_unit_id_idx on unit_crops(greenhouse_unit_id);
create index if not exists inspection_history_greenhouse_unit_id_idx on inspection_history(greenhouse_unit_id);
create index if not exists ek8_reports_greenhouse_unit_id_idx on ek8_reports(greenhouse_unit_id);
create index if not exists ek8_reports_task_id_idx on ek8_reports(task_id, created_at desc);
create index if not exists photos_inspection_id_idx on photos(inspection_id);
create index if not exists task_evidence_task_id_idx on task_evidence(task_id, created_at desc);
create index if not exists live_locations_updated_at_idx on live_locations(updated_at desc);
create index if not exists kobuks_sync_queue_status_idx on kobuks_sync_queue(status, created_at desc);
create index if not exists notifications_user_id_idx on notifications(user_id, read);
