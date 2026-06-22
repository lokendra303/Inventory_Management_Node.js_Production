import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Select, Space, Tag, Tooltip, message } from 'antd';
import { SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import batchGeneratorService from '../../services/batchGeneratorService';
import { buildKitBatchContext, showBatchGenerationError } from '../../utils/batchGeneration';

/**
 * Batch/lot number field with rule picker and Generate (batch coding machine).
 */
export default function BatchGeneratorField({
  compositeItemId,
  warehouseId,
  kitItem = null,
  warehouses = [],
  canManage = true,
  onOpenBatchRules = null,
  onPreviewChange = null,
}) {
  const form = Form.useFormInstance();
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [selectedRuleId, setSelectedRuleId] = useState(null);
  const [lastAppliedRule, setLastAppliedRule] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const loadRules = useCallback(async () => {
    setRulesLoading(true);
    try {
      const list = await batchGeneratorService.listRules('kit_assembly');
      const rows = Array.isArray(list) ? list : [];
      setRules(rows);
      setSelectedRuleId((prev) => {
        if (prev) return prev;
        const defaultRule = rows.find((r) => !!r.is_default);
        return defaultRule?.id || rows[0]?.id || null;
      });
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load batch coding rules');
    } finally {
      setRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const buildCtx = useCallback(() => buildKitBatchContext(form.getFieldsValue(), {
    compositeItemId,
    warehouseId,
    warehouses,
    kitItem,
    selectedRuleId,
  }), [compositeItemId, warehouseId, warehouses, kitItem, selectedRuleId, form]);

  const refreshPreview = useCallback(async () => {
    if (!compositeItemId || !warehouseId) return;
    setPreviewing(true);
    try {
      const ctx = buildCtx();
      const result = await batchGeneratorService.previewBatch(ctx);
      const preview = result?.preview || '';
      if (preview) {
        form.setFieldsValue({ outputBatchNumber: preview });
        onPreviewChange?.(result);
      }
    } catch (e) {
      // Non-fatal — rules table may not exist until migration runs
    } finally {
      setPreviewing(false);
    }
  }, [compositeItemId, warehouseId, buildCtx, form, onPreviewChange]);

  useEffect(() => {
    refreshPreview();
  }, [compositeItemId, warehouseId, selectedRuleId, refreshPreview]);

  const handleGenerate = async () => {
    if (!compositeItemId || !warehouseId) {
      message.warning('Select kit item and warehouse first');
      return;
    }
    setGenerating(true);
    try {
      const ctx = buildCtx();
      const generated = await batchGeneratorService.generateBatch(ctx);
      const batchNumber = generated?.batchNumber || '';
      if (batchNumber) {
        form.setFieldsValue({ outputBatchNumber: batchNumber, batchRuleId: generated.ruleId || selectedRuleId });
        const applied = generated?.ruleId ? rules.find((r) => r.id === generated.ruleId) : null;
        setLastAppliedRule(applied ? { id: applied.id, name: applied.name } : null);
        message.success(`Generated batch: ${batchNumber}${generated?.ruleName ? ` (${generated.ruleName})` : ''}`);
      }
    } catch (e) {
      showBatchGenerationError(e);
    } finally {
      setGenerating(false);
    }
  };

  const selectedRule = rules.find((r) => r.id === selectedRuleId);

  return (
    <div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Batch coding machine"
        description={
          selectedRule
            ? `Active rule: ${selectedRule.name} — template ${selectedRule.prefix_static || '(derived)'}`
            : 'Default kit rule applies: ASM-{SKU}-{DATE}-{SEQ}. Pick a rule or click Generate to allocate the next lot number.'
        }
      />

      <Form.Item name="batchRuleId" hidden>
        <Input />
      </Form.Item>

      <Form.Item
        name="outputBatchNumber"
        label={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>Output batch / lot number</span>
            {canManage && onOpenBatchRules && (
              <Tooltip title="Manage batch coding rules">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenBatchRules();
                  }}
                  style={{ width: 22, height: 22, minWidth: 22, padding: 0, borderRadius: '50%', color: '#764ba2' }}
                />
              </Tooltip>
            )}
          </span>
        )}
        rules={[{ required: true, message: 'Generate or enter a batch number' }]}
      >
        <Input placeholder="Click Generate or auto-preview" />
      </Form.Item>

      <div
        style={{
          marginBottom: 8,
          padding: 10,
          borderRadius: 12,
          border: '1px solid #edf0ff',
          background: 'linear-gradient(180deg, #fbfbff 0%, #f7f7ff 100%)',
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Select
            placeholder="Batch coding rule"
            value={selectedRuleId}
            allowClear
            loading={rulesLoading}
            onChange={(value) => {
              setSelectedRuleId(value || null);
              setLastAppliedRule(null);
            }}
            style={{ width: '100%' }}
            options={rules.map((r) => ({
              value: r.id,
              label: `${r.name}${r.scope === 'category' ? ` (${r.scope_value})` : ''}${r.is_default ? ' [Default]' : ''}`,
            }))}
          />
          {lastAppliedRule ? (
            <Tag color="purple">Applied: {lastAppliedRule.name}</Tag>
          ) : null}
          <Space style={{ width: '100%' }}>
            <Button loading={previewing} onClick={refreshPreview} disabled={!compositeItemId || !warehouseId}>
              Preview next
            </Button>
            <Button
              type="primary"
              loading={generating}
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              disabled={!compositeItemId || !warehouseId}
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
              }}
            >
              Generate batch
            </Button>
          </Space>
        </Space>
      </div>
    </div>
  );
}
