import React, { useState } from 'react';
import {
  Button, Checkbox, Col, Form, Grid, Input, InputNumber, Modal, Row, Select, Space, Tooltip, Typography, message,
} from 'antd';
import { DeleteOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';
import apiService from '../../services/apiService';
import {
  getCatalogItemById,
  resolveCatalogItemAvailableStock,
  resolveCatalogItemCost,
  resolveCatalogItemSize,
  resolveCatalogItemUnit,
} from '../../utils/bomCostHelpers';
import {
  convertQuantity,
  listCompatibleUnits,
  resolveItemStockUnitId,
  resolveToBase,
  unitDisplayLabel,
} from '../../utils/unitConversion';
import { formatNumber } from '../../utils/numberFormat';
import {
  bomLineToPackStockQty,
  findUnitByPackSymbol,
  itemIsBreakable,
  packCountToContentQty,
  resolveItemPackSpec,
  suggestBomLineForPackItem,
} from '../../utils/packSizeHelpers';
import { BOM_COLORS, primaryButtonStyle } from '../production/bomItemFormStyles';

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

const PANEL_STYLE_BOM = {
  ...PANEL_STYLE,
  border: `1px solid ${BOM_COLORS.border}`,
  boxShadow: '0 1px 4px rgba(15, 118, 110, 0.06)',
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
  const manufacturable = itemRow?.is_manufacturable !== 0 && itemRow?.is_manufacturable !== false;
  return itemRow?.id !== excludeItemId
    && itemRow?.status === 'active'
    && type !== 'service'
    && manufacturable;
};

const isExplodeOnShipComposite = (itemRow) => (
  String(itemRow?.type || '').toLowerCase() === 'composite'
  && String(itemRow?.kit_fulfillment_mode || itemRow?.kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship'
);

/**
 * Bill of materials editor for composite / finished product items.
 */
export default function CompositeBomSection({
  components,
  onComponentsChange,
  catalogItems = [],
  excludeItemId,
  kitFulfillmentMode = 'prebuilt',
  warehouseId = null,
  units = [],
  onUnitCreated,
  accentTheme = 'default',
}) {
  const screens = Grid.useBreakpoint();
  const { currency } = useCurrency();
  const isExplodeOnShip = String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';

  const [uomEditorOpen, setUomEditorOpen] = useState(false);
  const [uomEditorRowIdx, setUomEditorRowIdx] = useState(null);
  const [uomName, setUomName] = useState('');
  const [uomSymbol, setUomSymbol] = useState('');
  const [uomBaseUnitId, setUomBaseUnitId] = useState(null);
  const [uomFactor, setUomFactor] = useState(1);
  const [savingUom, setSavingUom] = useState(false);

  const addRow = () => {
    onComponentsChange((prev) => [
      ...prev,
      { itemId: '', quantityRequired: 1, consumptionTiming: 'shipment', consumptionUnitId: null, consumeFullPack: false },
    ]);
  };

  const updateRow = (idx, patch) => {
    onComponentsChange((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx) => {
    onComponentsChange((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectableItems = catalogItems.filter((itemRow) => isBomComponentItem(itemRow, excludeItemId));

  const handleComponentChange = (idx, itemId) => {
    const selectedItem = getCatalogItemById(catalogItems, itemId);
    const stockUnitId = resolveItemStockUnitId(selectedItem, units);
    const packSuggestion = suggestBomLineForPackItem(selectedItem, units);
    updateRow(idx, {
      itemId,
      consumptionUnitId: packSuggestion?.consumptionUnitId || stockUnitId || null,
      quantityRequired: packSuggestion?.quantityRequired ?? 1,
      consumeFullPack: !!packSuggestion?.consumeFullPack,
    });
  };

  const closeUomEditor = () => {
    setUomEditorOpen(false);
    setUomEditorRowIdx(null);
    setUomName('');
    setUomSymbol('');
    setUomBaseUnitId(null);
    setUomFactor(1);
  };

  const openUomEditor = (idx, stockUnitId) => {
    const stockUnit = (units || []).find((u) => String(u.id) === String(stockUnitId));
    const resolved = stockUnit ? resolveToBase(stockUnit, units) : null;
    const defaultBaseId = resolved?.baseId || stockUnitId || null;
    setUomEditorRowIdx(idx);
    setUomName('');
    setUomSymbol('');
    setUomBaseUnitId(defaultBaseId);
    setUomFactor(1);
    setUomEditorOpen(true);
  };

  const handleSaveCustomUom = async () => {
    const name = String(uomName || '').trim();
    if (!name) {
      message.warning('Enter a unit name');
      return;
    }
    const duplicate = (units || []).some(
      (u) => String(u.name || '').toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      message.warning(`Unit '${name}' already exists`);
      return;
    }
    if (uomBaseUnitId && (!(Number(uomFactor) > 0))) {
      message.warning('Conversion factor must be greater than 0');
      return;
    }

    setSavingUom(true);
    try {
      const symbol = String(uomSymbol || '').trim() || name.slice(0, 20);
      const factor = uomBaseUnitId ? Number(uomFactor) : 1;
      const response = await apiService.post('/units', {
        name,
        symbol,
        type: 'other',
        status: 'active',
        base_unit_id: uomBaseUnitId || null,
        conversion_factor: factor,
      });
      const created = response?.id ? response : response?.data;
      if (!created?.id) {
        message.error(response?.error || 'Failed to add unit');
        return;
      }
      const createdRow = {
        id: created.id,
        name: created.name || name,
        symbol: created.symbol || symbol,
        type: created.type || 'other',
        status: created.status || 'active',
        base_unit_id: created.base_unit_id ?? (uomBaseUnitId || null),
        conversion_factor: created.conversion_factor ?? factor,
      };
      await onUnitCreated?.(createdRow);
      if (uomEditorRowIdx != null) {
        updateRow(uomEditorRowIdx, { consumptionUnitId: createdRow.id });
      }
      message.success(`Unit '${createdRow.name}' added`);
      closeUomEditor();
    } catch (e) {
      message.error(e?.response?.data?.error || e?.userMessage || 'Failed to add unit');
    } finally {
      setSavingUom(false);
    }
  };

  const uomBaseOptions = (units || [])
    .filter((u) => u?.id)
    .map((u) => ({
      value: u.id,
      label: unitDisplayLabel(u),
    }));
  const uomBaseLabel = uomBaseOptions.find((o) => o.value === uomBaseUnitId)?.label || 'base unit';

  const isBomTheme = accentTheme === 'bom';
  const panelStyle = isBomTheme ? PANEL_STYLE_BOM : PANEL_STYLE;
  const addComponentBtnStyle = isBomTheme
    ? { fontWeight: 700, ...primaryButtonStyle }
    : {
      fontWeight: 600,
      background: '#4f46e5',
      borderColor: '#4338ca',
      color: '#fff',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
    };
  const typeBadgeStyle = isBomTheme
    ? {
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: BOM_COLORS.accentDeep,
      background: BOM_COLORS.accentSoft,
      borderRadius: 999,
      padding: '1px 8px',
      flexShrink: 0,
    }
    : {
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      color: '#6366f1',
      background: '#eef2ff',
      borderRadius: 999,
      padding: '1px 8px',
      flexShrink: 0,
    };
  const lineCostChipExtra = isBomTheme
    ? { background: BOM_COLORS.accentSoft, borderColor: BOM_COLORS.accentMuted, color: BOM_COLORS.accentDeep }
    : { background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca' };
  const subAssemblyChipExtra = isBomTheme
    ? { background: '#ecfeff', borderColor: '#a5f3fc', color: '#0e7490' }
    : { background: '#f3e8ff', borderColor: '#ddd6fe', color: '#6d28d9' };

  return (
    <div style={panelStyle}>
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${isBomTheme ? BOM_COLORS.border : '#f0f0f0'}`,
          fontWeight: 600,
          color: isBomTheme ? BOM_COLORS.charcoal : '#1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          background: isBomTheme ? 'linear-gradient(90deg, #f0fdfa 0%, #fff 40%)' : undefined,
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
          style={addComponentBtnStyle}
        >
          + Add component
        </Button>
      </div>
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${isBomTheme ? BOM_COLORS.border : '#f0f0f0'}`,
          background: isBomTheme
            ? 'linear-gradient(180deg, #f0fdfa 0%, #f8fafc 100%)'
            : 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
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
              {' — '}Pick an active inventory item (simple, variant, custom type, or another pre-built BOM sub-assembly). Service items cannot be components.
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
              {' — '}Pick an active inventory item (simple, variant, custom type, or another pre-built BOM sub-assembly). Service items cannot be components.
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
              (itemRow) => (
                (!selectedElsewhere.has(String(itemRow.id)) || String(row.itemId) === String(itemRow.id))
                && !isExplodeOnShipComposite(itemRow)
              )
            );
            const duplicateRow = row.itemId && components.some(
              (c, i) => i !== idx && String(c.itemId) === String(row.itemId)
            );
            const selectedItem = getCatalogItemById(catalogItems, row.itemId);
            const qty = Number(row.quantityRequired) || 0;
            const stockUnitId = resolveItemStockUnitId(selectedItem, units);
            const packSpec = selectedItem ? resolveItemPackSpec(selectedItem, units) : null;
            const breakable = !packSpec || itemIsBreakable(selectedItem);
            const consumeFullPack = !!(packSpec && (!breakable || row.consumeFullPack));
            const packContentUnit = packSpec ? findUnitByPackSymbol(packSpec, units) : null;
            const uomFamilyUnitId = (!consumeFullPack && packContentUnit?.id)
              ? packContentUnit.id
              : stockUnitId;
            const compatibleUnits = listCompatibleUnits(uomFamilyUnitId, units);
            const consumptionUnitId = consumeFullPack
              ? (row.consumptionUnitId || stockUnitId || null)
              : (row.consumptionUnitId || packContentUnit?.id || stockUnitId || null);
            const packStockQty = packSpec
              ? bomLineToPackStockQty(qty, {
                consumeFullPack,
                packSpec,
                consumptionUnitId,
                units,
              })
              : null;
            const convertedStockQty = (!packSpec && stockUnitId && consumptionUnitId
              && String(consumptionUnitId) !== String(stockUnitId))
              ? convertQuantity(qty, consumptionUnitId, stockUnitId, units)
              : null;
            const stockQty = packSpec
              ? (packStockQty ?? qty)
              : (convertedStockQty ?? qty);
            const availableStock = selectedItem ? resolveCatalogItemAvailableStock(selectedItem) : null;
            const availableContentTotal = (packSpec && availableStock != null)
              ? packCountToContentQty(availableStock, packSpec)
              : null;
            const packSizeAmount = packSpec?.amount || null;
            const unitCost = selectedItem ? resolveCatalogItemCost(selectedItem) : 0;
            const lineCost = stockQty * unitCost;
            const consumptionUnit = units.find((u) => String(u.id) === String(consumptionUnitId));
            const stockUnit = units.find((u) => String(u.id) === String(stockUnitId));
            const contentUnitLabel = packContentUnit
              ? unitDisplayLabel(packContentUnit)
              : (packSpec?.unitSymbol || 'content');
            const contentQtyUsed = (packSpec && !consumeFullPack && packStockQty != null && packSizeAmount)
              ? packStockQty * packSizeAmount
              : null;
            const contentRemaining = (availableContentTotal != null && contentQtyUsed != null)
              ? availableContentTotal - contentQtyUsed
              : null;
            const packsRemaining = (availableStock != null && consumeFullPack)
              ? availableStock - stockQty
              : null;
            const showConversionHint = selectedItem
              && !consumeFullPack
              && !packSpec
              && consumptionUnitId
              && stockUnitId
              && String(consumptionUnitId) !== String(stockUnitId)
              && convertedStockQty != null
              && Number.isFinite(convertedStockQty);
            const showPackHint = !!packSpec;
            const incompatibleUom = selectedItem
              && !consumeFullPack
              && consumptionUnitId
              && (
                (packSpec && packStockQty == null)
                || (!packSpec
                  && stockUnitId
                  && String(consumptionUnitId) !== String(stockUnitId)
                  && convertedStockQty == null)
              );
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
                  <Col xs={24} sm={isExplodeOnShip ? 8 : 9} style={{ flex: '1 1 0', minWidth: 0 }}>
                    <div style={BOM_FIELD_LABEL_STYLE}>
                      Component item
                      <Tooltip title="Search by SKU or name. Type is shown for each option.">
                        <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                      </Tooltip>
                    </div>
                    <Select
                      showSearch
                      optionFilterProp="searchLabel"
                      filterOption={(input, option) => {
                        const query = String(input || '').trim().toLowerCase();
                        if (!query) return true;
                        const searchLabel = String(option?.searchLabel || '').toLowerCase();
                        const valueLabel = String(option?.value || '').toLowerCase();
                        return searchLabel.includes(query) || valueLabel.includes(query);
                      }}
                      value={row.itemId || undefined}
                      placeholder="Select item — part of this BOM"
                      popupMatchSelectWidth={false}
                      style={{ width: '100%', display: 'block' }}
                      size="middle"
                      onChange={(value) => handleComponentChange(idx, value)}
                      status={duplicateRow ? 'error' : (!row.itemId ? 'warning' : undefined)}
                    >
                      {rowOptions.map((itemRow) => (
                        <Select.Option
                          key={itemRow.id}
                          value={itemRow.id}
                          searchLabel={`${itemRow.sku || ''} ${itemRow.name || ''}`}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <span>
                              <span style={{ fontWeight: 600 }}>{itemRow.sku}</span>
                              {' — '}
                              <span style={{ color: '#64748b' }}>{itemRow.name}</span>
                              {resolveCatalogItemSize(itemRow) !== '—' ? (
                                <span style={{ color: '#94a3b8' }}>{` · ${resolveCatalogItemSize(itemRow)}`}</span>
                              ) : null}
                            </span>
                            <span style={typeBadgeStyle}>
                              {formatComponentTypeLabel(itemRow.type)}
                            </span>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                    {selectedItem && isExplodeOnShipComposite(selectedItem) ? (
                      <AntText type="danger" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                        Explode-on-ship BOM items cannot be sub-assemblies. Switch that item to Pre-built or add its raw components directly.
                      </AntText>
                    ) : null}
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
                        {availableStock == null ? (
                          <span style={metaChipStyle}>
                            <strong>Available{warehouseId ? ' (WH)' : ' (active WH)'}:</strong> —
                          </span>
                        ) : packSpec ? (
                          consumeFullPack ? (
                            <>
                              <span style={metaChipStyle}>
                                <strong>Available{warehouseId ? ' (WH)' : ' (active WH)'}:</strong>{' '}
                                {formatNumber(availableStock, 4)} packs
                                <span style={{ color: '#64748b' }}>{` (${packSpec.label} each)`}</span>
                              </span>
                              {availableContentTotal != null ? (
                                <span style={metaChipStyle}>
                                  <strong>Total content:</strong>{' '}
                                  {formatNumber(availableContentTotal, 4)} {contentUnitLabel}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span style={metaChipStyle}>
                                <strong>Available{warehouseId ? ' (WH)' : ' (active WH)'}:</strong>{' '}
                                {availableContentTotal != null
                                  ? `${formatNumber(availableContentTotal, 4)} ${contentUnitLabel}`
                                  : `${formatNumber(availableStock, 4)} packs`}
                              </span>
                              <span style={metaChipStyle}>
                                <strong>Packs:</strong>{' '}
                                {formatNumber(availableStock, 4)}
                                <span style={{ color: '#64748b' }}>{` × ${packSpec.label}`}</span>
                              </span>
                            </>
                          )
                        ) : (
                          <span style={metaChipStyle}>
                            <strong>Available{warehouseId ? ' (WH)' : ' (active WH)'}:</strong>{' '}
                            {formatNumber(availableStock, 4)}
                            {stockUnit ? (
                              <span style={{ color: '#64748b' }}>{` ${unitDisplayLabel(stockUnit)}`}</span>
                            ) : null}
                          </span>
                        )}
                        <span style={{ ...metaChipStyle, ...lineCostChipExtra }}>
                          <strong>Line cost:</strong> {formatPrice(lineCost, currency, 'USD')}
                        </span>
                        {String(selectedItem.type || '').toLowerCase() === 'composite' ? (
                          <span style={{ ...metaChipStyle, ...subAssemblyChipExtra }}>
                            <strong>Sub-assembly</strong>
                          </span>
                        ) : null}
                        {packSpec ? (
                          <span style={{
                            ...metaChipStyle,
                            background: breakable ? '#ecfdf5' : '#fff7ed',
                            borderColor: breakable ? '#a7f3d0' : '#fed7aa',
                            color: breakable ? '#047857' : '#c2410c',
                          }}
                          >
                            <strong>{breakable ? 'Breakable' : 'Not breakable'}</strong>
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </Col>
                  <Col xs={12} sm={isExplodeOnShip ? 4 : 5}>
                    <div style={BOM_FIELD_LABEL_STYLE}>
                      Qty per 1 unit
                      <Tooltip title={consumeFullPack
                        ? `Full pack mode: enter how many whole packs to use. Stock pack count drops by that number.`
                        : packSpec
                          ? `Partial mode: enter amount in ${contentUnitLabel}. Deducted from total content (packs × ${packSpec.label}), not from pack count directly.`
                          : 'Enter quantity in the UOM you select. Stock is deducted in the component’s stock unit after conversion.'}>
                        <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                      </Tooltip>
                    </div>
                    <InputNumber
                      min={0.0001}
                      step={1}
                      style={{ width: '100%' }}
                      size="middle"
                      value={row.quantityRequired}
                      placeholder={consumeFullPack ? 'e.g. 1' : (packSpec ? 'e.g. 50' : 'e.g. 50')}
                      formatter={(value) => {
                        if (value === '' || value === undefined || value === null) return '';
                        const n = Number(value);
                        return Number.isFinite(n) ? formatNumber(n, 4) : String(value);
                      }}
                      parser={(value) => String(value ?? '').replace(/[^\d.-]/g, '')}
                      onChange={(value) => updateRow(idx, { quantityRequired: value })}
                    />
                    {showPackHint && consumeFullPack ? (
                      <AntText type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                        {formatNumber(qty, 4)} full pack({Number(qty) === 1 ? '' : 's'}) × {packSpec.label}
                        {availableStock != null ? (
                          <>
                            {' — packs '}
                            {formatNumber(availableStock, 4)}
                            {' → '}
                            {formatNumber(packsRemaining, 4)}
                          </>
                        ) : (
                          <> — deducts {formatNumber(stockQty, 4)} from pack count</>
                        )}
                      </AntText>
                    ) : null}
                    {showPackHint && !consumeFullPack ? (
                      <AntText type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                        {contentQtyUsed != null && availableContentTotal != null ? (
                          <>
                            {formatNumber(contentQtyUsed, 4)} {contentUnitLabel}
                            {' from '}
                            {formatNumber(availableContentTotal, 4)} {contentUnitLabel}
                            {' → '}
                            {formatNumber(contentRemaining, 4)} {contentUnitLabel} left
                            <span style={{ color: '#94a3b8' }}>{` (${packSpec.label} per pack)`}</span>
                          </>
                        ) : (
                          <>
                            {formatNumber(qty, 4)} {unitDisplayLabel(consumptionUnit) || contentUnitLabel}
                            {' deducted from total content'}
                            <span style={{ color: '#94a3b8' }}>{` (${packSpec.label} per pack)`}</span>
                          </>
                        )}
                      </AntText>
                    ) : null}
                    {showConversionHint ? (
                      <AntText type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                        {formatNumber(qty, 4)} {unitDisplayLabel(consumptionUnit) || 'UOM'}
                        {' ≈ '}
                        {formatNumber(stockQty, 4)} {unitDisplayLabel(stockUnit) || resolveCatalogItemUnit(selectedItem)} stock
                      </AntText>
                    ) : null}
                  </Col>
                  <Col xs={12} sm={isExplodeOnShip ? 4 : 5}>
                    <div style={BOM_FIELD_LABEL_STYLE}>
                      UOM
                      <Tooltip title="Consumption unit for this BOM line. Add a custom UOM linked to the same measurement family (e.g. Sachet → Grams, Box → Pieces).">
                        <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                      </Tooltip>
                    </div>
                    <Space.Compact style={{ width: '100%' }}>
                      <Select
                        showSearch
                        optionFilterProp="label"
                        disabled={!row.itemId || (packSpec && !breakable)}
                        value={consumptionUnitId || undefined}
                        placeholder={row.itemId ? 'Select UOM' : 'Pick component first'}
                        style={{ width: '100%' }}
                        size="middle"
                        status={incompatibleUom ? 'warning' : undefined}
                        labelRender={({ label, value }) => {
                          if (label && String(label) !== String(value)) return label;
                          const match = (units || []).find((u) => String(u.id) === String(value));
                          return unitDisplayLabel(match) || (value ? String(value) : '');
                        }}
                        options={(() => {
                          const pool = compatibleUnits.length > 1 ? compatibleUnits : units;
                          const seen = new Set();
                          const opts = pool
                            .filter((u) => u?.id && !seen.has(String(u.id)) && seen.add(String(u.id)))
                            .map((u) => ({
                              value: u.id,
                              label: unitDisplayLabel(u),
                            }));
                          // Keep current selection visible even when filtered out of compatible pool
                          if (consumptionUnitId && !seen.has(String(consumptionUnitId))) {
                            const orphan = (units || []).find(
                              (u) => String(u.id) === String(consumptionUnitId)
                            );
                            opts.unshift({
                              value: orphan?.id || consumptionUnitId,
                              label: unitDisplayLabel(orphan) || 'Unknown unit',
                            });
                          }
                          return opts;
                        })()}
                        onChange={(value) => updateRow(idx, { consumptionUnitId: value })}
                      />
                      <Tooltip title="Add custom UOM">
                        <Button
                          type="primary"
                          size="middle"
                          icon={<PlusOutlined />}
                          disabled={!row.itemId || (packSpec && !breakable)}
                          onClick={() => openUomEditor(idx, stockUnitId)}
                          aria-label="Add custom UOM"
                        />
                      </Tooltip>
                    </Space.Compact>
                    {incompatibleUom ? (
                      <AntText type="warning" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                        {packSpec
                          ? `Selected UOM cannot convert to pack content (${packSpec.label}). Pick ${contentUnitLabel} (or compatible).`
                          : `Selected UOM cannot convert to stock unit${stockUnit ? ` (${unitDisplayLabel(stockUnit)})` : ''}.`}
                      </AntText>
                    ) : null}
                    {packSpec ? (
                      breakable ? (
                        <Checkbox
                          checked={consumeFullPack}
                          style={{ marginTop: 6, fontSize: 12 }}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            if (checked) {
                              updateRow(idx, {
                                consumeFullPack: true,
                                quantityRequired: 1,
                                consumptionUnitId: stockUnitId || row.consumptionUnitId,
                              });
                            } else {
                              updateRow(idx, {
                                consumeFullPack: false,
                                quantityRequired: packSizeAmount || 1,
                                consumptionUnitId: packContentUnit?.id || row.consumptionUnitId || stockUnitId,
                              });
                            }
                          }}
                        >
                          Use full pack ({packSpec.label})
                        </Checkbox>
                      ) : (
                        <AntText type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>
                          Full pack only — item is not breakable ({packSpec.label})
                        </AntText>
                      )
                    ) : null}
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
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: '1px dashed #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button
              type="primary"
              onClick={addRow}
              style={addComponentBtnStyle}
            >
              + Add component
            </Button>
          </div>
        </div>
      )}

      <Modal
        title="Add custom UOM"
        open={uomEditorOpen}
        onCancel={closeUomEditor}
        onOk={handleSaveCustomUom}
        confirmLoading={savingUom}
        okText="Add UOM"
        destroyOnClose
        zIndex={1200}
      >
        <Form layout="vertical">
          <Form.Item label="Unit name" required style={{ marginBottom: 12 }}>
            <Input
              autoFocus
              placeholder="e.g. Sachet, Pack of 250g, Box of 12"
              value={uomName}
              onChange={(e) => setUomName(e.target.value)}
              onPressEnter={(e) => {
                e.preventDefault();
                handleSaveCustomUom();
              }}
            />
          </Form.Item>
          <Form.Item label="Symbol (optional)" style={{ marginBottom: 12 }}>
            <Input
              placeholder="e.g. sachet, pkt, box"
              value={uomSymbol}
              onChange={(e) => setUomSymbol(e.target.value)}
              maxLength={20}
            />
          </Form.Item>
          <Form.Item
            label="Base unit"
            tooltip="Link to the measurement this UOM converts from. Example: Sachet → Grams, factor 50 means 1 Sachet = 50 g."
            required
            style={{ marginBottom: 12 }}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select base unit (g, kg, ml, pcs…)"
              value={uomBaseUnitId || undefined}
              options={uomBaseOptions}
              onChange={(value) => {
                setUomBaseUnitId(value || null);
                if (!value) setUomFactor(1);
              }}
            />
          </Form.Item>
          <Form.Item
            label="Conversion factor"
            tooltip="How many base units equal 1 of this new UOM. Example: 1 kg = 1000 g → factor 1000."
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0.000001}
              step={1}
              style={{ width: '100%' }}
              disabled={!uomBaseUnitId}
              value={uomFactor}
              onChange={(value) => setUomFactor(value)}
            />
          </Form.Item>
          {uomBaseUnitId ? (
            <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              1 {uomName || 'new UOM'} = {Number(uomFactor) || '?'} {uomBaseLabel}
            </AntText>
          ) : (
            <AntText type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Pick a base unit in the same family as the component stock unit so BOM conversion works.
            </AntText>
          )}
        </Form>
      </Modal>
    </div>
  );
}
