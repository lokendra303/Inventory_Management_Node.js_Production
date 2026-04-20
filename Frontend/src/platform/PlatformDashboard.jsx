import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Typography, Tag, Space } from 'antd';
import {
  BankOutlined, UserOutlined, AppstoreOutlined, HomeOutlined,
} from '@ant-design/icons';
import platformApi from '../services/platformApi';

const { Title, Paragraph } = Typography;

export default function PlatformDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await platformApi.get('/platform/stats');
        if (!cancelled && res.success) setStats(res.data);
        else if (!cancelled) setError(res.error || 'Failed to load stats');
      } catch (e) {
        if (!cancelled) setError(e.response?.data?.error || e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return <Card><Paragraph type="danger">{error}</Paragraph></Card>;
  }

  const sub = stats?.subscriptionsByStatus || {};

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>Platform overview</Title>
      <Paragraph type="secondary">
        Cross-tenant metrics. Tenant users sign in separately at the main app login.
      </Paragraph>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Institutions"
              value={stats?.institutions?.total ?? 0}
              prefix={<BankOutlined />}
            />
            <div style={{ marginTop: 8 }}>
              <Tag color="green">active {stats?.institutions?.active ?? 0}</Tag>
              {stats?.institutions?.suspended > 0 && (
                <Tag color="red">suspended {stats.institutions.suspended}</Tag>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active users (all tenants)"
              value={stats?.activeUsers ?? 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active items"
              value={stats?.activeItems ?? 0}
              prefix={<AppstoreOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active warehouses"
              value={stats?.activeWarehouses ?? 0}
              prefix={<HomeOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Subscriptions (tenant billing)" style={{ marginTop: 16 }}>
        <Space wrap>
          {Object.keys(sub).length === 0 && <span style={{ color: '#999' }}>No subscription rows yet</span>}
          {Object.entries(sub).map(([k, v]) => (
            <Tag key={k} style={{ fontSize: 14, padding: '4px 10px' }}>{k}: {v}</Tag>
          ))}
        </Space>
      </Card>
    </div>
  );
}
