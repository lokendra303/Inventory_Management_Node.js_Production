import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Row, Col, message } from 'antd';
import {
  MobileOutlined, LockOutlined, MailOutlined, ShopOutlined,
  ArrowRightOutlined, CheckCircleFilled, IdcardOutlined,
  LineChartOutlined, SafetyCertificateOutlined, ApartmentOutlined,
  UserOutlined, PhoneOutlined
} from '@ant-design/icons';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';
import { SettingOutlined } from '@ant-design/icons';

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
    height: 52px;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 700;
    color: #fff;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    box-shadow: 0 4px 20px rgba(102,126,234,0.4);
    transition: all 0.25s ease;
    letter-spacing: 0.3px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
    outline: none;
  }
  .ims-submit-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 28px rgba(102,126,234,0.55);
    background: linear-gradient(135deg, #7b8ff5 0%, #8a5cb8 100%);
  }
  .ims-submit-btn:active {
    transform: translateY(0);
    box-shadow: 0 4px 20px rgba(102,126,234,0.4);
  }
  .ims-submit-btn:disabled {
    opacity: 0.75;
    cursor: not-allowed;
    transform: none;
  }
  .ims-spin {
    width: 18px; height: 18px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: ims-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes ims-spin {
    to { transform: rotate(360deg); }
  }

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

  .ims-admin-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 28px;
    padding-top: 20px;
    border-top: 1px solid #f0f0f4;
  }
  .ims-admin-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 12px;
    font-weight: 500;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.2s;
    outline: none;
  }
  .ims-admin-btn:hover {
    border-color: #ef4444;
    color: #ef4444;
    background: rgba(239,68,68,0.04);
  }

  .ims-alert-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
    border: 1.5px solid #fecdd3;
    border-radius: 12px;
    padding: 12px 14px;
    margin-bottom: 14px;
    margin-top: 2px;
    animation: ims-alert-in 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }
  .ims-alert-error-icon {
    width: 28px; height: 28px; flex-shrink: 0;
    background: linear-gradient(135deg, #f43f5e, #e11d48);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; color: white; font-weight: 700;
  }
  .ims-alert-error-text {
    font-size: 13px; color: #9f1239; font-weight: 500; line-height: 1.5;
  }
  .ims-alert-error-title {
    font-size: 13px; font-weight: 700; color: #be123c; margin-bottom: 2px;
  }
  @keyframes ims-alert-in {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .ims-forgot-link {
    background: none; border: none; padding: 0;
    font-size: 13px; font-weight: 400; color: #ef4444;
    cursor: pointer; transition: color 0.2s;
    text-decoration: none;
  }
  .ims-forgot-link:hover { color: #dc2626; text-decoration: underline; text-underline-offset: 3px; }

  .ims-info-box {
    background: #f0f4ff;
    border: 1px solid #c7d2fe;
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 13px;
    color: #4338ca;
    margin-bottom: 20px;
    line-height: 1.6;
  }
  .ims-hint-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 14px;
    color: #166534;
    margin-bottom: 16px;
    text-align: center;
    font-weight: 600;
  }
  .ims-contact-box {
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 12px;
    padding: 14px 16px;
    font-size: 13px;
    color: #9a3412;
    margin-bottom: 16px;
    text-align: center;
    line-height: 1.6;
  }

  .ims-otp-inputs {
    display: flex;
    gap: 10px;
    justify-content: center;
    margin: 20px 0;
  }
  .ims-otp-info {
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    margin-bottom: 20px;
    line-height: 1.6;
  }
  .ims-otp-info strong { color: #374151; }
  .ims-resend-btn {
    background: none; border: none; cursor: pointer;
    font-size: 13px; font-weight: 600;
    padding: 0; transition: color 0.2s;
  }
  .ims-resend-btn:not(:disabled) { color: #667eea; }
  .ims-resend-btn:not(:disabled):hover { color: #764ba2; text-decoration: underline; }
  .ims-resend-btn:disabled { color: #9ca3af; cursor: not-allowed; }
  .ims-back-btn {
    background: none; border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 6px 14px; font-size: 13px; font-weight: 500;
    color: #6b7280; cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center; gap: 5px;
  }
  .ims-back-btn:hover { border-color: #667eea; color: #667eea; }

  @media (max-width: 768px) {
    .ims-left { display: none; }
    .ims-right { padding: 36px 24px; }
    .ims-card { border-radius: 20px; min-height: unset; }
  }
`;

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const [loginError, setLoginError] = useState('');
  const [loginForm] = Form.useForm();
  const [regForm] = Form.useForm();
  const [otpForm] = Form.useForm();
  const [fpForm] = Form.useForm();
  const { login, register, sendOtp, verifyOtp, verifyLoginOtp, forgotPassword, verifyResetOtp, resetPassword, getEmailHint } = useAuth();
  const navigate = useNavigate();

  // forgot-password view: null | 'fp_email' | 'fp_otp' | 'fp_newpass' | 'fp_mobile'
  const [fpView, setFpView] = useState(null);
  const [fpEmail, setFpEmail] = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [emailHint, setEmailHint] = useState(null);
  const [fpResendTimer, setFpResendTimer] = useState(0);
  const [fpError, setFpError] = useState('');
  const fpTimerRef = useRef(null);

  const startFpResendTimer = () => {
    setFpResendTimer(60);
    clearInterval(fpTimerRef.current);
    fpTimerRef.current = setInterval(() => {
      setFpResendTimer(t => { if (t <= 1) { clearInterval(fpTimerRef.current); return 0; } return t - 1; });
    }, 1000);
  };

  const openForgotPassword = () => {
    setFpView('fp_email');
    setFpEmail('');
    setFpResetToken('');
    setEmailHint(null);
    setFpError('');
    fpForm.resetFields();
  };

  const closeForgotPassword = () => {
    setFpView(null);
    setFpError('');
    clearInterval(fpTimerRef.current);
    fpForm.resetFields();
  };

  const onFpEmailSubmit = async ({ email }) => {
    setFpError('');
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      if (res && res.success) {
        setFpEmail(email);
        setFpView('fp_otp');
        fpForm.resetFields();
        startFpResendTimer();
        message.success('OTP sent to your email.');
      } else {
        setFpError(res?.error || 'Failed to send OTP');
      }
    } finally { setLoading(false); }
  };

  const onFpOtpSubmit = async ({ otp }) => {
    setLoading(true);
    try {
      const res = await verifyResetOtp(fpEmail, otp);
      if (res.success) {
        setFpResetToken(res.data.resetToken);
        setFpView('fp_newpass');
        fpForm.resetFields();
      } else {
        message.error(res.error || 'Invalid OTP');
      }
    } finally { setLoading(false); }
  };

  const onFpNewPassSubmit = async ({ newPassword, confirmPassword }) => {
    if (newPassword !== confirmPassword) { message.error('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await resetPassword(fpResetToken, newPassword);
      if (res.success) {
        message.success('Password reset successfully! Please login.');
        closeForgotPassword();
        loginForm.resetFields();
      } else {
        message.error(res.error || 'Reset failed.');
      }
    } finally { setLoading(false); }
  };

  const onFpResendOtp = async () => {
    if (fpResendTimer > 0) return;
    setLoading(true);
    try {
      await forgotPassword(fpEmail);
      message.success('OTP resent.');
      startFpResendTimer();
    } finally { setLoading(false); }
  };

  const onMobileHintSubmit = async ({ mobile }) => {
    setLoading(true);
    try {
      const res = await getEmailHint(mobile);
      setEmailHint(res);
    } finally { setLoading(false); }
  };

  // OTP step state
  const [otpStep, setOtpStep] = useState(false);       // show OTP input
  const [otpContext, setOtpContext] = useState(null);   // { type: 'login'|'register', mobile, email, formValues }
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);

  const startResendTimer = () => {
    setResendTimer(60);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; });
    }, 1000);
  };

  const triggerOtp = async (mobile, email, type, formValues) => {
    setLoading(true);
    try {
      const res = await sendOtp(mobile, email);
      if (res && res.success) {
        setOtpContext({ type, mobile, email, formValues });
        setOtpStep(true);
        otpForm.resetFields();
        startResendTimer();
        message.success('OTP sent to ' + email);
      } else {
        message.error((res && res.error) || 'Failed to send OTP');
      }
    } finally { setLoading(false); }
  };

  // Step 1 for login: validate credentials → backend sends OTP if valid
  const onLoginStep1 = async (values) => {
    setLoginError('');
    setLoading(true);
    try {
      const res = await login(values);
      if (res.success && res.otpRequired) {
        setOtpContext({ type: 'login', email: res.email, institutionId: res.institutionId, formValues: values });
        setOtpStep(true);
        otpForm.resetFields();
        startResendTimer();
      } else {
        setLoginError(res.error || 'Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const onRegisterStep1 = async (values) => {
    await triggerOtp(values.adminMobile, values.adminEmail, 'register', values);
  };

  const onOtpSubmit = async ({ otp }) => {
    setLoading(true);
    try {
      if (otpContext.type === 'login') {
        // Login OTP — verify and get JWT in one call
        const result = await verifyLoginOtp(otpContext.email, otp, otpContext.institutionId);
        if (result.success) navigate('/dashboard', { replace: true });
        else message.error(result.error || 'Invalid OTP');
      } else {
        // Registration OTP — verify email OTP then register
        const verifyRes = await verifyOtp(otpContext.email, otp);
        if (!verifyRes.success) { message.error(verifyRes.error || 'Invalid OTP'); return; }
        const result = await register(otpContext.formValues);
        if (result.success) {
          setOtpStep(false);
          setOtpContext(null);
          setActiveTab('login');
          regForm.resetFields();
        }
      }
    } finally { setLoading(false); }
  };

  const onResendOtp = async () => {
    if (resendTimer > 0) return;
    setLoading(true);
    try {
      let res;
      if (otpContext.type === 'login') {
        res = await login(otpContext.formValues);
      } else {
        res = await sendOtp(otpContext.email, otpContext.email);
      }
      if (res.success) { message.success('OTP resent to ' + otpContext.email); startResendTimer(); }
      else message.error(res.error || 'Failed to resend OTP');
    } finally { setLoading(false); }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setLoginError('');
    setOtpStep(false);
    setOtpContext(null);
    loginForm.resetFields();
    regForm.resetFields();
    otpForm.resetFields();
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
            {!fpView && (
            <div className="ims-tab-switcher">
              <button className={`ims-tab-btn${activeTab === 'login' ? ' active' : ''}`} onClick={() => switchTab('login')}>
                Sign In
              </button>
              <button className={`ims-tab-btn${activeTab === 'register' ? ' active' : ''}`} onClick={() => switchTab('register')}>
                Create Account
              </button>
            </div>
            )}

            {/* Form Head */}
            <div className="ims-form-head">
              <div className="ims-form-icon-wrap">
                {fpView ? <LockOutlined /> : otpStep ? <MobileOutlined /> : activeTab === 'login' ? <LockOutlined /> : <ShopOutlined />}
              </div>
              <div className="ims-form-title">
                {fpView === 'fp_email' ? 'Reset Your Password'
                  : fpView === 'fp_otp' ? 'Enter Verification Code'
                  : fpView === 'fp_newpass' ? 'Set New Password'
                  : fpView === 'fp_mobile' ? 'Retrieve Your Email'
                  : otpStep ? 'Enter Verification Code'
                  : activeTab === 'login' ? 'Sign in to your account' : 'Create your account'}
              </div>
              <div className="ims-form-sub">
                {fpView === 'fp_email' ? 'Enter your email to receive a reset OTP'
                  : fpView === 'fp_otp' ? <span>OTP sent to <strong>{fpEmail}</strong></span>
                  : fpView === 'fp_newpass' ? 'Choose a strong new password'
                  : fpView === 'fp_mobile' ? 'We\'ll show a hint of your registered email'
                  : otpStep ? <span>A 6-digit OTP was sent to <strong>{otpContext?.email}</strong></span>
                  : activeTab === 'login' ? 'Access your inventory dashboard securely'
                  : 'Set up your company workspace in minutes'}
              </div>
            </div>

            {/* OTP STEP */}
            {otpStep && !fpView && (
              <div className="ims-form-wrap" key="otp">
                <div className="ims-otp-info">
                  Check your email inbox for the 6-digit code.<br />
                  It expires in <strong>5 minutes</strong>.
                </div>
                <Form form={otpForm} onFinish={onOtpSubmit} layout="vertical" size="large">
                  <Form.Item
                    label={<span className="ims-label">6-Digit OTP</span>}
                    name="otp"
                    rules={[
                      { required: true, message: 'OTP is required' },
                      { len: 6, message: 'OTP must be 6 digits' },
                      { pattern: /^[0-9]{6}$/, message: 'OTP must be numeric' }
                    ]}
                  >
                    <Input
                      className="ims-input"
                      prefix={<MobileOutlined style={{ fontSize: 15 }} />}
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      style={{ letterSpacing: 6, fontSize: 20, textAlign: 'center' }}
                    />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 0 }}>
                    <button type="submit" className="ims-submit-btn" disabled={loading}>
                      {loading
                        ? <><div className="ims-spin" /> Verifying...</>
                        : <>Verify OTP <ArrowRightOutlined /></>}
                    </button>
                  </Form.Item>
                </Form>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <button className="ims-back-btn" onClick={() => { setOtpStep(false); setOtpContext(null); }}>
                    ← Back
                  </button>
                  <button
                    className="ims-resend-btn"
                    disabled={resendTimer > 0 || loading}
                    onClick={onResendOtp}
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            {/* LOGIN FORM */}
            {!otpStep && !fpView && activeTab === 'login' && (
              <div className="ims-form-wrap" key="login">
                <Form form={loginForm} onFinish={onLoginStep1} layout="vertical" size="large"
                  onValuesChange={() => setLoginError('')}
                >
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

                  {loginError && (
                    <div className="ims-alert-error">
                      <div className="ims-alert-error-icon">✕</div>
                      <div>
                        <div className="ims-alert-error-title">Login Failed</div>
                        <div className="ims-alert-error-text">{loginError}</div>
                      </div>
                    </div>
                  )}

                  <Form.Item style={{ marginBottom: 0 }}>
                    <button
                      type="submit"
                      className="ims-submit-btn"
                      disabled={loading}
                    >
                      {loading
                        ? <><div className="ims-spin" /> Sending OTP...</>
                        : <>Continue <ArrowRightOutlined /></>}
                    </button>
                  </Form.Item>
                </Form>

                <div className="ims-trust">
                  <CheckCircleFilled className="ims-trust-icon" />
                  <span>Your data is encrypted & secure</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>
                    Don't have an account?{' '}
                    <button className="ims-switch-link" onClick={() => switchTab('register')}>Create one free</button>
                  </span>
                  <button className="ims-forgot-link" onClick={openForgotPassword}>Forgot password?</button>
                </div>

                <div className="ims-admin-link">
                  <button className="ims-admin-btn" onClick={() => { window.location.href = '/platform/login'; }}>
                    <SettingOutlined style={{ fontSize: 11 }} />
                    Platform Admin
                  </button>
                </div>
              </div>
            )}

            {/* FORGOT PASSWORD FLOW */}
            {fpView && !otpStep && (
              <div className="ims-form-wrap" key={fpView}>

                {fpView === 'fp_email' && (
                  <>
                    <div className="ims-info-box">
                      Enter your registered email and we'll send a 6-digit OTP to reset your password.
                    </div>

                    {fpError && (
                      <div className="ims-alert-error">
                        <div className="ims-alert-error-icon">✕</div>
                        <div>
                          <div className="ims-alert-error-title">Email Not Found</div>
                          <div className="ims-alert-error-text">{fpError}</div>
                        </div>
                      </div>
                    )}

                    <Form form={fpForm} onFinish={onFpEmailSubmit} layout="vertical" size="large"
                      onValuesChange={() => setFpError('')}
                    >
                      <Form.Item
                        label={<span className="ims-label">Registered Email</span>}
                        name="email"
                        rules={[
                          { required: true, message: 'Email is required' },
                          { type: 'email', message: 'Enter a valid email' }
                        ]}
                      >
                        <Input className="ims-input" prefix={<MailOutlined style={{ fontSize: 15 }} />} placeholder="you@company.com" />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <button type="submit" className="ims-submit-btn" disabled={loading}>
                          {loading ? <><div className="ims-spin" /> Sending...</> : <>Send OTP <ArrowRightOutlined /></>}
                        </button>
                      </Form.Item>
                    </Form>
                    <div style={{ marginTop: 14, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>
                      Forgot your email too?{' '}
                      <button className="ims-switch-link" style={{ fontSize: 13 }} onClick={() => { setFpView('fp_mobile'); fpForm.resetFields(); setEmailHint(null); }}>Retrieve via mobile</button>
                    </div>
                    <div style={{ marginTop: 10, textAlign: 'center' }}>
                      <button className="ims-back-btn" style={{ margin: '0 auto' }} onClick={closeForgotPassword}>← Back to Login</button>
                    </div>
                  </>
                )}

                {fpView === 'fp_otp' && (
                  <>
                    <div className="ims-otp-info">
                      A 6-digit OTP was sent to <strong>{fpEmail}</strong>.<br />
                      It expires in <strong>5 minutes</strong>.
                    </div>
                    <Form form={fpForm} onFinish={onFpOtpSubmit} layout="vertical" size="large">
                      <Form.Item
                        label={<span className="ims-label">6-Digit OTP</span>}
                        name="otp"
                        rules={[
                          { required: true, message: 'OTP is required' },
                          { len: 6, message: 'OTP must be 6 digits' },
                          { pattern: /^[0-9]{6}$/, message: 'OTP must be numeric' }
                        ]}
                      >
                        <Input
                          className="ims-input"
                          prefix={<MobileOutlined style={{ fontSize: 15 }} />}
                          placeholder="Enter 6-digit OTP"
                          maxLength={6}
                          style={{ letterSpacing: 6, fontSize: 20, textAlign: 'center' }}
                        />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <button type="submit" className="ims-submit-btn" disabled={loading}>
                          {loading ? <><div className="ims-spin" /> Verifying...</> : <>Verify OTP <ArrowRightOutlined /></>}
                        </button>
                      </Form.Item>
                    </Form>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <button className="ims-back-btn" onClick={() => { setFpView('fp_email'); fpForm.resetFields(); }}>← Back</button>
                      <button className="ims-resend-btn" disabled={fpResendTimer > 0 || loading} onClick={onFpResendOtp}>
                        {fpResendTimer > 0 ? `Resend in ${fpResendTimer}s` : 'Resend OTP'}
                      </button>
                    </div>
                  </>
                )}

                {fpView === 'fp_newpass' && (
                  <>
                    <div className="ims-info-box">OTP verified! Set your new password below.</div>
                    <Form form={fpForm} onFinish={onFpNewPassSubmit} layout="vertical" size="large">
                      <Form.Item
                        label={<span className="ims-label">New Password</span>}
                        name="newPassword"
                        rules={[
                          { required: true, message: 'Password is required' },
                          { min: 8, message: 'Minimum 8 characters' }
                        ]}
                      >
                        <Input.Password className="ims-input" prefix={<LockOutlined style={{ fontSize: 15 }} />} placeholder="Min. 8 characters" autoComplete="new-password" />
                      </Form.Item>
                      <Form.Item
                        label={<span className="ims-label">Confirm Password</span>}
                        name="confirmPassword"
                        rules={[{ required: true, message: 'Please confirm your password' }]}
                      >
                        <Input.Password className="ims-input" prefix={<LockOutlined style={{ fontSize: 15 }} />} placeholder="Re-enter password" autoComplete="new-password" />
                      </Form.Item>
                      <Form.Item style={{ marginBottom: 0 }}>
                        <button type="submit" className="ims-submit-btn" disabled={loading}>
                          {loading ? <><div className="ims-spin" /> Resetting...</> : <>Reset Password <ArrowRightOutlined /></>}
                        </button>
                      </Form.Item>
                    </Form>
                  </>
                )}

                {fpView === 'fp_mobile' && (
                  <>
                    <div className="ims-info-box">
                      Enter your registered mobile number and we'll show a hint of your email address.
                    </div>
                    <Form form={fpForm} onFinish={onMobileHintSubmit} layout="vertical" size="large">
                      <Form.Item
                        label={<span className="ims-label">Mobile Number</span>}
                        name="mobile"
                        rules={[
                          { required: true, message: 'Mobile number is required' },
                          { pattern: /^[0-9+\-\s()]{10,20}$/, message: 'Enter a valid mobile number' }
                        ]}
                      >
                        <Input className="ims-input" prefix={<PhoneOutlined style={{ fontSize: 15 }} />} placeholder="+92 300 1234567" />
                      </Form.Item>
                      {!emailHint && (
                        <Form.Item style={{ marginBottom: 0 }}>
                          <button type="submit" className="ims-submit-btn" disabled={loading}>
                            {loading ? <><div className="ims-spin" /> Searching...</> : <>Find Email <ArrowRightOutlined /></>}
                          </button>
                        </Form.Item>
                      )}
                    </Form>

                    {emailHint && emailHint.found && (
                      <>
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
                            {emailHint.hints.length === 1
                              ? '1 account found with this mobile:'
                              : `${emailHint.hints.length} accounts found with this mobile:`}
                          </div>
                          {emailHint.hints.map((item, idx) => (
                            <div key={idx} className="ims-hint-box" style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 400, marginBottom: 2 }}>{item.institutionName}</div>
                              <strong>{item.hint}</strong>
                            </div>
                          ))}
                        </div>
                        <button
                          className="ims-submit-btn"
                          onClick={() => { setFpView('fp_email'); fpForm.resetFields(); setEmailHint(null); }}
                        >
                          Continue to Reset Password <ArrowRightOutlined />
                        </button>
                      </>
                    )}

                    {emailHint && !emailHint.found && (
                      <div className="ims-contact-box">
                        No account found with this mobile number.<br />
                        <strong>Please contact us for further assistance.</strong>
                      </div>
                    )}

                    <div style={{ marginTop: 14, textAlign: 'center' }}>
                      <button className="ims-back-btn" style={{ margin: '0 auto' }} onClick={() => { setFpView('fp_email'); fpForm.resetFields(); setEmailHint(null); }}>← Back</button>
                    </div>
                  </>
                )}

              </div>
            )}

            {/* REGISTER FORM */}
            {!otpStep && !fpView && activeTab === 'register' && (
              <div className="ims-form-wrap" key="register">
                <Form form={regForm} onFinish={onRegisterStep1} layout="vertical" size="large">
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

                  <Form.Item
                    label={<span className="ims-label">Confirm Password</span>}
                    name="adminConfirmPassword"
                    dependencies={['adminPassword']}
                    rules={[
                      { required: true, message: 'Please confirm your password' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('adminPassword') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('Passwords do not match'));
                        }
                      })
                    ]}
                  >
                    <Input.Password className="ims-input" prefix={<LockOutlined style={{fontSize:15}} />} placeholder="Re-enter password" autoComplete="new-password" />
                  </Form.Item>

                  <Form.Item style={{ marginBottom: 0 }}>
                    <button
                      type="submit"
                      className="ims-submit-btn"
                      disabled={loading}
                    >
                      {loading
                        ? <><div className="ims-spin" /> Sending OTP...</>
                        : <>Continue <ArrowRightOutlined /></>}
                    </button>
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
