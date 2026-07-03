import apiClient from './apiClient';

export { apiError } from './operationsService';

export async function getInvoiceDashboardSummary() {
  return apiClient.get('/invoices/dashboard/summary');
}

export async function getOutstandingInvoices() {
  return apiClient.get('/invoices/dashboard/outstanding');
}

export async function getAccountingSummary() {
  return apiClient.get('/accounting/summary');
}

export async function getTrialBalance(params) {
  return apiClient.get('/accounting/trial-balance', { params });
}

export async function getJournalEntries(params) {
  return apiClient.get('/accounting/journal-entries', { params });
}

export async function getProfitLoss(params) {
  return apiClient.get('/profit-loss', { params });
}

export async function getReportDashboard() {
  return apiClient.get('/reports/dashboard');
}

export async function getReportInventory() {
  return apiClient.get('/reports/inventory');
}

export async function getReportSales() {
  return apiClient.get('/reports/sales');
}

export async function getReportPurchases() {
  return apiClient.get('/reports/purchases');
}

export async function getCompanySettings() {
  return apiClient.get('/company-settings');
}

export async function getSubscription() {
  return apiClient.get('/subscription');
}

export async function getDocumentFolders() {
  return apiClient.get('/documents/folders');
}

export async function getAuditTrail(params) {
  return apiClient.get('/audit/trail', { params });
}

export async function getWarehouseBins(params) {
  return apiClient.get('/warehouse-locations/bins', { params });
}
