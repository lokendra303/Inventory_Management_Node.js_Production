import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

export function useTaxRates() {
  const [taxRates, setTaxRates] = useState([]);

  useEffect(() => {
    apiService.get('/tax/rates')
      .then(res => { if (res.success) setTaxRates(res.data); })
      .catch(() => {});
  }, []);

  const getRateById = (id) => taxRates.find(r => r.id === id);

  return { taxRates, getRateById };
}
