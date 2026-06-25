import React, { useMemo } from 'react';
import { Button, Col, Form, Input, InputNumber, Row, Space, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';
import {
  BOM_CHARGE_PRESETS,
  calculateBomExpectedCost,
} from '../../utils/bomCostHelpers';

const { Text } = Typography;

export default function BomCostSummary({
  form,
  components = [],
  catalogItems = [],
}) {
  const { currency } = useCurrency();
  const additionalCharges = Form.useWatch('bomAdditionalCharges', form) || [];

  const { componentsSubtotal, additionalTotal, expectedCost } = useMemo(
    () => calculateBomExpectedCost(components, catalogItems, additionalCharges),
    [components, catalogItems, additionalCharges]
  );

  const currentCostPrice = Form.useWatch('costPrice', form);
  const costDiffers = Number(currentCostPrice) > 0
    && Math.abs(Number(currentCostPrice) - expectedCost) > 0.009;

  const applyExpectedCost = () => {
    form.setFieldsValue({ costPrice: expectedCost });
    const openingStock = Number(form.getFieldValue('openingStock')) || 0;
    if (openingStock > 0) {
      form.setFieldsValue({
        openingValue: Math.round(openingStock * expectedCost * 100) / 100,
      });
    }
  };

  const addPresetCharge = (label) => {
    const rows = form.getFieldValue('bomAdditionalCharges') || [];
    if (rows.some((row) => String(row?.label || '').toLowerCase() === label.toLowerCase())) return;
    form.setFieldsValue({
      bomAdditionalCharges: [...rows, { label, amount: undefined }],
    });
  };

  return (
    <div
      style={{
        marginTop: 12,
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: 'linear-gradient(180deg, #fafbff 0%, #fff 100%)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid #eef2ff',
          fontWeight: 700,
          color: '#334155',
          fontSize: 13,
        }}
      >
        Expected kit cost (from BOM)
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
            Add overhead or extra costs per finished kit (electricity, packaging, labour, etc.).
          </Text>
          <Space size={[6, 6]} wrap style={{ marginBottom: 10 }}>
            {BOM_CHARGE_PRESETS.map((preset) => (
              <Button
                key={preset}
                size="small"
                onClick={() => addPresetCharge(preset)}
                style={{ borderRadius: 999, fontSize: 12 }}
              >
                + {preset}
              </Button>
            ))}
          </Space>
          <Form.List name="bomAdditionalCharges">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Row key={key} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                    <Col xs={14} sm={10}>
                      <Form.Item
                        {...restField}
                        name={[name, 'label']}
                        rules={[{ required: true, message: 'Label required' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Charge name (e.g. Electric bill)" />
                      </Form.Item>
                    </Col>
                    <Col xs={8} sm={6}>
                      <Form.Item
                        {...restField}
                        name={[name, 'amount']}
                        rules={[{ required: true, message: 'Amount required' }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber min={0} step={0.01} precision={2} placeholder="0.00" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={2}>
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                        aria-label="Remove charge"
                      />
                    </Col>
                  </Row>
                ))}
                <Button
                  type="dashed"
                  block
                  icon={<PlusOutlined />}
                  onClick={() => add({ label: '', amount: undefined })}
                  style={{ marginBottom: 12, borderRadius: 10 }}
                >
                  Add custom charge
                </Button>
              </>
            )}
          </Form.List>
        </div>

        <div
          style={{
            background: '#fff',
            border: '1px solid #e8ecf4',
            borderRadius: 10,
            padding: '12px 14px',
          }}
        >
          <Row justify="space-between" style={{ marginBottom: 6 }}>
            <Text type="secondary">Components subtotal</Text>
            <Text strong>{formatPrice(componentsSubtotal, currency, 'USD')}</Text>
          </Row>
          <Row justify="space-between" style={{ marginBottom: 6 }}>
            <Text type="secondary">Additional charges</Text>
            <Text strong>{formatPrice(additionalTotal, currency, 'USD')}</Text>
          </Row>
          <Row
            justify="space-between"
            style={{
              marginTop: 8,
              paddingTop: 10,
              borderTop: '1px dashed #e2e8f0',
            }}
          >
            <Text strong style={{ color: '#1e293b' }}>Expected cost per kit</Text>
            <Text strong style={{ color: '#4f46e5', fontSize: 16 }}>
              {formatPrice(expectedCost, currency, 'USD')}
            </Text>
          </Row>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={applyExpectedCost}
              disabled={expectedCost <= 0 && componentsSubtotal <= 0}
              style={{
                borderRadius: 8,
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none',
              }}
            >
              Apply to cost price
            </Button>
            {costDiffers ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Current cost price: {formatPrice(currentCostPrice, currency, 'USD')} (differs from expected)
              </Text>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
