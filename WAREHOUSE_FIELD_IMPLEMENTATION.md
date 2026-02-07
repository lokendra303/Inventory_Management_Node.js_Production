# Warehouse Field Implementation - Smart Conditional Display

## Overview
Implemented a smart, user-friendly approach where the warehouse field only appears when needed.

## How It Works

### User Experience Flow:

1. **User creates a new item** → Warehouse field is hidden by default
2. **User enters Opening Stock > 0** → Warehouse field appears (required)
3. **User clears Opening Stock to 0** → Warehouse field disappears

### Logic:

```
IF Opening Stock > 0:
  ✓ Show Warehouse field (required)
  ✓ Create inventory projection in selected warehouse
ELSE:
  ✓ Hide Warehouse field
  ✓ Create item without initial inventory
```

## Benefits of This Approach

### 1. **Cleaner UI**
- No unnecessary fields when not needed
- Reduces form clutter
- Better user focus

### 2. **Logical Flow**
- Warehouse selection only makes sense when you have stock
- Prevents confusion: "Why do I need a warehouse if I have no stock?"

### 3. **Flexibility**
- Create items without initial stock (catalog items)
- Add stock later through purchase orders or stock adjustments
- Same item can exist in multiple warehouses

## Technical Implementation

### Frontend Changes (Items.jsx):
- Added `showWarehouse` state to control warehouse field visibility
- Warehouse field conditionally renders based on opening stock value
- Opening stock input has `onChange` handler to toggle warehouse visibility

### Backend Changes (itemService.js):
- Warehouse is now optional during item creation
- Inventory projection only created if BOTH warehouse AND opening stock provided
- Added warning log if opening stock provided without warehouse

## Example Scenarios

### Scenario 1: Item with Initial Stock
```
Item: "Laptop Dell XPS 15"
Opening Stock: 50 units
Warehouse: "Main Warehouse"

Result:
✓ Item created
✓ Inventory record: 50 units in Main Warehouse
```

### Scenario 2: Catalog Item (No Initial Stock)
```
Item: "Laptop Dell XPS 15"
Opening Stock: 0 (or empty)
Warehouse: Not shown

Result:
✓ Item created
✓ No inventory record
✓ Can add stock later via purchase orders
```

### Scenario 3: User Changes Mind
```
1. User enters Opening Stock: 100
   → Warehouse field appears
2. User selects "Main Warehouse"
3. User changes Opening Stock to 0
   → Warehouse field disappears
4. Submit form
   → Item created without inventory
```

## Database Structure

### Items Table
- Stores item master data (SKU, name, prices, etc.)
- No warehouse reference

### Inventory Projections Table
- Links items to warehouses
- Tracks quantity per warehouse
- Only created when opening stock > 0 and warehouse selected

## Future Enhancements

1. **Multi-warehouse opening stock**: Allow distributing opening stock across multiple warehouses
2. **Validation**: Warn if opening stock > 0 but no warehouse selected
3. **Bulk import**: Support CSV import with optional warehouse column

## Summary

This implementation provides the best of both worlds:
- **Simple**: Hide complexity when not needed
- **Flexible**: Support both catalog items and items with initial stock
- **Intuitive**: Warehouse field appears exactly when it makes sense
