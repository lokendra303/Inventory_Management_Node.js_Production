import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Table, Space, Tag, message, Modal } from 'antd';
import { ShoppingCartOutlined, PlusOutlined, EyeOutlined, FilePdfOutlined, EditOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import InvoiceForm from '../components/InvoiceForm';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { formatPrice } from '../utils/currency';

const { Title } = Typography;

const PurchaseInvoices = () => {
  const { currency } = useCurrency();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [modalMode, setModalMode] = useState('create');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/purchase-invoices', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize
        }
      });
      
      if (response.success) {
        setInvoices(response.data?.invoices || []);
        setPagination(prev => ({
          ...prev,
          total: response.data?.pagination?.total || 0
        }));
      } else {
        message.error(response.error || 'Failed to fetch purchase invoices');
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      message.error('Error loading invoices');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handleCreateInvoice = () => {
    setSelectedInvoiceId(null);
    setModalMode('create');
    setModalVisible(true);
  };

  const handleEditInvoice = (invoiceId) => {
    setSelectedInvoiceId(invoiceId);
    setModalMode('edit');
    setModalVisible(true);
  };

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
        
        const companyName = settings.company_name || data.header.companyName;
        const address = settings.address || `${data.header.address.line1}, ${data.header.address.city}, ${data.header.address.state}`;
        const phone = settings.phone || data.header.contact.phone;
        const email = settings.email || data.header.contact.email;
        const logoUrl = settings.logo_path ? `http://localhost:5000${settings.logo_path}` : data.header.branding?.logoUrl;
        const stampUrl = settings.stamp_path ? `http://localhost:5000${settings.stamp_path}` : data.header.branding?.stampUrl;
        const signatureUrl = settings.signature_path ? `http://localhost:5000${settings.signature_path}` : data.header.branding?.signatureUrl;
        
        Modal.info({
          title: 'Invoice Preview',
          width: 900,
          content: (
            <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '20px' }}>
                <div>
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" style={{ maxHeight: '60px', marginBottom: '10px' }} />
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h2 style={{ margin: 0 }}>{companyName}</h2>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>
                    {address}<br/>
                    {phone} | {email}
                  </p>
                  {data.header.taxInfo.taxId && (
                    <p style={{ margin: '5px 0', fontSize: '11px' }}>Tax ID: {data.header.taxInfo.taxId}</p>
                  )}
                </div>
              </div>

              {/* Invoice Details */}
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

              {/* Line Items */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>#</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Item</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Qty</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Rate</th>
                    <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lineItems.map((item) => (
                    <tr key={item.sno}>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.sno}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.itemName}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{parseFloat(item.quantity).toFixed(2)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{parseFloat(item.unitAmount).toFixed(2)}</td>
                      <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{item.netAmount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ textAlign: 'right', marginTop: '20px' }}>
                <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Subtotal:</strong> {data.details.currency} {data.totals.subtotal.toFixed(2)}</p>
                <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Tax:</strong> {data.details.currency} {data.totals.totalTaxAmount.toFixed(2)}</p>
                <p style={{ margin: '5px 0', fontSize: '13px' }}><strong>Discount:</strong> {data.details.currency} {data.totals.totalDiscountAmount.toFixed(2)}</p>
                <h3 style={{ margin: '10px 0', fontSize: '16px' }}><strong>Grand Total:</strong> {data.details.currency} {data.totals.grandTotal.toFixed(2)}</h3>
                <p style={{ margin: '5px 0', fontSize: '12px', fontStyle: 'italic' }}>Amount in words: {data.totals.amountInWords}</p>
              </div>

              {/* Bank Details */}
              {(data.partyDetails.bankDetails?.bankName || data.partyDetails.bankDetails?.accountNumber) && (
                <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Vendor Bank Details</h4>
                  {data.partyDetails.bankDetails.bankName && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>Bank Name:</strong> {data.partyDetails.bankDetails.bankName}</p>}
                  {data.partyDetails.bankDetails.branchName && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>Branch:</strong> {data.partyDetails.bankDetails.branchName}</p>}
                  {data.partyDetails.bankDetails.accountNumber && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>Account Number:</strong> {data.partyDetails.bankDetails.accountNumber}</p>}
                  {data.partyDetails.bankDetails.accountType && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>Account Type:</strong> {data.partyDetails.bankDetails.accountType}</p>}
                  {data.partyDetails.bankDetails.ifscCode && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>IFSC Code:</strong> {data.partyDetails.bankDetails.ifscCode}</p>}
                  {data.partyDetails.bankDetails.swiftCode && <p style={{ margin: '3px 0', fontSize: '12px' }}><strong>SWIFT Code:</strong> {data.partyDetails.bankDetails.swiftCode}</p>}
                </div>
              )}

              {/* Footer with Signature */}
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                {stampUrl && (
                  <div>
                    <img src={stampUrl} alt="Stamp" style={{ maxHeight: '80px' }} />
                  </div>
                )}
                <div style={{ textAlign: 'right' }}>
                  {signatureUrl && (
                    <img src={signatureUrl} alt="Signature" style={{ maxHeight: '60px', marginBottom: '5px' }} />
                  )}
                  <p style={{ margin: '5px 0', fontSize: '12px', borderTop: '1px solid #333', paddingTop: '5px', textAlign: 'left' }}>
                    <strong>Name:</strong> {settings.authorized_signatory_name || 'N/A'}<br/>
                    <strong>Designation:</strong> {settings.authorized_signatory_designation || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )
        });
      }
    } catch (error) {
      message.error('Failed to generate standard format');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (invoiceId, invoiceNumber) => {
    try {
      setLoading(true);
      const response = await apiService.get(`/purchase-invoices/${invoiceId}/pdf?download=true`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PI_${invoiceNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      message.success('PDF downloaded successfully');
    } catch (error) {
      message.error('Failed to download PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleModalSave = (savedInvoice) => {
    setModalVisible(false);
    fetchInvoices();
    message.success(`Invoice ${modalMode === 'create' ? 'created' : 'updated'} successfully`);
  };

  const handleTableChange = (paginationInfo) => {
    setPagination({
      current: paginationInfo.current,
      pageSize: paginationInfo.pageSize,
      total: paginationInfo.total
    });
  };

  const columns = [
    {
      title: 'Invoice Number',
      dataIndex: 'invoice_number',
      key: 'invoice_number',
    },
    {
      title: 'Vendor',
      dataIndex: 'vendor_name',
      key: 'vendor_name',
    },
    {
      title: 'Invoice Date',
      dataIndex: 'invoice_date',
      key: 'invoice_date',
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Due Date',
      dataIndex: 'due_date',
      key: 'due_date',
      render: (date) => date ? new Date(date).toLocaleDateString() : '-',
    },
    {
      title: 'Amount',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount) => formatPrice(amount, currency, 'USD'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const colors = {
          draft: 'orange',
          posted: 'blue',
          partially_paid: 'purple',
          paid: 'green',
          cancelled: 'red'
        };
        return (
          <Tag color={colors[status] || 'default'}>
            {status?.toUpperCase() || 'UNKNOWN'}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditInvoice(record.id)}
            title="Edit Invoice"
          />
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewStandardFormat(record.id)}
            title="View Standard Format"
          />
          <Button
            type="text"
            icon={<FilePdfOutlined />}
            onClick={() => handleDownloadPDF(record.id, record.invoice_number)}
            title="Download PDF"
          />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <Title level={2}>
          <ShoppingCartOutlined /> Purchase Invoices
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateInvoice}>
          Create Invoice
        </Button>
      </div>

      <Card>
        <Table 
          columns={columns} 
          dataSource={invoices}
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
          rowKey="id"
        />
      </Card>

      <Modal
        title={`${modalMode === 'create' ? 'Create' : 'Edit'} Purchase Invoice`}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        width={1200}
        footer={null}
        destroyOnClose
      >
        <InvoiceForm
          type="purchase"
          invoiceId={selectedInvoiceId}
          onSave={handleModalSave}
        />
      </Modal>
    </div>
  );
};

export default PurchaseInvoices;