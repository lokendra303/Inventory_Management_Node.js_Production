-- Third-party invoices: distinguish sales (SI / tax invoice) vs purchase (PI).

ALTER TABLE `third_party_invoices`
  ADD COLUMN `invoice_type` enum('sales','purchase') NOT NULL DEFAULT 'sales' AFTER `invoice_number`,
  ADD KEY `idx_tpi_invoice_type` (`invoice_type`);
