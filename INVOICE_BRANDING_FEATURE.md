# Invoice Logo, Stamp & Signature Feature

## Overview
This feature allows companies to upload and manage their logo, official stamp, and authorized signature for professional invoice generation. These elements are automatically included in PDF invoices for both purchase and sales invoices.

## Features Implemented

### 1. Database Schema
- **Table**: `company_settings`
- **Columns**:
  - `id`: Primary key
  - `institution_id`: Unique identifier for the company
  - `company_name`: Company name
  - `logo_path`: Path to uploaded logo image
  - `stamp_path`: Path to uploaded stamp image
  - `signature_path`: Path to uploaded signature image
  - `authorized_signatory_name`: Name of authorized person
  - `authorized_signatory_designation`: Designation (e.g., CEO, Director)
  - `created_at`, `updated_at`: Timestamps

### 2. Backend API Endpoints

#### Get Company Settings
```
GET /api/company-settings
```
Returns current company settings including paths to uploaded files.

#### Update Company Settings
```
PUT /api/company-settings
Body: {
  companyName: string,
  authorizedSignatoryName: string,
  authorizedSignatoryDesignation: string
}
```
Updates company information.

#### Upload File (Logo/Stamp/Signature)
```
POST /api/company-settings/upload/:fileType
Content-Type: multipart/form-data
Body: file (image file)
```
- `fileType`: 'logo', 'stamp', or 'signature'
- Accepts: JPEG, JPG, PNG, GIF, SVG
- Max size: 5MB
- Files stored in: `/uploads/company/{fileType}s/`

#### Delete File
```
DELETE /api/company-settings/upload/:fileType
```
Removes uploaded file and deletes from filesystem.

### 3. PDF Invoice Generation

The `invoicePDFService` has been updated to include:

#### Logo Placement
- Position: Top-left of invoice header
- Size: 80x60 pixels (auto-scaled)
- Appears next to company name and address

#### Signature Placement
- Position: Bottom-right, in authorized signatory section
- Size: 100x40 pixels (auto-scaled)
- Appears above signatory name and designation

#### Stamp Placement
- Position: Overlapping signature area (bottom-right)
- Size: 60x60 pixels (auto-scaled)
- Creates official seal effect

### 4. Frontend Interface

#### Company Settings Page
Location: `/company-settings`

**Features**:
- Upload logo, stamp, and signature
- Preview uploaded images
- Delete uploaded images
- Update company information
- Update authorized signatory details

**Image Requirements**:
- Logo: Recommended 200x80px, transparent PNG
- Stamp: Recommended 150x150px, circular design, transparent PNG
- Signature: Recommended 200x80px, transparent PNG or white background
- All images: Max 5MB, formats: PNG, JPG, JPEG, GIF, SVG
- For print quality: Use 300 DPI images

### 5. File Structure

```
Backend/
├── src/
│   ├── controllers/
│   │   └── companySettingsController.js
│   ├── routes/
│   │   └── company-settings.js
│   ├── services/
│   │   └── invoicePDFService.js (updated)
│   └── database/
│       └── migrations/
│           └── create-company-settings.sql
└── uploads/
    └── company/
        ├── logos/
        ├── stamps/
        └── signatures/

Frontend/
└── src/
    └── pages/
        └── CompanySettings.jsx
```

## Usage Instructions

### For Administrators

1. **Navigate to Company Settings**
   - Go to Settings → Company Settings in the sidebar

2. **Upload Company Logo**
   - Click "Upload Logo" button
   - Select your company logo (PNG recommended)
   - Logo will appear on all invoices

3. **Upload Company Stamp**
   - Click "Upload Stamp" button
   - Select your official company seal/stamp
   - Stamp will overlay signature on invoices

4. **Upload Authorized Signature**
   - Click "Upload Signature" button
   - Select signature image of authorized person
   - Signature appears at bottom of invoices

5. **Update Signatory Information**
   - Enter authorized signatory name
   - Enter designation (e.g., CEO, Managing Director)
   - Click "Save Settings"

### For Developers

#### Database Migration
Run the migration to create the company_settings table:
```sql
-- Execute: create-company-settings.sql
```

#### Install Required Dependencies
```bash
npm install multer
```

#### File Upload Configuration
- Storage: Local filesystem
- Path: `/uploads/company/{fileType}s/`
- Naming: `{institutionId}_{timestamp}.{ext}`
- Validation: Image files only, max 5MB

#### PDF Generation with Images
```javascript
// The service automatically fetches company settings
const pdfBuffer = await invoicePDFService.generatePDFBuffer(
  standardInvoice,
  institutionId  // Pass institution ID to fetch settings
);
```

## Security Considerations

1. **File Validation**
   - Only image files allowed
   - File size limited to 5MB
   - File type validation on both frontend and backend

2. **Access Control**
   - All endpoints require authentication
   - Institution-specific data isolation
   - Files stored with institution ID prefix

3. **File Storage**
   - Files stored outside web root
   - Served through Express static middleware
   - Automatic cleanup on deletion

## Best Practices

### Image Preparation

1. **Logo**
   - Use transparent background PNG
   - Keep aspect ratio around 2.5:1 (width:height)
   - Ensure text is readable at small sizes
   - Recommended: 200x80px at 300 DPI

2. **Stamp**
   - Use circular design
   - Transparent background PNG
   - Include company name and registration details
   - Recommended: 150x150px at 300 DPI

3. **Signature**
   - Scan actual signature at high resolution
   - Remove background (make transparent)
   - Ensure signature is clear and legible
   - Recommended: 200x80px at 300 DPI

### Invoice Layout

The standard invoice layout includes:
```
┌─────────────────────────────────────┐
│ [LOGO]  Company Name                │
│         Address                     │
│         Contact Info                │
├─────────────────────────────────────┤
│ Invoice Details                     │
│ Party Details                       │
├─────────────────────────────────────┤
│ Line Items Table                    │
├─────────────────────────────────────┤
│ Totals                              │
├─────────────────────────────────────┤
│ Notes & Terms                       │
│                                     │
│              Authorized Signatory   │
│              [SIGNATURE]            │
│              [STAMP]                │
│              Name                   │
│              Designation            │
└─────────────────────────────────────┘
```

## Troubleshooting

### Images Not Appearing in PDF

1. Check file paths in database
2. Verify files exist in upload directory
3. Check file permissions
4. Ensure institutionId is passed to PDF service

### Upload Fails

1. Check file size (max 5MB)
2. Verify file format (PNG, JPG, etc.)
3. Check upload directory permissions
4. Verify multer configuration

### Image Quality Issues

1. Use higher resolution images (300 DPI)
2. Use PNG format for transparency
3. Ensure proper aspect ratios
4. Test print output before finalizing

## Future Enhancements

Potential improvements:
- Image cropping/editing tool
- Multiple signature support
- Digital signature integration
- Watermark support
- Template customization
- Position adjustment controls
- Preview before saving

## API Response Examples

### Get Settings Response
```json
{
  "success": true,
  "data": {
    "id": 1,
    "institution_id": "inst_123",
    "company_name": "ACME Corporation",
    "logo_path": "/uploads/company/logos/inst_123_1234567890.png",
    "stamp_path": "/uploads/company/stamps/inst_123_1234567891.png",
    "signature_path": "/uploads/company/signatures/inst_123_1234567892.png",
    "authorized_signatory_name": "John Doe",
    "authorized_signatory_designation": "CEO"
  }
}
```

### Upload Response
```json
{
  "success": true,
  "message": "logo uploaded successfully",
  "data": {
    "path": "/uploads/company/logos/inst_123_1234567890.png"
  }
}
```

## Testing Checklist

- [ ] Upload logo successfully
- [ ] Upload stamp successfully
- [ ] Upload signature successfully
- [ ] Delete uploaded files
- [ ] Update company information
- [ ] Generate PDF with all elements
- [ ] Verify image quality in PDF
- [ ] Test with different image formats
- [ ] Test file size limits
- [ ] Test without uploaded images (graceful fallback)
- [ ] Test print output quality
- [ ] Verify multi-institution isolation

## Support

For issues or questions:
1. Check logs in `Backend/logs/`
2. Verify database migrations
3. Check file permissions
4. Review API responses
5. Test with sample images

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Author**: IMS Development Team
