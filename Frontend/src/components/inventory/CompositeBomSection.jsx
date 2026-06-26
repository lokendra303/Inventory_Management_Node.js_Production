import React from 'react';
import { Button, Col, Grid, InputNumber, Row, Select, Tooltip, Typography } from 'antd';
import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';
import {
  getCatalogItemById,
  resolveCatalogItemCost,
  resolveCatalogItemSize,
  resolveCatalogItemUnit,
} from '../../utils/bomCostHelpers';

const { Text: AntText } = Typography;

const BOM_FIELD_LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 22,
  lineHeight: '22px',
  marginBottom: 8,
};

const PANEL_STYLE = {
  marginBottom: 16,
  border: '1px solid #e6e8f0',
  borderRadius: 12,
  background: '#fff',
  overflow: 'hidden',
};

const CONSUMPTION_OPTIONS = [
  {
    value: 'shipment',
    label: 'At shipment',
    description: 'Deduct component stock when the finished product line is dispatched',
  },
  {
    value: 'order',
    label: 'At order',
    description: 'Reserve component stock when the sales order is confirmed',
  },
];

const consumptionOptionLabel = (value) => {
  const row = CONSUMPTION_OPTIONS.find((o) => o.value === value);
  return row?.label || 'At shipment';
};

const formatComponentTypeLabel = (type) => {
  const key = String(type || 'simple').toLowerCase();
  if (key === 'simple') return 'Simple';
  if (key === 'variant') return 'Variant';
  if (key === 'composite') return 'Composite';
  if (key === 'service') return 'Service';
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const isBomComponentItem = (itemRow, excludeItemId) => {
  const type = String(itemRow?.type || 'simple').toLowerCase();
  return itemRow?.id !== excludeItemId
    && itemRow?.status === 'active'
    && type !== 'composite'
    && type !== 'service';
};

/**
 * Bill of materials editor for composite / finished product items.
 */
export default function CompositeBomSection({
  components,
  onComponentsChange,
  catalogItems = [],
  excludeItemId,
  kitFulfillmentMode = 'prebuilt',
}) {
  const screens = Grid.useBreakpoint();
  const { currency } = useCurrency();
  const isExplodeOnShip = String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';

  const addRow = () => {
    onComponentsChange((prev) => [
      ...prev,
      { itemId: '', quantityRequired: 1, consumptionTiming: 'shipment' },
    ]);
  };

  const updateRow = (idx, patch) => {
    onComponentsChange((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx) => {
    onComponentsChange((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectableItems = catalogItems.filter((itemRow) => isBomComponentItem(itemRow, excludeItemId));

  return (
    <div style={PANEL_STYLE}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid #f0f0f0',
          fontWeight: 600,
          color: '#1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          BOM components ({components.length})
          <Tooltip title="Bill of Materials: lists each part (existing SKU) that makes up one unit of this finished product.">
            <InfoCircleOutlined style={{ color: '#94a3b8', cursor: 'help' }} />
          </Tooltip>
        </span>
        <Button
          type="primary"
          onClick={addRow}
          style={{
            fontWeight: 600,
            background: '#4f46e5',
            borderColor: '#4338ca',
            color: '#fff',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
          }}
        >
          + Add component
        </Button>
      </div>
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #f0f0f0',
          background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
          fontSize: 12,
          color: '#475569',
          lineHeight: 1.65,
        }}
      >
        <div style={{ fontWeight: 700, color: '#334155', marginBottom: 8 }}>What each field means</div>
        {isExplodeOnShip ? (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <AntText strong>Component item</AntText>
              {' — '}Pick an active inventory item (simple, variant, or custom type). Composite and service items cannot be components.
            </li>
            <li style={{ marginTop: 6 }}>
              <AntText strong>Qty per 1 unit</AntText>
              {' — '}How many units of the component are used for <AntText strong>one</AntText> finished unit sold/shipped
              (e.g. 4 screws per panel).
            </li>
            <li style={{ marginTop: 6 }}>
              <AntText strong>Consume when</AntText>
              {' — '}Only for <AntText strong>Explode on ship</AntText> products:
              <AntText strong> At order</AntText> reserves parts when the sales order is confirmed;
              <AntText strong> At shipment</AntText> deducts parts when the line is dispatched.
              No finished goods stock is kept — parts leave inventory at sale/ship time.
            </li>
          </ul>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              <AntText strong>Component item</AntText>
              {' — '}Pick an active inventory item (simple, variant, or custom type). Composite and service items cannot be components.
            </li>
            <li style={{ marginTop: 6 }}>
              <AntText strong>Qty per 1 unit</AntText>
              {' — '}How many units of each component are consumed to build <AntText strong>one</AntText> finished unit
              (e.g. 4 screws per assembled panel).
            </li>
            <li style={{ marginTop: 6 }}>
              <AntText strong>Consumption</AntText>
              {' — '}For <AntText strong>Pre-built</AntText> products, parts are deducted during{' '}
              <AntText strong>Production → Manufacturing → Assemble</AntText>, not at sales order or shipment.
              You sell finished goods stock after assembly.
            </li>
          </ul>
        )}
      </div>
      {components.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: '#64748b' }}>
          Add at least one row. Each row is one line on the BOM for this composite item.
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: '12px 14px 14px' }}>
          {components.map((row, idx) => {
            const controlTopOffset = 22 + 8;
            const deletePaddingTop = screens.sm ? controlTopOffset : 0;
            const selectedElsewhere = new Set(
              components
                .map((c, i) => (i !== idx && c.itemId ? String(c.itemId) : null))
                .filter(Boolean)
            );
            const rowOptions = selectableItems.filter(
              (itemRow) => !selectedElsewhere.has(String(itemRow.id)) || String(row.itemId) === String(itemRow.id)
            );
            const duplicateRow = row.itemId && components.some(
              (c, i) => i !== idx && String(c.itemId) === String(row.itemId)
            );
            const selectedItem = getCatalogItemById(catalogItems, row.itemId);
            const qty = Number(row.quantityRequired) || 0;
            const unitCost = selectedItem ? resolveCatalogItemCost(selectedItem) : 0;
            const lineCost = qty * unitCost;
            const metaChipStyle = {
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 999,
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: 11,
              color: '#475569',
            };
            return (
              <div
                key={`bom-${idx}`}
                style={{
                  marginBottom: idx < components.length - 1 ? 16 : 0,
                  paddingBottom: idx < components.length - 1 ? 16 : 0,
                  borderBottom: idx < components.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}
              >
                <Row gutter={16} align="top">
                  <Col xs={24} sm={11} style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div style={BOM_FIELD_LABEL_STYLE}>
                      Component item
                      <Tooltip title="Search by SKU or name. Type is shown for each option.">
                        <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                      </Tooltip>
                    </div>
                    <Select
                      showSearch
                      optionFilterProp="children"
                      value={row.itemId || undefined}
                      placeholder="Select item — part of this BOM"
                      popupMatchSelectWidth={false}
                      style={{ width: '100%', display: 'block' }}
                      size="middle"
                      onChange={(value) => updateRow(idx, { itemId: value })}
                      status={duplicateRow ? 'error' : (!row.itemId ? 'warning' : undefined)}
                    >
                      {rowOptions.map((itemRow) => (
                        <Select.Option key={itemRow.id} value={itemRow.id}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span>
                              <span style={{ fontWeight: 600 }}>{itemRow.sku}</span>
                              {' — '}
                              <span style={{ color: '#64748b' }}>{itemRow.name}</span>
                              {resolveCatalogItemSize(itemRow) !== '—' ? (
                                <span style={{ color: '#94a3b8' }}>{` · ${resolveCatalogItemSize(itemRow)}`}</span>
                              ) : null}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: '#6366f1',
                                background: '#eef2ff',
                                borderRadius: 999,
                                padding: '1px 8px',
                                flexShrink: 0,
                              }}
                            >
                              {formatComponentTypeLabel(itemRow.type)}
                            </span>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                    {duplicateRow ? (
                      <AntText type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                        Same component already on another row — use one row and increase qty, or remove this line.
                      </AntText>
                    ) : !row.itemId ? (
                      <AntText type="warning" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                        Select a component or remove this empty row before saving.
                      </AntText>
                    ) : null}
                    {selectedItem ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginTop: 8,
                        }}
                      >
                        <span style={metaChipStyle}>
                          <strong>Size:</strong> {resolveCatalogItemSize(selectedItem)}
                        </span>
                        <span style={metaChipStyle}>
                          <strong>Unit:</strong> {resolveCatalogItemUnit(selectedItem)}
                        </span>
                        <span style={metaChipStyle}>
                          <strong>Unit cost:</strong> {formatPrice(unitCost, currency, 'USD')}
                        </span>
                        <span style={{ ...metaChipStyle, background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca' }}>
                          <strong>Line cost:</strong> {formatPrice(lineCost, currency, 'USD')}
                        </span>
                      </div>
                    ) : null}
                  </Col>
                  <Col xs={12} sm={isExplodeOnShip ? 6 : 11}>
                    <div style={BOM_FIELD_LABEL_STYLE}>
                      Qty per 1 unit
                      <Tooltip title="Whole-number or fractional quantities allowed (e.g. 0.5 kg per unit).">
                        <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                      </Tooltip>
                    </div>
                    <InputNumber
                      min={0.0001}
                      step={0.0001}
                      style={{ width: '100%' }}
                      size="middle"
                      value={row.quantityRequired}
                      placeholder="e.g. 1"
                      onChange={(value) => updateRow(idx, { quantityRequired: value })}
                    />
                  </Col>
                  {isExplodeOnShip ? (
                    <Col xs={12} sm={5}>
                      <div style={BOM_FIELD_LABEL_STYLE}>
                        Consume when
                        <Tooltip title="At order: reserve parts when the sales order is confirmed. At shipment: deduct parts when the finished product line is dispatched.">
                          <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                        </Tooltip>
                      </div>
                      <Select
                        value={row.consumptionTiming || 'shipment'}
                        style={{ width: '100%', display: 'block' }}
                        size="middle"
                        onChange={(value) => updateRow(idx, { consumptionTiming: value })}
                        options={CONSUMPTION_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                      />
                    </Col>
                  ) : null}
                  <Col
                    xs={24}
                    sm={2}
                    style={{
                      flex: '0 0 auto',
                      width: 48,
                      maxWidth: screens.sm ? 48 : undefined,
                      display: 'flex',
                      justifyContent: screens.sm ? 'center' : 'flex-end',
                      paddingTop: deletePaddingTop,
                    }}
                  >
                    <Tooltip title="Remove this BOM line">
                      <Button
                        danger
                        type="text"
                        size="middle"
                        aria-label={`Remove BOM row ${idx + 1}`}
                        icon={<DeleteOutlined />}
                        onClick={() => removeRow(idx)}
                      />
                    </Tooltip>
                  </Col>
                </Row>
                {isExplodeOnShip ? (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      marginTop: 8,
                      lineHeight: 1.45,
                    }}
                  >
                    {consumptionOptionLabel(row.consumptionTiming || 'shipment')}
                    {' — '}
                    {CONSUMPTION_OPTIONS.find((o) => o.value === (row.consumptionTiming || 'shipment'))?.description}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      marginTop: 8,
                      lineHeight: 1.45,
                    }}
                  >
                    Parts for this row are consumed during manufacturing assembly, not at order or shipment.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
