import apiClient from './apiClient';

export function apiError(err, fallback = 'Request failed') {
  return err?.response?.data?.error || err?.message || fallback;
}

// Purchase orders
export async function getPurchaseOrders(params) {
  return apiClient.get('/purchase-orders', { params });
}

export async function getPurchaseOrder(poId) {
  return apiClient.get(`/purchase-orders/${poId}`);
}

export async function confirmPurchaseOrder(poId) {
  return apiClient.post(`/purchase-orders/${poId}/confirm`);
}

// Sales orders
export async function getSalesOrders(params) {
  return apiClient.get('/sales-orders', { params });
}

export async function getSalesOrder(soId) {
  return apiClient.get(`/sales-orders/${soId}`);
}

export async function confirmSalesOrder(soId) {
  return apiClient.post(`/sales-orders/${soId}/confirm`, {});
}

export async function shipSalesOrder(soId, data) {
  return apiClient.post(`/sales-orders/${soId}/ship`, data);
}

// Parties
export async function getCustomers(params) {
  return apiClient.get('/customers', { params });
}

export async function getCustomer(customerId) {
  return apiClient.get(`/customers/${customerId}`);
}

export async function getVendors(params) {
  return apiClient.get('/vendors', { params });
}

export async function getVendor(vendorId) {
  return apiClient.get(`/vendors/${vendorId}`);
}

// Delivery challans
export async function getDeliveryChallans(params) {
  return apiClient.get('/delivery-challans', { params });
}

export async function updateChallanStatus(challanId, status) {
  return apiClient.put(`/delivery-challans/${challanId}/status`, { status });
}

// Inventory ops
export async function getAdjustments(params) {
  return apiClient.get('/inventory/adjustments', { params });
}

export async function adjustStock(data) {
  return apiClient.post('/inventory/adjust', data);
}

export async function getItemStock(itemId, warehouseId) {
  return apiClient.get(`/inventory/${itemId}/${warehouseId}`);
}

export async function getTransfers(params) {
  return apiClient.get('/inventory/transfers', { params });
}

export async function transferStock(data) {
  return apiClient.post('/inventory/transfer', data);
}

export async function getTransferApprovals(params) {
  return apiClient.get('/transfer-approvals', { params });
}

export async function requestTransferApproval(data) {
  return apiClient.post('/transfer-approvals', data);
}

export async function approveTransfer(requestId) {
  return apiClient.post(`/transfer-approvals/${requestId}/approve`);
}

export async function rejectTransfer(requestId, rejectionReason) {
  return apiClient.post(`/transfer-approvals/${requestId}/reject`, { rejectionReason });
}

// Item groups
export async function getItemGroups(params) {
  return apiClient.get('/item-groups', { params });
}

// Lookups (reuse warehouse service patterns)
export async function getItems(params) {
  return apiClient.get('/items', { params });
}

export async function getWarehouses(params) {
  return apiClient.get('/warehouses', { params });
}
