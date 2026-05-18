import React, { useMemo } from 'react';
import { Card, Divider, Typography } from 'antd';
import { getCurrencySymbol } from '../../utils/currency';
import { calculateCommercialTotals, roundMoney } from '../../utils/commercialDocument';

const { Text } = Typography;

/**
 * Footer totals for PO / SO / invoices — amounts in document currency.
 */
export default function DocumentTotalsSummary({
  lines = [],
  documentCurrency,
  institutionCurrency,
  exchangeRate = 1,
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
  const showEquiv =
    documentCurrency &&
    institutionCurrency &&
    documentCurrency !== institutionCurrency &&
    Number(exchangeRate) > 0;

  return (
    <Card size="small" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text>Subtotal{showEquiv ? ` (${documentCurrency})` : ''}:</Text>
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
        <Text strong>Grand Total{showEquiv ? ` (${documentCurrency})` : ''}:</Text>
        <div style={{ textAlign: 'right' }}>
          <Text strong style={{ fontSize: 16 }}>
            {sym}
            {totals.grandTotal.toFixed(2)}
          </Text>
          {showEquiv && (
            <div style={{ fontSize: 11, color: '#666', marginTop: 4, fontWeight: 400 }}>
              ≈ {getCurrencySymbol(institutionCurrency)}
              {roundMoney(totals.grandTotal * Number(exchangeRate)).toFixed(2)} ({institutionCurrency})
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
