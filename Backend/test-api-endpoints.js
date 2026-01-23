const axios = require('axios');

const API_BASE = 'http://localhost:5000';

async function testAPIEndpoints() {
  try {
    console.log('🔄 Testing API endpoints...');
    
    // Test health endpoint
    try {
      const health = await axios.get(`${API_BASE}/health`);
      console.log('✅ Health check:', health.data.status);
    } catch (error) {
      console.log('❌ Health check failed:', error.message);
      return;
    }
    
    // Test warehouse-types endpoint (should return 401 without auth)
    try {
      await axios.get(`${API_BASE}/api/warehouse-types`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Warehouse-types endpoint exists (requires auth)');
      } else {
        console.log('❌ Warehouse-types endpoint error:', error.response?.status || error.message);
      }
    }
    
    // Test warehouses endpoint (should return 401 without auth)
    try {
      await axios.get(`${API_BASE}/api/warehouses`);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Warehouses endpoint exists (requires auth)');
      } else {
        console.log('❌ Warehouses endpoint error:', error.response?.status || error.message);
      }
    }
    
    console.log('✅ API endpoints test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPIEndpoints();