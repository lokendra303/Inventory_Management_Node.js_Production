import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Button, Row, Col, message } from 'antd';
import {
  MobileOutlined, LockOutlined, MailOutlined, ShopOutlined,
  ArrowRightOutlined, CheckCircleFilled, IdcardOutlined,
  LineChartOutlined, SafetyCertificateOutlined, ApartmentOutlined,
  UserOutlined, PhoneOutlined
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: Math.random() * 6 + 3,
  x: Math.random() * 100,
  y: Math.random() * 100,
  dur: Math.random() * 14 + 10,
  delay: Math.random() * 8,
}));

const FEATURES = [
  { icon: <LineChartOutlined />, title: 'Real-time Analytics', desc: 'Live dashboards & smart reports' },
  { icon: <SafetyCertificateOutlined />, title: 'Enterprise Security', desc: 'Bank-grade data protection' },
  { icon: <ApartmentOutlined />, title: 'Multi-branch Ready', desc: 'Manage all locations in one place' },
];

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  .ims-auth * { font-family: 'Inter', sans-serif; }

  @keyframes ims-bg-shift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes ims-particle {
    0%,100% { transform: translateY(0) scale(1); opacity: 0.18; }
    50%      { transform: translateY(-38px) scale(1.3); opacity: 0.38; }
  }
  @keyframes ims-card-in {
    from { opacity: 0; transform: translateY(40px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes ims-left-in {
    from { opacity: 0; transform: translateX(-30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ims-right-in {
    from { opacity: 0; transform: translateX(30px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes ims-tab-slide {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ims-logo-glow {
    0%,100% { text-shadow: 0 0 20px rgba(255,255,255,0.3); }
    50%      { text-shadow: 0 0 40px rgba(255,255,255,0.7), 0 0 80px rgba(167,139,250,0.4); }
  }
  @keyframes ims-orb1 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(40px,-30px) scale(1.1); }
    66%     { transform: translate(-20px,20px) scale(0.95); }
  }
  @keyframes ims-orb2 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%     { transform: translate(-50px,30px) scale(1.05); }
    66%     { transform: translate(30px,-40px) scale(0.9); }
  }
  @keyframes ims-check {
    from { transform: scale(0) rotate(-45deg); opacity: 0; }
    to   { transform: scale(1) rotate(0deg); opacity: 1; }
  }

  .ims-auth {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
    background-size: 300% 300%;
    animation: ims-bg-shift 12s ease infinite;
    padding: 20px;
  }

  .ims-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
  }
  .ims-orb-1 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(102,126,234,0.35) 0%, transparent 70%);
    top: -150px; left: -150px;
    animation: ims-orb1 18s ease-in-out infinite;
  }
  .ims-orb-2 {
    width: 600px; height: 600px;
    background: radial-gradient(circle, rgba(118,75,162,0.3) 0%, transparent 70%);
    bottom: -200px; right: -200px;
    animation: ims-orb2 22s ease-in-out infinite;
  }
  .ims-orb-3 {
    width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(236,72,153,0.15) 0%, transparent 70%);
    top: 40%; left: 40%;
    animation: ims-orb1 15s ease-in-out infinite reverse;
  }

  .ims-particle {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,255,255,0.6);
    pointer-events: none;
    z-index: 1;
  }

  .ims-card {
    position: relative;
    z-index: 10;
    width: 100%;
    max-width: 1060px;
    border-radius: 28px;
    overflow: hidden;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.08),
      0 32px 80px rgba(0,0,0,0.55),
      0 8px 24px rgba(0,0,0,0.3);
    animation: ims-card-in 0.7s cubic-bezier(0.22,1,0.36,1) both;
    display: flex;
    min-height: 620px;
  }

  /* ── LEFT PANEL ── */
  .ims-left {
    flex: 0 0 42%;
    background: linear-gradient(160deg, #667eea 0%, #764ba2 55%, #f093fb 100%);
    padding: 56px 44px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
    overflow: hidden;
    animation: ims-left-in 0.8s 0.2s cubic-bezier(0.22,1,0.36,1) both;
  }
  .ims-left::before {
    content: '';
    position: absolute;
    inset: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .ims-left-inner { position: relative; z-index: 2; }

  .ims-logo-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.25);
    border-radius: 50px;
    padding: 8px 18px;
    margin-bottom: 32px;
    backdrop-filter: blur(10px);
  }
  .ims-logo-dot {
    width: 10px; height: 10px;
    background: #4ade80;
    border-radius: 50%;
    box-shadow: 0 0 8px #4ade80;
  }
  .ims-logo-badge span {
    color: white;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  .ims-brand-name {
    font-size: 42px;
    font-weight: 800;
    color: white;
    line-height: 1.1;
    margin-bottom: 14px;
    animation: ims-logo-glow 4s ease-in-out infinite;
    letter-spacing: -1px;
  }
  .ims-brand-sub {
    font-size: 15px;
    color: rgba(255,255,255,0.8);
    font-weight: 400;
    line-height: 1.6;
    margin-bottom: 44px;
  }

  .ims-feature {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 22px;
    padding: 16px 18px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 16px;
    backdrop-filter: blur(8px);
    transition: background 0.2s;
  }
  .ims-feature:hover { background: rgba(255,255,255,0.18); }
  .ims-feature-icon {
    width: 40px; height: 40px;
    background: rgba(255,255,255,0.2);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; color: white; flex-shrink: 0;
  }
  .ims-feature-title { font-size: 14px; font-weight: 700; color: white; margin-bottom: 2px; }
  .ims-feature-desc  { font-size: 12px; color: rgba(255,255,255,0.75); }

  .ims-left-footer {
    display: flex; align-items: center; gap: 8px;
    color: rgba(255,255,255,0.6); font-size: 12px;
  }
  .ims-left-footer-dot { width: 6px; height: 6px; background: rgba(255,255,255,0.4); border-radius: 50%; }

  /* ── RIGHT PANEL ── */
  .ims-right {
    flex: 1;
    background: #ffffff;
    padding: 52px 48px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    animation: ims-right-in 0.8s 0.3s cubic-bezier(0.22,1,0.36,1) both;
    overflow-y: auto;
  }

  .ims-tab-switcher {
    display: flex;
    background: #f4f4f8;
    border-radius: 14px;
    padding: 5px;
    margin-bottom: 36px;
    gap: 4px;
  }
  .ims-tab-btn {
    flex: 1;
    padding: 11px 0;
    border: none;
    background: transparent;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    color: #888;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.22,1,0.36,1);
    letter-spacing: 0.2px;
  }
  .ims-tab-btn.active {
    background: white;
    color: #667eea;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  }

  .ims-form-head { margin-bottom: 32px; }
  .ims-form-icon-wrap {
    width: 56px; height: 56px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 16px;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px;
    margin-bottom: 18px;
    box-shadow: 0 8px 20px rgba(102,126,234,0.35);
  }
  .ims-form-title {
    font-size: 24px; font-weight: 800;
    color: #111827; margin: 0 0 6px 0; letter-spacing: -0.5px;
    line-height: 1.2;
  }
  .ims-form-sub {
    font-size: 13.5px; color: #9ca3af;
    margin: 0; line-height: 1.5;
  }

  .ims-form-wrap { animation: ims-tab-slide 0.3s ease both; }

  .ims-label {
    font-size: 13px; font-weight: 600;
    color: #374151; margin-bottom: 6px; display: block;
  }

  .ims-input .ant-input,
  .ims-input.ant-input,
  .ims-input .ant-input-password,
  .ims-input.ant-input-affix-wrapper {
    height: 48px !important;
    border-radius: 12px !important;
    border: 1.5px solid #e5e7eb !important;
    font-size: 14px !important;
    background: #fafafa !important;
    transition: all 0.2s !important;
    padding: 0 14px !important;
  }
  .ims-input .ant-input:focus,
  .ims-input.ant-input:focus,
  .ims-input.ant-input-affix-wrapper:focus-within {
    border-color: #667eea !important;
    background: white !important;
    box-shadow: 0 0 0 3px rgba(102,126,234,0.12) !important;
  }
  .ims-input .ant-input-prefix { color: #9ca3af; margin-right: 10px; }

  .ims-submit-btn {
    width: 100%;
    height: 52px !important;
    border-radius: 14px !important;
    font-size: 15px !important;
    font-weight: 700 !important;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border: none !important;
    box-shadow: 0 4px 20px rgba(102,126,234,0.4) !important;
    transition: all 0.25s !important;
    letter-spacing: 0.3px;
    margin-top: 4px;
  }
  .ims-submit-btn:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 28px rgba(102,126,234,0.55) !important;
  }
  .ims-submit-btn:active { transform: translateY(0) !important; }

  .ims-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 20px 0; color: #d1d5db; font-size: 12px;
  }
  .ims-divider::before, .ims-divider::after {
    content: ''; flex: 1; height: 1px; background: #e5e7eb;
  }

  .ims-trust {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; margin-top: 20px;
    font-size: 12px; color: #9ca3af;
  }
  .ims-trust-icon { color: #4ade80; font-size: 14px; animation: ims-check 0.5s 1s ease both; }

  .ims-switch-text {
    text-align: center; margin-top: 16px;
    font-size: 13px; color: #6b7280;
  }
  .ims-switch-link {
    color: #667eea; font-weight: 600; cursor: pointer;
    background: none; border: none; padding: 0;
    transition: color 0.2s;
  }
  .ims-switch-link:hover { color: #764ba2; text-decoration: underline; }

  @media (max-width: 768px) {
    .ims-left { display: none; }
    .ims-right { padding: 36px 24px; }
    .ims-card { border-radius: 20px; min-height: unset; }
  }
`;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [loginForm] = Form.useForm();
  const [regForm] = Form.useForm();
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const onLogin = async (values) => {
    setLoading(true);
    try {
      const result = await login(values);
      if (result.success) navigate('/dashboard', { replace: true });
    } finally { setLoading(false); }
  };

  const onRegister = async (values) => {
    setLoading(true);
    try {
      const result = await register(values);
      if (result.success) {
        setActiveTab('login');
        regForm.resetFields();
      }
    } finally { setLoading(false); }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    loginForm.resetFields();
    regForm.resetFields();
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="ims-auth">
        {/* Orbs */}
        <div className="ims-orb ims-orb-1" />
        <div className="ims-orb ims-orb-2" />
        <div className="ims-orb ims-orb-3" />

        {/* Particles */}
        {PARTICLES.map(p => (
          <div key={p.id} className="ims-particle" style={{
            width: p.size, height: p.size,
            left: `${p.x}%`, top: `${p.y}%`,
            animation: `ims-particle ${p.dur}s ${p.delay}s ease-in-out infinite`,
          }} />
        ))}

        <div className="ims-card">
          {/* ── LEFT ── */}
          <div className="ims-left">
            <div className="ims-left-inner">
              <div className="ims-logo-badge">
                <div className="ims-logo-dot" />
                <span>IMS SEPCUNE v2.0</span>
              </div>
              <div className="ims-brand-name">Inventory<br />Management<br />System</div>
              <div className="ims-brand-sub">
                The all-in-one platform to manage stock,<br />
                sales, purchases & reports — effortlessly.
              </div>
              {FEATURES.map((f, i) => (
                <div className="ims-feature" key={i}>
                  <div className="ims-feature-icon">{f.icon}</div>
                  <div>
                    <div className="ims-feature-title">{f.title}</div>
                    <div className="ims-feature-desc">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="ims-left-footer">
              <div className="ims-left-footer-dot" />
              <span>Trusted by 500+ businesses worldwide</span>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div className="ims-right">
            {/* Tab Switcher */}
            <div className="ims-tab-switcher">
              <button className={`ims-tab-btn${activeTab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>
                Sign In
              </button>
              <button className={`ims-tab-btn${activeTab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>
                Create Account
              </button>
            </div>

            {/* Form Head */}
            <div className="ims-form-head">
              <div className="ims-form-icon-wrap">
                {activeTab === 'login' ? <LockOutlined /> : <ShopOutlined />}
              </div>
              <div className="ims-form-title">
                {activeTab === 'login' ? 'Sign in to your account' : 'Create your account'}
              </div>
              <div className="ims-form-sub">
                {activeTab === 'login'
                  ? 'Access your inventory dashboard securely'
                  : 'Set up your company workspace in minutes'}
              </div>
            </div>

            {/* LOGIN FORM */}
            {activeTab === 'login' && (
              <div className="ims-form-wrap" key="login">
                <Form form={loginForm} onFinish={onLogin} layout="vertical" size="large">
                  <Form.Item
                    label={<span className="ims-label">Email Address</span>}
                    name="email"
                    rules={[
                      { required: true, message: 'Email is required' },
                      { type: 'email', message: 'Enter a valid email' }
                    ]}
                  >
                    <Input className="ims-input" prefix={<MailOutlined style={{fontSize:15}} />} placeholder="you@company.com" />
                  </Form.Item>

                  <Form.Item
                    label={<span className="ims-label">Password</span>}
                    name="password"
                    rules={[{ required: true, message: 'Password is required' }]}
                  >
                    <Input.Password className="ims-input" prefix={<LockOutlined style={{fontSize:15}} />} placeholder="Enter your password" autoComplete="current-password" />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button htmlType="submit" loading={loading} className="ims-submit-btn" type="primary">
                      {!loading && <span>Sign In <ArrowRightOutlined style={{ marginLeft: 6 }} /></span>}
                    </Button>
                  </Form.Item>
                </Form>

                <div className="ims-trust">
                  <CheckCircleFilled className="ims-trust-icon" />
                  <span>Your data is encrypted & secure</span>
                </div>

                <div className="ims-switch-text">
                  Don't have an account?{' '}
                  <button className="ims-switch-link" onClick={() => switchTab('register')}>Create one free</button>
                </div>
              </div>
            )}

            {/* REGISTER FORM */}
            {activeTab === 'register' && (
              <div className="ims-form-wrap" key="register">
                <Form form={regForm} onFinish={onRegister} layout="vertical" size="large">
                  <Form.Item
                    label={<span className="ims-label">Company Name</span>}
                    name="name"
                    rules={[{ required: true, message: 'Company name is required' }]}
                  >
                    <Input className="ims-input" prefix={<ShopOutlined style={{fontSize:15}} />} placeholder="Your Company Ltd." />
                  </Form.Item>

                  <Row gutter={14}>
                    <Col span={12}>
                      <Form.Item
                        label={<span className="ims-label">First Name</span>}
                        name="adminFirstName"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <Input className="ims-input" prefix={<IdcardOutlined style={{fontSize:15}} />} placeholder="John" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        label={<span className="ims-label">Last Name</span>}
                        name="adminLastName"
                        rules={[{ required: true, message: 'Required' }]}
                      >
                        <Input className="ims-input" prefix={<IdcardOutlined style={{fontSize:15}} />} placeholder="Doe" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    label={<span className="ims-label">Mobile Number</span>}
                    name="adminMobile"
                    rules={[
                      { required: true, message: 'Mobile number is required' },
                      { pattern: /^[0-9+\-\s()]{10,20}$/, message: 'Enter a valid mobile number' }
                    ]}
                  >
                    <Input className="ims-input" prefix={<MobileOutlined style={{fontSize:15}} />} placeholder="+92 300 1234567" />
                  </Form.Item>

                  <Form.Item
                    label={<span className="ims-label">Admin Email</span>}
                    name="adminEmail"
                    rules={[
                      { required: true, message: 'Email is required' },
                      { type: 'email', message: 'Enter a valid email' }
                    ]}
                  >
                    <Input className="ims-input" prefix={<MailOutlined style={{fontSize:15}} />} placeholder="admin@company.com" />
                  </Form.Item>

                  <Form.Item
                    label={<span className="ims-label">Password</span>}
                    name="adminPassword"
                    rules={[
                      { required: true, message: 'Password is required' },
                      { min: 8, message: 'Minimum 8 characters' }
                    ]}
                  >
                    <Input.Password className="ims-input" prefix={<LockOutlined style={{fontSize:15}} />} placeholder="Min. 8 characters" autoComplete="new-password" />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 0 }}>
                    <Button htmlType="submit" loading={loading} className="ims-submit-btn" type="primary">
                      {!loading && <span>Create Account <ArrowRightOutlined style={{ marginLeft: 6 }} /></span>}
                    </Button>
                  </Form.Item>
                </Form>

                <div className="ims-switch-text" style={{ marginTop: 16 }}>
                  Already have an account?{' '}
                  <button className="ims-switch-link" onClick={() => switchTab('login')}>Sign in</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
