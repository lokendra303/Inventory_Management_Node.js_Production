import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, message } from 'antd';
import {
  LockOutlined, MailOutlined, ArrowRightOutlined,
  SafetyCertificateOutlined, ArrowLeftOutlined, UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import platformApi, { platformToken } from '../../services/platformApi';

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; }
  .pa-root * { font-family: 'Inter', sans-serif; }

  @keyframes pa-bg-shift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes pa-card-in {
    from { opacity: 0; transform: translateY(36px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes pa-orb1 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%     { transform: translate(30px,-20px) scale(1.08); }
  }
  @keyframes pa-orb2 {
    0%,100% { transform: translate(0,0) scale(1); }
    50%     { transform: translate(-30px,25px) scale(0.95); }
  }
  @keyframes pa-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pa-badge-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
    50%     { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
  }

  .pa-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #0a0a1a, #1a0a2e, #0d1117);
    background-size: 300% 300%;
    animation: pa-bg-shift 14s ease infinite;
    padding: 20px;
  }

  .pa-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(90px);
    pointer-events: none;
    z-index: 0;
  }
  .pa-orb-1 {
    width: 480px; height: 480px;
    background: radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%);
    top: -160px; left: -160px;
    animation: pa-orb1 20s ease-in-out infinite;
  }
  .pa-orb-2 {
    width: 560px; height: 560px;
    background: radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%);
    bottom: -200px; right: -200px;
    animation: pa-orb2 24s ease-in-out infinite;
  }

  .pa-card {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 460px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 28px;
    padding: 48px 44px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.05),
      0 32px 80px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4);
    backdrop-filter: blur(20px);
    animation: pa-card-in 0.65s cubic-bezier(0.22,1,0.36,1) both;
  }

  .pa-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 6px 14px;
    color: rgba(255,255,255,0.55);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    margin-bottom: 32px;
    transition: all 0.2s;
    outline: none;
  }
  .pa-back-btn:hover {
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.85);
    border-color: rgba(255,255,255,0.2);
  }

  .pa-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(239,68,68,0.12);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 50px;
    padding: 6px 14px;
    margin-bottom: 28px;
    animation: pa-badge-pulse 2.5s ease-in-out infinite;
  }
  .pa-badge-dot {
    width: 8px; height: 8px;
    background: #ef4444;
    border-radius: 50%;
    box-shadow: 0 0 6px #ef4444;
  }
  .pa-badge span {
    color: #fca5a5;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.8px;
    text-transform: uppercase;
  }

  .pa-icon-wrap {
    width: 60px; height: 60px;
    background: linear-gradient(135deg, #ef4444 0%, #7c3aed 100%);
    border-radius: 18px;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; color: white;
    margin-bottom: 20px;
    box-shadow: 0 8px 24px rgba(239,68,68,0.35);
  }

  .pa-title {
    font-size: 26px;
    font-weight: 800;
    color: #ffffff;
    margin: 0 0 8px 0;
    letter-spacing: -0.5px;
    line-height: 1.2;
  }
  .pa-sub {
    font-size: 13.5px;
    color: rgba(255,255,255,0.45);
    margin: 0 0 36px 0;
    line-height: 1.5;
  }

  .pa-label {
    font-size: 12.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.6);
    margin-bottom: 6px;
    display: block;
    letter-spacing: 0.3px;
  }

  .pa-input .ant-input,
  .pa-input.ant-input,
  .pa-input .ant-input-password,
  .pa-input.ant-input-affix-wrapper {
    height: 48px !important;
    border-radius: 12px !important;
    border: 1.5px solid rgba(255,255,255,0.1) !important;
    font-size: 14px !important;
    background: rgba(255,255,255,0.05) !important;
    color: white !important;
    transition: all 0.2s !important;
    padding: 0 14px !important;
  }
  .pa-input .ant-input::placeholder,
  .pa-input.ant-input::placeholder { color: rgba(255,255,255,0.25) !important; }
  .pa-input .ant-input:focus,
  .pa-input.ant-input:focus,
  .pa-input.ant-input-affix-wrapper:focus-within {
    border-color: rgba(239,68,68,0.6) !important;
    background: rgba(255,255,255,0.08) !important;
    box-shadow: 0 0 0 3px rgba(239,68,68,0.12) !important;
  }
  .pa-input .ant-input-prefix { color: rgba(255,255,255,0.3); margin-right: 10px; }
  .pa-input .ant-input-suffix .anticon { color: rgba(255,255,255,0.3) !important; }
  .pa-input .ant-input-password input { color: white !important; background: transparent !important; }

  .pa-submit-btn {
    width: 100%;
    height: 52px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #ef4444 0%, #7c3aed 100%);
    border: none;
    box-shadow: 0 4px 20px rgba(239,68,68,0.35);
    transition: all 0.25s ease;
    letter-spacing: 0.3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 8px;
    outline: none;
  }
  .pa-submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(239,68,68,0.5);
  }
  .pa-submit-btn:active:not(:disabled) { transform: translateY(0); }
  .pa-submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }

  .pa-spin {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: pa-spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  .pa-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 10px;
    padding: 10px 14px;
    color: #fca5a5;
    font-size: 13px;
    margin-bottom: 16px;
    text-align: center;
  }

  .pa-forgot-link {
    background: none;
    border: none;
    color: rgba(252,165,165,0.85);
    font-size: 13px;
    cursor: pointer;
    padding: 0;
    margin-top: 4px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .pa-forgot-link:hover { color: #fca5a5; }

  .pa-resend {
    text-align: center;
    margin-top: 16px;
    font-size: 13px;
    color: rgba(255,255,255,0.4);
  }
  .pa-resend button {
    background: none;
    border: none;
    color: rgba(252,165,165,0.85);
    cursor: pointer;
    font-size: 13px;
    padding: 0;
    text-decoration: underline;
  }
  .pa-resend button:disabled {
    color: rgba(255,255,255,0.25);
    cursor: not-allowed;
    text-decoration: none;
  }

  .pa-footer {
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: rgba(255,255,255,0.25);
    font-size: 11.5px;
  }
  .pa-footer-icon { color: rgba(239,68,68,0.5); font-size: 13px; }

  .ant-form-item-explain-error { color: #fca5a5 !important; font-size: 12px !important; }
  .ant-form-item-label > label { color: transparent !important; }

  @media (max-width: 520px) {
    .pa-card { padding: 36px 24px; }
    .pa-title { font-size: 22px; }
    .pa-icon-wrap { width: 52px; height: 52px; font-size: 24px; }
    .pa-root { padding: 12px; }
  }
`;

export default function PlatformAdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [view, setView] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [fpEmail, setFpEmail] = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpResendTimer, setFpResendTimer] = useState(0);
  const [form] = Form.useForm();
  const [loginOtpForm] = Form.useForm();
  const [fpForm] = Form.useForm();
  const fpTimerRef = useRef(null);

  useEffect(() => {
    if (platformToken.get()) {
      navigate('/platform/dashboard', { replace: true });
      return;
    }
    (async () => {
      try {
        const res = await platformApi.get('/platform/auth/setup-status');
        if (res.success && res.data?.needsSetup) {
          setNeedsSetup(true);
          setView('setup');
        }
      } catch {
        // fall back to login form
      } finally {
        setBootLoading(false);
      }
    })();
  }, [navigate]);

  useEffect(() => () => clearInterval(fpTimerRef.current), []);

  const startFpResendTimer = () => {
    setFpResendTimer(60);
    clearInterval(fpTimerRef.current);
    fpTimerRef.current = setInterval(() => {
      setFpResendTimer((t) => {
        if (t <= 1) {
          clearInterval(fpTimerRef.current);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleAuthSuccess = (res) => {
    if (res.success && res.data?.requiresOtp) {
      setLoginEmail(res.data.email);
      setView('login_otp');
      loginOtpForm.resetFields();
      startFpResendTimer();
      message.success('OTP sent to your email.');
      return true;
    }
    if (res.success && res.data?.token) {
      platformToken.set(res.data.token);
      navigate('/platform/dashboard', { replace: true });
      return true;
    }
    setError(res.error || 'Authentication failed');
    return false;
  };

  const onLogin = async (values) => {
    setLoading(true);
    setError('');
    try {
      const res = await platformApi.post('/platform/auth/login', {
        email: values.email,
        password: values.password,
      });
      handleAuthSuccess(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onLoginOtpSubmit = async ({ otp }) => {
    setLoading(true);
    setError('');
    try {
      const res = await platformApi.post('/platform/auth/verify-login-otp', {
        email: loginEmail,
        otp,
      });
      handleAuthSuccess(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const onLoginResendOtp = async () => {
    if (fpResendTimer > 0 || !loginEmail) return;
    const password = form.getFieldValue('password');
    if (!password) {
      message.error('Go back and enter your password to resend OTP.');
      return;
    }
    setLoading(true);
    try {
      const res = await platformApi.post('/platform/auth/login', {
        email: loginEmail,
        password,
      });
      if (res.success && res.data?.requiresOtp) {
        message.success('OTP resent.');
        startFpResendTimer();
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const onSetup = async (values) => {
    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await platformApi.post('/platform/auth/setup', {
        email: values.email,
        password: values.password,
        name: values.name,
      });
      if (handleAuthSuccess(res)) {
        message.success('Platform admin account created.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Setup failed.');
    } finally {
      setLoading(false);
    }
  };

  const openForgotPassword = () => {
    setView('fp_email');
    setFpEmail('');
    setFpResetToken('');
    setError('');
    fpForm.resetFields();
  };

  const closeForgotPassword = () => {
    setView('login');
    setError('');
    clearInterval(fpTimerRef.current);
    fpForm.resetFields();
  };

  const onFpEmailSubmit = async ({ email }) => {
    setLoading(true);
    setError('');
    try {
      const res = await platformApi.post('/platform/auth/forgot-password', { email });
      if (res.success) {
        setFpEmail(email);
        setView('fp_otp');
        fpForm.resetFields();
        startFpResendTimer();
        message.success('OTP sent to your email.');
      } else {
        setError(res.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const onFpOtpSubmit = async ({ otp }) => {
    setLoading(true);
    setError('');
    try {
      const res = await platformApi.post('/platform/auth/verify-reset-otp', { email: fpEmail, otp });
      if (res.success) {
        setFpResetToken(res.data.resetToken);
        setView('fp_newpass');
        fpForm.resetFields();
      } else {
        setError(res.error || 'Invalid OTP');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const onFpNewPassSubmit = async ({ newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await platformApi.post('/platform/auth/reset-password', {
        resetToken: fpResetToken,
        newPassword,
      });
      if (res.success) {
        message.success('Password reset successfully. Please sign in.');
        closeForgotPassword();
        form.resetFields();
      } else {
        setError(res.error || 'Reset failed.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  const onFpResendOtp = async () => {
    if (fpResendTimer > 0) return;
    setLoading(true);
    try {
      await platformApi.post('/platform/auth/forgot-password', { email: fpEmail });
      message.success('OTP resent.');
      startFpResendTimer();
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: { title: 'Admin Portal', sub: 'Restricted access — service provider only.\nManage institutions, subscriptions & platform settings.' },
    login_otp: { title: 'Two-Factor Verification', sub: `Enter the 6-digit code sent to ${loginEmail}.` },
    setup: { title: 'Initial Setup', sub: 'Create the first platform admin account.\nCredentials are stored securely in the database.' },
    fp_email: { title: 'Forgot Password', sub: 'Enter your registered platform admin email.\nWe will send a one-time code to reset your password.' },
    fp_otp: { title: 'Verify OTP', sub: `Enter the 6-digit code sent to ${fpEmail}.` },
    fp_newpass: { title: 'New Password', sub: 'Choose a strong password for your platform admin account.' },
  };
  const copy = titles[view] || titles.login;

  if (bootLoading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="pa-root">
          <div className="pa-card" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
            <div className="pa-spin" style={{ margin: '0 auto 12px' }} />
            Loading...
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="pa-root">
        <div className="pa-orb pa-orb-1" />
        <div className="pa-orb pa-orb-2" />

        <div className="pa-card">
          <button
            className="pa-back-btn"
            onClick={() => {
              if (view === 'login_otp') {
                setView('login');
                setError('');
                clearInterval(fpTimerRef.current);
                setFpResendTimer(0);
              } else if (view.startsWith('fp_')) closeForgotPassword();
              else window.location.href = '/login';
            }}
          >
            <ArrowLeftOutlined style={{ fontSize: 11 }} />
            {view === 'login_otp' || view.startsWith('fp_') ? 'Back to admin login' : 'Back to application login'}
          </button>

          <div className="pa-badge">
            <div className="pa-badge-dot" />
            <span>Platform Admin</span>
          </div>

          <div className="pa-icon-wrap">
            <SafetyCertificateOutlined />
          </div>

          <div className="pa-title">{copy.title}</div>
          <div className="pa-sub" style={{ whiteSpace: 'pre-line' }}>{copy.sub}</div>

          {error && <div className="pa-error">{error}</div>}

          {view === 'login' && (
            <Form form={form} onFinish={onLogin} layout="vertical" size="large">
              <Form.Item
                label={<span className="pa-label">Admin Email</span>}
                name="email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input
                  className="pa-input"
                  prefix={<MailOutlined style={{ fontSize: 15 }} />}
                  placeholder="admin@yourplatform.com"
                />
              </Form.Item>

              <Form.Item
                label={<span className="pa-label">Password</span>}
                name="password"
                rules={[{ required: true, message: 'Password is required' }]}
              >
                <Input.Password
                  className="pa-input"
                  prefix={<LockOutlined style={{ fontSize: 15 }} />}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                />
              </Form.Item>

              <div style={{ textAlign: 'right', marginBottom: 8 }}>
                <button type="button" className="pa-forgot-link" onClick={openForgotPassword}>
                  Forgot password?
                </button>
              </div>

              <Form.Item style={{ marginBottom: 0 }}>
                <button type="submit" className="pa-submit-btn" disabled={loading}>
                  {loading
                    ? <><div className="pa-spin" /> Authenticating...</>
                    : <>Access Admin Panel <ArrowRightOutlined /></>}
                </button>
              </Form.Item>
            </Form>
          )}

          {view === 'setup' && needsSetup && (
            <Form form={form} onFinish={onSetup} layout="vertical" size="large">
              <Form.Item
                label={<span className="pa-label">Full Name</span>}
                name="name"
                rules={[{ required: true, message: 'Name is required' }]}
              >
                <Input
                  className="pa-input"
                  prefix={<UserOutlined style={{ fontSize: 15 }} />}
                  placeholder="Platform Administrator"
                />
              </Form.Item>

              <Form.Item
                label={<span className="pa-label">Admin Email</span>}
                name="email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input
                  className="pa-input"
                  prefix={<MailOutlined style={{ fontSize: 15 }} />}
                  placeholder="admin@yourplatform.com"
                />
              </Form.Item>

              <Form.Item
                label={<span className="pa-label">Password</span>}
                name="password"
                rules={[
                  { required: true, message: 'Password is required' },
                  { min: 8, message: 'At least 8 characters' },
                ]}
              >
                <Input.Password
                  className="pa-input"
                  prefix={<LockOutlined style={{ fontSize: 15 }} />}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                label={<span className="pa-label">Confirm Password</span>}
                name="confirmPassword"
                rules={[{ required: true, message: 'Please confirm your password' }]}
              >
                <Input.Password
                  className="pa-input"
                  prefix={<LockOutlined style={{ fontSize: 15 }} />}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <button type="submit" className="pa-submit-btn" disabled={loading}>
                  {loading
                    ? <><div className="pa-spin" /> Creating account...</>
                    : <>Create Admin Account <ArrowRightOutlined /></>}
                </button>
              </Form.Item>
            </Form>
          )}

          {view === 'login_otp' && (
            <Form form={loginOtpForm} onFinish={onLoginOtpSubmit} layout="vertical" size="large">
              <Form.Item
                label={<span className="pa-label">One-Time Password</span>}
                name="otp"
                rules={[
                  { required: true, message: 'OTP is required' },
                  { len: 6, message: 'Enter the 6-digit OTP' },
                ]}
              >
                <Input
                  className="pa-input"
                  prefix={<LockOutlined style={{ fontSize: 15 }} />}
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <button type="submit" className="pa-submit-btn" disabled={loading}>
                  {loading ? <><div className="pa-spin" /> Verifying...</> : <>Verify & sign in <ArrowRightOutlined /></>}
                </button>
              </Form.Item>

              <div className="pa-resend">
                {fpResendTimer > 0
                  ? `Resend OTP in ${fpResendTimer}s`
                  : <button type="button" onClick={onLoginResendOtp} disabled={loading}>Resend OTP</button>}
              </div>
            </Form>
          )}

          {view === 'fp_email' && (
            <Form form={fpForm} onFinish={onFpEmailSubmit} layout="vertical" size="large">
              <Form.Item
                label={<span className="pa-label">Admin Email</span>}
                name="email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Enter a valid email' },
                ]}
              >
                <Input
                  className="pa-input"
                  prefix={<MailOutlined style={{ fontSize: 15 }} />}
                  placeholder="admin@yourplatform.com"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <button type="submit" className="pa-submit-btn" disabled={loading}>
                  {loading ? <><div className="pa-spin" /> Sending OTP...</> : <>Send OTP <ArrowRightOutlined /></>}
                </button>
              </Form.Item>
            </Form>
          )}

          {view === 'fp_otp' && (
            <Form form={fpForm} onFinish={onFpOtpSubmit} layout="vertical" size="large">
              <Form.Item
                label={<span className="pa-label">One-Time Password</span>}
                name="otp"
                rules={[
                  { required: true, message: 'OTP is required' },
                  { len: 6, message: 'Enter the 6-digit OTP' },
                ]}
              >
                <Input
                  className="pa-input"
                  prefix={<LockOutlined style={{ fontSize: 15 }} />}
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <button type="submit" className="pa-submit-btn" disabled={loading}>
                  {loading ? <><div className="pa-spin" /> Verifying...</> : <>Verify OTP <ArrowRightOutlined /></>}
                </button>
              </Form.Item>

              <div className="pa-resend">
                {fpResendTimer > 0
                  ? `Resend OTP in ${fpResendTimer}s`
                  : <button type="button" onClick={onFpResendOtp} disabled={loading}>Resend OTP</button>}
              </div>
            </Form>
          )}

          {view === 'fp_newpass' && (
            <Form form={fpForm} onFinish={onFpNewPassSubmit} layout="vertical" size="large">
              <Form.Item
                label={<span className="pa-label">New Password</span>}
                name="newPassword"
                rules={[
                  { required: true, message: 'Password is required' },
                  { min: 8, message: 'At least 8 characters' },
                ]}
              >
                <Input.Password
                  className="pa-input"
                  prefix={<LockOutlined style={{ fontSize: 15 }} />}
                  placeholder="New password"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item
                label={<span className="pa-label">Confirm Password</span>}
                name="confirmPassword"
                rules={[{ required: true, message: 'Please confirm your password' }]}
              >
                <Input.Password
                  className="pa-input"
                  prefix={<LockOutlined style={{ fontSize: 15 }} />}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 0 }}>
                <button type="submit" className="pa-submit-btn" disabled={loading}>
                  {loading ? <><div className="pa-spin" /> Resetting...</> : <>Reset Password <ArrowRightOutlined /></>}
                </button>
              </Form.Item>
            </Form>
          )}

          <div className="pa-footer">
            <SafetyCertificateOutlined className="pa-footer-icon" />
            <span>This portal is monitored & access is logged</span>
          </div>
        </div>
      </div>
    </>
  );
}
