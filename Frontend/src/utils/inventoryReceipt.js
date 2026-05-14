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
