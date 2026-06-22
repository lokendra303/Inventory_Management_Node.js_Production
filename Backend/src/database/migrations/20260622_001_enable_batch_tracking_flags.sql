-- Enable batch/serial/expiry flags on items that already have batch or serial stock.
-- Safe to re-run: only updates rows where flags are still off.

UPDATE items i
INNER JOIN (
  SELECT item_id,
         institution_id,
         MAX(CASE WHEN expiry_date IS NOT NULL THEN 1 ELSE 0 END) AS has_expiry_data
    FROM item_batches
   GROUP BY item_id, institution_id
) b ON i.id = b.item_id AND i.institution_id = b.institution_id
   SET i.is_batch_tracked = 1,
       i.has_expiry = CASE WHEN b.has_expiry_data = 1 THEN 1 ELSE i.has_expiry END,
       i.updated_at = NOW()
 WHERE i.is_batch_tracked = 0 OR (b.has_expiry_data = 1 AND i.has_expiry = 0);

UPDATE items i
INNER JOIN (
  SELECT DISTINCT item_id, institution_id
    FROM item_serials
) s ON i.id = s.item_id AND i.institution_id = s.institution_id
   SET i.is_serialized = 1,
       i.updated_at = NOW()
 WHERE i.is_serialized = 0;
