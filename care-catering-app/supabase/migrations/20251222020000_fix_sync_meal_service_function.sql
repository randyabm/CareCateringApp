-- Fix sync_meal_service_to_diet_code function to remove updated_at reference
-- The diet_codes table doesn't have an updated_at column, so we need to remove it from the UPDATE statement

CREATE OR REPLACE FUNCTION sync_meal_service_to_diet_code()
RETURNS TRIGGER AS $$
DECLARE
    diet_code_id BIGINT;
BEGIN
    -- Check if a diet_code already exists for this meal service (by code)
    SELECT id INTO diet_code_id
    FROM diet_codes
    WHERE code = NEW.code AND category = 'meal_service';
    
    IF diet_code_id IS NOT NULL THEN
        -- Update existing diet_code (removed updated_at since diet_codes table doesn't have this column)
        UPDATE diet_codes
        SET 
            name = NEW.name,
            description = NEW.description,
            is_active = NEW.is_active
        WHERE id = diet_code_id;
    ELSE
        -- Insert new diet_code
        INSERT INTO diet_codes (code, name, category, description, is_active)
        VALUES (NEW.code, NEW.name, 'meal_service', NEW.description, NEW.is_active);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

