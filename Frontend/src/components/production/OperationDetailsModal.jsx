import React, { useEffect, useState } from 'react';
import {
  Modal, Button, Row, Col, Card, Tag, Table, Empty, Tabs, Spin, Typography,
} from 'antd';
import {
  EyeOutlined,
  BuildOutlined,
  UndoOutlined,
  HistoryOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import apiService from '../../services/apiService';

const { Text } = Typography;

const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

const formatMoney = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const statusTag = (status) => {
  const map = {
    draft: { color: 'gold', label: 'Draft' },
    done: { color: 'green', label: 'Done' },
    cancelled: { color: 'default', label: 'Cancelled' },
  };
  const cfg = map[status] || { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
};

const typeTag = (type) => (
  <Tag
    color={type === 'assemble' ? 'blue' : 'orange'}
    icon={type === 'assemble' ? <BuildOutlined /> : <UndoOutlined />}
  >
    {type === 'assemble' ? 'Assemble' : 'Disassemble'}
  </Tag>
);

const InfoRow = ({ label, value }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f5f5f5', fontSize: 13 }}>
    <span style={{ color: '#8c8c8c' }}>{label}</span>
    <span style={{ fontWeight: 600, color: '#1a1a2e', maxWidth: '55%', textAlign: 'right', wordBreak: 'break-word' }}>
      {value ?? '—'}
    </span>
  </div>
);

const normalizeAllocations = (result, key) => {
  const raw = result?.[key];
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    return Object.entries(raw).flatMap(([itemId, rows]) => {
      const list = Array.isArray(rows) ? rows : [rows];
      return list.map((row, idx) => ({ ...row, itemId: row.itemId || itemId, _key: `${itemId}-${idx}` }));
    });
  }
  return [];
};

const OperationDetailsModal = ({ open, operationId, seed, onClose, onResume }) => {
  const [operation, setOperation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !operationId) {
      setOperation(null);
      return undefined;
    }

    let cancelled = false;
    setOperation(seed || null);
    setLoading(true);

    (async () => {
      try {
        const res = await apiService.get(`/production/operations/${operationId}`);
        if (!cancelled) {
          setOperation(res.success ? res.data : seed || null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch operation details:', error);
          setOperation(seed || null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, operationId, seed]);

  const handleClose = () => {
    setOperation(null);
    onClose?.();
  };

  const op = operation;
  const result = op?.result || {};
  const payload = op?.payload || {};
  const isAssemble = op?.operationType === 'assemble';
  const isDone = op?.status === 'done';

  const componentAllocRows = normalizeAllocations(result, 'componentBatchAllocations');
  const kitAllocRows = normalizeAllocations(result, 'kitBatchAllocations');
  const componentBatchRows = normalizeAllocations(result, 'componentBatches');

  const componentLabel = (row) => {
    if (row?.itemName) {
      return row.itemSku ? `${row.itemName} (${row.itemSku})` : row.itemName;
    }
    return row?.itemId || '—';
  };

  const batchColumns = [
    { title: 'Batch #', dataIndex: 'batchNumber', key: 'batchNumber', render: (v) => v || '—' },
    { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', render: (v) => (v != null ? Number(v) : '—') },
    { title: 'Component', key: 'component', ellipsis: true, render: (_, r) => componentLabel(r) },
  ];
  const kitBatchColumns = batchColumns.filter((c) => c.key !== 'component');

  const overviewTab = (
    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 12 }} styles={{ body: { padding: '14px 18px' } }}>
          <InfoRow label="Kit" value={op?.kitName ? `${op.kitName} (${op.kitSku || ''})` : '—'} />
          <InfoRow label="Warehouse" value={op?.warehouseName || '—'} />
          <InfoRow label="Quantity" value={op?.quantity} />
          <InfoRow label="Output batch" value={op?.outputBatchNumber || payload?.outputBatchNumber || '—'} />
          <InfoRow label="Reference" value={op?.batchRef || result?.batchRef || '—'} />
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card variant="borderless" style={{ borderRadius: 12, marginBottom: 12 }} styles={{ body: { padding: '14px 18px' } }}>
          <InfoRow
            label="Est. unit cost"
            value={op?.estimatedUnitCost != null ? formatMoney(op.estimatedUnitCost) : '—'}
          />
          <InfoRow
            label="Actual unit cost"
            value={result?.unitKitCost != null ? formatMoney(result.unitKitCost) : '—'}
          />
          <InfoRow
            label="Manufacture date"
            value={payload?.outputManufactureDate ? dayjs(payload.outputManufactureDate).format('DD MMM YYYY') : '—'}
          />
          <InfoRow
            label="Expiry date"
            value={payload?.outputExpiryDate ? dayjs(payload.outputExpiryDate).format('DD MMM YYYY') : '—'}
          />
          <InfoRow label="Created by" value={op?.createdByName?.trim() || '—'} />
          <InfoRow label="Executed by" value={op?.executedByName?.trim() || '—'} />
        </Card>
      </Col>
      {op?.notes ? (
        <Col span={24}>
          <Card variant="borderless" style={{ borderRadius: 12 }} styles={{ body: { padding: '14px 18px' } }}>
            <Text type="secondary">Notes</Text>
            <div style={{ marginTop: 6, fontSize: 13 }}>{op.notes}</div>
          </Card>
        </Col>
      ) : null}
    </Row>
  );

  const resultTab = !isDone ? (
    <Empty description="Operation has not been executed yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
  ) : isAssemble ? (
    <div>
      <Card
        size="small"
        title="Output kit batch"
        style={{ borderRadius: 12, marginBottom: 12 }}
      >
        <InfoRow label="Batch number" value={result?.outputBatchNumber || op?.outputBatchNumber} />
        <InfoRow label="Unit kit cost" value={result?.unitKitCost != null ? formatMoney(result.unitKitCost) : '—'} />
      </Card>
      <Card size="small" title="Component batches consumed" style={{ borderRadius: 12 }}>
        {componentAllocRows.length === 0 ? (
          <Empty description="No component batch movements" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            size="small"
            rowKey={(r, i) => r._key || r.batchId || i}
            pagination={false}
            dataSource={componentAllocRows}
            columns={batchColumns}
          />
        )}
      </Card>
    </div>
  ) : (
    <div>
      <Card size="small" title="Kit batches consumed (FEFO)" style={{ borderRadius: 12, marginBottom: 12 }}>
        {kitAllocRows.length === 0 ? (
          <Empty description="No kit batch consumption" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            size="small"
            rowKey={(r, i) => r.batchId || i}
            pagination={false}
            dataSource={kitAllocRows}
            columns={kitBatchColumns}
          />
        )}
      </Card>
      <Card size="small" title="Component batches created" style={{ borderRadius: 12 }}>
        {componentBatchRows.length === 0 ? (
          <Empty description="No component batches created" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Table
            size="small"
            rowKey={(r, i) => r.batchId || i}
            pagination={false}
            dataSource={componentBatchRows}
            columns={batchColumns}
          />
        )}
      </Card>
    </div>
  );

  const tabItems = [
    { key: 'overview', label: 'Overview', children: overviewTab },
    { key: 'result', label: 'Execution result', children: resultTab },
  ];

  return (
    <Modal
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: GRADIENT, borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
            <EyeOutlined />
          </div>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Operation Details</span>
        </div>
      )}
      open={open}
      onCancel={handleClose}
      footer={[
        op?.status === 'draft' && onResume ? (
          <Button key="resume" type="primary" onClick={() => { onResume(op); handleClose(); }}>
            Resume draft
          </Button>
        ) : null,
        <Button key="close" onClick={handleClose}>Close</Button>,
      ].filter(Boolean)}
      width="min(1100px, 98vw)"
      style={{ top: 16 }}
      styles={{ body: { background: '#fafbff', maxHeight: '82vh', overflowY: 'auto', padding: '20px 24px' } }}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {op ? (
          <div>
            <div
              style={{
                background: GRADIENT,
                borderRadius: 12,
                padding: '20px 24px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 32,
                  color: '#fff',
                }}
              >
                {isAssemble ? <BuildOutlined /> : <UndoOutlined />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
                  {op.operationNumber}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 4 }}>
                  {op.kitName ? `${op.kitName} (${op.kitSku || ''})` : '—'}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {typeTag(op.operationType)}
                  {statusTag(op.status)}
                  {op.warehouseName ? <Tag style={{ borderRadius: 20 }}>{op.warehouseName}</Tag> : null}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { label: 'Quantity', val: op.quantity },
                  { label: 'Batch', val: op.outputBatchNumber || '—' },
                  {
                    label: 'Date',
                    val: op.executedAt || op.createdAt
                      ? dayjs(op.executedAt || op.createdAt).format('DD MMM YYYY HH:mm')
                      : '—',
                  },
                ].map((x) => (
                  <div
                    key={x.label}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: 10,
                      padding: '8px 16px',
                      textAlign: 'center',
                      minWidth: 90,
                    }}
                  >
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 700, wordBreak: 'break-word' }}>{x.val}</div>
                    <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>{x.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <Tabs
              defaultActiveKey="overview"
              items={tabItems.map((t) => ({
                ...t,
                label: (
                  <span>
                    {t.key === 'result' ? <InboxOutlined /> : <HistoryOutlined />}
                    {' '}
                    {t.label}
                  </span>
                ),
              }))}
            />
          </div>
        ) : (
          !loading && <Empty description="Operation not found" />
        )}
      </Spin>
    </Modal>
  );
};

export default OperationDetailsModal;
