import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Statistic, Row, Col, Spin } from 'antd';
import { DollarOutlined, FileTextOutlined, BarChartOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';

const { Title, Paragraph } = Typography;

const InvoiceDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await apiService.get('/invoices/dashboard/summary');
      
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <DollarOutlined /> Invoice Dashboard
      </Title>
      
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {dashboardData && (
          <>
            <Row gutter={16}>
              <Col span={12}>
                <Card title="Purchase Invoices">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic title="Total" value={dashboardData.purchase?.total_invoices || 0} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Amount" value={dashboardData.purchase?.total_amount || 0} prefix="$" precision={2} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Outstanding" value={dashboardData.purchase?.outstanding_amount || 0} prefix="$" precision={2} />
                    </Col>
                  </Row>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Sales Invoices">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic title="Total" value={dashboardData.sales?.total_invoices || 0} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Amount" value={dashboardData.sales?.total_amount || 0} prefix="$" precision={2} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Outstanding" value={dashboardData.sales?.outstanding_amount || 0} prefix="$" precision={2} />
                    </Col>
                  </Row>
                </Card>
              </Col>
            </Row>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <Card>
                <Title level={4}>
                  <ShoppingCartOutlined /> Purchase Invoices
                </Title>
                <Paragraph>Manage vendor bills and purchase invoice payments</Paragraph>
                <Button type="primary" href="/invoices/purchase">
                  View Purchase Invoices
                </Button>
              </Card>

              <Card>
                <Title level={4}>
                  <FileTextOutlined /> Sales Invoices
                </Title>
                <Paragraph>Manage customer invoices and sales receipts</Paragraph>
                <Button type="primary" href="/invoices/sales">
                  View Sales Invoices
                </Button>
              </Card>

              <Card>
                <Title level={4}>
                  <BarChartOutlined /> Outstanding Invoices
                </Title>
                <Paragraph>Track overdue and pending invoice payments</Paragraph>
                <Button type="primary" href="/invoices/outstanding">
                  View Outstanding
                </Button>
              </Card>
            </div>
          </>
        )}
      </Space>
    </div>
  );
};

export default InvoiceDashboard;