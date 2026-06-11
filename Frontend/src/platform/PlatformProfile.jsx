import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Input, Button, message, Tabs, Switch, Modal, Typography, Descriptions } from 'antd';
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import platformApi from '../services/platformApi';

const { Title, Paragraph } = Typography;

const OTP_MODAL_TITLES = {
  enable: 'Verify to enable 2FA',
  disable: 'Verify to disable 2FA',
  'email-change': 'Verify new email address',
  'password-change': 'Confirm password change',
};

export default function PlatformProfile() {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpAction, setOtpAction] = useState('enable');
  const [pendingTwoFactorValue, setPendingTwoFactorValue] = useState(null);
  const [pendingProfileValues, setPendingProfileValues] = useState(null);
  const [pendingPasswordValues, setPendingPasswordValues] = useState(null);
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
      const res = await platformApi.get('/platform/me');
      if (res.success) {
        const admin = res.data?.admin;
        setProfile(admin);
        setTwoFactorEnabled(Boolean(admin?.twoFactorEnabled));
        profileForm.setFieldsValue({
          name: admin?.name,
          email: admin?.email,
        });
      }
    } catch {
      message.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const openOtpModal = (action, email) => {
    setOtpAction(action);
    setOtpEmail(email);
    setOtpModalOpen(true);
    otpForm.resetFields();
    startResendTimer();
  };

  const handleProfileUpdate = async (values) => {
    const emailChanged = profile?.email
      && values.email?.trim().toLowerCase() !== profile.email.trim().toLowerCase();

    if (!emailChanged) {
      try {
        setLoading(true);
        const res = await platformApi.patch('/platform/profile', {
          name: values.name,
          email: values.email,
        });
        if (res.success) {
          message.success('Profile updated successfully');
          setProfile(res.data?.admin);
          profileForm.setFieldsValue({
            name: res.data?.admin?.name,
            email: res.data?.admin?.email,
          });
        } else {
          message.error(res.error || 'Failed to update profile');
        }
      } catch (err) {
        message.error(err.response?.data?.error || 'Failed to update profile');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      const res = await platformApi.post('/platform/profile/email/send-otp', {
        newEmail: values.email,
      });
      if (res.success) {
        setPendingProfileValues({ name: values.name, email: values.email });
        openOtpModal('email-change', res.data?.email || values.email);
        message.success('Verification code sent to your new email address');
      } else {
        message.error(res.error || 'Failed to send verification code');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const sendTwoFactorOtp = async (action, nextValue) => {
    const endpoint = action === 'disable'
      ? '/platform/profile/two-factor/send-disable-otp'
      : '/platform/profile/two-factor/send-enable-otp';
    const res = await platformApi.post(endpoint);
    if (res.success) {
      setOtpAction(action);
      setPendingTwoFactorValue(nextValue);
      openOtpModal(action, res.data?.email || profile?.email || '');
      message.success('OTP sent to your email');
      return true;
    }
    message.error(res.error || 'Failed to send OTP');
    return false;
  };

  const handleTwoFactorToggle = async (checked) => {
    const action = checked ? 'enable' : 'disable';
    try {
      setTwoFactorLoading(true);
      setTwoFactorEnabled(checked);
      const ok = await sendTwoFactorOtp(action, checked);
      if (!ok) setTwoFactorEnabled(!checked);
    } catch (err) {
      setTwoFactorEnabled(!checked);
      message.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyOtp = async ({ otp }) => {
    try {
      setTwoFactorLoading(true);

      if (otpAction === 'email-change') {
        if (!pendingProfileValues) {
          message.error('Profile update session expired. Please try again.');
          return;
        }
        const res = await platformApi.patch('/platform/profile', {
          name: pendingProfileValues.name,
          email: pendingProfileValues.email,
          emailOtp: otp,
        });
        if (res.success) {
          setProfile(res.data?.admin);
          profileForm.setFieldsValue({
            name: res.data?.admin?.name,
            email: res.data?.admin?.email,
          });
          setPendingProfileValues(null);
          setOtpModalOpen(false);
          otpForm.resetFields();
          message.success('Email updated successfully');
        } else {
          message.error(res.error || 'Failed to update email');
        }
        return;
      }

      if (otpAction === 'password-change') {
        if (!pendingPasswordValues) {
          message.error('Password change session expired. Please try again.');
          return;
        }
        const res = await platformApi.post('/platform/profile/change-password', {
          ...pendingPasswordValues,
          otp,
        });
        if (res.success) {
          setPendingPasswordValues(null);
          setOtpModalOpen(false);
          otpForm.resetFields();
          passwordForm.resetFields();
          message.success('Password changed successfully');
        } else {
          message.error(res.error || 'Failed to change password');
        }
        return;
      }

      const endpoint = otpAction === 'disable'
        ? '/platform/profile/two-factor/verify-disable'
        : '/platform/profile/two-factor/verify-enable';
      const res = await platformApi.post(endpoint, { otp });
      if (res.success) {
        const enabled = otpAction === 'enable';
        setTwoFactorEnabled(enabled);
        setProfile((prev) => (prev ? { ...prev, twoFactorEnabled: enabled } : prev));
        setPendingTwoFactorValue(null);
        setOtpModalOpen(false);
        otpForm.resetFields();
        message.success(enabled ? 'Two-factor authentication enabled' : 'Two-factor authentication disabled');
      } else {
        message.error(res.error || 'Invalid OTP');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'OTP verification failed');
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
    setPendingProfileValues(null);
    setPendingPasswordValues(null);
    otpForm.resetFields();
    clearInterval(timerRef.current);
    setResendTimer(0);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    try {
      setTwoFactorLoading(true);
      if (otpAction === 'email-change' && pendingProfileValues?.email) {
        const res = await platformApi.post('/platform/profile/email/send-otp', {
          newEmail: pendingProfileValues.email,
        });
        if (res.success) {
          openOtpModal('email-change', res.data?.email || pendingProfileValues.email);
          message.success('Verification code resent');
        } else {
          message.error(res.error || 'Failed to resend code');
        }
      } else if (otpAction === 'password-change') {
        const res = await platformApi.post('/platform/profile/change-password/send-otp', {
          currentPassword: pendingPasswordValues?.currentPassword,
        });
        if (res.success) {
          openOtpModal('password-change', res.data?.email || profile?.email || '');
          message.success('Verification code resent');
        } else {
          message.error(res.error || 'Failed to resend code');
        }
      } else {
        await sendTwoFactorOtp(otpAction, pendingTwoFactorValue);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handlePasswordChange = async (values) => {
    try {
      setLoading(true);
      const res = await platformApi.post('/platform/profile/change-password/send-otp', {
        currentPassword: values.currentPassword,
      });
      if (res.success) {
        setPendingPasswordValues({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        });
        openOtpModal('password-change', res.data?.email || profile?.email || '');
        message.success('Verification code sent to your email');
      } else {
        message.error(res.error || 'Failed to send verification code');
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const otpSubmitLabel = (() => {
    if (otpAction === 'disable') return 'Verify and disable 2FA';
    if (otpAction === 'enable') return 'Verify and enable 2FA';
    if (otpAction === 'email-change') return 'Verify and save new email';
    if (otpAction === 'password-change') return 'Verify and update password';
    return 'Verify';
  })();

  return (
    <div style={{ maxWidth: 900 }}>
      <Title level={3} style={{ marginTop: 0 }}>Admin profile</Title>
      <Paragraph type="secondary">
        Update your account details and security settings for the platform console.
      </Paragraph>

      <Tabs
        defaultActiveKey="profile"
        items={[
          {
            key: 'profile',
            label: 'Profile',
            children: (
              <Card loading={loading}>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Changing your email requires a verification code sent to the new address.
                </Paragraph>
                <Form form={profileForm} layout="vertical" onFinish={handleProfileUpdate}>
                  <Form.Item
                    label="Full name"
                    name="name"
                    rules={[{ required: true, message: 'Name is required' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="Your name" />
                  </Form.Item>
                  <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                      { required: true, message: 'Email is required' },
                      { type: 'email', message: 'Enter a valid email' },
                    ]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="admin@example.com" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Save changes
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: 'security',
            label: 'Security',
            children: (
              <Card loading={loading}>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  Password changes are confirmed with a one-time code sent to your current email.
                </Paragraph>
                <Title level={5} style={{ marginTop: 0 }}>Change password</Title>
                <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange}>
                  <Form.Item
                    label="Current password"
                    name="currentPassword"
                    rules={[{ required: true, message: 'Current password is required' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} />
                  </Form.Item>
                  <Form.Item
                    label="New password"
                    name="newPassword"
                    rules={[
                      { required: true, message: 'New password is required' },
                      { min: 8, message: 'At least 8 characters' },
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} />
                  </Form.Item>
                  <Form.Item
                    label="Confirm new password"
                    name="confirmPassword"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: 'Please confirm your password' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                          return Promise.reject(new Error('Passwords do not match'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Update password
                  </Button>
                </Form>

                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
                        <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                        Two-factor authentication
                      </Title>
                      <Paragraph type="secondary" style={{ marginBottom: 0, maxWidth: 520 }}>
                        When enabled, signing in requires a one-time code sent to your email after password verification.
                      </Paragraph>
                    </div>
                    <Switch
                      checked={twoFactorEnabled}
                      loading={twoFactorLoading}
                      onChange={handleTwoFactorToggle}
                      checkedChildren="On"
                      unCheckedChildren="Off"
                    />
                  </div>
                </div>
              </Card>
            ),
          },
          {
            key: 'details',
            label: 'Account info',
            children: (
              <Card loading={loading}>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Status">{profile?.status || '—'}</Descriptions.Item>
                  <Descriptions.Item label="2FA">{twoFactorEnabled ? 'Enabled' : 'Disabled'}</Descriptions.Item>
                  <Descriptions.Item label="Last login">
                    {profile?.lastLogin ? new Date(profile.lastLogin).toLocaleString() : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Created">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleString() : '—'}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={OTP_MODAL_TITLES[otpAction] || 'Verify OTP'}
        open={otpModalOpen}
        onCancel={handleOtpModalCancel}
        footer={null}
        destroyOnClose
      >
        <Paragraph>
          Enter the 6-digit code sent to <strong>{otpEmail}</strong>. It expires in 5 minutes.
        </Paragraph>
        <Form form={otpForm} layout="vertical" onFinish={handleVerifyOtp}>
          <Form.Item
            name="otp"
            rules={[
              { required: true, message: 'OTP is required' },
              { len: 6, message: 'Enter the 6-digit OTP' },
            ]}
          >
            <Input maxLength={6} inputMode="numeric" placeholder="123456" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={twoFactorLoading}>
            {otpSubmitLabel}
          </Button>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {resendTimer > 0 ? (
            <span style={{ color: '#999' }}>Resend OTP in {resendTimer}s</span>
          ) : (
            <Button type="link" onClick={handleResendOtp} disabled={twoFactorLoading}>
              Resend OTP
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}
