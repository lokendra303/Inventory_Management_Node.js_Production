# Sales Invoice Updates - Matching Purchase Invoice Features

## Overview
Updated the Sales Invoice module to have the same functionality as Purchase Invoice, using the same backend services and just changing variable names (vendor → customer, unitCost → unitPrice, etc.).

## Files Updated

### 1. Backend Controller
**File:** `Backend/src/controllers/salesInvoiceController.js`

**Changes:**
- Added UUID support for invoice IDs (matching purchase invoice)
- Enhanced `createSalesInvoice` with validation and customer name lookup
- Added `updateSalesInvoice` method (was missing)
- Added `getStandardInvoiceFormat` method
- Added `getCustomerDetailsForInvoice` method
- Added `getCustomerList` method
- Added `getItemsList` method
- Added `generateInvoicePDF` method with download support
- Removed old `downloadInvoicePDF` method

**Key Variable Changes:**
- `vendorId` → `customerId`
- `vendorName` → `customerName`
- `unitCost` → `unitPrice`
- `vendor` → `customer`

### 2. Backend Routes
**File:** `Backend/src/routes/sales-invoices.js`

**New Routes Added:**
- `PUT /api/sales-invoices/:id` - Update invoice
- `GET /api/sales-invoices/items/list` - Get items for dropdown
- `GET /api/sales-invoices/:id/pdf` - Generate/download PDF
- `GET /api/sales-invoices/:id/standard-format` - Get standard invoice format
- `GET /api/sales-invoices/customers/:customerId/details` - Get customer details
- `GET /api/sales-invoices/customers/list` - Get customer list

**Removed Routes:**
- `GET /api/sales-invoices/:id/download` (replaced with `/pdf?download=true`)

### 3. Frontend Component
**File:** `Frontend/src/pages/SalesInvoices.jsx`

**New Features Added:**
- Modal for creating/editing invoices using `InvoiceForm` component
- Edit invoice functionality
- View standard format preview (modal with formatted invoice)
- Download PDF functionality
- Action buttons (Edit, View, Download PDF)

**New Functions:**
- `handleCreateInvoice()` - Opens modal for new invoice
- `handleEditInvoice(invoiceId)` - Opens modal for editing
- `handleViewStandardFormat(invoiceId)` - Shows formatted invoice preview
- `handleDownloadPDF(invoiceId, invoiceNumber)` - Downloads PDF
- `handleModalSave()` - Handles save callback from form

## Shared Services Used

Both Purchase and Sales invoices now use the same backend services:

1. **invoiceTemplateService** - Generates standard invoice format
   - `generateStandardInvoice(institutionId, invoiceData, 'sales')`
   - `getCustomerDetails(institutionId, customerId)`
   - `getCustomerList(institutionId, search)`

2. **invoicePDFService** - Generates PDF documents
   - `generatePDFBuffer(standardInvoice, institutionId)`
   - `saveInvoicePDF(standardInvoice, invoiceNumber, 'sales')`
   - `generateFilename(invoiceNumber, 'sales')`

3. **autoInvoiceService** - Provides items list
   - `getItemsList(institutionId, search, limit)`

## Key Differences Between Purchase and Sales

| Feature | Purchase Invoice | Sales Invoice |
|---------|-----------------|---------------|
| Party Type | Vendor | Customer |
| Party ID Field | `vendorId` | `customerId` |
| Party Name Field | `vendorName` | `customerName` |
| Price Field | `unitCost` | `unitPrice` |
| Invoice Prefix | PI | SI |
| Invoice Type | 'purchase' | 'sales' |
| Related Docs | PO, GRN | SO, Delivery Note |

## Database Tables

Both modules use similar table structures:

**Purchase Invoice:**
- `purchase_invoices` (header)
- `purchase_invoice_lines` (line items)

**Sales Invoice:**
- `sales_invoices` (header)
- `sales_invoice_lines` (line items)

**Shared:**
- `invoice_payments` (payments for both types)
- `accounting_entries` (accounting entries for both types)

## Frontend Integration

The `InvoiceForm` component (used in modal) should support both types:
```jsx
<InvoiceForm
  type="sales"  // or "purchase"
  invoiceId={selectedInvoiceId}
  onSave={handleModalSave}
/>
```

## Testing Checklist

- [ ] Create new sales invoice
- [ ] Edit existing sales invoice
- [ ] View standard format preview
- [ ] Download PDF
- [ ] Customer dropdown loads correctly
- [ ] Items dropdown loads correctly
- [ ] Calculations work correctly (subtotal, tax, discount, total)
- [ ] Payment recording
- [ ] Status updates
- [ ] Invoice posting (accounting entries)

## Notes

- The implementation reuses the same backend services by just passing different parameters
- Variable names are changed to match the context (vendor vs customer)
- The frontend uses the same `InvoiceForm` component for both types
- PDF generation uses the same template service with type parameter
- All features from purchase invoice are now available in sales invoice
