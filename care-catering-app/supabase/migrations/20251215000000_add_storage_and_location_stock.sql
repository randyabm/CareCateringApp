-- Storage-level stock on products and per-location stock on location_products

-- Add storage stock fields to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS storage_stock integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS storage_reorder_point integer NOT NULL DEFAULT 0;

-- Add per-location stock fields
ALTER TABLE location_products
    ADD COLUMN IF NOT EXISTS current_stock integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reorder_point integer NOT NULL DEFAULT 0;

-- Keep updated_at fresh on location_products updates
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_location_products_updated_at ON location_products;
CREATE TRIGGER trg_location_products_updated_at
BEFORE UPDATE ON location_products
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_location_products_loc_prod ON location_products(location_id, product_id);
CREATE INDEX IF NOT EXISTS idx_products_storage_stock ON products(storage_stock);

-- Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_products ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Read products" ON products
    FOR SELECT USING (auth.role() IS NOT NULL);

CREATE POLICY "Read location products" ON location_products
    FOR SELECT USING (auth.role() IS NOT NULL);

-- Allow admins or store_man to manage storage stock
CREATE POLICY "Manage product stock" ON products
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'store_man')
        )
    );

-- Allow admins or store_man to manage per-location stock
CREATE POLICY "Insert location stock" ON location_products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'store_man')
        )
    );

CREATE POLICY "Update location stock" ON location_products
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'store_man')
        )
    );

