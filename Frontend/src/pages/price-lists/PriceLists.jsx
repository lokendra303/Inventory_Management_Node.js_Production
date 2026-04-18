import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber,
  Select, Tag, Space, Tabs, Popconfirm, message, Row, Col, Badge
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  TagsOutlined, StarFilled, StarOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext';
import { getCurrencies } from '../../utils/currency';

export default function PriceLists() {
  const { currency: activeCurrency, currencySymbol } = useCurrency(); // institution's active currency
  const allCurrencies = getCurrencies();
  const [lists, setLists] = useState([]);
  const [selected, setSelected] = useState(null);
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listModal, setListModal] = useState(false);
  const [itemModal, setItemModal] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [listForm] = Form.useForm();
  const [itemForm] = Form.useForm();

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/price-lists');
      if (res.success) setLists(res.data);
    } catch (e) {
      if (e?.isPermissionError || e?.response?.status === 403) {
        message.warning(e?.message || 'Price Lists feature is not available on your current plan. Please upgrade.');
      } else {
        message.error('Failed to load price lists');
      }
    }
    finally { setLoading(false); }
  }, []);

  const loadAllItems = useCallback(async () => {
    try {
      const res = await apiService.get('/items');
      if (res.success) setAllItems(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadLists(); loadAllItems(); }, [loadLists, loadAllItems]);

  const selectList = async (list) => {
    setSelected(list);
    try {
      const res = await apiService.get(`/price-lists/${list.id}`);
      if (res.success) setItems(res.data.items || []);
    } catch { message.error('Failed to load price list items'); }
  };

  // ── List CRUD ────────────────────────────────────────────────
  const openListModal = (record = null) => {
    setEditingList(record);
    listForm.setFieldsValue(record
      ? { name: record.name, description: record.description, currency: record.currency,
          pricelistType: record.pricelist_type, discountType: record.discount_type,
          discountValue: record.discount_value, isDefault: record.is_default }
      : { currency: activeCurrency || 'USD', pricelistType: 'sales',
          discountType: 'percentage', discountValue: 0 }
    );
    setListModal(true);
  };

  const saveList = async (values) => {
    try {
      if (editingList) {
        await apiService.put(`/price-lists/${editingList.id}`, values);
        message.success('Price list updated');
      } else {
        await apiService.post('/price-lists', values);
        message.success('Price list created');
      }
      setListModal(false);
      listForm.resetFields();
      setEditingList(null);
      loadLists();
    } catch { message.error('Failed to save price list'); }
  };

  const deleteList = async (id) => {
    try {
      await apiService.delete(`/price-lists/${id}`);
      message.success('Price list deleted');
      if (selected?.id === id) { setSelected(null); setItems([]); }
      loadLists();
    } catch { message.error('Failed to delete price list'); }
  };

  // ── Item overrides ───────────────────────────────────────────
  const openItemModal = (record = null) => {
    setEditingItem(record);
    itemForm.setFieldsValue(record
      ? { itemId: record.item_id, customPrice: record.custom_price,
          discountType: record.discount_type, discountValue: record.discount_value }
      : { discountType: 'percentage', discountValue: 0 }
    );
    setItemModal(true);
  };

  const saveItem = async (values) => {
    try {
      await apiService.post(`/price-lists/${selected.id}/items`, values);
      message.success('Item price saved');
      setItemModal(false);
      itemForm.resetFields();
      setEditingItem(null);
      selectList(selected);
    } catch { message.error('Failed to save item price'); }
  };

  const removeItem = async (itemId) => {
    try {
      await apiService.delete(`/price-lists/${selected.id}/items/${itemId}`);
      message.success('Item removed from price list');
      selectList(selected);
    } catch { message.error('Failed to remove item'); }
  };

  const listColumns = [
    {
      title: 'Name', key: 'name',
      render: (_, r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {r.is_default ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined style={{ color: '#d9d9d9' }} />}
          <span style={{ fontWeight: 600 }}>{r.name}</span>
        </div>
      )
    },
    { title: 'Type', dataIndex: 'pricelist_type', key: 'pricelist_type',
      render: v => <Tag color={v === 'sales' ? 'blue' : 'green'}>{v?.toUpperCase()}</Tag> },
    { title: 'Currency', dataIndex: 'currency', key: 'currency',
      render: v => {
        const info = allCurrencies.find(c => c.code === v);
        return <Tag>{info ? `${info.symbol} ${v}` : v}</Tag>;
      }
    },
    { title: 'Discount', key: 'discount',
      render: (_, r) => r.discount_value > 0
        ? <Tag color="orange">{r.discount_value}{r.discount_type === 'percentage' ? '%' : ' fixed'} off</Tag>
        : '—' },
    { title: 'Items', dataIndex: 'item_count', key: 'item_count',
      render: v => <Badge count={v || 0} showZero style={{ backgroundColor: '#667eea' }} /> },
    {
      title: 'Actions', key: 'actions', width: 120,
      render: (_, r) => (
        <Space>
          <Button size="small" onClick={() => selectList(r)}>View</Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openListModal(r)} />
          <Popconfirm title="Delete this price list?" onConfirm={() => deleteList(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  const itemColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', render: v => <strong>{v}</strong> },
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Base Price', dataIndex: 'base_price', key: 'base_price',
      render: v => v ? `${currencySymbol}${parseFloat(v).toFixed(2)}` : '—' },
    { title: 'Custom Price', dataIndex: 'custom_price', key: 'custom_price',
      render: v => v ? <Tag color="green">{currencySymbol}{parseFloat(v).toFixed(2)}</Tag> : '—' },
    { title: 'Discount', key: 'discount',
      render: (_, r) => r.discount_value > 0
        ? <Tag color="orange">{r.discount_value}{r.discount_type === 'percentage' ? '%' : ' fixed'}</Tag>
        : '—' },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openItemModal(r)} />
          <Popconfirm title="Remove from list?" onConfirm={() => removeItem(r.item_id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg,#11998e,#38ef7d)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <TagsOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Price Lists</div>
            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              Create custom pricing for different customer segments
            </div>
          </div>
        </div>
        <Button icon={<PlusOutlined />} size="large" onClick={() => openListModal()}
          style={{ background: '#fff', color: '#11998e', border: 'none', fontWeight: 700, borderRadius: 10 }}>
          New Price List
        </Button>
      </div>

      <Row gutter={16}>
        {/* Lists panel */}
        <Col xs={24} lg={selected ? 10 : 24}>
          <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
            title={<strong>All Price Lists ({lists.length})</strong>}>
            <Table dataSource={lists} columns={listColumns} rowKey="id"
              loading={loading} pagination={{ pageSize: 10 }} size="small"
              rowClassName={r => r.id === selected?.id ? 'ant-table-row-selected' : ''}
            />
          </Card>
        </Col>

        {/* Items panel */}
        {selected && (
          <Col xs={24} lg={14}>
            <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TagsOutlined style={{ color: '#11998e' }} />
                  <strong>{selected.name}</strong>
                  <Tag color="blue">{selected.pricelist_type}</Tag>
                </div>
              }
              extra={
                <Space>
                  <Button icon={<PlusOutlined />} onClick={() => openItemModal()}
                    style={{ background: '#11998e', color: '#fff', border: 'none', borderRadius: 8 }}>
                    Add Item
                  </Button>
                  <Button onClick={() => { setSelected(null); setItems([]); }}>Close</Button>
                </Space>
              }
            >
              <Table dataSource={items} columns={itemColumns} rowKey="item_id"
                pagination={{ pageSize: 10 }} size="small"
                locale={{ emptyText: 'No item overrides yet. Add items to set custom prices.' }} />
            </Card>
          </Col>
        )}
      </Row>

      {/* Price List Modal */}
      <Modal title={editingList ? 'Edit Price List' : 'New Price List'}
        open={listModal} onCancel={() => { setListModal(false); setEditingList(null); listForm.resetFields(); }}
        footer={null} width={520}>
        <Form form={listForm} layout="vertical" onFinish={saveList} style={{ marginTop: 16 }}>
          <Form.Item name="name" label="List Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Wholesale, VIP Customers, Retail" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input placeholder="Optional description" />
          </Form.Item>

          {/* Currency — defaults to institution active currency */}
          <Form.Item
            name="currency"
            label="Currency"
            extra={<span style={{ fontSize: 11, color: '#8c8c8c' }}>Defaults to your active currency ({activeCurrency})</span>}
          >
            <Select showSearch optionFilterProp="children" style={{ width: '100%' }}>
              {allCurrencies.map(c => (
                <Select.Option key={c.code} value={c.code}>
                  {c.symbol} {c.code} — {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={14}>
            <Col span={8}>
              <Form.Item name="pricelistType" label="Type">
                <Select>
                  <Select.Option value="sales">Sales</Select.Option>
                  <Select.Option value="purchase">Purchase</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="discountType" label="Discount Type">
                <Select>
                  <Select.Option value="percentage">Percentage</Select.Option>
                  <Select.Option value="fixed">Fixed Amount</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="discountValue" label="Discount Value">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit"
                style={{ background: 'linear-gradient(135deg,#11998e,#38ef7d)', border: 'none' }}>
                {editingList ? 'Update' : 'Create'}
              </Button>
              <Button onClick={() => { setListModal(false); setEditingList(null); listForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Item Override Modal */}
      <Modal title={editingItem ? 'Edit Item Price' : 'Add Item to Price List'}
        open={itemModal} onCancel={() => { setItemModal(false); setEditingItem(null); itemForm.resetFields(); }}
        footer={null} width={480}>
        <Form form={itemForm} layout="vertical" onFinish={saveItem} style={{ marginTop: 16 }}>
          {!editingItem && (
            <Form.Item name="itemId" label="Select Item" rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="children" placeholder="Search items...">
                {allItems.map(i => (
                  <Select.Option key={i.id} value={i.id}>{i.name} ({i.sku})</Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Row gutter={14}>
            <Col span={12}>
              <Form.Item name="customPrice" label="Custom Price (optional)">
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }}
                  placeholder="Override base price" addonBefore={currencySymbol} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="discountValue" label="Discount">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="discountType" label="Discount Type">
            <Select>
              <Select.Option value="percentage">Percentage (%)</Select.Option>
              <Select.Option value="fixed">Fixed Amount</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit"
                style={{ background: 'linear-gradient(135deg,#11998e,#38ef7d)', border: 'none' }}>
                Save
              </Button>
              <Button onClick={() => { setItemModal(false); setEditingItem(null); itemForm.resetFields(); }}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
