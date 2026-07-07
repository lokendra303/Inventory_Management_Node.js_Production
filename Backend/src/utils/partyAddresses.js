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

function normalizeBankDetails(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const bank = {
    bankName: String(input.bankName || input.bank_name || '').trim(),
    accountHolder: String(
      input.accountHolder || input.account_holder_name || input.account_holder || ''
    ).trim(),
    accountNumber: String(input.accountNumber || input.account_number || '').trim(),
    ifscCode: String(input.ifscCode || input.ifsc_code || '').trim(),
    branchName: String(input.branchName || input.branch_name || '').trim(),
    accountType: String(input.accountType || input.account_type || '').trim(),
    swiftCode: String(input.swiftCode || input.swift_code || '').trim(),
    iban: String(input.iban || '').trim(),
  };
  return Object.values(bank).some(Boolean) ? bank : null;
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
  const companySelection = data.companyAddressSelection || {};
  return {
    partyAddressSelection: {
      billingAddressId: selection.billingAddressId || null,
      shippingAddressId: selection.shippingAddressId || null,
      billingAddress: normalizeAddress(selection.billingAddress || data.billingAddress),
      shippingAddress: normalizeAddress(selection.shippingAddress || data.shippingAddress),
    },
    billingAddress: normalizeAddress(data.billingAddress || selection.billingAddress),
    shippingAddress: normalizeAddress(data.shippingAddress || selection.shippingAddress),
    companyAddressSelection: {
      billingAddress: normalizeAddress(companySelection.billingAddress || data.companyBillingAddress),
      shippingAddress: normalizeAddress(companySelection.shippingAddress || data.companyShippingAddress),
    },
    companyBillingAddress: normalizeAddress(data.companyBillingAddress || companySelection.billingAddress),
    companyShippingAddress: normalizeAddress(data.companyShippingAddress || companySelection.shippingAddress),
    bankDetails: normalizeBankDetails(data.bankDetails),
  };
}

function serializePartyAddresses(input) {
  if (!input) return null;
  const billing = normalizeAddress(input.billingAddress || input.partyAddressSelection?.billingAddress);
  const shipping = normalizeAddress(input.shippingAddress || input.partyAddressSelection?.shippingAddress);
  const bankDetails = normalizeBankDetails(input.bankDetails);
  const companyBilling = normalizeAddress(
    input.companyBillingAddress || input.companyAddressSelection?.billingAddress
  );
  const companyShipping = normalizeAddress(
    input.companyShippingAddress || input.companyAddressSelection?.shippingAddress
  );
  const hasBilling = Object.values(billing).some(Boolean);
  const hasShipping = Object.values(shipping).some(Boolean);
  const hasCompanyBilling = Object.values(companyBilling).some(Boolean);
  const hasCompanyShipping = Object.values(companyShipping).some(Boolean);
  if (
    !hasBilling
    && !hasShipping
    && !hasCompanyBilling
    && !hasCompanyShipping
    && !input.partyAddressSelection?.billingAddressId
    && !bankDetails
  ) {
    return null;
  }

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
  if (hasCompanyBilling || hasCompanyShipping) {
    payload.companyAddressSelection = {
      billingAddress: companyBilling,
      shippingAddress: companyShipping,
    };
    payload.companyBillingAddress = companyBilling;
    payload.companyShippingAddress = companyShipping;
  }
  if (bankDetails) payload.bankDetails = bankDetails;
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

  const isPurchase = invoice.invoice_type === 'purchase';

  return {
    invoiceNumber: invoice.invoice_number,
    invoiceDate: invoice.invoice_date,
    dueDate: invoice.due_date,
    customerId: !isPurchase && invoice.party_type === 'customer' ? invoice.party_id : null,
    vendorId: isPurchase && invoice.party_type === 'vendor' ? invoice.party_id : null,
    customerName: !isPurchase ? invoice.party_name : undefined,
    vendorName: isPurchase ? invoice.party_name : undefined,
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
    bankDetails: partyAddressesParsed?.bankDetails || null,
  };
}

module.exports = {
  emptyAddress,
  normalizeAddress,
  normalizeBankDetails,
  parsePartyAddresses,
  serializePartyAddresses,
  partyAddressesToLegacyText,
  buildInvoicePartyPayload,
};
