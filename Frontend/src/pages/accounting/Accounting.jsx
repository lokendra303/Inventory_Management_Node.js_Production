import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tabs, Button, Space, DatePicker,
  Typography, Tag, Alert, Spin, message, Modal, Descriptions
} from 'antd';
import {
  DollarOutlined, BankOutlined, FileTextOutlined, 
  RiseOutlined, FallOutlined, CalculatorOutlined, EyeOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatAmount } from '../../utils/numberFormat';

const { Title } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const Accounting = () => {
  const { currency } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({});
  const [trialBalance, setTrialBalance] = useState({ accounts: [], summary: {} });
  const [journalEntries, setJournalEntries] = useState([]);
  const [payables, setPayables] = useState({ bills: [], vendors: [], summary: {} });
  const [receivables, setReceivables] = useState({ invoices: [], summary: {} });
  const [payments, setPayments] = useState({ payments: [], summary: {} });
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [dateRange, setDateRange] = useState(null);
  const [viewingEntry, setViewingEntry] = useState(null);
  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [entryDetails, setEntryDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [usersCache, setUsersCache] = useState(null); // Cache for users list

  const fetchSummary = async () => {
    try {
      const response = await apiService.get('/accounting/summary');
      if (response.success) {
        // Calculate proper profit (revenue - expenses)
        const profit = (response.data.totalRevenue || 0) - (response.data.totalExpense || 0);
        setSummary({
          ...response.data,
          netProfit: profit
        });
      } else {
        console.error('Summary API error:', response.error);
        message.error('Failed to fetch accounting summary');
      }
    } catch (error) {
      console.error('Summary fetch error:', error);
      message.error('Failed to fetch accounting summary');
    }
  };

  const fetchTrialBalance = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }
      const response = await apiService.get('/accounting/trial-balance', { params });
      if (response.success) {
        setTrialBalance(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch trial balance');
    } finally {
      setLoading(false);
    }
  };

  const fetchJournalEntries = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 }; // Increased limit
      if (dateRange) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }
      const response = await apiService.get('/accounting/journal-entries', { params });
      if (response.success) {
        console.log('Journal entries:', response.data); // Debug log
        setJournalEntries(response.data.entries || []);
      } else {
        console.error('Journal entries error:', response.error);
        message.error('Failed to fetch journal entries');
      }
    } catch (error) {
      console.error('Journal entries fetch error:', error);
      message.error('Failed to fetch journal entries');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayables = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/accounting/payables');
      if (response.success) {
        setPayables(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch payables');
    } finally {
      setLoading(false);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = { limit: 50 };
      if (dateRange) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }
      const response = await apiService.get('/accounting/payments', { params });
      if (response.success) {
        setPayments(response.data);
      } else {
        console.error('Payments error:', response.error);
        message.error('Failed to fetch payments');
      }
    } catch (error) {
      console.error('Payments fetch error:', error);
      message.error('Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const fetchReceivables = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/accounting/receivables');
      if (response.success) {
        setReceivables(response.data);
      }
    } catch (error) {
      message.error('Failed to fetch receivables');
    } finally {
      setLoading(false);
    }
  };

  const fetchChartOfAccounts = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/accounting/chart-of-accounts');
      if (response.success) {
        setChartOfAccounts(response.data.accounts || []);
      }
    } catch (error) {
      message.error('Failed to fetch chart of accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchTrialBalance();
    fetchJournalEntries();
    fetchPayables();
    fetchReceivables();
    fetchPayments();
    fetchChartOfAccounts();
  }, []);

  const viewEntry = async (entry) => {
    setViewingEntry(entry);
    setEntryModalVisible(true);
    setDetailsLoading(true);
    setEntryDetails(null);

    try {
      // Fetch additional details based on entry type
      let additionalData = {};
      
      if (entry.entry_type === 'purchase_invoice' && entry.reference_id) {
        try {
          const invoiceResponse = await apiService.get(`/purchase-invoices/${entry.reference_id}`);
          if (invoiceResponse.success) {
            additionalData.invoice = invoiceResponse.data.invoice;
            additionalData.lines = invoiceResponse.data.lines;
            additionalData.payments = invoiceResponse.data.payments;
          }
        } catch (error) {
          console.log('Could not fetch invoice details:', error);
        }
      }

      if (entry.entry_type === 'sales_invoice' && entry.reference_id) {
        try {
          const invoiceResponse = await apiService.get(`/sales-invoices/${entry.reference_id}`);
          if (invoiceResponse.success) {
            additionalData.invoice = invoiceResponse.data.invoice;
            additionalData.lines = invoiceResponse.data.lines;
            additionalData.payments = invoiceResponse.data.payments;
          }
        } catch (error) {
          console.log('Could not fetch sales invoice details:', error);
        }
      }

      // Try to get user information
      if (entry.created_by) {
        try {
          console.log('Fetching user details for ID:', entry.created_by);
          
          let users = usersCache;
          if (!users) {
            // Fetch all users and cache them
            const usersResponse = await apiService.get('/users');
            console.log('Users API response:', usersResponse);
            if (usersResponse.success && usersResponse.data) {
              users = usersResponse.data;
              setUsersCache(users); // Cache for future use
            }
          }
          
          if (users) {
            const user = users.find(u => u.id === entry.created_by);
            if (user) {
              additionalData.createdByUser = user;
              console.log('Found user:', user);
            } else {
              console.log('User not found in users list');
              additionalData.createdByUser = {
                first_name: 'Unknown User',
                last_name: '',
                email: `ID: ${entry.created_by.substring(0, 8)}...`,
                role: 'User may have been deleted'
              };
            }
          }
        } catch (error) {
          console.log('Could not fetch user details:', error);
          // Set a fallback with the UUID
          additionalData.createdByUser = {
            first_name: 'Unknown User',
            last_name: '',
            email: `ID: ${entry.created_by.substring(0, 8)}...`,
            role: 'Error fetching user info'
          };
        }
      }

      setEntryDetails(additionalData);
    } catch (error) {
      console.error('Error fetching entry details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeEntryModal = () => {
    setEntryModalVisible(false);
    setViewingEntry(null);
    setEntryDetails(null);
    setDetailsLoading(false);
  };

  useEffect(() => {
    if (dateRange) {
      fetchTrialBalance();
      fetchJournalEntries();
      fetchPayments();
    }
  }, [dateRange]);

  const trialBalanceColumns = [
    { title: 'Account Code', dataIndex: 'account_code', key: 'account_code', width: 120 },
    { title: 'Account Name', dataIndex: 'account_name', key: 'account_name' },
    { 
      title: 'Type', 
      dataIndex: ['meta', 'type'], 
      key: 'type',
      width: 100,
      render: type => (
        <Tag color={
          type === 'asset' ? 'blue' : 
          type === 'liability' ? 'red' : 
          type === 'revenue' ? 'green' : 
          type === 'expense' ? 'orange' : 'default'
        }>
          {type?.toUpperCase()}
        </Tag>
      )
    },
    { 
      title: 'Debits', 
      dataIndex: 'total_debits', 
      key: 'total_debits',
      width: 120,
      align: 'right',
      render: v => `${currency} ${formatAmount(v)}` 
    },
    { 
      title: 'Credits', 
      dataIndex: 'total_credits', 
      key: 'total_credits',
      width: 120,
      align: 'right',
      render: v => `${currency} ${formatAmount(v)}` 
    },
    { 
      title: 'Balance', 
      dataIndex: 'balance', 
      key: 'balance',
      width: 120,
      align: 'right',
      render: v => (
        <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {currency} {formatAmount(Math.abs(v))} {v < 0 ? 'Cr' : 'Dr'}
        </span>
      )
    },
  ];

  const journalColumns = [
    { 
      title: 'Date', 
      dataIndex: 'entry_date', 
      key: 'entry_date', 
      width: 100, 
      render: d => d ? new Date(d).toLocaleDateString() : '-'
    },
    { 
      title: 'Type', 
      dataIndex: 'entry_type', 
      key: 'entry_type', 
      width: 120,
      render: type => (
        <Tag color="purple" style={{ fontSize: 11 }}>
          {type?.replace(/_/g, ' ').toUpperCase() || '-'}
        </Tag>
      )
    },
    { 
      title: 'Reference', 
      dataIndex: 'reference_number', 
      key: 'reference_number', 
      width: 120,
      render: ref => ref ? <Tag color="green">{ref}</Tag> : '-'
    },
    { 
      title: 'Account', 
      key: 'account_info',
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.account_name}</div>
          <div style={{ fontSize: 11, color: '#666' }}>({record.account_code})</div>
        </div>
      )
    },
    { title: 'Description', dataIndex: 'description', key: 'description', ellipsis: true },
    { 
      title: 'Debit', 
      dataIndex: 'debit_amount', 
      key: 'debit_amount',
      width: 100,
      align: 'right',
      render: v => v > 0 ? (
        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
          {currency} {formatAmount(v)}
        </span>
      ) : '-'
    },
    { 
      title: 'Credit', 
      dataIndex: 'credit_amount', 
      key: 'credit_amount',
      width: 100,
      align: 'right',
      render: v => v > 0 ? (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
          {currency} {formatAmount(v)}
        </span>
      ) : '-'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button 
          size="small" 
          icon={<EyeOutlined />} 
          onClick={() => viewEntry(record)}
          title="View Complete Details"
        />
      ),
    },
  ];

  const payablesColumns = [
    { title: 'Bill #', dataIndex: 'invoice_number', key: 'invoice_number', width: 120 },
    { title: 'Vendor', dataIndex: 'vendor_name', key: 'vendor_name' },
    { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', width: 100, render: d => new Date(d).toLocaleDateString() },
    { title: 'Due Date', dataIndex: 'due_date', key: 'due_date', width: 100, render: d => new Date(d).toLocaleDateString() },
    { 
      title: 'Amount Due', 
      dataIndex: 'balance_amount', 
      key: 'balance_amount',
      width: 120,
      align: 'right',
      render: v => `${currency} ${formatAmount(v)}` 
    },
    { 
      title: 'Status', 
      dataIndex: 'days_overdue', 
      key: 'days_overdue',
      width: 100,
      render: days => (
        <Tag color={days > 0 ? 'red' : 'green'}>
          {days > 0 ? `${days} days overdue` : 'Current'}
        </Tag>
      )
    },
  ];

  const receivablesColumns = [
    { title: 'Invoice #', dataIndex: 'invoice_number', key: 'invoice_number', width: 120 },
    { title: 'Customer', dataIndex: 'customer_name', key: 'customer_name' },
    { title: 'Date', dataIndex: 'invoice_date', key: 'invoice_date', width: 100, render: d => new Date(d).toLocaleDateString() },
    { title: 'Due Date', dataIndex: 'due_date', key: 'due_date', width: 100, render: d => new Date(d).toLocaleDateString() },
    { 
      title: 'Amount Due', 
      dataIndex: 'balance_amount', 
      key: 'balance_amount',
      width: 120,
      align: 'right',
      render: v => `${currency} ${formatAmount(v)}` 
    },
    { 
      title: 'Status', 
      dataIndex: 'days_overdue', 
      key: 'days_overdue',
      width: 100,
      render: days => (
        <Tag color={days > 0 ? 'red' : 'green'}>
          {days > 0 ? `${days} days overdue` : 'Current'}
        </Tag>
      )
    },
  ];

  const paymentsColumns = [
    { 
      title: 'Payment Date', 
      dataIndex: 'payment_date', 
      key: 'payment_date', 
      width: 120, 
      render: d => d ? new Date(d).toLocaleDateString() : '-'
    },
    { 
      title: 'Type', 
      dataIndex: 'invoice_type', 
      key: 'invoice_type', 
      width: 100,
      render: type => (
        <Tag color={type === 'purchase' ? 'red' : 'green'}>
          {type === 'purchase' ? 'BILL' : 'INVOICE'}
        </Tag>
      )
    },
    { title: 'Bill/Invoice #', dataIndex: 'invoice_number', key: 'invoice_number', width: 140 },
    { title: 'Vendor/Customer', dataIndex: 'party_name', key: 'party_name' },
    { 
      title: 'Amount', 
      dataIndex: 'amount', 
      key: 'amount',
      width: 120,
      align: 'right',
      render: v => (
        <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
          {currency} {formatAmount(v)}
        </span>
      )
    },
    { title: 'Method', dataIndex: 'payment_method', key: 'payment_method', width: 100 },
    { 
      title: 'Made By', 
      key: 'made_by', 
      width: 150,
      render: (_, record) => {
        if (record.first_name || record.last_name) {
          return (
            <div>
              <div style={{ fontWeight: 500 }}>
                {record.first_name} {record.last_name}
              </div>
              {record.user_email && (
                <div style={{ fontSize: 11, color: '#666' }}>
                  {record.user_email}
                </div>
              )}
            </div>
          );
        }
        return <span style={{ color: '#999' }}>Unknown User</span>;
      }
    },
    { title: 'Reference', dataIndex: 'reference', key: 'reference', width: 120 },
    { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true },
  ];

  const chartColumns = [
    { title: 'Code', dataIndex: 'code', key: 'code', width: 120 },
    { title: 'Account Name', dataIndex: 'name', key: 'name' },
    { 
      title: 'Type', 
      dataIndex: 'type', 
      key: 'type',
      width: 100,
      render: type => (
        <Tag color={
          type === 'asset' ? 'blue' : 
          type === 'liability' ? 'red' : 
          type === 'revenue' ? 'green' : 
          type === 'expense' ? 'orange' : 'default'
        }>
          {type?.toUpperCase()}
        </Tag>
      )
    },
    { title: 'Group', dataIndex: 'group', key: 'group', width: 150 },
    { 
      title: 'Balance', 
      dataIndex: 'balance', 
      key: 'balance',
      width: 120,
      align: 'right',
      render: v => (
        <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {currency} {formatAmount(Math.abs(v || 0))} {v < 0 ? 'Cr' : 'Dr'}
        </span>
      )
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      <Title level={4} style={{ marginBottom: 16 }}>Accounting Dashboard</Title>

      <Alert
        message="Feature Under Development"
        description="The Accounting module is currently under development. Data shown may be incomplete or inaccurate. Full accounting features will be available soon."
        type="warning"
        showIcon
        banner
        style={{ marginBottom: 24 }}
      />

      {/* Summary Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Payable"
              value={summary.totalPayable || 0}
              prefix={<DollarOutlined />}
              formatter={value => `${currency} ${formatAmount(value)}`}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Money we owe to vendors
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Receivable"
              value={summary.totalReceivable || 0}
              prefix={<BankOutlined />}
              formatter={value => `${currency} ${formatAmount(value)}`}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Money customers owe us
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={summary.totalRevenue || 0}
              prefix={<RiseOutlined />}
              formatter={value => `${currency} ${formatAmount(value)}`}
              valueStyle={{ color: '#1890ff' }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Total sales income
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Net Profit"
              value={summary.netProfit || 0}
              prefix={<CalculatorOutlined />}
              formatter={value => `${currency} ${formatAmount(value)}`}
              valueStyle={{ color: (summary.netProfit || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Revenue - Expenses
            </div>
          </Card>
        </Col>
      </Row>

      {/* Debug Information */}
      {process.env.NODE_ENV === 'development' && (
        <Card style={{ marginBottom: 16, backgroundColor: '#f6f6f6' }}>
          <Title level={5}>Debug Info (Development Only)</Title>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="Journal Entries Count" value={journalEntries.length} />
            </Col>
            <Col span={6}>
              <Statistic title="Trial Balance Accounts" value={trialBalance.accounts?.length || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="Payable Bills" value={payables.bills?.length || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="Receivable Invoices" value={receivables.invoices?.length || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="Total Payments" value={payments.payments?.length || 0} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Date Range Filter */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <RangePicker 
            value={dateRange} 
            onChange={setDateRange}
            placeholder={['From Date', 'To Date']}
            allowClear
          />
          <Button onClick={() => setDateRange(null)}>Clear Filter</Button>
        </Space>
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultActiveKey="trial-balance">
        <TabPane tab="Trial Balance" key="trial-balance">
          <Card>
            {trialBalance.summary?.isBalanced === false && (
              <Alert
                type="warning"
                message="Trial Balance is not balanced!"
                description={`Difference: ${currency} ${formatAmount(trialBalance.summary.difference || 0)}`}
                style={{ marginBottom: 16 }}
                showIcon
              />
            )}
            <div style={{ marginBottom: 16 }}>
              <Space>
                <Statistic 
                  title="Total Debits" 
                  value={trialBalance.summary?.totalDebits || 0}
                  formatter={value => `${currency} ${formatAmount(value)}`}
                  size="small"
                />
                <Statistic 
                  title="Total Credits" 
                  value={trialBalance.summary?.totalCredits || 0}
                  formatter={value => `${currency} ${formatAmount(value)}`}
                  size="small"
                />
              </Space>
            </div>
            <Table
              columns={trialBalanceColumns}
              dataSource={trialBalance.accounts || []}
              rowKey="account_code"
              loading={loading}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Journal Entries" key="journal-entries">
          <Card>
            <Table
              columns={journalColumns}
              dataSource={journalEntries}
              rowKey="id"
              loading={loading}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Accounts Payable" key="payables">
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title="Total Payable" 
                    value={payables.summary?.totalPayable || 0}
                    formatter={value => `${currency} ${formatAmount(value)}`}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Overdue Amount" 
                    value={payables.summary?.overdueTotal || 0}
                    formatter={value => `${currency} ${formatAmount(value)}`}
                    valueStyle={{ color: '#ff7875' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="Total Bills" value={payables.summary?.totalBills || 0} />
                </Col>
                <Col span={6}>
                  <Statistic title="Overdue Bills" value={payables.summary?.overdueBills || 0} />
                </Col>
              </Row>
            </div>
            <Table
              columns={payablesColumns}
              dataSource={payables.bills || []}
              rowKey="id"
              loading={loading}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Accounts Receivable" key="receivables">
          <Card>
            <div style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title="Total Receivable" 
                    value={receivables.summary?.totalReceivable || 0}
                    formatter={value => `${currency} ${formatAmount(value)}`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Overdue Amount" 
                    value={receivables.summary?.overdueTotal || 0}
                    formatter={value => `${currency} ${formatAmount(value)}`}
                    valueStyle={{ color: '#ff7875' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic title="Total Invoices" value={receivables.summary?.totalInvoices || 0} />
                </Col>
                <Col span={6}>
                  <Statistic title="Overdue Invoices" value={receivables.summary?.overdueInvoices || 0} />
                </Col>
              </Row>
            </div>
            <Table
              columns={receivablesColumns}
              dataSource={receivables.invoices || []}
              rowKey="id"
              loading={loading}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="Chart of Accounts" key="chart-of-accounts">
          <Card>
            <Table
              columns={chartColumns}
              dataSource={chartOfAccounts}
              rowKey="code"
              loading={loading}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>

        <TabPane tab="All Payments" key="payments">
          <Card>
            <div style={{ marginBottom: 16, padding: '12px', backgroundColor: '#f6ffed', borderRadius: '6px', border: '1px solid #b7eb8f' }}>
              <span style={{ color: '#52c41a', fontWeight: 500 }}>📋 All Payment Types</span>
              <span style={{ color: '#666', marginLeft: 8 }}>This shows both payments made to vendors (bills) and payments received from customers (invoices).</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic 
                    title="Purchase Payments" 
                    value={payments.summary?.totalPurchasePayments || 0}
                    formatter={value => `${currency} ${formatAmount(value)}`}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                  <div style={{ fontSize: 11, color: '#999' }}>Money paid to vendors</div>
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Sales Receipts" 
                    value={payments.summary?.totalSalesPayments || 0}
                    formatter={value => `${currency} ${formatAmount(value)}`}
                    valueStyle={{ color: '#52c41a' }}
                  />
                  <div style={{ fontSize: 11, color: '#999' }}>Money received from customers</div>
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Purchase Transactions" 
                    value={payments.summary?.purchasePaymentCount || 0}
                  />
                </Col>
                <Col span={6}>
                  <Statistic 
                    title="Sales Transactions" 
                    value={payments.summary?.salesPaymentCount || 0}
                  />
                </Col>
              </Row>
            </div>
            <Table
              columns={paymentsColumns}
              dataSource={payments.payments || []}
              rowKey="id"
              loading={loading}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </TabPane>
      </Tabs>

      {/* Journal Entry Details Modal */}
      <Modal
        title={`Journal Entry Details - ${viewingEntry?.reference_number || 'N/A'}`}
        open={entryModalVisible}
        onCancel={closeEntryModal}
        footer={[
          <Button key="close" onClick={closeEntryModal}>
            Close
          </Button>
        ]}
        width={900}
      >
        {viewingEntry && (
          <div>
            {detailsLoading && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin size="large" />
                <div style={{ marginTop: 8 }}>Loading detailed information...</div>
              </div>
            )}
            
            <Descriptions bordered column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Entry Date">
                {viewingEntry.entry_date ? new Date(viewingEntry.entry_date).toLocaleDateString() : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Entry Type">
                <Tag color="purple">{viewingEntry.entry_type?.replace(/_/g, ' ').toUpperCase() || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Reference Number" span={2}>
                <Tag color="green" style={{ fontSize: 14 }}>{viewingEntry.reference_number || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Account Code">
                <Tag color="orange">{viewingEntry.account_code}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Account Name">
                {viewingEntry.account_name}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {viewingEntry.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Debit Amount">
                <span style={{ 
                  color: viewingEntry.debit_amount > 0 ? '#52c41a' : '#999',
                  fontWeight: viewingEntry.debit_amount > 0 ? 'bold' : 'normal',
                  fontSize: '16px'
                }}>
                  {currency} {formatAmount(viewingEntry.debit_amount || 0)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Credit Amount">
                <span style={{ 
                  color: viewingEntry.credit_amount > 0 ? '#ff4d4f' : '#999',
                  fontWeight: viewingEntry.credit_amount > 0 ? 'bold' : 'normal',
                  fontSize: '16px'
                }}>
                  {currency} {formatAmount(viewingEntry.credit_amount || 0)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Created By">
                {detailsLoading ? (
                  <span style={{ color: '#999' }}>Loading user info...</span>
                ) : entryDetails?.createdByUser ? (
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      {entryDetails.createdByUser.first_name} {entryDetails.createdByUser.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      {entryDetails.createdByUser.email}
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      Role: {entryDetails.createdByUser.role}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: '#ff4d4f' }}>User information not available</div>
                    <div style={{ fontSize: 11, color: '#999' }}>
                      User ID: {viewingEntry.created_by?.substring(0, 8)}...
                    </div>
                    <div style={{ fontSize: 10, color: '#ccc' }}>
                      (User may have been deleted or endpoint not accessible)
                    </div>
                  </div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Created At">
                {viewingEntry.created_at ? new Date(viewingEntry.created_at).toLocaleString() : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Invoice Details */}
            {entryDetails?.invoice && (
              <Card title="Related Invoice Details" size="small" style={{ marginBottom: 16 }}>
                <Descriptions bordered column={3} size="small">
                  <Descriptions.Item label="Invoice Number">
                    <Tag color="blue">{entryDetails.invoice.invoice_number}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Vendor/Customer">
                    <strong>{entryDetails.invoice.vendor_name || entryDetails.invoice.customer_name}</strong>
                  </Descriptions.Item>
                  <Descriptions.Item label="Invoice Date">
                    {entryDetails.invoice.invoice_date ? new Date(entryDetails.invoice.invoice_date).toLocaleDateString() : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Due Date">
                    {entryDetails.invoice.due_date ? new Date(entryDetails.invoice.due_date).toLocaleDateString() : '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Total Amount">
                    <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                      {currency} {formatAmount(entryDetails.invoice.total_amount || 0)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color={
                      entryDetails.invoice.status === 'paid' ? 'green' :
                      entryDetails.invoice.status === 'posted' ? 'blue' :
                      entryDetails.invoice.status === 'partially_paid' ? 'orange' : 'default'
                    }>
                      {entryDetails.invoice.status?.replace(/_/g, ' ').toUpperCase()}
                    </Tag>
                  </Descriptions.Item>
                  {entryDetails.invoice.reference && (
                    <Descriptions.Item label="Reference" span={3}>
                      {entryDetails.invoice.reference}
                    </Descriptions.Item>
                  )}
                  {entryDetails.invoice.notes && (
                    <Descriptions.Item label="Notes" span={3}>
                      {entryDetails.invoice.notes}
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {/* Invoice Line Items */}
                {entryDetails.lines && entryDetails.lines.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <Title level={5}>Line Items</Title>
                    <Table
                      dataSource={entryDetails.lines}
                      rowKey="id"
                      size="small"
                      pagination={false}
                      columns={[
                        { title: 'Item', dataIndex: 'item_name', key: 'item_name' },
                        { title: 'Quantity', dataIndex: 'quantity', key: 'quantity', width: 80, align: 'right' },
                        { 
                          title: 'Unit Cost', 
                          dataIndex: 'unit_cost', 
                          key: 'unit_cost', 
                          width: 100, 
                          align: 'right',
                          render: v => `${currency} ${formatAmount(v || 0)}`
                        },
                        { 
                          title: 'Line Total', 
                          dataIndex: 'line_total', 
                          key: 'line_total', 
                          width: 120, 
                          align: 'right',
                          render: v => (
                            <span style={{ fontWeight: 'bold' }}>
                              {currency} {formatAmount(v || 0)}
                            </span>
                          )
                        },
                      ]}
                    />
                  </div>
                )}
              </Card>
            )}

            {/* Account Metadata */}
            {viewingEntry.account_meta && (
              <Card title="Account Information" size="small" style={{ marginBottom: 16 }}>
                <Descriptions bordered column={3} size="small">
                  <Descriptions.Item label="Account Type">
                    <Tag color={
                      viewingEntry.account_meta.type === 'asset' ? 'blue' : 
                      viewingEntry.account_meta.type === 'liability' ? 'red' : 
                      viewingEntry.account_meta.type === 'revenue' ? 'green' : 
                      viewingEntry.account_meta.type === 'expense' ? 'orange' : 'default'
                    }>
                      {viewingEntry.account_meta.type?.toUpperCase()}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Account Group">
                    {viewingEntry.account_meta.group}
                  </Descriptions.Item>
                  <Descriptions.Item label="Account Name">
                    {viewingEntry.account_meta.name}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {/* Accounting Explanation */}
            <Card title="Accounting Entry Explanation" size="small" style={{ marginBottom: 16 }}>
              <Alert
                type="info"
                showIcon
                message="Double-Entry Bookkeeping"
                description={
                  <div>
                    {viewingEntry.entry_type === 'purchase_invoice' && (
                      <div>
                        <p><strong>Purchase Invoice Entry:</strong></p>
                        <p>• <strong>Debit:</strong> Purchase Expense/Inventory ({currency} {formatAmount(entryDetails?.invoice?.subtotal || 0)}) - Increases expenses/assets</p>
                        <p>• <strong>Credit:</strong> Accounts Payable ({currency} {formatAmount(viewingEntry.credit_amount || 0)}) - Increases liability (money we owe)</p>
                        <p>This entry records that we received goods/services worth {currency} {formatAmount(viewingEntry.credit_amount || 0)} and now owe this amount to the vendor.</p>
                      </div>
                    )}
                    {viewingEntry.entry_type === 'sales_invoice' && (
                      <div>
                        <p><strong>Sales Invoice Entry:</strong></p>
                        <p>• <strong>Debit:</strong> Accounts Receivable ({currency} {formatAmount(viewingEntry.debit_amount || 0)}) - Increases assets (money customers owe us)</p>
                        <p>• <strong>Credit:</strong> Sales Revenue ({currency} {formatAmount(viewingEntry.credit_amount || 0)}) - Increases revenue</p>
                        <p>This entry records that we sold goods/services and the customer owes us money.</p>
                      </div>
                    )}
                    {!['purchase_invoice', 'sales_invoice'].includes(viewingEntry.entry_type) && (
                      <div>
                        <p>This is a {viewingEntry.entry_type?.replace(/_/g, ' ')} entry.</p>
                        <p>• <strong>Debit:</strong> {currency} {formatAmount(viewingEntry.debit_amount || 0)}</p>
                        <p>• <strong>Credit:</strong> {currency} {formatAmount(viewingEntry.credit_amount || 0)}</p>
                      </div>
                    )}
                  </div>
                }
              />
            </Card>

            {/* Raw Data for Debugging */}
            <Card title="Technical Details (Debug)" size="small">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Entry ID">
                  <code style={{ fontSize: 11 }}>{viewingEntry.id}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Reference ID">
                  <code style={{ fontSize: 11 }}>{viewingEntry.reference_id || '-'}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Institution ID">
                  <code style={{ fontSize: 11 }}>{viewingEntry.institution_id || '-'}</code>
                </Descriptions.Item>
                <Descriptions.Item label="Created By ID">
                  <code style={{ fontSize: 11 }}>{viewingEntry.created_by || '-'}</code>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Accounting;