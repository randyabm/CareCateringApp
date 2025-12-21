-- Announcements for store communications
create table if not exists announcements (
    id bigserial primary key,
    title text not null,
    message text not null,
    start_date date not null,
    end_date date not null,
    location_id bigint references locations(id) on delete set null,
    created_by uuid references profiles(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Keep updated_at current
create or replace function set_updated_at() returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_announcements_updated_at on announcements;
create trigger trg_announcements_updated_at
before update on announcements
for each row execute function set_updated_at();

alter table announcements enable row level security;

-- Allow admin and store_man to read
create policy "Announcements read" on announcements
    for select using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );

-- Only admin can insert/update/delete
create policy "Announcements insert" on announcements
    for insert with check (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "Announcements update" on announcements
    for update using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

create policy "Announcements delete" on announcements
    for delete using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

