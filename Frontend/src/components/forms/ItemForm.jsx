import React, { useState, useEffect } from 'react';
import { itemService } from '../../services/itemService';
import { masterDataService } from '../../services/masterDataService';
import useFormDraft from '../../hooks/useFormDraft';

const EMPTY_FORM = {
  name: '', sku: '', description: '', type: 'simple',
  category: '', unit: 'pcs', manufacturer: '', brand: '',
  cost_price: '', selling_price: '', mrp: ''
};

const ItemForm = ({ onSubmit, initialData = {} }) => {
  const { saveDraft, loadDraft, clearDraft } = useFormDraft();
  const isEditMode = Object.keys(initialData).length > 0;

  const [formData, setFormData] = useState({ ...EMPTY_FORM, ...initialData });
  const [draftRestored, setDraftRestored] = useState(null);

  const [dropdownData, setDropdownData] = useState({
    manufacturers: [],
    brands: [],
    units: [],
    categories: []
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDropdownData();
    if (!isEditMode) {
      loadDraft().then(draft => {
        if (draft) {
          setFormData(draft.data);
          setDraftRestored(draft.savedAt);
        }
      }).catch(() => {});
    }
  }, []);

  const loadDropdownData = async () => {
    try {
      setLoading(true);
      const [manufacturers, brands, units, categories] = await Promise.all([
        masterDataService.getManufacturers(),
        masterDataService.getBrands(),
        masterDataService.getUnits(),
        masterDataService.getCategories()
      ]);

      setDropdownData({
        manufacturers: manufacturers.data || [],
        brands: brands.data || [],
        units: units.data || [],
        categories: categories.data || []
      });
    } catch (error) {
      console.error('Failed to load dropdown data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    await saveDraft(formData);
    alert('Draft saved! You can continue later.');
  };

  const handleDiscardDraft = async () => {
    await clearDraft();
    setDraftRestored(null);
    setFormData(EMPTY_FORM);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await onSubmit(formData);
      await clearDraft();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const addNewOption = async (type, name) => {
    try {
      let newItem;
      switch (type) {
        case 'manufacturer':
          newItem = await masterDataService.createManufacturer({ name });
          setDropdownData(prev => ({
            ...prev,
            manufacturers: [...prev.manufacturers, newItem.data]
          }));
          setFormData(prev => ({ ...prev, manufacturer: newItem.data.id }));
          break;
        case 'brand':
          newItem = await masterDataService.createBrand({ name });
          setDropdownData(prev => ({
            ...prev,
            brands: [...prev.brands, newItem.data]
          }));
          setFormData(prev => ({ ...prev, brand: newItem.data.id }));
          break;
        case 'unit':
          newItem = await masterDataService.createUnit({ name, symbol: name });
          setDropdownData(prev => ({
            ...prev,
            units: [...prev.units, newItem.data]
          }));
          setFormData(prev => ({ ...prev, unit: newItem.data.id }));
          break;
        case 'category':
          newItem = await masterDataService.createCategory({ name });
          setDropdownData(prev => ({
            ...prev,
            categories: [...prev.categories, newItem.data]
          }));
          setFormData(prev => ({ ...prev, category: newItem.data.id }));
          break;
      }
    } catch (error) {
      console.error(`Failed to create ${type}:`, error);
    }
  };

  if (loading) {
    return <div className=\"text-center\">Loading...</div>;
  }

  return (\n    <form onSubmit={handleSubmit} className=\"item-form\">\n      {draftRestored && (\n        <div className=\"alert alert-info d-flex justify-content-between align-items-center\">\n          <span>Draft restored from {new Date(draftRestored).toLocaleString()}</span>\n          <button type=\"button\" className=\"btn btn-sm btn-outline-danger\" onClick={handleDiscardDraft}>Discard Draft</button>\n        </div>\n      )}\n      <div className=\"row\">\n        <div className=\"col-md-6\">\n          <div className=\"form-group\">\n            <label>Item Name *</label>\n            <input\n              type=\"text\"\n              value={formData.name}\n              onChange={(e) => handleInputChange('name', e.target.value)}\n              className=\"form-control\"\n              required\n            />\n          </div>\n        </div>\n\n        <div className=\"col-md-6\">\n          <div className=\"form-group\">\n            <label>SKU *</label>\n            <input\n              type=\"text\"\n              value={formData.sku}\n              onChange={(e) => handleInputChange('sku', e.target.value)}\n              className=\"form-control\"\n              required\n            />\n          </div>\n        </div>\n\n        <div className=\"col-md-6\">\n          <div className=\"form-group\">\n            <label>Category</label>\n            <div className=\"input-group\">\n              <select\n                value={formData.category}\n                onChange={(e) => handleInputChange('category', e.target.value)}\n                className=\"form-control\"\n              >\n                <option value=\"\">Select Category</option>\n                {dropdownData.categories.map(cat => (\n                  <option key={cat.id} value={cat.id}>{cat.name}</option>\n                ))}\n              </select>\n              <div className=\"input-group-append\">\n                <button\n                  type=\"button\"\n                  className=\"btn btn-outline-secondary\"\n                  onClick={() => {\n                    const name = prompt('Enter category name:');\n                    if (name) addNewOption('category', name);\n                  }}\n                >\n                  +\n                </button>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        <div className=\"col-md-6\">\n          <div className=\"form-group\">\n            <label>Unit</label>\n            <div className=\"input-group\">\n              <select\n                value={formData.unit}\n                onChange={(e) => handleInputChange('unit', e.target.value)}\n                className=\"form-control\"\n              >\n                <option value=\"\">Select Unit</option>\n                {dropdownData.units.map(unit => (\n                  <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>\n                ))}\n              </select>\n              <div className=\"input-group-append\">\n                <button\n                  type=\"button\"\n                  className=\"btn btn-outline-secondary\"\n                  onClick={() => {\n                    const name = prompt('Enter unit name:');\n                    if (name) addNewOption('unit', name);\n                  }}\n                >\n                  +\n                </button>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        <div className=\"col-md-6\">\n          <div className=\"form-group\">\n            <label>Manufacturer</label>\n            <div className=\"input-group\">\n              <select\n                value={formData.manufacturer}\n                onChange={(e) => handleInputChange('manufacturer', e.target.value)}\n                className=\"form-control\"\n              >\n                <option value=\"\">Select Manufacturer</option>\n                {dropdownData.manufacturers.map(mfg => (\n                  <option key={mfg.id} value={mfg.id}>{mfg.name}</option>\n                ))}\n              </select>\n              <div className=\"input-group-append\">\n                <button\n                  type=\"button\"\n                  className=\"btn btn-outline-secondary\"\n                  onClick={() => {\n                    const name = prompt('Enter manufacturer name:');\n                    if (name) addNewOption('manufacturer', name);\n                  }}\n                >\n                  +\n                </button>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        <div className=\"col-md-6\">\n          <div className=\"form-group\">\n            <label>Brand</label>\n            <div className=\"input-group\">\n              <select\n                value={formData.brand}\n                onChange={(e) => handleInputChange('brand', e.target.value)}\n                className=\"form-control\"\n              >\n                <option value=\"\">Select Brand</option>\n                {dropdownData.brands.map(brand => (\n                  <option key={brand.id} value={brand.id}>{brand.name}</option>\n                ))}\n              </select>\n              <div className=\"input-group-append\">\n                <button\n                  type=\"button\"\n                  className=\"btn btn-outline-secondary\"\n                  onClick={() => {\n                    const name = prompt('Enter brand name:');\n                    if (name) addNewOption('brand', name);\n                  }}\n                >\n                  +\n                </button>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        <div className=\"col-md-4\">\n          <div className=\"form-group\">\n            <label>Cost Price</label>\n            <input\n              type=\"number\"\n              step=\"0.01\"\n              value={formData.cost_price}\n              onChange={(e) => handleInputChange('cost_price', e.target.value)}\n              className=\"form-control\"\n            />\n          </div>\n        </div>\n\n        <div className=\"col-md-4\">\n          <div className=\"form-group\">\n            <label>Selling Price</label>\n            <input\n              type=\"number\"\n              step=\"0.01\"\n              value={formData.selling_price}\n              onChange={(e) => handleInputChange('selling_price', e.target.value)}\n              className=\"form-control\"\n            />\n          </div>\n        </div>\n\n        <div className=\"col-md-4\">\n          <div className=\"form-group\">\n            <label>MRP</label>\n            <input\n              type=\"number\"\n              step=\"0.01\"\n              value={formData.mrp}\n              onChange={(e) => handleInputChange('mrp', e.target.value)}\n              className=\"form-control\"\n            />\n          </div>\n        </div>\n\n        <div className=\"col-12\">\n          <div className=\"form-group\">\n            <label>Description</label>\n            <textarea\n              value={formData.description}\n              onChange={(e) => handleInputChange('description', e.target.value)}\n              className=\"form-control\"\n              rows={3}\n            />\n          </div>\n        </div>\n      </div>\n\n      <div className=\"form-group mt-4 d-flex gap-2\">\n        <button type=\"submit\" className=\"btn btn-primary\">Save Item</button>\n        <button type=\"button\" className=\"btn btn-secondary\" onClick={handleSaveDraft}>Save as Draft</button>\n      </div>\n    </form>\n  );\n};\n\nexport default ItemForm;