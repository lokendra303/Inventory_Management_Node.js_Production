import React, { useState, useEffect } from 'react';
import { Select, message } from 'antd';
import { getCurrencies } from '../../utils/currency';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';

const CurrencySelector = () => {
  const { currency, updateCurrency, loading } = useCurrency();
  const currencies = getCurrencies();

  const handleCurrencyChange = async (newCurrency) => {
    try {
      const success = await updateCurrency(newCurrency);
      if (success) {
        message.success(`Currency updated to ${newCurrency}`);
      } else {
        message.error('Failed to update currency. Please try again.');
      }
    } catch (error) {
      console.error('Currency change error:', error);
      message.error('Failed to update currency. Please try again.');
    }
  };

  return (
    <div style={{ padding: '8px 16px', borderTop: '1px solid #303030' }}>
      <Select
        value={currency}
        onChange={handleCurrencyChange}
        loading={loading}
        style={{ width: '100%' }}
        size="small"
        placeholder="Select Currency"
        showSearch
        optionFilterProp="children"
        filterOption={(input, option) =>
          option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
        }
      >
        {currencies.map(curr => (
          <Select.Option key={curr.code} value={curr.code}>
            {curr.symbol} {curr.code} - {curr.name}
          </Select.Option>
        ))}
      </Select>
    </div>
  );
};

export default CurrencySelector;