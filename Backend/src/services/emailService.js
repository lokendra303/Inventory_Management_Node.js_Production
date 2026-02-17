const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_PORT == 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  async sendEmail({ to, subject, text, html }) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('Email credentials not configured');
        return { success: false, error: 'Email not configured' };
      }

      const info = await this.transporter.sendMail({
        from: `"${process.env.APP_NAME || 'IMS'}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html
      });

      logger.info(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendEmailWithAttachment({ to, subject, text, html, attachments }) {
    try {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        logger.warn('Email credentials not configured');
        return { success: false, error: 'Email not configured' };
      }

      const info = await this.transporter.sendMail({
        from: `"${process.env.APP_NAME || 'IMS'}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
        attachments
      });

      logger.info(`Email with attachment sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendLowStockAlert(email, items) {
    const itemList = items.map(item => 
      `- ${item.name} (SKU: ${item.sku}): ${item.quantity_on_hand} ${item.unit}`
    ).join('\n');

    return this.sendEmail({
      to: email,
      subject: 'Low Stock Alert',
      text: `The following items are running low:\n\n${itemList}`,
      html: `<h3>Low Stock Alert</h3><p>The following items are running low:</p><ul>${items.map(item => 
        `<li><strong>${item.name}</strong> (SKU: ${item.sku}): ${item.quantity_on_hand} ${item.unit}</li>`
      ).join('')}</ul>`
    });
  }

  async sendOrderNotification(email, orderType, orderNumber) {
    return this.sendEmail({
      to: email,
      subject: `${orderType} Order ${orderNumber} Created`,
      text: `Your ${orderType} order ${orderNumber} has been created successfully.`,
      html: `<h3>${orderType} Order Created</h3><p>Your order <strong>${orderNumber}</strong> has been created successfully.</p>`
    });
  }

  async sendInvoiceEmail(email, invoiceNumber, pdfBuffer) {
    return this.sendEmailWithAttachment({
      to: email,
      subject: `Invoice ${invoiceNumber}`,
      text: `Please find attached invoice ${invoiceNumber}.`,
      html: `<h3>Invoice ${invoiceNumber}</h3><p>Please find your invoice attached.</p><p>Thank you for your business!</p>`,
      attachments: [{
        filename: `invoice-${invoiceNumber}.pdf`,
        content: pdfBuffer
      }]
    });
  }

  async sendReportEmail(email, reportName, pdfBuffer) {
    return this.sendEmailWithAttachment({
      to: email,
      subject: `Report: ${reportName}`,
      text: `Please find attached the ${reportName} report.`,
      html: `<h3>${reportName}</h3><p>Please find your report attached.</p>`,
      attachments: [{
        filename: `${reportName.replace(/\s+/g, '-')}.pdf`,
        content: pdfBuffer
      }]
    });
  }
}

module.exports = new EmailService();
