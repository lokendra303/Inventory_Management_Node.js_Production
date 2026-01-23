import axios from 'axios';

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
        return response.data;
      },
      (error) => {
        if (error.response?.status === 401) {
          sessionStorage.removeItem('token');
          window.location.href = '/login';
        } else if (error.response?.status === 403) {
          // Permission denied - let the component handle it
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