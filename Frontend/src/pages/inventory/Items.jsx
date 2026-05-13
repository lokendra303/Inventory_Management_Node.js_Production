import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { useLocation } from 'react-router-dom';

const VARIANT_MATRIX_GRID_TEMPLATE = 'minmax(0, 2.2fr) minmax(0, 1.5fr) minmax(0, 1.35fr) minmax(0, 0.95fr) minmax(0, 0.95fr) minmax(0, 1.5fr) minmax(64px, 0.6fr)';
const VARIANT_MATRIX_MIN_WIDTH = '100%';
const VARIANT_MATRIX_LABEL_STYLE = {
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.4
};
const VARIANT_MATRIX_ACTION_STYLE = {
  padding: 0,
  height: 'auto',
  fontSize: 11,
  fontWeight: 600
};
const extractSkuTemplateTokens = (template = '') =>
  (String(template || '').match(/\{([^}]+)\}/g) || [])
    .map((wrap) => String(wrap).slice(1, -1).split('|')[0]?.trim()?.toUpperCase())
    .filter(Boolean);
const toSkuCode = (value, len = 3) => {
  const parts = String(value || '')
    .trim()
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean);
  const compact = parts.length >= 2
    ? parts.map((part) => part[0].toUpperCase()).join('')
    : parts.join('').toUpperCase();
  return compact.replace(/[^A-Z0-9]+/g, '').slice(0, len);
};
const isBlankVariantMatrixValue = (value) => (
  value === undefined ||
  value === null ||
  (typeof value === 'string' && !value.trim())
);

const Items = () => {
  const location = useLocation();
  const { user, sessionSecondsLeft } = useAuth();
  const { currency } = useCurrency();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [itemTypes, setItemTypes] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
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
  const [itemGroupFilter, setItemGroupFilter] = useState('all');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [warehouseModalVisible, setWarehouseModalVisible] = useState(false);
  const [warehouseForm] = Form.useForm();
  const [warehouseTypes, setWarehouseTypes] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [draftBanner, setDraftBanner] = useState(null);
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [duplicateBanner, setDuplicateBanner] = useState(null); // { sourceName }
  const [drafts, setDrafts] = useState([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');
  const [binsForWarehouse, setBinsForWarehouse] = useState([]);
  const [binsLoading, setBinsLoading] = useState(false);
  const [editingWarehouseSummaries, setEditingWarehouseSummaries] = useState([]);
  const [duplicateSourcePayload, setDuplicateSourcePayload] = useState(null);
  const [variantLibrary, setVariantLibrary] = useState([]);
  const [existingCustomFields, setExistingCustomFields] = useState({});
  const [variantMatrixEdits, setVariantMatrixEdits] = useState([]);
  const [compositeComponents, setCompositeComponents] = useState([]);
  const autoDraftSavingRef = useRef(false);
  const autoDraftSavedRef = useRef(false);
  const variantBuilderSeededRef = useRef(false);

  // ---- SKU auto-generator (Zoho-style rules) ------------------------------
  const [skuRulesOpen, setSkuRulesOpen] = useState(false);
  const [skuRules, setSkuRules] = useState([]);
  const [skuRulesLoading, setSkuRulesLoading] = useState(false);
  const [skuRuleForm] = Form.useForm();
  const [editingSkuRule, setEditingSkuRule] = useState(null);
  const [skuGenerating, setSkuGenerating] = useState(false);
  const [selectedSkuRuleId, setSelectedSkuRuleId] = useState(null);
  const [lastAppliedSkuRule, setLastAppliedSkuRule] = useState(null);

  const normalizeOptionalText = (value) => {
    if (value == null) return undefined;
    const text = String(value).trim();
    if (!text || text.toLowerCase() === 'null' || text.toLowerCase() === 'undefined') return undefined;
    return text;
  };
  const normalizeDuplicateLookup = (value) => (
    String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase()
  );
  const normalizeOptionalTextArray = (value) => {
    if (Array.isArray(value)) {
      return Array.from(new Set(value.map((v) => normalizeOptionalText(v)).filter(Boolean)));
    }
    const one = normalizeOptionalText(value);
    return one ? [one] : [];
  };
  const formScalarMeta = (value) => normalizeOptionalTextArray(value)[0];
  const formatStockQty = (value) => {
    const numeric = Number(value) || 0;
    return Number.isInteger(numeric)
      ? numeric.toLocaleString()
      : numeric.toLocaleString(undefined, { maximumFractionDigits: 3 });
  };
  const deriveTrackInventoryValue = (item = {}, warehouseId = null) => (
    Boolean(
      warehouseId ||
      item?.default_bin_id ||
      Number(item?.opening_stock) > 0 ||
      Number(item?.opening_value) > 0 ||
      Number(item?.min_stock_level) > 0 ||
      Number(item?.max_stock_level) > 0
    )
  );
  const buildVariantAttributeSeedRows = ({
    variant,
    colorCode,
    sizeCode,
    packType
  } = {}) => (
    [
      { name: 'Variant', values: normalizeOptionalTextArray(variant) },
      { name: 'Colour', values: normalizeOptionalTextArray(colorCode) },
      { name: 'Size', values: normalizeOptionalTextArray(sizeCode) },
      { name: 'Pack Type', values: normalizeOptionalTextArray(packType) }
    ].filter((row) => row.values.length > 0)
  );
  const normalizeComparableValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeComparableValue(entry));
    }
    if (typeof value === 'object') {
      return Object.keys(value).sort().reduce((acc, key) => {
        acc[key] = normalizeComparableValue(value[key]);
        return acc;
      }, {});
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed || null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? Number(value) : null;
    }
    return value;
  };
  const buildComparableItemPayload = (payload = {}) => normalizeComparableValue({
    sku: payload.sku,
    name: payload.name,
    description: payload.description,
    image: payload.image,
    type: payload.type,
    category: payload.category,
    customFields: payload.customFields || {},
    unit: payload.unit,
    warehouseId: payload.warehouseId,
    costPrice: payload.costPrice,
    sellingPrice: payload.sellingPrice,
    mrp: payload.mrp,
    taxRate: payload.taxRate,
    brand: payload.brand,
    manufacturer: payload.manufacturer,
    itemGroup: payload.itemGroup,
    itemGroupId: payload.itemGroupId,
    minStockLevel: payload.minStockLevel,
    maxStockLevel: payload.maxStockLevel,
    barcode: payload.barcode,
    batchNumber: payload.batchNumber,
    openingStock: payload.openingStock,
    openingValue: payload.openingValue,
    defaultBinId: payload.defaultBinId,
    valuationMethod: payload.valuationMethod,
    weight: payload.weight,
    dimensions: payload.dimensions,
    hsnCode: payload.hsnCode,
    upc: payload.upc,
    ean: payload.ean,
    isbn: payload.isbn,
    mpn: payload.mpn,
    components: payload.components || []
  });

  const loadSkuRules = async () => {
    setSkuRulesLoading(true);
    try {
      const rules = await skuGeneratorService.listRules();
      const list = Array.isArray(rules) ? rules : [];
      setSkuRules(list);
      if (!selectedSkuRuleId) {
        const defaultRule = list.find((r) => !!r.is_default);
        if (defaultRule?.id) setSelectedSkuRuleId(defaultRule.id);
      }
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load SKU rules');
    } finally {
      setSkuRulesLoading(false);
    }
  };

  const showSkuGenerationError = (error) => {
    const err = error?.response?.data?.error || error?.message || 'Failed to generate SKU';
    const normalizedErr = String(err || '').toLowerCase();
    if (normalizedErr.includes('failed to allocate unique sku after multiple attempts')) {
      Modal.warning({
        title: 'SKU generation needs attention',
        width: 560,
        content: (
          <div style={{ marginTop: 8 }}>
            <p style={{ marginBottom: 8 }}>
              Could not generate a unique SKU with the current rule after several retries.
            </p>
            <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
              <li>Try selecting another SKU rule from the dropdown.</li>
              <li>Increase counter padding or change prefix tokens in Manage SKU Rules.</li>
              <li>If urgent, enter SKU manually and save.</li>
            </ul>
          </div>
        ),
        okText: 'Got it'
      });
      return;
    }

    Modal.error({
      title: 'SKU generation failed',
      content: err,
      okText: 'Close'
    });
  };

  const getVariantRowAttributeValue = (row = {}, aliases = []) => {
    const aliasSet = new Set((aliases || []).map((alias) => String(alias || '').trim().toLowerCase()).filter(Boolean));
    const attrs = row?.attributes && typeof row.attributes === 'object' ? row.attributes : {};
    const match = Object.entries(attrs).find(([key, value]) => (
      aliasSet.has(String(key || '').trim().toLowerCase()) &&
      String(value || '').trim()
    ));
    return match ? String(match[1]).trim() : '';
  };

  const buildSkuGenerationContext = (variantRow = null) => {
    const brandValue = form.getFieldValue('brand');
    const brandRow = brandOptions.find((b) => b.id === brandValue || b.name === brandValue);
    const brandName = brandRow?.name || brandValue || '';
    const itemName = form.getFieldValue('name') || '';
    const categoryName = form.getFieldValue('category') || '';
    const variantValue = getVariantRowAttributeValue(variantRow, ['variant', 'variant / packing', 'packing'])
      || formScalarMeta(form.getFieldValue('variant'))
      || '';
    const colorValue = getVariantRowAttributeValue(variantRow, ['colour', 'color', 'color code'])
      || formScalarMeta(form.getFieldValue('colorCode'))
      || '';
    const typeName = form.getFieldValue('type') || '';
    const sizeValue = getVariantRowAttributeValue(variantRow, ['size'])
      || formScalarMeta(form.getFieldValue('sizeCode'))
      || '';
    const packTypeValue = getVariantRowAttributeValue(variantRow, ['pack type', 'type'])
      || formScalarMeta(form.getFieldValue('packType'))
      || '';
    const manufacturerValue = form.getFieldValue('manufacturer');
    const manufacturerRow = manufacturerOptions.find((m) => m.id === manufacturerValue || m.name === manufacturerValue);
    const manufacturerName = manufacturerRow?.name || manufacturerValue || '';
    const unitValue = form.getFieldValue('unit');
    const unitRow = unitOptions.find((u) => u.id === unitValue || u.name === unitValue || u.symbol === unitValue);
    const unitLabel = unitRow?.symbol || unitRow?.name || unitValue || '';
    const warehouseId = variantRow?.warehouseId ?? form.getFieldValue('warehouseId');
    const warehouseRow = warehouses.find((w) => String(w.id) === String(warehouseId));
    const warehouseLabel = warehouseRow?.code || warehouseRow?.name || warehouseId || '';
    const hsnCode = form.getFieldValue('hsnCode') || '';
    const mpn = form.getFieldValue('mpn') || '';
    const barcode = variantRow?.barcode || form.getFieldValue('barcode') || form.getFieldValue('ean') || '';

    return {
      ruleId: selectedSkuRuleId || undefined,
      category: categoryName,
      brand: brandName,
      manufacturer: manufacturerName,
      name: itemName,
      item: itemName,
      variant: variantValue,
      color: colorValue,
      type: packTypeValue || typeName,
      unit: unitLabel,
      warehouse: warehouseLabel,
      hsnCode,
      mpn,
      barcode,
      brandCode: toSkuCode(brandName, 3),
      itemCode: toSkuCode(itemName, 4),
      variantCode: toSkuCode(variantValue, 4),
      colorCode: toSkuCode(colorValue, 4),
      categoryCode: toSkuCode(categoryName, 3),
      manufacturerCode: toSkuCode(manufacturerName, 3),
      typeCode: toSkuCode(packTypeValue || typeName, 3),
      unitCode: toSkuCode(unitLabel, 4),
      warehouseCode: toSkuCode(warehouseLabel, 4),
      size: toSkuCode(sizeValue || unitLabel, 8),
      typeValue: packTypeValue || typeName
    };
  };

  const ensureSkuRuleRequirements = (selectedRule, ctx, actionLabel = 'Generate SKU') => {
    if (!(selectedRule?.prefix_mode === 'static' && String(selectedRule?.prefix_static || '').includes('{'))) {
      return true;
    }

    const tokenRequirements = {
      BRAND: { label: 'Brand', value: ctx.brand },
      ITEM: { label: 'Item Name', value: ctx.name || ctx.item },
      NAME: { label: 'Item Name', value: ctx.name || ctx.item },
      VARIANT: { label: 'Variant / Packing', value: ctx.variant },
      COLOR: { label: 'Colour', value: ctx.color },
      SIZE: { label: 'Size (or Unit)', value: ctx.size || ctx.unit },
      TYPE: { label: 'Pack Type', value: ctx.typeValue || ctx.type },
      CATEGORY: { label: 'Category', value: ctx.category },
      MANUFACTURER: { label: 'Manufacturer', value: ctx.manufacturer },
      UNIT: { label: 'Unit', value: ctx.unit },
      WAREHOUSE: { label: 'Warehouse', value: ctx.warehouse },
      HSN: { label: 'HSN Code', value: ctx.hsnCode },
      MPN: { label: 'MPN', value: ctx.mpn },
      BARCODE: { label: 'Barcode / EAN', value: ctx.barcode }
    };

    const missingFields = extractSkuTemplateTokens(selectedRule.prefix_static)
      .map((token) => tokenRequirements[token])
      .filter((requirement) => requirement && !String(requirement.value || '').trim())
      .map((requirement) => requirement.label);

    const uniqueMissing = Array.from(new Set(missingFields));
    if (uniqueMissing.length === 0) return true;

    Modal.warning({
      title: 'Required fields missing for selected SKU rule',
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ marginBottom: 8 }}>
            Fill these fields first, then click {actionLabel}:
          </p>
          <ul style={{ paddingLeft: 18, marginBottom: 0 }}>
            {uniqueMissing.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      ),
      okText: 'Understood'
    });
    return false;
  };

  // Handler for the "Generate" button next to the SKU field. Pulls the
  // current category/brand/name off the form so the resolver can pick the
  // correct category-scoped rule if one exists.
  const handleGenerateSku = async () => {
    setSkuGenerating(true);
    try {
      const selectedRule = selectedSkuRuleId
        ? skuRules.find((r) => r.id === selectedSkuRuleId) || null
        : null;
      const ctx = buildSkuGenerationContext();

      if (!ensureSkuRuleRequirements(selectedRule, ctx, 'Generate SKU')) return;

      const generated = await skuGeneratorService.generateSku(ctx);
      const sku = generated?.sku || '';
      if (sku) {
        form.setFieldsValue({ sku });
        form.validateFields(['sku']).catch(() => {});
        const appliedRule = generated?.ruleId
          ? skuRules.find((r) => r.id === generated.ruleId)
          : null;
        setLastAppliedSkuRule(
          appliedRule
            ? { id: appliedRule.id, name: appliedRule.name, scope: appliedRule.scope, scopeValue: appliedRule.scope_value }
            : null
        );
        message.success(`Generated SKU: ${sku}${generated?.ruleName ? ` (Rule: ${generated.ruleName})` : ''}`);
      }
    } catch (e) {
      showSkuGenerationError(e);
    } finally {
      setSkuGenerating(false);
    }
  };

  const validateSkuAvailability = async (_, value) => {
    const sku = String(value || '').trim();
    if (!sku) return Promise.reject(new Error('Please input SKU!'));
    try {
      const res = await apiService.get('/items/check-sku', {
        params: {
          sku,
          excludeItemId: editingItem?.id || undefined
        }
      });
      const available = !!res?.data?.available;
      if (!available) {
        return Promise.reject(new Error('SKU already exists. Please use a unique SKU.'));
      }
      return Promise.resolve();
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed to validate SKU';
      return Promise.reject(new Error(msg));
    }
  };

  const insertSkuToken = (token) => {
    const current = skuRuleForm.getFieldValue('prefixStatic') || '';
    const next = current ? `${current}-${token}` : token;
    skuRuleForm.setFieldsValue({ prefixStatic: next });
  };

  const openSkuRulesModal = async () => {
    setEditingSkuRule(null);
    skuRuleForm.resetFields();
    setSkuRulesOpen(true);
    await loadSkuRules();
  };

  const DERIVED_TOKEN_BY_SOURCE = {
    category: 'CATEGORY',
    brand: 'BRAND',
    name: 'ITEM',
    variant: 'VARIANT',
    color: 'COLOR',
    size: 'SIZE',
    type: 'TYPE',
    manufacturer: 'MANUFACTURER',
    unit: 'UNIT',
    warehouse: 'WAREHOUSE',
    hsn: 'HSN',
    mpn: 'MPN',
    barcode: 'BARCODE'
  };
  const SOURCE_BY_DERIVED_TOKEN = Object.fromEntries(
    Object.entries(DERIVED_TOKEN_BY_SOURCE).map(([source, token]) => [token, source])
  );
  const DERIVED_SOURCE_LABELS = {
    category: 'Category',
    brand: 'Brand',
    name: 'Item name',
    variant: 'Variant',
    color: 'Colour',
    size: 'Size',
    type: 'Pack Type',
    manufacturer: 'Manufacturer',
    unit: 'Unit',
    warehouse: 'Warehouse',
    hsn: 'HSN',
    mpn: 'MPN',
    barcode: 'Barcode'
  };
  const DERIVED_SOURCE_OPTIONS = Object.keys(DERIVED_TOKEN_BY_SOURCE).map((key) => ({
    value: key,
    label: DERIVED_SOURCE_LABELS[key] || key
  }));
  const DEFAULT_DERIVED_CFG = { len: 3, mode: 'abbr' };
  const buildDefaultDerivedConfig = () => Object.fromEntries(
    Object.keys(DERIVED_TOKEN_BY_SOURCE).map((src) => [src, { ...DEFAULT_DERIVED_CFG }])
  );
  const preserveSelectionOrder = (previous = [], current = []) => {
    const prev = Array.isArray(previous) ? previous : [];
    const cur = Array.isArray(current) ? current : [];
    const inBoth = prev.filter((x) => cur.includes(x));
    const appended = cur.filter((x) => !inBoth.includes(x));
    return [...inBoth, ...appended];
  };

  const parseDerivedTemplateConfig = (prefixStatic = '') => {
    const matches = String(prefixStatic || '').match(/\{[^}]+\}/g) || [];
    if (!matches.length) return null;
    const sources = [];
    const config = {};
    for (const tokenWrap of matches) {
      const inside = tokenWrap.slice(1, -1);
      const [tokenRaw, lenRaw, modeRaw] = inside.split('|').map((p) => String(p || '').trim());
      const token = String(tokenRaw || '').toUpperCase();
      const src = SOURCE_BY_DERIVED_TOKEN[token];
      if (!src) return null;
      sources.push(src);
      config[src] = {
        len: Math.max(1, Number(lenRaw) || 3),
        mode: ['abbr', 'slice'].includes(String(modeRaw || '').toLowerCase()) ? String(modeRaw).toLowerCase() : 'abbr'
      };
    }
    return { sources, config };
  };

  const startEditSkuRule = (rule) => {
    const parsedDerived = rule.prefix_mode === 'static'
      ? parseDerivedTemplateConfig(rule.prefix_static)
      : null;
    const effectivePrefixMode = parsedDerived ? 'derived' : rule.prefix_mode;
    const effectiveSources = parsedDerived
      ? parsedDerived.sources
      : (rule.prefix_source ? [rule.prefix_source] : []);
    setEditingSkuRule(rule);
    skuRuleForm.setFieldsValue({
      name: rule.name,
      scope: rule.scope,
      scopeValue: rule.scope_value,
      prefixMode: effectivePrefixMode,
      prefixStatic: rule.prefix_static,
      prefixSources: effectiveSources,
      prefixSourceConfig: { ...buildDefaultDerivedConfig(), ...(parsedDerived?.config || {}) },
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
      prefixSources: ['name'],
      prefixSourceConfig: buildDefaultDerivedConfig(),
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
      const sourceList = Array.isArray(values.prefixSources) ? values.prefixSources.filter(Boolean) : [];
      const cfg = values.prefixSourceConfig || {};
      const payload = {
        ...values,
        // Category rules cannot be marked as default.
        isDefault: values.scope === 'default' ? !!values.isDefault : false,
        // Keep counter start aligned with backend validation.
        counterStart: Math.max(1, Number(values.counterStart || 1)),
      };
      if (values.prefixMode === 'derived') {
        // Persist derived customization as static template tokens with modifiers:
        // e.g. {BRAND|3|abbr}-{ITEM|4|slice}
        payload.prefixMode = 'static';
        payload.prefixSource = null;
        payload.prefixStatic = sourceList
          .map((s) => {
            const token = DERIVED_TOKEN_BY_SOURCE[s];
            if (!token) return null;
            const c = cfg[s] || DEFAULT_DERIVED_CFG;
            const len = Math.max(1, Number(c?.len) || 3);
            const mode = String(c?.mode || 'abbr').toLowerCase() === 'slice' ? 'slice' : 'abbr';
            return `{${token}|${len}|${mode}}`;
          })
          .filter(Boolean)
          .join('-');
      } else {
        payload.prefixSource = null;
      }
      delete payload.prefixSources;
      delete payload.prefixSourceConfig;
      if (editingSkuRule) {
        await skuGeneratorService.updateRule(editingSkuRule.id, payload);
        message.success('SKU rule updated');
      } else {
        await skuGeneratorService.createRule(payload);
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
  const canViewItems = user?.permissions?.item_view || user?.permissions?.all;
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

  const handleInlineAddItemType = async () => {
    const raw = prompt('Enter new item type:');
    if (!raw?.trim()) return;
    const name = raw.trim().toLowerCase();
    if (itemTypes.some(t => t.name === name)) {
      message.info('Item type already in the list');
      form.setFieldsValue({ type: name });
      return;
    }
    try {
      const response = await apiService.post('/item-types', { name });
      if (response?.success && response.data?.typeId) {
        setItemTypes(prev => [...prev, { id: response.data.typeId, name, is_active: true }]);
        form.setFieldsValue({ type: name });
        message.success('Item type added');
      }
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to add item type');
    }
  };

  const handleDeleteItemType = async (typeId, typeName) => {
    if (!canManageItems) return;
    try {
      await apiService.delete(`/item-types/${typeId}`);
      setItemTypes(prev => prev.filter(t => t.id !== typeId));
      if (form.getFieldValue('type') === typeName) {
        form.setFieldsValue({ type: 'simple' });
      }
      message.success(`Item type '${typeName}' deleted`);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to delete item type');
    }
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    if (!canManageCategories) return;
    try {
      await apiService.delete(`/categories/${categoryId}`);
      setCategories(prev => prev.filter(c => c.id !== categoryId));
      if (form.getFieldValue('category') === categoryName) {
        form.setFieldsValue({ category: undefined });
      }
      message.success(`Category '${categoryName}' deleted`);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to delete category');
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
    { title: 'Item Group', dataIndex: 'item_group_name', key: 'item_group_name', render: v => v ? <Tag color="purple" style={{ borderRadius: 20 }}>{v}</Tag> : '-' },
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
        apiService.get('/vendors'),
        canViewItems ? apiService.get('/item-types') : Promise.resolve({ success: true, data: [] }),
        canViewItems ? apiService.get('/item-groups') : Promise.resolve({ success: true, data: [] }),
        canViewItems ? apiService.get('/items/variant-library') : Promise.resolve({ success: true, data: [] })
      ]);
      
      const [manufacturersRes, brandsRes, unitsRes, vendorsRes, itemTypesRes, itemGroupsRes, variantLibraryRes] = results;
      
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

      if (itemTypesRes.status === 'fulfilled') {
        const types = Array.isArray(itemTypesRes.value) ? itemTypesRes.value : (itemTypesRes.value?.data || []);
        setItemTypes(types);
      }

      if (itemGroupsRes.status === 'fulfilled') {
        const groups = Array.isArray(itemGroupsRes.value) ? itemGroupsRes.value : (itemGroupsRes.value?.data || []);
        setItemGroups(groups);
      }

      if (variantLibraryRes.status === 'fulfilled') {
        const library = Array.isArray(variantLibraryRes.value) ? variantLibraryRes.value : (variantLibraryRes.value?.data || []);
        setVariantLibrary(Array.isArray(library) ? library : []);
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

  const fetchItemWarehouseSummaries = useCallback(async (itemId) => {
    if (!itemId) {
      setEditingWarehouseSummaries([]);
      return [];
    }

    try {
      const response = await apiService.get(`/inventory/item-activity/${itemId}`);
      const summaries = response.success && Array.isArray(response.data) ? response.data : [];
      setEditingWarehouseSummaries(summaries);
      return summaries;
    } catch (error) {
      console.log('Warehouse stock summary unavailable for item edit', error);
      setEditingWarehouseSummaries([]);
      return [];
    }
  }, []);

  const warehouseSelectOptions = useMemo(() => {
    const merged = new Map();

    warehouses.forEach((warehouse) => {
      merged.set(warehouse.id, {
        ...warehouse,
        stock: null
      });
    });

    editingWarehouseSummaries.forEach((summary) => {
      const existing = merged.get(summary.warehouse_id) || {
        id: summary.warehouse_id,
        name: summary.warehouse_name || summary.warehouse_id,
        code: null,
        status: 'active'
      };

      merged.set(summary.warehouse_id, {
        ...existing,
        name: existing.name || summary.warehouse_name || summary.warehouse_id,
        stock: {
          available: Number(summary?.current_stock?.quantity_available || 0),
          onHand: Number(summary?.current_stock?.quantity_on_hand || 0),
          reserved: Number(summary?.current_stock?.quantity_reserved || 0)
        }
      });
    });

    return Array.from(merged.values())
      .filter((warehouse) => warehouse.status === 'active' || warehouse.stock)
      .sort((left, right) => {
        const stockDiff = (Number(right.stock?.available || 0) - Number(left.stock?.available || 0));
        if (stockDiff !== 0) return stockDiff;
        return String(left.name || '').localeCompare(String(right.name || ''));
      });
  }, [warehouses, editingWarehouseSummaries]);

  const fetchItems = async () => {
    let itemsLoaded = false;
    try {
      setLoading(true);
      
      // Stagger API calls to prevent 429 errors
      try {
        const itemsResponse = await apiService.get('/items', { params: { status: 'all' } });
        if (itemsResponse.success) {
          setItems(itemsResponse.data);
          itemsLoaded = true;
        }
      } catch (error) {
        if (error?.isPermissionError) {
          message.error('You do not have permission to view items');
          return;
        }
        throw error;
      }
      
      // Add small delay before next request
      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const warehousesResponse = await apiService.get('/warehouses', { params: { status: 'all' } });
        if (warehousesResponse.success) {
          setWarehouses(warehousesResponse.data);
        }
      } catch (error) {
        // Fallback: item users may not have warehouse_view but still need selectable warehouse list.
        try {
          const accessibleWarehousesResponse = await apiService.get('/warehouses/accessible');
          if (accessibleWarehousesResponse.success) {
            setWarehouses(accessibleWarehousesResponse.data || []);
          }
        } catch {
          console.log('Warehouse list unavailable for this user, continuing without warehouses');
        }
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
      if (!itemsLoaded) {
        message.error('Failed to fetch data');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const isEditing = !!editingItem;
      console.log('Form values:', values);
      const itemType = values.type || itemTypes.find(t => t.name === 'simple')?.name || itemTypes[0]?.name || 'simple';
      const normalizedVariantAttributes = normalizeVariantAttributes(values.variantAttributes);
      const normalizedVariantMatrix = normalizeVariantMatrixRows(variantMatrixRows);
      const isVariantType = itemType === 'variant';
      const defaultVariantWarehouseId = normalizedVariantMatrix.find((row) => row.warehouseId)?.warehouseId || null;

      if (!isVariantType && (Number(values.openingStock) || 0) > 0 && !values.warehouseId) {
        message.error('Please select Warehouse when opening stock is greater than 0.');
        return;
      }
      if (isVariantType) {
        const stockRowMissingWarehouse = normalizedVariantMatrix.find(
          (row) => (Number(row.openingStock) || 0) > 0 && !row.warehouseId
        );
        if (stockRowMissingWarehouse) {
          message.error(`Select a warehouse for variant "${stockRowMissingWarehouse.combinationLabel}" before saving stock.`);
          return;
        }
      }
      
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
        type: itemType,
        category: values.category,
        customFields: {
          ...(existingCustomFields || {}),
          variantAttributes: normalizedVariantAttributes,
          variantMatrix: normalizedVariantMatrix,
          skuMeta: {
            ...((existingCustomFields || {}).skuMeta || {}),
            color: normalizeOptionalTextArray(values.colorCode),
            size: normalizeOptionalTextArray(values.sizeCode),
            packType: normalizeOptionalTextArray(values.packType)
          }
        },
        unit: values.unit,
        warehouseId: isVariantType ? defaultVariantWarehouseId : values.warehouseId,
        costPrice: values.costPrice != null && values.costPrice !== '' ? convertPrice(values.costPrice, priceCurrency, 'USD') : 0,
        sellingPrice: values.sellingPrice != null && values.sellingPrice !== '' ? convertPrice(values.sellingPrice, priceCurrency, 'USD') : 0,
        mrp: values.mrp ? convertPrice(values.mrp, priceCurrency, 'USD') : null,
        taxRate: values.taxRate,
        brand: values.brand,
        manufacturer: values.manufacturer,
        itemGroupId: values.itemGroupId || null,
        itemGroup: itemGroups.find((group) => group.id === values.itemGroupId)?.name || null,
        minStockLevel: values.minStockLevel,
        maxStockLevel: values.maxStockLevel,
        barcode: values.barcode,
        batchNumber: values.batchNumber?.trim().toUpperCase() || null,
        openingStock: isVariantType ? 0 : (values.openingStock || 0),
        openingValue: isVariantType ? 0 : (values.openingValue || 0),
        defaultBinId: isVariantType ? null : (values.defaultBinId || null),
        valuationMethod: values.valuationMethod,
        weight: values.weight,
        dimensions: dimensions,
        hsnCode: values.hsnCode,
        upc: values.upc,
        ean: values.ean,
        isbn: values.isbn,
        mpn: values.mpn
      };
      if (itemData.type === 'composite') {
        const normalizedComponents = normalizeCompositeComponents(compositeComponents);
        if (normalizedComponents.length === 0) {
          message.error('Add at least one BOM component for composite item.');
          return;
        }
        const duplicateSet = new Set(normalizedComponents.map((row) => row.itemId));
        if (duplicateSet.size !== normalizedComponents.length) {
          message.error('Duplicate component item is not allowed in BOM.');
          return;
        }
        if (editingItem?.id && normalizedComponents.some((row) => row.itemId === editingItem.id)) {
          message.error('Composite item cannot be added as its own component.');
          return;
        }
        itemData.components = normalizedComponents;
      }

      if (!isEditing && duplicateSourcePayload) {
        const comparableCurrent = JSON.stringify(buildComparableItemPayload(itemData));
        const comparableSource = JSON.stringify(duplicateSourcePayload);
        if (comparableCurrent === comparableSource) {
          message.error('This is an exact duplicate of the source item. Change at least one field before saving.');
          return;
        }
      }
      
      if (isEditing) {
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
      const normalizedVariantRows = normalizeVariantAttributes(values.variantAttributes);
      if (normalizedVariantRows.length > 0) {
        try {
          await apiService.post('/items/variant-library', { rows: normalizedVariantRows });
          await fetchDropdownOptions();
        } catch {
          // Keep item flow successful even if library save fails.
        }
      }
      // Clear only the draft being continued on successful save.
      if (activeDraftId) {
        try { await apiService.delete(`/items/draft/${activeDraftId}`); } catch {}
      }
      setDraftBanner(null);
      setActiveDraftId(null);
      if (isEditing) {
        setModalVisible(false);
        setEditingItem(null);
        setVariantMatrixEdits([]);
        setSelectedSkuRuleId(null);
        setLastAppliedSkuRule(null);
        form.resetFields();
      } else {
        // Keep form open for rapid multi-item entry.
        setImageUrl('');
        setImageFile(null);
        setDuplicateBanner(null);
        setDuplicateSourcePayload(null);
        setExistingCustomFields({});
        setVariantMatrixEdits([]);
        setCompositeComponents([]);
        setSelectedSkuRuleId(null);
        setLastAppliedSkuRule(null);
        form.resetFields();
        form.setFieldsValue({
          type: itemTypes.find(t => t.name === 'simple')?.name || itemTypes[0]?.name || 'simple',
          itemGroupId: null,
          purchaseAccount: 'cogs',
          purchaseTaxRate: 0,
          purchaseDescription: 'Initial stock entry'
        });
      }
      fetchItems();
    } catch (error) {
      console.error('Submit error:', error);
      const rawError =
        error?.response?.data?.error ||
        error?.message ||
        '';
      const normalizedError = String(rawError).toLowerCase();

      let userMessage = rawError || `Failed to ${editingItem ? 'update' : 'create'} item`;

      if (normalizedError.includes('duplicate') || normalizedError.includes('already exists')) {
        userMessage = rawError || 'Duplicate item found. Please use a unique SKU.';
      } else if (normalizedError.includes('er_dup_entry') || normalizedError.includes('unique_tenant_sku')) {
        userMessage = 'Item with this SKU already exists. Please enter a unique SKU.';
      }

      message.error(userMessage);
    }
  };

  const handlePriceCurrencyChange = (nextCurrency) => {
    const currentCurrency = priceCurrency;
    if (!nextCurrency || nextCurrency === currentCurrency) return;

    const currentValues = form.getFieldsValue([
      'costPrice',
      'sellingPrice',
      'mrp',
      'openingValue',
      'openingStock'
    ]);

    const converted = {
      costPrice: currentValues.costPrice != null ? convertPrice(currentValues.costPrice, currentCurrency, nextCurrency) : currentValues.costPrice,
      sellingPrice: currentValues.sellingPrice != null ? convertPrice(currentValues.sellingPrice, currentCurrency, nextCurrency) : currentValues.sellingPrice,
      mrp: currentValues.mrp != null ? convertPrice(currentValues.mrp, currentCurrency, nextCurrency) : currentValues.mrp,
      openingValue: currentValues.openingValue != null ? convertPrice(currentValues.openingValue, currentCurrency, nextCurrency) : currentValues.openingValue,
    };

    // Prefer recomputing opening value from stock x cost after conversion.
    if (currentValues.openingStock > 0 && converted.costPrice > 0) {
      converted.openingValue = Math.round((currentValues.openingStock * converted.costPrice) * 100) / 100;
    }

    form.setFieldsValue(converted);
    setPriceCurrency(nextCurrency);
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
        params: { warehouseId, status: 'all', limit: 1000 }
      });
      const bins = res.success ? (res.data || []) : [];

      // Fallback: some setups return sparse results on /bins filters; hierarchy is authoritative.
      if (bins.length === 0) {
        const hierarchyRes = await apiService.get(`/warehouse-locations/warehouses/${warehouseId}/hierarchy`);
        const hierarchyBins = hierarchyRes.success
          ? (hierarchyRes.data || []).flatMap(z => (z.racks || []).flatMap(r => r.bins || []))
          : [];
        setBinsForWarehouse(hierarchyBins);
        if (hierarchyBins.length === 0) {
          message.info('No bins found for selected warehouse. Please create bins in Warehouse Locations.');
        }
      } else {
        setBinsForWarehouse(bins);
      }
    } catch (error) {
      setBinsForWarehouse([]);
      message.error(error?.response?.data?.error || 'Failed to load bins for selected warehouse');
    } finally {
      setBinsLoading(false);
    }
  };

  const editItem = async (item) => {
    setEditingItem(item);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setPriceCurrency(currency);
    setImageUrl(item.image || '');
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    
    await fetchDropdownOptions();
    await loadSkuRules();
    
    let fullItem = item;
    let warehouseSummaries = [];
    const [itemResponse, warehouseSummaryResponse] = await Promise.allSettled([
      apiService.get(`/items/${item.id}`),
      fetchItemWarehouseSummaries(item.id)
    ]);
    if (itemResponse.status === 'fulfilled' && itemResponse.value.success) {
      fullItem = itemResponse.value.data;
    } else if (itemResponse.status === 'rejected') {
      console.error('Failed to fetch full item details:', itemResponse.reason);
    }
    if (warehouseSummaryResponse.status === 'fulfilled' && Array.isArray(warehouseSummaryResponse.value)) {
      warehouseSummaries = warehouseSummaryResponse.value;
    }
    setExistingCustomFields(fullItem?.custom_fields || {});
    setVariantMatrixEdits(
      Array.isArray(fullItem?.variant_rows) && fullItem.variant_rows.length > 0
        ? normalizeVariantRowsForEdit(fullItem.variant_rows)
        : (Array.isArray(fullItem?.custom_fields?.variantMatrix) ? fullItem.custom_fields.variantMatrix : [])
    );
    setCompositeComponents(normalizeCompositeComponents(fullItem?.composite_components || []));

    // Get warehouse from item's inventory projections first.
    // If the item has no stock projection yet, fall back to the warehouse owning
    // the saved default bin so the edit form still pre-fills correctly.
    let finalWarehouseId = null;
    if (fullItem.warehouse_ids?.length > 0) {
      finalWarehouseId = fullItem.warehouse_ids[0] || null;
    } else if (fullItem.default_bin_id) {
      try {
        const binResponse = await apiService.get(`/warehouse-locations/bins/${fullItem.default_bin_id}`);
        if (binResponse.success) {
          finalWarehouseId = binResponse.data?.warehouse_id || null;
        }
      } catch { /* no warehouse found from default bin */ }
    } else if (warehouseSummaries.length > 0) {
      const best = warehouseSummaries.reduce((currentBest, row) => (
        Number(row?.current_stock?.quantity_available || 0) > Number(currentBest?.current_stock?.quantity_available || 0)
          ? row
          : currentBest
      ), warehouseSummaries[0]);
      finalWarehouseId = best?.warehouse_id || null;
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
      description: normalizeOptionalText(fullItem.description),
      type: fullItem.type,
      trackInventory: deriveTrackInventoryValue(fullItem, finalWarehouseId),
      category: normalizeOptionalText(fullItem.category),
      unit: unitId,
      costPrice: convertPrice(fullItem.cost_price, 'USD', currency),
      sellingPrice: normalizeOptionalNumber(convertPrice(fullItem.selling_price, 'USD', currency), { allowZero: false }),
      mrp: normalizeOptionalNumber(convertPrice(fullItem.mrp, 'USD', currency), { allowZero: false }),
      taxRate: normalizeTaxRateForForm(fullItem.tax_rate),
      brand: brandId,
      manufacturer: manufacturerId,
      minStockLevel: normalizeOptionalNumber(fullItem.min_stock_level),
      maxStockLevel: normalizeOptionalNumber(fullItem.max_stock_level),
      barcode: normalizeOptionalText(fullItem.barcode),
      batchNumber: normalizeOptionalText(fullItem.batch_number)?.toUpperCase(),
      hsnCode: normalizeOptionalText(fullItem.hsn_code),
      itemGroupId: fullItem.item_group_id || null,
      colorCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.color),
      sizeCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.size),
      packType: formScalarMeta(fullItem?.custom_fields?.skuMeta?.packType),
      variantAttributes: expandVariantAttributesForForm(fullItem?.custom_fields?.variantAttributes),
      openingStock: normalizeOptionalNumber(fullItem.opening_stock),
      openingValue: normalizeOptionalNumber(fullItem.opening_value, { allowZero: false }),
      valuationMethod: fullItem.valuation_method,
      warehouseId: finalWarehouseId,
      defaultBinId: fullItem.default_bin_id || null,
      weight: normalizeOptionalNumber(fullItem.weight, { allowZero: false }),
      length: normalizeOptionalNumber(fullItem.dimensions?.length, { allowZero: false }),
      width: normalizeOptionalNumber(fullItem.dimensions?.width, { allowZero: false }),
      height: normalizeOptionalNumber(fullItem.dimensions?.height, { allowZero: false }),
      upc: normalizeOptionalText(fullItem.upc),
      ean: normalizeOptionalText(fullItem.ean),
      isbn: normalizeOptionalText(fullItem.isbn),
      mpn: normalizeOptionalText(fullItem.mpn)
    });
    fetchBinsForWarehouse(finalWarehouseId);
    setModalVisible(true);
  };

  const openPossibleDuplicateForEdit = async (item) => {
    if (!item) return;
    setDuplicateBanner(null);
    setDuplicateSourcePayload(null);
    setDraftBanner(null);
    setActiveDraftId(null);
    await editItem(item);
    message.info(`Opened "${item.name}" in edit mode.`);
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

  const normalizeTaxRateForForm = (value) => {
    if (value == null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    return numeric === 0 ? undefined : numeric;
  };

  const normalizeOptionalNumber = (value, { allowZero = true } = {}) => {
    if (value == null || value === '') return undefined;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    if (!allowZero && numeric === 0) return undefined;
    return numeric;
  };

  const expandVariantAttributesForForm = (attrs) => {
    if (!Array.isArray(attrs)) return [];
    return attrs.flatMap((a) => {
      const name = normalizeOptionalText(a?.name);
      let vals = [];
      if (Array.isArray(a?.values)) {
        vals = a.values.map((v) => normalizeOptionalText(v)).filter(Boolean);
      } else {
        const one = normalizeOptionalText(a?.values);
        if (one) vals = [one];
      }
      if (!name || !vals.length) return [];
      return [{ name, values: vals }];
    });
  };

  const normalizeVariantAttributes = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    const byName = new Map();
    for (const row of rows) {
      const name = normalizeOptionalText(row?.name);
      if (!name) continue;
      let rowVals = [];
      if (Array.isArray(row?.values)) {
        rowVals = row.values.map((v) => normalizeOptionalText(v)).filter(Boolean);
      } else {
        const one = normalizeOptionalText(row?.values);
        if (one) rowVals = [one];
      }
      if (!rowVals.length) continue;
      const prev = byName.get(name) || [];
      byName.set(name, Array.from(new Set([...prev, ...rowVals])));
    }
    return Array.from(byName.entries()).map(([name, values]) => ({ name, values }));
  };

  const normalizeVariantMatrixRows = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    return rows.map((row) => ({
      id: normalizeOptionalText(row?.id),
      key: String(row?.key || ''),
      combinationLabel: String(row?.combinationLabel || ''),
      attributes: row?.attributes && typeof row.attributes === 'object' ? row.attributes : {},
      sku: normalizeOptionalText(row?.sku),
      barcode: normalizeOptionalText(row?.barcode),
      costPrice: normalizeOptionalNumber(row?.costPrice),
      sellingPrice: normalizeOptionalNumber(row?.sellingPrice),
      openingStock: normalizeOptionalNumber(row?.openingStock),
      warehouseId: normalizeOptionalText(row?.warehouseId),
      active: row?.active !== false
    })).filter((row) => row.key && row.combinationLabel);
  };

  const toTitleText = (value) => String(value || '')
    .split(' ')
    .map((part) => {
      const trimmed = String(part || '').trim();
      return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : '';
    })
    .filter(Boolean)
    .join(' ');

  const getVariantAttributeTokens = (row = {}) => {
    const attrs = row?.attributes && typeof row.attributes === 'object' ? row.attributes : {};
    const entries = Object.entries(attrs)
      .filter(([key, value]) => key && key !== '_imsKey' && String(value || '').trim());

    if (entries.length > 0) {
      return entries.map(([key, value]) => ({
        label: toTitleText(key),
        value: String(value).trim()
      }));
    }

    const label = String(row?.combinationLabel || row?.variant_name || '').trim();
    if (!label) return [];

    return label
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => {
        const [left, ...rest] = segment.split(':');
        if (rest.length === 0) return { label: 'Variant', value: left.trim() };
        return {
          label: toTitleText(left),
          value: rest.join(':').trim()
        };
      });
  };

  const buildVariantMatrixKeyFromAttributes = (attributes = {}) => {
    if (!attributes || typeof attributes !== 'object') return '';
    const entries = Object.entries(attributes)
      .filter(([k, v]) => String(k || '').trim() && String(k || '').trim() !== '_imsKey' && String(v || '').trim())
      .sort(([a], [b]) => String(a).localeCompare(String(b)));
    if (!entries.length) return '';
    return entries.map(([k, v]) => `${k}:${v}`).join('|');
  };

  const normalizeVariantRowsForEdit = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => {
        const attrs = row?.attributes && typeof row.attributes === 'object' ? row.attributes : {};
        const keyFromAttrs = buildVariantMatrixKeyFromAttributes(attrs);
        const key = String(attrs?._imsKey || keyFromAttrs || row?.key || row?.id || '').trim();
        return {
          ...row,
          id: row?.id || null,
          key
        };
      })
      .filter((row) => row.key);
  };

  const normalizeCompositeComponents = (rows = []) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((row) => ({
        itemId: String(row?.itemId || row?.component_item_id || '').trim(),
        quantityRequired: Number(row?.quantityRequired ?? row?.quantity_required),
        consumptionTiming: String(row?.consumptionTiming || row?.consumption_timing || 'shipment').toLowerCase()
      }))
      .filter((row) => row.itemId && Number.isFinite(row.quantityRequired) && row.quantityRequired > 0)
      .map((row) => ({
        ...row,
        consumptionTiming: ['order', 'shipment'].includes(row.consumptionTiming) ? row.consumptionTiming : 'shipment'
      }));
  };

  const cartesianVariantRows = (rows = []) => {
    const normalized = normalizeVariantAttributes(rows);
    if (normalized.length === 0) return [];

    const recurse = (idx, acc, labels) => {
      if (idx >= normalized.length) {
        const key = Object.entries(acc).map(([k, v]) => `${k}:${v}`).join('|');
        return [{ key, attributes: { ...acc }, combinationLabel: labels.join(' / ') }];
      }
      const current = normalized[idx];
      return current.values.flatMap((value) =>
        recurse(
          idx + 1,
          { ...acc, [current.name]: value },
          [...labels, `${String(current.name || '').trim()}: ${String(value)}`]
        )
      );
    };

    return recurse(0, {}, []);
  };

  const watchedVariantAttributes = Form.useWatch('variantAttributes', form);
  const watchedItemType = Form.useWatch('type', form);
  const watchedItemGroupId = Form.useWatch('itemGroupId', form);
  const watchedSku = Form.useWatch('sku', form);
  const watchedName = Form.useWatch('name', form);
  const watchedBarcode = Form.useWatch('barcode', form);
  const watchedBatchNumber = Form.useWatch('batchNumber', form);
  const watchedVariant = Form.useWatch('variant', form);
  const watchedColor = Form.useWatch('colorCode', form);
  const watchedSize = Form.useWatch('sizeCode', form);
  const watchedPackType = Form.useWatch('packType', form);
  const watchedTrackInventory = Form.useWatch('trackInventory', form) === true;
  const isVariantItem = watchedItemType === 'variant';

  const possibleDuplicateItems = useMemo(() => {
    if (!modalVisible || editingItem) return [];

    const skuKey = normalizeDuplicateLookup(watchedSku);
    const nameKey = normalizeDuplicateLookup(watchedName);
    const barcodeKey = normalizeDuplicateLookup(watchedBarcode);
    const batchKey = normalizeDuplicateLookup(watchedBatchNumber);

    if (!skuKey && !nameKey && !barcodeKey && !batchKey) return [];

    return (items || [])
      .map((item) => {
        if (!item?.id) return null;

        const reasons = [];
        if (skuKey && normalizeDuplicateLookup(item.sku) === skuKey) reasons.push('Same SKU');
        if (nameKey && normalizeDuplicateLookup(item.name) === nameKey) reasons.push('Same name');
        if (barcodeKey && normalizeDuplicateLookup(item.barcode) === barcodeKey) reasons.push('Same barcode');
        if (batchKey && normalizeDuplicateLookup(item.batch_number) === batchKey) reasons.push('Same batch number');
        if (reasons.length === 0) return null;

        return {
          ...item,
          duplicateReasons: reasons,
          duplicateScore: reasons.length
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        if (right.duplicateScore !== left.duplicateScore) return right.duplicateScore - left.duplicateScore;
        if ((left.status === 'active') !== (right.status === 'active')) return left.status === 'active' ? -1 : 1;
        return String(left.name || '').localeCompare(String(right.name || ''), undefined, { sensitivity: 'base', numeric: true });
      })
      .slice(0, 5);
  }, [modalVisible, editingItem, items, watchedSku, watchedName, watchedBarcode, watchedBatchNumber]);

  const selectableItemGroups = useMemo(() => (
    (itemGroups || [])
      .filter((group) => group?.is_active || group?.id === watchedItemGroupId)
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))
  ), [itemGroups, watchedItemGroupId]);

  useEffect(() => {
    if (watchedItemType !== 'composite' && compositeComponents.length > 0) {
      setCompositeComponents([]);
    }
  }, [watchedItemType]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!modalVisible) {
      variantBuilderSeededRef.current = false;
      return;
    }
    if (watchedItemType !== 'variant') {
      variantBuilderSeededRef.current = false;
      return;
    }
    const currentRows = normalizeVariantAttributes(form.getFieldValue('variantAttributes'));
    if (currentRows.length > 0) {
      variantBuilderSeededRef.current = true;
      return;
    }
    if (variantBuilderSeededRef.current) return;

    const seedRows = buildVariantAttributeSeedRows({
      variant: form.getFieldValue('variant'),
      colorCode: form.getFieldValue('colorCode'),
      sizeCode: form.getFieldValue('sizeCode'),
      packType: form.getFieldValue('packType')
    });

    if (seedRows.length === 0) return;

    form.setFieldsValue({ variantAttributes: seedRows });
    variantBuilderSeededRef.current = true;
  }, [modalVisible, watchedItemType, watchedVariant, watchedColor, watchedSize, watchedPackType]); // eslint-disable-line react-hooks/exhaustive-deps

  const variantMatrixRows = useMemo(() => {
    if (watchedItemType !== 'variant') return [];
    let sourceAttributes = normalizeVariantAttributes(watchedVariantAttributes);
    if (sourceAttributes.length === 0) {
      const fallback = [];
      const variantVals = normalizeOptionalTextArray(watchedVariant);
      const colorVals = normalizeOptionalTextArray(watchedColor);
      const sizeVals = normalizeOptionalTextArray(watchedSize);
      const packVals = normalizeOptionalTextArray(watchedPackType);
      if (variantVals.length) fallback.push({ name: 'Variant', values: variantVals });
      if (colorVals.length) fallback.push({ name: 'Colour', values: colorVals });
      if (sizeVals.length) fallback.push({ name: 'Size', values: sizeVals });
      if (packVals.length) fallback.push({ name: 'Pack Type', values: packVals });
      sourceAttributes = fallback;
    }

    const combos = cartesianVariantRows(sourceAttributes);
    if (combos.length === 0) return [];

    return combos.map((combo) => {
      const edited = variantMatrixEdits.find((r) => r.key === combo.key) || {};
      return {
        ...combo,
        id: edited.id || null,
        sku: edited.sku,
        barcode: edited.barcode,
        costPrice: edited.costPrice,
        sellingPrice: edited.sellingPrice,
        openingStock: edited.openingStock,
        warehouseId: edited.warehouseId,
        active: edited.active !== false
      };
    });
  }, [watchedItemType, watchedVariantAttributes, watchedVariant, watchedColor, watchedSize, watchedPackType, variantMatrixEdits]);

  const updateVariantMatrixRow = (key, patch) => {
    setVariantMatrixEdits((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return [...prev, { key, ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const updateAllVariantMatrixRows = (patchOrFactory) => {
    if (!variantMatrixRows.length) return false;
    setVariantMatrixEdits((prev) => {
      const byKey = new Map(prev.map((row) => [row.key, { ...row }]));
      variantMatrixRows.forEach((row) => {
        const patch = typeof patchOrFactory === 'function' ? patchOrFactory(row) : patchOrFactory;
        if (!patch || Object.keys(patch).length === 0) return;
        byKey.set(row.key, { ...(byKey.get(row.key) || { key: row.key }), ...patch });
      });
      return Array.from(byKey.values());
    });
    return true;
  };

  const copyVariantFieldFromFirstRow = (field, label, options = {}) => {
    const firstRow = variantMatrixRows[0];
    if (!firstRow) {
      message.warning('Add at least one variant row first.');
      return;
    }

    const value = firstRow[field];
    if (!options.allowBlank && isBlankVariantMatrixValue(value)) {
      message.warning(`Enter ${label} in the first row first.`);
      return;
    }

    if (updateAllVariantMatrixRows({ [field]: value })) {
      message.success(`${label} copied to all variants.`);
    }
  };

  const handleGenerateAllVariantSkus = async () => {
    if (!variantMatrixRows.length) {
      message.warning('Add at least one variant row first.');
      return;
    }

    setSkuGenerating(true);
    try {
      const selectedRule = selectedSkuRuleId
        ? skuRules.find((r) => r.id === selectedSkuRuleId) || null
        : null;
      const generatedRows = [];
      let appliedRuleMeta = null;

      for (const row of variantMatrixRows) {
        const ctx = buildSkuGenerationContext(row);
        if (!ensureSkuRuleRequirements(selectedRule, ctx, 'Generate all SKUs')) return;

        const generated = await skuGeneratorService.generateSku(ctx);
        const sku = generated?.sku || '';
        if (sku) {
          generatedRows.push({ key: row.key, sku });
        }

        if (!appliedRuleMeta && generated?.ruleId) {
          const appliedRule = skuRules.find((rule) => rule.id === generated.ruleId);
          if (appliedRule) {
            appliedRuleMeta = {
              id: appliedRule.id,
              name: appliedRule.name,
              scope: appliedRule.scope,
              scopeValue: appliedRule.scope_value
            };
          }
        }
      }

      if (!generatedRows.length) {
        message.warning('No SKUs were generated for the current variants.');
        return;
      }

      setVariantMatrixEdits((prev) => {
        const byKey = new Map(prev.map((row) => [row.key, { ...row }]));
        generatedRows.forEach((row) => {
          byKey.set(row.key, { ...(byKey.get(row.key) || { key: row.key }), sku: row.sku });
        });
        return Array.from(byKey.values());
      });

      if (appliedRuleMeta) {
        setLastAppliedSkuRule(appliedRuleMeta);
      }
      message.success(`Generated SKUs for ${generatedRows.length} variants.`);
    } catch (e) {
      showSkuGenerationError(e);
    } finally {
      setSkuGenerating(false);
    }
  };

  const variantLibraryNames = (variantLibrary || []).map((r) => r.name).filter(Boolean);
  const getVariantLibraryValues = (attributeName) => {
    const key = String(attributeName || '').trim().toLowerCase();
    if (!key) return [];
    const row = (variantLibrary || []).find((r) => String(r?.name || '').trim().toLowerCase() === key);
    return Array.isArray(row?.values) ? row.values : [];
  };
  const getVariantLibraryValuesByAliases = (aliases = []) => {
    const aliasSet = new Set((aliases || []).map((a) => String(a || '').trim().toLowerCase()).filter(Boolean));
    const merged = [];
    (variantLibrary || []).forEach((row) => {
      const name = String(row?.name || '').trim().toLowerCase();
      if (!aliasSet.has(name)) return;
      if (Array.isArray(row?.values)) merged.push(...row.values);
    });
    return Array.from(new Set(merged.map((v) => String(v || '').trim()).filter(Boolean)));
  };
  const findVariantLibraryNameByAliasesAndValue = (aliases = [], value = '') => {
    const aliasSet = new Set((aliases || []).map((a) => String(a || '').trim().toLowerCase()).filter(Boolean));
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) return null;
    const row = (variantLibrary || []).find((r) => {
      const nameMatch = aliasSet.has(String(r?.name || '').trim().toLowerCase());
      const valueMatch = Array.isArray(r?.values) && r.values.some((v) => String(v || '').trim() === normalizedValue);
      return nameMatch && valueMatch;
    });
    return row?.name || null;
  };

  const addVariantMetaValue = async (attributeName, aliases, fieldName) => {
    const raw = prompt(`Add ${attributeName} value:`);
    const value = String(raw || '').trim();
    if (!value) return;
    try {
      await apiService.put('/items/variant-library/entry', { name: aliases[0], values: [value] });
      await fetchDropdownOptions();
      form.setFieldsValue({ [fieldName]: value });
      message.success(`${attributeName} added`);
    } catch (e) {
      message.error(e?.response?.data?.error || `Failed to add ${attributeName}`);
    }
  };

  const deleteVariantMetaSpecificValue = async (attributeName, aliases, value, fieldName) => {
    const sourceName = findVariantLibraryNameByAliasesAndValue(aliases, value) || aliases[0];
    if (!window.confirm(`Delete ${attributeName} value "${value}"?`)) return;
    try {
      await apiService.delete('/items/variant-library/entry', { params: { name: sourceName, value } });
      await fetchDropdownOptions();
      const current = formScalarMeta(form.getFieldValue(fieldName));
      if (current && current === String(value || '').trim()) {
        form.setFieldsValue({ [fieldName]: undefined });
      }
      message.success(`${attributeName} deleted`);
    } catch (e) {
      message.error(e?.response?.data?.error || `Failed to delete ${attributeName}`);
    }
  };

  const saveVariantSetupForFuture = async () => {
    const rows = normalizeVariantAttributes(form.getFieldValue('variantAttributes'));
    if (!rows.length) {
      message.warning('Add variant attributes first to save for future use.');
      return;
    }
    try {
      await apiService.post('/items/variant-library', { rows });
      await fetchDropdownOptions();
      message.success('Variant setup saved for future use.');
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to save variant setup');
    }
  };

  const duplicateItem = async (item) => {
    setEditingItem(null);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setPriceCurrency(currency);
    setImageUrl(item.image || '');
    setImageFile(null);
    setDraftBanner(null);
    setDuplicateBanner({ sourceName: item.name });
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    form.resetFields();
    await fetchDropdownOptions();
    await loadSkuRules();

    let fullItem = item;
    try {
      const res = await apiService.get(`/items/${item.id}`);
      if (res.success) fullItem = res.data;
    } catch {}
    setExistingCustomFields(fullItem?.custom_fields || {});
    setVariantMatrixEdits(
      Array.isArray(fullItem?.variant_rows) && fullItem.variant_rows.length > 0
        ? normalizeVariantRowsForEdit(fullItem.variant_rows)
        : (Array.isArray(fullItem?.custom_fields?.variantMatrix) ? fullItem.custom_fields.variantMatrix : [])
    );
    setCompositeComponents(normalizeCompositeComponents(fullItem?.composite_components || []));

    let finalWarehouseId = null;
    if (fullItem.warehouse_ids?.length > 0) {
      finalWarehouseId = fullItem.warehouse_ids[0] || null;
    } else if (fullItem.default_bin_id) {
      try {
        const binResponse = await apiService.get(`/warehouse-locations/bins/${fullItem.default_bin_id}`);
        if (binResponse.success) {
          finalWarehouseId = binResponse.data?.warehouse_id || null;
        }
      } catch { /* no warehouse found from default bin */ }
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

    const duplicateFormValues = {
      sku: normalizeOptionalText(fullItem.sku),
      name: normalizeOptionalText(fullItem.name),
      description: normalizeOptionalText(fullItem.description),
      type: fullItem.type,
      trackInventory: deriveTrackInventoryValue(fullItem, finalWarehouseId),
      category: normalizeOptionalText(fullItem.category),
      unit: unitOptions.find(u => u.name === fullItem.unit)?.id ?? fullItem.unit,
      costPrice: convertPrice(fullItem.cost_price, 'USD', currency),
      sellingPrice: normalizeOptionalNumber(convertPrice(fullItem.selling_price, 'USD', currency), { allowZero: false }),
      mrp: normalizeOptionalNumber(convertPrice(fullItem.mrp, 'USD', currency), { allowZero: false }),
      taxRate: normalizeTaxRateForForm(fullItem.tax_rate),
      brand: brandOptions.find(b => b.name === fullItem.brand)?.id ?? fullItem.brand,
      manufacturer: manufacturerOptions.find(m => m.name === fullItem.manufacturer)?.id ?? fullItem.manufacturer,
      minStockLevel: normalizeOptionalNumber(fullItem.min_stock_level),
      maxStockLevel: normalizeOptionalNumber(fullItem.max_stock_level),
      barcode: normalizeOptionalText(fullItem.barcode),
      batchNumber: normalizeOptionalText(fullItem.batch_number)?.toUpperCase(),
      hsnCode: normalizeOptionalText(fullItem.hsn_code),
      itemGroupId: fullItem.item_group_id || null,
      colorCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.color),
      sizeCode: formScalarMeta(fullItem?.custom_fields?.skuMeta?.size),
      packType: formScalarMeta(fullItem?.custom_fields?.skuMeta?.packType),
      variantAttributes: expandVariantAttributesForForm(fullItem?.custom_fields?.variantAttributes),
      openingStock: normalizeOptionalNumber(fullItem.opening_stock),
      openingValue: normalizeOptionalNumber(fullItem.opening_value, { allowZero: false }),
      valuationMethod: fullItem.valuation_method,
      warehouseId: finalWarehouseId,
      defaultBinId: fullItem.default_bin_id || null,
      weight: normalizeOptionalNumber(fullItem.weight, { allowZero: false }),
      length: normalizeOptionalNumber(fullItem.dimensions?.length, { allowZero: false }),
      width: normalizeOptionalNumber(fullItem.dimensions?.width, { allowZero: false }),
      height: normalizeOptionalNumber(fullItem.dimensions?.height, { allowZero: false }),
      upc: normalizeOptionalText(fullItem.upc),
      ean: normalizeOptionalText(fullItem.ean),
      isbn: normalizeOptionalText(fullItem.isbn),
      mpn: normalizeOptionalText(fullItem.mpn),
    };

    const duplicateComparablePayload = buildComparableItemPayload({
      sku: duplicateFormValues.sku,
      name: duplicateFormValues.name,
      description: duplicateFormValues.description,
      image: fullItem.image || '',
      type: duplicateFormValues.type,
      category: duplicateFormValues.category,
      customFields: {
        ...(fullItem?.custom_fields || {}),
        variantAttributes: normalizeVariantAttributes(duplicateFormValues.variantAttributes),
        variantMatrix: normalizeVariantMatrixRows(
          Array.isArray(fullItem?.variant_rows) && fullItem.variant_rows.length > 0
            ? normalizeVariantRowsForEdit(fullItem.variant_rows)
            : (Array.isArray(fullItem?.custom_fields?.variantMatrix) ? fullItem.custom_fields.variantMatrix : [])
        ),
        skuMeta: {
          ...((fullItem?.custom_fields || {}).skuMeta || {}),
          color: normalizeOptionalTextArray(duplicateFormValues.colorCode),
          size: normalizeOptionalTextArray(duplicateFormValues.sizeCode),
          packType: normalizeOptionalTextArray(duplicateFormValues.packType)
        }
      },
      unit: duplicateFormValues.unit,
      warehouseId: duplicateFormValues.warehouseId,
      costPrice: duplicateFormValues.costPrice != null && duplicateFormValues.costPrice !== '' ? convertPrice(duplicateFormValues.costPrice, priceCurrency, 'USD') : 0,
      sellingPrice: duplicateFormValues.sellingPrice != null && duplicateFormValues.sellingPrice !== '' ? convertPrice(duplicateFormValues.sellingPrice, priceCurrency, 'USD') : 0,
      mrp: duplicateFormValues.mrp != null && duplicateFormValues.mrp !== '' ? convertPrice(duplicateFormValues.mrp, priceCurrency, 'USD') : null,
      taxRate: duplicateFormValues.taxRate,
      brand: duplicateFormValues.brand,
      manufacturer: duplicateFormValues.manufacturer,
      itemGroupId: duplicateFormValues.itemGroupId || null,
      itemGroup: itemGroups.find((group) => group.id === duplicateFormValues.itemGroupId)?.name || fullItem.item_group_name || fullItem.item_group || null,
      minStockLevel: duplicateFormValues.minStockLevel,
      maxStockLevel: duplicateFormValues.maxStockLevel,
      barcode: duplicateFormValues.barcode,
      batchNumber: duplicateFormValues.batchNumber,
      openingStock: duplicateFormValues.openingStock || 0,
      openingValue: duplicateFormValues.openingValue || 0,
      defaultBinId: duplicateFormValues.defaultBinId || null,
      valuationMethod: duplicateFormValues.valuationMethod,
      weight: duplicateFormValues.weight,
      dimensions: (duplicateFormValues.length || duplicateFormValues.width || duplicateFormValues.height) ? {
        length: duplicateFormValues.length || 0,
        width: duplicateFormValues.width || 0,
        height: duplicateFormValues.height || 0
      } : null,
      hsnCode: duplicateFormValues.hsnCode,
      upc: duplicateFormValues.upc,
      ean: duplicateFormValues.ean,
      isbn: duplicateFormValues.isbn,
      mpn: duplicateFormValues.mpn,
      components: normalizeCompositeComponents(fullItem?.composite_components || [])
    });
    setDuplicateSourcePayload(duplicateComparablePayload);

    form.setFieldsValue(duplicateFormValues);
    fetchBinsForWarehouse(finalWarehouseId);
    setModalVisible(true);
    setTimeout(() => message.info(`Duplicated from "${item.name}" — all values copied. Change at least one field before saving.`), 300);
  };

  const openCreateModal = async () => {
    setEditingItem(null);
    setEditingWarehouseSummaries([]);
    setDuplicateSourcePayload(null);
    variantBuilderSeededRef.current = false;
    setActiveDraftId(null);
    setPriceCurrency(currency);
    setImageUrl('');
    setImageFile(null);
    form.resetFields();
    setDraftBanner(null);
    setDuplicateBanner(null);
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    setExistingCustomFields({});
    setVariantMatrixEdits([]);
    setCompositeComponents([]);

    await fetchDropdownOptions();
    await loadSkuRules();
    form.setFieldsValue({
      type: itemTypes.find(t => t.name === 'simple')?.name || itemTypes[0]?.name || 'simple',
      trackInventory: false,
      itemGroupId: null,
      purchaseAccount: 'cogs',
      purchaseTaxRate: 0,
      purchaseDescription: 'Initial stock entry'
    });
    setModalVisible(true);
  };

  const fetchDrafts = async () => {
    try {
      setDraftsLoading(true);
      const res = await apiService.get('/items/drafts');
      setDrafts(Array.isArray(res?.data) ? res.data : []);
    } catch {
      setDrafts([]);
    } finally {
      setDraftsLoading(false);
    }
  };

  const openDraft = async (draft) => {
    setEditingItem(null);
    setActiveDraftId(draft.id);
    setPriceCurrency(currency);
    setImageUrl(draft.data?.image || '');
    setImageFile(null);
    setExistingCustomFields(draft.data?.customFields || {});
    setVariantMatrixEdits(Array.isArray(draft.data?.customFields?.variantMatrix) ? draft.data.customFields.variantMatrix : []);
    setCompositeComponents(normalizeCompositeComponents(draft.data?.components || []));
    setLastAppliedSkuRule(null);
    setSelectedSkuRuleId(null);
    form.resetFields();
    await fetchDropdownOptions();
    await loadSkuRules();
    form.setFieldsValue(draft.data);
    setDraftBanner({ savedAt: draft.savedAt, draftId: draft.id });
    setModalVisible(true);
  };

  const hasDraftableValues = useCallback((values = {}) => {
    const fieldsToCheck = [
      'sku', 'name', 'description', 'category', 'unit', 'warehouseId', 'type',
      'brand', 'manufacturer', 'barcode', 'batchNumber', 'upc', 'ean', 'isbn', 'mpn', 'itemGroupId'
    ];
    const hasText = fieldsToCheck.some((k) => {
      const v = values[k];
      return typeof v === 'string' ? v.trim().length > 0 : !!v;
    });
    const hasNumeric = ['costPrice', 'sellingPrice', 'mrp', 'openingStock', 'weight', 'minStockLevel', 'maxStockLevel']
      .some((k) => Number(values[k]) > 0);
    return hasText || hasNumeric || !!imageUrl;
  }, [imageUrl]);

  const saveDraftSilently = useCallback(async (source = 'manual') => {
    if (editingItem) return false;
    if (autoDraftSavingRef.current) return false;

    const values = form.getFieldsValue();
    if (!hasDraftableValues(values)) return false;

    autoDraftSavingRef.current = true;
    try {
      await apiService.post('/items/draft', { ...values, image: imageUrl, components: compositeComponents });
      if (source === 'session-timeout') {
        message.info('Session about to expire: item saved as draft.');
      }
      fetchDrafts();
      return true;
    } catch {
      if (source === 'session-timeout') {
        message.error('Could not auto-save draft before session expiry.');
      }
      return false;
    } finally {
      autoDraftSavingRef.current = false;
    }
  }, [compositeComponents, editingItem, form, hasDraftableValues, imageUrl]);

  const handleSaveDraft = async () => {
    try {
      const saved = await saveDraftSilently('manual');
      if (!saved) {
        message.warning('Nothing to save as draft yet.');
        return;
      }
      message.success('Draft saved! You can continue later.');
      setModalVisible(false);
      setEditingItem(null);
      setActiveDraftId(null);
      setDraftBanner(null);
      setCompositeComponents([]);
      fetchDrafts();
    } catch {
      message.error('Failed to save draft');
    }
  };

  useEffect(() => {
    // Reset auto-save latch when timer has enough buffer again.
    if (sessionSecondsLeft == null || sessionSecondsLeft > 30) {
      autoDraftSavedRef.current = false;
      return;
    }

    // Auto-save once shortly before inactivity logout.
    if (
      modalVisible &&
      !editingItem &&
      sessionSecondsLeft > 0 &&
      sessionSecondsLeft <= 20 &&
      !autoDraftSavedRef.current
    ) {
      autoDraftSavedRef.current = true;
      saveDraftSilently('session-timeout');
    }
  }, [sessionSecondsLeft, modalVisible, editingItem, saveDraftSilently]);

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

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const requestedItemGroupId = params.get('itemGroupId') || 'all';
    setItemGroupFilter((current) => (current === requestedItemGroupId ? current : requestedItemGroupId));
  }, [location.search]);

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
    if (itemGroupFilter !== 'all' && item.item_group_id !== itemGroupFilter) return false;
    if (!searchText) return true;
    return (
      item.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.category?.toLowerCase().includes(searchText.toLowerCase()) ||
      item.item_group_name?.toLowerCase().includes(searchText.toLowerCase())
    );
  });

  const getItemSortDate = (item) => {
    const rawValue = item?.created_at || item?.updated_at || null;
    if (!rawValue) return 0;
    const parsed = new Date(rawValue).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sortedFilteredItems = useMemo(() => {
    const list = [...filteredItems];

    list.sort((left, right) => {
      const leftName = String(left?.name || '');
      const rightName = String(right?.name || '');

      switch (sortBy) {
        case 'name_desc':
          return rightName.localeCompare(leftName, undefined, { sensitivity: 'base', numeric: true });
        case 'date_desc':
          return getItemSortDate(right) - getItemSortDate(left) || leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
        case 'date_asc':
          return getItemSortDate(left) - getItemSortDate(right) || leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
        case 'name_asc':
        default:
          return leftName.localeCompare(rightName, undefined, { sensitivity: 'base', numeric: true });
      }
    });

    return list;
  }, [filteredItems, sortBy]);

  const getSelectedUnitLabel = () => {
    const selectedUnit = form.getFieldValue('unit');
    if (!selectedUnit) return 'kg';
    const unitRow = unitOptions.find((u) => u.id === selectedUnit || u.name === selectedUnit || u.symbol === selectedUnit);
    if (unitRow?.symbol) return unitRow.symbol;
    if (unitRow?.name) return unitRow.name;
    // If unit lookup is stale (e.g. recently deleted), avoid showing raw UUID.
    return 'selected unit';
  };
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
              placeholder="Search by name, SKU, category or group..."
              prefix={<SearchOutlined style={{ color: '#bbb' }} />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 260, borderRadius: 10 }}
              allowClear
            />
            <Select
              value={itemGroupFilter}
              onChange={setItemGroupFilter}
              style={{ width: 220 }}
              options={[
                { value: 'all', label: 'All Item Groups' },
                ...itemGroups.map((group) => ({
                  value: group.id,
                  label: group.name
                }))
              ]}
            />
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 180 }}
              options={[
                { value: 'name_asc', label: 'Name: A to Z' },
                { value: 'name_desc', label: 'Name: Z to A' },
                { value: 'date_desc', label: 'Date: Newest' },
                { value: 'date_asc', label: 'Date: Oldest' }
              ]}
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
              label: <span>All Items <Tag color="purple" style={{ borderRadius: 20, marginLeft: 4 }}>{sortedFilteredItems.length}</Tag></span>,
              children: (
                <Table
                  columns={columns}
                  dataSource={sortedFilteredItems}
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
                                await apiService.delete(`/items/draft/${r.id}`);
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
        onCancel={() => { setModalVisible(false); setEditingItem(null); setImageUrl(''); setImageFile(null); setDuplicateBanner(null); setDuplicateSourcePayload(null); setDraftBanner(null); setActiveDraftId(null); setExistingCustomFields({}); setVariantMatrixEdits([]); setCompositeComponents([]); setEditingWarehouseSummaries([]); setSelectedSkuRuleId(null); setLastAppliedSkuRule(null); form.resetFields(); }}
        footer={null}
        width="min(1440px, 99vw)"
        style={{ top: 8 }}
        styles={{ body: { background: '#fafbff', borderRadius: '0 0 12px 12px', maxHeight: '88vh', overflowY: 'auto', padding: 20 } }}
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
                <div style={{ fontSize: 12, color: '#ad6800', marginTop: 2 }}>All values are copied. Update at least one field before saving so this does not remain an exact duplicate.</div>
              </div>
              <Button size="small" style={{ borderRadius: 6, borderColor: '#ffa940', color: '#fa8c16' }} onClick={() => setDuplicateBanner(null)}>Dismiss</Button>
            </div>
          )}

          {/* Draft restored banner */}
          {draftBanner && (
            <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 8, padding: '8px 14px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#1677ff' }}>📝 Draft restored from {new Date(draftBanner.savedAt).toLocaleString()}</span>
              <Button size="small" danger onClick={async () => {
                try {
                  if (draftBanner?.draftId) {
                    await apiService.delete(`/items/draft/${draftBanner.draftId}`);
                  }
                } catch {}
                setDraftBanner(null);
                setActiveDraftId(null);
                form.resetFields();
                setImageUrl('');
                fetchDrafts();
              }}>Discard</Button>
            </div>
          )}

          {!editingItem && possibleDuplicateItems.length > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #fffbe6, #fff7e6)', border: '1px solid #ffd666', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <WarningOutlined style={{ color: '#d48806', fontSize: 18, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#ad6800', fontSize: 13, marginBottom: 4 }}>
                    Possible existing item found
                  </div>
                  <div style={{ fontSize: 12, color: '#ad6800', marginBottom: 12 }}>
                    A matching item already exists by SKU, name, barcode, or batch number. If this is the same item, update the existing record instead of creating a new one.
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {possibleDuplicateItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'center',
                          background: '#fff',
                          border: '1px solid #ffe58f',
                          borderRadius: 8,
                          padding: '10px 12px'
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, color: '#262626' }}>
                            {item.name || 'Unnamed Item'}
                          </div>
                          <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>
                            SKU: {item.sku || 'N/A'}
                            {item.barcode ? ` | Barcode: ${item.barcode}` : ''}
                            {item.batch_number ? ` | Batch: ${item.batch_number}` : ''}
                          </div>
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {item.duplicateReasons.map((reason) => (
                              <Tag key={`${item.id}-${reason}`} color="orange" style={{ borderRadius: 20, marginInlineEnd: 0 }}>
                                {reason}
                              </Tag>
                            ))}
                            <Tag color={item.status === 'active' ? 'green' : 'default'} style={{ borderRadius: 20, marginInlineEnd: 0, textTransform: 'capitalize' }}>
                              {item.status || 'unknown'}
                            </Tag>
                          </div>
                        </div>
                        <Space wrap>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            style={{ borderRadius: 6 }}
                            onClick={() => viewItem(item)}
                          >
                            View
                          </Button>
                          {canManageItems && (
                            <Button
                              size="small"
                              type="primary"
                              icon={<EditOutlined />}
                              style={{ borderRadius: 6 }}
                              onClick={() => openPossibleDuplicateForEdit(item)}
                            >
                              Update Existing
                            </Button>
                          )}
                        </Space>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
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
                    <Form.Item
                      name="sku"
                      label={
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <span>SKU</span>
                          {canManageItems && (
                            <Tooltip title="Open SKU rule settings">
                              <Button
                                type="text"
                                size="small"
                                icon={<SettingOutlined />}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openSkuRulesModal();
                                }}
                                style={{
                                  width: 22,
                                  height: 22,
                                  minWidth: 22,
                                  padding: 0,
                                  borderRadius: '50%',
                                  color: '#764ba2'
                                }}
                              />
                            </Tooltip>
                          )}
                        </span>
                      }
                      validateTrigger={['onBlur', 'onSubmit']}
                      rules={[{ validator: validateSkuAvailability }]}
                      style={{ marginBottom: 10 }}
                    >
                      <Input
                        placeholder="e.g. ITEM-001"
                        style={{ borderRadius: 8 }}
                      />
                    </Form.Item>
                    <div
                      style={{
                        marginBottom: 8,
                        padding: '10px 10px',
                        borderRadius: 12,
                        border: '1px solid #edf0ff',
                        background: 'linear-gradient(180deg, #fbfbff 0%, #f7f7ff 100%)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Select
                          placeholder="Pick SKU rule (optional)"
                          value={selectedSkuRuleId}
                          allowClear
                          loading={skuRulesLoading}
                          onChange={(value) => {
                            setSelectedSkuRuleId(value || null);
                            setLastAppliedSkuRule(null);
                          }}
                          style={{ width: '100%' }}
                          options={skuRules.map((r) => ({
                            value: r.id,
                            label: `${r.name}${r.scope === 'category' ? ` (Category: ${r.scope_value})` : ' (Institution)'}${r.is_default ? ' [Default]' : ''}`
                          }))}
                        />
                        {lastAppliedSkuRule ? (
                          <Tag color="purple" style={{ marginInlineEnd: 0, whiteSpace: 'nowrap' }}>
                            Applied: {lastAppliedSkuRule.name}
                          </Tag>
                        ) : null}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>
                        Leave empty to auto-pick (category rule → default → secondary)
                      </div>
                      <Tooltip title="Generate SKU using the selected rule (or auto-pick if none)">
                        <Button
                          block
                          type="primary"
                          loading={skuGenerating}
                          icon={<ThunderboltOutlined />}
                          onClick={handleGenerateSku}
                          style={{
                            marginTop: 10,
                            height: 40,
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            boxShadow: '0 10px 22px rgba(118, 75, 162, 0.22)',
                            fontWeight: 700
                          }}
                        >
                          Generate SKU
                        </Button>
                      </Tooltip>
                    </div>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item name="name" label="Item Name" rules={[{ required: true, message: 'Please input name!' }]}>
                      <Input placeholder="Enter item name" style={{ borderRadius: 8 }} />
                    </Form.Item>
                  </Col>
                </Row>
                {watchedItemType !== 'variant' && (
                <>
                <div
                  style={{
                    marginBottom: 14,
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid #e6ecff',
                    background: 'linear-gradient(180deg, #fbfcff 0%, #f7f9ff 100%)'
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#3659c9', marginBottom: 4 }}>
                    Quick Variant Tags
                  </div>
                  <div style={{ fontSize: 12, color: '#5b6475', lineHeight: 1.6 }}>
                    Use these optional fields for a single descriptor such as colour, size, or packing. They help with SKU generation and search, but they are not meant for multi-combination variants.
                  </div>
                </div>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="variant"
                      label="Variant / Packing"
                      tooltip="Example: ALOE, 7G, PREMIUM, 100ML"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select variant / packing"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Variant/Packing', ['variant'], 'variant')}>
                                  + Add Variant/Packing
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['variant', 'packing', 'pack']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Variant/Packing', ['variant', 'packing', 'pack'], v, 'variant');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="colorCode"
                      label="Colour"
                      tooltip="Color or shade code, reusable for variant matrix/SKU context"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select colour"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Colour', ['color'], 'colorCode')}>
                                  + Add Colour
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['color', 'colour']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Colour', ['color', 'colour'], v, 'colorCode');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="sizeCode"
                      label="Size"
                      tooltip="Used by SKU {SIZE}. Example: 100ML, 7G, XL"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select size"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Size', ['size'], 'sizeCode')}>
                                  + Add Size
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['size']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Size', ['size'], v, 'sizeCode');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="packType"
                      label="Pack Type"
                      tooltip="Used by SKU {TYPE}. Example: SCH, BTL, BOX"
                    >
                      <Select
                        showSearch
                        allowClear
                        optionFilterProp="title"
                        placeholder="Select pack type"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={() => addVariantMetaValue('Pack Type', ['pack type'], 'packType')}>
                                  + Add Pack Type
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {getVariantLibraryValuesByAliases(['pack type', 'packtype', 'type']).map((v) => (
                          <Select.Option key={v} value={v} title={v}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span>{v}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteVariantMetaSpecificValue('Pack Type', ['pack type', 'packtype', 'type'], v, 'packType');
                                  }}
                                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  ×
                                </span>
                              )}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                </>
                )}
                {watchedItemType === 'variant' && (
                <>
                <div
                  style={{
                    marginBottom: 14,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: '1px solid #d8e4ff',
                    background: 'linear-gradient(135deg, #f7f9ff 0%, #eef4ff 100%)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.08)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#2343a7' }}>
                      Variant Configuration
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Tag color="blue" style={{ marginInlineEnd: 0 }}>Single source of truth</Tag>
                      <Tag color="purple" style={{ marginInlineEnd: 0 }}>Auto-generate combinations</Tag>
                      <Tag color="geekblue" style={{ marginInlineEnd: 0 }}>Child SKU ready</Tag>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.6 }}>
                    This item is in <strong>Variant</strong> mode, so use the builder below to define attributes like Size, Colour, and Pack Type. The old quick fields are hidden here to avoid duplicate entry and confusion.
                  </div>
                </div>
                <Form.List name="variantAttributes">
                  {(fields, { add, remove }) => (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: '#667eea', fontWeight: 700, textTransform: 'uppercase' }}>
                          Multi-Variant Builder
                        </span>
                        <Button size="small" onClick={() => add({ name: '', values: undefined })}>
                          + Add Attribute
                        </Button>
                      </div>
                      <div style={{ background: '#f8faff', border: '1px solid #e6ecff', borderRadius: 8, padding: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: '#1f3b8f', fontWeight: 600, marginBottom: 4 }}>
                          Build Variant Dimensions (Professional Setup)
                        </div>
                        <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                          Each row is one attribute name with <strong>one or more</strong> values. Select multiple values in the same row, and the matrix combines all selected values across attributes.
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                          Example: one row <strong>Size</strong> {'=>'} 7G, 15G and one row <strong>Colour</strong> {'=>'} Red, Blue {'=>'} 4 variants
                        </div>
                      </div>
                      {fields.map(({ key, name, ...restField }) => (
                        <Row key={key} gutter={8} style={{ marginBottom: 8 }}>
                          <Col xs={24} sm={8}>
                            <Form.Item
                              {...restField}
                              name={[name, 'name']}
                              rules={[{ required: true, message: 'Attribute name required' }]}
                            >
                              <Select
                                showSearch
                                allowClear
                                placeholder="Attribute name (Size, Colour, Pack Type)"
                                options={variantLibraryNames.map((option) => ({ value: option, label: option }))}
                                filterOption={(inputValue, option) =>
                                  String(option?.label || '').toLowerCase().includes(String(inputValue || '').toLowerCase())
                                }
                                onChange={() => {
                                  form.setFieldValue(['variantAttributes', name, 'values'], []);
                                }}
                                dropdownRender={(menu) => (
                                  <div>
                                    {menu}
                                    {canManageItems && (
                                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                        <Button
                                          type="link"
                                          size="small"
                                          onClick={async () => {
                                            const raw = prompt('Add Attribute Name (e.g. Size, Colour, Pack Type):');
                                            const attrName = String(raw || '').trim();
                                            if (!attrName) return;
                                            try {
                                              await apiService.put('/items/variant-library/entry', { name: attrName, values: [] });
                                              await fetchDropdownOptions();
                                              form.setFieldValue(['variantAttributes', name, 'name'], attrName);
                                              message.success('Attribute name added');
                                            } catch (e) {
                                              message.error(e?.response?.data?.error || 'Failed to add attribute name');
                                            }
                                          }}
                                        >
                                          + Add Attribute Name
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={14}>
                            <Form.Item
                              {...restField}
                              name={[name, 'values']}
                              rules={[{
                                validator: (_, value) => (
                                  normalizeOptionalTextArray(value).length > 0
                                    ? Promise.resolve()
                                    : Promise.reject(new Error('Select or add at least one value'))
                                )
                              }]}
                            >
                              <Select
                                mode="multiple"
                                showSearch
                                allowClear
                                maxTagCount="responsive"
                                placeholder="Attribute values"
                                options={getVariantLibraryValues(form.getFieldValue(['variantAttributes', name, 'name'])).map((value) => ({ value, label: value }))}
                                dropdownRender={(menu) => (
                                  <div>
                                    {menu}
                                    {canManageItems && (
                                      <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                        <Button
                                          type="link"
                                          size="small"
                                          onClick={async () => {
                                            const attrName = normalizeOptionalText(form.getFieldValue(['variantAttributes', name, 'name']));
                                            if (!attrName) {
                                              message.warning('Choose attribute name first');
                                              return;
                                            }
                                            const raw = prompt('Add attribute value:');
                                            const v = String(raw || '').trim();
                                            if (!v) return;
                                            try {
                                              await apiService.put('/items/variant-library/entry', { name: attrName, values: [v] });
                                              await fetchDropdownOptions();
                                              const currentValues = normalizeOptionalTextArray(form.getFieldValue(['variantAttributes', name, 'values']));
                                              form.setFieldValue(
                                                ['variantAttributes', name, 'values'],
                                                Array.from(new Set([...currentValues, v]))
                                              );
                                              message.success(`Value "${v}" saved to library`);
                                            } catch (e) {
                                              message.error(e?.response?.data?.error || 'Failed to save attribute value');
                                            }
                                          }}
                                        >
                                          + Add Value to Library
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} sm={2} style={{ display: 'flex', alignItems: 'center' }}>
                            <Button danger type="text" onClick={() => remove(name)}>
                              Delete
                            </Button>
                          </Col>
                        </Row>
                      ))}
                      {fields.length === 0 && (
                        <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.5 }}>
                          No attributes added yet. Start with one dimension like <strong>Size</strong> or <strong>Colour</strong>, then select multiple values in the same row.
                          Use clear business names to keep SKU generation and variant matrix consistent.
                        </div>
                      )}
                    </div>
                  )}
                </Form.List>
                </>
                )}
                {watchedItemType === 'variant' && (
                  <div
                    style={{
                      marginBottom: 18,
                      border: '1px solid #dbe3f2',
                      borderRadius: 14,
                      background: 'linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)',
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.04)',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid #edf2f7',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        flexWrap: 'wrap',
                        background: 'linear-gradient(180deg, #fcfdff 0%, #f6f8fc 100%)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#334155' }}>Variant Matrix ({variantMatrixRows.length})</div>
                        <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>
                          Use the first row as your template, then apply repeated values across every variant in one click.
                        </div>
                      </div>
                      <Button onClick={saveVariantSetupForFuture}>
                        Save setup for future
                      </Button>
                    </div>
                    {variantMatrixRows.length === 0 ? (
                      <div style={{ padding: 14, fontSize: 12, color: '#8c8c8c' }}>
                        Add at least one variant attribute with values to generate combinations.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 360, overflowY: 'auto', padding: 14 }}>
                        <div style={{ minWidth: VARIANT_MATRIX_MIN_WIDTH }}>
                          <div
                            style={{
                              marginBottom: 12,
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: '1px solid #e2e8f0',
                              background: '#f8fbff',
                              fontSize: 12,
                              color: '#64748b'
                            }}
                          >
                            Enter repeated values in the first row, then use <strong>Copy to all</strong> in the header for price, stock, warehouse, or active status.
                          </div>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: VARIANT_MATRIX_GRID_TEMPLATE,
                              columnGap: 12,
                              alignItems: 'end',
                              padding: '0 10px 10px',
                              borderBottom: '1px solid #e8eef8',
                              marginBottom: 12
                            }}
                          >
                            <div style={VARIANT_MATRIX_LABEL_STYLE}>Combination</div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Child SKU</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={handleGenerateAllVariantSkus}
                                loading={skuGenerating}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Generate all
                              </Button>
                            </div>
                            <div style={VARIANT_MATRIX_LABEL_STYLE}>Barcode</div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Sell</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => copyVariantFieldFromFirstRow('sellingPrice', 'selling price')}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Stock</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => {
                                  if (window.confirm('Copy opening stock from the first row to all variants?')) {
                                    copyVariantFieldFromFirstRow('openingStock', 'opening stock');
                                  }
                                }}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                            <div>
                              <div style={VARIANT_MATRIX_LABEL_STYLE}>Warehouse</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => copyVariantFieldFromFirstRow('warehouseId', 'warehouse')}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ ...VARIANT_MATRIX_LABEL_STYLE, textAlign: 'center' }}>On</div>
                              <Button
                                type="link"
                                size="small"
                                onClick={() => copyVariantFieldFromFirstRow('active', 'active status', { allowBlank: true })}
                                style={VARIANT_MATRIX_ACTION_STYLE}
                              >
                                Copy to all
                              </Button>
                            </div>
                          </div>
                          {variantMatrixRows.map((row) => (
                            <div
                              key={row.key}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: VARIANT_MATRIX_GRID_TEMPLATE,
                                columnGap: 12,
                                alignItems: 'center',
                                marginBottom: 12,
                                padding: 12,
                                border: '1px solid #dde7f5',
                                borderRadius: 14,
                                background: '#ffffff',
                                boxShadow: '0 6px 18px rgba(148, 163, 184, 0.12)'
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    minHeight: 40,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 12px',
                                    border: '1px solid #d9e2f1',
                                    borderRadius: 10,
                                    background: '#f8fbff',
                                    fontWeight: 600,
                                    color: '#1f2937'
                                  }}
                                >
                                  {row.combinationLabel}
                                </div>
                              </div>
                              <Input
                                size="large"
                                value={row.sku}
                                onChange={(e) => updateVariantMatrixRow(row.key, { sku: e.target.value })}
                                placeholder="Child SKU"
                              />
                              <Input
                                size="large"
                                value={row.barcode}
                                onChange={(e) => updateVariantMatrixRow(row.key, { barcode: e.target.value })}
                                placeholder="Barcode"
                              />
                              <InputNumber
                                size="large"
                                min={0}
                                style={{ width: '100%' }}
                                value={row.sellingPrice}
                                onChange={(v) => updateVariantMatrixRow(row.key, { sellingPrice: v })}
                                placeholder="Sell"
                              />
                              <InputNumber
                                size="large"
                                min={0}
                                style={{ width: '100%' }}
                                value={row.openingStock}
                                onChange={(v) => updateVariantMatrixRow(row.key, { openingStock: v })}
                                placeholder="Stock"
                              />
                              <Select
                                size="large"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                value={row.warehouseId}
                                onChange={(v) => updateVariantMatrixRow(row.key, { warehouseId: v })}
                                placeholder="Warehouse"
                              >
                                {warehouses.map((w) => (
                                  <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                                ))}
                              </Select>
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={row.active !== false}
                                  onChange={(e) => updateVariantMatrixRow(row.key, { active: e.target.checked })}
                                  title="Active"
                                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item
                      name="type"
                      label="Item type"
                      initialValue="simple"
                      rules={[{ required: true, message: 'Select item type' }]}
                      tooltip="Simple: one SKU. Variant: options (e.g. size). Composite: BOM / kit. Service: non-stock."
                    >
                      <Select
                        placeholder={itemTypes.length ? 'Select type' : 'Select or add a type'}
                        showSearch
                        optionFilterProp="children"
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            {canManageItems && (
                              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                                <Button type="link" size="small" onClick={handleInlineAddItemType}>
                                  + Add Type
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      >
                        {itemTypes.map(type => (
                          <Select.Option key={type.id} value={type.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ textTransform: 'capitalize' }}>{type.name}</span>
                              {canManageItems && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItemType(type.id, type.name);
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
                              )}
                            </div>
                          </Select.Option>
                        ))}
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
                              {canManageCategories && (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCategory(category.id, category.name);
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
                              )}
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
                            <span>
                              {unit.name}
                              {unit.symbol && String(unit.symbol).trim().toLowerCase() !== String(unit.name || '').trim().toLowerCase()
                                ? ` (${unit.symbol})`
                                : ''}
                            </span>
                            <span
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await apiService.delete(`/units/${unit.id}`);
                                  setUnitOptions(prev => prev.filter(u => u.id !== unit.id));
                                  if (form.getFieldValue('unit') === unit.id) {
                                    form.setFieldsValue({ unit: undefined });
                                  }
                                  message.success(`Unit '${unit.name}' deleted`);
                                } catch (error) {
                                  message.error(error?.response?.data?.error || 'Failed to delete unit');
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
                  <Col xs={24} sm={12}>
                    <Form.Item
                      name="itemGroupId"
                      label="Item Group"
                      tooltip="Use item groups to organize related items for reporting, filtering, and master-data consistency."
                    >
                      <Select
                        allowClear
                        placeholder={itemGroups.length ? 'Select item group' : 'No item groups available'}
                        optionFilterProp="label"
                        options={selectableItemGroups.map((group) => ({
                          value: group.id,
                          label: group.name
                        }))}
                        dropdownRender={(menu) => (
                          <div>
                            {menu}
                            <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', fontSize: 12, color: '#6b7280' }}>
                              Manage item groups from the <strong>Item Groups</strong> page in the Items menu.
                            </div>
                          </div>
                        )}
                      />
                    </Form.Item>
                  </Col>
                </Row>
                {watchedItemType === 'composite' && (
                  <div style={{ marginBottom: 16, border: '1px solid #e6e8f0', borderRadius: 8, background: '#fff' }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 600, color: '#4b5563', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>BOM Components ({compositeComponents.length})</span>
                      <Button
                        size="small"
                        onClick={() => setCompositeComponents((prev) => [...prev, { itemId: '', quantityRequired: 1, consumptionTiming: 'shipment' }])}
                      >
                        + Add Component
                      </Button>
                    </div>
                    {compositeComponents.length === 0 ? (
                      <div style={{ padding: 12, fontSize: 12, color: '#8c8c8c' }}>
                        Add at least one component item for this kit/BOM.
                      </div>
                    ) : (
                      <div style={{ maxHeight: 300, overflowY: 'auto', padding: 10 }}>
                        {compositeComponents.map((row, idx) => (
                          <Row key={`bom-${idx}`} gutter={8} style={{ marginBottom: 8 }}>
                            <Col xs={24} sm={13}>
                              <Select
                                showSearch
                                optionFilterProp="children"
                                value={row.itemId || undefined}
                                placeholder="Select component item"
                                onChange={(value) =>
                                  setCompositeComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, itemId: value } : x)))
                                }
                              >
                                {items
                                  .filter((itemRow) => itemRow.id !== editingItem?.id && itemRow.status === 'active')
                                  .map((itemRow) => (
                                    <Select.Option key={itemRow.id} value={itemRow.id}>
                                      {itemRow.sku} - {itemRow.name}
                                    </Select.Option>
                                  ))}
                              </Select>
                            </Col>
                            <Col xs={24} sm={5}>
                              <InputNumber
                                min={0.0001}
                                step={0.0001}
                                style={{ width: '100%' }}
                                value={row.quantityRequired}
                                placeholder="Qty required"
                                onChange={(value) =>
                                  setCompositeComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, quantityRequired: value } : x)))
                                }
                              />
                            </Col>
                            <Col xs={24} sm={4}>
                              <Select
                                value={row.consumptionTiming || 'shipment'}
                                onChange={(value) =>
                                  setCompositeComponents((prev) => prev.map((x, i) => (i === idx ? { ...x, consumptionTiming: value } : x)))
                                }
                                options={[
                                  { value: 'shipment', label: 'Shipment' },
                                  { value: 'order', label: 'Order' }
                                ]}
                              />
                            </Col>
                            <Col xs={24} sm={2} style={{ display: 'flex', alignItems: 'center' }}>
                              <Button
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => setCompositeComponents((prev) => prev.filter((_, i) => i !== idx))}
                              />
                            </Col>
                          </Row>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, cur) => prev.unit !== cur.unit}
                >
                  {() => {
                    const unitLabel = getSelectedUnitLabel();
                    return (
                      <Form.Item
                        name="weight"
                        label={`Weight (per unit, ${unitLabel})`}
                        tooltip={`Enter net weight for one selling unit in ${unitLabel}.`}
                      >
                        <Input placeholder={`Per unit weight in ${unitLabel}`} />
                      </Form.Item>
                    );
                  }}
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
              <Col xs={24} sm={8}>
                <Form.Item
                  name="batchNumber"
                  label="Batch Number"
                  getValueFromEvent={(event) => String(event?.target?.value || '').toUpperCase()}
                >
                  <Input placeholder="Enter Batch Number" />
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
          {isVariantItem && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#f7faff', border: '1px solid #d6e4ff', fontSize: 12, color: '#1d39c4' }}>
              Variant item detected. Child variants use the prices entered in the Variant Matrix above. The fields below act as shared defaults only when a variant row price is left blank.
            </div>
          )}
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Price Currency">
                <Select
                  value={priceCurrency}
                  onChange={handlePriceCurrencyChange}
                  options={currencies.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <div style={{ paddingTop: 30, color: '#595959', fontSize: 12 }}>
                Prices are entered as <strong>per unit</strong> based on selected Unit and are converted to USD on save.
              </div>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="sellingPrice" label={`${isVariantItem ? 'Default Selling Price' : 'Selling Price'} (per unit, ${priceCurrency})`} rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
                <InputNumber 
                  min={0} 
                  step={0.01} 
                  precision={2}
                  style={{ width: '100%' }} 
                  placeholder={isVariantItem ? 'Optional fallback for variants' : 'Enter selling price'}
                  parser={value => value.replace(/[^0-9.]/g, '')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="mrp" label={`${isVariantItem ? 'Default MRP' : 'MRP'} (per unit, ${priceCurrency})`} rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
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
          {isVariantItem && (
            <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 8, background: '#faf8ff', border: '1px solid #e6d8ff', fontSize: 12, color: '#531dab' }}>
              Shared purchase settings stay here. If you use child-level costs later, this default cost is the fallback for variants without their own cost.
            </div>
          )}
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="costPrice" label={`${isVariantItem ? 'Default Cost Price' : 'Cost Price'} (per unit, ${priceCurrency})`} rules={[{ type: 'number', message: 'Please enter a valid number' }]}>
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
            {isVariantItem ? (
              <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f', fontSize: 12, color: '#135200' }}>
                Variant stock is tracked per combination. Use the <strong>Stock</strong> and <strong>Warehouse</strong> columns in the Variant Matrix above. In sales, users will choose the parent item, then the exact variant, and stock will be checked for that specific variant only.
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <Form.Item name="trackInventory" valuePropName="checked" style={{ marginBottom: 0 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff', fontSize: 13, color: '#595959', userSelect: 'none' }}>
                    <input type="checkbox" style={{ accentColor: '#667eea', width: 15, height: 15 }} />
                    <span>Track Inventory for this Item</span>
                  </label>
                </Form.Item>
              </div>
            )}
          {(isVariantItem || watchedTrackInventory) && (
          <>
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
          {!isVariantItem && (
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
                  showSearch
                  optionLabelProp="label"
                  optionFilterProp="label"
                  dropdownStyle={{ minWidth: 320 }}
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
                  {warehouseSelectOptions.map((warehouse) => {
                    const stock = warehouse.stock;
                    return (
                      <Select.Option
                        key={warehouse.id}
                        value={warehouse.id}
                        label={`${warehouse.name}${warehouse.status !== 'active' ? ' (inactive)' : ''}`}
                      >
                        <div>
                          <strong>
                            {warehouse.name}
                            {warehouse.status !== 'active' ? ' (inactive)' : ''}
                          </strong>
                          {(warehouse.code || stock) && <br />}
                          {warehouse.code && (
                            <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                              Code: {warehouse.code}
                            </span>
                          )}
                          {warehouse.code && stock && <br />}
                          {stock && (
                            <span
                              style={{
                                fontSize: 12,
                                color: stock.available > 0 ? '#52c41a' : '#8c8c8c'
                              }}
                            >
                              Available: {formatStockQty(stock.available)} | On hand: {formatStockQty(stock.onHand)} | Reserved: {formatStockQty(stock.reserved)}
                            </span>
                          )}
                        </div>
                      </Select.Option>
                    );
                  })}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          )}
          </>
          )}
          {!isVariantItem && (
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
          )}
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
              <Button size="large" style={{ borderRadius: 10, color: '#8c8c8c' }} onClick={() => { setModalVisible(false); setEditingItem(null); setDuplicateBanner(null); setDuplicateSourcePayload(null); setCompositeComponents([]); setEditingWarehouseSummaries([]); form.resetFields(); }}>
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
        width="min(1280px, 98vw)"
        style={{ top: 16 }}
        styles={{ body: { background: '#fafbff', maxHeight: '82vh', overflowY: 'auto', padding: '20px 24px' } }}
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
                  {viewingItem.item_group_name && <Tag color="purple" style={{ borderRadius: 20 }}>{viewingItem.item_group_name}</Tag>}
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
                ['Item Group', viewingItem.item_group_name || 'N/A'],
                ['Brand', viewingItem.brand || 'N/A'],
                ['Manufacturer', viewingItem.manufacturer || 'N/A'],
              ], [
                ['Status', <Tag color={viewingItem.status === 'active' ? 'success' : 'error'} style={{ borderRadius: 20, marginInlineEnd: 0, textTransform: 'capitalize' }}>{viewingItem.status || 'N/A'}</Tag>],
                ['Min Stock', viewingItem.min_stock_level ?? 'N/A'],
                ['Max Stock', viewingItem.max_stock_level ?? 'N/A'],
                ['Opening Stock', viewingItem.opening_stock ?? 'N/A'],
                ['Valuation', viewingItem.valuation_method || 'N/A'],
                ['HSN Code', viewingItem.hsn_code || 'N/A'],
                ['Barcode', viewingItem.barcode || 'N/A'],
              ], [
                ['Batch Number', viewingItem.batch_number || 'N/A'],
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

            {String(viewingItem.type || '').toLowerCase() === 'variant' && (
              <Card
                size="small"
                title={(
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span>Variant Details</span>
                    <Tag color="blue" style={{ borderRadius: 999, marginInlineEnd: 0 }}>
                      {(Array.isArray(viewingItem.variant_rows) && viewingItem.variant_rows.length > 0
                        ? viewingItem.variant_rows.length
                        : (Array.isArray(viewingItem?.custom_fields?.variantMatrix) ? viewingItem.custom_fields.variantMatrix.length : 0)
                      ) || 0} variants
                    </Tag>
                  </div>
                )}
                style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden' }}
                bodyStyle={{ paddingTop: 8 }}
              >
                {(() => {
                  const rows = Array.isArray(viewingItem.variant_rows) && viewingItem.variant_rows.length > 0
                    ? viewingItem.variant_rows
                    : (Array.isArray(viewingItem?.custom_fields?.variantMatrix) ? viewingItem.custom_fields.variantMatrix : []);
                  if (!rows.length) {
                    return <Empty description="No variant rows available" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
                  }
                  return (
                    <Table
                      size="middle"
                      rowKey={(row, idx) => row.id || row.key || `${row.sku || 'variant'}-${idx}`}
                      dataSource={rows}
                      bordered={false}
                      scroll={{ x: 760 }}
                      style={{ border: '1px solid #f0f3f8', borderRadius: 12, overflow: 'hidden' }}
                      rowClassName={(_, idx) => (idx % 2 === 0 ? 'table-row-light' : 'table-row-dark')}
                      pagination={{
                        pageSize: 6,
                        size: 'small',
                        hideOnSinglePage: true,
                        position: ['bottomRight'],
                        style: { margin: '12px 12px 0 0' }
                      }}
                      columns={[
                        {
                          title: 'Variant',
                          key: 'variant',
                          width: 360,
                          render: (_, row) => {
                            const tokens = getVariantAttributeTokens(row);
                            const primaryLabel = String(row.combinationLabel || row.variant_name || '').trim();
                            return (
                              <div>
                                {tokens.length > 0 && (
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {tokens.map((token, tokenIdx) => (
                                      <Tag
                                        key={`${token.label}-${token.value}-${tokenIdx}`}
                                        color="blue"
                                        style={{
                                          borderRadius: 999,
                                          marginInlineEnd: 0,
                                          paddingInline: 10,
                                          borderColor: '#d6e4ff',
                                          background: '#f5f9ff',
                                          color: '#1d39c4'
                                        }}
                                      >
                                        <span style={{ fontWeight: 600 }}>{token.label}</span>: {token.value}
                                      </Tag>
                                    ))}
                                  </div>
                                )}
                                {tokens.length === 0 && (
                                  <div style={{ fontWeight: 600, color: '#1f2937' }}>
                                    {primaryLabel || 'Unnamed variant'}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        },
                        {
                          title: 'Child SKU',
                          key: 'sku',
                          width: 120,
                          render: (_, row) => row.sku ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: '#f3f4f6',
                              border: '1px solid #e5e7eb',
                              fontFamily: 'Consolas, monospace',
                              fontSize: 12,
                              color: '#111827'
                            }}>
                              {row.sku}
                            </span>
                          ) : <span style={{ color: '#9ca3af' }}>-</span>
                        },
                        {
                          title: 'Barcode',
                          key: 'barcode',
                          width: 120,
                          render: (_, row) => row.barcode || <span style={{ color: '#9ca3af' }}>-</span>
                        },
                        {
                          title: 'Sell Price',
                          key: 'selling',
                          width: 120,
                          render: (_, row) => {
                            const val = row.sellingPrice ?? row.selling_price;
                            return val != null ? (
                              <span style={{ fontWeight: 700, color: '#1677ff' }}>
                                {formatPrice(Number(val) || 0, currency, 'USD')}
                              </span>
                            ) : <span style={{ color: '#9ca3af' }}>-</span>;
                          }
                        },
                        {
                          title: 'Status',
                          key: 'status',
                          width: 100,
                          render: (_, row) => {
                            const active = row.active !== undefined ? !!row.active : String(row.status || '').toLowerCase() === 'active';
                            return (
                              <Tag
                                color={active ? 'success' : 'default'}
                                style={{ borderRadius: 999, marginInlineEnd: 0, textTransform: 'capitalize', fontWeight: 600 }}
                              >
                                {active ? 'active' : 'inactive'}
                              </Tag>
                            );
                          }
                        }
                      ]}
                    />
                  );
                })()}
              </Card>
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
                      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                        <Timeline>
                          {itemHistory.map((log, index) => {
                            const eventType = log.type || log.event_type || '';
                            const fieldChanges = Array.isArray(log.field_changes) ? log.field_changes : [];
                            const summaryText = log.summary || log.description;
                            const getEventColor = (type) => {
                              if (['PurchaseReceived', 'SaleReturned', 'SaleReservationCancelled'].includes(type)) return 'green';
                              if (['SaleShipped', 'PurchaseReturned', 'StockDamaged', 'StockExpired'].includes(type)) return 'red';
                              if (['SaleReserved'].includes(type)) return 'orange';
                              if (type === 'ADJUSTMENT') return 'blue';
                              if (['TransferIn', 'TransferOut'].includes(type)) return 'purple';
                              if (type === 'ITEM_CREATED') return 'green';
                              if (type === 'ITEM_UPDATED') return 'cyan';
                              if (type === 'ITEM_COMPONENTS_UPDATED') return 'purple';
                              if (type === 'ITEM_DELETED') return 'red';
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
                                ITEM_CREATED: 'Item Created',
                                ITEM_UPDATED: 'Item Updated',
                                ITEM_COMPONENTS_UPDATED: 'BOM Updated',
                                ITEM_DELETED: 'Item Deleted',
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
                                  {fieldChanges.length > 0 && (
                                    <div style={{ marginTop: 8 }}>
                                      {fieldChanges.slice(0, 8).map((change, changeIndex) => (
                                        <div key={`${log.id || index}-field-${changeIndex}`}>
                                          {change.label}: <strong>{change.from_display}</strong>{' -> '}<strong>{change.to_display}</strong>
                                        </div>
                                      ))}
                                      {fieldChanges.length > 8 && (
                                        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                                          +{fieldChanges.length - 8} more field changes
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  {log.performed_by?.trim() && <div style={{ color: '#8c8c8c', fontSize: 12 }}>By: {log.performed_by}</div>}
                                  {ref && <div style={{ color: '#8c8c8c', fontSize: 12 }}>Ref: {ref}</div>}
                                  {summaryText && <div style={{ color: '#8c8c8c', fontSize: 12 }}>{summaryText}</div>}
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
        width="min(1200px, 98vw)"
        style={{ top: 8 }}
        styles={{ body: { background: '#f8f9ff', borderRadius: '0 0 12px 12px', maxHeight: '86vh', overflowY: 'auto', padding: 16 } }}
        destroyOnClose
      >
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* --- Existing rules list --- */}
          <div style={{ flex: '1 1 360px', minWidth: 340, background: '#fff', border: '1px solid #eef0f7', borderRadius: 12, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b style={{ fontSize: 14, color: '#1f2937' }}>Active Rules</b>
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
              bordered
              scroll={{ y: 520 }}
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
          <div style={{ flex: '1 1 620px', minWidth: 420, background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #eef0f7' }}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: '#1f2937' }}>
              {editingSkuRule ? `Edit: ${editingSkuRule.name}` : 'Create a new rule'}
            </div>
            <Form
              form={skuRuleForm}
              layout="vertical"
              size="middle"
              labelCol={{ style: { paddingBottom: 2 } }}
              initialValues={{
                scope: 'default',
                prefixMode: 'static',
                prefixSources: ['name'],
                prefixSourceConfig: buildDefaultDerivedConfig(),
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
              <div style={{ background: '#fafbff', border: '1px solid #edf0ff', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="name" label="Rule Name" rules={[{ required: true, message: 'Name is required' }]} style={{ marginBottom: 10 }}>
                      <Input placeholder="e.g. Default, Electronics, Apparel" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="scope" label="Applies To" rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                      <Select>
                        <Select.Option value="default">Institution default</Select.Option>
                        <Select.Option value="category">Specific category</Select.Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, cur) => prev.scope !== cur.scope}
                    >
                      {({ getFieldValue }) => getFieldValue('scope') === 'category' ? (
                        <Form.Item name="scopeValue" label="Category" rules={[{ required: true, message: 'Pick a category' }]} style={{ marginBottom: 0 }}>
                          <Select
                            placeholder="Select category"
                            showSearch
                            options={(categories || []).map(c => ({ value: c.name, label: c.name }))}
                          />
                        </Form.Item>
                      ) : (
                        <Form.Item name="isDefault" label="Usage" style={{ marginBottom: 0 }}>
                          <Select>
                            <Select.Option value={true}>Use as default</Select.Option>
                            <Select.Option value={false}>Secondary (manual pick)</Select.Option>
                          </Select>
                        </Form.Item>
                      )}
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              <Divider style={{ margin: '10px 0 14px', fontSize: 12 }} orientation="left">Prefix</Divider>
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
                      <>
                        <Form.Item
                          name="prefixStatic"
                          label="Text"
                          rules={[{ required: true, message: 'Enter a prefix' }]}
                          style={{ marginBottom: 8 }}
                        >
                          <Input placeholder="e.g. ITEM or {BRAND}-{ITEM}-{SIZE}-{TYPE}-{SEQ}" maxLength={80} />
                        </Form.Item>
                        <div style={{ marginBottom: 6, fontSize: 12, color: '#6b7280' }}>Template tokens</div>
                        <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
                          {[
                            '{BRAND}', '{ITEM}', '{VARIANT}', '{COLOR}', '{SIZE}', '{TYPE}', '{CATEGORY}',
                            '{MANUFACTURER}', '{UNIT}', '{WAREHOUSE}', '{HSN}', '{MPN}', '{BARCODE}', '{DATE}', '{SEQ}'
                          ].map((token) => (
                            <Button key={token} size="small" onClick={() => insertSkuToken(token)}>
                              {token}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <Form.Item noStyle shouldUpdate={(p, c) =>
                        p.prefixSources !== c.prefixSources || p.prefixSourceConfig !== c.prefixSourceConfig
                      }>
                        {({ getFieldValue }) => {
                          const selected = Array.isArray(getFieldValue('prefixSources'))
                            ? getFieldValue('prefixSources').filter(Boolean)
                            : [];
                          return (
                            <>
                              <Form.Item name="prefixSources" label="Source fields" rules={[{ required: true, message: 'Select at least one field' }]}>
                                <Select
                                  mode="multiple"
                                  maxTagCount="responsive"
                                  placeholder="Choose one or more fields"
                                  options={DERIVED_SOURCE_OPTIONS}
                                  onChange={(nextValues) => {
                                    const prevValues = skuRuleForm.getFieldValue('prefixSources') || [];
                                    const ordered = preserveSelectionOrder(prevValues, nextValues);
                                    skuRuleForm.setFieldsValue({ prefixSources: ordered });
                                  }}
                                />
                              </Form.Item>
                              {selected.length > 0 && (
                                <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, marginTop: -4, background: '#fcfcff' }}>
                                  {selected.map((src) => (
                                    <Row gutter={10} key={src} style={{ marginBottom: 10, padding: '8px 8px 2px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                                      <Col xs={24} sm={8}>
                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Field</div>
                                        <div style={{ fontSize: 13, color: '#262626', textTransform: 'capitalize', fontWeight: 600 }}>
                                          {DERIVED_SOURCE_LABELS[src] || src}
                                        </div>
                                      </Col>
                                      <Col xs={12} sm={8}>
                                        <Form.Item noStyle shouldUpdate={(p, c) =>
                                          p?.prefixSourceConfig?.[src]?.mode !== c?.prefixSourceConfig?.[src]?.mode
                                        }>
                                          {({ getFieldValue }) => {
                                            const mode = getFieldValue(['prefixSourceConfig', src, 'mode']) || 'abbr';
                                            const disableLen = mode === 'abbr';
                                            return (
                                              <Form.Item
                                                name={['prefixSourceConfig', src, 'len']}
                                                label="Chars"
                                                style={{ marginBottom: 0 }}
                                                labelCol={{ style: { paddingBottom: 2 } }}
                                                extra={disableLen ? 'Disabled for first letters' : undefined}
                                              >
                                                <InputNumber min={1} max={10} style={{ width: '100%' }} disabled={disableLen} />
                                              </Form.Item>
                                            );
                                          }}
                                        </Form.Item>
                                      </Col>
                                      <Col xs={12} sm={8}>
                                        <Form.Item name={['prefixSourceConfig', src, 'mode']} label="Pick style" style={{ marginBottom: 0 }} labelCol={{ style: { paddingBottom: 2 } }}>
                                          <Select>
                                            <Select.Option value="abbr">First letters</Select.Option>
                                            <Select.Option value="slice">First chars</Select.Option>
                                          </Select>
                                        </Form.Item>
                                      </Col>
                                    </Row>
                                  ))}
                                </div>
                              )}
                            </>
                          );
                        }}
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="separator" label="Separator" style={{ marginBottom: 10 }}>
                <Select>
                  <Select.Option value="-">Dash (-)</Select.Option>
                  <Select.Option value="_">Underscore (_)</Select.Option>
                  <Select.Option value="">None</Select.Option>
                </Select>
              </Form.Item>

              <Divider style={{ margin: '10px 0 14px', fontSize: 12 }} orientation="left">Date segment (optional)</Divider>
              <Row gutter={12}>
                <Col span={10}>
                  <Form.Item name="useDate" label="Include date" style={{ marginBottom: 10 }}>
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

              <Divider style={{ margin: '10px 0 14px', fontSize: 12 }} orientation="left">Counter</Divider>
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
                    <InputNumber min={1} style={{ width: '100%' }} />
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