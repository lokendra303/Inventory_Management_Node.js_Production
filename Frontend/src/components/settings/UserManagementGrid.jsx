import React from 'react';
import { Row, Col, Card, Button, Space, Tag, Pagination, Spin, Empty, Tooltip } from 'antd';
import { EditOutlined, KeyOutlined, UserOutlined } from '@ant-design/icons';

const roleTagColor = (role) => {
  if (role === 'admin') return 'red';
  if (role === 'manager') return 'blue';
  return 'green';
};

const UserManagementGrid = ({
  users = [],
  loading = false,
  canManageUsers = false,
  page = 1,
  pageSize = 12,
  onPageChange,
  onEdit,
  onToggleStatus,
  onTempAccess,
}) => {
  const initials = (record) => {
    const a = (record.first_name || '').trim().charAt(0);
    const b = (record.last_name || '').trim().charAt(0);
    const s = `${a}${b}`.toUpperCase();
    if (s) return s;
    const e = (record.email || '').trim();
    return e ? e.charAt(0).toUpperCase() : '?';
  };

  const displayName = (r) =>
    [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || r.email || 'User';

  if (loading && !users.length) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!users.length) {
    return (
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No users found" style={{ padding: 32 }} />
    );
  }

  const start = (page - 1) * pageSize;
  const pageRows = users.slice(start, start + pageSize);

  return (
    <>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 8 }}>
          {pageRows.map((record) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={record.id} style={{ display: 'flex' }}>
              <Card
                bordered={false}
                hoverable
                style={{
                  width: '100%',
                  borderRadius: 14,
                  border: '1px solid #e8ecf4',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
                }}
                styles={{ body: { padding: 0 } }}
              >
                <div style={{ height: 3, background: 'linear-gradient(90deg, #667eea, #764ba2)' }} />
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 14 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: 'linear-gradient(145deg, #eef2ff, #f3e8ff)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#5b21b6',
                        fontSize: 18,
                        fontWeight: 800,
                        flexShrink: 0,
                        border: '1px solid #e9d5ff',
                      }}
                    >
                      {initials(record) || <UserOutlined />}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, lineHeight: 1.3 }} title={displayName(record)}>
                        {displayName(record)}
                      </div>
                      <div
                        style={{ fontSize: 12, color: '#64748b', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={record.email}
                      >
                        {record.email}
                      </div>
                      <Space size={6} wrap style={{ marginTop: 10 }}>
                        <Tag color={roleTagColor(record.role)} style={{ margin: 0, borderRadius: 999, fontWeight: 600 }}>
                          {(record.role || '').toUpperCase()}
                        </Tag>
                        <Tag color={record.status === 'active' ? 'green' : 'red'} style={{ margin: 0, borderRadius: 999 }}>
                          {(record.status || '').toUpperCase()}
                        </Tag>
                      </Space>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', padding: '10px 12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #f1f5f9' }}>
                    <span style={{ fontWeight: 600, color: '#94a3b8' }}>Last login </span>
                    {record.last_login
                      ? new Date(record.last_login).toLocaleString()
                      : <span style={{ fontStyle: 'italic' }}>Never</span>}
                  </div>
                  {canManageUsers && (
                    <Space wrap size={8} style={{ marginTop: 14, justifyContent: 'flex-end', display: 'flex', width: '100%' }}>
                      <Button icon={<EditOutlined />} size="small" onClick={() => onEdit?.(record)}>
                        Edit
                      </Button>
                      <Button
                        size="small"
                        type={record.status === 'active' ? 'default' : 'primary'}
                        onClick={() => onToggleStatus?.(record)}
                        disabled={record.role === 'admin' && record.status === 'active'}
                      >
                        {record.status === 'active' ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Tooltip title={record.role === 'admin' ? 'Not available for admin' : 'Temporary access'}>
                        <Button
                          icon={<KeyOutlined />}
                          size="small"
                          onClick={() => onTempAccess?.(record)}
                          disabled={record.role === 'admin'}
                          type="dashed"
                        >
                          Access
                        </Button>
                      </Tooltip>
                    </Space>
                  )}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>
      <Pagination
        style={{ marginTop: 16, textAlign: 'right' }}
        current={page}
        pageSize={pageSize}
        total={users.length}
        showSizeChanger
        pageSizeOptions={['12', '24', '48']}
        showTotal={(t) => `${t} users`}
        onChange={(p, ps) => onPageChange?.(p, ps)}
      />
    </>
  );
};

export default UserManagementGrid;
