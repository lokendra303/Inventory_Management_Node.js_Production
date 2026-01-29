import React from 'react';
import { Button, Row, Col, Card, Empty, Space, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

const ColumnCard = ({ title }) => (
  <Card
    title={title}
    size="small"
    headStyle={{ background: '#f6f8fa', fontWeight: 600 }}
    bodyStyle={{ minHeight: 220 }}
  >
    <Empty description="No Records Found" />
  </Card>
);

const Packages = () => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>All Packages</Typography.Title>
        <Space>
          <Button key="list" type="default">List</Button>
          <Button key="grid" type="default">Grid</Button>
          <Button key="new" type="primary" icon={<PlusOutlined />}>New</Button>
        </Space>
      </div>

      <div style={{ padding: 16 }}>
        <Row gutter={16}>
          <Col xs={24} sm={24} md={8} lg={8} xl={8}>
            <ColumnCard title="Packages, Not Shipped" />
          </Col>
          <Col xs={24} sm={24} md={8} lg={8} xl={8}>
            <ColumnCard title="Shipped Packages" />
          </Col>
          <Col xs={24} sm={24} md={8} lg={8} xl={8}>
            <ColumnCard title="Delivered Packages" />
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Packages;
