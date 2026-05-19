import React, { useState, useEffect, useCallback } from "react";
import {
  Card, Table, Button, Space, Modal, Form, Input, Select,
  InputNumber, message, DatePicker, Tag,
} from "antd";
import { PlusOutlined, DownloadOutlined, PrinterOutlined, MailOutlined, SearchOutlined } from "@ant-design/icons";
import moment from 'moment';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { useTaxRates } from '../../hooks/useTaxRates';
import { getCurrencies, formatDocumentAmount, formatCommercialDocAmount } from '../../utils/currency';
import { useCommercialDocumentCurrency } from '../../hooks/useCommercialDocumentCurrency';
import {
  amountInDocumentCurrency,
  convertAmountBetweenCurrencies,
  getExchangeRateValidationError,
} from '../../utils/commercialDocument';
import { filterSelectOption } from '../../utils/selectFilter';
import DocumentTotalsSummary from '../../components/business/DocumentTotalsSummary';
import CommercialExchangeRateField from '../../components/business/CommercialExchangeRateField';
import { assertPdfBlob, printPdfBlob } from '../../utils/printPdfBlob';
import DocumentMetaFields from '../../components/business/DocumentMetaFields';
import {
  emptyDocumentMetaForm,
  formatDocumentMetaForApi,
} from '../../constants/documentMetaFields';

const DEFAULT_SO_LINE = { discountRate: 0, taxRateId: undefined };

const SalesOrders = () => {
  const { formatCurrency } = useCurrency();
  const { taxRates, getRateById } = useTaxRates();
  const [sos, setSOs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [selectedSOForView, setSelectedSOForView] = useState(null);
  const [allItemStocks, setAllItemStocks] = useState({});
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [selectedSOForEmail, setSelectedSOForEmail] = useState(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [selectedSOForCancel, setSelectedSOForCancel] = useState(null);
  const [form] = Form.useForm();
  const {
    documentCurrency,
    institutionCurrency: instCcy,
    exchangeRate,
    rateMissing,
    rateSource,
    rateResolving,
    syncRateToForm,
    applyResolvedRate,
  } = useCommercialDocumentCurrency(form);
  const watchedLines = Form.useWatch('lines', form) || [];

  const getLineTaxRate = useCallback(
    (line) => (line?.taxRateId ? parseFloat(getRateById(line.taxRateId)?.rate || 0) : 0),
    [getRateById]
  );

  const openCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      currency: instCcy,
      exchangeRate: 1,
      channel: 'direct',
      orderDate: moment(),
      lines: [{ ...DEFAULT_SO_LINE }],
      documentMeta: emptyDocumentMetaForm('salesOrder'),
    });
    setSelectedPriceListId(null);
    setPriceListItemMap({});
    setModalVisible(true);
  };

  const convertSoLinePrices = async (fromCcy, toCcy) => {
    const lines = form.getFieldValue('lines') || [];
    const updated = await Promise.all(
      lines.map(async (line) => {
        const v = Number(line?.unitPrice);
        if (!Number.isFinite(v) || v === 0) return line;
        const converted = await convertAmountBetweenCurrencies(apiService, v, fromCcy, toCcy);
        return { ...line, unitPrice: converted };
      })
    );
    form.setFieldsValue({ lines: updated });
  };

  const [searchText, setSearchText] = useState('');
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [priceLists, setPriceLists] = useState([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState(null);
  const [priceListItemMap, setPriceListItemMap] = useState({});

  const getLineDiscountRate = (itemId) => {
    const priceListEntry = priceListItemMap[itemId];
    return priceListEntry != null ? priceListEntry.discountRate : 0;
  };

  const getLineUnitPrice = (item, variantId = null) => {
    if (!item) return 0;
    let raw = 0;
    const priceListEntry = priceListItemMap[item.id];
    if (priceListEntry != null) {
      raw = priceListEntry.unitPrice;
    } else if (variantId && Array.isArray(item.variant_options)) {
      const variantOption = item.variant_options.find((option) => option.id === variantId);
      const variantSellingPrice = Number(variantOption?.sellingPrice || 0);
      raw = variantSellingPrice > 0 ? variantSellingPrice : Number(item.selling_price || 0);
    } else {
      raw = Number(item.selling_price || 0);
    }
    return (
      amountInDocumentCurrency(raw, documentCurrency || instCcy, instCcy, exchangeRate) ?? raw
    );
  };

  const fetchPriceLists = async () => {
    try {
      const res = await apiService.get('/price-lists');
      if (res.success) setPriceLists(res.data.filter(pl => pl.pricelist_type === 'sales' || pl.pricelist_type == null));
    } catch { /* optional */ }
  };

  const handlePriceListChange = async (priceListId) => {
    setSelectedPriceListId(priceListId);
    if (!priceListId) { setPriceListItemMap({}); return; }
    try {
      const res = await apiService.get(`/price-lists/${priceListId}`);
      if (res.success) {
        const pl = res.data;
        const listDiscountType  = pl.discount_type  || 'percentage';
        const listDiscountValue = parseFloat(pl.discount_value) || 0;
        // map: itemId -> { unitPrice, discountRate }
        const map = {};
        (pl.items || []).forEach(pli => {
          const base = parseFloat(pli.base_price) || 0;
          if (pli.custom_price != null && parseFloat(pli.custom_price) > 0) {
            // explicit custom price — set as unit price, no discount
            map[pli.item_id] = { unitPrice: parseFloat(pli.custom_price), discountRate: 0 };
          } else {
            const itemDv = parseFloat(pli.discount_value) || 0;
            if (itemDv > 0) {
              // item-level discount — keep base price, show discount %
              const discountRate = pli.discount_type === 'percentage'
                ? itemDv
                : (base > 0 ? (itemDv / base) * 100 : 0);
              map[pli.item_id] = { unitPrice: base, discountRate: Math.round(discountRate * 100) / 100 };
            } else if (listDiscountValue > 0) {
              // list-level discount — keep base price, show discount %
              const discountRate = listDiscountType === 'percentage'
                ? listDiscountValue
                : (base > 0 ? (listDiscountValue / base) * 100 : 0);
              map[pli.item_id] = { unitPrice: base, discountRate: Math.round(discountRate * 100) / 100 };
            } else {
              map[pli.item_id] = { unitPrice: base, discountRate: 0 };
            }
          }
        });
        setPriceListItemMap(map);
        // Re-apply prices and discounts to existing lines
        const lines = form.getFieldValue('lines') || [];
        const updated = lines.map(line => {
          if (!line.itemId || !map[line.itemId]) return line;
          return { ...line, unitPrice: map[line.itemId].unitPrice, discountRate: map[line.itemId].discountRate };
        });
        form.setFieldsValue({ lines: updated });
      }
    } catch { message.warning('Failed to load price list prices'); }
  };

  const fetchAllStocks = async () => {
    try {
      const response = await apiService.get("/inventory");
      if (response.success) {
        const stockByItemAndWarehouse = {};
        response.data.forEach((inv) => {
          if (!stockByItemAndWarehouse[inv.item_id]) {
            stockByItemAndWarehouse[inv.item_id] = {};
          }
          const vKey = inv.item_variant_id || "base";
          if (!stockByItemAndWarehouse[inv.item_id][vKey]) {
            stockByItemAndWarehouse[inv.item_id][vKey] = {};
          }
          stockByItemAndWarehouse[inv.item_id][vKey][inv.warehouse_id] =
            inv.quantity_available || 0;
        });
        setAllItemStocks(stockByItemAndWarehouse);
        console.log("Stock data loaded:", stockByItemAndWarehouse);
      }
    } catch (error) {
      console.error("Failed to fetch stock", error);
    }
  };

  const columns = [
    { title: "SO Number", dataIndex: "so_number", key: "so_number", width: 130, ellipsis: true },
    { title: "Customer", dataIndex: "customer_name", key: "customer_name", width: 150, ellipsis: true },
    { title: "Status", dataIndex: "status", key: "status", width: 100,
      render: (status) => {
        const colors = { draft: "gray", confirmed: "blue", shipped: "green", delivered: "green", cancelled: "red" };
        return <span style={{ color: colors[status] || "black" }}>{status?.toUpperCase()}</span>;
      },
    },
    { title: "Total", dataIndex: "total_amount", key: "total_amount", width: 110,
      render: (val, record) => formatCommercialDocAmount(val, record) },
    { title: "Order Date", dataIndex: "order_date", key: "order_date", width: 110 },
    {
      title: "Actions", key: "actions", width: 180,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button size="small" onClick={() => viewSO(record)}>View</Button>
          {record.status === "draft" && <Button size="small" type="primary" onClick={() => confirmSO(record)}>Confirm</Button>}
          {record.status === "confirmed" && <Button size="small" onClick={() => shipSO(record)}>Ship</Button>}
          {record.status === "draft" && <Button size="small" danger onClick={() => cancelSO(record)}>Cancel</Button>}
        </Space>
      ),
    },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sosRes, customersRes, warehousesRes, itemsRes] = await Promise.all(
        [
          apiService
            .get("/sales-orders")
            .catch(() => ({ success: false, data: [] })),
          apiService
            .get("/customers")
            .catch(() => ({ success: false, data: [] })),
          apiService.get("/warehouses"),
          apiService.get("/items?includeVariants=1"),
        ],
      );

      setSOs(sosRes.success ? sosRes.data : []);
      setCustomers(customersRes.success ? customersRes.data : []);
      setWarehouses(warehousesRes.success ? warehousesRes.data : []);
      setItems(itemsRes.success ? itemsRes.data : []);
    } catch (error) {
      message.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSO = async (values) => {
    try {
      const rateErr = getExchangeRateValidationError(
        values.currency || documentCurrency,
        instCcy,
        values.exchangeRate
      );
      if (rateErr) {
        message.error(rateErr);
        return;
      }

      const selectedCustomer = customers.find(c => c.id === values.customerId);

      const soData = {
        ...values,
        soNumber: values.soNumber?.trim() || `SO-${Date.now()}`,
        priceListId: values.priceListId || null,
        customerName:
          selectedCustomer?.display_name ||
          selectedCustomer?.company_name ||
          'Unknown Customer',
        orderDate: values.orderDate ? values.orderDate.format("YYYY-MM-DD") : new Date().toISOString().split('T')[0],
        expectedShipDate: values.expectedShipDate?.format("YYYY-MM-DD") || null,
        lines: (values.lines || []).map(line => {
          const taxRate = line.taxRateId ? parseFloat(getRateById(line.taxRateId)?.rate || 0) : 0;
          return {
            ...line,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            discountRate: Number(line.discountRate || 0),
            taxRate,
            taxRateId: line.taxRateId || null,
          };
        }),
        documentMeta: formatDocumentMetaForApi(values.documentMeta, moment, 'salesOrder'),
      };

      const response = await apiService.post("/sales-orders", soData);

      if (response.success) {
        message.success("Sales order created successfully");
        setModalVisible(false);
        form.resetFields();
        fetchData();
      }
    } catch (error) {
      const errorMsg =
        error.response?.data?.error ||
        error.message ||
        "Failed to create sales order";
      message.error(errorMsg);
    }
  };

  const confirmSO = async (so) => {
    try {
      const response = await apiService.post(`/sales-orders/${so.id}/confirm`);
      if (response.success) {
        const invoiceNumber = response.data?.invoiceNumber;
        message.success(invoiceNumber
          ? `SO confirmed — Invoice ${invoiceNumber} generated with tax`
          : 'Sales order confirmed successfully');
        fetchData();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to confirm sales order');
    }
  };

  const shipSO = async (so) => {
    try {
      await apiService.put(`/sales-orders/${so.id}/status`, {
        status: "shipped",
      });
      message.success("Sales order shipped");
      fetchData();
    } catch (error) {
      message.error("Failed to ship sales order");
    }
  };

  const cancelSO = (so) => {
    setSelectedSOForCancel(so);
    setCancellationReason('');
    setCancelModalVisible(true);
  };

  const handleCancelSO = async () => {
    if (!cancellationReason || cancellationReason.trim() === '') {
      message.warning('Please provide a cancellation reason');
      return;
    }

    try {
      const response = await apiService.post(
        `/sales-orders/${selectedSOForCancel.id}/cancel`,
        { cancellationReason: cancellationReason.trim() }
      );

      if (response.success) {
        message.success('Sales order cancelled and reserved stock released');
        setCancelModalVisible(false);
        fetchData();
      }
    } catch (error) {
      message.error(
        error.response?.data?.error || 'Failed to cancel sales order'
      );
    }
  };

  const viewSO = async (so) => {
    try {
      const response = await apiService.get(`/sales-orders/${so.id}`);
      if (response.success) {
        setSelectedSOForView(response.data);
        setViewModalVisible(true);
      }
    } catch (error) {
      message.error("Failed to load SO details");
    }
  };

  const downloadPDF = async (so) => {
    try {
      const token = sessionStorage.getItem('token');
      let institutionId = sessionStorage.getItem('institutionId');
      
      if (!institutionId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          institutionId = payload.institutionId;
        } catch (e) {
          console.error('Failed to parse token');
        }
      }
      
      const response = await fetch(`${apiService.baseURL}/sales-orders/${so.id}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-institution-id': institutionId
        }
      });
      
      if (!response.ok) throw new Error('Failed to download PDF');
      
      const blob = await response.blob();
      await assertPdfBlob(blob);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SO_${so.so_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('PDF downloaded successfully');
    } catch (error) {
      message.error('Failed to download PDF');
    }
  };

  const printSO = async (so) => {
    try {
      const token = sessionStorage.getItem('token');
      let institutionId = sessionStorage.getItem('institutionId');

      if (!institutionId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          institutionId = payload.institutionId;
        } catch (e) {
          console.error('Failed to parse token');
        }
      }

      const response = await fetch(`${apiService.baseURL}/sales-orders/${so.id}/pdf`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-institution-id': institutionId,
        },
      });

      if (!response.ok) throw new Error('Failed to load PDF');

      const blob = await response.blob();
      await printPdfBlob(blob);
    } catch (error) {
      console.error('Print error:', error);
      message.error(
        error?.message === 'POPUP_BLOCKED'
          ? 'Please allow pop-ups to print'
          : error?.message || 'Failed to print PDF'
      );
    }
  };

  const handleEmailSO = (so) => {
    setSelectedSOForEmail(so);
    setEmailAddress('');
    setEmailModalVisible(true);
  };

  const handleSendEmail = async () => {
    if (!emailAddress) {
      message.warning('Please enter an email address');
      return;
    }

    try {
      const response = await apiService.post(`/sales-orders/${selectedSOForEmail.id}/email`, {
        to: emailAddress
      });

      if (response.success) {
        message.success(`Sales order sent to ${emailAddress}`);
        setEmailModalVisible(false);
      } else {
        message.error(response.error || 'Failed to send email');
      }
    } catch (error) {
      message.error('Failed to send email');
    }
  };

  useEffect(() => {
    fetchData();
    fetchAllStocks();
    fetchPriceLists();
  }, []);

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: 16 }}>Sales Orders</h1>
      <Card>
        <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>Create SO</Button>
          <Input placeholder="Search SO or customer..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ width: '100%', maxWidth: 220 }} allowClear />
          <DatePicker placeholder="From Date" value={fromDate} onChange={date => setFromDate(date)} style={{ width: 140 }} allowClear />
          <DatePicker placeholder="To Date" value={toDate} onChange={date => setToDate(date)} style={{ width: 140 }} allowClear />
          <Select placeholder="All Statuses" value={statusFilter} onChange={val => setStatusFilter(val)} style={{ width: 150 }} allowClear>
            <Select.Option value="draft">Draft</Select.Option>
            <Select.Option value="confirmed">Confirmed</Select.Option>
            <Select.Option value="shipped">Shipped</Select.Option>
            <Select.Option value="delivered">Delivered</Select.Option>
            <Select.Option value="cancelled">Cancelled</Select.Option>
          </Select>
        </Space>
        <Table
          columns={columns}
          dataSource={sos.filter(so => {
            const textMatch = !searchText || so.so_number?.toLowerCase().includes(searchText.toLowerCase()) || so.customer_name?.toLowerCase().includes(searchText.toLowerCase());
            const dateMatch = (!fromDate || !toDate) || (() => { const d = new Date(so.order_date); return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate(); })();
            const statusMatch = !statusFilter || so.status === statusFilter;
            return textMatch && dateMatch && statusMatch;
          })}
          loading={loading}
          rowKey="id"
          scroll={{ x: 'max-content' }}
          size="small"
          pagination={{ size: 'small' }}
        />
      </Card>

      <Modal title="Create Sales Order" open={modalVisible} onCancel={() => { setModalVisible(false); setSelectedPriceListId(null); setPriceListItemMap({}); form.resetFields(); }} footer={null} width="min(800px, 96vw)" style={{ top: 16 }}>
        <Form form={form} layout="vertical" onFinish={handleCreateSO}>
          <Form.Item name="soNumber" label="SO Number">
            <Input placeholder="Auto-generated if empty" />
          </Form.Item>

          <Form.Item
            name="customerId"
            label="Customer"
            rules={[{ required: true, message: 'Please select a customer' }]}
          >
            <Select
              placeholder="Select customer"
              showSearch
              optionFilterProp="children"
              allowClear
              onChange={async (customerId) => {
                if (!customerId) { setSelectedPriceListId(null); setPriceListItemMap({}); form.setFieldsValue({ priceListId: null }); return; }
                try {
                  const res = await apiService.get(`/customers/${customerId}/price-list`);
                  if (res.success && res.data) {
                    form.setFieldsValue({ priceListId: res.data.id });
                    await handlePriceListChange(res.data.id);
                  }
                } catch { /* no price list assigned */ }
              }}
            >
              {customers
                .filter((customer) => customer.status === "active")
                .map((customer) => (
                  <Select.Option key={customer.id} value={customer.id}>
                    {customer.display_name}{" "}
                    {customer.company_name && `- ${customer.company_name}`}
                  </Select.Option>
                ))}
            </Select>
          </Form.Item>

          {priceLists.length > 0 && (
            <Form.Item name="priceListId" label="Price List">
              <Select
                placeholder="Select price list (optional)"
                allowClear
                onChange={handlePriceListChange}
              >
                {priceLists.map(pl => (
                  <Select.Option key={pl.id} value={pl.id}>
                    {pl.name}{pl.is_default ? ' (Default)' : ''}
                    {pl.discount_value > 0 && ` — ${pl.discount_value}${pl.discount_type === 'percentage' ? '%' : ' fixed'} off`}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item name="currency" label="Currency" initialValue={instCcy}>
            <Select
              showSearch
              placeholder="Search currency..."
              optionFilterProp="label"
              filterOption={filterSelectOption}
              onChange={async (value) => {
                const prev = form.getFieldValue('currency');
                if (prev && prev !== value) {
                  await convertSoLinePrices(prev, value);
                }
              }}
            >
              {getCurrencies().map(c => (
                <Select.Option key={c.code} value={c.code} label={`${c.code} ${c.symbol} ${c.name}`}>
                  {c.code} — {c.symbol} {c.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <CommercialExchangeRateField
            documentCurrency={documentCurrency}
            institutionCurrency={instCcy}
            onRateChange={syncRateToForm}
            onRefresh={applyResolvedRate}
            loading={rateResolving}
          />

          <Form.Item name="channel" label="Sales Channel" initialValue="direct">
            <Select placeholder="Select channel">
              <Select.Option value="direct">Direct</Select.Option>
              <Select.Option value="online">Online</Select.Option>
              <Select.Option value="retail">Retail</Select.Option>
              <Select.Option value="wholesale">Wholesale</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="orderDate"
            label="Order Date"
            rules={[{ required: true }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item name="expectedShipDate" label="Expected Ship Date">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.List name="lines">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => {
                  const selectedItemId = form.getFieldValue([
                    "lines",
                    name,
                    "itemId",
                  ]);
                  const selectedVariantId = form.getFieldValue([
                    "lines",
                    name,
                    "itemVariantId",
                  ]);
                  const selectedWarehouseId = form.getFieldValue([
                    "lines",
                    name,
                    "warehouseId",
                  ]);
                  const allLines = form.getFieldValue("lines") || [];
                  const selectedLineItem = items.find((i) => i.id === selectedItemId);

                  const lineAllocKey = (line) =>
                    `${line.itemId}_${line.itemVariantId || "base"}_${line.warehouseId}`;

                  // Calculate already allocated quantities per item / variant / warehouse
                  const allocatedStock = {};
                  allLines.forEach((line, idx) => {
                    if (
                      idx !== name &&
                      line?.itemId &&
                      line?.warehouseId &&
                      line?.quantity
                    ) {
                      const ak = lineAllocKey(line);
                      allocatedStock[ak] =
                        (allocatedStock[ak] || 0) + line.quantity;
                    }
                  });

                  // Show all active warehouses; if item selected, sort by available stock
                  const availableWarehouses = warehouses.filter(wh => wh.status === 'active');

                  // Show all active items regardless of stock
                  const availableItems = items.filter(item => item.status === 'active');

                  // Calculate available stock for current selection
                  const vKey = selectedVariantId || "base";
                  const whStockMap =
                    selectedItemId && allItemStocks[selectedItemId]
                      ? allItemStocks[selectedItemId][vKey]
                      : null;
                  const currentTotalStock =
                    selectedItemId && selectedWarehouseId
                      ? whStockMap?.[selectedWarehouseId] || 0
                      : 0;
                  const currentAllocated =
                    selectedItemId && selectedWarehouseId
                      ? allocatedStock[
                          `${selectedItemId}_${vKey}_${selectedWarehouseId}`
                        ] || 0
                      : 0;
                  const currentAvailable = currentTotalStock - currentAllocated;

                  return (
                    <div
                      key={key}
                      style={{
                        marginBottom: 16,
                        padding: 16,
                        border: "1px solid #d9d9d9",
                        borderRadius: 4,
                        backgroundColor: "#fafafa",
                      }}
                    >
                      <Space
                        direction="vertical"
                        style={{ width: "100%" }}
                        size="small"
                      >
                        <Space
                          align="start"
                          style={{ width: "100%", flexWrap: "wrap" }}
                        >
                          <Form.Item
                            {...restField}
                            name={[name, "itemId"]}
                            label="Item"
                            rules={[{ required: true, message: "Select item" }]}
                            style={{ marginBottom: 0, minWidth: 250, flex: 1 }}
                          >
                            <Select
                              placeholder="Select item"
                              showSearch
                              optionLabelProp="label"
                              filterOption={filterSelectOption}
                              dropdownStyle={{ minWidth: 350 }}
                              onChange={(itemId) => {
                                const sel = items.find((i) => i.id === itemId);
                                if (sel) {
                                  const lines = form.getFieldValue("lines") || [];
                                  const opts = sel.variant_options || [];
                                  const defaultVariantId =
                                    sel.type === "variant" && opts.length === 1
                                      ? opts[0].id
                                      : undefined;
                                  lines[name] = {
                                    ...lines[name],
                                    itemVariantId: defaultVariantId,
                                    unitPrice: getLineUnitPrice(sel, defaultVariantId),
                                    discountRate: getLineDiscountRate(itemId),
                                    taxRateId: undefined,
                                  };
                                  form.setFieldsValue({ lines });
                                }
                              }}
                            >
                              {availableItems.map((item) => {
                                const byVar = allItemStocks[item.id] || {};
                                let totalStock = 0;
                                Object.values(byVar).forEach((whMap) => {
                                  Object.values(whMap || {}).forEach((qty) => {
                                    totalStock += Number(qty) || 0;
                                  });
                                });
                                let allocated = 0;
                                allLines.forEach((line, idx) => {
                                  if (line?.itemId !== item.id || !line?.warehouseId) return;
                                  allocated += allocatedStock[lineAllocKey(line)] || 0;
                                });
                                const available = totalStock - allocated;

                                return (
                                  <Select.Option
                                    key={item.id}
                                    value={item.id}
                                    label={`${item.name} (${item.sku})`}
                                  >
                                    <div>
                                      <strong>{item.name}</strong> ({item.sku})
                                      <br />
                                      <span style={{ fontSize: '12px', color: available > 0 ? '#52c41a' : '#ff4d4f' }}>
                                        Available: {available} (all warehouses)
                                      </span>
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          {selectedLineItem?.type === "variant" && (
                            <Form.Item
                              {...restField}
                              name={[name, "itemVariantId"]}
                              label="Variant"
                              rules={[
                                {
                                  required: true,
                                  message: "Select variant",
                                },
                              ]}
                              style={{ marginBottom: 0, minWidth: 220, flex: 1 }}
                            >
                              <Select
                                placeholder="Select variant"
                                showSearch
                                optionFilterProp="children"
                                onChange={(variantId) => {
                                  const lines = form.getFieldValue("lines") || [];
                                  const currentLine = lines[name] || {};
                                  const item = items.find((i) => i.id === currentLine.itemId);
                                  lines[name] = {
                                    ...currentLine,
                                    itemVariantId: variantId,
                                    unitPrice: getLineUnitPrice(item, variantId),
                                  };
                                  form.setFieldsValue({ lines });
                                }}
                              >
                                {(selectedLineItem.variant_options || []).map((vo) => {
                                  const variantWarehouseMap = (allItemStocks[selectedItemId] || {})[vo.id] || {};
                                  const totalVariantStock = Object.values(variantWarehouseMap).reduce(
                                    (sum, qty) => sum + (Number(qty) || 0),
                                    0
                                  );
                                  return (
                                    <Select.Option key={vo.id} value={vo.id}>
                                      {vo.combinationLabel} ({vo.sku}) - {totalVariantStock} available
                                    </Select.Option>
                                  );
                                })}
                              </Select>
                            </Form.Item>
                          )}

                          <Form.Item
                            {...restField}
                            name={[name, "warehouseId"]}
                            label="Warehouse"
                            rules={[
                              { required: true, message: "Select warehouse" },
                            ]}
                            style={{ marginBottom: 0, minWidth: 250, flex: 1 }}
                          >
                            <Select
                              placeholder="Select warehouse"
                              showSearch
                              optionLabelProp="label" // ✅ important
                              optionFilterProp="label" // ✅ important
                              dropdownStyle={{ minWidth: 300 }}
                            >
                              {availableWarehouses.map((wh) => {
                                const totalStock =
                                  selectedItemId && whStockMap
                                    ? whStockMap[wh.id] || 0
                                    : 0;

                                const allocated =
                                  allocatedStock[
                                    `${selectedItemId}_${vKey}_${wh.id}`
                                  ] || 0;

                                const available = totalStock - allocated;

                                return (
                                  <Select.Option
                                    key={wh.id}
                                    value={wh.id}
                                    label={wh.name} // 👈 This is what shows after selection
                                  >
                                    <div>
                                      <strong>{wh.name}</strong>

                                      {selectedItemId && (
                                        <>
                                          <br />
                                          <span
                                            style={{
                                              fontSize: "12px",
                                              color: "#52c41a",
                                            }}
                                          >
                                            Available: {available} units
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </Select.Option>
                                );
                              })}
                            </Select>
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, "quantity"]}
                            label="Quantity"
                            rules={[
                              { required: true, message: "Enter qty" },
                            ]}
                            style={{ marginBottom: 0, width: 100 }}
                          >
                            <InputNumber
                              placeholder="Qty"
                              min={1}
                              style={{ width: "100%" }}
                              onChange={() => form.setFieldsValue({})}
                            />
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, "unitPrice"]}
                            label="Unit Price"
                            rules={[{ required: true, message: "Enter price" }]}
                            style={{ marginBottom: 0, width: 120 }}
                          >
                            <InputNumber placeholder="Price" min={0} step={0.01} style={{ width: "100%" }}
                              onChange={() => form.setFieldsValue({})} />
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, "discountRate"]}
                            label="Discount %"
                            style={{ marginBottom: 0, width: 100 }}
                          >
                            <InputNumber placeholder="0" min={0} max={100} step={0.01} style={{ width: "100%" }}
                              onChange={() => form.setFieldsValue({})} />
                          </Form.Item>

                          <Form.Item
                            {...restField}
                            name={[name, "taxRateId"]}
                            label="Tax"
                            style={{ marginBottom: 0, width: 150 }}
                          >
                            <Select placeholder="No tax (0%)" allowClear
                              onChange={() => form.setFieldsValue({})}>
                              {taxRates.map(t => (
                                <Select.Option key={t.id} value={t.id}>
                                  {t.name} ({parseFloat(t.rate).toFixed(2)}%)
                                </Select.Option>
                              ))}
                            </Select>
                          </Form.Item>

                          <Form.Item label=" " style={{ marginBottom: 0 }}>
                            <Button onClick={() => remove(name)} danger>
                              Remove
                            </Button>
                          </Form.Item>
                        </Space>

                        {selectedItemId && selectedWarehouseId && (() => {
                          const qty         = parseFloat(form.getFieldValue(['lines', name, 'quantity'])     || 0);
                          const price       = parseFloat(form.getFieldValue(['lines', name, 'unitPrice'])    || 0);
                          const discountPct = parseFloat(form.getFieldValue(['lines', name, 'discountRate']) || 0);
                          const taxId       = form.getFieldValue(['lines', name, 'taxRateId']);
                          const taxPct      = taxId ? parseFloat(getRateById(taxId)?.rate || 0) : 0;
                          const lineTotal     = qty * price;
                          const discountAmt   = lineTotal * discountPct / 100;
                          const afterDiscount = lineTotal - discountAmt;
                          const taxAmount     = afterDiscount * taxPct / 100;
                          const grandTotal    = afterDiscount + taxAmount;
                          const docCcy        = documentCurrency || instCcy;
                          const fmtDoc        = (n) => formatDocumentAmount(n, docCcy);
                          // Must match variant-aware stock map: itemId → variantKey → warehouseId
                          const available     = currentAvailable;
                          const isInsufficient = qty > 0 && available < qty;
                          return (
                            <>
                              {isInsufficient && (
                                <div style={{ padding: '8px 12px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 4, marginBottom: 6 }}>
                                  <span style={{ fontSize: 13, color: '#cf1322', fontWeight: 600 }}>
                                    ⚠️ Insufficient stock — only <strong>{available}</strong> unit{available !== 1 ? 's' : ''} available at this warehouse, but <strong>{qty}</strong> ordered.
                                  </span>
                                </div>
                              )}
                              <div style={{ padding: '8px 12px', backgroundColor: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
                                <span style={{ fontSize: '13px', color: '#0050b3' }}>
                                  ℹ️ <strong>{items.find(i => i.id === selectedItemId)?.name}</strong>
                                  {selectedVariantId && selectedLineItem?.variant_options?.find((vo) => vo.id === selectedVariantId)?.combinationLabel
                                    ? <> / <strong>{selectedLineItem.variant_options.find((vo) => vo.id === selectedVariantId)?.combinationLabel}</strong></>
                                    : null}
                                  {' '}at <strong>{warehouses.find(w => w.id === selectedWarehouseId)?.name}</strong>:
                                  <strong style={{ color: available > 0 ? '#52c41a' : '#ff4d4f', marginLeft: 4 }}>{available} in stock</strong>
                                  {qty > 0 && (
                                    <span style={{ marginLeft: 8 }}>
                                      Subtotal: <strong>{fmtDoc(lineTotal)}</strong>
                                      {discountPct > 0 && <> − Discount ({discountPct}%): <strong style={{ color: '#ff4d4f' }}>−{fmtDoc(discountAmt)}</strong></>}
                                      {taxPct > 0 && <> + Tax ({taxPct}%): <strong>{fmtDoc(taxAmount)}</strong></>}
                                      {' = '}<Tag color="green">{fmtDoc(grandTotal)} ({docCcy})</Tag>
                                    </span>
                                  )}
                                </span>
                              </div>
                            </>
                          );
                        })()}
                      </Space>
                    </div>
                  );
                })}
                <Form.Item>
                  <Button
                    type="dashed"
                    onClick={() => add({ ...DEFAULT_SO_LINE })}
                    block
                    icon={<PlusOutlined />}
                  >
                    Add Line Item
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <DocumentTotalsSummary
            lines={watchedLines}
            documentCurrency={documentCurrency || instCcy}
            institutionCurrency={instCcy}
            exchangeRate={exchangeRate}
            rateMissing={rateMissing}
            rateSource={rateSource}
            unitField="unitPrice"
            getTaxRate={getLineTaxRate}
          />

          <DocumentMetaFields docType="salesOrder" />

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Create Sales Order
              </Button>
              <Button onClick={() => setModalVisible(false)}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Sales Order Details - ${selectedSOForView?.so_number}`} open={viewModalVisible} onCancel={() => { setViewModalVisible(false); setSelectedSOForView(null); }} footer={[
          <Button key="email" icon={<MailOutlined />} onClick={() => handleEmailSO(selectedSOForView)}>Email</Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => printSO(selectedSOForView)}>Print</Button>,
          <Button key="download" icon={<DownloadOutlined />} onClick={() => downloadPDF(selectedSOForView)}>PDF</Button>,
          <Button key="close" onClick={() => { setViewModalVisible(false); setSelectedSOForView(null); }}>Close</Button>,
        ]} width="min(1000px, 96vw)" style={{ top: 16 }}>
        {selectedSOForView && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>Customer:</strong> {selectedSOForView.customer_name}<br />
              <strong>Status:</strong> {selectedSOForView.status?.toUpperCase()}<br />
              <strong>Order Date:</strong> {selectedSOForView.order_date}<br />
              <strong>Expected Ship Date:</strong> {selectedSOForView.expected_ship_date}<br />
              <strong>Currency:</strong> {selectedSOForView.currency}<br />
              <strong>Total Amount:</strong> {formatDocumentAmount(selectedSOForView.total_amount, selectedSOForView.currency)}
              {selectedSOForView.status === 'cancelled' && selectedSOForView.cancellation_reason && (
                <div style={{ marginTop: 12, padding: 12, backgroundColor: '#fff2e8', border: '1px solid #ffbb96', borderRadius: 4 }}>
                  <strong style={{ color: '#d4380d' }}>Cancellation Reason:</strong>
                  <div style={{ marginTop: 4, color: '#595959' }}>{selectedSOForView.cancellation_reason}</div>
                </div>
              )}
            </div>
            <h4>Line Items:</h4>
            <Table dataSource={selectedSOForView.lines || []} rowKey="id" pagination={false} size="small" scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 140, ellipsis: true },
                { title: 'HSN', dataIndex: 'hsn_code', key: 'hsn_code', width: 80, render: v => v || '-' },
                { title: 'Qty', dataIndex: 'quantity_ordered', key: 'quantity_ordered', width: 70 },
                { title: 'Shipped', dataIndex: 'quantity_shipped', key: 'quantity_shipped', width: 80, render: v => v || 0 },
                { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', width: 100,
                  render: v => formatDocumentAmount(v, selectedSOForView?.currency) },
                { title: 'Discount', dataIndex: 'discount_rate', key: 'discount_rate', width: 80, render: v => v > 0 ? <Tag color="orange">{v}%</Tag> : '-' },
                { title: 'Tax', dataIndex: 'tax_rate', key: 'tax_rate', width: 70, render: v => v > 0 ? <Tag color="blue">{v}%</Tag> : '-' },
                { title: 'Tax Amt', dataIndex: 'tax_amount', key: 'tax_amount', width: 90,
                  render: v => v > 0 ? formatDocumentAmount(v, selectedSOForView?.currency) : '-' },
                { title: 'Total', dataIndex: 'line_total', key: 'line_total', width: 100,
                  render: v => formatDocumentAmount(v, selectedSOForView?.currency) },
                { title: 'Status', dataIndex: 'status', key: 'status', width: 90, render: v => v?.toUpperCase() },
              ]}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="Email Sales Order"
        open={emailModalVisible}
        onCancel={() => setEmailModalVisible(false)}
        onOk={handleSendEmail}
        okText="Send Email"
      >
        <p>Send sales order <strong>{selectedSOForEmail?.so_number}</strong> to:</p>
        <Input
          placeholder="Enter email address"
          value={emailAddress}
          onChange={(e) => setEmailAddress(e.target.value)}
          onPressEnter={handleSendEmail}
        />
      </Modal>

      <Modal
        title="Cancel Sales Order"
        open={cancelModalVisible}
        onCancel={() => setCancelModalVisible(false)}
        onOk={handleCancelSO}
        okText="Cancel Order"
        okButtonProps={{ danger: true }}
      >
        <p>
          Are you sure you want to cancel sales order{" "}
          <strong>{selectedSOForCancel?.so_number}</strong>?
        </p>
        <p style={{ marginTop: 16, marginBottom: 8 }}>
          <strong>Cancellation Reason:</strong>
        </p>
        <Input.TextArea
          placeholder="Please provide a reason for cancellation (required)"
          value={cancellationReason}
          onChange={(e) => setCancellationReason(e.target.value)}
          rows={4}
          maxLength={500}
          showCount
        />
        <p style={{ marginTop: 8, fontSize: '12px', color: '#888' }}>
          Note: Reserved stock will be automatically released.
        </p>
      </Modal>
    </div>
  );
};

export default SalesOrders;
