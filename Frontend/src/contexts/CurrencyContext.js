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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCurrency();
  }, []);

  const fetchCurrency = async () => {
    try {
      const response = await apiService.get('/settings');
      if (response.success) {
        setCurrency(response.data.currency || 'USD');
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
        setCurrency(newCurrency);
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

  return (
    <CurrencyContext.Provider value={{ currency, updateCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};