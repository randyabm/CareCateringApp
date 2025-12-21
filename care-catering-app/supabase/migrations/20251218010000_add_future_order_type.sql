-- Add future_order to order_type enum for future orders workflow
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'order_type'
          AND e.enumlabel = 'future_order'
    ) THEN
        ALTER TYPE order_type ADD VALUE 'future_order';
    END IF;
END
$$;


