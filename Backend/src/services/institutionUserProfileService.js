const db = require('../database/connection');
const logger = require('../utils/logger');

class InstitutionUserProfileService {
  // Update user addresses
  async updateUserAddresses(userId, addressData) {
    return await db.transaction(async (connection) => {
      // Delete existing addresses
      await connection.execute(
        'DELETE FROM addresses WHERE entity_type = ? AND entity_id = ?',
        ['institution_user', userId]
      );

      // Create home address
      if (addressData.homeAttention || addressData.homeAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['institution_user', userId, 'home', addressData.homeAttention || null,
           addressData.homeCountry || null, addressData.homeAddress1 || null,
           addressData.homeAddress2 || null, addressData.homeCity || null,
           addressData.homeState || null, addressData.homePinCode || null]
        );
      }

      // Create work address
      if (addressData.workAttention || addressData.workAddress1) {
        await connection.execute(
          `INSERT INTO addresses (entity_type, entity_id, address_type, attention, country, address1, address2, city, state, pin_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ['institution_user', userId, 'work', addressData.workAttention || null,
           addressData.workCountry || null, addressData.workAddress1 || null,
           addressData.workAddress2 || null, addressData.workCity || null,
           addressData.workState || null, addressData.workPinCode || null]
        );
      }

      logger.info('User addresses updated', { userId });
      return true;
    });
  }

  // Update user bank details
  async updateUserBankDetails(userId, bankData) {
    return await db.transaction(async (connection) => {
      // Delete existing bank details
      await connection.execute(
        'DELETE FROM bank_details WHERE entity_type = ? AND entity_id = ?',
        ['institution_user', userId]
      );

      // Create bank details
      await connection.execute(
        `INSERT INTO bank_details (entity_type, entity_id, bank_name, account_holder_name, account_number, ifsc_code, branch_name, account_type, swift_code, iban)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['institution_user', userId, bankData.bankName || null, bankData.accountHolderName || null,
         bankData.accountNumber || null, bankData.ifscCode || null, bankData.branchName || null,
         bankData.accountType || null, bankData.swiftCode || null, bankData.iban || null]
      );

      logger.info('User bank details updated', { userId });
      return true;
    });
  }

  // Get user addresses
  async getUserAddresses(userId) {
    const addresses = await db.query(
      'SELECT * FROM addresses WHERE entity_type = ? AND entity_id = ?',
      ['institution_user', userId]
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

  // Get user bank details
  async getUserBankDetails(userId) {
    const bankDetails = await db.query(
      'SELECT * FROM bank_details WHERE entity_type = ? AND entity_id = ?',
      ['institution_user', userId]
    );

    return bankDetails[0] || null;
  }
}

module.exports = new InstitutionUserProfileService();
