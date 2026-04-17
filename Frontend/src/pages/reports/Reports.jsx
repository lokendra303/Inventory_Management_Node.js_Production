import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, DatePicker, Select, message, Tabs, Modal, Descriptions, Row, Col, Tag } from 'antd';
import {
  EyeOutlined, ReloadOutlined, AccountBookOutlined,
  FileDoneOutlined, ContainerOutlined, AlertOutlined, DatabaseOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { useLocation } from 'react-router-dom';
import { formatNumber } from '../../utils/currency.js';

const { TabPane } = Tabs;

const statCards = [
  {
    key: 'inventoryValue',
    label: 'Inventory Value',
    icon: <AccountBookOutlined style={{ fontSize: 28, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    isCurrency: true,
  },
  {
    key: 'totalSales',
    label: 'Total Sales',
    icon: <FileDoneOutlined style={{ fontSize: 28, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    isCurrency: false,
    accessor: (d) => d.totalSales?.count || 0,
  },
  {
    key: 'totalPurchases',
    label: 'Total Purchases',
    icon: <ContainerOutlined style={{ fontSize: 28, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    isCurrency: false,
    accessor: (d) => d.totalPurchases?.count || 0,
  },
  {
    key: 'lowStockItems',
    label: 'Low Stock Items',
    icon: <AlertOutlined style={{ fontSize: 28, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    isCurrency: false,
  },
];

const Reports = () => {
  const { formatCurrency, currency, exchangeRate } = useCurrency();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [inventoryData, setInventoryData] = useState([]);
  const [adjustmentData, setAdjustmentData] = useState([]);
  const [transferData, setTransferData] = useState([]);
  const [purchaseData, setPurchaseData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [dashboardData, setDashboardData] = useState({});
  const [activeTab, setActiveTab] = useState('inventory');
  const [viewModal, setViewModal] = useState({ visible: false, data: null, type: null });
  const [purchaseFromDate, setPurchaseFromDate] = useState(null);
  const [purchaseToDate, setPurchaseToDate] = useState(null);
  const [purchaseStatus, setPurchaseStatus] = useState(null);
  const [salesFromDate, setSalesFromDate] = useState(null);
  const [salesToDate, setSalesToDate] = useState(null);
  const [salesStatus, setSalesStatus] = useState(null);
  const [adjustmentFromDate, setAdjustmentFromDate] = useState(null);
  const [adjustmentToDate, setAdjustmentToDate] = useState(null);
  const [adjustmentLossType, setAdjustmentLossType] = useState(null);
  const [transferFromDate, setTransferFromDate] = useState(null);
  const [transferToDate, setTransferToDate] = useState(null);

  useEffect(() => {
    if (location.pathname.includes('inventory-adjustments')) setActiveTab('adjustments');
    else if (location.pathname.includes('stock-transfers')) setActiveTab('transfers');
    else if (location.pathname.includes('inventory-valuation')) setActiveTab('valuation');
  }, [location.pathname]);

  const fetchInventoryReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/inventory', { timeout: 10000 });
      setInventoryData(response.success ? response.data || [] : []);
    } catch (error) {
      setInventoryData([]);
      if (error.code !== 'ECONNABORTED') message.error('Failed to fetch inventory report');
    } finally { setLoading(false); }
  };

  const fetchPurchaseReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/purchases', { timeout: 10000 });
      if (response.success) {
        setPurchaseData(response.data || []);
        if (!response.data?.length) message.info('No purchase orders found');
      } else {
        setPurchaseData([]);
        message.warning(response.error || 'No purchase data available');
      }
    } catch (error) {
      setPurchaseData([]);
      if (error.code !== 'ECONNABORTED') message.error('Failed to fetch purchase report');
    } finally { setLoading(false); }
  };

  const fetchSalesReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/sales', { timeout: 10000 });
      setSalesData(response.success ? response.data || [] : []);
    } catch (error) {
      setSalesData([]);
      if (error.code !== 'ECONNABORTED') message.error('Failed to fetch sales report');
    } finally { setLoading(false); }
  };

  const fetchAdjustmentReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/inventory-adjustments', { timeout: 10000 });
      setAdjustmentData(response.success ? response.data || [] : []);
    } catch (error) {
      setAdjustmentData([]);
      if (error.code !== 'ECONNABORTED') message.error('Failed to fetch adjustment report');
    } finally { setLoading(false); }
  };

  const fetchTransferReport = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/reports/stock-transfers', { timeout: 10000 });
      setTransferData(response.success ? response.data || [] : []);
    } catch (error) {
      setTransferData([]);
      if (error.code !== 'ECONNABORTED') message.error('Failed to fetch transfer report');
    } finally { setLoading(false); }
  };

  const fetchDashboard = async () => {
    try {
      const response = await apiService.get('/reports/dashboard', { timeout: 10000 });
      setDashboardData(response.success ? response.data || {} : {});
    } catch { setDashboardData({}); }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await fetchDashboard();
      await fetchInventoryReport();
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    let interval;
    if (activeTab === 'sales' || activeTab === 'purchase') {
      const fn = activeTab === 'sales' ? fetchSalesReport : fetchPurchaseReport;
      fn();
      interval = setInterval(fn, 30000);
    } else if (activeTab === 'adjustments') {
      fetchAdjustmentReport();
    } else if (activeTab === 'transfers') {
      fetchTransferReport();
    }
    return () => { if (interval) clearInterval(interval); };
  }, [activeTab]);

  const inventoryColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    { title: 'On Hand', dataIndex: 'quantity_on_hand', key: 'quantity_on_hand', width: 90 },
    { title: 'Available', dataIndex: 'quantity_available', key: 'quantity_available', width: 90 },
    { title: 'Reserved', dataIndex: 'quantity_reserved', key: 'quantity_reserved', width: 90 },
    { title: 'Value', dataIndex: 'total_value', key: 'total_value', width: 110, render: (val) => formatCurrency(val || 0) },
    {
      title: 'Action', key: 'action', width: 80,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => setViewModal({ visible: true, data: record, type: 'inventory' })}>View</Button>
      )
    }
  ];

  const purchaseColumns = [
    { title: 'PO Number', dataIndex: 'po_number', key: 'po_number', width: 130, ellipsis: true },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name', width: 140, ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (val) => {
        const colorMap = { draft: 'default', sent: 'blue', confirmed: 'cyan', partially_received: 'orange', received: 'green', cancelled: 'red' };
        return <Tag color={colorMap[val] || 'default'}>{val?.toUpperCase()}</Tag>;
      }
    },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date', width: 110, render: (val) => val ? new Date(val).toLocaleDateString() : 'N/A' },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 110, render: (val) => formatCurrency(val || 0) },
    {
      title: 'Action', key: 'action', width: 80,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => setViewModal({ visible: true, data: record, type: 'purchase' })}>View</Button>
      )
    }
  ];

  const salesColumns = [
    { title: 'SO Number', dataIndex: 'so_number', key: 'so_number', width: 130, ellipsis: true },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', width: 140, ellipsis: true },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (val) => {
        const colorMap = { draft: 'default', confirmed: 'blue', shipped: 'cyan', delivered: 'green', cancelled: 'red' };
        return <Tag color={colorMap[val] || 'default'}>{val?.toUpperCase()}</Tag>;
      }
    },
    { title: 'Order Date', dataIndex: 'order_date', key: 'order_date', width: 110 },
    { title: 'Total', dataIndex: 'total_amount', key: 'total_amount', width: 110, render: (val) => formatCurrency(val || 0) },
    {
      title: 'Action', key: 'action', width: 80,
      render: (_, record) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => setViewModal({ visible: true, data: record, type: 'sales' })}>View</Button>
      )
    }
  ];

  const adjustmentColumns = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', width: 100, render: (val) => new Date(val).toLocaleDateString() },
    { title: 'Reference', dataIndex: 'reference_number', key: 'reference_number', width: 120, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 130, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 90, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    { title: 'Type', dataIndex: 'adjustment_type', key: 'adjustment_type', width: 90, render: (val) => val?.toUpperCase() },
    {
      title: 'Loss Type', dataIndex: 'loss_type', key: 'loss_type', width: 100,
      render: (val) => {
        const colors = { MISSING: 'red', DAMAGED: 'orange', EXPIRED: 'volcano', MANUAL: 'green', SYSTEM: 'blue' };
        return val ? <Tag color={colors[val] || 'default'}>{val}</Tag> : '-';
      }
    },
    { title: 'Qty', dataIndex: 'quantity_change', key: 'quantity_change', width: 70, render: (val) => formatNumber(Math.abs(val)) },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 130, ellipsis: true },
    { title: 'By', key: 'adjusted_by', width: 120, render: (_, record) => record.adjusted_by_name?.trim() || 'System' }
  ];

  const transferColumns = [
    { title: 'Date', dataIndex: 'created_at', key: 'created_at', width: 100, render: (val) => new Date(val).toLocaleDateString() },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 130, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 90, ellipsis: true },
    { title: 'From', dataIndex: 'from_warehouse', key: 'from_warehouse', width: 120, ellipsis: true },
    { title: 'To', dataIndex: 'to_warehouse', key: 'to_warehouse', width: 120, ellipsis: true },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70, render: (val) => formatNumber(val) },
    { title: 'Transfer ID', dataIndex: 'transfer_id', key: 'transfer_id', width: 120, ellipsis: true }
  ];

  const filterBar = (children) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: 16 }}>
      {children}
    </div>
  );

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 'clamp(18px, 4vw, 26px)', fontWeight: 700, margin: 0, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 10 }}>
          <DatabaseOutlined style={{ fontSize: 22, color: '#667eea' }} /> Reports & Analytics
        </h1>
        <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
          Overview of your inventory, sales and purchase activity
        </p>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card) => {
          const value = card.accessor
            ? card.accessor(dashboardData)
            : dashboardData[card.key] || 0;
          return (
            <Col xs={12} sm={12} md={6} key={card.key}>
              <div style={{
                background: card.gradient,
                borderRadius: 16,
                padding: '20px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                minHeight: 90,
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 12,
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {card.icon}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 'clamp(14px, 3vw, 20px)', fontWeight: 700, color: '#fff', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {card.isCurrency ? formatCurrency(value) : value}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>
                    {card.label}
                  </div>
                </div>
              </div>
            </Col>
          );
        })}
      </Row>

      {/* Tabs */}
      <Card
        style={{ borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', border: 'none' }}
        bodyStyle={{ padding: '0 0 16px' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{ padding: '0 16px', marginBottom: 0 }}
          items={[
            {
              key: 'inventory',
              label: <span><DatabaseOutlined style={{ marginRight: 6 }} />Inventory</span>,
              children: (
                <div style={{ padding: '16px' }}>
                  {filterBar(
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchInventoryReport} loading={loading}>
                      Refresh
                    </Button>
                  )}
                  <Table columns={inventoryColumns} dataSource={inventoryData} loading={loading} rowKey="id"
                    scroll={{ x: 'max-content' }} size="small" pagination={{ size: 'small', showSizeChanger: false }} />
                </div>
              )
            },
            {
              key: 'purchase',
              label: <span><ContainerOutlined style={{ marginRight: 6 }} />Purchases</span>,
              children: (
                <div style={{ padding: '16px' }}>
                  {filterBar(<>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchPurchaseReport} loading={loading}>Refresh</Button>
                    <DatePicker placeholder="From Date" value={purchaseFromDate} onChange={setPurchaseFromDate} style={{ width: 130 }} allowClear />
                    <DatePicker placeholder="To Date" value={purchaseToDate} onChange={setPurchaseToDate} style={{ width: 130 }} allowClear />
                    <Select placeholder="All Statuses" value={purchaseStatus} onChange={setPurchaseStatus} style={{ width: 150 }} allowClear>
                      <Select.Option value="draft">Draft</Select.Option>
                      <Select.Option value="sent">Sent</Select.Option>
                      <Select.Option value="confirmed">Confirmed</Select.Option>
                      <Select.Option value="partially_received">Partially Received</Select.Option>
                      <Select.Option value="received">Received</Select.Option>
                      <Select.Option value="cancelled">Cancelled</Select.Option>
                    </Select>
                  </>)}
                  <Table columns={purchaseColumns}
                    dataSource={purchaseData.filter(po => {
                      const statusMatch = !purchaseStatus || po.status === purchaseStatus;
                      const dateMatch = (!purchaseFromDate || !purchaseToDate) || (() => { const d = new Date(po.order_date); return d >= purchaseFromDate.startOf('day').toDate() && d <= purchaseToDate.endOf('day').toDate(); })();
                      return statusMatch && dateMatch;
                    })}
                    loading={loading} rowKey="id"
                    scroll={{ x: 'max-content' }} size="small" pagination={{ size: 'small', showSizeChanger: false }} />
                </div>
              )
            },
            {
              key: 'sales',
              label: <span><FileDoneOutlined style={{ marginRight: 6 }} />Sales</span>,
              children: (
                <div style={{ padding: '16px' }}>
                  {filterBar(<>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchSalesReport} loading={loading}>Refresh</Button>
                    <DatePicker placeholder="From Date" value={salesFromDate} onChange={setSalesFromDate} style={{ width: 130 }} allowClear />
                    <DatePicker placeholder="To Date" value={salesToDate} onChange={setSalesToDate} style={{ width: 130 }} allowClear />
                    <Select placeholder="All Statuses" value={salesStatus} onChange={setSalesStatus} style={{ width: 150 }} allowClear>
                      <Select.Option value="draft">Draft</Select.Option>
                      <Select.Option value="confirmed">Confirmed</Select.Option>
                      <Select.Option value="shipped">Shipped</Select.Option>
                      <Select.Option value="delivered">Delivered</Select.Option>
                      <Select.Option value="cancelled">Cancelled</Select.Option>
                    </Select>
                  </>)}
                  <Table columns={salesColumns}
                    dataSource={salesData.filter(so => {
                      const statusMatch = !salesStatus || so.status === salesStatus;
                      const dateMatch = (!salesFromDate || !salesToDate) || (() => { const d = new Date(so.order_date); return d >= salesFromDate.startOf('day').toDate() && d <= salesToDate.endOf('day').toDate(); })();
                      return statusMatch && dateMatch;
                    })}
                    loading={loading} rowKey="id"
                    scroll={{ x: 'max-content' }} size="small" pagination={{ size: 'small', showSizeChanger: false }} />
                </div>
              )
            },
            {
              key: 'adjustments',
              label: <span><AlertOutlined style={{ marginRight: 6 }} />Adjustments</span>,
              children: (
                <div style={{ padding: '16px' }}>
                  {filterBar(<>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchAdjustmentReport} loading={loading}>Refresh</Button>
                    <DatePicker placeholder="From Date" value={adjustmentFromDate} onChange={setAdjustmentFromDate} style={{ width: 130 }} allowClear />
                    <DatePicker placeholder="To Date" value={adjustmentToDate} onChange={setAdjustmentToDate} style={{ width: 130 }} allowClear />
                    <Select placeholder="Loss Type" value={adjustmentLossType} onChange={setAdjustmentLossType} style={{ width: 140 }} allowClear>
                      <Select.Option value="MISSING">Missing</Select.Option>
                      <Select.Option value="DAMAGED">Damaged</Select.Option>
                      <Select.Option value="EXPIRED">Expired</Select.Option>
                      <Select.Option value="ADJUSTMENT">Manual</Select.Option>
                    </Select>
                  </>)}
                  <Table columns={adjustmentColumns}
                    dataSource={adjustmentData.filter(item => {
                      const lossMatch = !adjustmentLossType || item.loss_type === adjustmentLossType;
                      const dateMatch = (!adjustmentFromDate || !adjustmentToDate) || (() => { const d = new Date(item.created_at); return d >= adjustmentFromDate.startOf('day').toDate() && d <= adjustmentToDate.endOf('day').toDate(); })();
                      return lossMatch && dateMatch;
                    })}
                    loading={loading} rowKey={(r) => `${r.created_at}-${r.item_name}`}
                    scroll={{ x: 'max-content' }} size="small" pagination={{ size: 'small', showSizeChanger: false }} />
                </div>
              )
            },
            {
              key: 'transfers',
              label: <span><ReloadOutlined style={{ marginRight: 6 }} />Transfers</span>,
              children: (
                <div style={{ padding: '16px' }}>
                  {filterBar(<>
                    <Button type="primary" icon={<ReloadOutlined />} onClick={fetchTransferReport} loading={loading}>Refresh</Button>
                    <DatePicker placeholder="From Date" value={transferFromDate} onChange={setTransferFromDate} style={{ width: 130 }} allowClear />
                    <DatePicker placeholder="To Date" value={transferToDate} onChange={setTransferToDate} style={{ width: 130 }} allowClear />
                  </>)}
                  <Table columns={transferColumns}
                    dataSource={transferData.filter(item => {
                      const dateMatch = (!transferFromDate || !transferToDate) || (() => { const d = new Date(item.created_at); return d >= transferFromDate.startOf('day').toDate() && d <= transferToDate.endOf('day').toDate(); })();
                      return dateMatch;
                    })}
                    loading={loading} rowKey={(r) => `${r.created_at}-${r.transfer_id}`}
                    scroll={{ x: 'max-content' }} size="small" pagination={{ size: 'small', showSizeChanger: false }} />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* View Modal */}
      <Modal
        title={
          <span style={{ fontWeight: 600 }}>
            {viewModal.type === 'inventory' ? <span><DatabaseOutlined style={{ marginRight: 6 }} />Inventory Details</span>
              : viewModal.type === 'purchase' ? <span><ContainerOutlined style={{ marginRight: 6 }} />Purchase Order Details</span>
              : <span><FileDoneOutlined style={{ marginRight: 6 }} />Sales Order Details</span>}
          </span>
        }
        open={viewModal.visible}
        onCancel={() => setViewModal({ visible: false, data: null, type: null })}
        footer={null}
        width="min(600px, 96vw)"
        style={{ top: 16 }}
      >
        {viewModal.data && (
          <>
          <Descriptions column={1} bordered size="small">
            {viewModal.type === 'inventory' && (<>
              <Descriptions.Item label="Item Name">{viewModal.data.item_name}</Descriptions.Item>
              <Descriptions.Item label="SKU">{viewModal.data.sku}</Descriptions.Item>
              <Descriptions.Item label="Warehouse">{viewModal.data.warehouse_name}</Descriptions.Item>
              <Descriptions.Item label="On Hand">{viewModal.data.quantity_on_hand}</Descriptions.Item>
              <Descriptions.Item label="Available">{viewModal.data.quantity_available}</Descriptions.Item>
              <Descriptions.Item label="Reserved">{viewModal.data.quantity_reserved}</Descriptions.Item>
              <Descriptions.Item label="Avg Cost">{formatCurrency(viewModal.data.average_cost || 0)}</Descriptions.Item>
              <Descriptions.Item label="Total Value">{formatCurrency(viewModal.data.total_value || 0)}</Descriptions.Item>
            </>)}
            {viewModal.type === 'purchase' && (<>
              <Descriptions.Item label="PO Number">{viewModal.data.po_number}</Descriptions.Item>
              <Descriptions.Item label="Vendor">{viewModal.data.vendor_name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={{ draft:'default',sent:'blue',confirmed:'cyan',partially_received:'orange',received:'green',cancelled:'red' }[viewModal.data.status]}>{viewModal.data.status?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Order Date">{viewModal.data.order_date ? new Date(viewModal.data.order_date).toLocaleDateString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Expected Date">{viewModal.data.expected_date ? new Date(viewModal.data.expected_date).toLocaleDateString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Currency">{viewModal.data.currency}</Descriptions.Item>
              <Descriptions.Item label="Total Amount">{formatCurrency(viewModal.data.total_amount || 0)}</Descriptions.Item>
              <Descriptions.Item label="Lines">{viewModal.data.line_count || 0}</Descriptions.Item>
              <Descriptions.Item label="Qty Ordered">{viewModal.data.total_quantity || 0}</Descriptions.Item>
              <Descriptions.Item label="Qty Received">{viewModal.data.total_received || 0}</Descriptions.Item>
              <Descriptions.Item label="Notes">{viewModal.data.notes || '—'}</Descriptions.Item>
            </>)}
            {viewModal.type === 'sales' && (<>
              <Descriptions.Item label="SO Number">{viewModal.data.so_number}</Descriptions.Item>
              <Descriptions.Item label="Customer">{viewModal.data.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={{ draft:'default',confirmed:'blue',shipped:'cyan',delivered:'green',cancelled:'red' }[viewModal.data.status]}>{viewModal.data.status?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Order Date">{viewModal.data.order_date ? new Date(viewModal.data.order_date).toLocaleDateString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Expected Ship">{viewModal.data.expected_ship_date ? new Date(viewModal.data.expected_ship_date).toLocaleDateString() : '—'}</Descriptions.Item>
              <Descriptions.Item label="Currency">{viewModal.data.currency}</Descriptions.Item>
              <Descriptions.Item label="Total Amount">{formatCurrency(viewModal.data.total_amount || 0)}</Descriptions.Item>
              <Descriptions.Item label="Lines">{viewModal.data.line_count || 0}</Descriptions.Item>
              <Descriptions.Item label="Qty Ordered">{viewModal.data.total_quantity || 0}</Descriptions.Item>
              <Descriptions.Item label="Qty Shipped">{viewModal.data.total_shipped || 0}</Descriptions.Item>
              <Descriptions.Item label="Channel">{viewModal.data.channel || '—'}</Descriptions.Item>
              <Descriptions.Item label="Notes">{viewModal.data.notes || '—'}</Descriptions.Item>
            </>)}
          </Descriptions>

          {/* Audit Trail */}
          <div style={{ marginTop: 20, padding: '14px 16px', background: '#f9f9ff', borderRadius: 10, border: '1px solid #e8e8ff' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#667eea', marginBottom: 10 }}>🕵️ Audit Trail</div>
            <Descriptions column={1} size="small">
              {viewModal.type !== 'inventory' && (
                <Descriptions.Item label="Created By">
                  <span style={{ fontWeight: 600 }}>
                    {(viewModal.data.created_by_name?.trim() || viewModal.data.adjusted_by_name?.trim()) || 'System'}
                  </span>
                  {(viewModal.data.created_by_email || viewModal.data.adjusted_by_email) && (
                    <span style={{ color: '#8c8c8c', marginLeft: 8, fontSize: 12 }}>
                      ({viewModal.data.created_by_email || viewModal.data.adjusted_by_email})
                    </span>
                  )}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Created At">
                {viewModal.data.created_at ? new Date(viewModal.data.created_at).toLocaleString() : '—'}
              </Descriptions.Item>
              {viewModal.data.updated_at && viewModal.data.updated_at !== viewModal.data.created_at && (
                <Descriptions.Item label="Last Updated">
                  {new Date(viewModal.data.updated_at).toLocaleString()}
                </Descriptions.Item>
              )}
              {viewModal.data.cancellation_reason && (
                <Descriptions.Item label="Cancellation Reason">
                  <span style={{ color: '#ff4d4f' }}>{viewModal.data.cancellation_reason}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default Reports;
