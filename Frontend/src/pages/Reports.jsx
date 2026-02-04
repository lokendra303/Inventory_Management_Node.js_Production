import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, DatePicker, Select, message, Tabs, Modal, Descriptions } from 'antd';
import { FileTextOutlined, EyeOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { useLocation } from 'react-router-dom';
import { formatNumber } from '../utils/currency.js';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const Reports = () => {
  const { formatCurrency, currency, exchangeRate } = useCurrency();
  const location = useLocation();
  console.log('Reports - Currency:', currency, 'Rate:', exchangeRate);
  const [loading, setLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState([]);
  const [adjustmentData, setAdjustmentData] = useState([]);
  const [transferData, setTransferData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [dashboardData, setDashboardData] = useState({});
  const [activeTab, setActiveTab] = useState('inventory');
  const [viewModal, setViewModal] = useState({ visible: false, data: null, type: null });

  // Determine initial tab based on URL
  useEffect(() => {
    if (location.pathname.includes('inventory-adjustments')) {
      setActiveTab('adjustments');
    } else if (location.pathname.includes('stock-transfers')) {
      setActiveTab('transfers');
    } else if (location.pathname.includes('inventory-valuation')) {
      setActiveTab('valuation');
    }
  }, [location.pathname]);

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

  const fetchAdjustmentReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/inventory-adjustments');
      if (response.success) {
        setAdjustmentData(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch adjustment report');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransferReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/stock-transfers');
      if (response.success) {
        setTransferData(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch transfer report');
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
    } else if (activeTab === 'adjustments') {
      fetchAdjustmentReport();
    } else if (activeTab === 'transfers') {
      fetchTransferReport();
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

  const adjustmentColumns = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (val) => new Date(val).toLocaleDateString() },
    { title: 'Reference', dataIndex: 'reference_number', key: 'reference_number' },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name' },
    { title: 'Type', dataIndex: 'adjustment_type', key: 'adjustment_type', render: (val) => val?.toUpperCase() },
    { 
      title: 'Loss Type', 
      dataIndex: 'loss_type', 
      key: 'loss_type', 
      render: (val) => {
        const colors = {
          'MISSING': '#ff4d4f',
          'DAMAGED': '#faad14', 
          'EXPIRED': '#ff7a45',
          'MANUAL': '#52c41a',
          'SYSTEM': '#1890ff'
        };
        return <span style={{ color: colors[val] || '#666' }}>{val}</span>;
      }
    },
    { title: 'Quantity', dataIndex: 'quantity_change', key: 'quantity_change', render: (val) => formatNumber(Math.abs(val)) },
    { title: 'Reason', dataIndex: 'reason', key: 'reason' },
    { title: 'Adjusted By', key: 'adjusted_by', render: (_, record) => `${record.first_name || ''} ${record.last_name || ''}`.trim() || 'System' }
  ];

  const transferColumns = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', render: (val) => new Date(val).toLocaleDateString() },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'From Warehouse', dataIndex: 'from_warehouse', key: 'from_warehouse' },
    { title: 'To Warehouse', dataIndex: 'to_warehouse', key: 'to_warehouse' },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', render: (val) => formatNumber(val) },
    { title: 'Transfer ID', dataIndex: 'transfer_id', key: 'transfer_id' }
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

        <TabPane tab="Inventory Adjustments" key="adjustments">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<FileTextOutlined />}
                onClick={fetchAdjustmentReport}
                loading={loading}
              >
                Refresh Report
              </Button>
              <Select 
                placeholder="Filter by Loss Type"
                style={{ width: 150 }}
                allowClear
                onChange={(value) => {
                  // Filter adjustmentData by loss_type
                  if (value) {
                    const filtered = adjustmentData.filter(item => item.loss_type === value);
                    setAdjustmentData(filtered);
                  } else {
                    fetchAdjustmentReport(); // Reload all data
                  }
                }}
              >
                <Select.Option value="MISSING">Missing Items</Select.Option>
                <Select.Option value="DAMAGED">Damaged Items</Select.Option>
                <Select.Option value="EXPIRED">Expired Items</Select.Option>
                <Select.Option value="ADJUSTMENT">Manual Adjustments</Select.Option>
              </Select>
            </Space>
            <Table 
              columns={adjustmentColumns} 
              dataSource={adjustmentData} 
              loading={loading}
              rowKey={(record) => `${record.created_at}-${record.item_name}`}
            />
          </Card>
        </TabPane>

        <TabPane tab="Stock Transfers" key="transfers">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<FileTextOutlined />}
                onClick={fetchTransferReport}
                loading={loading}
              >
                Refresh Report
              </Button>
            </Space>
            <Table 
              columns={transferColumns} 
              dataSource={transferData} 
              loading={loading}
              rowKey={(record) => `${record.created_at}-${record.transfer_id}`}
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