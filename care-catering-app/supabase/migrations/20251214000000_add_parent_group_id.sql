-- Add parent_group_id to location_groups for hierarchical structure
ALTER TABLE location_groups
ADD COLUMN parent_group_id BIGINT REFERENCES location_groups(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_location_groups_parent_group_id ON location_groups(parent_group_id);

