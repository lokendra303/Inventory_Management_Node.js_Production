import React from 'react';
import { Result, Typography } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const Packages = () => {
  return (
    <div style={{ padding: '16px' }}>
      <Typography.Title level={4} style={{ margin: '0 0 24px' }}>All Packages</Typography.Title>
      <Result
        icon={<ToolOutlined style={{ color: '#1677ff' }} />}
        title="Feature Under Development"
        subTitle="Package tracking (pack, ship, and deliver) is not available yet. Use Shipments and Delivery Challans for outbound fulfillment in the meantime."
      />
    </div>
  );
};

export default Packages;
