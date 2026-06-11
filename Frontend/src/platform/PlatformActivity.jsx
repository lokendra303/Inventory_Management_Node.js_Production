import React, { useEffect, useState } from 'react';
import {
  Card, Table, Typography, Spin, Tag, Button, Space, Grid, Tabs, Input, Popconfirm, message,
} from 'antd';
import { ReloadOutlined, LogoutOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import platformApi from '../services/platformApi';
import { institutionStatusLabel } from '../config/institutionDisplay';

const { Title, Paragraph, Text } = Typography;
const { Search } = Input;

function formatWhen(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function shortAgent(ua) {
  if (!ua) return '—';
  const s = String(ua);
  return s.length > 72 ? `${s.slice(0, 72)}…` : s;
}

export default function PlatformActivity() {
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const navigate = useNavigate();
  const [tab, setTab] = useState('active');
  const [loading, setLoading] = useState(true);
  const [recentRows, setRecentRows] = useState([]);
  const [activeRows, setActiveRows] = useState([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeWindowMinutes, setActiveWindowMinutes] = useState(30);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(null);

  const loadRecent = async () => {
    const res = await platformApi.get('/platform/activity/recent-logins', { params: { limit: 50 } });
    if (res.success) setRecentRows(res.data || []);
    else throw new Error(res.error || 'Failed to load recent logins');
  };

  const loadActive = async (page = activePage, q = search) => {
    const res = await platformApi.get('/platform/activity/active-sessions', {
      params: { page, limit: 20, search: q || undefined },
    });
    if (res.success) {
      setActiveRows(res.data || []);
      setActiveTotal(res.total || 0);
      setActivePage(res.page || page);
      if (res.activeWindowMinutes) setActiveWindowMinutes(res.activeWindowMinutes);
    } else {
      throw new Error(res.error || 'Failed to load active sessions');
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'active') await loadActive(activePage, search);
      else await loadRecent();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const revokeSession = async (sessionId) => {
    setRevoking(sessionId);
    try {
      const res = await platformApi.post(`/platform/activity/sessions/${sessionId}/revoke`, {});
      if (res.success) {
        message.success('Session ended — user will be logged out on their next request');
        await loadActive(activePage, search);
      } else {
        message.error(res.error || 'Failed to end session');
      }
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setRevoking(null);
    }
  };

  const revokeUserSessions = async (userId) => {
    setRevoking(`user-${userId}`);
    try {
      const res = await platformApi.post(`/platform/activity/users/${userId}/revoke-sessions`, {});
      if (res.success) {
        message.success(res.message || 'User sessions ended');
        await loadActive(activePage, search);
      } else {
        message.error(res.error || 'Failed to end sessions');
      }
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setRevoking(null);
    }
  };

  const revokeInstitutionSessions = async (institutionId) => {
    setRevoking(`inst-${institutionId}`);
    try {
      const res = await platformApi.post(`/platform/activity/institutions/${institutionId}/revoke-sessions`, {});
      if (res.success) {
        message.success(res.message || 'Institution sessions ended');
        await loadActive(activePage, search);
      } else {
        message.error(res.error || 'Failed to end sessions');
      }
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setRevoking(null);
    }
  };

  const header = (
    <>
      {isNarrow ? (
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>Sessions & activity</Title>
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            View who is logged in now and force logout users or entire institutions.
          </Paragraph>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} block>
            Refresh
          </Button>
        </div>
      ) : (
        <Space align="center" style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <div>
            <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>Sessions & activity</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              View who is logged in now and force logout users or entire institutions.
            </Paragraph>
          </div>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        </Space>
      )}
    </>
  );

  if (loading && recentRows.length === 0 && activeRows.length === 0) {
    return (
      <div>
        {header}
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      </div>
    );
  }

  const activeColumns = [
    {
      title: 'Last active',
      dataIndex: 'last_activity_at',
      key: 'last_activity_at',
      width: 180,
      render: formatWhen,
    },
    {
      title: 'Institution',
      key: 'inst',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/platform/institutions/${r.institution_id}`)}
          >
            {r.institution_name || '—'}
          </Button>
          <Tag color={r.institution_status === 'active' ? 'green' : 'red'} style={{ width: 'fit-content' }}>
            {institutionStatusLabel(r.institution_status)}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'User email',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
      render: (email, r) => (
        <Button
          type="link"
          style={{ padding: 0, height: 'auto' }}
          onClick={() => navigate(`/platform/activity/sessions/${r.session_id}`)}
        >
          {email}
        </Button>
      ),
    },
    {
      title: 'Name',
      key: 'nm',
      width: 140,
      render: (_, r) => {
        const name = `${r.first_name || ''} ${r.last_name || ''}`.trim() || '—';
        return (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/platform/activity/sessions/${r.session_id}`)}
          >
            {name}
          </Button>
        );
      },
    },
    { title: 'Role', dataIndex: 'role', key: 'role', width: 110 },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 120,
      render: (v) => v || '—',
    },
    {
      title: 'Location',
      dataIndex: 'location_label',
      key: 'location_label',
      width: 160,
      ellipsis: true,
      render: (v, r) => v || (r.ip_address === '127.0.0.1' ? 'Local network' : '—'),
    },
    {
      title: 'Device',
      dataIndex: 'user_agent',
      key: 'user_agent',
      ellipsis: true,
      render: shortAgent,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<EyeOutlined />}
            onClick={() => navigate(`/platform/activity/sessions/${r.session_id}`)}
          >
            View
          </Button>
          <Popconfirm
            title="End this session?"
            description="The user will be logged out on their next API call."
            onConfirm={() => revokeSession(r.session_id)}
            okText="End session"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<LogoutOutlined />}
              loading={revoking === r.session_id}
            >
              Session
            </Button>
          </Popconfirm>
          <Popconfirm
            title="End all sessions for this user?"
            onConfirm={() => revokeUserSessions(r.user_id)}
            okText="End all"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" loading={revoking === `user-${r.user_id}`}>User</Button>
          </Popconfirm>
          <Popconfirm
            title="End all sessions for this institution?"
            onConfirm={() => revokeInstitutionSessions(r.institution_id)}
            okText="End all"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" loading={revoking === `inst-${r.institution_id}`}>Institution</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const recentColumns = [
    {
      title: 'Last login',
      dataIndex: 'last_login',
      key: 'last_login',
      width: 180,
      render: formatWhen,
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
  ];

  return (
    <div>
      {header}
      {error && <Card style={{ marginBottom: 16 }}><Paragraph type="danger">{error}</Paragraph></Card>}

      <Card>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'active',
              label: 'Active sessions',
              children: (
                <>
                  <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    Users with activity in the last{' '}
                    <Text strong>{activeWindowMinutes}</Text> minutes (not yet force-logged out).
                  </Paragraph>
                  <Search
                    placeholder="Search institution, email, or name"
                    allowClear
                    style={{ maxWidth: 360, marginBottom: 16 }}
                    onSearch={(v) => {
                      setSearch(v);
                      loadActive(1, v);
                    }}
                  />
                  <Table
                    rowKey="session_id"
                    size="small"
                    loading={loading}
                    dataSource={activeRows}
                    scroll={{ x: 1200 }}
                    pagination={{
                      current: activePage,
                      pageSize: 20,
                      total: activeTotal,
                      showSizeChanger: false,
                      onChange: (p) => loadActive(p, search),
                    }}
                    columns={activeColumns}
                  />
                </>
              ),
            },
            {
              key: 'recent',
              label: 'Recent logins',
              children: (
                <Table
                  rowKey={(r) => `${r.user_id}-${r.last_login}`}
                  size="small"
                  loading={loading}
                  pagination={{ pageSize: 15 }}
                  dataSource={recentRows}
                  scroll={{ x: 920 }}
                  columns={recentColumns}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
