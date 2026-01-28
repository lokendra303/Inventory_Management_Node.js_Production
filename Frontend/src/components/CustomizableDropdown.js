import React, { useState } from 'react';

const CustomizableDropdown = ({ 
  value, 
  onChange, 
  options = [], 
  onOptionsChange,
  placeholder = "Select option",
  fieldName,
  className = "form-control"
}) => {
  const [isManaging, setIsManaging] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editValue, setEditValue] = useState('');

  console.log('CustomizableDropdown rendered for:', fieldName, 'with options:', options);

  const handleAddOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      const updatedOptions = [...options, newOption.trim()];
      onOptionsChange(updatedOptions);
      setNewOption('');
    }
  };

  const handleEditOption = (index) => {
    setEditingIndex(index);
    setEditValue(options[index]);
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && !options.includes(editValue.trim())) {
      const updatedOptions = [...options];
      updatedOptions[editingIndex] = editValue.trim();
      onOptionsChange(updatedOptions);
    }
    setEditingIndex(-1);
    setEditValue('');
  };

  const handleDeleteOption = (index) => {
    const updatedOptions = options.filter((_, i) => i !== index);
    onOptionsChange(updatedOptions);
    if (value === options[index]) {
      onChange('');
    }
  };

  return (
    <div className="customizable-dropdown">
      <div className="d-flex">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
        >
          <option value="">{placeholder}</option>
          {options.map((option, index) => (
            <option key={index} value={option}>{option}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm ml-2"
          onClick={() => setIsManaging(!isManaging)}
          title="Manage options"
          style={{ minWidth: '40px' }}
        >
          ⚙️
        </button>
      </div>

      {isManaging && (
        <div className="mt-2 p-3 border rounded bg-light">
          <h6>Manage Options</h6>
          
          {/* Add new option */}
          <div className="mb-3">
            <div className="input-group input-group-sm">
              <input
                type="text"
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                className="form-control"
                placeholder="Add new option"
                onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
              />
              <div className="input-group-append">
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={handleAddOption}
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Existing options */}
          <div className="existing-options">
            {options.map((option, index) => (
              <div key={index} className="d-flex align-items-center mb-2">
                {editingIndex === index ? (
                  <div className="input-group input-group-sm flex-grow-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="form-control"
                      onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                    />
                    <div className="input-group-append">
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={handleSaveEdit}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setEditingIndex(-1)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="flex-grow-1">{option}</span>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm ml-2"
                      onClick={() => handleEditOption(index)}
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm ml-1"
                      onClick={() => handleDeleteOption(index)}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm mt-2"
            onClick={() => setIsManaging(false)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomizableDropdown;