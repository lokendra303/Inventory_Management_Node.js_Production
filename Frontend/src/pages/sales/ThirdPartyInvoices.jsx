import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Table, Tag, message, Modal, Input, Select, Tooltip, Alert, Popconfirm,
} from 'antd';
import {
  FileTextOutlined, PlusOutlined, EyeOutlined, FilePdfOutlined,
  EditOutlined, PrinterOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, StopOutlined, DeleteOutlined,
} from '@ant-design/icons';
import apiService from '../../services/apiService';
import ThirdPartyInvoiceForm from '../../components/forms/ThirdPartyInvoiceForm';
import InvoicePdfViewModal from '../../components/business/InvoicePdfViewModal';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import { formatCommercialDocAmount } from '../../utils/currency';
import { assertPdfBlob, printPdfBlob } from '../../utils/printPdfBlob';

const STATUS_CONFIG = {
  draft:     { color: 'orange',  label: 'Draft' },
  posted:    { color: 'blue',    label: 'Posted' },
  cancelled: { color: 'error',   label: 'Cancelled' },
};

const ThirdPartyInvoices = () => {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [viewInvoiceId, setViewInvoiceId] = useState(null);
  const [viewInvoiceNumber, setViewInvoiceNumber] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [modalMode, setModalMode] = useState('create');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/third-party-invoices', {
        params: { page: pagination.current, limit: pagination.pageSize },
      });
      if (response.success) {
        setInvoices(response.data?.invoices || []);
        setPagination((prev) => ({
          ...prev,
          total: response.data?.pagination?.total || 0,
        }));
      } else {
        message.error(response.error || 'Failed to fetch invoices');
      }
    } catch {
      message.error('Error loading third-party invoices');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/third-party-invoices/${invoiceId}/pdf?download=true`,
        { responseType: 'blob' }
      );
      await assertPdfBlob(response.data);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `TPI_${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      message.success('PDF downloaded');
    } catch {
      message.error('Failed to download PDF');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPDF = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await apiService.get(
        `/third-party-invoices/${invoiceId}/pdf?download=true`,
        { responseType: 'blob' }
      );
      await printPdfBlob(response.data);
    } catch (e) {
      message.error(e?.message === 'POPUP_BLOCKED' ? 'Allow pop-ups to print' : 'Failed to print');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await apiService.put(`/third-party-invoices/${invoiceId}/status`, { status: 'posted' });
      if (response.success) {
        message.success('Invoice marked as posted');
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

  const handleCancel = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await apiService.put(`/third-party-invoices/${invoiceId}/status`, { status: 'cancelled' });
      if (response.success) {
        message.success('Invoice cancelled');
        fetchInvoices();
      } else {
        message.error(response.error || 'Failed to cancel invoice');
      }
    } catch {
      message.error('Failed to cancel invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (invoiceId) => {
    try {
      setLoading(true);
      const response = await apiService.delete(`/third-party-invoices/${invoiceId}`);
      if (response.success) {
        message.success(response.message || 'Invoice deleted');
        fetchInvoices();
      } else {
        message.error(response.error || 'Failed to delete invoice');
      }
    } catch (e) {
      message.error(e.response?.data?.error || 'Failed to delete invoice');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const textMatch = !searchText
      || inv.invoice_number?.toLowerCase().includes(searchText.toLowerCase())
      || inv.party_name?.toLowerCase().includes(searchText.toLowerCase());
    const statusMatch = !statusFilter || inv.status === statusFilter;
    return textMatch && statusMatch;
  });

  const columns = [
    {
      title: 'Invoice #',
      dataIndex: 'invoice_number',
      width: 130,
      render: (v) => <span style={{ fontWeight: 600, color: '#11998e' }}>{v}</span>,
    },
    { title: 'Party', dataIndex: 'party_name', ellipsis: true },
    {
      title: 'Date',
      dataIndex: 'invoice_date',
      width: 110,
      render: (d) => new Date(d).toLocaleDateString(),
    },
    {
      title: 'Amount',
      dataIndex: 'total_amount',
      width: 120,
      render: (v, record) => (
        <span style={{ fontWeight: 600 }}>{formatCommercialDocAmount(v, record)}</span>
      ),
    },
    {
      title: 'GSTIN',
      dataIndex: 'party_gstin',
      width: 140,
      responsive: ['md'],
      render: (v) => v || '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (s) => {
        const c = STATUS_CONFIG[s] || {};
        return <Tag color={c.color}>{c.label || s}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 2 }}>
          {record.status === 'draft' && (
            <>
              <Tooltip title="Edit">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedInvoiceId(record.id);
                    setModalMode('edit');
                    setModalVisible(true);
                  }}
                  style={{ color: '#11998e' }}
                />
              </Tooltip>
              <Tooltip title="Post (finalize)">
                <Button
                  type="text"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handlePost(record.id)}
                  style={{ color: '#52c41a' }}
                />
              </Tooltip>
            </>
          )}
          {record.status === 'posted' && (
            <Tooltip title="Cancel">
              <Button
                type="text"
                icon={<StopOutlined />}
                onClick={() => handleCancel(record.id)}
                style={{ color: '#ff4d4f' }}
              />
            </Tooltip>
          )}
          <Tooltip title="View PDF">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setViewInvoiceId(record.id);
                setViewInvoiceNumber(record.invoice_number);
              }}
            />
          </Tooltip>
          <Tooltip title="Download PDF">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={() => handleDownloadPDF(record.id, record.invoice_number)}
            />
          </Tooltip>
          <Tooltip title="Print">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={() => handlePrintPDF(record.id)}
            />
          </Tooltip>
          {isSuperAdmin && (
            <Popconfirm
              title="Delete this invoice?"
              description={`"${record.invoice_number}" will be permanently removed. This cannot be undone.`}
              okText="Delete"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
              onConfirm={() => handleDelete(record.id)}
            >
              <Tooltip title="Delete (super admin only)">
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  const totalAmount = filteredInvoices.reduce((s, i) => s + (Number(i.total_amount) || 0), 0);

  return (
    <div style={{ padding: '0 4px' }}>
      <div style={{ marginBottom: 20 }}>
        <TitleRow />
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Third-party invoices"
          description="Create GST-compliant invoices with full calculation automation. These documents use your standard invoice PDF format but do not affect inventory, stock movements, or accounting."
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <Input
            prefix={<SearchOutlined />}
            placeholder="Search invoice # or party..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="Status"
            allowClear
            style={{ width: 130 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v.label}</Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchInvoices}>Refresh</Button>
          <div style={{ flex: 1 }} />
          <span style={{ color: '#666', fontSize: 13 }}>
            {filteredInvoices.length} invoice(s) · {formatCurrency(totalAmount)}
          </span>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedInvoiceId(null);
              setModalMode('create');
              setModalVisible(true);
            }}
            style={{ background: '#11998e', borderColor: '#11998e' }}
          >
            New Third-Party Invoice
          </Button>
        </div>
      </div>

      <Card>
        <Table
          dataSource={filteredInvoices}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            onChange: (page, pageSize) => setPagination((p) => ({ ...p, current: page, pageSize })),
          }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Modal
        title={modalMode === 'edit' ? 'Edit Third-Party Invoice' : 'Create Third-Party Invoice'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1100}
        destroyOnClose
      >
        <ThirdPartyInvoiceForm
          invoiceId={modalMode === 'edit' ? selectedInvoiceId : null}
          onSave={() => {
            setModalVisible(false);
            fetchInvoices();
          }}
        />
      </Modal>

      <InvoicePdfViewModal
        open={Boolean(viewInvoiceId)}
        onClose={() => { setViewInvoiceId(null); setViewInvoiceNumber(''); }}
        invoiceId={viewInvoiceId}
        apiBase="/third-party-invoices"
        title={viewInvoiceNumber ? `TPI ${viewInvoiceNumber}` : 'Third-Party Invoice'}
      />
    </div>
  );
};

function TitleRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <FileTextOutlined style={{ fontSize: 28, color: '#11998e' }} />
      <div>
        <h2 style={{ margin: 0, fontSize: 22 }}>Third-Party Invoices</h2>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>
          Manual invoices · GST automation · No inventory impact
        </p>
      </div>
    </div>
  );
}

export default ThirdPartyInvoices;
