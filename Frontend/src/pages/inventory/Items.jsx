import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, message, Form, Input, Select, InputNumber, Row, Col, Upload, Timeline, Tag, Spin, Empty, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, UploadOutlined, HistoryOutlined, SearchOutlined, DollarOutlined, BarcodeOutlined } from '@ant-design/icons';
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
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
    { 
      title: 'On Hand Stock', 
      dataIndex: 'current_stock', 
      key: 'current_stock',
      render: (val, record) => {
        const stock = val || 0;
        const displayValue = stock % 1 === 0 ? Math.floor(stock) : stock.toFixed(2);
        return (
          <span style={{ 
            fontWeight: 'bold',
            color: stock <= (record.min_stock_level || 0) ? '#ff4d4f' : '#52c41a'
          }}>
            {displayValue}
          </span>
        );
      }
    },
    { title: 'Cost Price', dataIndex: 'cost_price', key: 'cost_price', render: (val) => val ? formatPrice(val, currency, 'USD') : '-' },
    { title: 'Selling Price', dataIndex: 'selling_price', key: 'selling_price', render: (val) => val ? formatPrice(val, currency, 'USD') : '-' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? '#52c41a' : '#ff4d4f' }}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            icon={<EyeOutlined />} 
            size="small"
            onClick={() => viewItem(record)}
          >
            View
          </Button>
          {canManageItems && (
            <Button 
              icon={<EditOutlined />} 
              size="small"
              onClick={() => editItem(record)}
            >
              Edit
            </Button>
          )}
          {canManageItems && (
            <Button 
              size="small"
              type={record.status === 'active' ? 'default' : 'primary'}
              onClick={() => toggleItemStatus(record)}
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

  return (
    <div style={{ padding: '24px' }}>
      <h1>Items</h1>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          {canManageItems && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={openCreateModal}
            >
              Add Item
            </Button>
          )}
          <Input
            placeholder="Search by name, SKU or category..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
        </Space>
        <Table 
          columns={columns} 
          dataSource={items.filter(item =>
            !searchText ||
            item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.category?.toLowerCase().includes(searchText.toLowerCase())
          )} 
          loading={loading}
          rowKey="id"
        />
      </Card>

      <Modal
        title={editingItem ? "Edit Item" : "Add New Item"}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingItem(null);
          setImageUrl('');
          setImageFile(null);
          form.resetFields();
        }}
        footer={null}
        width={900}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="sku"
                label="SKU"
                rules={[{ required: true, message: 'Please input SKU!' }]}
              >
                <Input placeholder="Enter SKU" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Please input name!' }]}
              >
                <Input placeholder="Enter item name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={16}>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="type"
                    label="Type"
                    initialValue="simple"
                  >
                    <Select>
                      <Select.Option value="simple">Simple</Select.Option>
                      <Select.Option value="variant">Variant</Select.Option>
                      <Select.Option value="composite">Composite</Select.Option>
                      <Select.Option value="service">Service</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
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
                <Col span={8}>
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
                  <Form.Item name="returnableItem" label="" valuePropName="checked">
                    <input type="checkbox" /> Returnable Item
                  </Form.Item>
                </Col>
              </Row>
            </Col>
            
            <Col span={8}>
              <Form.Item name="image" label="Item Image">
                <Upload
                  name="image"
                  listType="picture-card"
                  className="avatar-uploader"
                  showUploadList={false}
                  beforeUpload={(file) => {
                    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                    if (!isJpgOrPng) {
                      message.error('You can only upload JPG/PNG file!');
                      return false;
                    }
                    const isLt2M = file.size / 1024 / 1024 < 2;
                    if (!isLt2M) {
                      message.error('Image must smaller than 2MB!');
                      return false;
                    }
                    
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setImageUrl(e.target.result);
                    };
                    reader.readAsDataURL(file);
                    setImageFile(file);
                    
                    return false;
                  }}
                >
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt="item" 
                      style={{ width: '100%', height: '150px', objectFit: 'cover' }} 
                    />
                  ) : (
                    <div style={{ 
                      border: '2px dashed #d9d9d9', 
                      borderRadius: '6px', 
                      width: '150px', 
                      height: '150px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}>
                      <UploadOutlined style={{ fontSize: '24px', color: '#999' }} />
                      <div style={{ marginTop: 8, color: '#999', fontSize: '12px', textAlign: 'center' }}>
                        Drag and drop or click to upload<br/>
                        Browse Images<br/>
                        <small>Maximum 2 MB and JPG/PNG only</small>
                      </div>
                    </div>
                  )}
                </Upload>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Dimensions (L × W × H)">
                <Input.Group compact>
                  <Form.Item name="length" noStyle>
                    <InputNumber placeholder="Length" style={{ width: '33%' }} min={0} />
                  </Form.Item>
                  <Form.Item name="width" noStyle>
                    <InputNumber placeholder="Width" style={{ width: '33%' }} min={0} />
                  </Form.Item>
                  <Form.Item name="height" noStyle>
                    <InputNumber placeholder="Height" style={{ width: '34%' }} min={0} />
                  </Form.Item>
                </Input.Group>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="weight" label="Weight">
                <Input placeholder="Weight in kg" />
              </Form.Item>
            </Col>
            <Col span={8}>
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
            <Col span={8}>
              <Form.Item name="upc" label="UPC">
                <Input placeholder="Enter UPC" />
              </Form.Item>
            </Col>
            <Col span={8}>
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
            <Col span={8}>
              <Form.Item name="mpn" label="MPN">
                <Input placeholder="Enter MPN" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
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
            <Col span={8}>
              <Form.Item name="isbn" label="ISBN">
                <Input placeholder="Enter ISBN" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="barcode" label="Barcode">
                <Input placeholder="Enter Barcode" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="hsnCode" label="HSN Code">
                <Input placeholder="Enter HSN Code" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <h3>Sales Information</h3>
          </div>
          <Row gutter={16}>
            <Col span={8}>
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
            <Col span={8}>
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
            <Col span={8}>
              <Form.Item name="account" label="Account">
                <Select placeholder="Select account">
                  <Select.Option value="sales">Sales</Select.Option>
                  <Select.Option value="income">Income</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
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
            <Col span={16}>
              <Form.Item name="salesDescription" label="Description">
                <Input.TextArea placeholder="Sales description" rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <h3>Purchase Information</h3>
          </div>
          <Row gutter={16}>
            <Col span={8}>
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
            <Col span={8}>
              <Form.Item name="purchaseAccount" label="Account">
                <Select placeholder="Select account">
                  <Select.Option value="cogs">Cost of Goods Sold</Select.Option>
                  <Select.Option value="expense">Expense</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
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
            <Col span={12}>
              <Form.Item name="purchaseDescription" label="Description">
                <Input.TextArea placeholder="Purchase description" rows={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
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

          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <Form.Item name="trackInventory" label="" valuePropName="checked">
              <input type="checkbox" /> Track Inventory for this Item
            </Form.Item>
          </div>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="inventoryAccount" label="Inventory Account">
                <Select placeholder="Select an account">
                  <Select.Option value="inventory">Inventory Asset</Select.Option>
                  <Select.Option value="stock">Stock</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="minStockLevel" label="Min Stock Level">
                <InputNumber 
                  min={0} 
                  style={{ width: '100%' }} 
                  placeholder="Enter min stock level"
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
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
            <Col span={8}>
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
            <Col span={8}>
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
            <Col span={8}>
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
            <Col span={8}>
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
              <Form.Item name="description" label="Description">
                <Input.TextArea placeholder="Enter description" rows={3} />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingItem ? 'Update Item' : 'Create Item'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingItem(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

{/* View Item Modal */}
      <Modal
        title="View Item Details"
        open={viewModalVisible}
        onCancel={() => { setViewModalVisible(false); setViewingItem(null); setItemHistory([]); setPriceHistory([]); }}
        footer={[<Button key="close" onClick={() => { setViewModalVisible(false); setViewingItem(null); setItemHistory([]); setPriceHistory([]); }}>Close</Button>]}
        width={960}
      >
        {viewingItem && (
          <div>
            <Row gutter={16}>
              <Col span={16}>
                <Row gutter={16}>
                  <Col span={12}>
                    <p><strong>SKU:</strong> {viewingItem.sku}</p>
                    <p><strong>Name:</strong> {viewingItem.name}</p>
                    <p><strong>Type:</strong> {viewingItem.type}</p>
                    <p><strong>Category:</strong> {viewingItem.category || 'N/A'}</p>
                    <p><strong>Unit:</strong> {viewingItem.unit}</p>
                    <p><strong>Brand:</strong> {viewingItem.brand || 'N/A'}</p>
                    <p><strong>Manufacturer:</strong> {viewingItem.manufacturer || 'N/A'}</p>
                    <p><strong>Barcode:</strong> {viewingItem.barcode || 'N/A'}</p>
                    <p><strong>HSN Code:</strong> {viewingItem.hsn_code || 'N/A'}</p>
                    <p><strong>Status:</strong> <span style={{ color: viewingItem.status === 'active' ? '#52c41a' : '#ff4d4f' }}>{viewingItem.status}</span></p>
                  </Col>
                  <Col span={12}>
                    <p><strong>Cost Price:</strong> {viewingItem.cost_price ? formatPrice(viewingItem.cost_price, currency, 'USD') : 'N/A'}</p>
                    <p><strong>Selling Price:</strong> {viewingItem.selling_price ? formatPrice(viewingItem.selling_price, currency, 'USD') : 'N/A'}</p>
                    <p><strong>MRP:</strong> {viewingItem.mrp ? formatPrice(viewingItem.mrp, currency, 'USD') : 'N/A'}</p>
                    <p><strong>Tax Rate:</strong> {viewingItem.tax_rate ? `${viewingItem.tax_rate}%` : 'N/A'}</p>
                    <p><strong>Tax Type:</strong> {viewingItem.tax_type || 'N/A'}</p>
                    <p><strong>On Hand Stock:</strong> <span style={{ fontWeight: 'bold', color: (viewingItem.current_stock || 0) <= (viewingItem.min_stock_level || 0) ? '#ff4d4f' : '#52c41a' }}>{(() => { const s = viewingItem.current_stock || 0; return s % 1 === 0 ? Math.floor(s) : s.toFixed(2); })()}</span></p>
                    <p><strong>Min Stock Level:</strong> {viewingItem.min_stock_level ?? 'N/A'}</p>
                    <p><strong>Max Stock Level:</strong> {viewingItem.max_stock_level ?? 'N/A'}</p>
                    <p><strong>Opening Stock:</strong> {viewingItem.opening_stock ?? 'N/A'}</p>
                    <p><strong>Opening Value:</strong> {viewingItem.opening_value ? formatPrice(viewingItem.opening_value, currency, 'USD') : 'N/A'}</p>
                    <p><strong>Valuation Method:</strong> {viewingItem.valuation_method || 'N/A'}</p>
                  </Col>
                </Row>
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <p><strong>Weight:</strong> {viewingItem.weight ? `${viewingItem.weight} ${viewingItem.weight_unit || 'kg'}` : 'N/A'}</p>
                    <p><strong>Dimensions (L×W×H):</strong> {viewingItem.dimensions ? `${viewingItem.dimensions.length || 0} × ${viewingItem.dimensions.width || 0} × ${viewingItem.dimensions.height || 0}` : 'N/A'}</p>
                  </Col>
                  <Col span={12}>
                    <p><strong>UPC:</strong> {viewingItem.upc || 'N/A'}</p>
                    <p><strong>EAN:</strong> {viewingItem.ean || 'N/A'}</p>
                    <p><strong>ISBN:</strong> {viewingItem.isbn || 'N/A'}</p>
                    <p><strong>MPN:</strong> {viewingItem.mpn || 'N/A'}</p>
                  </Col>
                </Row>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <p><strong>Item Image</strong></p>
                  {viewingItem.image ? (
                    <img src={viewingItem.image} alt={viewingItem.name} style={{ width: '150px', height: '150px', objectFit: 'cover', border: '1px solid #d9d9d9', borderRadius: '6px' }} />
                  ) : (
                    <div style={{ width: '150px', height: '150px', border: '2px dashed #d9d9d9', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '12px', margin: '0 auto' }}>
                      No Image Available
                    </div>
                  )}
                </div>
              </Col>
            </Row>
            {viewingItem.description && (
              <Row gutter={16} style={{ marginTop: 8 }}>
                <Col span={24}>
                  <p><strong>Description:</strong> {viewingItem.description}</p>
                </Col>
              </Row>
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