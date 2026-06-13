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
 */
export default function InvoicePartyAddressFields({
  form,
  selectedParty = null,
  shipSameAsBill,
  onShipSameAsBillChange,
  onBillingAddressPick,
  onShippingAddressPick,
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
      {selectedParty && (billingOptions.length > 0 || shippingOptions.length > 0) && (
        <Row gutter={12} style={{ marginBottom: 8 }}>
          {billingOptions.length > 0 && (
            <Col span={12}>
              <Form.Item label="Saved billing address">
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
          {shippingOptions.length > 0 && (
            <Col span={12}>
              <Form.Item label="Saved shipping address">
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

      <Text strong style={{ display: 'block', marginBottom: 8 }}>Bill To</Text>
      <AddressFields prefix="billingAddress" />

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>Ship To</Text>
        <Checkbox
          checked={shipSameAsBill}
          onChange={(e) => onShipSameAsBillChange?.(e.target.checked)}
        >
          Same as Bill To
        </Checkbox>
      </div>
      <AddressFields prefix="shippingAddress" disabled={shipSameAsBill} />
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

export function buildPartyAddressesPayload(values, shipSameAsBill) {
  const billing = values.billingAddress || EMPTY_INVOICE_ADDRESS;
  const shipping = shipSameAsBill
    ? { ...billing }
    : (values.shippingAddress || EMPTY_INVOICE_ADDRESS);

  return {
    partyAddressSelection: {
      billingAddressId: values.billingAddressId || null,
      shippingAddressId: values.shippingAddressId || null,
      billingAddress: billing,
      shippingAddress: shipping,
    },
    billingAddress: billing,
    shippingAddress: shipping,
  };
}
