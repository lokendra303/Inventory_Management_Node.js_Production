import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Spin, Alert, Typography } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import { assertPdfBlob } from '../../utils/printPdfBlob';

const { Text } = Typography;

/**
 * View invoice PDF using the same generator as download/email (company invoice_pdf_template).
 * @param {boolean} open
 * @param {() => void} onClose
 * @param {string|null} invoiceId
 * @param {string} apiBase - e.g. '/sales-invoices' or '/purchase-invoices'
 * @param {string} [title]
 */
const InvoicePdfViewModal = ({ open, onClose, invoiceId, apiBase, title = 'Invoice' }) => {
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(null);

  const revokeUrl = useCallback(() => {
    setPdfUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!open || !invoiceId || !apiBase) return undefined;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      revokeUrl();
      try {
        const res = await apiService.get(`${apiBase}/${invoiceId}/pdf?inline=true`, {
          responseType: 'blob',
        });
        await assertPdfBlob(res.data);
        if (!cancelled) {
          setPdfUrl(URL.createObjectURL(res.data));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.response?.data?.error || e.message || 'Failed to load invoice PDF');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      revokeUrl();
    };
  }, [open, invoiceId, apiBase, revokeUrl]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(920px, 96vw)"
      style={{ top: 16 }}
      title={
        <span>
          <FilePdfOutlined style={{ marginRight: 8 }} />
          {title}
        </span>
      }
      destroyOnClose
      maskClosable
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="Generating PDF…" />
        </div>
      )}
      {!loading && error && <Alert type="error" showIcon message={error} />}
      {!loading && !error && pdfUrl && (
        <iframe
          src={pdfUrl}
          title={title}
          style={{ width: '100%', height: 'min(75vh, 720px)', border: 'none', display: 'block' }}
        />
      )}
      {!loading && !error && !pdfUrl && <Text type="secondary">No preview available</Text>}
    </Modal>
  );
};

export default InvoicePdfViewModal;
