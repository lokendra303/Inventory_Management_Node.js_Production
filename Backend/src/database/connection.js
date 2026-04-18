const mysql = require('mysql2/promise');
const config = require('../config');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = mysql.createPool({
        ...config.database,
        waitForConnections: true,
        connectionLimit: config.database.connectionLimit || 20,
        queueLimit: 0,
        charset: 'utf8mb4_unicode_ci',
        timezone: '+00:00',
      });
      
      // Test connection
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async getConnection() {
    // charset is set at pool level — no need for SET NAMES on every connection
    return this.pool.getConnection();
  }

  async query(sql, params = []) {
    try {
      const connection = await this.getConnection();
      try {
        const [rows] = await connection.execute(sql, params);
        return rows;
      } finally {
        connection.release();
      }
    } catch (error) {
      // Suppress expected DDL errors: 1060 = duplicate column, 1061 = duplicate key name
      if (error.errno !== 1060 && error.errno !== 1061) {
        logger.error('Database query error:', { sql, params, error: error.message });
      }
      throw error;
    }
  }

  async transaction(callback) {
    const connection = await this.getConnection();
    await connection.beginTransaction();
    
    try {
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      logger.info('Database connection closed');
    }
  }
}

module.exports = new Database();