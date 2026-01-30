# Customer Bank Details Management

## Overview
The Customer Bank Details feature allows you to store and manage multiple bank account information for each customer. This is useful for payment processing, refunds, and financial reconciliation.

## Database Schema

### customer_bank_details Table
```sql
CREATE TABLE IF NOT EXISTS customer_bank_details (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  customer_id VARCHAR(36) NOT NULL,
  bank_name VARCHAR(255),
  account_holder_name VARCHAR(255),
  account_number VARCHAR(50),
  ifsc_code VARCHAR(50),
  account_type VARCHAR(50),
  branch_name VARCHAR(255),
  swift_code VARCHAR(50),
  iban VARCHAR(50),
  is_primary TINYINT DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_by VARCHAR(36),
  updated_by VARCHAR(36),
  INDEX idx_institution_customer (institution_id, customer_id),
  INDEX idx_customer (customer_id),
  CONSTRAINT fk_customer_bank_institution FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_bank_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
)
```

## Available Fields

| Field | Type | Description | Required |
|-------|------|-------------|----------|
| bank_name | String | Name of the bank | Optional |
| account_holder_name | String | Name of the account holder | Optional |
| account_number | String | Bank account number | Optional |
| ifsc_code | String | IFSC code (India) | Optional |
| account_type | String | Type of account (Savings, Current, etc.) | Optional |
| branch_name | String | Bank branch name | Optional |
| swift_code | String | SWIFT code (International) | Optional |
| iban | String | IBAN (International) | Optional |
| is_primary | Boolean | Mark as primary account | Optional |

## API Endpoints

### 1. Add Bank Details
**POST** `/api/customers/:customerId/bank-details`

**Permission Required:** `customer_management`

**Request Body:**
```json
{
  "bankName": "HDFC Bank",
  "accountHolderName": "John Doe",
  "accountNumber": "1234567890",
  "ifscCode": "HDFC0000001",
  "accountType": "Savings",
  "branchName": "Mumbai Main",
  "isPrimary": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank details added successfully",
  "data": {
    "bankDetailId": "uuid-string"
  }
}
```

### 2. Get Bank Details
**GET** `/api/customers/:customerId/bank-details`

**Permission Required:** `customer_view`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "institutionId": "uuid-string",
      "customerId": "uuid-string",
      "bankName": "HDFC Bank",
      "accountHolderName": "John Doe",
      "accountNumber": "1234567890",
      "ifscCode": "HDFC0000001",
      "accountType": "Savings",
      "branchName": "Mumbai Main",
      "swiftCode": null,
      "iban": null,
      "isPrimary": 1,
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### 3. Update Bank Details
**PUT** `/api/customers/:customerId/bank-details/:bankDetailId`

**Permission Required:** `customer_management`

**Request Body:**
```json
{
  "bankName": "HDFC Bank",
  "accountHolderName": "John Doe",
  "accountNumber": "9876543210",
  "ifscCode": "HDFC0000001",
  "accountType": "Current",
  "branchName": "Mumbai Main",
  "isPrimary": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bank details updated successfully"
}
```

### 4. Delete Bank Details
**DELETE** `/api/customers/:customerId/bank-details/:bankDetailId`

**Permission Required:** `customer_management`

**Response:**
```json
{
  "success": true,
  "message": "Bank details deleted successfully"
}
```

## Service Methods

The `customerService.js` includes the following methods:

### addCustomerBankDetails(institutionId, customerId, bankData)
Adds new bank details for a customer.

**Parameters:**
- `institutionId` (String): institution ID
- `customerId` (String): Customer ID
- `bankData` (Object): Bank details object

**Returns:** Bank detail ID (UUID)

### getCustomerBankDetails(institutionId, customerId)
Retrieves all bank details for a customer.

**Parameters:**
- `institutionId` (String): institution ID
- `customerId` (String): Customer ID

**Returns:** Array of bank detail objects

### updateCustomerBankDetails(institutionId, bankDetailId, bankData)
Updates existing bank details.

**Parameters:**
- `institutionId` (String): institution ID
- `bankDetailId` (String): Bank detail ID
- `bankData` (Object): Updated bank details

**Returns:** true on success

### deleteCustomerBankDetails(institutionId, bankDetailId)
Deletes bank details.

**Parameters:**
- `institutionId` (String): institution ID
- `bankDetailId` (String): Bank detail ID

**Returns:** true on success

## Controller Methods

The `customerController.js` includes:

- `addBankDetails(req, res)` - POST handler
- `getBankDetails(req, res)` - GET handler
- `updateBankDetails(req, res)` - PUT handler
- `deleteBankDetails(req, res)` - DELETE handler

## Setup Instructions

### 1. Create the Database Table
Run the migration script:
```bash
node create-customer-bank-details-table.js
```

### 2. Add Permissions
Ensure your role configuration includes:
- `customer_management` - For creating, updating, deleting bank details
- `customer_view` - For viewing bank details

### 3. Update Frontend
Add components for managing customer bank details in the Customers page:
- BankDetailsForm component
- BankDetailsTable component
- Modal for bank details management

## Usage Examples

### Add Bank Details
```javascript
const response = await fetch('/api/customers/customer-123/bank-details', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({
    bankName: 'HDFC Bank',
    accountHolderName: 'John Doe',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0000001',
    accountType: 'Savings',
    branchName: 'Mumbai Main',
    isPrimary: true
  })
});

const data = await response.json();
console.log(data.data.bankDetailId);
```

### Get Bank Details
```javascript
const response = await fetch('/api/customers/customer-123/bank-details', {
  headers: {
    'Authorization': 'Bearer token'
  }
});

const data = await response.json();
console.log(data.data);
```

### Update Bank Details
```javascript
const response = await fetch('/api/customers/customer-123/bank-details/bank-detail-123', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer token'
  },
  body: JSON.stringify({
    bankName: 'HDFC Bank',
    accountHolderName: 'Jane Doe',
    accountNumber: '9876543210',
    ifscCode: 'HDFC0000002',
    accountType: 'Current',
    isPrimary: true
  })
});

const data = await response.json();
console.log(data);
```

### Delete Bank Details
```javascript
const response = await fetch('/api/customers/customer-123/bank-details/bank-detail-123', {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer token'
  }
});

const data = await response.json();
console.log(data);
```

## Validation Rules

- **Bank Name**: Optional, max 255 characters
- **Account Holder Name**: Optional, max 255 characters
- **Account Number**: Optional, max 50 characters, alphanumeric
- **IFSC Code**: Optional, max 50 characters, follows IFSC format
- **Account Type**: Optional, predefined values (Savings, Current, Overdraft, etc.)
- **Branch Name**: Optional, max 255 characters
- **SWIFT Code**: Optional, max 50 characters, follows SWIFT format
- **IBAN**: Optional, max 50 characters, follows IBAN format

## Audit Trail

All bank details operations are logged with:
- Action type (created, updated, deleted)
- User ID who performed the action
- Timestamp
- institution ID
- Customer ID

Audit log events:
- `customer_bank_details_added`
- `customer_bank_details_updated`
- `customer_bank_details_deleted`

## Security Considerations

1. **Permission Checks**: All endpoints require appropriate permissions
2. **institution Isolation**: Data is isolated by institution_id
3. **Sensitive Data**: Account numbers should be encrypted in production
4. **Audit Trail**: All operations are logged for compliance

## Future Enhancements

- Account number encryption/masking
- Bank account verification
- Multiple currency support
- Payment gateway integration
- Account statement integration
