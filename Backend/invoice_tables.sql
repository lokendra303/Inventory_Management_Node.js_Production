-- Create purchase_invoices table
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  institution_id VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  vendor_id VARCHAR(255),
  vendor_name VARCHAR(255),
  po_id VARCHAR(255),
  grn_id VARCHAR(255),
  invoice_date DATE NOT NULL,
  due_date DATE,
  currency VARCHAR(10) DEFAULT 'USD',
  exchange_rate DECIMAL(10,4) DEFAULT 1.0000,
  subtotal DECIMAL(15,2) DEFAULT 0.00,
  tax_amount DECIMAL(15,2) DEFAULT 0.00,
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  paid_amount DECIMAL(15,2) DEFAULT 0.00,
  balance_amount DECIMAL(15,2) DEFAULT 0.00,
  status ENUM('draft', 'posted', 'partially_paid', 'paid', 'cancelled') DEFAULT 'draft',
  reference VARCHAR(255),
  notes TEXT,
  created_by INT,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_institution_id (institution_id),
  INDEX idx_vendor_id (vendor_id),
  INDEX idx_invoice_date (invoice_date),
  INDEX idx_status (status)
);

-- Create purchase_invoice_lines table
CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  po_line_id INT,
  grn_line_id INT,
  item_id VARCHAR(255),
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15,4) NOT NULL,
  unit_cost DECIMAL(15,4) NOT NULL,
  line_total DECIMAL(15,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 0.00,
  tax_amount DECIMAL(15,2) DEFAULT 0.00,
  discount_rate DECIMAL(5,2) DEFAULT 0.00,
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_item_id (item_id)
);

-- Create invoice_payments table
CREATE TABLE IF NOT EXISTS invoice_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  institution_id VARCHAR(255) NOT NULL,
  invoice_type ENUM('purchase', 'sales') NOT NULL,
  invoice_id INT NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(100),
  reference VARCHAR(255),
  notes TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_institution_id (institution_id),
  INDEX idx_invoice_type_id (invoice_type, invoice_id),
  INDEX idx_payment_date (payment_date)
);