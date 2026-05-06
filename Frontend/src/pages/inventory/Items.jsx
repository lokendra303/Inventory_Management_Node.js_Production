import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, message, Form, Input, Select, InputNumber, Row, Col, Upload, Timeline, Tag, Spin, Empty, Tabs, Badge, Statistic, Divider, Tooltip, Popconfirm, Dropdown } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, UploadOutlined, HistoryOutlined, SearchOutlined, DollarOutlined, BarcodeOutlined, AppstoreOutlined, UnorderedListOutlined, InboxOutlined, ShopOutlined, TagsOutlined, WarningOutlined, CloseOutlined, DeleteOutlined, CopyOutlined, MoreOutlined, StopOutlined, CheckCircleOutlined, ThunderboltOutlined, SettingOutlined } from '@ant-design/icons';
import { lookupProductByBarcode } from '../../utils/openFoodFacts';
import BarcodeScannerModal from '../../components/common/BarcodeScannerModal';
import apiService from '../../services/apiService';
import skuGeneratorService from '../../services/skuGeneratorService';
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
  const [taxRateOptions, setTaxRateOptions] = useState([]);
  const [itemHistory, setItemHistory] = useState([]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [warehouseForm] = Form.useForm();
  const [warehouseTypes, setWarehouseTypes] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [draftBanner, setDraftBanner] = useState(null);
  const [duplicateBanner, setDuplicateBanner] = useState(null); // { sourceName }
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [binsForWarehouse, setBinsForWarehouse] = useState([]);
  const [binsLoading, setBinsLoading] = useState(false);

  // ---- SKU auto-generator (Zoho-style rules) ------------------------------
  const [skuRulesOpen, setSkuRulesOpen] = useState(false);
  const [skuRules, setSkuRules] = useState([]);
  const [skuRulesLoading, setSkuRulesLoading] = useState(false);
  const [skuRuleForm] = Form.useForm();
  const [editingSkuRule, setEditingSkuRule] = useState(null);
  const [skuGenerating, setSkuGenerating] = useState(false);

  const loadSkuRules = async () => {
    setSkuRulesLoading(true);
    try {
      const rules = await skuGeneratorService.listRules();
      setSkuRules(Array.isArray(rules) ? rules : []);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load SKU rules');
    } finally {
      setSkuRulesLoading(false);
    }
  };

  // Handler for the "Generate" button next to the SKU field. Pulls the
  // current category/brand/name off the form so the resolver can pick the
  // correct category-scoped rule if one exists.
  const handleGenerateSku = async () => {
    setSkuGenerating(true);
    try {
      const ctx = {
        category: form.getFieldValue('category'),
        brand: form.getFieldValue('brand'),
        name: form.getFieldValue('name')
      };
      const sku = await skuGeneratorService.generateSku(ctx);
      if (sku) {
        form.setFieldsValue({ sku });
        message.success(`Generated SKU: ${sku}`);
      }
    } catch (e) {
      const err = e?.response?.data?.error || e?.message || 'Failed to generate SKU';
      message.error(err);
    } finally {
      setSkuGenerating(false);
    }
  };

  const openSkuRulesModal = async () => {
    setEditingSkuRule(null);
    skuRuleForm.resetFields();
    setSkuRulesOpen(true);
    await loadSkuRules();
  };

  const startEditSkuRule = (rule) => {
    setEditingSkuRule(rule);
    skuRuleForm.setFieldsValue({
      name: rule.name,
      scope: rule.scope,
      scopeValue: rule.scope_value,
      prefixMode: rule.prefix_mode,
      prefixStatic: rule.prefix_static,
      prefixSource: rule.prefix_source,
      prefixLength: rule.prefix_length,
      separator: rule.separator,
      useDate: !!rule.use_date,
      dateFormat: rule.date_format,
      useCounter: !!rule.use_counter,
      counterStart: rule.counter_start,
      counterPadding: rule.counter_padding,
      isDefault: !!rule.is_default
    });
  };

  const startNewSkuRule = () => {
    setEditingSkuRule(null);
    skuRuleForm.resetFields();
    skuRuleForm.setFieldsValue({
      scope: 'default',
      prefixMode: 'static',
      prefixLength: 3,
      separator: '-',
      useDate: false,
      dateFormat: 'YYMM',
      useCounter: true,
      counterStart: 1,
      counterPadding: 4,
      isDefault: skuRules.length === 0
    });
  };

  const submitSkuRule = async () => {
    try {
      const values = await skuRuleForm.validateFields();
      if (editingSkuRule) {
        await skuGeneratorService.updateRule(editingSkuRule.id, values);
        message.success('SKU rule updated');
      } else {
        await skuGeneratorService.createRule(values);
        message.success('SKU rule created');
      }
      setEditingSkuRule(null);
      skuRuleForm.resetFields();
      await loadSkuRules();
    } catch (e) {
      if (e?.errorFields) return; // validation
      message.error(e?.response?.data?.error || 'Failed to save rule');
    }
  };

  const removeSkuRule = async (id) => {
    try {
      await skuGeneratorService.deleteRule(id);
      message.success('Rule removed');
      await loadSkuRules();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to remove rule');
    }
  };

  // Check if user can manage items
  const canManageCategories = user?.permissions?.category_management || user?.permissions?.all;
  const canViewCategories = user?.permissions?.category_view || user?.permissions?.all;
  const canManageItems = user?.permissions?.item_management || user?.permissions?.all;

  /** Add category from the item modal: persists when user has category_management, else local pick list only */
  const handleInlineAddCategory = async () => {
    const raw = prompt('Enter new category:');
    if (!raw?.trim()) return;
    const name = raw.trim();
    if (categories.some(c => c.name === name)) {
      message.info('Category already in the list');
      form.setFieldsValue({ category: name });
      return;
    }
    if (canManageCategories) {
      try {
        const response = await apiService.post('/categories', { name });
        if (response?.success && response.data?.categoryId) {
          setCategories(prev => [...prev, { id: response.data.categoryId, name }]);
          form.setFieldsValue({ category: name });
          message.success('Category added');
        }
      } catch (e) {
        message.error(e?.response?.data?.error || 'Failed to add category');
      }
    } else {
      setCategories(prev => [...prev, { id: `local-${Date.now()}`, name }]);
      form.setFieldsValue({ category: name });
      message.success(`Using "${name}" for this item`);
    }
  };

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
      width: canManageItems ? 110 : 60,
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="View">
            <Button
              icon={<EyeOutlined />}
              size="small"
              onClick={() => viewItem(record)}
              style={{ borderRadius: 6, background: '#f0f0ff', borderColor: '#667eea', color: '#667eea' }}
            />
          </Tooltip>
          {canManageItems && (
            <Tooltip title="Edit">
              <Button
                icon={<EditOutlined />}
                size="small"
                onClick={() => editItem(record)}
                style={{ borderRadius: 6, background: '#667eea', border: 'none', color: '#fff' }}
              />
            </Tooltip>
          )}
          {canManageItems && (
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'duplicate',
                    icon: <CopyOutlined style={{ color: '#fa8c16' }} />,
                    label: 'Duplicate',
                    onClick: () => duplicateItem(record),
                  },
                  {
                    key: 'toggle',
                    icon: record.status === 'active'
                      ? <StopOutlined style={{ color: '#ff4d4f' }} />
                      : <CheckCircleOutlined style={{ color: '#52c41a' }} />,
                    label: record.status === 'active' ? 'Deactivate' : 'Activate',
                    onClick: () => toggleItemStatus(record),
                  },
                ],
              }}
            >
              <Tooltip title="More actions">
                <Button
                  icon={<MoreOutlined />}
                  size="small"
                  style={{ borderRadius: 6, border: '1px solid #d9d9d9', color: '#595959' }}
                />
              </Tooltip>
            </Dropdown>
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

      // Load tax rates from new tax module
      try {
        const taxRes = await apiService.get('/tax/rates');
        if (taxRes.success) setTaxRateOptions(taxRes.data || []);
      } catch { /* silent — tax module optional */ }
    } catch (error) {
      console.error('Dropdown fetch error:', error);
    }
  };

  const fetchWarehouseTypes = async () => {
    try {
      const res = await apiService.get('/warehouse-types');
      if (res.success) setWarehouseTypes(res.data);
    } catch (e) {
      console.error('Failed to fetch warehouse types', e);
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
        defaultBinId: values.defaultBinId || null,
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
      // Clear draft on successful save
      try { await apiService.delete('/items/draft'); } catch {}
      setDraftBanner(null);
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

  const fetchBinsForWarehouse = async (warehouseId) => {
    if (!warehouseId) { setBinsForWarehouse([]); return; }
    setBinsLoading(true);
    try {
      const res = await apiService.get('/warehouse-locations/bins', {
        params: { warehouseId, status: 'active', limit: 1000 }
      });
      setBinsForWarehouse(res.success ? (res.data || []) : []);
    } catch {
      setBinsForWarehouse([]);
    } finally {
      setBinsLoading(false);
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

    // Get warehouse from item's warehouse_ids (returned by getItem via GROUP_CONCAT)
    // Fall back to fetching all inventory and filtering by item
    let finalWarehouseId = null;
    if (fullItem.warehouse_ids?.length > 0) {
      finalWarehouseId = fullItem.warehouse_ids[0] || null;
    } else {
      try {
        const invResponse = await apiService.get('/inventory');
        if (invResponse.success && invResponse.data?.length > 0) {
          const itemStocks = invResponse.data.filter(inv => inv.item_id === fullItem.id);
          if (itemStocks.length > 0) {
            const best = itemStocks.reduce((a, b) =>
              (Number(b.quantity_available) || 0) > (Number(a.quantity_available) || 0) ? b : a
            );
            finalWarehouseId = best.warehouse_id || null;
          }
        }
      } catch { /* no warehouse found */ }
    }
    
    // brand/manufacturer/unit come back as names from the API JOIN — map back to IDs for the selects
    const brandId = brandOptions.find(b => b.name === fullItem.brand)?.id ?? fullItem.brand;
    const manufacturerId = manufacturerOptions.find(m => m.name === fullItem.manufacturer)?.id ?? fullItem.manufacturer;
    const unitId = unitOptions.find(u => u.name === fullItem.unit)?.id ?? fullItem.unit;

    form.setFieldsValue({
      sku: fullItem.sku,
      name: fullItem.name,
      description: fullItem.description,
      type: fullItem.type,
      category: fullItem.category,
      unit: unitId,
      costPrice: convertPrice(fullItem.cost_price, 'USD', currency),
      sellingPrice: convertPrice(fullItem.selling_price, 'USD', currency),
      mrp: convertPrice(fullItem.mrp, 'USD', currency),
      taxRate: fullItem.tax_rate,
      brand: brandId,
      manufacturer: manufacturerId,
      minStockLevel: fullItem.min_stock_level,
      maxStockLevel: fullItem.max_stock_level,
      barcode: fullItem.barcode,
      hsnCode: fullItem.hsn_code,
      openingStock: fullItem.opening_stock,
      openingValue: fullItem.opening_value,
      valuationMethod: fullItem.valuation_method,
      warehouseId: finalWarehouseId,
      defaultBinId: fullItem.default_bin_id || null,
      weight: fullItem.weight,
      length: fullItem.dimensions?.length,
      width: fullItem.dimensions?.width,
      height: fullItem.dimensions?.height,
      upc: fullItem.upc,
      ean: fullItem.ean,
      isbn: fullItem.isbn,
      mpn: fullItem.mpn
    });
    fetchBinsForWarehouse(finalWarehouseId);
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

  const duplicateItem = async (item) => {
    setEditingItem(null);
    setPriceCurrency(currency);
    setImageUrl(item.image || '');
    setImageFile(null);
    setDraftBanner(null);
    setDuplicateBanner({ sourceName: item.name });
    form.resetFields();
    await fetchDropdownOptions();

    let fullItem = item;
    try {
      const res = await apiService.get(`/items/${item.id}`);
      if (res.success) fullItem = res.data;
    } catch {}

    form.setFieldsValue({
      // SKU and name intentionally left blank — user must fill these
      sku: '',
      name: '',
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
      barcode: '',
      hsnCode: fullItem.hsn_code,
      openingStock: null,
      openingValue: null,
      valuationMethod: fullItem.valuation_method,
      weight: fullItem.weight,
      length: fullItem.dimensions?.length,
      width: fullItem.dimensions?.width,
      height: fullItem.dimensions?.height,
      upc: '',
      ean: '',
      isbn: '',
      mpn: fullItem.mpn,
    });
    setModalVisible(true);
    setTimeout(() => message.info('Duplicated from "' + item.name + '" — update SKU, Name & Opening Stock'), 300);
  };

  const openCreateModal = async () => {
    setEditingItem(null);
    setPriceCurrency(currency);
    setImageUrl('');
    setImageFile(null);
    form.resetFields();
    setDraftBanner(null);
    setDuplicateBanner(null);

    await fetchDropdownOptions();
    setModalVisible(true);
  };

  const fetchDrafts = async () => {
    try {
      setDraftsLoading(true);
      const res = await apiService.get('/items/draft');
      setDrafts(res?.data ? [res.data] : []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  const openDraft = async (draft) => {
    setEditingItem(null);
    setPriceCurrency(currency);
    setImageUrl(draft.data?.image || '');
    setImageFile(null);
    form.resetFields();
    await fetchDropdownOptions();
    form.setFieldsValue(draft.data);
    setDraftBanner({ savedAt: draft.savedAt });
    setModalVisible(true);
  };

  const handleSaveDraft = async () => {
    try {
      const values = form.getFieldsValue();
      await apiService.post('/items/draft', { ...values, image: imageUrl });
      message.success('Draft saved! You can continue later.');
      setModalVisible(false);
      setEditingItem(null);
      fetchDrafts();
    } catch {
      message.error('Failed to save draft');
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await fetchItems();
      await new Promise(resolve => setTimeout(resolve, 200));
      await fetchDropdownOptions();
      await fetchDrafts();
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
    border: '1px solid #ebebf5',
    borderRadius: 14,
    padding: '20px 20px 8px',
    marginBottom: 18,
    boxShadow: '0 2px 10px rgba(102,126,234,0.06)',
  };
  const sectionHeader = {
    fontWeight: 700,
    fontSize: 13,
    color: '#667eea',
    marginBottom: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottom: '2px solid #f0f0ff',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };
  const sectionIconStyle = {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    borderRadius: 8,
    padding: '5px 7px',
    color: '#fff',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const filteredItems = items.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (!searchText) return true;
    return (
      item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchText.toLowerCase())
    );
  });
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
          <Space size={6}>
            {[
              { key: 'all', label: 'All', count: items.length, color: '#667eea', bg: '#f0f0ff', border: '#667eea' },
              { key: 'active', label: 'Active', count: items.filter(i => i.status === 'active').length, color: '#52c41a', bg: '#f6ffed', border: '#52c41a' },
              { key: 'inactive', label: 'Inactive', count: items.filter(i => i.status === 'inactive').length, color: '#ff4d4f', bg: '#fff1f0', border: '#ff4d4f' },
            ].map(f => (
              <span
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  border: `1.5px solid ${statusFilter === f.key ? f.border : '#e0e0e0'}`,
                  background: statusFilter === f.key ? f.bg : '#fff',
                  color: statusFilter === f.key ? f.color : '#8c8c8c',
                  transition: 'all 0.15s',
                }}
              >
                {f.label}
                <span style={{ background: statusFilter === f.key ? f.color : '#d9d9d9', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{f.count}</span>
              </span>
            ))}
          </Space>
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
              <Tooltip title="Configure SKU auto-generator rules (prefix, counter, date, per-category overrides)">
                <Button
                  icon={<SettingOutlined />}
                  onClick={openSkuRulesModal}
                  style={{
                    background: '#fff',
                    color: '#764ba2',
                    border: '1.5px solid #764ba2',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    height: 38,
                  }}
                >
                  SKU Rules
                </Button>
              </Tooltip>
            )}
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
        <Tabs
          defaultActiveKey="items"
          items={[
            {
              key: 'items',
              label: <span>All Items <Tag color="purple" style={{ borderRadius: 20, marginLeft: 4 }}>{filteredItems.length}</Tag></span>,
              children: (
                <Table
                  columns={columns}
                  dataSource={filteredItems}
                  loading={loading}
                  rowKey="id"
                  scroll={{ x: 'max-content' }}
                  rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
                  pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (t) => `Total ${t} items`, style: { marginTop: 16 } }}
                />
              )
            },
            {
              key: 'drafts',
              label: <span>Drafts {drafts.length > 0 && <Tag color="orange" style={{ borderRadius: 20, marginLeft: 4 }}>{drafts.length}</Tag>}</span>,
              children: (
                <Table
                  loading={draftsLoading}
                  rowKey="id"
                  dataSource={drafts}
                  pagination={false}
                  locale={{ emptyText: 'No drafts saved' }}
                  columns={[
                    {
                      title: 'Item Name',
                      render: (_, r) => r.data?.name || <span style={{ color: '#bbb' }}>Untitled</span>
                    },
                    {
                      title: 'SKU',
                      render: (_, r) => r.data?.sku || '-'
                    },
                    {
                      title: 'Type',
                      render: (_, r) => r.data?.type ? <Tag color="blue" style={{ borderRadius: 20, textTransform: 'capitalize' }}>{r.data.type}</Tag> : '-'
                    },
                    {
                      title: 'Last Saved',
                      render: (_, r) => <span style={{ color: '#8c8c8c', fontSize: 13 }}>{new Date(r.savedAt).toLocaleString()}</span>
                    },
                    {
                      title: 'Actions',
                      render: (_, r) => (
                        <Space>
                          <Button
                            size="small"
                            style={{ borderRadius: 6, background: '#667eea', border: 'none', color: '#fff', fontWeight: 600 }}
                            onClick={() => openDraft(r)}
                          >
                            Continue
                          </Button>
                          <Button
                            size="small"
                            danger
                            style={{ borderRadius: 6 }}
                            onClick={async () => {
                              try {
                                await apiService.delete('/items/draft');
                                message.success('Draft deleted');
                                fetchDrafts();
                              } catch { message.error('Failed to delete draft'); }
                            }}
                          >
                            Delete
                          </Button>
                        </Space>
                      )
                    }
                  ]}
                />
              )
            }
          ]}
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
        onCancel={() => { setModalVisible(false); setEditingItem(null); setImageUrl(''); setImageFile(null); setDuplicateBanner(null); form.resetFields(); }}
        footer={null}
        width="min(900px, 96vw)"
        style={{ top: 16 }}
        styles={{ body: { background: '#fafbff', borderRadius: '0 0 12px 12px', maxHeight: '80vh', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}
          style={{ '--ant-input-border-radius': '8px' }}
        >

          {/* Duplicate banner */}
          {duplicateBanner && (
            <div style={{ background: 'linear-gradient(135deg, #fff7e6, #fffbe6)', border: '1px solid #ffd591', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CopyOutlined style={{ color: '#fa8c16', fontSize: 18 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#d46b08', fontSize: 13 }}>Duplicated from "{duplicateBanner.sourceName}"</div>
                <div style={{ fontSize: 12, color: '#ad6800', marginTop: 2 }}>All details copied — just update <strong>SKU</strong>, <strong>Item Name</strong> and <strong>Opening Stock</strong> before saving.</div>
              </div>
              <Button size="small" style={{ borderRadius: 6, borderColor: '#ffa940', color: '#fa8c16' }} onClick={() => setDuplicateBanner(null)}>Dismiss</Button>
            </div>
          )}

          {/* Draft restored banner */}
          {draftBanner && (
            <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8, padding: '8px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#1677ff' }}>📝 Draft restored from {new Date(draftBanner.savedAt).toLocaleString()}</span>
              <Button size="small" danger onClick={async () => { try { await apiService.delete('/items/draft'); } catch {} setDraftBanner(null); form.resetFields(); setImageUrl(''); }}>Discard</Button>
            </div>
          )}

          {/* ── Section: Basic Info ── */}
          <div style={sectionStyle}>
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><AppstoreOutlined /></span>
              Basic Information
            </div>
            <Row gutter={16}>
              <Col xs={24} md={16}>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item name="sku" label="SKU" rules={[{ required: true, message: 'Please input SKU!' }]}>
                      <Input
                        placeholder="e.g. ITEM-001"
                        style={{ borderRadius: 8 }}
                        addonAfter={(
                          <Tooltip title="Generate SKU from your SKU rule (uses Category/Brand if configured)">
                            <Button
                              type="link"
                              size="small"
                              loading={skuGenerating}
                              icon={<ThunderboltOutlined />}
                              onClick={handleGenerateSku}
                              style={{ padding: 0, height: 'auto', color: '#764ba2', fontWeight: 600 }}
                            >
                              Generate
                            </Button>
                          </Tooltip>
                        )}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="name" label="Item Name" rules={[{ required: true, message: 'Please input name!' }]}>
                      <Input placeholder="Enter item name" style={{ borderRadius: 8 }} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="type" label="Type" initialValue="simple">
                      <Select allowClear>
                        <Select.Option value="simple">Simple</Select.Option>
                        <Select.Option value="variant">Variant</Select.Option>
                        <Select.Option value="composite">Composite</Select.Option>
                        <Select.Option value="service">Service</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="category" label="Category">
                    {canViewCategories ? (
                      <Select
                        placeholder={categories.length ? 'Select category' : 'Select or add a category'}
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                              <Button type="link" size="small" onClick={handleInlineAddCategory}>
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
                      allowClear
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
                    <Form.Item name="returnableItem" valuePropName="checked" style={{ marginBottom: 8 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff', fontSize: 13, color: '#595959', userSelect: 'none' }}>
                        <input type="checkbox" style={{ accentColor: '#667eea', width: 15, height: 15 }} />
                        <span>Returnable Item</span>
                      </label>
                    </Form.Item>
                  </Col>
                </Row>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="image" label="Item Image">
                  <div style={{ position: 'relative' }}>
                    <Upload name="image" listType="picture-card" showUploadList={false}
                      style={{ width: '100%' }}
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
                        <div style={{ position: 'relative', width: '100%', height: 260 }}>
                          <img src={imageUrl} alt="item" style={{ width: '100%', height: 260, objectFit: 'cover', borderRadius: 10 }} />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', color: '#fff', fontSize: 13, fontWeight: 600, gap: 6 }}
                            onMouseEnter={e => e.currentTarget.style.opacity = 1}
                            onMouseLeave={e => e.currentTarget.style.opacity = 0}
                          >
                            <UploadOutlined style={{ fontSize: 24 }} />
                            Change Image
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 260, background: 'linear-gradient(135deg, #f5f5ff 0%, #faf0ff 100%)', border: '2px dashed #c5b8f5', borderRadius: 10, color: '#9b8fd4', cursor: 'pointer', transition: 'all 0.2s', gap: 8 }}>
                          <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: '50%', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UploadOutlined style={{ fontSize: 24, color: '#fff' }} />
                          </div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#667eea' }}>Click or drag to upload</div>
                          <div style={{ fontSize: 11, color: '#aaa', background: '#fff', borderRadius: 20, padding: '2px 10px', border: '1px solid #e8e8ff' }}>JPG / PNG · max 2MB</div>
                        </div>
                      )}
                    </Upload>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => { setImageUrl(''); setImageFile(null); }}
                        style={{ position: 'absolute', top: 8, right: 8, background: '#ff4d4f', border: 'none', borderRadius: '50%', width: 26, height: 26, color: '#fff', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 2 }}
                      >
                        ×
                      </button>
                    )}
                  </div>
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
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><DollarOutlined /></span>
              Sales Information
            </div>
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
                <Select placeholder="Select account" allowClear>
                  <Select.Option value="sales">Sales</Select.Option>
                  <Select.Option value="income">Income</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="taxRate" label="Tax Rate (%)" rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                {taxRateOptions.length > 0 ? (
                  <Select allowClear placeholder="Select tax rate" showSearch optionFilterProp="children">
                    {taxRateOptions.map(t => (
                      <Select.Option key={t.id} value={parseFloat(t.rate)}>
                        {t.name} ({parseFloat(t.rate).toFixed(2)}%) — {t.tax_type?.toUpperCase()}
                      </Select.Option>
                    ))}
                  </Select>
                ) : (
                  <InputNumber
                    min={0} max={100} step={0.01} precision={2}
                    style={{ width: '100%' }}
                    placeholder="Enter tax rate"
                    parser={value => value.replace(/[^0-9.]/g, '')}
                  />
                )}
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
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><ShopOutlined /></span>
              Purchase Information
            </div>
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
                <Select placeholder="Select account" allowClear>
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
            <div style={sectionHeader}>
              <span style={sectionIconStyle}><InboxOutlined /></span>
              Inventory Tracking
            </div>
            <div style={{ marginBottom: 16 }}>
              <Form.Item name="trackInventory" valuePropName="checked" style={{ marginBottom: 0 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff', fontSize: 13, color: '#595959', userSelect: 'none' }}>
                  <input type="checkbox" style={{ accentColor: '#667eea', width: 15, height: 15 }} />
                  <span>Track Inventory for this Item</span>
                </label>
              </Form.Item>
            </div>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="inventoryAccount" label="Inventory Account">
                <Select placeholder="Select an account" allowClear>
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
                <Select
                  placeholder="Select warehouse"
                  allowClear
                  onChange={(value) => {
                    form.setFieldsValue({ defaultBinId: null });
                    fetchBinsForWarehouse(value);
                  }}
                  notFoundContent={
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                      <div style={{ color: '#8c8c8c', marginBottom: 8 }}>No warehouses found</div>
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => setWarehouseModalVisible(true)}
                      >
                        Add Warehouse
                      </Button>
                    </div>
                  }
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                        <Button
                          type="link"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => setWarehouseModalVisible(true)}
                        >
                          Add New Warehouse
                        </Button>
                      </div>
                    </div>
                  )}
                >
                  {warehouses.filter(w => w.status === 'active' || (editingItem && w.id === form.getFieldValue('warehouseId'))).map(warehouse => (
                    <Select.Option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}{warehouse.status !== 'active' ? ' (inactive)' : ''}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                noStyle
                shouldUpdate={(prev, cur) => prev.warehouseId !== cur.warehouseId}
              >
                {({ getFieldValue }) => {
                  const hasWarehouse = !!getFieldValue('warehouseId');
                  return (
                    <Form.Item
                      name="defaultBinId"
                      label="Default Bin (optional)"
                      tooltip="Preferred putaway bin for this item. Used as the default destination in GRN / Putaway flows."
                    >
                      <Select
                        placeholder={hasWarehouse ? 'Select bin' : 'Select a warehouse first'}
                        allowClear
                        showSearch
                        loading={binsLoading}
                        disabled={!hasWarehouse}
                        optionFilterProp="label"
                        options={binsForWarehouse.map(b => ({
                          value: b.id,
                          label: `${b.zone_code} / ${b.rack_code} / ${b.code}${b.name ? ` — ${b.name}` : ''}`
                        }))}
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="valuationMethod" label="Inventory Valuation Method">
                <Select placeholder="Select valuation method" allowClear>
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

          <div style={{ position: 'sticky', bottom: 0, background: 'linear-gradient(to top, #fafbff 80%, transparent)', zIndex: 10, marginLeft: -24, marginRight: -24, padding: '16px 24px 8px', borderTop: '1px solid #ebebf5' }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                icon={editingItem ? <EditOutlined /> : <PlusOutlined />}
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 10, fontWeight: 700, paddingInline: 28, boxShadow: '0 4px 14px rgba(102,126,234,0.45)' }}
              >
                {editingItem ? 'Update Item' : 'Create Item'}
              </Button>
              {!editingItem && (
                <Button size="large" style={{ borderRadius: 10, borderColor: '#faad14', color: '#faad14', fontWeight: 600 }} onClick={handleSaveDraft}>
                  Save as Draft
                </Button>
              )}
              <Button size="large" style={{ borderRadius: 10, color: '#8c8c8c' }} onClick={() => { setModalVisible(false); setEditingItem(null); setDuplicateBanner(null); form.resetFields(); }}>
                Cancel
              </Button>
            </Space>
          </div>
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
                            const eventType = log.type || log.event_type || '';
                            const getEventColor = (type) => {
                              if (['PurchaseReceived', 'SaleReturned', 'SaleReservationCancelled'].includes(type)) return 'green';
                              if (['SaleShipped', 'PurchaseReturned', 'StockDamaged', 'StockExpired'].includes(type)) return 'red';
                              if (['SaleReserved'].includes(type)) return 'orange';
                              if (type === 'ADJUSTMENT') return 'blue';
                              if (['TransferIn', 'TransferOut'].includes(type)) return 'purple';
                              return 'gray';
                            };
                            const getEventLabel = (type) => {
                              const labels = {
                                PurchaseReceived: 'Stock Received (PO)',
                                PurchaseReturned: 'Purchase Returned',
                                SaleReserved: 'Stock Reserved (SO)',
                                SaleShipped: 'Stock Shipped (SO)',
                                SaleReturned: 'Sale Returned',
                                SaleReservationCancelled: 'Reservation Cancelled',
                                TransferIn: 'Transfer In',
                                TransferOut: 'Transfer Out',
                                StockDamaged: 'Stock Damaged',
                                StockExpired: 'Stock Expired',
                                ADJUSTMENT: 'Stock Adjusted',
                              };
                              return labels[type] || type;
                            };
                            const qty = log.quantity ?? log.quantity_change;
                            const isPositive = ['PurchaseReceived', 'TransferIn', 'SaleReturned', 'SaleReservationCancelled'].includes(eventType) || (eventType === 'ADJUSTMENT' && log.sub_type === 'increase');
                            const isNegative = ['SaleShipped', 'SaleReserved', 'TransferOut', 'PurchaseReturned', 'StockDamaged', 'StockExpired'].includes(eventType) || (eventType === 'ADJUSTMENT' && log.sub_type === 'decrease');
                            const signedQty = qty != null ? (isNegative ? -Math.abs(qty) : isPositive ? Math.abs(qty) : qty) : null;
                            const unitCost = log.details?.unitCost || log.details?.unitPrice || log.unit_cost;
                            const ref = log.reference || log.reference_number;
                            const notes = log.reason || log.notes;
                            return (
                              <Timeline.Item key={index} color={getEventColor(eventType)}>
                                <div style={{ marginBottom: 8 }}>
                                  <Tag color={getEventColor(eventType)}>{getEventLabel(eventType)}</Tag>
                                  <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                                    {new Date(log.timestamp || log.operation_date).toLocaleString()}
                                  </span>
                                </div>
                                <div style={{ fontSize: 13 }}>
                                  {log.warehouse && <div>Warehouse: <strong>{log.warehouse}</strong></div>}
                                  {signedQty != null && (
                                    <div>Quantity: <strong style={{ color: signedQty >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                      {signedQty > 0 ? '+' : ''}{signedQty}
                                    </strong></div>
                                  )}
                                  {unitCost != null && <div>Unit Cost: <strong>{formatPrice(unitCost, currency, 'USD')}</strong></div>}
                                  {log.performed_by?.trim() && <div style={{ color: '#8c8c8c', fontSize: 12 }}>By: {log.performed_by}</div>}
                                  {ref && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Ref: {ref}</div>}
                                  {notes && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Notes: {notes}</div>}
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
                            dataIndex: 'reason',
                            key: 'reason',
                            render: (v) => v || '-'
                          },
                          {
                            title: 'Date',
                            dataIndex: 'effective_date',
                            key: 'effective_date',
                            render: (v) => v ? new Date(v).toLocaleDateString() : '-'
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
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
              <PlusOutlined />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Add New Warehouse</span>
          </div>
        }
        open={warehouseModalVisible}
        onCancel={() => { setWarehouseModalVisible(false); warehouseForm.resetFields(); }}
        footer={null}
        width="min(480px, 96vw)"
        style={{ top: 40 }}
        styles={{ body: { background: '#fafbff' } }}
      >
        <Form
          form={warehouseForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              const response = await apiService.post('/warehouses', {
                code: values.code,
                name: values.name,
                type: values.type || null,
                address: values.address || null,
                contactPerson: values.contactPerson || null,
                phone: values.phone || null,
                email: values.email || null
              });
              if (response.success) {
                message.success('Warehouse created successfully');
                const newWarehouseId = response.data?.warehouseId;
                const warehousesResponse = await apiService.get('/warehouses', { params: { status: 'all' } });
                if (warehousesResponse.success) {
                  setWarehouses(warehousesResponse.data);
                  if (newWarehouseId) {
                    form.setFieldsValue({ warehouseId: newWarehouseId });
                  }
                }
                setWarehouseModalVisible(false);
                warehouseForm.resetFields();
              }
            } catch (error) {
              const errMsg = error?.response?.data?.error || error?.message || 'Failed to create warehouse';
              message.error(errMsg);
            }
          }}
        >
          <Form.Item name="code" label="Code" rules={[{ required: true, message: 'Please input code!' }]}>
            <Input placeholder="e.g. WH-001" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please input name!' }]}>
            <Input placeholder="Enter warehouse name" />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Select
              placeholder="Select warehouse type"
              allowClear
              onDropdownVisibleChange={(open) => { if (open) fetchWarehouseTypes(); }}
              dropdownRender={(menu) => (
                <>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {warehouseTypes.map(type => (
                      <div key={type.id} style={{ padding: '5px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {editingTypeId === type.id ? (
                          <>
                            <Input
                              size="small"
                              value={editingTypeName}
                              onChange={(e) => setEditingTypeName(e.target.value)}
                              onKeyDown={(e) => e.stopPropagation()}
                              style={{ flex: 1, marginRight: 8 }}
                            />
                            <Space size="small">
                              <Button size="small" type="primary"
                                onClick={async () => {
                                  if (!editingTypeName.trim()) { message.warning('Type name cannot be empty'); return; }
                                  try {
                                    const res = await apiService.put(`/warehouse-types/${type.id}`, { name: editingTypeName });
                                    if (res.success) { message.success('Type updated'); setEditingTypeId(null); setEditingTypeName(''); fetchWarehouseTypes(); }
                                  } catch { message.error('Failed to update type'); }
                                }}
                              >Save</Button>
                              <Button size="small" icon={<CloseOutlined />} onClick={() => { setEditingTypeId(null); setEditingTypeName(''); }} />
                            </Space>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => warehouseForm.setFieldsValue({ type: type.id })}>{type.name}</span>
                            <Space size="small">
                              <Button size="small" type="text" icon={<EditOutlined />}
                                onClick={(e) => { e.stopPropagation(); setEditingTypeId(type.id); setEditingTypeName(type.name); }}
                              />
                              <Popconfirm title="Delete this type?" onConfirm={async (e) => {
                                e?.stopPropagation();
                                try {
                                  const res = await apiService.delete(`/warehouse-types/${type.id}`);
                                  if (res.success) { message.success('Type deleted'); fetchWarehouseTypes(); }
                                } catch { message.error('Failed to delete type'); }
                              }} onCancel={(e) => e?.stopPropagation()}>
                                <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                              </Popconfirm>
                            </Space>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <Divider style={{ margin: '8px 0' }} />
                  <Space style={{ padding: '0 8px 4px' }}>
                    <Input
                      placeholder="New type name"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <Button type="text" icon={<PlusOutlined />}
                      onClick={async () => {
                        if (!newTypeName.trim()) { message.warning('Please enter a type name'); return; }
                        try {
                          const res = await apiService.post('/warehouse-types', { name: newTypeName });
                          if (res.success) { message.success('Type created'); setNewTypeName(''); fetchWarehouseTypes(); }
                        } catch { message.error('Failed to create type'); }
                      }}
                    >Add</Button>
                  </Space>
                </>
              )}
            >
              {warehouseTypes.map(type => (
                <Select.Option key={type.id} value={type.id}>{type.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="address" label="Address">
            <Input.TextArea placeholder="Enter address" rows={2} />
          </Form.Item>
          <Form.Item name="contactPerson" label="Contact Person">
            <Input placeholder="Enter contact person" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="Enter phone number" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="Enter email" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', borderRadius: 8, fontWeight: 600 }}
              >
                Create Warehouse
              </Button>
              <Button style={{ borderRadius: 8 }} onClick={() => { setWarehouseModalVisible(false); warehouseForm.resetFields(); }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onBarcode={handleBarcodeScan}
      />

      {/* -------------------- SKU Auto-Generator: Manage Rules ----------------- */}
      <Modal
        title={<span><ThunderboltOutlined style={{ color: '#764ba2', marginRight: 8 }} />Manage SKU Rules</span>}
        open={skuRulesOpen}
        onCancel={() => { setSkuRulesOpen(false); setEditingSkuRule(null); skuRuleForm.resetFields(); }}
        footer={null}
        width={900}
        destroyOnClose
      >
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* --- Existing rules list --- */}
          <div style={{ flex: '1 1 340px', minWidth: 320 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ fontSize: 14 }}>Active Rules</b>
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={startNewSkuRule} style={{ background: '#764ba2', border: 'none' }}>
                New Rule
              </Button>
            </div>
            <Table
              size="small"
              rowKey="id"
              loading={skuRulesLoading}
              dataSource={skuRules}
              pagination={false}
              locale={{ emptyText: 'No rules yet. Create one to start auto-generating SKUs.' }}
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  render: (v, r) => (
                    <div>
                      <div style={{ fontWeight: 600 }}>{v}</div>
                      <div style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {r.scope === 'category' ? `Category: ${r.scope_value}` : 'Institution default'}
                        {r.is_default ? <Tag color="purple" style={{ marginLeft: 6 }}>Default</Tag> : null}
                      </div>
                    </div>
                  )
                },
                {
                  title: 'Next',
                  render: (_, r) => {
                    const n = (Number(r.counter_current) || 0) + 1;
                    const padded = String(n).padStart(r.counter_padding || 4, '0');
                    return <Tag color="geekblue">{r.use_counter ? padded : '—'}</Tag>;
                  }
                },
                {
                  title: '',
                  width: 90,
                  render: (_, r) => (
                    <Space size={4}>
                      <Button size="small" type="link" onClick={() => startEditSkuRule(r)}>Edit</Button>
                      <Popconfirm title="Remove this rule?" onConfirm={() => removeSkuRule(r.id)} okText="Remove" okButtonProps={{ danger: true }}>
                        <Button size="small" type="link" danger>Delete</Button>
                      </Popconfirm>
                    </Space>
                  )
                }
              ]}
            />
          </div>

          {/* --- Edit / create form --- */}
          <div style={{ flex: '1 1 420px', minWidth: 380, background: '#fafafb', padding: 16, borderRadius: 10, border: '1px solid #f0f0f0' }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>
              {editingSkuRule ? `Edit: ${editingSkuRule.name}` : 'Create a new rule'}
            </div>
            <Form
              form={skuRuleForm}
              layout="vertical"
              initialValues={{
                scope: 'default',
                prefixMode: 'static',
                prefixLength: 3,
                separator: '-',
                useDate: false,
                dateFormat: 'YYMM',
                useCounter: true,
                counterStart: 1,
                counterPadding: 4,
                isDefault: false
              }}
            >
              <Form.Item name="name" label="Rule Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input placeholder="e.g. Default, Electronics, Apparel" />
              </Form.Item>

              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item name="scope" label="Applies To" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="default">Institution default</Select.Option>
                      <Select.Option value="category">Specific category</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    noStyle
                    shouldUpdate={(prev, cur) => prev.scope !== cur.scope}
                  >
                    {({ getFieldValue }) => getFieldValue('scope') === 'category' ? (
                      <Form.Item name="scopeValue" label="Category" rules={[{ required: true, message: 'Pick a category' }]}>
                        <Select
                          placeholder="Select category"
                          showSearch
                          options={(categories || []).map(c => ({ value: c.name, label: c.name }))}
                        />
                      </Form.Item>
                    ) : (
                      <Form.Item name="isDefault" label="Usage">
                        <Select>
                          <Select.Option value={true}>Use as default</Select.Option>
                          <Select.Option value={false}>Secondary (manual pick)</Select.Option>
                        </Select>
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '4px 0 12px', fontSize: 12 }} orientation="left">Prefix</Divider>
              <Row gutter={12}>
                <Col span={10}>
                  <Form.Item name="prefixMode" label="Mode" rules={[{ required: true }]}>
                    <Select>
                      <Select.Option value="static">Static text</Select.Option>
                      <Select.Option value="derived">Derived from field</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item noStyle shouldUpdate={(p, c) => p.prefixMode !== c.prefixMode}>
                    {({ getFieldValue }) => getFieldValue('prefixMode') === 'static' ? (
                      <Form.Item name="prefixStatic" label="Text" rules={[{ required: true, message: 'Enter a prefix' }]}>
                        <Input placeholder="e.g. ITEM, TSHIRT, EL" maxLength={20} />
                      </Form.Item>
                    ) : (
                      <Row gutter={8}>
                        <Col span={14}>
                          <Form.Item name="prefixSource" label="Source" rules={[{ required: true }]}>
                            <Select>
                              <Select.Option value="category">Category name</Select.Option>
                              <Select.Option value="brand">Brand name</Select.Option>
                              <Select.Option value="name">Item name</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={10}>
                          <Form.Item name="prefixLength" label="# chars">
                            <InputNumber min={1} max={10} style={{ width: '100%' }} />
                          </Form.Item>
                        </Col>
                      </Row>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="separator" label="Separator">
                <Select>
                  <Select.Option value="-">Dash (-)</Select.Option>
                  <Select.Option value="_">Underscore (_)</Select.Option>
                  <Select.Option value="">None</Select.Option>
                </Select>
              </Form.Item>

              <Divider style={{ margin: '4px 0 12px', fontSize: 12 }} orientation="left">Date segment (optional)</Divider>
              <Row gutter={12}>
                <Col span={10}>
                  <Form.Item name="useDate" label="Include date">
                    <Select>
                      <Select.Option value={false}>No</Select.Option>
                      <Select.Option value={true}>Yes</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={14}>
                  <Form.Item noStyle shouldUpdate={(p, c) => p.useDate !== c.useDate}>
                    {({ getFieldValue }) => getFieldValue('useDate') ? (
                      <Form.Item name="dateFormat" label="Format" rules={[{ required: true }]}>
                        <Select>
                          <Select.Option value="YY">YY (26)</Select.Option>
                          <Select.Option value="YYMM">YYMM (2604)</Select.Option>
                          <Select.Option value="YYYYMM">YYYYMM (202604)</Select.Option>
                          <Select.Option value="YYYYMMDD">YYYYMMDD (20260421)</Select.Option>
                        </Select>
                      </Form.Item>
                    ) : null}
                  </Form.Item>
                </Col>
              </Row>

              <Divider style={{ margin: '4px 0 12px', fontSize: 12 }} orientation="left">Counter</Divider>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="useCounter" label="Include counter">
                    <Select>
                      <Select.Option value={true}>Yes</Select.Option>
                      <Select.Option value={false}>No</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="counterStart" label="Start at">
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="counterPadding" label="Zero-pad width">
                    <InputNumber min={1} max={10} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                {editingSkuRule && (
                  <Button onClick={() => { setEditingSkuRule(null); skuRuleForm.resetFields(); }}>Cancel edit</Button>
                )}
                <Button type="primary" onClick={submitSkuRule} style={{ background: '#764ba2', border: 'none' }}>
                  {editingSkuRule ? 'Update Rule' : 'Create Rule'}
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Items;