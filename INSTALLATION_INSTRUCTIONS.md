# Installation Instructions - Invoice Branding Feature

## Prerequisites

Before installing this feature, ensure you have:
- ✅ Node.js 18+ installed
- ✅ MySQL database running
- ✅ Backend server configured
- ✅ Frontend application running
- ✅ Admin access to the system

---

## Installation Steps

### Step 1: Install Dependencies

Navigate to the Backend directory and install required packages:

```bash
cd Backend
npm install multer
```

**What this does:**
- Installs Multer for handling file uploads
- Required for image upload functionality

---

### Step 2: Run Database Migration

Execute the setup script to create the database table:

```bash
node setup-company-settings.js
```

**What this does:**
- Creates `company_settings` table in database
- Creates upload directories:
  - `uploads/company/logos/`
  - `uploads/company/stamps/`
  - `uploads/company/signatures/`
- Sets up file structure

**Expected Output:**
```
Setting up company settings table...
✓ Company settings table created successfully
✓ Created directory: uploads/company/logos
✓ Created directory: uploads/company/stamps
✓ Created directory: uploads/company/signatures

✓ Company settings feature setup completed successfully!

You can now:
1. Navigate to Settings → Company Settings in the application
2. Upload your company logo, stamp, and signature
3. Generate professional invoices with your branding
```

---

### Step 3: Verify Database Table

Check that the table was created successfully:

```sql
USE your_database_name;
DESCRIBE company_settings;
```

**Expected Result:**
```
+----------------------------------+--------------+------+-----+
| Field                            | Type         | Null | Key |
+----------------------------------+--------------+------+-----+
| id                               | int          | NO   | PRI |
| institution_id                   | varchar(255) | NO   | UNI |
| company_name                     | varchar(255) | YES  |     |
| logo_path                        | varchar(500) | YES  |     |
| stamp_path                       | varchar(500) | YES  |     |
| signature_path                   | varchar(500) | YES  |     |
| authorized_signatory_name        | varchar(255) | YES  |     |
| authorized_signatory_designation | varchar(255) | YES  |     |
| created_at                       | timestamp    | YES  |     |
| updated_at                       | timestamp    | YES  |     |
+----------------------------------+--------------+------+-----+
```

---

### Step 4: Restart Backend Server

Stop and restart your backend server:

```bash
# Stop the server (Ctrl+C if running)
# Then start it again
npm start
```

**Or if using PM2:**
```bash
pm2 restart ims-backend
```

---

### Step 5: Verify API Endpoints

Test that the new endpoints are accessible:

```bash
# Test GET endpoint (requires authentication)
curl -X GET http://localhost:3000/api/company-settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {}
}
```

---

### Step 6: Access Frontend

1. Open your browser
2. Navigate to your application URL
3. Login with admin credentials
4. Go to **Settings** in the sidebar
5. Click **Company Settings**

**You should see:**
- Company information form
- Upload buttons for Logo, Stamp, Signature
- Preview tab

---

### Step 7: Upload Test Images

Prepare test images:
- Logo: 200x80px PNG
- Stamp: 150x150px PNG
- Signature: 200x80px PNG

Upload each image:
1. Click "Upload Logo"
2. Select your logo file
3. Wait for success message
4. Repeat for Stamp and Signature

---

### Step 8: Generate Test Invoice

1. Navigate to Invoices
2. Create a new invoice (Purchase or Sales)
3. Fill in required details
4. Save the invoice
5. Click "Download PDF"
6. Open the PDF and verify:
   - Logo appears in header
   - Signature appears at bottom
   - Stamp overlays signature

---

## Verification Checklist

After installation, verify:

- [ ] Database table created successfully
- [ ] Upload directories exist
- [ ] Backend server starts without errors
- [ ] API endpoints respond correctly
- [ ] Frontend page loads
- [ ] Can upload logo
- [ ] Can upload stamp
- [ ] Can upload signature
- [ ] Can view uploaded images
- [ ] Can delete uploaded images
- [ ] Preview tab works
- [ ] PDF generation includes images
- [ ] Images appear correctly in PDF
- [ ] Print quality is acceptable

---

## Troubleshooting Installation

### Issue: Database table not created

**Solution:**
```bash
# Manually run the SQL script
mysql -u your_user -p your_database < src/database/migrations/create-company-settings.sql
```

### Issue: Upload directories not created

**Solution:**
```bash
# Manually create directories
mkdir -p uploads/company/logos
mkdir -p uploads/company/stamps
mkdir -p uploads/company/signatures
```

### Issue: Permission denied on upload

**Solution:**
```bash
# Set proper permissions (Linux/Mac)
chmod -R 755 uploads/

# Or for Windows, ensure the folder is not read-only
```

### Issue: Module 'multer' not found

**Solution:**
```bash
# Reinstall dependencies
npm install
# Or specifically install multer
npm install multer
```

### Issue: API endpoint returns 404

**Solution:**
1. Check that `company-settings.js` route file exists
2. Verify it's imported in `api.js`
3. Restart the server
4. Check server logs for errors

### Issue: Images not showing in PDF

**Solution:**
1. Check database for file paths
2. Verify files exist in upload directory
3. Check file permissions
4. Ensure institutionId is passed to PDF service

---

## Post-Installation Configuration

### 1. Set File Size Limits (Optional)

Edit `Backend/src/routes/company-settings.js`:

```javascript
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Change to 10MB
  fileFilter: fileFilter
});
```

### 2. Configure Allowed File Types (Optional)

Edit `Backend/src/routes/company-settings.js`:

```javascript
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|svg|webp/; // Add webp
  // ... rest of the code
};
```

### 3. Set Image Quality (Optional)

For better print quality, you can add image processing with Sharp:

```bash
npm install sharp
```

Then modify the upload handler to optimize images.

---

## Environment Variables (Optional)

Add to your `.env` file:

```env
# File Upload Settings
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads
ALLOWED_FILE_TYPES=jpeg,jpg,png,gif,svg
```

---

## Security Considerations

After installation:

1. **Verify File Validation**
   - Only image files can be uploaded
   - File size is limited
   - File types are restricted

2. **Check Access Control**
   - Only authenticated users can upload
   - Files are institution-specific
   - No cross-institution access

3. **Review File Storage**
   - Files stored outside web root
   - Served through Express middleware
   - Proper permissions set

---

## Performance Optimization (Optional)

### 1. Enable Image Caching

Add to `Backend/src/app.js`:

```javascript
app.use('/uploads', express.static('uploads', {
  maxAge: '1d', // Cache for 1 day
  etag: true
}));
```

### 2. Compress Images on Upload

Install Sharp and add compression:

```bash
npm install sharp
```

```javascript
const sharp = require('sharp');

// In upload handler
await sharp(file.path)
  .resize(200, 80, { fit: 'inside' })
  .png({ quality: 90 })
  .toFile(outputPath);
```

---

## Backup Recommendations

After installation:

1. **Backup Database**
   ```bash
   mysqldump -u user -p database > backup.sql
   ```

2. **Backup Upload Directory**
   ```bash
   tar -czf uploads-backup.tar.gz uploads/
   ```

3. **Schedule Regular Backups**
   - Daily database backups
   - Weekly file backups
   - Store backups off-site

---

## Monitoring

Set up monitoring for:

1. **Upload Directory Size**
   ```bash
   du -sh uploads/company/
   ```

2. **Failed Uploads**
   - Check server logs
   - Monitor error rates

3. **Storage Usage**
   - Track disk space
   - Set up alerts for low space

---

## Rollback Instructions

If you need to rollback:

### 1. Remove Database Table
```sql
DROP TABLE IF EXISTS company_settings;
```

### 2. Remove Upload Directories
```bash
rm -rf uploads/company/
```

### 3. Uninstall Multer (Optional)
```bash
npm uninstall multer
```

### 4. Revert Code Changes
```bash
git checkout -- .
```

---

## Next Steps

After successful installation:

1. ✅ Read the full documentation: `INVOICE_BRANDING_FEATURE.md`
2. ✅ Review the layout guide: `INVOICE_LAYOUT_GUIDE.md`
3. ✅ Prepare your company images
4. ✅ Upload and test with sample invoice
5. ✅ Train users on the new feature
6. ✅ Set up regular backups

---

## Support

If you encounter issues during installation:

1. Check the logs: `Backend/logs/error.log`
2. Review this troubleshooting section
3. Verify all prerequisites are met
4. Check file permissions
5. Ensure database connection is working

---

## Installation Complete! 🎉

You've successfully installed the Invoice Branding Feature!

**What you can do now:**
- Upload your company logo
- Upload your company stamp
- Upload authorized signature
- Generate professional branded invoices
- Print high-quality invoices

**Remember to:**
- Use high-quality images (300 DPI)
- Test print output
- Keep backup copies of images
- Train users on the feature

---

**Installation Date**: _______________
**Installed By**: _______________
**Version**: 1.0.0
**Status**: ✅ Complete
