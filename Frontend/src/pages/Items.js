import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, message, InputNumber, Row, Col, Upload } from 'antd';
import { PlusOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useCurrency } from '../contexts/CurrencyContext';
import { formatPrice, convertPrice, getCurrencies } from '../utils/currency';

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
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();

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
      
      // Map form field names to database field names
      const itemData = {
        sku: values.sku,
        name: values.name,
        description: values.description,
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
      
      console.log('Sending item data:', itemData);
      
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

  const editItem = (item) => {
    setEditingItem(item);
    setPriceCurrency(currency); // Set to current display currency
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
    setPriceCurrency(currency); // Set to current display currency
    setImageUrl('');
    setImageFile(null);
    form.resetFields();
    setModalVisible(true);
  };

  useEffect(() => {
    fetchItems();
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
                    <Select placeholder="Select unit">
                      <Select.Option value="pcs">Pieces</Select.Option>
                      <Select.Option value="kg">Kilograms</Select.Option>
                      <Select.Option value="g">Grams</Select.Option>
                      <Select.Option value="l">Liters</Select.Option>
                      <Select.Option value="ml">Milliliters</Select.Option>
                      <Select.Option value="m">Meters</Select.Option>
                      <Select.Option value="cm">Centimeters</Select.Option>
                      <Select.Option value="box">Box</Select.Option>
                      <Select.Option value="pack">Pack</Select.Option>
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
            
            {/* Image Upload Section */}
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
                    
                    // Create preview URL
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      setImageUrl(e.target.result);
                    };
                    reader.readAsDataURL(file);
                    setImageFile(file);
                    
                    return false; // Prevent auto upload
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
                <Select placeholder="Select or Add Manufacturer" allowClear>
                  <Select.Option value="manufacturer1">Manufacturer 1</Select.Option>
                  <Select.Option value="manufacturer2">Manufacturer 2</Select.Option>
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
                <Select placeholder="Select or Add Brand" allowClear>
                  <Select.Option value="brand1">Brand 1</Select.Option>
                  <Select.Option value="brand2">Brand 2</Select.Option>
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

          {/* Sales Information Section */}
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

          {/* Purchase Information Section */}
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

          {/* Inventory Tracking Section */}
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
    </div>
  );
};

export default Items;