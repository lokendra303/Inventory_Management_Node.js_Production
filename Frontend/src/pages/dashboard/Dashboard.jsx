import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Alert, Spin } from 'antd';
import { 
  ShoppingCartOutlined, 
  InboxOutlined, 
  WarningOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const { currency, formatCurrency } = useCurrency();
  const [dashboardData, setDashboardData] = useState({
    totalItems: 0,
    lowStockItems: [],
    lowStockCount: 0,
    activeWarehouses: 0,
    inactiveWarehouses: 0,
    totalItemsCount: 0,
    recentMovements: [],
    stockTrend: []
  });

  useEffect(() => {
    fetchDashboardData();
  }, [currency]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch data from existing endpoints
      const [inventoryResponse, warehousesResponse, lowStockResponse, itemsResponse] = await Promise.all([
        apiService.get('/inventory').catch(() => ({ success: false, data: [] })),
        apiService.get('/warehouses').catch(() => ({ success: false, data: [] })),
        apiService.get('/inventory/low-stock').catch(() => ({ success: false, data: [] })),
        apiService.get('/items').catch(() => ({ success: false, data: [] }))
      ]);

      const inventory = inventoryResponse.success ? inventoryResponse.data : [];
      const warehouses = warehousesResponse.success ? warehousesResponse.data : [];
      const lowStockItems = lowStockResponse.success ? lowStockResponse.data : [];
      const items = itemsResponse.success ? itemsResponse.data : [];
      
      // Calculate stats from data
      const totalItems = inventory.length;
      const activeItems = items.filter(i => i.status === 'active').length;
      const inactiveItems = items.filter(i => i.status === 'inactive').length;
      const totalQuantity = inventory.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity_on_hand) || 0;
        return sum + quantity;
      }, 0);
      const totalAvailable = inventory.reduce((sum, item) => {
        const available = parseFloat(item.quantity_available) || 0;
        return sum + available;
      }, 0);
      const totalReserved = inventory.reduce((sum, item) => {
        const reserved = parseFloat(item.quantity_reserved) || 0;
        return sum + reserved;
      }, 0);
      const activeWarehouses = warehouses.filter(w => w.status === 'active').length;
      const inactiveWarehouses = warehouses.filter(w => w.status === 'inactive').length;
      const totalItemsCount = items.length;
      
      // Generate mock stock trend data
      const stockTrend = generateMockTrendData();

      setDashboardData({
        totalItems,
        activeItems,
        inactiveItems,
        totalQuantity,
        totalAvailable,
        totalReserved,
        lowStockItems: lowStockItems.slice(0, 10),
        lowStockCount: lowStockItems.length,
        activeWarehouses,
        inactiveWarehouses,
        totalItemsCount,
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
      ellipsis: true,
      width: 120,
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      ellipsis: true,
      width: 90,
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      ellipsis: true,
      width: 100,
    },
    {
      title: 'Qty',
      dataIndex: 'quantity_available',
      key: 'quantity_available',
      width: 60,
      render: (value) => (
        <span style={{ color: value <= 5 ? '#ff4d4f' : '#faad14', fontWeight: 600 }}>
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
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '16px' }}>Dashboard</h1>
      
      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={12} sm={12} md={8} lg={5}>
          <Card>
            <Statistic
              title="Active Items"
              value={dashboardData.activeItems || 0}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={8} lg={5}>
          <Card>
            <Statistic
              title="Inactive Items"
              value={dashboardData.inactiveItems || 0}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={8} lg={5}>
          <Card>
            <Statistic
              title="Total Quantity"
              value={dashboardData.totalQuantity || 0}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={12} lg={5}>
          <Card>
            <Statistic
              title="Available Quantity"
              value={dashboardData.totalAvailable || 0}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={12} lg={4}>
          <Card>
            <Statistic
              title="Reserved Quantity"
              value={dashboardData.totalReserved || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Low Stock Items"
              value={dashboardData.lowStockCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Active Warehouses"
              value={dashboardData.activeWarehouses}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card>
            <Statistic
              title="Inactive Warehouses"
              value={dashboardData.inactiveWarehouses}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts and Tables */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="Inventory Value Trend" style={{ marginBottom: '24px' }}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dashboardData.stockTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [formatCurrency(value, true), 'Value']} />
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
        
        <Col xs={24} lg={8}>
          <Card title="Low Stock Alert" style={{ marginBottom: '24px' }}>
            {dashboardData.lowStockItems.length > 0 ? (
              <Table
                dataSource={dashboardData.lowStockItems}
                columns={lowStockColumns}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content', y: 250 }}
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
        <Col xs={24}>
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