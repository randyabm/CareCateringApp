-- Remove service_time column from meal_services table
-- The order time window (order_start_time and order_end_time) is sufficient
ALTER TABLE meal_services 
DROP COLUMN IF EXISTS service_time;

