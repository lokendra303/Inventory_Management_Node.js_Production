const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

class ItemFieldService {
  // Get field configuration for item type
  async getFieldConfig(tenantId, itemType) {
    // Get both tenant-specific and default configs
    const configs = await db.query(
      'SELECT * FROM item_field_configs WHERE (tenant_id = ? OR tenant_id = "default") AND item_type = ? AND status = "active" ORDER BY tenant_id DESC',
      [tenantId, itemType]
    );
    
    return configs.map(config => ({
      ...config,
      validation_rules: JSON.parse(config.validation_rules || '{}'),
      options: JSON.parse(config.options || '[]')
    }));
  }

  // Create custom field configuration
  async createFieldConfig(tenantId, fieldData, userId) {
    const {
      itemType,
      fieldName,
      fieldLabel,
      fieldType,
      isRequired = false,
      validationRules = {},
      options = [],
      defaultValue,
      displayOrder = 0
    } = fieldData;

    const configId = uuidv4();
    
    await db.query(
      `INSERT INTO item_field_configs 
       (id, tenant_id, item_type, field_name, field_label, field_type, 
        is_required, validation_rules, options, default_value, display_order, 
        status, created_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
      [
        configId, tenantId, itemType, fieldName, fieldLabel, fieldType,
        isRequired, JSON.stringify(validationRules), JSON.stringify(options),
        defaultValue, displayOrder, userId
      ]
    );

    return configId;
  }

  // Get default field configurations for different item types
  getDefaultFieldConfigs() {
    return {
      simple: [
        { fieldName: 'weight', fieldLabel: 'Weight', fieldType: 'number', isRequired: false },
        { fieldName: 'dimensions', fieldLabel: 'Dimensions', fieldType: 'text', isRequired: false },
        { fieldName: 'color', fieldLabel: 'Color', fieldType: 'select', options: ['Red', 'Blue', 'Green', 'Black', 'White'] }
      ],
      service: [
        { fieldName: 'duration', fieldLabel: 'Service Duration (hours)', fieldType: 'number', isRequired: true },
        { fieldName: 'serviceType', fieldLabel: 'Service Type', fieldType: 'select', 
          options: ['Consultation', 'Installation', 'Maintenance', 'Repair', 'Training'] },
        { fieldName: 'skillLevel', fieldLabel: 'Required Skill Level', fieldType: 'select',
          options: ['Basic', 'Intermediate', 'Advanced', 'Expert'] },
        { fieldName: 'location', fieldLabel: 'Service Location', fieldType: 'select',
          options: ['On-site', 'Remote', 'Workshop', 'Customer Location'] }
      ],
      composite: [
        { fieldName: 'assemblyTime', fieldLabel: 'Assembly Time (minutes)', fieldType: 'number' },
        { fieldName: 'assemblyInstructions', fieldLabel: 'Assembly Instructions', fieldType: 'textarea' }
      ],
      variant: [
        { fieldName: 'variantAttribute1', fieldLabel: 'Size', fieldType: 'select', 
          options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
        { fieldName: 'variantAttribute2', fieldLabel: 'Color', fieldType: 'select',
          options: ['Red', 'Blue', 'Green', 'Black', 'White'] }
      ]
    };
  }

  // Validate custom fields based on configuration
  async validateCustomFields(tenantId, itemType, customFields) {
    const fieldConfigs = await this.getFieldConfig(tenantId, itemType);
    const errors = [];

    for (const config of fieldConfigs) {
      const fieldValue = customFields[config.field_name];
      
      // Check required fields
      if (config.is_required && (!fieldValue || fieldValue === '')) {
        errors.push(`${config.field_label} is required`);
        continue;
      }

      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        // Validate field type
        if (!this.validateFieldType(fieldValue, config.field_type)) {
          errors.push(`${config.field_label} must be of type ${config.field_type}`);
        }

        // Validate against options for select fields
        if (config.field_type === 'select' && config.options.length > 0) {
          if (!config.options.includes(fieldValue)) {
            errors.push(`${config.field_label} must be one of: ${config.options.join(', ')}`);
          }
        }

        // Apply validation rules
        if (config.validation_rules) {
          const validationError = this.applyValidationRules(fieldValue, config.validation_rules, config.field_label);
          if (validationError) {
            errors.push(validationError);
          }
        }
      }
    }

    return errors;
  }

  validateFieldType(value, fieldType) {
    switch (fieldType) {
      case 'number':
        return !isNaN(value) && isFinite(value);
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'url':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'date':
        return !isNaN(Date.parse(value));
      default:
        return true;
    }
  }

  applyValidationRules(value, rules, fieldLabel) {
    if (rules.min !== undefined && value < rules.min) {
      return `${fieldLabel} must be at least ${rules.min}`;
    }
    if (rules.max !== undefined && value > rules.max) {
      return `${fieldLabel} must be at most ${rules.max}`;
    }
    if (rules.minLength !== undefined && value.length < rules.minLength) {
      return `${fieldLabel} must be at least ${rules.minLength} characters`;
    }
    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
      return `${fieldLabel} must be at most ${rules.maxLength} characters`;
    }
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
      return `${fieldLabel} format is invalid`;
    }
    return null;
  }
}

module.exports = new ItemFieldService();