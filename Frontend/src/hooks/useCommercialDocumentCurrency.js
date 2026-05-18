import { useState, useEffect, useCallback } from 'react';
import { Form } from 'antd';
import apiService from '../services/apiService';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import { fetchLiveExchangeRate } from '../utils/commercialDocument';

/**
 * Live FX + document currency for PO/SO/invoice forms.
 * @param {import('antd').FormInstance} form
 * @param {string} currencyFieldName - form field for document currency (default 'currency')
 * @param {string} exchangeRateFieldName - form field for rate (default 'exchangeRate')
 */
export function useCommercialDocumentCurrency(
  form,
  currencyFieldName = 'currency',
  exchangeRateFieldName = 'exchangeRate'
) {
  const { currency: institutionCurrency } = useCurrency();
  const documentCurrency = Form.useWatch(currencyFieldName, form) || institutionCurrency;
  const watchedRate = Form.useWatch(exchangeRateFieldName, form);
  const [exchangeRate, setExchangeRate] = useState(1);

  const syncRateToForm = useCallback(
    (rate) => {
      const r = rate ?? 1;
      setExchangeRate(r);
      form.setFieldsValue({ [exchangeRateFieldName]: r });
    },
    [form, exchangeRateFieldName]
  );

  const applyLiveRate = useCallback(
    async (silent = false) => {
      if (documentCurrency === institutionCurrency) {
        syncRateToForm(1);
        return 1;
      }
      try {
        const rate = await fetchLiveExchangeRate(apiService, documentCurrency, institutionCurrency);
        syncRateToForm(rate);
        return rate;
      } catch (e) {
        if (!silent) throw e;
        return exchangeRate;
      }
    },
    [documentCurrency, institutionCurrency, syncRateToForm, exchangeRate]
  );

  useEffect(() => {
    if (documentCurrency === institutionCurrency) {
      syncRateToForm(1);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rate = await fetchLiveExchangeRate(apiService, documentCurrency, institutionCurrency);
        if (!cancelled) syncRateToForm(rate);
      } catch {
        /* manual entry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [documentCurrency, institutionCurrency, syncRateToForm]);

  useEffect(() => {
    if (watchedRate != null && Number(watchedRate) > 0) {
      setExchangeRate(Number(watchedRate));
    }
  }, [watchedRate]);

  const effectiveRate =
    documentCurrency === institutionCurrency
      ? 1
      : Number(exchangeRate) > 0
        ? Number(exchangeRate)
        : 1;

  return {
    institutionCurrency,
    documentCurrency,
    exchangeRate: effectiveRate,
    syncRateToForm,
    applyLiveRate,
  };
}
