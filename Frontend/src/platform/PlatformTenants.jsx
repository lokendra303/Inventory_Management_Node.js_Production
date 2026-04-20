import React, { useEffect, useState } from 'react';
import {
  Card, Table, Input, Button, Space, Tag, Typography, Select,
} from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import platformApi from '../services/platformApi';

const { Title } = Typography;

function institutionStatusLabel(dbStatus) {
  if (dbStatus === 'inactive') return 'Suspended';
  if (dbStatus === 'active') return 'Active';
  return dbStatus || '—';
}

export default function PlatformTenants() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await platformApi.get('/platform/institutions', {
          params: {
            page,
            limit,
            search: appliedSearch || undefined,
            status: status || undefined,
          },
        });
        if (!cancelled && res.success) {
          setData(res.data || []);
          setTotal(res.total || 0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [page, limit, appliedSearch, status]);

  const runSearch = () => {
    setPage(1);
    setAppliedSearch(searchInput.trim());
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, row) => (
        <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => navigate(`/platform/tenants/${row.id}`)}>
          {text || '—'}
        </Button>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (v) => <Tag color={v === 'active' ? 'green' : 'red'}>{institutionStatusLabel(v)}</Tag>,
    },
    { title: 'Plan', dataIndex: 'plan_name', key: 'plan', render: (v) => v || '—' },
    { title: 'Users', dataIndex: 'user_count', key: 'user_count', width: 80 },
    { title: 'Items', dataIndex: 'item_count', key: 'item_count', width: 80 },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_, row) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/platform/tenants/${row.id}`)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>Tenants</Title>
      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            allowClear
            placeholder="Search name or email"
            prefix={<SearchOutlined />}
            style={{ width: 260 }}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onPressEnter={runSearch}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 140 }}
            value={status || undefined}
            onChange={(v) => { setStatus(v || ''); setPage(1); }}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
            ]}
          />
          <Button type="primary" onClick={runSearch}>Search</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={data}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
          }}
        />
      </Card>
    </div>
  );
}
