# IMS SEPCUNE Mobile (Expo + React Native)

**Current release: v3.0 (final)** — full module parity with the web app for browse, lookup, and field workflows. Complex create/edit flows (Excel import, PDF templates, kit assembly) remain on web.

Test in browser first — no Android build required.

## Prerequisites
- Backend running on http://localhost:5000
- Node.js 18+

## Setup
```bash
cd Mobile
npm install
```

## Run in web browser
```bash
npm run web
# or: npx expo start --web
```

Open **http://localhost:8081** (preferred — in CORS allowlist). Other ports (8090, etc.) work after backend CORS update.

## Troubleshooting login "Network Error"

1. **Backend must be running:** `cd Backend && npm run dev` → should show `Server started on ...:5000`
2. **CORS:** Expo web origin must be allowed. Dev config allows `http://localhost:*` and `http://127.0.0.1:*`. **Restart backend** after pulling latest `Backend/src/config/index.js`.
3. **API URL:** `Mobile/.env` → `EXPO_PUBLIC_API_URL=http://localhost:5000/api` then restart Expo (`Ctrl+C` and `npm run web` again).
4. Prefer Expo on port **8081**: `npx expo start --web` (avoid random ports unless backend is restarted).

## API URL

Edit `.env`:
```
EXPO_PUBLIC_API_URL=http://localhost:5000/api
```

For live server:
```
EXPO_PUBLIC_API_URL=https://kamaxinventory.sepcune.com/api
```

## Android (later)
```bash
npm run android
```

## Notes
- Barcode scan on web: manual entry on Scan tab; use device for camera.
- Backend CORS allows Expo web on `localhost` / `127.0.0.1` (any dev port).
- Menu is permission-filtered and mirrors web `Sidebar.jsx` via `src/navigation/menuConfig.js`.

## Version history

### v1.0 — Core
| Screen | Permission | API |
|--------|------------|-----|
| Login / Home | — | Auth, dashboard stats |
| Items / scan | `item_view` | `/items` |
| Inventory overview | `inventory_view` | `/inventory` |
| SKU rules | `item_management` | `/sku-rules` |

### v1.1 — Warehouse ops
| Screen | Permission | API |
|--------|------------|-----|
| GRN receive | `inventory_receive` | `/purchase-orders`, `/grn` |
| Stock count | `inventory_adjust` | `/stock-counts` |
| Putaway | `inventory_receive` | `/putaways` |
| Batch / serial | `inventory_view` | `/batch-serial`, `/serials` |
| Warehouses | `inventory_view` | `/warehouses` |

### v2.0 — Orders & parties
| Screen | Permission | API |
|--------|------------|-----|
| Purchase / sales orders | `purchase_view` / `sales_view` | `/purchase-orders`, `/sales-orders` |
| Customers / vendors | `customer_view` / `vendor_view` | `/customers`, `/vendors` |
| Delivery challans | `sales_view` | `/delivery-challans` |
| Adjustments / transfers | `inventory_adjust` / `inventory_transfer` | `/inventory/adjust`, `/inventory/transfer` |
| Item groups | `item_view` | `/item-groups` |

### v3.0 — Final (web parity)
| Area | Mobile screens | Notes |
|------|----------------|-------|
| **Inventory** | Reorder levels, shipments, packages | Packages = web placeholder |
| **Production** | BOM items, batch rules, manufacturing | Manufacturing = view on web |
| **Items** | Item trash | List + lookup |
| **Warehouses** | Zones / racks / bins | `/warehouse-locations/bins` |
| **Sales** | Invoices, payments received, returns, credit notes | List views |
| **Purchases** | Invoices, receives, bills, payments, vendor credits, returns | List views |
| **Invoices** | Dashboard, outstanding, third-party, payments | Finance KPIs |
| **Finance** | Accounting, profit & loss | Summary views |
| **Reports** | Reports hub | Snapshot per report type |
| **Admin** | Users, roles, tax, price lists, workflows, subscription, audit | Role-gated |
| **Documents** | Folder list | Upload on web |
| **Settings** | Company settings, exchange rates, all settings | Read-only / list |

Open **More** drawer for the full permission-filtered menu, or use **Home → Modules**.

## Web-only (use browser for full workflow)
- Excel item import / bulk edit
- Invoice PDF template designer
- Kit assembly / BOM editor
- Package tracking (not built on web yet either)
- Document upload & preview
- Subscription upgrade & payment

Future app updates can extend individual screens without changing the web client.
