# Service Folder Reorganization

## Summary
Successfully reorganized the services folder into logical subdirectories for better code organization and maintainability.

## New Structure

### 1. **auth/** - Authentication & Authorization Services
- authService.js
- roleService.js
- institutionProfileService.js
- institutionUserProfileService.js

### 2. **pdf/** - PDF Generation Services
- invoicePDFService.js
- purchaseOrderPDFService.js
- salesOrderPDFService.js

### 3. **invoice/** - Invoice Management Services
- invoiceService.js
- invoiceTemplateService.js
- autoInvoiceService.js

### 4. **order/** - Order Management Services
- purchaseOrderService.js
- salesOrderService.js
- poConfirmationService.js
- soConfirmationService.js

### 5. **inventory/** - Inventory Management Services
- inventoryService.js
- reorderLevelService.js

### 6. **accounting/** - Accounting Services
- accountingService.js

### 7. **entity/** - Entity Management Services
- customerService.js
- vendorService.js
- itemService.js
- itemFieldService.js
- categoryService.js

### 8. **automation/** - Automation Services
- automationService.js

### 9. **reports/** - Reporting Services
- reportsService.js

### 10. **warehouse/** - Warehouse Management Services
- warehouseService.js
- warehouseTypeService.js
- warehouseOptimizationService.js

## Updated Import Paths

All controllers have been updated with new import paths:

### Controllers Updated:
- authController.js
- categoryController.js
- customerController.js
- inventoryController.js
- itemController.js
- purchaseInvoiceController.js
- purchaseOrderController.js
- reorderLevelController.js
- reportsController.js
- roleController.js
- salesInvoiceController.js
- salesOrderController.js
- vendorController.js
- warehouseController.js
- warehouseTypeController.js

## Benefits
1. **Better Organization**: Services are grouped by functionality
2. **Easier Navigation**: Developers can quickly find related services
3. **Scalability**: Easy to add new services to appropriate folders
4. **Maintainability**: Clear separation of concerns
5. **Team Collaboration**: Multiple developers can work on different modules without conflicts

## Next Steps
- Test all endpoints to ensure imports are working correctly
- Update any additional files that may import these services
- Consider adding index.js files in each folder for cleaner imports
