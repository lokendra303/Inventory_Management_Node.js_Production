import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Descriptions, Table, Button, Space, Tag, Spin, message,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import platformApi from '../services/platformApi';

const { Title } = Typography;

function institutionStatusLabel(dbStatus) {
  if (dbStatus === 'inactive') return 'Suspended';
  if (dbStatus === 'active') return 'Active';
  return dbStatus || '—';
}

export default function PlatformTenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);

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

  const setStatus = async (status) => {
    try {
      const res = await platformApi.patch(`/platform/institutions/${id}/status`, { status });
      if (res.success) {
        message.success(`Tenant ${status === 'suspended' ? 'suspended' : 'activated'}`);
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
    return <Card>Tenant not found.</Card>;
  }

  const { institution, stats, subscription, users } = payload;
  const sub = subscription || {};

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform/tenants')} style={{ marginBottom: 8, paddingLeft: 0 }}>
        Back to tenants
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
        <Space style={{ marginTop: 16 }}>
          {institution.status === 'active' ? (
            <Button danger onClick={() => setStatus('suspended')}>Suspend tenant</Button>
          ) : (
            <Button type="primary" onClick={() => setStatus('active')}>Activate tenant</Button>
          )}
        </Space>
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          Suspending blocks tenant login. Data is not deleted.
        </Typography.Paragraph>
      </Card>

      <RowCards stats={stats} />

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
          ]}
        />
      </Card>
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
