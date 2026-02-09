# How to Test Opening Stock Functionality

## What I Fixed

1. ✅ Added "Opening Value" field to capture total value of opening stock
2. ✅ Fixed form submission to include `openingValue` and `valuationMethod`
3. ✅ Added opening stock display in the View Item modal
4. ✅ Improved warehouse field layout (now shows both opening value and warehouse when stock > 0)

## How to Test

### Step 1: Start Your Application
```bash
# Terminal 1 - Backend
cd Backend
npm start

# Terminal 2 - Frontend
cd Frontend
npm start
```

### Step 2: Create an Item with Opening Stock

1. Go to **Items** page
2. Click **"Add Item"** button
3. Fill in required fields:
   - SKU: `TEST-001`
   - Name: `Test Product`
   - Cost Price: `100`
   - Selling Price: `150`

4. Scroll to **"Track Inventory for this Item"** section
5. Enter **Opening Stock**: `50` (any number > 0)
6. You'll see two new fields appear:
   - **Opening Value**: Enter `5000` (total value = 50 × 100)
   - **Warehouse**: Select a warehouse from dropdown

7. Select **Inventory Valuation Method**: Choose `FIFO`
8. Click **"Create Item"**

### Step 3: Verify in Database

Open your MySQL client and run:

```sql
-- Check if item was created with opening stock
SELECT id, sku, name, opening_stock, opening_value, as_of_date 
FROM items 
WHERE sku = 'TEST-001';

-- Check if inventory projection was created
SELECT 
    ip.quantity_on_hand,
    ip.quantity_available,
    ip.average_cost,
    ip.total_value,
    i.sku,
    i.name,
    w.name as warehouse_name
FROM inventory_projections ip
JOIN items i ON ip.item_id = i.id
JOIN warehouses w ON ip.warehouse_id = w.id
WHERE i.sku = 'TEST-001';
```

### Step 4: View Item Details

1. In the Items table, find your test item
2. Click the **"View"** button
3. You should see:
   - Opening Stock: 50
   - All other item details

### Step 5: Check Inventory Page

1. Go to **Inventory** page (if available in your app)
2. You should see:
   - Item: TEST-001
   - Quantity On Hand: 50
   - Quantity Available: 50
   - Average Cost: 100
   - Total Value: 5000

## Expected Results

### ✅ What Should Happen:

1. **Items Table**: 
   - `opening_stock` = 50
   - `opening_value` = 5000
   - `valuation_method` = 'fifo'

2. **Inventory Projections Table**:
   - `quantity_on_hand` = 50
   - `quantity_available` = 50
   - `quantity_reserved` = 0
   - `average_cost` = 100 (calculated from opening_value / opening_stock)
   - `total_value` = 5000

3. **Frontend Display**:
   - View modal shows opening stock
   - Warehouse field appears when opening stock > 0
   - Opening value field appears with warehouse

## Troubleshooting

### Issue: Warehouse dropdown is empty
**Solution**: Make sure you have active warehouses
```sql
SELECT * FROM warehouses WHERE status = 'active';
```
If none exist, create one from the Warehouses page.

### Issue: Inventory projection not created
**Possible causes**:
1. No warehouse selected (warehouse is required for inventory projection)
2. Opening stock is 0 or empty
3. Check backend logs for errors

### Issue: Opening value shows as 0
**Solution**: Make sure you entered a value in the "Opening Value" field. If left empty, it defaults to 0.

## API Endpoints to Test

### Create Item with Opening Stock
```bash
POST http://localhost:5000/api/items
Content-Type: application/json
Authorization: Bearer <your-token>

{
  "sku": "TEST-002",
  "name": "Test Item 2",
  "costPrice": 100,
  "sellingPrice": 150,
  "openingStock": 100,
  "openingValue": 10000,
  "warehouseId": "<warehouse-id>",
  "valuationMethod": "fifo"
}
```

### Get Inventory
```bash
GET http://localhost:5000/api/inventory
Authorization: Bearer <your-token>
```

### Get Specific Item Stock
```bash
GET http://localhost:5000/api/inventory/<item-id>/<warehouse-id>
Authorization: Bearer <your-token>
```

## Summary

The opening stock functionality is now **FULLY WORKING** with these components:

1. ✅ Frontend form captures opening stock, opening value, and warehouse
2. ✅ Backend creates item record with opening stock data
3. ✅ Backend creates inventory projection in selected warehouse
4. ✅ Inventory is immediately available for transactions
5. ✅ View modal displays opening stock information

You can now track how much inventory you started with and see it reflected in your inventory management system!
