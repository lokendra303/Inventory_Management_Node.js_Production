import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Empty, Spin, Select } from 'antd';
import { HistoryOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/apiService';
import EntityTransactionDetailModal from './EntityTransactionDetailModal';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatCommercialDocAmount } from '../../utils/currency';

const TYPE_META = {
  sales_order: {
    label: 'Sales Order',
    color: 'blue',
    path: '/sales-orders',
  },
  sales_invoice: {
    label: 'Sales Invoice',
    color: 'geekblue',
    path: '/sales-invoices',
  },
  delivery_challan: {
    label: 'Delivery Challan',
    color: 'cyan',
    path: '/sales/delivery-challans',
  },
  purchase_order: {
    label: 'Purchase Order',
    color: 'purple',
    path: '/purchase-orders',
  },
  purchase_invoice: {
    label: 'Purchase Invoice',
    color: 'volcano',
    path: '/purchase-invoices',
  },
  grn: {
    label: 'Goods Receipt',
    color: 'green',
    path: '/purchase-orders',
  },
  purchase_return: {
    label: 'Purchase Return',
    color: 'orange',
    path: '/purchases/returns',
  },
  payment: {
    label: 'Payment',
    color: 'gold',
    path: null,
  },
};

const STATUS_COLORS = {
  draft: 'default',
  posted: 'processing',
  confirmed: 'processing',
  sent: 'processing',
  approved: 'processing',
  partially_paid: 'warning',
  partially_received: 'warning',
  partially_shipped: 'warning',
  paid: 'success',
  received: 'success',
  delivered: 'success',
  shipped: 'success',
  dispatched: 'processing',
  invoiced: 'success',
  recorded: 'success',
  cancelled: 'error',
};

/**
 * @param {'customer'|'vendor'} entityType
 * @param {string} entityId
 */
const EntityTransactionHistory = ({ entityType, entityId }) => {
  const navigate = useNavigate();
  const { formatCurrency } = useCurrency();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  const [detailRecord, setDetailRecord] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const apiPath =
    entityType === 'customer'
      ? `/customers/${entityId}/transactions`
      : `/vendors/${entityId}/transactions`;

  const fetchHistory = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const response = await apiService.get(apiPath, {
        params: { limit: 100, offset: 0 },
      });
      if (response.success) {
        setTransactions(response.data?.transactions || []);
        setPagination(response.data?.pagination || { total: 0, limit: 100, offset: 0 });
      }
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath, entityId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filtered = typeFilter
    ? transactions.filter((t) => t.type === typeFilter)
    : transactions;

  const typeOptions = [...new Set(transactions.map((t) => t.type))].map((type) => ({
    value: type,
    label: TYPE_META[type]?.label || type,
  }));

  const resolveNavigatePath = (record) => {
    const meta = TYPE_META[record.type];
    if (!meta?.path) {
      if (record.type === 'payment' && record.relatedType && record.relatedId) {
        const related = TYPE_META[record.relatedType];
        return related?.path || null;
      }
      return null;
    }
    return meta.path;
  };

  const formatAmount = (record) => {
    if (record.type === 'delivery_challan' && !record.amount) {
      return '—';
    }
    if (record.currency) {
      return formatCommercialDocAmount(record.amount, { currency: record.currency });
    }
    return formatCurrency(record.amount);
  };

  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (d) => (d ? new Date(d).toLocaleDateString() : '—'),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 140,
      render: (type) => {
        const meta = TYPE_META[type] || { label: type, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Document',
      dataIndex: 'documentNumber',
      key: 'documentNumber',
      ellipsis: true,
      render: (text) => (
        <span style={{ fontWeight: 600, color: '#667eea' }}>{text || '—'}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => (
        <Tag color={STATUS_COLORS[s] || 'default'} style={{ textTransform: 'capitalize' }}>
          {(s || '—').replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (_, record) => (
        <span style={{ fontWeight: 600 }}>{formatAmount(record)}</span>
      ),
    },
    {
      title: 'Balance',
      dataIndex: 'balanceAmount',
      key: 'balanceAmount',
      width: 120,
      align: 'right',
      render: (v, record) => {
        if (v == null || v === '') return '—';
        if (record.currency) {
          return formatCommercialDocAmount(v, { currency: record.currency });
        }
        return formatCurrency(v);
      },
    },
    {
      title: '',
      key: 'action',
      width: 56,
      render: (_, record) => {
        const path = resolveNavigatePath(record);
        if (!path) return null;
        return (
          <a
            onClick={(e) => {
              e.stopPropagation();
              navigate(path);
            }}
            title="Open module list"
            style={{ color: '#667eea' }}
          >
            <LinkOutlined />
          </a>
        );
      },
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <HistoryOutlined style={{ color: '#667eea' }} />
          Transaction History
          <span style={{ fontSize: 12, fontWeight: 400, color: '#888' }}>— click a row for details</span>
          {pagination.total > 0 && (
            <Tag color="blue" style={{ fontWeight: 500, marginLeft: 4 }}>
              {pagination.total}
            </Tag>
          )}
        </h3>
        {typeOptions.length > 1 && (
          <Select
            allowClear
            placeholder="Filter by type"
            style={{ minWidth: 180 }}
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
          />
        )}
      </div>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey={(r) => `${r.type}-${r.id}`}
        loading={loading}
        size="small"
        onRow={(record) => ({
          onClick: () => {
            setDetailRecord(record);
            setDetailOpen(true);
          },
          style: { cursor: 'pointer' },
        })}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          showTotal: (total) => `${total} transaction${total !== 1 ? 's' : ''}`,
        }}
        locale={{
          emptyText: loading ? (
            <Spin />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No transactions with this party yet"
            />
          ),
        }}
        scroll={{ x: 'max-content' }}
      />

      <EntityTransactionDetailModal
        open={detailOpen}
        record={detailRecord}
        onClose={() => {
          setDetailOpen(false);
          setDetailRecord(null);
        }}
      />
    </div>
  );
};

export default EntityTransactionHistory;
