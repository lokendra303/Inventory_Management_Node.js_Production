# 🔄 Vendor Field Mapping Reference

## Complete Field Mappings (Frontend ↔ Database)

### **Group 1: Core Identification**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| vendorCode | vendor_code | VARCHAR(100) | ❌ | Auto-generated if empty |
| displayName | display_name | VARCHAR(255) | ✅ | Primary display name |
| companyName | company_name | VARCHAR(255) | ❌ | Legal company name |

### **Group 2: Contact Information**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| salutation | salutation | VARCHAR(50) | ❌ | Mr., Ms., Mrs., Dr. |
| firstName | first_name | VARCHAR(100) | ❌ | Contact person first name |
| lastName | last_name | VARCHAR(100) | ❌ | Contact person last name |
| email | email | VARCHAR(255) | ❌ | Primary email address |
| workPhone | work_phone | VARCHAR(50) | ❌ | Office phone number |
| mobilePhone | mobile_phone | VARCHAR(50) | ❌ | Mobile phone number |

### **Group 3: Tax & Legal**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| pan | pan | VARCHAR(50) | ❌ | PAN number (India) |
| gstin | gstin | VARCHAR(50) | ❌ | GST registration number |
| msmeRegistered | msme_registered | BOOLEAN | ❌ | MSME registration status |

### **Group 4: Financial Terms**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| currency | currency | VARCHAR(3) | ❌ | Default: 'INR' |
| paymentTerms | payment_terms | VARCHAR(100) | ❌ | e.g., Net 30, Net 60 |
| tds | tds | VARCHAR(100) | ❌ | Tax Deducted at Source % |

### **Group 5: Organization**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| department | department | VARCHAR(255) | ❌ | Vendor department |
| designation | designation | VARCHAR(255) | ❌ | Contact person designation |
| website | website_url | VARCHAR(255) | ❌ | Company website URL |

### **Group 6: Billing Address**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| billingAttention | billing_attention | VARCHAR(255) | ❌ | Attention to person |
| billingCountry | billing_country | VARCHAR(100) | ❌ | Country name |
| billingAddress1 | billing_address1 | TEXT | ❌ | Street address line 1 |
| billingAddress2 | billing_address2 | TEXT | ❌ | Street address line 2 |
| billingCity | billing_city | VARCHAR(100) | ❌ | City name |
| billingState | billing_state | VARCHAR(100) | ❌ | State/Province |
| billingPinCode | billing_pin_code | VARCHAR(20) | ❌ | ZIP/Postal code |

### **Group 7: Shipping Address**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| shippingAttention | shipping_attention | VARCHAR(255) | ❌ | Attention to person |
| shippingCountry | shipping_country | VARCHAR(100) | ❌ | Country name |
| shippingAddress1 | shipping_address1 | TEXT | ❌ | Street address line 1 |
| shippingAddress2 | shipping_address2 | TEXT | ❌ | Street address line 2 |
| shippingCity | shipping_city | VARCHAR(100) | ❌ | City name |
| shippingState | shipping_state | VARCHAR(100) | ❌ | State/Province |
| shippingPinCode | shipping_pin_code | VARCHAR(20) | ❌ | ZIP/Postal code |

### **Group 8: Additional Info**
| Frontend Field | Database Column | Type | Required | Notes |
|---|---|---|---|---|
| remarks | remarks | TEXT | ❌ | Additional notes/comments |
| status | status | ENUM('active','inactive') | ❌ | Default: 'active' |

### **Group 9: System Fields** (Auto-managed)
| Frontend Field | Database Column | Type | Notes |
|---|---|---|---|
| id | id | VARCHAR(36) | UUID primary key |
| createdAt | created_at | TIMESTAMP | Auto-set on insert |
| updatedAt | updated_at | TIMESTAMP | Auto-updated on modify |

---

## Conversion Rules

### Frontend to Backend Conversion
```javascript
// camelCase → snake_case mapping
const fieldMapping = {
  // Core
  displayName: 'display_name',
  companyName: 'company_name',
  vendorCode: 'vendor_code',
  
  // Contact
  firstName: 'first_name',
  lastName: 'last_name',
  workPhone: 'work_phone',
  mobilePhone: 'mobile_phone',
  
  // Tax
  gstin: 'gstin',
  msmeRegistered: 'msme_registered',
  
  // Financial
  paymentTerms: 'payment_terms',
  
  // Organization
  websiteUrl: 'website_url',
  
  // Billing
  billingAttention: 'billing_attention',
  billingCountry: 'billing_country',
  billingAddress1: 'billing_address1',
  billingAddress2: 'billing_address2',
  billingCity: 'billing_city',
  billingState: 'billing_state',
  billingPinCode: 'billing_pin_code',
  
  // Shipping
  shippingAttention: 'shipping_attention',
  shippingCountry: 'shipping_country',
  shippingAddress1: 'shipping_address1',
  shippingAddress2: 'shipping_address2',
  shippingCity: 'shipping_city',
  shippingState: 'shipping_state',
  shippingPinCode: 'shipping_pin_code'
};
```

### Backend to Frontend Conversion
```javascript
// snake_case → camelCase mapping in Vendors.js fetchVendors()
const mappedVendor = {
  id: vendor.id,
  vendorCode: vendor.vendor_code,
  displayName: vendor.display_name,
  companyName: vendor.company_name,
  
  firstName: vendor.first_name,
  lastName: vendor.last_name,
  workPhone: vendor.work_phone,
  mobilePhone: vendor.mobile_phone,
  
  gstin: vendor.gstin,
  msmeRegistered: vendor.msme_registered,
  
  paymentTerms: vendor.payment_terms,
  
  websiteUrl: vendor.website_url,
  
  billingCity: vendor.billing_city,
  billingState: vendor.billing_state,
  // ... etc
};
```

### Boolean Handling
```javascript
// JavaScript boolean → MySQL BOOLEAN (0/1)
msmeRegistered: true  → msme_registered: 1
msmeRegistered: false → msme_registered: 0

// MySQL BOOLEAN (0/1) → JavaScript boolean
msme_registered: 1 → msmeRegistered: true
msme_registered: 0 → msmeRegistered: false
```

### Status Handling
```javascript
// Database: ENUM('active', 'inactive')
// Display: 'Active' or 'Inactive'

status === 'active' ? 'Active' : 'Inactive'
```

---

## API Payload Examples

### Create Vendor Payload
```json
{
  "displayName": "ABC Supplies",
  "vendorCode": "VENDOR-001",
  "companyName": "ABC Trading Company",
  "salutation": "Mr.",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@abcsupplies.com",
  "workPhone": "+91-11-2345-6789",
  "mobilePhone": "+91-98765-43210",
  "pan": "ABCDE1234F",
  "gstin": "27AACFU5055K1Z0",
  "msmeRegistered": false,
  "currency": "INR",
  "paymentTerms": "Net 30",
  "tds": "5%",
  "website": "https://abcsupplies.com",
  "department": "Sales",
  "designation": "Manager",
  "billingCity": "Mumbai",
  "billingState": "Maharashtra",
  "billingCountry": "India",
  "billingAddress1": "123 Business Park",
  "billingCity": "Mumbai",
  "billingPinCode": "400001",
  "remarks": "Preferred vendor for supplies"
}
```

### Update Vendor Payload (Status Change)
```json
{
  "status": "inactive"
}
```

### Database Response (getVendor)
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "abc123",
  "vendor_code": "VENDOR-001",
  "display_name": "ABC Supplies",
  "company_name": "ABC Trading Company",
  "salutation": "Mr.",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@abcsupplies.com",
  "work_phone": "+91-11-2345-6789",
  "mobile_phone": "+91-98765-43210",
  "pan": "ABCDE1234F",
  "gstin": "27AACFU5055K1Z0",
  "msme_registered": 0,
  "currency": "INR",
  "payment_terms": "Net 30",
  "tds": "5%",
  "website_url": "https://abcsupplies.com",
  "department": "Sales",
  "designation": "Manager",
  "billing_city": "Mumbai",
  "billing_state": "Maharashtra",
  "billing_country": "India",
  "billing_address1": "123 Business Park",
  "billing_pin_code": "400001",
  "remarks": "Preferred vendor for supplies",
  "status": "active",
  "created_at": "2026-01-29T10:30:00.000Z",
  "updated_at": "2026-01-29T10:30:00.000Z"
}
```

---

## Form Field Organization

### New Vendor Form Tabs
1. **Primary Contact** (auto-tab)
   - Display Name ✅
   - Salutation
   - First Name, Last Name

2. **Other Details** (Tab 1)
   - Company Name
   - Vendor Code
   - Currency, Payment Terms, TDS
   - MSME Registered

3. **Address** (Tab 2)
   - Billing Address (7 fields)
   - Shipping Address (7 fields)

4. **Contact Persons** (Tab 3)
   - [Expandable table for multiple contacts]

5. **Bank Details** (Tab 4)
   - [Bank info fields]

6. **Custom Fields** (Tab 5)
   - [Custom field values]

7. **Reporting Tags** (Tab 6)
   - [Category/tag assignments]

8. **Remarks** (Tab 7)
   - General notes

---

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---|
| displayName | Required, max 255 chars | Display Name is required |
| email | Optional, valid email format | Invalid email format |
| workPhone | Optional, phone format | Invalid phone number |
| gstin | Optional, valid GSTIN (15 chars) | Invalid GSTIN format |
| pan | Optional, valid PAN (10 chars) | Invalid PAN format |
| billingCity | Optional if address provided | - |
| paymentTerms | Optional dropdown | - |
| currency | Optional, dropdown (INR/USD/EUR) | - |

---

## Database Indexes

```sql
UNIQUE KEY unique_tenant_vendor_code (tenant_id, vendor_code)
INDEX idx_tenant_status (tenant_id, status)
INDEX idx_tenant_email (tenant_id, email)
FOREIGN KEY (tenant_id) REFERENCES tenants(id)
```

**Query Performance:**
- List vendors: Uses `idx_tenant_status` ✅
- Find by email: Uses `idx_tenant_email` ✅
- Filter by status: Uses `idx_tenant_status` ✅
- Unique code per tenant: Uses `unique_tenant_vendor_code` ✅

---

## Total Field Count

- **Required Fields:** 1 (displayName)
- **Recommended Fields:** 6 (email, gstin, pan, billing_address1, billing_city, billing_state)
- **Optional Fields:** 33
- **System Fields:** 4 (id, tenant_id, created_at, updated_at)
- **Total:** 40 fields

---

**Last Updated:** January 29, 2026
**Status:** ✅ Complete & Production Ready
