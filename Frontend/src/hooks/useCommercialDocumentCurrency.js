import { useState, useEffect, useCallback } from 'react';
import { Form } from 'antd';
import apiService from '../services/apiService';
import { useCurrency } from '../contexts/CurrencyContext.jsx';
import {
  isPlausibleCrossCurrencyRate,
  isSameCurrency,
  resolveExchangeRate,
} from '../utils/commercialDocument';

/**
 * Live/stored FX + document currency for PO/SO/invoice forms.
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
  const [rateSource, setRateSource] = useState('same_currency');
  const [rateResolving, setRateResolving] = useState(false);

  const syncRateToForm = useCallback(
    (rate) => {
      const r = rate == null ? undefined : rate;
      if (r != null) setExchangeRate(r);
      form.setFieldsValue({ [exchangeRateFieldName]: r });
    },
    [form, exchangeRateFieldName]
  );

  const applyResolvedRate = useCallback(
    async () => {
      if (isSameCurrency(documentCurrency, institutionCurrency)) {
        syncRateToForm(1);
        setRateSource('same_currency');
        return 1;
      }

      const current = form.getFieldValue(exchangeRateFieldName);
      if (isPlausibleCrossCurrencyRate(documentCurrency, institutionCurrency, current)) {
        setExchangeRate(Number(current));
        setRateSource('manual');
        return Number(current);
      }

      setRateResolving(true);
      try {
        const { rate, source } = await resolveExchangeRate(
          apiService,
          documentCurrency,
          institutionCurrency
        );
        if (rate != null) {
          syncRateToForm(rate);
          setRateSource(source);
          return rate;
        }
        syncRateToForm(undefined);
        setRateSource('missing');
        return null;
      } finally {
        setRateResolving(false);
      }
    },
    [documentCurrency, institutionCurrency, form, exchangeRateFieldName, syncRateToForm]
  );

  useEffect(() => {
    if (isSameCurrency(documentCurrency, institutionCurrency)) {
      syncRateToForm(1);
      setRateSource('same_currency');
      return undefined;
    }

    const current = form.getFieldValue(exchangeRateFieldName);
    if (isPlausibleCrossCurrencyRate(documentCurrency, institutionCurrency, current)) {
      setExchangeRate(Number(current));
      setRateSource('manual');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      setRateResolving(true);
      try {
        const { rate, source } = await resolveExchangeRate(
          apiService,
          documentCurrency,
          institutionCurrency
        );
        if (cancelled) return;
        if (rate != null) {
          syncRateToForm(rate);
          setRateSource(source);
        } else {
          syncRateToForm(undefined);
          setRateSource('missing');
        }
      } finally {
        if (!cancelled) setRateResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [documentCurrency, institutionCurrency, syncRateToForm, form, exchangeRateFieldName]);

  useEffect(() => {
    if (watchedRate != null && Number(watchedRate) > 0) {
      setExchangeRate(Number(watchedRate));
    }
  }, [watchedRate]);

  const crossCurrency = !isSameCurrency(documentCurrency, institutionCurrency);
  const rateMissing =
    crossCurrency &&
    !isPlausibleCrossCurrencyRate(documentCurrency, institutionCurrency, exchangeRate);

  const exchangeRateForCalc = crossCurrency
    ? isPlausibleCrossCurrencyRate(documentCurrency, institutionCurrency, exchangeRate)
      ? Number(exchangeRate)
      : null
    : 1;

  return {
    institutionCurrency,
    documentCurrency,
    exchangeRate: exchangeRateForCalc,
    exchangeRateRaw: exchangeRate,
    rateMissing,
    rateSource,
    rateResolving,
    syncRateToForm,
    applyResolvedRate,
  };
}
