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
        const activeCurrency = response.data.currency || 'USD';
        const activeSymbol   = response.data.currencySymbol || '$';
        setCurrency(activeCurrency);
        setCurrencySymbol(activeSymbol);
        setBaseCurrency(response.data.baseCurrency || 'USD');

        const base = response.data.baseCurrency || 'USD';

        // If display currency equals base, rate is always 1
        if (activeCurrency === base) {
          setExchangeRate(1);
          return;
        }

        // Read rate from exchange_rates table (base → display)
        try {
          const ratesRes = await apiService.get('/settings/exchange-rates');
          if (ratesRes?.success && ratesRes?.data?.length > 0) {
            const pair = ratesRes.data.find(
              (r) =>
                String(r.from_currency).toUpperCase() === String(base).toUpperCase() &&
                String(r.to_currency).toUpperCase() === String(activeCurrency).toUpperCase()
            );
            if (pair) {
              setExchangeRate(parseFloat(pair.rate) || 1);
              return;
            }
          }
        } catch { /* fall through to institutions rate */ }

        // Fallback: use the rate stored in institutions table
        setExchangeRate(parseFloat(response.data.exchangeRate) || 1);
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
      // Step 1: update the active currency on the institution
      const response = await apiService.put('/settings', {
        currency: newCurrency,
        exchangeRate: newExchangeRate ?? 1
      });
      if (!response?.success) return false;

      // Step 2: if a rate was provided, also upsert it into exchange_rates table
      const base = baseCurrency || 'USD';
      if (newExchangeRate && newExchangeRate !== 1 && newCurrency !== base) {
        await apiService.put('/settings/exchange-rates', {
          fromCurrency: base,
          toCurrency: newCurrency,
          rate: newExchangeRate,
          note: 'Set active via currency selector'
        }).catch(() => {}); // non-fatal
      }

      await fetchCurrency();
      return true;
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