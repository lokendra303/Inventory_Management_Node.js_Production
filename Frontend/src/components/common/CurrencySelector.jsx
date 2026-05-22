import React, { useMemo } from 'react';
import { Select, message } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import { getCurrencies, getCurrencyInfo } from '../../utils/currency';
import { useCurrency } from '../../contexts/CurrencyContext.jsx';
import './CurrencySelector.css';

const filterCurrency = (input, option) => {
  const q = (input || '').trim().toLowerCase();
  if (!q) return true;
  const label = (option?.label ?? '').toLowerCase();
  return label.includes(q);
};

const CurrencyValue = ({ code, symbol }) => (
  <span className="currency-selector-value">
    <span className="currency-selector-symbol">{symbol}</span>
    <span className="currency-selector-code">{code}</span>
  </span>
);

const CurrencyOption = ({ code, symbol, name }) => (
  <div className="currency-option">
    <span className="currency-option-badge">{symbol}</span>
    <div className="currency-option-text">
      <span className="currency-option-code">{code}</span>
      <span className="currency-option-name">{name}</span>
    </div>
  </div>
);

const CurrencySelector = () => {
  const { currency, updateCurrency, loading } = useCurrency();
  const currencies = useMemo(() => getCurrencies(), []);
  const active = getCurrencyInfo(currency);

  const handleCurrencyChange = async (newCurrency) => {
    if (newCurrency === currency) return;
    try {
      const success = await updateCurrency(newCurrency);
      if (success) {
        message.success(`Display currency set to ${newCurrency}`);
      } else {
        message.error('Failed to update currency');
      }
    } catch {
      message.error('Failed to update currency');
    }
  };

  return (
    <div className="currency-selector-wrap">
      <div className="currency-selector-label">
        <DollarOutlined className="currency-selector-label-icon" />
        <span>Display currency</span>
      </div>
      <Select
        className="currency-selector-select"
        popupClassName="currency-selector-dropdown"
        value={currency}
        onChange={handleCurrencyChange}
        loading={loading}
        showSearch
        optionFilterProp="label"
        filterOption={filterCurrency}
        listHeight={280}
        placeholder="Select currency"
        labelRender={() => (
          <CurrencyValue code={currency} symbol={active.symbol} />
        )}
      >
        {currencies.map((curr) => (
          <Select.Option
            key={curr.code}
            value={curr.code}
            label={`${curr.code} ${curr.symbol} ${curr.name}`}
          >
            <CurrencyOption code={curr.code} symbol={curr.symbol} name={curr.name} />
          </Select.Option>
        ))}
      </Select>
    </div>
  );
};

export default CurrencySelector;
