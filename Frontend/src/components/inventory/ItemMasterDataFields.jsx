import React from 'react';
import { Button, Form, Input, Select, message } from 'antd';
import apiService from '../../services/apiService';
import { filterSelectOption } from '../../utils/selectFilter';

const deleteChipStyle = {
  marginLeft: 8,
  width: 18,
  height: 18,
  borderRadius: '50%',
  backgroundColor: '#ff4d4f',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 'bold',
};

function DeleteChip({ onClick }) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      style={deleteChipStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#d9363e';
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#ff4d4f';
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      ×
    </span>
  );
}

export function CategoryField({
  form,
  categories = [],
  canViewCategories = true,
  canManageCategories = false,
  onRefresh,
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
      <Form.Item name="category" label="Category">
        <Input placeholder="Enter category name" />
      </Form.Item>
    );
  }

  return (
    <Form.Item name="category" label="Category">
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

export function UnitField({ form, units = [], onRefresh }) {
  const handleAdd = async () => {
    const raw = window.prompt('Enter new unit:');
    const name = String(raw || '').trim();
    if (!name || units.some((u) => String(u.name || '').toLowerCase() === name.toLowerCase())) return;

    try {
      const response = await apiService.post('/units', { name, symbol: name });
      if (response?.success) {
        const refreshed = await onRefresh?.();
        const created = refreshed?.units?.find((u) => u.name === name);
        if (created?.id) form?.setFieldsValue?.({ unit: created.id });
        message.success('Unit added');
      }
    } catch {
      message.error('Failed to add unit');
    }
  };

  const handleDelete = async (unit) => {
    try {
      await apiService.delete(`/units/${unit.id}`);
      await onRefresh?.();
      if (form?.getFieldValue?.('unit') === unit.id) {
        form.setFieldsValue({ unit: undefined });
      }
      message.success(`Unit '${unit.name}' deleted`);
    } catch {
      message.error('Failed to delete unit');
    }
  };

  return (
    <Form.Item name="unit" label="Unit" rules={[{ required: true, message: 'Unit is required' }]}>
      <Select
        showSearch
        allowClear
        placeholder="Select unit"
        filterOption={filterSelectOption}
        dropdownRender={(menu) => (
          <div>
            {menu}
            <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
              <Button type="link" size="small" onClick={handleAdd}>
                + Add Unit
              </Button>
            </div>
          </div>
        )}
      >
        {units.map((unit) => (
          <Select.Option key={unit.id} value={unit.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {unit.name}
                {unit.symbol && String(unit.symbol).trim().toLowerCase() !== String(unit.name || '').trim().toLowerCase()
                  ? ` (${unit.symbol})`
                  : ''}
              </span>
              <DeleteChip onClick={() => handleDelete(unit)} />
            </div>
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  );
}

export function BrandField({ form, brandOptions = [], onRefresh }) {
  const handleAdd = async () => {
    const raw = window.prompt('Enter new brand:');
    const name = String(raw || '').trim();
    if (!name || brandOptions.some((b) => b.name === name)) return;

    try {
      const response = await apiService.post('/brands', { name });
      if (response?.success) {
        const refreshed = await onRefresh?.();
        const created = refreshed?.brands?.find((b) => b.name === name);
        if (created?.id) form?.setFieldsValue?.({ brand: created.id });
        message.success('Brand added');
      }
    } catch {
      message.error('Failed to add brand');
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
      if (response?.success) {
        const refreshed = await onRefresh?.();
        const created = refreshed?.manufacturers?.find((m) => m.name === name);
        if (created?.id) form?.setFieldsValue?.({ manufacturer: created.id });
        message.success('Manufacturer added');
      }
    } catch {
      message.error('Failed to add manufacturer');
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
