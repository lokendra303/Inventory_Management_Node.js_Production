import apiClient from './apiClient';

export async function listRules() {
  const res = await apiClient.get('/sku-rules');
  return res?.data || [];
}
export async function createRule(payload) {
  const res = await apiClient.post('/sku-rules', payload);
  return res?.data;
}
export async function updateRule(id, payload) {
  const res = await apiClient.put(`/sku-rules/${id}`, payload);
  return res?.data;
}
export async function previewSku(ctx = {}) {
  const res = await apiClient.get('/sku-rules/preview', { params: ctx });
  return res?.data || { preview: '' };
}
export async function generateSku(ctx = {}) {
  const res = await apiClient.post('/sku-rules/generate', ctx);
  return res?.data || {};
}
