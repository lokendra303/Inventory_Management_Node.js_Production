import React, { useState, useEffect } from 'react';
import { Card, Form, Select, Button, message, Space } from 'antd';
import apiService from '../services/apiService';
import { getCurrencies } from '../utils/currency';

const Settings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currencies] = useState(getCurrencies());

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

  return (
    <div style={{ padding: '24px' }}>
      <h1>Settings</h1>
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
  );
};

export default Settings;