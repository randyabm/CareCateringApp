-- Notes for general or location-scoped post-its
create table if not exists notes (
    id bigserial primary key,
    location_id bigint references locations(id) on delete set null,
    message text not null,
    color text,
    pinned boolean default false,
    resolved boolean default false,
    expires_at timestamptz,
    created_by uuid references profiles(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Ensure updated_at stays fresh
create or replace function set_updated_at() returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notes_updated_at on notes;
create trigger trg_notes_updated_at
before update on notes
for each row execute function set_updated_at();

-- Helpful indexes
create index if not exists idx_notes_location_pinned_resolved on notes(location_id, pinned, resolved);
create index if not exists idx_notes_created_at on notes(created_at);

-- RLS policies
alter table notes enable row level security;

create policy "Notes read" on notes
    for select using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );

create policy "Notes insert" on notes
    for insert with check (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );

create policy "Notes update" on notes
    for update using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );

create policy "Notes delete" on notes
    for delete using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );

