-- Add opening_stock context for BOM / item opening balance lots
ALTER TABLE batch_generator_rules
  MODIFY context ENUM('general','kit_assembly','kit_disassembly','opening_stock') NOT NULL DEFAULT 'general';
