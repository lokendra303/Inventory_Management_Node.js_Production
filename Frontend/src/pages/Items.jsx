import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, message, Form, Input, Select, InputNumber, Row, Col, Upload } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { useAuth } from '../hooks/useAuth.jsx';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { formatPrice, convertPrice, getCurrencies } from '../utils/currency';
import CustomizableDropdown from '../components/CustomizableDropdown';

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

  // Check if user can manage items
  const canManageCategories = user?.permissions?.category_management || user?.permissions?.all;
  const canManageItems = user?.permissions?.item_management || user?.permissions?.all;
  
  console.log('User permissions:', user?.permissions);
  console.log('Can manage items:', canManageItems);

  const columns = [
    { title: 'SKU', dataIndex: 'sku', key: 'sku' },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Brand', dataIndex: 'brand', key: 'brand' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Category', dataIndex: 'category', key: 'category' },
    { title: 'Unit', dataIndex: 'unit', key: 'unit' },
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
      const [unitsRes, manufacturersRes, brandsRes] = await Promise.all([
        apiService.get('/dropdown-options/units'),
        apiService.get('/dropdown-options/manufacturers'), 
        apiService.get('/dropdown-options/brands')
      ]);
      
      if (unitsRes.success) setUnitOptions(unitsRes.data);
      if (manufacturersRes.success) setManufacturerOptions(manufacturersRes.data);
      if (brandsRes.success) setBrandOptions(brandsRes.data);
    } catch (error) {
      console.log('Using empty options');
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      console.log('Fetching items...');
      
      const [itemsResponse, warehousesResponse] = await Promise.all([
        apiService.get('/items'),
        apiService.get('/warehouses')
      ]);
      
      console.log('Items response:', itemsResponse);
      
      if (itemsResponse.success) {
        setItems(itemsResponse.data);
      }
      
      if (warehousesResponse.success) {
        setWarehouses(warehousesResponse.data);
      }
      
      // Only fetch categories if user has permission
      if (user?.permissions?.category_view || user?.permissions?.all) {
        try {
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
      
      const itemData = {
        sku: values.sku,
        name: values.name,
        description: values.description,
        image: imageUrl, // Store base64 image
        type: values.type,
        category: values.category,
        unit: values.unit,
        warehouseId: values.warehouseId,
        costPrice: convertPrice(values.costPrice, priceCurrency, 'USD'),
        sellingPrice: convertPrice(values.sellingPrice, priceCurrency, 'USD'),
        mrp: convertPrice(values.mrp, priceCurrency, 'USD'),
        taxRate: values.taxRate,
        brand: values.brand,
        manufacturer: values.manufacturer,
        minStockLevel: values.minStockLevel,
        maxStockLevel: values.maxStockLevel,
        barcode: values.barcode
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

  const viewItem = (item) => {
    setViewingItem(item);
    setViewModalVisible(true);
  };

  const editItem = (item) => {
    setEditingItem(item);
    setPriceCurrency(currency);
    setImageUrl(item.image || ''); // Load existing image
    form.setFieldsValue({
      sku: item.sku,
      name: item.name,
      description: item.description,
      type: item.type,
      category: item.category,
      unit: item.unit,
      costPrice: convertPrice(item.cost_price, 'USD', currency),
      sellingPrice: convertPrice(item.selling_price, 'USD', currency),
      mrp: convertPrice(item.mrp, 'USD', currency),
      taxRate: item.tax_rate,
      brand: item.brand,
      manufacturer: item.manufacturer,
      minStockLevel: item.min_stock_level,
      maxStockLevel: item.max_stock_level
    });
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setPriceCurrency(currency);
    setImageUrl('');
    setImageFile(null);
    form.resetFields();
    setModalVisible(true);
  };

  useEffect(() => {
    fetchItems();
    fetchDropdownOptions();
  }, []);

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
          {canManageCategories && (
            <Button 
              onClick={() => setCategoryModalVisible(true)}
            >
              Manage Categories
            </Button>
          )}
        </Space>
        <Table 
          columns={columns} 
          dataSource={items} 
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
                              <Button 
                                type="link" 
                                size="small"
                                danger
                                onClick={() => {
                                  const optionToDelete = prompt('Enter category name to delete:');
                                  if (optionToDelete) {
                                    setCategories(categories.filter(c => c.name !== optionToDelete));
                                    message.success('Category deleted');
                                  }
                                }}
                              >
                                - Delete Category
                              </Button>
                            </div>
                          </div>
                        )}
                      >
                        {categories.map(category => (
                          <Select.Option key={category.id} value={category.name}>
                            {category.name}
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
                              onClick={() => {
                                const newOption = prompt('Enter new unit:');
                                if (newOption && !unitOptions.includes(newOption)) {
                                  setUnitOptions([...unitOptions, newOption]);
                                }
                              }}
                            >
                              + Add Unit
                            </Button>
                            <Button 
                              type="link" 
                              size="small"
                              danger
                              onClick={() => {
                                const optionToDelete = prompt('Enter unit to delete:');
                                if (optionToDelete && unitOptions.includes(optionToDelete)) {
                                  setUnitOptions(unitOptions.filter(u => u !== optionToDelete));
                                  message.success('Unit deleted');
                                }
                              }}
                            >
                              - Delete Unit
                            </Button>
                          </div>
                        </div>
                      )}
                    >
                      {unitOptions.map(unit => (
                        <Select.Option key={unit} value={unit}>{unit.charAt(0).toUpperCase() + unit.slice(1)}</Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="returnableItem" label="" valuePropName="checked">
                    <input type="checkbox" /> Returnable Item
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="warehouseId"
                    label="Warehouse"
                    rules={[{ required: true, message: 'Please select a warehouse!' }]}
                  >
                    <Select placeholder="Select warehouse">
                      {warehouses.map(warehouse => (
                        <Select.Option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </Select.Option>
                      ))}
                    </Select>
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
              <Form.Item name="dimensions" label="Dimensions">
                <Input placeholder="Length x Width x Height" />
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
                          onClick={() => {
                            const newOption = prompt('Enter new manufacturer:');
                            if (newOption && !manufacturerOptions.includes(newOption)) {
                              setManufacturerOptions([...manufacturerOptions, newOption]);
                            }
                          }}
                        >
                          + Add Manufacturer
                        </Button>
                        <Button 
                          type="link" 
                          size="small"
                          danger
                          onClick={() => {
                            const optionToDelete = prompt('Enter manufacturer to delete:');
                            if (optionToDelete && manufacturerOptions.includes(optionToDelete)) {
                              setManufacturerOptions(manufacturerOptions.filter(m => m !== optionToDelete));
                              message.success('Manufacturer deleted');
                            }
                          }}
                        >
                          - Delete Manufacturer
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {manufacturerOptions.map(manufacturer => (
                    <Select.Option key={manufacturer} value={manufacturer}>{manufacturer}</Select.Option>
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
                          onClick={() => {
                            const newOption = prompt('Enter new brand:');
                            if (newOption && !brandOptions.includes(newOption)) {
                              setBrandOptions([...brandOptions, newOption]);
                            }
                          }}
                        >
                          + Add Brand
                        </Button>
                        <Button 
                          type="link" 
                          size="small"
                          danger
                          onClick={() => {
                            const optionToDelete = prompt('Enter brand to delete:');
                            if (optionToDelete && brandOptions.includes(optionToDelete)) {
                              setBrandOptions(brandOptions.filter(b => b !== optionToDelete));
                              message.success('Brand deleted');
                            }
                          }}
                        >
                          - Delete Brand
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {brandOptions.map(brand => (
                    <Select.Option key={brand} value={brand}>{brand}</Select.Option>
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
                <Input placeholder="Enter EAN" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isbn" label="ISBN">
                <Input placeholder="Enter ISBN" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 24, marginBottom: 16 }}>
            <h3>Sales Information</h3>
          </div>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="sellingPrice" label="Selling Price" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="Enter selling price" />
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
            <Col span={8}>
              <Form.Item name="taxRate" label="Tax Rate (%)">
                <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} placeholder="Enter tax rate" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
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
              <Form.Item name="costPrice" label="Cost Price" rules={[{ required: true }]}>
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} placeholder="Enter cost price" />
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
              <Form.Item name="purchaseTaxRate" label="Tax Rate (%)">
                <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} placeholder="Enter tax rate" />
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
                <Input placeholder="Enter preferred vendor" />
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
              <Form.Item name="openingStock" label="Opening Stock">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="Enter opening stock" />
              </Form.Item>
            </Col>
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

      {/* Category Modal - Only show if user has permission */}
      {canManageCategories && (
        <Modal
          title="Add New Category"
          open={categoryModalVisible}
          onCancel={() => {
            setCategoryModalVisible(false);
            categoryForm.resetFields();
          }}
          footer={null}
          width={400}
        >
          <Form
            form={categoryForm}
            layout="vertical"
            onFinish={async (values) => {
              try {
                const response = await apiService.post('/categories', values);
                if (response.success) {
                  message.success('Category created successfully');
                  setCategoryModalVisible(false);
                  categoryForm.resetFields();
                  fetchItems(); // Refresh categories
                }
              } catch (error) {
                message.error('Failed to create category');
              }
            }}
          >
            <Form.Item
              name="name"
              label="Category Name"
              rules={[{ required: true, message: 'Please input category name!' }]}
            >
              <Input placeholder="Enter category name" />
            </Form.Item>
            
            <Form.Item name="description" label="Description">
              <Input.TextArea placeholder="Enter description" rows={3} />
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Create Category
                </Button>
                <Button onClick={() => {
                  setCategoryModalVisible(false);
                  categoryForm.resetFields();
                }}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* View Item Modal */}
      <Modal
        title="View Item Details"
        open={viewModalVisible}
        onCancel={() => {
          setViewModalVisible(false);
          setViewingItem(null);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setViewModalVisible(false);
            setViewingItem(null);
          }}>
            Close
          </Button>
        ]}
        width={800}
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
                  </Col>
                  <Col span={12}>
                    <p><strong>Cost Price:</strong> {viewingItem.cost_price ? formatPrice(viewingItem.cost_price, currency, 'USD') : 'N/A'}</p>
                    <p><strong>Selling Price:</strong> {viewingItem.selling_price ? formatPrice(viewingItem.selling_price, currency, 'USD') : 'N/A'}</p>
                    <p><strong>MRP:</strong> {viewingItem.mrp ? formatPrice(viewingItem.mrp, currency, 'USD') : 'N/A'}</p>
                    <p><strong>Tax Rate:</strong> {viewingItem.tax_rate ? `${viewingItem.tax_rate}%` : 'N/A'}</p>
                    <p><strong>Min Stock Level:</strong> {viewingItem.min_stock_level || 'N/A'}</p>
                    <p><strong>Max Stock Level:</strong> {viewingItem.max_stock_level || 'N/A'}</p>
                    <p><strong>Status:</strong> <span style={{ color: viewingItem.status === 'active' ? '#52c41a' : '#ff4d4f' }}>{viewingItem.status}</span></p>
                  </Col>
                </Row>
              </Col>
              <Col span={8}>
                <div style={{ textAlign: 'center' }}>
                  <p><strong>Item Image</strong></p>
                  {viewingItem.image ? (
                    <img 
                      src={viewingItem.image} 
                      alt={viewingItem.name}
                      style={{ 
                        width: '150px', 
                        height: '150px', 
                        objectFit: 'cover',
                        border: '1px solid #d9d9d9',
                        borderRadius: '6px'
                      }} 
                    />
                  ) : (
                    <div style={{
                      width: '150px',
                      height: '150px',
                      border: '2px dashed #d9d9d9',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#999',
                      fontSize: '12px',
                      margin: '0 auto'
                    }}>
                      No Image Available
                    </div>
                  )}
                </div>
              </Col>
            </Row>
            {viewingItem.description && (
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <p><strong>Description:</strong></p>
                  <p>{viewingItem.description}</p>
                </Col>
              </Row>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Items;