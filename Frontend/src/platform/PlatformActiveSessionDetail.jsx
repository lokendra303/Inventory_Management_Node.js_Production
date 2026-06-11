import React, { useCallback, useEffect, useState } from 'react';
import {
  Card, Typography, Descriptions, Table, Button, Space, Tag, Spin, message, Popconfirm, Row, Col, Statistic, Grid,
} from 'antd';
import {
  ArrowLeftOutlined, ReloadOutlined, LogoutOutlined, UserOutlined, BankOutlined, ClockCircleOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import platformApi from '../services/platformApi';
import { institutionStatusLabel } from '../config/institutionDisplay';

const { Title, Text, Paragraph } = Typography;

function formatWhen(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

function formatDuration(totalSeconds) {
  const s = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function getLiveDurations(session, nowMs = Date.now()) {
  const nowSec = Math.floor(nowMs / 1000);
  const createdSec = Number(session.created_unix)
    || Math.floor(new Date(session.created_at).getTime() / 1000);
  const lastActiveSec = Number(session.last_activity_unix)
    || Math.floor(new Date(session.last_activity_at).getTime() / 1000);
  const revokedSec = session.revoked_unix != null
    ? Number(session.revoked_unix)
    : (session.revoked_at ? Math.floor(new Date(session.revoked_at).getTime() / 1000) : null);

  if (!createdSec || Number.isNaN(createdSec)) {
    return { durationSeconds: 0, idleSeconds: 0 };
  }

  const endSec = revokedSec ?? nowSec;
  const durationSeconds = Math.max(0, endSec - createdSec);
  const idleSeconds = session.is_active && revokedSec == null
    ? Math.max(0, nowSec - lastActiveSec)
    : Math.max(0, endSec - lastActiveSec);

  return { durationSeconds, idleSeconds };
}

function parseBrowser(ua) {
  if (!ua) return '—';
  const s = String(ua);
  if (s.includes('Edg/')) return 'Microsoft Edge';
  if (s.includes('Chrome/')) return 'Chrome';
  if (s.includes('Firefox/')) return 'Firefox';
  if (s.includes('Safari/') && !s.includes('Chrome')) return 'Safari';
  return s.length > 60 ? `${s.slice(0, 60)}…` : s;
}

export default function PlatformActiveSessionDetail() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await platformApi.get(`/platform/activity/sessions/${sessionId}`, {
        params: { operationsLimit: 50 },
      });
      if (res.success) setPayload(res.data);
      else if (!silent) message.error(res.error || 'Session not found');
    } catch (e) {
      if (!silent) message.error(e.response?.data?.error || e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  // Tick every second so duration / idle time update live on screen
  useEffect(() => {
    if (!payload?.session) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [payload?.session?.session_id, payload?.session?.is_active]);

  // Refresh last activity + operations while session is still active
  useEffect(() => {
    if (!payload?.session?.is_active || payload.session.revoked_at) return undefined;
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, [load, payload?.session?.is_active, payload?.session?.revoked_at, payload?.session?.session_id]);

  const revokeSession = async () => {
    setRevoking(true);
    try {
      const res = await platformApi.post(`/platform/activity/sessions/${sessionId}/revoke`, {});
      if (res.success) {
        message.success('Session ended');
        await load();
      } else {
        message.error(res.error || 'Failed to end session');
      }
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setRevoking(false);
    }
  };

  if (loading && !payload) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!payload) {
    return (
      <Card>
        <Paragraph>Session not found.</Paragraph>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform/activity')}>
          Back to sessions
        </Button>
      </Card>
    );
  }

  const { session, user, institution, stats, recent_operations: ops } = payload;
  const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
  const { durationSeconds, idleSeconds } = getLiveDurations(session, now);

  return (
    <div>
      <Space
        align="center"
        style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}
        wrap
      >
        <Space align="start" wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/platform/activity')}>
            Back
          </Button>
          <div>
            <Title level={3} style={{ margin: 0 }}>{fullName}</Title>
            <Space size="small" wrap>
              <Tag color={session.is_active ? 'green' : 'default'}>
                {session.is_active ? 'Active now' : session.revoked_at ? 'Ended' : 'Idle'}
              </Tag>
              <Text type="secondary">{user.email}</Text>
            </Space>
          </div>
        </Space>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          {session.is_active && !session.revoked_at && (
            <Popconfirm
              title="End this session?"
              description="The user will be signed out on their next request."
              onConfirm={revokeSession}
              okText="End session"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<LogoutOutlined />} loading={revoking}>
                Force logout
              </Button>
            </Popconfirm>
          )}
        </Space>
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Session duration"
              value={formatDuration(durationSeconds)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic
              title="Idle time"
              value={formatDuration(idleSeconds)}
              valueStyle={{ color: idleSeconds > 300 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Operations this session" value={stats.operations_in_session} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card size="small">
            <Statistic title="Other active sessions" value={stats.other_active_sessions} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<><UserOutlined /> User</>} size="small">
            <Descriptions column={isNarrow ? 1 : 2} size="small">
              <Descriptions.Item label="Name">{fullName}</Descriptions.Item>
              <Descriptions.Item label="Email">{user.email}</Descriptions.Item>
              <Descriptions.Item label="Role"><Tag>{user.role}</Tag></Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={user.status === 'active' ? 'green' : 'default'}>{user.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Department">{user.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{user.designation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{user.mobile || '—'}</Descriptions.Item>
              <Descriptions.Item label="2FA">
                {user.two_factor_enabled ? <Tag color="blue">Enabled</Tag> : <Tag>Off</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Last login">{formatWhen(user.last_login)}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<><BankOutlined /> Institution</>}
            size="small"
            extra={(
              <Button
                type="link"
                size="small"
                onClick={() => navigate(`/platform/institutions/${institution.institution_id}`)}
              >
                View institution
              </Button>
            )}
          >
            <Descriptions column={isNarrow ? 1 : 2} size="small">
              <Descriptions.Item label="Name">{institution.name}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={institution.status === 'active' ? 'green' : 'red'}>
                  {institutionStatusLabel(institution.status)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Plan">{institution.plan || '—'}</Descriptions.Item>
              <Descriptions.Item label="Email">{institution.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Location">
                {[institution.city, institution.country].filter(Boolean).join(', ') || '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Session details" size="small">
            <Descriptions column={isNarrow ? 1 : 3} size="small">
              <Descriptions.Item label="Signed in at">{formatWhen(session.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Last activity">{formatWhen(session.last_activity_at)}</Descriptions.Item>
              <Descriptions.Item label="IP address">{session.ip_address || '—'}</Descriptions.Item>
              <Descriptions.Item label="Login location">
                <Space size={6} wrap>
                  <EnvironmentOutlined style={{ color: '#1677ff' }} />
                  <span>
                    {session.location_label
                      || (['127.0.0.1', '::1'].includes(session.ip_address) ? 'Local network' : 'Resolving…')}
                    {session.location_country_code ? ` (${session.location_country_code})` : ''}
                  </span>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Browser / device" span={isNarrow ? 1 : 2}>
                {parseBrowser(session.user_agent)}
              </Descriptions.Item>
              <Descriptions.Item label="User agent" span={3}>
                <Text type="secondary" style={{ fontSize: 12, wordBreak: 'break-all' }}>
                  {session.user_agent || '—'}
                </Text>
              </Descriptions.Item>
              {session.revoked_at && (
                <>
                  <Descriptions.Item label="Ended at">{formatWhen(session.revoked_at)}</Descriptions.Item>
                  <Descriptions.Item label="Reason" span={2}>
                    {session.revoke_reason || '—'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title="Recent operations (this session)" size="small">
            <Table
              rowKey="id"
              size="small"
              loading={loading}
              dataSource={ops || []}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 900 }}
              locale={{ emptyText: 'No operations recorded yet for this session' }}
              columns={[
                {
                  title: 'Time',
                  dataIndex: 'created_at',
                  width: 170,
                  render: formatWhen,
                },
                {
                  title: 'Action',
                  dataIndex: 'action',
                  width: 160,
                  render: (v) => (v ? <Tag>{v}</Tag> : '—'),
                },
                {
                  title: 'Entity',
                  key: 'entity',
                  width: 140,
                  render: (_, r) => r.entity_type
                    ? `${r.entity_type}${r.entity_id ? ` #${String(r.entity_id).slice(0, 8)}` : ''}`
                    : '—',
                },
                {
                  title: 'Request',
                  key: 'req',
                  ellipsis: true,
                  render: (_, r) => (
                    <Text code style={{ fontSize: 11 }}>
                      {(r.method || '—').toUpperCase()} {r.path || '—'}
                    </Text>
                  ),
                },
                {
                  title: 'Status',
                  dataIndex: 'status_code',
                  width: 72,
                  render: (v) => (
                    <Tag color={v >= 200 && v < 300 ? 'green' : v >= 400 ? 'red' : 'default'}>
                      {v ?? '—'}
                    </Tag>
                  ),
                },
                {
                  title: 'Description',
                  dataIndex: 'description',
                  ellipsis: true,
                  render: (v) => v || '—',
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
