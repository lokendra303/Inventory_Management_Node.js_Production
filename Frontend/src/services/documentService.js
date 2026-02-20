import apiService from './apiService';

export const documentService = {
  createFolder: async (name, parentFolderId = null) => {
    return apiService.post('/documents/folders', { name, parentFolderId });
  },

  getFolders: async () => {
    return apiService.get('/documents/folders');
  },

  uploadDocument: async (file, folderId = null, associatedEntity = null, associatedEntityId = null) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);
    if (associatedEntity) formData.append('associatedEntity', associatedEntity);
    if (associatedEntityId) formData.append('associatedEntityId', associatedEntityId);

    return apiService.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  getDocuments: async (folderId = null, view = 'all') => {
    const params = {};
    if (folderId) params.folderId = folderId;
    if (view) params.view = view;
    return apiService.get('/documents', { params });
  },

  deleteDocument: async (documentId) => {
    return apiService.delete(`/documents/${documentId}`);
  },

  deleteFolder: async (folderId) => {
    return apiService.delete(`/documents/folders/${folderId}`);
  },

  toggleFolderStatus: async (folderId) => {
    return apiService.put(`/documents/folders/${folderId}/toggle`);
  }
};
