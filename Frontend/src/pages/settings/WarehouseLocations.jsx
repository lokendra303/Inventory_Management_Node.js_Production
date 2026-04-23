import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Card, Tabs, Table, Button, Space, Modal, Form, Input, InputNumber, Select,
  message, Tag, Popconfirm, Upload, Alert, Typography, Row, Col, Tree, Empty,
  Tooltip,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined,
  DownloadOutlined, SearchOutlined, ReloadOutlined, AppstoreOutlined,
  BranchesOutlined, InboxOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { usePermissions } from '../../components/common/PermissionWrapper';

const { Text } = Typography;

const STATUS_COLORS = {
  active: 'green',
  inactive: 'default',
  blocked: 'volcano',
  full: 'gold',
};

/** CSV -> array of objects. Handles quoted cells and embedded commas. */
function parseCsv(text) {
  const rows = [];
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return rows;

  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i += 1; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headers = splitLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ''));
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cols[idx] ?? ''; });
    rows.push(obj);
  }
  return rows;
}

const CSV_TEMPLATE = [
  'warehouseCode,zoneCode,rackCode,code,name,binType,binLevel,binColumn,capacityQty,capacityUnit,barcode,status',
  'WH001,RECV,R-01,A-01-01,Row A Level 1,standard,1,1,100,pcs,,active',
  'WH001,RECV,R-01,A-01-02,Row A Level 2,shelf,1,2,,,BIN-000002,active',
].join('\n');

function downloadCsvTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bins_import_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const WarehouseLocations = () => {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('warehouse_management');

  const [warehouses, setWarehouses] = useState([]);
  const [zones, setZones] = useState([]);
  const [racks, setRacks] = useState([]);
  const [bins, setBins] = useState([]);
  const [zoneTypesList, setZoneTypesList] = useState([]);
  const [binTypesList, setBinTypesList] = useState([]);
  const [constants, setConstants] = useState({ zoneTypes: [], binTypes: [], binStatuses: [] });

  const [activeTab, setActiveTab] = useState('tree');
  const [warehouseFilter, setWarehouseFilter] = useState(undefined);
  const [zoneFilter, setZoneFilter] = useState(undefined);
  const [rackFilter, setRackFilter] = useState(undefined);
  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(false);

  // Modal state
  const [zoneModal, setZoneModal] = useState({ open: false, editing: null });
  const [rackModal, setRackModal] = useState({ open: false, editing: null });
  const [binModal, setBinModal] = useState({ open: false, editing: null });
  const [importModal, setImportModal] = useState({ open: false, rows: [], result: null, busy: false });
  // kind = 'zone' | 'bin' — a single shared modal handles both catalogs.
  const [typeModal, setTypeModal] = useState({ open: false, kind: 'zone', editing: null });

  const [zoneForm] = Form.useForm();
  const [rackForm] = Form.useForm();
  const [binForm] = Form.useForm();
  const [typeForm] = Form.useForm();

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await apiService.get('/warehouses', { params: { status: 'active' } });
      if (res.success) setWarehouses(res.data || []);
    } catch {
      message.error('Failed to load warehouses');
    }
  }, []);

  const fetchConstants = useCallback(async () => {
    // zoneTypes / binTypes come back as [{code, name}] — this is what the
    // backend reads from the per-institution catalog tables. binStatuses is
    // still a fixed string list because it is a workflow state.
    const FALLBACK = {
      zoneTypes: [
        { code: 'storage', name: 'Storage' },
        { code: 'receiving', name: 'Receiving' },
        { code: 'shipping', name: 'Shipping' },
        { code: 'picking', name: 'Picking' },
        { code: 'bulk', name: 'Bulk' },
        { code: 'quarantine', name: 'Quarantine' },
        { code: 'cold_storage', name: 'Cold Storage' },
        { code: 'hazmat', name: 'Hazmat' },
        { code: 'returns', name: 'Returns' },
        { code: 'other', name: 'Other' },
      ],
      binTypes: [
        { code: 'standard', name: 'Standard' },
        { code: 'shelf', name: 'Shelf' },
        { code: 'pallet', name: 'Pallet' },
        { code: 'floor', name: 'Floor' },
        { code: 'carton', name: 'Carton' },
        { code: 'bulk', name: 'Bulk' },
        { code: 'other', name: 'Other' },
      ],
      binStatuses: ['active', 'inactive', 'blocked', 'full'],
    };
    try {
      const res = await apiService.get('/warehouse-locations/constants');
      if (res.success && res.data) {
        setConstants({
          zoneTypes: res.data.zoneTypes?.length ? res.data.zoneTypes : FALLBACK.zoneTypes,
          binTypes:  res.data.binTypes?.length  ? res.data.binTypes  : FALLBACK.binTypes,
          binStatuses: res.data.binStatuses?.length ? res.data.binStatuses : FALLBACK.binStatuses,
        });
      } else {
        setConstants(FALLBACK);
      }
    } catch {
      setConstants(FALLBACK);
    }
  }, []);

  const fetchZones = useCallback(async () => {
    try {
      const res = await apiService.get('/warehouse-locations/zones', {
        params: { warehouseId: warehouseFilter, search: search || undefined },
      });
      if (res.success) setZones(res.data || []);
    } catch {
      message.error('Failed to load zones');
    }
  }, [warehouseFilter, search]);

  const fetchRacks = useCallback(async () => {
    try {
      const res = await apiService.get('/warehouse-locations/racks', {
        params: {
          warehouseId: warehouseFilter,
          zoneId: zoneFilter,
          search: search || undefined,
        },
      });
      if (res.success) setRacks(res.data || []);
    } catch {
      message.error('Failed to load racks');
    }
  }, [warehouseFilter, zoneFilter, search]);

  const fetchBins = useCallback(async () => {
    try {
      const res = await apiService.get('/warehouse-locations/bins', {
        params: {
          warehouseId: warehouseFilter,
          zoneId: zoneFilter,
          rackId: rackFilter,
          search: search || undefined,
          limit: 1000,
        },
      });
      if (res.success) setBins(res.data || []);
    } catch {
      message.error('Failed to load bins');
    }
  }, [warehouseFilter, zoneFilter, rackFilter, search]);

  const fetchZoneTypes = useCallback(async () => {
    try {
      const res = await apiService.getZoneTypes({ status: 'all' });
      if (res.success) setZoneTypesList(res.data || []);
    } catch {
      message.error('Failed to load zone types');
    }
  }, []);

  const fetchBinTypes = useCallback(async () => {
    try {
      const res = await apiService.getBinTypes({ status: 'all' });
      if (res.success) setBinTypesList(res.data || []);
    } catch {
      message.error('Failed to load bin types');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchZones(), fetchRacks(), fetchBins(), fetchZoneTypes(), fetchBinTypes()]);
    setLoading(false);
  }, [fetchZones, fetchRacks, fetchBins, fetchZoneTypes, fetchBinTypes]);

  useEffect(() => {
    fetchWarehouses();
    fetchConstants();
  }, [fetchWarehouses, fetchConstants]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // ───────────────────────── Zones ─────────────────────────
  const openZoneModal = (editing = null) => {
    zoneForm.resetFields();
    if (editing) {
      zoneForm.setFieldsValue({
        warehouseId: editing.warehouse_id,
        code: editing.code,
        name: editing.name,
        description: editing.description,
        zoneType: editing.zone_type,
        status: editing.status,
      });
    } else if (warehouseFilter) {
      zoneForm.setFieldsValue({ warehouseId: warehouseFilter, zoneType: 'storage', status: 'active' });
    } else {
      zoneForm.setFieldsValue({ zoneType: 'storage', status: 'active' });
    }
    setZoneModal({ open: true, editing });
  };

  const saveZone = async (values) => {
    try {
      if (zoneModal.editing) {
        await apiService.put(`/warehouse-locations/zones/${zoneModal.editing.id}`, values);
        message.success('Zone updated');
      } else {
        await apiService.post('/warehouse-locations/zones', values);
        message.success('Zone created');
      }
      setZoneModal({ open: false, editing: null });
      refreshAll();
    } catch (err) {
      message.error(err.response?.data?.error || err.message || 'Failed to save zone');
    }
  };

  const deleteZone = async (zone) => {
    try {
      await apiService.delete(`/warehouse-locations/zones/${zone.id}`);
      message.success('Zone deleted');
      refreshAll();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete zone');
    }
  };

  // ───────────────────────── Racks ─────────────────────────
  const openRackModal = (editing = null) => {
    rackForm.resetFields();
    if (editing) {
      rackForm.setFieldsValue({
        zoneId: editing.zone_id,
        code: editing.code,
        name: editing.name,
        description: editing.description,
        totalLevels: editing.total_levels,
        totalColumns: editing.total_columns,
        status: editing.status,
      });
    } else {
      rackForm.setFieldsValue({
        zoneId: zoneFilter,
        totalLevels: 1,
        totalColumns: 1,
        status: 'active',
      });
    }
    setRackModal({ open: true, editing });
  };

  const saveRack = async (values) => {
    try {
      if (rackModal.editing) {
        await apiService.put(`/warehouse-locations/racks/${rackModal.editing.id}`, values);
        message.success('Rack updated');
      } else {
        await apiService.post('/warehouse-locations/racks', values);
        message.success('Rack created');
      }
      setRackModal({ open: false, editing: null });
      refreshAll();
    } catch (err) {
      message.error(err.response?.data?.error || err.message || 'Failed to save rack');
    }
  };

  const deleteRack = async (rack) => {
    try {
      await apiService.delete(`/warehouse-locations/racks/${rack.id}`);
      message.success('Rack deleted');
      refreshAll();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete rack');
    }
  };

  // ───────────────────────── Bins ─────────────────────────
  const openBinModal = (editing = null) => {
    binForm.resetFields();
    if (editing) {
      binForm.setFieldsValue({
        rackId: editing.rack_id,
        code: editing.code,
        name: editing.name,
        binLevel: editing.bin_level,
        binColumn: editing.bin_column,
        binType: editing.bin_type,
        capacityQty: editing.capacity_qty,
        capacityUnit: editing.capacity_unit,
        barcode: editing.barcode,
        status: editing.status,
      });
    } else {
      binForm.setFieldsValue({
        rackId: rackFilter,
        binType: 'standard',
        status: 'active',
      });
    }
    setBinModal({ open: true, editing });
  };

  const saveBin = async (values) => {
    try {
      if (binModal.editing) {
        await apiService.put(`/warehouse-locations/bins/${binModal.editing.id}`, values);
        message.success('Bin updated');
      } else {
        await apiService.post('/warehouse-locations/bins', values);
        message.success('Bin created');
      }
      setBinModal({ open: false, editing: null });
      refreshAll();
    } catch (err) {
      message.error(err.response?.data?.error || err.message || 'Failed to save bin');
    }
  };

  const deleteBin = async (bin) => {
    try {
      await apiService.delete(`/warehouse-locations/bins/${bin.id}`);
      message.success('Bin deleted');
      refreshAll();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete bin');
    }
  };

  // ───────────────────────── Import ─────────────────────────
  const handleCsvFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCsv(e.target.result);
        if (rows.length === 0) {
          message.warning('CSV has no data rows');
          return;
        }
        setImportModal((s) => ({ ...s, rows, result: null }));
      } catch (err) {
        message.error('Failed to parse CSV');
      }
    };
    reader.readAsText(file);
    return false;
  };

  const runImport = async () => {
    if (importModal.rows.length === 0) {
      message.warning('Upload a CSV first');
      return;
    }
    setImportModal((s) => ({ ...s, busy: true, result: null }));
    try {
      const res = await apiService.post('/warehouse-locations/bins/import', { rows: importModal.rows });
      setImportModal((s) => ({ ...s, busy: false, result: res }));
      if (res.success) {
        message.success(`Imported ${res.created} bin(s) • skipped ${res.skipped} • errors ${res.errors?.length || 0}`);
        refreshAll();
      }
    } catch (err) {
      setImportModal((s) => ({ ...s, busy: false }));
      message.error(err.response?.data?.error || 'Import failed');
    }
  };

  // ───────────────────── Type catalogs (zone / bin) ─────────────────────
  const openTypeModal = (kind, editing = null) => {
    setTypeModal({ open: true, kind, editing });
    typeForm.resetFields();
    if (editing) {
      typeForm.setFieldsValue({
        code: editing.code,
        name: editing.name,
        description: editing.description || '',
        sortOrder: editing.sort_order ?? 0,
        status: editing.status || 'active',
      });
    } else {
      typeForm.setFieldsValue({ status: 'active', sortOrder: 0 });
    }
  };

  const saveType = async (values) => {
    const { kind, editing } = typeModal;
    const call = kind === 'zone'
      ? (editing ? (d) => apiService.updateZoneType(editing.id, d) : apiService.createZoneType.bind(apiService))
      : (editing ? (d) => apiService.updateBinType(editing.id, d) : apiService.createBinType.bind(apiService));
    try {
      const res = await call(values);
      if (res.success) {
        message.success(editing ? 'Type updated' : 'Type created');
        setTypeModal({ open: false, kind, editing: null });
        // Refresh the catalog list AND the /constants cache so the zone/bin
        // create modals pick up the change immediately.
        await Promise.all([
          kind === 'zone' ? fetchZoneTypes() : fetchBinTypes(),
          fetchConstants(),
        ]);
      }
    } catch (err) {
      message.error(err.response?.data?.error || err.message || 'Failed to save type');
    }
  };

  const deleteType = async (kind, row) => {
    try {
      const res = kind === 'zone'
        ? await apiService.deleteZoneType(row.id)
        : await apiService.deleteBinType(row.id);
      if (res.success) {
        message.success('Type deleted');
        await Promise.all([
          kind === 'zone' ? fetchZoneTypes() : fetchBinTypes(),
          fetchConstants(),
        ]);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to delete type');
    }
  };

  const typeColumns = (kind) => [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 160, render: (v) => <code>{v}</code> },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true, responsive: ['md'] },
    {
      title: 'Built-in', dataIndex: 'is_system', key: 'is_system', width: 90,
      render: (v) => v ? <Tag color="blue">system</Tag> : <Tag>custom</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (s) => <Tag color={s === 'active' ? 'green' : 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {canManage && (
            <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openTypeModal(kind, r)} /></Tooltip>
          )}
          {canManage && !r.is_system && (
            <Popconfirm title="Delete this type?" onConfirm={() => deleteType(kind, r)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
          {canManage && r.is_system && (
            <Tooltip title="Built-in types cannot be deleted">
              <Button size="small" danger icon={<DeleteOutlined />} disabled />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // ───────────────────────── Tree view ─────────────────────────
  const treeData = useMemo(() => {
    const zonesFiltered = zones;
    return zonesFiltered.map((z) => {
      const zoneRacks = racks.filter((r) => r.zone_id === z.id);
      return {
        key: `zone-${z.id}`,
        title: (
          <Space size={6}>
            <BranchesOutlined style={{ color: '#667eea' }} />
            <Text strong>{z.name}</Text>
            <Tag>{z.code}</Tag>
            <Tag color="blue">{z.zone_type}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {z.rack_count || 0} racks · {z.bin_count || 0} bins
            </Text>
          </Space>
        ),
        children: zoneRacks.map((r) => {
          const rackBins = bins.filter((b) => b.rack_id === r.id);
          return {
            key: `rack-${r.id}`,
            title: (
              <Space size={6}>
                <AppstoreOutlined style={{ color: '#38ef7d' }} />
                <Text strong>{r.name}</Text>
                <Tag>{r.code}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {r.bin_count || 0} bins · {r.total_levels}L × {r.total_columns}C
                </Text>
              </Space>
            ),
            children: rackBins.map((b) => ({
              key: `bin-${b.id}`,
              title: (
                <Space size={6}>
                  <InboxOutlined style={{ color: '#ffd200' }} />
                  <Text>{b.code}</Text>
                  {b.name && <Text type="secondary">— {b.name}</Text>}
                  <Tag color="purple">{b.bin_type}</Tag>
                  <Tag color={STATUS_COLORS[b.status] || 'default'}>{b.status}</Tag>
                  {b.barcode && <Tag icon={<DatabaseOutlined />}>{b.barcode}</Tag>}
                </Space>
              ),
            })),
          };
        }),
      };
    });
  }, [zones, racks, bins]);

  // ───────────────────────── Table columns ─────────────────────────
  const zoneColumns = [
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', ellipsis: true, responsive: ['md'] },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Type', dataIndex: 'zone_type', key: 'zone_type', width: 110, render: (t) => <Tag color="blue">{t}</Tag> },
    { title: 'Racks', dataIndex: 'rack_count', key: 'rack_count', width: 70 },
    { title: 'Bins', dataIndex: 'bin_count', key: 'bin_count', width: 70 },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {canManage && (
            <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openZoneModal(r)} /></Tooltip>
          )}
          {canManage && (
            <Popconfirm
              title="Delete this zone?"
              description="All racks & bins under it will also be removed."
              onConfirm={() => deleteZone(r)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const rackColumns = [
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', ellipsis: true, responsive: ['md'] },
    { title: 'Zone', dataIndex: 'zone_name', key: 'zone_name', ellipsis: true, responsive: ['sm'] },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 100 },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Levels', dataIndex: 'total_levels', key: 'total_levels', width: 80 },
    { title: 'Columns', dataIndex: 'total_columns', key: 'total_columns', width: 90 },
    { title: 'Bins', dataIndex: 'bin_count', key: 'bin_count', width: 70 },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {canManage && (
            <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openRackModal(r)} /></Tooltip>
          )}
          {canManage && (
            <Popconfirm
              title="Delete this rack?"
              description="All bins under it will also be removed."
              onConfirm={() => deleteRack(r)}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const binColumns = [
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', ellipsis: true, responsive: ['lg'] },
    { title: 'Zone', dataIndex: 'zone_name', key: 'zone_name', ellipsis: true, responsive: ['md'] },
    { title: 'Rack', dataIndex: 'rack_name', key: 'rack_name', ellipsis: true, responsive: ['md'] },
    { title: 'Code', dataIndex: 'code', key: 'code', width: 110 },
    { title: 'Name', dataIndex: 'name', key: 'name', ellipsis: true, responsive: ['sm'] },
    { title: 'Type', dataIndex: 'bin_type', key: 'bin_type', width: 100, render: (t) => <Tag color="purple">{t}</Tag> },
    {
      title: 'Position', key: 'position', width: 100,
      render: (_, r) => (r.bin_level != null || r.bin_column != null)
        ? `L${r.bin_level ?? '-'}/C${r.bin_column ?? '-'}`
        : '-',
    },
    {
      title: 'Capacity', key: 'capacity', width: 120,
      render: (_, r) => r.capacity_qty ? `${r.capacity_qty} ${r.capacity_unit || ''}`.trim() : '-',
    },
    { title: 'Barcode', dataIndex: 'barcode', key: 'barcode', ellipsis: true, responsive: ['lg'] },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90,
      render: (s) => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size={4}>
          {canManage && (
            <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openBinModal(r)} /></Tooltip>
          )}
          {canManage && (
            <Popconfirm title="Delete this bin?" onConfirm={() => deleteBin(r)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const zonesForSelectedWarehouse = useMemo(
    () => (warehouseFilter ? zones.filter((z) => z.warehouse_id === warehouseFilter) : zones),
    [zones, warehouseFilter]
  );

  const racksForSelectedZone = useMemo(
    () => (zoneFilter ? racks.filter((r) => r.zone_id === zoneFilter) : racks),
    [racks, zoneFilter]
  );

  const filterBar = (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <Select
        placeholder="All warehouses"
        allowClear
        value={warehouseFilter}
        onChange={(v) => {
          setWarehouseFilter(v);
          setZoneFilter(undefined);
          setRackFilter(undefined);
        }}
        style={{ minWidth: 200 }}
        options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
      />
      <Select
        placeholder="All zones"
        allowClear
        value={zoneFilter}
        onChange={(v) => { setZoneFilter(v); setRackFilter(undefined); }}
        style={{ minWidth: 180 }}
        options={zonesForSelectedWarehouse.map((z) => ({ value: z.id, label: `${z.name} (${z.code})` }))}
      />
      <Select
        placeholder="All racks"
        allowClear
        value={rackFilter}
        onChange={setRackFilter}
        style={{ minWidth: 180 }}
        options={racksForSelectedZone.map((r) => ({ value: r.id, label: `${r.name} (${r.code})` }))}
      />
      <Input
        placeholder="Search code / name / barcode"
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
        style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
      />
      <Button icon={<ReloadOutlined />} onClick={refreshAll}>Refresh</Button>
    </div>
  );

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Warehouse Locations</h1>
        <Space wrap>
          {canManage && (
            <Button icon={<DownloadOutlined />} onClick={downloadCsvTemplate}>
              CSV template
            </Button>
          )}
          {canManage && (
            <Button icon={<UploadOutlined />} onClick={() => setImportModal({ open: true, rows: [], result: null, busy: false })}>
              Import bins
            </Button>
          )}
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openZoneModal()}>
              New zone
            </Button>
          )}
        </Space>
      </div>

      <Card>
        {filterBar}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'tree',
              label: 'Hierarchy',
              children: (
                <div>
                  {treeData.length === 0
                    ? <Empty description="No zones yet. Create a zone to get started." />
                    : (
                      <Tree
                        treeData={treeData}
                        defaultExpandAll
                        blockNode
                        selectable={false}
                        style={{ background: 'transparent' }}
                      />
                    )}
                </div>
              ),
            },
            {
              key: 'zones',
              label: `Zones (${zones.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {canManage && <Button size="small" icon={<PlusOutlined />} onClick={() => openZoneModal()}>Add zone</Button>}
                  </div>
                  <Table
                    size="small"
                    rowKey="id"
                    loading={loading}
                    columns={zoneColumns}
                    dataSource={zones}
                    pagination={{ pageSize: 20, size: 'small' }}
                    scroll={{ x: 900 }}
                  />
                </>
              ),
            },
            {
              key: 'racks',
              label: `Racks (${racks.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {canManage && (
                      <Button
                        size="small" icon={<PlusOutlined />}
                        disabled={zones.length === 0}
                        onClick={() => openRackModal()}
                      >
                        Add rack
                      </Button>
                    )}
                  </div>
                  <Table
                    size="small"
                    rowKey="id"
                    loading={loading}
                    columns={rackColumns}
                    dataSource={racks}
                    pagination={{ pageSize: 20, size: 'small' }}
                    scroll={{ x: 1000 }}
                  />
                </>
              ),
            },
            {
              key: 'bins',
              label: `Bins (${bins.length})`,
              children: (
                <>
                  <div style={{ marginBottom: 8 }}>
                    {canManage && (
                      <Button
                        size="small" icon={<PlusOutlined />}
                        disabled={racks.length === 0}
                        onClick={() => openBinModal()}
                      >
                        Add bin
                      </Button>
                    )}
                  </div>
                  <Table
                    size="small"
                    rowKey="id"
                    loading={loading}
                    columns={binColumns}
                    dataSource={bins}
                    pagination={{ pageSize: 25, size: 'small' }}
                    scroll={{ x: 1100 }}
                  />
                </>
              ),
            },
            {
              key: 'types',
              label: `Types (${zoneTypesList.length + binTypesList.length})`,
              children: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Alert
                    type="info"
                    showIcon
                    message="Customize zone and bin type labels"
                    description={
                      <span>
                        Zones and bins use these type codes. Built-in types are tagged <Tag color="blue" style={{ marginInline: 4 }}>system</Tag>
                        and cannot be deleted (but their name/description can be edited). Create custom types that match your operation.
                        Bin statuses (active, inactive, blocked, full) are workflow states and are not customizable.
                      </span>
                    }
                  />

                  <Card size="small" title={`Zone types (${zoneTypesList.length})`}
                    extra={canManage && <Button size="small" icon={<PlusOutlined />} onClick={() => openTypeModal('zone')}>Add zone type</Button>}
                    styles={{ body: { padding: 0 } }}
                  >
                    <Table
                      size="small"
                      rowKey="id"
                      loading={loading}
                      columns={typeColumns('zone')}
                      dataSource={zoneTypesList}
                      pagination={{ pageSize: 10, size: 'small' }}
                      scroll={{ x: 800 }}
                    />
                  </Card>

                  <Card size="small" title={`Bin types (${binTypesList.length})`}
                    extra={canManage && <Button size="small" icon={<PlusOutlined />} onClick={() => openTypeModal('bin')}>Add bin type</Button>}
                    styles={{ body: { padding: 0 } }}
                  >
                    <Table
                      size="small"
                      rowKey="id"
                      loading={loading}
                      columns={typeColumns('bin')}
                      dataSource={binTypesList}
                      pagination={{ pageSize: 10, size: 'small' }}
                      scroll={{ x: 800 }}
                    />
                  </Card>
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* ── Zone modal ── */}
      <Modal
        title={zoneModal.editing ? 'Edit zone' : 'New zone'}
        open={zoneModal.open}
        onCancel={() => setZoneModal({ open: false, editing: null })}
        onOk={() => zoneForm.submit()}
        okText={zoneModal.editing ? 'Update' : 'Create'}
        destroyOnClose
      >
        <Form form={zoneForm} layout="vertical" onFinish={saveZone}>
          <Form.Item name="warehouseId" label="Warehouse" rules={[{ required: true }]}>
            <Select
              placeholder="Select warehouse"
              disabled={!!zoneModal.editing}
              options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. RECV" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Receiving Area" maxLength={150} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="zoneType" label="Type" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={constants.zoneTypes.map((t) => ({ value: t.code, label: t.name || t.code }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="Status">
                <Select options={['active', 'inactive'].map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Rack modal ── */}
      <Modal
        title={rackModal.editing ? 'Edit rack' : 'New rack'}
        open={rackModal.open}
        onCancel={() => setRackModal({ open: false, editing: null })}
        onOk={() => rackForm.submit()}
        okText={rackModal.editing ? 'Update' : 'Create'}
        destroyOnClose
      >
        <Form form={rackForm} layout="vertical" onFinish={saveRack}>
          <Form.Item name="zoneId" label="Zone" rules={[{ required: true }]}>
            <Select
              placeholder="Select zone"
              disabled={!!rackModal.editing}
              options={zones.map((z) => ({
                value: z.id,
                label: `${z.warehouse_code} / ${z.name} (${z.code})`,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. R-01" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Rack 01" maxLength={150} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={12} sm={8}>
              <Form.Item name="totalLevels" label="Levels">
                <InputNumber min={1} max={99} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="totalColumns" label="Columns">
                <InputNumber min={1} max={99} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="status" label="Status">
                <Select options={['active', 'inactive'].map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Bin modal ── */}
      <Modal
        title={binModal.editing ? 'Edit bin' : 'New bin'}
        open={binModal.open}
        onCancel={() => setBinModal({ open: false, editing: null })}
        onOk={() => binForm.submit()}
        okText={binModal.editing ? 'Update' : 'Create'}
        destroyOnClose
      >
        <Form form={binForm} layout="vertical" onFinish={saveBin}>
          <Form.Item name="rackId" label="Rack" rules={[{ required: true }]}>
            <Select
              placeholder="Select rack"
              disabled={!!binModal.editing}
              options={racks.map((r) => ({
                value: r.id,
                label: `${r.warehouse_code} / ${r.zone_code} / ${r.name} (${r.code})`,
              }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="code" label="Code" rules={[{ required: true }]}>
                <Input placeholder="e.g. A-01-01" maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Name">
                <Input maxLength={150} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={12} sm={8}>
              <Form.Item name="binLevel" label="Level">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="binColumn" label="Column">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="binType" label="Type" rules={[{ required: true }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={constants.binTypes.map((t) => ({ value: t.code, label: t.name || t.code }))}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={12} sm={8}>
              <Form.Item name="capacityQty" label="Capacity">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item name="capacityUnit" label="Unit">
                <Input placeholder="pcs, kg, m³..." maxLength={50} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="status" label="Status">
                <Select options={constants.binStatuses.map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="barcode" label="Barcode">
            <Input placeholder="Optional — scan or type" maxLength={100} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Type catalog modal (shared by zone / bin types) ── */}
      <Modal
        title={`${typeModal.editing ? 'Edit' : 'New'} ${typeModal.kind === 'zone' ? 'zone' : 'bin'} type`}
        open={typeModal.open}
        onCancel={() => setTypeModal({ open: false, kind: typeModal.kind, editing: null })}
        onOk={() => typeForm.submit()}
        okText={typeModal.editing ? 'Update' : 'Create'}
        destroyOnClose
      >
        <Form form={typeForm} layout="vertical" onFinish={saveType}>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="code"
                label="Code"
                tooltip="Lowercase machine key — stored on zones/bins. Cannot be changed on built-in types."
                rules={[{ required: true, message: 'Code is required' }, { pattern: /^[A-Za-z0-9_\- ]{1,50}$/, message: 'Letters, digits, _ or -' }]}
              >
                <Input
                  placeholder="e.g. cross_dock"
                  maxLength={50}
                  disabled={!!typeModal.editing && !!typeModal.editing.is_system}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="name" label="Display name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Cross Dock" maxLength={150} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} maxLength={255} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={12} sm={12}>
              <Form.Item name="sortOrder" label="Sort order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={12}>
              <Form.Item name="status" label="Status">
                <Select options={['active', 'inactive'].map((s) => ({ value: s, label: s }))} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Import modal ── */}
      <Modal
        title="Import bins from CSV"
        open={importModal.open}
        onCancel={() => setImportModal({ open: false, rows: [], result: null, busy: false })}
        footer={[
          <Button key="template" icon={<DownloadOutlined />} onClick={downloadCsvTemplate}>Template</Button>,
          <Button key="close" onClick={() => setImportModal({ open: false, rows: [], result: null, busy: false })}>Close</Button>,
          <Button
            key="import"
            type="primary"
            loading={importModal.busy}
            disabled={importModal.rows.length === 0}
            onClick={runImport}
          >
            Import {importModal.rows.length || ''}
          </Button>,
        ]}
        width={720}
      >
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 12 }}
          message="CSV columns"
          description={
            <div>
              <code>warehouseCode, zoneCode, rackCode, code</code> (required),
              and optional <code>name, binType, binLevel, binColumn, capacityQty, capacityUnit, barcode, status</code>.
              Missing zones/racks are auto-created. Duplicate bin codes per rack are skipped.
            </div>
          }
        />
        <Upload.Dragger
          accept=".csv"
          multiple={false}
          showUploadList={false}
          beforeUpload={handleCsvFile}
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Drop a CSV file here, or click to select</p>
          <p className="ant-upload-hint">Up to 5,000 rows per import</p>
        </Upload.Dragger>

        {importModal.rows.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text strong>{importModal.rows.length} row(s) staged</Text>
            <Table
              size="small"
              rowKey={(_, idx) => idx}
              dataSource={importModal.rows.slice(0, 10)}
              pagination={false}
              style={{ marginTop: 8 }}
              columns={Object.keys(importModal.rows[0]).slice(0, 8).map((k) => ({
                title: k, dataIndex: k, key: k, ellipsis: true,
              }))}
              scroll={{ x: 'max-content' }}
            />
            {importModal.rows.length > 10 && <Text type="secondary">…and {importModal.rows.length - 10} more</Text>}
          </div>
        )}

        {importModal.result && (
          <div style={{ marginTop: 12 }}>
            <Alert
              type={importModal.result.errors?.length ? 'warning' : 'success'}
              message={
                `Created ${importModal.result.created}, skipped ${importModal.result.skipped}, errors ${importModal.result.errors?.length || 0}`
              }
              showIcon
            />
            {importModal.result.errors?.length > 0 && (
              <Table
                size="small"
                style={{ marginTop: 8 }}
                rowKey={(r) => r.row}
                dataSource={importModal.result.errors.slice(0, 50)}
                columns={[
                  { title: 'Row', dataIndex: 'row', key: 'row', width: 80 },
                  { title: 'Error', dataIndex: 'error', key: 'error' },
                ]}
                pagination={false}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default WarehouseLocations;
