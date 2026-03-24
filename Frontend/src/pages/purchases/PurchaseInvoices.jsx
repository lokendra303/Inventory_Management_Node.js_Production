import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Table, Tag, message, Modal, Input, DatePicker, Select, Row, Col, Tooltip } from 'antd';
import {
  ContainerOutlined, PlusOutlined, EyeOutlined, FilePdfOutlined,
  EditOutlined, PrinterOutlined, MailOutlined, SearchOutlined, ReloadOutlined
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import InvoiceForm from '../../components/forms/InvoiceForm';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatQuantity, formatAmount } from '../../utils/numberFormat';

const STATUS_CONFIG = {
  draft:          { color: 'orange',  label: 'Draft' },
  posted:         { color: 'blue',    label: 'Posted' },
  partially_paid: { color: 'purple',  label: 'Partial' },
  paid:           { color: 'success', label: 'Paid' },
  cancelled:      { color: 'error',   label: 'Cancelled' },
};

const PurchaseInvoices = () => {
  const { formatCurrency } = useCurrency();
  const [invoices, setInvoices]                               = useState([]);
  const [loading, setLoading]                                 = useState(true);
  const [pagination, setPagination]                           = useState({ current: 1, pageSize: 10, total: 0 });
  const [modalVisible, setModalVisible]                       = useState(false);
  const [emailModalVisible, setEmailModalVisible]             = useState(false);
  const [emailAddress, setEmailAddress]                       = useState('');
  const [selectedInvoiceForEmail, setSelectedInvoiceForEmail] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId]             = useState(null);
  const [modalMode, setModalMode]                             = useState('create');
  const [searchText, setSearchText]                           = useState('');
  const [fromDate, setFromDate]                               = useState(null);
  const [toDate, setToDate]                                   = useState(null);
  const [statusFilter, setStatusFilter]                       = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/purchase-invoices', {
        params: { page: pagination.current, limit: pagination.pageSize }, timeout: 10000
      });
      if (response.success) {
        setInvoices(response.data?.invoices || []);
        setPagination(prev => ({ ...prev, total: response.data?.pagination?.total || 0 }));
      } else {
        message.error(response.error || 'Failed to fetch purchase invoices');
        setInvoices([]);
      }
    } catch (e) {
      if (e.code === 'ECONNABORTED') message.error('Request timeout');
      else message.error('Error loading invoices: ' + (e.message || 'Unknown error'));
      setInvoices([]);
    } finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleViewStandardFormat = async (invoiceId) => {
    try {
      setLoading(true);
      const [invoiceResponse, settingsResponse] = await Promise.all([
        apiService.get(`/purchase-invoices/${invoiceId}/standard-format`),
        apiService.get('/company-settings')
      ]);
      if (invoiceResponse.success) {
        const data = invoiceResponse.data;
        const settings = settingsResponse.data || {};
        const companyName  = settings.company_name || data.header.companyName;
        const address      = settings.address || `${data.header.address.line1}, ${data.header.address.city}, ${data.header.address.state}`;
        const phone        = settings.phone || data.header.contact.phone;
        const email        = settings.email || data.header.contact.email;
        const logoUrl      = settings.logo_path      ? `http://localhost:5000${settings.logo_path}`      : data.header.branding?.logoUrl;
        const stampUrl     = settings.stamp_path     ? `http://localhost:5000${settings.stamp_path}`     : data.header.branding?.stampUrl;
        const signatureUrl = settings.signature_path ? `http://localhost:5000${settings.signature_path}` : data.header.branding?.signatureUrl;
        Modal.info({
          title: 'Invoice Preview', width: 900,
          content: (
            <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
                <div>{logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: '60px', marginBottom: '10px' }} />}</div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0 }}>{companyName}</h2>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>{address}<br />{phone} | {email}</p>
                  {data.header.taxInfo.taxId && <p style={{ margin: '5px 0', fontSize: '11px' }}>Tax ID: {data.header.taxInfo.taxId}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div>
                  <h4 style={{ margin: '0 0 10px 0' }}>Vendor Details</h4>
                  <p style={{ margin: '3px 0', fontSize: '13px' }}><strong>{data.partyDetails.name}</strong></p>
                  <p style={{ margin: '3px 0', fontSize: '13px' }}>{data.partyDetails.billingAddress.line1}</p>
                  <p style={{ margin: '3px 0', fontSize: '13px' }}>{data.partyDetails.billingAddress.city}, {data.partyDetails.billingAddress.state}</p>
                  <p style={{ margin: '3px 0', fontSize: '13px' }}>{data.partyDetails.contact.phone}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>PURCHASE INVOICE</h3>
                  <p style={{ margin: '3px 0', fontSize: '13px' }}><strong>Invoice #:</strong> {data.details.invoiceNumber}</p>
                  <p style={{ margin: '3px 0', fontSize: '13px' }}><strong>Date:</strong> {new Date(data.details.invoiceDate).toLocaleDateString()}</p>
                  <p style={{ margin: '3px 0', fontSize: '13px' }}><strong>Due Date:</strong> {new Date(data.details.dueDate).toLocaleDateString()}</p>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    {['#','Item','Qty','Rate','Amount'].map(h => <th key={h} style={{ border: '1px solid #ddd', padding: '8px', textAlign: h === '#' || h === 'Item' ? 'left' : 'right' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.lineItems.map(item => (
                    <tr key={item.sno}>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.sno}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.itemName}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatQuantity(item.quantity)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatAmount(item.unitAmount)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{formatAmount(item.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Subtotal:</strong> {data.details.currency} {formatAmount(data.totals.subtotal)}</p>
                <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Tax:</strong> {data.details.currency} {formatAmount(data.totals.totalTaxAmount)}</p>
                <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Discount:</strong> {data.details.currency} {formatAmount(data.totals.totalDiscountAmount)}</p>
                <h3 style={{ margin: '10px 0', fontSize: '16px' }}><strong>Grand Total:</strong> {data.details.currency} {formatAmount(data.totals.grandTotal)}</h3>
                <p style={{ margin: '5px 0', fontSize: '12px', fontStyle: 'italic' }}>Amount in words: {data.totals.amountInWords}</p>
              </div>
              {(data.partyDetails.bankDetails?.bankName || data.partyDetails.bankDetails?.accountNumber) && (
                <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Vendor Bank Details</h4>
                  {data.partyDetails.bankDetails.bankName      && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>Bank:</strong> {data.partyDetails.bankDetails.bankName}</p>}
                  {data.partyDetails.bankDetails.accountNumber && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>Account:</strong> {data.partyDetails.bankDetails.accountNumber}</p>}
                  {data.partyDetails.bankDetails.ifscCode      && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>IFSC:</strong> {data.partyDetails.bankDetails.ifscCode}</p>}
                </div>
              )}
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                {stampUrl && <img src={stampUrl} alt="Stamp" style={{ maxHeight: '80px' }} />}
                <div style={{ textAlign: 'right' }}>
                  {signatureUrl && <img src={signatureUrl} alt="Signature" style={{ maxHeight: '60px', marginBottom: '5px' }} />}
                  <p style={{ margin: '5px 0', fontSize: '12px', borderTop: '1px solid #333', paddingTop: '5px', textAlign: 'left' }}>
                    <strong>Name:</strong> {settings.authorized_signatory_name || 'N/A'}<br />
                    <strong>Designation:</strong> {settings.authorized_signatory_designation || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )
        });
      }
    } catch { message.error('Failed to generate standard format'); }
    finally { setLoading(false); }
  };

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      setLoading(true);
      const response = await apiService.get(`/purchase-invoices/${invoiceId}/pdf?download=true`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', `PI_${invoiceNumber}.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      window.URL.revokeObjectURL(url);
      message.success('PDF downloaded');
    } catch { message.error('Failed to download PDF'); }
    finally { setLoading(false); }
  };

  const handlePrintPDF = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await apiService.get(`/purchase-invoices/${invoiceId}/pdf?download=true`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const w = window.open(blobUrl, '_blank');
      if (!w) { message.error('Allow pop-ups to print'); URL.revokeObjectURL(blobUrl); return; }
      w.onload = () => { w.focus(); setTimeout(() => w.print(), 250); };
    } catch { message.error('Failed to print PDF'); }
    finally { setLoading(false); }
  };

  const handleSendEmail = async () => {
    if (!emailAddress) { message.warning('Please enter an email address'); return; }
    try {
      setLoading(true);
      const response = await apiService.post(`/purchase-invoices/${selectedInvoiceForEmail.id}/email`, { email: emailAddress });
      if (response.success) { message.success(`Invoice sent to ${emailAddress}`); setEmailModalVisible(false); }
      else message.error(response.error || 'Failed to send email');
    } catch { message.error('Failed to send email'); }
    finally { setLoading(false); }
  };

  const filteredInvoices = invoices.filter(inv => {
    const textMatch   = !searchText   || inv.invoice_number?.toLowerCase().includes(searchText.toLowerCase()) || inv.vendor_name?.toLowerCase().includes(searchText.toLowerCase());
    const statusMatch = !statusFilter || inv.status === statusFilter;
    const dateMatch   = (!fromDate || !toDate) || (() => { const d = new Date(inv.invoice_date); return d >= fromDate.startOf('day').toDate() && d <= toDate.endOf('day').toDate(); })();
    return textMatch && statusMatch && dateMatch;
  });

  const paidCount    = invoices.filter(i => i.status === 'paid').length;
  const pendingCount = invoices.filter(i => ['draft','posted','partially_paid'].includes(i.status)).length;

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoice_number', key: 'invoice_number', width: 130, ellipsis: true,
      render: v => <span style={{ fontWeight: 600, color: '#667eea' }}>{v}</span> },
    { title: 'Vendor',       dataIndex: 'vendor_name',   key: 'vendor_name',   width: 140, ellipsis: true },
    { title: 'Invoice Date', dataIndex: 'invoice_date',  key: 'invoice_date',  width: 110, render: d => new Date(d).toLocaleDateString() },
    { title: 'Due Date',     dataIndex: 'due_date',      key: 'due_date',      width: 100, render: d => d ? new Date(d).toLocaleDateString() : '-', responsive: ['sm'] },
    { title: 'Amount',       dataIndex: 'total_amount',  key: 'total_amount',  width: 115, render: v => <span style={{ fontWeight: 600 }}>{formatCurrency(v)}</span> },
    { title: 'Status',       dataIndex: 'status',        key: 'status',        width: 120,
      render: s => { const c = STATUS_CONFIG[s] || {}; return <Tag color={c.color || 'default'} style={{ fontWeight: 600 }}>{c.label || s?.toUpperCase()}</Tag>; }
    },
    { title: 'Actions', key: 'actions', width: 170,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 2 }}>
          {[
            { icon: <EditOutlined />,    title: 'Edit',     color: '#667eea', onClick: () => { setSelectedInvoiceId(record.id); setModalMode('edit'); setModalVisible(true); } },
            { icon: <EyeOutlined />,     title: 'View',     color: '#11998e', onClick: () => handleViewStandardFormat(record.id) },
            { icon: <MailOutlined />,    title: 'Email',    color: '#f7971e', onClick: () => { setSelectedInvoiceForEmail(record); setEmailAddress(''); setEmailModalVisible(true); } },
            { icon: <PrinterOutlined />, title: 'Print',    color: '#764ba2', onClick: () => handlePrintPDF(record.id) },
            { icon: <FilePdfOutlined />, title: 'Download', color: '#f5576c', onClick: () => handleDownloadPDF(record.id, record.invoice_number) },
          ].map(btn => (
            <Tooltip title={btn.title} key={btn.title}>
              <Button type="text" icon={btn.icon} onClick={btn.onClick} style={{ color: btn.color, padding: '4px 6px' }} />
            </Tooltip>
          ))}
        </div>
      )
    },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(18px,4vw,26px)', fontWeight: 700, margin: 0, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ContainerOutlined style={{ fontSize: 22, color: '#667eea' }} /> Purchase Invoices
          </h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Manage and track all vendor invoices</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large"
          onClick={() => { setSelectedInvoiceId(null); setModalMode('create'); setModalVisible(true); }}
          style={{ borderRadius: 10, height: 42, fontWeight: 600 }}>
          Create Invoice
        </Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { label: 'Total',    value: invoices.length,         gradient: 'linear-gradient(135deg,#667eea,#764ba2)', shadow: 'rgba(102,126,234,0.3)' },
          { label: 'Paid',     value: paidCount,               gradient: 'linear-gradient(135deg,#11998e,#38ef7d)', shadow: 'rgba(17,153,142,0.3)' },
          { label: 'Pending',  value: pendingCount,            gradient: 'linear-gradient(135deg,#f7971e,#ffd200)', shadow: 'rgba(247,151,30,0.3)' },
          { label: 'Filtered', value: filteredInvoices.length, gradient: 'linear-gradient(135deg,#f093fb,#f5576c)', shadow: 'rgba(245,87,108,0.3)' },
        ].map(s => (
          <Col xs={12} sm={6} key={s.label}>
            <div style={{ background: s.gradient, borderRadius: 12, padding: '12px 16px', boxShadow: `0 3px 12px ${s.shadow}` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>{s.label}</div>
            </div>
          </Col>
        ))}
      </Row>

      <Card style={{ borderRadius: 16, border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} bodyStyle={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <Input placeholder="Search invoice or vendor..." prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={searchText} onChange={e => setSearchText(e.target.value)}
            style={{ width: 220, borderRadius: 8 }} allowClear />
          <DatePicker placeholder="From Date" value={fromDate} onChange={setFromDate} style={{ width: 130, borderRadius: 8 }} allowClear />
          <DatePicker placeholder="To Date"   value={toDate}   onChange={setToDate}   style={{ width: 130, borderRadius: 8 }} allowClear />
          <Select placeholder="All Statuses" value={statusFilter} onChange={setStatusFilter} style={{ width: 150 }} allowClear>
            {Object.entries(STATUS_CONFIG).map(([v, c]) => <Select.Option key={v} value={v}>{c.label}</Select.Option>)}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchInvoices} loading={loading} style={{ borderRadius: 8 }}>Refresh</Button>
        </div>
        <Table columns={columns} dataSource={filteredInvoices} loading={loading}
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, size: 'small' }}
          onChange={p => setPagination({ current: p.current, pageSize: p.pageSize, total: p.total })}
          rowKey="id" scroll={{ x: 'max-content' }} size="small"
          rowClassName={(_, i) => i % 2 === 0 ? 'table-row-light' : ''}
        />
      </Card>

      <Modal title={<span style={{ fontWeight: 700 }}>{modalMode === 'create' ? <><PlusOutlined style={{ marginRight: 6 }} />Create</> : <><EditOutlined style={{ marginRight: 6 }} />Edit</>} Purchase Invoice</span>}
        open={modalVisible} onCancel={() => setModalVisible(false)}
        width="min(1200px,96vw)" style={{ top: 16 }} footer={null} destroyOnClose>
        <InvoiceForm type="purchase" invoiceId={selectedInvoiceId}
          onSave={() => { setModalVisible(false); fetchInvoices(); message.success(`Invoice ${modalMode === 'create' ? 'created' : 'updated'}`); }} />
      </Modal>

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

export default PurchaseInvoices;
