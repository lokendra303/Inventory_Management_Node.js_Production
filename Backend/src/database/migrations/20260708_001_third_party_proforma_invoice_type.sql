-- Third-party invoices: add proforma (PF) alongside sales (SI) and purchase (PI).

ALTER TABLE `third_party_invoices`
  MODIFY COLUMN `invoice_type` enum('sales','purchase','proforma') NOT NULL DEFAULT 'sales';
