-- Create audit_logs table for comprehensive user action tracking
-- This table stores all user actions throughout the application

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  service_account_id VARCHAR(36),
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  action VARCHAR(50),
  method VARCHAR(10),
  path VARCHAR(500),
  changes JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status_code INT,
  duration INT,
  request_body JSON,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_id ON audit_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_institution_created ON audit_logs(institution_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);

-- Add foreign key constraint to institution_users table
ALTER TABLE audit_logs 
ADD CONSTRAINT fk_audit_logs_user 
FOREIGN KEY (user_id, institution_id) 
REFERENCES institution_users(id, institution_id) 
ON DELETE SET NULL;