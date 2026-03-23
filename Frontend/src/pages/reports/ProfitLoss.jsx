import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, DatePicker, Button, Table, message, Space } from 'antd';
import { DollarOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatNumber } from '../../utils/currency.js';

const ProfitLoss = () => {
  const { formatCurrency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [plData, setPLData] = useState({
    revenue: 0,
    cogs: 0,
    grossProfit: 0,
    netProfit: 0,
    purchases: 0,
    inventoryLosses: 0
  });
  const [salesDetails, setSalesDetails] = useState([]);

  const fetchPLData = async (startDate = null, endDate = null) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [plResponse, detailsResponse] = await Promise.all([
        apiService.get(`/profit-loss?${params}`),
        apiService.get(`/profit-loss/details?${params}`)
      ]);

      if (plResponse.success) setPLData(plResponse.data);
      if (detailsResponse.success) setSalesDetails(detailsResponse.data.sales);
    } catch (error) {
      message.error('Failed to fetch P&L data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartDateChange = (date) => {
    setStartDate(date);
    fetchPLData(date?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'));
  };

  const handleEndDateChange = (date) => {
    setEndDate(date);
    fetchPLData(startDate?.format('YYYY-MM-DD'), date?.format('YYYY-MM-DD'));
  };

  const columns = [
    { title: 'SO #', dataIndex: 'so_number', key: 'so_number', width: 110, ellipsis: true },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name', width: 130, ellipsis: true },
    { title: 'Item', dataIndex: 'item_name', key: 'item_name', width: 130, ellipsis: true },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 90, ellipsis: true },
    { title: 'Qty', dataIndex: 'quantity_shipped', key: 'quantity_shipped', width: 70, render: val => formatNumber(val) },
    { title: 'Unit Price', dataIndex: 'unit_price', key: 'unit_price', width: 100, render: val => formatCurrency(val) },
    { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', width: 100, render: val => formatCurrency(val) },
    { title: 'Cost', dataIndex: 'cost', key: 'cost', width: 100, render: val => formatCurrency(val) },
    { title: 'Profit', dataIndex: 'profit', key: 'profit', width: 100,
      render: val => <span style={{ color: val >= 0 ? '#52c41a' : '#ff4d4f' }}>{formatCurrency(val)}</span>
    },
    { title: 'Date', dataIndex: 'order_date', key: 'order_date', width: 100 }
  ];

  useEffect(() => {
    fetchPLData();
  }, []);

  const grossMargin = plData.revenue > 0 ? ((plData.grossProfit / plData.revenue) * 100) : 0;
  const netMargin = plData.revenue > 0 ? ((plData.netProfit / plData.revenue) * 100) : 0;

  return (
    <div style={{ padding: '16px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: 16 }}>Profit & Loss</h1>

      <Card style={{ marginBottom: 16 }}>
        <Space style={{ flexWrap: 'wrap' }}>
          <DatePicker onChange={handleStartDateChange} value={startDate} placeholder="Start Date" format="YYYY-MM-DD" />
          <DatePicker onChange={handleEndDateChange} value={endDate} placeholder="End Date" format="YYYY-MM-DD" />
          <Button onClick={() => fetchPLData()} loading={loading}>Refresh</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={5}>
          <Card>
            <Statistic title="Revenue" value={plData.revenue} formatter={value => formatCurrency(value)}
              prefix={<DollarOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5}>
          <Card>
            <Statistic title="COGS" value={plData.cogs} formatter={value => formatCurrency(value)}
              prefix={<FallOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={4}>
          <Card>
            <Statistic title="Inv. Losses" value={plData.inventoryLosses} formatter={value => formatCurrency(value)}
              prefix={<FallOutlined />} valueStyle={{ color: '#ff7875' }} />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={5}>
          <Card>
            <Statistic title="Gross Profit" value={plData.grossProfit} formatter={value => formatCurrency(value)}
              prefix={<RiseOutlined />} valueStyle={{ color: plData.grossProfit >= 0 ? '#52c41a' : '#ff4d4f' }} />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Margin: {formatNumber(grossMargin)}%</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={5}>
          <Card>
            <Statistic title="Net Profit" value={plData.netProfit} formatter={value => formatCurrency(value)}
              prefix={<RiseOutlined />} valueStyle={{ color: plData.netProfit >= 0 ? '#52c41a' : '#ff4d4f' }} />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Margin: {formatNumber(netMargin)}%</div>
          </Card>
        </Col>
      </Row>

      <Card title="Sales Details">
        <Table columns={columns} dataSource={salesDetails} loading={loading}
          rowKey={record => `${record.so_number}-${record.item_id}`}
          pagination={{ pageSize: 20, size: 'small' }}
          scroll={{ x: 'max-content' }} size="small"
        />
      </Card>
    </div>
  );
};

export default ProfitLoss;