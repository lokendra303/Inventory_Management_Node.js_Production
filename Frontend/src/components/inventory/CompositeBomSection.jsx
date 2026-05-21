import React from 'react';
import { Button, Col, Grid, InputNumber, Row, Select, Tooltip, Typography } from 'antd';
import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

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

/**
 * Bill of materials editor for composite / kit items.
 */
export default function CompositeBomSection({
  components,
  onComponentsChange,
  catalogItems = [],
  excludeItemId,
}) {
  const screens = Grid.useBreakpoint();

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

  const selectableItems = catalogItems.filter(
    (itemRow) => itemRow.id !== excludeItemId && itemRow.status === 'active'
  );

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
          <Tooltip title="Bill of Materials: lists each part (existing SKU) that makes up one unit of this kit/composite parent.">
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
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            <AntText strong>Component item</AntText>
            {' — '}Pick another item already in your catalog (<AntText strong>simple</AntText> or{' '}
            <AntText strong>variant</AntText> only). It is not duplicated or overwritten; this row only defines the
            relationship to this kit.
          </li>
          <li style={{ marginTop: 6 }}>
            <AntText strong>Qty per 1 kit</AntText>
            {' — '}How many units of that component are consumed to build <AntText strong>one</AntText> unit of this
            parent (e.g. 4 screws per assembled panel). Scale mentally: selling 10 kits would need{' '}
            <AntText style={{ fontStyle: 'italic' }}>10 × qty</AntText> of each line.
          </li>
          <li style={{ marginTop: 6 }}>
            <AntText strong>Consume when</AntText>
            {' — '}When integrated fulfilment consumes component stock:&nbsp;
            <AntText strong>Shipment</AntText>
            {' '}when dispatching/leaving warehouse; <AntText strong>Order</AntText>
            {' '}when the sales order is placed or confirmed—use whichever matches how you allocate stock. (You can still
            sell components on their own; this table only drives the kit recipe.)
          </li>
        </ul>
      </div>
      {components.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: '#64748b' }}>
          Add at least one row. Each row is one line on the BOM for this composite item.
        </div>
      ) : (
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: '12px 14px 14px' }}>
          {components.map((row, idx) => {
            const controlTopOffset = 22 + 8;
            const deletePaddingTop = screens.sm ? controlTopOffset : 0;
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
                      <Tooltip title="Search by SKU or name. Cannot be another composite or a service item.">
                        <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                      </Tooltip>
                    </div>
                    <Select
                      showSearch
                      optionFilterProp="children"
                      value={row.itemId || undefined}
                      placeholder="Select item — part of this kit"
                      popupMatchSelectWidth={false}
                      style={{ width: '100%', display: 'block' }}
                      size="middle"
                      onChange={(value) => updateRow(idx, { itemId: value })}
                    >
                      {selectableItems.map((itemRow) => (
                        <Select.Option key={itemRow.id} value={itemRow.id}>
                          <span>{itemRow.sku}</span>
                          {' — '}
                          <span style={{ color: '#64748b' }}>{itemRow.name}</span>
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={12} sm={6}>
                    <div style={BOM_FIELD_LABEL_STYLE}>
                      Qty per 1 kit
                      <Tooltip title="Whole-number or fractional quantities allowed (e.g. 0.5 kg per kit).">
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
                  <Col xs={12} sm={5}>
                    <div style={BOM_FIELD_LABEL_STYLE}>
                      Consume when
                      <Tooltip title="Shipment: consume when goods ship. Order: consume at order/booking stage. Pick what matches your process.">
                        <InfoCircleOutlined style={{ color: '#cbd5e1', fontSize: 12 }} />
                      </Tooltip>
                    </div>
                    <Select
                      value={row.consumptionTiming || 'shipment'}
                      style={{ width: '100%', display: 'block' }}
                      size="middle"
                      onChange={(value) => updateRow(idx, { consumptionTiming: value })}
                      options={[
                        { value: 'shipment', label: 'Shipment' },
                        { value: 'order', label: 'Order' },
                      ]}
                    />
                  </Col>
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
                <div
                  style={{
                    fontSize: 11,
                    color: '#94a3b8',
                    marginTop: 8,
                    lineHeight: 1.4,
                    paddingLeft: 0,
                    clear: 'both',
                  }}
                >
                  <AntText type="secondary">Consume when:</AntText>{' '}
                  Shipment = dispatch gate · Order = earlier commitment (matches the dropdown in this row).
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
