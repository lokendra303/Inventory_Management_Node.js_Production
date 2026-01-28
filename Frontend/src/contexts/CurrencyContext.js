import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/apiService';

const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loading, setLoading] = useState(false);

  // Simple exchange rates (you can update these or fetch from API)
  const exchangeRates = {
    'USD': 1,
    'EUR': 0.85,
    'GBP': 0.73,
    'INR': 83.12,
    'JPY': 110.0,
    'CAD': 1.25
  };

  useEffect(() => {
    fetchCurrency();
  }, []);

  const fetchCurrency = async () => {
    try {
      const response = await apiService.get('/settings');
      if (response.success) {
        const newCurrency = response.data.currency || 'USD';
        const newRate = exchangeRates[newCurrency] || 1;
        setCurrency(newCurrency);
        setExchangeRate(newRate);
        console.log('Currency loaded:', newCurrency, 'Rate:', newRate);
      }
    } catch (error) {
      console.error('Failed to fetch currency');
    }
  };

  const updateCurrency = async (newCurrency) => {
    try {
      setLoading(true);
      const response = await apiService.put('/settings', { currency: newCurrency });
      if (response.success) {
        const newRate = exchangeRates[newCurrency] || 1;
        setCurrency(newCurrency);
        setExchangeRate(newRate);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update currency');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const convertedAmount = (amount * exchangeRate).toFixed(2);
    console.log('Converting:', amount, 'x', exchangeRate, '=', convertedAmount);
    return `${currency} ${convertedAmount}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, exchangeRate, formatCurrency, updateCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};