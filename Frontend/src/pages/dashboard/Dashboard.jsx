import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Alert, Spin, Tag, Progress, DatePicker, Segmented, Typography, Space } from 'antd';
import {
  TagsOutlined, DatabaseOutlined, AlertOutlined,
  FundProjectionScreenOutlined, RiseOutlined, FallOutlined, BankOutlined,
  LineChartOutlined, ShoppingCartOutlined, CalendarOutlined, ReloadOutlined,
  TrophyOutlined, PieChartOutlined, BarChartOutlined
} from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import dayjs from 'dayjs';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const PRESETS = [
  { label: '7D',  days: 6 },
  { label: '30D', days: 29 },
  { label: '90D', days: 89 },
];

const DONUT_COLORS = ['#667eea','#11998e','#f7971e','#f5576c','#764ba2','#38ef7d'];

const EmptyChart = ({ height = 260 }) => (
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
    No data available
  </div>
);

const cardStyle = { borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' };
const cardBody = { padding: '12px 16px 16px' };

const STAT_CARDS = [
  {
    key: 'activeItems',
    label: 'Active Items',
    icon: <TagsOutlined style={{ fontSize: 26, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    suffix: '',
  },
  {
    key: 'totalQuantity',
    label: 'Total Stock',
    icon: <DatabaseOutlined style={{ fontSize: 26, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    suffix: ' units',
  },
  {
    key: 'totalAvailable',
    label: 'Available',
    icon: <RiseOutlined style={{ fontSize: 26, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    suffix: ' units',
  },
  {
    key: 'totalReserved',
    label: 'Reserved',
    icon: <FallOutlined style={{ fontSize: 26, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)',
    suffix: ' units',
  },
  {
    key: 'lowStockCount',
    label: 'Low Stock',
    icon: <AlertOutlined style={{ fontSize: 26, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
    suffix: ' items',
  },
  {
    key: 'activeWarehouses',
    label: 'Warehouses',
    icon: <BankOutlined style={{ fontSize: 26, color: '#fff' }} />,
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    suffix: ' active',
  },
];

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const { currency, formatCurrency } = useCurrency();
  const [dashboardData, setDashboardData] = useState({
    totalItems: 0, lowStockItems: [], lowStockCount: 0,
    activeWarehouses: 0, inactiveWarehouses: 0, totalItemsCount: 0,
    activeItems: 0, inactiveItems: 0, totalQuantity: 0,
    totalAvailable: 0, totalReserved: 0, stockTrend: []
  });
  const [topItems, setTopItems] = useState([]);
  const [categoryStock, setCategoryStock] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  // Date range state — default last 7 days
  const [activePreset, setActivePreset] = useState('7D');
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(6, 'day'),
    dayjs()
  ]);

  useEffect(() => { fetchDashboardData(); }, [currency]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      const [inventoryRes, warehousesRes, lowStockRes, itemsRes, trendRes, topItemsRes, categoryRes, monthlyRes] = await Promise.all([
        apiService.get('/inventory').catch(() => ({ success: false, data: [] })),
        apiService.get('/warehouses').catch(() => ({ success: false, data: [] })),
        apiService.get('/inventory/low-stock').catch(() => ({ success: false, data: [] })),
        apiService.get('/items').catch(() => ({ success: false, data: [] })),
        apiService.get(`/reports/dashboard-trend?startDate=${start}&endDate=${end}`).catch(() => ({ success: false, data: [] })),
        apiService.get(`/reports/dashboard-top-items?startDate=${start}&endDate=${end}`).catch(() => ({ success: false, data: [] })),
        apiService.get('/reports/dashboard-category-stock').catch(() => ({ success: false, data: [] })),
        apiService.get(`/reports/dashboard-monthly?startDate=${start}&endDate=${end}`).catch(() => ({ success: false, data: [] }))
      ]);

      const inventory = inventoryRes.success ? inventoryRes.data : [];
      const warehouses = warehousesRes.success ? warehousesRes.data : [];
      const lowStockItems = lowStockRes.success ? lowStockRes.data : [];
      const items = itemsRes.success ? itemsRes.data : [];
      const stockTrend = trendRes.success ? trendRes.data : [];

      if (topItemsRes.success) setTopItems(topItemsRes.data);
      if (categoryRes.success) setCategoryStock(categoryRes.data);
      if (monthlyRes.success) setMonthlyData(monthlyRes.data);

      setDashboardData({
        totalItems: inventory.length,
        activeItems: items.filter(i => i.status === 'active').length,
        inactiveItems: items.filter(i => i.status === 'inactive').length,
        totalQuantity: inventory.reduce((s, i) => s + (parseFloat(i.quantity_on_hand) || 0), 0),
        totalAvailable: inventory.reduce((s, i) => s + (parseFloat(i.quantity_available) || 0), 0),
        totalReserved: inventory.reduce((s, i) => s + (parseFloat(i.quantity_reserved) || 0), 0),
        activeWarehouses: warehouses.filter(w => w.status === 'active').length,
        inactiveWarehouses: warehouses.filter(w => w.status === 'inactive').length,
        totalItemsCount: items.length,
        lowStockItems: lowStockItems.slice(0, 10),
        lowStockCount: lowStockItems.length,
        stockTrend
      });
    } catch (e) {
      console.error('Dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTrend = async (start, end) => {
    setTrendLoading(true);
    try {
      const [trendRes, topItemsRes, monthlyRes] = await Promise.all([
        apiService.get(`/reports/dashboard-trend?startDate=${start}&endDate=${end}`).catch(() => ({ success: false, data: [] })),
        apiService.get(`/reports/dashboard-top-items?startDate=${start}&endDate=${end}`).catch(() => ({ success: false, data: [] })),
        apiService.get(`/reports/dashboard-monthly?startDate=${start}&endDate=${end}`).catch(() => ({ success: false, data: [] }))
      ]);
      if (trendRes.success) setDashboardData(prev => ({ ...prev, stockTrend: trendRes.data }));
      if (topItemsRes.success) setTopItems(topItemsRes.data);
      if (monthlyRes.success) setMonthlyData(monthlyRes.data);
    } finally {
      setTrendLoading(false);
    }
  };

  const onPresetClick = (preset) => {
    const end = dayjs();
    const start = dayjs().subtract(preset.days, 'day');
    setActivePreset(preset.label);
    setDateRange([start, end]);
    fetchTrend(start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'));
  };

  const onRangeChange = (dates) => {
    if (!dates || !dates[0] || !dates[1]) return;
    setActivePreset(null);
    setDateRange(dates);
    fetchTrend(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'));
  };

  const lowStockColumns = [
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', ellipsis: true, responsive: ['sm'] },
    { title: 'Warehouse', dataIndex: 'warehouse_name', key: 'warehouse_name', ellipsis: true, responsive: ['md'] },
    {
      title: 'Qty', dataIndex: 'quantity_available', key: 'quantity_available', width: 70,
      render: (v) => (
        <Tag color={v <= 5 ? 'red' : 'orange'} style={{ fontWeight: 600 }}>{v}</Tag>
      )
    },
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const stockUsagePercent = dashboardData.totalQuantity > 0
    ? Math.round((dashboardData.totalReserved / dashboardData.totalQuantity) * 100)
    : 0;

  return (
    <div style={{ padding: '18px 18px 36px', background: 'linear-gradient(180deg,#f7f8fc 0%,#eef2ff 100%)', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{
        marginBottom: 24,
        background: 'linear-gradient(135deg,#667eea 0%,#764ba2 55%,#11998e 100%)',
        borderRadius: 18,
        padding: '20px 20px',
        boxShadow: '0 10px 28px rgba(102,126,234,0.28)',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FundProjectionScreenOutlined style={{ fontSize: 24 }} />
            Dashboard
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13 }}>
            Live inventory, sales, and purchasing intelligence at a glance.
          </Text>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Tag color="blue" style={{ borderRadius: 16, padding: '4px 10px', margin: 0, border: 'none' }}>
            Range: {dateRange[0].format('DD MMM')} - {dateRange[1].format('DD MMM YYYY')}
          </Tag>
          <Tag color={dashboardData.lowStockCount > 0 ? 'red' : 'green'} style={{ borderRadius: 16, padding: '4px 10px', margin: 0, border: 'none' }}>
            {dashboardData.lowStockCount > 0 ? `${dashboardData.lowStockCount} low-stock alerts` : 'All stock healthy'}
          </Tag>
        </div>
      </div>

      {/* Stat Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {STAT_CARDS.map(card => (
          <Col xs={12} sm={8} md={8} lg={4} key={card.key}>
            <div style={{
              background: card.gradient,
              borderRadius: 18,
              padding: '18px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
              minHeight: 88,
              transition: 'transform 0.22s ease, box-shadow 0.22s ease',
              cursor: 'default',
              border: '1px solid rgba(255,255,255,0.14)',
            }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                e.currentTarget.style.boxShadow = '0 16px 28px rgba(0,0,0,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.16)';
              }}
            >
              <div style={{
                background: 'rgba(255,255,255,0.2)', borderRadius: 12,
                width: 48, height: 48, display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.28)'
              }}>
                {card.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 'clamp(16px, 3vw, 22px)', fontWeight: 700,
                  color: '#fff', lineHeight: 1.1,
                }}>
                  {(dashboardData[card.key] || 0).toLocaleString()}
                  {card.suffix && (
                    <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 4, opacity: 0.9 }}>
                      {card.suffix}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>
                  {card.label}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Insight Strip */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ ...cardStyle, background: 'linear-gradient(135deg,#ffffff,#f7f9ff)' }} bodyStyle={{ padding: '12px 14px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Stock Utilization</Text>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#667eea' }}>{stockUsagePercent}%</div>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Reserved against total stock</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ ...cardStyle, background: 'linear-gradient(135deg,#ffffff,#f4fffb)' }} bodyStyle={{ padding: '12px 14px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Availability Health</Text>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#11998e' }}>
              {dashboardData.totalQuantity > 0 ? Math.round((dashboardData.totalAvailable / dashboardData.totalQuantity) * 100) : 0}%
            </div>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Sellable stock ratio</Text>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card bordered={false} style={{ ...cardStyle, background: 'linear-gradient(135deg,#ffffff,#fff8f2)' }} bodyStyle={{ padding: '12px 14px' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Warehouse Status</Text>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#f7971e' }}>
              {dashboardData.activeWarehouses}/{dashboardData.activeWarehouses + dashboardData.inactiveWarehouses}
            </div>
            <Text style={{ fontSize: 12, color: '#8c8c8c' }}>Active over total warehouses</Text>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><LineChartOutlined style={{ color: '#667eea' }} />Sales Revenue Trend</span>}
            extra={
              <Space size={8} wrap>
                <Segmented
                  size="small"
                  value={activePreset || 'custom'}
                  onChange={(val) => {
                    const picked = PRESETS.find(p => p.label === val);
                    if (picked) onPresetClick(picked);
                  }}
                  options={[
                    ...PRESETS.map(p => ({ label: p.label, value: p.label })),
                    { label: 'Custom', value: 'custom' }
                  ]}
                />
                <RangePicker
                  size="small"
                  value={dateRange}
                  onChange={onRangeChange}
                  disabledDate={d => d && d.isAfter(dayjs())}
                  allowClear={false}
                  style={{ borderRadius: 8 }}
                  suffixIcon={<CalendarOutlined style={{ color: '#667eea' }} />}
                />
                {trendLoading && <ReloadOutlined spin style={{ color: '#667eea' }} />}
              </Space>
            }
            style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            bodyStyle={{ padding: '12px 16px 16px' }}
          >
            {dashboardData.stockTrend.length === 0 ? (
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                No sales data for the selected period
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dashboardData.stockTrend}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#667eea" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#667eea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v, true)} width={80} />
                <Tooltip formatter={(v) => [formatCurrency(v, true), 'Revenue']} />
                <Area type="monotone" dataKey="value" stroke="#667eea" strokeWidth={2.5}
                  fill="url(#colorValue)" dot={dashboardData.stockTrend.length <= 31 ? { fill: '#667eea', r: 3 } : false} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><DatabaseOutlined style={{ color: '#667eea' }} />Stock Usage</span>}
            style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', height: '100%' }}
            bodyStyle={{ padding: '16px' }}
          >
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#555' }}>Reserved vs Total</span>
                <span style={{ fontWeight: 600, color: '#667eea' }}>{stockUsagePercent}%</span>
              </div>
              <Progress percent={stockUsagePercent} strokeColor={{ from: '#667eea', to: '#764ba2' }} showInfo={false} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Total Stock', value: dashboardData.totalQuantity, color: '#667eea' },
                { label: 'Available', value: dashboardData.totalAvailable, color: '#11998e' },
                { label: 'Reserved', value: dashboardData.totalReserved, color: '#f7971e' },
                { label: 'Inactive Items', value: dashboardData.inactiveItems, color: '#ff4d4f' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                    <span style={{ fontSize: 13, color: '#555' }}>{item.label}</span>
                  </div>
                  <span style={{ fontWeight: 600, color: '#1a1a2e' }}>{item.value?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Low Stock + Orders Trend */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><AlertOutlined style={{ color: '#ff4d4f' }} />Low Stock Alerts</span>}
            extra={dashboardData.lowStockCount > 0 && (
              <Tag color="red">{dashboardData.lowStockCount} items</Tag>
            )}
            style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            bodyStyle={{ padding: '0 0 8px' }}
          >
            {dashboardData.lowStockItems.length > 0 ? (
              <Table
                dataSource={dashboardData.lowStockItems}
                columns={lowStockColumns}
                pagination={false}
                size="small"
                scroll={{ x: 'max-content', y: 260 }}
                rowKey="id"
                rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : ''}
              />
            ) : (
              <div style={{ padding: 16 }}>
                <Alert message="All items are well stocked ✅" type="success" showIcon />
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCartOutlined style={{ color: '#11998e' }} />
                Daily Orders
                <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>
                  {dateRange[0].format('DD MMM')} – {dateRange[1].format('DD MMM YYYY')}
                </span>
              </span>
            }
            style={{ borderRadius: 16, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
            bodyStyle={{ padding: '12px 16px 16px' }}
          >
            {dashboardData.stockTrend.length === 0 ? (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
                No order data for the selected period
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dashboardData.stockTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#11998e" strokeWidth={2.5}
                  dot={dashboardData.stockTrend.length <= 31 ? { fill: '#11998e', r: 3 } : false} name="Orders" />
              </LineChart>
            </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
      {/* ── NEW CHARTS ROW 1: Monthly Sales vs Purchases + Top Items ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><BarChartOutlined style={{ color: '#667eea' }} />Monthly Sales vs Purchases <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>({dateRange[0].format('DD MMM')} – {dateRange[1].format('DD MMM YYYY')})</span></span>}
            style={cardStyle} bodyStyle={cardBody}
          >
            {monthlyData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} barCategoryGap="30%" barGap={4}>
                  <defs>
                    <linearGradient id="gradSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#667eea" stopOpacity={1} />
                      <stop offset="100%" stopColor="#764ba2" stopOpacity={0.8} />
                    </linearGradient>
                    <linearGradient id="gradPurchases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#11998e" stopOpacity={1} />
                      <stop offset="100%" stopColor="#38ef7d" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v, true)} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    formatter={(v, name) => [formatCurrency(v, true), name]}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="sales" name="Sales" fill="url(#gradSales)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="purchases" name="Purchases" fill="url(#gradPurchases)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><TrophyOutlined style={{ color: '#f7971e' }} />Top 5 Selling Items <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af' }}>({dateRange[0].format('DD MMM')} – {dateRange[1].format('DD MMM YYYY')})</span></span>}
            style={cardStyle} bodyStyle={cardBody}
          >
            {topItems.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topItems} layout="vertical" barCategoryGap="25%">
                  <defs>
                    <linearGradient id="gradTop" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f7971e" />
                      <stop offset="100%" stopColor="#ffd200" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip
                    formatter={(v) => [v + ' units', 'Qty Sold']}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                  />
                  <Bar dataKey="qty" name="Qty Sold" fill="url(#gradTop)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      {/* ── NEW CHARTS ROW 2: Stock by Category Donut ── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={10}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><PieChartOutlined style={{ color: '#764ba2' }} />Stock by Category</span>}
            style={cardStyle} bodyStyle={cardBody}
          >
            {categoryStock.length === 0 ? <EmptyChart height={300} /> : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <defs>
                    {DONUT_COLORS.map((c, i) => (
                      <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.7} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={categoryStock}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={110}
                    paddingAngle={3}
                    dataKey="qty"
                    nameKey="name"
                    label={false}
                  >
                    {categoryStock.map((_, i) => (
                      <Cell key={i} fill={`url(#pieGrad${i % DONUT_COLORS.length})`} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, name) => [v.toLocaleString() + ' units', name]}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title={<span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}><DatabaseOutlined style={{ color: '#11998e' }} />Category Stock Value</span>}
            style={cardStyle} bodyStyle={cardBody}
          >
            {categoryStock.length === 0 ? <EmptyChart height={300} /> : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={categoryStock} barCategoryGap="35%">
                  <defs>
                    {DONUT_COLORS.map((c, i) => (
                      <linearGradient key={i} id={`barCat${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c} stopOpacity={1} />
                        <stop offset="100%" stopColor={c} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => formatCurrency(v, true)} axisLine={false} tickLine={false} width={80} />
                  <Tooltip
                    formatter={(v) => [formatCurrency(v, true), 'Stock Value']}
                    contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
                  />
                  <Bar dataKey="value" name="Stock Value" radius={[8, 8, 0, 0]}>
                    {categoryStock.map((_, i) => (
                      <Cell key={i} fill={`url(#barCat${i % DONUT_COLORS.length})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
