import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, DatePicker, Select, message, Tabs } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const Reports = () => {
  const [loading, setLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [dashboardData, setDashboardData] = useState({});

  const fetchInventoryReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/inventory');
      if (response.success) {
        setInventoryData(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch inventory report');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/purchases');
      if (response.success) {
        setPurchaseData(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch purchase report');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/sales');
      if (response.success) {
        setSalesData(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch sales report');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await apiService.get('/reports/dashboard');
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch dashboard data');
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchInventoryReport();
  }, []);

  const inventoryColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
    { title: 'On Hand', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand' },
    { title: 'Available', dataIndex: 'quantity_available', key: 'quantity_available' },
    { title: 'Reserved', dataIndex: 'quantity_reserved', key: 'quantity_reserved' },
    { title: 'Value', dataIndex: 'total_value', key: 'total_value', render: (val) => `$${val || 0}` }
  ];

  const purchaseColumns = [
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (val) => `$${val || 0}` }
  ];

  const salesColumns = [
    { title: 'SO Number', dataIndex: 'so_number', key: 'so_number' },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (val) => `$${val || 0}` }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>Reports</h1>
      
      {/* Dashboard Summary */}
      <Card title="Dashboard Summary" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <h3>${dashboardData.inventoryValue || 0}</h3>
            <p>Inventory Value</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3>{dashboardData.totalSales?.count || 0}</h3>
            <p>Total Sales</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3>{dashboardData.totalPurchases?.count || 0}</h3>
            <p>Total Purchases</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <h3>{dashboardData.lowStockItems || 0}</h3>
            <p>Low Stock Items</p>
          </div>
        </div>
      </Card>

      <Tabs defaultActiveKey="inventory">
        <TabPane tab="Inventory Report" key="inventory">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<FileTextOutlined />}
                onClick={fetchInventoryReport}
                loading={loading}
              >
                Refresh Report
              </Button>
            </Space>
            <Table 
              columns={inventoryColumns} 
              dataSource={inventoryData} 
              loading={loading}
              rowKey="id"
            />
          </Card>
        </TabPane>

        <TabPane tab="Purchase Report" key="purchase">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<FileTextOutlined />}
                onClick={fetchPurchaseReport}
                loading={loading}
              >
                Refresh Report
              </Button>
            </Space>
            <Table 
              columns={purchaseColumns} 
              dataSource={purchaseData} 
              loading={loading}
              rowKey="id"
            />
          </Card>
        </TabPane>

        <TabPane tab="Sales Report" key="sales">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<FileTextOutlined />}
                onClick={fetchSalesReport}
                loading={loading}
              >
                Refresh Report
              </Button>
            </Space>
            <Table 
              columns={salesColumns} 
              dataSource={salesData} 
              loading={loading}
              rowKey="id"
            />
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default Reports;