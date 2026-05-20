import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, Button, Table, Tag, message, Modal, Input, DatePicker, Select, Tooltip } from 'antd';
import {
  FileTextOutlined, PlusOutlined, EyeOutlined, FilePdfOutlined,
  EditOutlined, PrinterOutlined, MailOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, ClockCircleOutlined, FormOutlined, FilterOutlined,
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import InvoiceForm from '../../components/forms/InvoiceForm';
import InvoicePdfViewModal from '../../components/business/InvoicePdfViewModal';
import InvoiceListStatCards, { aggregateInvoiceStatusBreakdown } from '../../components/business/InvoiceListStatCards';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatCommercialDocAmount } from '../../utils/currency';
import { assertPdfBlob, printPdfBlob } from '../../utils/printPdfBlob';

const STATUS_CONFIG = {
  draft:          { color: 'orange',  label: 'Draft' },
  posted:         { color: 'blue',    label: 'Posted' },
  partially_paid: { color: 'purple',  label: 'Partial' },
  paid:           { color: 'success', label: 'Paid' },
  cancelled:      { color: 'error',   label: 'Cancelled' },
};

const SalesInvoices = () => {
  const { formatCurrency } = useCurrency();
  const [invoices, setInvoices]                         = useState([]);
  const [statusBreakdown, setStatusBreakdown]           = useState([]);
  const [loading, setLoading]                           = useState(true);
  const [pagination, setPagination]                     = useState({ current: 1, pageSize: 10, total: 0 });
  const [modalVisible, setModalVisible]                 = useState(false);
  const [viewInvoiceId, setViewInvoiceId]               = useState(null);
  const [viewInvoiceNumber, setViewInvoiceNumber]       = useState('');
  const [emailModalVisible, setEmailModalVisible]       = useState(false);
  const [emailAddress, setEmailAddress]                 = useState('');
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId]       = useState(null);
  const [modalMode, setModalMode]                       = useState('create');
  const [searchText, setSearchText]                     = useState('');
  const [fromDate, setFromDate]                         = useState(null);
  const [toDate, setToDate]                             = useState(null);
  const [statusFilter, setStatusFilter]                 = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/sales-invoices', {
        params: { page: pagination.current, limit: pagination.pageSize }
      });
      if (response.success) {
        setInvoices(response.data?.invoices || []);
        setPagination(prev => ({ ...prev, total: response.data?.pagination?.total || 0 }));
      } else {
        message.error(response.error || 'Failed to fetch sales invoices');
      }
    } catch (e) {
      message.error('Error loading invoices');
    } finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const params = {};
      if (fromDate) params.dateFrom = fromDate.format('YYYY-MM-DD');
      if (toDate) params.dateTo = toDate.format('YYYY-MM-DD');
      const response = await apiService.get('/sales-invoices/analytics/summary', { params });
      if (response.success) {
        setStatusBreakdown(response.data?.statusBreakdown || []);
      }
    } catch {
      /* non-blocking */
    }
  }, [fromDate, toDate]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const handleViewInvoice = (record) => {
    setViewInvoiceId(record.id);
    setViewInvoiceNumber(record.invoice_number || '');
  };

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      setLoading(true);
      const response = await apiService.get(`/sales-invoices/${invoiceId}/pdf?download=true`, { responseType: 'blob' });
      await assertPdfBlob(response.data);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `SI_${invoiceNumber}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      message.success('PDF downloaded');
    } catch { message.error('Failed to download PDF'); }
    finally { setLoading(false); }
  };

  const handlePrintPDF = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await apiService.get(`/sales-invoices/${invoiceId}/pdf?download=true`, { responseType: 'blob' });
      await printPdfBlob(response.data);
    } catch (e) {
      message.error(
        e?.message === 'POPUP_BLOCKED'
          ? 'Allow pop-ups for this site to print'
          : e?.message || 'Failed to print PDF'
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePostInvoice = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await apiService.post(`/sales-invoices/${invoiceId}/post`);
      if (response.success) {
        message.success('Invoice posted successfully');
        fetchInvoices();
      } else {
        message.error(response.error || 'Failed to post invoice');
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to post invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) { message.warning('Please enter an email address'); return; }
    try {
      setLoading(true);
      const response = await apiService.post(`/sales-invoices/${selectedInvoiceForEmail.id}/email`, { email: emailAddress });
      if (response.success) { message.success(`Invoice sent to ${emailAddress}`); setEmailModalVisible(false); }
      else message.error(response.error || 'Failed to send email');
    } catch { message.error('Failed to send email'); }
    finally { setLoading(false); }
  };

  const filteredInvoices = invoices.filter(inv => {
    const textMatch   = !searchText    || inv.invoice_number?.toLowerCase().includes(searchText.toLowerCase()) || inv.customer_name?.toLowerCase().includes(searchText.toLowerCase());
    const statusMatch = !statusFilter  || inv.status === statusFilter;
    const dateMatch   = (!fromDate || !toDate) || (() => { const d = new Date(inv.invoice_date); return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate(); })();
    return textMatch && statusMatch && dateMatch;
  });

  const hasActiveFilters = Boolean(searchText || statusFilter || fromDate || toDate);

  const summary = useMemo(
    () => aggregateInvoiceStatusBreakdown(statusBreakdown),
    [statusBreakdown]
  );

  const filteredSummary = useMemo(() => {
    let total = 0;
    let balance = 0;
    for (const inv of filteredInvoices) {
      total += Number(inv.total_amount) || 0;
      balance += Number(inv.balance_amount) || 0;
    }
    return { count: filteredInvoices.length, total, balance };
  }, [filteredInvoices]);

  const statCards = useMemo(() => {
    const fmt = (n) => formatCurrency(n);
    const base = [
      {
        label: 'All Invoices',
        value: summary.totalCount,
        sub: 'Billed',
        subValue: fmt(summary.totalAmount),
        gradient: 'linear-gradient(135deg,#667eea,#764ba2)',
        shadow: 'rgba(102,126,234,0.35)',
        icon: <FileTextOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
      {
        label: 'Collected',
        value: summary.paidCount,
        sub: 'Received',
        subValue: fmt(summary.collectedAmount),
        gradient: 'linear-gradient(135deg,#11998e,#38ef7d)',
        shadow: 'rgba(17,153,142,0.35)',
        icon: <CheckCircleOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
      {
        label: 'Receivable',
        value: summary.outstandingCount,
        sub: 'Balance due',
        subValue: fmt(summary.outstandingBalance),
        gradient: 'linear-gradient(135deg,#f7971e,#ffd200)',
        shadow: 'rgba(247,151,30,0.35)',
        icon: <ClockCircleOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
    ];
    if (hasActiveFilters) {
      base.push({
        label: 'Matching filters',
        value: filteredSummary.count,
        sub: 'Amount in list',
        subValue: fmt(filteredSummary.total),
        hint: filteredSummary.balance > 0 ? `Due: ${fmt(filteredSummary.balance)}` : null,
        gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)',
        shadow: 'rgba(79,172,254,0.35)',
        icon: <FilterOutlined style={{ fontSize: 22, color: '#fff' }} />,
      });
    } else {
      base.push({
        label: 'Draft',
        value: summary.draftCount,
        sub: 'Not posted',
        subValue: fmt(summary.draftAmount),
        gradient: 'linear-gradient(135deg,#f093fb,#f5576c)',
        shadow: 'rgba(245,87,108,0.35)',
        icon: <FormOutlined style={{ fontSize: 22, color: '#fff' }} />,
      });
    }
    return base;
  }, [summary, filteredSummary, hasActiveFilters, formatCurrency]);

  const columns = [
    { title: 'Invoice #',    dataIndex: 'invoice_number', key: 'invoice_number', width: 130, ellipsis: true,
      render: v => <span style={{ fontWeight: 600, color: '#667eea' }}>{v}</span> },
    { title: 'Customer',     dataIndex: 'customer_name',  key: 'customer_name',  width: 140, ellipsis: true },
    { title: 'Invoice Date', dataIndex: 'invoice_date',   key: 'invoice_date',   width: 110, render: d => new Date(d).toLocaleDateString() },
    { title: 'Due Date',     dataIndex: 'due_date',       key: 'due_date',       width: 100, render: d => d ? new Date(d).toLocaleDateString() : '-', responsive: ['sm'] },
    { title: 'Amount',       dataIndex: 'total_amount',   key: 'total_amount',   width: 115,
      render: (v, record) => <span style={{ fontWeight: 600 }}>{formatCommercialDocAmount(v, record)}</span> },
    { title: 'Status',       dataIndex: 'status',         key: 'status',         width: 120,
      render: s => { const c = STATUS_CONFIG[s] || {}; return <Tag color={c.color || 'default'} style={{ fontWeight: 600 }}>{c.label || s?.toUpperCase()}</Tag>; }
    },
    { title: 'Actions', key: 'actions', width: 170,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 2 }}>
          {record.status === 'draft' && (
            <>
              <Tooltip title="Edit" key="Edit">
                <Button type="text" icon={<EditOutlined />}
                  onClick={() => { setSelectedInvoiceId(record.id); setModalMode('edit'); setModalVisible(true); }}
                  style={{ color: '#667eea', padding: '4px 6px' }} />
              </Tooltip>
              <Tooltip title="Post" key="Post">
                <Button type="text" icon={<CheckCircleOutlined />}
                  onClick={() => handlePostInvoice(record.id)}
                  style={{ color: '#52c41a', padding: '4px 6px' }} />
              </Tooltip>
            </>
          )}
          {[
            { icon: <EyeOutlined />,      title: 'View',     color: '#11998e', onClick: () => handleViewInvoice(record) },
            { icon: <MailOutlined />,     title: 'Email',    color: '#f7971e', onClick: () => { setSelectedInvoiceForEmail(record); setEmailAddress(''); setEmailModalVisible(true); } },
            { icon: <PrinterOutlined />,  title: 'Print',    color: '#764ba2', onClick: () => handlePrintPDF(record.id) },
            { icon: <FilePdfOutlined />,  title: 'Download', color: '#f5576c', onClick: () => handleDownloadPDF(record.id, record.invoice_number) },
          ].map(btn => (
            <Tooltip title={btn.title} key={btn.title}>
              <Button type="text" icon={btn.icon} onClick={btn.onClick}
                style={{ color: btn.color, padding: '4px 6px' }} />
            </Tooltip>
          ))}
        </div>
      )
    },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
        <h1 style={{ fontSize: 'clamp(18px,4vw,26px)', fontWeight: 700, margin: 0, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileTextOutlined style={{ fontSize: 22, color: '#667eea' }} /> Sales Invoices
          </h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Manage and track all customer invoices</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large"
          onClick={() => { setSelectedInvoiceId(null); setModalMode('create'); setModalVisible(true); }}
          style={{ borderRadius: 10, height: 42, fontWeight: 600 }}>
          Create Invoice
        </Button>
      </div>

      <InvoiceListStatCards cards={statCards} />

      {/* Filter + Table */}
      <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Input placeholder="Search invoice or customer..." prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={searchText} onChange={e => setSearchText(e.target.value)}
            style={{ width: 220, borderRadius: 8 }} allowClear />
          <DatePicker placeholder="From Date" value={fromDate} onChange={setFromDate} style={{ width: 130, borderRadius: 8 }} allowClear />
          <DatePicker placeholder="To Date"   value={toDate}   onChange={setToDate}   style={{ width: 130, borderRadius: 8 }} allowClear />
          <Select placeholder="All Statuses" value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }} allowClear>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <Select.Option key={v} value={v}>{c.label}</Select.Option>)}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchInvoices(); fetchAnalytics(); }} loading={loading} style={{ borderRadius: 8 }}>Refresh</Button>
        </div>
        <Table columns={columns} dataSource={filteredInvoices} loading={loading}
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, size: 'small' }}
          onChange={p => setPagination({ current: p.current, pageSize: p.pageSize, total: p.total })}
          rowKey="id" scroll={{ x: 'max-content' }} size="small"
          rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : ''}
        />
      </Card>

      <InvoicePdfViewModal
        open={!!viewInvoiceId}
        onClose={() => setViewInvoiceId(null)}
        invoiceId={viewInvoiceId}
        apiBase="/sales-invoices"
        title={viewInvoiceNumber ? `Sales invoice ${viewInvoiceNumber}` : 'Sales invoice'}
      />

      {/* Create/Edit Modal */}
      <Modal title={<span style={{ fontWeight: 700 }}>{modalMode === 'create' ? <><PlusOutlined style={{ marginRight: 6 }} />Create</> : <><EditOutlined style={{ marginRight: 6 }} />Edit</>} Sales Invoice</span>}
        open={modalVisible} onCancel={() => setModalVisible(false)}
        width="min(1200px,96vw)" style={{ top: 16 }} footer={null} destroyOnClose>
        <InvoiceForm type="sales" invoiceId={selectedInvoiceId}
          onSave={() => { setModalVisible(false); fetchInvoices(); message.success(`Invoice ${modalMode === 'create' ? 'created' : 'updated'}`); }} />
      </Modal>

      {/* Email Modal */}
      <Modal title={<span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}><MailOutlined />Email Invoice</span>} open={emailModalVisible} onCancel={() => setEmailModalVisible(false)}
        onOk={handleSendEmail} okText="Send Email" confirmLoading={loading}
        okButtonProps={{ style: { background: 'linear-gradient(135deg,#667eea,#764ba2)', border: 'none', borderRadius: 8 } }}>
        <p>Send invoice <strong>{selectedInvoiceForEmail?.invoice_number}</strong> to:</p>
        <Input placeholder="Enter email address" value={emailAddress}
          onChange={e => setEmailAddress(e.target.value)} onPressEnter={handleSendEmail}
          prefix={<MailOutlined style={{ color: '#bbb' }} />} style={{ borderRadius: 8 }} />
      </Modal>
    </div>
  );
};

export default SalesInvoices;
