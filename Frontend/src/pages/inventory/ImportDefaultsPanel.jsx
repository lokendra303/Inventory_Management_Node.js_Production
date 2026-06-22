import React, { useMemo } from 'react';
import { Alert, Collapse, Row, Col, Input, InputNumber, Select, Typography } from 'antd';
import { CSV_IMPORT_DEFAULTABLE_CORE_IDS, CSV_IMPORT_SKU_AUTO_RULE, CSV_IMPORT_PURPOSE_UPDATE } from './importConstants.js';

const { Text } = Typography;

const FIELD_META = {
  sku: { type: 'text', placeholder: 'Same SKU for every row (only if file has no SKU column)' },
  description: { type: 'text', placeholder: 'Same description for every item' },
  barcode: { type: 'text' },
  category: { type: 'category' },
  unit: { type: 'unit' },
  itemGroupName: { type: 'itemGroup' },
  brand: { type: 'brand' },
  manufacturer: { type: 'manufacturer' },
  supplierCode: { type: 'text' },
  costPrice: { type: 'number' },
  sellingPrice: { type: 'number' },
  mrp: { type: 'number' },
  taxRate: { type: 'tax' },
  weight: { type: 'number' },
  hsnCode: { type: 'text' },
  batchNumber: { type: 'text' },
  batchExpiryDate: { type: 'text', placeholder: 'YYYY-MM-DD or sheet date column' },
  batchManufactureDate: { type: 'text', placeholder: 'YYYY-MM-DD or sheet date column' },
  minStockLevel: { type: 'number' },
  maxStockLevel: { type: 'number' },
  openingStock: { type: 'number' },
  openingValue: { type: 'number' },
  dimLength: { type: 'number' },
  dimWidth: { type: 'number' },
  dimHeight: { type: 'number' },
  upc: { type: 'text' },
  ean: { type: 'text' },
  isbn: { type: 'text' },
  mpn: { type: 'text' },
};

export function ImportDefaultField({
  fieldId,
  label,
  value,
  disabled,
  onChange,
  meta,
  categories,
  unitOptions,
  brandOptions,
  manufacturerOptions,
  itemGroups,
  taxRateOptions,
  canViewCategories,
}) {
  if (meta.type === 'category') {
    if (!canViewCategories) {
      return (
        <Input
          placeholder="Category name"
          value={value ?? ''}
          disabled={disabled}
          allowClear
          onChange={(e) => onChange(fieldId, e.target.value || undefined)}
        />
      );
    }
    return (
      <Select
        allowClear
        showSearch
        placeholder="Default category"
        style={{ width: '100%' }}
        disabled={disabled}
        value={value || undefined}
        options={(categories || []).map((c) => ({ value: c.name, label: c.name }))}
        onChange={(v) => onChange(fieldId, v || undefined)}
      />
    );
  }

  if (meta.type === 'unit') {
    return (
      <Select
        allowClear
        showSearch
        placeholder="Default unit"
        style={{ width: '100%' }}
        disabled={disabled}
        value={value || undefined}
        options={(unitOptions || []).map((u) => ({
          value: u.name || u.symbol || u.id,
          label: u.symbol && u.name ? `${u.name} (${u.symbol})` : (u.name || u.symbol),
        }))}
        onChange={(v) => onChange(fieldId, v || undefined)}
      />
    );
  }

  if (meta.type === 'brand') {
    return (
      <Select
        allowClear
        showSearch
        placeholder="Default brand"
        style={{ width: '100%' }}
        disabled={disabled}
        value={value || undefined}
        options={(brandOptions || []).map((b) => ({ value: b.name, label: b.name }))}
        onChange={(v) => onChange(fieldId, v || undefined)}
      />
    );
  }

  if (meta.type === 'manufacturer') {
    return (
      <Select
        allowClear
        showSearch
        placeholder="Default manufacturer"
        style={{ width: '100%' }}
        disabled={disabled}
        value={value || undefined}
        options={(manufacturerOptions || []).map((m) => ({ value: m.name, label: m.name }))}
        onChange={(v) => onChange(fieldId, v || undefined)}
      />
    );
  }

  if (meta.type === 'itemGroup') {
    return (
      <Select
        allowClear
        showSearch
        placeholder="Default item group"
        style={{ width: '100%' }}
        disabled={disabled}
        value={value || undefined}
        options={(itemGroups || []).map((g) => ({ value: g.name, label: g.name }))}
        onChange={(v) => onChange(fieldId, v || undefined)}
      />
    );
  }

  if (meta.type === 'tax') {
    if (taxRateOptions?.length) {
      return (
        <Select
          allowClear
          placeholder="Default tax rate"
          style={{ width: '100%' }}
          disabled={disabled}
          value={value != null && value !== '' ? Number(value) : undefined}
          options={taxRateOptions.map((t) => ({
            value: parseFloat(t.rate),
            label: `${t.name} (${parseFloat(t.rate).toFixed(2)}%)`,
          }))}
          onChange={(v) => onChange(fieldId, v != null ? String(v) : undefined)}
        />
      );
    }
    return (
      <InputNumber
        style={{ width: '100%' }}
        min={0}
        max={100}
        placeholder="%"
        disabled={disabled}
        value={value != null && value !== '' ? Number(value) : undefined}
        onChange={(v) => onChange(fieldId, v != null ? String(v) : undefined)}
      />
    );
  }

  if (meta.type === 'number') {
    return (
      <InputNumber
        style={{ width: '100%' }}
        placeholder={meta.placeholder || label}
        disabled={disabled}
        value={value != null && value !== '' ? Number(value) : undefined}
        onChange={(v) => onChange(fieldId, v != null ? String(v) : undefined)}
      />
    );
  }

  return (
    <Input
      placeholder={meta.placeholder || label}
      disabled={disabled}
      allowClear
      value={value ?? ''}
      onChange={(e) => onChange(fieldId, e.target.value || undefined)}
    />
  );
}

export function ImportDefaultsPanel({
  importDefaults = {},
  onFieldChange,
  disabled,
  coreTargets = [],
  fieldConfigs = [],
  categories = [],
  unitOptions = [],
  brandOptions = [],
  manufacturerOptions = [],
  itemGroups = [],
  taxRateOptions = [],
  canViewCategories = false,
  defaultCount = 0,
  skuSource,
  importPurpose,
}) {
  const isUpdateImport = importPurpose === CSV_IMPORT_PURPOSE_UPDATE;

  const coreFields = useMemo(() => {
    const allowed = new Set(CSV_IMPORT_DEFAULTABLE_CORE_IDS);
    return (coreTargets || []).filter((t) => {
      if (!allowed.has(t.id)) return false;
      if (t.id === 'sku' && skuSource === CSV_IMPORT_SKU_AUTO_RULE) return false;
      return true;
    });
  }, [coreTargets, skuSource]);

  const customFields = useMemo(
    () => (fieldConfigs || []).map((c) => ({
      id: `cf:${c.field_name || c.fieldName}`,
      label: c.field_label || c.fieldLabel || c.field_name || c.fieldName,
      fieldType: c.field_type || c.fieldType,
      options: c.options,
    })),
    [fieldConfigs]
  );

  if (isUpdateImport) {
    return (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Update mode: mapped columns only"
        description="Existing catalog values are kept for every field you do not map. Only mapped columns with data on each row are changed (empty mapped cells are skipped). Import defaults are not used on update — map the columns you want to change. Use Auto-generate SKU without mapping the SKU column when you want new SKUs."
      />
    );
  }

  const renderCustom = (cf) => {
    const ft = String(cf.fieldType || 'text').toLowerCase();
    const val = importDefaults[cf.id];
    if (ft === 'select') {
      let opts = [];
      try {
        opts = Array.isArray(cf.options) ? cf.options : JSON.parse(cf.options || '[]');
      } catch {
        opts = [];
      }
      if (opts.length) {
        return (
          <Select
            allowClear
            showSearch
            style={{ width: '100%' }}
            placeholder={`Default ${cf.label}`}
            disabled={disabled}
            value={val || undefined}
            options={opts.map((o) => ({ value: String(o), label: String(o) }))}
            onChange={(v) => onFieldChange(cf.id, v || undefined)}
          />
        );
      }
    }
    if (ft === 'number' || ft === 'decimal') {
      return (
        <InputNumber
          style={{ width: '100%' }}
          disabled={disabled}
          value={val != null && val !== '' ? Number(val) : undefined}
          onChange={(v) => onFieldChange(cf.id, v != null ? String(v) : undefined)}
        />
      );
    }
    return (
      <Input
        allowClear
        disabled={disabled}
        value={val ?? ''}
        placeholder={`Default ${cf.label}`}
        onChange={(e) => onFieldChange(cf.id, e.target.value || undefined)}
      />
    );
  };

  return (
    <Collapse
      style={{ marginBottom: 12 }}
      items={[
        {
          key: 'defaults',
          label: (
            <span>
              Default values for all rows (optional)
              {defaultCount > 0 ? (
                <Text type="secondary" style={{ marginLeft: 8, fontWeight: 400 }}>
                  {defaultCount} set — no column mapping needed for those fields
                </Text>
              ) : null}
            </span>
          ),
          children: (
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                Set once here instead of mapping a file column. For each item, the file value is used when the mapped cell has data;
                otherwise the default below applies. Name can use a default only if you do not map a Name column.
              </Text>
              <Row gutter={[12, 12]}>
                {coreFields.map((t) => (
                  <Col xs={24} sm={12} md={8} key={t.id}>
                    <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>{t.label}</div>
                    <ImportDefaultField
                      fieldId={t.id}
                      label={t.label}
                      value={importDefaults[t.id]}
                      disabled={disabled}
                      onChange={onFieldChange}
                      meta={FIELD_META[t.id] || { type: 'text' }}
                      categories={categories}
                      unitOptions={unitOptions}
                      brandOptions={brandOptions}
                      manufacturerOptions={manufacturerOptions}
                      itemGroups={itemGroups}
                      taxRateOptions={taxRateOptions}
                      canViewCategories={canViewCategories}
                    />
                  </Col>
                ))}
                {customFields.map((cf) => (
                  <Col xs={24} sm={12} md={8} key={cf.id}>
                    <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 600 }}>{cf.label}</div>
                    {renderCustom(cf)}
                  </Col>
                ))}
              </Row>
            </div>
          ),
        },
      ]}
    />
  );
}

export default ImportDefaultsPanel;
