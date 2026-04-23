-- Run this once in your MySQL database
-- Workflow tables for IMS SEPCUNE

CREATE TABLE IF NOT EXISTS workflow_rules (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255),
  module ENUM('inventory','sales_order','purchase_order','invoice','item') NOT NULL,
  trigger_event VARCHAR(100) NOT NULL,
  conditions JSON DEFAULT ('[]'),
  actions JSON DEFAULT ('[]'),
  is_active TINYINT(1) DEFAULT 1,
  execution_count INT DEFAULT 0,
  last_executed_at TIMESTAMP NULL,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wr_institution (institution_id),
  INDEX idx_wr_trigger (institution_id, trigger_event, is_active)
);

CREATE TABLE IF NOT EXISTS workflow_logs (
  id VARCHAR(36) PRIMARY KEY,
  rule_id VARCHAR(36) NOT NULL,
  institution_id VARCHAR(36) NOT NULL,
  trigger_data JSON,
  actions_executed JSON,
  status ENUM('success','failed','partial') DEFAULT 'success',
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_wl_institution (institution_id, executed_at),
  FOREIGN KEY (rule_id) REFERENCES workflow_rules(id) ON DELETE CASCADE
);
