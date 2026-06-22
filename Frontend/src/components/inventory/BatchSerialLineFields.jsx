import React, { useEffect, useState } from 'react';
import { Form, Input, DatePicker, Select, Alert, Tag } from 'antd';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { TextArea } = Input;

/**
 * Batch/serial capture fields for receive, ship, and return line forms.
 * mode: 'receive' | 'ship' | 'return_out' | 'return_in'
 */
export default function BatchSerialLineFields({
  form,
  lineName,
  itemId,
  warehouseId,
  tracking = {},
  quantity = 0,
  mode = 'receive',
  disabled = false,
}) {
  const { is_batch_tracked: isBatchTracked, is_serialized: isSerialized, has_expiry: hasExpiry } = tracking;
  const [batches, setBatches] = useState([]);
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(false);

  const showBatch = Boolean(isBatchTracked) && mode !== 'ship';
  const showBatchPick = Boolean(isBatchTracked) && mode === 'ship';
  const showSerialPick = Boolean(isSerialized) && (mode === 'ship' || mode === 'return_out');
  const showSerialEntry = Boolean(isSerialized) && (mode === 'receive' || mode === 'return_in');

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
        const requests = [];
        if (showBatchPick || mode === 'return_out') {
          requests.push(apiService.getBatches({
            itemId,
            warehouseId,
            hasStock: 'true',
            status: 'active',
          }));
        } else {
          requests.push(Promise.resolve({ data: [] }));
        }
        if (showSerialPick) {
          requests.push(apiService.getSerials({
            itemId,
            warehouseId,
            status: 'available',
          }));
        } else {
          requests.push(Promise.resolve({ data: [] }));
        }
        const [batchRes, serialRes] = await Promise.all(requests);
        if (!cancelled) {
          setBatches(batchRes?.data || []);
          setSerials(serialRes?.data || []);
        }
      } catch {
        if (!cancelled) {
          setBatches([]);
          setSerials([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [itemId, warehouseId, showBatchPick, showSerialPick, mode]);

  if (!isBatchTracked && !isSerialized) return null;

  const qtyInt = Math.round(Number(quantity) || 0);

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', background: '#f0f5ff', borderRadius: 6, border: '1px solid #adc6ff' }}>
      <div style={{ marginBottom: 6 }}>
        <Tag color="blue">Batch / Serial</Tag>
        {isBatchTracked && <Tag color="geekblue">Batch tracked</Tag>}
        {isSerialized && <Tag color="purple">Serialized</Tag>}
        {hasExpiry && <Tag color="orange">Expiry</Tag>}
      </div>

      {showBatch && (
        <>
          <Form.Item
            name={[lineName, 'batchNumber']}
            label="Batch / Lot Number"
            rules={[{ required: true, message: 'Batch number required' }]}
            style={{ marginBottom: 8 }}
          >
            <Input placeholder="e.g. LOT-2026-A" disabled={disabled} />
          </Form.Item>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Form.Item name={[lineName, 'manufactureDate']} label="Mfg Date" style={{ flex: 1, minWidth: 130, marginBottom: 8 }}>
              <DatePicker style={{ width: '100%' }} disabled={disabled} />
            </Form.Item>
            {hasExpiry && (
              <Form.Item
                name={[lineName, 'expiryDate']}
                label="Expiry Date"
                rules={[{ required: true, message: 'Expiry required' }]}
                style={{ flex: 1, minWidth: 130, marginBottom: 8 }}
              >
                <DatePicker style={{ width: '100%' }} disabled={disabled} />
              </Form.Item>
            )}
          </div>
        </>
      )}

      {showBatchPick && (
        <Form.Item
          name={[lineName, 'batchId']}
          label="Batch (FEFO auto if empty)"
          style={{ marginBottom: 8 }}
          extra={batches.length ? `${batches.length} batch(es) in stock` : 'No batches — will use FEFO if stock exists'}
        >
          <Select
            allowClear
            placeholder="Auto FEFO"
            loading={loading}
            disabled={disabled}
            optionFilterProp="label"
            options={batches.map((b) => ({
              value: b.id,
              label: `${b.batch_number} — ${parseFloat(b.quantity_remaining || 0).toFixed(2)} avail${b.expiry_date ? ` · exp ${dayjs(b.expiry_date).format('DD MMM YY')}` : ''}`,
            }))}
          />
        </Form.Item>
      )}

      {showSerialEntry && (
        <Form.Item
          name={[lineName, 'serialNumbers']}
          label={`Serial Numbers (${qtyInt} required)`}
          rules={[
            { required: true, message: 'Enter serial numbers' },
            {
              validator: (_, value) => {
                const list = String(value || '').split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
                if (qtyInt > 0 && list.length !== qtyInt) {
                  return Promise.reject(`Enter exactly ${qtyInt} serial number(s)`);
                }
                return Promise.resolve();
              },
            },
          ]}
          style={{ marginBottom: 0 }}
          extra="One per line or comma-separated"
        >
          <TextArea rows={2} placeholder="SN-001, SN-002" disabled={disabled} />
        </Form.Item>
      )}

      {showSerialPick && (
        <Form.Item
          name={[lineName, 'serialIds']}
          label={`Select Serials (${qtyInt} required)`}
          rules={[
            {
              validator: (_, value) => {
                const count = Array.isArray(value) ? value.length : 0;
                if (qtyInt > 0 && count !== qtyInt) {
                  return Promise.reject(`Select exactly ${qtyInt} serial(s)`);
                }
                return Promise.resolve();
              },
            },
          ]}
          style={{ marginBottom: 0 }}
          extra="Leave empty to auto-pick oldest available serials"
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="Auto-pick if empty"
            loading={loading}
            disabled={disabled}
            optionFilterProp="label"
            options={serials.map((s) => ({
              value: s.id,
              label: `${s.serial_number}${s.batch_number ? ` (${s.batch_number})` : ''}`,
            }))}
          />
        </Form.Item>
      )}

      {mode === 'ship' && isBatchTracked && !isSerialized && (
        <Alert type="info" showIcon message="Batch stock consumed FEFO (first expiry, first out) when no batch is selected." style={{ marginTop: 4 }} />
      )}
    </div>
  );
}

export function mapReceiveLineBatchSerial(line) {
  return {
    batchNumber: line.batchNumber,
    manufactureDate: line.manufactureDate?.format?.('YYYY-MM-DD') || line.manufactureDate || null,
    expiryDate: line.expiryDate?.format?.('YYYY-MM-DD') || line.expiryDate || null,
    serialNumbers: line.serialNumbers,
  };
}

export function mapShipLineBatchSerial(line) {
  const payload = {};
  if (line.batchId) {
    payload.batchAllocations = [{ batchId: line.batchId, quantity: Number(line.quantity) }];
  }
  if (line.serialIds?.length) {
    payload.serialIds = line.serialIds;
  }
  return payload;
}

export function mapReturnOutLineBatchSerial(line) {
  const payload = {};
  if (line.batchId) {
    payload.batchAllocations = [{ batchId: line.batchId, quantity: Number(line.quantity) }];
  }
  if (line.serialIds?.length) {
    payload.serialIds = line.serialIds;
  }
  return payload;
}

export function mapReturnInLineBatchSerial(line) {
  return {
    batchNumber: line.batchNumber,
    manufactureDate: line.manufactureDate?.format?.('YYYY-MM-DD') || line.manufactureDate || null,
    expiryDate: line.expiryDate?.format?.('YYYY-MM-DD') || line.expiryDate || null,
    serialNumbers: line.serialNumbers,
    serialIds: line.serialIds,
  };
}
