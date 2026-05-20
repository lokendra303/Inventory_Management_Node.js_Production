import React from 'react';
import { Row, Col } from 'antd';

export const InvoiceListStatCard = ({
  label,
  value,
  sub,
  subValue,
  gradient,
  shadow,
  icon,
  hint,
}) => (
  <div
    style={{
      background: gradient,
      borderRadius: 16,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: `0 4px 18px ${shadow}`,
      transition: 'transform 0.2s, box-shadow 0.2s',
      minHeight: 88,
      overflow: 'hidden',
      position: 'relative',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = `0 8px 24px ${shadow}`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = `0 4px 18px ${shadow}`;
    }}
  >
    <div
      style={{
        background: 'rgba(255,255,255,0.22)',
        borderRadius: 12,
        width: 44,
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0, flex: 1 }}>
      <div
        style={{
          fontSize: 'clamp(18px,4vw,26px)',
          fontWeight: 800,
          color: '#fff',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
          marginTop: 2,
        }}
      >
        {label}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.72)',
            marginTop: 4,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sub}: <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.95)' }}>{subValue}</span>
        </div>
      )}
      {hint && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{hint}</div>
      )}
    </div>
  </div>
);

/** Aggregate rows from GET .../analytics/summary statusBreakdown */
export function aggregateInvoiceStatusBreakdown(rows = []) {
  const out = {
    totalCount: 0,
    totalAmount: 0,
    paidCount: 0,
    collectedAmount: 0,
    outstandingCount: 0,
    outstandingBalance: 0,
    draftCount: 0,
    draftAmount: 0,
  };
  for (const row of rows) {
    const count = Number(row.count) || 0;
    const total = Number(row.total_amount) || 0;
    const paid = Number(row.paid_amount) || 0;
    const balance = Number(row.balance_amount) || 0;
    out.totalCount += count;
    out.totalAmount += total;
    if (row.status === 'paid') {
      out.paidCount += count;
      out.collectedAmount += paid || total;
    } else if (row.status === 'draft') {
      out.draftCount += count;
      out.draftAmount += total;
    } else if (row.status !== 'cancelled' && balance > 0) {
      out.outstandingCount += count;
      out.outstandingBalance += balance;
    }
  }
  return out;
}

const InvoiceListStatCards = ({ cards }) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
    {cards.map((card) => (
      <Col xs={12} sm={12} md={6} key={card.label}>
        <InvoiceListStatCard {...card} />
      </Col>
    ))}
  </Row>
);

export default InvoiceListStatCards;
