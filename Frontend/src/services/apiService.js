import axios from 'axios';
import { Modal } from 'antd';
import { getApiBaseUrl } from '../config/appConfig';

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
      baseURL: getApiBaseUrl(),
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

        // Multipart uploads: default axios JSON Content-Type breaks multer (no file parsed).
        if (config.data instanceof FormData) {
          delete config.headers['Content-Type'];
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
          // Check if it's a session timeout error
          const isSessionTimeout = error.response?.data?.code === 'SESSION_TIMEOUT';
          
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
              content: isSessionTimeout 
                ? 'Your session has expired due to inactivity. Please login again.'
                : 'Your session has expired. Please login again.',
              onOk: () => {
                window.location.href = '/';
              },
              centered: true,
              maskClosable: false
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

  // Batch & Serial Tracking
  async getBatches(params = {}) { return this.get('/batch-serial/batches', { params }); }
  async createBatch(data) { return this.post('/batch-serial/batches', data); }
  async consumeBatch(batchId, quantity) { return this.post(`/batch-serial/batches/${batchId}/consume`, { quantity }); }
  async updateBatchStatus(batchId, status) { return this.put(`/batch-serial/batches/${batchId}/status`, { status }); }

  async getSerials(params = {}) { return this.get('/batch-serial/serials', { params }); }
  async createSerials(data) { return this.post('/batch-serial/serials', data); }
  async updateSerialStatus(serialId, status, soId) { return this.put(`/batch-serial/serials/${serialId}/status`, { status, soId }); }

  // Expiry Alerts
  async getExpiryAlerts(params = {}) { return this.get('/batch-serial/expiry-alerts', { params }); }
  async acknowledgeExpiryAlert(alertId) { return this.put(`/batch-serial/expiry-alerts/${alertId}/acknowledge`); }
  async refreshExpiryAlerts() { return this.post('/batch-serial/expiry-alerts/refresh'); }

  // Stock Count
  async getStockCounts(params = {}) { return this.get('/stock-counts', { params }); }
  async createStockCount(data) { return this.post('/stock-counts', data); }
  async getStockCount(countId) { return this.get(`/stock-counts/${countId}`); }
  async submitStockCount(countId, lines) { return this.post(`/stock-counts/${countId}/submit`, { lines }); }
  async approveStockCount(countId) { return this.post(`/stock-counts/${countId}/approve`); }
  async cancelStockCount(countId) { return this.post(`/stock-counts/${countId}/cancel`); }
  async getInventoryAgingReport(params = {}) { return this.get('/stock-counts/aging', { params }); }

  // Purchase Returns
  async getPurchaseReturns(params = {}) { return this.get('/purchase-returns', { params }); }
  async createPurchaseReturn(data) { return this.post('/purchase-returns', data); }
  async getPurchaseReturn(returnId) { return this.get(`/purchase-returns/${returnId}`); }
  async confirmPurchaseReturn(returnId) { return this.post(`/purchase-returns/${returnId}/confirm`); }
  async cancelPurchaseReturn(returnId) { return this.post(`/purchase-returns/${returnId}/cancel`); }

  // Auto-PO Generation
  async previewAutoPOs(warehouseId) { return this.get('/purchase-returns/auto-po/preview', { params: { warehouseId } }); }
  async generateAutoPOs(warehouseId) { return this.post('/purchase-returns/auto-po/generate', { warehouseId }); }

  // Delivery Challans
  async getDeliveryChallans(params = {}) { return this.get('/delivery-challans', { params }); }
  async createDeliveryChallan(data) { return this.post('/delivery-challans', data); }
  async getDeliveryChallan(challanId) { return this.get(`/delivery-challans/${challanId}`); }
  async updateChallanStatus(challanId, status) { return this.put(`/delivery-challans/${challanId}/status`, { status }); }
  async convertChallanToInvoice(challanId) { return this.post(`/delivery-challans/${challanId}/convert-to-invoice`); }

  // Transfer Approvals
  async requestTransfer(data) { return this.post('/transfer-approvals', data); }
  async getTransferRequests(params = {}) { return this.get('/transfer-approvals', { params }); }
  async approveTransfer(requestId) { return this.post(`/transfer-approvals/${requestId}/approve`); }
  async rejectTransfer(requestId, rejectionReason) { return this.post(`/transfer-approvals/${requestId}/reject`, { rejectionReason }); }
  async cancelTransferRequest(requestId) { return this.post(`/transfer-approvals/${requestId}/cancel`); }

  // Analytics
  async getABCAnalysis(params = {}) { return this.get('/analytics/abc-analysis', { params }); }
  async getSlowMovingStock(days = 90) { return this.get('/analytics/slow-moving', { params: { days } }); }
  async getDeadStock() { return this.get('/analytics/dead-stock'); }
  async getDemandForecast(itemId, warehouseId) { return this.get(`/analytics/demand-forecast/${itemId}/${warehouseId}`); }
  async getAnalyticsProfitLoss(startDate, endDate) { return this.get('/analytics/profit-loss', { params: { startDate, endDate } }); }
  async getValuationReport(warehouseId) { return this.get('/analytics/valuation', { params: { warehouseId } }); }

  // Notifications
  async getNotifications(params = {}) { return this.get('/notifications', { params }); }
  async getUnreadNotificationCount() { return this.get('/notifications/unread-count'); }
  async markNotificationRead(notificationId) { return this.put(`/notifications/${notificationId}/read`); }
  async markAllNotificationsRead() { return this.put('/notifications/mark-all-read'); }

  // Audit
  async getAuditTrail(params = {}) { return this.get('/audit/trail', { params }); }
  async getAuditSummary() { return this.get('/audit/summary'); }
  async getEntityAuditLog(entityType, entityId, limit = 50) { return this.get(`/audit/${entityType}/${entityId}`, { params: { limit } }); }
}

const apiService = new ApiService();
export default apiService;