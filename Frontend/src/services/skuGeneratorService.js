import apiService from './apiService';

/**
 * SKU auto-generator client. Thin wrapper around /api/sku-rules.
 *
 * Pair:
 *   - previewSku()   non-destructive; fine to call while the user is typing.
 *   - generateSku()  advances the counter; call on explicit user action
 *                    (e.g. the "Generate" button) so we don't waste SKUs.
 */
class SkuGeneratorService {
  async listRules() {
    const res = await apiService.get('/sku-rules');
    return res?.data || [];
  }

  async getRule(id) {
    const res = await apiService.get(`/sku-rules/${id}`);
    return res?.data || null;
  }

  async createRule(payload) {
    const res = await apiService.post('/sku-rules', payload);
    return res?.data?.id;
  }

  async updateRule(id, payload) {
    const res = await apiService.put(`/sku-rules/${id}`, payload);
    return res?.data?.id;
  }

  async deleteRule(id) {
    return apiService.delete(`/sku-rules/${id}`);
  }

  async previewSku(ctx = {}) {
    const res = await apiService.get('/sku-rules/preview', { params: ctx });
    return res?.data || { rule: null, preview: '' };
  }

  async generateSku(ctx = {}) {
    const res = await apiService.post('/sku-rules/generate', ctx);
    return res?.data || {};
  }
}

export default new SkuGeneratorService();
