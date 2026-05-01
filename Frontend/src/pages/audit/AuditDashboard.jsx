import React, { useState, useEffect } from 'react';
import {
  CalendarOutlined, UserOutlined, AuditOutlined, SafetyOutlined,
  ClockCircleOutlined, FilterOutlined, DownloadOutlined, EyeOutlined,
  SearchOutlined, ReloadOutlined
} from '@ant-design/icons';
import { Card, Table, Tag, Button, Input, Select, DatePicker, Modal, Descriptions, Typography, Row, Col, Space, Tooltip, Badge, Collapse } from 'antd';
import moment from 'moment';
import apiService from '../../services/apiService';
import { flattenAuditPayload, parseAuditObject } from '../../utils/auditDisplay';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

const AuditDashboard = () => {
  const [auditData, setAuditData] = useState({ dashboard: null, auditTrail: [], userActivity: null, loading: true });
  const [filters, setFilters] = useState({ entityType: '', action: '', userId: '', startDate: '', endDate: '', limit: 100, offset: 0 });
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => { loadAuditData(); loadUsers(); }, []);

  const loadUsers = async () => {
    try {
      const res = await apiService.get('/users');
      if (res.success) setUsers(res.data || []);
    } catch { /* silent */ }
  };

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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value ?? '', offset: 0 }));
  };

  const applyFilters = () => loadAuditData();

  const clearFilters = () => {
    setFilters({ entityType: '', action: '', userId: '', startDate: '', endDate: '', limit: 100, offset: 0 });
  };

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

  const getActionColor = (action) => {
    const exact = {
      create: 'green', update: 'blue', delete: 'red', view: 'default',
      login: 'purple', logout: 'purple', approve: 'success', reject: 'warning',
      payment: 'gold', transfer: 'cyan',
    };
    if (exact[action]) return exact[action];
    const a = String(action || '').toLowerCase();
    if (a.includes('delete') || a.includes('cancel') || a.includes('removed')) return 'red';
    if (a.includes('create') || a.includes('add') || a.includes('login') || a.includes('confirm') || a.includes('posted')) return 'green';
    if (a.includes('update') || a.includes('edit') || a.includes('sync') || a.includes('adjust')) return 'blue';
    if (a.includes('view') || a.includes('export') || a.includes('report')) return 'default';
    return 'geekblue';
  };

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
      width: 130,
      render: (action) => (
        <Tag color={getActionColor(action)} style={{ borderRadius: 20, fontWeight: 600, fontSize: 11 }}>
          {String(action || '—').replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Fields',
      key: 'fields_hint',
      width: 140,
      render: (_, record) => {
        const fields = record.changes?.inputFields;
        const hint = Array.isArray(fields) && fields.length
          ? `${fields.slice(0, 3).join(', ')}${fields.length > 3 ? '…' : ''}`
          : '—';
        return (
          <Tooltip title="Open View for full values (every field and nested address, etc.)">
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>{hint}</span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Entity',
      key: 'entity',
      width: 150,
      render: (_, record) => (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', textTransform: 'capitalize' }}>
            {record.entity_type?.replace(/_/g, ' ') || '—'}
          </div>
          {record.entity_id && (
            <div style={{ fontSize: 11, color: '#8c8c8c' }}>
              #{record.entity_id.substring(0, 8)}...
            </div>
          )}
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
            <Button onClick={clearFilters} style={{ borderRadius: 8 }}>Clear All</Button>
            <Button icon={<DownloadOutlined />} onClick={exportAuditLog} style={{ borderRadius: 8, borderColor: '#667eea', color: '#667eea' }}>
              Export
            </Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #667eea, #764ba2)', border: 'none', fontWeight: 600 }}>
              Apply
            </Button>
          </Space>
        </div>
        <Row gutter={[12, 12]}>

          {/* Entity Type — all 35 types */}
          <Col xs={24} sm={12} md={5}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 600 }}>ENTITY TYPE</div>
            <Select
              placeholder="All entities"
              value={filters.entityType || undefined}
              onChange={v => handleFilterChange('entityType', v)}
              allowClear
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {[
                { value: 'item',              label: 'Item' },
                { value: 'item_draft',        label: 'Item Draft' },
                { value: 'customer',          label: 'Customer' },
                { value: 'vendor',            label: 'Vendor' },
                { value: 'sales_invoice',     label: 'Sales Invoice' },
                { value: 'purchase_invoice',  label: 'Purchase Invoice' },
                { value: 'sales_order',       label: 'Sales Order' },
                { value: 'purchase_order',    label: 'Purchase Order' },
                { value: 'inventory',         label: 'Inventory' },
                { value: 'warehouse',         label: 'Warehouse' },
                { value: 'user',              label: 'User' },
                { value: 'exchange_rate',     label: 'Exchange Rate' },
                { value: 'company_settings',  label: 'Company Settings' },
                { value: 'settings',          label: 'Settings' },
                { value: 'tax_rate',          label: 'Tax Rate' },
                { value: 'tax_group',         label: 'Tax Group' },
                { value: 'tax_type',          label: 'Tax Type' },
                { value: 'price_list',        label: 'Price List' },
                { value: 'price_list_item',   label: 'Price List Item' },
                { value: 'workflow',          label: 'Workflow Rule' },
                { value: 'subscription',      label: 'Subscription' },
                { value: 'onboarding',        label: 'Onboarding' },
                { value: 'report',            label: 'Report' },
                { value: 'accounting',        label: 'Accounting' },
                { value: 'document',          label: 'Document' },
                { value: 'delivery_challan',  label: 'Delivery Challan' },
                { value: 'purchase_return',   label: 'Purchase Return' },
                { value: 'stock_count',       label: 'Stock Count' },
                { value: 'reorder_level',     label: 'Reorder Level' },
                { value: 'batch_serial',      label: 'Batch / Serial' },
                { value: 'transfer_approval', label: 'Transfer Approval' },
                { value: 'role',              label: 'Role' },
                { value: 'category',          label: 'Category' },
                { value: 'brand',             label: 'Brand' },
                { value: 'manufacturer',      label: 'Manufacturer' },
                { value: 'unit',              label: 'Unit' },
              ].map(o => <Option key={o.value} value={o.value}>{o.label}</Option>)}
            </Select>
          </Col>

          {/* Action — all action types */}
          <Col xs={24} sm={12} md={4}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 600 }}>ACTION</div>
            <Select
              placeholder="All actions"
              value={filters.action || undefined}
              onChange={v => handleFilterChange('action', v)}
              allowClear
              style={{ width: '100%' }}
            >
              {[
                { value: 'create',     label: 'Create',     color: 'green' },
                { value: 'update',     label: 'Update',     color: 'blue' },
                { value: 'delete',     label: 'Delete',     color: 'red' },
                { value: 'view',       label: 'View',       color: 'default' },
                { value: 'login',      label: 'Login',      color: 'purple' },
                { value: 'logout',     label: 'Logout',     color: 'purple' },
                { value: 'approve',    label: 'Approve',    color: 'success' },
                { value: 'reject',     label: 'Reject',     color: 'warning' },
                { value: 'cancel',     label: 'Cancel',     color: 'orange' },
                { value: 'confirm',    label: 'Confirm',    color: 'cyan' },
                { value: 'payment',    label: 'Payment',    color: 'gold' },
                { value: 'transfer',   label: 'Transfer',   color: 'cyan' },
                { value: 'adjustment', label: 'Adjustment', color: 'blue' },
              ].map(o => (
                <Option key={o.value} value={o.value}>
                  <Tag color={o.color} style={{ borderRadius: 20, fontSize: 11, margin: 0 }}>{o.label}</Tag>
                </Option>
              ))}
            </Select>
          </Col>

          {/* User — dropdown from real users */}
          <Col xs={24} sm={12} md={5}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 600 }}>USER</div>
            <Select
              placeholder="All users"
              value={filters.userId || undefined}
              onChange={v => handleFilterChange('userId', v)}
              allowClear
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {users.map(u => (
                <Option key={u.id} value={u.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#667eea,#764ba2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 10, fontWeight: 700, flexShrink: 0
                    }}>
                      {(u.first_name || u.email || 'U')[0].toUpperCase()}
                    </div>
                    <span>{u.first_name} {u.last_name} <span style={{ color: '#8c8c8c', fontSize: 11 }}>({u.email})</span></span>
                  </div>
                </Option>
              ))}
            </Select>
          </Col>

          {/* Date Range */}
          <Col xs={24} sm={12} md={6}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 600 }}>DATE RANGE</div>
            <RangePicker
              style={{ width: '100%' }}
              value={[
                filters.startDate ? moment(filters.startDate) : null,
                filters.endDate   ? moment(filters.endDate)   : null,
              ]}
              onChange={(dates) => {
                handleFilterChange('startDate', dates ? dates[0].format('YYYY-MM-DD') : '');
                handleFilterChange('endDate',   dates ? dates[1].format('YYYY-MM-DD') : '');
              }}
              allowClear
              format="DD MMM YYYY"
            />
          </Col>

          {/* Rows per page */}
          <Col xs={24} sm={12} md={4}>
            <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 4, fontWeight: 600 }}>ROWS</div>
            <Select
              value={filters.limit}
              onChange={v => handleFilterChange('limit', v)}
              style={{ width: '100%' }}
            >
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
        width="min(920px, 96vw)"
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
                <Tag color={getActionColor(selectedEntry.action)} style={{ borderRadius: 20, fontWeight: 700 }}>
                  {String(selectedEntry.action || '—').replace(/_/g, ' ')}
                </Tag>
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
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                  {selectedEntry.entity_type?.replace(/_/g, ' ')}
                </span>
                {selectedEntry.entity_id && (
                  <span style={{ color: '#8c8c8c', marginLeft: 6, fontSize: 11 }}>
                    #{selectedEntry.entity_id.substring(0, 8)}...
                  </span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Method & Path" span={2}>
                <Tag
                  color={{ GET: 'blue', POST: 'green', PUT: 'orange', DELETE: 'red', PATCH: 'cyan' }[selectedEntry.method] || 'default'}
                  style={{ borderRadius: 20, fontWeight: 700 }}
                >
                  {selectedEntry.method}
                </Tag>
                <code style={{ marginLeft: 8, fontSize: 12, color: '#595959', wordBreak: 'break-all' }}>
                  {selectedEntry.path}
                </code>
              </Descriptions.Item>
              <Descriptions.Item label="IP Address">{selectedEntry.ip_address || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="Duration" span={1}>{formatDuration(selectedEntry.duration)}</Descriptions.Item>
              {selectedEntry.description && (
                <Descriptions.Item label="Description" span={2}>{selectedEntry.description}</Descriptions.Item>
              )}
            </Descriptions>

            {(() => {
              const snap = selectedEntry.changes?.serverSnapshot;
              const payload = parseAuditObject(selectedEntry.request_body)
                || parseAuditObject(selectedEntry.changes?.input);
              const payloadRows = payload && typeof payload === 'object'
                ? flattenAuditPayload(payload)
                : [];
              const resultRaw = parseAuditObject(selectedEntry.changes?.result);
              const resultRows = resultRaw !== null && resultRaw !== undefined && typeof resultRaw === 'object'
                ? flattenAuditPayload(resultRaw)
                : [];
              const deletedRows = snap?.deleted && typeof snap.deleted === 'object'
                ? flattenAuditPayload(snap.deleted)
                : [];
              const beforeRows = snap?.before && typeof snap.before === 'object'
                ? flattenAuditPayload(snap.before)
                : [];
              const submittedSnapRows = snap?.submitted && typeof snap.submitted === 'object'
                ? flattenAuditPayload(snap.submitted)
                : [];
              const detailCol = [
                {
                  title: 'Field',
                  dataIndex: 'key',
                  key: 'key',
                  width: '36%',
                  render: (t) => <code style={{ fontSize: 11, wordBreak: 'break-all', color: '#434343' }}>{t}</code>,
                },
                {
                  title: 'Value',
                  dataIndex: 'value',
                  key: 'value',
                  render: (t) => (
                    <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: '#1a1a2e' }}>{t}</span>
                  ),
                },
              ];
              const hasPayload = payloadRows.length > 0;
              const hasResult = resultRows.length > 0;
              const hasSnap = deletedRows.length > 0 || beforeRows.length > 0 || submittedSnapRows.length > 0 || !!snap?.createdId;
              return (
                <>
                  {!hasPayload && !hasResult && !hasSnap && (
                    <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#876800' }}>
                      No stored request payload or response snapshot for this row (common for older logs or read-only requests). Use <strong>Description</strong> above and <strong>Raw JSON</strong> if present.
                    </div>
                  )}
                  {snap?.createdId ? (
                    <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
                      <strong>New record id:</strong> <code>{snap.createdId}</code>
                    </div>
                  ) : null}
                  {deletedRows.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #ffccc7', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#cf1322', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Deleted record — full values before removal
                      </div>
                      <Table
                        size="small"
                        pagination={deletedRows.length > 25 ? { pageSize: 25 } : false}
                        columns={detailCol}
                        dataSource={deletedRows.map((r, i) => ({ ...r, rowKey: `d-${i}` }))}
                        rowKey="rowKey"
                        scroll={{ x: true, y: 280 }}
                      />
                    </div>
                  )}
                  {beforeRows.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #ffe7ba', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#d46b08', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Previous values (before this update)
                      </div>
                      <Table
                        size="small"
                        pagination={beforeRows.length > 25 ? { pageSize: 25 } : false}
                        columns={detailCol}
                        dataSource={beforeRows.map((r, i) => ({ ...r, rowKey: `b-${i}` }))}
                        rowKey="rowKey"
                        scroll={{ x: true, y: 280 }}
                      />
                    </div>
                  )}
                  {submittedSnapRows.length > 0 && beforeRows.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #ebebf5', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#667eea', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Submitted update (payload copy at save time)
                      </div>
                      <Table
                        size="small"
                        pagination={submittedSnapRows.length > 25 ? { pageSize: 25 } : false}
                        columns={detailCol}
                        dataSource={submittedSnapRows.map((r, i) => ({ ...r, rowKey: `s-${i}` }))}
                        rowKey="rowKey"
                        scroll={{ x: true, y: 280 }}
                      />
                    </div>
                  )}
                  {payloadRows.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #ebebf5', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#667eea', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Request payload — what was sent (line‑by‑line)
                      </div>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                        Nested objects (e.g. billing address) are expanded with dot paths like <code>address.city</code>.
                      </Text>
                      <Table
                        size="small"
                        pagination={payloadRows.length > 25 ? { pageSize: 25 } : false}
                        columns={detailCol}
                        dataSource={payloadRows.map((r, i) => ({ ...r, rowKey: `p-${i}` }))}
                        rowKey="rowKey"
                        scroll={{ x: true, y: 360 }}
                      />
                    </div>
                  )}
                  {resultRows.length > 0 && (
                    <div style={{ background: '#fff', border: '1px solid #ebebf5', borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#52c41a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        API result data (from response)
                      </div>
                      <Table
                        size="small"
                        pagination={resultRows.length > 25 ? { pageSize: 25 } : false}
                        columns={detailCol}
                        dataSource={resultRows.map((r, i) => ({ ...r, rowKey: `r-${i}` }))}
                        rowKey="rowKey"
                        scroll={{ x: true, y: 280 }}
                      />
                    </div>
                  )}
                  {(selectedEntry.changes || selectedEntry.request_body) && (
                    <Collapse
                      size="small"
                      items={[
                        {
                          key: 'raw',
                          label: 'Raw JSON (technical)',
                          children: (
                            <pre style={{ background: '#f5f5ff', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 11, margin: 0, maxHeight: 240 }}>
                              {JSON.stringify(
                                {
                                  changes: selectedEntry.changes,
                                  request_body: selectedEntry.request_body,
                                },
                                null,
                                2
                              )}
                            </pre>
                          ),
                        },
                      ]}
                    />
                  )}
                </>
              );
            })()}
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
