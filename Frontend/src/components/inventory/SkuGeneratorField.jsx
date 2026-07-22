import React, { useCallback, useEffect, useState } from 'react';
import { Button, Form, Input, Select, Tag, Tooltip, message } from 'antd';
import { SettingOutlined, ThunderboltOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import skuGeneratorService from '../../services/skuGeneratorService';
import {
  buildSkuContextFromValues,
  ensureSkuRuleRequirements,
  showSkuGenerationError,
} from '../../utils/skuGeneration';
import { BOM_COLORS, primaryButtonStyle } from '../production/bomItemFormStyles';

/**
 * SKU input + rule picker + Generate button (same behaviour as Items add form).
 * Pass accentTheme="bom" for manufacturing teal chrome (BOM form).
 */
export default function SkuGeneratorField({
  excludeItemId = null,
  itemType = 'simple',
  units = [],
  warehouses = [],
  skuInputDisabled = false,
  canManage = true,
  onOpenSkuRules = null,
  skuLabel = 'SKU',
  accentTheme = 'default',
}) {
  const form = Form.useFormInstance();
  const [skuRules, setSkuRules] = useState([]);
  const [skuRulesLoading, setSkuRulesLoading] = useState(false);
  const [selectedSkuRuleId, setSelectedSkuRuleId] = useState(null);
  const [lastAppliedSkuRule, setLastAppliedSkuRule] = useState(null);
  const [skuGenerating, setSkuGenerating] = useState(false);

  const isBomTheme = accentTheme === 'bom';

  const loadSkuRules = useCallback(async () => {
    setSkuRulesLoading(true);
    try {
      const rules = await skuGeneratorService.listRules();
      const list = Array.isArray(rules) ? rules : [];
      setSkuRules(list);
      setSelectedSkuRuleId((prev) => {
        if (prev) return prev;
        const defaultRule = list.find((r) => !!r.is_default);
        return defaultRule?.id || null;
      });
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load SKU rules');
    } finally {
      setSkuRulesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSkuRules();
  }, [loadSkuRules]);

  const validateSkuAvailability = async (_, value) => {
    const sku = String(value || '').trim();
    if (!sku) return Promise.reject(new Error(`Please enter ${skuLabel}!`));
    try {
      const res = await apiService.get('/items/check-sku', {
        params: {
          sku,
          excludeItemId: excludeItemId || undefined,
        },
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

  const handleGenerateSku = async () => {
    setSkuGenerating(true);
    try {
      const values = form.getFieldsValue();
      const selectedRule = selectedSkuRuleId
        ? skuRules.find((r) => r.id === selectedSkuRuleId) || null
        : null;
      const ctx = buildSkuContextFromValues(values, {
        units,
        warehouses,
        itemType,
        selectedRuleId: selectedSkuRuleId,
      });

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
            ? { id: appliedRule.id, name: appliedRule.name }
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

  const ruleOptions = skuRules.map((r) => ({
    value: r.id,
    label: `${r.name}${r.scope === 'category' ? ` (Category: ${r.scope_value})` : ' (Institution)'}${r.is_default ? ' [Default]' : ''}`,
  }));

  const settingsBtnColor = isBomTheme ? BOM_COLORS.accent : '#764ba2';

  return (
    <div>
      <Form.Item
        name="sku"
        label={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>{skuLabel}</span>
            {canManage && onOpenSkuRules && (
              <Tooltip title="Manage SKU rules">
                <Button
                  type="text"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenSkuRules();
                  }}
                  style={{
                    width: 22,
                    height: 22,
                    minWidth: 22,
                    padding: 0,
                    borderRadius: '50%',
                    color: settingsBtnColor,
                  }}
                />
              </Tooltip>
            )}
          </span>
        }
        validateTrigger={['onBlur', 'onSubmit']}
        rules={[{ validator: validateSkuAvailability }]}
        style={{ marginBottom: isBomTheme ? 12 : 10 }}
      >
        <Input placeholder="e.g. KIT-001" disabled={skuInputDisabled} style={{ borderRadius: 8 }} />
      </Form.Item>
      {!skuInputDisabled && (
        isBomTheme ? (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${BOM_COLORS.border}`,
              background: '#f8fafb',
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
                style={{ flex: 1, minWidth: 0 }}
                options={ruleOptions}
              />
              <Tooltip title="Generate SKU using the selected rule (or auto-pick if none)">
                <Button
                  type="primary"
                  loading={skuGenerating}
                  icon={<ThunderboltOutlined />}
                  onClick={handleGenerateSku}
                  style={{
                    height: 32,
                    flexShrink: 0,
                    borderRadius: 8,
                    paddingInline: 14,
                    ...primaryButtonStyle,
                    boxShadow: 'none',
                    fontWeight: 600,
                  }}
                >
                  Generate
                </Button>
              </Tooltip>
            </div>
            <div
              style={{
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: 11, color: BOM_COLORS.slate, lineHeight: 1.4 }}>
                Leave empty to auto-pick (category rule → default → secondary)
              </span>
              {lastAppliedSkuRule ? (
                <Tag
                  style={{
                    marginInlineEnd: 0,
                    whiteSpace: 'nowrap',
                    borderColor: BOM_COLORS.accentMuted,
                    color: BOM_COLORS.accentDeep,
                    background: BOM_COLORS.accentSoft,
                  }}
                >
                  Applied: {lastAppliedSkuRule.name}
                </Tag>
              ) : null}
            </div>
          </div>
        ) : (
          <div
            style={{
              marginBottom: 8,
              padding: '10px 10px',
              borderRadius: 12,
              border: '1px solid #edf0ff',
              background: 'linear-gradient(180deg, #fbfbff 0%, #f7f7ff 100%)',
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
                options={ruleOptions}
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
                  fontWeight: 700,
                }}
              >
                Generate SKU
              </Button>
            </Tooltip>
          </div>
        )
      )}
    </div>
  );
}
