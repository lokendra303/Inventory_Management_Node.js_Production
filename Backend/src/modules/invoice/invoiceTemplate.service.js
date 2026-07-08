const db = require('../../database/connection');
const vendorService = require('../entity/vendor.service');
const customerService = require('../entity/customer.service');
const logger = require('../../utils/logger');
const { normalizeInvoiceUnit } = require('../../utils/invoiceUnit');
const { applyDocumentMetaToInvoiceDetails } = require('../../utils/documentMeta');
const { normalizeBankDetails } = require('../../utils/partyAddresses');

class InvoiceTemplateService {
  normalizeAddressRecord(addr = {}) {
    return {
      id: addr.id != null ? String(addr.id) : null,
      attention: addr.attention || '',
      line1: addr.address1 || '',
      line2: addr.address2 || '',
      city: addr.city || '',
      state: addr.state || '',
      country: addr.country || '',
      postalCode: addr.pin_code || '',
    };
  }

  hasAddressData(address = {}) {
    if (!address || typeof address !== 'object') return false;
    return ['attention', 'line1', 'line2', 'city', 'state', 'country', 'postalCode']
      .some((key) => address[key] != null && String(address[key]).trim() !== '');
  }

  async getPartyAddresses(entityType, entityId) {
    if (!entityId) return { billing: [], shipping: [] };
    const rows = await db.query(
      `SELECT id, address_type, attention, country, address1, address2, city, state, pin_code
       FROM addresses
       WHERE entity_type = ? AND entity_id = ?
       ORDER BY id ASC`,
      [entityType, entityId]
    );
    const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
    const billing = [];
    const shipping = [];
    for (const row of list) {
      const normalized = this.normalizeAddressRecord(row);
      const type = String(row.address_type || '').toLowerCase();
      if (type === 'billing') billing.push(normalized);
      if (type === 'shipping') shipping.push(normalized);
    }
    return { billing, shipping };
  }

  chooseAddressForInvoice(addresses = [], selectedAddressId, fallback = {}) {
    if (selectedAddressId) {
      const selected = addresses.find((addr) => String(addr.id) === String(selectedAddressId));
      if (selected) return { ...selected };
    }
    const firstWithData = addresses.find((addr) => this.hasAddressData(addr));
    if (firstWithData) return { ...firstWithData };
    return { ...fallback };
  }

  /**
   * Generate standard invoice format with vendor/customer details
   */
  async generateStandardInvoice(institutionId, invoiceData, type = 'purchase') {
    try {
      const invoice = {
        header: await this.getInvoiceHeader(institutionId),
        details: await this.getInvoiceDetails(invoiceData, type),
        partyDetails: await this.getPartyDetails(institutionId, invoiceData, type),
        lineItems: this.formatLineItems(invoiceData.lines || []),
        totals: this.calculateTotals(invoiceData.lines || [], invoiceData.currency || 'USD'),
        footer: this.getInvoiceFooter(invoiceData),
        metadata: {
          type,
          generatedAt: new Date().toISOString(),
          institutionId,
          customerId: invoiceData.customerId || null,
          vendorId: invoiceData.vendorId || null,
        }
      };

      return invoice;
    } catch (error) {
      logger.error('Error generating standard invoice:', error);
      throw error;
    }
  }

  /**
   * Get institution/company header details
   */
  async getInvoiceHeader(institutionId) {
    try {
      const rows = await db.query(
        `SELECT
           COALESCE(ip.company_name, i.name) AS company_name,
           COALESCE(ip.address, i.address) AS address,
           COALESCE(ip.phone, i.mobile) AS phone,
           COALESCE(ip.email, i.email) AS email,
           ip.logo_path,
           COALESCE(NULLIF(TRIM(ip.tax_id), ''), i.tax_id) AS tax_id,
           ip.pan,
           ip.cin,
           ip.tan,
           ip.website,
           ip.account_holder_name,
           ip.branch_name,
           i.city,
           i.state,
           i.postal_code
         FROM institutions i
         LEFT JOIN institution_profiles ip
           ON ip.institution_id COLLATE utf8mb4_unicode_ci = i.id COLLATE utf8mb4_unicode_ci
         WHERE i.id COLLATE utf8mb4_unicode_ci = ?
         LIMIT 1`,
        [institutionId]
      );
      const row = Array.isArray(rows) ? rows[0] : rows;

      if (row) {
        return {
          companyName: row.company_name || 'Company Name',
          address: {
            line1: row.address || '',
            city: row.city || '',
            state: row.state || '',
            country: '',
            postalCode: row.postal_code || '',
          },
          contact: {
            phone: row.phone || '',
            email: row.email || '',
            website: row.website || '',
          },
          taxInfo: {
            taxId: row.tax_id || '',
            pan: row.pan ? String(row.pan).trim().toUpperCase() : '',
            registrationNumber: row.cin ? String(row.cin).trim().toUpperCase() : '',
          },
          branding: {
            logoUrl: row.logo_path || '',
            stampUrl: '',
            signatureUrl: '',
          },
        };
      }
      return this.getDefaultHeader();
    } catch (error) {
      logger.error('Error getting invoice header:', error);
      return this.getDefaultHeader();
    }
  }

  /**
   * Get invoice basic details
   */
  async getInvoiceDetails(invoiceData, type) {
    const base = {
      type: type === 'purchase' ? 'purchase' : 'sales',
      invoiceNumber: invoiceData.invoiceNumber || await this.generateInvoiceNumber(type),
      invoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || this.calculateDueDate(invoiceData.paymentTerms),
      currency: invoiceData.currency || 'USD',
      exchangeRate: invoiceData.exchangeRate || 1,
      reference: invoiceData.reference || '',
      poNumber: invoiceData.poNumber || '',
      grnNumber: invoiceData.grnNumber || '',
      paymentTerms: invoiceData.paymentTerms || '',
    };
    if (invoiceData.documentKind) {
      base.documentKind = invoiceData.documentKind;
    }
    const meta = invoiceData.documentMeta ?? invoiceData.document_meta;
    const metaInvoiceType = invoiceData.documentKind === 'proforma' ? 'proforma' : type;
    return applyDocumentMetaToInvoiceDetails(base, meta, {
      invoiceType: metaInvoiceType,
      documentKind: invoiceData.documentKind,
      soNumber: invoiceData.soNumber,
      poNumber: invoiceData.poNumber,
      invoiceDate: base.invoiceDate,
      destination: invoiceData.destination,
    });
  }

  /**
   * Get vendor or customer details based on invoice type
   */
  async getPartyDetails(institutionId, invoiceData, type) {
    try {
      const hasSavedAddresses = (addr) => {
        if (!addr || typeof addr !== 'object') return false;
        return Boolean(addr.line1 || addr.line2 || addr.city || addr.state || addr.country || addr.postalCode);
      };
      if (
        hasSavedAddresses(invoiceData.billingAddress)
        || hasSavedAddresses(invoiceData.shippingAddress)
      ) {
        return this.getManualPartyDetails(invoiceData, type);
      }

      const meta = invoiceData.documentMeta ?? invoiceData.document_meta ?? {};
      const selected = meta.partyAddressSelection || {};
      if (type === 'purchase' && invoiceData.vendorId) {
        return await this.getVendorDetails(institutionId, invoiceData.vendorId, selected);
      }
      if (type === 'sales' && invoiceData.customerId) {
        return await this.getCustomerDetails(institutionId, invoiceData.customerId, selected);
      }
      return this.getManualPartyDetails(invoiceData, type);
    } catch (error) {
      logger.error('Error getting party details:', error);
      return this.getManualPartyDetails(invoiceData, type);
    }
  }

  /**
   * Get comprehensive vendor details for invoice
   */
  async getVendorDetails(institutionId, vendorId, selectedAddress = {}) {
    try {
      const vendor = await vendorService.getVendor(institutionId, vendorId);
      
      if (!vendor) {
        logger.warn('Vendor not found', { vendorId, institutionId });
        return { type: 'vendor', name: 'Unknown Vendor', contact: {}, billingAddress: {} };
      }

      const { billing, shipping } = await this.getPartyAddresses('vendor', vendor.id);
      const fallbackBilling = {
        attention: vendor.billing_attention || '',
        line1: vendor.billing_address1 || '',
        line2: vendor.billing_address2 || '',
        city: vendor.billing_city || '',
        state: vendor.billing_state || '',
        country: vendor.billing_country || '',
        postalCode: vendor.billing_pin_code || '',
      };
      const fallbackShipping = {
        attention: vendor.shipping_attention || '',
        line1: vendor.shipping_address1 || '',
        line2: vendor.shipping_address2 || '',
        city: vendor.shipping_city || '',
        state: vendor.shipping_state || '',
        country: vendor.shipping_country || '',
        postalCode: vendor.shipping_pin_code || '',
      };

      return {
        type: 'vendor',
        id: vendor.id,
        code: vendor.vendor_code,
        name: vendor.display_name || vendor.company_name,
        companyName: vendor.company_name,
        contact: {
          person: `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim(),
          email: vendor.email,
          phone: vendor.work_phone || vendor.mobile_phone,
          mobile: vendor.mobile_phone
        },
        billingAddresses: billing,
        shippingAddresses: shipping,
        billingAddress: this.chooseAddressForInvoice(
          billing,
          selectedAddress.billingAddressId,
          selectedAddress.billingAddress || fallbackBilling
        ),
        shippingAddress: this.chooseAddressForInvoice(
          shipping,
          selectedAddress.shippingAddressId,
          selectedAddress.shippingAddress || fallbackShipping
        ),
        taxInfo: {
          pan: vendor.pan ? String(vendor.pan).trim().toUpperCase() : '',
          gstin: vendor.gstin,
          msmeRegistered: vendor.msme_registered
        },
        bankDetails: {
          bankName: vendor.bank_name,
          accountHolder: vendor.account_holder_name,
          accountNumber: vendor.account_number,
          ifscCode: vendor.ifsc_code,
          branchName: vendor.branch_name,
          accountType: vendor.account_type,
          swiftCode: vendor.swift_code,
          iban: vendor.iban
        },
        businessInfo: {
          website: vendor.website_url,
          department: vendor.department,
          designation: vendor.designation,
          paymentTerms: vendor.payment_terms,
          currency: vendor.currency,
          tds: vendor.tds
        }
      };
    } catch (error) {
      logger.error('Error getting vendor details:', error);
      return { type: 'vendor', name: 'Unknown Vendor', contact: {}, billingAddress: {} };
    }
  }

  /**
   * Get customer details for sales invoice
   */
  async getCustomerDetails(institutionId, customerId, selectedAddress = {}) {
    try {
      const customer = await customerService.getCustomer(institutionId, customerId);
      
      if (!customer) {
        throw new Error('Customer not found');
      }

      const { billing, shipping } = await this.getPartyAddresses('customer', customer.id);
      const fallbackBilling = {
        attention: customer.billing_attention || '',
        line1: customer.billing_address1 || '',
        line2: customer.billing_address2 || '',
        city: customer.billing_city || '',
        state: customer.billing_state || '',
        country: customer.billing_country || '',
        postalCode: customer.billing_pin_code || '',
      };
      const fallbackShipping = {
        attention: customer.shipping_attention || '',
        line1: customer.shipping_address1 || '',
        line2: customer.shipping_address2 || '',
        city: customer.shipping_city || '',
        state: customer.shipping_state || '',
        country: customer.shipping_country || '',
        postalCode: customer.shipping_pin_code || '',
      };

      return {
        type: 'customer',
        id: customer.id,
        code: customer.customer_code,
        name: customer.display_name || customer.company_name,
        companyName: customer.company_name,
        contact: {
          person: `${customer.first_name || ''} ${customer.last_name || ''}`.trim(),
          email: customer.email,
          phone: customer.work_phone || customer.mobile_phone,
          mobile: customer.mobile_phone
        },
        billingAddresses: billing,
        shippingAddresses: shipping,
        billingAddress: this.chooseAddressForInvoice(
          billing,
          selectedAddress.billingAddressId,
          selectedAddress.billingAddress || fallbackBilling
        ),
        shippingAddress: this.chooseAddressForInvoice(
          shipping,
          selectedAddress.shippingAddressId,
          selectedAddress.shippingAddress || fallbackShipping
        ),
        taxInfo: {
          pan: customer.pan ? String(customer.pan).trim().toUpperCase() : '',
          gstin: customer.gstin
        }
      };
    } catch (error) {
      logger.error('Error getting customer details:', error);
      throw error;
    }
  }

  /**
   * Format line items with calculations
   */
  formatLineItems(lines) {
    return lines.map((line, index) => {
      const taxRate = parseFloat(line.taxRate ?? line.tax_rate ?? 0);
      const unitAmount = parseFloat(line.unitCost ?? line.unit_cost ?? line.unitPrice ?? line.unit_price ?? 0);
      const quantity = parseFloat(line.quantity ?? 0);
      const discountRate = parseFloat(line.discountRate ?? line.discount_rate ?? 0);
      const lineTotal = quantity * unitAmount;
      const discountAmount = (lineTotal * discountRate) / 100;
      const taxableAmount = lineTotal - discountAmount;
      const taxAmount = (taxableAmount * taxRate) / 100;
      const netAmount = taxableAmount + taxAmount;

      return {
        sno: index + 1,
        itemId: line.itemId,
        itemName: line.itemName ?? line.item_name ?? line.description,
        description: line.description,
        sku: line.sku,
        unit: normalizeInvoiceUnit(line.unit || line.unit_of_measure),
        quantity,
        unitAmount,
        lineTotal,
        discountRate,
        discountAmount,
        taxableAmount,
        taxRate,
        taxAmount,
        netAmount,
        hsnCode: line.hsnCode,
        specifications: line.specifications
      };
    });
  }

  /**
   * Calculate invoice totals
   */
  calculateTotals(lines, currencyCode = 'USD') {
    const formattedLines = this.formatLineItems(lines);

    const subtotal = formattedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const totalDiscountAmount = formattedLines.reduce((sum, line) => sum + line.discountAmount, 0);
    const totalTaxableAmount = formattedLines.reduce((sum, line) => sum + line.taxableAmount, 0);
    const totalTaxAmount = formattedLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const sumLineNets = formattedLines.reduce((sum, line) => sum + line.netAmount, 0);

    const rSub = this.roundAmount(subtotal);
    const rDisc = this.roundAmount(totalDiscountAmount);
    const rt = this.roundAmount(totalTaxableAmount);
    const rta = this.roundAmount(totalTaxAmount);
    const fromLineNets = this.roundAmount(sumLineNets);
    /** Grand total shown on PDF (Taxable + tax after 2dp) so it matches the GST summary block. */
    const fromTaxStack = this.roundAmount(rt + rta);
    const grandTotal = fromTaxStack;
    if (Math.abs(fromTaxStack - fromLineNets) > 0.02) {
      logger.warn('Invoice totals: rounded taxable+tax differs from sum of line net amounts', {
        fromTaxStack,
        fromLineNets,
      });
    }

    return {
      subtotal: rSub,
      totalDiscountAmount: rDisc,
      totalTaxableAmount: rt,
      totalTaxAmount: rta,
      grandTotal,
      amountInWords: this.convertAmountToWords(grandTotal, currencyCode),
    };
  }

  /**
   * 0–99 to words (shared building block)
   */
  _wordsBelowHundred(num) {
    const n = Math.floor(Number(num) || 0);
    if (n < 0 || n > 99) return '';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    const t = Math.floor(n / 10);
    const o = n % 10;
    return tens[t] + (o ? ` ${ones[o]}` : '');
  }

  /**
   * 0–999 to words
   */
  _wordsBelowThousand(num) {
    const n = Math.floor(Number(num) || 0);
    if (n < 0 || n > 999) return '';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    if (n < 100) return this._wordsBelowHundred(n);
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return `${ones[h]} Hundred${rest ? ` and ${this._wordsBelowHundred(rest)}` : ''}`;
  }

  /**
   * Non-negative integer to words (Indian numbering: Crore, Lakh, Thousand)
   */
  _integerToIndianWords(n) {
    let rem = Math.floor(Number(n) || 0);
    if (rem === 0) return 'Zero';
    if (rem < 0) return 'Zero';
    const parts = [];

    const crore = Math.floor(rem / 10000000);
    rem %= 10000000;
    if (crore) parts.push(`${this._wordsBelowThousand(crore)} Crore`.trim());

    const lakh = Math.floor(rem / 100000);
    rem %= 100000;
    if (lakh) parts.push(`${this._wordsBelowThousand(lakh)} Lakh`.trim());

    const thousand = Math.floor(rem / 1000);
    rem %= 1000;
    if (thousand) parts.push(`${this._wordsBelowThousand(thousand)} Thousand`.trim());

    if (rem) parts.push(this._wordsBelowThousand(rem));

    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Non-negative integer to words (short scale: Billion, Million, Thousand)
   */
  _integerToWesternWords(n) {
    let rem = Math.floor(Number(n) || 0);
    if (rem === 0) return 'Zero';
    if (rem < 0) return 'Zero';
    const scales = [
      [1000000000, 'Billion'],
      [1000000, 'Million'],
      [1000, 'Thousand']
    ];
    const parts = [];
    for (const [div, label] of scales) {
      if (rem >= div) {
        const v = Math.floor(rem / div);
        rem %= div;
        parts.push(`${this._wordsBelowThousand(v)} ${label}`.trim());
      }
    }
    if (rem) parts.push(this._wordsBelowThousand(rem));
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Amount in words for invoice (e.g. INR → "Five Rupees Only", USD → "Five Dollars Only")
   */
  convertAmountToWords(amount, currencyCode = 'USD') {
    const code = String(currencyCode || 'USD').toUpperCase().trim();
    const rounded = this.roundAmount(Number(amount) || 0);
    const totalPaisa = Math.round(rounded * 100 + Number.EPSILON);
    const major = Math.floor(totalPaisa / 100);
    const minor = totalPaisa % 100;

    const currencyLabels = {
      INR: { majorSingular: 'Rupee', majorPlural: 'Rupees', minorSingular: 'Paisa', minorPlural: 'Paise', useIndian: true },
      USD: { majorSingular: 'Dollar', majorPlural: 'Dollars', minorSingular: 'Cent', minorPlural: 'Cents', useIndian: false },
      GBP: { majorSingular: 'Pound', majorPlural: 'Pounds', minorSingular: 'Penny', minorPlural: 'Pence', useIndian: false },
      EUR: { majorSingular: 'Euro', majorPlural: 'Euros', minorSingular: 'Cent', minorPlural: 'Cents', useIndian: false },
      AED: { majorSingular: 'Dirham', majorPlural: 'Dirhams', minorSingular: 'Fils', minorPlural: 'Fils', useIndian: false }
    };
    const L = currencyLabels[code] || {
      majorSingular: 'Unit',
      majorPlural: 'Units',
      minorSingular: 'Cent',
      minorPlural: 'Cents',
      useIndian: false
    };

    const intWords = L.useIndian ? this._integerToIndianWords(major) : this._integerToWesternWords(major);
    const minorWords = minor ? this._wordsBelowHundred(minor) : '';

    let body = '';
    if (major === 0 && minor === 0) {
      body = `Zero ${L.majorPlural}`;
    } else if (major === 0) {
      body = `${minorWords} ${minor === 1 ? L.minorSingular : L.minorPlural}`;
    } else if (minor === 0) {
      const majorLabel = major === 1 ? L.majorSingular : L.majorPlural;
      body = `${intWords} ${majorLabel}`;
    } else {
      const majorLabel = major === 1 ? L.majorSingular : L.majorPlural;
      const minorLabel = minor === 1 ? L.minorSingular : L.minorPlural;
      body = `${intWords} ${majorLabel} and ${minorWords} ${minorLabel}`;
    }

    return `${body} Only`;
  }

  /**
   * Get invoice footer information
   */
  getInvoiceFooter(invoiceData) {
    return {
      notes: invoiceData.notes || '',
      terms:
        invoiceData.terms ||
        invoiceData.notes ||
        'Payment due within specified terms. Late payments may incur charges.',
      bankDetails: invoiceData.bankDetails || null,
      authorizedSignatory: {
        name: invoiceData.authorizedBy || '',
        designation: 'Authorized Signatory',
        date: new Date().toISOString().split('T')[0]
      }
    };
  }

  /**
   * Get manual party details when no ID is provided
   */
  getManualPartyDetails(invoiceData, type) {
    const partyName = type === 'purchase' ? 'vendorName' : 'customerName';

    const billing = invoiceData.billingAddress && typeof invoiceData.billingAddress === 'object'
      ? { ...invoiceData.billingAddress }
      : {
        attention: invoiceData.billingAttention || '',
        line1: invoiceData.billingAddress || invoiceData.billingLine1 || '',
        line2: invoiceData.billingLine2 || '',
        city: invoiceData.billingCity || '',
        state: invoiceData.billingState || '',
        country: invoiceData.billingCountry || '',
        postalCode: invoiceData.billingPostalCode || '',
      };

    const shipping = invoiceData.shippingAddress && typeof invoiceData.shippingAddress === 'object'
      ? { ...invoiceData.shippingAddress }
      : {
        attention: invoiceData.shippingAttention || '',
        line1: invoiceData.shippingAddress || invoiceData.shippingLine1 || '',
        line2: invoiceData.shippingLine2 || '',
        city: invoiceData.shippingCity || '',
        state: invoiceData.shippingState || '',
        country: invoiceData.shippingCountry || '',
        postalCode: invoiceData.shippingPostalCode || '',
      };

    return {
      type: type === 'purchase' ? 'vendor' : 'customer',
      name: invoiceData[partyName] || '',
      companyName: invoiceData.companyName || invoiceData[partyName] || '',
      contact: {
        email: invoiceData.email || '',
        phone: invoiceData.phone || '',
      },
      billingAddress: billing,
      shippingAddress: shipping,
      taxInfo: {
        gstin: invoiceData.partyGstin || invoiceData.gstin || '',
      },
      bankDetails: normalizeBankDetails(invoiceData.bankDetails) || null,
    };
  }

  /**
   * Generate invoice number
   */
  async generateInvoiceNumber(type) {
    const prefix = type === 'purchase' ? 'PI' : 'SI';
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}${timestamp}`;
  }

  /**
   * Calculate due date based on payment terms
   */
  calculateDueDate(paymentTerms) {
    const today = new Date();
    let daysToAdd = 30; // Default 30 days

    if (paymentTerms) {
      const match = paymentTerms.match(/(\d+)/);
      if (match) {
        daysToAdd = parseInt(match[1]);
      }
    }

    const dueDate = new Date(today);
    dueDate.setDate(today.getDate() + daysToAdd);
    return dueDate.toISOString().split('T')[0];
  }

  /**
   * Round amount to 2 decimal places
   */
  roundAmount(amount) {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  /**
   * Get default header when institution details are not available
   */
  getDefaultHeader() {
    return {
      companyName: 'Your Company Name',
      address: {
        line1: 'Company Address',
        city: 'City',
        state: 'State',
        country: 'Country',
        postalCode: '000000'
      },
      contact: {
        phone: '+1-000-000-0000',
        email: 'info@company.com',
        website: 'www.company.com'
      },
      taxInfo: {
        taxId: '',
        registrationNumber: ''
      },
      branding: {
        logoUrl: '',
        stampUrl: '',
        signatureUrl: ''
      }
    };
  }

  /**
   * Get vendor list for dropdown
   */
  async getVendorList(institutionId, search = '') {
    try {
      let query = `
        SELECT 
          id,
          vendor_code,
          display_name,
          company_name,
          email,
          work_phone,
          mobile_phone
        FROM vendors 
        WHERE institution_id = ? AND status = 'active'
      `;
      const params = [institutionId];

      if (search) {
        query += ` AND (display_name LIKE ? OR company_name LIKE ? OR vendor_code LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY display_name LIMIT 50`;

      const vendors = await db.query(query, params);
      
      return vendors.map(vendor => ({
        id: vendor.id,
        code: vendor.vendor_code,
        name: vendor.display_name || vendor.company_name,
        displayText: `${vendor.vendor_code} - ${vendor.display_name || vendor.company_name}`,
        email: vendor.email,
        phone: vendor.work_phone || vendor.mobile_phone
      }));
    } catch (error) {
      logger.error('Error getting vendor list:', error);
      return [];
    }
  }

  /**
   * Get customer list for dropdown
   */
  async getCustomerList(institutionId, search = '') {
    try {
      let query = `
        SELECT 
          id,
          customer_code,
          display_name,
          company_name,
          email,
          work_phone,
          mobile_phone
        FROM customers 
        WHERE institution_id = ? AND status = 'active'
      `;
      const params = [institutionId];

      if (search) {
        query += ` AND (display_name LIKE ? OR company_name LIKE ? OR customer_code LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += ` ORDER BY display_name LIMIT 50`;

      const customers = await db.query(query, params);
      
      return customers.map(customer => ({
        id: customer.id,
        code: customer.customer_code,
        name: customer.display_name || customer.company_name,
        displayText: `${customer.customer_code} - ${customer.display_name || customer.company_name}`,
        email: customer.email,
        phone: customer.work_phone || customer.mobile_phone
      }));
    } catch (error) {
      logger.error('Error getting customer list:', error);
      return [];
    }
  }
}

module.exports = new InvoiceTemplateService();