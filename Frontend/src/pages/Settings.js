import React, { useState, useEffect } from 'react';
import { Card, Form, Select, Button, message, Space } from 'antd';
import apiService from '../services/apiService';
import { getCurrencies } from '../utils/currency';
import { useNavigate } from 'react-router-dom';
import './Settings.css';

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currencies] = useState(getCurrencies());
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/settings');
      if (response.success) {
        form.setFieldsValue({
          currency: response.data.currency
        });
      }
    } catch (error) {
      message.error('Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      setLoading(true);
      const response = await apiService.put('/settings', values);
      if (response.success) {
        message.success('Settings updated successfully');
        // Refresh the page to apply currency changes
        window.location.reload();
      }
    } catch (error) {
      message.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    {
      title: 'Organization Settings',
      items: [
        { label: 'Profile', path: '/settings/profile' },
        { label: 'Branding', path: '/settings/branding' },
        { label: 'Locations', path: '/settings/locations' },
        { label: 'Manage Subscription', path: '/settings/subscription' }
      ],
      type: 'green'
    },
    {
      title: 'Users & Roles',
      items: [
        { label: 'Users', path: '/users' },
        { label: 'Roles', path: '/roles' },
        { label: 'User Preferences', path: '/settings/user-preferences' }
      ],
      type: 'red'
    },
    {
      title: 'Setup & Configurations',
      items: [
        { label: 'General', path: '/settings/general' },
        { label: 'Currencies', path: '/settings/currencies' },
        { label: 'Reminders', path: '/settings/reminders' },
        { label: 'Customer Portal', path: '/settings/customer-portal' }
      ],
      type: 'orange'
    },
    {
      title: 'Taxes & Compliance',
      items: [
        { label: 'Taxes', path: '/settings/taxes' },
        { label: 'Direct Taxes', path: '/settings/direct-taxes' },
        { label: 'MSME Settings', path: '/settings/msme' }
      ],
      type: 'blue'
    },
    {
      title: 'Customization',
      items: [
        { label: 'Transaction Number Series', path: '/settings/transaction-series' },
        { label: 'PDF Templates', path: '/settings/pdf-templates' },
        { label: 'Email Notifications', path: '/settings/email-notifications' },
        { label: 'SMS Notifications', path: '/settings/sms-notifications' },
        { label: 'Reporting Tags', path: '/settings/reporting-tags' },
        { label: 'Web Tabs', path: '/settings/web-tabs' }
      ],
      type: 'peach'
    },
    {
      title: 'Automation',
      items: [
        { label: 'Workflow Rules', path: '/settings/workflow-rules' },
        { label: 'Workflow Actions', path: '/settings/workflow-actions' },
        { label: 'Workflow Logs', path: '/settings/workflow-logs' }
      ],
      type: 'pink'
    },
    {
      title: 'Module Settings',
      items: [
        { label: 'Customers and Vendors', path: '/settings/customers-vendors' },
        { label: 'Items', path: '/items' },
        { label: 'Inventory Adjustments', path: '/inventory/adjustments' },
        { label: 'Packages', path: '/inventory/packages' },
        { label: 'Shipments', path: '/inventory/shipments' }
      ],
      type: 'mint'
    },
    {
      title: 'Extension & Developer Data',
      items: [
        { label: 'Widgets', path: '/settings/widgets' },
        { label: 'Incoming Webhooks', path: '/settings/webhooks' },
        { label: 'API Usage', path: '/settings/api-usage' }
      ],
      type: 'teal'
    }
  ];

  return (
    <div className="settings-page">
      <h1>All Settings</h1>

      <div className="settings-grid">
        {sections.map((section) => (
          <Card key={section.title} className="settings-card">
            <div className={`card-header ${section.type}`}>{section.title}</div>
            <div className="card-list">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="card-item"
                  onClick={() => item.path && navigate(item.path)}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <Card title="Currency Settings" style={{ maxWidth: 600 }}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="currency"
              label="Default Currency"
              rules={[{ required: true, message: 'Please select a currency!' }]}
            >
              <Select
                placeholder="Select currency"
                loading={loading}
                showSearch
                optionFilterProp="children"
              >
                {currencies.map(currency => (
                  <Select.Option key={currency.code} value={currency.code}>
                    {currency.symbol} - {currency.name} ({currency.code})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save Settings
                </Button>
                <Button onClick={() => form.resetFields()}>
                  Reset
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Settings;