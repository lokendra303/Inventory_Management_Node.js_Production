# Customizable Item Fields System

## Overview

The Inventory Management System supports dynamic, customizable fields for different item types. This allows the system to handle various types of inventory items including physical products, services, composite items, and variants - each with their own specific field requirements.

## Supported Item Types

### 1. Simple Products (`simple`)
Regular physical products with standard inventory tracking.

**Default Fields:**
- Weight (kg) - Decimal field
- Dimensions (L×W×H) - Text field  
- Color - Select dropdown
- Material - Text field
- Warranty Period (months) - Number field

**Example Use Cases:**
- Electronics (phones, laptops, headphones)
- Furniture (chairs, tables, cabinets)
- Clothing (basic items without variants)
- Tools and equipment

### 2. Services (`service`)
Non-physical items representing services or labor.

**Default Fields:**
- Service Duration (hours) - Required number field
- Service Type - Required select (Consultation, Installation, Maintenance, Repair, Training)
- Required Skill Level - Select with default (Basic, Intermediate, Advanced, Expert)
- Service Location - Select with default (On-site, Remote, Workshop, Customer Location)
- Prerequisites - Textarea for additional requirements

**Example Use Cases:**
- IT support and consulting
- Installation services
- Maintenance contracts
- Training programs
- Professional consultations

### 3. Composite Items (`composite`)
Items assembled from multiple components.

**Default Fields:**
- Assembly Time (minutes) - Number field
- Assembly Instructions - Textarea
- Tools Required - Textarea

**Example Use Cases:**
- Computer builds
- Furniture kits
- Electronic assemblies
- Custom product bundles

### 4. Variant Items (`variant`)
Products with multiple variations (size, color, style).

**Default Fields:**
- Size - Select (XS, S, M, L, XL, XXL)
- Color - Select dropdown
- Style - Text field

**Example Use Cases:**
- Clothing with size/color options
- Products with different configurations
- Items with multiple SKU variations

## Field Types Supported

### Basic Field Types
- **text** - Single line text input
- **textarea** - Multi-line text input
- **number** - Integer numbers
- **decimal** - Decimal numbers with precision
- **boolean** - Checkbox (true/false)

### Advanced Field Types
- **date** - Date picker
- **datetime** - Date and time picker
- **email** - Email validation
- **url** - URL validation
- **phone** - Phone number input

### Selection Field Types
- **select** - Single selection dropdown
- **multiselect** - Multiple selection dropdown

## Field Configuration

### Field Properties
Each custom field can be configured with:

```javascript
{
  fieldName: 'duration',           // Unique field identifier
  fieldLabel: 'Service Duration',  // Display label
  fieldType: 'number',            // Field type
  isRequired: true,               // Required validation
  validationRules: {              // Custom validation rules
    min: 0.5,
    max: 24
  },
  options: [],                    // Options for select fields
  defaultValue: null,             // Default value
  displayOrder: 1                 // Display order in form
}
```

### Validation Rules
Custom validation rules can be applied:

```javascript
validationRules: {
  min: 0,                    // Minimum value (numbers)
  max: 100,                  // Maximum value (numbers)
  minLength: 5,              // Minimum length (text)
  maxLength: 500,            // Maximum length (text)
  pattern: '^[A-Z]{2,3}$'    // Regex pattern
}
```

## API Endpoints

### Get Field Configuration
```http
GET /api/items/field-config/{itemType}
```
Returns field configuration for specific item type.

### Create Field Configuration
```http
POST /api/items/field-config
Content-Type: application/json

{
  "itemType": "service",
  "fieldName": "certification",
  "fieldLabel": "Required Certification",
  "fieldType": "select",
  "isRequired": true,
  "options": ["Basic", "Advanced", "Expert"],
  "displayOrder": 10
}
```

### Create Item with Custom Fields
```http
POST /api/items
Content-Type: application/json

{
  "name": "Computer Repair Service",
  "sku": "SRV-001",
  "type": "service",
  "customFields": {
    "duration": 2,
    "serviceType": "Repair",
    "skillLevel": "Advanced",
    "location": "On-site"
  }
}
```

## Frontend Implementation

### Dynamic Form Component
The `DynamicItemForm` component automatically renders appropriate form fields based on item type:

```jsx
<DynamicItemForm
  itemType="service"
  onSubmit={handleSubmit}
  initialData={existingItem}
/>
```

### Field Rendering
Fields are automatically rendered based on their type:
- Text fields → `<input type="text">`
- Numbers → `<input type="number">`
- Select → `<select>` with options
- Textarea → `<textarea>`
- Boolean → `<input type="checkbox">`

## Database Schema

### item_field_configs Table
```sql
CREATE TABLE item_field_configs (
  id VARCHAR(36) PRIMARY KEY,
  institution_id VARCHAR(36) NOT NULL,
  item_type ENUM('simple', 'variant', 'composite', 'service'),
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(255) NOT NULL,
  field_type ENUM('text', 'textarea', 'number', 'decimal', 'boolean', 'date', 'datetime', 'select', 'multiselect', 'email', 'url', 'phone'),
  is_required BOOLEAN DEFAULT FALSE,
  validation_rules JSON,
  options JSON,
  default_value TEXT,
  display_order INT DEFAULT 0,
  status ENUM('active', 'inactive') DEFAULT 'active'
);
```

### items Table (Enhanced)
The existing items table includes a `custom_fields` JSON column to store dynamic field values:

```sql
custom_fields JSON  -- Stores dynamic field values as JSON
```

## Usage Examples

### Creating a Service Item
```javascript
const serviceItem = {
  name: "Website Development",
  sku: "WEB-001",
  type: "service",
  description: "Custom website development service",
  sellingPrice: 2500.00,
  customFields: {
    duration: 40,
    serviceType: "Development",
    skillLevel: "Expert",
    location: "Remote",
    prerequisites: "Client must provide content and design requirements"
  }
};

await itemService.createItem(serviceItem);
```

### Creating a Product with Variants
```javascript
const variantItem = {
  name: "Premium T-Shirt",
  sku: "TS-PREM-001",
  type: "variant",
  description: "High-quality cotton t-shirt",
  costPrice: 12.00,
  sellingPrice: 29.99,
  customFields: {
    size: "L",
    variantColor: "Navy Blue",
    style: "Fitted"
  }
};

await itemService.createItem(variantItem);
```

## Benefits

1. **Flexibility** - Support for different business models (products, services, etc.)
2. **Scalability** - Easy to add new item types and fields
3. **Validation** - Built-in field validation and type checking
4. **User Experience** - Dynamic forms that adapt to item type
5. **Data Integrity** - Structured storage with proper validation

## Best Practices

1. **Field Naming** - Use descriptive, consistent field names
2. **Validation** - Always add appropriate validation rules
3. **Default Values** - Provide sensible defaults where applicable
4. **Display Order** - Organize fields logically in forms
5. **Required Fields** - Mark essential fields as required
6. **Options Management** - Keep select options up-to-date and relevant

This system provides a robust foundation for managing diverse inventory types while maintaining data consistency and user experience.