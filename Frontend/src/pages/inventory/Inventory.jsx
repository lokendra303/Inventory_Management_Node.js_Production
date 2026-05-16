import React, { useState, useEffect, useMemo } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, InputNumber, message, Statistic, Row, Col, Empty, Tag, Timeline, Spin, Badge } from 'antd';
import { PlusOutlined, EyeOutlined, SearchOutlined, InboxOutlined, WarningOutlined, HistoryOutlined, DollarOutlined, ReloadOutlined, FilterOutlined, CheckCircleOutlined, LockOutlined, EnvironmentOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { formatNumber } from '../../utils/currency.js';
import { isOpeningStockReceipt } from '../../utils/inventoryReceipt';
import { useCurrency } from '../../contexts/CurrencyContext';
import ViewModeToggle from '../../components/common/ViewModeToggle';
import { usePersistedViewMode } from '../../hooks/usePersistedViewMode';
import InventoryOverviewGrid from '../../components/inventory/InventoryOverviewGrid';

const Inventory = () => {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [inventory, setInventory] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('receive');
  const [form] = Form.useForm();
  const [viewingRecord, setViewingRecord] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [overviewViewMode, setOverviewViewMode] = usePersistedViewMode('ims-inventory-overview-view-mode', 'list');
  const [overviewGridPage, setOverviewGridPage] = useState(1);
  const [overviewGridPageSize, setOverviewGridPageSize] = useState(12);
  const [stats, setStats] = useState({ totalValue: 0, totalItems: 0, lowStockCount: 0 });
  const [historyData, setHistoryData] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const canReceive = user?.permissions?.inventory_receive || user?.permissions?.all;
  const allowManualOperations = user?.permissions?.manual_inventory || user?.role === 'admin';
  const showManualButtons = process.env.REACT_APP_ENABLE_MANUAL_INVENTORY !== 'false' && allowManualOperations;

  const columns = [
    {
      title: 'Item',
      dataIndex: 'item_name',
      key: 'item_name',
      sorter: (a, b) => (a.item_name || '').localeCompare(b.item_name || ''),
      render: (val, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{val}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 1 }}>{record.sku}</div>
        </div>
      )
    },
    {
      title: 'Warehouse',
      dataIndex: 'warehouse_name',
      key: 'warehouse_name',
      sorter: (a, b) => (a.warehouse_name || '').localeCompare(b.warehouse_name || ''),
      render: (val) => (
        <Tag style={{ borderRadius: 12, fontSize: 11, padding: '1px 8px', background: '#f0f5ff', border: '1px solid #adc6ff', color: '#2f54eb' }}>
          {val}
        </Tag>
      )
    },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', render: (val) => <span style={{ color: '#595959', fontSize: 12 }}>{val}</span> },
    {
      title: 'On Hand',
      dataIndex: 'quantity_on_hand',
      key: 'quantity_on_hand',
      render: (val) => (
        <span style={{ fontWeight: 600, color: '#1890ff', fontSize: 13 }}>{formatNumber(val || 0)}</span>
      ),
      sorter: (a, b) => (a.quantity_on_hand || 0) - (b.quantity_on_hand || 0),
      align: 'right'
    },
    {
      title: 'Available',
      dataIndex: 'quantity_available',
      key: 'quantity_available',
      render: (val) => {
        const isLow = val <= 10;
        return (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <span style={{
              fontWeight: 700, fontSize: 13,
              color: isLow ? '#ff4d4f' : '#52c41a',
              background: isLow ? '#fff1f0' : '#f6ffed',
              border: `1px solid ${isLow ? '#ffa39e' : '#b7eb8f'}`,
              borderRadius: 8, padding: '1px 8px'
            }}>
              {formatNumber(val || 0)}
            </span>
            {isLow && <WarningOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
          </span>
        );
      },
      sorter: (a, b) => (a.quantity_available || 0) - (b.quantity_available || 0),
      align: 'right'
    },
    {
      title: 'Reserved',
      dataIndex: 'quantity_reserved',
      key: 'quantity_reserved',
      render: (val) => (
        <span style={{ color: '#fa8c16', fontWeight: 500, fontSize: 13 }}>{formatNumber(val || 0)}</span>
      ),
      sorter: (a, b) => (a.quantity_reserved || 0) - (b.quantity_reserved || 0),
      align: 'right'
    },
    {
      title: 'Avg Cost',
      dataIndex: 'average_cost',
      key: 'average_cost',
      render: (val) => (val && !isNaN(Number(val))) ? (
        <span style={{ color: '#595959', fontSize: 12 }}>{formatCurrency(val)}</span>
      ) : <span style={{ color: '#bfbfbf' }}>—</span>,
      sorter: (a, b) => (a.average_cost || 0) - (b.average_cost || 0),
      align: 'right'
    },
    {
      title: 'Total Value',
      dataIndex: 'total_value',
      key: 'total_value',
      render: (_, record) => {
        const v = (parseFloat(record.quantity_on_hand) || 0) * (parseFloat(record.average_cost) || 0);
        return v > 0 ? (
          <span style={{ fontWeight: 700, color: '#1890ff', fontSize: 13 }}>{formatCurrency(v)}</span>
        ) : <span style={{ color: '#bfbfbf' }}>—</span>;
      },
      sorter: (a, b) => {
        const vA = (parseFloat(a.quantity_on_hand) || 0) * (parseFloat(a.average_cost) || 0);
        const vB = (parseFloat(b.quantity_on_hand) || 0) * (parseFloat(b.average_cost) || 0);
        return vA - vB;
      },
      align: 'right'
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => openViewModal(record)}
          style={{
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            background: '#1890ff',
            color: '#fff',
            border: 'none',
            boxShadow: '0 2px 6px rgba(24,144,255,0.4)'
          }}
        >
          View
        </Button>
      )
    }
  ];

  const fetchData = async (warehouseFilter = selectedWarehouse) => {
    try {
      setLoading(true);
      const inventoryUrl = warehouseFilter === 'all' ? '/inventory' : `/inventory/warehouse/${warehouseFilter}`;
      const [inventoryRes, itemsRes, warehousesRes] = await Promise.all([
        apiService.get(inventoryUrl).catch((e) => { if (e.response?.status === 401) window.location.href = '/login'; return { success: false, data: [] }; }),
        apiService.get('/items').catch((e) => { if (e.response?.status === 401) window.location.href = '/login'; return { success: false, data: [] }; }),
        apiService.get('/warehouses').catch((e) => { if (e.response?.status === 401) window.location.href = '/login'; return { success: false, data: [] }; })
      ]);

      if (inventoryRes.success && inventoryRes.data.length > 0) {
        const totalValue = inventoryRes.data.reduce((sum, item) => sum + (parseFloat(item.quantity_on_hand) || 0) * (parseFloat(item.average_cost) || 0), 0);
        const lowStock = inventoryRes.data.filter(item => (item.quantity_available || 0) <= 10).length;
        setStats({ totalValue, totalItems: inventoryRes.data.length, lowStockCount: lowStock });
      } else {
        setStats({ totalValue: 0, totalItems: 0, lowStockCount: 0 });
      }

      setInventory(inventoryRes.success ? inventoryRes.data : []);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(warehousesRes.success ? warehousesRes.data : []);
    } catch (error) {
      if (error.response?.status === 401) window.location.href = '/login';
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleWarehouseChange = (warehouseId) => {
    setSelectedWarehouse(warehouseId);
    fetchData(warehouseId);
  };

  const handleOperation = async (values) => {
    try {
      const operationData = {
        ...values,
        poId: values.poId || '00000000-0000-0000-0000-000000000000',
        poLineId: values.poLineId || '00000000-0000-0000-0000-000000000000',
        grnNumber: values.grnNumber || `GRN-${Date.now()}`,
        soId: values.soId || '00000000-0000-0000-0000-000000000000',
        soLineId: values.soLineId || '00000000-0000-0000-0000-000000000000',
        shipmentNumber: values.shipmentNumber || `SHIP-${Date.now()}`,
      };
      const response = modalType === 'receive' ? await apiService.post('/inventory/receive', operationData) : null;
      if (response?.success) {
        message.success('Stock receive successful');
        setModalVisible(false);
        form.resetFields();
        setTimeout(() => fetchData(), 500);
      }
    } catch (error) {
      if (error.response?.status === 401) { window.location.href = '/login'; return; }
      message.error(`Failed to receive stock: ${error.response?.data?.error || error.message || 'Unknown error'}`);
    }
  };

  const openViewModal = async (record) => {
    setViewingRecord(record);
    setModalType('view');
    setModalVisible(true);
    setLoadingHistory(true);
    try {
      const response = await apiService.get(`/inventory/item-logs/${record.item_id}`, {
        params: {
          warehouseId: record.warehouse_id,
          ...(record.item_variant_id ? { itemVariantId: record.item_variant_id } : {})
        }
      });
      setHistoryData(response.success ? (response.data || []) : []);
    } catch {
      setHistoryData([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const openModal = (type) => {
    setModalType(type);
    setModalVisible(true);
    form.resetFields();
  };

  useEffect(() => { fetchData(); }, []);

  const filteredInventory = useMemo(() => {
    const q = (searchText || '').trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (r) =>
        (r.item_name || '').toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q)
    );
  }, [inventory, searchText]);

  useEffect(() => {
    setOverviewGridPage(1);
  }, [searchText, selectedWarehouse, overviewViewMode, inventory.length]);

  const getEventColor = (eventType) => {
    const type = String(eventType || '').toUpperCase();
    if (type.includes('RECEIVED') || type.includes('PURCHASERECEIVED')) return 'green';
    if (type.includes('SHIPPED') || type.includes('PURCHASERETURNED') || type.includes('DAMAGED') || type.includes('EXPIRED')) return 'red';
    if (type.includes('RESERVED')) return 'orange';
    if (type.includes('ADJUSTMENT') || type.includes('ADJUSTED')) return 'blue';
    if (type.includes('TRANSFER')) return 'purple';
    return 'gray';
  };

  const getEventLabel = (eventType, event) => {
    const type = String(eventType || '').toUpperCase();
    if (type.includes('PURCHASERECEIVED') && event && isOpeningStockReceipt(event)) {
      return 'Opening Stock';
    }
    if (type.includes('PURCHASERECEIVED') || type.includes('RECEIVED')) return 'Stock Received';
    if (type.includes('SALESHIPPED') || type.includes('SHIPPED')) return 'Stock Shipped';
    if (type.includes('SALERESERVED') || type.includes('RESERVED')) return 'Stock Reserved';
    if (type.includes('CANCELLED')) return 'Reservation Cancelled';
    if (type.includes('ADJUSTMENT') || type.includes('ADJUSTED')) return 'Stock Adjusted';
    if (type.includes('TRANSFERIN')) return 'Transfer In';
    if (type.includes('TRANSFEROUT')) return 'Transfer Out';
    if (type.includes('PURCHASERETURNED')) return 'Purchase Returned';
    if (type.includes('SALERETURNED')) return 'Sale Returned';
    if (type.includes('DAMAGED')) return 'Stock Damaged';
    if (type.includes('EXPIRED')) return 'Stock Expired';
    return eventType;
  };

  const renderModalContent = () => {
    if (modalType === 'receive') {
      return (
        <>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select placeholder="Select item" showSearch optionFilterProp="children">
              {items.filter(item => item.status === 'active').map(item => (
                <Select.Option key={item.id} value={item.id}>{item.name} ({item.sku})</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.filter(wh => wh.status === 'active').map(wh => (
                <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unitCost" label="Unit Cost" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </>
      );
    }

    if (modalType === 'view' && viewingRecord) {
      const totalValue = (parseFloat(viewingRecord.quantity_on_hand) || 0) * (parseFloat(viewingRecord.average_cost) || 0);
      const stockCards = [
        {
          label: 'On Hand',
          value: viewingRecord.quantity_on_hand || 0,
          icon: <InboxOutlined style={{ fontSize: 22 }} />,
          gradient: 'linear-gradient(135deg, #1677ff 0%, #2f54eb 100%)',
          shadow: '0 14px 30px rgba(22,119,255,0.22)'
        },
        {
          label: 'Available',
          value: viewingRecord.quantity_available || 0,
          icon: <CheckCircleOutlined style={{ fontSize: 22 }} />,
          gradient: 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
          shadow: '0 14px 30px rgba(82,196,26,0.22)'
        },
        {
          label: 'Reserved',
          value: viewingRecord.quantity_reserved || 0,
          icon: <LockOutlined style={{ fontSize: 22 }} />,
          gradient: 'linear-gradient(135deg, #fa8c16 0%, #d46b08 100%)',
          shadow: '0 14px 30px rgba(250,140,22,0.22)'
        }
      ];

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            style={{
              background: 'linear-gradient(135deg, #1d4ed8 0%, #5b21b6 55%, #7c3aed 100%)',
              borderRadius: 24,
              padding: '24px 24px 22px',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 18px 40px rgba(91,33,182,0.24)'
            }}
          >
            <div style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.10)' }} />
            <div style={{ position: 'absolute', left: -50, bottom: -70, width: 170, height: 170, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: '1 1 420px', minWidth: 0 }}>
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(255,255,255,0.16)',
                    border: '1px solid rgba(255,255,255,0.24)',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  <InboxOutlined style={{ fontSize: 30, color: '#fff' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.78, fontWeight: 600 }}>
                    Inventory Line Detail
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.15, marginTop: 4, wordBreak: 'break-word' }}>
                    {viewingRecord.item_name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                    <Tag color="blue" style={{ borderRadius: 999, margin: 0 }}>SKU: {viewingRecord.sku}</Tag>
                    <Tag color="cyan" style={{ borderRadius: 999, margin: 0 }}>Unit: {viewingRecord.unit}</Tag>
                    <Tag color="purple" style={{ borderRadius: 999, margin: 0 }}>
                      <EnvironmentOutlined style={{ marginRight: 6 }} />
                      {viewingRecord.warehouse_name}
                    </Tag>
                    {viewingRecord.variant_name && (
                      <Tag color="geekblue" style={{ borderRadius: 999, margin: 0 }}>
                        Variant: {viewingRecord.variant_name}
                      </Tag>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  minWidth: 220,
                  flex: '0 1 260px',
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: 20,
                  padding: '16px 18px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6, fontWeight: 600 }}>Current Inventory Value</div>
                <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>
                  {totalValue > 0 ? formatCurrency(totalValue) : '—'}
                </div>
                <div style={{ fontSize: 12, opacity: 0.78, marginTop: 8 }}>
                  Avg cost {viewingRecord.average_cost && !isNaN(Number(viewingRecord.average_cost))
                    ? formatCurrency(viewingRecord.average_cost)
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          <Row gutter={[16, 16]}>
            {stockCards.map((card) => (
              <Col xs={24} md={8} key={card.label}>
                <div
                  style={{
                    background: card.gradient,
                    borderRadius: 20,
                    padding: '18px 20px',
                    color: '#fff',
                    boxShadow: card.shadow,
                    minHeight: 140,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 14,
                        background: 'rgba(255,255,255,0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {card.icon}
                    </div>
                    <Tag style={{ borderRadius: 999, margin: 0, border: 'none', background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                      Live
                    </Tag>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{formatNumber(card.value)}</div>
                  <div style={{ fontSize: 13, opacity: 0.88, marginTop: 8 }}>{card.label}</div>
                </div>
              </Col>
            ))}
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card bordered={false} style={{ borderRadius: 18, boxShadow: '0 10px 26px rgba(15,23,42,0.08)' }} bodyStyle={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Average Cost</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#1677ff', marginTop: 4 }}>
                      {viewingRecord.average_cost && !isNaN(Number(viewingRecord.average_cost)) ? formatCurrency(viewingRecord.average_cost) : '—'}
                    </div>
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: '#e6f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarOutlined style={{ fontSize: 22, color: '#1677ff' }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#8c8c8c' }}>Weighted cost currently applied to this warehouse line.</div>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card bordered={false} style={{ borderRadius: 18, boxShadow: '0 10px 26px rgba(15,23,42,0.08)' }} bodyStyle={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#8c8c8c', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Total Value</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#52c41a', marginTop: 4 }}>
                      {totalValue > 0 ? formatCurrency(totalValue) : '—'}
                    </div>
                  </div>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: '#f6ffed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarOutlined style={{ fontSize: 22, color: '#52c41a' }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#8c8c8c' }}>Calculated from on-hand quantity multiplied by current average cost.</div>
              </Card>
            </Col>
          </Row>

          <Card bordered={false} style={{ borderRadius: 22, boxShadow: '0 14px 32px rgba(15,23,42,0.08)' }} bodyStyle={{ padding: '18px 20px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 14, background: '#e6f4ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HistoryOutlined style={{ color: '#1677ff', fontSize: 20 }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#1f2937' }}>Transaction History</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>Stock movements and inventory actions for this warehouse line</div>
                </div>
              </div>
              {historyData.length > 0 && <Badge count={historyData.length} style={{ background: '#1677ff' }} />}
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
            ) : historyData.length > 0 ? (
              <div style={{ maxHeight: 360, overflowY: 'auto', paddingRight: 6 }}>
                <Timeline>
                  {historyData.map((event, index) => {
                    const eventType = event.type || event.event_type;
                    const eventData = event.details || event.event_data || {};
                    const quantity = event.quantity ?? eventData.quantity;
                    const quantityChange = event.quantity_change ?? eventData.quantityChange;
                    const unitCost = eventData.unitCost || eventData.unitPrice || event.unit_cost;
                    const reason = event.reason || event.notes || eventData.reason;
                    const timestamp = event.timestamp || event.created_at;

                    return (
                      <Timeline.Item key={event.id || index} color={getEventColor(eventType)}>
                        <div style={{ background: '#fafbff', border: '1px solid #edf2ff', borderRadius: 16, padding: '12px 14px', boxShadow: '0 4px 14px rgba(15,23,42,0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                            <Tag color={getEventColor(eventType)} style={{ borderRadius: 999, margin: 0, fontSize: 11, fontWeight: 600 }}>
                              {getEventLabel(eventType, event)}
                            </Tag>
                            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                              {timestamp ? new Date(timestamp).toLocaleString() : '-'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: reason ? 10 : 0 }}>
                            {quantity != null && (
                              <Tag style={{ borderRadius: 999, margin: 0, background: '#f0f5ff', color: '#1d39c4', border: '1px solid #adc6ff' }}>
                                Qty: {formatNumber(quantity)}
                              </Tag>
                            )}
                            {quantityChange != null && (
                              <Tag
                                style={{
                                  borderRadius: 999,
                                  margin: 0,
                                  background: quantityChange > 0 ? '#f6ffed' : '#fff1f0',
                                  color: quantityChange > 0 ? '#389e0d' : '#cf1322',
                                  border: `1px solid ${quantityChange > 0 ? '#b7eb8f' : '#ffa39e'}`
                                }}
                              >
                                Change: {quantityChange > 0 ? '+' : ''}{formatNumber(quantityChange)}
                              </Tag>
                            )}
                            {unitCost != null && (
                              <Tag style={{ borderRadius: 999, margin: 0, background: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591' }}>
                                Cost: {formatCurrency(unitCost)}
                              </Tag>
                            )}
                          </div>

                          {reason && (
                            <div style={{ fontSize: 13, color: '#595959', background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', padding: '10px 12px' }}>
                              {reason}
                            </div>
                          )}
                        </div>
                      </Timeline.Item>
                    );
                  })}
                </Timeline>
              </div>
            ) : (
              <Empty description="No transaction history" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </div>
      );
    }
    return null;
  };

  const statCards = [
    {
      title: 'Total Inventory Value',
      value: formatCurrency(stats.totalValue),
      icon: <DollarOutlined style={{ fontSize: 28, opacity: 0.85 }} />,
      gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
      sub: 'Across all warehouses'
    },
    {
      title: 'Total SKUs',
      value: stats.totalItems,
      icon: <InboxOutlined style={{ fontSize: 28, opacity: 0.85 }} />,
      gradient: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
      sub: 'Active inventory lines'
    },
    {
      title: 'Low Stock Alerts',
      value: stats.lowStockCount,
      icon: <WarningOutlined style={{ fontSize: 28, opacity: 0.85 }} />,
      gradient: stats.lowStockCount > 0
        ? 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)'
        : 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)',
      sub: stats.lowStockCount > 0 ? 'Items need restocking' : 'All stock levels healthy'
    }
  ];

  const availablePct = stats.totalItems > 0
    ? Math.round((inventory.reduce((s, i) => s + (parseFloat(i.quantity_available) || 0), 0) /
      Math.max(inventory.reduce((s, i) => s + (parseFloat(i.quantity_on_hand) || 0), 0), 1)) * 100)
    : 0;

  return (
    <div style={{ padding: '20px 24px', background: 'linear-gradient(180deg,#f8f9ff 0%,#eef3ff 100%)', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
        flexWrap: 'wrap',
        gap: 12,
        background: 'linear-gradient(135deg,#1890ff 0%,#667eea 45%,#764ba2 100%)',
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: '0 10px 28px rgba(102,126,234,0.28)',
        color: '#fff'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Inventory Overview</h1>
          <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>
            Real-time stock visibility across warehouses and item lines
          </p>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tag color="blue" style={{ margin: 0, borderRadius: 14, border: 'none' }}>
              {selectedWarehouse === 'all' ? 'All Warehouses' : `Warehouse Filter Applied`}
            </Tag>
            <Tag color={stats.lowStockCount > 0 ? 'red' : 'green'} style={{ margin: 0, borderRadius: 14, border: 'none' }}>
              {stats.lowStockCount > 0 ? `${stats.lowStockCount} Low Stock` : 'Stock Healthy'}
            </Tag>
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => fetchData()} loading={loading} style={{ borderRadius: 10, border: 'none', fontWeight: 600 }}>
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card) => (
          <Col xs={24} sm={8} key={card.title}>
            <div style={{
              background: card.gradient,
              borderRadius: 18,
              padding: '20px 24px',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
              minHeight: 104,
              border: '1px solid rgba(255,255,255,0.14)',
              transition: 'all 0.22s ease'
            }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.title}</div>
                <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, marginBottom: 4 }}>{card.value}</div>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{card.sub}</div>
              </div>
              <div style={{ opacity: 0.7 }}>{card.icon}</div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Insight strip */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={8}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>Available Stock Ratio</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#11998e', lineHeight: 1.2 }}>{availablePct}%</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Available vs on-hand quantity</div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>Tracked Warehouses</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1890ff', lineHeight: 1.2 }}>
              {warehouses.filter(w => w.status === 'active').length}/{warehouses.length}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Active over total warehouses</div>
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>Inventory Coverage</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#764ba2', lineHeight: 1.2 }}>
              {stats.totalItems?.toLocaleString() || 0}
            </div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>Inventory lines currently tracked</div>
          </div>
        </Col>
      </Row>

      {/* Table Card */}
      <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 6px 18px rgba(0,0,0,0.08)', overflow: 'hidden', border: '1px solid #edf0f7' }}>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: 'linear-gradient(180deg,#ffffff,#fafbff)' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FilterOutlined style={{ color: '#8c8c8c' }} />
            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>Stock Ledger</span>
          </div>
          {showManualButtons && canReceive && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal('receive')}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #1890ff, #096dd9)', border: 'none', fontWeight: 600 }}
            >
              Receive Stock
            </Button>
          )}
          <Input
            placeholder="Search item or SKU…"
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220, borderRadius: 8 }}
            allowClear
          />
          <Select
            value={selectedWarehouse}
            onChange={handleWarehouseChange}
            style={{ width: 200, borderRadius: 8 }}
          >
            <Select.Option value="all">All Warehouses</Select.Option>
            {warehouses.filter(wh => wh.status === 'active').map(wh => (
              <Select.Option key={wh.id} value={wh.id}>{wh.name}</Select.Option>
            ))}
          </Select>
          <ViewModeToggle
            value={overviewViewMode}
            onChange={setOverviewViewMode}
            listTitle="Table view"
            gridTitle="Grid view"
          />
        </div>

        {overviewViewMode === 'grid' ? (
          <InventoryOverviewGrid
            rows={filteredInventory}
            loading={loading}
            formatCurrency={formatCurrency}
            page={overviewGridPage}
            pageSize={overviewGridPageSize}
            onPageChange={(p, ps) => {
              setOverviewGridPage(p);
              if (ps && ps !== overviewGridPageSize) {
                setOverviewGridPageSize(ps);
                setOverviewGridPage(1);
              }
            }}
            onView={(record) => openViewModal(record)}
          />
        ) : (
        <Table
          columns={columns}
          dataSource={filteredInventory}
          loading={loading}
          rowKey="id"
          rowClassName={(record) => (record.quantity_available || 0) <= 10 ? 'low-stock-row' : ''}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `${total} items`,
            pageSizeOptions: ['10', '20', '50', '100'],
            size: 'small',
            style: { padding: '12px 20px' }
          }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No inventory data available" style={{ padding: '40px 0' }} /> }}
          scroll={{ x: 1000 }}
          style={{ fontSize: 13 }}
        />
        )}
      </div>

      {/* Low stock row style */}
      <style>{`.low-stock-row { background: #fff9f9 !important; } .low-stock-row:hover > td { background: #fff1f0 !important; }`}</style>

      {/* View Modal */}
      <Modal
        title={null}
        open={modalVisible && modalType === 'view'}
        onCancel={() => { setModalVisible(false); setViewingRecord(null); setHistoryData([]); }}
        footer={[
          <Button key="close" type="primary" onClick={() => { setModalVisible(false); setViewingRecord(null); setHistoryData([]); }} style={{ borderRadius: 8 }}>
            Close
          </Button>
        ]}
        width="min(940px, 96vw)"
        style={{ top: 20 }}
        styles={{ body: { padding: '20px 24px', background: 'linear-gradient(180deg, #f8faff 0%, #eef3ff 100%)' } }}
      >
        {renderModalContent()}
      </Modal>

      {/* Receive Modal */}
      <Modal
        title={<span style={{ fontWeight: 700, fontSize: 16 }}>📥 Receive Stock</span>}
        open={modalVisible && modalType === 'receive'}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width="min(500px, 96vw)"
        style={{ top: 20 }}
      >
        <Form form={form} layout="vertical" onFinish={handleOperation} style={{ marginTop: 16 }}>
          {renderModalContent()}
          <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
            <Space>
              <Button type="primary" htmlType="submit" style={{ borderRadius: 8, fontWeight: 600 }}>Receive Stock</Button>
              <Button onClick={() => setModalVisible(false)} style={{ borderRadius: 8 }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Inventory;
