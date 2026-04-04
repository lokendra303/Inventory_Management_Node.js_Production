const nodemailer = require('nodemailer');
const logger = require('../../utils/logger');

const otpStore = new Map();
const OTP_TTL_MS = 5 * 60 * 1000;

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function storeKey(identifier) {
  return `otp:${identifier}`;
}

// Lazy-init so process.env is fully loaded before transporter is created
let _transporter = null;
function getTransporter() {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: { rejectUnauthorized: false },
    });
  }
  return _transporter;
}

async function sendOtp(identifier, email) {
  const otp = generateOtp();
  const key = storeKey(identifier);
  otpStore.set(key, { otp, expiresAt: Date.now() + OTP_TTL_MS });

  try {
    await getTransporter().sendMail({
      from: `"${process.env.APP_NAME || 'IMS SEPCUNE'}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#667eea;margin-bottom:8px;">OTP Verification</h2>
          <p style="color:#374151;">Use the code below to verify your identity. It expires in <strong>5 minutes</strong>.</p>
          <div style="font-size:36px;font-weight:800;letter-spacing:10px;color:#111827;text-align:center;padding:24px 0;">${otp}</div>
          <p style="color:#9ca3af;font-size:12px;">If you did not request this, please ignore this email.</p>
        </div>
      `,
    });
    logger.info('OTP sent', { identifier, email });
  } catch (err) {
    // Reset transporter so next call retries with fresh config
    _transporter = null;
    logger.error('Failed to send OTP email', {
      error: err.message,
      code: err.code,
      smtp_host: process.env.SMTP_HOST,
      smtp_user: process.env.SMTP_USER,
      identifier,
      email,
    });
    throw new Error(`Failed to send OTP email: ${err.message}`);
  }

  return true;
}

function verifyOtp(identifier, otp) {
  const key = storeKey(identifier);
  const record = otpStore.get(key);

  if (!record) throw new Error('OTP not found or already used. Please request a new one.');
  if (Date.now() > record.expiresAt) {
    otpStore.delete(key);
    throw new Error('OTP has expired. Please request a new one.');
  }
  if (record.otp !== otp) throw new Error('Invalid OTP. Please try again.');

  otpStore.delete(key);
  return true;
}

module.exports = { sendOtp, verifyOtp };
