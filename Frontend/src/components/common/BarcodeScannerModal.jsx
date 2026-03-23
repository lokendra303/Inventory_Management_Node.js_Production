import React, { useEffect, useRef, useState } from 'react';
import { Modal, Spin, Alert, Button } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import apiService from '../../services/apiService';

const wsBase = (() => {
  const api = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  return api.replace(/^http/, 'ws').replace('/api', '');
})();

const BarcodeScannerModal = ({ open, onClose, onBarcode }) => {
  const [qrUrl, setQrUrl] = useState('');
  const [wsStatus, setWsStatus] = useState('connecting');
  const wsRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const init = async () => {
      try {
        const data = await apiService.post('/barcode/session');
        if (cancelled || !data.success) return;

        const sid = data.sessionId;
        const mobileHost = process.env.REACT_APP_MOBILE_URL || window.location.origin;
        setQrUrl(`${mobileHost}/scan?sessionId=${sid}`);

        const ws = new WebSocket(`${wsBase}/ws/barcode?sessionId=${sid}`);
        wsRef.current = ws;

        ws.onopen = () => !cancelled && setWsStatus('waiting');
        ws.onerror = () => !cancelled && setWsStatus('error');

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'barcode' && msg.barcode) {
              setWsStatus('received');
              onBarcode(msg.barcode);
              ws.close();
            }
          } catch (_) {}
        };
      } catch {
        if (!cancelled) setWsStatus('error');
      }
    };

    init();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      setQrUrl('');
      setWsStatus('connecting');
    };
  }, [open]);

  return (
    <Modal
      title="📱 Scan Barcode with Mobile"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Cancel</Button>}
      width={380}
      centered
    >
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {wsStatus === 'connecting' && <Spin size="large" tip="Connecting..." />}

        {wsStatus === 'error' && (
          <Alert type="error" message="Connection failed. Please close and try again." showIcon />
        )}

        {(wsStatus === 'waiting' || wsStatus === 'received') && qrUrl && (
          <>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <QRCodeSVG value={qrUrl} size={200} />
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
              {wsStatus === 'received'
                ? '✅ Barcode received! Closing...'
                : 'Scan the QR code with your mobile to start scanning'}
            </div>
            {wsStatus === 'waiting' && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#aaa' }}>
                Opens camera on your phone — no app needed
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default BarcodeScannerModal;
