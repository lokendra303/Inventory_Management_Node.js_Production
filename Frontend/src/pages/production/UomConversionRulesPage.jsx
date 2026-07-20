import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CloudDownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { formatNumber } from '../../utils/numberFormat';
import { unitDisplayLabel } from '../../utils/unitConversion';

const { Text, Title } = Typography;

const TYPE_COLORS = {
  weight: 'orange',
  volume: 'blue',
  length: 'green',
  count: 'purple',
  other: 'default',
};

function unitLabel(unit) {
  return unitDisplayLabel(unit) || unit?.name || '—';
}

export default function UomConversionRulesPage() {
  const [units, setUnits] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const unitsById = useMemo(() => {
    const map = new Map();
    (units || []).forEach((u) => {
      if (u?.id) map.set(String(u.id), u);
    });
    return map;
  }, [units]);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/units');
      setUnits(Array.isArray(res) ? res : (res?.data || []));
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to load units');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await apiService.get('/units/standard-conversions');
      setCatalog(res);
    } catch {
      setCatalog(null);
    }
  }, []);

  useEffect(() => {
    loadUnits();
    loadCatalog();
  }, [loadUnits, loadCatalog]);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({
      name: '',
      symbol: '',
      type: 'other',
      base_unit_id: undefined,
      conversion_factor: 1,
    });
    setEditorOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      symbol: row.symbol,
      type: row.type || 'other',
      base_unit_id: row.base_unit_id || undefined,
      conversion_factor: Number(row.conversion_factor) > 0 ? Number(row.conversion_factor) : 1,
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const name = String(values.name || '').trim();
      const symbol = String(values.symbol || name).trim().slice(0, 20);
      const baseId = values.base_unit_id || null;
      const factor = baseId ? Number(values.conversion_factor) : 1;
      if (baseId && (!(factor > 0))) {
        message.warning('Conversion factor must be greater than 0');
        return;
      }
      setSaving(true);
      const payload = {
        name,
        symbol,
        type: values.type || 'other',
        base_unit_id: baseId,
        conversion_factor: factor,
        status: 'active',
      };
      if (editing?.id) {
        await apiService.put(`/units/${editing.id}`, payload);
        message.success('UOM rule updated');
      } else {
        await apiService.post('/units', payload);
        message.success('Custom UOM added');
      }
      setEditorOpen(false);
      await loadUnits();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e?.response?.data?.error || 'Failed to save UOM');
    } finally {
      setSaving(false);
    }
  };

  const applyStandards = async ({ updateExisting = false } = {}) => {
    setApplying(true);
    try {
      const result = await apiService.post('/units/apply-standards', {
        createMissing: true,
        updateExisting,
      });
      const created = result?.created?.length || 0;
      const updated = result?.updated?.length || 0;
      message.success(
        `Standards applied: ${created} created, ${updated} linked`
        + (result?.catalogVersion ? ` (${result.catalogVersion})` : '')
      );
      if (Array.isArray(result?.units)) setUnits(result.units);
      else await loadUnits();
      await loadCatalog();
    } catch (e) {
      message.error(e?.response?.data?.error || 'Failed to fetch/apply standard conversions');
    } finally {
      setApplying(false);
    }
  };

  const columns = [
    {
      title: 'Unit',
      key: 'unit',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.symbol}</Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 110,
      render: (type) => <Tag color={TYPE_COLORS[type] || 'default'}>{type || 'other'}</Tag>,
    },
    {
      title: 'Conversion rule',
      key: 'rule',
      render: (_, row) => {
        if (!row.base_unit_id) {
          return <Tag color="geekblue">Base unit</Tag>;
        }
        const base = unitsById.get(String(row.base_unit_id));
        return (
          <Text>
            1 {row.symbol || row.name} ={' '}
            <Text strong>{formatNumber(row.conversion_factor, 6)}</Text>{' '}
            {base ? unitLabel(base) : 'base'}
          </Text>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, row) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(row)}>
          Edit
        </Button>
      ),
    },
  ];

  const catalogRows = useMemo(() => {
    const rows = [];
    (catalog?.families || []).forEach((family) => {
      rows.push({
        key: `${family.family}-base`,
        family: family.family,
        name: family.base.name,
        symbol: family.base.symbol,
        formula: 'Base (factor 1)',
        isBase: true,
      });
      (family.units || []).forEach((u) => {
        rows.push({
          key: `${family.family}-${u.symbol}`,
          family: family.family,
          name: u.name,
          symbol: u.symbol,
          formula: u.formula,
          isBase: false,
        });
      });
    });
    return rows;
  }, [catalog]);

  const watchedBase = Form.useWatch('base_unit_id', form);
  const watchedFactor = Form.useWatch('conversion_factor', form);
  const watchedName = Form.useWatch('name', form);

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
          borderRadius: 16,
          padding: '22px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          boxShadow: '0 8px 32px rgba(15, 118, 110, 0.28)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <SwapOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>UOM conversion rules</div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, maxWidth: 680 }}>
              Define how BOM consumption units convert to stock units (e.g. 1 kg = 1000 g).
              Fetch SI / common standard conversions, or add custom pack rules for your organization.
            </div>
          </div>
        </div>
        <Space wrap>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => { loadUnits(); loadCatalog(); }}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={applying}
            onClick={() => applyStandards({ updateExisting: false })}
            style={{ background: '#fff', color: '#0f766e', borderColor: '#fff', fontWeight: 600 }}
          >
            Fetch standard conversions
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card
            variant="borderless"
            style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
            title={<Title level={5} style={{ margin: 0 }}>Your UOM rules</Title>}
            extra={(
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add custom UOM
              </Button>
            )}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="BOM uses these links when converting grams ↔ kilograms, ml ↔ liters, and custom packs."
              description="Custom links you already set are preserved when fetching standards (unless you force-update)."
            />
            <Space style={{ marginBottom: 12 }}>
              <Button
                size="small"
                loading={applying}
                onClick={() => {
                  Modal.confirm({
                    title: 'Overwrite existing conversion links?',
                    content: 'This re-applies SI factors even if a unit already has a custom base/factor.',
                    okText: 'Force update',
                    onOk: () => applyStandards({ updateExisting: true }),
                  });
                }}
              >
                Force re-apply standards
              </Button>
            </Space>
            <Table
              rowKey="id"
              loading={loading}
              columns={columns}
              dataSource={units}
              pagination={{ pageSize: 12, showSizeChanger: true }}
              size="middle"
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card
            variant="borderless"
            style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
            title={<Title level={5} style={{ margin: 0 }}>Standard catalog</Title>}
            extra={catalog?.catalogVersion ? <Tag>{catalog.catalogVersion}</Tag> : null}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              {catalog?.source || 'SI / common factors'} — fetched from server for BOM-ready linking.
            </Text>
            <Table
              rowKey="key"
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={catalogRows}
              columns={[
                {
                  title: 'Family',
                  dataIndex: 'family',
                  width: 90,
                  render: (v) => <Tag color={TYPE_COLORS[v] || 'default'}>{v}</Tag>,
                },
                {
                  title: 'Unit',
                  key: 'name',
                  render: (_, r) => `${r.name} (${r.symbol})`,
                },
                {
                  title: 'Rule',
                  dataIndex: 'formula',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        title={editing ? 'Edit UOM rule' : 'Add custom UOM'}
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editing ? 'Save' : 'Add UOM'}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Unit name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="e.g. Sachet, Pack of 250g, Dozen" />
          </Form.Item>
          <Form.Item name="symbol" label="Symbol">
            <Input placeholder="e.g. sachet, pkt, dz" maxLength={20} />
          </Form.Item>
          <Form.Item name="type" label="Measurement type" initialValue="other">
            <Select
              options={[
                { value: 'weight', label: 'Weight' },
                { value: 'volume', label: 'Volume' },
                { value: 'length', label: 'Length' },
                { value: 'count', label: 'Count' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="base_unit_id"
            label="Base unit"
            tooltip="Leave empty if this unit is itself a base (e.g. Grams, Pieces)."
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="None — this is a base unit"
              options={(units || [])
                .filter((u) => !editing || u.id !== editing.id)
                .map((u) => ({ value: u.id, label: unitLabel(u) }))}
            />
          </Form.Item>
          <Form.Item
            name="conversion_factor"
            label="Conversion factor"
            tooltip="How many base units equal 1 of this unit. Example: 1 kg = 1000 g → factor 1000."
          >
            <InputNumber min={0.000001} step={1} style={{ width: '100%' }} disabled={!watchedBase} />
          </Form.Item>
          {watchedBase ? (
            <Text type="secondary">
              1 {watchedName || 'unit'} = {formatNumber(watchedFactor, 6)}{' '}
              {unitLabel(unitsById.get(String(watchedBase)))}
            </Text>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
}
