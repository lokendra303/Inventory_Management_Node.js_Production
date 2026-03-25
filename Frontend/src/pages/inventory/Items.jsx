import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, message, Form, Input, Select, InputNumber, Row, Col, Upload, Timeline, Tag, Spin, Empty, Tabs, Badge, Statistic, Divider, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, UploadOutlined, HistoryOutlined, SearchOutlined, DollarOutlined, BarcodeOutlined, AppstoreOutlined, UnorderedListOutlined, InboxOutlined, ShopOutlined, TagsOutlined, WarningOutlined } from '@ant-design/icons';
import { lookupProductByBarcode } from '../../utils/openFoodFacts';
import BarcodeScannerModal from '../../components/common/BarcodeScannerModal';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice, convertPrice, getCurrencies } from '../../utils/currency';
import CustomizableDropdown from '../../components/common/CustomizableDropdown';

const Items = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [priceCurrency, setPriceCurrency] = useState('USD');
  const [currencies] = useState(getCurrencies());
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingItem, setViewingItem] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();
  const [unitOptions, setUnitOptions] = useState([]);
  const [manufacturerOptions, setManufacturerOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [vendorOptions, setVendorOptions] = useState([]);
  const [itemHistory, setItemHistory] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Check if user can manage items
  const canManageCategories = user?.permissions?.category_management || user?.permissions?.all;
  const canManageItems = user?.permissions?.item_management || user?.permissions?.all;

  const columns = [
    {
      title: 'Item',
      key: 'item',
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {record.image ? (
            <img src={record.image} alt={record.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid #f0f0f0' }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #667eea22, #764ba222)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#764ba2', fontSize: 16 }}><InboxOutlined /></div>
          )}
          <div>
            <div style={{ fontWeight: 600, color: '#1a1a2e', fontSize: 13 }}>{record.name}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.sku}</div>
          </div>
        </div>
      )
    },
    { title: 'Type', dataIndex: 'type', key: 'type', render: v => v ? <Tag color="blue" style={{ borderRadius: 20, textTransform: 'capitalize' }}>{v}</Tag> : '-' },
    { title: 'Category', dataIndex: 'category', key: 'category', render: v => v ? <Tag color="orange" style={{ borderRadius: 20 }}>{v}</Tag> : '-' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit', render: v => v || '-' },
    {
      title: 'On Hand',
      dataIndex: 'current_stock',
      key: 'current_stock',
      render: (val, record) => {
        const stock = val || 0;
        const low = stock <= (record.min_stock_level || 0);
        const display = stock % 1 === 0 ? Math.floor(stock) : stock.toFixed(2);
        return (
          <Tag color={low ? 'red' : 'green'} style={{ borderRadius: 20, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>
            {low && <WarningOutlined style={{ marginRight: 4 }} />}{display}
          </Tag>
        );
      }
    },
    { title: 'Cost Price', dataIndex: 'cost_price', key: 'cost_price', render: val => val ? <span style={{ fontWeight: 600, color: '#595959' }}>{formatPrice(val, currency, 'USD')}</span> : '-' },
    { title: 'Selling Price', dataIndex: 'selling_price', key: 'selling_price', render: val => val ? <span style={{ fontWeight: 700, color: '#667eea' }}>{formatPrice(val, currency, 'USD')}</span> : '-' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: status => <Badge status={status === 'active' ? 'success' : 'error'} text={<span style={{ fontWeight: 500, textTransform: 'capitalize' }}>{status}</span>} />
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size={6}>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => viewItem(record)}
            style={{ borderRadius: 6, background: '#f0f0ff', borderColor: '#667eea', color: '#667eea', fontWeight: 600 }}
          >
            View
          </Button>
          {canManageItems && (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => editItem(record)}
              style={{ borderRadius: 6, background: '#667eea', border: 'none', color: '#fff', fontWeight: 600 }}
            >
              Edit
            </Button>
          )}
          {canManageItems && (
            <Button
              size="small"
              onClick={() => toggleItemStatus(record)}
              style={{
                borderRadius: 6, fontWeight: 600,
                ...(record.status === 'active'
                  ? { background: '#fff1f0', borderColor: '#ff4d4f', color: '#ff4d4f' }
                  : { background: '#52c41a', border: 'none', color: '#fff' })
              }}
            >
              {record.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </Space>
      )
    }
  ];

  const fetchDropdownOptions = async () => {
    try {
      // Use Promise.allSettled to handle individual failures gracefully
      const results = await Promise.allSettled([
        apiService.get('/manufacturers'),
        apiService.get('/brands'),
        apiService.get('/units'),
        apiService.get('/vendors')
      ]);
      
      const [manufacturersRes, brandsRes, unitsRes, vendorsRes] = results;
      
      if (manufacturersRes.status === 'fulfilled') {
        const manufacturers = Array.isArray(manufacturersRes.value) ? manufacturersRes.value : (manufacturersRes.value?.data || []);
        setManufacturerOptions(manufacturers);
      }
      
      if (brandsRes.status === 'fulfilled') {
        const brands = Array.isArray(brandsRes.value) ? brandsRes.value : (brandsRes.value?.data || []);
        setBrandOptions(brands);
      }
      
      if (unitsRes.status === 'fulfilled') {
        const units = Array.isArray(unitsRes.value) ? unitsRes.value : (unitsRes.value?.data || []);
        setUnitOptions(units);
      }
      
      if (vendorsRes.status === 'fulfilled') {
        const vendors = Array.isArray(vendorsRes.value) ? vendorsRes.value : (vendorsRes.value?.data || []);
        setVendorOptions(vendors);
      }
    } catch (error) {
      console.error('Dropdown fetch error:', error);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      
      // Stagger API calls to prevent 429 errors
      const itemsResponse = await apiService.get('/items', { params: { status: 'all' } });
      
      if (itemsResponse.success) {
        setItems(itemsResponse.data);
      }
      
      // Add small delay before next request
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const warehousesResponse = await apiService.get('/warehouses', { params: { status: 'all' } });
      
      if (warehousesResponse.success) {
        setWarehouses(warehousesResponse.data);
      }
      
      // Only fetch categories if user has permission
      if (user?.permissions?.category_view || user?.permissions?.all) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          const categoriesResponse = await apiService.get('/categories');
          if (categoriesResponse.success) {
            setCategories(categoriesResponse.data);
          }
        } catch (error) {
          console.log('No category access, continuing without categories');
        }
      }
    } catch (error) {
      console.error('Fetch items error:', error);
      if (error.isPermissionError) {
        message.error('You do not have permission to view items');
      } else {
        message.error('Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      console.log('Form values:', values);
      
      // Build dimensions object if any dimension value exists
      const dimensions = (values.length || values.width || values.height) ? {
        length: values.length || 0,
        width: values.width || 0,
        height: values.height || 0
      } : null;
      
      const itemData = {
        sku: values.sku,
        name: values.name,
        description: values.description,
        image: imageUrl,
        type: values.type,
        category: values.category,
        unit: values.unit,
        warehouseId: values.warehouseId,
        costPrice: convertPrice(values.costPrice, priceCurrency, 'USD'),
        sellingPrice: convertPrice(values.sellingPrice, priceCurrency, 'USD'),
        mrp: values.mrp ? convertPrice(values.mrp, priceCurrency, 'USD') : null,
        taxRate: values.taxRate,
        brand: values.brand,
        manufacturer: values.manufacturer,
        minStockLevel: values.minStockLevel,
        maxStockLevel: values.maxStockLevel,
        barcode: values.barcode,
        openingStock: values.openingStock || 0,
        openingValue: values.openingValue || 0,
        valuationMethod: values.valuationMethod,
        weight: values.weight,
        dimensions: dimensions,
        hsnCode: values.hsnCode,
        upc: values.upc,
        ean: values.ean,
        isbn: values.isbn,
        mpn: values.mpn
      };
      
      if (editingItem) {
        const response = await apiService.put(`/items/${editingItem.id}`, itemData);
        if (response.success) {
          message.success('Item updated successfully');
        }
      } else {
        const response = await apiService.post('/items', itemData);
        if (response.success) {
          message.success('Item created successfully');
        }
      }
      setModalVisible(false);
      setEditingItem(null);
      form.resetFields();
      fetchItems();
    } catch (error) {
      console.error('Submit error:', error);
      message.error(`Failed to ${editingItem ? 'update' : 'create'} item`);
    }
  };

  const toggleItemStatus = async (item) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      const response = await apiService.put(`/items/${item.id}`, { status: newStatus });
      if (response.success) {
        message.success(`Item ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchItems();
      }
    } catch (error) {
      message.error('Failed to update item status');
    }
  };

const viewItem = async (item) => {
    setViewModalVisible(true);
    setLoadingHistory(true);
    try {
      const [itemRes, historyRes, priceHistRes] = await Promise.allSettled([
        apiService.get(`/items/${item.id}`),
        apiService.get(`/inventory/item-logs/${item.id}`),
        apiService.get(`/items/${item.id}/price-history`)
      ]);
      setViewingItem(itemRes.status === 'fulfilled' && itemRes.value.success ? itemRes.value.data : item);
      setItemHistory(historyRes.status === 'fulfilled' && historyRes.value.success ? historyRes.value.data || [] : []);
      setPriceHistory(priceHistRes.status === 'fulfilled' && priceHistRes.value.success ? priceHistRes.value.data || [] : []);
    } catch (error) {
      console.error('Failed to fetch item details:', error);
      setViewingItem(item);
      setItemHistory([]);
      setPriceHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const editItem = async (item) => {
    setEditingItem(item);
    setPriceCurrency(currency);
    setImageUrl(item.image || '');
    
    await fetchDropdownOptions();
    
    let fullItem = item;
    try {
      const itemResponse = await apiService.get(`/items/${item.id}`);
      if (itemResponse.success) {
        fullItem = itemResponse.data;
      }
    } catch (error) {
      console.error('Failed to fetch full item details:', error);
    }

    // Pick warehouse with highest stock; fall back to first warehouse_id from item
    let warehouseId = null;
    try {
      const invResponse = await apiService.get('/inventory');
      if (invResponse.success && invResponse.data.length > 0) {
        const itemStocks = invResponse.data.filter(inv => inv.item_id === item.id);
        if (itemStocks.length > 0) {
          const best = itemStocks.reduce((a, b) =>
            (Number(b.quantity_available) || 0) > (Number(a.quantity_available) || 0) ? b : a
          );
          warehouseId = best.warehouse_id;
        }
      }
    } catch (error) {
      console.error('Failed to fetch inventory for warehouse prefill:', error);
    }
    // Fall back to first warehouse_id stored on item if no inventory found
    if (!warehouseId && fullItem.warehouse_ids && fullItem.warehouse_ids.length > 0) {
      warehouseId = fullItem.warehouse_ids[0];
    }
    
    form.setFieldsValue({
      sku: fullItem.sku,
      name: fullItem.name,
      description: fullItem.description,
      type: fullItem.type,
      category: fullItem.category,
      unit: fullItem.unit,
      costPrice: convertPrice(fullItem.cost_price, 'USD', currency),
      sellingPrice: convertPrice(fullItem.selling_price, 'USD', currency),
      mrp: convertPrice(fullItem.mrp, 'USD', currency),
      taxRate: fullItem.tax_rate,
      brand: fullItem.brand,
      manufacturer: fullItem.manufacturer,
      minStockLevel: fullItem.min_stock_level,
      maxStockLevel: fullItem.max_stock_level,
      barcode: fullItem.barcode,
      hsnCode: fullItem.hsn_code,
      openingStock: fullItem.opening_stock,
      openingValue: fullItem.opening_value,
      valuationMethod: fullItem.valuation_method,
      warehouseId: warehouseId,
      weight: fullItem.weight,
      length: fullItem.dimensions?.length,
      width: fullItem.dimensions?.width,
      height: fullItem.dimensions?.height,
      upc: fullItem.upc,
      ean: fullItem.ean,
      isbn: fullItem.isbn,
      mpn: fullItem.mpn
    });
    setModalVisible(true);
  };

  const handleBarcodeScan = async (barcode) => {
    setScannerOpen(false);
    // Fill EAN field first
    form.setFieldsValue({ ean: barcode });
    // Then trigger Open Food Facts lookup
    setBarcodeLoading(true);
    try {
      const product = await lookupProductByBarcode(barcode);
      if (!product) {
        message.warning('Product not found in Open Food Facts database.');
        return;
      }
      const updates = { ean: barcode };
      if (product.name) updates.name = product.name;
      if (product.brand) {
        const matchedBrand = brandOptions.find(b => b.name?.toLowerCase() === product.brand?.toLowerCase());
        if (matchedBrand) updates.brand = matchedBrand.id;
      }
      if (product.category) updates.category = product.category;
      if (product.weight) updates.weight = product.weight;
      if (product.manufacturer) {
        const matchedMfr = manufacturerOptions.find(m => m.name?.toLowerCase() === product.manufacturer?.toLowerCase());
        if (matchedMfr) updates.manufacturer = matchedMfr.id;
      }
      if (product.image) setImageUrl(product.image);
      form.setFieldsValue(updates);
      message.success(`Product found: ${product.name || 'details auto-filled'}!`);
    } catch (err) {
      message.error(err.message || 'Barcode lookup failed.');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const openCreateModal = async () => {
    setEditingItem(null);
    setPriceCurrency(currency);
    setImageUrl('');
    setImageFile(null);
    form.resetFields();

    await fetchDropdownOptions();

    setModalVisible(true);
  };

  useEffect(() => {
    const initializeData = async () => {
      await fetchItems();
      // Add delay before fetching dropdown options
      await new Promise(resolve => setTimeout(resolve, 200));
      await fetchDropdownOptions();
    };
    
    initializeData();
    
    // Refresh vendor list when window regains focus (after adding vendor in new tab)
    const handleFocus = () => {
      if (modalVisible) {
        setTimeout(() => fetchDropdownOptions(), 100);
      }
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [modalVisible]);

  const sectionStyle = {
    background: '#fff',
    border: '1px solid #e8e8ff',
    borderRadius: 12,
    padding: '20px 20px 8px',
    marginBottom: 16,
  };
  const sectionHeader = {
    fontWeight: 700,
    fontSize: 14,
    color: '#667eea',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
  };

  const filteredItems = items.filter(item =>
    !searchText ||
    item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchText.toLowerCase())
  );
  const activeCount = items.filter(i => i.status === 'active').length;
  const lowStockCount = items.filter(i => (i.current_stock || 0) <= (i.min_stock_level || 0)).length;

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <ShopOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>Items</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Manage your inventory items</div>
          </div>
        </div>
        {canManageItems && (
          <Button
            icon={<PlusOutlined />}
            size="large"
            onClick={openCreateModal}
            style={{ background: '#fff', color: '#764ba2', border: '2px solid rgba(255,255,255,0.6)', fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: 15 }}
          >
            Add Item
          </Button>
        )}
      </div>

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { title: 'Total Items', value: items.length, icon: <InboxOutlined />, color: '#667eea', bg: '#f0f0ff' },
          { title: 'Active Items', value: activeCount, icon: <AppstoreOutlined />, color: '#52c41a', bg: '#f6ffed' },
          { title: 'Categories', value: categories.length, icon: <TagsOutlined />, color: '#fa8c16', bg: '#fff7e6' },
          { title: 'Low Stock', value: lowStockCount, icon: <WarningOutlined />, color: '#ff4d4f', bg: '#fff1f0' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: s.bg, borderRadius: 10, padding: 10, fontSize: 22, color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{s.title}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Table Card */}
      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: '#1a1a2e' }}>
            All Items <Tag color="purple" style={{ marginLeft: 8, borderRadius: 20 }}>{filteredItems.length}</Tag>
          </div>
          <Space wrap>
            <Input
              placeholder="Search by name, SKU or category..."
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 260, borderRadius: 10 }}
              allowClear
            />
            {canManageItems && (
              <Button
                icon={<PlusOutlined />}
                onClick={openCreateModal}
                style={{
                  background: '#52c41a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  boxShadow: '0 3px 10px rgba(82,196,26,0.4)',
                  padding: '0 20px',
                  height: 38,
                }}
              >
                Add Item
              </Button>
            )}
          </Space>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
        <Table
          columns={columns}
          dataSource={filteredItems}
          loading={loading}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} items`, style: { marginTop: 16 } }}
        />
        </div>
      </Card>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
              {editingItem ? <EditOutlined /> : <PlusOutlined />}
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{editingItem ? 'Edit Item' : 'Add New Item'}</span>
          </div>
        }
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setEditingItem(null); setImageUrl(''); setImageFile(null); form.resetFields(); }}
        footer={null}
        width="min(900px, 96vw)"
        style={{ top: 16 }}
        styles={{ body: { background: '#fafbff', borderRadius: '0 0 12px 12px' } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>

          {/* ── Section: Basic Info ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}><AppstoreOutlined style={{ marginRight: 8 }} />Basic Information</div>
            <Row gutter={16}>
              <Col xs={24} md={16}>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="sku" label="SKU" rules={[{ required: true, message: 'Please input SKU!' }]}>
                      <Input placeholder="Enter SKU" size="middle" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="name" label="Item Name" rules={[{ required: true, message: 'Please input name!' }]}>
                      <Input placeholder="Enter item name" size="middle" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="type" label="Type" initialValue="simple">
                      <Select>
                        <Select.Option value="simple">Simple</Select.Option>
                        <Select.Option value="variant">Variant</Select.Option>
                        <Select.Option value="composite">Composite</Select.Option>
                        <Select.Option value="service">Service</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="category" label="Category">
                    {categories.length > 0 ? (
                      <Select 
                        placeholder="Select category"
                        allowClear
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                              <Button 
                                type="link" 
                                size="small"
                                onClick={() => {
                                  const newOption = prompt('Enter new category:');
                                  if (newOption && !categories.find(c => c.name === newOption)) {
                                    setCategories([...categories, { id: Date.now(), name: newOption }]);
                                  }
                                }}
                              >
                                + Add Category
                              </Button>
                            </div>
                          </div>
                        )}
                      >
                        {categories.map(category => (
                          <Select.Option key={category.id} value={category.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{category.name}</span>
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCategories(categories.filter(c => c.id !== category.id));
                                  message.success(`Category '${category.name}' deleted`);
                                }}
                                style={{ 
                                  marginLeft: 8,
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: '#ff4d4f',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.target.style.backgroundColor = '#d9363e';
                                  e.target.style.transform = 'scale(1.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.target.style.backgroundColor = '#ff4d4f';
                                  e.target.style.transform = 'scale(1)';
                                }}
                              >
                                ×
                              </span>
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    ) : (
                      <Input placeholder="Enter category name" />
                    )}
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="unit" label="Unit" initialValue="pcs">
                    <Select 
                      placeholder="Select unit"
                      dropdownRender={(menu) => (
                        <div>
                          {menu}
                          <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                            <Button 
                              type="link" 
                              size="small"
                              onClick={async () => {
                                const newOption = prompt('Enter new unit:');
                                if (newOption && !unitOptions.find(u => u.name === newOption)) {
                                  try {
                                    const response = await apiService.post('/units', { name: newOption, symbol: newOption });
                                    if (response) {
                                      await fetchDropdownOptions();
                                      message.success('Unit added successfully');
                                    }
                                  } catch (error) {
                                    message.error('Failed to add unit');
                                  }
                                }
                              }}
                            >
                              + Add Unit
                            </Button>
                          </div>
                        </div>
                      )}
                    >
                      {unitOptions.map(unit => (
                        <Select.Option key={unit.id} value={unit.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{unit.name} ({unit.symbol})</span>
                            <span
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await apiService.delete(`/units/${unit.id}`);
                                  await fetchDropdownOptions();
                                  message.success(`Unit '${unit.name}' deleted`);
                                } catch (error) {
                                  message.error('Failed to delete unit');
                                }
                              }}
                              style={{ 
                                marginLeft: 8,
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#ff4d4f',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#d9363e';
                                e.target.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#ff4d4f';
                                e.target.style.transform = 'scale(1)';
                              }}
                            >
                              ×
                            </span>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="returnableItem" label="" valuePropName="checked" style={{ marginBottom: 0 }}>
                      <input type="checkbox" style={{ marginRight: 6 }} /> Returnable Item
                    </Form.Item>
                  </Col>
                </Row>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="image" label="Item Image">
                  <Upload name="image" listType="picture-card" showUploadList={false}
                    beforeUpload={(file) => {
                      if (!['image/jpeg','image/png'].includes(file.type)) { message.error('JPG/PNG only!'); return false; }
                      if (file.size / 1024 / 1024 > 2) { message.error('Max 2MB!'); return false; }
                      const reader = new FileReader();
                      reader.onload = e => setImageUrl(e.target.result);
                      reader.readAsDataURL(file);
                      setImageFile(file);
                      return false;
                    }}
                  >
                    {imageUrl ? (
                      <img src={imageUrl} alt="item" style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 8 }} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 150, color: '#aaa' }}>
                        <UploadOutlined style={{ fontSize: 28, marginBottom: 8 }} />
                        <div style={{ fontSize: 12, textAlign: 'center', lineHeight: 1.5 }}>Click or drag to upload<br /><small>JPG/PNG, max 2MB</small></div>
                      </div>
                    )}
                  </Upload>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item label="Dimensions (L × W × H)">
                  <Input.Group compact>
                    <Form.Item name="length" noStyle><InputNumber placeholder="L" style={{ width: '33%' }} min={0} /></Form.Item>
                    <Form.Item name="width" noStyle><InputNumber placeholder="W" style={{ width: '33%' }} min={0} /></Form.Item>
                    <Form.Item name="height" noStyle><InputNumber placeholder="H" style={{ width: '34%' }} min={0} /></Form.Item>
                  </Input.Group>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="weight" label="Weight">
                  <Input placeholder="Weight in kg" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="manufacturer" label="Manufacturer">
                    <Select 
                      placeholder="Select or Add Manufacturer" 
                      allowClear
                      dropdownRender={(menu) => (
                        <div>
                          {menu}
                          <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                            <Button 
                              type="link" 
                              size="small"
                              onClick={async () => {
                                const newOption = prompt('Enter new manufacturer:');
                                if (newOption && !manufacturerOptions.find(m => m.name === newOption)) {
                                  try {
                                    const response = await apiService.post('/manufacturers', { name: newOption });
                                    if (response) {
                                      await fetchDropdownOptions();
                                      message.success('Manufacturer added successfully');
                                    }
                                  } catch (error) {
                                    message.error('Failed to add manufacturer');
                                  }
                                }
                              }}
                            >
                              + Add Manufacturer
                            </Button>
                          </div>
                        </div>
                      )}
                    >
                      {manufacturerOptions.map(manufacturer => (
                        <Select.Option key={manufacturer.id} value={manufacturer.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{manufacturer.name}</span>
                            <span
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await apiService.delete(`/manufacturers/${manufacturer.id}`);
                                  await fetchDropdownOptions();
                                  message.success(`Manufacturer '${manufacturer.name}' deleted`);
                                } catch (error) {
                                  message.error('Failed to delete manufacturer');
                                }
                              }}
                              style={{ 
                                marginLeft: 8,
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                backgroundColor: '#ff4d4f',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#d9363e';
                                e.target.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#ff4d4f';
                                e.target.style.transform = 'scale(1)';
                              }}
                            >
                              ×
                            </span>
                          </div>
                        </Select.Option>
                      ))}
                    </Select>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="upc" label="UPC">
                  <Input placeholder="Enter UPC" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="brand" label="Brand">
                <Select 
                  placeholder="Select or Add Brand" 
                  allowClear
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                        <Button 
                          type="link" 
                          size="small"
                          onClick={async () => {
                            const newOption = prompt('Enter new brand:');
                            if (newOption && !brandOptions.find(b => b.name === newOption)) {
                              try {
                                const response = await apiService.post('/brands', { name: newOption });
                                if (response) {
                                  await fetchDropdownOptions();
                                  message.success('Brand added successfully');
                                }
                              } catch (error) {
                                message.error('Failed to add brand');
                              }
                            }
                          }}
                        >
                          + Add Brand
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {brandOptions.map(brand => (
                    <Select.Option key={brand.id} value={brand.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{brand.name}</span>
                        <span
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await apiService.delete(`/brands/${brand.id}`);
                              await fetchDropdownOptions();
                              message.success(`Brand '${brand.name}' deleted`);
                            } catch (error) {
                              message.error('Failed to delete brand');
                            }
                          }}
                          style={{ 
                            marginLeft: 8,
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: '#ff4d4f',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#d9363e';
                            e.target.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#ff4d4f';
                            e.target.style.transform = 'scale(1)';
                          }}
                        >
                          ×
                        </span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="mpn" label="MPN">
                  <Input placeholder="Enter MPN" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="ean" label="EAN">
                  <Input.Search
                  placeholder="Enter EAN to lookup product"
                  enterButton={<span><BarcodeOutlined /> Lookup</span>}
                  loading={barcodeLoading}
                  addonBefore={
                    <span
                      style={{ cursor: 'pointer', color: '#1890ff' }}
                      onClick={() => setScannerOpen(true)}
                      title="Scan with mobile"
                    >
                      📱
                    </span>
                  }
                  onSearch={async (value) => {
                    if (!value) return;
                    setBarcodeLoading(true);
                    try {
                      const product = await lookupProductByBarcode(value);
                      if (!product) {
                        message.warning('Product not found in Open Food Facts database.');
                        return;
                      }
                      const updates = {};
                      if (product.name) updates.name = product.name;
                      if (product.brand) {
                        const matchedBrand = brandOptions.find(b => b.name?.toLowerCase() === product.brand?.toLowerCase());
                        if (matchedBrand) updates.brand = matchedBrand.id;
                      }
                      if (product.category) updates.category = product.category;
                      if (product.weight) updates.weight = product.weight;
                      if (product.ean) updates.ean = product.ean;
                      if (product.manufacturer) {
                        const matchedMfr = manufacturerOptions.find(m => m.name?.toLowerCase() === product.manufacturer?.toLowerCase());
                        if (matchedMfr) updates.manufacturer = matchedMfr.id;
                      }
                      if (product.image) setImageUrl(product.image);
                      form.setFieldsValue(updates);
                      message.success(`Product found: ${product.name || 'details auto-filled'}!`);
                    } catch (err) {
                      message.error(err.message || 'Barcode lookup failed.');
                    } finally {
                      setBarcodeLoading(false);
                    }
                  }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="isbn" label="ISBN">
                  <Input placeholder="Enter ISBN" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="barcode" label="Barcode">
                  <Input placeholder="Enter Barcode" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="hsnCode" label="HSN Code">
                  <Input placeholder="Enter HSN Code" />
                </Form.Item>
              </Col>
            </Row>
          </div>{/* end Basic Info section */}

          {/* ── Section: Sales ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}><DollarOutlined style={{ marginRight: 8 }} />Sales Information</div>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="sellingPrice" label="Selling Price" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter selling price"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="mrp" label="MRP" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter MRP"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="account" label="Account">
                <Select placeholder="Select account">
                  <Select.Option value="sales">Sales</Select.Option>
                  <Select.Option value="income">Income</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="taxRate" label="Tax Rate (%)" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  max={100} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter tax rate"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="salesDescription" label="Description">
                <Input.TextArea placeholder="Sales description" rows={2} />
              </Form.Item>
            </Col>
          </Row>

          </div>{/* end Sales section */}

          {/* ── Section: Purchase ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}><ShopOutlined style={{ marginRight: 8 }} />Purchase Information</div>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="costPrice" label="Cost Price (can be set later via Purchase Order)" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter cost price"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                  onChange={(value) => {
                    // Auto-calculate opening value if opening stock exists
                    const openingStock = form.getFieldValue('openingStock');
                    if (openingStock > 0 && value > 0) {
                      const calculatedValue = openingStock * value;
                      // Round to 2 decimal places to avoid floating point issues
                      form.setFieldsValue({ openingValue: Math.round(calculatedValue * 100) / 100 });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="purchaseAccount" label="Account">
                <Select placeholder="Select account">
                  <Select.Option value="cogs">Cost of Goods Sold</Select.Option>
                  <Select.Option value="expense">Expense</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="purchaseTaxRate" label="Tax Rate (%)" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  max={100} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Enter tax rate"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="purchaseDescription" label="Description">
                <Input.TextArea placeholder="Purchase description" rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="preferredVendor" label="Preferred Vendor">
                <Select 
                  placeholder="Select Vendor" 
                  allowClear
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {vendorOptions.map(vendor => (
                    <Select.Option key={vendor.id} value={vendor.id}>
                      {vendor.display_name || vendor.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          </div>{/* end Purchase section */}

          {/* ── Section: Inventory ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}><InboxOutlined style={{ marginRight: 8 }} />Inventory Tracking</div>
            <div style={{ marginBottom: 16 }}>
              <Form.Item name="trackInventory" label="" valuePropName="checked" style={{ marginBottom: 0 }}>
                <input type="checkbox" style={{ marginRight: 6 }} /> Track Inventory for this Item
              </Form.Item>
            </div>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="inventoryAccount" label="Inventory Account">
                <Select placeholder="Select an account">
                  <Select.Option value="inventory">Inventory Asset</Select.Option>
                  <Select.Option value="stock">Stock</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="minStockLevel" label="Min Stock Level">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="Enter min stock level"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="maxStockLevel" label="Max Stock Level">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="Enter max stock level"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="openingStock" label="Opening Stock">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="Enter opening stock"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                  onChange={(value) => {
                    // Auto-calculate opening value
                    const costPrice = form.getFieldValue('costPrice');
                    if (value > 0 && costPrice > 0) {
                      const calculatedValue = value * costPrice;
                      form.setFieldsValue({ openingValue: Math.round(calculatedValue * 100) / 100 });
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item 
                name="openingValue" 
                label="Opening Value (Auto-calculated)"
              >
                <InputNumber 
                  disabled
                  min={0} 
                  step={0.01}
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder="Auto-calculated"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="warehouseId"
                label="Warehouse"
                rules={[{ required: true, message: 'Please select a warehouse!' }]}
              >
                <Select placeholder="Select warehouse" allowClear>
                  {warehouses.filter(warehouse => warehouse.status === 'active').map(warehouse => (
                    <Select.Option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="valuationMethod" label="Inventory Valuation Method">
                <Select placeholder="Select valuation method">
                  <Select.Option value="fifo">FIFO</Select.Option>
                  <Select.Option value="lifo">LIFO</Select.Option>
                  <Select.Option value="weighted_average">Weighted Average</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item name="description" label="Notes / Description">
                  <Input.TextArea placeholder="Enter description" rows={3} />
                </Form.Item>
              </Col>
            </Row>
          </div>{/* end Inventory section */}

          <Form.Item style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 10, fontWeight: 600, paddingInline: 32 }}
              >
                {editingItem ? 'Update Item' : 'Create Item'}
              </Button>
              <Button size="large" style={{ borderRadius: 10 }} onClick={() => { setModalVisible(false); setEditingItem(null); form.resetFields(); }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
              <EyeOutlined />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Item Details</span>
          </div>
        }
        open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setViewingItem(null); setItemHistory([]); setPriceHistory([]); }}
        footer={[<Button key="close" style={{ borderRadius: 10 }} onClick={() => { setViewModalVisible(false); setViewingItem(null); setItemHistory([]); setPriceHistory([]); }}>Close</Button>]}
        width="min(960px, 96vw)"
        style={{ top: 16 }}
        styles={{ body: { background: '#fafbff' } }}
      >
        {viewingItem && (
          <div>
            {/* Top hero strip */}
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {viewingItem.image ? (
                <img src={viewingItem.image} alt={viewingItem.name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12, border: '3px solid rgba(255,255,255,0.4)' }} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: 12, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, color: '#fff' }}><InboxOutlined /></div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{viewingItem.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>SKU: {viewingItem.sku}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Tag color={viewingItem.status === 'active' ? 'success' : 'error'} style={{ borderRadius: 20 }}>{viewingItem.status}</Tag>
                  {viewingItem.type && <Tag color="blue" style={{ borderRadius: 20 }}>{viewingItem.type}</Tag>}
                  {viewingItem.category && <Tag color="orange" style={{ borderRadius: 20 }}>{viewingItem.category}</Tag>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[{ label: 'Selling Price', val: viewingItem.selling_price ? formatPrice(viewingItem.selling_price, currency, 'USD') : '—' },
                  { label: 'On Hand', val: (() => { const s = viewingItem.current_stock || 0; return s % 1 === 0 ? Math.floor(s) : s.toFixed(2); })() }].map(x => (
                  <div key={x.label} style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '8px 16px', textAlign: 'center' }}>
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{x.val}</div>
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{x.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Detail grid */}
            <Row gutter={16}>
              {[[
                ['Cost Price', viewingItem.cost_price ? formatPrice(viewingItem.cost_price, currency, 'USD') : 'N/A'],
                ['MRP', viewingItem.mrp ? formatPrice(viewingItem.mrp, currency, 'USD') : 'N/A'],
                ['Tax Rate', viewingItem.tax_rate ? `${viewingItem.tax_rate}%` : 'N/A'],
                ['Unit', viewingItem.unit || 'N/A'],
                ['Brand', viewingItem.brand || 'N/A'],
                ['Manufacturer', viewingItem.manufacturer || 'N/A'],
              ], [
                ['Min Stock', viewingItem.min_stock_level ?? 'N/A'],
                ['Max Stock', viewingItem.max_stock_level ?? 'N/A'],
                ['Opening Stock', viewingItem.opening_stock ?? 'N/A'],
                ['Valuation', viewingItem.valuation_method || 'N/A'],
                ['HSN Code', viewingItem.hsn_code || 'N/A'],
                ['Barcode', viewingItem.barcode || 'N/A'],
              ], [
                ['UPC', viewingItem.upc || 'N/A'],
                ['EAN', viewingItem.ean || 'N/A'],
                ['ISBN', viewingItem.isbn || 'N/A'],
                ['MPN', viewingItem.mpn || 'N/A'],
                ['Weight', viewingItem.weight ? `${viewingItem.weight} ${viewingItem.weight_unit || 'kg'}` : 'N/A'],
                ['Dimensions', viewingItem.dimensions ? `${viewingItem.dimensions.length||0}×${viewingItem.dimensions.width||0}×${viewingItem.dimensions.height||0}` : 'N/A'],
              ]].map((group, gi) => (
                <Col xs={24} sm={8} key={gi}>
                  <Card bordered={false} style={{ borderRadius: 12, background: '#fff', boxShadow: '0 1px 8px rgba(0,0,0,0.06)', marginBottom: 12 }} bodyStyle={{ padding: '14px 18px' }}>
                    {group.map(([label, val]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
                        <span style={{ color: '#8c8c8c' }}>{label}</span>
                        <span style={{ fontWeight: 600, color: '#1a1a2e', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-word' }}>{val}</span>
                      </div>
                    ))}
                  </Card>
                </Col>
              ))}
            </Row>
            {viewingItem.description && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '12px 18px', marginBottom: 12, boxShadow: '0 1px 8px rgba(0,0,0,0.06)', fontSize: 13, color: '#595959' }}>
                <strong>Description:</strong> {viewingItem.description}
              </div>
            )}
            
            <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
              ) : (
                <Tabs items={[
                  {
                    key: 'transactions',
                    label: <span><HistoryOutlined /> Transaction History</span>,
                    children: itemHistory.length > 0 ? (
                      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                        <Timeline>
                          {itemHistory.map((log, index) => {
                            const getEventColor = (type) => {
                              if (type?.includes('RECEIVED')) return 'green';
                              if (type?.includes('SHIPPED')) return 'red';
                              if (type?.includes('RESERVED')) return 'orange';
                              if (type?.includes('ADJUSTED')) return 'blue';
                              if (type?.includes('TRANSFER')) return 'purple';
                              return 'gray';
                            };
                            const getEventLabel = (type) => {
                              if (type?.includes('RECEIVED')) return 'Stock Received';
                              if (type?.includes('SHIPPED')) return 'Stock Shipped';
                              if (type?.includes('RESERVED')) return 'Stock Reserved';
                              if (type?.includes('CANCELLED')) return 'Reservation Cancelled';
                              if (type?.includes('ADJUSTED')) return 'Stock Adjusted';
                              if (type?.includes('TRANSFER_IN')) return 'Transfer In';
                              if (type?.includes('TRANSFER_OUT')) return 'Transfer Out';
                              return type;
                            };
                            return (
                              <Timeline.Item key={index} color={getEventColor(log.operation_type)}>
                                <div style={{ marginBottom: 8 }}>
                                  <Tag color={getEventColor(log.operation_type)}>{getEventLabel(log.operation_type)}</Tag>
                                  <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                                    {new Date(log.operation_date).toLocaleString()}
                                  </span>
                                </div>
                                <div style={{ fontSize: 13 }}>
                                  {log.warehouse_name && <div>Warehouse: <strong>{log.warehouse_name}</strong></div>}
                                  {log.quantity_change && (
                                    <div>Change: <strong style={{ color: log.quantity_change > 0 ? '#52c41a' : '#ff4d4f' }}>
                                      {log.quantity_change > 0 ? '+' : ''}{log.quantity_change}
                                    </strong></div>
                                  )}
                                  {log.balance_after != null && <div>Balance After: <strong>{log.balance_after}</strong></div>}
                                  {log.unit_cost && <div>Unit Cost: <strong>{formatPrice(log.unit_cost, currency, 'USD')}</strong></div>}
                                  {log.reference_number && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Ref: {log.reference_number}</div>}
                                  {log.notes && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Notes: {log.notes}</div>}
                                </div>
                              </Timeline.Item>
                            );
                          })}
                        </Timeline>
                      </div>
                    ) : <Empty description="No transaction history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  },
                  {
                    key: 'price-history',
                    label: <span><DollarOutlined /> Price History</span>,
                    children: priceHistory.length > 0 ? (
                      <Table
                        size="small"
                        rowKey={(r, i) => i}
                        dataSource={priceHistory}
                        pagination={{ pageSize: 10, size: 'small' }}
                        columns={[
                          {
                            title: 'Price Type',
                            dataIndex: 'price_type',
                            key: 'price_type',
                            render: (v) => ({ cost: 'Cost Price', selling: 'Selling Price', mrp: 'MRP' }[v] || v)
                          },
                          {
                            title: 'Old Price',
                            dataIndex: 'old_price',
                            key: 'old_price',
                            render: (v) => v != null ? formatPrice(v, currency, 'USD') : '-'
                          },
                          {
                            title: 'New Price',
                            dataIndex: 'new_price',
                            key: 'new_price',
                            render: (v, r) => {
                              const diff = r.old_price != null ? v - r.old_price : null;
                              return (
                                <span>
                                  {formatPrice(v, currency, 'USD')}
                                  {diff != null && (
                                    <Tag color={diff > 0 ? 'red' : 'green'} style={{ marginLeft: 8 }}>
                                      {diff > 0 ? '+' : ''}{formatPrice(diff, currency, 'USD')}
                                    </Tag>
                                  )}
                                </span>
                              );
                            }
                          },
                          {
                            title: 'Changed By',
                            key: 'changed_by',
                            render: (_, r) => r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : '-'
                          },
                          {
                            title: 'Reason',
                            dataIndex: 'change_reason',
                            key: 'change_reason',
                            render: (v) => v || '-'
                          },
                          {
                            title: 'Date',
                            dataIndex: 'changed_at',
                            key: 'changed_at',
                            render: (v) => new Date(v).toLocaleString()
                          }
                        ]}
                      />
                    ) : <Empty description="No price history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  }
                ]} />
              )}
            </div>
          </div>
        )}
      </Modal>
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcode={handleBarcodeScan}
      />
    </div>
  );
};

export default Items;