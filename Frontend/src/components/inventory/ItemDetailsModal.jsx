import React, { useEffect, useState } from 'react';
import {
  Modal, Button, Row, Col, Card, Tag, Table, Empty, Tabs, Timeline, Spin,
} from 'antd';
import {
  EyeOutlined, InboxOutlined, HistoryOutlined, DollarOutlined, BuildOutlined,
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';
import { mapSkuMetaToVariantFormFields } from '../../utils/variantLibraryHelpers';
import { isOpeningStockReceipt, getInventoryLogReferenceDisplay } from '../../utils/inventoryReceipt';

const toTitleText = (value) => String(value || '')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (c) => c.toUpperCase());

const getVariantAttributeTokens = (row = {}) => {
  const attrs = row?.attributes && typeof row.attributes === 'object' ? row.attributes : {};
  const entries = Object.entries(attrs)
    .filter(([key, value]) => key && key !== '_imsKey' && String(value || '').trim());

  if (entries.length > 0) {
    return entries.map(([key, value]) => ({
      label: toTitleText(key),
      value: String(value).trim(),
    }));
  }

  const label = String(row?.combinationLabel || row?.variant_name || '').trim();
  if (!label) return [];

  return label
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const [left, ...rest] = segment.split(':');
      if (rest.length === 0) return { label: 'Variant', value: left.trim() };
      return {
        label: toTitleText(left),
        value: rest.join(':').trim(),
      };
    });
};

const getItemStatusTagColor = (status) => {
  if (status === 'active') return 'success';
  if (status === 'inactive') return 'warning';
  if (status === 'trashed') return 'default';
  return 'error';
};

const fulfillmentLabel = (mode) => (
  mode === 'explode_on_ship' ? 'Explode on ship' : 'Pre-built'
);

const consumptionLabel = (timing, kitFulfillmentMode) => {
  const isExplode = String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';
  if (!isExplode) return 'At assembly';
  return String(timing || 'shipment').toLowerCase() === 'order' ? 'At order' : 'At shipment';
};

const looksLikeUuid = (value) => (
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
);

const resolveComponentUnit = (component) => {
  if (component?.unit_name) return component.unit_name;
  const raw = component?.unit;
  if (raw && !looksLikeUuid(raw)) return raw;
  return '—';
};

const resolveComponentSize = (component) => {
  if (component?.component_size) return component.component_size;
  const cf = component?.custom_fields;
  if (cf && typeof cf === 'object') {
    const skuMeta = cf.skuMeta && typeof cf.skuMeta === 'object' ? cf.skuMeta : {};
    const pick = (val) => {
      if (val == null || val === '') return null;
      if (Array.isArray(val)) return val.filter(Boolean).join(', ') || null;
      return String(val).trim() || null;
    };
    return pick(skuMeta.size) || pick(cf.size) || pick(cf.Size) || '—';
  }
  return component?.size || '—';
};

const normalizeBomComponents = (item) => (
  Array.isArray(item?.composite_components) ? item.composite_components : []
).map((c, idx) => ({
  key: c.id || c.component_item_id || `component-${idx}`,
  itemId: c.component_item_id || c.itemId,
  name: c.component_name || c.name || '—',
  sku: c.sku || '—',
  unit: resolveComponentUnit(c),
  size: resolveComponentSize(c),
  quantityRequired: Number(c.quantity_required ?? c.quantityRequired ?? 0),
  consumptionTiming: c.consumption_timing || c.consumptionTiming || 'shipment',
}));

const ItemDetailsModal = ({ open, item, onClose }) => {
  const { currency } = useCurrency();
  const [viewingItem, setViewingItem] = useState(null);
  const [itemHistory, setItemHistory] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [viewingItemBatches, setViewingItemBatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item?.id) {
      setViewingItem(null);
      setItemHistory([]);
      setPriceHistory([]);
      setViewingItemBatches([]);
      return undefined;
    }

    let cancelled = false;
    setViewingItem(item);
    setLoading(true);

    (async () => {
      try {
        const [itemRes, historyRes, priceHistRes, batchesRes] = await Promise.allSettled([
          apiService.get(`/items/${item.id}`),
          apiService.get(`/inventory/item-logs/${item.id}`),
          apiService.get(`/items/${item.id}/price-history`),
          apiService.getBatches({ itemId: item.id }),
        ]);

        if (cancelled) return;

        setViewingItem(itemRes.status === 'fulfilled' && itemRes.value.success ? itemRes.value.data : item);
        setItemHistory(historyRes.status === 'fulfilled' && historyRes.value.success ? historyRes.value.data || [] : []);
        setPriceHistory(priceHistRes.status === 'fulfilled' && priceHistRes.value.success ? priceHistRes.value.data || [] : []);
        setViewingItemBatches(batchesRes.status === 'fulfilled' ? (batchesRes.value?.data || []) : []);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch item details:', error);
          setViewingItem(item);
          setItemHistory([]);
          setPriceHistory([]);
          setViewingItemBatches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, item]);

  const handleClose = () => {
    setViewingItem(null);
    setItemHistory([]);
    setPriceHistory([]);
    setViewingItemBatches([]);
    onClose?.();
  };

  const isComposite = String(viewingItem?.type || '').toLowerCase() === 'composite';
  const bomComponents = normalizeBomComponents(viewingItem);
  const kitFulfillmentMode = viewingItem?.kit_fulfillment_mode || viewingItem?.kitFulfillmentMode;
  const variantTags = mapSkuMetaToVariantFormFields(viewingItem?.custom_fields || {});

  return (
    <Modal
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
            <EyeOutlined />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Item Details</span>
        </div>
      )}
      open={open}
      onCancel={handleClose}
      footer={[<Button key="close" style={{ borderRadius: 10 }} onClick={handleClose}>Close</Button>]}
      width="min(1280px, 98vw)"
      style={{ top: 16 }}
      styles={{ body: { background: '#fafbff', maxHeight: '82vh', overflowY: 'auto', padding: '20px 24px' } }}
      destroyOnClose
    >
      {viewingItem && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {viewingItem.image ? (
              <img src={viewingItem.image} alt={viewingItem.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '3px solid rgba(255,255,255,0.4)' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff' }}><InboxOutlined /></div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{viewingItem.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>SKU: {viewingItem.sku}</div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Tag color={getItemStatusTagColor(viewingItem.status)} style={{ borderRadius: 20, textTransform: 'capitalize' }}>{viewingItem.status}</Tag>
                {viewingItem.type && <Tag color="blue" style={{ borderRadius: 20 }}>{viewingItem.type}</Tag>}
                {viewingItem.type !== 'service' && viewingItem.is_sellable !== 0 && viewingItem.is_sellable !== false && (
                  <Tag color="green" style={{ borderRadius: 20 }}>Sellable</Tag>
                )}
                {viewingItem.type !== 'service' && viewingItem.is_sellable === 0 && (
                  <Tag color="orange" style={{ borderRadius: 20 }}>Production only</Tag>
                )}
                {isComposite && (
                  <Tag color="geekblue" style={{ borderRadius: 20 }}>
                    <BuildOutlined /> {fulfillmentLabel(kitFulfillmentMode)}
                  </Tag>
                )}
                {viewingItem.category && <Tag color="orange" style={{ borderRadius: 20 }}>{viewingItem.category}</Tag>}
                {viewingItem.item_group_name && <Tag color="purple" style={{ borderRadius: 20 }}>{viewingItem.item_group_name}</Tag>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Selling Price', val: viewingItem.selling_price ? formatPrice(viewingItem.selling_price, currency, 'USD') : '—' },
                {
                  label: 'On Hand',
                  val: (() => {
                    const s = viewingItem.current_stock || 0;
                    return s % 1 === 0 ? Math.floor(s) : s.toFixed(2);
                  })(),
                },
              ].map((x) => (
                <div key={x.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{x.val}</div>
                  <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{x.label}</div>
                </div>
              ))}
            </div>
          </div>

          <Row gutter={16}>
            {[
              [
                ['Item Type', viewingItem.type ? String(viewingItem.type).replace(/_/g, ' ') : 'N/A'],
                ['Variant / Packing', variantTags.variant || 'N/A'],
                ['Colour', variantTags.colorCode || 'N/A'],
                ['Size', variantTags.sizeCode || 'N/A'],
                ['Pack Type', variantTags.packType || 'N/A'],
                ['Cost Price', viewingItem.cost_price ? formatPrice(viewingItem.cost_price, currency, 'USD') : 'N/A'],
                ['MRP', viewingItem.mrp ? formatPrice(viewingItem.mrp, currency, 'USD') : 'N/A'],
                ['Tax Rate', viewingItem.tax_rate ? `${viewingItem.tax_rate}%` : 'N/A'],
                ['Unit', viewingItem.unit || 'N/A'],
                ['Item Group', viewingItem.item_group_name || 'N/A'],
                ['Brand', viewingItem.brand || 'N/A'],
                ['Manufacturer', viewingItem.manufacturer || 'N/A'],
              ],
              [
                ['Status', <Tag color={getItemStatusTagColor(viewingItem.status)} style={{ borderRadius: 20, marginInlineEnd: 0, textTransform: 'capitalize' }}>{viewingItem.status || 'N/A'}</Tag>],
                ['Min Stock', viewingItem.min_stock_level ?? 'N/A'],
                ['Max Stock', viewingItem.max_stock_level ?? 'N/A'],
                ['Opening Stock', viewingItem.opening_stock ?? 'N/A'],
                ['Valuation', viewingItem.valuation_method || 'N/A'],
                ['HSN Code', viewingItem.hsn_code || 'N/A'],
                ['Barcode', viewingItem.barcode || 'N/A'],
              ],
              [
                ['Batch Number', viewingItem.batch_number || 'N/A'],
                ['UPC', viewingItem.upc || 'N/A'],
                ['EAN', viewingItem.ean || 'N/A'],
                ['ISBN', viewingItem.isbn || 'N/A'],
                ['MPN', viewingItem.mpn || 'N/A'],
                ['Weight', viewingItem.weight ? `${viewingItem.weight} ${viewingItem.weight_unit || 'kg'}` : 'N/A'],
                ['Dimensions', viewingItem.dimensions ? `${viewingItem.dimensions.length || 0}×${viewingItem.dimensions.width || 0}×${viewingItem.dimensions.height || 0}` : 'N/A'],
              ],
            ].map((group, gi) => (
              <Col xs={24} sm={8} key={gi}>
                <Card variant="borderless" style={{ borderRadius: 12, background: '#fff', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', marginBottom: 12 }} styles={{ body: { padding: '14px 18px' } }}>
                  {group.map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                      <span style={{ color: '#8c8c8c' }}>{label}</span>
                      <span style={{ fontWeight: 600, color: '#1a1a2e', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-word' }}>{val}</span>
                    </div>
                  ))}
                </Card>
              </Col>
            ))}
          </Row>

          {viewingItem.description && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '12px 18px', marginBottom: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', fontSize: 13, color: '#595959' }}>
              <strong>Description:</strong> {viewingItem.description}
            </div>
          )}

          {isComposite && (
            <Card
              size="small"
              title={(
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span><BuildOutlined /> BOM Components</span>
                  <Tag color="purple" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    {bomComponents.length} component{bomComponents.length === 1 ? '' : 's'}
                  </Tag>
                </div>
              )}
              style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}
              styles={{ body: { paddingTop: 8 } }}
            >
              {bomComponents.length === 0 ? (
                <Empty description="No BOM components defined for this finished product" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Table
                  size="small"
                  rowKey="key"
                  dataSource={bomComponents}
                  pagination={{ pageSize: 8, size: 'small', hideOnSinglePage: true }}
                  scroll={{ x: 820 }}
                  columns={[
                    {
                      title: 'Component',
                      key: 'component',
                      render: (_, row) => (
                        <div>
                          <div style={{ fontWeight: 600, color: '#1a1a2e' }}>{row.name}</div>
                          <div style={{ fontSize: 12, color: '#8c8c8c', fontFamily: 'monospace' }}>{row.sku}</div>
                        </div>
                      ),
                    },
                    {
                      title: 'Qty per unit',
                      dataIndex: 'quantityRequired',
                      key: 'quantityRequired',
                      width: 110,
                      render: (v) => <strong>{Number(v)}</strong>,
                    },
                    { title: 'Size', dataIndex: 'size', key: 'size', width: 90, render: (v) => v || '—' },
                    { title: 'Unit', dataIndex: 'unit', key: 'unit', width: 90, render: (v) => v || '—' },
                    {
                      title: 'Consumption',
                      dataIndex: 'consumptionTiming',
                      key: 'consumptionTiming',
                      width: 140,
                      render: (v) => {
                        const isExplode = String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';
                        const label = consumptionLabel(v, kitFulfillmentMode);
                        return (
                          <Tag
                            color={!isExplode ? 'purple' : (String(v).toLowerCase() === 'order' ? 'orange' : 'blue')}
                            style={{ borderRadius: 20, marginInlineEnd: 0 }}
                          >
                            {label}
                          </Tag>
                        );
                      },
                    },
                  ]}
                />
              )}
            </Card>
          )}

          <Card
            size="small"
            title={(
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <span>Warehouse Batches</span>
                <Tag color="purple" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                  {viewingItemBatches.length} batch{viewingItemBatches.length === 1 ? '' : 'es'}
                </Tag>
              </div>
            )}
            style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}
            styles={{ body: { paddingTop: 8 } }}
          >
            {viewingItemBatches.length === 0 ? (
              <Empty description="No warehouse batches recorded for this item" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <Table
                size="small"
                rowKey="id"
                dataSource={viewingItemBatches}
                pagination={{ pageSize: 5, size: 'small', hideOnSinglePage: true }}
                scroll={{ x: 720 }}
                columns={[
                  { title: 'Batch #', dataIndex: 'batch_number', key: 'batch_number', width: 130, ellipsis: true },
                  { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 140, ellipsis: true },
                  { title: 'Received', dataIndex: 'quantity_received', key: 'quantity_received', width: 90, render: (v) => parseFloat(v || 0).toFixed(2) },
                  {
                    title: 'Available',
                    key: 'quantity_remaining',
                    width: 90,
                    render: (_, row) => {
                      const remaining = parseFloat(row.quantity_remaining ?? row.quantity_available ?? 0);
                      const color = remaining <= 0 ? 'default' : remaining <= 10 ? 'orange' : 'green';
                      return <Tag color={color}>{remaining.toFixed(2)}</Tag>;
                    },
                  },
                  { title: 'Manufacture Date', dataIndex: 'manufacture_date', key: 'manufacture_date', width: 120, render: (v) => (v ? new Date(v).toLocaleDateString() : '-') },
                  { title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry_date', width: 120, render: (v) => (v ? new Date(v).toLocaleDateString() : '-') },
                  { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: (v) => <Tag color={v === 'active' ? 'green' : v === 'expired' ? 'red' : 'orange'}>{v?.toUpperCase()}</Tag> },
                ]}
              />
            )}
          </Card>

          {String(viewingItem.type || '').toLowerCase() === 'variant' && (
            <Card
              size="small"
              title={(
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <span>Variant Details</span>
                  <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                    {(Array.isArray(viewingItem.variant_rows) && viewingItem.variant_rows.length > 0
                      ? viewingItem.variant_rows.length
                      : (Array.isArray(viewingItem?.custom_fields?.variantMatrix) ? viewingItem.custom_fields.variantMatrix.length : 0)
                    ) || 0} variants
                  </Tag>
                </div>
              )}
              style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}
              styles={{ body: { paddingTop: 8 } }}
            >
              {(() => {
                const rows = Array.isArray(viewingItem.variant_rows) && viewingItem.variant_rows.length > 0
                  ? viewingItem.variant_rows
                  : (Array.isArray(viewingItem?.custom_fields?.variantMatrix) ? viewingItem.custom_fields.variantMatrix : []);
                if (!rows.length) {
                  return <Empty description="No variant rows available" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
                }
                return (
                  <Table
                    size="middle"
                    rowKey={(row, idx) => row.id || row.key || `${row.sku || 'variant'}-${idx}`}
                    dataSource={rows}
                    bordered={false}
                    scroll={{ x: 760 }}
                    style={{ border: '1px solid #f0f3f8', borderRadius: 12, overflow: 'hidden' }}
                    rowClassName={(_, idx) => (idx % 2 === 0 ? 'table-row-light' : 'table-row-dark')}
                    pagination={{ pageSize: 6, size: 'small', hideOnSinglePage: true, position: ['bottomRight'], style: { margin: '12px 12px 0 0' } }}
                    columns={[
                      {
                        title: 'Variant',
                        key: 'variant',
                        width: 360,
                        render: (_, row) => {
                          const tokens = getVariantAttributeTokens(row);
                          const primaryLabel = String(row.combinationLabel || row.variant_name || '').trim();
                          return (
                            <div>
                              {tokens.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {tokens.map((token, tokenIdx) => (
                                    <Tag key={`${token.label}-${token.value}-${tokenIdx}`} color="blue" style={{ borderRadius: 999, marginInlineEnd: 0, paddingInline: 10, borderColor: '#d6e4ff', background: '#f5f9ff', color: '#1d39c4' }}>
                                      <span style={{ fontWeight: 600 }}>{token.label}</span>: {token.value}
                                    </Tag>
                                  ))}
                                </div>
                              )}
                              {tokens.length === 0 && (
                                <div style={{ fontWeight: 600, color: '#1f2937' }}>{primaryLabel || 'Unnamed variant'}</div>
                              )}
                            </div>
                          );
                        },
                      },
                      {
                        title: 'Child SKU',
                        key: 'sku',
                        width: 120,
                        render: (_, row) => row.sku ? (
                          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: '#f3f4f6', border: '1px solid #e5e7eb', fontFamily: 'Consolas, monospace', fontSize: 12, color: '#111827' }}>{row.sku}</span>
                        ) : <span style={{ color: '#9ca3af' }}>-</span>,
                      },
                      { title: 'Barcode', key: 'barcode', width: 120, render: (_, row) => row.barcode || <span style={{ color: '#9ca3af' }}>-</span> },
                      {
                        title: 'Sell Price',
                        key: 'selling',
                        width: 120,
                        render: (_, row) => {
                          const val = row.sellingPrice ?? row.selling_price;
                          return val != null ? (
                            <span style={{ fontWeight: 700, color: '#1677ff' }}>{formatPrice(Number(val) || 0, currency, 'USD')}</span>
                          ) : <span style={{ color: '#9ca3af' }}>-</span>;
                        },
                      },
                      {
                        title: 'Status',
                        key: 'status',
                        width: 100,
                        render: (_, row) => {
                          const active = row.active !== undefined ? !!row.active : String(row.status || '').toLowerCase() === 'active';
                          return (
                            <Tag color={active ? 'success' : 'default'} style={{ borderRadius: 999, marginInlineEnd: 0, textTransform: 'capitalize', fontWeight: 600 }}>
                              {active ? 'active' : 'inactive'}
                            </Tag>
                          );
                        },
                      },
                    ]}
                  />
                );
              })()}
            </Card>
          )}

          <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
            ) : (
              <Tabs items={[
                {
                  key: 'transactions',
                  label: <span><HistoryOutlined /> Transaction History</span>,
                  children: itemHistory.length > 0 ? (
                    <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                      <Timeline>
                        {itemHistory.map((log, index) => {
                          const eventType = log.type || log.event_type || '';
                          const fieldChanges = Array.isArray(log.field_changes) ? log.field_changes : [];
                          const summaryText = log.summary || log.description;
                          const getEventColor = (type) => {
                            if (['PurchaseReceived', 'SaleReturned', 'SaleReservationCancelled'].includes(type)) return 'green';
                            if (['SaleShipped', 'PurchaseReturned', 'StockDamaged', 'StockExpired'].includes(type)) return 'red';
                            if (['SaleReserved'].includes(type)) return 'orange';
                            if (type === 'ADJUSTMENT') return 'blue';
                            if (['TransferIn', 'TransferOut'].includes(type)) return 'purple';
                            if (type === 'ITEM_CREATED') return 'green';
                            if (type === 'ITEM_UPDATED') return 'cyan';
                            if (type === 'ITEM_COMPONENTS_UPDATED') return 'purple';
                            if (type === 'ITEM_DELETED') return 'red';
                            return 'gray';
                          };
                          const getEventLabel = (type, logRow) => {
                            if (type === 'PurchaseReceived' && isOpeningStockReceipt(logRow)) return 'Opening Stock';
                            const labels = {
                              PurchaseReceived: 'Stock Received (PO)',
                              PurchaseReturned: 'Purchase Returned',
                              SaleReserved: 'Stock Reserved (SO)',
                              SaleShipped: 'Stock Shipped (SO)',
                              SaleReturned: 'Sale Returned',
                              SaleReservationCancelled: 'Reservation Cancelled',
                              TransferIn: 'Transfer In',
                              TransferOut: 'Transfer Out',
                              StockDamaged: 'Stock Damaged',
                              StockExpired: 'Stock Expired',
                              ADJUSTMENT: 'Stock Adjusted',
                              ITEM_CREATED: 'Item Created',
                              ITEM_UPDATED: 'Item Updated',
                              ITEM_COMPONENTS_UPDATED: 'BOM Updated',
                              ITEM_DELETED: 'Item Deleted',
                            };
                            return labels[type] || type;
                          };
                          const qty = log.quantity ?? log.quantity_change;
                          const isPositive = ['PurchaseReceived', 'TransferIn', 'SaleReturned', 'SaleReservationCancelled'].includes(eventType) || (eventType === 'ADJUSTMENT' && log.sub_type === 'increase');
                          const isNegative = ['SaleShipped', 'SaleReserved', 'TransferOut', 'PurchaseReturned', 'StockDamaged', 'StockExpired'].includes(eventType) || (eventType === 'ADJUSTMENT' && log.sub_type === 'decrease');
                          const signedQty = qty != null ? (isNegative ? -Math.abs(qty) : isPositive ? Math.abs(qty) : qty) : null;
                          const unitCost = log.details?.unitCost || log.details?.unitPrice || log.unit_cost;
                          const ref = getInventoryLogReferenceDisplay(log);
                          const notes = log.reason || log.notes;
                          return (
                            <Timeline.Item key={index} color={getEventColor(eventType)}>
                              <div style={{ marginBottom: 8 }}>
                                <Tag color={getEventColor(eventType)}>{getEventLabel(eventType, log)}</Tag>
                                <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                                  {new Date(log.timestamp || log.operation_date).toLocaleString()}
                                </span>
                              </div>
                              <div style={{ fontSize: 13 }}>
                                {log.warehouse && <div>Warehouse: <strong>{log.warehouse}</strong></div>}
                                {signedQty != null && (
                                  <div>
                                    Quantity: <strong style={{ color: signedQty >= 0 ? '#52c41a' : '#ff4d4f' }}>{signedQty > 0 ? '+' : ''}{signedQty}</strong>
                                  </div>
                                )}
                                {unitCost != null && <div>Unit Cost: <strong>{formatPrice(unitCost, currency, 'USD')}</strong></div>}
                                {fieldChanges.length > 0 && (
                                  <div style={{ marginTop: 8 }}>
                                    {fieldChanges.slice(0, 8).map((change, changeIndex) => (
                                      <div key={`${log.id || index}-field-${changeIndex}`}>
                                        {change.label}: <strong>{change.from_display}</strong>{' -> '}<strong>{change.to_display}</strong>
                                      </div>
                                    ))}
                                    {fieldChanges.length > 8 && (
                                      <div style={{ color: '#8c8c8c', fontSize: 12 }}>+{fieldChanges.length - 8} more field changes</div>
                                    )}
                                  </div>
                                )}
                                {log.performed_by?.trim() && <div style={{ color: '#8c8c8c', fontSize: 12 }}>By: {log.performed_by}</div>}
                                {ref && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Ref: {ref}</div>}
                                {summaryText && <div style={{ color: '#8c8c8c', fontSize: 12 }}>{summaryText}</div>}
                                {notes && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Notes: {notes}</div>}
                              </div>
                            </Timeline.Item>
                          );
                        })}
                      </Timeline>
                    </div>
                  ) : <Empty description="No transaction history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
                },
                {
                  key: 'price-history',
                  label: <span><DollarOutlined /> Price History</span>,
                  children: priceHistory.length > 0 ? (
                    <Table
                      size="small"
                      rowKey={(r, i) => i}
                      dataSource={priceHistory}
                      pagination={{ pageSize: 10, size: 'small' }}
                      columns={[
                        { title: 'Price Type', dataIndex: 'price_type', key: 'price_type', render: (v) => ({ cost: 'Cost Price', selling: 'Selling Price', mrp: 'MRP' }[v] || v) },
                        { title: 'Old Price', dataIndex: 'old_price', key: 'old_price', render: (v) => v != null ? formatPrice(v, currency, 'USD') : '-' },
                        {
                          title: 'New Price',
                          dataIndex: 'new_price',
                          key: 'new_price',
                          render: (v, r) => {
                            const diff = r.old_price != null ? v - r.old_price : null;
                            return (
                              <span>
                                {formatPrice(v, currency, 'USD')}
                                {diff != null && (
                                  <Tag color={diff > 0 ? 'red' : 'green'} style={{ marginLeft: 8 }}>
                                    {diff > 0 ? '+' : ''}{formatPrice(diff, currency, 'USD')}
                                  </Tag>
                                )}
                              </span>
                            );
                          },
                        },
                        { title: 'Changed By', key: 'changed_by', render: (_, r) => r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : '-' },
                        { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (v) => v || '-' },
                        { title: 'Date', dataIndex: 'effective_date', key: 'effective_date', render: (v) => v ? new Date(v).toLocaleDateString() : '-' },
                      ]}
                    />
                  ) : <Empty description="No price history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
                },
              ]}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default ItemDetailsModal;
