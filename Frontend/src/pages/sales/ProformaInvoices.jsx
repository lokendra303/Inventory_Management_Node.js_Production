import React from 'react';
import { Alert, Result, Typography } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const ProformaInvoices = () => {
  return (
    <div style={{ padding: '16px' }}>
      <Typography.Title level={4} style={{ margin: '0 0 16px' }}>
        PI Proforma Invoice
      </Typography.Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="Actual sales proforma invoices"
        description="Proforma invoices here will be linked to real customers, sales orders, and inventory — not third-party documentation-only invoices."
      />
      <Result
        icon={<ToolOutlined style={{ color: '#1677ff' }} />}
        title="Feature Under Development"
        subTitle="Proforma invoices for actual sales are not available yet. Use Sales Orders and Sales Invoices for live transactions, or Third-Party Invoices for documentation-only proformas in the meantime."
      />
    </div>
  );
};

export default ProformaInvoices;
