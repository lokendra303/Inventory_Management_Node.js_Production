import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, DatePicker, Select, Space, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import batchGeneratorService from '../../services/batchGeneratorService';
import { buildOpeningBatchPreviewContext } from '../../utils/batchGeneration';

const { Text } = Typography;

/**
 * Opening stock batch preview for BOM create (before item id exists).
 * Final batch is allocated on server when the item is saved.
 */
export default function OpeningBatchFields({
  form,
  warehouses = [],
  hasExpiry = false,
  canManageRules = false,
}) {
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState(null);

  const openingStock = Form.useWatch('openingStock', form);
  const warehouseId = Form.useWatch('warehouseId', form);
  const sku = Form.useWatch('sku', form);
  const name = Form.useWatch('name', form);
  const category = Form.useWatch('category', form);
  const showSection = Number(openingStock) > 0 && Boolean(warehouseId);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const list = await batchGeneratorService.listRules('opening_stock');
      const rows = Array.isArray(list) ? list : [];
      setRules(rows);
      setSelectedRuleId((prev) => prev || rows.find((r) => r.is_default)?.id || rows[0]?.id || null);
    } catch {
      setRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showSection) loadRules();
  }, [showSection, loadRules]);

  const refreshPreview = useCallback(async () => {
    if (!showSection || !sku) return;
    try {
      const ctx = buildOpeningBatchPreviewContext(form.getFieldsValue(), {
        warehouses,
        selectedRuleId,
      });
      const result = await batchGeneratorService.previewBatch(ctx);
      if (result?.preview) {
        form.setFieldsValue({
          openingBatchNumber: result.preview,
          openingBatchRuleId: result.rule?.id || selectedRuleId,
        });
      }
    } catch {
      // rules table may be missing until migration
    }
  }, [showSection, sku, form, warehouses, selectedRuleId]);

  useEffect(() => {
    refreshPreview();
  }, [openingStock, warehouseId, sku, name, category, selectedRuleId, refreshPreview]);

  useEffect(() => {
    if (showSection) {
      form.setFieldsValue({ isBatchTracked: true });
    }
  }, [showSection, form]);

  if (!showSection) return null;

  const selectedRule = rules.find((r) => r.id === selectedRuleId);

  return (
    <div style={{ marginBottom: 16 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Opening stock batch (production-style)"
        description={(
          <span>
            Opening balance gets one warehouse lot via opening-stock rules (e.g. OPEN-{'{SKU}'}-{'{DATE}'}-{'{SEQ}'}). The lot is created when you save this BOM item.
            {canManageRules ? (
              <>
                {' '}
                <Link to="/production/batch-rules">Manage batch coding rules</Link>
              </>
            ) : null}
          </span>
        )}
      />

      <Form.Item name="openingBatchRuleId" hidden>
        <Input />
      </Form.Item>

      <Form.Item
        name="openingBatchNumber"
        label="Opening batch / lot number"
        extra="Preview until save — server allocates the counter on create. Edit to use a custom lot."
      >
        <Input placeholder="OPEN-SKU-20260622-001" />
      </Form.Item>

      <Space style={{ width: '100%', marginBottom: 12 }} wrap>
        <Select
          placeholder="Opening batch rule"
          value={selectedRuleId}
          loading={rulesLoading}
          onChange={setSelectedRuleId}
          style={{ minWidth: 260 }}
          options={rules.map((r) => ({
            value: r.id,
            label: `${r.name}${r.is_default ? ' [Default]' : ''}`,
          }))}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {selectedRule?.prefix_static ? `Template: ${selectedRule.prefix_static}` : 'Default: OPEN-{SKU}-{DATE}-{SEQ}'}
        </Text>
        {canManageRules ? (
          <Link to="/production/batch-rules">
            <Button size="small" icon={<SettingOutlined />}>Manage rules</Button>
          </Link>
        ) : null}
      </Space>

      <Space wrap>
        <Form.Item name="openingManufactureDate" label="Mfg date (optional)">
          <DatePicker format="DD MMM YYYY" />
        </Form.Item>
        <Form.Item
          name="openingExpiryDate"
          label="Expiry date"
          rules={hasExpiry ? [{ required: true, message: 'Expiry required' }] : []}
        >
          <DatePicker
            format="DD MMM YYYY"
            disabledDate={(d) => d && d.isBefore(dayjs(), 'day')}
          />
        </Form.Item>
      </Space>
    </div>
  );
}
