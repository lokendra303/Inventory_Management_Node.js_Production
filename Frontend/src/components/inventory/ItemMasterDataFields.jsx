import React, { useEffect, useState } from 'react';
import { Button, Form, Input, InputNumber, Modal, Select, Space, Typography, message } from 'antd';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { filterSelectOption } from '../../utils/selectFilter';

const { Text } = Typography;

const actionChipBase = {
  marginLeft: 6,
  width: 18,
  height: 18,
  borderRadius: '50%',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 'bold',
  flexShrink: 0,
};

function ActionChip({ onClick, title, bg, hoverBg, children }) {
  return (
    <span
      role="button"
      tabIndex={0}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick?.(e);
        }
      }}
      style={{ ...actionChipBase, backgroundColor: bg }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverBg;
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = bg;
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </span>
  );
}

function DeleteChip({ onClick }) {
  return (
    <ActionChip onClick={onClick} title="Delete" bg="#ff4d4f" hoverBg="#d9363e">
      ×
    </ActionChip>
  );
}

function EditChip({ onClick }) {
  return (
    <ActionChip onClick={onClick} title="Rename" bg="#1677ff" hoverBg="#0958d9">
      <EditOutlined style={{ fontSize: 10 }} />
    </ActionChip>
  );
}

export function CategoryField({
  form,
  categories = [],
  canViewCategories = true,
  canManageCategories = false,
  onRefresh,
  tooltip,
}) {
  const handleAdd = async () => {
    const raw = window.prompt('Enter new category:');
    const name = String(raw || '').trim();
    if (!name) return;

    if (canManageCategories) {
      try {
        const response = await apiService.post('/categories', { name });
        if (response?.success) {
          await onRefresh?.();
          form?.setFieldsValue?.({ category: name });
          message.success('Category added');
          return;
        }
      } catch (e) {
        message.error(e?.response?.data?.error || 'Failed to add category');
        return;
      }
    }

    form?.setFieldsValue?.({ category: name });
    message.success('Category selected');
  };

  const handleDelete = async (categoryId, categoryName) => {
    if (!canManageCategories) return;
    try {
      await apiService.delete(`/categories/${categoryId}`);
      await onRefresh?.();
      if (form?.getFieldValue?.('category') === categoryName) {
        form.setFieldsValue({ category: undefined });
      }
      message.success(`Category '${categoryName}' deleted`);
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to delete category');
    }
  };

  if (!canViewCategories) {
    return (
      <Form.Item name="category" label="Category" tooltip={tooltip}>
        <Input placeholder="Enter category name" />
      </Form.Item>
    );
  }

  return (
    <Form.Item name="category" label="Category" tooltip={tooltip}>
      <Select
        allowClear
        showSearch
        placeholder={categories.length ? 'Select category' : 'Select or add a category'}
        optionFilterProp="children"
        dropdownRender={(menu) => (
          <div>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
              <Button type="link" size="small" onClick={handleAdd}>
                + Add Category
              </Button>
            </div>
          </div>
        )}
      >
        {categories.map((category) => (
          <Select.Option key={category.id || category.name} value={category.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{category.name}</span>
              {canManageCategories && category.id && (
                <DeleteChip onClick={() => handleDelete(category.id, category.name)} />
              )}
            </div>
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  );
}

export function UnitField({ form, units = [], onRefresh, label = 'Unit', requiredMessage = 'Unit is required' }) {
  const [localUnits, setLocalUnits] = useState(() => (Array.isArray(units) ? units : []));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitName, setUnitName] = useState('');
  const [baseUnitId, setBaseUnitId] = useState(null);
  const [conversionFactor, setConversionFactor] = useState(1);
  const [savingUnit, setSavingUnit] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);

  useEffect(() => {
    if (Array.isArray(units) && units.length > 0) {
      setLocalUnits(units);
    }
  }, [units]);

  useEffect(() => {
    if (Array.isArray(units) && units.length > 0) return undefined;
    if (localUnits.length > 0) return undefined;

    let cancelled = false;
    (async () => {
      setLoadingUnits(true);
      try {
        const res = await apiService.get('/units');
        const rows = Array.isArray(res) ? res : (res?.data || []);
        if (!cancelled && Array.isArray(rows)) setLocalUnits(rows);
      } catch {
        // parent refresh / retry can recover
      } finally {
        if (!cancelled) setLoadingUnits(false);
      }
    })();

    return () => { cancelled = true; };
  }, [units, localUnits.length]);

  const unitLabel = (unit) => {
    const name = unit?.name || '';
    const symbol = unit?.symbol && String(unit.symbol).trim().toLowerCase() !== String(name).trim().toLowerCase()
      ? ` (${unit.symbol})`
      : '';
    return `${name}${symbol}`;
  };

  const selectOptions = (Array.isArray(localUnits) ? localUnits : [])
    .filter((unit) => unit?.id)
    .map((unit) => ({
      value: unit.id,
      label: unitLabel(unit),
      unit,
    }));

  const baseUnitOptions = (Array.isArray(localUnits) ? localUnits : [])
    .filter((unit) => unit?.id && (!editingUnit || unit.id !== editingUnit.id))
    .map((unit) => ({
      value: unit.id,
      label: unitLabel(unit),
    }));

  const openCreate = () => {
    setEditingUnit(null);
    setUnitName('');
    setBaseUnitId(null);
    setConversionFactor(1);
    setEditorOpen(true);
  };

  const openEdit = (unit, e) => {
    e?.domEvent?.stopPropagation?.();
    e?.stopPropagation?.();
    setEditingUnit(unit);
    setUnitName(unit?.name || '');
    setBaseUnitId(unit?.base_unit_id || null);
    setConversionFactor(Number(unit?.conversion_factor) > 0 ? Number(unit.conversion_factor) : 1);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditingUnit(null);
    setUnitName('');
    setBaseUnitId(null);
    setConversionFactor(1);
  };

  const handleSave = async () => {
    const name = String(unitName || '').trim();
    if (!name) {
      message.warning('Enter a unit name');
      return;
    }
    const duplicate = localUnits.some((u) => (
      String(u.name || '').toLowerCase() === name.toLowerCase()
      && (!editingUnit || u.id !== editingUnit.id)
    ));
    if (duplicate) {
      message.warning(`Unit '${name}' already exists`);
      return;
    }
    if (baseUnitId && (!(Number(conversionFactor) > 0))) {
      message.warning('Conversion factor must be greater than 0');
      return;
    }

    setSavingUnit(true);
    try {
      const symbol = name.slice(0, 20);
      const factor = baseUnitId ? Number(conversionFactor) : 1;
      const payload = {
        name,
        symbol,
        type: editingUnit?.type || 'other',
        status: editingUnit?.status || 'active',
        base_unit_id: baseUnitId || null,
        conversion_factor: factor,
      };
      if (editingUnit?.id) {
        const response = await apiService.put(`/units/${editingUnit.id}`, payload);
        const updated = response?.id ? response : response?.data;
        const row = {
          ...editingUnit,
          ...(updated || {}),
          id: editingUnit.id,
          name: updated?.name || name,
          symbol: updated?.symbol || symbol,
          base_unit_id: updated?.base_unit_id ?? (baseUnitId || null),
          conversion_factor: updated?.conversion_factor ?? factor,
        };
        setLocalUnits((prev) => prev.map((u) => (u.id === editingUnit.id ? row : u)));
        message.success('Unit updated');
      } else {
        const response = await apiService.post('/units', payload);
        const created = response?.id ? response : response?.data;
        const createdId = created?.id;
        if (!createdId) {
          message.error(response?.error || 'Failed to add unit');
          return;
        }
        const createdRow = {
          id: createdId,
          name: created.name || name,
          symbol: created.symbol || symbol,
          type: created.type || 'other',
          status: created.status || 'active',
          base_unit_id: created.base_unit_id ?? (baseUnitId || null),
          conversion_factor: created.conversion_factor ?? factor,
        };
        setLocalUnits((prev) => {
          if (prev.some((u) => u.id === createdId)) return prev;
          return [...prev, createdRow];
        });
        form?.setFieldsValue?.({ unit: createdId });
        message.success('Unit added');
      }
      closeEditor();
      try {
        await onRefresh?.();
      } catch {
        // local list already updated
      }
    } catch (e) {
      message.error(
        e?.response?.data?.error
        || e?.userMessage
        || (editingUnit ? 'Failed to update unit' : 'Failed to add unit')
      );
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDelete = async (unit, e) => {
    e?.domEvent?.stopPropagation?.();
    e?.stopPropagation?.();
    try {
      await apiService.delete(`/units/${unit.id}`);
      setLocalUnits((prev) => prev.filter((u) => u.id !== unit.id));
      if (form?.getFieldValue?.('unit') === unit.id) {
        form.setFieldsValue({ unit: undefined });
      }
      message.success(`Unit '${unit.name}' deleted`);
      try {
        await onRefresh?.();
      } catch {
        // ignore
      }
    } catch {
      message.error('Failed to delete unit');
    }
  };

  return (
    <>
      <Form.Item label={label} required style={{ marginBottom: 0 }}>
        <Space.Compact style={{ width: '100%' }}>
          <Form.Item
            name="unit"
            noStyle
            rules={[{ required: true, message: requiredMessage }]}
          >
            <Select
              showSearch
              allowClear
              loading={loadingUnits}
              placeholder={selectOptions.length ? 'Select unit' : 'No units yet — click Add'}
              optionFilterProp="label"
              filterOption={filterSelectOption}
              options={selectOptions}
              optionRender={(option) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.label}</span>
                  {option.data?.unit && (
                    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <EditChip onClick={(ev) => openEdit(option.data.unit, ev)} />
                      <DeleteChip onClick={(ev) => handleDelete(option.data.unit, ev)} />
                    </span>
                  )}
                </div>
              )}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            title="Add unit"
          >
            Add
          </Button>
        </Space.Compact>
      </Form.Item>

      <Modal
        title={editingUnit ? 'Edit unit' : 'Add unit'}
        open={editorOpen}
        onCancel={closeEditor}
        onOk={handleSave}
        confirmLoading={savingUnit}
        okText={editingUnit ? 'Save' : 'Add unit'}
        destroyOnClose
        zIndex={1200}
      >
        <Form layout="vertical">
          <Form.Item label="Unit name" required style={{ marginBottom: 12 }}>
            <Input
              autoFocus
              placeholder="e.g. Kilograms, Grams, Liters"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              onPressEnter={(e) => {
                e.preventDefault();
                handleSave();
              }}
            />
          </Form.Item>
          <Form.Item
            label="Base unit (optional)"
            tooltip="Link this unit for BOM conversion. Example: Kilograms → base Grams, factor 1000."
            style={{ marginBottom: 12 }}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="None — this unit is a base"
              value={baseUnitId || undefined}
              options={baseUnitOptions}
              onChange={(value) => {
                setBaseUnitId(value || null);
                if (!value) setConversionFactor(1);
              }}
            />
          </Form.Item>
          <Form.Item
            label="Conversion factor"
            tooltip="How many base units equal 1 of this unit. Example: 1 kg = 1000 g → factor 1000."
            style={{ marginBottom: 0 }}
          >
            <InputNumber
              min={0.000001}
              step={1}
              style={{ width: '100%' }}
              disabled={!baseUnitId}
              value={conversionFactor}
              onChange={(value) => setConversionFactor(value)}
            />
          </Form.Item>
          {baseUnitId ? (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              1 {unitName || 'unit'} = {Number(conversionFactor) || '?'}{' '}
              {baseUnitOptions.find((o) => o.value === baseUnitId)?.label || 'base unit'}
            </Text>
          ) : (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Leave base empty for stock base units (e.g. Grams, Millilitres, Pieces).
            </Text>
          )}
        </Form>
      </Modal>
    </>
  );
}



export function BrandField({ form, brandOptions = [], onRefresh }) {
  const handleAdd = async () => {
    const raw = window.prompt('Enter new brand:');
    const name = String(raw || '').trim();
    if (!name || brandOptions.some((b) => b.name === name)) return;

    try {
      const response = await apiService.post('/brands', { name });
      const createdId = response?.id || response?.data?.id;
      if (createdId) {
        form?.setFieldsValue?.({ brand: createdId });
        await onRefresh?.();
        message.success('Brand added');
        return;
      }
      message.error(response?.error || 'Failed to add brand');
    } catch (e) {
      message.error(e?.response?.data?.error || e?.userMessage || 'Failed to add brand');
    }
  };

  const handleDelete = async (brand) => {
    try {
      await apiService.delete(`/brands/${brand.id}`);
      await onRefresh?.();
      if (form?.getFieldValue?.('brand') === brand.id) {
        form.setFieldsValue({ brand: undefined });
      }
      message.success(`Brand '${brand.name}' deleted`);
    } catch {
      message.error('Failed to delete brand');
    }
  };

  return (
    <Form.Item name="brand" label="Brand">
      <Select
        allowClear
        showSearch
        placeholder="Select or add brand"
        filterOption={filterSelectOption}
        dropdownRender={(menu) => (
          <div>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
              <Button type="link" size="small" onClick={handleAdd}>
                + Add Brand
              </Button>
            </div>
          </div>
        )}
      >
        {brandOptions.map((brand) => (
          <Select.Option key={brand.id} value={brand.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{brand.name}</span>
              <DeleteChip onClick={() => handleDelete(brand)} />
            </div>
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  );
}

export function ManufacturerField({ form, manufacturerOptions = [], onRefresh }) {
  const handleAdd = async () => {
    const raw = window.prompt('Enter new manufacturer:');
    const name = String(raw || '').trim();
    if (!name || manufacturerOptions.some((m) => m.name === name)) return;

    try {
      const response = await apiService.post('/manufacturers', { name });
      const createdId = response?.id || response?.data?.id;
      if (createdId) {
        form?.setFieldsValue?.({ manufacturer: createdId });
        await onRefresh?.();
        message.success('Manufacturer added');
        return;
      }
      message.error(response?.error || 'Failed to add manufacturer');
    } catch (e) {
      message.error(e?.response?.data?.error || e?.userMessage || 'Failed to add manufacturer');
    }
  };

  const handleDelete = async (manufacturer) => {
    try {
      await apiService.delete(`/manufacturers/${manufacturer.id}`);
      await onRefresh?.();
      if (form?.getFieldValue?.('manufacturer') === manufacturer.id) {
        form.setFieldsValue({ manufacturer: undefined });
      }
      message.success(`Manufacturer '${manufacturer.name}' deleted`);
    } catch {
      message.error('Failed to delete manufacturer');
    }
  };

  return (
    <Form.Item name="manufacturer" label="Manufacturer">
      <Select
        allowClear
        showSearch
        placeholder="Select or add manufacturer"
        filterOption={filterSelectOption}
        dropdownRender={(menu) => (
          <div>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
              <Button type="link" size="small" onClick={handleAdd}>
                + Add Manufacturer
              </Button>
            </div>
          </div>
        )}
      >
        {manufacturerOptions.map((manufacturer) => (
          <Select.Option key={manufacturer.id} value={manufacturer.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{manufacturer.name}</span>
              <DeleteChip onClick={() => handleDelete(manufacturer)} />
            </div>
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  );
}

export function resolveMasterDataIds(item = {}, { units = [], brandOptions = [], manufacturerOptions = [] } = {}) {
  const brandId = brandOptions.find((b) => b.name === item.brand || b.id === item.brand)?.id ?? item.brand;
  const manufacturerId = manufacturerOptions.find((m) => m.name === item.manufacturer || m.id === item.manufacturer)?.id ?? item.manufacturer;
  const unitId = units.find((u) => u.name === item.unit || u.id === item.unit)?.id ?? item.unit;
  return { brandId, manufacturerId, unitId };
}
