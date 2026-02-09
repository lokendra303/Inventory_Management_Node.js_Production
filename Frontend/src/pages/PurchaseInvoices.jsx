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
      const response = await apiService.get(`/purchase-invoices/${invoiceId}/standard-format`);
      if (response.success) {
        message.success('Standard format generated successfully');
        console.log('Standard Invoice Format:', response.data);
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