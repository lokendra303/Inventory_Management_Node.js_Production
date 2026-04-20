# Barcode scanning

## Purpose

Let a desktop session pair with a phone (or kiosk) to scan barcodes: create a short-lived session, show a QR/link to the mobile page, receive scans over HTTP POST, and push results to the desktop via WebSocket.

## API base paths

- `/api/barcode` — mounted in `server.js` only (public; no JWT required for session/scan).

## Endpoints (`routes/barcode.js`)

- `POST /session` — returns `sessionId` for pairing.
- `POST /scan/:sessionId` — body `{ barcode }`; validates length; pushes to subscribers.

## Backend files

- `Backend/src/routes/barcode.js`
- `Backend/src/services/barcodeScanService.js` (session store + WebSocket `attachWebSocketServer` from `server.js`)

## Frontend

- `Frontend/src/pages/scanner/MobileScanner.jsx` (`/scan` route, rendered outside main auth shell in `App.jsx`)
- `Frontend/src/components/common/BarcodeScannerModal.jsx` (desktop integration)

## Security notes

Public endpoints must stay minimal (session + scan only); rate limiting applies under `/api`. Validate barcode length and session existence (already present).
