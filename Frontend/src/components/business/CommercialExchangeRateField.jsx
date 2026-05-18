import React from 'react';
import { Form, InputNumber, Button, message } from 'antd';
import { isPlausibleCrossCurrencyRate, isSameCurrency } from '../../utils/commercialDocument';

export default function CommercialExchangeRateField({
  documentCurrency,
  institutionCurrency,
  onRateChange,
  onRefresh,
  loading = false,
}) {
  if (!documentCurrency || isSameCurrency(documentCurrency, institutionCurrency)) {
    return null;
  }

  const refreshLive = async () => {
    try {
      const rate = await onRefresh?.();
      if (rate == null) {
        message.warning('No exchange rate available. Save a rate in Settings → Exchange rates or enter it manually.');
        return;
      }
      message.success('Exchange rate updated');
    } catch {
      message.warning('Live exchange rate unavailable. Enter the rate manually or save rates in Settings.');
    }
  };

  return (
    <Form.Item
      name="exchangeRate"
      label={`Exchange rate (1 ${documentCurrency} = ? ${institutionCurrency})`}
      tooltip={`Live rate from open.er-api.com, or saved in Settings → Exchange rates. Line prices and totals are in ${documentCurrency}.`}
      extra={
        <Button
          type="link"
          size="small"
          style={{ padding: 0, height: 'auto' }}
          loading={loading}
          onClick={() => void refreshLive()}
        >
          Refresh live rate
        </Button>
      }
      rules={[
        { required: true, message: 'Exchange rate is required' },
        {
          validator: (_, value) => {
            if (isPlausibleCrossCurrencyRate(documentCurrency, institutionCurrency, value)) {
              return Promise.resolve();
            }
            return Promise.reject(
              new Error(
                `Enter a valid rate (not 1:1). Use Refresh or Settings → Exchange rates for ${documentCurrency} → ${institutionCurrency}.`
              )
            );
          },
        },
      ]}
    >
      <InputNumber
        min={0.000001}
        precision={6}
        style={{ width: '100%' }}
        onChange={(v) => onRateChange?.(v ?? undefined)}
      />
    </Form.Item>
  );
}
