# Invoice Management API Documentation

## Overview
Complete invoice management system supporting both Purchase and Sales invoices with 3-way matching, accounting integration, and payment tracking.

## Key Features
- ✅ Purchase & Sales Invoice Management
- ✅ 3-Way Matching (PO ↔ GRN ↔ Invoice)
- ✅ Automatic Accounting Entries
- ✅ Payment Tracking & Status Management
- ✅ Tax & Discount Calculations
- ✅ Multi-currency Support
- ✅ Invoice Analytics & Reporting

---

## Purchase Invoices

### 1. Create Purchase Invoice
**POST** `/api/purchase-invoices`

Creates a new purchase invoice with automatic total calculations.

**Request Body:**
```json
{
  "invoiceNumber": "PI202412001",
  "vendorId": "uuid-vendor-id",
  "vendorName": "ABC Suppliers Ltd",
  "poId": "uuid-po-id",
  "grnId": "uuid-grn-id",
  "invoiceDate": "2024-12-15",
  "dueDate": "2025-01-15",
  "currency": "USD",
  "exchangeRate": 1.0,
  "reference": "REF-001",
  "notes": "Monthly supplies invoice",
  "lines": [
    {
      "poLineId": "uuid-po-line-id",
      "grnLineId": "uuid-grn-line-id",
      "itemId": "uuid-item-id",
      "itemName": "Office Supplies",
      "quantity": 100,
      "unitCost": 15.50,
      "taxRate": 10.0,
      "discountRate": 5.0
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Purchase invoice created successfully",
  "data": {
    "invoiceId": "uuid-invoice-id",
    "totalAmount": 1472.50
  }
}
```

### 2. Get Purchase Invoices
**GET** `/api/purchase-invoices`

Retrieves purchase invoices with filtering and pagination.

**Query Parameters:**
- `status` - Filter by status (draft, posted, partially_paid, paid, cancelled)
- `vendorId` - Filter by vendor
- `dateFrom` - Start date filter (YYYY-MM-DD)
- `dateTo` - End date filter (YYYY-MM-DD)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50)

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "uuid-invoice-id",
        "invoice_number": "PI202412001",
        "vendor_name": "ABC Suppliers Ltd",
        "invoice_date": "2024-12-15",
        "total_amount": 1472.50,
        "balance_amount": 1472.50,
        "status": "draft",
        "po_number": "PO202412001",
        "grn_number": "GRN202412001",
        "line_count": 1
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1,
      "pages": 1
    }
  }
}
```

### 3. Get Single Purchase Invoice
**GET** `/api/purchase-invoices/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "uuid-invoice-id",
      "invoice_number": "PI202412001",
      "vendor_name": "ABC Suppliers Ltd",
      "subtotal": 1550.00,
      "tax_amount": 155.00,
      "discount_amount": 77.50,
      "total_amount": 1472.50,
      "status": "draft"
    },
    "lines": [
      {
        "id": "uuid-line-id",
        "item_name": "Office Supplies",
        "quantity": 100,
        "unit_cost": 15.50,
        "line_total": 1550.00,
        "tax_amount": 155.00,
        "discount_amount": 77.50
      }
    ],
    "payments": []
  }
}
```

### 4. Post Purchase Invoice
**POST** `/api/purchase-invoices/:id/post`

Posts the invoice and creates accounting entries.

**Accounting Entries Created:**
```
Dr GRN Clearing Account    1,472.50
Dr Input Tax                 155.00
    Cr Accounts Payable              1,627.50
```

### 5. Add Payment
**POST** `/api/purchase-invoices/:id/payments`

**Request Body:**
```json
{
  "amount": 1472.50,
  "paymentDate": "2024-12-20",
  "paymentMethod": "bank_transfer",
  "reference": "TXN-12345",
  "notes": "Full payment via bank transfer"
}
```

### 6. Get 3-Way Matching Data
**GET** `/api/purchase-invoices/matching/three-way?poId=uuid&grnId=uuid`

Returns PO and GRN data for invoice creation with validation.

---

## Sales Invoices

### 1. Create Sales Invoice
**POST** `/api/sales-invoices`

**Request Body:**
```json
{
  "invoiceNumber": "SI202412001",
  "customerId": "uuid-customer-id",
  "customerName": "XYZ Corporation",
  "soId": "uuid-so-id",
  "deliveryNoteId": "uuid-delivery-id",
  "invoiceDate": "2024-12-15",
  "dueDate": "2025-01-15",
  "currency": "USD",
  "exchangeRate": 1.0,
  "reference": "REF-001",
  "notes": "Monthly service invoice",
  "lines": [
    {
      "soLineId": "uuid-so-line-id",
      "deliveryLineId": "uuid-delivery-line-id",
      "itemId": "uuid-item-id",
      "itemName": "Consulting Services",
      "quantity": 40,
      "unitPrice": 125.00,
      "taxRate": 10.0,
      "discountRate": 0.0
    }
  ]
}
```

### 2. Get Sales Invoices
**GET** `/api/sales-invoices`

Similar to purchase invoices with customer-specific filters.

### 3. Post Sales Invoice
**POST** `/api/sales-invoices/:id/post`

**Accounting Entries Created:**
```
Dr Accounts Receivable     5,500.00
    Cr Sales Revenue               5,000.00
    Cr Output Tax                    500.00

Dr Cost of Goods Sold      3,000.00
    Cr Inventory                   3,000.00
```

### 4. Get Invoice Analytics
**GET** `/api/sales-invoices/analytics/summary`

**Query Parameters:**
- `dateFrom` - Start date
- `dateTo` - End date

**Response:**
```json
{
  "success": true,
  "data": {
    "statusBreakdown": [
      {
        "status": "posted",
        "count": 15,
        "total_amount": 75000.00,
        "paid_amount": 60000.00,
        "balance_amount": 15000.00
      }
    ],
    "monthlyTrend": [
      {
        "month": "2024-12",
        "invoice_count": 8,
        "total_revenue": 40000.00
      }
    ]
  }
}
```

---

## Invoice Status Flow

### Purchase Invoice Statuses:
1. **draft** → Initial creation
2. **posted** → Accounting entries created
3. **partially_paid** → Partial payment received
4. **paid** → Fully paid
5. **cancelled** → Cancelled invoice

### Sales Invoice Statuses:
Same as purchase invoices.

---

## Business Rules

### 3-Way Matching Validation:
- ✅ Invoice quantity ≤ GRN received quantity
- ✅ Invoice quantity ≤ PO ordered quantity
- ⚠️ Price variance warning if > 5% difference
- ❌ Error if item not in PO/GRN

### Accounting Rules:
- **GRN exists**: Dr GRN Clearing, Cr Vendor Payable
- **No GRN**: Dr Purchase Expense, Cr Vendor Payable
- **Sales**: Dr Customer Receivable, Cr Sales Revenue + COGS entries

### Payment Rules:
- Only posted invoices can receive payments
- Payment amount cannot exceed balance amount
- Status auto-updates based on payment completion

---

## Error Handling

### Common Error Responses:
```json
{
  "success": false,
  "error": "Invoice not found or already posted"
}
```

### Validation Errors:
```json
{
  "success": false,
  "error": "Validation error",
  "details": [
    {
      "field": "lines.0.quantity",
      "message": "Quantity must be a positive number"
    }
  ]
}
```

---

## Permissions Required

### Purchase Invoices:
- `purchase_view` - View invoices
- `purchase_management` - Create, update, post invoices

### Sales Invoices:
- `sales_view` - View invoices
- `sales_management` - Create, update, post invoices

---

## Database Schema

### Key Tables:
- `purchase_invoices` - Purchase invoice headers
- `purchase_invoice_lines` - Purchase invoice line items
- `sales_invoices` - Sales invoice headers
- `sales_invoice_lines` - Sales invoice line items
- `accounting_entries` - All accounting transactions
- `invoice_payments` - Payment records

### Relationships:
- Invoice → Lines (1:many)
- Invoice → Payments (1:many)
- Invoice → PO/GRN (many:1)
- Invoice → Accounting Entries (1:many)

---

## Integration Points

### With Purchase Orders:
- Auto-populate invoice from PO data
- Validate quantities against PO limits
- Link for 3-way matching

### With GRN (Goods Receipt):
- Auto-populate from received quantities
- Validate against actual receipts
- Clear GRN clearing accounts

### With Inventory:
- COGS calculation for sales invoices
- Inventory valuation updates

### With Accounting:
- Automatic journal entries
- Trial balance integration
- Account ledger updates

This completes the comprehensive invoice management system! 🎉