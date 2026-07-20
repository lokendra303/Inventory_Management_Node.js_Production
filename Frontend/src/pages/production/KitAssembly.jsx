import React, { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import {
  Card,
  Form,
  Select,
  InputNumber,
  Input,
  Button,
  message,
  Row,
  Col,
  Table,
  Tag,
  Space,
  Spin,
  Typography,
  Divider,
  Alert,
  DatePicker,
  Tabs,
  Segmented,
  Popconfirm,
  Empty,
} from 'antd';
import {
  BuildOutlined,
  UndoOutlined,
  ReloadOutlined,
  HistoryOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import apiService from '../../services/apiService';
import { filterSelectOption } from '../../utils/selectFilter';
import batchGeneratorService from '../../services/batchGeneratorService';
import { buildKitBatchContext } from '../../utils/batchGeneration';
import { useAuth } from '../../hooks/useAuth.jsx';
import OperationDetailsModal from '../../components/production/OperationDetailsModal';

const { Text, Title } = Typography;

const BatchGeneratorField = lazy(() => import('../../components/production/BatchGeneratorField'));
const BatchRulesModal = lazy(() => import('../../components/production/BatchRulesModal'));

const PAGE_BG = '#f0f2f5';
const GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const CARD_SHADOW = '0 2px 12px rgba(0,0,0,0.06)';
const SECTION_LABEL = {
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  marginBottom: 10,
  display: 'block',
};

const OPERATION_TYPES = [
  {
    value: 'assemble',
    title: 'Assemble',
    description: 'Build finished goods from parts',
  },
  {
    value: 'disassemble',
    title: 'Disassemble',
    description: 'Break down finished goods into parts',
  },
];

const statusTag = (status) => {
  const map = {
    draft: { color: 'gold', label: 'Draft' },
    done: { color: 'green', label: 'Done' },
    cancelled: { color: 'default', label: 'Cancelled' },
  };
  const cfg = map[status] || { color: 'default', label: status || '—' };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
};

const operationTypeTag = (type) => {
  const isAssemble = String(type || '').toLowerCase() === 'assemble';
  return (
    <Tag color={isAssemble ? 'blue' : 'orange'}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {isAssemble ? <BuildOutlined /> : <UndoOutlined />}
        {isAssemble ? 'Assemble' : 'Disassemble'}
      </span>
    </Tag>
  );
};

const formatMoney = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function KitAssembly() {
  const { user } = useAuth();
  const canManage = user?.permissions?.production_management || user?.permissions?.all;

  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [disassemblyPreview, setDisassemblyPreview] = useState(null);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [loadingDisasmPreview, setLoadingDisasmPreview] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [batchRulesOpen, setBatchRulesOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('new');
  const [operationType, setOperationType] = useState('assemble');
  const [draftId, setDraftId] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all');
  const [viewOperation, setViewOperation] = useState(null);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [quantityStockAlert, setQuantityStockAlert] = useState(null);
  const lastQuantityWarnAtRef = useRef(0);

  const [form] = Form.useForm();

  const watchedCompositeId = Form.useWatch('compositeItemId', form);
  const watchedWarehouseId = Form.useWatch('warehouseId', form);
  const watchedQuantity = Form.useWatch('quantity', form);

  const compositeItems = items.filter(
    (i) => String(i.type || '').toLowerCase() === 'composite' && i.status === 'active'
  );

  const selectedKitItem = useMemo(
    () => compositeItems.find((i) => i.id === watchedCompositeId) || null,
    [compositeItems, watchedCompositeId]
  );

  const estimatedUnitCost = Number(availability?.estimatedUnitCost) || 0;
  const qty = Number(watchedQuantity) || 0;
  const estimatedTotalCost = estimatedUnitCost * qty;

  const maxOperationQuantity = useMemo(() => {
    if (operationType === 'assemble') {
      if (!availability) return null;
      return Number(availability.buildableFromComponents) || 0;
    }
    const previewAvail = Number(disassemblyPreview?.kitAvailable);
    if (Number.isFinite(previewAvail)) return previewAvail;
    if (!availability) return null;
    return Number(availability.kitAvailable) || 0;
  }, [operationType, availability, disassemblyPreview]);

  const isQuantityOverLimit = maxOperationQuantity != null
    && qty > 0
    && qty > maxOperationQuantity;

  const showQuantityStockAlert = Boolean(quantityStockAlert) || isQuantityOverLimit;
  const alertRequestedQty = quantityStockAlert?.requested ?? qty;
  const alertAvailableQty = quantityStockAlert?.available ?? maxOperationQuantity;

  const selectedWarehouseName = useMemo(
    () => warehouses.find((w) => w.id === watchedWarehouseId)?.name || 'selected warehouse',
    [warehouses, watchedWarehouseId]
  );

  const warnQuantityOverLimit = useCallback((requestedQty) => {
    if (maxOperationQuantity == null) return;
    const now = Date.now();
    if (now - lastQuantityWarnAtRef.current < 800) return;
    lastQuantityWarnAtRef.current = now;
    setQuantityStockAlert({ requested: requestedQty, available: maxOperationQuantity });
    const unitLabel = maxOperationQuantity !== 1 ? 's' : '';
    if (operationType === 'assemble') {
      message.warning(
        `Only ${maxOperationQuantity} unit${unitLabel} can be built from available parts at ${selectedWarehouseName}.`
      );
    } else {
      message.warning(
        `Only ${maxOperationQuantity} finished unit${unitLabel} available at ${selectedWarehouseName}.`
      );
    }
  }, [maxOperationQuantity, operationType, selectedWarehouseName]);

  const normalizeOperationQuantity = useCallback((value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    if (maxOperationQuantity == null) {
      setQuantityStockAlert(null);
      return n;
    }
    if (n > maxOperationQuantity) {
      warnQuantityOverLimit(n);
      return maxOperationQuantity;
    }
    setQuantityStockAlert(null);
    return n;
  }, [maxOperationQuantity, warnQuantityOverLimit]);

  useEffect(() => {
    setQuantityStockAlert(null);
  }, [watchedCompositeId, watchedWarehouseId, operationType, maxOperationQuantity]);

  useEffect(() => {
    if (maxOperationQuantity == null) return undefined;
    const currentQty = form.getFieldValue('quantity');
    if (currentQty != null && currentQty !== '') {
      form.validateFields(['quantity']).catch(() => {});
    }
    return undefined;
  }, [maxOperationQuantity, form]);

  const fetchLookups = async () => {
    try {
      const [itemsRes, whRes] = await Promise.all([
        apiService.get('/production/bom-items'),
        apiService.get('/warehouses'),
      ]);
      setItems(itemsRes.success ? itemsRes.data : []);
      setWarehouses(whRes.success ? whRes.data.filter((w) => w.status === 'active') : []);
    } catch {
      message.error('Failed to load items and warehouses');
    }
  };

  const fetchHistory = useCallback(async (status = historyFilter) => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({ limit: '100' });
      if (status && status !== 'all') params.set('status', status);
      const res = await apiService.get(`/production/operations?${params}`);
      setHistory(Array.isArray(res?.data) ? res.data : []);
    } catch {
      message.error('Failed to load operation history');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyFilter]);

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab, historyFilter, fetchHistory]);

  const loadAvailability = useCallback(async (compositeItemId, warehouseId) => {
    if (!compositeItemId || !warehouseId) {
      setAvailability(null);
      return;
    }
    try {
      setLoadingAvail(true);
      const res = await apiService.get(
        `/production/bom-items/${compositeItemId}/availability/${warehouseId}`
      );
      const data = res.success ? res.data : null;
      setAvailability(data);
      if (operationType === 'assemble' && data?.suggestedOutputBatchNumber) {
        form.setFieldsValue({
          outputBatchNumber: data.suggestedOutputBatchNumber,
          batchRuleId: data.batchRule?.id || undefined,
        });
      }
    } catch (err) {
      setAvailability(null);
      message.error(err?.response?.data?.error || 'Could not load manufacturing availability');
    } finally {
      setLoadingAvail(false);
    }
  }, [form, operationType]);

  const loadDisassemblyPreview = useCallback(async (compositeItemId, warehouseId, quantity) => {
    if (!compositeItemId || !warehouseId || !quantity || quantity <= 0) {
      setDisassemblyPreview(null);
      return;
    }
    try {
      setLoadingDisasmPreview(true);
      const res = await apiService.get(
        `/production/bom-items/${compositeItemId}/disassembly-preview/${warehouseId}?quantity=${quantity}`
      );
      setDisassemblyPreview(res.success ? res.data : null);
    } catch (err) {
      setDisassemblyPreview(null);
      message.error(err?.response?.data?.error || 'Could not load disassembly preview');
    } finally {
      setLoadingDisasmPreview(false);
    }
  }, []);

  const onFieldsChange = (_, all) => {
    loadAvailability(all.compositeItemId, all.warehouseId);
    if (operationType === 'disassemble') {
      loadDisassemblyPreview(all.compositeItemId, all.warehouseId, all.quantity);
    } else {
      setDisassemblyPreview(null);
    }
  };

  useEffect(() => {
    const all = form.getFieldsValue();
    if (operationType === 'disassemble') {
      loadDisassemblyPreview(all.compositeItemId, all.warehouseId, all.quantity);
    } else {
      setDisassemblyPreview(null);
    }
  }, [operationType, form, loadDisassemblyPreview]);

  const buildPayload = async (values) => {
    let outputBatchNumber = values.outputBatchNumber?.trim() || '';
    let batchRuleId = values.batchRuleId || undefined;

    if (operationType === 'assemble' && !outputBatchNumber) {
      const kitItem = compositeItems.find((i) => i.id === values.compositeItemId);
      const gen = await batchGeneratorService.generateBatch(buildKitBatchContext(values, {
        compositeItemId: values.compositeItemId,
        warehouseId: values.warehouseId,
        warehouses,
        kitItem,
      }));
      outputBatchNumber = gen.batchNumber;
      batchRuleId = gen.ruleId;
    }

    const payload = {
      operationType,
      compositeItemId: values.compositeItemId,
      warehouseId: values.warehouseId,
      quantity: values.quantity,
      notes: values.notes,
      estimatedUnitCost: availability?.estimatedUnitCost ?? null,
    };

    if (operationType === 'assemble') {
      Object.assign(payload, {
        outputBatchNumber,
        batchRuleId,
        outputManufactureDate: values.outputManufactureDate
          ? values.outputManufactureDate.format('YYYY-MM-DD')
          : undefined,
        outputExpiryDate: values.outputExpiryDate
          ? values.outputExpiryDate.format('YYYY-MM-DD')
          : undefined,
      });
    }

    return payload;
  };

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      setSavingDraft(true);
      const payload = await buildPayload(values);
      if (draftId) payload.id = draftId;

      const res = draftId
        ? await apiService.put(`/production/operations/${draftId}`, payload)
        : await apiService.post('/production/operations', payload);

      if (res.success) {
        const saved = res.data;
        setDraftId(saved?.id || draftId);
        message.success(`Draft saved${saved?.operationNumber ? ` (${saved.operationNumber})` : ''}`);
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error || 'Failed to save draft');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      setConfirming(true);
      const payload = await buildPayload(values);

      let orderId = draftId;
      if (!orderId) {
        const draftRes = await apiService.post('/production/operations', payload);
        if (!draftRes.success) throw new Error(draftRes.error || 'Failed to create draft');
        orderId = draftRes.data?.id;
        setDraftId(orderId);
      } else {
        await apiService.put(`/production/operations/${orderId}`, payload);
      }

      const res = await apiService.post(`/production/operations/${orderId}/confirm`);
      if (res.success) {
        const batchNo = res.data?.outputBatchNumber;
        const verb = operationType === 'assemble' ? 'Assembled' : 'Disassembled';
        message.success(
          batchNo
            ? `${verb} ${values.quantity} unit(s) — ${res.data?.operationNumber || ''} batch ${batchNo}`
            : `${verb} ${values.quantity} unit(s) — ${res.data?.operationNumber || 'done'}`
        );
        form.resetFields();
        setDraftId(null);
        setDisassemblyPreview(null);
        loadAvailability(values.compositeItemId, values.warehouseId);
        if (activeTab === 'history') fetchHistory();
      }
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error || 'Operation failed');
    } finally {
      setConfirming(false);
    }
  };

  const viewOperationDetails = (order) => {
    setViewOperation(order);
    setViewModalOpen(true);
  };

  const loadDraftIntoForm = (order) => {
    setDraftId(order.id);
    setOperationType(order.operationType || 'assemble');
    setActiveTab('new');
    form.setFieldsValue({
      compositeItemId: order.compositeItemId,
      warehouseId: order.warehouseId,
      quantity: order.quantity,
      notes: order.notes,
      outputBatchNumber: order.payload?.outputBatchNumber,
      batchRuleId: order.payload?.batchRuleId,
      outputManufactureDate: order.payload?.outputManufactureDate
        ? dayjs(order.payload.outputManufactureDate)
        : undefined,
      outputExpiryDate: order.payload?.outputExpiryDate
        ? dayjs(order.payload.outputExpiryDate)
        : undefined,
    });
    loadAvailability(order.compositeItemId, order.warehouseId);
    if (order.operationType === 'disassemble') {
      loadDisassemblyPreview(order.compositeItemId, order.warehouseId, order.quantity);
    }
  };

  const kitHasExpiry = Boolean(availability?.kitTracking?.hasExpiry);

  const componentColumns = [
    { title: 'Component', dataIndex: 'name', key: 'name', render: (t, r) => `${t || '—'} (${r.sku || ''})` },
    {
      title: 'Per unit',
      key: 'qty',
      render: (_, r) => {
        const stockQty = r.quantityRequiredInStockUnit ?? r.quantityRequiredPerKit;
        const stockUnit = r.stockUnit || '';
        const consQty = r.quantityRequiredPerKit;
        const consUnit = r.consumptionUnit || '';
        if (
          consUnit
          && stockUnit
          && String(consUnit) !== String(stockUnit)
          && Number(consQty) !== Number(stockQty)
        ) {
          return (
            <span>
              {consQty} {consUnit}
              <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                ≈ {stockQty} {stockUnit} stock
              </Text>
            </span>
          );
        }
        return `${stockQty ?? '—'}${stockUnit ? ` ${stockUnit}` : ''}`;
      },
    },
    { title: 'Available (WH)', dataIndex: 'available', key: 'avail' },
    {
      title: 'Avg cost',
      dataIndex: 'averageCost',
      key: 'cost',
      render: (v) => formatMoney(v),
    },
    {
      title: 'Units buildable',
      dataIndex: 'kitsSupportable',
      key: 'kits',
      render: (v) => <Tag color={v > 0 ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: 'Tracking',
      key: 'tracking',
      render: (_, r) => (
        <Space size={4} wrap>
          {r.isBatchTracked ? <Tag color="blue">Batch</Tag> : null}
          {r.isSerialized ? <Tag color="purple">Serial</Tag> : null}
          {!r.isBatchTracked && !r.isSerialized ? <Text type="secondary">—</Text> : null}
        </Space>
      ),
    },
  ];

  const fefoColumns = [
    { title: 'Batch #', dataIndex: 'batchNumber', key: 'batch' },
    { title: 'Expiry', dataIndex: 'expiryDate', key: 'exp', render: (v) => v || '—' },
    { title: 'Available', dataIndex: 'availableQuantity', key: 'avail' },
    { title: 'Allocate', dataIndex: 'allocatedQuantity', key: 'alloc' },
  ];

  const historyColumns = [
    {
      title: 'Operation #',
      dataIndex: 'operationNumber',
      key: 'op',
      render: (text, record) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, fontFamily: 'monospace' }}
          onClick={(e) => { e.stopPropagation(); viewOperationDetails(record); }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'operationType',
      key: 'type',
      render: (t) => operationTypeTag(t),
    },
    {
      title: 'Finished product',
      key: 'kit',
      render: (_, r) => `${r.kitName || '—'} (${r.kitSku || ''})`,
    },
    { title: 'Qty', dataIndex: 'quantity', key: 'qty' },
    { title: 'Batch', dataIndex: 'outputBatchNumber', key: 'batch', render: (v) => v || '—' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status) => statusTag(status) },
    {
      title: 'By',
      key: 'by',
      render: (_, r) => r.executedByName?.trim() || r.createdByName?.trim() || '—',
    },
    {
      title: 'Date',
      key: 'date',
      render: (_, r) => {
        const d = r.executedAt || r.createdAt;
        return d ? dayjs(d).format('DD MMM YYYY HH:mm') : '—';
      },
    },
    {
      title: '',
      key: 'actions',
      render: (_, r) => (
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => viewOperationDetails(r)}>
            View
          </Button>
          {r.status === 'draft' && canManage ? (
            <Button type="link" size="small" onClick={() => loadDraftIntoForm(r)}>
              Resume
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  const availabilityPanel = (
    <Spin spinning={loadingAvail}>
      {availability ? (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {operationType === 'assemble' && availability.anyBatchTrackedComponent ? (
            <Alert
              type="info"
              showIcon
              message="Batch-tracked components use FEFO during assembly unless you specify lots manually."
            />
          ) : null}
          <Row gutter={[12, 12]}>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ borderRadius: 10, height: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Finished goods on hand</Text>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{availability.kitOnHand}</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Available: {availability.kitAvailable}</Text>
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ borderRadius: 10, height: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Buildable from parts</Text>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{availability.buildableFromComponents}</div>
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small" style={{ borderRadius: 10, height: '100%' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <DollarOutlined /> Est. unit cost
                </Text>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{formatMoney(estimatedUnitCost)}</div>
                {qty > 0 ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>Total: {formatMoney(estimatedTotalCost)}</Text>
                ) : null}
              </Card>
            </Col>
            {operationType === 'assemble' ? (
              <Col xs={24} sm={12}>
                <Card size="small" style={{ borderRadius: 10, height: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Next output batch #</Text>
                  <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                    {availability.suggestedOutputBatchNumber || '—'}
                  </div>
                </Card>
              </Col>
            ) : null}
          </Row>
          <Table
            size="small"
            rowKey="componentItemId"
            pagination={false}
            dataSource={availability.componentDetails || []}
            columns={componentColumns}
          />
        </Space>
      ) : (
        <div
          style={{
            minHeight: 360,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 16px',
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={(
              <span style={{ color: '#64748b', maxWidth: 320, display: 'inline-block' }}>
                Select a finished product and warehouse to preview stock, cost, and BOM usage.
              </span>
            )}
          />
        </div>
      )}
    </Spin>
  );

  const disassemblyPanel = operationType === 'disassemble' ? (
    <Spin spinning={loadingDisasmPreview}>
      {disassemblyPreview ? (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {!disassemblyPreview.kitSufficient ? (
            <Alert type="error" showIcon message={`Insufficient finished goods stock (available: ${disassemblyPreview.kitAvailable})`} />
          ) : null}
          {disassemblyPreview.kitBatchAllocations?.length > 0 ? (
            <>
              <Text strong><EyeOutlined /> Finished goods batches to consume (FEFO)</Text>
              <Table
                size="small"
                rowKey="batchId"
                pagination={false}
                dataSource={disassemblyPreview.kitBatchAllocations}
                columns={fefoColumns}
              />
            </>
          ) : disassemblyPreview.kitBatchError ? (
            <Alert type="warning" showIcon message={disassemblyPreview.kitBatchError} />
          ) : null}
          <Text strong>Components returned</Text>
          <Table
            size="small"
            rowKey="componentItemId"
            pagination={false}
            dataSource={disassemblyPreview.componentPreview || []}
            columns={[
              { title: 'Component', dataIndex: 'name', render: (t, r) => `${t} (${r.sku})` },
              {
                title: 'Per unit',
                key: 'quantityPerKit',
                render: (_, r) => {
                  const stockQty = r.quantityRequiredInStockUnit ?? r.quantityPerKit;
                  const stockUnit = r.stockUnit || '';
                  const consQty = r.quantityPerKit;
                  const consUnit = r.consumptionUnit || '';
                  if (
                    consUnit
                    && stockUnit
                    && String(consUnit) !== String(stockUnit)
                    && Number(consQty) !== Number(stockQty)
                  ) {
                    return (
                      <span>
                        {consQty} {consUnit}
                        <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
                          ≈ {stockQty} {stockUnit} stock
                        </Text>
                      </span>
                    );
                  }
                  return `${stockQty ?? '—'}${stockUnit ? ` ${stockUnit}` : ''}`;
                },
              },
              { title: 'Returned', dataIndex: 'quantityReturned' },
              {
                title: 'Batch',
                dataIndex: 'willCreateBatch',
                render: (v) => (v ? <Tag color="blue">New DSM batch</Tag> : <Text type="secondary">—</Text>),
              },
            ]}
          />
        </Space>
      ) : (
        <div
          style={{
            minHeight: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Enter quantity to preview FEFO finished-goods batch consumption."
          />
        </div>
      )}
    </Spin>
  ) : null;

  const newOperationTab = (
    <Row gutter={[24, 24]} align="stretch">
      <Col xs={24} xl={11} style={{ display: 'flex' }}>
        <Card
          bordered={false}
          style={{ borderRadius: 12, boxShadow: CARD_SHADOW, width: '100%' }}
          styles={{ body: { padding: '20px 24px 24px' } }}
        >
          <div style={{ marginBottom: 20 }}>
            <span style={SECTION_LABEL}>Operation type</span>
            <Row gutter={[12, 12]}>
              {OPERATION_TYPES.map((opt) => {
                const selected = operationType === opt.value;
                const isAssemble = opt.value === 'assemble';
                return (
                  <Col xs={24} sm={12} key={opt.value}>
                    <button
                      type="button"
                      onClick={() => setOperationType(opt.value)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: `2px solid ${selected ? '#667eea' : '#e2e8f0'}`,
                        borderRadius: 12,
                        padding: '14px 16px',
                        cursor: 'pointer',
                        background: selected
                          ? 'linear-gradient(135deg, #f0f4ff 0%, #f5f0ff 100%)'
                          : '#fff',
                        boxShadow: selected ? '0 4px 14px rgba(102, 126, 234, 0.15)' : 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
                      }}
                    >
                      <Space align="start" size={12}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: selected ? GRADIENT : '#f1f5f9',
                            color: selected ? '#fff' : '#64748b',
                            fontSize: 18,
                            flexShrink: 0,
                          }}
                        >
                          {isAssemble ? <BuildOutlined /> : <UndoOutlined />}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{opt.title}</div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                            {opt.description}
                          </div>
                        </div>
                      </Space>
                    </button>
                  </Col>
                );
              })}
            </Row>
            {draftId ? (
              <Alert type="info" showIcon message="Editing draft operation" style={{ marginTop: 12, borderRadius: 10 }} />
            ) : null}
          </div>

          <Form form={form} layout="vertical" onValuesChange={onFieldsChange} requiredMark="optional">
            <Form.Item
              name="compositeItemId"
              label="Finished product"
              tooltip="BOM item — the assembled product you are building or breaking down"
              rules={[{ required: true, message: 'Select a finished product' }]}
            >
              <Select
                showSearch
                placeholder="Select BOM item"
                filterOption={filterSelectOption}
                options={compositeItems.map((i) => ({
                  value: i.id,
                  label: `${i.name} (${i.sku})`,
                }))}
              />
            </Form.Item>
            <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true, message: 'Select a warehouse' }]}>
              <Select
                showSearch
                placeholder="Warehouse"
                filterOption={filterSelectOption}
                options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
              />
            </Form.Item>
            <Form.Item
              name="quantity"
              label={operationType === 'assemble' ? 'Quantity to build' : 'Quantity to break down'}
              dependencies={['compositeItemId', 'warehouseId']}
              validateStatus={showQuantityStockAlert ? 'error' : undefined}
              normalize={normalizeOperationQuantity}
              rules={[
                { required: true, type: 'number', min: 0.0001, message: 'Enter a quantity greater than zero' },
                {
                  validator: (_, value) => {
                    const n = Number(value);
                    if (!Number.isFinite(n) || n <= 0) return Promise.resolve();
                    if (maxOperationQuantity == null) return Promise.resolve();
                    if (n > maxOperationQuantity) {
                      if (operationType === 'assemble') {
                        return Promise.reject(
                          new Error(`Cannot build more than ${maxOperationQuantity} — insufficient component stock`)
                        );
                      }
                      return Promise.reject(
                        new Error(`Cannot break down more than ${maxOperationQuantity} — insufficient finished goods stock`)
                      );
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <InputNumber
                min={0.0001}
                style={{ width: '100%' }}
              />
            </Form.Item>

            {watchedCompositeId && watchedWarehouseId && maxOperationQuantity != null ? (
              <>
                {showQuantityStockAlert ? (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#fff2f0',
                      border: '1px solid #ffccc7',
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#cf1322', fontWeight: 600 }}>
                      {operationType === 'assemble' ? (
                        <>
                          ⚠️ Insufficient component stock — only <strong>{alertAvailableQty}</strong> unit
                          {alertAvailableQty !== 1 ? 's' : ''} buildable from parts at <strong>{selectedWarehouseName}</strong>, but <strong>{alertRequestedQty}</strong> requested.
                        </>
                      ) : (
                        <>
                          ⚠️ Insufficient finished goods — only <strong>{alertAvailableQty}</strong> unit
                          {alertAvailableQty !== 1 ? 's' : ''} available at <strong>{selectedWarehouseName}</strong>, but <strong>{alertRequestedQty}</strong> requested.
                        </>
                      )}
                    </span>
                  </div>
                ) : null}
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#e6f7ff',
                    border: '1px solid #91d5ff',
                    borderRadius: 4,
                    marginBottom: 16,
                  }}
                >
                  <span style={{ fontSize: 13, color: '#0050b3' }}>
                    ℹ️ <strong>{selectedKitItem?.name || 'Finished product'}</strong>
                    {' '}at <strong>{selectedWarehouseName}</strong>:
                    <strong style={{ color: maxOperationQuantity > 0 ? '#52c41a' : '#ff4d4f', marginLeft: 4 }}>
                      {maxOperationQuantity}{' '}
                      {operationType === 'assemble' ? 'buildable from parts' : 'finished goods available'}
                    </strong>
                  </span>
                </div>
              </>
            ) : null}

            {operationType === 'assemble' ? (
              <>
                <Divider orientation="left" plain style={{ margin: '8px 0 16px' }}>
                  Output batch / lot
                </Divider>
                <Suspense fallback={null}>
                  <BatchGeneratorField
                    compositeItemId={watchedCompositeId}
                    warehouseId={watchedWarehouseId}
                    kitItem={selectedKitItem}
                    warehouses={warehouses}
                    canManage={canManage}
                    onOpenBatchRules={() => setBatchRulesOpen(true)}
                  />
                </Suspense>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="outputManufactureDate" label="Manufacture date (optional)">
                      <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="outputExpiryDate"
                      label="Expiry date"
                      rules={kitHasExpiry ? [{ required: true, message: 'Expiry is required for this finished product' }] : []}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD MMM YYYY"
                        disabledDate={(d) => d && d.isBefore(dayjs(), 'day')}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            ) : (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Disassembly consumes finished goods batches (FEFO) and creates DSM batches for batch-tracked components."
              />
            )}

            <Form.Item name="notes" label="Notes (optional)">
              <Input.TextArea rows={2} maxLength={500} />
            </Form.Item>

            {canManage ? (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 16,
                  borderTop: '1px solid #f0f0f0',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Button
                  icon={<SaveOutlined />}
                  loading={savingDraft}
                  onClick={handleSaveDraft}
                >
                  Save draft
                </Button>
                <Popconfirm
                  title={`Confirm and run ${operationType}?`}
                  description="This will execute stock movements immediately."
                  onConfirm={handleConfirm}
                  okText="Confirm"
                >
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={confirming}
                  >
                    Confirm & run
                  </Button>
                </Popconfirm>
                {draftId ? (
                  <Button
                    type="link"
                    danger
                    onClick={async () => {
                      try {
                        await apiService.delete(`/production/operations/${draftId}`);
                        message.success('Draft cancelled');
                        setDraftId(null);
                        form.resetFields();
                      } catch (err) {
                        message.error(err?.response?.data?.error || 'Failed to cancel draft');
                      }
                    }}
                  >
                    Cancel draft
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Form>
        </Card>
      </Col>

      <Col xs={24} xl={13} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card
          title="Stock & cost preview"
          extra={(
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                const a = form.getFieldsValue();
                loadAvailability(a.compositeItemId, a.warehouseId);
                if (operationType === 'disassemble') {
                  loadDisassemblyPreview(a.compositeItemId, a.warehouseId, a.quantity);
                }
              }}
            >
              Refresh
            </Button>
          )}
          bordered={false}
          style={{ borderRadius: 12, boxShadow: CARD_SHADOW, flex: 1 }}
          styles={{ body: { padding: '16px 20px 20px', minHeight: 420 } }}
        >
          {availabilityPanel}
        </Card>

        {operationType === 'disassemble' ? (
          <Card
            title="Disassembly preview (FEFO)"
            bordered={false}
            style={{ borderRadius: 12, boxShadow: CARD_SHADOW }}
            styles={{ body: { padding: '16px 20px 20px', minHeight: 200 } }}
          >
            {disassemblyPanel}
          </Card>
        ) : null}
      </Col>
    </Row>
  );

  const historyTab = (
    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Segmented
          value={historyFilter}
          onChange={setHistoryFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Done', value: 'done' },
            { label: 'Drafts', value: 'draft' },
            { label: 'Cancelled', value: 'cancelled' },
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={() => fetchHistory()} loading={historyLoading}>
          Refresh
        </Button>
      </Space>
      <Table
        rowKey="id"
        loading={historyLoading}
        dataSource={history}
        columns={historyColumns}
        locale={{ emptyText: <Empty description="No operations yet" /> }}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 900 }}
        onRow={(record) => ({
          onClick: () => viewOperationDetails(record),
          style: { cursor: 'pointer' },
        })}
      />
    </Card>
  );

  return (
    <div style={{ padding: 24, background: PAGE_BG, minHeight: '100%' }}>
      <div
        style={{
          background: GRADIENT,
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 24,
          color: '#fff',
          boxShadow: '0 8px 24px rgba(102, 126, 234, 0.35)',
        }}
      >
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          <BuildOutlined /> Manufacturing
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.85)', display: 'block', marginTop: 8 }}>
          Assemble or disassemble finished goods from parts — draft workflow, cost preview, FEFO disassembly, and full operation history.
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        destroyInactiveTabPane
        style={{ marginBottom: 0 }}
        items={[
          { key: 'new', label: 'New operation', children: newOperationTab },
          { key: 'history', label: <span><HistoryOutlined /> History</span>, children: historyTab },
        ]}
      />

      <Suspense fallback={null}>
        <BatchRulesModal open={batchRulesOpen} onClose={() => setBatchRulesOpen(false)} />
      </Suspense>

      <OperationDetailsModal
        open={viewModalOpen}
        operationId={viewOperation?.id}
        seed={viewOperation}
        onClose={() => {
          setViewModalOpen(false);
          setViewOperation(null);
        }}
        onResume={canManage ? loadDraftIntoForm : undefined}
      />
    </div>
  );
}
