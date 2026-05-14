/**
 * Item create with opening stock calls receiveStock with synthetic OPENING-* refs
 * (see Backend src/modules/entity/item.service.js).
 */
export function isOpeningStockReceipt(log) {
  if (!log || typeof log !== 'object') return false;
  const d = log.details || log.event_data || {};
  const s = (v) => (v == null ? '' : String(v));
  const poId = s(d.poId);
  const grn = s(d.grnNumber);
  const poLine = s(d.poLineId);
  const ref = s(log.reference);
  return (
    poId.startsWith('OPENING-') ||
    grn.startsWith('OPENING-') ||
    poLine.includes('-OPENING') ||
    ref.startsWith('OPENING-')
  );
}

/** Omit Ref line for opening stock — backend uses OPENING-{itemId} / OPENING-{timestamp} internally. */
export function getInventoryLogReferenceDisplay(log) {
  if (!log || typeof log !== 'object') return null;
  if (isOpeningStockReceipt(log)) return null;
  const ref = log.reference ?? log.reference_number;
  if (ref == null) return null;
  const t = String(ref).trim();
  return t || null;
}
