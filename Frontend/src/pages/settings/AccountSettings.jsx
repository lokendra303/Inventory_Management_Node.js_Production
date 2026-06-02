import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, Button, message, Tabs, DatePicker, Select, Switch, Modal } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import moment from 'moment';

const { TabPane } = Tabs;
const { Option } = Select;

const AccountSettings = () => {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpAction, setOtpAction] = useState('enable');
  const [pendingTwoFactorValue, setPendingTwoFactorValue] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    fetchProfile();
    return () => clearInterval(timerRef.current);
  }, []);

  const startResendTimer = () => {
    setResendTimer(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await apiService.get('/users/profile');
      if (response.success) {
        setUserProfile(response.data);
        const enabled = Boolean(response.data.twoFactorEnabled);
        setTwoFactorEnabled(enabled);
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

  const sendTwoFactorOtp = async (action, nextValue) => {
    const endpoint = action === 'disable'
      ? '/users/two-factor/send-disable-otp'
      : '/users/two-factor/send-otp';
    const response = await apiService.post(endpoint);
    if (response.success) {
      setOtpAction(action);
      setPendingTwoFactorValue(nextValue);
      setOtpEmail(response.data?.email || userProfile?.email || '');
      setOtpModalOpen(true);
      otpForm.resetFields();
      startResendTimer();
      message.success('OTP sent to your email');
      return true;
    }
    message.error(response.error || 'Failed to send OTP');
    return false;
  };

  const handleTwoFactorToggle = async (checked) => {
    const action = checked ? 'enable' : 'disable';
    try {
      setTwoFactorLoading(true);
      setTwoFactorEnabled(checked);
      const ok = await sendTwoFactorOtp(action, checked);
      if (!ok) {
        setTwoFactorEnabled(!checked);
      }
    } catch (error) {
      setTwoFactorEnabled(!checked);
      message.error(error.response?.data?.error || 'Failed to send OTP');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyTwoFactorOtp = async ({ otp }) => {
    try {
      setTwoFactorLoading(true);
      const endpoint = otpAction === 'disable'
        ? '/users/two-factor/verify-disable'
        : '/users/two-factor/verify-enable';
      const response = await apiService.post(endpoint, { otp });
      if (response.success) {
        const enabled = otpAction === 'enable';
        setTwoFactorEnabled(enabled);
        setUserProfile((prev) => (prev ? { ...prev, twoFactorEnabled: enabled } : prev));
        setPendingTwoFactorValue(null);
        setOtpModalOpen(false);
        otpForm.resetFields();
        message.success(enabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled');
      } else {
        message.error(response.error || 'Invalid OTP');
      }
    } catch (error) {
      message.error(error.response?.data?.error || 'OTP verification failed');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleOtpModalCancel = () => {
    setOtpModalOpen(false);
    if (pendingTwoFactorValue !== null) {
      setTwoFactorEnabled(!pendingTwoFactorValue);
    }
    setPendingTwoFactorValue(null);
    otpForm.resetFields();
    clearInterval(timerRef.current);
    setResendTimer(0);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      setTwoFactorLoading(true);
      await sendTwoFactorOtp(otpAction, pendingTwoFactorValue);
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setTwoFactorLoading(false);
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

              <h3 style={{ marginTop: '24px' }}>Security</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontWeight: 500 }}>Two-Factor Authentication</span>
                <Switch
                  checked={twoFactorEnabled}
                  loading={twoFactorLoading}
                  checkedChildren="Enabled"
                  unCheckedChildren="Disabled"
                  onChange={handleTwoFactorToggle}
                />
              </div>
              <p style={{ color: '#666', fontSize: '13px', marginBottom: '24px' }}>
                Both enabling and disabling two-factor authentication require email OTP verification.
              </p>

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

      <Modal
        title="Confirm your email"
        open={otpModalOpen}
        onCancel={handleOtpModalCancel}
        footer={null}
        destroyOnClose
        maskClosable={false}
      >
        <p style={{ marginBottom: 16, color: '#666' }}>
          Enter the 6-digit code sent to <strong>{otpEmail}</strong> to {otpAction === 'disable' ? 'disable' : 'enable'} 2FA. It expires in 5 minutes.
        </p>
        <Form form={otpForm} layout="vertical" onFinish={handleVerifyTwoFactorOtp}>
          <Form.Item
            name="otp"
            label="Verification code"
            rules={[
              { required: true, message: 'OTP is required' },
              { len: 6, message: 'OTP must be 6 digits' },
              { pattern: /^[0-9]{6}$/, message: 'OTP must be numeric' }
            ]}
          >
            <Input
              placeholder="000000"
              maxLength={6}
              style={{ letterSpacing: 6, textAlign: 'center', fontSize: 18 }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block loading={twoFactorLoading}>
              {otpAction === 'disable' ? 'Verify and disable 2FA' : 'Verify and enable 2FA'}
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center' }}>
          <Button
            type="link"
            disabled={resendTimer > 0 || twoFactorLoading}
            onClick={handleResendOtp}
          >
            {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AccountSettings;
