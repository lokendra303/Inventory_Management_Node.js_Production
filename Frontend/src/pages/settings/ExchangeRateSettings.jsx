import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Form, InputNumber, Button, message, Select, Row, Col,
  Table, Divider, Typography, Space, Tag, Tabs, Alert, Tooltip, Input, Spin
} from 'antd';
import {
  SwapOutlined, SaveOutlined, PlusOutlined, HistoryOutlined,
  DollarOutlined, ThunderboltOutlined, SyncOutlined, WifiOutlined,
  SearchOutlined, ArrowRightOutlined
} from '@ant-design/icons';
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
  const [activeTab, setActiveTab] = useState('checker');
  const [fetchingLive, setFetchingLive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [liveRateInfo, setLiveRateInfo] = useState(null);

  // ── Rate Checker state ──────────────────────────────────────
  const [checkerFrom, setCheckerFrom] = useState('USD');
  const [checkerTo, setCheckerTo] = useState('INR');
  const [checkerAmount, setCheckerAmount] = useState(1);
  const [checkerResult, setCheckerResult] = useState(null);
  const [checkerLoading, setCheckerLoading] = useState(false);
  const [checkerSearch, setCheckerSearch] = useState('');
  const [multiResults, setMultiResults] = useState([]);

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
    const newRate = current > 0 ? parseFloat((Math.round((1 / current) * 1e8) / 1e8).toFixed(6)) : undefined;
    const prevFrom = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(prevFrom);
    setPreviewRate(newRate || null);
    setLiveRateInfo(null);
    if (newRate) form.setFieldsValue({ rate: newRate });
    else form.resetFields(['rate']);
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

  // Fetch a single live rate and fill the rate input
  const handleFetchLive = async () => {
    if (fromCurrency === toCurrency) return message.error('From and To currency cannot be the same');
    setFetchingLive(true);
    setLiveRateInfo(null);
    try {
      const res = await apiService.get('/settings/exchange-rates/live', {
        params: { base: fromCurrency, to: toCurrency }
      });
      if (res.success) {
        const { rate, inverseRate, lastUpdated } = res.data;
        form.setFieldsValue({ rate });
        setPreviewRate(rate);
        setLiveRateInfo({ rate, inverseRate, lastUpdated, from: fromCurrency, to: toCurrency });
        message.success(`Live rate fetched: 1 ${fromCurrency} = ${rate} ${toCurrency}`);
      } else {
        message.error(res.error || 'Failed to fetch live rate');
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to fetch live rate');
    } finally {
      setFetchingLive(false);
    }
  };

  // Sync ALL live rates for a base currency into DB
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await apiService.post('/settings/exchange-rates/live-sync', { base: fromCurrency });
      if (res.success) {
        message.success(res.message);
        loadRates();
        loadCurrencies();
      } else {
        message.error(res.error || 'Sync failed');
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Rate Checker handlers ───────────────────────────────────
  const handleCheckRate = async () => {
    if (!checkerFrom || !checkerTo) return message.warning('Select both currencies');
    if (checkerFrom === checkerTo) {
      setCheckerResult({ rate: 1, inverseRate: 1, converted: checkerAmount, from: checkerFrom, to: checkerTo, lastUpdated: 'N/A' });
      return;
    }
    setCheckerLoading(true);
    setCheckerResult(null);
    try {
      const res = await apiService.get('/settings/exchange-rates/live', {
        params: { base: checkerFrom, to: checkerTo }
      });
      if (res.success) {
        const { rate, inverseRate, lastUpdated } = res.data;
        const converted = parseFloat((checkerAmount * rate).toFixed(4));
        setCheckerResult({ rate, inverseRate, converted, from: checkerFrom, to: checkerTo, lastUpdated, amount: checkerAmount });
      } else {
        message.error(res.error || 'Failed to fetch rate');
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to fetch rate');
    } finally {
      setCheckerLoading(false);
    }
  };

  // Search & check rate for multiple currencies at once
  const handleMultiSearch = async () => {
    if (!checkerSearch.trim()) return message.warning('Enter a currency code or name to search');
    setCheckerLoading(true);
    setMultiResults([]);
    try {
      // Fetch all rates for the base currency
      const res = await apiService.get('/settings/exchange-rates/live', {
        params: { base: checkerFrom, to: checkerSearch.trim().toUpperCase() }
      });
      if (res.success) {
        const { rate, inverseRate, lastUpdated } = res.data;
        const converted = parseFloat((checkerAmount * rate).toFixed(4));
        setCheckerResult({ rate, inverseRate, converted, from: checkerFrom, to: checkerSearch.trim().toUpperCase(), lastUpdated, amount: checkerAmount });
        setCheckerTo(checkerSearch.trim().toUpperCase());
      } else {
        message.error(res.error || `Currency "${checkerSearch}" not found`);
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Currency not found');
    } finally {
      setCheckerLoading(false);
    }
  };

  // Popular currencies to show quick results
  const POPULAR = ['USD','EUR','GBP','INR','AED','SAR','PKR','JPY','CAD','AUD','CHF','CNY'];

  const handleQuickCheck = async (toCurr) => {
    if (checkerFrom === toCurr) return;
    setCheckerLoading(true);
    try {
      const res = await apiService.get('/settings/exchange-rates/live', {
        params: { base: checkerFrom, to: toCurr }
      });
      if (res.success) {
        const { rate, inverseRate, lastUpdated } = res.data;
        const converted = parseFloat((checkerAmount * rate).toFixed(4));
        setCheckerResult({ rate, inverseRate, converted, from: checkerFrom, to: toCurr, lastUpdated, amount: checkerAmount });
        setCheckerTo(toCurr);
      }
    } catch { /* silent */ }
    finally { setCheckerLoading(false); }
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
    { title: '', key: 'actions', width: 180,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" type="link" onClick={() => handleSetActive(r)}>Set Active</Button>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            style={{ color: '#1677ff', borderColor: '#1677ff' }}
            onClick={async () => {
              try {
                const res = await apiService.get('/settings/exchange-rates/live', {
                  params: { base: r.from_currency, to: r.to_currency }
                });
                if (res.success) {
                  await apiService.put('/settings/exchange-rates', {
                    fromCurrency: r.from_currency,
                    toCurrency: r.to_currency,
                    rate: res.data.rate,
                    note: `Live update ${dayjs().format('DD MMM YYYY HH:mm')}`
                  });
                  message.success(`Updated: 1 ${r.from_currency} = ${res.data.rate} ${r.to_currency}`);
                  loadRates();
                }
              } catch { message.error('Failed to fetch live rate'); }
            }}
          >
            Live Update
          </Button>
        </Space>
      )
    }
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

      {/* Active rate banner — reads from live exchange_rates table */}
      <Card style={{ marginBottom: 24, background: 'linear-gradient(135deg,#0f0c29,#302b63)', border: 'none', borderRadius: 16 }}>
        <Row align="middle" justify="space-between" gutter={16} wrap>
          <Col>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>
              <WifiOutlined style={{ marginRight: 6, color: '#52c41a' }} />
              Active Currency &nbsp;·&nbsp; Source: open.er-api.com
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>
              <Tag color="blue" style={{ fontSize: 14, padding: '2px 10px', marginRight: 10 }}>{currency}</Tag>
              {currency !== 'USD' && savedRates.length > 0 && (() => {
                const pair = savedRates.find(r => r.from_currency === 'USD' && r.to_currency === currency);
                return pair
                  ? <span>1 USD = {getCurrencySymbol(currency)}{trimZeros(pair.rate)} {currency}</span>
                  : <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Rate not synced yet</span>;
              })()}
              {currency === 'USD' && <span>Base Currency</span>}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
              To change active currency: go to Exchange Rates tab → click "Set Active" on any row
            </div>
          </Col>
          <Col style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag color="green" icon={<WifiOutlined />} style={{ fontSize: 12 }}>166 currencies live</Tag>
            <Tooltip title="Fetch all 166 live rates from open.er-api.com and save to DB">
              <Button
                icon={<SyncOutlined spin={syncing} />}
                loading={syncing}
                onClick={handleSyncAll}
                style={{ background: '#52c41a', color: '#fff', border: 'none', borderRadius: 8 }}
              >
                Sync All Live Rates
              </Button>
            </Tooltip>
          </Col>
        </Row>
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'checker',
          label: <span><SearchOutlined /> Rate Checker</span>,
          children: (
            <>
              {/* Converter Card */}
              <Card
                style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)', marginBottom: 20 }}
                bodyStyle={{ padding: 28 }}
              >
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
                    <SearchOutlined style={{ color: '#667eea', marginRight: 8 }} />
                    Currency Rate Checker
                  </div>
                  <div style={{ fontSize: 13, color: '#8c8c8c' }}>
                    Check live exchange rates instantly. Powered by open.er-api.com
                  </div>
                </div>

                {/* Search by code */}
                <Row gutter={12} style={{ marginBottom: 16 }}>
                  <Col flex="1">
                    <Input
                      size="large"
                      placeholder="Type currency code e.g. INR, EUR, GBP, AED..."
                      prefix={<SearchOutlined style={{ color: '#bbb' }} />}
                      value={checkerSearch}
                      onChange={e => setCheckerSearch(e.target.value.toUpperCase())}
                      onPressEnter={handleMultiSearch}
                      allowClear
                      style={{ borderRadius: 10 }}
                    />
                  </Col>
                  <Col>
                    <Button
                      size="large"
                      icon={<SearchOutlined />}
                      loading={checkerLoading}
                      onClick={handleMultiSearch}
                      style={{ background: '#667eea', color: '#fff', border: 'none', borderRadius: 10, height: 40 }}
                    >
                      Search
                    </Button>
                  </Col>
                </Row>

                {/* Amount + From + To selectors */}
                <Row gutter={12} align="middle" style={{ marginBottom: 16 }}>
                  <Col xs={24} sm={6}>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Amount</div>
                    <InputNumber
                      size="large"
                      min={0.000001}
                      value={checkerAmount}
                      onChange={v => setCheckerAmount(v || 1)}
                      style={{ width: '100%', borderRadius: 10 }}
                      formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={v => v.replace(/,/g, '')}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>From</div>
                    <Select
                      size="large"
                      value={checkerFrom}
                      onChange={v => { setCheckerFrom(v); setCheckerResult(null); }}
                      showSearch optionFilterProp="children"
                      style={{ width: '100%' }}
                    >
                      {allCurrencies.map(c => (
                        <Option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col xs={24} sm={2} style={{ textAlign: 'center', paddingTop: 20 }}>
                    <Button
                      icon={<SwapOutlined />}
                      onClick={() => {
                        setCheckerFrom(checkerTo);
                        setCheckerTo(checkerFrom);
                        setCheckerResult(null);
                      }}
                      style={{ borderRadius: 8 }}
                    />
                  </Col>
                  <Col xs={24} sm={8}>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>To</div>
                    <Select
                      size="large"
                      value={checkerTo}
                      onChange={v => { setCheckerTo(v); setCheckerResult(null); }}
                      showSearch optionFilterProp="children"
                      style={{ width: '100%' }}
                    >
                      {allCurrencies.map(c => (
                        <Option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</Option>
                      ))}
                    </Select>
                  </Col>
                </Row>

                <Button
                  type="primary"
                  size="large"
                  icon={checkerLoading ? <SyncOutlined spin /> : <ThunderboltOutlined />}
                  loading={checkerLoading}
                  onClick={handleCheckRate}
                  style={{
                    background: 'linear-gradient(135deg,#667eea,#764ba2)',
                    border: 'none', borderRadius: 10,
                    width: '100%', height: 48, fontSize: 15, fontWeight: 700,
                    marginBottom: checkerResult ? 20 : 0
                  }}
                >
                  Check Live Rate
                </Button>

                {/* Result display */}
                {checkerResult && (
                  <div style={{
                    background: 'linear-gradient(135deg,#667eea15,#764ba215)',
                    border: '2px solid #667eea40',
                    borderRadius: 14, padding: '20px 24px',
                  }}>
                    <Row align="middle" gutter={16}>
                      <Col xs={24} sm={10}>
                        <div style={{ fontSize: 13, color: '#8c8c8c' }}>You have</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>
                          {getCurrencySymbol(checkerResult.from)}
                          {checkerResult.amount?.toLocaleString()}
                          <span style={{ fontSize: 14, color: '#8c8c8c', marginLeft: 6 }}>{checkerResult.from}</span>
                        </div>
                      </Col>
                      <Col xs={24} sm={4} style={{ textAlign: 'center' }}>
                        <ArrowRightOutlined style={{ fontSize: 24, color: '#667eea' }} />
                      </Col>
                      <Col xs={24} sm={10}>
                        <div style={{ fontSize: 13, color: '#8c8c8c' }}>You get</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#667eea' }}>
                          {getCurrencySymbol(checkerResult.to)}
                          {checkerResult.converted?.toLocaleString()}
                          <span style={{ fontSize: 14, color: '#8c8c8c', marginLeft: 6 }}>{checkerResult.to}</span>
                        </div>
                      </Col>
                    </Row>
                    <Divider style={{ margin: '14px 0' }} />
                    <Row gutter={24}>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>Exchange Rate</Text>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          1 {checkerResult.from} = {checkerResult.rate} {checkerResult.to}
                        </div>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>Inverse Rate</Text>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          1 {checkerResult.to} = {checkerResult.inverseRate} {checkerResult.from}
                        </div>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>Last Updated</Text>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {checkerResult.lastUpdated !== 'N/A'
                            ? dayjs(checkerResult.lastUpdated).format('DD MMM YYYY HH:mm')
                            : 'Same currency'}
                        </div>
                      </Col>
                      <Col>
                        <Text type="secondary" style={{ fontSize: 12 }}>Source</Text>
                        <div>
                          <Tag color="green" icon={<WifiOutlined />} style={{ fontSize: 11 }}>open.er-api.com</Tag>
                        </div>
                      </Col>
                    </Row>
                  </div>
                )}
              </Card>

              {/* Quick check popular currencies */}
              <Card
                title={
                  <span>
                    <ThunderboltOutlined style={{ color: '#f7971e', marginRight: 8 }} />
                    Quick Check — Popular Currencies
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                      (base: {checkerFrom} · amount: {checkerAmount?.toLocaleString()})
                    </Text>
                  </span>
                }
                style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}
              >
                {checkerLoading && <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>}
                <Row gutter={[12, 12]}>
                  {POPULAR.filter(c => c !== checkerFrom).map(curr => {
                    const sym = getCurrencySymbol(curr);
                    const isActive = checkerResult?.to === curr;
                    return (
                      <Col xs={12} sm={8} md={6} lg={4} key={curr}>
                        <div
                          onClick={() => handleQuickCheck(curr)}
                          style={{
                            border: `2px solid ${isActive ? '#667eea' : '#f0f0f0'}`,
                            borderRadius: 12,
                            padding: '12px 14px',
                            cursor: 'pointer',
                            background: isActive ? 'linear-gradient(135deg,#667eea15,#764ba215)' : '#fafafa',
                            transition: 'all 0.2s',
                            textAlign: 'center',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = '#667eea80'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = '#f0f0f0'; }}
                        >
                          <div style={{ fontSize: 18, fontWeight: 800, color: isActive ? '#667eea' : '#1a1a2e' }}>
                            {sym}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? '#667eea' : '#374151' }}>
                            {curr}
                          </div>
                          {isActive && checkerResult && (
                            <div style={{ fontSize: 11, color: '#667eea', marginTop: 4, fontWeight: 600 }}>
                              = {checkerResult.converted?.toLocaleString()}
                            </div>
                          )}
                          {!isActive && (
                            <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>click to check</div>
                          )}
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              </Card>
            </>
          )
        },
        {
          key: 'rates',
          label: <span><DollarOutlined /> Exchange Rates</span>,
          children: (
            <>
              {/* Rate editor */}
              <Card title={<><PlusOutlined /> Add / Update Rate Pair</>} style={{ marginBottom: 24 }}>

                {/* From / To selectors — outside Form, own state */}
                <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
                  <Col xs={24} sm={10}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>From Currency</div>
                    <Select
                      value={fromCurrency}
                      onChange={v => { setFromCurrency(v); setPreviewRate(null); setLiveRateInfo(null); }}
                      showSearch
                      optionFilterProp="children"
                      style={{ width: '100%' }}
                      size="large"
                      placeholder="Select base currency"
                    >
                      {allCurrencies.map(c => (
                        <Option key={c.code} value={c.code}>
                          <span style={{ fontWeight: 600 }}>{c.code}</span>
                          <span style={{ color: '#8c8c8c', marginLeft: 6 }}>{c.symbol} — {c.name}</span>
                        </Option>
                      ))}
                    </Select>
                  </Col>

                  <Col xs={24} sm={4} style={{ textAlign: 'center', paddingTop: 22 }}>
                    <Button
                      icon={<SwapOutlined />}
                      onClick={handleSwap}
                      title="Swap currencies"
                      style={{ borderRadius: 8, width: '100%' }}
                    >
                      Swap
                    </Button>
                  </Col>

                  <Col xs={24} sm={10}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>To Currency</div>
                    <Select
                      value={toCurrency}
                      onChange={v => { setToCurrency(v); setPreviewRate(null); setLiveRateInfo(null); }}
                      showSearch
                      optionFilterProp="children"
                      style={{ width: '100%' }}
                      size="large"
                      placeholder="Select target currency"
                    >
                      {allCurrencies.map(c => (
                        <Option key={c.code} value={c.code}>
                          <span style={{ fontWeight: 600 }}>{c.code}</span>
                          <span style={{ color: '#8c8c8c', marginLeft: 6 }}>{c.symbol} — {c.name}</span>
                        </Option>
                      ))}
                    </Select>
                  </Col>
                </Row>

                {/* Selected pair preview */}
                {fromCurrency && toCurrency && fromCurrency !== toCurrency && (
                  <div style={{
                    background: '#f0f5ff', border: '1px solid #adc6ff',
                    borderRadius: 8, padding: '8px 14px', marginBottom: 16,
                    fontSize: 13, color: '#1677ff', fontWeight: 600
                  }}>
                    Pair selected: <strong>{fromCurrency}</strong> → <strong>{toCurrency}</strong>
                    &nbsp;|&nbsp; Enter the rate below: 1 {fromCurrency} = ? {toCurrency}
                  </div>
                )}
                {fromCurrency === toCurrency && (
                  <div style={{
                    background: '#fff2f0', border: '1px solid #ffccc7',
                    borderRadius: 8, padding: '8px 14px', marginBottom: 16,
                    fontSize: 13, color: '#ff4d4f'
                  }}>
                    From and To currency cannot be the same
                  </div>
                )}

                <Divider style={{ margin: '0 0 16px' }} />

                {/* Rate + Note inside Form */}
                <Form form={form} layout="vertical" onFinish={handleSavePair}>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item
                        name="rate"
                        label={
                          <span style={{ fontWeight: 600 }}>
                            Rate
                            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                              1 {fromCurrency} = ? {toCurrency}
                            </Text>
                          </span>
                        }
                        rules={[
                          { required: true, message: 'Enter the exchange rate' },
                          { type: 'number', min: 0.000001, message: 'Rate must be greater than 0' }
                        ]}
                      >
                        <InputNumber
                          min={0.000001}
                          step={0.01}
                          precision={6}
                          size="large"
                          style={{ width: '100%' }}
                          addonBefore={`1 ${fromCurrency} =`}
                          addonAfter={toCurrency}
                          onChange={v => { setPreviewRate(v || 0); setLiveRateInfo(null); }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Form.Item name="note" label={<span style={{ fontWeight: 600 }}>Note (optional)</span>}>
                        <Input
                          size="large"
                          placeholder="e.g. RBI rate, Bank rate, Custom rate"
                          style={{ borderRadius: 8 }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Live rate info banner */}
                  {liveRateInfo && (
                    <Alert
                      type="success"
                      showIcon
                      icon={<WifiOutlined />}
                      style={{ marginBottom: 12, borderRadius: 8 }}
                      message={
                        <span>
                          <strong>Live Rate:</strong> 1 {liveRateInfo.from} = {liveRateInfo.rate} {liveRateInfo.to}
                          &nbsp;|&nbsp;
                          1 {liveRateInfo.to} = {liveRateInfo.inverseRate} {liveRateInfo.from}
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 12 }}>
                            Source: open.er-api.com · Updated: {liveRateInfo.lastUpdated}
                          </Text>
                        </span>
                      }
                    />
                  )}

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
                    <Space wrap>
                      <Button
                        icon={<ThunderboltOutlined />}
                        loading={fetchingLive}
                        onClick={handleFetchLive}
                        style={{ background: '#1677ff', color: '#fff', border: 'none', borderRadius: 8 }}
                      >
                        Fetch Live Rate
                      </Button>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={saving}
                        icon={<SaveOutlined />}
                        disabled={fromCurrency === toCurrency}
                      >
                        Save Pair
                      </Button>
                      <Button onClick={() => { form.resetFields(); setPreviewRate(null); setLiveRateInfo(null); }}>Clear</Button>
                    </Space>
                  </Form.Item>
                </Form>
              </Card>

              {/* Saved rates */}
              <Card
                title="Current Exchange Rates"
                extra={
                  <Tooltip title="Fetch all 166 currencies live from open.er-api.com and save to DB">
                    <Button
                      icon={<SyncOutlined spin={syncing} />}
                      loading={syncing}
                      onClick={handleSyncAll}
                      style={{ background: '#52c41a', color: '#fff', border: 'none', borderRadius: 8 }}
                    >
                      Sync All Live Rates
                    </Button>
                  </Tooltip>
                }
              >
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
