import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Form, InputNumber, Button, message, Select, Row, Col,
  Table, Divider, Typography, Space, Tag, Tabs
} from 'antd';
import { SwapOutlined, SaveOutlined, PlusOutlined, HistoryOutlined, DollarOutlined } from '@ant-design/icons';
import { useCurrency } from '../../contexts/CurrencyContext';
import { getCurrencies, getCurrencySymbol } from '../../utils/currency';
import apiService from '../../services/apiService';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

const mul = (a, b) => parseFloat((Math.round(a * b * 1e8) / 1e8).toFixed(6));
const fmt = (n, d = 2) => parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
const trimZeros = (n) => fmt(n, 6).replace(/\.?0+$/, '');

export default function ExchangeRateSettings() {
  const { currency, currencySymbol, exchangeRate, updateCurrency, loading: ctxLoading } = useCurrency();
  const [form] = Form.useForm();
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState(currency);
  const [previewRate, setPreviewRate] = useState(null);
  const [savedRates, setSavedRates] = useState([]);
  const [currenciesMaster, setCurrenciesMaster] = useState([]);
  const [history, setHistory] = useState([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('rates');
  const allCurrencies = getCurrencies();

  const loadRates = useCallback(async () => {
    setTableLoading(true);
    try {
      const res = await apiService.get('/settings/exchange-rates');
      setSavedRates(res.data || []);
    } catch { message.error('Failed to load exchange rates'); }
    finally { setTableLoading(false); }
  }, []);

  const loadCurrencies = useCallback(async () => {
    try {
      const res = await apiService.get('/settings/currencies');
      setCurrenciesMaster(res.data || []);
    } catch { message.error('Failed to load currencies'); }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiService.get('/settings/exchange-rates/history', { params: { limit: 200 } });
      setHistory(res.data || []);
    } catch { message.error('Failed to load history'); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { loadRates(); loadCurrencies(); }, [loadRates, loadCurrencies]);
  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);
  useEffect(() => { setToCurrency(currency); }, [currency]);

  const handleSwap = () => {
    const current = form.getFieldValue('rate');
    const newRate = current > 0 ? parseFloat((Math.round((1 / current) * 1e8) / 1e8).toFixed(6)) : 1;
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setPreviewRate(newRate);
    form.setFieldsValue({ rate: newRate });
  };

  const handleSavePair = async ({ rate, note }) => {
    if (fromCurrency === toCurrency) return message.error('From and To currency cannot be the same');
    setSaving(true);
    try {
      const res = await apiService.put('/settings/exchange-rates', { fromCurrency, toCurrency, rate, note });
      if (res.success) {
        message.success(`Saved: 1 ${fromCurrency} = ${trimZeros(rate)} ${toCurrency} (inverse auto-saved)`);
        loadRates();
        loadCurrencies();
        if (activeTab === 'history') loadHistory();
      } else {
        message.error(res.error || 'Failed to save');
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSetActive = async (row) => {
    const success = await updateCurrency(row.to_currency, row.rate);
    if (success) message.success(`Active currency set to ${row.to_currency}`);
    else message.error('Failed to set active currency');
  };

  // Conversion preview rows
  const conversionRows = previewRate > 0
    ? [1, 5, 10, 50, 100, 500, 1000].map(amount => ({
        key: amount,
        from: `${getCurrencySymbol(fromCurrency)} ${fmt(amount, 0)}`,
        to: `${getCurrencySymbol(toCurrency)} ${fmt(mul(amount, previewRate))}`
      }))
    : [];

  const rateColumns = [
    { title: 'From', key: 'from', width: 160,
      render: (_, r) => <><Tag>{r.from_currency}</Tag> <Text type="secondary" style={{ fontSize: 11 }}>{r.from_name}</Text></> },
    { title: 'To', key: 'to', width: 160,
      render: (_, r) => <><Tag color={r.to_currency === currency ? 'blue' : 'default'}>{r.to_currency}{r.to_currency === currency ? ' ✓' : ''}</Tag> <Text type="secondary" style={{ fontSize: 11 }}>{r.to_name}</Text></> },
    { title: 'Rate', key: 'rate',
      render: (_, r) => `1 ${r.from_currency} = ${r.to_symbol || getCurrencySymbol(r.to_currency)}${trimZeros(r.rate)}` },
    { title: 'Updated', dataIndex: 'updated_at', key: 'updated_at', width: 140,
      render: v => dayjs(v).format('DD MMM YYYY HH:mm') },
    { title: '', key: 'actions', width: 100,
      render: (_, r) => <Button size="small" type="link" onClick={() => handleSetActive(r)}>Set Active</Button> }
  ];

  const historyColumns = [
    { title: 'From', dataIndex: 'from_currency', key: 'from_currency', width: 80, render: v => <Tag>{v}</Tag> },
    { title: 'To', dataIndex: 'to_currency', key: 'to_currency', width: 80, render: v => <Tag>{v}</Tag> },
    { title: 'Rate', key: 'rate',
      render: (_, r) => `1 ${r.from_currency} = ${getCurrencySymbol(r.to_currency)}${trimZeros(r.rate)}` },
    { title: 'Inverse', key: 'inverse',
      render: (_, r) => `1 ${r.to_currency} = ${getCurrencySymbol(r.from_currency)}${trimZeros(r.inverse_rate)}` },
    { title: 'Changed By', dataIndex: 'changed_by_name', key: 'changed_by_name', width: 130,
      render: v => v?.trim() || '-' },
    { title: 'Note', dataIndex: 'note', key: 'note', render: v => v || '-' },
    { title: 'Date', dataIndex: 'changed_at', key: 'changed_at', width: 140,
      render: v => dayjs(v).format('DD MMM YYYY HH:mm') }
  ];

  const masterColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 80, render: v => <Tag>{v}</Tag> },
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Symbol', dataIndex: 'symbol', key: 'symbol', width: 70 },
    { title: 'Base', dataIndex: 'is_base', key: 'is_base', width: 70,
      render: v => v ? <Tag color="gold">Base</Tag> : '-' },
    { title: 'Rate to Base', dataIndex: 'current_rate_to_base', key: 'current_rate_to_base', width: 130,
      render: v => v ? trimZeros(v) : <Text type="secondary">—</Text> },
    { title: 'Status', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag> }
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 24 }}>Exchange Rate Settings</h2>

      {/* Active rate banner */}
      <Card style={{ marginBottom: 24, background: '#f0f5ff', border: '1px solid #adc6ff' }}>
        <Row align="middle" gutter={16}>
          <Col>
            <Text type="secondary" style={{ fontSize: 12 }}>Active Currency & Rate</Text>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              1 {fromCurrency} = {currencySymbol}{trimZeros(exchangeRate)} {currency}
            </div>
          </Col>
          <Col><Tag color="blue">{currency}</Tag></Col>
        </Row>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'rates',
          label: <span><DollarOutlined /> Exchange Rates</span>,
          children: (
            <>
              {/* Rate editor */}
              <Card title={<><PlusOutlined /> Add / Update Rate Pair</>} style={{ marginBottom: 24 }}>
                <Form form={form} layout="vertical" onFinish={handleSavePair}>
                  <Row gutter={12} align="middle">
                    <Col flex="1">
                      <Form.Item label="From" style={{ marginBottom: 0 }}>
                        <Select value={fromCurrency} onChange={setFromCurrency} showSearch optionFilterProp="children" style={{ width: '100%' }}>
                          {allCurrencies.map(c => <Option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col style={{ paddingTop: 28 }}>
                      <Button icon={<SwapOutlined />} onClick={handleSwap} title="Swap" />
                    </Col>
                    <Col flex="1">
                      <Form.Item label="To" style={{ marginBottom: 0 }}>
                        <Select value={toCurrency} onChange={setToCurrency} showSearch optionFilterProp="children" style={{ width: '100%' }}>
                          {allCurrencies.map(c => <Option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</Option>)}
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider />

                  <Row gutter={12}>
                    <Col flex="1">
                      <Form.Item
                        name="rate"
                        label={<span>Rate <Text type="secondary" style={{ fontSize: 12 }}>1 {fromCurrency} = ? {toCurrency}</Text></span>}
                        rules={[{ required: true, message: 'Enter rate' }, { type: 'number', min: 0.000001, message: 'Must be > 0' }]}
                      >
                        <InputNumber
                          min={0.000001} step={0.01} precision={6} style={{ width: '100%' }}
                          addonBefore={`1 ${fromCurrency} =`} addonAfter={toCurrency}
                          onChange={v => setPreviewRate(v || 0)}
                        />
                      </Form.Item>
                    </Col>
                    <Col flex="1">
                      <Form.Item name="note" label="Note (optional)">
                        <input className="ant-input" placeholder="e.g. RBI rate 23 Mar 2025" style={{ width: '100%', padding: '4px 11px', border: '1px solid #d9d9d9', borderRadius: 6 }} />
                      </Form.Item>
                    </Col>
                  </Row>

                  {previewRate > 0 && (
                    <div style={{ padding: '8px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, marginBottom: 16 }}>
                      <Text style={{ color: '#389e0d' }}>
                        1 {fromCurrency} = {getCurrencySymbol(toCurrency)}{trimZeros(previewRate)} {toCurrency}
                        &nbsp;|&nbsp;
                        1 {toCurrency} = {getCurrencySymbol(fromCurrency)}{trimZeros(Math.round((1 / previewRate) * 1e8) / 1e8)} {fromCurrency}
                      </Text>
                    </div>
                  )}

                  <Form.Item style={{ marginBottom: 0 }}>
                    <Space>
                      <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>Save Pair</Button>
                      <Button onClick={() => { form.resetFields(); setPreviewRate(null); }}>Clear</Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>

              {/* Saved rates */}
              <Card title="Current Exchange Rates">
                <Table dataSource={savedRates} columns={rateColumns}
                  rowKey={r => `${r.from_currency}-${r.to_currency}`}
                  loading={tableLoading} pagination={{ pageSize: 20 }} size="small"
                  locale={{ emptyText: 'No exchange rates saved yet' }} />
              </Card>

              {/* Conversion table */}
              {previewRate > 0 && conversionRows.length > 0 && (
                <Card title={`Conversion Table — ${fromCurrency} → ${toCurrency}`} style={{ marginTop: 24 }}>
                  <Table dataSource={conversionRows} pagination={false} size="small"
                    columns={[
                      { title: fromCurrency, dataIndex: 'from', key: 'from', align: 'right' },
                      { title: '→', key: 'arrow', width: 40, align: 'center', render: () => '→' },
                      { title: toCurrency, dataIndex: 'to', key: 'to', align: 'right' }
                    ]} />
                </Card>
              )}
            </>
          )
        },
        {
          key: 'currencies',
          label: <span><DollarOutlined /> Currencies Master</span>,
          children: (
            <Card title="All Currencies">
              <Table dataSource={currenciesMaster} columns={masterColumns}
                rowKey="id" size="small" pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'No currencies loaded yet' }} />
            </Card>
          )
        },
        {
          key: 'history',
          label: <span><HistoryOutlined /> Rate History</span>,
          children: (
            <Card title="Exchange Rate Change History">
              <Table dataSource={history} columns={historyColumns}
                rowKey="id" loading={historyLoading} size="small"
                pagination={{ pageSize: 50, showSizeChanger: true }}
                locale={{ emptyText: 'No history yet' }} />
            </Card>
          )
        }
      ]} />
    </div>
  );
}
