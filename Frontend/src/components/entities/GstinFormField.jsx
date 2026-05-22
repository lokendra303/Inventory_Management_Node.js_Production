import React from 'react';
import { Form, Input, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/**
 * Optional GSTIN field for customer / vendor profiles.
 * @param {'customer'|'vendor'} partyType
 */
export function GstinFormField({ partyType = 'customer' }) {
  const label = partyType === 'vendor' ? 'vendor' : 'customer';

  return (
    <Form.Item
      name="gstin"
      label={
        <span>
          GST Number (GSTIN)
          <Tooltip title={`Optional ${label} GSTIN — shown on invoices, POs, and tax documents`}>
            <InfoCircleOutlined style={{ marginLeft: 8, color: '#999' }} />
          </Tooltip>
        </span>
      }
      normalize={(value) => (value ? String(value).trim().toUpperCase() : '')}
      rules={[
        {
          validator: (_, value) => {
            const v = (value || '').trim();
            if (!v) return Promise.resolve();
            if (v.length !== 15) {
              return Promise.reject(new Error('GSTIN must be 15 characters'));
            }
            if (!GSTIN_PATTERN.test(v)) {
              return Promise.reject(new Error('Invalid GSTIN format'));
            }
            return Promise.resolve();
          },
        },
      ]}
    >
      <Input
        placeholder="e.g. 27AAAAA0000A1Z5 (optional)"
        allowClear
        maxLength={15}
        style={{ textTransform: 'uppercase' }}
      />
    </Form.Item>
  );
}

export default GstinFormField;
