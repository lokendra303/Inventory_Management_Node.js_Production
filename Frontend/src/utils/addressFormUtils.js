import { message } from 'antd';

const BILLING_FIELD_MAP = {
  billingAttention: 'shippingAttention',
  billingCountry: 'shippingCountry',
  billingAddress1: 'shippingAddress1',
  billingAddress2: 'shippingAddress2',
  billingCity: 'shippingCity',
  billingState: 'shippingState',
  billingPinCode: 'shippingPinCode',
};

/** Copy all billing address fields into shipping fields on an Ant Design Form instance. */
export function copyBillingToShipping(form) {
  if (!form?.getFieldsValue || !form?.setFieldsValue) {
    message.error('Form is not ready');
    return;
  }

  const values = form.getFieldsValue(true);
  const shippingValues = {};

  for (const [billingKey, shippingKey] of Object.entries(BILLING_FIELD_MAP)) {
    shippingValues[shippingKey] = values[billingKey] ?? undefined;
  }

  form.setFieldsValue(shippingValues);
  message.success('Billing address copied to shipping');
}
