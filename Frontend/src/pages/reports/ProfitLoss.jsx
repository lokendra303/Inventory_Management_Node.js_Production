import React, { useState, useEffect } from 'react';
import { Card, Row, Col, DatePicker, Button, Table, message, Tag, Progress } from 'antd';
import { DollarOutlined, RiseOutlined, FallOutlined, ReloadOutlined, CalendarOutlined, BarChartOutlined, AimOutlined, FileTextOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatNumber } from '../../utils/currency.js';

const ProfitLoss = () => {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading]     = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate]     = useState(null);
  const [plData, setPLData]       = useState({
    revenue: 0, cogs: 0, grossProfit: 0,
    netProfit: 0, purchases: 0, inventoryLosses: 0
  });
  const [salesDetails, setSalesDetails] = useState([]);

  const fetchPLData = async (start = null, end = null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (start) params.append('startDate', start);
      if (end)   params.append('endDate', end);

      const [plResResult, detailsResResult] = await Promise.allSettled([
        apiService.get(`/profit-loss?${params}`),
        apiService.get(`/profit-loss/details?${params}`)
      ]);

      const plRes = plResResult.status === 'fulfilled' ? plResResult.value : null;
      const detailsRes = detailsResResult.status === 'fulfilled' ? detailsResResult.value : null;

      const plLoaded = !!plRes?.success;
      const detailsLoaded = !!detailsRes?.success;

      if (plLoaded) {
        setPLData(plRes.data || {
          revenue: 0, cogs: 0, grossProfit: 0, netProfit: 0, purchases: 0, inventoryLosses: 0
        });
      } else {
        setPLData({
          revenue: 0, cogs: 0, grossProfit: 0, netProfit: 0, purchases: 0, inventoryLosses: 0
        });
      }

      if (detailsLoaded) {
        setSalesDetails(Array.isArray(detailsRes?.data?.sales) ? detailsRes.data.sales : []);
      } else {
        setSalesDetails([]);
      }

      if (!plLoaded && !detailsLoaded) {
        message.error('Failed to fetch P&L data');
      } else if (!detailsLoaded) {
        message.warning('P&L summary loaded, but sales detail rows are unavailable right now.');
      }
    } catch {
      setPLData({
        revenue: 0, cogs: 0, grossProfit: 0, netProfit: 0, purchases: 0, inventoryLosses: 0
      });
      setSalesDetails([]);
      message.error('Failed to fetch P&L data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPLData(); }, []);

  const grossMargin = plData.revenue > 0 ? ((plData.grossProfit / plData.revenue) * 100) : 0;
  const netMargin   = plData.revenue > 0 ? ((plData.netProfit   / plData.revenue) * 100) : 0;
  const cogsRatio   = plData.revenue > 0 ? ((plData.cogs        / plData.revenue) * 100) : 0;

  /* ── Stat cards config ─────────────────────────────── */
  const statCards = [
    {
      label: 'Total Revenue',
      value: plData.revenue,
      icon: <DollarOutlined style={{ fontSize: 26, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',
      shadow: 'rgba(102,126,234,0.4)',
    },
    {
      label: 'Cost of Goods',
      value: plData.cogs,
      icon: <FallOutlined style={{ fontSize: 26, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg,#f093fb 0%,#f5576c 100%)',
      shadow: 'rgba(245,87,108,0.4)',
    },
    {
      label: 'Inventory Losses',
      value: plData.inventoryLosses,
      icon: <FallOutlined style={{ fontSize: 26, color: '#fff' }} />,
      gradient: 'linear-gradient(135deg,#f7971e 0%,#ffd200 100%)',
      shadow: 'rgba(247,151,30,0.4)',
    },
    {
      label: 'Gross Profit',
      value: plData.grossProfit,
      icon: <RiseOutlined style={{ fontSize: 26, color: '#fff' }} />,
      gradient: plData.grossProfit >= 0
        ? 'linear-gradient(135deg,#11998e 0%,#38ef7d 100%)'
        : 'linear-gradient(135deg,#ff416c 0%,#ff4b2b 100%)',
      shadow: plData.grossProfit >= 0 ? 'rgba(17,153,142,0.4)' : 'rgba(255,65,108,0.4)',
      extra: `${formatNumber(grossMargin)}% margin`,
    },
    {
      label: 'Net Profit',
      value: plData.netProfit,
      icon: <RiseOutlined style={{ fontSize: 26, color: '#fff' }} />,
      gradient: plData.netProfit >= 0
        ? 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)'
        : 'linear-gradient(135deg,#ff416c 0%,#ff4b2b 100%)',
      shadow: plData.netProfit >= 0 ? 'rgba(26,26,46,0.4)' : 'rgba(255,65,108,0.4)',
      extra: `${formatNumber(netMargin)}% margin`,
    },
  ];

  /* ── Bar chart data ────────────────────────────────── */
  const chartData = [
    { name: 'Revenue',    value: plData.revenue,          fill: '#667eea' },
    { name: 'COGS',       value: plData.cogs,             fill: '#f5576c' },
    { name: 'Inv. Loss',  value: plData.inventoryLosses,  fill: '#f7971e' },
    { name: 'Gross P.',   value: Math.max(0, plData.grossProfit), fill: '#38ef7d' },
    { name: 'Net P.',     value: Math.max(0, plData.netProfit),   fill: '#764ba2' },
  ];

  /* ── Table columns ─────────────────────────────────── */
  const columns = [
    { title: 'SO #',      dataIndex: 'so_number',       key: 'so_number',       width: 110, ellipsis: true },
    { title: 'Customer',  dataIndex: 'customer_name',   key: 'customer_name',   width: 130, ellipsis: true },
    { title: 'Item',      dataIndex: 'item_name',       key: 'item_name',       width: 130, ellipsis: true },
    { title: 'SKU',       dataIndex: 'sku',             key: 'sku',             width: 90,  ellipsis: true, responsive: ['md'] },
    { title: 'Qty',       dataIndex: 'quantity_shipped',key: 'quantity_shipped',width: 65,  render: v => formatNumber(v) },
    { title: 'Unit Price',dataIndex: 'unit_price',      key: 'unit_price',      width: 105, render: v => formatCurrency(v), responsive: ['sm'] },
    { title: 'Revenue',   dataIndex: 'revenue',         key: 'revenue',         width: 105, render: v => <span style={{ color: '#667eea', fontWeight: 500 }}>{formatCurrency(v)}</span> },
    { title: 'Cost',      dataIndex: 'cost',            key: 'cost',            width: 105, render: v => <span style={{ color: '#f5576c' }}>{formatCurrency(v)}</span>, responsive: ['sm'] },
    {
      title: 'Profit', dataIndex: 'profit', key: 'profit', width: 110,
      render: v => (
        <Tag color={v >= 0 ? 'success' : 'error'} style={{ fontWeight: 600, fontSize: 12 }}>
          {v >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(v))}
        </Tag>
      )
    },
    { title: 'Date', dataIndex: 'order_date', key: 'order_date', width: 100, responsive: ['md'] },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 'clamp(18px,4vw,26px)', fontWeight: 700, margin: 0, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BarChartOutlined style={{ fontSize: 22, color: '#667eea' }} /> Profit & Loss
        </h1>
        <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
          Track your revenue, costs and profitability
        </p>
      </div>

      {/* Filter Bar */}
      <Card style={{ marginBottom: 20, borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
        bodyStyle={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <CalendarOutlined style={{ color: '#667eea', fontSize: 16 }} />
          <DatePicker
            onChange={d => { setStartDate(d); fetchPLData(d?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD')); }}
            value={startDate} placeholder="Start Date" format="YYYY-MM-DD"
            style={{ borderRadius: 8 }}
          />
          <span style={{ color: '#aaa', fontSize: 13 }}>to</span>
          <DatePicker
            onChange={d => { setEndDate(d); fetchPLData(startDate?.format('YYYY-MM-DD'), d?.format('YYYY-MM-DD')); }}
            value={endDate} placeholder="End Date" format="YYYY-MM-DD"
            style={{ borderRadius: 8 }}
          />
          <Button
            type="primary" icon={<ReloadOutlined />} loading={loading}
            onClick={() => fetchPLData(startDate?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'))}
          >
            Refresh
          </Button>
        </div>
      </Card>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {statCards.map(card => (
          <Col xs={12} sm={12} md={12} lg={24 / statCards.length} key={card.label}>
            <div style={{
              background: card.gradient,
              borderRadius: 16,
              padding: '18px 16px',
              display: 'flex', alignItems: 'center', gap: 14,
              boxShadow: `0 4px 20px ${card.shadow}`,
              minHeight: 90,
              transition: 'transform 0.2s',
              cursor: 'default',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                background: 'rgba(255,255,255,0.2)', borderRadius: 12,
                width: 50, height: 50, display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                {card.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'clamp(13px,2.5vw,19px)', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                  {formatCurrency(card.value)}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.82)', marginTop: 3 }}>{card.label}</div>
                {card.extra && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{card.extra}</div>
                )}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Chart + Margin Breakdown */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={15}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><BarChartOutlined />Financial Overview</span>}
            style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
            bodyStyle={{ padding: '12px 16px 16px' }}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} barSize={36}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={v => [formatCurrency(v), 'Amount']}
                  contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><AimOutlined />Margin Analysis</span>}
            style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', height: '100%' }}
            bodyStyle={{ padding: '20px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { label: 'Gross Margin', value: grossMargin, color: '#38ef7d', from: '#11998e', to: '#38ef7d' },
                { label: 'Net Margin',   value: netMargin,   color: '#667eea', from: '#667eea', to: '#764ba2' },
                { label: 'COGS Ratio',   value: cogsRatio,   color: '#f5576c', from: '#f093fb', to: '#f5576c' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontWeight: 700, color: item.color }}>{formatNumber(item.value)}%</span>
                  </div>
                  <Progress
                    percent={Math.min(Math.abs(item.value), 100)}
                    strokeColor={{ from: item.from, to: item.to }}
                    showInfo={false}
                    strokeWidth={10}
                    trailColor="#f0f0f0"
                  />
                </div>
              ))}

              <div style={{ marginTop: 8, padding: '14px', background: '#f8f9ff', borderRadius: 12 }}>
                {[
                  { label: 'Revenue',          value: plData.revenue,         color: '#667eea' },
                  { label: 'Total Costs',       value: plData.cogs + plData.inventoryLosses, color: '#f5576c' },
                  { label: 'Net Profit',        value: plData.netProfit,       color: plData.netProfit >= 0 ? '#11998e' : '#f5576c' },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#777' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.color }}>{formatCurrency(row.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Sales Details Table */}
      <Card
        title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><FileTextOutlined />Sales Details</span>}
        extra={<Tag color="purple">{salesDetails.length} records</Tag>}
        style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
        bodyStyle={{ padding: '0 0 8px' }}
      >
        <Table
          columns={columns}
          dataSource={salesDetails}
          loading={loading}
          rowKey={r => `${r.so_number}-${r.item_id}`}
          pagination={{ pageSize: 20, size: 'small', showSizeChanger: false }}
          scroll={{ x: 'max-content' }}
          size="small"
          rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : ''}
        />
      </Card>
    </div>
  );
};

export default ProfitLoss;
