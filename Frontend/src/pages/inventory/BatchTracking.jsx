import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Select, DatePicker,
  InputNumber, Input, message, Tabs, Tooltip, Alert, Row, Col
} from 'antd';
import { PlusOutlined, WarningOutlined, BellOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Option } = Select;
const { TabPane } = Tabs;

export default function BatchTracking() {
  const [batches, setBatches] = useState([]);
  const [serials, setSerials] = useState([]);
  const [expiryAlerts, setExpiryAlerts] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batchModal, setBatchModal] = useState(false);
  const [serialModal, setSerialModal] = useState(false);
  const [activeTab, setActiveTab] = useState('batches');
  const [batchForm] = Form.useForm();
  const [serialForm] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes, eRes, iRes, wRes] = await Promise.all([
        apiService.get('/inventory/batches'),
        apiService.get('/inventory/serials'),
        apiService.get('/inventory/expiry-alerts'),
        apiService.get('/items', { params: { status: 'active' } }),
        apiService.get('/warehouses', { params: { status: 'active' } })
      ]);
      setBatches(bRes.data || []);
      setSerials(sRes.data || []);
      setExpiryAlerts(eRes.data || []);
      setItems(iRes.data || []);
      setWarehouses(wRes.data || []);
    } catch { message.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateBatch = async (values) => {
    try {
      await apiService.post('/inventory/batches', {
        ...values,
        manufactureDate: values.manufactureDate?.format('YYYY-MM-DD'),
        expiryDate: values.expiryDate?.format('YYYY-MM-DD')
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
    const serialNumbers = values.serialNumbers.split('\n').map(s => s.trim()).filter(Boolean);
    try {
      await apiService.post('/inventory/serials', { ...values, serialNumbers });
      message.success(`${serialNumbers.length} serial(s) created`);
      setSerialModal(false);
      serialForm.resetFields();
      load();
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to create serials');
    }
  };

  const acknowledgeAlert = async (alertId) => {
    try {
      await apiService.put(`/inventory/expiry-alerts/${alertId}/acknowledge`);
      message.success('Alert acknowledged');
      load();
    } catch { message.error('Failed to acknowledge'); }
  };

  const batchColumns = [
    { title: 'Batch #', dataIndex: 'batch_number', key: 'batch_number', width: 130, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    { title: 'Available', dataIndex: 'quantity_available', key: 'quantity_available', width: 90,
      render: v => parseFloat(v || 0).toFixed(2) },
    { title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry_date', width: 120,
      render: v => {
        if (!v) return '-';
        const days = dayjs(v).diff(dayjs(), 'day');
        const color = days < 0 ? 'red' : days <= 30 ? 'orange' : days <= 90 ? 'gold' : 'green';
        return <Tag color={color}>{dayjs(v).format('DD MMM YYYY')}</Tag>;
      }
    },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: v => {
        const colors = { active: 'green', quarantine: 'orange', expired: 'red', consumed: 'default' };
        return <Tag color={colors[v]}>{v?.toUpperCase()}</Tag>;
      }
    }
  ];

  const serialColumns = [
    { title: 'Serial #', dataIndex: 'serial_number', key: 'serial_number', width: 140, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: v => {
        const colors = { in_stock: 'green', reserved: 'blue', sold: 'default', returned: 'orange', damaged: 'red' };
        return <Tag color={colors[v]}>{v?.replace('_', ' ').toUpperCase()}</Tag>;
      }
    },
    { title: 'Received', dataIndex: 'received_date', key: 'received_date', width: 120,
      render: v => v ? dayjs(v).format('DD MMM YYYY') : '-' }
  ];

  const alertColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 130, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100, ellipsis: true },
    { title: 'Batch #', dataIndex: 'batch_number', key: 'batch_number', width: 120, ellipsis: true },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', width: 120, ellipsis: true },
    { title: 'Expiry', dataIndex: 'expiry_date', key: 'expiry_date', width: 120,
      render: v => <Tag color="red">{dayjs(v).format('DD MMM YYYY')}</Tag> },
    { title: 'Days Left', dataIndex: 'days_to_expiry', key: 'days_to_expiry', width: 100,
      render: v => {
        const color = v < 0 ? 'red' : v <= 30 ? 'orange' : 'gold';
        return <Tag color={color}>{v < 0 ? `${Math.abs(v)}d overdue` : `${v}d`}</Tag>;
      }
    },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', width: 70,
      render: v => parseFloat(v || 0).toFixed(2) },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: v => <Tag color={v === 'active' ? 'red' : 'default'}>{v?.toUpperCase()}</Tag> },
    { title: 'Action', key: 'action', width: 110, fixed: 'right',
      render: (_, r) => r.status === 'active'
        ? <Button size="small" onClick={() => acknowledgeAlert(r.id)}>Acknowledge</Button>
        : null
    }
  ];

  const activeAlerts = expiryAlerts.filter(a => a.status === 'active');

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
          type="warning" showIcon icon={<WarningOutlined />}
          message={`${activeAlerts.length} item(s) expiring within 90 days`}
          style={{ marginBottom: 16 }}
          action={<Button size="small" onClick={() => setActiveTab('expiry')}>View Alerts</Button>}
        />
      )}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Batches" key="batches">
          <Table columns={batchColumns} dataSource={batches} rowKey="id"
            loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }} scroll={{ x: 'max-content' }} />
        </TabPane>
        <TabPane tab="Serial Numbers" key="serials">
          <Table columns={serialColumns} dataSource={serials} rowKey="id"
            loading={loading} size="small" pagination={{ pageSize: 20, size: 'small' }} scroll={{ x: 'max-content' }} />
        </TabPane>
        <TabPane
          tab={<span><BellOutlined />{activeAlerts.length > 0 && <Tag color="red" style={{ marginLeft: 4 }}>{activeAlerts.length}</Tag>} Expiry Alerts</span>}
          key="expiry"
        >
          <Table columns={alertColumns} dataSource={expiryAlerts} rowKey="id"
            size="small" pagination={{ pageSize: 20, size: 'small' }} scroll={{ x: 'max-content' }} />
        </TabPane>
      </Tabs>

      {/* Create Batch Modal */}
      <Modal title="Create Batch" open={batchModal}
        onCancel={() => { setBatchModal(false); batchForm.resetFields(); }}
        onOk={() => batchForm.submit()} okText="Create"
        width="min(480px, 96vw)" style={{ top: 16 }}>
        <Form form={batchForm} layout="vertical" onFinish={handleCreateBatch}>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select item">
              {items.map(i => <Option key={i.id} value={i.id}>{i.name} ({i.sku})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="batchNumber" label="Batch Number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="lotNumber" label="Lot Number"><Input /></Form.Item>
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
          <Form.Item name="quantityReceived" label="Quantity" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="unitCost" label="Unit Cost">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Serials Modal */}
      <Modal title="Add Serial Numbers" open={serialModal}
        onCancel={() => { setSerialModal(false); serialForm.resetFields(); }}
        onOk={() => serialForm.submit()} okText="Add"
        width="min(480px, 96vw)" style={{ top: 16 }}>
        <Form form={serialForm} layout="vertical" onFinish={handleCreateSerials}>
          <Form.Item name="itemId" label="Item" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="children" placeholder="Select item">
              {items.map(i => <Option key={i.id} value={i.id}>{i.name} ({i.sku})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select placeholder="Select warehouse">
              {warehouses.map(w => <Option key={w.id} value={w.id}>{w.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="serialNumbers" label="Serial Numbers (one per line)" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder="SN001&#10;SN002&#10;SN003" />
          </Form.Item>
          <Form.Item name="unitCost" label="Unit Cost">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="receivedDate" label="Received Date">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
