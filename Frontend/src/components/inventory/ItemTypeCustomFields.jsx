import React from 'react';
import {
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
} from 'antd';
import { FormOutlined } from '@ant-design/icons';
import { filterSelectOption } from '../../utils/selectFilter';

function renderCustomFieldInput(config) {
  const options = Array.isArray(config.options)
    ? config.options
    : (typeof config.options === 'string'
      ? (() => { try { return JSON.parse(config.options); } catch { return []; } })()
      : []);

  switch (config.field_type) {
    case 'textarea':
      return <Input.TextArea rows={2} placeholder={config.field_label} />;
    case 'number':
    case 'decimal':
      return (
        <InputNumber
          min={0}
          step={config.field_type === 'decimal' ? 0.01 : 1}
          style={{ width: '100%' }}
          placeholder={config.field_label}
        />
      );
    case 'boolean':
      return <Checkbox>{config.field_label}</Checkbox>;
    case 'date':
      return <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />;
    case 'select':
      return (
        <Select
          allowClear
          showSearch
          placeholder={`Select ${config.field_label}`}
          filterOption={filterSelectOption}
          options={options.map((opt) => {
            const value = typeof opt === 'object' ? (opt.value ?? opt.label) : opt;
            const label = typeof opt === 'object' ? (opt.label ?? opt.value) : opt;
            return { value, label: String(label) };
          })}
        />
      );
    case 'multiselect':
      return (
        <Select
          mode="multiple"
          allowClear
          showSearch
          placeholder={`Select ${config.field_label}`}
          filterOption={filterSelectOption}
          options={options.map((opt) => {
            const value = typeof opt === 'object' ? (opt.value ?? opt.label) : opt;
            const label = typeof opt === 'object' ? (opt.label ?? opt.value) : opt;
            return { value, label: String(label) };
          })}
        />
      );
    default:
      return <Input placeholder={config.field_label} />;
  }
}

/**
 * Renders institution-configured custom fields for an item type (simple, composite, etc.).
 */
export default function ItemTypeCustomFields({
  fieldConfigs = [],
  sectionStyle,
  sectionHeader,
  sectionIconStyle,
  title = 'Type-specific fields',
}) {
  const sorted = [...fieldConfigs].sort(
    (a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0)
  );

  if (!sorted.length) return null;

  return (
    <div style={sectionStyle}>
      <div style={sectionHeader}>
        <span style={sectionIconStyle}><FormOutlined /></span>
        {title}
      </div>
      <Row gutter={16}>
        {sorted.map((config) => {
          const fieldName = config.field_name || config.fieldName;
          const isBoolean = config.field_type === 'boolean';
          return (
            <Col key={fieldName} xs={24} sm={config.field_type === 'textarea' ? 24 : 12}>
              <Form.Item
                name={['customFields', fieldName]}
                label={isBoolean ? ' ' : (config.field_label || fieldName)}
                colon={!isBoolean}
                valuePropName={isBoolean ? 'checked' : 'value'}
                rules={config.is_required ? [{ required: true, message: `${config.field_label || fieldName} is required` }] : []}
              >
                {renderCustomFieldInput(config)}
              </Form.Item>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
