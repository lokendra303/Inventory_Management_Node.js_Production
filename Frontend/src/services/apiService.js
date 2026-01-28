import axios from 'axios';
import { Modal } from 'antd';

class ApiService {
  constructor() {
    this.api = axios.create({
      baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        const token = sessionStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
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
        // Update last activity on successful API calls
        sessionStorage.setItem('lastActivity', Date.now().toString());
        return response.data;
      },
      async (error) => {
        if (error.response?.status === 401) {
          const errorData = error.response?.data;
          
          // Check if it's a session expired error
          if (errorData?.code === 'SESSION_EXPIRED' || errorData?.error?.includes('expired')) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('lastActivity');
            
            // Show session expired popup
            const { Modal } = await import('antd');
            Modal.warning({
              title: 'Session Expired',
              content: 'Your session has expired. Please login again.',
              okText: 'Login',
              onOk: () => {
                window.location.href = '/';
              },
              centered: true,
              maskClosable: false,
            });
            
            return Promise.reject(error);
          }
          
          // Try to refresh token for other 401 errors
          const token = sessionStorage.getItem('token');
          if (token && !error.config._retry) {
            error.config._retry = true;
            try {
              const refreshResponse = await axios.post(
                `${this.api.defaults.baseURL}/auth/refresh`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
              );
              
              if (refreshResponse.data.success) {
                const newToken = refreshResponse.data.data.token;
                sessionStorage.setItem('token', newToken);
                sessionStorage.setItem('lastActivity', Date.now().toString());
                this.setAuthToken(newToken);
                error.config.headers.Authorization = `Bearer ${newToken}`;
                return this.api.request(error.config);
              }
            } catch (refreshError) {
              // Refresh failed, redirect to login
              sessionStorage.removeItem('token');
              sessionStorage.removeItem('lastActivity');
              window.location.href = '/';
              return Promise.reject(refreshError);
            }
          } else {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('lastActivity');
            window.location.href = '/';
          }
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