const db = require('../database/connection');
const vendorService = require('./vendorService');
const customerService = require('./customerService');
const logger = require('../utils/logger');

class InvoiceTemplateService {
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
        totals: this.calculateTotals(invoiceData.lines || []),
        footer: this.getInvoiceFooter(invoiceData),
        metadata: {
          type,
          generatedAt: new Date().toISOString(),
          institutionId
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
      const [institution] = await db.query(`
        SELECT 
          name as company_name,
          email
        FROM institutions 
        WHERE id = ?
      `, [institutionId]);

      if (institution) {
        return {
          companyName: institution.company_name || 'Your Company Name',
          address: {
            line1: '',
            city: '',
            state: '',
            country: '',
            postalCode: ''
          },
          contact: {
            phone: '',
            email: institution.email || '',
            website: ''
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
    return {
      invoiceNumber: invoiceData.invoiceNumber || await this.generateInvoiceNumber(type),
      invoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: invoiceData.dueDate || this.calculateDueDate(invoiceData.paymentTerms),
      currency: invoiceData.currency || 'USD',
      exchangeRate: invoiceData.exchangeRate || 1,
      reference: invoiceData.reference || '',
      poNumber: invoiceData.poNumber || '',
      grnNumber: invoiceData.grnNumber || '',
      paymentTerms: invoiceData.paymentTerms || 'Net 30'
    };
  }

  /**
   * Get vendor or customer details based on invoice type
   */
  async getPartyDetails(institutionId, invoiceData, type) {
    try {
      if (type === 'purchase' && invoiceData.vendorId) {
        return await this.getVendorDetails(institutionId, invoiceData.vendorId);
      } else if (type === 'sales' && invoiceData.customerId) {
        return await this.getCustomerDetails(institutionId, invoiceData.customerId);
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
  async getVendorDetails(institutionId, vendorId) {
    try {
      const vendor = await vendorService.getVendor(institutionId, vendorId);
      
      if (!vendor) {
        logger.warn('Vendor not found', { vendorId, institutionId });
        return { type: 'vendor', name: 'Unknown Vendor', contact: {}, billingAddress: {} };
      }

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
        billingAddress: {
          attention: vendor.billing_attention,
          line1: vendor.billing_address1,
          line2: vendor.billing_address2,
          city: vendor.billing_city,
          state: vendor.billing_state,
          country: vendor.billing_country,
          postalCode: vendor.billing_pin_code
        },
        shippingAddress: {
          attention: vendor.shipping_attention,
          line1: vendor.shipping_address1,
          line2: vendor.shipping_address2,
          city: vendor.shipping_city,
          state: vendor.shipping_state,
          country: vendor.shipping_country,
          postalCode: vendor.shipping_pin_code
        },
        taxInfo: {
          pan: vendor.pan,
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
  async getCustomerDetails(institutionId, customerId) {
    try {
      const customer = await customerService.getCustomer(institutionId, customerId);
      
      if (!customer) {
        throw new Error('Customer not found');
      }

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
        billingAddress: {
          attention: customer.billing_attention,
          line1: customer.billing_address1,
          line2: customer.billing_address2,
          city: customer.billing_city,
          state: customer.billing_state,
          country: customer.billing_country,
          postalCode: customer.billing_pin_code
        },
        shippingAddress: {
          attention: customer.shipping_attention,
          line1: customer.shipping_address1,
          line2: customer.shipping_address2,
          city: customer.shipping_city,
          state: customer.shipping_state,
          country: customer.shipping_country,
          postalCode: customer.shipping_pin_code
        },
        taxInfo: {
          pan: customer.pan,
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
      const unitAmount = line.unitCost || line.unitPrice || 0;
      const quantity = line.quantity || 0;
      const lineTotal = quantity * unitAmount;
      const discountRate = line.discountRate || 0;
      const discountAmount = (lineTotal * discountRate) / 100;
      const taxableAmount = lineTotal - discountAmount;
      const taxRate = line.taxRate || 0;
      const taxAmount = (taxableAmount * taxRate) / 100;
      const netAmount = taxableAmount + taxAmount;

      return {
        sno: index + 1,
        itemId: line.itemId,
        itemName: line.itemName || line.description,
        description: line.description,
        sku: line.sku,
        unit: line.unit || 'PCS',
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
  calculateTotals(lines) {
    const formattedLines = this.formatLineItems(lines);
    
    const subtotal = formattedLines.reduce((sum, line) => sum + line.lineTotal, 0);
    const totalDiscountAmount = formattedLines.reduce((sum, line) => sum + line.discountAmount, 0);
    const totalTaxableAmount = formattedLines.reduce((sum, line) => sum + line.taxableAmount, 0);
    const totalTaxAmount = formattedLines.reduce((sum, line) => sum + line.taxAmount, 0);
    const grandTotal = formattedLines.reduce((sum, line) => sum + line.netAmount, 0);

    return {
      subtotal: this.roundAmount(subtotal),
      totalDiscountAmount: this.roundAmount(totalDiscountAmount),
      totalTaxableAmount: this.roundAmount(totalTaxableAmount),
      totalTaxAmount: this.roundAmount(totalTaxAmount),
      grandTotal: this.roundAmount(grandTotal),
      amountInWords: this.convertAmountToWords(grandTotal)
    };
  }

  /**
   * Get invoice footer information
   */
  getInvoiceFooter(invoiceData) {
    return {
      notes: invoiceData.notes || '',
      terms: invoiceData.terms || 'Payment due within specified terms. Late payments may incur charges.',
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
    
    return {
      type: type === 'purchase' ? 'vendor' : 'customer',
      name: invoiceData[partyName] || '',
      companyName: invoiceData.companyName || '',
      contact: {
        email: invoiceData.email || '',
        phone: invoiceData.phone || ''
      },
      billingAddress: {
        line1: invoiceData.billingAddress || '',
        city: invoiceData.billingCity || '',
        state: invoiceData.billingState || '',
        country: invoiceData.billingCountry || '',
        postalCode: invoiceData.billingPostalCode || ''
      }
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
   * Convert amount to words (basic implementation)
   */
  convertAmountToWords(amount) {
    // This is a simplified implementation
    // You can integrate a proper number-to-words library
    const rounded = Math.round(amount);
    return `${rounded} Only`;
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