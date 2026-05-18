import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatPrice, getCurrencySymbol, getCurrencies } from '../../utils/currency';
import {
  amountInDocumentCurrency as amountInInvoiceCurrency,
  averageCostInDocumentCurrency as averageCostInInvoiceCurrency,
  calculateCommercialTotals,
  fetchLiveExchangeRate,
  roundMoney,
} from '../../utils/commercialDocument';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Items list often returns `unit` as a units-table FK (UUID). Do not render that as a label. */
function formatItemUnitForDisplay(unit) {
  if (unit == null || unit === '') return '';
  const s = String(unit).trim();
  if (UUID_LIKE.test(s)) return '';
  if (s.length >= 24 && /^[0-9a-f-]+$/i.test(s)) return '';
  return s;
}

function formatStockQuantity(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  if (x === 0) return '0';
  return x % 1 === 0
    ? x.toLocaleString(undefined, { maximumFractionDigits: 0 })
    : x.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const InvoiceForm = ({ type = 'purchase', invoiceId = null, onSave }) => {
  const { currency } = useCurrency();
  const [form] = Form.useForm();
  const shipFromWarehouseId = Form.useWatch('shipFromWarehouseId', form);
  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  /** Per item + warehouse: available qty and WAC from inventory_projections (GET /inventory). */
  const [inventoryByItemWarehouse, setInventoryByItemWarehouse] = useState({});
  const [selectedParty, setSelectedParty] = useState(null);
  const [invoiceLines, setInvoiceLines] = useState([{ key: 1, taxRate: 0, discountRate: 0 }]);
  const [invoiceCurrency, setInvoiceCurrency] = useState(currency || 'USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  /** When true, auto-fetch live FX for invoice↔institution pair. False while editing until user changes currency or clicks refresh. */
  const allowLiveExchangeRef = useRef(true);
  useEffect(() => {
    allowLiveExchangeRef.current = !invoiceId;
  }, [invoiceId]);
  const [taxRates, setTaxRates] = useState([]);
  const [priceListItemMap, setPriceListItemMap] = useState({}); // loaded from /tax/rates
  const [totals, setTotals] = useState({
    subtotal: 0,
    totalDiscount: 0,
    totalTax: 0,
    grandTotal: 0
  });

  const fetchAllStocks = async () => {
    try {
      const response = await apiService.get('/inventory', {
        params: { limit: 10000, offset: 0 }
      });
      if (response.success) {
        const map = {};
        (response.data || []).forEach((inv) => {
          const itemId = inv.item_id;
          const whId = inv.warehouse_id;
          if (!itemId || !whId) return;
          if (!map[itemId]) map[itemId] = {};
          map[itemId][whId] = {
            quantityAvailable: Number(inv.quantity_available || 0),
            averageCost: Number(inv.average_cost != null ? inv.average_cost : 0)
          };
        });
        setInventoryByItemWarehouse(map);
      }
    } catch (error) {
      console.error('Failed to fetch stock', error);
    }
  };

  const loadWarehouses = async () => {
    try {
      const response = await apiService.get('/warehouses');
      if (response.success) {
        setWarehouses(response.data || []);
      }
    } catch (error) {
      console.error('Error loading warehouses:', error);
    }
  };

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
      console.log('Loading items from:', endpoint);
      const response = await apiService.get(endpoint, {
        params: { search, limit: 50 }
      });
      console.log('Items API response:', response);
      if (response.success) {
        const itemsList = response.data?.items || [];
        console.log('Setting items:', itemsList.length, 'items');
        console.log('First 3 items:', itemsList.slice(0, 3));
        setItems(itemsList);
      } else {
        console.error('Items load failed:', response.error);
      }
    } catch (error) {
      console.error('Error loading items:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const loadTaxRates = async () => {
    try {
      const res = await apiService.get('/tax/rates');
      if (res.success) setTaxRates(res.data || []);
    } catch { /* silent — tax rates are optional */ }
  };

  const convertLinePricesToCurrency = useCallback(async (fromCcy, toCcy) => {
    if (!fromCcy || !toCcy || fromCcy === toCcy) return;
    const priceKey = type === 'purchase' ? 'unitCost' : 'unitPrice';
    try {
      const rate = await fetchLiveExchangeRate(apiService, fromCcy, toCcy);
      setInvoiceLines((prev) =>
        prev.map((line) => {
          const v = Number(line[priceKey]);
          if (!Number.isFinite(v) || v === 0) return line;
          return { ...line, [priceKey]: roundMoney(v * rate) };
        })
      );
    } catch {
      /* keep existing prices */
    }
  }, [type]);

  const handleItemSelect = (key, itemId) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      const priceField    = type === 'purchase' ? 'cost_price'   : 'selling_price';
      const unitPriceKey  = type === 'purchase' ? 'unitCost'     : 'unitPrice';
      const rawPrice      = item[priceField] || 0;
      const priceListPrice = type === 'sales' && priceListItemMap[itemId] != null ? priceListItemMap[itemId] : null;
      const baseInInst    = priceListPrice != null ? priceListPrice : rawPrice;
      const unitAmount    = amountInInvoiceCurrency(baseInInst, invoiceCurrency, currency, exchangeRate);
      setInvoiceLines(invoiceLines.map(line =>
        line.key === key ? {
          ...line,
          itemId:            item.id,
          itemName:          item.name,
          [unitPriceKey]:    unitAmount,
          hsn_code:          item.hsn_code    || '',
          unit:              item.unit        || '',
          taxRate:           0,
          discountRate:      line.discountRate || 0,
          stockQuantity:     item.stock_quantity    || 0,
          reservedQuantity:  item.reserved_quantity || 0,
          availableQuantity: item.available_quantity|| 0,
        } : line
      ));
    }
  };

  const loadPartyDetails = async (partyId, skipCurrencyOverride = false) => {
    try {
      const endpoint = type === 'purchase'
        ? `/purchase-invoices/vendors/${partyId}/details`
        : `/sales-invoices/customers/${partyId}/details`;
      const response = await apiService.get(endpoint);
      if (response.success) {
        setSelectedParty(response.data);
        const nameField = type === 'purchase' ? 'vendorName' : 'customerName';
        const updates = { [nameField]: response.data.name };
        // Only set currency from party if not editing an existing invoice
        if (!skipCurrencyOverride) {
          const partyCurrency = response.data.businessInfo?.currency || 'INR';
          updates.currency = partyCurrency;
          setInvoiceCurrency(partyCurrency);
        }
        form.setFieldsValue(updates);
      }
    } catch (error) {
      console.error(`Error loading ${type === 'purchase' ? 'vendor' : 'customer'} details:`, error);
    }
  };

  const handlePartySelect = (partyId) => {
    const party = parties.find(p => p.id === partyId);
    if (party) {
      loadPartyDetails(partyId);
      // Auto-load customer's price list for sales invoices
      if (type === 'sales') {
        apiService.get(`/customers/${partyId}/price-list`).then(res => {
          if (res.success && res.data) {
            const pl = res.data;
            const listDiscountType  = pl.discount_type  || 'percentage';
            const listDiscountValue = parseFloat(pl.discount_value) || 0;
            const map = {};
            (pl.items || []).forEach(pli => {
              const base = parseFloat(pli.base_price) || 0;
              let price;
              if (pli.custom_price != null && parseFloat(pli.custom_price) > 0) {
                price = parseFloat(pli.custom_price);
              } else {
                const itemDv = parseFloat(pli.discount_value) || 0;
                if (itemDv > 0) {
                  price = pli.discount_type === 'percentage' ? base * (1 - itemDv / 100) : base - itemDv;
                } else if (listDiscountValue > 0) {
                  price = listDiscountType === 'percentage' ? base * (1 - listDiscountValue / 100) : base - listDiscountValue;
                } else {
                  price = base;
                }
              }
              map[pli.item_id] = Math.max(0, price);
            });
            setPriceListItemMap(map);
          } else {
            setPriceListItemMap({});
          }
        }).catch(() => setPriceListItemMap({}));
      }
    }
  };

  const addInvoiceLine = () => {
    const newKey = Math.max(...invoiceLines.map(line => line.key)) + 1;
    setInvoiceLines([...invoiceLines, { key: newKey, taxRate: 0, discountRate: 0 }]);
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
    setTotals(
      calculateCommercialTotals(invoiceLines, {
        getUnitAmount: (line) =>
          type === 'purchase' ? Number(line.unitCost || 0) : Number(line.unitPrice || 0),
        getTaxRate: (line) => Number(line.taxRate || 0),
        getDiscountRate: (line) => Number(line.discountRate || 0),
      })
    );
  }, [invoiceLines, type]);

  const fetchAndApplyLiveExchangeRate = useCallback(async (silent = false, isCancelled = () => false) => {
    if (invoiceCurrency === currency) {
      setExchangeRate(1);
      form.setFieldsValue({ exchangeRate: 1 });
      return;
    }
    try {
      const rounded = await fetchLiveExchangeRate(apiService, invoiceCurrency, currency);
      if (isCancelled()) return;
      setExchangeRate(rounded);
      form.setFieldsValue({ exchangeRate: rounded });
      if (!silent) message.success('Exchange rate updated from live market');
    } catch (e) {
      console.warn('Live exchange rate fetch failed', e);
      if (!silent) message.warning('Live exchange rate unavailable. Enter the rate manually.');
    }
  }, [invoiceCurrency, currency, form]);

  useEffect(() => {
    if (invoiceCurrency === currency) {
      setExchangeRate(1);
      form.setFieldsValue({ exchangeRate: 1 });
      return undefined;
    }
    if (invoiceId && !allowLiveExchangeRef.current) {
      return undefined;
    }
    let cancelled = false;
    void fetchAndApplyLiveExchangeRate(true, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [invoiceCurrency, currency, invoiceId, form, fetchAndApplyLiveExchangeRate]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      // Debug: Log current invoice lines
      console.log('Current invoice lines:', invoiceLines);
      
      // More lenient validation - check if we have basic line data
      const validLines = invoiceLines.filter(line => {
        const hasItem = !!(line.itemName && line.itemName.trim());
        const hasQuantity = !!(line.quantity && line.quantity > 0);
        return hasItem && hasQuantity;
      });
      
      console.log('Valid lines:', validLines);
      
      if (validLines.length === 0) {
        message.error('Please add at least one line item with name, quantity, and price');
        return;
      }

      const defaultShipWarehouse = type === 'sales' ? values.shipFromWarehouseId : undefined;

      if (type === 'sales') {
        const missingWh = validLines.find((line) => {
          const hasRealItem = line.itemId && !String(line.itemId).includes('manual_');
          const qty = Number(line.quantity) || 0;
          if (!hasRealItem || qty <= 0) return false;
          return !(line.warehouseId || defaultShipWarehouse);
        });
        if (missingWh) {
          message.error(
            'Select a warehouse on each line that has a catalog item, or set "Ship from warehouse" once for all lines. Stock is deducted from that warehouse when the invoice is saved.'
          );
          return;
        }
      }
      
      setLoading(true);

      const prefix = type === 'purchase' ? 'PI' : 'SI';
      const { shipFromWarehouseId, ...formValuesForPayload } = values;
      const invoiceData = {
        ...formValuesForPayload,
        invoiceNumber: values.invoiceNumber?.trim() || `${prefix}${Date.now()}`,
        invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
        dueDate: values.dueDate.format('YYYY-MM-DD'),
        ...(type === 'sales' && defaultShipWarehouse ? { warehouseId: defaultShipWarehouse } : {}),
        lines: validLines.map(line => {
          const lineData = {
            itemName:     line.itemName,
            quantity:     Number(line.quantity),
            taxRate:      Number(line.taxRate     || 0),
            discountRate: Number(line.discountRate || 0),
          };

          if (type === 'purchase') {
            lineData.unitCost = Number(line.unitCost || 0);
          } else {
            lineData.unitPrice = Number(line.unitPrice || 0);
          }

          if (line.itemId && !line.itemId.includes('manual_')) {
            lineData.itemId = line.itemId;
          }

          if (type === 'sales' && line.warehouseId) {
            lineData.warehouseId = line.warehouseId;
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
    loadTaxRates();
    if (type === 'sales') {
      loadWarehouses();
      fetchAllStocks();
    }
    if (invoiceId) {
      loadInvoiceData();
    }
  }, [type, invoiceId]);

  useEffect(() => {
    if (type !== 'sales' || invoiceId || warehouses.length !== 1) return;
    const wid = warehouses[0]?.id;
    if (!wid) return;
    const current = form.getFieldValue('shipFromWarehouseId');
    if (!current) {
      form.setFieldsValue({ shipFromWarehouseId: wid });
    }
  }, [type, invoiceId, warehouses, form]);

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
        
        const invoiceCurr = invoice.currency || 'INR';
        setInvoiceCurrency(invoiceCurr);
        const savedEr = parseFloat(invoice.exchange_rate);
        const er = Number.isFinite(savedEr) && savedEr > 0 ? savedEr : 1;
        if (invoiceCurr === currency) {
          setExchangeRate(1);
        } else {
          setExchangeRate(er);
        }
        form.setFieldsValue({
          invoiceNumber: invoice.invoice_number,
          invoiceDate:   invoice.invoice_date ? dayjs(invoice.invoice_date) : null,
          dueDate:       invoice.due_date     ? dayjs(invoice.due_date)     : null,
          [formPartyIdField]:   invoice[partyIdField],
          [formPartyNameField]: invoice[partyNameField],
          currency:  invoiceCurr,
          exchangeRate: invoiceCurr === currency ? 1 : er,
          reference: invoice.reference || '',
          notes:     invoice.notes     || ''
        });
        if (invoice[partyIdField]) {
          loadPartyDetails(invoice[partyIdField], true); // true = skip currency override
        }
        if (lines && lines.length > 0) {
          setInvoiceLines(lines.map((line, index) => {
            const lineData = {
              key: index + 1,
              itemId: line.item_id,
              itemName: line.item_name,
              hsn_code: line.hsn_code,
              unit: line.unit,
              quantity: line.quantity,
              discountRate: line.discount_rate || 0,
              taxRate: line.tax_rate || 0
            };
            if (type === 'purchase') {
              lineData.unitCost = line.unit_cost;
            } else {
              lineData.unitPrice = line.unit_price;
              if (line.warehouse_id) {
                lineData.warehouseId = line.warehouse_id;
              }
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
      width: 250,
      render: (value, record) => {
        if (type === 'sales') {
          const selectedWarehouseId = record.warehouseId;
          return (
            <div style={{ minWidth: 0 }}>
              <Select
                showSearch
                value={record.itemId}
                placeholder="Select item"
                onSelect={(itemId) => handleItemSelect(record.key, itemId)}
                filterOption={(input, option) => {
                  return option.children?.toString().toLowerCase().includes(input.toLowerCase());
                }}
                style={{ width: '100%' }}
                allowClear
                notFoundContent="No items found"
              >
                {items.map(item => {
                  let available = 0;
                  if (selectedWarehouseId) {
                    available = Number(inventoryByItemWarehouse[item.id]?.[selectedWarehouseId]?.quantityAvailable || 0);
                  } else {
                    available = Object.values(inventoryByItemWarehouse[item.id] || {}).reduce(
                      (sum, cell) => sum + (Number(cell?.quantityAvailable) || 0),
                      0
                    );
                  }
                  return (
                    <Option key={item.id} value={item.id}>
                      {item.sku} — {item.name} (Avail: {formatStockQuantity(available)})
                    </Option>
                  );
                })}
              </Select>
              {items.length === 0 && (
                <div style={{ color: 'red', fontSize: '12px', marginTop: 4 }}>
                  No items loaded. Check console for errors.
                </div>
              )}
              {record.itemId && selectedWarehouseId && (
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 8,
                    paddingTop: 6,
                    lineHeight: 1.45,
                    borderTop: '1px solid #f0f0f0',
                    color: '#595959'
                  }}
                >
                  {(() => {
                    const item = items.find(i => i.id === record.itemId);
                    if (!item) return null;
                    const available = Number(inventoryByItemWarehouse[record.itemId]?.[selectedWarehouseId]?.quantityAvailable || 0);
                    const qty = record.quantity || 0;
                    const unitSuffix = formatItemUnitForDisplay(item.unit);
                    return (
                      <span style={{ color: qty > available ? '#ff4d4f' : '#389e0d' }}>
                        Available: {formatStockQuantity(available)}
                        {unitSuffix ? ` ${unitSuffix}` : ' units'}
                        {qty > available && ' — insufficient stock'}
                      </span>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        }

        return (
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
        );
      }
    },
    {
      title: 'HSN Code',
      dataIndex: 'hsn_code',
      width: 100,
      render: (value) => value || '-'
    },
    ...(type === 'sales' ? [{
      title: 'Warehouse',
      dataIndex: 'warehouseId',
      width: 150,
      render: (value, record) => {
        const selectedItemId = record.itemId;
        const availableWarehouses = warehouses.filter((wh) => wh.status === 'active');

        return (
          <div style={{ minWidth: 0 }}>
            <Select
              value={value}
              placeholder="Select warehouse"
              onChange={(val) => updateInvoiceLine(record.key, 'warehouseId', val)}
              style={{ width: '100%' }}
              optionLabelProp="label"
              popupMatchSelectWidth={false}
            >
              {availableWarehouses.map(wh => {
                const stock = Number(inventoryByItemWarehouse[selectedItemId]?.[wh.id]?.quantityAvailable || 0);
                return (
                  <Option key={wh.id} value={wh.id} label={wh.name}>
                    <div style={{ lineHeight: 1.35, padding: '2px 0' }}>
                      <div style={{ fontWeight: 600 }}>{wh.name}</div>
                      {selectedItemId && !String(selectedItemId).includes('manual_') && (
                        <div style={{ fontSize: 12, color: '#389e0d', marginTop: 2 }}>
                          Avail: {formatStockQuantity(stock)} units
                        </div>
                      )}
                    </div>
                  </Option>
                );
              })}
            </Select>
          </div>
        );
      }
    }] : []),
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
    ...(type === 'sales' ? [
      {
        title: 'Avg cost (WH)',
        key: 'avgCostWh',
        width: 118,
        render: (_, record) => {
          const wid = record.warehouseId || shipFromWarehouseId;
          const manual = record.itemId && String(record.itemId).includes('manual_');
          if (!record.itemId || manual || !wid) {
            return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
          }
          const avgRaw = inventoryByItemWarehouse[record.itemId]?.[wid]?.averageCost;
          const n = averageCostInInvoiceCurrency(avgRaw, invoiceCurrency, currency, exchangeRate);
          if (n == null || !Number.isFinite(n) || n <= 0) {
            return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
          }
          const sym = getCurrencySymbol(invoiceCurrency);
          return (
            <Text
              style={{ fontSize: 13 }}
              title={
                invoiceCurrency !== currency
                  ? `Weighted average cost in stock (${currency}), converted to ${invoiceCurrency} using the exchange rate above.`
                  : 'Weighted average cost for this item in the selected warehouse (from stock).'
              }
            >
              {sym}{n.toFixed(2)}
            </Text>
          );
        }
      },
      {
        title: 'vs avg (excl. disc.)',
        key: 'marginVsAvg',
        width: 132,
        render: (_, record) => {
          const wid = record.warehouseId || shipFromWarehouseId;
          const manual = record.itemId && String(record.itemId).includes('manual_');
          const qty = Number(record.quantity) || 0;
          const unitPrice = Number(record.unitPrice) || 0;
          if (!record.itemId || manual || !wid) {
            return <Text type="secondary" style={{ fontSize: 11 }}>Select item and warehouse</Text>;
          }
          const avgRaw = inventoryByItemWarehouse[record.itemId]?.[wid]?.averageCost;
          const avgN = averageCostInInvoiceCurrency(avgRaw, invoiceCurrency, currency, exchangeRate);
          if (avgN == null || !Number.isFinite(avgN) || avgN <= 0) {
            return <Text type="secondary" style={{ fontSize: 11 }}>No avg cost</Text>;
          }
          const perUnit = unitPrice - avgN;
          const line = perUnit * qty;
          const sym = getCurrencySymbol(invoiceCurrency);
          const isProfit = perUnit >= 0;
          return (
            <div title="Unit price minus average stock cost (converted to invoice currency), before line discount and tax.">
              <Text type={isProfit ? 'success' : 'danger'} style={{ fontSize: 12, fontWeight: 600 }}>
                {isProfit ? 'Profit' : 'Loss'} {sym}{Math.abs(perUnit).toFixed(2)}/u
              </Text>
              <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
                Line: {isProfit ? '+' : '−'}{sym}{Math.abs(line).toFixed(2)}
              </div>
            </div>
          );
        }
      }
    ] : []),
    {
      title: 'Discount %',
      dataIndex: 'discountRate',
      width: 100,
      render: (value, record) => (
        <InputNumber
          value={value || 0}
          min={0}
          max={100}
          precision={2}
          addonAfter="%"
          style={{ width: '100%' }}
          onChange={(val) => updateInvoiceLine(record.key, 'discountRate', val || 0)}
        />
      )
    },
    {
      title: 'Tax Rate',
      dataIndex: 'taxRate',
      width: 170,
      render: (value, record) => (
        <Select
          value={value ?? 0}
          style={{ width: '100%', border: (value > 0) ? undefined : '1px solid #faad14', borderRadius: 6 }}
          onChange={(val) => updateInvoiceLine(record.key, 'taxRate', val)}
          showSearch
          optionFilterProp="children"
          placeholder="Select tax"
        >
          <Option value={0}><span style={{ color: '#faad14' }}>⚠ No Tax (0%)</span></Option>
          {taxRates.map(t => (
            <Option key={t.id} value={parseFloat(t.rate)}>
              {t.name} ({parseFloat(t.rate).toFixed(2)}%)
            </Option>
          ))}
        </Select>
      )
    },
    {
      title: 'Line Total',
      width: 130,
      render: (_, record) => {
        const qty       = record.quantity || 0;
        const unitPrice = type === 'purchase' ? (record.unitCost || 0) : (record.unitPrice || 0);
        const discount  = record.discountRate || 0;
        const tax       = record.taxRate || 0;
        const base      = qty * unitPrice;
        const afterDisc = base - (base * discount / 100);
        const total     = afterDisc + (afterDisc * tax / 100);
        const symbol    = getCurrencySymbol(invoiceCurrency);
        return (
          <span style={{ fontWeight: 600, color: '#1a1a2e' }}>
            {symbol}{total.toFixed(2)}
            {tax > 0 && <div style={{ fontSize: 11, color: '#52c41a' }}>incl. {symbol}{(afterDisc * tax / 100).toFixed(2)} tax</div>}
          </span>
        );
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
    <div style={{ padding: '8px' }}>
      <Card>
        <Title level={4} style={{ marginBottom: 16 }}>
          {invoiceId ? 'Edit' : 'Create'} {type === 'purchase' ? 'Purchase' : 'Sales'} Invoice
        </Title>
        
        <Form form={form} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="invoiceNumber" label="Invoice Number" rules={[{ required: !invoiceId, message: 'Please enter invoice number' }]}>
                <Input placeholder="Auto-generated if empty" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="invoiceDate" label="Invoice Date" rules={[{ required: true, message: 'Please select invoice date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="dueDate" label="Due Date" rules={[{ required: !invoiceId, message: 'Please select due date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name={type === 'purchase' ? 'vendorId' : 'customerId'}
                label={type === 'purchase' ? 'Vendor' : 'Customer'}
                rules={[{ required: true, message: `Please select ${type === 'purchase' ? 'vendor' : 'customer'}` }]}
              >
                <Select showSearch placeholder={`Select ${type === 'purchase' ? 'vendor' : 'customer'}`}
                  optionFilterProp="children" onSelect={handlePartySelect} filterOption={false}>
                  {parties.map(party => (
                    <Option key={party.id} value={party.id}>{party.displayText}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name={type === 'purchase' ? 'vendorName' : 'customerName'} label={`${type === 'purchase' ? 'Vendor' : 'Customer'} Name`} style={{ display: 'none' }}>
                <Input />
              </Form.Item>
              <Form.Item name="currency" label="Currency">
                <Select
                  showSearch
                  placeholder="Search currency..."
                  optionFilterProp="children"
                  filterOption={(input, option) =>
                    option.children?.toString().toLowerCase().includes(input.toLowerCase())
                  }
                  value={invoiceCurrency}
                  onChange={async (value) => {
                    const prev = invoiceCurrency;
                    if (prev && prev !== value) {
                      await convertLinePricesToCurrency(prev, value);
                    }
                    allowLiveExchangeRef.current = true;
                    setInvoiceCurrency(value);
                    if (value === currency) {
                      setExchangeRate(1);
                      form.setFieldsValue({ exchangeRate: 1 });
                    }
                  }}
                >
                  {getCurrencies().map(curr => (
                    <Option key={curr.code} value={curr.code}>
                      {curr.code} — {curr.symbol} {curr.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              {invoiceCurrency !== currency && (
                <Form.Item
                  name="exchangeRate"
                  label={`Exchange rate (1 ${invoiceCurrency} = ? ${currency})`}
                  initialValue={1}
                  tooltip={`Prefilled from live rates (server: open.er-api.com). This is how many ${currency} equal one ${invoiceCurrency}. Average cost from stock is in ${currency}; margin uses this rate to compare in ${invoiceCurrency}.`}
                  extra={(
                    <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => void fetchAndApplyLiveExchangeRate(false, () => false)}>
                      Refresh live rate
                    </Button>
                  )}
                  rules={[{ required: true, message: 'Exchange rate is required' }]}
                >
                  <InputNumber min={0.0001} precision={6} style={{ width: '100%' }}
                    onChange={(value) => setExchangeRate(value || 1)} />
                </Form.Item>
              )}
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col span={24}>
              <Form.Item name="reference" label="Reference">
                <Input placeholder="Reference number" />
              </Form.Item>
            </Col>
          </Row>

          {type === 'sales' && (
            <Row gutter={[16, 0]}>
              <Col xs={24} sm={12} md={10}>
                <Form.Item
                  name="shipFromWarehouseId"
                  label="Ship from warehouse (default)"
                  tooltip="Applies to any line that does not choose its own warehouse. The API needs a warehouse to deduct stock for catalog items."
                >
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Optional — use if all lines ship from one warehouse"
                    options={warehouses
                      .filter((w) => w.status === 'active')
                      .map((w) => ({ value: w.id, label: w.name }))}
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {selectedParty && (
            <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f9f9f9' }}>
              <Title level={5}>{type === 'purchase' ? 'Vendor' : 'Customer'} Details</Title>
              <Row gutter={[16, 8]}>
                <Col xs={24} sm={12}>
                  <Text strong>Company:</Text> {selectedParty.companyName}<br/>
                  <Text strong>Contact:</Text> {selectedParty.contact.person}<br/>
                  <Text strong>Email:</Text> {selectedParty.contact.email}<br/>
                  <Text strong>Phone:</Text> {selectedParty.contact.phone}
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>Billing Address:</Text><br/>
                  {selectedParty.billingAddress.line1}<br/>
                  {selectedParty.billingAddress.city}, {selectedParty.billingAddress.state}<br/>
                  {selectedParty.billingAddress.country} - {selectedParty.billingAddress.postalCode}
                </Col>
              </Row>
            </Card>
          )}

          <Divider>Invoice Items</Divider>
          
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Table
              columns={lineColumns}
              dataSource={invoiceLines}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </div>
          
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <Button type="dashed" onClick={addInvoiceLine} icon={<PlusOutlined />} style={{ width: '100%' }}>
              Add Line Item
            </Button>
          </div>

          <Row justify="end">
            <Col xs={24} sm={12} md={8}>
              <Card size="small">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Subtotal{invoiceCurrency !== currency ? ` (${invoiceCurrency})` : ''}:</Text>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text strong>Grand Total{invoiceCurrency !== currency ? ` (${invoiceCurrency})` : ''}:</Text>
                  <div style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: '16px' }}>
                      {getCurrencySymbol(invoiceCurrency)}{totals.grandTotal.toFixed(2)}
                    </Text>
                    {invoiceCurrency !== currency && Number(exchangeRate) > 0 && (
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4, fontWeight: 400 }}>
                        ≈ {getCurrencySymbol(currency)}
                        {roundMoney(totals.grandTotal * Number(exchangeRate)).toFixed(2)} ({currency})
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 0]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={3} placeholder="Additional notes or terms" />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 16, textAlign: 'right' }}>
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