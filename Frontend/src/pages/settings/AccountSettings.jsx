import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Tabs, DatePicker, Select } from 'antd';
import { UserOutlined, LockOutlined, EnvironmentOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import moment from 'moment';

const { TabPane } = Tabs;
const { Option } = Select;

const AccountSettings = () => {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/users/profile');
      if (response.success) {
        setUserProfile(response.data);
        profileForm.setFieldsValue({
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          email: response.data.email,
          mobile: response.data.mobile,
          address: response.data.address,
          city: response.data.city,
          state: response.data.state,
          country: response.data.country,
          postalCode: response.data.postalCode,
          dateOfBirth: response.data.dateOfBirth ? moment(response.data.dateOfBirth) : null,
          gender: response.data.gender
        });
      }
    } catch (error) {
      message.error('Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async (values) => {
    try {
      setLoading(true);
      const updateData = {
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null
      };
      const response = await apiService.put('/users/account-settings', updateData);
      if (response.success) {
        message.success('Profile updated successfully');
        setUserProfile(response.data);
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (values) => {
    try {
      setLoading(true);
      const response = await apiService.put('/users/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      });
      if (response.success) {
        message.success('Password changed successfully');
        passwordForm.resetFields();
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const isMobile = window.innerWidth <= 768;

  return (
    <div style={{ padding: isMobile ? '12px' : '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Account Settings</h1>
      
      <Tabs defaultActiveKey="profile">
        <TabPane 
          tab={<span><UserOutlined /> Profile Information</span>} 
          key="profile"
        >
          <Card>
            <Form
              form={profileForm}
              layout="vertical"
              onFinish={handleProfileUpdate}
            >
              <h3>Personal Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                <Form.Item
                  name="firstName"
                  label="First Name"
                  rules={[{ required: true, message: 'Please enter first name' }]}
                >
                  <Input placeholder="First Name" />
                </Form.Item>

                <Form.Item
                  name="lastName"
                  label="Last Name"
                  rules={[{ required: true, message: 'Please enter last name' }]}
                >
                  <Input placeholder="Last Name" />
                </Form.Item>

                <Form.Item
                  name="email"
                  label="Email"
                  rules={[
                    { required: true, message: 'Please enter email' },
                    { type: 'email', message: 'Please enter valid email' }
                  ]}
                >
                  <Input placeholder="Email" />
                </Form.Item>

                <Form.Item
                  name="mobile"
                  label="Mobile Number"
                >
                  <Input placeholder="Mobile Number" />
                </Form.Item>

                <Form.Item
                  name="dateOfBirth"
                  label="Date of Birth"
                >
                  <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
                </Form.Item>

                <Form.Item
                  name="gender"
                  label="Gender"
                >
                  <Select placeholder="Select Gender">
                    <Option value="male">Male</Option>
                    <Option value="female">Female</Option>
                    <Option value="other">Other</Option>
                  </Select>
                </Form.Item>
              </div>

              <h3 style={{ marginTop: '24px' }}>Address Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                <Form.Item
                  name="address"
                  label="Street Address"
                >
                  <Input.TextArea rows={2} placeholder="Street Address" />
                </Form.Item>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                  <Form.Item
                    name="city"
                    label="City"
                  >
                    <Input placeholder="City" />
                  </Form.Item>

                  <Form.Item
                    name="state"
                    label="State/Province"
                  >
                    <Input placeholder="State/Province" />
                  </Form.Item>

                  <Form.Item
                    name="country"
                    label="Country"
                  >
                    <Input placeholder="Country" />
                  </Form.Item>

                  <Form.Item
                    name="postalCode"
                    label="Postal Code"
                  >
                    <Input placeholder="Postal Code" />
                  </Form.Item>
                </div>
              </div>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Update Profile
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane 
          tab={<span><LockOutlined /> Change Password</span>} 
          key="password"
        >
          <Card style={{ maxWidth: '600px' }}>
            <Form
              form={passwordForm}
              layout="vertical"
              onFinish={handlePasswordChange}
            >
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: 'Please enter current password' }]}
              >
                <Input.Password placeholder="Current Password" />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: 'Please enter new password' },
                  { min: 6, message: 'Password must be at least 6 characters' }
                ]}
              >
                <Input.Password placeholder="New Password" />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirm New Password"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Please confirm new password' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Passwords do not match'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Confirm New Password" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Change Password
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default AccountSettings;
