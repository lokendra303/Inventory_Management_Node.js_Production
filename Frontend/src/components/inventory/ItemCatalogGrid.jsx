import React from 'react';
import {
  Row, Col, Card, Button, Tooltip, Dropdown, Pagination, Spin, Empty,
} from 'antd';
import {
  InboxOutlined,
  EyeOutlined,
  EditOutlined,
  MoreOutlined,
  CopyOutlined,
  StopOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { formatPrice } from '../../utils/currency';

const cardShell = {
  borderRadius: 16,
  overflow: 'hidden',
  border: '1px solid #e8ecf4',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
  transition: 'box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease',
};

const statLabel = {
  fontSize: 11,
  fontWeight: 500,
  color: '#64748b',
  letterSpacing: '0.02em',
  marginBottom: 4,
};

const statValue = {
  fontSize: 15,
  fontWeight: 650,
  color: '#0f172a',
  lineHeight: 1.2,
};

const ItemCatalogGrid = ({
  items = [],
  loading = false,
  currency = 'USD',
  canManageItems = false,
  page = 1,
  pageSize = 12,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onDuplicate,
  onToggleStatus,
}) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!items.length) {
    return <Empty description="No items found" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return (
    <>
      <Row gutter={[16, 16]} align="stretch">
        {pageItems.map((record) => {
          const stock = record.current_stock || 0;
          const low = stock <= (record.min_stock_level || 0);
          const stockDisplay = stock % 1 === 0 ? Math.floor(stock) : stock.toFixed(2);
          const unitLabel = typeof record.unit === 'object' && record.unit?.name
            ? record.unit.name
            : (typeof record.unit === 'string' && record.unit.length > 12
              ? `${record.unit.slice(0, 8)}…`
              : (record.unit || '—'));

          return (
            <Col xs={24} sm={12} md={8} xl={6} key={record.id} style={{ display: 'flex' }}>
              <Card
                hoverable
                bordered={false}
                className="ims-catalog-card"
                style={{
                  ...cardShell,
                }}
                styles={{
                  body: {
                    padding: 0,
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                  },
                }}
              >
                {/* Top accent */}
                <div
                  style={{
                    height: 3,
                    background: 'linear-gradient(90deg, #667eea, #764ba2)',
                    opacity: 0.85,
                  }}
                />

                <div style={{ padding: '14px 16px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    {record.image ? (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 12,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.04)',
                        }}
                      >
                        <img
                          src={record.image}
                          alt={record.name || 'Item'}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 12,
                          background: 'linear-gradient(145deg, #f1f5f9 0%, #e8eefa 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6366f1',
                          fontSize: 26,
                          flexShrink: 0,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <InboxOutlined />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1, paddingTop: 2 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: '#0f172a',
                          fontSize: 15,
                          lineHeight: 1.35,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                        title={record.name}
                      >
                        {record.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: '#94a3b8',
                          marginTop: 5,
                          fontFamily: 'ui-monospace, monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={record.sku || undefined}
                      >
                        {record.sku || '—'}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {record.type && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 10px',
                              borderRadius: 999,
                              background: '#eef2ff',
                              color: '#4f46e5',
                              textTransform: 'capitalize',
                            }}
                          >
                            {record.type}
                          </span>
                        )}
                        {record.status === 'inactive' && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              padding: '2px 10px',
                              borderRadius: 999,
                              background: '#f1f5f9',
                              color: '#64748b',
                            }}
                          >
                            Inactive
                          </span>
                        )}
                      </div>
                      {record.item_group_name && (
                        <div
                          style={{
                            fontSize: 11,
                            color: '#a78bfa',
                            fontWeight: 600,
                            marginTop: 8,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={record.item_group_name}
                        >
                          {record.item_group_name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats — single muted panel */}
                  <div
                    style={{
                      marginTop: 14,
                      padding: '12px 12px',
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px 16px',
                        rowGap: 14,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={statLabel}>On hand</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ ...statValue, color: low ? '#dc2626' : '#059669' }}>
                            {stockDisplay}
                          </span>
                          {low && (
                            <WarningOutlined style={{ color: '#f59e0b', fontSize: 14 }} />
                          )}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={statLabel}>Unit</div>
                        <div
                          style={{ ...statValue, fontSize: 14, fontWeight: 600 }}
                          title={String(unitLabel)}
                        >
                          {unitLabel}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={statLabel}>Cost</div>
                        <div style={{ ...statValue, fontSize: 14, fontWeight: 600 }}>
                          {record.cost_price
                            ? formatPrice(record.cost_price, currency, 'USD')
                            : '—'}
                        </div>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={statLabel}>Sell</div>
                        <div style={{ ...statValue, color: '#4f46e5', fontSize: 15 }}>
                          {record.selling_price
                            ? formatPrice(record.selling_price, currency, 'USD')
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer — full bleed divider, actions right */}
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '12px 16px 14px',
                    borderTop: '1px solid #eef2f7',
                    background: 'linear-gradient(180deg, #fafbfc 0%, #fff 100%)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Tooltip title="View">
                    <Button
                      type="default"
                      icon={<EyeOutlined />}
                      size="small"
                      onClick={() => onView?.(record)}
                      style={{
                        borderRadius: 8,
                        borderColor: '#c7d2fe',
                        color: '#4f46e5',
                        background: '#fff',
                      }}
                    />
                  </Tooltip>
                  {canManageItems && (
                    <Tooltip title="Edit">
                      <Button
                        type="primary"
                        icon={<EditOutlined />}
                        size="small"
                        onClick={() => onEdit?.(record)}
                        style={{
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          border: 'none',
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.35)',
                        }}
                      />
                    </Tooltip>
                  )}
                  {canManageItems && (
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          {
                            key: 'duplicate',
                            icon: <CopyOutlined style={{ color: '#ea580c' }} />,
                            label: 'Duplicate',
                            onClick: () => onDuplicate?.(record),
                          },
                          {
                            key: 'toggle',
                            icon: record.status === 'active'
                              ? <StopOutlined style={{ color: '#dc2626' }} />
                              : <CheckCircleOutlined style={{ color: '#16a34a' }} />,
                            label: record.status === 'active' ? 'Deactivate' : 'Activate',
                            onClick: () => onToggleStatus?.(record),
                          },
                        ],
                      }}
                    >
                      <Button
                        icon={<MoreOutlined />}
                        size="small"
                        style={{
                          borderRadius: 8,
                          borderColor: '#e2e8f0',
                          color: '#475569',
                          background: '#fff',
                        }}
                      />
                    </Dropdown>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      <style>{`
        .ims-catalog-card.ant-card-hoverable:hover {
          box-shadow: 0 12px 40px rgba(102, 126, 234, 0.12) !important;
          border-color: #c7d2fe !important;
          transform: translateY(-2px);
        }
      `}</style>

      <Pagination
        style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}
        current={page}
        pageSize={pageSize}
        total={items.length}
        showSizeChanger
        pageSizeOptions={['12', '24', '48', '96']}
        showTotal={(total) => `Total ${total} items`}
        onChange={(p, ps) => {
          onPageChange?.(p);
          if (ps !== pageSize) onPageSizeChange?.(ps);
        }}
      />
    </>
  );
};

export default ItemCatalogGrid;
