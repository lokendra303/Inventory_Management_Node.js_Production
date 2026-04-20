import React, { useEffect, useRef, useState } from 'react';
import { getApiBaseUrl } from '../../config/appConfig';

const apiBase = getApiBaseUrl();

const MobileScanner = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const [status, setStatus] = useState('starting'); // starting | scanning | success | error
  const [message, setMessage] = useState('Starting camera...');
  const canvasRef = useRef(document.createElement('canvas'));

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('sessionId');

  const stopCamera = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const sendBarcode = async (barcode) => {
    stopCamera();
    setStatus('success');
    setMessage(`✅ Scanned: ${barcode} — Sending to desktop...`);
    try {
      const res = await fetch(`${apiBase}/barcode/scan/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ "${barcode}" sent to desktop! You can close this tab.`);
      } else {
        setStatus('error');
        setMessage(`Server error: ${data.error}`);
      }
    } catch {
      setStatus('error');
      setMessage('Network error — make sure phone and PC are on the same Wi‑Fi and the API is reachable.');
    }
  };

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      setMessage('Invalid session. Please scan the QR code again from the desktop.');
      return;
    }

    const startScanner = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw Object.assign(new Error('Camera API not available. Open this page over HTTPS — HTTP blocks camera access on mobile browsers.'), { name: 'NotSecureError' });
        }

        // Dynamically import ZXing to avoid SSR issues
        const mod = await import('@zxing/browser');
        const libMod = await import('@zxing/library');

        // Request camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        setStatus('scanning');
        setMessage('');

        const hints = new Map();
        hints.set(libMod.DecodeHintType.POSSIBLE_FORMATS, [
          libMod.BarcodeFormat.EAN_13,
          libMod.BarcodeFormat.EAN_8,
          libMod.BarcodeFormat.UPC_A,
          libMod.BarcodeFormat.UPC_E,
          libMod.BarcodeFormat.CODE_128,
          libMod.BarcodeFormat.CODE_39,
          libMod.BarcodeFormat.QR_CODE,
        ]);
        hints.set(libMod.DecodeHintType.TRY_HARDER, true);

        const reader = new mod.BrowserMultiFormatReader(hints);
        const canvas = canvasRef.current;

        const tick = () => {
          const video = videoRef.current;
          if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
            animFrameRef.current = requestAnimationFrame(tick);
            return;
          }

          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          try {
            const result = reader.decodeFromCanvas(canvas);
            if (result) {
              sendBarcode(result.getText());
              return; // stop loop
            }
          } catch {
            // NotFoundException is thrown when no barcode found — ignore and keep scanning
          }

          animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);

      } catch (err) {
        setStatus('error');
        if (err.name === 'NotSecureError') {
          setMessage(err.message);
        } else if (err.name === 'NotAllowedError') {
          setMessage('Camera permission denied. Please allow camera access and try again.');
        } else if (err.name === 'NotFoundError') {
          setMessage('No camera found on this device.');
        } else {
          setMessage(`Camera error: ${err.message}`);
        }
      }
    };

    startScanner();

    return () => stopCamera();
  }, [sessionId]);

  const colors = { starting: '#1890ff', scanning: '#1890ff', success: '#52c41a', error: '#ff4d4f' };

  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: 16, background: '#000', minHeight: '100vh', color: '#fff' }}>
      <div style={{ fontSize: 20, marginBottom: 12 }}>📦 Barcode Scanner</div>

      {/* Video feed */}
      {(status === 'starting' || status === 'scanning') && (
        <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: 400 }}>
          <video
            ref={videoRef}
            style={{ width: '100%', borderRadius: 12, border: `3px solid ${colors[status]}`, display: 'block' }}
            muted
            playsInline
          />
          {/* Scanning overlay */}
          {status === 'scanning' && (
            <div style={{
              position: 'absolute', top: '40%', left: '10%', right: '10%',
              height: 2, background: '#1890ff',
              boxShadow: '0 0 8px #1890ff',
              animation: 'scan 2s linear infinite'
            }} />
          )}
        </div>
      )}

      {/* Status message */}
      {message && (
        <div style={{
          marginTop: 16, fontSize: 15, padding: '12px 16px', borderRadius: 8,
          background: `${colors[status]}22`, color: colors[status]
        }}>
          {message}
        </div>
      )}

      {status === 'scanning' && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#aaa' }}>
          Point your camera at a barcode
        </div>
      )}

      {status === 'success' && (
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#1890ff', color: '#fff', border: 'none', fontSize: 15, cursor: 'pointer' }}
        >
          Scan Another
        </button>
      )}

      {status === 'error' && (
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#ff4d4f', color: '#fff', border: 'none', fontSize: 15, cursor: 'pointer' }}
        >
          Try Again
        </button>
      )}

      <style>{`
        @keyframes scan {
          0% { top: 20%; }
          50% { top: 75%; }
          100% { top: 20%; }
        }
      `}</style>
    </div>
  );
};

export default MobileScanner;
