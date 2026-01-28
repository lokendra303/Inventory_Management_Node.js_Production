import React, { useState, useEffect } from 'react';
import { itemService } from '../services/itemService';
import CustomizableDropdown from './CustomizableDropdown';

const DynamicItemForm = ({ itemType = 'simple', onSubmit, initialData = {} }) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    type: itemType,
    customFields: {},
    ...initialData
  });
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const [dropdownOptions, setDropdownOptions] = useState({});

  useEffect(() => {
    loadFieldConfigs();
  }, [itemType]);

  const loadFieldConfigs = async () => {
    try {
      setLoading(true);
      const configs = await itemService.getFieldConfig(itemType);
      setFieldConfigs(configs);
      
      // Initialize dropdown options
      const optionsMap = {};
      configs.forEach(config => {
        if (config.field_type === 'select' || config.field_type === 'multiselect') {
          optionsMap[config.field_name] = config.options || [];
        }
      });
      setDropdownOptions(optionsMap);
      
      console.log('Field configs loaded:', configs);
      console.log('Dropdown options:', optionsMap);
      
      // Initialize custom fields with default values
      const defaultCustomFields = {};
      configs.forEach(config => {
        if (config.default_value) {
          defaultCustomFields[config.field_name] = config.default_value;
        }
      });
      
      setFormData(prev => ({
        ...prev,
        type: itemType,
        customFields: { ...defaultCustomFields, ...prev.customFields }
      }));
    } catch (error) {
      console.error('Failed to load field configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionsChange = async (fieldName, newOptions) => {
    setDropdownOptions(prev => ({
      ...prev,
      [fieldName]: newOptions
    }));
    
    // Update field config in backend
    try {
      await itemService.updateFieldOptions(itemType, fieldName, newOptions);
    } catch (error) {
      console.error('Failed to update field options:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleCustomFieldChange = (fieldName, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldName]: value
      }
    }));
    
    // Clear error when user starts typing
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: null }));
    }
  };

  const renderField = (config) => {
    const value = formData.customFields[config.field_name] || '';
    const hasError = errors[config.field_name];
    
    console.log('Rendering field:', config.field_name, 'type:', config.field_type);

    switch (config.field_type) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
        return (
          <input
            type={config.field_type === 'text' ? 'text' : config.field_type}
            value={value}
            onChange={(e) => handleCustomFieldChange(config.field_name, e.target.value)}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={config.field_label}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value}
            onChange={(e) => handleCustomFieldChange(config.field_name, e.target.value)}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={config.field_label}
            rows={3}
          />
        );

      case 'number':
      case 'decimal':
        return (
          <input
            type="number"
            step={config.field_type === 'decimal' ? '0.01' : '1'}
            value={value}
            onChange={(e) => handleCustomFieldChange(config.field_name, parseFloat(e.target.value) || 0)}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={config.field_label}
          />
        );

      case 'boolean':
        return (
          <div className="form-check">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => handleCustomFieldChange(config.field_name, e.target.checked)}
              className="form-check-input"
            />
            <label className="form-check-label">{config.field_label}</label>
          </div>
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleCustomFieldChange(config.field_name, e.target.value)}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => handleCustomFieldChange(config.field_name, e.target.value)}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
          />
        );

      case 'select':
        console.log('Rendering select field:', config.field_name, 'options:', dropdownOptions[config.field_name] || config.options || []);
        return (
          <CustomizableDropdown
            value={value}
            onChange={(newValue) => handleCustomFieldChange(config.field_name, newValue)}
            options={dropdownOptions[config.field_name] || config.options || []}
            onOptionsChange={(newOptions) => handleOptionsChange(config.field_name, newOptions)}
            placeholder={`Select ${config.field_label}`}
            fieldName={config.field_name}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
          />
        );

      case 'multiselect':
        return (
          <select
            multiple
            value={Array.isArray(value) ? value : []}
            onChange={(e) => {
              const selectedValues = Array.from(e.target.selectedOptions, option => option.value);
              handleCustomFieldChange(config.field_name, selectedValues);
            }}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
          >
            {config.options.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleCustomFieldChange(config.field_name, e.target.value)}
            className={`form-control ${hasError ? 'is-invalid' : ''}`}
            placeholder={config.field_label}
          />
        );
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
    } catch (error) {
      if (error.response?.data?.validationErrors) {
        setErrors(error.response.data.validationErrors);
      }
    }
  };

  if (loading) {
    return <div className="text-center">Loading form configuration...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="dynamic-item-form">
      <div className="row">
        {/* Standard Fields */}
        <div className="col-md-6">
          <div className="form-group">
            <label>Item Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`form-control ${errors.name ? 'is-invalid' : ''}`}
              required
            />
            {errors.name && <div className="invalid-feedback">{errors.name}</div>}
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-group">
            <label>SKU *</label>
            <input
              type="text"
              value={formData.sku}
              onChange={(e) => handleInputChange('sku', e.target.value)}
              className={`form-control ${errors.sku ? 'is-invalid' : ''}`}
              required
            />
            {errors.sku && <div className="invalid-feedback">{errors.sku}</div>}
          </div>
        </div>

        <div className="col-md-6">
          <div className="form-group">
            <label>Item Type</label>
            <select
              value={formData.type}
              onChange={(e) => handleInputChange('type', e.target.value)}
              className="form-control"
              disabled
            >
              <option value="simple">Simple Product</option>
              <option value="service">Service</option>
              <option value="composite">Composite</option>
              <option value="variant">Variant</option>
            </select>
          </div>
        </div>

        <div className="col-12">
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="form-control"
              rows={3}
            />
          </div>
        </div>

        {/* Dynamic Custom Fields */}
        {fieldConfigs.length > 0 && (
          <>
            <div className="col-12">
              <h5 className="mt-4 mb-3">
                {itemType.charAt(0).toUpperCase() + itemType.slice(1)} Specific Fields
              </h5>
            </div>
            
            {fieldConfigs
              .sort((a, b) => a.display_order - b.display_order)
              .map(config => (
                <div key={config.field_name} className="col-md-6">
                  <div className="form-group">
                    <label>
                      {config.field_label}
                      {config.is_required && <span className="text-danger"> *</span>}
                    </label>
                    {renderField(config)}
                    {errors[config.field_name] && (
                      <div className="invalid-feedback d-block">
                        {errors[config.field_name]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </>
        )}
      </div>

      <div className="form-group mt-4">
        <button type="submit" className="btn btn-primary">
          Save Item
        </button>
      </div>
    </form>
  );
};

export default DynamicItemForm;