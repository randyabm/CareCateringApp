-- Allow order insertion in test mode (when user_id is null)
-- This policy allows inserting orders without authentication for testing purposes
-- It only allows insertion if user_id is null and location_id is provided

DROP POLICY IF EXISTS "Test mode insert orders" ON orders;
CREATE POLICY "Test mode insert orders" ON orders
    FOR INSERT
    WITH CHECK (
        -- Allow insertion if user_id is null (test mode) and location_id is provided
        user_id IS NULL
        AND location_id IS NOT NULL
        -- Ensure location exists
        AND EXISTS (
            SELECT 1 FROM locations
            WHERE id = location_id
        )
    );

-- Also allow order_items insertion in test mode
DROP POLICY IF EXISTS "Test mode insert order items" ON order_items;
CREATE POLICY "Test mode insert order items" ON order_items
    FOR INSERT
    WITH CHECK (
        -- Allow if the order exists and has null user_id (test mode)
        EXISTS (
            SELECT 1 FROM orders
            WHERE id = order_items.order_id
            AND user_id IS NULL
        )
    );

