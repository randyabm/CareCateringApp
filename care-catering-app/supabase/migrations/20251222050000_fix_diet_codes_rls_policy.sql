-- Fix RLS policy for diet_codes to ensure admins can see all items
-- This migration fixes the issue where diet codes weren't showing up

-- Drop and recreate the read policy with a corrected structure
DROP POLICY IF EXISTS "Read diet codes" ON diet_codes;

-- Create separate policies for better clarity and to ensure they work correctly
-- Policy 1: Admins can see all diet codes (including deleted)
CREATE POLICY "Admin read all diet codes" ON diet_codes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy 2: Regular authenticated users can see active, non-deleted diet codes
CREATE POLICY "Users read active diet codes" ON diet_codes
    FOR SELECT
    USING (
        auth.role() IS NOT NULL
        AND is_active = true 
        AND deleted_at IS NULL
        AND NOT EXISTS (
            -- Exclude if user is admin (to avoid duplicate results)
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

