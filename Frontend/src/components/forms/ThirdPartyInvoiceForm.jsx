import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Form, Input, Select, DatePicker, InputNumber, Button, Card, Row, Col,
  Table, Space, Typography, message, Radio, Tag, Tooltip, Spin,
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

function partyDisplayName(party) {
  return party?.display_name || party?.company_name || party?.name || party?.displayText || '';
}

function normalizePartyId(id) {
  if (id == null || id === '') return null;
  return String(id).trim().toLowerCase();
}

function matchPartyId(rawId, catalog = []) {
  if (!rawId) return null;
  const norm = normalizePartyId(rawId);
  const found = catalog.find((p) => normalizePartyId(p.id) === norm);
  return found?.id ?? rawId;
}

function resolvePartyMode(invoice, loadedType) {
  if (loadedType === 'purchase') {
    return invoice.party_type === 'vendor' || invoice.party_id ? 'vendor' : 'manual';
  }
  return invoice.party_type === 'customer' || invoice.party_id ? 'customer' : 'manual';
}

function hasAddressData(addr = {}) {
  return Boolean(addr.line1 || addr.line2 || addr.city || addr.state || addr.postalCode || addr.country);
}

function hasBankDetails(bank) {
  if (!bank || typeof bank !== 'object') return false;
  return Boolean(
    bank.bankName || bank.bank_name
    || bank.accountNumber || bank.account_number
    || bank.ifscCode || bank.ifsc_code
  );
}

function VendorBankDetailsCard({ bankDetails }) {
  if (!hasBankDetails(bankDetails)) return null;
  const bank = bankDetails;
  const rows = [
    ['Account holder', bank.accountHolder || bank.account_holder_name],
    ['Bank name', bank.bankName || bank.bank_name],
    ['Account number', bank.accountNumber || bank.account_number],
    ['Branch', bank.branchName || bank.branch_name],
    ['IFSC', bank.ifscCode || bank.ifsc_code],
    ['Account type', bank.accountType || bank.account_type],
    ['SWIFT', bank.swiftCode || bank.swift_code],
    ['IBAN', bank.iban],
  ].filter(([, value]) => value);

  return (
    <Card size="small" style={{ marginBottom: 12, background: '#f6ffed', borderColor: '#b7eb8f' }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Vendor bank details</Text>
      {rows.map(([label, value]) => (
        <div key={label} style={{ fontSize: 12, marginBottom: 4 }}>
          <Text type="secondary">{label}: </Text>
          <Text>{value}</Text>
        </div>
      ))}
      <Text type="secondary" style={{ fontSize: 11 }}>
        Shown on purchase invoice PDF footer (same as regular PI).
      </Text>
    </Card>
  );
}

const ThirdPartyInvoiceForm = ({ type = 'sales', invoiceId = null, onSave }) => {
  const isPurchase = type === 'purchase';
  const isProforma = type === 'proforma';
  const docMetaType = isPurchase ? 'purchaseInvoice' : isProforma ? 'proformaInvoice' : 'salesInvoice';
  const partyCatalogMode = isPurchase ? 'vendor' : 'customer';
  const invoicePrefix = isPurchase ? 'PI' : isProforma ? 'PF' : 'SI';
  const invoiceNumberLabel = isProforma ? 'Proforma No.' : 'Invoice #';
  const invoiceNumberPlaceholder = isProforma ? 'Auto (e.g. KB/PI/00013)' : `Auto: ${invoicePrefix}000001`;
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
  const [initializing, setInitializing] = useState(Boolean(invoiceId));
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [companyGstin, setCompanyGstin] = useState('');
  const [partyMode, setPartyMode] = useState(
    () => (isPurchase ? 'vendor' : (invoiceId ? 'customer' : 'manual'))
  );
  const [selectedParty, setSelectedParty] = useState(null);
  const [vendorBankDetails, setVendorBankDetails] = useState(null);
  const [shipSameAsBill, setShipSameAsBill] = useState(true);
  const [companyShipSameAsBill, setCompanyShipSameAsBill] = useState(true);
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
      if (res.success) {
        const list = res.data || [];
        setCustomers(list);
        return list;
      }
    } catch { /* non-blocking */ }
    return [];
  };

  const loadVendors = async () => {
    try {
      const res = await apiService.get('/third-party-invoices/vendors/list');
      if (res.success) {
        const list = res.data || [];
        setVendors(list);
        return list;
      }
    } catch { /* non-blocking */ }
    return [];
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

  const applyPartyDetails = (data) => {
    if (!data) return;
    setSelectedParty(data);
    if (isPurchase && hasBankDetails(data.bankDetails)) {
      setVendorBankDetails(data.bankDetails);
    }
    const bill = addressFromPartyRecord(data.billingAddress);
    const ship = addressFromPartyRecord(data.shippingAddress);
    const same = JSON.stringify(bill) === JSON.stringify(ship);
    setShipSameAsBill(same || !ship.line1);
    form.setFieldsValue({
      partyName: data.name || data.companyName || form.getFieldValue('partyName'),
      partyGstin: data.taxInfo?.gstin || form.getFieldValue('partyGstin') || '',
      billingAddress: bill,
      shippingAddress: ship.line1 ? ship : bill,
      billingAddressId: data.billingAddress?.id || null,
      shippingAddressId: data.shippingAddress?.id || null,
    });
  };

  const loadPartyDetails = async (partyId, { preserveAddresses = false, savedBank = null, fallbackParty = null } = {}) => {
    const endpoint = isPurchase
      ? `/third-party-invoices/vendors/${partyId}/details`
      : `/third-party-invoices/customers/${partyId}/details`;
    try {
      const res = await apiService.get(endpoint);
      if (res.success && res.data) {
        setSelectedParty(res.data);
        if (isPurchase) {
          setVendorBankDetails(
            hasBankDetails(res.data.bankDetails) ? res.data.bankDetails : (savedBank || null)
          );
        }
        if (!preserveAddresses) {
          applyPartyDetails(res.data);
        }
      } else if (fallbackParty) {
        setSelectedParty(fallbackParty);
        if (isPurchase && hasBankDetails(fallbackParty.bankDetails)) {
          setVendorBankDetails(fallbackParty.bankDetails);
        }
        message.warning('Could not load party details — showing saved invoice data');
      } else {
        message.warning('Could not load party details');
      }
    } catch {
      if (fallbackParty) {
        setSelectedParty(fallbackParty);
        if (isPurchase && hasBankDetails(fallbackParty.bankDetails)) {
          setVendorBankDetails(fallbackParty.bankDetails);
        }
      } else {
        message.error(`Failed to load ${isPurchase ? 'vendor' : 'customer'} details`);
      }
    }
  };

  const handleCustomerSelect = async (customerId) => {
    const customer = customers.find((c) => c.id === customerId);
    form.setFieldsValue({
      partyId: customerId,
      partyName: partyDisplayName(customer),
      partyGstin: customer?.gstin || '',
      partyType: 'customer',
    });
    await loadPartyDetails(customerId);
  };

  const handleVendorSelect = async (vendorId) => {
    const vendor = vendors.find((v) => v.id === vendorId);
    form.setFieldsValue({
      partyId: vendorId,
      partyName: partyDisplayName(vendor),
      partyGstin: vendor?.gstin || '',
      partyType: 'vendor',
    });
    await loadPartyDetails(vendorId);
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

  const handleCompanyShipSameAsBill = (checked) => {
    setCompanyShipSameAsBill(checked);
    if (checked) {
      const bill = form.getFieldValue('companyBillingAddress') || EMPTY_INVOICE_ADDRESS;
      form.setFieldsValue({ companyShippingAddress: { ...bill } });
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
      const shipSame = shipSameAsBill;
      const companyShipSame = companyShipSameAsBill;
      if (shipSame) {
        const bill = form.getFieldValue('billingAddress') || EMPTY_INVOICE_ADDRESS;
        form.setFieldsValue({ shippingAddress: { ...bill } });
      }
      if (companyShipSame) {
        const bill = form.getFieldValue('companyBillingAddress') || EMPTY_INVOICE_ADDRESS;
        form.setFieldsValue({ companyShippingAddress: { ...bill } });
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

      const partyAddresses = buildPartyAddressesPayload(
        { ...values, companyShipSameAsBill: companyShipSame },
        shipSame,
        isPurchase ? vendorBankDetails : null
      );

      const payload = {
        invoiceType: type,
        invoiceNumber: values.invoiceNumber || undefined,
        partyType: values.partyType || (partyMode === partyCatalogMode ? partyCatalogMode : 'other'),
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
        documentMeta: formatDocumentMetaForApi(values.documentMeta, dayjs, docMetaType),
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
        message.success(`Third-party ${invoicePrefix} invoice ${invoiceId ? 'updated' : 'created'} successfully`);
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
      setInitializing(true);
      const res = await apiService.get(`/third-party-invoices/${invoiceId}`);
      if (!res.success) {
        message.error(res.error || 'Failed to load invoice');
        return;
      }
      const { invoice, lines } = res.data;
      const loadedType = invoice.invoice_type === 'purchase'
        ? 'purchase'
        : invoice.invoice_type === 'proforma'
          ? 'proforma'
          : 'sales';
      const loadedDocMetaType = loadedType === 'purchase'
        ? 'purchaseInvoice'
        : loadedType === 'proforma'
          ? 'proformaInvoice'
          : 'salesInvoice';
      setPartyMode(resolvePartyMode(invoice, loadedType));

      let catalog = loadedType === 'purchase'
        ? await loadVendors()
        : await loadCustomers();

      if (invoice.party_id && invoice.party_name) {
        const norm = normalizePartyId(invoice.party_id);
        if (!catalog.some((p) => normalizePartyId(p.id) === norm)) {
          const savedEntry = {
            id: invoice.party_id,
            display_name: invoice.party_name,
            company_name: invoice.party_name,
            gstin: invoice.party_gstin,
          };
          catalog = [...catalog, savedEntry];
          if (loadedType === 'purchase') setVendors(catalog);
          else setCustomers(catalog);
        }
      }

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
      const hasSavedBill = hasAddressData(bill);
      const hasSavedShip = hasAddressData(ship);
      const companyBill = addressFromPartyRecord(
        partyAddr.companyBillingAddress || partyAddr.companyAddressSelection?.billingAddress
      );
      const companyShip = addressFromPartyRecord(
        partyAddr.companyShippingAddress || partyAddr.companyAddressSelection?.shippingAddress
      );
      const companySame = JSON.stringify(companyBill) === JSON.stringify(companyShip);
      setCompanyShipSameAsBill(companySame || !hasAddressData(companyShip));
      const same = JSON.stringify(bill) === JSON.stringify(ship);
      setShipSameAsBill(same || !hasSavedShip);
      if (loadedType === 'purchase' && hasBankDetails(partyAddr.bankDetails)) {
        setVendorBankDetails(partyAddr.bankDetails);
      }

      const partyId = matchPartyId(invoice.party_id, catalog);

      form.setFieldsValue({
        invoiceNumber: invoice.invoice_number,
        partyType: invoice.party_type || (loadedType === 'purchase' ? 'vendor' : 'customer'),
        partyId,
        partyName: invoice.party_name,
        partyGstin: invoice.party_gstin,
        billingAddress: bill,
        shippingAddress: hasSavedShip ? ship : (ship.line1 ? ship : bill),
        billingAddressId: partyAddr.partyAddressSelection?.billingAddressId || null,
        shippingAddressId: partyAddr.partyAddressSelection?.shippingAddressId || null,
        companyBillingAddress: companyBill,
        companyShippingAddress: hasAddressData(companyShip) ? companyShip : (companyShip.line1 ? companyShip : companyBill),
        invoiceDate: invoice.invoice_date ? dayjs(invoice.invoice_date) : null,
        dueDate: invoice.due_date ? dayjs(invoice.due_date) : null,
        currency: invoice.currency || institutionCurrency,
        exchangeRate: Number.isFinite(er) && er > 0 ? er : 1,
        reference: invoice.reference,
        notes: invoice.notes,
        documentMeta: documentMetaToFormValues(invoice.documentMeta, dayjs, loadedDocMetaType),
      });

      if (partyId) {
        await loadPartyDetails(partyId, {
          preserveAddresses: hasSavedBill || hasSavedShip,
          savedBank: partyAddr.bankDetails || null,
          fallbackParty: {
            name: invoice.party_name,
            contact: {},
            billingAddress: bill,
            billingAddresses: hasSavedBill ? [{ ...bill, id: 'saved' }] : [],
            bankDetails: partyAddr.bankDetails || null,
          },
        });
      } else if (loadedType === 'purchase') {
        setSelectedParty({
          name: invoice.party_name,
          contact: {},
          billingAddress: bill,
          billingAddresses: bill.line1 ? [{ ...bill, id: 'saved' }] : [],
          bankDetails: partyAddr.bankDetails || null,
        });
      }

      if (lines?.length) {
        setInvoiceLines(lines.map((l, i) => ({
          key: i + 1,
          description: l.description,
          hsnCode: l.hsn_code,
          unit: l.unit || 'Nos',
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unit_price) || 0,
          taxRate: Number(l.tax_rate) || 0,
          discountRate: Number(l.discount_rate) || 0,
        })));
      }
    } catch {
      message.error('Failed to load invoice');
    } finally {
      setInitializing(false);
    }
  }, [invoiceId, form, institutionCurrency, isPurchase]);

  useEffect(() => {
    loadTaxRates();
    loadCompanyGstin();
    if (!invoiceId) {
      loadCustomers();
      loadVendors();
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!invoiceId) return;
    loadInvoice();
  }, [invoiceId, loadInvoice]);

  useEffect(() => {
    if (invoiceId) return;
    setInitializing(false);
    setPartyMode(isPurchase ? 'vendor' : 'manual');
    setSelectedParty(null);
    setVendorBankDetails(null);
    setShipSameAsBill(true);
    setCompanyShipSameAsBill(true);
    setInvoiceLines([{ key: 1, taxRate: 18, discountRate: 0, unit: 'Nos' }]);
    const today = dayjs();
    form.setFieldsValue({
      invoiceDate: today,
      dueDate: today.add(30, 'day'),
      currency: institutionCurrency,
      exchangeRate: 1,
      partyType: isPurchase ? 'vendor' : 'other',
      partyId: null,
      partyName: undefined,
      partyGstin: undefined,
      billingAddress: { ...EMPTY_INVOICE_ADDRESS },
      shippingAddress: { ...EMPTY_INVOICE_ADDRESS },
      companyBillingAddress: { ...EMPTY_INVOICE_ADDRESS },
      companyShippingAddress: { ...EMPTY_INVOICE_ADDRESS },
      documentMeta: emptyDocumentMetaForm(docMetaType),
    });
  }, [invoiceId, institutionCurrency, form, docMetaType, isPurchase]);

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
      title: isPurchase ? 'Unit Cost' : 'Rate',
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
    <Spin spinning={initializing} tip="Loading invoice...">
    <Form form={form} layout="vertical" preserve={false}>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={isPurchase ? 'Supplier (Bill from)' : 'Party (Bill To / Ship To)'}
            style={{ marginBottom: 16 }}
          >
            <Form.Item label="Party source">
              <Radio.Group
                value={partyMode}
                onChange={(e) => {
                  setPartyMode(e.target.value);
                  if (e.target.value === 'manual') {
                    form.setFieldsValue({ partyId: null, partyType: 'other' });
                    setSelectedParty(null);
                    setVendorBankDetails(null);
                  }
                }}
              >
                <Radio.Button value="manual">Manual entry</Radio.Button>
                <Radio.Button value={partyCatalogMode}>
                  From {isPurchase ? 'vendor' : 'customer'}
                </Radio.Button>
              </Radio.Group>
            </Form.Item>

            {partyMode === 'customer' && !isPurchase && (
              <Form.Item name="partyId" label="Customer" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select customer"
                  onSelect={handleCustomerSelect}
                  filterOption={filterSelectOption}
                  optionLabelProp="label"
                >
                  {customers.map((c) => (
                    <Option
                      key={c.id}
                      value={c.id}
                      label={partyDisplayName(c)}
                    >
                      {partyDisplayName(c)}
                      {c.gstin ? ` · ${c.gstin}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            {partyMode === 'vendor' && isPurchase && (
              <Form.Item name="partyId" label="Vendor" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Select vendor"
                  onSelect={handleVendorSelect}
                  filterOption={filterSelectOption}
                  optionLabelProp="label"
                >
                  {vendors.map((v) => (
                    <Option
                      key={v.id}
                      value={v.id}
                      label={partyDisplayName(v)}
                    >
                      {partyDisplayName(v)}
                      {v.gstin ? ` · ${v.gstin}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <Form.Item
              name="partyName"
              label={isPurchase ? 'Supplier name' : 'Party name'}
              rules={[{ required: true, message: 'Required' }]}
            >
              <Input placeholder={isPurchase ? 'Vendor / supplier name' : 'Company / person name'} />
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

            {isPurchase && (
              <VendorBankDetailsCard bankDetails={vendorBankDetails || selectedParty?.bankDetails} />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card size="small" title={isProforma ? 'Proforma Details' : 'Invoice Details'} style={{ marginBottom: 16 }}>
            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="invoiceNumber" label={invoiceNumberLabel}>
                  <Input placeholder={invoiceNumberPlaceholder} />
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
                <Form.Item
                  name="reference"
                  label={isPurchase ? 'Supplier invoice ref' : 'Reference'}
                >
                  <Input placeholder={isPurchase ? 'Vendor bill / challan no.' : 'PO / order ref'} />
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

      {isPurchase ? (
        <>
          <Card
            size="small"
            title="Bill From (Vendor)"
            style={{ marginBottom: 16 }}
          >
            <InvoicePartyAddressFields
              form={form}
              selectedParty={selectedParty}
              shipSameAsBill={shipSameAsBill}
              onShipSameAsBillChange={handleShipSameAsBill}
              onBillingAddressPick={applySavedBillingAddress}
              onShippingAddressPick={applySavedShippingAddress}
              billingTitle="Bill From (Vendor)"
              shippingTitle="Ship To"
              showShipping={false}
              sameAsBillLabel="Same as Bill To"
              savedBillingLabel="Saved vendor address"
              savedShippingLabel="Saved ship-to address"
            />
          </Card>
          <Card
            size="small"
            title="Bill To / Ship To (Your company)"
            style={{ marginBottom: 16 }}
          >
            <InvoicePartyAddressFields
              form={form}
              selectedParty={null}
              shipSameAsBill={companyShipSameAsBill}
              onShipSameAsBillChange={handleCompanyShipSameAsBill}
              billingTitle="Bill To (Your company)"
              shippingTitle="Ship To (Warehouse / branch)"
              showShipping
              sameAsBillLabel="Same as Bill To"
              billingPrefix="companyBillingAddress"
              shippingPrefix="companyShippingAddress"
            />
            <Form.Item name="companyBillingAddressId" hidden><Input /></Form.Item>
            <Form.Item name="companyShippingAddressId" hidden><Input /></Form.Item>
          </Card>
        </>
      ) : (
        <Card
          size="small"
          title="Billing & shipping address"
          style={{ marginBottom: 16 }}
        >
          <InvoicePartyAddressFields
            form={form}
            selectedParty={selectedParty}
            shipSameAsBill={shipSameAsBill}
            onShipSameAsBillChange={handleShipSameAsBill}
            onBillingAddressPick={applySavedBillingAddress}
            onShippingAddressPick={applySavedShippingAddress}
            billingTitle="Bill To"
            shippingTitle="Ship To"
            showShipping
            sameAsBillLabel="Same as Bill To"
            savedBillingLabel="Saved billing address"
            savedShippingLabel="Saved shipping address"
          />
        </Card>
      )}

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
          <DocumentMetaFields form={form} docType={docMetaType} defaultActive={isProforma} />
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
            <Card
              size="small"
              style={{ marginTop: 12 }}
              title={<><ThunderboltOutlined /> GST Summary{isProforma ? ' (Estimated)' : ''}</>}
            >
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
          {invoiceId ? `Update ${isProforma ? 'Proforma' : invoicePrefix} Invoice` : `Create ${isProforma ? 'Proforma' : invoicePrefix} Invoice`}
        </Button>
      </div>
    </Form>
    </Spin>
  );
};

export default ThirdPartyInvoiceForm;
