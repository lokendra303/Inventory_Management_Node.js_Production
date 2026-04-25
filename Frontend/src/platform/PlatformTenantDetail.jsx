import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card, Typography, Descriptions, Table, Button, Space, Tag, Spin, message, Modal, Form, Input, Row, Col,
  Tabs, Select, DatePicker, Tooltip, Empty,
} from 'antd';
import { ArrowLeftOutlined, EditOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import platformApi from '../services/platformApi';
import { institutionStatusLabel } from '../config/institutionDisplay';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function PlatformTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await platformApi.get(`/platform/institutions/${id}`);
        if (!cancelled && res.success) setPayload(res.data);
        else if (!cancelled) message.error(res.error || 'Not found');
      } catch (e) {
        if (!cancelled) message.error(e.response?.data?.error || e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const openEdit = () => {
    const inst = payload?.institution;
    if (!inst) return;
    form.setFieldsValue({
      name: inst.name,
      email: inst.email,
      mobile: inst.mobile || '',
      address: inst.address || '',
      city: inst.city || '',
      state: inst.state || '',
      country: inst.country || '',
      postal_code: inst.postal_code || '',
      website: inst.website || '',
      contact_person: inst.contact_person || '',
      plan: inst.plan || '',
      institution_type: inst.institution_type || '',
      registration_number: inst.registration_number || '',
      tax_id: inst.tax_id || '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await platformApi.patch(`/platform/institutions/${id}`, values);
      if (res.success && res.data) {
        message.success('Institution updated');
        setPayload(res.data);
        setEditOpen(false);
      } else message.error(res.error || 'Update failed');
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status) => {
    try {
      const res = await platformApi.patch(`/platform/institutions/${id}/status`, { status });
      if (res.success) {
        message.success(`Institution ${status === 'suspended' ? 'suspended' : 'activated'}`);
        const refreshed = await platformApi.get(`/platform/institutions/${id}`);
        if (refreshed.success) setPayload(refreshed.data);
      } else message.error(res.error);
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!payload?.institution) {
    return <Card>Institution not found.</Card>;
  }

  const { institution, stats, subscription, users } = payload;
  const sub = subscription || {};

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform/institutions')} style={{ marginBottom: 8, paddingLeft: 0 }}>
        Back to institutions
      </Button>
      <Title level={3} style={{ marginTop: 0 }}>{institution.name}</Title>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
          <Descriptions.Item label="ID">{institution.id}</Descriptions.Item>
          <Descriptions.Item label="Status">
            <Tag color={institution.status === 'active' ? 'green' : 'red'}>{institutionStatusLabel(institution.status)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Email">{institution.email}</Descriptions.Item>
          <Descriptions.Item label="Plan">{sub.plan_name || institution.plan || '—'}</Descriptions.Item>
          <Descriptions.Item label="Subscription">{sub.status || '—'}</Descriptions.Item>
          <Descriptions.Item label="City / Country">{institution.city || '—'} / {institution.country || '—'}</Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 16 }} wrap>
          <Button icon={<EditOutlined />} onClick={openEdit}>Edit institution</Button>
          {institution.status === 'active' ? (
            <Button danger onClick={() => setStatus('suspended')}>Suspend institution</Button>
          ) : (
            <Button type="primary" onClick={() => setStatus('active')}>Activate institution</Button>
          )}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Suspending blocks institution user login. Data is not deleted.
        </Typography.Paragraph>
      </Card>

      <RowCards stats={stats} />

      <Modal
        title="Edit institution"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={saveEdit}
        confirmLoading={saving}
        width={720}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Required' }, { type: 'email' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="mobile" label="Mobile">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="contact_person" label="Contact person">
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="address" label="Address">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="city" label="City">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="state" label="State">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="postal_code" label="Postal code">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="country" label="Country">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="website" label="Website">
                <Input placeholder="https://…" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="plan" label="Plan label (institution)">
                <Input placeholder="e.g. starter, standard" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="institution_type" label="Institution type">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="registration_number" label="Registration #">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="tax_id" label="Tax ID">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        destroyInactiveTabPane
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Card title={`Users (${users?.length || 0})`}>
                <Table
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10 }}
                  dataSource={users || []}
                  columns={[
                    { title: 'Email', dataIndex: 'email', key: 'email' },
                    { title: 'Name', key: 'name', render: (_, r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—' },
                    { title: 'Role', dataIndex: 'role', key: 'role' },
                    {
                      title: 'Status',
                      dataIndex: 'status',
                      key: 'status',
                      render: (v) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag>,
                    },
                    {
                      title: 'Last login',
                      dataIndex: 'last_login',
                      key: 'last_login',
                      render: (v) => (v ? new Date(v).toLocaleString() : '—'),
                    },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: 'activity',
            label: 'Activity & Audit',
            children: <InstitutionAuditTrail institutionId={id} users={users || []} />,
          },
        ]}
      />
    </div>
  );
}

function RowCards({ stats }) {
  if (!stats) return null;
  return (
    <Card style={{ marginBottom: 16 }} size="small">
      <Space size="large" wrap>
        <span><strong>Active users:</strong> {stats.activeUsers}</span>
        <span><strong>Active items:</strong> {stats.activeItems}</span>
        <span><strong>Warehouses:</strong> {stats.activeWarehouses}</span>
      </Space>
    </Card>
  );
}

const ACTION_COLORS = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN: 'purple',
  LOGOUT: 'default',
  VIEW: 'default',
};

function actionColor(action) {
  if (!action) return 'default';
  const key = String(action).toUpperCase();
  return ACTION_COLORS[key] || 'geekblue';
}

function InstitutionAuditTrail({ institutionId, users }) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterOpts, setFilterOpts] = useState({ entityTypes: [], actions: [] });

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [filters, setFilters] = useState({
    entityType: undefined,
    action: undefined,
    userId: undefined,
    search: '',
    startDate: undefined,
    endDate: undefined,
  });
  const [searchDraft, setSearchDraft] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        entityType: filters.entityType || undefined,
        action: filters.action || undefined,
        userId: filters.userId || undefined,
        search: filters.search || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };
      const res = await platformApi.get(`/platform/institutions/${institutionId}/audit`, { params });
      if (res.success) {
        setRows(res.data || []);
        setTotal(res.total || 0);
        if (res.filters) setFilterOpts(res.filters);
      } else {
        message.error(res.error || 'Failed to load audit trail');
      }
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [institutionId, page, limit, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const userOptions = useMemo(() => (users || []).map((u) => ({
    value: u.id,
    label: `${u.email}${u.first_name || u.last_name ? ` — ${`${u.first_name || ''} ${u.last_name || ''}`.trim()}` : ''}`,
  })), [users]);

  const onApplySearch = () => {
    setPage(1);
    setFilters((f) => ({ ...f, search: searchDraft.trim() }));
  };

  const onResetFilters = () => {
    setSearchDraft('');
    setPage(1);
    setFilters({
      entityType: undefined,
      action: undefined,
      userId: undefined,
      search: '',
      startDate: undefined,
      endDate: undefined,
    });
  };

  const columns = [
    {
      title: 'When',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (v) => (v ? <Tooltip title={new Date(v).toISOString()}>{new Date(v).toLocaleString()}</Tooltip> : '—'),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 110,
      render: (v) => (v ? <Tag color={actionColor(v)}>{v}</Tag> : '—'),
    },
    {
      title: 'Entity',
      key: 'entity',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text>{r.entity_type || '—'}</Text>
          {r.entity_id ? <Text type="secondary" style={{ fontSize: 12 }}>{r.entity_id}</Text> : null}
        </Space>
      ),
    },
    {
      title: 'User',
      key: 'user',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text>{r.user_name || r.user_email || (r.user_id ? r.user_id : '—')}</Text>
          {r.user_email && r.user_name ? <Text type="secondary" style={{ fontSize: 12 }}>{r.user_email}</Text> : null}
          {r.user_role ? <Tag style={{ marginTop: 2 }}>{r.user_role}</Tag> : null}
        </Space>
      ),
    },
    {
      title: 'Request',
      key: 'request',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {r.method || r.path ? (
            <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {r.method ? <Tag style={{ marginRight: 6 }}>{r.method}</Tag> : null}
              {r.path || ''}
            </Text>
          ) : (
            <Text type="secondary">—</Text>
          )}
          {r.status_code ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {`Status ${r.status_code}`}
              {typeof r.duration === 'number' ? ` · ${r.duration}ms` : ''}
              {r.ip_address ? ` · ${r.ip_address}` : ''}
            </Text>
          ) : null}
        </Space>
      ),
    },
    {
      title: 'Notes',
      dataIndex: 'description',
      key: 'description',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
  ];

  return (
    <Card
      title="Audit trail"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchLogs} loading={loading}>Refresh</Button>
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          allowClear
          placeholder="Search entity id, path, description…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onPressEnter={onApplySearch}
          prefix={<SearchOutlined />}
          style={{ width: 280 }}
        />
        <Button onClick={onApplySearch} type="primary">Search</Button>
        <Select
          allowClear
          placeholder="Entity type"
          style={{ minWidth: 180 }}
          value={filters.entityType}
          onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, entityType: v })); }}
          options={filterOpts.entityTypes.map((e) => ({ value: e, label: e }))}
          showSearch
        />
        <Select
          allowClear
          placeholder="Action"
          style={{ minWidth: 150 }}
          value={filters.action}
          onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, action: v })); }}
          options={filterOpts.actions.map((e) => ({ value: e, label: e }))}
          showSearch
        />
        <Select
          allowClear
          placeholder="User"
          style={{ minWidth: 240 }}
          value={filters.userId}
          onChange={(v) => { setPage(1); setFilters((f) => ({ ...f, userId: v })); }}
          options={userOptions}
          showSearch
          optionFilterProp="label"
        />
        <RangePicker
          allowEmpty={[true, true]}
          value={[
            filters.startDate ? dayjs(filters.startDate) : null,
            filters.endDate ? dayjs(filters.endDate) : null,
          ]}
          onChange={(range) => {
            setPage(1);
            setFilters((f) => ({
              ...f,
              startDate: range?.[0] ? range[0].format('YYYY-MM-DD') : undefined,
              endDate: range?.[1] ? range[1].format('YYYY-MM-DD') : undefined,
            }));
          }}
        />
        <Button onClick={onResetFilters}>Reset</Button>
      </Space>

      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        columns={columns}
        locale={{ emptyText: <Empty description="No audit activity for this institution yet" /> }}
        expandable={{
          expandedRowRender: (record) => <AuditRowDetail record={record} />,
          rowExpandable: (r) => Boolean(r.changes || r.request_body || r.description),
        }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: ['10', '25', '50', '100', '200'],
          showTotal: (t) => `${t} event${t === 1 ? '' : 's'}`,
          onChange: (p, ps) => { setPage(p); setLimit(ps); },
        }}
      />
    </Card>
  );
}

function AuditRowDetail({ record }) {
  const sections = [];
  if (record.description) {
    sections.push({ key: 'description', title: 'Description', content: record.description });
  }
  if (record.changes) {
    sections.push({ key: 'changes', title: 'Changes', content: formatJson(record.changes) });
  }
  if (record.request_body) {
    sections.push({ key: 'request_body', title: 'Request body', content: formatJson(record.request_body) });
  }
  if (!sections.length) return <Text type="secondary">No additional details.</Text>;
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {sections.map((s) => (
        <div key={s.key}>
          <Text strong>{s.title}</Text>
          <pre
            style={{
              background: '#0f172a',
              color: '#e2e8f0',
              padding: 12,
              borderRadius: 6,
              overflowX: 'auto',
              marginTop: 6,
              marginBottom: 0,
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {s.content}
          </pre>
        </div>
      ))}
    </Space>
  );
}

function formatJson(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
