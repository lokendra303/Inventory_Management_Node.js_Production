import React, { useMemo } from 'react';
import { Alert, Card, Divider, Typography } from 'antd';
import { getCurrencySymbol } from '../../utils/currency';
import {
  calculateCommercialTotals,
  convertDocumentAmountToInstitution,
  isSameCurrency,
} from '../../utils/commercialDocument';

const { Text } = Typography;

export default function DocumentTotalsSummary({
  lines = [],
  documentCurrency,
  institutionCurrency,
  exchangeRate = 1,
  rateMissing = false,
  rateSource,
  getTaxRate = () => 0,
  unitField = 'unitPrice',
}) {
  const totals = useMemo(
    () =>
      calculateCommercialTotals(lines, {
        getUnitAmount: (l) => Number(l?.[unitField] ?? l?.unitPrice ?? l?.unitCost) || 0,
        getTaxRate: (l) => getTaxRate(l),
      }),
    [lines, getTaxRate, unitField]
  );

  const sym = getCurrencySymbol(documentCurrency);
  const crossCurrency = !isSameCurrency(documentCurrency, institutionCurrency);
  const institutionEquiv = crossCurrency
    ? convertDocumentAmountToInstitution(
        totals.grandTotal,
        documentCurrency,
        institutionCurrency,
        exchangeRate
      )
    : null;

  const showEquiv = crossCurrency && institutionEquiv != null && !rateMissing;

  return (
    <Card size="small" style={{ marginTop: 16 }}>
      {crossCurrency && rateMissing && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Exchange rate required"
          description={`Set how many ${institutionCurrency} equal 1 ${documentCurrency} (use Refresh live rate or Settings → Exchange rates). A 1:1 rate is not used between different currencies.`}
        />
      )}
      {crossCurrency && !rateMissing && rateSource && rateSource !== 'manual' && (
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
          FX rate: {rateSource === 'live' ? 'live market' : rateSource === 'stored' ? 'saved in Settings' : ''}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text>Subtotal{crossCurrency ? ` (${documentCurrency})` : ''}:</Text>
        <Text>
          {sym}
          {totals.subtotal.toFixed(2)}
        </Text>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text>Total Discount:</Text>
        <Text>
          -{sym}
          {totals.totalDiscount.toFixed(2)}
        </Text>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text>Total Tax:</Text>
        <Text>
          {sym}
          {totals.totalTax.toFixed(2)}
        </Text>
      </div>
      <Divider style={{ margin: '8px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text strong>Grand Total{crossCurrency ? ` (${documentCurrency})` : ''}:</Text>
        <div style={{ textAlign: 'right' }}>
          <Text strong style={{ fontSize: 16 }}>
            {sym}
            {totals.grandTotal.toFixed(2)}
          </Text>
          {showEquiv && (
            <div style={{ fontSize: 11, color: '#666', marginTop: 4, fontWeight: 400 }}>
              ≈ {getCurrencySymbol(institutionCurrency)}
              {institutionEquiv.toFixed(2)} ({institutionCurrency})
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
