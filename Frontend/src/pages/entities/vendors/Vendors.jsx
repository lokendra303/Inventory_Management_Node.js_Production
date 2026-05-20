import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Table,
  Input,
  Tag,
  Dropdown,
  message,
  Tooltip,
  Avatar,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  MoreOutlined,
  EditOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  StopOutlined,
  MailOutlined,
  PhoneOutlined,
  ReloadOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import apiService from '../../../services/apiService';
import InvoiceListStatCards from '../../../components/business/InvoiceListStatCards';

const mapVendor = (vendor) => ({
  id: vendor.id,
  displayName: vendor.display_name || vendor.displayName || '',
  companyName: vendor.company_name || vendor.companyName || '',
  vendorCode: vendor.vendor_code || vendor.vendorCode || '',
  email: vendor.email || '',
  workPhone: vendor.work_phone || vendor.workPhone || '',
  mobilePhone: vendor.mobile_phone || vendor.mobilePhone || '',
  gstin: vendor.gstin || '',
  pan: vendor.pan || '',
  status: vendor.status === 'active' || vendor.status === 'Active' ? 'active' : 'inactive',
});

const Vendors = () => {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/vendors', { params: { status: 'all' } });

      let vendorsData = [];
      if (Array.isArray(response)) {
        vendorsData = response;
      } else if (response?.data && Array.isArray(response.data)) {
        vendorsData = response.data;
      } else if (response?.success && Array.isArray(response.data)) {
        vendorsData = response.data;
      }

      setVendors(vendorsData.map(mapVendor));
    } catch (error) {
      console.error('Error fetching vendors:', error);
      if (error.response?.status === 403) {
        message.error('You do not have permission to view vendors');
      } else if (error.response?.status === 401) {
        message.error('Session expired — please login again');
      } else {
        message.error(error.response?.data?.error || 'Failed to load vendors');
      }
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredVendors = useMemo(() => {
    const q = searchText.toLowerCase();
    if (!q) return vendors;
    return vendors.filter(
      (v) =>
        v.displayName?.toLowerCase().includes(q) ||
        v.companyName?.toLowerCase().includes(q) ||
        v.email?.toLowerCase().includes(q) ||
        v.gstin?.toLowerCase().includes(q) ||
        v.vendorCode?.toLowerCase().includes(q)
    );
  }, [vendors, searchText]);

  const stats = useMemo(
    () => ({
      total: vendors.length,
      active: vendors.filter((v) => v.status === 'active').length,
      inactive: vendors.filter((v) => v.status === 'inactive').length,
    }),
    [vendors]
  );

  const handleStatusChange = async (vendorId, newStatus) => {
    try {
      setActionLoading(true);
      const response = await apiService.put(`/vendors/${vendorId}`, { status: newStatus });

      if (response?.success === false) {
        message.error(response.error || 'Failed to update vendor status');
        return;
      }

      setVendors((prev) =>
        prev.map((v) => (v.id === vendorId ? { ...v, status: newStatus } : v))
      );
      message.success(`Vendor ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error('Error updating vendor status:', error);
      message.error(error.response?.data?.error || 'Failed to update vendor status');
    } finally {
      setActionLoading(false);
    }
  };

  const getActionItems = (record) => [
    {
      key: 'edit',
      label: 'Edit Vendor',
      icon: <EditOutlined />,
      onClick: () => navigate(`/purchases/vendors/${record.id}/edit`),
    },
    {
      key: 'status',
      label: record.status === 'active' ? 'Deactivate' : 'Activate',
      icon: record.status === 'active' ? <StopOutlined /> : <CheckCircleOutlined />,
      danger: record.status === 'active',
      onClick: () =>
        handleStatusChange(record.id, record.status === 'active' ? 'inactive' : 'active'),
    },
  ];

  const statCards = useMemo(() => {
    const cards = [
      {
        label: 'Total Vendors',
        value: stats.total,
        sub: 'In directory',
        subValue: `${stats.active} active`,
        gradient: 'linear-gradient(135deg,#667eea,#764ba2)',
        shadow: 'rgba(102,126,234,0.35)',
        icon: <ShopOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
      {
        label: 'Active',
        value: stats.active,
        sub: 'Approved suppliers',
        subValue: stats.total ? `${Math.round((stats.active / stats.total) * 100)}%` : '0%',
        gradient: 'linear-gradient(135deg,#11998e,#38ef7d)',
        shadow: 'rgba(17,153,142,0.35)',
        icon: <CheckCircleOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
      {
        label: 'Inactive',
        value: stats.inactive,
        sub: 'Deactivated',
        subValue: stats.inactive ? 'Review needed' : 'None',
        gradient: 'linear-gradient(135deg,#f7971e,#ffd200)',
        shadow: 'rgba(247,151,30,0.35)',
        icon: <StopOutlined style={{ fontSize: 22, color: '#fff' }} />,
      },
    ];
    if (searchText) {
      cards.push({
        label: 'Matching search',
        value: filteredVendors.length,
        sub: 'Shown below',
        subValue: `"${searchText.length > 18 ? `${searchText.slice(0, 18)}…` : searchText}"`,
        gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)',
        shadow: 'rgba(79,172,254,0.35)',
        icon: <SearchOutlined style={{ fontSize: 22, color: '#fff' }} />,
      });
    }
    return cards;
  }, [stats, searchText, filteredVendors.length]);

  const columns = [
    {
      title: 'Vendor',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            size={40}
            style={{
              background: 'linear-gradient(135deg,#f7971e,#f5576c)',
              flexShrink: 0,
              fontWeight: 700,
            }}
          >
            {(text || record.companyName || '?').charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: '#1a1a2e', lineHeight: 1.3 }}>
              {text || record.companyName || '—'}
            </div>
            {record.companyName && text && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{record.companyName}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'contact',
      render: (_, record) => (
        <div style={{ fontSize: 13 }}>
          {record.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#444' }}>
              <MailOutlined style={{ color: '#667eea', fontSize: 12 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{record.email}</span>
            </div>
          )}
          {(record.workPhone || record.mobilePhone) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#888',
                marginTop: 4,
                fontSize: 12,
              }}
            >
              <PhoneOutlined style={{ color: '#11998e', fontSize: 12 }} />
              {record.mobilePhone || record.workPhone}
            </div>
          )}
          {!record.email && !record.workPhone && !record.mobilePhone && (
            <span style={{ color: '#bbb' }}>—</span>
          )}
        </div>
      ),
    },
    {
      title: 'GSTIN',
      dataIndex: 'gstin',
      key: 'gstin',
      width: 160,
      render: (gstin) =>
        gstin ? (
          <Tag icon={<IdcardOutlined />} style={{ borderRadius: 6, margin: 0, fontFamily: 'monospace' }}>
            {gstin}
          </Tag>
        ) : (
          <span style={{ color: '#bbb' }}>—</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag
          color={status === 'active' ? 'success' : 'error'}
          style={{ borderRadius: 20, fontWeight: 600, margin: 0 }}
        >
          {status === 'active' ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 52,
      render: (_, record) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Dropdown
            menu={{
              items: getActionItems(record),
              onClick: ({ key }) => {
                const item = getActionItems(record).find((i) => i.key === key);
                if (item?.onClick) item.onClick();
              },
            }}
            trigger={['click']}
            disabled={actionLoading}
          >
            <Tooltip title="Actions">
              <Button
                type="text"
                icon={<MoreOutlined />}
                onClick={(e) => e.stopPropagation()}
                style={{ color: '#667eea' }}
              />
            </Tooltip>
          </Dropdown>
        </span>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 16px 32px', background: '#f5f6fa', minHeight: '100vh' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 'clamp(18px,4vw,26px)',
              fontWeight: 700,
              margin: 0,
              color: '#1a1a2e',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <ShopOutlined style={{ fontSize: 22, color: '#f7971e' }} />
            Vendors
          </h1>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>
            Manage suppliers — click a row to open profile and transaction history
          </p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => navigate('/purchases/vendors/new')}
          style={{ borderRadius: 10, height: 42, fontWeight: 600 }}
        >
          New Vendor
        </Button>
      </div>

      <InvoiceListStatCards cards={statCards} />

      <div
        style={{
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Input
            placeholder="Search name, company, email, GSTIN..."
            prefix={<SearchOutlined style={{ color: '#bbb' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 300, borderRadius: 8 }}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchVendors}
            loading={loading}
            style={{ borderRadius: 8 }}
          >
            Refresh
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={filteredVendors}
          rowKey="id"
          loading={loading}
          size="middle"
          onRow={(record) => ({
            onClick: () => navigate(`/purchases/vendors/${record.id}`),
            style: { cursor: 'pointer' },
          })}
          rowClassName={(_, index) => (index % 2 === 0 ? 'table-row-light' : '')}
          pagination={{
            total: filteredVendors.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} vendors`,
            size: 'small',
          }}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  );
};

export default Vendors;
