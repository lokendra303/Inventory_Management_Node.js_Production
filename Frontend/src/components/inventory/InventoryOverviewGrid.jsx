import React from 'react';
import { Row, Col, Card, Button, Pagination, Spin, Empty, Tag, Tooltip } from 'antd';
import {
  InboxOutlined,
  EyeOutlined,
  WarningOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { formatNumber } from '../../utils/currency.js';

/**
 * Card grid for Inventory Overview ledger lines (per item × warehouse).
 */
const InventoryOverviewGrid = ({
  rows = [],
  loading = false,
  formatCurrency,
  page = 1,
  pageSize = 12,
  onPageChange,
  onView,
}) => {
  if (loading && !rows.length) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="No inventory data available"
        style={{ padding: '40px 0' }}
      />
    );
  }

  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  const lineValue = (r) => (
    (parseFloat(r.quantity_on_hand) || 0) * (parseFloat(r.average_cost) || 0)
  );

  return (
    <>
      <Spin spinning={loading}>
      <Row gutter={[16, 16]} align="stretch" style={{ padding: '0 20px 16px' }}>
        {pageRows.map((record) => {
          const avail = record.quantity_available || 0;
          const low = avail <= 10;
          const tv = lineValue(record);

          return (
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
                <div style={{ height: 3, background: 'linear-gradient(90deg, #1677ff, #5b21b6)' }} />
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: 'linear-gradient(145deg, #eff6ff 0%, #eef2ff 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#1677ff',
                        fontSize: 20,
                        flexShrink: 0,
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <InboxOutlined />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{ fontWeight: 700, color: '#0f172a', fontSize: 14, lineHeight: 1.35 }}
                        title={record.item_name}
                      >
                        {record.item_name}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
                        {record.sku}
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <Tag
                          icon={<EnvironmentOutlined />}
                          style={{
                            margin: 0,
                            borderRadius: 999,
                            background: '#f0f5ff',
                            border: '1px solid #adc6ff',
                            color: '#2f54eb',
                            fontSize: 11,
                          }}
                        >
                          {record.warehouse_name}
                        </Tag>
                        {record.unit && (
                          <Tag style={{ margin: 0, borderRadius: 999, fontSize: 11 }}>
                            {record.unit}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px 12px',
                        fontSize: 12,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>On hand</div>
                        <div style={{ fontWeight: 700, color: '#1677ff' }}>{formatNumber(record.quantity_on_hand || 0)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Available</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: low ? '#dc2626' : '#059669' }}>
                            {formatNumber(avail)}
                          </span>
                          {low && <WarningOutlined style={{ color: '#f59e0b' }} />}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Reserved</div>
                        <div style={{ fontWeight: 600, color: '#d97706' }}>{formatNumber(record.quantity_reserved || 0)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Avg cost</div>
                        <div style={{ fontWeight: 600 }}>
                          {record.average_cost != null && !Number.isNaN(Number(record.average_cost))
                            ? formatCurrency(record.average_cost)
                            : '—'}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e2e8f0', fontSize: 12 }}>
                      <span style={{ color: '#64748b' }}>Line value </span>
                      <span style={{ fontWeight: 800, color: '#1677ff' }}>
                        {tv > 0 ? formatCurrency(tv) : '—'}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title="View ledger detail">
                      <Button
                        type="primary"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => onView?.(record)}
                        style={{
                          borderRadius: 8,
                          background: 'linear-gradient(135deg, #1890ff, #096dd9)',
                          border: 'none',
                          fontWeight: 600,
                        }}
                      >
                        View
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
      </Spin>
      <Pagination
        style={{ padding: '4px 20px 16px', display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}
        current={page}
        pageSize={pageSize}
        total={rows.length}
        showSizeChanger
        pageSizeOptions={['12', '24', '48']}
        showTotal={(t) => `${t} lines`}
        onChange={(p, ps) => onPageChange?.(p, ps)}
      />
    </>
  );
};

export default InventoryOverviewGrid;
