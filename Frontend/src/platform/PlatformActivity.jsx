import React, { useEffect, useState } from 'react';
import { Card, Table, Typography, Spin, Tag, Button, Space, Grid } from 'antd';import { ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import platformApi from '../services/platformApi';
import { institutionStatusLabel } from '../config/institutionDisplay';

const { Title, Paragraph } = Typography;

export default function PlatformActivity() {
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await platformApi.get('/platform/activity/recent-logins', { params: { limit: 50 } });
      if (res.success) setRows(res.data || []);
      else setError(res.error || 'Failed to load');
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && rows.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {isNarrow ? (
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>Recent institution logins</Title>
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Latest sign-ins across all institutions (from user records).
          </Paragraph>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} block>
            Refresh
          </Button>
        </div>
      ) : (
        <Space align="center" style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <div>
            <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>Recent institution logins</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Latest sign-ins across all institutions (from user records).
            </Paragraph>
          </div>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        </Space>
      )}

      {error && <Card style={{ marginBottom: 16 }}><Paragraph type="danger">{error}</Paragraph></Card>}

      <Card>
        <Table
          rowKey={(r) => `${r.user_id}-${r.last_login}`}
          size="small"
          loading={loading}
          pagination={{ pageSize: 15 }}
          dataSource={rows}
          scroll={{ x: 920 }}
          columns={[
            {
              title: 'Last login',
              dataIndex: 'last_login',
              key: 'last_login',
              width: 180,
              render: (t) => (t ? new Date(t).toLocaleString() : '—'),
            },
            {
              title: 'Institution',
              key: 'inst',
              render: (_, r) => (
                <Button
                  type="link"
                  style={{ padding: 0, height: 'auto' }}
                  onClick={() => navigate(`/platform/institutions/${r.institution_id}`)}
                >
                  {r.institution_name || '—'}
                </Button>
              ),
            },
            {
              title: 'Institution status',
              dataIndex: 'institution_status',
              key: 'is',
              width: 120,
              render: (v) => <Tag color={v === 'active' ? 'green' : 'red'}>{institutionStatusLabel(v)}</Tag>,
            },
            { title: 'User email', dataIndex: 'email', key: 'email', ellipsis: true },
            {
              title: 'Name',
              key: 'nm',
              width: 160,
              render: (_, r) => `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—',
            },
            { title: 'Role', dataIndex: 'role', key: 'role', width: 120 },
            {
              title: 'User',
              dataIndex: 'user_status',
              key: 'us',
              width: 90,
              render: (v) => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
