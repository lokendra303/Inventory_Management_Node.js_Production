import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [baseCurrency, setBaseCurrency] = useState('USD');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [loading, setLoading] = useState(false);

  const fetchCurrency = useCallback(async () => {
    try {
      const response = await apiService.get('/settings');
      if (response?.success && response?.data) {
        setCurrency(response.data.currency || 'USD');
        setCurrencySymbol(response.data.currencySymbol || '$');
        setExchangeRate(parseFloat(response.data.exchangeRate) || 1);
        setBaseCurrency(response.data.baseCurrency || 'USD');
      }
    } catch (error) {
      console.error('Failed to fetch currency:', error);
    }
  }, []);

  useEffect(() => {
    if (user) fetchCurrency();
  }, [user, fetchCurrency]);

  const updateCurrency = async (newCurrency, newExchangeRate) => {
    try {
      setLoading(true);
      const rate = newExchangeRate ?? exchangeRate;
      const response = await apiService.put('/settings', { currency: newCurrency, exchangeRate: rate });
      if (response?.success) {
        await fetchCurrency();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to update currency:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Convert amount from baseCurrency to active display currency
  const formatCurrency = (amount, showSymbol = true) => {
    if (!amount && amount !== 0) return '-';
    const num = parseFloat(amount);
    if (isNaN(num)) return '-';
    // Only convert if display currency differs from base currency
    const converted = currency === baseCurrency ? num : num * exchangeRate;
    const formatted = formatNumber(converted);
    return showSymbol ? `${currencySymbol}${formatted}` : formatted;
  };

  return (
    <CurrencyContext.Provider value={{ currency, baseCurrency, exchangeRate, currencySymbol, formatCurrency, updateCurrency, fetchCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};