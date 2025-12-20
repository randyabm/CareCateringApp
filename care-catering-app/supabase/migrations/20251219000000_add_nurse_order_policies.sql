-- RLS policies for nurse order creation and viewing
-- This migration ensures nurses can create and view their own orders

-- Enable RLS on catering_details and order_dietary_flags if not already enabled
ALTER TABLE catering_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_dietary_flags ENABLE ROW LEVEL SECURITY;

-- Nurses can view catering_details for orders from their location
DROP POLICY IF EXISTS "Nurse view own location catering details" ON catering_details;
CREATE POLICY "Nurse view own location catering details" ON catering_details
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid()
            WHERE o.id = catering_details.order_id
            AND o.location_id = p.assigned_location_id
        )
    );

-- Store man and admin can view all catering_details
DROP POLICY IF EXISTS "Store man view all catering details" ON catering_details;
CREATE POLICY "Store man view all catering details" ON catering_details
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'store_man', 'kitchen_staff')
        )
    );

-- Nurses can insert catering_details for orders from their location
DROP POLICY IF EXISTS "Nurse insert own location catering details" ON catering_details;
CREATE POLICY "Nurse insert own location catering details" ON catering_details
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid()
            WHERE o.id = catering_details.order_id
            AND o.location_id = p.assigned_location_id
        )
    );

-- Store man and admin can insert catering_details
DROP POLICY IF EXISTS "Store man insert catering details" ON catering_details;
CREATE POLICY "Store man insert catering details" ON catering_details
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'store_man', 'kitchen_staff')
        )
    );

-- Nurses can view order_dietary_flags for orders from their location
DROP POLICY IF EXISTS "Nurse view own location dietary flags" ON order_dietary_flags;
CREATE POLICY "Nurse view own location dietary flags" ON order_dietary_flags
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid()
            WHERE o.id = order_dietary_flags.order_id
            AND o.location_id = p.assigned_location_id
        )
    );

-- Store man and admin can view all order_dietary_flags
DROP POLICY IF EXISTS "Store man view all dietary flags" ON order_dietary_flags;
CREATE POLICY "Store man view all dietary flags" ON order_dietary_flags
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'store_man', 'kitchen_staff')
        )
    );

-- Nurses can insert order_dietary_flags for orders from their location
DROP POLICY IF EXISTS "Nurse insert own location dietary flags" ON order_dietary_flags;
CREATE POLICY "Nurse insert own location dietary flags" ON order_dietary_flags
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid()
            WHERE o.id = order_dietary_flags.order_id
            AND o.location_id = p.assigned_location_id
        )
    );

-- Store man and admin can insert order_dietary_flags
DROP POLICY IF EXISTS "Store man insert dietary flags" ON order_dietary_flags;
CREATE POLICY "Store man insert dietary flags" ON order_dietary_flags
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'store_man', 'kitchen_staff')
        )
    );

-- Ensure nurses can view order_items for orders from their location
-- (This should already be covered by the report views, but let's add explicit policy)
DROP POLICY IF EXISTS "Nurse view own location order items" ON order_items;
CREATE POLICY "Nurse view own location order items" ON order_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            JOIN profiles p ON p.id = auth.uid()
            WHERE o.id = order_items.order_id
            AND o.location_id = p.assigned_location_id
        )
    );

-- Ensure nurses can view diet_codes (needed for catering form)
ALTER TABLE diet_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read diet codes" ON diet_codes;
CREATE POLICY "Read diet codes" ON diet_codes
    FOR SELECT
    USING (auth.role() IS NOT NULL);

-- Update order insert policy to ensure nurses can only insert orders for their location
DROP POLICY IF EXISTS "Nurse insert own location orders" ON orders;
CREATE POLICY "Nurse insert own location orders" ON orders
    FOR INSERT
    WITH CHECK (
        -- Allow if user is admin or store_man
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'store_man')
        )
        OR
        -- Or if user is nurse and location_id matches their assigned location
        (
            EXISTS (
                SELECT 1 FROM profiles
                WHERE id = auth.uid() AND role = 'nurse'
            )
            AND location_id IN (
                SELECT assigned_location_id FROM profiles
                WHERE id = auth.uid()
            )
        )
    );

