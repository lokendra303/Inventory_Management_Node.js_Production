import apiService from './apiService';

class ItemService {
  // Get field configuration for item type
  async getFieldConfig(itemType) {
    try {
      console.log('Fetching field config for:', itemType);
      const response = await apiService.get(`/items/field-config/${itemType}`);
      console.log('API response:', response);
      return response.data || [];
    } catch (error) {
      console.error('Failed to get field config:', error);
      return [];
    }
  }

  // Create field configuration
  async createFieldConfig(fieldData) {
    return await apiService.post('/items/field-config', fieldData);
  }

  // Create item with validation
  async createItem(itemData) {
    return await apiService.post('/items', itemData);
  }

  // Update item with validation
  async updateItem(itemId, itemData) {
    return await apiService.put(`/items/${itemId}`, itemData);
  }

  // Get all items
  async getItems(filters = {}) {
    return await apiService.get('/items', { params: filters });
  }

  // Get single item
  async getItem(itemId) {
    return await apiService.get(`/items/${itemId}`);
  }

  // Update field options
  async updateFieldOptions(itemType, fieldName, options) {
    return await apiService.put(`/items/field-config/${itemType}/${fieldName}/options`, { options });
  }

  // Get default field configurations for different item types
  getDefaultFieldConfigs() {
    return {
      simple: [
        { fieldName: 'weight', fieldLabel: 'Weight (kg)', fieldType: 'decimal', isRequired: false },
        { fieldName: 'dimensions', fieldLabel: 'Dimensions (L×W×H)', fieldType: 'text', isRequired: false },
        { fieldName: 'color', fieldLabel: 'Color', fieldType: 'select', 
          options: ['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Orange', 'Purple'] },
        { fieldName: 'material', fieldLabel: 'Material', fieldType: 'text', isRequired: false },
        { fieldName: 'warranty', fieldLabel: 'Warranty Period (months)', fieldType: 'number', isRequired: false }
      ],
      service: [
        { fieldName: 'duration', fieldLabel: 'Service Duration (hours)', fieldType: 'number', isRequired: true },
        { fieldName: 'serviceType', fieldLabel: 'Service Type', fieldType: 'select', 
          options: ['Consultation', 'Installation', 'Maintenance', 'Repair', 'Training'], isRequired: true },
        { fieldName: 'skillLevel', fieldLabel: 'Required Skill Level', fieldType: 'select',
          options: ['Basic', 'Intermediate', 'Advanced', 'Expert'], defaultValue: 'Basic' },
        { fieldName: 'location', fieldLabel: 'Service Location', fieldType: 'select',
          options: ['On-site', 'Remote', 'Workshop', 'Customer Location'], defaultValue: 'On-site' },
        { fieldName: 'prerequisites', fieldLabel: 'Prerequisites', fieldType: 'textarea', isRequired: false }
      ],
      composite: [
        { fieldName: 'assemblyTime', fieldLabel: 'Assembly Time (minutes)', fieldType: 'number', isRequired: false },
        { fieldName: 'assemblyInstructions', fieldLabel: 'Assembly Instructions', fieldType: 'textarea', isRequired: false },
        { fieldName: 'toolsRequired', fieldLabel: 'Tools Required', fieldType: 'textarea', isRequired: false }
      ],
      variant: [
        { fieldName: 'size', fieldLabel: 'Size', fieldType: 'select', 
          options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], isRequired: false },
        { fieldName: 'variantColor', fieldLabel: 'Color', fieldType: 'select',
          options: ['Red', 'Blue', 'Green', 'Black', 'White'], isRequired: false },
        { fieldName: 'style', fieldLabel: 'Style', fieldType: 'text', isRequired: false }
      ]
    };
  }

  // Validate item data based on type
  validateItemData(itemType, itemData) {
    const errors = {};
    
    // Basic validation
    if (!itemData.name || itemData.name.trim() === '') {
      errors.name = 'Item name is required';
    }
    
    if (!itemData.sku || itemData.sku.trim() === '') {
      errors.sku = 'SKU is required';
    }

    // Type-specific validation
    if (itemType === 'service') {
      if (!itemData.customFields?.duration || itemData.customFields.duration <= 0) {
        errors.duration = 'Service duration is required and must be greater than 0';
      }
      if (!itemData.customFields?.serviceType) {
        errors.serviceType = 'Service type is required';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  }

  // Get item type specific data templates
  getItemTypeTemplates() {
    return {
      simple: {
        name: 'Wireless Headphones',
        sku: 'WH-001',
        description: 'High-quality wireless headphones with noise cancellation',
        type: 'simple',
        costPrice: 50.00,
        sellingPrice: 99.99,
        customFields: {
          weight: 0.25,
          color: 'Black',
          warranty: 12,
          material: 'Plastic/Metal'
        }
      },
      service: {
        name: 'Computer Repair Service',
        sku: 'SRV-001',
        description: 'Professional computer repair and maintenance service',
        type: 'service',
        costPrice: 0,
        sellingPrice: 75.00,
        customFields: {
          duration: 2,
          serviceType: 'Repair',
          skillLevel: 'Advanced',
          location: 'On-site',
          prerequisites: 'Customer must provide system details in advance'
        }
      },
      composite: {
        name: 'Gaming PC Build',
        sku: 'PC-001',
        description: 'Custom gaming PC with high-end components',
        type: 'composite',
        costPrice: 800.00,
        sellingPrice: 1200.00,
        customFields: {
          assemblyTime: 120,
          assemblyInstructions: 'Follow the step-by-step guide for optimal cable management',
          toolsRequired: 'Screwdriver set, anti-static wrist strap'
        }
      },
      variant: {
        name: 'Cotton T-Shirt',
        sku: 'TS-001',
        description: 'Premium cotton t-shirt available in multiple sizes and colors',
        type: 'variant',
        costPrice: 8.00,
        sellingPrice: 19.99,
        customFields: {
          size: 'M',
          variantColor: 'Blue',
          style: 'Casual'
        }
      }
    };
  }
}

export const itemService = new ItemService();
export default itemService;