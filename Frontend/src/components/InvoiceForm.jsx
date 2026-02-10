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
import dayjs from 'dayjs';
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
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedParty, setSelectedParty] = useState(null);
  const [invoiceLines, setInvoiceLines] = useState([{ key: 1 }]);
  const [invoiceCurrency, setInvoiceCurrency] = useState(currency || 'USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [totals, setTotals] = useState({
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 0
  });

  const loadParties = async (search = '') => {
    try {
      const endpoint = type === 'purchase' 
        ? '/purchase-invoices/vendors/list'
        : '/sales-invoices/customers/list';
      const response = await apiService.get(endpoint, {
        params: { search }
      });
      if (response.success) {
        setParties(response.data || []);
      }
    } catch (error) {
      console.error(`Error loading ${type === 'purchase' ? 'vendors' : 'customers'}:`, error);
    }
  };

  const loadItems = async (search = '') => {
    try {
      const endpoint = type === 'purchase'
        ? '/purchase-invoices/items/list'
        : '/sales-invoices/items/list';
      const response = await apiService.get(endpoint, {
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
      const priceField = type === 'purchase' ? 'cost_price' : 'selling_price';
      const unitPriceKey = type === 'purchase' ? 'unitCost' : 'unitPrice';
      setInvoiceLines(invoiceLines.map(line => 
        line.key === key ? {
          ...line,
          itemId: item.id,
          itemName: item.name,
          [unitPriceKey]: item[priceField] || 0,
          sku: item.sku,
          unit: item.unit
        } : line
      ));
      console.log('Updated line with item:', { key, itemId: item.id, itemName: item.name });
    }
  };

  const loadPartyDetails = async (partyId) => {
    try {
      const endpoint = type === 'purchase'
        ? `/purchase-invoices/vendors/${partyId}/details`
        : `/sales-invoices/customers/${partyId}/details`;
      const response = await apiService.get(endpoint);
      if (response.success) {
        setSelectedParty(response.data);
        const nameField = type === 'purchase' ? 'vendorName' : 'customerName';
        form.setFieldsValue({
          [nameField]: response.data.name,
          currency: response.data.businessInfo?.currency || 'USD'
        });
        setInvoiceCurrency(response.data.businessInfo?.currency || 'USD');
      }
    } catch (error) {
      console.error(`Error loading ${type === 'purchase' ? 'vendor' : 'customer'} details:`, error);
      message.error(`Failed to load ${type === 'purchase' ? 'vendor' : 'customer'} details`);
    }
  };

  const handlePartySelect = (partyId) => {
    const party = parties.find(p => p.id === partyId);
    if (party) {
      loadPartyDetails(partyId);
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
      const unitPrice = type === 'purchase' ? (line.unitCost || 0) : (line.unitPrice || 0);
      const discountRate = line.discountRate || 0;
      const taxRate = line.taxRate || 0;

      const lineTotal = quantity * unitPrice;
      const discountAmount = (lineTotal * discountRate) / 100;
      const taxableAmount = lineTotal - discountAmount;
      const taxAmount = (taxableAmount * taxRate) / 100;

      subtotal += lineTotal;
      totalDiscount += discountAmount;
      totalTax += taxAmount;
    });

    const grandTotal = subtotal - totalDiscount + totalTax;
    const rate = exchangeRate || 1;

    setTotals({
      subtotal: Math.round(subtotal * rate * 100) / 100,
      totalDiscount: Math.round(totalDiscount * rate * 100) / 100,
      totalTax: Math.round(totalTax * rate * 100) / 100,
      grandTotal: Math.round(grandTotal * rate * 100) / 100
    });
  }, [invoiceLines, exchangeRate, type]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Debug: Log current invoice lines
      console.log('Current invoice lines:', invoiceLines);
      
      // More lenient validation - check if we have basic line data
      const validLines = invoiceLines.filter(line => {
        const hasItem = !!(line.itemName && line.itemName.trim());
        const hasQuantity = !!(line.quantity && line.quantity > 0);
        const unitPriceKey = type === 'purchase' ? 'unitCost' : 'unitPrice';
        const hasPrice = !!(line[unitPriceKey] && line[unitPriceKey] > 0);
        return hasItem && hasQuantity && hasPrice;
      });
      
      console.log('Valid lines:', validLines);
      
      if (validLines.length === 0) {
        message.error('Please add at least one line item with name, quantity, and price');
        return;
      }
      
      setLoading(true);

      const prefix = type === 'purchase' ? 'PI' : 'SI';
      const invoiceData = {
        ...values,
        invoiceNumber: values.invoiceNumber?.trim() || `${prefix}${Date.now()}`,
        invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        lines: validLines.map(line => {
          const lineData = {
            itemName: line.itemName,
            quantity: Number(line.quantity)
          };
          
          if (type === 'purchase') {
            lineData.unitCost = Number(line.unitCost || 0);
          } else {
            lineData.unitPrice = Number(line.unitPrice || 0);
          }
          
          if (line.itemId && !line.itemId.includes('manual_')) {
            lineData.itemId = line.itemId;
          }
          
          return lineData;
        }),
        totals
      };

      console.log('Sending invoice data:', invoiceData);

      const baseUrl = type === 'purchase' ? '/purchase-invoices' : '/sales-invoices';
      const url = invoiceId ? `${baseUrl}/${invoiceId}` : baseUrl;
      const method = invoiceId ? 'put' : 'post';
      console.log('Request:', method, url);
      const response = await apiService[method](url, invoiceData);
      console.log('Response:', response);

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
      console.error('Error response:', error.response?.data);
      let errorMessage = 'Failed to save invoice';
      
      if (error.response?.data?.error) {
        const serverError = error.response.data.error;
        if (serverError.includes('foreign key constraint') || serverError.includes('purchase_invoice_lines_ibfk_1')) {
          errorMessage = 'Database error: Invoice could not be saved due to a system issue. Please contact support.';
        } else {
          errorMessage = serverError;
        }
      } else if (error.response?.data?.details) {
        errorMessage = error.response.data.details.map(d => d.message).join(', ');
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
    loadParties();
    loadItems();
    if (invoiceId) {
      loadInvoiceData();
    }
  }, []);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      const baseUrl = type === 'purchase' ? '/purchase-invoices' : '/sales-invoices';
      const response = await apiService.get(`${baseUrl}/${invoiceId}`);
      if (response.success) {
        const { invoice, lines } = response.data;
        const partyIdField = type === 'purchase' ? 'vendor_id' : 'customer_id';
        const partyNameField = type === 'purchase' ? 'vendor_name' : 'customer_name';
        const formPartyIdField = type === 'purchase' ? 'vendorId' : 'customerId';
        const formPartyNameField = type === 'purchase' ? 'vendorName' : 'customerName';
        
        form.setFieldsValue({
          invoiceNumber: invoice.invoice_number,
          invoiceDate: invoice.invoice_date ? dayjs(invoice.invoice_date) : null,
          dueDate: invoice.due_date ? dayjs(invoice.due_date) : null,
          [formPartyIdField]: invoice[partyIdField],
          [formPartyNameField]: invoice[partyNameField],
          currency: invoice.currency || 'USD',
          reference: invoice.reference,
          notes: invoice.notes
        });
        setInvoiceCurrency(invoice.currency || 'USD');
        if (invoice[partyIdField]) {
          loadPartyDetails(invoice[partyIdField]);
        }
        if (lines && lines.length > 0) {
          setInvoiceLines(lines.map((line, index) => {
            const lineData = {
              key: index + 1,
              itemId: line.item_id,
              itemName: line.item_name,
              sku: line.sku,
              unit: line.unit,
              quantity: line.quantity,
              discountRate: line.discount_rate || 0,
              taxRate: line.tax_rate || 0
            };
            if (type === 'purchase') {
              lineData.unitCost = line.unit_cost;
            } else {
              lineData.unitPrice = line.unit_price;
            }
            return lineData;
          }));
        }
      }
    } catch (error) {
      console.error('Error loading invoice:', error);
      message.error('Failed to load invoice data');
    } finally {
      setLoading(false);
    }
  };

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
      title: type === 'purchase' ? 'Unit Cost' : 'Unit Price',
      dataIndex: type === 'purchase' ? 'unitCost' : 'unitPrice',
      width: 120,
      render: (value, record) => (
        <InputNumber
          value={type === 'purchase' ? record.unitCost : record.unitPrice}
          min={0}
          precision={2}
          onChange={(val) => updateInvoiceLine(record.key, type === 'purchase' ? 'unitCost' : 'unitPrice', val)}
        />
      )
    },
    {
      title: 'Line Total',
      width: 120,
      render: (_, record) => {
        const quantity = record.quantity || 0;
        const unitPrice = type === 'purchase' ? (record.unitCost || 0) : (record.unitPrice || 0);
        const lineTotal = quantity * unitPrice;
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
                name={type === 'purchase' ? 'vendorId' : 'customerId'}
                label={type === 'purchase' ? 'Vendor' : 'Customer'}
                rules={[{ required: true, message: `Please select ${type === 'purchase' ? 'vendor' : 'customer'}` }]}
              >
                <Select
                  showSearch
                  placeholder={`Select ${type === 'purchase' ? 'vendor' : 'customer'}`}
                  optionFilterProp="children"
                  onSelect={handlePartySelect}
                  filterOption={false}
                >
                  {parties.map(party => (
                    <Option key={party.id} value={party.id}>
                      {party.displayText}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name={type === 'purchase' ? 'vendorName' : 'customerName'} label={`${type === 'purchase' ? 'Vendor' : 'Customer'} Name`} style={{ display: 'none' }}>
                <Input />
              </Form.Item>
              <Form.Item name="currency" label="Currency">
                <Select 
                  value={invoiceCurrency}
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
              <Form.Item name="exchangeRate" label="Exchange Rate">
                <InputNumber
                  min={0}
                  precision={4}
                  placeholder="1.0000"
                  style={{ width: '100%' }}
                  onChange={(value) => setExchangeRate(value || 1)}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="reference" label="Reference">
                <Input placeholder="Reference number" />
              </Form.Item>
            </Col>
          </Row>

          {selectedParty && (
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f9f9f9' }}>
              <Title level={5}>{type === 'purchase' ? 'Vendor' : 'Customer'} Details</Title>
              <Row gutter={16}>
                <Col span={12}>
                  <Text strong>Company:</Text> {selectedParty.companyName}<br/>
                  <Text strong>Contact:</Text> {selectedParty.contact.person}<br/>
                  <Text strong>Email:</Text> {selectedParty.contact.email}<br/>
                  <Text strong>Phone:</Text> {selectedParty.contact.phone}
                </Col>
                <Col span={12}>
                  <Text strong>Billing Address:</Text><br/>
                  {selectedParty.billingAddress.line1}<br/>
                  {selectedParty.billingAddress.city}, {selectedParty.billingAddress.state}<br/>
                  {selectedParty.billingAddress.country} - {selectedParty.billingAddress.postalCode}
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