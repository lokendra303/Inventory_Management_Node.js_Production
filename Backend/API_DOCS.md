# IMS SEPCUNE API Documentation

## Base URL
```
Production: https://api.ims-sepcune.com
Development: http://localhost:3000/api
```

## Authentication

All API requests (except registration and login) require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Tenant Context

Tenant context is required for all authenticated requests and can be provided via:
1. JWT token (preferred)
2. Subdomain: `tenant.ims-sepcune.com`
3. Header: `X-Tenant-ID: <tenant_id>`

## API Endpoints

### Authentication

#### Register Tenant
```http
POST /auth/register-tenant
Content-Type: application/json

{
  "name": "Company Name",
  "subdomain": "company-name",
  "adminEmail": "admin@company.com",
  "adminPassword": "password123",
  "adminFirstName": "John",
  "adminLastName": "Doe"
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "password123",
  "subdomain": "company-name"
}
```

### Inventory Operations

#### Receive Stock
```http
POST /inventory/receive
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": 100,
  "unitCost": 25.50,
  "poId": "uuid",
  "poLineId": "uuid",
  "grnNumber": "GRN-001"
}
```

#### Reserve Stock
```http
POST /inventory/reserve
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": 10,
  "unitPrice": 30.00,
  "soId": "uuid",
  "soLineId": "uuid"
}
```

#### Ship Stock
```http
POST /inventory/ship
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": 10,
  "unitPrice": 30.00,
  "soId": "uuid",
  "soLineId": "uuid",
  "shipmentNumber": "SHIP-001"
}
```

#### Adjust Stock
```http
POST /inventory/adjust
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantityChange": 5,
  "reason": "Damaged goods",
  "adjustmentType": "decrease"
}
```

#### Transfer Stock
```http
POST /inventory/transfer
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "uuid",
  "fromWarehouseId": "uuid",
  "toWarehouseId": "uuid",
  "quantity": 20,
  "transferId": "uuid"
}
```

### Inventory Queries

#### Get Current Stock
```http
GET /inventory/current/{itemId}/{warehouseId}
Authorization: Bearer <token>
```

#### Get Warehouse Stock
```http
GET /inventory/warehouse/{warehouseId}?limit=100&offset=0
Authorization: Bearer <token>
```

#### Get All Inventory
```http
GET /inventory?limit=100&offset=0
Authorization: Bearer <token>
```

#### Get Low Stock Items
```http
GET /inventory/low-stock?threshold=10
Authorization: Bearer <token>
```

#### Get Inventory History
```http
GET /inventory/history/{itemId}/{warehouseId}
Authorization: Bearer <token>
```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 250
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limits

- Global: 100 requests per 15 minutes
- Per Tenant: 1000 requests per 15 minutes
- Authentication endpoints: 10 requests per minute

## Event Types

The system supports these inventory events:

- `PurchaseReceived` - Stock received from supplier
- `SaleReserved` - Stock reserved for sale
- `SaleShipped` - Stock shipped to customer
- `SaleReturned` - Stock returned by customer
- `PurchaseReturned` - Stock returned to supplier
- `StockAdjusted` - Manual stock adjustment
- `TransferOut` - Stock transferred out
- `TransferIn` - Stock transferred in
- `StockDamaged` - Stock marked as damaged
- `StockExpired` - Stock marked as expired

## Webhooks

Configure webhooks to receive real-time notifications:

```json
{
  "url": "https://your-app.com/webhook",
  "events": ["PurchaseReceived", "SaleShipped"],
  "secret": "webhook-secret"
}
```

## SDKs and Libraries

- JavaScript/Node.js: `npm install ims-sepcune-sdk`
- Python: `pip install ims-sepcune`
- PHP: `composer require ims-sepcune/sdk`