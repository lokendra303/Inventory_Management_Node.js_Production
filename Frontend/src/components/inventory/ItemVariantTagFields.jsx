import React from 'react';
import { Button, Col, Form, Row, Select, Typography, message } from 'antd';
import apiService from '../../services/apiService';
import { getVariantLibraryValuesByAliases } from '../../utils/variantLibraryHelpers';

const { Text } = Typography;

function VariantMetaSelect({
  name,
  label,
  tooltip,
  aliases,
  attributeName,
  variantLibrary,
  canManage,
  onRefresh,
}) {
  const form = Form.useFormInstance();
  const options = getVariantLibraryValuesByAliases(variantLibrary, aliases);

  const addValue = async () => {
    const raw = window.prompt(`Add ${attributeName} value:`);
    const value = String(raw || '').trim();
    if (!value) return;
    try {
      await apiService.put('/items/variant-library/entry', { name: aliases[0], values: [value] });
      await onRefresh?.();
      form.setFieldsValue({ [name]: value });
      message.success(`${attributeName} added`);
    } catch (e) {
      message.error(e?.response?.data?.error || `Failed to add ${attributeName}`);
    }
  };

  const deleteValue = async (value) => {
    try {
      await apiService.delete('/items/variant-library/entry', {
        params: { name: aliases[0], value },
      });
      await onRefresh?.();
      const current = form.getFieldValue(name);
      if (String(current || '').trim() === String(value || '').trim()) {
        form.setFieldsValue({ [name]: undefined });
      }
      message.success(`${attributeName} removed`);
    } catch (e) {
      message.error(e?.response?.data?.error || `Failed to remove ${attributeName}`);
    }
  };

  return (
    <Form.Item name={name} label={label} tooltip={tooltip}>
      <Select
        showSearch
        allowClear
        optionFilterProp="title"
        placeholder={`Select ${label.toLowerCase()}`}
        dropdownRender={(menu) => (
          <div>
            {menu}
            {canManage ? (
              <div style={{ padding: '8px', borderTop: '1px solid #f0f0f0' }}>
                <Button type="link" size="small" onClick={addValue}>
                  {`+ Add ${label}`}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      >
        {options.map((v) => (
          <Select.Option key={v} value={v} title={v}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{v}</span>
              {canManage ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteValue(v);
                  }}
                  style={{ marginLeft: 8, color: '#ff4d4f', fontWeight: 700, cursor: 'pointer' }}
                >
                  ×
                </span>
              ) : null}
            </div>
          </Select.Option>
        ))}
      </Select>
    </Form.Item>
  );
}

/**
 * Optional variant / packing / colour / size tags for simple and composite items (not multi-variant matrix).
 */
export default function ItemVariantTagFields({
  variantLibrary = [],
  canManage = false,
  onRefreshVariantLibrary,
}) {
  return (
    <>
      <div
        style={{
          marginBottom: 14,
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid #e6ecff',
          background: 'linear-gradient(180deg, #fbfcff 0%, #f7f9ff 100%)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#3659c9', marginBottom: 4 }}>
          Quick variant tags
        </div>
        <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.6 }}>
          Optional descriptors such as colour, size, or packing. They help with SKU generation and search.
        </Text>
      </div>
      <Row gutter={16}>
        <Col xs={24} sm={12} md={6}>
          <VariantMetaSelect
            name="variant"
            label="Variant / Packing"
            tooltip="Example: ALOE, 7G, PREMIUM, 100ML"
            aliases={['variant', 'packing', 'pack']}
            attributeName="Variant/Packing"
            variantLibrary={variantLibrary}
            canManage={canManage}
            onRefresh={onRefreshVariantLibrary}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <VariantMetaSelect
            name="colorCode"
            label="Colour"
            tooltip="Colour or shade code for SKU and search"
            aliases={['color', 'colour']}
            attributeName="Colour"
            variantLibrary={variantLibrary}
            canManage={canManage}
            onRefresh={onRefreshVariantLibrary}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <VariantMetaSelect
            name="sizeCode"
            label="Size"
            tooltip="Size label for SKU and search"
            aliases={['size']}
            attributeName="Size"
            variantLibrary={variantLibrary}
            canManage={canManage}
            onRefresh={onRefreshVariantLibrary}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <VariantMetaSelect
            name="packType"
            label="Pack type"
            tooltip="Packaging type such as box, bottle, or carton"
            aliases={['pack type', 'packtype', 'type']}
            attributeName="Pack Type"
            variantLibrary={variantLibrary}
            canManage={canManage}
            onRefresh={onRefreshVariantLibrary}
          />
        </Col>
      </Row>
    </>
  );
}
