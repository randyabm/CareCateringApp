-- Add new fields to catering_details table
-- Add UR Number (mandatory)
ALTER TABLE catering_details 
ADD COLUMN IF NOT EXISTS patient_ur_number TEXT;

-- Make patient_name mandatory (was optional before)
ALTER TABLE catering_details 
ALTER COLUMN patient_name SET NOT NULL;

-- Add meal service required (references diet_codes with category 'meal_service')
ALTER TABLE catering_details 
ADD COLUMN IF NOT EXISTS meal_service_required_id BIGINT REFERENCES diet_codes(id);

-- Add free text fields for allergies, intolerances, and dislikes
ALTER TABLE catering_details 
ADD COLUMN IF NOT EXISTS allergies_free_text TEXT,
ADD COLUMN IF NOT EXISTS intolerances_free_text TEXT,
ADD COLUMN IF NOT EXISTS dislikes_free_text TEXT;

-- Add 'intolerance' and 'meal_service' categories to diet_category enum if they don't exist
DO $$ 
BEGIN
    -- Check if 'intolerance' exists in enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'intolerance' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'diet_category')
    ) THEN
        ALTER TYPE diet_category ADD VALUE 'intolerance';
    END IF;
    
    -- Check if 'meal_service' exists in enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'meal_service' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'diet_category')
    ) THEN
        ALTER TYPE diet_category ADD VALUE 'meal_service';
    END IF;
END $$;

