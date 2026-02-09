# Invoice Layout Guide - Logo, Stamp & Signature Placement

## Standard Invoice Layout

```
┌─────────────────────────────────────────────────────────────────┐
│                         INVOICE HEADER                          │
│                                                                 │
│  ┌────────┐                                                     │
│  │        │   COMPANY NAME                                      │
│  │  LOGO  │   123 Business Street                               │
│  │        │   City, State 12345                                 │
│  └────────┘   Phone: (123) 456-7890 | Email: info@company.com  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  INVOICE                          BILL TO                       │
│  Invoice #: INV-001               Customer Name                 │
│  Date: 2024-01-15                 Customer Address              │
│  Due Date: 2024-02-15             City, State ZIP               │
│  Currency: USD                                                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                         LINE ITEMS                              │
│                                                                 │
│  S.No  Description         Qty    Unit Price    Total           │
│  ────────────────────────────────────────────────────────────   │
│   1    Product A            2      $100.00      $200.00         │
│   2    Product B            1      $150.00      $150.00         │
│   3    Product C            3       $50.00      $150.00         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                      Subtotal:      $500.00     │
│                                      Discount:      -$50.00     │
│                                      Tax (10%):      $45.00     │
│                                      ─────────────────────      │
│                                      TOTAL:         $495.00     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NOTES:                                                         │
│  Thank you for your business!                                   │
│  Payment terms: Net 30 days                                     │
│                                                                 │
│  TERMS & CONDITIONS:                                            │
│  1. Payment due within 30 days                                  │
│  2. Late payments subject to 1.5% monthly interest              │
│                                                                 │
│                                                                 │
│                                    Authorized Signatory         │
│                                                                 │
│                                    ┌──────────────┐             │
│                                    │              │             │
│                              ┌───┐ │  SIGNATURE   │             │
│                              │ S │ │              │             │
│                              │ T │ └──────────────┘             │
│                              │ A │                              │
│                              │ M │  John Doe                    │
│                              │ P │  Chief Executive Officer     │
│                              └───┘  Date: 2024-01-15            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Element Specifications

### 1. LOGO (Top-Left)
```
Position: Header, Left Side
Size: 80x60 pixels (auto-scaled)
Format: PNG (transparent background)
Recommended Original: 200x80px @ 300 DPI

┌────────────┐
│            │
│    LOGO    │
│            │
└────────────┘
```

### 2. SIGNATURE (Bottom-Right)
```
Position: Footer, Right Side, Above Name
Size: 100x40 pixels (auto-scaled)
Format: PNG (transparent background)
Recommended Original: 200x80px @ 300 DPI

┌──────────────────┐
│                  │
│   [Signature]    │
│                  │
└──────────────────┘
```

### 3. STAMP (Bottom-Right, Overlapping)
```
Position: Footer, Overlapping Signature
Size: 60x60 pixels (auto-scaled)
Format: PNG (transparent background)
Recommended Original: 150x150px @ 300 DPI

    ┌─────┐
    │  S  │
    │  T  │
    │  A  │
    │  M  │
    │  P  │
    └─────┘
```

## Combined Footer Layout

```
                    Authorized Signatory
                    
        ┌───┐       ┌──────────────┐
        │ S │       │              │
        │ T │       │  SIGNATURE   │
        │ A │       │              │
        │ M │       └──────────────┘
        │ P │       
        └───┘       John Doe
                    Chief Executive Officer
                    Date: 2024-01-15
```

## Image Preparation Guide

### Logo Preparation
1. **Remove Background**
   - Use transparent PNG
   - Remove any white/colored background
   - Keep only logo elements

2. **Resize**
   - Target: 200x80 pixels
   - Maintain aspect ratio
   - Use 300 DPI for print quality

3. **Format**
   - Save as PNG-24 (with transparency)
   - Optimize file size (under 5MB)
   - Test on white and colored backgrounds

### Stamp Preparation
1. **Design**
   - Circular shape recommended
   - Include company name
   - Include registration/license number
   - Add border for definition

2. **Transparency**
   - Remove background completely
   - Keep only stamp elements
   - Ensure text is readable

3. **Size**
   - Target: 150x150 pixels (square)
   - Circular design within square
   - 300 DPI for print quality

### Signature Preparation
1. **Scan**
   - Scan actual signature at high resolution
   - Use 600 DPI scanner if available
   - Ensure signature is clear

2. **Clean Up**
   - Remove background
   - Adjust contrast for clarity
   - Remove any artifacts or noise

3. **Format**
   - Save as PNG with transparency
   - Target: 200x80 pixels
   - Ensure signature is legible at small size

## Color Recommendations

### Logo
- Use full color if brand requires
- Ensure readability on white background
- Test print output for color accuracy

### Stamp
- Traditional: Red or Blue
- Modern: Company brand color
- Ensure good contrast with background

### Signature
- Black or Dark Blue (traditional)
- Ensure good contrast
- Avoid light colors

## Print Quality Checklist

- [ ] All images at 300 DPI or higher
- [ ] Transparent backgrounds (PNG format)
- [ ] Clear and legible at actual size
- [ ] Good contrast with white background
- [ ] No pixelation or artifacts
- [ ] Proper aspect ratios maintained
- [ ] File sizes under 5MB
- [ ] Test print on actual paper

## Common Mistakes to Avoid

❌ **Don't:**
- Use JPEG with white background
- Use low-resolution images (< 150 DPI)
- Make logo too large (overwhelms invoice)
- Use colored backgrounds
- Compress images too much (quality loss)
- Use script fonts that are hard to read

✅ **Do:**
- Use PNG with transparency
- Use high-resolution images (300 DPI)
- Keep logo proportional
- Remove all backgrounds
- Maintain original quality
- Use clear, legible fonts

## Testing Your Images

### Visual Test
1. Upload images to system
2. Generate test invoice
3. View PDF on screen
4. Check alignment and sizing
5. Verify all elements visible

### Print Test
1. Print invoice on actual paper
2. Check image quality
3. Verify colors are accurate
4. Ensure text is readable
5. Check stamp visibility

### Quality Checklist
- [ ] Logo is clear and professional
- [ ] Stamp is visible and legible
- [ ] Signature looks authentic
- [ ] All elements properly aligned
- [ ] No pixelation or blur
- [ ] Good contrast and visibility
- [ ] Professional overall appearance

## Example Dimensions

### Small Invoice (A5)
- Logo: 60x40 pixels
- Signature: 80x30 pixels
- Stamp: 50x50 pixels

### Standard Invoice (A4)
- Logo: 80x60 pixels (default)
- Signature: 100x40 pixels (default)
- Stamp: 60x60 pixels (default)

### Large Invoice (Letter)
- Logo: 100x75 pixels
- Signature: 120x50 pixels
- Stamp: 70x70 pixels

## File Naming Convention

When preparing files:
- Logo: `company-logo.png`
- Stamp: `company-stamp.png`
- Signature: `authorized-signature.png`

System will rename on upload:
- `{institutionId}_{timestamp}.png`

## Storage Information

Files are stored in:
```
Backend/uploads/company/
├── logos/
│   └── inst_123_1234567890.png
├── stamps/
│   └── inst_123_1234567891.png
└── signatures/
    └── inst_123_1234567892.png
```

## Browser Compatibility

Supported formats:
- ✅ PNG (recommended)
- ✅ JPG/JPEG
- ✅ GIF
- ✅ SVG
- ❌ BMP (not recommended)
- ❌ TIFF (not supported)

## Mobile Considerations

When viewing on mobile:
- Images scale proportionally
- Layout remains readable
- Touch-friendly upload interface
- Preview available before upload

---

**Remember**: Quality images = Professional invoices!

Use this guide to prepare your images for the best results.
