const logger = require('../utils/logger');

class TestController {
  async testEndpoint(req, res) {
    try {
      console.log('=== TEST ENDPOINT ===');
      console.log('req.institutionId:', req.institutionId);
      console.log('req.user:', req.user);
      console.log('Headers:', req.headers);
      
      res.json({
        success: true,
        message: 'Test endpoint working',
        data: {
          institutionId: req.institutionId,
          userId: req.user?.userId,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Test endpoint error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new TestController();