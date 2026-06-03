import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Form,
  Select,
  InputNumber,
  Input,
  Button,
  message,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Spin,
  Typography,
  Divider,
} from 'antd';
import { BuildOutlined, UndoOutlined, ReloadOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { filterSelectOption } from '../../utils/selectFilter';

const { Text } = Typography;

const KitAssembly = () => {
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [disassembling, setDisassembling] = useState(false);
  const [assembleForm] = Form.useForm();
  const [disassembleForm] = Form.useForm();

  const compositeItems = items.filter((i) => String(i.type || '').toLowerCase() === 'composite' && i.status === 'active');

  const fetchLookups = async () => {
    try {
      const [itemsRes, whRes] = await Promise.all([
        apiService.get('/items'),
        apiService.get('/warehouses'),
      ]);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(whRes.success ? whRes.data.filter((w) => w.status === 'active') : []);
    } catch {
      message.error('Failed to load items and warehouses');
    }
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  const loadAvailability = useCallback(async (compositeItemId, warehouseId) => {
    if (!compositeItemId || !warehouseId) {
      setAvailability(null);
      return;
    }
    try {
      setLoadingAvail(true);
      const res = await apiService.get(
        `/inventory/composite/${compositeItemId}/${warehouseId}/availability`
      );
      setAvailability(res.success ? res.data : null);
    } catch (err) {
      setAvailability(null);
      message.error(err?.response?.data?.error || 'Could not load kit availability');
    } finally {
      setLoadingAvail(false);
    }
  }, []);

  const onAssembleFieldsChange = (_, all) => {
    loadAvailability(all.compositeItemId, all.warehouseId);
  };

  const onDisassembleFieldsChange = (_, all) => {
    loadAvailability(all.compositeItemId, all.warehouseId);
  };

  const handleAssemble = async (values) => {
    try {
      setAssembling(true);
      const res = await apiService.post('/inventory/assemble-kit', values);
      if (res.success) {
        message.success(`Assembled ${values.quantity} kit(s)`);
        assembleForm.resetFields(['quantity', 'notes']);
        loadAvailability(values.compositeItemId, values.warehouseId);
      }
    } catch (err) {
      message.error(err?.response?.data?.error || 'Assembly failed');
    } finally {
      setAssembling(false);
    }
  };

  const handleDisassemble = async (values) => {
    try {
      setDisassembling(true);
      const res = await apiService.post('/inventory/disassemble-kit', values);
      if (res.success) {
        message.success(`Disassembled ${values.quantity} kit(s) into components`);
        disassembleForm.resetFields(['quantity', 'notes']);
        loadAvailability(values.compositeItemId, values.warehouseId);
      }
    } catch (err) {
      message.error(err?.response?.data?.error || 'Disassembly failed');
    } finally {
      setDisassembling(false);
    }
  };

  const componentColumns = [
    { title: 'Component', dataIndex: 'name', key: 'name', render: (t, r) => `${t || '—'} (${r.sku || ''})` },
    { title: 'Per kit', dataIndex: 'quantityRequiredPerKit', key: 'qty' },
    { title: 'Available', dataIndex: 'available', key: 'avail' },
    {
      title: 'Kits possible',
      dataIndex: 'kitsSupportable',
      key: 'kits',
      render: (v) => <Tag color={v > 0 ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: 'Consume on',
      dataIndex: 'consumptionTiming',
      key: 'timing',
      render: (v) => <Tag>{v === 'order' ? 'Order' : 'Shipment'}</Tag>,
    },
  ];

  const availabilityPanel = (
    <Spin spinning={loadingAvail}>
      {availability ? (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Text type="secondary">Finished kits on hand</Text>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{availability.kitOnHand}</div>
                <Text type="secondary">Available: {availability.kitAvailable}</Text>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Text type="secondary">Buildable from parts</Text>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{availability.buildableFromComponents}</div>
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card size="small">
                <Text type="secondary">Sales mode</Text>
                <div style={{ marginTop: 8 }}>
                  <Tag color={availability.fulfillmentMode === 'prebuilt' ? 'blue' : 'purple'}>
                    {availability.fulfillmentMode === 'prebuilt' ? 'Pre-built kits' : 'Explode on ship'}
                  </Tag>
                </div>
              </Card>
            </Col>
          </Row>
          <Table
            size="small"
            rowKey="componentItemId"
            pagination={false}
            dataSource={availability.componentDetails || []}
            columns={componentColumns}
          />
        </Space>
      ) : (
        <Text type="secondary">Select a kit and warehouse to see stock and BOM usage.</Text>
      )}
    </Spin>
  );

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={3} style={{ marginBottom: 8 }}>
        <BuildOutlined /> Kit assembly
      </Typography.Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Build finished kits from BOM components (parts go down, kit stock goes up). Use disassembly to break kits back into parts.
      </Text>

      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <Card title="Assemble kits" bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Form
              form={assembleForm}
              layout="vertical"
              onFinish={handleAssemble}
              onValuesChange={onAssembleFieldsChange}
            >
              <Form.Item name="compositeItemId" label="Kit item" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select composite item"
                  filterOption={filterSelectOption}
                  options={compositeItems.map((i) => ({
                    value: i.id,
                    label: `${i.name} (${i.sku})`,
                  }))}
                />
              </Form.Item>
              <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Warehouse"
                  filterOption={filterSelectOption}
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
              </Form.Item>
              <Form.Item
                name="quantity"
                label="Quantity to build"
                rules={[{ required: true, type: 'number', min: 0.0001 }]}
              >
                <InputNumber min={0.0001} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="notes" label="Notes (optional)">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={assembling} icon={<BuildOutlined />}>
                Assemble
              </Button>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Disassemble kits" bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <Form
              form={disassembleForm}
              layout="vertical"
              onFinish={handleDisassemble}
              onValuesChange={onDisassembleFieldsChange}
            >
              <Form.Item name="compositeItemId" label="Kit item" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select composite item"
                  filterOption={filterSelectOption}
                  options={compositeItems.map((i) => ({
                    value: i.id,
                    label: `${i.name} (${i.sku})`,
                  }))}
                />
              </Form.Item>
              <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Warehouse"
                  filterOption={filterSelectOption}
                  options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                />
              </Form.Item>
              <Form.Item
                name="quantity"
                label="Quantity to break down"
                rules={[{ required: true, type: 'number', min: 0.0001 }]}
              >
                <InputNumber min={0.0001} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="notes" label="Notes (optional)">
                <Input.TextArea rows={2} maxLength={500} />
              </Form.Item>
              <Button htmlType="submit" loading={disassembling} icon={<UndoOutlined />}>
                Disassemble
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card
        title={
          <Space>
            <span>Stock & BOM preview</span>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                const a = assembleForm.getFieldsValue();
                loadAvailability(a.compositeItemId, a.warehouseId);
              }}
            >
              Refresh
            </Button>
          </Space>
        }
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
      >
        {availabilityPanel}
      </Card>
    </div>
  );
};

export default KitAssembly;
