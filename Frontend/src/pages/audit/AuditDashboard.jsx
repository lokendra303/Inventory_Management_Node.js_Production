import React, { useState, useEffect } from 'react';
import {
  CalendarOutlined, UserOutlined, AuditOutlined, SafetyOutlined,
  ClockCircleOutlined, FilterOutlined, DownloadOutlined, EyeOutlined,
  SearchOutlined, ReloadOutlined
} from '@ant-design/icons';
import { Card, Table, Tag, Button, Input, Select, DatePicker, Modal, Descriptions, Typography, Row, Col, Space, Tooltip, Badge } from 'antd';
import moment from 'moment';
import apiService from '../../services/apiService';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

const AuditDashboard = () => {
  const [auditData, setAuditData] = useState({ dashboard: null, auditTrail: [], userActivity: null, loading: true });
  const [filters, setFilters] = useState({ entityType: '', action: '', userId: '', startDate: '', endDate: '', limit: 100, offset: 0 });
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => { loadAuditData(); }, []);

  const loadAuditData = async () => {
    try {
      setAuditData(prev => ({ ...prev, loading: true }));
      const [dashboardRes, trailRes, myActivityRes] = await Promise.all([
        apiService.get('/audit/dashboard'),
        apiService.get('/audit/trail', { params: filters }),
        apiService.get('/audit/my-activity')
      ]);
      setAuditData({ dashboard: dashboardRes.data, auditTrail: trailRes.data, userActivity: myActivityRes.data, loading: false });
    } catch (error) {
      console.error('Failed to load audit data:', error);
      setAuditData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));

  const exportAuditLog = async () => {
    try {
      const response = await apiService.get('/audit/trail', { params: { ...filters, limit: 10000 }, responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${moment().format('YYYY-MM-DD')}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit log:', error);
    }
  };

  const getActionColor = (action) => ({
    create: 'green', update: 'blue', delete: 'red', view: 'default',
    login: 'purple', logout: 'purple', approve: 'success', reject: 'warning',
    payment: 'gold', transfer: 'cyan'
  }[action] || 'default');

  const formatDuration = (d) => !d ? 'N/A' : d < 1000 ? `${d}ms` : `${(d / 1000).toFixed(2)}s`;

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      sorter: true,
      render: (text) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{moment(text).format('MMM DD, YYYY')}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{moment(text).format('HH:mm:ss')}</div>
        </div>
      ),
    },
    {
      title: 'User',
      key: 'user',
      width: 160,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {(record.user_name || 'S')[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{record.user_name || 'System'}</div>
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.user_email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 90,
      render: (action) => <Tag color={getActionColor(action)} style={{ borderRadius: 20, textTransform: 'capitalize', fontWeight: 600 }}>{action}</Tag>,
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 130,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', textTransform: 'capitalize' }}>{record.entity_type}</div>
          <div style={{ fontSize: 11, color: '#8c8c8c' }}>{record.entity_id}</div>
        </div>
      ),
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method) => {
        const colors = { GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red', PATCH: 'cyan' };
        return <Tag color={colors[method] || 'default'} style={{ borderRadius: 20, fontWeight: 700, fontSize: 11 }}>{method}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status_code',
      key: 'status_code',
      width: 75,
      render: (status) => (
        <Tag color={status < 300 ? 'green' : status < 400 ? 'blue' : 'red'} style={{ borderRadius: 20, fontWeight: 700 }}>{status}</Tag>
      ),
    },
    {
      title: 'Details',
      key: 'actions',
      fixed: 'right',
      width: 65,
      render: (_, record) => (
        <Tooltip title="View Details">
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => { setSelectedEntry(record); setShowDetails(true); }}
            style={{ borderRadius: 6, background: '#f0f0ff', borderColor: '#667eea', color: '#667eea' }}
          />
        </Tooltip>
      ),
    },
  ];

  const statCards = [
    { title: 'Total Actions (24h)', value: auditData.dashboard?.totalActions ?? 0, icon: <AuditOutlined />, color: '#667eea', bg: '#f0f0ff' },
    { title: 'Active Users', value: auditData.dashboard?.userActions?.length ?? 0, icon: <UserOutlined />, color: '#52c41a', bg: '#f6ffed' },
    { title: 'Critical Actions', value: auditData.dashboard?.recentCriticalActions?.length ?? 0, icon: <SafetyOutlined />, color: '#ff4d4f', bg: '#fff1f0' },
    { title: 'My Actions (7d)', value: auditData.userActivity?.summary?.reduce((s, x) => s + x.count, 0) ?? 0, icon: <ClockCircleOutlined />, color: '#722ed1', bg: '#f9f0ff' },
  ];

  const sectionStyle = { background: '#fff', border: '1px solid #ebebf5', borderRadius: 14, padding: '20px 20px 12px', marginBottom: 18, boxShadow: '0 2px 10px rgba(102,126,234,0.06)' };
  const sectionHeader = { fontWeight: 700, fontSize: 13, color: '#667eea', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, borderBottom: '2px solid #f0f0ff', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const sectionIconStyle = { background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '5px 7px', color: '#fff', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 16, padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
            <AuditOutlined style={{ fontSize: 28, color: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>Audit Trail</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Track all system activity and changes</div>
          </div>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadAuditData}
          loading={auditData.loading}
          style={{ background: '#fff', color: '#764ba2', border: '2px solid rgba(255,255,255,0.6)', fontWeight: 700, borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
        >
          Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {statCards.map(s => (
          <Col xs={12} sm={6} key={s.title}>
            <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} bodyStyle={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ background: s.bg, borderRadius: 10, padding: 10, fontSize: 22, color: s.color }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a2e', lineHeight: 1.1 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 2 }}>{s.title}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* My Recent Activity */}
      {auditData.userActivity?.recentActions?.length > 0 && (
        <div style={sectionStyle}>
          <div style={sectionHeader}>
            <span style={sectionIconStyle}><UserOutlined /></span>
            My Recent Activity
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {auditData.userActivity.recentActions.slice(0, 5).map((action, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#fafbff', borderRadius: 8, border: '1px solid #ebebf5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Tag color={getActionColor(action.action)} style={{ borderRadius: 20, textTransform: 'capitalize', fontWeight: 600, margin: 0 }}>{action.action}</Tag>
                  <Text style={{ fontSize: 13 }}>{action.description}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', marginLeft: 12 }}>
                  {moment(action.created_at).format('MMM DD, HH:mm')}
                </Text>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHeader, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={sectionIconStyle}><FilterOutlined /></span>
            Filters
          </div>
          <Space>
            <Button icon={<DownloadOutlined />} onClick={exportAuditLog} style={{ borderRadius: 8, borderColor: '#667eea', color: '#667eea' }}>
              Export
            </Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={loadAuditData}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', fontWeight: 600 }}>
              Apply
            </Button>
          </Space>
        </div>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={4}>
            <Select placeholder="Entity Type" value={filters.entityType || undefined} onChange={v => handleFilterChange('entityType', v)} allowClear style={{ width: '100%' }}>
              <Option value="item">Items</Option>
              <Option value="customer">Customers</Option>
              <Option value="vendor">Vendors</Option>
              <Option value="invoice">Invoices</Option>
              <Option value="inventory">Inventory</Option>
              <Option value="user">Users</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select placeholder="Action" value={filters.action || undefined} onChange={v => handleFilterChange('action', v)} allowClear style={{ width: '100%' }}>
              <Option value="create">Create</Option>
              <Option value="update">Update</Option>
              <Option value="delete">Delete</Option>
              <Option value="view">View</Option>
              <Option value="approve">Approve</Option>
              <Option value="payment">Payment</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker style={{ width: '100%' }} onChange={(dates) => {
              handleFilterChange('startDate', dates ? dates[0].format('YYYY-MM-DD') : '');
              handleFilterChange('endDate', dates ? dates[1].format('YYYY-MM-DD') : '');
            }} />
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Input placeholder="User ID" value={filters.userId} onChange={e => handleFilterChange('userId', e.target.value)} style={{ borderRadius: 8 }} />
          </Col>
          <Col xs={24} sm={12} md={3}>
            <Select value={filters.limit} onChange={v => handleFilterChange('limit', v)} style={{ width: '100%' }}>
              <Option value={50}>50 rows</Option>
              <Option value={100}>100 rows</Option>
              <Option value={500}>500 rows</Option>
              <Option value={1000}>1000 rows</Option>
            </Select>
          </Col>
        </Row>
      </div>

      {/* Audit Trail Table */}
      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={sectionIconStyle}><AuditOutlined /></span>
            Audit Trail
            <Tag color="purple" style={{ borderRadius: 20, marginLeft: 4 }}>{auditData.auditTrail?.length ?? 0}</Tag>
          </div>
        </div>
        <div style={{ padding: '16px 24px 24px' }}>
          <Table
            columns={columns}
            dataSource={auditData.auditTrail}
            rowKey="id"
            loading={auditData.loading}
            size="middle"
            scroll={{ x: 'max-content' }}
            rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : 'table-row-dark'}
            pagination={{
              pageSize: filters.limit,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} entries`,
              style: { marginTop: 16 },
            }}
          />
        </div>
      </Card>

      {/* Entry Details Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
              <EyeOutlined />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17 }}>Audit Entry Details</span>
          </div>
        }
        open={showDetails}
        onCancel={() => setShowDetails(false)}
        footer={<Button style={{ borderRadius: 8 }} onClick={() => setShowDetails(false)}>Close</Button>}
        width="min(760px, 96vw)"
        style={{ top: 40 }}
        styles={{ body: { background: '#fafbff' } }}
      >
        {selectedEntry && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Hero strip */}
            <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>
                {(selectedEntry.user_name || 'S')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{selectedEntry.user_name || 'System'}</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{selectedEntry.user_email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Tag color={getActionColor(selectedEntry.action)} style={{ borderRadius: 20, fontWeight: 700, textTransform: 'capitalize' }}>{selectedEntry.action}</Tag>
                <Tag color={selectedEntry.status_code < 400 ? 'green' : 'red'} style={{ borderRadius: 20, fontWeight: 700 }}>{selectedEntry.status_code}</Tag>
              </div>
            </div>

            <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small"
              labelStyle={{ background: '#f5f5ff', fontWeight: 600, color: '#595959', fontSize: 12 }}
              contentStyle={{ fontSize: 13 }}
            >
              <Descriptions.Item label="Timestamp">
                {moment(selectedEntry.created_at).format('MMM DD YYYY, HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="Entity">
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{selectedEntry.entity_type}</span>
                <span style={{ color: '#8c8c8c', marginLeft: 6 }}>#{selectedEntry.entity_id}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Method & Path" span={2}>
                <Tag color={{ GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red', PATCH: 'cyan' }[selectedEntry.method] || 'default'} style={{ borderRadius: 20, fontWeight: 700 }}>{selectedEntry.method}</Tag>
                <code style={{ marginLeft: 8, fontSize: 12, color: '#595959' }}>{selectedEntry.path}</code>
              </Descriptions.Item>
              <Descriptions.Item label="IP Address">{selectedEntry.ip_address || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Duration" span={1}>{formatDuration(selectedEntry.duration)}</Descriptions.Item>
              {selectedEntry.description && (
                <Descriptions.Item label="Description" span={2}>{selectedEntry.description}</Descriptions.Item>
              )}
            </Descriptions>

            {selectedEntry.changes && (
              <div style={{ background: '#fff', border: '1px solid #ebebf5', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#667eea', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Changes</div>
                <pre style={{ background: '#f5f5ff', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 12, margin: 0, maxHeight: 200 }}>
                  {JSON.stringify(selectedEntry.changes, null, 2)}
                </pre>
              </div>
            )}
            {selectedEntry.request_body && (
              <div style={{ background: '#fff', border: '1px solid #ebebf5', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#667eea', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Request Body</div>
                <pre style={{ background: '#f5f5ff', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 12, margin: 0, maxHeight: 200 }}>
                  {JSON.stringify(selectedEntry.request_body, null, 2)}
                </pre>
              </div>
            )}
            {selectedEntry.user_agent && (
              <div style={{ background: '#fff', border: '1px solid #ebebf5', borderRadius: 10, padding: '10px 16px' }}>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#667eea', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>User Agent</div>
                <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{selectedEntry.user_agent}</Text>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditDashboard;
