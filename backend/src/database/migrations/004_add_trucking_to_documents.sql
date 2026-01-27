-- Add trucking_operation_id to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS trucking_operation_id UUID REFERENCES trucking_operations(id) ON DELETE CASCADE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_trucking_operation ON documents(trucking_operation_id);

