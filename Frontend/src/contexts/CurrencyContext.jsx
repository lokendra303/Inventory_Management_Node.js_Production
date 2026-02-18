import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { formatNumber } from '../utils/currency';

const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loading, setLoading] = useState(false);

  // Exchange rates matching backend currency service
  const exchangeRates = {
    'USD': 1,
    'EUR': 0.85,
    'GBP': 0.73,
    'INR': 83.50,
    'JPY': 110.25,
    'CAD': 1.25,
    'AUD': 1.35,
    'CNY': 6.45,
    'SGD': 1.35,
    'AED': 3.67
  };

  useEffect(() => {
    if (user) {
      fetchCurrency();
    }
  }, [user]);

  const fetchCurrency = async () => {
    try {
      const response = await apiService.get('/settings');
      if (response.success && response.data) {
        const newCurrency = response.data.currency || 'USD';
        const newRate = exchangeRates[newCurrency] || 1;
        setCurrency(newCurrency);
        setExchangeRate(newRate);
      } else {
        setCurrency('USD');
        setExchangeRate(1);
      }
    } catch (error) {
      console.error('Failed to fetch currency:', error);
      // Set default values on error
      setCurrency('USD');
      setExchangeRate(1);
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
      } else {
        return false;
      }
    } catch (error) {
      console.error('Failed to update currency:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, showSymbol = true) => {
    if (!amount && amount !== 0) return '-';
    
    const convertedAmount = parseFloat(amount) * exchangeRate;
    const formattedAmount = formatNumber(convertedAmount);
    
    if (showSymbol) {
      const symbols = {
        'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'JPY': '¥',
        'CAD': 'C$', 'AUD': 'A$', 'CNY': '¥', 'SGD': 'S$', 'AED': 'د.إ'
      };
      const symbol = symbols[currency] || currency;
      return `${symbol}${formattedAmount}`;
    }
    
    return formattedAmount;
  };

  return (
    <CurrencyContext.Provider value={{ currency, exchangeRate, formatCurrency, updateCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};