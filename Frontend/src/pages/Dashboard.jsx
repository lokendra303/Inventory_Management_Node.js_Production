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
import { useCurrency } from '../contexts/CurrencyContext.jsx';
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
    inactiveWarehouses: 0,
    totalItemsCount: 0,
    recentMovements: [],
    stockTrend: []
  });
  //useeffect
  useEffect(() => {
    fetchDashboardData();
  }, []);

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
      const totalValue = inventory.reduce((sum, item) => {
        const quantity = parseFloat(item.quantity_on_hand) || 0;
        const avgCost = parseFloat(item.average_cost) || 0;
        return sum + (quantity * avgCost);
      }, 0);
      const activeWarehouses = warehouses.filter(w => w.status === 'active').length;
      const inactiveWarehouses = warehouses.filter(w => w.status === 'inactive').length;
      const totalItemsCount = items.length;
      
      console.log('Dashboard data:', { totalItems, totalValue, inventory: inventory.slice(0, 3) });
      
      // Generate mock stock trend data
      const stockTrend = generateMockTrendData();

      setDashboardData({
        totalItems,
        totalValue,
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
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Items"
              value={dashboardData.totalItemsCount}
              prefix={<InboxOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="Total Inventory Value"
              value={dashboardData.totalValue}
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => formatPrice(value, currency, 'USD')}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Low Stock Items"
              value={dashboardData.lowStockCount}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={5}>
          <Card>
            <Statistic
              title="Active Warehouses"
              value={dashboardData.activeWarehouses}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={6}>
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