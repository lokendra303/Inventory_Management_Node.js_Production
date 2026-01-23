# IMS SEPCUNE API Documentation

## Base URL
```
Production: https://api.ims-sepcune.com
Development: http://localhost:3000
```

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100
  }
}
```

## Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new tenant | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/refresh` | Refresh token | Yes |
| POST | `/api/auth/temp-login` | Temporary access login | No |

### User Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users` | Get all users | Yes |
| POST | `/api/users` | Create new user | Yes |
| GET | `/api/users/profile` | Get current user profile | Yes |
| PUT | `/api/users/profile` | Update user profile | Yes |
| PUT | `/api/users/change-password` | Change password | Yes |
| PUT | `/api/users/:id/permissions` | Update user permissions | Yes |
| PUT | `/api/users/:id/status` | Update user status | Yes |
| POST | `/api/users/:id/temp-access` | Generate temp access | Yes |

### Role Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/roles` | Get all roles | Yes |
| POST | `/api/roles` | Create new role | Yes |
| PUT | `/api/roles/:id` | Update role | Yes |
| PUT | `/api/roles/:id/status` | Toggle role status | Yes |

### Item Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/items` | Get all items | Yes |
| POST | `/api/items` | Create new item | Yes |
| GET | `/api/items/:id` | Get item by ID | Yes |
| PUT | `/api/items/:id` | Update item | Yes |
| DELETE | `/api/items/:id` | Delete item | Yes |

### Category Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/categories` | Get all categories | Yes |
| POST | `/api/categories` | Create new category | Yes |
| GET | `/api/categories/tree` | Get category tree | Yes |
| GET | `/api/categories/:id` | Get category by ID | Yes |
| PUT | `/api/categories/:id` | Update category | Yes |
| DELETE | `/api/categories/:id` | Delete category | Yes |

### Warehouse Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/warehouses` | Get all warehouses | Yes |
| POST | `/api/warehouses` | Create new warehouse | Yes |
| GET | `/api/warehouses/:id` | Get warehouse by ID | Yes |
| PUT | `/api/warehouses/:id` | Update warehouse | Yes |
| GET | `/api/warehouses/:id/details` | Get warehouse details | Yes |

### Warehouse Types
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/warehouse-types` | Get all warehouse types | Yes |
| POST | `/api/warehouse-types` | Create warehouse type | Yes |
| PUT | `/api/warehouse-types/:id` | Update warehouse type | Yes |

### Inventory Management
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/inventory` | Get all inventory | Yes |
| GET | `/api/inventory/dashboard-stats` | Get dashboard statistics | Yes |
| GET | `/api/inventory/low-stock` | Get low stock items | Yes |
| GET | `/api/inventory/warehouse/:id` | Get warehouse inventory | Yes |
| GET | `/api/inventory/:itemId/:warehouseId` | Get current stock | Yes |
| GET | `/api/inventory/:itemId/:warehouseId/history` | Get inventory history | Yes |
| POST | `/api/inventory/receive` | Receive stock | Yes |
| POST | `/api/inventory/reserve` | Reserve stock | Yes |
| POST | `/api/inventory/ship` | Ship stock | Yes |
| POST | `/api/inventory/adjust` | Adjust stock | Yes |
| POST | `/api/inventory/transfer` | Transfer stock | Yes |

### Purchase Orders
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/purchase-orders` | Get all purchase orders | Yes |
| POST | `/api/purchase-orders` | Create purchase order | Yes |
| GET | `/api/purchase-orders/:id` | Get purchase order by ID | Yes |
| PUT | `/api/purchase-orders/:id/status` | Update PO status | Yes |

### Vendors
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/vendors` | Get all vendors | Yes |
| POST | `/api/vendors` | Create new vendor | Yes |
| GET | `/api/vendors/:id` | Get vendor by ID | Yes |
| PUT | `/api/vendors/:id` | Update vendor | Yes |
| GET | `/api/vendors/:id/performance` | Get vendor performance | Yes |

### Sales Orders
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/sales-orders` | Get all sales orders | Yes |
| POST | `/api/sales-orders` | Create sales order | Yes |
| GET | `/api/sales-orders/:id` | Get sales order by ID | Yes |

### GRN (Goods Receipt Note)
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/grn/pending-receipts` | Get pending receipts | Yes |
| POST | `/api/grn` | Create GRN | Yes |
| GET | `/api/grn/:id` | Get GRN by ID | Yes |

### Reorder Levels
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/reorder-levels` | Get reorder levels | Yes |
| POST | `/api/reorder-levels` | Set reorder level | Yes |
| GET | `/api/reorder-levels/low-stock-alerts` | Get low stock alerts | Yes |
| PUT | `/api/reorder-levels/alerts/:id/acknowledge` | Acknowledge alert | Yes |
| GET | `/api/reorder-levels/suggestions` | Get reorder suggestions | Yes |

### Settings
| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/settings` | Get tenant settings | Yes |
| PUT | `/api/settings` | Update tenant settings | Yes |

## Request Examples

### Register Tenant
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Company Name",
  "subdomain": "company",
  "adminEmail": "admin@company.com",
  "adminPassword": "password123",
  "adminFirstName": "John",
  "adminLastName": "Doe"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@company.com",
  "password": "password123"
}
```

### Create Item
```http
POST /api/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Product Name",
  "sku": "SKU001",
  "description": "Product description",
  "categoryId": "uuid",
  "unitPrice": 25.50,
  "minStock": 10,
  "maxStock": 100
}
```

### Receive Stock
```http
POST /api/inventory/receive
Authorization: Bearer <token>
Content-Type: application/json

{
  "itemId": "uuid",
  "warehouseId": "uuid",
  "quantity": 100,
  "unitCost": 20.00,
  "poId": "uuid",
  "grnNumber": "GRN001"
}
```

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limits
- 100 requests per 15 minutes (global)
- 1000 requests per 15 minutes (per tenant)
- 10 requests per minute (auth endpoints)

## Pagination
Use query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 100)
- `sort` - Sort field
- `order` - Sort order (asc/desc)

Example: `/api/items?page=2&limit=25&sort=name&order=asc`

## Filtering
Use query parameters for filtering:
- `/api/items?category=electronics`
- `/api/inventory?warehouse=uuid&lowStock=true`
- `/api/purchase-orders?status=pending&vendor=uuid`

## SDK Support
- JavaScript/Node.js: `npm install ims-sepcune-sdk`
- Python: `pip install ims-sepcune`
- PHP: `composer require ims-sepcune/sdk`