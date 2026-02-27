import React from 'react';
import { Timeline, Tag, Spin, Empty } from 'antd';
import { HistoryOutlined, UserOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';

const AuditLog = ({ data, loading }) => {
  const getActionIcon = (action) => {
    if (action === 'created') return <PlusOutlined />;
    if (action === 'updated') return <EditOutlined />;
    if (action === 'deleted') return <DeleteOutlined />;
    return <HistoryOutlined />;
  };

  const getActionColor = (action) => {
    if (action === 'created') return 'green';
    if (action === 'updated') return 'blue';
    if (action === 'deleted') return 'red';
    if (action === 'status_changed') return 'orange';
    return 'gray';
  };

  const getActionLabel = (action) => {
    if (action === 'created') return 'Created';
    if (action === 'updated') return 'Updated';
    if (action === 'deleted') return 'Deleted';
    if (action === 'status_changed') return 'Status Changed';
    return action;
  };

  const renderChanges = (changes) => {
    if (!changes) return null;
    
    return Object.entries(changes).map(([field, value]) => {
      if (typeof value === 'object' && value.old !== undefined && value.new !== undefined) {
        return (
          <div key={field} style={{ fontSize: 12, marginTop: 4 }}>
            <strong>{field}:</strong> 
            <span style={{ color: '#ff4d4f', textDecoration: 'line-through', marginLeft: 4 }}>
              {String(value.old)}
            </span>
            <span style={{ margin: '0 4px' }}>→</span>
            <span style={{ color: '#52c41a' }}>{String(value.new)}</span>
          </div>
        );
      }
      return (
        <div key={field} style={{ fontSize: 12, marginTop: 4 }}>
          <strong>{field}:</strong> {String(value)}
        </div>
      );
    });
  };

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
      <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <HistoryOutlined /> Audit Log
      </h4>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      ) : data && data.length > 0 ? (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <Timeline>
            {data.map((log, index) => (
              <Timeline.Item 
                key={index} 
                color={getActionColor(log.action)}
                dot={getActionIcon(log.action)}
              >
                <div style={{ marginBottom: 8 }}>
                  <Tag color={getActionColor(log.action)}>
                    {getActionLabel(log.action)}
                  </Tag>
                  <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                    {new Date(log.created_at || log.timestamp).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: 13 }}>
                  {log.user_name && (
                    <div style={{ marginBottom: 4 }}>
                      <UserOutlined style={{ marginRight: 4 }} />
                      <strong>{log.user_name}</strong>
                      {log.user_email && <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 4 }}>({log.user_email})</span>}
                    </div>
                  )}
                  {log.description && (
                    <div style={{ color: '#595959', marginTop: 4 }}>{log.description}</div>
                  )}
                  {log.changes && renderChanges(log.changes)}
                  {log.ip_address && (
                    <div style={{ color: '#8c8c8c', fontSize: 11, marginTop: 4 }}>
                      IP: {log.ip_address}
                    </div>
                  )}
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      ) : (
        <Empty description="No audit logs available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );
};

export default AuditLog;
