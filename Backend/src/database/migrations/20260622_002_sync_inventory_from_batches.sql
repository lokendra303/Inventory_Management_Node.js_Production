-- Align warehouse stock with active batch totals where batches were created
-- without updating inventory_projections (manual batch / legacy data).
-- Safe to re-run.

INSERT INTO inventory_projections
  (id, institution_id, item_id, warehouse_id, quantity_on_hand, quantity_available,
   quantity_reserved, average_cost, total_value, last_movement_date, version)
SELECT UUID(), b.institution_id, b.item_id, b.warehouse_id,
       b.batch_qty, b.batch_qty, 0, 0, 0, NOW(), 1
  FROM (
    SELECT institution_id, item_id, warehouse_id, SUM(quantity_remaining) AS batch_qty
      FROM item_batches
     WHERE status = 'active'
     GROUP BY institution_id, item_id, warehouse_id
  ) b
  LEFT JOIN inventory_projections ip
    ON ip.institution_id = b.institution_id
   AND ip.item_id = b.item_id
   AND ip.warehouse_id = b.warehouse_id
 WHERE ip.id IS NULL
   AND b.batch_qty > 0;

UPDATE inventory_projections ip
INNER JOIN (
  SELECT institution_id, item_id, warehouse_id, SUM(quantity_remaining) AS batch_qty
    FROM item_batches
   WHERE status = 'active'
   GROUP BY institution_id, item_id, warehouse_id
) b ON ip.institution_id = b.institution_id
   AND ip.item_id = b.item_id
   AND ip.warehouse_id = b.warehouse_id
   SET ip.quantity_on_hand = GREATEST(ip.quantity_on_hand, b.batch_qty),
       ip.quantity_available = GREATEST(ip.quantity_available, b.batch_qty),
       ip.last_movement_date = NOW()
 WHERE b.batch_qty > ip.quantity_on_hand;
