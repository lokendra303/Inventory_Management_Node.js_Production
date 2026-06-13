import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tabs, Alert, Row, Col, Dropdown
} from 'antd';
import { PlusOutlined, WarningOutlined, BellOutlined, MoreOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;

const BATCH_STATUS_COLORS = {
  active: 'green',
  expired: 'red',
  damaged: 'orange',
  recalled: 'volcano',
};

const SERIAL_STATUS_COLORS = {
  available: 'green',
  reserved: 'blue',
  sold: 'default',
  returned: 'orange',
  damaged: 'red',
};

const formatQty = (value) => parseFloat(value || 0).toFixed(2);

export default function BatchTracking() {
  const [batches, setBatches] = useState([]);
  const [serials, setSerials] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [serialModal, setSerialModal] = useState(false);
  const [consumeModal, setConsumeModal] = useState(false);
  const [datesModal, setDatesModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [activeTab, setActiveTab] = useState('batches');
  const [batchFilters, setBatchFilters] = useState({
    itemId: undefined,
    warehouseId: undefined,
    status: undefined,
    batchNumber: '',
  });
  const [batchForm] = Form.useForm();
  const [serialForm] = Form.useForm();
  const [consumeForm] = Form.useForm();
  const [datesForm] = Form.useForm();

  const watchedSerialItemId = Form.useWatch('itemId', serialForm);
  const watchedSerialWarehouseId = Form.useWatch('warehouseId', serialForm);

  const serialBatchOptions = useMemo(() => {
    if (!watchedSerialItemId || !watchedSerialWarehouseId) return [];
    return batches.filter(
      (b) => b.item_id === watchedSerialItemId
        && b.warehouse_id === watchedSerialWarehouseId
        && parseFloat(b.quantity_remaining || 0) > 0
        && b.status === 'active'
    );
  }, [batches, watchedSerialItemId, watchedSerialWarehouseId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const batchParams = {
        ...(batchFilters.itemId ? { itemId: batchFilters.itemId } : {}),
        ...(batchFilters.warehouseId ? { warehouseId: batchFilters.warehouseId } : {}),
        ...(batchFilters.status ? { status: batchFilters.status } : {}),
        ...(batchFilters.batchNumber?.trim() ? { batchNumber: batchFilters.batchNumber.trim() } : {}),
      };

      const [bRes, sRes, eRes, iRes, wRes] = await Promise.all([
        apiService.get('/batch-serial/batches', { params: batchParams }),
        apiService.get('/batch-serial/serials'),
        apiService.get('/batch-serial/expiry-alerts'),
        apiService.get('/items', { params: { status: 'active' } }),
        apiService.get('/warehouses', { params: { status: 'active' } }),
      ]);
      setBatches(bRes.data || []);
      setSerials(sRes.data || []);
      setExpiryAlerts(eRes.data || []);
      setItems(iRes.data || []);
      setWarehouses(wRes.data || []);
    } catch {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [batchFilters]);

  useEffect(() => { load(); }, [load]);

  const handleCreateBatch = async (values) => {
    try {
      await apiService.post('/batch-serial/batches', {
        ...values,
        manufactureDate: values.manufactureDate?.format('YYYY-MM-DD'),
        expiryDate: values.expiryDate?.format('YYYY-MM-DD'),
      });
      message.success('Batch created');
      setBatchModal(false);
      batchForm.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create batch');
    }
  };

  const handleCreateSerials = async (values) => {
    const serialNumbers = values.serialNumbers.split('\n').map((s) => s.trim()).filter(Boolean);
    try {
      await apiService.post('/batch-serial/serials', {
        ...values,
        serialNumbers,
        receivedDate: values.receivedDate?.format('YYYY-MM-DD'),
      });
      message.success(`${serialNumbers.length} serial(s) created`);
      setSerialModal(false);
      serialForm.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create serials');
    }
  };

  const handleConsumeBatch = async (values) => {
    if (!selectedBatch) return;
    try {
      await apiService.consumeBatch(selectedBatch.id, values.quantity);
      message.success('Batch quantity updated');
      setConsumeModal(false);
      setSelectedBatch(null);
      consumeForm.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to consume batch quantity');
    }
  };

  const updateBatchStatus = async (batchId, status) => {
    try {
      await apiService.updateBatchStatus(batchId, status);
      message.success(`Batch marked as ${status}`);
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to update batch status');
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await apiService.put(`/batch-serial/expiry-alerts/${alertId}/acknowledge`);
      message.success('Alert acknowledged');
      load();
    } catch {
      message.error('Failed to acknowledge');
    }
  };

  const openConsumeModal = (batch) => {
    setSelectedBatch(batch);
    consumeForm.setFieldsValue({ quantity: undefined });
    setConsumeModal(true);
  };

  const openDatesModal = (batch) => {
    setSelectedBatch(batch);
    datesForm.setFieldsValue({
      manufactureDate: batch.manufacture_date ? dayjs(batch.manufacture_date) : null,
      expiryDate: batch.expiry_date ? dayjs(batch.expiry_date) : null,
    });
    setDatesModal(true);
  };

  const handleUpdateBatchDates = async (values) => {
    if (!selectedBatch) return;
    try {
      await apiService.updateBatchDates(selectedBatch.id, {
        manufactureDate: values.manufactureDate?.format('YYYY-MM-DD') || null,
        expiryDate: values.expiryDate?.format('YYYY-MM-DD') || null,
      });
      message.success('Batch dates updated');
      setDatesModal(false);
      setSelectedBatch(null);
      datesForm.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to update batch dates');
    }
  };

  const batchColumns = [
    { title: 'Batch #', dataIndex: 'batch_number', key: 'batch_number', width: 130, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: 'Received',
      dataIndex: 'quantity_received',
      key: 'quantity_received',
      width: 90,
      render: formatQty,
    },
    {
      title: 'Available',
      key: 'quantity_remaining',
      width: 90,
      render: (_, record) => {
        const remaining = parseFloat(record.quantity_remaining ?? record.quantity_available ?? 0);
        const color = remaining <= 0 ? 'default' : remaining <= 10 ? 'orange' : 'green';
        return <Tag color={color}>{formatQty(remaining)}</Tag>;
      },
    },
    {
      title: 'Manufacture Date',
      dataIndex: 'manufacture_date',
      key: 'manufacture_date',
      width: 120,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
    },
    {
      title: 'Expiry',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      width: 120,
      render: (v) => {
        if (!v) return '-';
        const days = dayjs(v).diff(dayjs(), 'day');
        const color = days < 0 ? 'red' : days <= 30 ? 'orange' : days <= 90 ? 'gold' : 'green';
        return <Tag color={color}>{dayjs(v).format('DD MMM YYYY')}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v) => <Tag color={BATCH_STATUS_COLORS[v] || 'default'}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      fixed: 'right',
      render: (_, record) => {
        const remaining = parseFloat(record.quantity_remaining ?? record.quantity_available ?? 0);
        const menuItems = [
          { key: 'edit_dates', label: 'Edit manufacture / expiry dates' },
          ...(remaining > 0 && record.status === 'active'
            ? [{ key: 'consume', label: 'Consume qty' }]
            : []),
          ...(record.status !== 'damaged'
            ? [{ key: 'damaged', label: 'Mark damaged' }]
            : []),
          ...(record.status !== 'recalled'
            ? [{ key: 'recalled', label: 'Mark recalled' }]
            : []),
          ...(record.status !== 'expired'
            ? [{ key: 'expired', label: 'Mark expired' }]
            : []),
          ...(record.status !== 'active'
            ? [{ key: 'active', label: 'Mark active' }]
            : []),
        ];

        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                if (key === 'consume') {
                  openConsumeModal(record);
                  return;
                }
                if (key === 'edit_dates') {
                  openDatesModal(record);
                  return;
                }
                updateBatchStatus(record.id, key);
              },
            }}
            trigger={['click']}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];

  const serialColumns = [
    { title: 'Serial #', dataIndex: 'serial_number', key: 'serial_number', width: 140, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Batch #', dataIndex: 'batch_number', key: 'batch_number', width: 120, ellipsis: true, render: (v) => v || '-' },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v) => (
        <Tag color={SERIAL_STATUS_COLORS[v] || 'default'}>
          {v?.replace('_', ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Received',
      dataIndex: 'received_date',
      key: 'received_date',
      width: 120,
      render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
    },
  ];

  const alertColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 130, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Batch #', dataIndex: 'batch_number', key: 'batch_number', width: 120, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    {
      title: 'Expiry',
      dataIndex: 'expiry_date',
      key: 'expiry_date',
      width: 120,
      render: (v) => <Tag color="red">{dayjs(v).format('DD MMM YYYY')}</Tag>,
    },
    {
      title: 'Days Left',
      dataIndex: 'days_to_expiry',
      key: 'days_to_expiry',
      width: 100,
      render: (v) => {
        const color = v < 0 ? 'red' : v <= 30 ? 'orange' : 'gold';
        return <Tag color={color}>{v < 0 ? `${Math.abs(v)}d overdue` : `${v}d`}</Tag>;
      },
    },
    {
      title: 'Qty',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 70,
      render: formatQty,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v) => <Tag color={v === 'active' ? 'red' : 'default'}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: 'Action',
      key: 'action',
      width: 110,
      fixed: 'right',
      render: (_, r) => (r.status === 'active'
        ? <Button size="small" onClick={() => acknowledgeAlert(r.id)}>Acknowledge</Button>
        : null),
    },
  ];

  const activeAlerts = expiryAlerts.filter((a) => a.status === 'active');

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Batch & Serial Tracking</h2>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setBatchModal(true)}>New Batch</Button>
          <Button icon={<PlusOutlined />} type="primary" onClick={() => setSerialModal(true)}>Add Serials</Button>
        </Space>
      </div>

      {activeAlerts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message={`${activeAlerts.length} item(s) expiring within 90 days`}
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => setActiveTab('expiry')}>View Alerts</Button>}
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'batches',
            label: 'Batches',
            children: (
              <>
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                  <Col xs={24} sm={12} md={6}>
                    <Input
                      allowClear
                      placeholder="Search batch #"
                      value={batchFilters.batchNumber}
                      onChange={(e) => setBatchFilters((prev) => ({ ...prev, batchNumber: e.target.value.toUpperCase() }))}
                    />
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Select
                      allowClear
                      showSearch
                      optionFilterProp="children"
                      placeholder="Filter by item"
                      style={{ width: '100%' }}
                      value={batchFilters.itemId}
                      onChange={(value) => setBatchFilters((prev) => ({ ...prev, itemId: value }))}
                    >
                      {items.map((i) => <Option key={i.id} value={i.id}>{i.name} ({i.sku})</Option>)}
                    </Select>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Select
                      allowClear
                      placeholder="Filter by warehouse"
                      style={{ width: '100%' }}
                      value={batchFilters.warehouseId}
                      onChange={(value) => setBatchFilters((prev) => ({ ...prev, warehouseId: value }))}
                    >
                      {warehouses.map((w) => <Option key={w.id} value={w.id}>{w.name}</Option>)}
                    </Select>
                  </Col>
                  <Col xs={24} sm={12} md={6}>
                    <Select
                      allowClear
                      placeholder="Filter by status"
                      style={{ width: '100%' }}
                      value={batchFilters.status}
                      onChange={(value) => setBatchFilters((prev) => ({ ...prev, status: value }))}
                    >
                      {Object.keys(BATCH_STATUS_COLORS).map((status) => (
                        <Option key={status} value={status}>{status.toUpperCase()}</Option>
                      ))}
                    </Select>
                  </Col>
                </Row>
                <Table
                  columns={batchColumns}
                  dataSource={batches}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 20, size: 'small' }}
                  scroll={{ x: 'max-content' }}
                />
              </>
            ),
          },
          {
            key: 'serials',
            label: 'Serial Numbers',
            children: (
              <Table
                columns={serialColumns}
                dataSource={serials}
                rowKey="id"
                loading={loading}
                size="small"
                pagination={{ pageSize: 20, size: 'small' }}
                scroll={{ x: 'max-content' }}
              />
            ),
          },
          {
            key: 'expiry',
            label: (
              <span>
                <BellOutlined />
                {activeAlerts.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{activeAlerts.length}</Tag>}
                {' '}Expiry Alerts
              </span>
            ),
            children: (
              <Table
                columns={alertColumns}
                dataSource={expiryAlerts}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 20, size: 'small' }}
                scroll={{ x: 'max-content' }}
              />
            ),
          },
        ]}
      />

      <Modal
        title="Create Batch"
        open={batchModal}
        onCancel={() => { setBatchModal(false); batchForm.resetFields(); }}
        onOk={() => batchForm.submit()}
        okText="Create"
        width="min(480px, 96vw)"
        style={{ top: 16 }}
      >
        <Form form={batchForm} layout="vertical" onFinish={handleCreateBatch}>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select item">
              {items.map((i) => <Option key={i.id} value={i.id}>{i.name} ({i.sku})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.map((w) => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            name="batchNumber"
            label="Batch Number"
            rules={[{ required: true, message: 'Batch number is required' }]}
            getValueFromEvent={(event) => String(event?.target?.value || '').toUpperCase()}
          >
            <Input placeholder="Enter batch number" />
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="manufactureDate" label="Manufacture Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="expiryDate" label="Expiry Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="quantityReceived"
            label="Quantity"
            rules={[{ required: true, message: 'Quantity is required' }]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitCost" label="Unit Cost">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add Serial Numbers"
        open={serialModal}
        onCancel={() => { setSerialModal(false); serialForm.resetFields(); }}
        onOk={() => serialForm.submit()}
        okText="Add"
        width="min(480px, 96vw)"
        style={{ top: 16 }}
      >
        <Form form={serialForm} layout="vertical" onFinish={handleCreateSerials}>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="children"
              placeholder="Select item"
              onChange={() => serialForm.setFieldValue('batchId', undefined)}
            >
              {items.map((i) => <Option key={i.id} value={i.id}>{i.name} ({i.sku})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select
              placeholder="Select warehouse"
              onChange={() => serialForm.setFieldValue('batchId', undefined)}
            >
              {warehouses.map((w) => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="batchId" label="Link to Batch (optional)">
            <Select
              allowClear
              placeholder={serialBatchOptions.length ? 'Select batch' : 'Select item and warehouse first'}
              disabled={!serialBatchOptions.length}
            >
              {serialBatchOptions.map((b) => (
                <Option key={b.id} value={b.id}>
                  {b.batch_number} ({formatQty(b.quantity_remaining)} available)
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="serialNumbers" label="Serial Numbers (one per line)" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder={'SN001\nSN002\nSN003'} />
          </Form.Item>
          <Form.Item name="receivedDate" label="Received Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedBatch ? `Consume — ${selectedBatch.batch_number}` : 'Consume Batch Quantity'}
        open={consumeModal}
        onCancel={() => { setConsumeModal(false); setSelectedBatch(null); consumeForm.resetFields(); }}
        onOk={() => consumeForm.submit()}
        okText="Consume"
        width="min(420px, 96vw)"
      >
        {selectedBatch && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Available: ${formatQty(selectedBatch.quantity_remaining ?? selectedBatch.quantity_available)}`}
          />
        )}
        <Form form={consumeForm} layout="vertical" onFinish={handleConsumeBatch}>
          <Form.Item
            name="quantity"
            label="Quantity to consume"
            rules={[{ required: true, message: 'Quantity is required' }]}
          >
            <InputNumber
              min={0.01}
              step={0.01}
              max={selectedBatch ? parseFloat(selectedBatch.quantity_remaining ?? selectedBatch.quantity_available ?? 0) : undefined}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedBatch ? `Batch dates — ${selectedBatch.batch_number}` : 'Batch dates'}
        open={datesModal}
        onCancel={() => { setDatesModal(false); setSelectedBatch(null); datesForm.resetFields(); }}
        onOk={() => datesForm.submit()}
        okText="Save dates"
        width="min(420px, 96vw)"
        style={{ top: 16 }}
      >
        <Form form={datesForm} layout="vertical" onFinish={handleUpdateBatchDates}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="manufactureDate" label="Manufacture Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="expiryDate" label="Expiry Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
