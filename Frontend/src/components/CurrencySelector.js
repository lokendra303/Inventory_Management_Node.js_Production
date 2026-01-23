import React, { useState, useEffect } from 'react';
import { Select, message } from 'antd';
import { getCurrencies } from '../utils/currency';
import { useCurrency } from '../contexts/CurrencyContext';

const CurrencySelector = () => {
  const { currency, updateCurrency, loading } = useCurrency();
  const currencies = getCurrencies();

  const handleCurrencyChange = async (newCurrency) => {
    const success = await updateCurrency(newCurrency);
    if (success) {
      message.success('Currency updated');
    } else {
      message.error('Failed to update currency');
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
        placeholder="Currency"
      >
        {currencies.map(curr => (
          <Select.Option key={curr.code} value={curr.code}>
            {curr.symbol} {curr.code}
          </Select.Option>
        ))}
      </Select>
    </div>
  );
};

export default CurrencySelector;