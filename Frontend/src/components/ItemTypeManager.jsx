import React, { useState } from 'react';
import DynamicItemForm from './DynamicItemForm.jsx';
import { itemService } from '../services/itemService';

const ItemTypeManager = () => {
  const [selectedType, setSelectedType] = useState('simple');
  const [message, setMessage] = useState('');

  const itemTypes = [
    { value: 'simple', label: 'Simple Product', description: 'Regular physical products' },
    { value: 'service', label: 'Service', description: 'Services like consultation, repair, etc.' },
    { value: 'composite', label: 'Composite', description: 'Items made from multiple components' },
    { value: 'variant', label: 'Variant', description: 'Products with variations like size, color' }
  ];

  const handleItemSubmit = async (itemData) => {
    try {
      const result = await itemService.createItem(itemData);
      setMessage(`✅ ${selectedType} item created successfully! ID: ${result.itemId}`);
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    }
  };

  const sampleData = {
    simple: {
      name: 'Wireless Headphones',
      sku: 'WH-001',
      description: 'High-quality wireless headphones with noise cancellation',
      customFields: {
        weight: 0.25,
        color: 'Black',
        warranty: 12
      }
    },
    service: {
      name: 'Computer Repair Service',
      sku: 'SRV-001',
      description: 'Professional computer repair and maintenance service',
      customFields: {
        duration: 2,
        serviceType: 'Repair',
        skillLevel: 'Advanced',
        location: 'On-site'
      }
    },
    composite: {
      name: 'Gaming PC Build',
      sku: 'PC-001',
      description: 'Custom gaming PC with high-end components',
      customFields: {
        assemblyTime: 120,
        assemblyInstructions: 'Follow the step-by-step guide for optimal cable management'
      }
    },
    variant: {
      name: 'Cotton T-Shirt',
      sku: 'TS-001',
      description: 'Premium cotton t-shirt available in multiple sizes and colors',
      customFields: {
        size: 'M',
        variantColor: 'Blue'
      }
    }
  };

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-12">
          <h2>Dynamic Item Fields Demo</h2>
          <p className="text-muted">
            This system supports different item types with customizable fields. 
            Select an item type to see its specific fields.
          </p>
        </div>
      </div>

      <div className="row">
        <div className="col-md-3">
          <div className="card">
            <div className="card-header">
              <h5>Item Types</h5>
            </div>
            <div className="card-body">
              {itemTypes.map(type => (
                <div key={type.value} className="mb-3">
                  <div className="form-check">
                    <input
                      type="radio"
                      name="itemType"
                      value={type.value}
                      checked={selectedType === type.value}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="form-check-input"
                    />
                    <label className="form-check-label">
                      <strong>{type.label}</strong>
                      <br />
                      <small className="text-muted">{type.description}</small>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {message && (
            <div className={`alert mt-3 ${message.includes('✅') ? 'alert-success' : 'alert-danger'}`}>
              {message}
            </div>
          )}
        </div>

        <div className="col-md-9">
          <div className="card">
            <div className="card-header">
              <h5>
                {itemTypes.find(t => t.value === selectedType)?.label} Form
              </h5>
            </div>
            <div className="card-body">
              <DynamicItemForm
                key={selectedType} // Force re-render when type changes
                itemType={selectedType}
                onSubmit={handleItemSubmit}
                initialData={sampleData[selectedType]}
              />
            </div>
          </div>
        </div>
      </div>

              <div className="row mt-4">
                <div className="col-12">
                  <div className="card">
                    <div className="card-header">
                      <h5>Field Configuration Reference</h5>
                    </div>
                    <div className="card-body">
                      <div className="row">
                        <div className="col-md-6">
                          <h6>Service Fields</h6>
                          <ul className="list-unstyled">
                            <li>• Duration (required number field)</li>
                            <li>• Service Type (select dropdown)</li>
                            <li>• Skill Level (select with default)</li>
                            <li>• Location (select options)</li>
                            <li>• Prerequisites (textarea)</li>
                          </ul>
                        </div>
                        <div className="col-md-6">
                          <h6>Product Fields</h6>
                          <ul className="list-unstyled">
                            <li>• Weight (decimal with validation)</li>
                            <li>• Dimensions (text field)</li>
                            <li>• Color (select dropdown)</li>
                            <li>• Material (text field)</li>
                            <li>• Warranty (number with min/max)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
    </div>
  );
};

export default ItemTypeManager;