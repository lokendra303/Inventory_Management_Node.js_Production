import axios from 'axios';
import { Modal } from 'antd';

// Simple rate limiter to prevent 429 errors
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
    this.queue = [];
    this.processing = false;
  }

  async waitForSlot() {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      this.requests = this.requests.filter(time => now - time < this.windowMs);
      
      if (this.requests.length < this.maxRequests) {
        this.requests.push(now);
        const resolve = this.queue.shift();
        resolve();
      } else {
        const oldestRequest = Math.min(...this.requests);
        const waitTime = this.windowMs - (now - oldestRequest) + 50;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    this.processing = false;
  }
}

class ApiService {
  constructor() {
    this.rateLimiter = new RateLimiter(10, 1000); // 10 requests per second
    this.retryCount = new Map(); // Track retry attempts per request
    
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor with rate limiting
    this.api.interceptors.request.use(
      async (config) => {
        // Apply rate limiting
        await this.rateLimiter.waitForSlot();
        
        const token = sessionStorage.getItem('token');
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          
          // Try to extract institution ID from token or get from storage
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.institutionId) {
              config.headers['x-institution-id'] = payload.institutionId;
            }
          } catch (error) {
            // If token parsing fails, try to get from sessionStorage
            const institutionId = sessionStorage.getItem('institutionId');
            if (institutionId) {
              config.headers['x-institution-id'] = institutionId;
            }
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => {
        // For blob responses (like PDF downloads), return the full response
        if (response.config.responseType === 'blob') {
          return response;
        }
        return response.data;
      },
      async (error) => {
        if (error.response?.status === 401) {
          // Only show session expired modal if user was logged in (has token)
          // Don't show for login/profile endpoint failures
          const isAuthEndpoint = error.config?.url?.includes('/auth/login') || 
                                 error.config?.url?.includes('/auth/profile');
          const hadToken = sessionStorage.getItem('token');
          
          if (!isAuthEndpoint && hadToken) {
            // Handle session expiration for authenticated users
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('lastActivity');
            sessionStorage.removeItem('institutionId');
            
            Modal.warning({
              title: 'Session Expired',
              content: 'Your session has expired. Please login again.',
              onOk: () => {
                window.location.href = '/';
              },
              centered: true
            });
          }
          
          return Promise.reject(error);
        } else if (error.response?.status === 429) {
          // Handle rate limiting with exponential backoff and max retries
          const requestKey = `${error.config.method}-${error.config.url}`;
          const currentRetries = this.retryCount.get(requestKey) || 0;
          
          if (currentRetries >= 3) {
            // Max retries reached, clear and reject
            this.retryCount.delete(requestKey);
            console.error('Max retries reached for rate limited request');
            return Promise.reject(new Error('Too many requests. Please try again later.'));
          }
          
          this.retryCount.set(requestKey, currentRetries + 1);
          const retryAfter = error.response.headers['retry-after'] || 1;
          const delay = parseInt(retryAfter) * 1000 * (currentRetries + 1); // Exponential backoff
          
          console.warn(`Rate limited. Retry ${currentRetries + 1}/3 after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Retry the request
          const result = await this.api.request(error.config);
          this.retryCount.delete(requestKey); // Clear on success
          return result;
        } else if (error.response?.status === 403) {
          return Promise.reject({
            ...error,
            isPermissionError: true,
            message: error.response?.data?.error || 'Access denied'
          });
        }
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token) {
    if (token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
  }

  get baseURL() {
    return this.api.defaults.baseURL;
  }

  async get(url, config = {}) {
    return this.api.get(url, config);
  }

  async post(url, data = {}, config = {}) {
    return this.api.post(url, data, config);
  }

  async put(url, data = {}, config = {}) {
    return this.api.put(url, data, config);
  }

  async patch(url, data = {}, config = {}) {
    return this.api.patch(url, data, config);
  }

  async delete(url, config = {}) {
    return this.api.delete(url, config);
  }

  // Inventory API methods
  async getInventory(params = {}) {
    return this.get('/inventory', { params });
  }

  async getWarehouseStock(warehouseId, params = {}) {
    return this.get(`/inventory/warehouse/${warehouseId}`, { params });
  }

  async getCurrentStock(itemId, warehouseId) {
    return this.get(`/inventory/current/${itemId}/${warehouseId}`);
  }

  async receiveStock(data) {
    return this.post('/inventory/receive', data);
  }

  async reserveStock(data) {
    return this.post('/inventory/reserve', data);
  }

  async shipStock(data) {
    return this.post('/inventory/ship', data);
  }

  async adjustStock(data) {
    return this.post('/inventory/adjust', data);
  }

  async transferStock(data) {
    return this.post('/inventory/transfer', data);
  }

  async getLowStockItems(threshold = 10) {
    return this.get('/inventory/low-stock', { params: { threshold } });
  }

  // Items API methods
  async getItems(params = {}) {
    return this.get('/items', { params });
  }

  async getItem(itemId) {
    return this.get(`/items/${itemId}`);
  }

  async createItem(data) {
    return this.post('/items', data);
  }

  async updateItem(itemId, data) {
    return this.put(`/items/${itemId}`, data);
  }

  async deleteItem(itemId) {
    return this.delete(`/items/${itemId}`);
  }

  // Warehouses API methods
  async getWarehouses(params = {}) {
    return this.get('/warehouses', { params });
  }

  async getWarehouse(warehouseId) {
    return this.get(`/warehouses/${warehouseId}`);
  }

  async createWarehouse(data) {
    return this.post('/warehouses', data);
  }

  async updateWarehouse(warehouseId, data) {
    return this.put(`/warehouses/${warehouseId}`, data);
  }

  async deleteWarehouse(warehouseId) {
    return this.delete(`/warehouses/${warehouseId}`);
  }

  // Purchase Orders API methods
  async getPurchaseOrders(params = {}) {
    return this.get('/purchase-orders', { params });
  }

  async getPurchaseOrder(poId) {
    return this.get(`/purchase-orders/${poId}`);
  }

  async createPurchaseOrder(data) {
    return this.post('/purchase-orders', data);
  }

  async updatePurchaseOrder(poId, data) {
    return this.put(`/purchase-orders/${poId}`, data);
  }

  // Sales Orders API methods
  async getSalesOrders(params = {}) {
    return this.get('/sales-orders', { params });
  }

  async getSalesOrder(soId) {
    return this.get(`/sales-orders/${soId}`);
  }

  async createSalesOrder(data) {
    return this.post('/sales-orders', data);
  }

  async updateSalesOrder(soId, data) {
    return this.put(`/sales-orders/${soId}`, data);
  }

  // Dashboard API methods
  async getDashboardStats() {
    return this.get('/dashboard/stats');
  }

  // Reports API methods
  async getInventoryReport(params = {}) {
    return this.get('/reports/inventory', { params });
  }

  async getStockMovementReport(params = {}) {
    return this.get('/reports/stock-movement', { params });
  }

  async getStockAgingReport(params = {}) {
    return this.get('/reports/stock-aging', { params });
  }
}

export default new ApiService();