import React, { useCallback, useEffect, useState } from 'react';
import {
  Card, Table, Typography, Spin, Tag, Button, Space, Select, Modal, Form, Input, message, Grid,
} from 'antd';
import { ReloadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import platformApi from '../services/platformApi';

const { Title, Paragraph, Text } = Typography;

const STATUS_COLOR = { pending: 'orange', approved: 'green', rejected: 'red' };

export default function PlatformSubscriptionRequests() {
  const screens = Grid.useBreakpoint();
  const isNarrow = !screens.md;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionRow, setActionRow] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await platformApi.get('/platform/subscription-requests', {
        params: { status: statusFilter === 'all' ? undefined : statusFilter, page, limit },
      });
      if (res.success) {
        setRows(res.data || []);
        setTotal(res.total ?? 0);
      } else {
        message.error(res.error || 'Failed to load requests');
      }
    } catch (e) {
      message.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, limit]);

  useEffect(() => { load(); }, [load]);

  const openApprove = (record) => {
    setActionRow(record);
    setActionType('approve');
    form.resetFields();
    form.setFieldsValue({ adminNotes: '' });
  };

  const openReject = (record) => {
    setActionRow(record);
    setActionType('reject');
    form.resetFields();
    form.setFieldsValue({ adminNotes: '' });
  };

  const submitAction = async () => {
    if (!actionRow || !actionType) return;
    try {
      const values = await form.validateFields();
      const path =
        actionType === 'approve'
          ? `/platform/subscription-requests/${actionRow.id}/approve`
          : `/platform/subscription-requests/${actionRow.id}/reject`;
      const res = await platformApi.post(path, { adminNotes: values.adminNotes || undefined });
      if (res.success) {
        message.success(actionType === 'approve' ? 'Plan assigned to institution' : 'Request rejected');
        setActionRow(null);
        setActionType(null);
        load();
      } else {
        message.error(res.error || 'Action failed');
      }
    } catch (e) {
      if (e?.errorFields) return;
      const d = e.response?.data;
      if (d?.error === 'DOWNGRADE_BLOCKED') {
        message.error(
          `Cannot approve: usage exceeds limits for ${d.planName || 'this plan'}. Ask the institution to reduce usage or assign a different plan.`
        );
      } else {
        message.error(d?.error || e.message);
      }
    }
  };

  const columns = [
    {
      title: 'Requested',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (t) => (t ? new Date(t).toLocaleString() : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => <Tag color={STATUS_COLOR[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Institution',
      key: 'inst',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={() => navigate(`/platform/institutions/${r.institution_id}`)}
          >
            {r.institution_name || '—'}
          </Button>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.institution_email}</Text>
        </Space>
      ),
    },
    {
      title: 'Requested plan',
      key: 'plan',
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.requested_plan_name || r.requested_plan_id}</Text>
          <Tag>{r.billing_cycle}</Tag>
        </Space>
      ),
    },
    {
      title: 'Message',
      dataIndex: 'request_message',
      key: 'request_message',
      ellipsis: true,
      render: (t) => t || <Text type="secondary">—</Text>,
    },
    {
      title: 'Review',
      key: 'review',
      width: 200,
      render: (_, r) => {
        if (r.status !== 'pending') {
          return (
            <Space direction="vertical" size={0}>
              {r.reviewed_at && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(r.reviewed_at).toLocaleString()}
                </Text>
              )}
              {r.admin_notes && (
                <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: r.admin_notes }}>{r.admin_notes}</Text>
              )}
            </Space>
          );
        }
        return (
          <Space>
            <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => openApprove(r)}>
              Approve
            </Button>
            <Button danger size="small" icon={<CloseOutlined />} onClick={() => openReject(r)}>
              Reject
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      {isNarrow ? (
        <div style={{ marginBottom: 16 }}>
          <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>Subscription requests</Title>
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Institutions request paid plan upgrades here. Approve to assign the plan (no payment), or reject with an optional note.
          </Paragraph>
          <Select
            style={{ width: '100%', marginBottom: 8 }}
            value={statusFilter}
            onChange={(v) => { setPage(1); setStatusFilter(v); }}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'all', label: 'All' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} block>
            Refresh
          </Button>
        </div>
      ) : (
        <Space align="center" style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <div>
            <Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>Subscription requests</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Institutions request paid plan upgrades here. Approve to assign the plan (no payment), or reject with an optional note.
            </Paragraph>
          </div>
          <Space wrap>
            <Select
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(v) => { setPage(1); setStatusFilter(v); }}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'all', label: 'All' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          </Space>
        </Space>
      )}

      <Card>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize: limit,
            total,
            showSizeChanger: false,
            onChange: (p) => setPage(p),
            showTotal: (t) => `${t} request${t === 1 ? '' : 's'}`,
          }}
        />
      </Card>

      <Modal
        title={actionType === 'approve' ? 'Approve upgrade request' : 'Reject upgrade request'}
        open={Boolean(actionRow && actionType)}
        onCancel={() => { setActionRow(null); setActionType(null); }}
        onOk={submitAction}
        okText={actionType === 'approve' ? 'Approve & assign plan' : 'Reject request'}
        okButtonProps={{ danger: actionType === 'reject' }}
        width={isNarrow ? 'calc(100vw - 24px)' : 520}
        style={isNarrow ? { top: 12 } : undefined}
        destroyOnClose
      >
        {actionRow && (
          <Paragraph type="secondary" style={{ marginBottom: 12 }}>
            <strong>{actionRow.institution_name}</strong>
            {' → '}
            <strong>{actionRow.requested_plan_name}</strong>
            {' '}
            ({actionRow.billing_cycle})
          </Paragraph>
        )}
        <Form form={form} layout="vertical">
          <Form.Item
            name="adminNotes"
            label={actionType === 'reject' ? 'Reason (recommended)' : 'Internal note (optional)'}
            rules={actionType === 'reject' ? [{ required: true, message: 'Please provide a short reason' }] : []}
          >
            <Input.TextArea rows={3} placeholder={actionType === 'reject' ? 'Explain why the request was denied…' : 'Optional note for billing records…'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
