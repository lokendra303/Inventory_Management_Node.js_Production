import React from 'react';
import './EntityInfoGrid.css';

export const EntityEmptyValue = () => <span className="entity-info-empty">—</span>;

export const formatEntityValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return <EntityEmptyValue />;
  }
  return value;
};

const EntityInfoGrid = ({ items = [] }) => (
  <div className="entity-info-grid">
    {items.map((item) => (
      <div
        key={item.key || item.label}
        className={`entity-info-tile${item.span === 2 ? ' entity-info-tile--span-2' : ''}`}
      >
        <div className="entity-info-tile-label">
          {item.icon ? <span className="entity-info-tile-icon">{item.icon}</span> : null}
          <span>{item.label}</span>
        </div>
        <div className="entity-info-tile-value">
          {item.render ? item.render() : formatEntityValue(item.value)}
        </div>
      </div>
    ))}
  </div>
);

export default EntityInfoGrid;
