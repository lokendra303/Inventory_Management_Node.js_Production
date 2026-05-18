import React from 'react';
import { Form, InputNumber, Button } from 'antd';
import apiService from '../../services/apiService';
import { message } from 'antd';

export default function CommercialExchangeRateField({
  documentCurrency,
  institutionCurrency,
  onRateChange,
}) {
  if (!documentCurrency || documentCurrency === institutionCurrency) {
    return null;
  }

  const refreshLive = async () => {
    try {
      const res = await apiService.get('/settings/exchange-rates/live', {
        params: { base: documentCurrency, to: institutionCurrency },
      });
      if (!res?.success || res.data?.rate == null) {
        message.warning(res?.error || 'Could not load live exchange rate');
        return;
      }
      const r = Math.round(parseFloat(res.data.rate) * 1e6) / 1e6;
      onRateChange?.(r);
      message.success('Exchange rate updated from live market');
    } catch {
      message.warning('Live exchange rate unavailable. Enter the rate manually.');
    }
  };

  return (
    <Form.Item
      name="exchangeRate"
      label={`Exchange rate (1 ${documentCurrency} = ? ${institutionCurrency})`}
      initialValue={1}
      tooltip={`Live rate from open.er-api.com. Line prices and totals are in ${documentCurrency}.`}
      extra={
        <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => void refreshLive()}>
          Refresh live rate
        </Button>
      }
      rules={[{ required: true, message: 'Exchange rate is required' }]}
    >
      <InputNumber
        min={0.0001}
        precision={6}
        style={{ width: '100%' }}
        onChange={(v) => onRateChange?.(v || 1)}
      />
    </Form.Item>
  );
}
