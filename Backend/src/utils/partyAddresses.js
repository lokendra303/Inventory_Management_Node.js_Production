/**
 * Structured party addresses for invoice PDF (bill-to / ship-to).
 */

function emptyAddress() {
  return {
    attention: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
  };
}

function normalizeAddress(input = {}) {
  if (!input || typeof input !== 'object') return emptyAddress();
  return {
    attention: String(input.attention || '').trim(),
    line1: String(input.line1 || input.address1 || '').trim(),
    line2: String(input.line2 || input.address2 || '').trim(),
    city: String(input.city || '').trim(),
    state: String(input.state || '').trim(),
    country: String(input.country || '').trim(),
    postalCode: String(input.postalCode || input.pin_code || input.pinCode || '').trim(),
  };
}

function parsePartyAddresses(raw) {
  if (raw == null || raw === '') return null;
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;

  const selection = data.partyAddressSelection || {};
  return {
    partyAddressSelection: {
      billingAddressId: selection.billingAddressId || null,
      shippingAddressId: selection.shippingAddressId || null,
      billingAddress: normalizeAddress(selection.billingAddress || data.billingAddress),
      shippingAddress: normalizeAddress(selection.shippingAddress || data.shippingAddress),
    },
    billingAddress: normalizeAddress(data.billingAddress || selection.billingAddress),
    shippingAddress: normalizeAddress(data.shippingAddress || selection.shippingAddress),
  };
}

function serializePartyAddresses(input) {
  if (!input) return null;
  const billing = normalizeAddress(input.billingAddress || input.partyAddressSelection?.billingAddress);
  const shipping = normalizeAddress(input.shippingAddress || input.partyAddressSelection?.shippingAddress);
  const hasBilling = Object.values(billing).some(Boolean);
  const hasShipping = Object.values(shipping).some(Boolean);
  if (!hasBilling && !hasShipping && !input.partyAddressSelection?.billingAddressId) return null;

  const payload = {
    partyAddressSelection: {
      billingAddressId: input.partyAddressSelection?.billingAddressId || input.billingAddressId || null,
      shippingAddressId: input.partyAddressSelection?.shippingAddressId || input.shippingAddressId || null,
      billingAddress: billing,
      shippingAddress: shipping,
    },
    billingAddress: billing,
    shippingAddress: shipping,
  };
  return JSON.stringify(payload);
}

function partyAddressesToLegacyText(addresses) {
  const bill = addresses?.billingAddress || addresses?.partyAddressSelection?.billingAddress;
  if (!bill) return null;
  return [bill.line1, bill.line2, bill.city, bill.state, bill.postalCode, bill.country]
    .filter(Boolean)
    .join(', ');
}

function buildInvoicePartyPayload(invoice, partyAddressesParsed) {
  const bill = partyAddressesParsed?.billingAddress
    || partyAddressesParsed?.partyAddressSelection?.billingAddress
    || emptyAddress();
  const ship = partyAddressesParsed?.shippingAddress
    || partyAddressesParsed?.partyAddressSelection?.shippingAddress
    || emptyAddress();

  if (!bill.line1 && invoice.party_address) {
    bill.line1 = String(invoice.party_address);
  }

  return {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    customerId: invoice.party_type === 'customer' ? invoice.party_id : null,
    customerName: invoice.party_name,
    partyGstin: invoice.party_gstin,
    currency: invoice.currency,
    exchangeRate: invoice.exchange_rate,
    reference: invoice.reference,
    notes: invoice.notes,
    billingAddress: bill,
    shippingAddress: ship,
    billingLine1: bill.line1,
    billingLine2: bill.line2,
    billingCity: bill.city,
    billingState: bill.state,
    billingCountry: bill.country,
    billingPostalCode: bill.postalCode,
    shippingLine1: ship.line1,
    shippingLine2: ship.line2,
    shippingCity: ship.city,
    shippingState: ship.state,
    shippingCountry: ship.country,
    shippingPostalCode: ship.postalCode,
  };
}

module.exports = {
  emptyAddress,
  normalizeAddress,
  parsePartyAddresses,
  serializePartyAddresses,
  partyAddressesToLegacyText,
  buildInvoicePartyPayload,
};
