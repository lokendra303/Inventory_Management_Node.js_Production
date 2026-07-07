import React from 'react';
import { Form, Input, Row, Col, Select, Checkbox, Divider, Typography } from 'antd';
import { filterSelectOption } from '../../utils/selectFilter';

const { Text } = Typography;

export const EMPTY_INVOICE_ADDRESS = {
  attention: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  country: '',
  postalCode: '',
};

function formatAddressOption(addr, index) {
  const parts = [addr.line1, addr.city, addr.state].filter(Boolean);
  const label = parts.length ? parts.join(', ') : `Address ${index + 1}`;
  return { value: addr.id || String(index), label };
}

function AddressFields({ prefix, disabled = false }) {
  return (
    <>
      <Form.Item name={[prefix, 'attention']} label="Attention">
        <Input placeholder="Contact person" disabled={disabled} />
      </Form.Item>
      <Form.Item name={[prefix, 'line1']} label="Address line 1" rules={[{ required: !disabled, message: 'Required' }]}>
        <Input placeholder="Street / building" disabled={disabled} />
      </Form.Item>
      <Form.Item name={[prefix, 'line2']} label="Address line 2">
        <Input placeholder="Area / landmark" disabled={disabled} />
      </Form.Item>
      <Row gutter={8}>
        <Col span={12}>
          <Form.Item name={[prefix, 'city']} label="City">
            <Input disabled={disabled} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={[prefix, 'state']} label="State">
            <Input disabled={disabled} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={[prefix, 'postalCode']} label="PIN / Postal code">
            <Input disabled={disabled} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={[prefix, 'country']} label="Country">
            <Input placeholder="India" disabled={disabled} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}

/**
 * Bill-to / ship-to fields aligned with sales invoice PDF layout.
 * Purchase invoices: supplier (bill from) + ship to (vendor shipping / delivery).
 */
export default function InvoicePartyAddressFields({
  form,
  selectedParty = null,
  shipSameAsBill,
  onShipSameAsBillChange,
  onBillingAddressPick,
  onShippingAddressPick,
  billingTitle = 'Bill To',
  shippingTitle = 'Ship To',
  showShipping = true,
  sameAsBillLabel = 'Same as Bill To',
  savedBillingLabel = 'Saved billing address',
  savedShippingLabel = 'Saved shipping address',
  billingPrefix = 'billingAddress',
  shippingPrefix = 'shippingAddress',
}) {
  const billingOptions = selectedParty?.billingAddresses?.length
    ? selectedParty.billingAddresses
    : selectedParty?.billingAddress
      ? [{ ...selectedParty.billingAddress, id: 'primary-billing' }]
      : [];

  const shippingOptions = selectedParty?.shippingAddresses?.length
    ? selectedParty.shippingAddresses
    : selectedParty?.shippingAddress
      ? [{ ...selectedParty.shippingAddress, id: 'primary-shipping' }]
      : [];

  return (
    <>
      {selectedParty && (billingOptions.length > 0 || (showShipping && shippingOptions.length > 0)) && (
        <Row gutter={12} style={{ marginBottom: 8 }}>
          {billingOptions.length > 0 && (
            <Col span={showShipping && shippingOptions.length > 0 ? 12 : 24}>
              <Form.Item label={savedBillingLabel}>
                <Select
                  allowClear
                  placeholder="Pick billing address"
                  optionFilterProp="label"
                  filterOption={filterSelectOption}
                  onChange={(val) => onBillingAddressPick?.(val)}
                  options={billingOptions.map((a, i) => formatAddressOption(a, i))}
                />
              </Form.Item>
            </Col>
          )}
          {showShipping && shippingOptions.length > 0 && (
            <Col span={12}>
              <Form.Item label={savedShippingLabel}>
                <Select
                  allowClear
                  placeholder="Pick shipping address"
                  optionFilterProp="label"
                  filterOption={filterSelectOption}
                  onChange={(val) => onShippingAddressPick?.(val)}
                  options={shippingOptions.map((a, i) => formatAddressOption(a, i))}
                />
              </Form.Item>
            </Col>
          )}
        </Row>
      )}

      <Text strong style={{ display: 'block', marginBottom: 8 }}>{billingTitle}</Text>
      <AddressFields prefix={billingPrefix} />

      {showShipping && (
        <>
          <Divider style={{ margin: '12px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text strong>{shippingTitle}</Text>
            <Checkbox
              checked={shipSameAsBill}
              onChange={(e) => onShipSameAsBillChange?.(e.target.checked)}
            >
              {sameAsBillLabel}
            </Checkbox>
          </div>
          <AddressFields prefix={shippingPrefix} disabled={shipSameAsBill} />
        </>
      )}
    </>
  );
}

export function addressFromPartyRecord(addr = {}) {
  return {
    attention: addr.attention || '',
    line1: addr.line1 || addr.address1 || '',
    line2: addr.line2 || addr.address2 || '',
    city: addr.city || '',
    state: addr.state || '',
    country: addr.country || '',
    postalCode: addr.postalCode || addr.pin_code || '',
  };
}

export function buildPartyAddressesPayload(values, shipSameAsBill, bankDetails = null) {
  const billing = values.billingAddress || EMPTY_INVOICE_ADDRESS;
  const shipping = shipSameAsBill
    ? { ...billing }
    : (values.shippingAddress || EMPTY_INVOICE_ADDRESS);

  const payload = {
    partyAddressSelection: {
      billingAddressId: values.billingAddressId || null,
      shippingAddressId: values.shippingAddressId || null,
      billingAddress: billing,
      shippingAddress: shipping,
    },
    billingAddress: billing,
    shippingAddress: shipping,
  };
  if (bankDetails && typeof bankDetails === 'object') {
    payload.bankDetails = bankDetails;
  }

  const companyBilling = values.companyBillingAddress || EMPTY_INVOICE_ADDRESS;
  const companyShipping = values.companyShipSameAsBill
    ? { ...companyBilling }
    : (values.companyShippingAddress || EMPTY_INVOICE_ADDRESS);
  const hasCompanyBilling = Object.values(companyBilling).some(Boolean);
  const hasCompanyShipping = Object.values(companyShipping).some(Boolean);
  if (hasCompanyBilling || hasCompanyShipping) {
    payload.companyAddressSelection = {
      billingAddress: companyBilling,
      shippingAddress: companyShipping,
    };
    payload.companyBillingAddress = companyBilling;
    payload.companyShippingAddress = companyShipping;
  }

  return payload;
}
