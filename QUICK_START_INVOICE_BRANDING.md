# Quick Start Guide - Invoice Branding Feature

## What's New?

Your invoice system now supports uploading and displaying:
- ✅ **Company Logo** - Appears at the top of invoices
- ✅ **Company Stamp** - Official seal on invoices
- ✅ **Authorized Signature** - Digital signature on invoices

All these elements are automatically included in PDF invoices for professional, print-ready documents.

## Installation Steps

### 1. Run Database Migration

```bash
cd Backend
node setup-company-settings.js
```

This will:
- Create the `company_settings` table
- Create upload directories for images
- Set up the necessary file structure

### 2. Install Dependencies (if not already installed)

```bash
cd Backend
npm install multer
```

### 3. Restart Backend Server

```bash
npm start
```

### 4. Access the Feature

1. Login to your application
2. Go to **Settings → Company Settings** in the sidebar
3. Upload your logo, stamp, and signature
4. Save your company information

## File Requirements

### Logo
- **Format**: PNG (transparent background recommended)
- **Size**: 200x80 pixels recommended
- **Max File Size**: 5MB
- **Placement**: Top-left of invoice

### Stamp
- **Format**: PNG (transparent background recommended)
- **Size**: 150x150 pixels (circular design)
- **Max File Size**: 5MB
- **Placement**: Overlapping signature area

### Signature
- **Format**: PNG (transparent background recommended)
- **Size**: 200x80 pixels
- **Max File Size**: 5MB
- **Placement**: Bottom-right, above signatory name

## How to Use

### Upload Images

1. Navigate to **Settings → Company Settings**
2. Click **Upload Logo** and select your company logo
3. Click **Upload Stamp** and select your company stamp
4. Click **Upload Signature** and select the authorized signature
5. Fill in the authorized signatory name and designation
6. Click **Save Settings**

### Generate Invoice with Branding

When you generate any invoice (Purchase or Sales):
1. Create invoice as usual
2. Click **Download PDF** or **Print**
3. The PDF will automatically include:
   - Your company logo in the header
   - Signature at the bottom
   - Stamp overlapping the signature

### Remove/Replace Images

1. Go to **Settings → Company Settings**
2. Click **Remove Logo/Stamp/Signature** button
3. Upload a new image if needed

## API Endpoints

For developers integrating with the API:

```
GET    /api/company-settings              - Get current settings
PUT    /api/company-settings              - Update company info
POST   /api/company-settings/upload/:type - Upload logo/stamp/signature
DELETE /api/company-settings/upload/:type - Delete uploaded file
```

## Files Created/Modified

### New Files
```
Backend/
├── src/
│   ├── controllers/companySettingsController.js
│   ├── routes/company-settings.js
│   └── database/migrations/create-company-settings.sql
├── setup-company-settings.js
└── uploads/company/
    ├── logos/
    ├── stamps/
    └── signatures/

Frontend/
└── src/pages/CompanySettings.jsx
```

### Modified Files
```
Backend/
├── src/
│   ├── app.js (added static file serving)
│   ├── routes/api.js (added company-settings route)
│   └── services/invoicePDFService.js (updated to include images)

Frontend/
├── src/
│   ├── App.jsx (added route)
│   └── components/Sidebar.jsx (added menu item)
```

## Troubleshooting

### Images not showing in PDF?
- Check that files were uploaded successfully
- Verify the database has the correct file paths
- Ensure the `uploads` directory has proper permissions

### Upload fails?
- Check file size (must be under 5MB)
- Verify file format (PNG, JPG, JPEG, GIF, SVG only)
- Check server logs for detailed error messages

### Poor image quality in PDF?
- Use higher resolution images (300 DPI recommended)
- Use PNG format for best quality
- Ensure images are clear before uploading

## Testing

To test the feature:

1. ✅ Upload a logo
2. ✅ Upload a stamp
3. ✅ Upload a signature
4. ✅ Create a test invoice
5. ✅ Download PDF and verify all images appear
6. ✅ Print the PDF to check print quality
7. ✅ Test removing and re-uploading images

## Benefits

✨ **Professional Appearance**: Branded invoices look more professional
✨ **Legal Compliance**: Stamps and signatures add authenticity
✨ **Print Ready**: High-quality output suitable for printing
✨ **Easy Management**: Upload once, use on all invoices
✨ **Flexible**: Easy to update or change branding elements

## Next Steps

1. Prepare your logo, stamp, and signature images
2. Run the setup script
3. Upload your branding elements
4. Generate a test invoice
5. Review and adjust images if needed

## Support

For detailed documentation, see: `INVOICE_BRANDING_FEATURE.md`

For issues:
- Check `Backend/logs/` for error messages
- Verify database connection
- Check file permissions on upload directories

---

**Ready to make your invoices look professional!** 🎉
