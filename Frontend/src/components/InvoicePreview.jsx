import React, { useState, useEffect } from 'react';
import { Card, Typography, Divider, Space, Image } from 'antd';
import apiService from '../services/apiService';

const { Title, Text } = Typography;

const InvoicePreview = () => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiService.get('/company-settings');
      if (response.success && response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const getImageUrl = (path) => {
    if (!path) return null;
    return `http://localhost:5000${path}?t=${Date.now()}`;
  };

  return (
    <Card 
      title="Invoice Preview" 
      style={{ 
        maxWidth: 800, 
        margin: '20px auto',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}
    >
      {/* Header Section */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 20 }}>
        {settings?.logo_path && (
          <div style={{ marginRight: 20 }}>
            <Image
              src={getImageUrl(settings.logo_path)}
              alt="Company Logo"
              width={80}
              height={60}
              style={{ objectFit: 'contain' }}
            />
          </div>
        )}
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {settings?.company_name || 'Your Company Name'}
          </Title>
          <Text type="secondary">{settings?.address || 'Company Address, City, State'}</Text><br/>
          <Text type="secondary">Phone: {settings?.phone || '+1-000-000-0000'} | Email: {settings?.email || 'info@company.com'}</Text>
        </div>
      </div>

      <Divider />

      {/* Invoice Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Title level={5}>INVOICE</Title>
          <Text>Invoice Number: INV-001</Text><br/>
          <Text>Invoice Date: {new Date().toLocaleDateString()}</Text><br/>
          <Text>Due Date: {new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString()}</Text>
        </div>
        <div>
          <Title level={5}>BILL TO</Title>
          <Text>Customer Name</Text><br/>
          <Text>Customer Address</Text><br/>
          <Text>City, State ZIP</Text>
        </div>
      </div>

      <Divider />

      {/* Items Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>Item</th>
            <th style={{ textAlign: 'center', padding: 8 }}>Qty</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Price</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Total</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td style={{ padding: 8 }}>Sample Product 1</td>
            <td style={{ textAlign: 'center', padding: 8 }}>2</td>
            <td style={{ textAlign: 'right', padding: 8 }}>$100.00</td>
            <td style={{ textAlign: 'right', padding: 8 }}>$200.00</td>
          </tr>
          <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
            <td style={{ padding: 8 }}>Sample Product 2</td>
            <td style={{ textAlign: 'center', padding: 8 }}>1</td>
            <td style={{ textAlign: 'right', padding: 8 }}>$150.00</td>
            <td style={{ textAlign: 'right', padding: 8 }}>$150.00</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <div style={{ width: 250 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <Text>Subtotal:</Text>
            <Text>$350.00</Text>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <Text>Tax (10%):</Text>
            <Text>$35.00</Text>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <Text strong>Total:</Text>
            <Text strong style={{ fontSize: 16 }}>$385.00</Text>
          </div>
        </div>
      </div>

      <Divider />

      {/* Footer with Signature and Stamp */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ width: '50%' }}>
            <Text strong>Notes:</Text><br/>
            <Text type="secondary">Thank you for your business!</Text>
          </div>
          <div style={{ width: '40%', textAlign: 'center' }}>
            <Text strong>Authorized Signatory</Text><br/>
            <div style={{ position: 'relative', marginTop: 10, marginBottom: 10, height: 80 }}>
              {settings?.signature_path && (
                <Image
                  src={getImageUrl(settings.signature_path)}
                  alt="Signature"
                  width={100}
                  height={40}
                  style={{ objectFit: 'contain' }}
                  preview={false}
                />
              )}
              {settings?.stamp_path && (
                <div style={{ position: 'absolute', top: 10, left: -20 }}>
                  <Image
                    src={getImageUrl(settings.stamp_path)}
                    alt="Stamp"
                    width={60}
                    height={60}
                    style={{ objectFit: 'contain', opacity: 0.8 }}
                    preview={false}
                  />
                </div>
              )}
            </div>
            <Text>{settings?.authorized_signatory_name || 'Signatory Name'}</Text><br/>
            <Text type="secondary">{settings?.authorized_signatory_designation || 'Designation'}</Text><br/>
            <Text type="secondary">Date: {new Date().toLocaleDateString()}</Text>
          </div>
        </div>
      </div>

      {!settings?.logo_path && !settings?.stamp_path && !settings?.signature_path && (
        <div style={{ 
          textAlign: 'center', 
          padding: 20, 
          backgroundColor: '#f0f2f5', 
          borderRadius: 4,
          marginTop: 20 
        }}>
          <Text type="secondary">
            Upload your logo, stamp, and signature in Company Settings to see them here!
          </Text>
        </div>
      )}
    </Card>
  );
};

export default InvoicePreview;
