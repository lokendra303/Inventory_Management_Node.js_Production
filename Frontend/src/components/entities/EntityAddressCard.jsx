import React from 'react';
import { Card } from 'antd';
import { EntityEmptyValue } from './EntityInfoGrid';
import './EntityInfoGrid.css';

const EntityAddressCard = ({ title, prefix = '', data = {} }) => {
  const line1 = data[`${prefix}address1`] || data[`${prefix}address_1`];
  const hasAddress = Boolean(line1);

  return (
    <Card title={title} size="small" className="entity-address-card">
      {hasAddress ? (
        <div className="entity-address-block">
          {(data[`${prefix}attention`]) && <div><strong>{data[`${prefix}attention`]}</strong></div>}
          {line1 && <div>{line1}</div>}
          {(data[`${prefix}address2`] || data[`${prefix}address_2`]) && (
            <div>{data[`${prefix}address2`] || data[`${prefix}address_2`]}</div>
          )}
          {(data[`${prefix}city`] || data[`${prefix}state`]) && (
            <div>
              {[data[`${prefix}city`], data[`${prefix}state`]].filter(Boolean).join(', ')}
            </div>
          )}
          {(data[`${prefix}pin_code`] || data[`${prefix}pinCode`]) && (
            <div>{data[`${prefix}pin_code`] || data[`${prefix}pinCode`]}</div>
          )}
          {data[`${prefix}country`] && <div>{data[`${prefix}country`]}</div>}
        </div>
      ) : (
        <EntityEmptyValue />
      )}
    </Card>
  );
};

export default EntityAddressCard;
