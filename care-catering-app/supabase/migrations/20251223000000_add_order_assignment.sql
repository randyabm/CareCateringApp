-- Add kitchen_runner role and order assignment fields
-- This allows assigning orders to store_man or kitchen_runner users

-- Add kitchen_runner to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'kitchen_runner';

-- Add assignment fields to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS assignment_type user_role;

-- Add comment to explain the fields
COMMENT ON COLUMN orders.assigned_to_user_id IS 'User assigned to handle this order (store_man or kitchen_runner)';
COMMENT ON COLUMN orders.assignment_type IS 'Type of assignment: store_man or kitchen_runner';

-- Update the report_orders_summary view to include assignment information
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
    o.assigned_to_user_id,
    o.assignment_type,
    assigned_prof.full_name as assigned_user_name,
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
LEFT JOIN profiles assigned_prof on assigned_prof.id = o.assigned_to_user_id
LEFT JOIN catering_details cd on cd.order_id = o.id
GROUP BY o.id, o.created_at, o.updated_at, o.location_id, l.name, o.user_id, prof.full_name, 
         o.requested_by, o.type, o.status, o.assigned_to_user_id, o.assignment_type, 
         assigned_prof.full_name, cd.bed_number;

-- Add RLS policy to allow admin and kitchen_staff to update assignment fields
DROP POLICY IF EXISTS "Update order assignment" ON orders;
CREATE POLICY "Update order assignment" ON orders
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen_staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role IN ('admin', 'kitchen_staff')
        )
    );

