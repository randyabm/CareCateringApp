-- Add order time window fields to meal_services table
-- These fields define when nurses can place orders for each meal service
ALTER TABLE meal_services 
ADD COLUMN IF NOT EXISTS order_start_time TIME,
ADD COLUMN IF NOT EXISTS order_end_time TIME;

-- Add comment to explain the fields
COMMENT ON COLUMN meal_services.order_start_time IS 'Start time when orders for this meal service can be placed';
COMMENT ON COLUMN meal_services.order_end_time IS 'End time when orders for this meal service can be placed';

