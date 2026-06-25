import React, { useEffect, useState } from 'react';
import {
  Form, Input, Select, InputNumber, Row, Col, Divider, Tag, Typography, Alert, Switch,
} from 'antd';
import {
  CODE_TEMPLATE_TOKENS,
  DERIVED_SOURCE_OPTIONS,
  DERIVED_SOURCE_LABELS,
  DEFAULT_DERIVED_CFG,
  preserveSelectionOrder,
  previewCodeFromFormValues,
  ADVANCED_TOKEN_HELP,
} from '../../utils/codeGeneratorConfig';

const { Text } = Typography;

/**
 * Advanced SKU / batch template editor — static tokens, derived field mode, live preview.
 */
export default function CodeRuleEditor({
  form,
  ruleKind = 'sku',
  showContextField = false,
  contextOptions = [],
  categoryOptions = [],
  samplePreviewContext = {},
}) {
  const [preview, setPreview] = useState('');

  const watched = Form.useWatch([], form);

  const refreshPreview = () => {
    try {
      const values = form.getFieldsValue(true);
      if (!values.prefixStatic && values.prefixMode !== 'derived') {
        setPreview('');
        return;
      }
      if (values.prefixMode === 'derived' && !(values.prefixSources || []).length) {
        setPreview('');
        return;
      }
      const ctx = {
        ...samplePreviewContext,
        context: values.context || samplePreviewContext.context,
        category: values.scope === 'category' ? (values.scopeValue || samplePreviewContext.category) : samplePreviewContext.category,
      };
      const counter = Math.max(1, Number(values.counterStart) || 1);
      setPreview(previewCodeFromFormValues(values, ctx, counter));
    } catch {
      setPreview('');
    }
  };

  useEffect(() => {
    refreshPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched]);

  const insertToken = (token) => {
    const current = form.getFieldValue('prefixStatic') || '';
    const next = current ? `${current}${current.endsWith('-') || current.endsWith('_') ? '' : '-'}${token}` : token;
    form.setFieldsValue({ prefixStatic: next, prefixMode: 'static' });
    refreshPreview();
  };

  const labelPrefix = ruleKind === 'batch' ? 'Batch / lot template' : 'SKU template';

  return (
    <>
      {showContextField && (
        <Form.Item name="context" label="Rule type (when this applies)" rules={[{ required: true }]}>
          <Select options={contextOptions} onChange={refreshPreview} />
        </Form.Item>
      )}

      <Form.Item name="scope" label="Scope" rules={[{ required: true }]}>
        <Select
          options={[
            { value: 'default', label: 'Institution-wide' },
            { value: 'category', label: 'Category override' },
          ]}
          onChange={refreshPreview}
        />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(p, c) => p.scope !== c.scope}>
        {({ getFieldValue }) => getFieldValue('scope') === 'category' && (
          <Form.Item name="scopeValue" label="Category" rules={[{ required: true }]}>
            {categoryOptions.length > 0 ? (
              <Select
                showSearch
                allowClear
                placeholder="Select category"
                options={categoryOptions.map((c) => ({ value: c, label: c }))}
                onChange={refreshPreview}
              />
            ) : (
              <Input placeholder="e.g. Gift Sets" onChange={refreshPreview} />
            )}
          </Form.Item>
        )}
      </Form.Item>

      <Form.Item name="prefixMode" label="Template style" rules={[{ required: true }]}>
        <Select
          onChange={refreshPreview}
          options={[
            { value: 'static', label: 'Custom template (tokens)' },
            { value: 'derived', label: 'Build from item fields (guided)' },
          ]}
        />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(p, c) => p.prefixMode !== c.prefixMode}>
        {({ getFieldValue }) => {
          const mode = getFieldValue('prefixMode');
          return mode === 'static' ? (
            <>
              <Form.Item
                name="prefixStatic"
                label={labelPrefix}
                rules={[{ required: true, message: 'Enter a template' }]}
                extra="Use tokens below. Advanced: {TOKEN|length|mode}"
              >
                <Input.TextArea
                  rows={2}
                  placeholder={ruleKind === 'batch' ? 'ASM-{BRAND|3|abbr}-{SKU}-{DATE}-{SEQ}' : '{BRAND|3|abbr}-{ITEM|4|slice}-{VARIANT}-{SEQ}'}
                  onChange={refreshPreview}
                />
              </Form.Item>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>Insert token</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CODE_TEMPLATE_TOKENS.map((tok) => (
                    <Tag
                      key={tok}
                      style={{ cursor: 'pointer', margin: 0 }}
                      onClick={() => insertToken(tok)}
                    >
                      {tok}
                    </Tag>
                  ))}
                </div>
              </div>
              <Alert
                type="info"
                showIcon={false}
                style={{ marginBottom: 12, fontSize: 12 }}
                message={ADVANCED_TOKEN_HELP.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              />
            </>
          ) : (
            <Form.Item noStyle shouldUpdate={(p, c) =>
              p.prefixSources !== c.prefixSources || p.prefixSourceConfig !== c.prefixSourceConfig
            }>
              {({ getFieldValue: gfv }) => {
                const selected = Array.isArray(gfv('prefixSources'))
                  ? gfv('prefixSources').filter(Boolean)
                  : [];
                return (
                  <>
                    <Form.Item
                      name="prefixSources"
                      label="Source fields"
                      rules={[{ required: true, message: 'Select at least one field' }]}
                    >
                      <Select
                        mode="multiple"
                        maxTagCount="responsive"
                        placeholder="Choose fields — order matters"
                        options={DERIVED_SOURCE_OPTIONS}
                        onChange={(nextValues) => {
                          const prevValues = form.getFieldValue('prefixSources') || [];
                          form.setFieldsValue({ prefixSources: preserveSelectionOrder(prevValues, nextValues) });
                          refreshPreview();
                        }}
                      />
                    </Form.Item>
                    {selected.length > 0 && (
                      <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 10, marginBottom: 12, background: '#fcfcff' }}>
                        {selected.map((src) => (
                          <Row gutter={10} key={src} style={{ marginBottom: 10, padding: '8px 8px 2px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8 }}>
                            <Col xs={24} sm={8}>
                              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Field</div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{DERIVED_SOURCE_LABELS[src] || src}</div>
                            </Col>
                            <Col xs={12} sm={8}>
                              <Form.Item noStyle shouldUpdate>
                                {() => {
                                  const m = form.getFieldValue(['prefixSourceConfig', src, 'mode']) || 'abbr';
                                  return (
                                    <Form.Item
                                      name={['prefixSourceConfig', src, 'len']}
                                      label={m === 'abbr' ? 'Max initials' : 'Chars'}
                                      style={{ marginBottom: 0 }}
                                      initialValue={DEFAULT_DERIVED_CFG.len}
                                    >
                                      <InputNumber min={1} max={20} style={{ width: '100%' }} onChange={refreshPreview} />
                                    </Form.Item>
                                  );
                                }}
                              </Form.Item>
                            </Col>
                            <Col xs={12} sm={8}>
                              <Form.Item
                                name={['prefixSourceConfig', src, 'mode']}
                                label="Pick style"
                                style={{ marginBottom: 0 }}
                                initialValue={DEFAULT_DERIVED_CFG.mode}
                              >
                                <Select onChange={refreshPreview}>
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
          );
        }}
      </Form.Item>

      {preview && (
        <Alert
          type="success"
          style={{ marginBottom: 12 }}
          message="Live preview (sample item)"
          description={<Text code copyable>{preview}</Text>}
        />
      )}

      <Form.Item name="separator" label="Separator" style={{ marginBottom: 10 }}>
        <Select onChange={refreshPreview}>
          <Select.Option value="-">Dash (-)</Select.Option>
          <Select.Option value="_">Underscore (_)</Select.Option>
          <Select.Option value="">None</Select.Option>
        </Select>
      </Form.Item>

      <Divider style={{ margin: '10px 0 14px', fontSize: 12 }} orientation="left">Date segment (optional)</Divider>
      <Row gutter={12}>
        <Col span={10}>
          <Form.Item name="useDate" label="Include date" style={{ marginBottom: 10 }}>
            <Select onChange={refreshPreview}>
              <Select.Option value={false}>No</Select.Option>
              <Select.Option value={true}>Yes</Select.Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={14}>
          <Form.Item noStyle shouldUpdate={(p, c) => p.useDate !== c.useDate}>
            {({ getFieldValue }) => getFieldValue('useDate') ? (
              <Form.Item name="dateFormat" label="Format" rules={[{ required: true }]}>
                <Select onChange={refreshPreview}>
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
            <Select onChange={refreshPreview}>
              <Select.Option value={true}>Yes</Select.Option>
              <Select.Option value={false}>No</Select.Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="counterStart" label="Start at">
            <InputNumber min={1} style={{ width: '100%' }} onChange={refreshPreview} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="counterPadding" label="Zero-pad width">
            <InputNumber min={1} max={10} style={{ width: '100%' }} onChange={refreshPreview} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="isDefault" label="Default rule" valuePropName="checked">
        <Switch />
      </Form.Item>
    </>
  );
}
