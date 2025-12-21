-- Add bed_number to report_orders_summary view
-- This allows displaying bed number directly in the order history table

DROP VIEW IF EXISTS report_orders_summary;
CREATE VIEW report_orders_summary AS
SELECT
    o.id as order_id,
    o.created_at,
    o.updated_at,
    o.location_id,
    l.name as location_name,
    o.user_id,
    prof.full_name as user_name,
    o.requested_by,
    o.type,
    o.status,
    cd.bed_number,
    coalesce(sum(oi.quantity), 0) as total_quantity,
    count(distinct oi.id) as items_count,
    array_remove(array_agg(distinct pc.name), null) as category_names
FROM orders o
LEFT JOIN order_items oi on oi.order_id = o.id
LEFT JOIN products p on p.id = oi.product_id
LEFT JOIN product_categories pc on pc.id = p.category_id
LEFT JOIN locations l on l.id = o.location_id
LEFT JOIN profiles prof on prof.id = o.user_id
LEFT JOIN catering_details cd on cd.order_id = o.id
GROUP BY o.id, o.created_at, o.updated_at, o.location_id, l.name, o.user_id, prof.full_name, o.requested_by, o.type, o.status, cd.bed_number;

