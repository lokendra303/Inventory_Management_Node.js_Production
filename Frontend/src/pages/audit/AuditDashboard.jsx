import React, { useState, useEffect } from 'react';
import { 
  CalendarOutlined, 
  UserOutlined, 
  AuditOutlined, 
  SafetyOutlined, 
  ClockCircleOutlined, 
  FilterOutlined, 
  DownloadOutlined, 
  EyeOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { Card, Table, Tag, Button, Input, Select, DatePicker, Modal, Descriptions, Typography } from 'antd';
import moment from 'moment';
import apiService from '../../services/apiService';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const AuditDashboard = () => {
  const [auditData, setAuditData] = useState({
    dashboard: null,
    auditTrail: [],
    userActivity: null,
    loading: true
  });
  
  const [filters, setFilters] = useState({
    entityType: '',
    action: '',
    userId: '',
    startDate: '',
    endDate: '',
    limit: 100,
    offset: 0
  });

  const [selectedEntry, setSelectedEntry] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadAuditData();
  }, []);

  const loadAuditData = async () => {
    try {
      setAuditData(prev => ({ ...prev, loading: true }));
      
      const [dashboardRes, trailRes, myActivityRes] = await Promise.all([
        apiService.get('/audit/dashboard'),
        apiService.get('/audit/trail', { params: filters }),
        apiService.get('/audit/my-activity')
      ]);

      setAuditData({
        dashboard: dashboardRes.data,
        auditTrail: trailRes.data,
        userActivity: myActivityRes.data,
        loading: false
      });
    } catch (error) {
      console.error('Failed to load audit data:', error);
      setAuditData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const applyFilters = () => {
    loadAuditData();
  };

  const exportAuditLog = async () => {
    try {
      const response = await apiService.get('/audit/trail', { 
        params: { ...filters, limit: 10000 },
        responseType: 'blob'
      });
      
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

  const getActionBadgeColor = (action) => {
    const colors = {
      create: 'green',
      update: 'blue',
      delete: 'red',
      view: 'default',
      login: 'purple',
      logout: 'purple',
      approve: 'success',
      reject: 'warning',
      payment: 'gold',
      transfer: 'cyan'
    };
    return colors[action] || 'default';
  };

  const formatDuration = (duration) => {
    if (!duration) return 'N/A';
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;
  };

  const showEntryDetails = (entry) => {
    setSelectedEntry(entry);
    setShowDetails(true);
  };

  if (auditData.loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <div>Loading...</div>
      </div>
    );
  }

  const columns = [
    {
      title: 'Timestamp',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => moment(text).format('MMM DD, YYYY HH:mm:ss'),
      sorter: true,
    },
    {
      title: 'User',
      key: 'user',
      render: (record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.user_name || 'System'}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>{record.user_email}</div>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action) => <Tag color={getActionBadgeColor(action)}>{action}</Tag>,
    },
    {
      title: 'Entity',
      key: 'entity',
      render: (record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.entity_type}</div>
          <div style={{ color: '#666', fontSize: '12px' }}>{record.entity_id}</div>
        </div>
      ),
    },
    {
      title: 'Method',
      dataIndex: 'method',
      key: 'method',
      render: (method) => <Tag>{method}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status_code',
      key: 'status_code',
      render: (status) => (
        <Tag color={status < 400 ? 'green' : 'red'}>{status}</Tag>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration) => formatDuration(duration),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />}
          onClick={() => showEntryDetails(record)}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>Audit Dashboard</Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={loadAuditData}
          type="primary"
        >
          Refresh
        </Button>
      </div>

      {/* Dashboard Overview */}
      {auditData.dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AuditOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              <div>
                <Text type="secondary">Total Actions (24h)</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{auditData.dashboard.totalActions}</div>
              </div>
            </div>
          </Card>
          
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <UserOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
              <div>
                <Text type="secondary">Active Users</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{auditData.dashboard.userActions?.length || 0}</div>
              </div>
            </div>
          </Card>
          
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <SafetyOutlined style={{ fontSize: '24px', color: '#f5222d' }} />
              <div>
                <Text type="secondary">Critical Actions</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{auditData.dashboard.recentCriticalActions?.length || 0}</div>
              </div>
            </div>
          </Card>
          
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ClockCircleOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
              <div>
                <Text type="secondary">My Actions (7d)</Text>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
                  {auditData.userActivity?.summary?.reduce((sum, s) => sum + s.count, 0) || 0}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* My Recent Activity */}
      {auditData.userActivity && auditData.userActivity.recentActions && (
        <Card title={<><UserOutlined /> My Recent Activity</>} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {auditData.userActivity.recentActions.slice(0, 5).map((action, index) => (
              <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Tag color={getActionBadgeColor(action.action)}>{action.action}</Tag>
                  <Text>{action.description}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {moment(action.created_at).format('MMM DD, HH:mm')}
                </Text>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card 
        title={<><FilterOutlined /> Audit Trail Filters</>}
        extra={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button icon={<DownloadOutlined />} onClick={exportAuditLog}>
              Export
            </Button>
            <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>
              Apply Filters
            </Button>
          </div>
        }
        style={{ marginBottom: '24px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <Select
            placeholder="Entity Type"
            value={filters.entityType || undefined}
            onChange={(value) => handleFilterChange('entityType', value)}
            allowClear
          >
            <Option value="item">Items</Option>
            <Option value="customer">Customers</Option>
            <Option value="vendor">Vendors</Option>
            <Option value="invoice">Invoices</Option>
            <Option value="inventory">Inventory</Option>
            <Option value="user">Users</Option>
          </Select>

          <Select
            placeholder="Action"
            value={filters.action || undefined}
            onChange={(value) => handleFilterChange('action', value)}
            allowClear
          >
            <Option value="create">Create</Option>
            <Option value="update">Update</Option>
            <Option value="delete">Delete</Option>
            <Option value="view">View</Option>
            <Option value="approve">Approve</Option>
            <Option value="payment">Payment</Option>
          </Select>

          <RangePicker
            onChange={(dates) => {
              if (dates) {
                handleFilterChange('startDate', dates[0].format('YYYY-MM-DD'));
                handleFilterChange('endDate', dates[1].format('YYYY-MM-DD'));
              } else {
                handleFilterChange('startDate', '');
                handleFilterChange('endDate', '');
              }
            }}
          />

          <Input
            placeholder="User ID"
            value={filters.userId}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
          />

          <Select
            value={filters.limit}
            onChange={(value) => handleFilterChange('limit', value)}
          >
            <Option value={50}>50 records</Option>
            <Option value={100}>100 records</Option>
            <Option value={500}>500 records</Option>
            <Option value={1000}>1000 records</Option>
          </Select>
        </div>
      </Card>

      {/* Audit Trail Table */}
      <Card title="Audit Trail">
        <Table
          columns={columns}
          dataSource={auditData.auditTrail}
          rowKey="id"
          pagination={{
            pageSize: filters.limit,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* Entry Details Modal */}
      <Modal
        title="Audit Entry Details"
        open={showDetails}
        onCancel={() => setShowDetails(false)}
        footer={[
          <Button key="close" onClick={() => setShowDetails(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        {selectedEntry && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="Timestamp">
              {moment(selectedEntry.created_at).format('MMMM Do YYYY, h:mm:ss a')}
            </Descriptions.Item>
            <Descriptions.Item label="User">
              {selectedEntry.user_name} ({selectedEntry.user_email})
            </Descriptions.Item>
            <Descriptions.Item label="Action">
              <Tag color={getActionBadgeColor(selectedEntry.action)}>
                {selectedEntry.action}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Entity">
              {selectedEntry.entity_type} ({selectedEntry.entity_id})
            </Descriptions.Item>
            <Descriptions.Item label="Method & Path">
              {selectedEntry.method} {selectedEntry.path}
            </Descriptions.Item>
            <Descriptions.Item label="IP Address">
              {selectedEntry.ip_address}
            </Descriptions.Item>
            {selectedEntry.description && (
              <Descriptions.Item label="Description" span={2}>
                {selectedEntry.description}
              </Descriptions.Item>
            )}
            {selectedEntry.changes && (
              <Descriptions.Item label="Changes" span={2}>
                <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>
                  {JSON.stringify(selectedEntry.changes, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            {selectedEntry.request_body && (
              <Descriptions.Item label="Request Body" span={2}>
                <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', overflow: 'auto' }}>
                  {JSON.stringify(selectedEntry.request_body, null, 2)}
                </pre>
              </Descriptions.Item>
            )}
            {selectedEntry.user_agent && (
              <Descriptions.Item label="User Agent" span={2}>
                <Text style={{ fontSize: '12px', color: '#666' }}>{selectedEntry.user_agent}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default AuditDashboard;