import React from 'react';
import { Timeline, Tag, Spin, Empty } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { formatNumber } from '../../utils/currency';

const TransactionHistory = ({ data, loading, currency = '₹' }) => {
  const getEventColor = (eventType) => {
    if (eventType?.includes('RECEIVED')) return 'green';
    if (eventType?.includes('SHIPPED')) return 'red';
    if (eventType?.includes('RESERVED')) return 'orange';
    if (eventType?.includes('ADJUSTED')) return 'blue';
    if (eventType?.includes('TRANSFER')) return 'purple';
    return 'gray';
  };

  const getEventLabel = (eventType) => {
    if (eventType?.includes('RECEIVED')) return 'Stock Received';
    if (eventType?.includes('SHIPPED')) return 'Stock Shipped';
    if (eventType?.includes('RESERVED')) return 'Stock Reserved';
    if (eventType?.includes('CANCELLED')) return 'Reservation Cancelled';
    if (eventType?.includes('ADJUSTED')) return 'Stock Adjusted';
    if (eventType?.includes('TRANSFER_IN')) return 'Transfer In';
    if (eventType?.includes('TRANSFER_OUT')) return 'Transfer Out';
    return eventType;
  };

  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
      <h4 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <HistoryOutlined /> Transaction History
      </h4>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>
          <Spin />
        </div>
      ) : data.length > 0 ? (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          <Timeline>
            {data.map((event, index) => {
              const eventType = event.event_type || event.operation_type;
              const eventData = event.event_data || event;
              
              return (
                <Timeline.Item key={index} color={getEventColor(eventType)}>
                  <div style={{ marginBottom: 8 }}>
                    <Tag color={getEventColor(eventType)}>{getEventLabel(eventType)}</Tag>
                    <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                      {new Date(event.created_at || event.operation_date).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    {event.warehouse_name && (
                      <div>Warehouse: <strong>{event.warehouse_name}</strong></div>
                    )}
                    {(eventData.quantity || event.quantity_change) && (
                      <div>
                        {event.quantity_change ? 'Change: ' : 'Quantity: '}
                        <strong style={{ 
                          color: event.quantity_change > 0 ? '#52c41a' : event.quantity_change < 0 ? '#ff4d4f' : 'inherit' 
                        }}>
                          {event.quantity_change ? (event.quantity_change > 0 ? '+' : '') + event.quantity_change : eventData.quantity}
                        </strong>
                      </div>
                    )}
                    {eventData.quantityChange && (
                      <div>Change: <strong>{eventData.quantityChange > 0 ? '+' : ''}{eventData.quantityChange}</strong></div>
                    )}
                    {(event.balance_after !== null && event.balance_after !== undefined) && (
                      <div>Balance After: <strong>{event.balance_after}</strong></div>
                    )}
                    {(eventData.unitCost || event.unit_cost) && (
                      <div>Unit Cost: <strong>{currency}{formatNumber(eventData.unitCost || event.unit_cost)}</strong></div>
                    )}
                    {(eventData.reason || event.notes) && (
                      <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                        {eventData.reason ? `Reason: ${eventData.reason}` : `Notes: ${event.notes}`}
                      </div>
                    )}
                    {(eventData.grnNumber || eventData.poId || event.reference_number) && (
                      <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                        Ref: {eventData.grnNumber || event.reference_number || eventData.poId}
                      </div>
                    )}
                  </div>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </div>
      ) : (
        <Empty description="No transaction history available" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </div>
  );
};

export default TransactionHistory;
