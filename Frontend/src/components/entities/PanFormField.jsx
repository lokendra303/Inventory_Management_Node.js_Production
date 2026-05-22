import React from 'react';
import { Form, Input, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

/**
 * Optional PAN field — always stored/displayed in uppercase.
 * @param {object} props - forwarded to Form.Item (name, label, extra, etc.)
 */
export function PanFormField({ label = 'PAN', ...formItemProps }) {
  return (
    <Form.Item
      label={
        <span>
          {label}
          <Tooltip title="Permanent Account Number (10 characters)">
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
            if (v.length !== 10) {
              return Promise.reject(new Error('PAN must be 10 characters'));
            }
            if (!PAN_PATTERN.test(v)) {
              return Promise.reject(new Error('Invalid PAN format (e.g. ABCDE1234F)'));
            }
            return Promise.resolve();
          },
        },
      ]}
      {...formItemProps}
    >
      <Input
        placeholder="e.g. ABCDE1234F (optional)"
        allowClear
        maxLength={10}
        style={{ textTransform: 'uppercase' }}
      />
    </Form.Item>
  );
}

export default PanFormField;
