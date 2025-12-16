-- Rounds workflow for store man location visits

create table if not exists rounds (
    id bigserial primary key,
    user_id uuid references profiles(id),
    status text not null default 'in_progress', -- in_progress, completed, cancelled
    started_at timestamptz default now(),
    finished_at timestamptz,
    notes text
);

create table if not exists round_visits (
    id bigserial primary key,
    round_id bigint references rounds(id) on delete cascade,
    location_id bigint references locations(id),
    status text not null default 'pending', -- pending, visited, skipped
    visited_at timestamptz,
    skipped_reason text
);

create table if not exists round_visit_items (
    id bigserial primary key,
    round_visit_id bigint references round_visits(id) on delete cascade,
    location_id bigint references locations(id),
    product_id bigint references products(id),
    before_stock integer,
    after_stock integer,
    quantity_delta integer,
    created_future_order boolean default false,
    created_order_id bigint references orders(id),
    created_at timestamptz default now()
);

-- Ensure item pairs reference the specific location/product entry
alter table round_visit_items
    add constraint fk_round_visit_items_loc_prod
    foreign key (location_id, product_id)
    references location_products(location_id, product_id)
    on delete cascade;

alter table rounds enable row level security;
alter table round_visits enable row level security;
alter table round_visit_items enable row level security;

-- Rounds RLS: store_man can manage their own rounds, admin can see all
create policy "Rounds read" on rounds
    for select using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
        and (
            user_id = auth.uid()
            or exists (
                select 1 from profiles p2
                where p2.id = auth.uid() and p2.role = 'admin'
            )
        )
    );

create policy "Rounds insert" on rounds
    for insert with check (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
        and user_id = auth.uid()
    );

create policy "Rounds update" on rounds
    for update using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
        and (
            user_id = auth.uid()
            or exists (
                select 1 from profiles p2
                where p2.id = auth.uid() and p2.role = 'admin'
            )
        )
    );

create policy "Rounds delete" on rounds
    for delete using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

-- Round visits/items RLS: admin and store_man
create policy "Round visits manage" on round_visits
    for all using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    )
    with check (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );

create policy "Round visit items manage" on round_visit_items
    for all using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    )
    with check (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );


