import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, DatePicker, Select, message, Tabs, Modal, Descriptions } from 'antd';
import { FileTextOutlined, EyeOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { useCurrency } from '../contexts/CurrencyContext';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const Reports = () => {
  const { formatCurrency, currency, exchangeRate } = useCurrency();
  console.log('Reports - Currency:', currency, 'Rate:', exchangeRate);
  const [loading, setLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [dashboardData, setDashboardData] = useState({});
  const [activeTab, setActiveTab] = useState('inventory');
  const [viewModal, setViewModal] = useState({ visible: false, data: null, type: null });

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
    console.log('Reports mounted, fetching data...');
    fetchDashboard();
    fetchInventoryReport();
  }, []);

  // Auto-refresh for sales and purchase reports
  useEffect(() => {
    let interval;
    if (activeTab === 'sales' || activeTab === 'purchase') {
      const refreshFunction = activeTab === 'sales' ? fetchSalesReport : fetchPurchaseReport;
      refreshFunction(); // Initial fetch
      interval = setInterval(refreshFunction, 30000); // Refresh every 30 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const inventoryColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
    { title: 'On Hand', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand' },
    { title: 'Available', dataIndex: 'quantity_available', key: 'quantity_available' },
    { title: 'Reserved', dataIndex: 'quantity_reserved', key: 'quantity_reserved' },
    { title: 'Value', dataIndex: 'total_value', key: 'total_value', render: (val) => formatCurrency(val || 0) },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />} 
          onClick={() => setViewModal({ visible: true, data: record, type: 'inventory' })}
        >
          View
        </Button>
      )
    }
  ];

  const purchaseColumns = [
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number' },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (val) => formatCurrency(val || 0) },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />} 
          onClick={() => setViewModal({ visible: true, data: record, type: 'purchase' })}
        >
          View
        </Button>
      )
    }
  ];

  const salesColumns = [
    { title: 'SO Number', dataIndex: 'so_number', key: 'so_number' },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Status', dataIndex: 'status', key: 'status' },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', render: (val) => formatCurrency(val || 0) },
    {
      title: 'Action',
      key: 'action',
      render: (_, record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />} 
          onClick={() => setViewModal({ visible: true, data: record, type: 'sales' })}
        >
          View
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <h1>Reports</h1>
      
      {/* Dashboard Summary */}
      <Card title="Dashboard Summary" style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <h3>{formatCurrency(dashboardData.inventoryValue || 0)}</h3>
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

      <Tabs defaultActiveKey="inventory" onChange={setActiveTab}>
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

      <Modal
        title={`${viewModal.type === 'inventory' ? 'Inventory' : viewModal.type === 'purchase' ? 'Purchase Order' : 'Sales Order'} Details`}
        open={viewModal.visible}
        onCancel={() => setViewModal({ visible: false, data: null, type: null })}
        footer={null}
        width={600}
      >
        {viewModal.data && (
          <Descriptions column={1} bordered>
            {viewModal.type === 'inventory' && (
              <>
                <Descriptions.Item label="Item Name">{viewModal.data.item_name}</Descriptions.Item>
                <Descriptions.Item label="SKU">{viewModal.data.sku}</Descriptions.Item>
                <Descriptions.Item label="Warehouse">{viewModal.data.warehouse_name}</Descriptions.Item>
                <Descriptions.Item label="Quantity On Hand">{viewModal.data.quantity_on_hand}</Descriptions.Item>
                <Descriptions.Item label="Quantity Available">{viewModal.data.quantity_available}</Descriptions.Item>
                <Descriptions.Item label="Quantity Reserved">{viewModal.data.quantity_reserved}</Descriptions.Item>
                <Descriptions.Item label="Total Value">{formatCurrency(viewModal.data.total_value || 0)}</Descriptions.Item>
                <Descriptions.Item label="Unit Cost">{formatCurrency(viewModal.data.unit_cost || 0)}</Descriptions.Item>
                <Descriptions.Item label="Last Updated">{viewModal.data.updated_at}</Descriptions.Item>
              </>
            )}
            {viewModal.type === 'purchase' && (
              <>
                <Descriptions.Item label="PO Number">{viewModal.data.po_number}</Descriptions.Item>
                <Descriptions.Item label="Vendor">{viewModal.data.vendor_name}</Descriptions.Item>
                <Descriptions.Item label="Status">{viewModal.data.status}</Descriptions.Item>
                <Descriptions.Item label="Order Date">{viewModal.data.order_date}</Descriptions.Item>
                <Descriptions.Item label="Expected Date">{viewModal.data.expected_date}</Descriptions.Item>
                <Descriptions.Item label="Total Amount">{formatCurrency(viewModal.data.total_amount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Notes">{viewModal.data.notes || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Created By">{viewModal.data.created_by}</Descriptions.Item>
              </>
            )}
            {viewModal.type === 'sales' && (
              <>
                <Descriptions.Item label="SO Number">{viewModal.data.so_number}</Descriptions.Item>
                <Descriptions.Item label="Customer">{viewModal.data.customer_name}</Descriptions.Item>
                <Descriptions.Item label="Status">{viewModal.data.status}</Descriptions.Item>
                <Descriptions.Item label="Order Date">{viewModal.data.order_date}</Descriptions.Item>
                <Descriptions.Item label="Ship Date">{viewModal.data.ship_date}</Descriptions.Item>
                <Descriptions.Item label="Total Amount">{formatCurrency(viewModal.data.total_amount || 0)}</Descriptions.Item>
                <Descriptions.Item label="Payment Status">{viewModal.data.payment_status || 'N/A'}</Descriptions.Item>
                <Descriptions.Item label="Created By">{viewModal.data.created_by}</Descriptions.Item>
              </>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Reports;