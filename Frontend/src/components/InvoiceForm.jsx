import React, { useState, useEffect, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Card,
  Row,
  Col,
  Table,
  Space,
  Divider,
  Typography,
  message
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined
} from '@ant-design/icons';
import apiService from '../services/apiService';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { formatPrice, getCurrencySymbol, getCurrencies } from '../utils/currency';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const InvoiceForm = ({ type = 'purchase', invoiceId = null, onSave }) => {
  const { currency } = useCurrency();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [invoiceLines, setInvoiceLines] = useState([{ key: 1 }]);
  const [invoiceCurrency, setInvoiceCurrency] = useState(currency || 'USD');
  const [totals, setTotals] = useState({
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 0
  });

  const loadVendors = async (search = '') => {
    try {
      const response = await apiService.get('/purchase-invoices/vendors/list', {
        params: { search }
      });
      if (response.success) {
        setVendors(response.data || []);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    }
  };

  const loadItems = async (search = '') => {
    try {
      const response = await apiService.get('/purchase-invoices/items/list', {
        params: { search, limit: 50 }
      });
      if (response.success) {
        setItems(response.data?.items || []);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const handleItemSelect = (key, itemId) => {
    const item = items.find(i => i.id === itemId);
    console.log('Selected item:', item);
    if (item) {
      setInvoiceLines(invoiceLines.map(line => 
        line.key === key ? {
          ...line,
          itemId: item.id,
          itemName: item.name,
          unitCost: item.cost_price || 0,
          sku: item.sku,
          unit: item.unit
        } : line
      ));
      console.log('Updated line with item:', { key, itemId: item.id, itemName: item.name });
    }
  };

  const loadVendorDetails = async (vendorId) => {
    try {
      const response = await apiService.get(`/purchase-invoices/vendors/${vendorId}/details`);
      if (response.success) {
        setSelectedVendor(response.data);
        form.setFieldsValue({
          vendorName: response.data.name,
          currency: response.data.businessInfo?.currency || 'USD'
        });
        setInvoiceCurrency(response.data.businessInfo?.currency || 'USD');
      }
    } catch (error) {
      console.error('Error loading vendor details:', error);
      message.error('Failed to load vendor details');
    }
  };

  const handleVendorSelect = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor) {
      loadVendorDetails(vendorId);
    }
  };

  const addInvoiceLine = () => {
    const newKey = Math.max(...invoiceLines.map(line => line.key)) + 1;
    setInvoiceLines([...invoiceLines, { key: newKey }]);
  };

  const removeInvoiceLine = (key) => {
    if (invoiceLines.length > 1) {
      setInvoiceLines(invoiceLines.filter(line => line.key !== key));
    }
  };

  const updateInvoiceLine = (key, field, value) => {
    setInvoiceLines(invoiceLines.map(line => 
      line.key === key ? { ...line, [field]: value } : line
    ));
  };

  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    invoiceLines.forEach(line => {
      const quantity = line.quantity || 0;
      const unitCost = line.unitCost || 0;
      const discountRate = line.discountRate || 0;
      const taxRate = line.taxRate || 0;

      const lineTotal = quantity * unitCost;
      const discountAmount = (lineTotal * discountRate) / 100;
      const taxableAmount = lineTotal - discountAmount;
      const taxAmount = (taxableAmount * taxRate) / 100;

      subtotal += lineTotal;
      totalDiscount += discountAmount;
      totalTax += taxAmount;
    });

    const grandTotal = subtotal - totalDiscount + totalTax;

    setTotals({
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      grandTotal: Math.round(grandTotal * 100) / 100
    });
  }, [invoiceLines]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Debug: Log current invoice lines
      console.log('Current invoice lines:', invoiceLines);
      
      // More lenient validation - check if we have basic line data
      const validLines = invoiceLines.filter(line => {
        const hasValidItem = !!(line.itemId && !line.itemId.includes('manual_'));
        const hasManualItem = !!(line.itemName && !line.itemId);
        const hasItem = hasValidItem || hasManualItem;
        const hasQuantity = !!(line.quantity && line.quantity > 0);
        const hasCost = !!(line.unitCost && line.unitCost > 0);
        const isValid = hasItem && hasQuantity && hasCost;
        
        console.log('Line validation:', {
          line,
          hasValidItem,
          hasManualItem,
          hasItem,
          hasQuantity,
          hasCost,
          isValid
        });
        
        return isValid;
      });
      
      console.log('Valid lines:', validLines);
      
      if (validLines.length === 0) {
        message.error('Please select an item from the dropdown for at least one line');
        return;
      }
      
      setLoading(true);

      const invoiceData = {
        ...values,
        invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        lines: validLines.map(line => {
          const lineData = {
            itemName: line.itemName,
            quantity: Number(line.quantity),
            unitCost: Number(line.unitCost)
          };
          
          // Only include itemId if it's a valid GUID (from dropdown selection)
          if (line.itemId && !line.itemId.includes('manual_')) {
            lineData.itemId = line.itemId;
          }
          
          return lineData;
        }),
        totals
      };

      console.log('Sending invoice data:', invoiceData);

      const url = invoiceId 
        ? `/purchase-invoices/${invoiceId}`
        : '/purchase-invoices';
      
      const method = invoiceId ? 'put' : 'post';
      const response = await apiService[method](url, invoiceData);

      if (response.success) {
        message.success(`Invoice ${invoiceId ? 'updated' : 'created'} successfully`);
        if (onSave) onSave(response.data);
      } else {
        const errorMsg = response.error?.includes('foreign key constraint') 
          ? 'Database error: Unable to save invoice. Please try again or contact support.'
          : response.error || 'Failed to save invoice';
        message.error(errorMsg);
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      let errorMessage = 'Failed to save invoice';
      
      if (error.response?.data?.error) {
        const serverError = error.response.data.error;
        if (serverError.includes('foreign key constraint') || serverError.includes('purchase_invoice_lines_ibfk_1')) {
          errorMessage = 'Database error: Invoice could not be saved due to a system issue. Please contact support.';
        } else {
          errorMessage = serverError;
        }
      } else if (error.response?.status === 500) {
        errorMessage = 'Server error occurred. Please try again or contact support.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
    loadItems();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const lineColumns = [
    {
      title: 'S.No',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Item',
      dataIndex: 'itemName',
      width: 200,
      render: (value, record) => (
        <div>
          <Select
            showSearch
            value={record.itemId}
            placeholder="Select item"
            optionFilterProp="children"
            onSelect={(itemId) => handleItemSelect(record.key, itemId)}
            onSearch={loadItems}
            filterOption={false}
            style={{ width: '100%', marginBottom: 8 }}
            allowClear
          >
            {items.map(item => (
              <Option key={item.id} value={item.id}>
                {item.sku} - {item.name}
              </Option>
            ))}
          </Select>
          <Input
            value={record.itemName}
            placeholder="Or enter item name manually"
            onChange={(e) => {
              updateInvoiceLine(record.key, 'itemName', e.target.value);
              if (!record.itemId) {
                updateInvoiceLine(record.key, 'itemId', `manual_${record.key}`);
              }
            }}
            style={{ width: '100%' }}
          />
        </div>
      )
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      width: 100,
      render: (value) => value || '-'
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      width: 100,
      render: (value, record) => (
        <InputNumber
          value={value}
          min={0}
          precision={2}
          onChange={(val) => updateInvoiceLine(record.key, 'quantity', val)}
        />
      )
    },
    {
      title: 'Unit Cost',
      dataIndex: 'unitCost',
      width: 120,
      render: (value, record) => (
        <InputNumber
          value={value}
          min={0}
          precision={2}
          onChange={(val) => updateInvoiceLine(record.key, 'unitCost', val)}
        />
      )
    },
    {
      title: 'Line Total',
      width: 120,
      render: (_, record) => {
        const quantity = record.quantity || 0;
        const unitCost = record.unitCost || 0;
        const lineTotal = quantity * unitCost;
        const symbol = getCurrencySymbol(invoiceCurrency);
        return `${symbol}${lineTotal.toFixed(2)}`;
      }
    },
    {
      title: 'Action',
      width: 80,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeInvoiceLine(record.key)}
          disabled={invoiceLines.length === 1}
        />
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={3}>
          {invoiceId ? 'Edit' : 'Create'} {type === 'purchase' ? 'Purchase' : 'Sales'} Invoice
        </Title>
        
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="invoiceNumber"
                label="Invoice Number"
                rules={[{ required: true, message: 'Please enter invoice number' }]}
              >
                <Input placeholder="Auto-generated if empty" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="invoiceDate"
                label="Invoice Date"
                rules={[{ required: true, message: 'Please select invoice date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="dueDate"
                label="Due Date"
                rules={[{ required: true, message: 'Please select due date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="vendorId"
                label="Vendor"
                rules={[{ required: true, message: 'Please select vendor' }]}
              >
                <Select
                  showSearch
                  placeholder="Select vendor"
                  optionFilterProp="children"
                  onSelect={handleVendorSelect}
                  filterOption={false}
                >
                  {vendors.map(vendor => (
                    <Option key={vendor.id} value={vendor.id}>
                      {vendor.displayText}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="vendorName" label="Vendor Name" style={{ display: 'none' }}>
                <Input />
              </Form.Item>
              <Form.Item name="currency" label="Currency">
                <Select 
                  defaultValue={currency}
                  onChange={(value) => setInvoiceCurrency(value)}
                >
                  {getCurrencies().map(curr => (
                    <Option key={curr.code} value={curr.code}>
                      {curr.symbol} {curr.code} - {curr.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="reference" label="Reference">
                <Input placeholder="Reference number" />
              </Form.Item>
            </Col>
          </Row>

          {selectedVendor && (
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f9f9f9' }}>
              <Title level={5}>Vendor Details</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Company:</Text> {selectedVendor.companyName}<br/>
                  <Text strong>Contact:</Text> {selectedVendor.contact.person}<br/>
                  <Text strong>Email:</Text> {selectedVendor.contact.email}<br/>
                  <Text strong>Phone:</Text> {selectedVendor.contact.phone}
                </Col>
                <Col span={12}>
                  <Text strong>Billing Address:</Text><br/>
                  {selectedVendor.billingAddress.line1}<br/>
                  {selectedVendor.billingAddress.city}, {selectedVendor.billingAddress.state}<br/>
                  {selectedVendor.billingAddress.country} - {selectedVendor.billingAddress.postalCode}
                </Col>
              </Row>
            </Card>
          )}

          <Divider>Invoice Items</Divider>
          
          <Table
            columns={lineColumns}
            dataSource={invoiceLines}
            pagination={false}
            size="small"
          />
          
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <Button
              type="dashed"
              onClick={addInvoiceLine}
              icon={<PlusOutlined />}
              style={{ width: '100%' }}
            >
              Add Line Item
            </Button>
          </div>

          <Row justify="end">
            <Col span={8}>
              <Card size="small">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Subtotal:</Text>
                  <Text>{getCurrencySymbol(invoiceCurrency)}{totals.subtotal.toFixed(2)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Total Discount:</Text>
                  <Text>-{getCurrencySymbol(invoiceCurrency)}{totals.totalDiscount.toFixed(2)}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Total Tax:</Text>
                  <Text>{getCurrencySymbol(invoiceCurrency)}{totals.totalTax.toFixed(2)}</Text>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong>Grand Total:</Text>
                  <Text strong style={{ fontSize: '16px' }}>{getCurrencySymbol(invoiceCurrency)}{totals.grandTotal.toFixed(2)}</Text>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes or terms" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 24, textAlign: 'right' }}>
            <Space>
              <Button type="primary" onClick={handleSave} loading={loading} icon={<SaveOutlined />}>
                {invoiceId ? 'Update' : 'Create'} Invoice
              </Button>
            </Space>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default InvoiceForm;