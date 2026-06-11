import React, { useMemo } from 'react';
import { Alert, Button, Col, Input, Row, Select, Table, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { CSV_IMPORT_SKU_AUTO_RULE } from './importConstants';
import { ImportDefaultField } from './ImportDefaultsPanel';

const { Text } = Typography;

const FIELD_META = {
  sku: { type: 'text' },
  description: { type: 'text' },
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
  name: { type: 'text' },
};

export function buildUpdateImportFieldOptions(coreTargets = [], fieldConfigs = [], { skuSource } = {}) {
  const core = (coreTargets || [])
    .filter((t) => !(t.id === 'sku' && skuSource === CSV_IMPORT_SKU_AUTO_RULE))
    .map((t) => ({ value: t.id, label: t.label, group: t.group || 'Core' }));
  const custom = (fieldConfigs || []).map((c) => ({
    value: `cf:${c.field_name || c.fieldName}`,
    label: c.field_label || c.fieldLabel || c.field_name || c.fieldName,
    group: 'Custom fields',
  }));
  return [...core, ...custom];
}

export function ImportUpdateFieldsPanel({
  mapping = {},
  importDefaults = {},
  onMappingChange,
  onDefaultChange,
  onRemoveMapping,
  onRemoveDefault,
  disabled = false,
  coreTargets = [],
  fieldConfigs = [],
  headers = [],
  skuSource,
  categories = [],
  unitOptions = [],
  brandOptions = [],
  manufacturerOptions = [],
  itemGroups = [],
  taxRateOptions = [],
  canViewCategories = false,
}) {
  const fieldOptions = useMemo(
    () => buildUpdateImportFieldOptions(coreTargets, fieldConfigs, { skuSource }),
    [coreTargets, fieldConfigs, skuSource]
  );

  const labelByKey = useMemo(() => {
    const m = new Map(fieldOptions.map((o) => [o.value, o.label]));
    return (key) => m.get(key) || key;
  }, [fieldOptions]);

  const headerOptions = useMemo(
    () => (headers || []).map((h) => ({ value: h, label: h })),
    [headers]
  );

  const mappingRows = useMemo(
    () => Object.entries(mapping)
      .filter(([, col]) => col)
      .map(([fieldKey, fileColumn]) => ({ key: fieldKey, fieldKey, fileColumn })),
    [mapping]
  );

  const defaultRows = useMemo(
    () => Object.entries(importDefaults)
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([fieldKey, value]) => ({ key: fieldKey, fieldKey, value })),
    [importDefaults]
  );

  const usedInMapping = new Set(Object.keys(mapping).filter((k) => mapping[k]));
  const usedInDefaults = new Set(
    Object.keys(importDefaults).filter((k) => {
      const v = importDefaults[k];
      return v !== undefined && v !== null && String(v).trim() !== '';
    })
  );

  const availableForMapping = fieldOptions.filter((o) => !usedInMapping.has(o.value));
  const availableForDefault = fieldOptions.filter((o) => !usedInDefaults.has(o.value));

  const [pendingMapField, setPendingMapField] = React.useState(null);
  const [pendingMapColumn, setPendingMapColumn] = React.useState(null);
  const [pendingDefaultField, setPendingDefaultField] = React.useState(null);

  const addMapping = () => {
    if (!pendingMapField || !pendingMapColumn) return;
    onMappingChange(pendingMapField, pendingMapColumn);
    setPendingMapField(null);
    setPendingMapColumn(null);
  };

  const addDefault = (fieldId, value) => {
    if (!fieldId || value === undefined || value === null || String(value).trim() === '') return;
    onDefaultChange(fieldId, String(value).trim());
    setPendingDefaultField(null);
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Update only the fields you choose"
        description="Add a file column mapping and/or a default value per field. Unlisted fields keep their existing catalog values. File cell wins when both are set. Auto-generate SKU works without mapping SKU."
      />

      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Map from file column
      </Text>
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        locale={{ emptyText: 'No field mappings yet — add one below' }}
        dataSource={mappingRows}
        columns={[
          { title: 'Field to update', dataIndex: 'fieldKey', render: (k) => labelByKey(k) },
          { title: 'File column', dataIndex: 'fileColumn' },
          {
            title: '',
            key: 'rm',
            width: 48,
            render: (_, r) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => onRemoveMapping(r.fieldKey)}
              />
            ),
          },
        ]}
        style={{ marginBottom: 10 }}
      />
      <Row gutter={8} align="middle" style={{ marginBottom: 16 }}>
        <Col flex="1 1 180px">
          <Select
            showSearch
            allowClear
            placeholder="Field to update"
            style={{ width: '100%' }}
            disabled={disabled || !availableForMapping.length}
            value={pendingMapField}
            options={availableForMapping}
            optionFilterProp="label"
            onChange={setPendingMapField}
          />
        </Col>
        <Col flex="1 1 180px">
          <Select
            showSearch
            allowClear
            placeholder="File column"
            style={{ width: '100%' }}
            disabled={disabled || !headerOptions.length}
            value={pendingMapColumn}
            options={headerOptions}
            optionFilterProp="label"
            onChange={setPendingMapColumn}
          />
        </Col>
        <Col>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            disabled={disabled || !pendingMapField || !pendingMapColumn}
            onClick={addMapping}
          >
            Add mapping
          </Button>
        </Col>
      </Row>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Default value (all matched rows)
      </Text>
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        locale={{ emptyText: 'No defaults yet — e.g. set Brand without a file column' }}
        dataSource={defaultRows}
        columns={[
          { title: 'Field to update', dataIndex: 'fieldKey', render: (k) => labelByKey(k) },
          { title: 'Default value', dataIndex: 'value', ellipsis: true },
          {
            title: '',
            key: 'rm',
            width: 48,
            render: (_, r) => (
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => onRemoveDefault(r.fieldKey)}
              />
            ),
          },
        ]}
        style={{ marginBottom: 10 }}
      />
      <Row gutter={8} align="top">
        <Col flex="1 1 200px">
          <Select
            showSearch
            allowClear
            placeholder="Field to update"
            style={{ width: '100%', marginBottom: 8 }}
            disabled={disabled || !availableForDefault.length}
            value={pendingDefaultField}
            options={availableForDefault}
            optionFilterProp="label"
            onChange={setPendingDefaultField}
          />
        </Col>
        <Col flex="1 1 240px">
          {pendingDefaultField ? (
            <ImportDefaultField
              fieldId={pendingDefaultField}
              label={labelByKey(pendingDefaultField)}
              value={undefined}
              disabled={disabled}
              meta={FIELD_META[pendingDefaultField] || { type: 'text' }}
              categories={categories}
              unitOptions={unitOptions}
              brandOptions={brandOptions}
              manufacturerOptions={manufacturerOptions}
              itemGroups={itemGroups}
              taxRateOptions={taxRateOptions}
              canViewCategories={canViewCategories}
              onChange={(fieldId, value) => addDefault(fieldId, value)}
            />
          ) : (
            <Input disabled placeholder="Pick a field first" />
          )}
        </Col>
      </Row>
    </div>
  );
}
