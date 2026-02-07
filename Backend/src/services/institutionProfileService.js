const db = require('../database/connection');
const logger = require('../utils/logger');

class InstitutionProfileService {
  // Update institution addresses
  async updateInstitutionAddresses(institutionId, addressData) {
    return await db.transaction(async (connection) => {
      // Delete existing addresses
      await connection.execute(
        'DELETE FROM addresses WHERE entity_type = ? AND entity_id = ?',
        ['institution', institutionId]
      );

      // Create billing address
      if (addressData.billingAttention || addressData.billingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['institution', institutionId, 'billing', addressData.billingAttention || null,
           addressData.billingCountry || null, addressData.billingAddress1 || null,
           addressData.billingAddress2 || null, addressData.billingCity || null,
           addressData.billingState || null, addressData.billingPinCode || null]
        );
      }

      // Create shipping address
      if (addressData.shippingAttention || addressData.shippingAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['institution', institutionId, 'shipping', addressData.shippingAttention || null,
           addressData.shippingCountry || null, addressData.shippingAddress1 || null,
           addressData.shippingAddress2 || null, addressData.shippingCity || null,
           addressData.shippingState || null, addressData.shippingPinCode || null]
        );
      }

      logger.info('Institution addresses updated', { institutionId });
      return true;
    });
  }

  // Update institution bank details
  async updateInstitutionBankDetails(institutionId, bankData) {
    return await db.transaction(async (connection) => {
      // Delete existing bank details
      await connection.execute(
        'DELETE FROM bank_details WHERE entity_type = ? AND entity_id = ?',
        ['institution', institutionId]
      );

      // Create bank details
      await connection.execute(
        `INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['institution', institutionId, bankData.bankName || null, bankData.accountHolderName || null,
         bankData.accountNumber || null, bankData.ifscCode || null, bankData.branchName || null,
         bankData.accountType || null, bankData.swiftCode || null, bankData.iban || null]
      );

      logger.info('Institution bank details updated', { institutionId });
      return true;
    });
  }

  // Get institution addresses
  async getInstitutionAddresses(institutionId) {
    const addresses = await db.query(
      'SELECT * FROM addresses WHERE entity_type = ? AND entity_id = ?',
      ['institution', institutionId]
    );

    const result = {};
    addresses.forEach(addr => {
      const prefix = addr.address_type;
      result[`${prefix}_attention`] = addr.attention;
      result[`${prefix}_country`] = addr.country;
      result[`${prefix}_address1`] = addr.address1;
      result[`${prefix}_address2`] = addr.address2;
      result[`${prefix}_city`] = addr.city;
      result[`${prefix}_state`] = addr.state;
      result[`${prefix}_pin_code`] = addr.pin_code;
    });

    return result;
  }

  // Get institution bank details
  async getInstitutionBankDetails(institutionId) {
    const bankDetails = await db.query(
      'SELECT * FROM bank_details WHERE entity_type = ? AND entity_id = ?',
      ['institution', institutionId]
    );

    return bankDetails[0] || null;
  }
}

module.exports = new InstitutionProfileService();
