import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Statistic, Row, Col, Spin } from 'antd';
import { DollarOutlined, FileTextOutlined, BarChartOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice } from '../../utils/currency';

const { Title, Paragraph } = Typography;

const InvoiceDashboard = () => {
  const { currency } = useCurrency();
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
    <div style={{ padding: '16px' }}>
      <Title level={4} style={{ marginBottom: 16 }}><DollarOutlined /> Invoice Dashboard</Title>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {dashboardData && (
          <>
            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card title="Purchase Invoices">
                  <Row gutter={[16, 16]}>
                    <Col xs={8}><Statistic title="Total" value={dashboardData.purchase?.total_invoices || 0} /></Col>
                    <Col xs={8}><Statistic title="Amount" value={formatPrice(dashboardData.purchase?.total_amount || 0, currency)} /></Col>
                    <Col xs={8}><Statistic title="Outstanding" value={formatPrice(dashboardData.purchase?.outstanding_amount || 0, currency)} /></Col>
                  </Row>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Sales Invoices">
                  <Row gutter={[16, 16]}>
                    <Col xs={8}><Statistic title="Total" value={dashboardData.sales?.total_invoices || 0} /></Col>
                    <Col xs={8}><Statistic title="Amount" value={formatPrice(dashboardData.sales?.total_amount || 0, currency)} /></Col>
                    <Col xs={8}><Statistic title="Outstanding" value={formatPrice(dashboardData.sales?.outstanding_amount || 0, currency)} /></Col>
                  </Row>
                </Card>
              </Col>
            </Row>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Card>
                  <Title level={5}><ShoppingCartOutlined /> Purchase Invoices</Title>
                  <Paragraph>Manage vendor bills and purchase invoice payments</Paragraph>
                  <Button type="primary" href="/invoices/purchase">View Purchase Invoices</Button>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Card>
                  <Title level={5}><FileTextOutlined /> Sales Invoices</Title>
                  <Paragraph>Manage customer invoices and sales receipts</Paragraph>
                  <Button type="primary" href="/invoices/sales">View Sales Invoices</Button>
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Card>
                  <Title level={5}><BarChartOutlined /> Outstanding Invoices</Title>
                  <Paragraph>Track overdue and pending invoice payments</Paragraph>
                  <Button type="primary" href="/invoices/outstanding">View Outstanding</Button>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Space>
    </div>
  );
};

export default InvoiceDashboard;