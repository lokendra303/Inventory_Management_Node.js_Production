import apiClient from './apiClient';

export function apiError(err, fallback = 'Request failed') {
  return err?.response?.data?.error || err?.message || fallback;
}

export async function getDashboardStats() {
  return apiClient.get('/inventory/dashboard-stats');
}

export async function getLowStock() {
  return apiClient.get('/inventory/low-stock');
}

export async function getPurchaseOrders(params) {
  return apiClient.get('/purchase-orders', { params });
}

export async function getPurchaseOrder(poId) {
  return apiClient.get(`/purchase-orders/${poId}`);
}

export async function getPendingReceipts(params) {
  return apiClient.get('/grn/pending-receipts', { params });
}

export async function createGrn(data) {
  return apiClient.post('/grn', data);
}

export async function getGrn(grnId) {
  return apiClient.get(`/grn/${grnId}`);
}

export async function getStockCounts(params) {
  return apiClient.get('/stock-counts', { params });
}

export async function createStockCount(data) {
  return apiClient.post('/stock-counts', data);
}

export async function getStockCount(countId) {
  return apiClient.get(`/stock-counts/${countId}`);
}

export async function submitStockCount(countId, lines) {
  return apiClient.post(`/stock-counts/${countId}/submit`, { lines });
}

export async function approveStockCount(countId) {
  return apiClient.post(`/stock-counts/${countId}/approve`);
}

export async function cancelStockCount(countId) {
  return apiClient.post(`/stock-counts/${countId}/cancel`);
}

export async function getPendingPutaways(params) {
  return apiClient.get('/putaways/pending', { params });
}

export async function getPutawayHistory(params) {
  return apiClient.get('/putaways/history', { params });
}

export async function completePutaway(data) {
  return apiClient.post('/putaways', data);
}

export async function getWarehouses(params) {
  return apiClient.get('/warehouses', { params });
}

export async function getWarehouseBins(params) {
  return apiClient.get('/warehouse-locations/bins', { params });
}

export async function getBatches(params) {
  return apiClient.get('/batch-serial/batches', { params });
}

export async function getSerials(params) {
  return apiClient.get('/batch-serial/serials', { params });
}

export async function getExpiryAlerts(params) {
  return apiClient.get('/batch-serial/expiry-alerts', { params });
}
