import React, { useEffect, useState } from 'react';
import { Input, DatePicker, Select, Tag, Alert } from 'antd';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { TextArea } = Input;

/** Controlled batch/serial fields for return forms (non-Ant-Form line arrays). */
export default function BatchSerialLinePanel({
  itemId,
  warehouseId,
  tracking = {},
  quantity = 0,
  mode = 'return_out',
  value = {},
  onChange,
  disabled = false,
}) {
  const { is_batch_tracked: isBatchTracked, is_serialized: isSerialized, has_expiry: hasExpiry } = tracking;
  const [batches, setBatches] = useState([]);
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(false);

  const showBatch = Boolean(isBatchTracked) && mode === 'return_in';
  const showBatchPick = Boolean(isBatchTracked) && mode === 'return_out';
  const showSerialPick = Boolean(isSerialized) && mode === 'return_out';
  const showSerialEntry = Boolean(isSerialized) && mode === 'return_in';

  useEffect(() => {
    if (!itemId || !warehouseId) {
      setBatches([]);
      setSerials([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const reqs = [];
        if (showBatchPick) {
          reqs.push(apiService.getBatches({ itemId, warehouseId, hasStock: 'true', status: 'active' }));
        } else reqs.push(Promise.resolve({ data: [] }));
        if (showSerialPick) {
          reqs.push(apiService.getSerials({ itemId, warehouseId, status: 'available' }));
        } else reqs.push(Promise.resolve({ data: [] }));
        const [bRes, sRes] = await Promise.all(reqs);
        if (!cancelled) {
          setBatches(bRes?.data || []);
          setSerials(sRes?.data || []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [itemId, warehouseId, showBatchPick, showSerialPick]);

  if (!isBatchTracked && !isSerialized) return null;

  const set = (patch) => onChange?.({ ...value, ...patch });
  const qtyInt = Math.round(Number(quantity) || 0);

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', background: '#f0f5ff', borderRadius: 6, border: '1px solid #adc6ff', width: '100%' }}>
      <div style={{ marginBottom: 6 }}>
        <Tag color="blue">Batch / Serial</Tag>
        {isBatchTracked && <Tag color="geekblue">Batch</Tag>}
        {isSerialized && <Tag color="purple">Serial</Tag>}
      </div>

      {showBatch && (
        <>
          <Input
            placeholder="Batch / Lot number"
            value={value.batchNumber || ''}
            onChange={(e) => set({ batchNumber: e.target.value })}
            disabled={disabled}
            style={{ marginBottom: 6 }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DatePicker
              placeholder="Mfg date"
              value={value.manufactureDate ? dayjs(value.manufactureDate) : null}
              onChange={(d) => set({ manufactureDate: d?.format('YYYY-MM-DD') || null })}
              disabled={disabled}
            />
            {hasExpiry && (
              <DatePicker
                placeholder="Expiry date"
                value={value.expiryDate ? dayjs(value.expiryDate) : null}
                onChange={(d) => set({ expiryDate: d?.format('YYYY-MM-DD') || null })}
                disabled={disabled}
              />
            )}
          </div>
        </>
      )}

      {showBatchPick && (
        <Select
          allowClear
          placeholder="Batch (FEFO auto if empty)"
          loading={loading}
          disabled={disabled}
          style={{ width: '100%', marginBottom: 6 }}
          value={value.batchId || undefined}
          onChange={(batchId) => set({ batchId: batchId || null })}
          options={batches.map((b) => ({
            value: b.id,
            label: `${b.batch_number} — ${parseFloat(b.quantity_remaining || 0).toFixed(2)} avail`,
          }))}
        />
      )}

      {showSerialEntry && (
        <TextArea
          rows={2}
          placeholder={`Serial numbers (${qtyInt} required)`}
          value={value.serialNumbers || ''}
          onChange={(e) => set({ serialNumbers: e.target.value })}
          disabled={disabled}
        />
      )}

      {showSerialPick && (
        <Select
          mode="multiple"
          allowClear
          placeholder={`Serials (${qtyInt} required, auto if empty)`}
          loading={loading}
          disabled={disabled}
          style={{ width: '100%' }}
          value={value.serialIds || []}
          onChange={(serialIds) => set({ serialIds })}
          options={serials.map((s) => ({
            value: s.id,
            label: s.serial_number,
          }))}
        />
      )}

      {mode === 'return_out' && isBatchTracked && (
        <Alert type="info" showIcon message="Stock deducted FEFO when no batch is selected." style={{ marginTop: 4 }} />
      )}
    </div>
  );
}

export function buildReturnOutPayload(line) {
  const payload = {
    itemId: line.itemId,
    warehouseId: line.warehouseId,
    quantity: line.quantity,
    unitCost: line.unitCost,
    returnReason: line.returnReason,
  };
  if (line.batchId) {
    payload.batchAllocations = [{ batchId: line.batchId, quantity: Number(line.quantity) }];
  }
  if (line.serialIds?.length) payload.serialIds = line.serialIds;
  return payload;
}

export function buildReturnInPayload(line) {
  return {
    batchNumber: line.batchNumber,
    manufactureDate: line.manufactureDate,
    expiryDate: line.expiryDate,
    serialNumbers: line.serialNumbers,
  };
}
