import React, { useEffect, useState } from 'react';
import { Modal, Spin, Alert, Button } from 'antd';
import { QRCodeSVG } from 'qrcode.react';
import apiService from '../../services/apiService';

/** Gap between polls — avoid hammering the API if the modal stays open. */
const POLL_MS = 1500;

const BarcodeScannerModal = ({ open, onClose, onBarcode }) => {
  const [qrUrl, setQrUrl] = useState('');
  const [pollStatus, setPollStatus] = useState('connecting');

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let pollTimeoutId = null;

    const clearPollSchedule = () => {
      if (pollTimeoutId != null) {
        clearTimeout(pollTimeoutId);
        pollTimeoutId = null;
      }
    };

    const init = async () => {
      try {
        const data = await apiService.post('/barcode/session');
        if (cancelled || !data.success) return;

        const sid = data.sessionId;
        const mobileHost = process.env.REACT_APP_MOBILE_URL || window.location.origin;
        setQrUrl(`${mobileHost}/scan?sessionId=${sid}`);
        setPollStatus('waiting');

        const scheduleNext = () => {
          if (cancelled) return;
          pollTimeoutId = setTimeout(runPoll, POLL_MS);
        };

        const runPoll = async () => {
          if (cancelled) return;
          pollTimeoutId = null;
          try {
            const res = await apiService.get(`/barcode/poll/${sid}`);
            if (cancelled) return;
            if (res.success && res.barcode) {
              setPollStatus('received');
              onBarcode(res.barcode);
              return;
            }
          } catch (e) {
            if (!cancelled && e.response?.status === 404) {
              setPollStatus('error');
              return;
            }
          }
          scheduleNext();
        };

        runPoll();
      } catch {
        if (!cancelled) setPollStatus('error');
      }
    };

    init();

    return () => {
      cancelled = true;
      clearPollSchedule();
      setQrUrl('');
      setPollStatus('connecting');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- omit onBarcode to avoid resetting the poll when parent passes a new callback
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
        {pollStatus === 'connecting' && <Spin size="large" tip="Connecting..." />}

        {pollStatus === 'error' && (
          <Alert type="error" message="Connection failed. Please close and try again." showIcon />
        )}

        {(pollStatus === 'waiting' || pollStatus === 'received') && qrUrl && (
          <>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <QRCodeSVG value={qrUrl} size={200} />
            </div>
            <div style={{ marginTop: 16, fontSize: 13, color: '#666' }}>
              {pollStatus === 'received'
                ? '✅ Barcode received! Closing...'
                : 'Scan the QR code with your mobile to start scanning'}
            </div>
            {pollStatus === 'waiting' && (
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
