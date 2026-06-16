-- Add trashed status for items (active -> inactive -> trashed lifecycle)
ALTER TABLE `items`
  MODIFY COLUMN `status` enum('active','inactive','trashed','draft') NOT NULL DEFAULT 'active';
