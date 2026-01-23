import React from 'react';
import { Card, Row, Col, Button, Space } from 'antd';

const Reports = () => {
  return (
    <div style={{ padding: '24px' }}>
      <h1>Reports</h1>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="Inventory Reports">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block>Stock on Hand</Button>
              <Button block>Stock Movement</Button>
              <Button block>Stock Aging</Button>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Purchase Reports">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block>Purchase Summary</Button>
              <Button block>Vendor Analysis</Button>
              <Button block>GRN Report</Button>
            </Space>
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Sales Reports">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button block>Sales Summary</Button>
              <Button block>Customer Analysis</Button>
              <Button block>Shipment Report</Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reports;