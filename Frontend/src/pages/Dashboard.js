import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Alert, Spin } from 'antd';
import { 
  ShoppingCartOutlined, 
  InboxOutlined, 
  WarningOutlined,
  DollarOutlined 
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiService from '../services/apiService';
import { useCurrency } from '../contexts/CurrencyContext';
import { formatPrice } from '../utils/currency';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const { currency } = useCurrency();
  const [dashboardData, setDashboardData] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStockItems: [],
    lowStockCount: 0,
    activeWarehouses: 0,
    recentMovements: [],
    stockTrend: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch multiple data sources in parallel
      const [statsResponse, warehousesResponse, lowStockResponse] = await Promise.all([
        apiService.get('/inventory/dashboard-stats'),
        apiService.get('/warehouses'),
        apiService.get('/inventory/low-stock')
      ]);

      const stats = statsResponse.success ? statsResponse.data : {};
      const activeWarehouses = warehousesResponse.success ? warehousesResponse.data.length : 0;
      const lowStockItems = lowStockResponse.success ? lowStockResponse.data : [];
      
      // Generate mock stock trend data (in real app, this would come from API)
      const stockTrend = generateMockTrendData();

      setDashboardData({
        totalItems: stats.totalItems || 0,
        totalValue: stats.totalValue || 0,
        lowStockItems: lowStockItems,
        lowStockCount: stats.lowStockCount || lowStockItems.length,
        activeWarehouses,
        stockTrend
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMockTrendData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toLocaleDateString(),
        value: Math.floor(Math.random() * 1000000) + 500000
      });
    }
    
    return data;
  };

  const lowStockColumns = [
    {
      title: 'Item',
      dataIndex: 'item_name',
      key: 'item_name',
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
    },
    {
      title: 'Available',
      dataIndex: 'quantity_available',
      key: 'quantity_available',
      render: (value) => (
        <span style={{ color: value <= 5 ? '#ff4d4f' : '#faad14' }}>
          {value}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1>Dashboard</h1>
      
      {/* Key Metrics */}
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Items"
              value={dashboardData.totalItems}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Inventory Value"
              value={dashboardData.totalValue}
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => formatPrice(value, currency, 'USD')}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Low Stock Items"
              value={dashboardData.lowStockCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Warehouses"
              value={dashboardData.activeWarehouses}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts and Tables */}
      <Row gutter={16}>
        <Col span={16}>
          <Card title="Inventory Value Trend" style={{ marginBottom: '24px' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardData.stockTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [formatPrice(value, currency, 'USD'), 'Value']} />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#1890ff" 
                  strokeWidth={2}
                  dot={{ fill: '#1890ff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        
        <Col span={8}>
          <Card title="Low Stock Alert" style={{ marginBottom: '24px' }}>
            {dashboardData.lowStockItems.length > 0 ? (
              <Table
                dataSource={dashboardData.lowStockItems}
                columns={lowStockColumns}
                pagination={false}
                size="small"
                scroll={{ y: 250 }}
                rowKey="id"
              />
            ) : (
              <Alert
                message="All items are well stocked"
                type="success"
                showIcon
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent Activity */}
      <Row>
        <Col span={24}>
          <Card title="Recent Activity">
            <Alert
              message="Recent inventory movements will be displayed here"
              description="This section will show the latest stock movements, receipts, and shipments."
              type="info"
              showIcon
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;