import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Form, Input, Select, DatePicker, InputNumber, Button, Card, Row, Col,
  Table, Space, Typography, message, Radio, Tag, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { getCurrencySymbol, getCurrencies } from '../../utils/currency';
import {
  calculateCommercialTotals,
  getExchangeRateValidationError,
  roundMoney,
} from '../../utils/commercialDocument';
import { useCommercialDocumentCurrency } from '../../hooks/useCommercialDocumentCurrency';
import DocumentMetaFields from '../business/DocumentMetaFields';
import {
  documentMetaToFormValues,
  emptyDocumentMetaForm,
  formatDocumentMetaForApi,
} from '../../constants/documentMetaFields';
import DocumentTotalsSummary from '../business/DocumentTotalsSummary';
import CommercialExchangeRateField from '../business/CommercialExchangeRateField';
import InvoicePartyAddressFields, {
  EMPTY_INVOICE_ADDRESS,
  addressFromPartyRecord,
  buildPartyAddressesPayload,
} from '../business/InvoicePartyAddressFields';
import { filterSelectOption } from '../../utils/selectFilter';

const { Text } = Typography;
const { Option } = Select;

const GST_SLABS = [0, 5, 12, 18, 28];
const COMMON_UNITS = ['Nos', 'Pcs', 'Kg', 'Ltr', 'Mtr', 'Box', 'Set', 'Hr', 'Day'];

function gstStateCode(gstin) {
  const s = String(gstin || '').trim().toUpperCase();
  if (s.length >= 2 && /^\d{2}/.test(s)) return s.slice(0, 2);
  return null;
}

function isIntraState(sellerGstin, buyerGstin) {
  const a = gstStateCode(sellerGstin);
  const b = gstStateCode(buyerGstin);
  return Boolean(a && b && a === b);
}

function lineNetAmount(line) {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.unitPrice) || 0;
  const disc = Number(line.discountRate) || 0;
  const tax = Number(line.taxRate) || 0;
  const lineTotal = qty * rate;
  const discountAmount = (lineTotal * disc) / 100;
  const taxable = lineTotal - discountAmount;
  const taxAmount = (taxable * tax) / 100;
  return roundMoney(taxable + taxAmount);
}

const ThirdPartyInvoiceForm = ({ invoiceId = null, onSave }) => {
  const { baseCurrency: institutionCurrency } = useCurrency();
  const [form] = Form.useForm();
  const {
    documentCurrency: invoiceCurrency,
    exchangeRate,
    rateMissing,
    rateSource,
    syncRateToForm,
    applyResolvedRate,
  } = useCommercialDocumentCurrency(form);

  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [companyGstin, setCompanyGstin] = useState('');
  const [partyMode, setPartyMode] = useState('manual');
  const [selectedParty, setSelectedParty] = useState(null);
  const [shipSameAsBill, setShipSameAsBill] = useState(true);
  const [invoiceLines, setInvoiceLines] = useState([
    { key: 1, taxRate: 18, discountRate: 0, unit: 'Nos' },
  ]);

  const totals = useMemo(
    () => calculateCommercialTotals(invoiceLines, { getUnitAmount: (l) => Number(l.unitPrice) || 0 }),
    [invoiceLines]
  );

  const partyGstin = Form.useWatch('partyGstin', form);
  const intraState = useMemo(
    () => isIntraState(companyGstin, partyGstin),
    [companyGstin, partyGstin]
  );

  const gstBreakdown = useMemo(() => {
    const totalTax = totals.totalTax;
    if (totalTax <= 0) return null;
    if (intraState) {
      const half = roundMoney(totalTax / 2);
      return { type: 'intra', cgst: half, sgst: half, igst: 0 };
    }
    return { type: 'inter', cgst: 0, sgst: 0, igst: totalTax };
  }, [totals.totalTax, intraState]);

  const loadCustomers = async () => {
    try {
      const res = await apiService.get('/third-party-invoices/customers/list');
      if (res.success) setCustomers(res.data || []);
    } catch { /* non-blocking */ }
  };

  const loadTaxRates = async () => {
    try {
      const res = await apiService.get('/tax/rates');
      if (res.success) setTaxRates(res.data || []);
    } catch { /* non-blocking */ }
  };

  const loadCompanyGstin = async () => {
    try {
      const res = await apiService.get('/company-settings');
      if (res.success) {
        const gst = res.data?.tax_id || res.data?.profile?.tax_id || '';
        setCompanyGstin(String(gst).trim());
      }
    } catch { /* non-blocking */ }
  };

  const handleCustomerSelect = async (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    form.setFieldsValue({
      partyId: customer.id,
      partyName: customer.display_name || customer.company_name,
      partyGstin: customer.gstin || '',
      partyType: 'customer',
    });
    try {
      const res = await apiService.get(`/third-party-invoices/customers/${customerId}/details`);
      if (res.success && res.data) {
        setSelectedParty(res.data);
        const bill = addressFromPartyRecord(res.data.billingAddress);
        const ship = addressFromPartyRecord(res.data.shippingAddress);
        const same = JSON.stringify(bill) === JSON.stringify(ship);
        setShipSameAsBill(same || !ship.line1);
        form.setFieldsValue({
          billingAddress: bill,
          shippingAddress: ship,
          billingAddressId: res.data.billingAddress?.id || null,
          shippingAddressId: res.data.shippingAddress?.id || null,
        });
        if (res.data.taxInfo?.gstin) {
          form.setFieldsValue({ partyGstin: res.data.taxInfo.gstin });
        }
      }
    } catch { /* optional */ }
  };

  const applySavedBillingAddress = (key) => {
    const list = selectedParty?.billingAddresses?.length
      ? selectedParty.billingAddresses
      : selectedParty?.billingAddress
        ? [selectedParty.billingAddress]
        : [];
    const idx = list.findIndex((a, i) => String(a.id || i) === String(key));
    const addr = list[idx >= 0 ? idx : 0];
    if (!addr) return;
    form.setFieldsValue({
      billingAddress: addressFromPartyRecord(addr),
      billingAddressId: addr.id || null,
    });
  };

  const applySavedShippingAddress = (key) => {
    const list = selectedParty?.shippingAddresses?.length
      ? selectedParty.shippingAddresses
      : selectedParty?.shippingAddress
        ? [selectedParty.shippingAddress]
        : [];
    const idx = list.findIndex((a, i) => String(a.id || i) === String(key));
    const addr = list[idx >= 0 ? idx : 0];
    if (!addr) return;
    setShipSameAsBill(false);
    form.setFieldsValue({
      shippingAddress: addressFromPartyRecord(addr),
      shippingAddressId: addr.id || null,
    });
  };

  const handleShipSameAsBill = (checked) => {
    setShipSameAsBill(checked);
    if (checked) {
      const bill = form.getFieldValue('billingAddress') || EMPTY_INVOICE_ADDRESS;
      form.setFieldsValue({ shippingAddress: { ...bill } });
    }
  };

  const addLine = () => {
    const newKey = Math.max(...invoiceLines.map((l) => l.key), 0) + 1;
    setInvoiceLines([...invoiceLines, { key: newKey, taxRate: 18, discountRate: 0, unit: 'Nos' }]);
  };

  const removeLine = (key) => {
    if (invoiceLines.length > 1) {
      setInvoiceLines(invoiceLines.filter((l) => l.key !== key));
    }
  };

  const updateLine = (key, field, value) => {
    setInvoiceLines(invoiceLines.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const applyGstToAll = (rate) => {
    setInvoiceLines(invoiceLines.map((l) => ({ ...l, taxRate: rate })));
    message.success(`GST ${rate}% applied to all lines`);
  };

  const handleSave = async () => {
    try {
      if (shipSameAsBill) {
        const bill = form.getFieldValue('billingAddress') || EMPTY_INVOICE_ADDRESS;
        form.setFieldsValue({ shippingAddress: { ...bill } });
      }
      const values = await form.validateFields();
      const rateErr = getExchangeRateValidationError(
        values.currency || invoiceCurrency,
        institutionCurrency,
        values.exchangeRate
      );
      if (rateErr) { message.error(rateErr); return; }

      const validLines = invoiceLines.filter(
        (l) => l.description?.trim() && Number(l.quantity) > 0
      );
      if (!validLines.length) {
        message.error('Add at least one line with description and quantity');
        return;
      }

      const partyAddresses = buildPartyAddressesPayload(values, shipSameAsBill);

      const payload = {
        invoiceNumber: values.invoiceNumber || undefined,
        partyType: values.partyType || (partyMode === 'customer' ? 'customer' : 'other'),
        partyId: values.partyId || null,
        partyName: values.partyName,
        partyGstin: values.partyGstin || null,
        partyAddresses,
        invoiceDate: values.invoiceDate?.format('YYYY-MM-DD'),
        dueDate: values.dueDate?.format('YYYY-MM-DD'),
        currency: values.currency,
        exchangeRate: values.exchangeRate,
        reference: values.reference || undefined,
        notes: values.notes || undefined,
        documentMeta: formatDocumentMetaForApi(values.documentMeta),
        lines: validLines.map((l) => ({
          description: l.description.trim(),
          hsnCode: l.hsnCode || null,
          unit: l.unit || null,
          quantity: l.quantity,
          unitPrice: l.unitPrice || 0,
          taxRate: l.taxRate || 0,
          discountRate: l.discountRate || 0,
        })),
        totals,
      };

      setLoading(true);
      const url = invoiceId ? `/third-party-invoices/${invoiceId}` : '/third-party-invoices';
      const method = invoiceId ? 'put' : 'post';
      const response = await apiService[method](url, payload);
      if (response.success) {
        message.success(`Third-party invoice ${invoiceId ? 'updated' : 'created'} successfully`);
        onSave?.(response.data);
      } else {
        message.error(response.error || 'Failed to save invoice');
      }
    } catch (error) {
      if (error?.errorFields) return;
      const details = error.response?.data?.details;
      const msg = details?.length
        ? details.map((d) => d.message).join(', ')
        : (error.response?.data?.error || 'Failed to save invoice');
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoice = useCallback(async () => {
    if (!invoiceId) return;
    try {
      setLoading(true);
      const res = await apiService.get(`/third-party-invoices/${invoiceId}`);
      if (!res.success) return;
      const { invoice, lines } = res.data;
      const mode = invoice.party_id ? 'customer' : 'manual';
      setPartyMode(mode);
      const er = parseFloat(invoice.exchange_rate);
      const partyAddr = invoice.partyAddresses || {};
      const bill = addressFromPartyRecord(
        partyAddr.billingAddress || partyAddr.partyAddressSelection?.billingAddress
      );
      const ship = addressFromPartyRecord(
        partyAddr.shippingAddress || partyAddr.partyAddressSelection?.shippingAddress
      );
      if (!bill.line1 && invoice.party_address) {
        bill.line1 = invoice.party_address;
      }
      const same = JSON.stringify(bill) === JSON.stringify(ship);
      setShipSameAsBill(same || !ship.line1);

      form.setFieldsValue({
        invoiceNumber: invoice.invoice_number,
        partyType: invoice.party_type,
        partyId: invoice.party_id,
        partyName: invoice.party_name,
        partyGstin: invoice.party_gstin,
        billingAddress: bill,
        shippingAddress: ship.line1 ? ship : bill,
        billingAddressId: partyAddr.partyAddressSelection?.billingAddressId || null,
        shippingAddressId: partyAddr.partyAddressSelection?.shippingAddressId || null,
        invoiceDate: invoice.invoice_date ? dayjs(invoice.invoice_date) : null,
        dueDate: invoice.due_date ? dayjs(invoice.due_date) : null,
        currency: invoice.currency,
        exchangeRate: Number.isFinite(er) && er > 0 ? er : 1,
        reference: invoice.reference,
        notes: invoice.notes,
        documentMeta: documentMetaToFormValues(invoice.documentMeta, dayjs, 'salesInvoice'),
      });
      if (invoice.party_id) {
        try {
          const partyRes = await apiService.get(
            `/third-party-invoices/customers/${invoice.party_id}/details`
          );
          if (partyRes.success) setSelectedParty(partyRes.data);
        } catch { /* optional */ }
      }
      if (lines?.length) {
        setInvoiceLines(lines.map((l, i) => ({
          key: i + 1,
          description: l.description,
          hsnCode: l.hsn_code,
          unit: l.unit || 'Nos',
          quantity: l.quantity,
          unitPrice: l.unit_price,
          taxRate: l.tax_rate || 0,
          discountRate: l.discount_rate || 0,
        })));
      }
    } catch {
      message.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId, form]);

  useEffect(() => {
    loadCustomers();
    loadTaxRates();
    loadCompanyGstin();
    if (invoiceId) {
      loadInvoice();
    } else {
      const today = dayjs();
      form.setFieldsValue({
        invoiceDate: today,
        dueDate: today.add(30, 'day'),
        currency: institutionCurrency,
        exchangeRate: 1,
        partyType: 'other',
        billingAddress: { ...EMPTY_INVOICE_ADDRESS },
        shippingAddress: { ...EMPTY_INVOICE_ADDRESS },
        documentMeta: emptyDocumentMetaForm('salesInvoice'),
      });
    }
  }, [invoiceId, institutionCurrency, form, loadInvoice]);

  const sym = getCurrencySymbol(invoiceCurrency);

  const columns = [
    {
      title: '#',
      width: 44,
      render: (_, __, i) => i + 1,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      width: 220,
      render: (_, record) => (
        <Input
          value={record.description}
          placeholder="Item / service description"
          onChange={(e) => updateLine(record.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'HSN/SAC',
      width: 100,
      render: (_, record) => (
        <Input
          value={record.hsnCode}
          placeholder="HSN"
          maxLength={8}
          onChange={(e) => updateLine(record.key, 'hsnCode', e.target.value)}
        />
      ),
    },
    {
      title: 'Unit',
      width: 90,
      render: (_, record) => (
        <Select
          value={record.unit}
          style={{ width: '100%' }}
          onChange={(v) => updateLine(record.key, 'unit', v)}
          showSearch
          allowClear
        >
          {COMMON_UNITS.map((u) => <Option key={u} value={u}>{u}</Option>)}
        </Select>
      ),
    },
    {
      title: 'Qty',
      width: 90,
      render: (_, record) => (
        <InputNumber
          min={0}
          precision={2}
          value={record.quantity}
          style={{ width: '100%' }}
          onChange={(v) => updateLine(record.key, 'quantity', v)}
        />
      ),
    },
    {
      title: 'Rate',
      width: 100,
      render: (_, record) => (
        <InputNumber
          min={0}
          precision={2}
          value={record.unitPrice}
          style={{ width: '100%' }}
          onChange={(v) => updateLine(record.key, 'unitPrice', v)}
        />
      ),
    },
    {
      title: 'Disc %',
      width: 80,
      render: (_, record) => (
        <InputNumber
          min={0}
          max={100}
          value={record.discountRate}
          style={{ width: '100%' }}
          onChange={(v) => updateLine(record.key, 'discountRate', v)}
        />
      ),
    },
    {
      title: 'GST %',
      width: 100,
      render: (_, record) => (
        <Select
          value={record.taxRate}
          style={{ width: '100%' }}
          onChange={(v) => updateLine(record.key, 'taxRate', v)}
        >
          {GST_SLABS.map((r) => <Option key={r} value={r}>{r}%</Option>)}
          {taxRates.filter((t) => !GST_SLABS.includes(Number(t.rate))).map((t) => (
            <Option key={t.id} value={Number(t.rate)}>{t.name || `${t.rate}%`}</Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Amount',
      width: 100,
      render: (_, record) => (
        <Text strong>{sym}{lineNetAmount(record).toFixed(2)}</Text>
      ),
    },
    {
      title: '',
      width: 44,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.key)}
          disabled={invoiceLines.length <= 1}
        />
      ),
    },
  ];

  return (
    <Form form={form} layout="vertical">
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card size="small" title="Party (Bill To / Ship To)" style={{ marginBottom: 16 }}>
            <Form.Item label="Party source">
              <Radio.Group
                value={partyMode}
                onChange={(e) => {
                  setPartyMode(e.target.value);
                  if (e.target.value === 'manual') {
                    form.setFieldsValue({ partyId: null, partyType: 'other' });
                    setSelectedParty(null);
                  }
                }}
              >
                <Radio.Button value="manual">Manual entry</Radio.Button>
                <Radio.Button value="customer">From customer</Radio.Button>
              </Radio.Group>
            </Form.Item>

            {partyMode === 'customer' && (
              <Form.Item name="partyId" label="Customer" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select customer"
                  onChange={handleCustomerSelect}
                  filterOption={filterSelectOption}
                  optionLabelProp="label"
                >
                  {customers.map((c) => (
                    <Option
                      key={c.id}
                      value={c.id}
                      label={c.display_name || c.company_name}
                    >
                      {c.display_name || c.company_name}
                      {c.gstin ? ` · ${c.gstin}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <Form.Item name="partyName" label="Party name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="Company / person name" />
            </Form.Item>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="partyGstin" label="GSTIN">
                  <Input placeholder="22AAAAA0000A1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="partyType" hidden><Input /></Form.Item>
                <Form.Item name="billingAddressId" hidden><Input /></Form.Item>
                <Form.Item name="shippingAddressId" hidden><Input /></Form.Item>
                {partyGstin && companyGstin && (
                  <div style={{ paddingTop: 30 }}>
                    <Tag color={intraState ? 'blue' : 'orange'}>
                      {intraState ? 'Intra-state (CGST+SGST)' : 'Inter-state (IGST)'}
                    </Tag>
                  </div>
                )}
              </Col>
            </Row>

            {selectedParty && (
              <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {selectedParty.contact?.email && <>Email: {selectedParty.contact.email} · </>}
                  {selectedParty.contact?.phone && <>Phone: {selectedParty.contact.phone}</>}
                </Text>
              </Card>
            )}

            <InvoicePartyAddressFields
              form={form}
              selectedParty={selectedParty}
              shipSameAsBill={shipSameAsBill}
              onShipSameAsBillChange={handleShipSameAsBill}
              onBillingAddressPick={applySavedBillingAddress}
              onShippingAddressPick={applySavedShippingAddress}
            />
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card size="small" title="Invoice Details" style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="invoiceNumber" label="Invoice #">
                  <Input placeholder="Auto: TPI000001" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="currency" label="Currency" rules={[{ required: true }]}>
                  <Select onChange={() => syncRateToForm()}>
                    {getCurrencies().map((c) => (
                      <Option key={c.code} value={c.code}>{c.code} — {c.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="invoiceDate" label="Invoice date" rules={[{ required: true }]}>
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="dueDate" label="Due date">
                  <DatePicker style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={24}>
                <CommercialExchangeRateField
                  form={form}
                  documentCurrency={invoiceCurrency}
                  institutionCurrency={institutionCurrency}
                  exchangeRate={exchangeRate}
                  rateMissing={rateMissing}
                  rateSource={rateSource}
                  applyResolvedRate={applyResolvedRate}
                />
              </Col>
              <Col span={12}>
                <Form.Item name="reference" label="Reference">
                  <Input placeholder="PO / order ref" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="notes" label="Notes">
                  <Input placeholder="Internal notes" />
                </Form.Item>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card
        size="small"
        title={
          <Space>
            <span>Line Items</span>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
              No inventory impact — manual entry only
            </Text>
          </Space>
        }
        extra={
          <Space wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>Quick GST:</Text>
            {GST_SLABS.map((r) => (
              <Tooltip key={r} title={`Apply ${r}% to all lines`}>
                <Button size="small" onClick={() => applyGstToAll(r)}>{r}%</Button>
              </Tooltip>
            ))}
          </Space>
        }
      >
        <Table
          dataSource={invoiceLines}
          columns={columns}
          pagination={false}
          size="small"
          rowKey="key"
          scroll={{ x: 900 }}
        />
        <Button type="dashed" onClick={addLine} icon={<PlusOutlined />} style={{ marginTop: 12 }}>
          Add line
        </Button>
      </Card>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col xs={24} md={14}>
          <DocumentMetaFields form={form} documentType="salesInvoice" />
        </Col>
        <Col xs={24} md={10}>
          <DocumentTotalsSummary
            lines={invoiceLines}
            documentCurrency={invoiceCurrency}
            institutionCurrency={institutionCurrency}
            exchangeRate={exchangeRate}
            rateMissing={rateMissing}
            rateSource={rateSource}
            unitField="unitPrice"
            getTaxRate={(l) => Number(l?.taxRate) || 0}
          />
          {gstBreakdown && (
            <Card size="small" style={{ marginTop: 12 }} title={<><ThunderboltOutlined /> GST Summary</>}>
              {gstBreakdown.type === 'intra' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text>CGST</Text><Text>{sym}{gstBreakdown.cgst.toFixed(2)}</Text>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>SGST</Text><Text>{sym}{gstBreakdown.sgst.toFixed(2)}</Text>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>IGST</Text><Text>{sym}{gstBreakdown.igst.toFixed(2)}</Text>
                </div>
              )}
            </Card>
          )}
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
          size="large"
        >
          {invoiceId ? 'Update Invoice' : 'Create Third-Party Invoice'}
        </Button>
      </div>
    </Form>
  );
};

export default ThirdPartyInvoiceForm;
