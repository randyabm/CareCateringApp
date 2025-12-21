-- Vistas para reportes

drop view if exists report_stock_by_location;
drop view if exists report_stock_movements;
drop view if exists report_orders_summary;

create view report_stock_by_location as
select
    lp.location_id,
    l.name as location_name,
    l.group_id,
    lg.name as group_name,
    lp.product_id,
    p.name as product_name,
    p.unit_size,
    p.category_id,
    pc.name as category_name,
    lp.current_stock,
    lp.par_level,
    lp.reorder_point,
    lp.updated_at,
    p.storage_stock,
    p.storage_reorder_point
from location_products lp
join locations l on l.id = lp.location_id
left join location_groups lg on lg.id = l.group_id
join products p on p.id = lp.product_id
left join product_categories pc on pc.id = p.category_id;

create view report_stock_movements as
select
    oi.id as movement_id,
    oi.order_id,
    o.type as movement_type,
    o.status as order_status,
    o.location_id,
    l.name as location_name,
    oi.product_id,
    p.name as product_name,
    p.unit_size,
    p.category_id,
    pc.name as category_name,
    oi.quantity,
    o.user_id,
    prof.full_name as user_name,
    oi.created_at,
    o.created_at as order_created_at
from order_items oi
join orders o on o.id = oi.order_id
left join locations l on l.id = o.location_id
left join products p on p.id = oi.product_id
left join product_categories pc on pc.id = p.category_id
left join profiles prof on prof.id = o.user_id;

create view report_orders_summary as
select
    o.id as order_id,
    o.created_at,
    o.updated_at,
    o.location_id,
    l.name as location_name,
    o.user_id,
    prof.full_name as user_name,
    o.type,
    o.status,
    coalesce(sum(oi.quantity), 0) as total_quantity,
    count(distinct oi.id) as items_count,
    array_remove(array_agg(distinct pc.name), null) as category_names
from orders o
left join order_items oi on oi.order_id = o.id
left join products p on p.id = oi.product_id
left join product_categories pc on pc.id = p.category_id
left join locations l on l.id = o.location_id
left join profiles prof on prof.id = o.user_id
group by o.id, l.name, prof.full_name;

-- RLS y permisos para vistas de reportes
alter table orders enable row level security;
alter table order_items enable row level security;

drop policy if exists "Admin view all orders" on orders;
create policy "Admin view all orders" on orders
    for select using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role = 'admin'
        )
    );

drop policy if exists "Orders insert (authenticated)" on orders;
create policy "Orders insert (authenticated)" on orders
    for insert with check (auth.role() is not null);

drop policy if exists "Admin view order_items" on order_items;
create policy "Admin view order_items" on order_items
    for select using (
        exists (
            select 1 from profiles p
            where p.id = auth.uid() and p.role in ('admin', 'store_man')
        )
    );

drop policy if exists "Order items insert (authenticated)" on order_items;
create policy "Order items insert (authenticated)" on order_items
    for insert with check (auth.role() is not null);

drop policy if exists "Order items update (authenticated)" on order_items;
create policy "Order items update (authenticated)" on order_items
    for update using (auth.role() is not null);

