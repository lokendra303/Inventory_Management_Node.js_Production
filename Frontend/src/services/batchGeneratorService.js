import apiService from './apiService';

const batchGeneratorService = {
  async listRules(context = 'kit_assembly') {
    const res = await apiService.get('/batch-rules', { params: { context } });
    return res?.data || [];
  },

  async previewBatch(ctx) {
    const res = await apiService.get('/batch-rules/preview', { params: ctx });
    return res?.data || { preview: '', rule: null };
  },

  async generateBatch(ctx) {
    const res = await apiService.post('/batch-rules/generate', ctx);
    return res?.data || {};
  },

  async createRule(payload) {
    const res = await apiService.post('/batch-rules', payload);
    return res?.data;
  },

  async updateRule(id, payload) {
    const res = await apiService.put(`/batch-rules/${id}`, payload);
    return res?.data;
  },

  async deleteRule(id) {
    return apiService.delete(`/batch-rules/${id}`);
  },
};

export default batchGeneratorService;
