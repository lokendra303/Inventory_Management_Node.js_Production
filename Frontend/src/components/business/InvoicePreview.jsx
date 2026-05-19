import React, { useState, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Space, Spin, Alert } from 'antd';
import { ReloadOutlined, FilePdfOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { INVOICE_PDF_TEMPLATES } from '../../constants/invoicePdfTemplates';

const { Text, Paragraph } = Typography;

/**
 * Live invoice PDF preview (SI or PI) using the same generator as download/email.
 * @param {string} templateId - invoice_pdf_template id (branded, classic, …)
 * @param {'sales'|'purchase'} documentType - sales invoice (SI) or purchase invoice (PI)
 * @param {string} [title] - card title override
 * @param {number|string} [refreshKey] - change to reload after save
 */
const InvoicePreview = ({
  templateId = 'branded',
  documentType = 'sales',
  title,
  refreshKey,
}) => {
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);

  const docType = documentType === 'purchase' ? 'purchase' : 'sales';
  const isPurchase = docType === 'purchase';
  const templateMeta = INVOICE_PDF_TEMPLATES.find((t) => t.id === templateId);

  const defaultTitle = isPurchase ? 'Purchase invoice (PI) preview' : 'Sales invoice (SI) preview';
  const cardTitle = title || defaultTitle;

  const revokeUrl = useCallback(() => {
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const loadPdfPreview = useCallback(async () => {
    const tpl = templateId || 'branded';
    setLoading(true);
    setError(null);
    revokeUrl();
    try {
      const res = await apiService.get(
        `/company-settings/invoice-pdf-preview/${tpl}/${docType}`,
        { responseType: 'blob' }
      );
      const blob = res.data;
      if (!blob || blob.size < 64 || (blob.type && blob.type.includes('json'))) {
        throw new Error('Preview could not be generated');
      }
      setPdfUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Could not load invoice preview');
    } finally {
      setLoading(false);
    }
  }, [templateId, docType, revokeUrl]);

  useEffect(() => {
    loadPdfPreview();
    return () => revokeUrl();
  }, [loadPdfPreview, refreshKey, revokeUrl]);

  return (
    <Card
      title={
        <Space>
          <FilePdfOutlined />
          <span>{cardTitle}</span>
          {templateMeta && (
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 400 }}>
              — {templateMeta.name}
            </Text>
          )}
        </Space>
      }
      extra={
        <Button icon={<ReloadOutlined />} onClick={loadPdfPreview} loading={loading} size="small">
          Refresh
        </Button>
      }
      style={{ marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
    >
      <Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 12 }}>
        {isPurchase ? (
          <>
            <Text strong>Purchase invoice (PI)</Text> — shows <Text strong>Bill to</Text> (vendor billing
            address). Data from your first active vendor and catalog items.
          </>
        ) : (
          <>
            <Text strong>Sales invoice (SI)</Text> — shows <Text strong>Bill to</Text> and{' '}
            <Text strong>Ship to</Text> (customer billing and shipping from the customer master). Company
            logo and banner come from Details &amp; branding.
          </>
        )}
      </Paragraph>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={loadPdfPreview}>
              Retry
            </Button>
          }
        />
      )}

      <div
        style={{
          minHeight: 420,
          border: '1px solid #e8e8e8',
          borderRadius: 8,
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {loading && <Spin tip="Generating preview PDF…" />}
        {!loading && pdfUrl && (
          <iframe
            title={cardTitle}
            src={pdfUrl}
            style={{
              width: '100%',
              minHeight: 640,
              height: '72vh',
              border: 'none',
              background: '#fff',
            }}
          />
        )}
        {!loading && !pdfUrl && !error && <Text type="secondary">No preview available</Text>}
      </div>
    </Card>
  );
};

export default InvoicePreview;
