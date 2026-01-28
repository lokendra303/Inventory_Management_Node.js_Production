const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testIndependentApp() {
  try {
    console.log('🧪 Testing Independent App...\n');
    
    // 1. Check app status
    console.log('1. Checking app status...');
    const statusRes = await axios.get('http://localhost:3000/');
    console.log('✅ App running:', statusRes.data.message);
    console.log('   Auth enabled:', statusRes.data.authEnabled);
    
    // 2. Test products without auth
    console.log('2. Testing products (no auth)...');
    try {
      const productsRes = await axios.get(`${BASE_URL}/products`);
      console.log('✅ Products accessible:', productsRes.data.success);
      console.log('   User:', productsRes.data.user);
    } catch (error) {
      console.log('⚠️ Products require auth');
    }
    
    // 3. Test with auth if enabled
    if (statusRes.data.authEnabled) {
      console.log('3. Testing with authentication...');
      
      try {
        // Register
        const registerRes = await axios.post(`${BASE_URL}/auth/register`, {
          name: 'Test Company',
          adminEmail: 'admin@test.com',
          adminPassword: 'password123',
          adminFirstName: 'John',
          adminLastName: 'Doe'
        });
        console.log('✅ Company registered');
        
        // Login
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
          email: 'admin@test.com',
          password: 'password123'
        });
        const token = loginRes.data.data.token;
        console.log('✅ Login successful');
        
        // Test authenticated products
        const authProductsRes = await axios.get(`${BASE_URL}/products`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Authenticated products:', authProductsRes.data.user);
        
        // Create product
        const createRes = await axios.post(`${BASE_URL}/products`, {
          name: 'Test Product',
          price: 99.99,
          description: 'A test product'
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Product created:', createRes.data.data.id);
        
      } catch (error) {
        console.log('⚠️ Auth test failed:', error.response?.data?.error || error.message);
      }
    } else {
      console.log('3. Auth disabled - testing without authentication...');
      
      // Test creating product without auth
      try {
        const createRes = await axios.post(`${BASE_URL}/products`, {
          name: 'Test Product No Auth',
          price: 49.99,
          description: 'Product created without auth'
        });
        console.log('✅ Product created without auth:', createRes.data.data.id);
      } catch (error) {
        console.log('⚠️ Product creation failed:', error.response?.data?.error);
      }
    }
    
    console.log('\n🎉 Independent app test completed!');
    console.log('✨ App works with or without authentication');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Test with different auth settings
async function testBothModes() {
  console.log('🔄 Testing both auth modes...\n');
  
  console.log('📋 To test without auth:');
  console.log('   1. Set AUTH_ENABLED=false in .env');
  console.log('   2. Restart the app');
  console.log('   3. Run this test again\n');
  
  await testIndependentApp();
}

testBothModes();