const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { resolveUploadAbsolutePath } = require('../../shared/storage/fileStorage');
const logger = require('../../utils/logger');
const db = require('../../database/connection');
const axios = require('axios');
const { resolvePublicBaseUrl } = require('../../config');
const { normalizeInvoicePdfTemplate } = require('./invoicePdfTemplate.constants');
const {
  formatShortDate,
  formatDisplayDate,
  drawCompanyLogoTopLeft,
  drawInvoiceLineItems,
  drawTotalsBlock,
  drawPartyBankBox,
  drawStampSignature,
} = require('./invoicePdfDrawShared');
const {
  formatInvoiceDate,
  drawParallelogramCompanyBanner,
  hasAddress,
  drawBrandedPartyColumn,
  drawSalesBillShipColumns,
  getSalesPartyColumnLayout,
  drawBrandedLineItems,
  drawBrandedTotals,
  drawBrandedFooter,
} = require('./invoicePdfBranded');
const { normalizeDocType } = require('../../utils/pdfFooterOptions');
const { loadPdfFooterAssets } = require('../../utils/pdfFooterAssets');

class InvoicePDFService {
  _firstRow(result) {
    if (result == null) return null;
    if (Array.isArray(result)) return result[0] || null;
    return result;
  }

  /**
   * Load company profile the same way Company Settings API does (profile + default address + assets).
   */
  async loadCompanyProfileForPdf(institutionId) {
    if (!institutionId) return null;

    const row = this._firstRow(
      await db.query(
        `SELECT
           ip.company_name,
           ip.address AS profile_address,
           ip.phone,
           ip.email AS profile_email,
           ip.bank_name,
           ip.account_number,
           ip.ifsc_code,
           ip.swift_code,
           ip.logo_path,
           ip.authorized_signatory_name,
           ip.authorized_signatory_designation,
           ip.invoice_pdf_template,
           ip.pdf_footer_options,
           i.name AS institution_name,
           i.email AS institution_email,
           i.address AS institution_address,
           i.mobile AS institution_mobile,
           i.city AS institution_city,
           i.state AS institution_state,
           i.postal_code AS institution_postal,
           i.tax_id AS institution_tax_id
         FROM institutions i
         LEFT JOIN institution_profiles ip
           ON ip.institution_id COLLATE utf8mb4_unicode_ci = i.id COLLATE utf8mb4_unicode_ci
         WHERE i.id COLLATE utf8mb4_unicode_ci = ?
         LIMIT 1`,
        [institutionId]
      )
    );

    if (!row) return null;

    const base = {
      company_name: row.company_name || row.institution_name || null,
      address: row.profile_address || row.institution_address || null,
      phone: row.phone || row.institution_mobile || null,
      email: row.profile_email || row.institution_email || null,
      bank_name: row.bank_name || null,
      account_number: row.account_number || null,
      ifsc_code: row.ifsc_code || null,
      swift_code: row.swift_code || null,
      logo_path: row.logo_path || null,
      authorized_signatory_name: row.authorized_signatory_name || null,
      authorized_signatory_designation: row.authorized_signatory_designation || null,
      invoice_pdf_template: row.invoice_pdf_template || null,
      pdf_footer_options: row.pdf_footer_options ?? null,
      tax_id: row.institution_tax_id || null,
      city: row.institution_city || null,
      state: row.institution_state || null,
      postal_code: row.institution_postal || null,
    };

    try {
      const multi = require('../settings/companySettingsMulti.service');
      await multi.ensureTables();
      return await multi.attachMultiToSettingsRow(institutionId, base);
    } catch (err) {
      logger.warn('attachMultiToSettingsRow failed for PDF', { institutionId, error: err.message });
      return base;
    }
  }

  /** Ensure header/branding on standardInvoice matches loaded company profile. */
  _applyCompanyProfileToStandardInvoice(standardInvoice, companySettings) {
    if (!companySettings || !standardInvoice) return;
    standardInvoice.header = {
      ...(standardInvoice.header || {}),
      companyName: companySettings.company_name || standardInvoice.header?.companyName,
      address: {
        line1: companySettings.address || standardInvoice.header?.address?.line1 || '',
        city: companySettings.city || standardInvoice.header?.address?.city || '',
        state: companySettings.state || standardInvoice.header?.address?.state || '',
        country: companySettings.country || standardInvoice.header?.address?.country || '',
        postalCode: companySettings.postal_code || standardInvoice.header?.address?.postalCode || '',
      },
      contact: {
        phone: companySettings.phone || standardInvoice.header?.contact?.phone || '',
        email: companySettings.email || standardInvoice.header?.contact?.email || '',
        website: standardInvoice.header?.contact?.website || '',
      },
      taxInfo: {
        taxId: companySettings.tax_id || standardInvoice.header?.taxInfo?.taxId || '',
        registrationNumber: standardInvoice.header?.taxInfo?.registrationNumber || '',
      },
      branding: {
        logoUrl: companySettings.logo_path || standardInvoice.header?.branding?.logoUrl || '',
        stampUrl: companySettings.stamp_path || standardInvoice.header?.branding?.stampUrl || '',
        signatureUrl: companySettings.signature_path || standardInvoice.header?.branding?.signatureUrl || '',
      },
    };
  }

  _isSalesInvoice(standardInvoice) {
    const docType = standardInvoice?.details?.type || standardInvoice?.metadata?.type;
    return docType === 'sales';
  }

  /** When ship-to is empty, use bill-to so SI PDF always shows both columns. */
  _ensureSalesShippingAddress(partyDetails) {
    if (!partyDetails) return;
    const ship = partyDetails.shippingAddress || {};
    if (hasAddress(ship)) return;
    const bill = partyDetails.billingAddress || {};
    if (hasAddress(bill)) {
      partyDetails.shippingAddress = {
        attention: bill.attention || '',
        line1: bill.line1 || '',
        line2: bill.line2 || '',
        city: bill.city || '',
        state: bill.state || '',
        country: bill.country || '',
        postalCode: bill.postalCode || '',
      };
    }
  }

  _ensurePreviewShippingAddress(partyDetails) {
    this._ensureSalesShippingAddress(partyDetails);
  }

  /** Logo upper-left; company name / contact upper-right (sales invoice layout). */
  _drawClassicCompanyHeader(doc, logoBuffer, cs) {
    const header = drawCompanyLogoTopLeft(doc, logoBuffer);
    const rightX = 280;
    const rightW = 545 - rightX;
    let ry = header.topY;

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(cs.companyName, rightX, ry, {
      width: rightW,
      align: 'right',
    });
    ry += 18;
    doc.fontSize(9).font('Helvetica');
    if (cs.address) {
      doc.text(cs.address, rightX, ry, { width: rightW, align: 'right' });
      ry += 12;
    }
    if (cs.cityLine) {
      doc.text(cs.cityLine, rightX, ry, { width: rightW, align: 'right' });
      ry += 12;
    }
    const contact = [cs.phone, cs.email].filter(Boolean).join(' | ');
    if (contact) {
      doc.text(contact, rightX, ry, { width: rightW, align: 'right' });
      ry += 12;
    }
    if (cs.taxId) {
      doc.fontSize(8).text(`Tax ID: ${cs.taxId}`, rightX, ry, { width: rightW, align: 'right' });
      ry += 12;
    }
    doc.fillColor('#000');
    return Math.max(header.bottomY, ry) + 10;
  }

  /** Right column: SALES INVOICE title + invoice # / dates (matches UI preview). */
  _drawSalesInvoiceMetaRight(doc, startY, standardInvoice, layout) {
    const { metaX, metaWidth } = layout;
    let y = startY;

    doc.fontSize(14).font('Helvetica-Bold').fillColor('#000').text('SALES INVOICE', metaX, y, {
      width: metaWidth,
      align: 'right',
    });
    y += 22;

    const row = (label, value) => {
      doc.fontSize(10).font('Helvetica').text(`${label} ${value || '—'}`, metaX, y, {
        width: metaWidth,
        align: 'right',
      });
      y += 16;
    };
    row('Invoice #:', standardInvoice.details?.invoiceNumber || 'N/A');
    row('Date:', formatDisplayDate(standardInvoice.details?.invoiceDate));
    row('Due Date:', formatDisplayDate(standardInvoice.details?.dueDate));
    return y;
  }

  /** Invoice # / date / due / currency block (classic & minimal). */
  _drawInvoiceMetaBlock(doc, x, startY, standardInvoice, width = 140) {
    let y = startY;
    const row = (label, value) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(label, x, y, { width });
      doc.font('Helvetica').text(value || '—', x + 72, y, { width: width - 72 });
      y += 18;
    };
    row('Invoice #:', standardInvoice.details?.invoiceNumber || 'N/A');
    row('Invoice Date:', formatShortDate(standardInvoice.details?.invoiceDate));
    row('Due Date:', formatShortDate(standardInvoice.details?.dueDate));
    row('Currency:', standardInvoice.details?.currency || 'USD');
    return y;
  }

  /** Bill to / Ship to (sales) or single Bill to (purchase). Returns bottom Y. */
  _drawPartyBillShipBlock(doc, startY, standardInvoice) {
    const party = standardInvoice.partyDetails || { name: 'N/A' };
    const isSales = this._isSalesInvoice(standardInvoice);

    if (isSales) {
      const { bottomY, layout } = drawSalesBillShipColumns(doc, startY, party, { showGst: false });
      const metaY = this._drawSalesInvoiceMetaRight(doc, startY, standardInvoice, layout);
      return Math.max(bottomY, metaY);
    }

    const layout = getSalesPartyColumnLayout();
    const billY = drawBrandedPartyColumn(doc, layout.billX, startY, layout.colWidth + 40, 'Bill to:', party, {
      addressKey: 'billing',
      showName: true,
      showContact: true,
      showGst: true,
    });
    const metaY = this._drawInvoiceMetaBlock(doc, layout.metaX, startY, standardInvoice, layout.metaWidth);
    return Math.max(billY, metaY);
  }

  /**
   * Ensure SI party has bill/ship addresses (collation-safe DB load + customer name fallback).
   */
  async enrichSalesPartyDetails(institutionId, standardInvoice, invoiceData = {}) {
    if (!standardInvoice || !this._isSalesInvoice(standardInvoice)) return;

    const invoiceTemplateService = require('./invoiceTemplate.service');
    const { resolveCustomerId, loadCustomerAddressesFromTable } = require('../../utils/partyAddressLoader');

    const customerId = await resolveCustomerId(institutionId, {
      customerId:
        invoiceData.customerId ||
        standardInvoice.metadata?.customerId ||
        standardInvoice.partyDetails?.id,
      customerName:
        invoiceData.customerName ||
        standardInvoice.partyDetails?.name,
    });

    let party = standardInvoice.partyDetails || {};

    if (customerId) {
      try {
        party = await invoiceTemplateService.getCustomerDetails(institutionId, customerId);
      } catch (err) {
        logger.warn('getCustomerDetails failed, merging addresses only', {
          customerId,
          error: err.message,
        });
        const { billing, shipping } = await loadCustomerAddressesFromTable(customerId);
        party = {
          ...party,
          id: customerId,
          name: party.name || invoiceData.customerName || 'Customer',
          billingAddress: { ...(party.billingAddress || {}), ...billing },
          shippingAddress: { ...(party.shippingAddress || {}), ...shipping },
        };
      }
    }

    standardInvoice.partyDetails = party;
  }

  /** Load full customer/vendor party (billing + shipping) for PDF preview and documents. */
  async _loadPartyDetailsForDocument(institutionId, invoiceData, docType) {
    const invoiceTemplateService = require('./invoiceTemplate.service');
    const { resolveCustomerId } = require('../../utils/partyAddressLoader');
    const type = docType === 'purchase' ? 'purchase' : 'sales';

    if (type === 'sales') {
      const customerId = await resolveCustomerId(institutionId, {
        customerId: invoiceData.customerId,
        customerName: invoiceData.customerName,
      });
      if (customerId) {
        invoiceData.customerId = customerId;
        try {
          return await invoiceTemplateService.getCustomerDetails(institutionId, customerId);
        } catch (err) {
          logger.warn('Could not load party details for document', {
            docType: type,
            error: err.message,
          });
        }
      }
    }

    if (type === 'purchase' && invoiceData.vendorId) {
      try {
        return await invoiceTemplateService.getVendorDetails(institutionId, invoiceData.vendorId);
      } catch (err) {
        logger.warn('Could not load party details for document', {
          docType: type,
          error: err.message,
        });
      }
    }

    return invoiceTemplateService.getManualPartyDetails(invoiceData, type);
  }

  /**
   * Build preview invoice from institution data (company profile, real customer/vendor & items when available).
   * @param {'sales'|'purchase'} docType
   */
  async buildPreviewStandardInvoice(institutionId, docType = 'sales') {
    const invoiceTemplateService = require('./invoiceTemplate.service');
    const { getInstitutionBaseCurrency } = require('../../utils/exchangeRateHelpers');
    const type = docType === 'purchase' ? 'purchase' : 'sales';

    const currency = await getInstitutionBaseCurrency(db, institutionId);
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const itemRows = await db.query(
      `SELECT id, name, sku, unit,
              COALESCE(NULLIF(selling_price, 0), NULLIF(cost_price, 0), NULLIF(mrp, 0), 0) AS unit_price,
              hsn_code, tax_rate
         FROM items
        WHERE institution_id = ? AND status = 'active'
        ORDER BY name ASC
        LIMIT 3`,
      [institutionId]
    );
    const catalogItems = Array.isArray(itemRows) ? itemRows : itemRows ? [itemRows] : [];

    let lines;
    if (catalogItems.length > 0) {
      lines = catalogItems.map((it, index) => ({
        itemId: it.id,
        itemName: it.name,
        sku: it.sku,
        unit: it.unit,
        hsnCode: it.hsn_code,
        quantity: index === 0 ? 2 : 1,
        unitPrice: parseFloat(it.unit_price) || 0,
        taxRate: parseFloat(it.tax_rate) || 0,
        discountRate: 0,
      }));
    } else {
      lines = [
        {
          itemName: 'Add products in Items to see real line names here',
          quantity: 1,
          unitPrice: 0,
          taxRate: 0,
          discountRate: 0,
        },
      ];
    }

    let invoiceData;
    let invoiceNumber;

    if (type === 'purchase') {
      const vendorRows = await db.query(
        `SELECT id, display_name, company_name
           FROM vendors
          WHERE institution_id = ? AND status = 'active'
          ORDER BY display_name ASC
          LIMIT 1`,
        [institutionId]
      );
      const vendor = Array.isArray(vendorRows) ? vendorRows[0] : vendorRows;

      const lastPi = await db.query(
        `SELECT invoice_number FROM purchase_invoices
          WHERE institution_id = ?
          ORDER BY created_at DESC LIMIT 1`,
        [institutionId]
      );
      const last = Array.isArray(lastPi) ? lastPi[0] : lastPi;
      invoiceNumber = last?.invoice_number ? `${last.invoice_number}-PREVIEW` : 'PI000001';

      invoiceData = {
        invoiceNumber,
        invoiceDate: today,
        dueDate: due,
        currency,
        vendorId: vendor?.id || null,
        vendorName:
          vendor?.display_name ||
          vendor?.company_name ||
          'Vendor — add vendors under Purchases',
        paymentTerms: 'Net 30 days',
        notes: 'Purchase invoice preview — vendor billing details from your vendor master.',
        lines,
      };
    } else {
      const customerRows = await db.query(
        `SELECT id, display_name, company_name
           FROM customers
          WHERE institution_id = ? AND status = 'active'
          ORDER BY display_name ASC
          LIMIT 1`,
        [institutionId]
      );
      const customer = Array.isArray(customerRows) ? customerRows[0] : customerRows;

      const lastSi = await db.query(
        `SELECT invoice_number FROM sales_invoices
          WHERE institution_id = ?
          ORDER BY created_at DESC LIMIT 1`,
        [institutionId]
      );
      const last = Array.isArray(lastSi) ? lastSi[0] : lastSi;
      invoiceNumber = last?.invoice_number ? `${last.invoice_number}-PREVIEW` : 'SI000001';

      invoiceData = {
        invoiceNumber,
        invoiceDate: today,
        dueDate: due,
        currency,
        customerId: customer?.id || null,
        customerName:
          customer?.display_name ||
          customer?.company_name ||
          'Customer — add customers under Sales',
        paymentTerms: 'Net 30 days',
        notes: 'Thank you for your business. Please remit payment to the bank account listed below.',
        lines,
      };
    }

    const standard = await invoiceTemplateService.generateStandardInvoice(institutionId, invoiceData, type);
    if (type === 'sales') {
      await this.enrichSalesPartyDetails(institutionId, standard, invoiceData);
      this._ensurePreviewShippingAddress(standard.partyDetails);
    } else {
      standard.partyDetails = await this._loadPartyDetailsForDocument(institutionId, invoiceData, type);
    }
    const companyProfile = await this.loadCompanyProfileForPdf(institutionId);
    this._applyCompanyProfileToStandardInvoice(standard, companyProfile);
    return standard;
  }

  /** Static fallback when institution context is unavailable. */
  getSampleStandardInvoice(docType = 'sales') {
    const today = new Date().toISOString().split('T')[0];
    const due = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
    const type = docType === 'purchase' ? 'purchase' : 'sales';

    if (type === 'purchase') {
      return {
        header: {},
        details: {
          type: 'purchase',
          invoiceNumber: 'PI-PREVIEW-001',
          invoiceDate: today,
          dueDate: due,
          currency: 'USD',
        },
        partyDetails: {
          type: 'vendor',
          name: 'Sample Vendor Ltd.',
          billingAddress: {
            line1: '45 Supplier Road, Industrial Area',
            city: 'Delhi',
            state: 'DL',
            postalCode: '110001',
          },
          contact: { phone: '+91 91111 00000', email: 'accounts@vendor.example' },
        },
        lineItems: [
          { sno: 1, itemName: 'Raw Material A', hsn_code: '3901', quantity: 10, unitAmount: 25, netAmount: 250 },
          { sno: 2, itemName: 'Packaging B', hsn_code: '3923', quantity: 5, unitAmount: 40, netAmount: 200 },
        ],
        totals: {
          subtotal: 450,
          totalTaxAmount: 81,
          totalDiscountAmount: 0,
          grandTotal: 531,
          amountInWords: 'Five hundred thirty-one only',
        },
        footer: {
          terms: 'Payment per agreed purchase terms. Goods received subject to inspection.',
        },
      };
    }

    return {
      header: {},
      details: {
        type: 'sales',
        invoiceNumber: 'SI-PREVIEW-001',
        invoiceDate: today,
        dueDate: due,
        currency: 'USD',
      },
      partyDetails: {
        name: 'Sample Customer Ltd.',
        billingAddress: {
          line1: '221B Billing Street, Business Park',
          city: 'Mumbai',
          state: 'MH',
          postalCode: '400001',
        },
        shippingAddress: {
          line1: '88 Warehouse Lane, Dock 3',
          city: 'Pune',
          state: 'MH',
          postalCode: '411001',
        },
        contact: { phone: '+91 90000 00000', email: 'billing@customer.example' },
        taxInfo: { gstin: '27AAAAA0000A1Z5' },
        bankDetails: {
          bankName: 'Sample National Bank',
          branchName: 'Main Branch',
          accountNumber: '0123456789',
          ifscCode: 'SAMP0001234',
        },
      },
      lineItems: [
        { sno: 1, itemName: 'Demo Product A', hsn_code: '8471', quantity: 2, unitAmount: 150, netAmount: 300 },
        { sno: 2, itemName: 'Demo Service B', hsn_code: '9983', quantity: 1, unitAmount: 50, netAmount: 50 },
      ],
      totals: {
        subtotal: 350,
        totalTaxAmount: 63,
        totalDiscountAmount: 0,
        grandTotal: 413,
        amountInWords: 'Four hundred thirteen only',
      },
      footer: {
        terms:
          'Payment is due within 30 days of invoice date. Goods once sold will not be taken back. All disputes are subject to local jurisdiction.',
      },
    };
  }

  async loadImageAsset(pathOrUrl) {
    if (!pathOrUrl) return null;
    const raw = String(pathOrUrl).trim();
    if (!raw) return null;

    if (!raw.startsWith('http')) {
      try {
        const baseDir = path.join(__dirname, '../..');
        const rel = raw.replace(/^\/+/, '');
        const candidates = [
          resolveUploadAbsolutePath(baseDir, rel),
          path.join(baseDir, 'uploads', rel.replace(/^uploads[\\/]/, '')),
          path.join(baseDir, rel),
        ];
        for (const fp of candidates) {
          if (fp && fs.existsSync(fp)) {
            return fs.readFileSync(fp);
          }
        }
      } catch (err) {
        logger.warn('Could not read image from disk:', raw, err.message);
      }
    }

    try {
      const fullUrl = raw.startsWith('http') ? raw : `${resolvePublicBaseUrl()}${raw.startsWith('/') ? '' : '/'}${raw}`;
      const response = await axios.get(fullUrl, { responseType: 'arraybuffer', timeout: 10000 });
      return Buffer.from(response.data);
    } catch (err) {
      logger.warn('Could not download image:', raw, err.message);
      return null;
    }
  }

  _resolveCompanyStrings(standardInvoice, companySettings) {
    const city = companySettings?.city || standardInvoice.header?.address?.city || '';
    const state = companySettings?.state || standardInvoice.header?.address?.state || '';
    const postal = companySettings?.postal_code || standardInvoice.header?.address?.postalCode || '';
    const cityLine = [city, state, postal].filter(Boolean).join(', ');
    return {
      companyName: companySettings?.company_name || standardInvoice.header?.companyName || 'Company Name',
      address: companySettings?.address || standardInvoice.header?.address?.line1 || '',
      cityLine,
      phone: companySettings?.phone || standardInvoice.header?.contact?.phone || '',
      email: companySettings?.email || standardInvoice.header?.contact?.email || '',
      taxId: companySettings?.tax_id || standardInvoice.header?.taxInfo?.taxId || '',
    };
  }

  _tailSection(doc, y, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber, tailOpts = {}) {
    let yn = drawTotalsBlock(doc, y, standardInvoice, tailOpts);
    doc.fontSize(9).font('Helvetica').text(`Page ${pageNumber}`, 500, 780);
    yn = drawPartyBankBox(doc, yn, standardInvoice);
    drawStampSignature(doc, yn + 20, companySettings, stampBuffer, signatureBuffer);
  }

  _renderClassic(doc, ctx) {
    const { standardInvoice, companySettings, logoBuffer, stampBuffer, signatureBuffer } = ctx;
    const cs = this._resolveCompanyStrings(standardInvoice, companySettings);
    const isSales = this._isSalesInvoice(standardInvoice);

    let y = isSales
      ? this._drawClassicCompanyHeader(doc, logoBuffer, cs)
      : this._drawClassicCompanyHeaderLegacy(doc, logoBuffer, cs);

    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 15;

    if (!isSales) {
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('PURCHASE INVOICE', 50, y);
      y += 28;
    }

    y = this._drawPartyBillShipBlock(doc, y, standardInvoice) + 12;

    const { y: y2, pageNumber } = drawInvoiceLineItems(doc, y, standardInvoice, {
      variant: isSales ? 'classic-sales' : 'classic',
      invoiceNumber: standardInvoice.details?.invoiceNumber || 'N/A',
    });
    this._tailSection(doc, y2, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber, {
      classicSalesTable: isSales,
    });
  }

  /** Purchase / legacy classic header (company block beside logo). */
  _drawClassicCompanyHeaderLegacy(doc, logoBuffer, cs) {
    const header = drawCompanyLogoTopLeft(doc, logoBuffer);
    let ty = header.topY;
    const tx = header.contentX;

    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text(cs.companyName, tx, ty, { width: 300 });
    ty += 20;
    doc.fontSize(9).font('Helvetica');
    if (cs.address) {
      doc.text(cs.address, tx, ty, { width: 300 });
      ty += 12;
    }
    if (cs.cityLine) {
      doc.text(cs.cityLine, tx, ty, { width: 300 });
      ty += 12;
    }
    if (cs.phone) {
      doc.text(`Phone: ${cs.phone}`, tx, ty, { width: 300 });
      ty += 12;
    }
    if (cs.email) {
      doc.text(`Email: ${cs.email}`, tx, ty, { width: 300 });
      ty += 12;
    }
    if (cs.taxId) {
      doc.fontSize(8).text(`Tax ID: ${cs.taxId}`, tx, ty, { width: 300 });
      ty += 12;
    }
    return Math.max(ty, header.bottomY) + 14;
  }

  _renderMinimal(doc, ctx) {
    const { standardInvoice, companySettings, logoBuffer, stampBuffer, signatureBuffer } = ctx;
    const cs = this._resolveCompanyStrings(standardInvoice, companySettings);
    const header = drawCompanyLogoTopLeft(doc, logoBuffer);
    const textLeft = header.contentX;
    let y = header.topY;

    doc.fontSize(17).font('Helvetica-Bold').text(cs.companyName, textLeft, y, { width: 400 });
    y += 22;
    doc.fontSize(9).font('Helvetica').text(cs.address, textLeft, y, { width: 400 });
    y += 12;
    const contactLine = [cs.cityLine, cs.phone, cs.email].filter(Boolean).join('  |  ');
    if (contactLine) {
      doc.text(contactLine, textLeft, y, { width: 400 });
      y += 12;
    }
    if (cs.taxId) {
      doc.fontSize(8).text(`Tax ID: ${cs.taxId}`, textLeft, y);
      y += 12;
    }

    y = Math.max(y + 14, header.bottomY + 14);
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#cccccc').lineWidth(0.8).stroke();
    y += 18;

    const invoiceType = this._isSalesInvoice(standardInvoice) ? 'Sales invoice' : 'Purchase invoice';
    doc.fontSize(15).font('Helvetica-Bold').fillColor('#333').text(invoiceType, 50, y);
    y += 24;

    y = this._drawPartyBillShipBlock(doc, y, standardInvoice) + 10;

    const { y: y2, pageNumber } = drawInvoiceLineItems(doc, y, standardInvoice, {
      variant: 'minimal',
      invoiceNumber: standardInvoice.details?.invoiceNumber || 'N/A',
    });
    this._tailSection(doc, y2, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber);
  }

  _renderBranded(doc, ctx) {
    const { standardInvoice, companySettings, logoBuffer, signatureBuffer } = ctx;
    const cs = this._resolveCompanyStrings(standardInvoice, companySettings);
    const left = 50;
    const header = drawCompanyLogoTopLeft(doc, logoBuffer);
    const bannerBottom = drawParallelogramCompanyBanner(doc, 318, header.topY - 2, cs);

    const partyStartY = Math.max(header.bottomY + 10, bannerBottom + 8);
    const party = standardInvoice.partyDetails || { name: 'N/A' };
    const isSales = this._isSalesInvoice(standardInvoice);
    let partyY;

    const layout = getSalesPartyColumnLayout();

    if (isSales) {
      ({ bottomY: partyY } = drawSalesBillShipColumns(doc, left, partyStartY, party, { showGst: true }));
    } else {
      partyY = drawBrandedPartyColumn(doc, left, partyStartY, 300, 'Bill to:', party, {
        addressKey: 'billing',
        showName: true,
        showContact: true,
        showGst: true,
      });
    }

    let metaY = partyStartY;
    const metaRow = (label, value, valueBold = false) => {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text(label, layout.metaX, metaY, {
        width: layout.metaWidth,
        align: 'right',
      });
      metaY += 13;
      doc
        .fontSize(valueBold ? 11 : 9)
        .font(valueBold ? 'Helvetica-Bold' : 'Helvetica')
        .text(value || '—', layout.metaX, metaY, { width: layout.metaWidth, align: 'right' });
      metaY += valueBold ? 20 : 16;
    };
    metaRow('Invoice#', standardInvoice.details?.invoiceNumber || 'N/A', true);
    metaRow('Date', formatInvoiceDate(standardInvoice.details?.invoiceDate));
    if (standardInvoice.details?.dueDate) {
      metaRow('Due Date', formatInvoiceDate(standardInvoice.details.dueDate));
    }
    metaRow('Currency', standardInvoice.details?.currency || 'USD');
    if (standardInvoice.details?.reference) {
      metaRow('Reference', standardInvoice.details.reference);
    }

    const tableStart = Math.max(partyY, metaY) + 16;
    const { y: afterTable, pageNumber } = drawBrandedLineItems(doc, tableStart, standardInvoice, {
      invoiceNumber: standardInvoice.details?.invoiceNumber || 'N/A',
    });

    let footerY = drawBrandedTotals(doc, afterTable, standardInvoice);
    if (footerY > 520) {
      doc.fontSize(8).fillColor('#888').text(`Page ${pageNumber}`, 500, 780);
      doc.addPage();
      footerY = 50;
      pageNumber += 1;
    } else {
      doc.fontSize(8).fillColor('#888').text(`Page ${pageNumber}`, 500, 780);
    }

    drawBrandedFooter(doc, footerY, standardInvoice, companySettings, signatureBuffer);
  }

  _renderModern(doc, ctx) {
    const { standardInvoice, companySettings, logoBuffer, stampBuffer, signatureBuffer } = ctx;
    const cs = this._resolveCompanyStrings(standardInvoice, companySettings);
    const invoiceType = this._isSalesInvoice(standardInvoice) ? 'SALES INVOICE' : 'PURCHASE INVOICE';

    doc.rect(0, 0, 596, 78).fill('#1e3a5f');
    doc.fillColor('#ffffff');
    if (logoBuffer) {
      doc.image(logoBuffer, 50, 12, { width: 76, height: 54 });
    }
    doc.fontSize(11).font('Helvetica-Bold').text(cs.companyName, logoBuffer ? 136 : 50, 18, { width: 300 });
    doc.fontSize(8).font('Helvetica').text(`${cs.phone}  ·  ${cs.email}`, logoBuffer ? 130 : 50, 44, { width: 320 });
    doc.fontSize(14).font('Helvetica-Bold').text(invoiceType, 350, 28, { width: 195, align: 'right' });
    doc.fillColor('#000000');

    let y = 88;
    if (this._isSalesInvoice(standardInvoice)) {
      y = this._drawPartyBillShipBlock(doc, y, standardInvoice) + 8;
    } else {
      doc.rect(48, y, 449, 72).stroke('#cbd5e1');
      doc.fontSize(9).font('Helvetica-Bold').text('Invoice #', 58, y + 12);
      doc.font('Helvetica').text(standardInvoice.details?.invoiceNumber || 'N/A', 130, y + 12);
      doc.font('Helvetica-Bold').text('Invoice date', 58, y + 32);
      doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.invoiceDate), 130, y + 32);
      doc.font('Helvetica-Bold').text('Due date', 58, y + 52);
      doc.font('Helvetica').text(formatShortDate(standardInvoice.details?.dueDate), 130, y + 52);
      doc.font('Helvetica-Bold').text('Currency', 300, y + 12);
      doc.font('Helvetica').text(standardInvoice.details?.currency || 'USD', 370, y + 12);
      doc.font('Helvetica-Bold').text('Bill to', 300, y + 32);
      doc.font('Helvetica').text(standardInvoice.partyDetails?.name || 'N/A', 300, y + 46, { width: 190 });
      y += 80;
    }
    const { y: y2, pageNumber } = drawInvoiceLineItems(doc, y, standardInvoice, {
      variant: 'modern',
      invoiceNumber: standardInvoice.details?.invoiceNumber || 'N/A',
    });
    this._tailSection(doc, y2, standardInvoice, companySettings, stampBuffer, signatureBuffer, pageNumber);
  }

  async generatePDFBuffer(standardInvoice, institutionId = null, options = {}) {
    let companySettings = null;
    if (institutionId) {
      try {
        companySettings = await this.loadCompanyProfileForPdf(institutionId);
        this._applyCompanyProfileToStandardInvoice(standardInvoice, companySettings);
      } catch (err) {
        logger.warn('Could not load company settings for PDF', { institutionId, error: err.message });
      }
    }

    if (this._isSalesInvoice(standardInvoice) && institutionId) {
      await this.enrichSalesPartyDetails(institutionId, standardInvoice, {
        customerId: standardInvoice.metadata?.customerId || standardInvoice.partyDetails?.id,
        customerName: standardInvoice.partyDetails?.name,
      });
      this._ensureSalesShippingAddress(standardInvoice.partyDetails);
    } else if (!this._isSalesInvoice(standardInvoice) && institutionId && standardInvoice.partyDetails?.id) {
      try {
        standardInvoice.partyDetails = await this._loadPartyDetailsForDocument(
          institutionId,
          {
            vendorId: standardInvoice.partyDetails.id,
            vendorName: standardInvoice.partyDetails?.name,
          },
          'purchase'
        );
      } catch (err) {
        logger.warn('Could not refresh vendor party for PI PDF', { error: err.message });
      }
    }

    const templateKey =
      options.template != null
        ? normalizeInvoicePdfTemplate(options.template)
        : normalizeInvoicePdfTemplate(companySettings?.invoice_pdf_template);

    const logoUrl = companySettings?.logo_path || standardInvoice.header?.branding?.logoUrl;
    const docType = normalizeDocType(
      options.docType || (this._isSalesInvoice(standardInvoice) ? 'si' : 'pi')
    );

    const logoBuffer = await this.loadImageAsset(logoUrl);
    const { stampBuffer, signatureBuffer } = await loadPdfFooterAssets(
      this,
      companySettings,
      docType
    );

    const ctx = {
      standardInvoice,
      companySettings,
      logoBuffer,
      stampBuffer,
      signatureBuffer,
    };

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 15, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        if (templateKey === 'branded') {
          this._renderBranded(doc, ctx);
        } else if (templateKey === 'minimal') {
          this._renderMinimal(doc, ctx);
        } else if (templateKey === 'modern') {
          this._renderModern(doc, ctx);
        } else {
          this._renderClassic(doc, ctx);
        }
        doc.end();
      } catch (error) {
        logger.error('PDF generation error:', error);
        reject(error);
      }
    });
  }

  generateFilename(invoiceNumber, type = 'purchase') {
    const prefix = type === 'purchase' ? 'PI' : 'SI';
    const timestamp = new Date().toISOString().split('T')[0];
    return prefix + '_' + invoiceNumber + '_' + timestamp + '.pdf';
  }

  async saveInvoicePDF(standardInvoice, invoiceNumber, type = 'purchase', institutionId = null) {
    try {
      const filename = this.generateFilename(invoiceNumber, type);
      const outputDir = path.join(__dirname, '../../temp/invoices');

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const buffer = await this.generatePDFBuffer(standardInvoice, institutionId);
      const outputPath = path.join(outputDir, filename);
      fs.writeFileSync(outputPath, buffer);

      return {
        filename,
        path: outputPath,
        url: '/temp/invoices/' + filename,
      };
    } catch (error) {
      logger.error('Error saving invoice PDF:', error);
      throw error;
    }
  }
}

module.exports = new InvoicePDFService();
