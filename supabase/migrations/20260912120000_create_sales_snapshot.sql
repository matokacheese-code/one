create table if not exists public.sales_snapshot (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  ordered_at timestamptz not null,
  branch_id text,
  branch_name text not null,
  platform text not null check (platform in ('BOLT', 'WOLT', 'DAMEJIDLO', 'choice')),
  total numeric(14,2) not null check (total >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_snapshot_ordered_at_idx on public.sales_snapshot (ordered_at desc);
create index if not exists sales_snapshot_branch_name_idx on public.sales_snapshot (branch_name);
create index if not exists sales_snapshot_platform_idx on public.sales_snapshot (platform);

alter table public.sales_snapshot enable row level security;

drop policy if exists "Public sales dashboard can read snapshots" on public.sales_snapshot;
create policy "Public sales dashboard can read snapshots"
on public.sales_snapshot for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.sales_snapshot from anon, authenticated;
grant select on public.sales_snapshot to anon, authenticated;
