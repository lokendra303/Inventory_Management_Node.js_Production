-- Structured bill-to / ship-to addresses for third-party invoices (matches sales invoice PDF).

ALTER TABLE `third_party_invoices`
  ADD COLUMN `party_addresses` json DEFAULT NULL AFTER `party_address`;
