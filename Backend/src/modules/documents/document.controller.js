const documentService = require('./document.service');
const logger = require('../../utils/logger');

class DocumentController {
  async createFolder(req, res) {
    try {
      const { name, parentFolderId } = req.body;
      const folderId = await documentService.createFolder(
        req.institutionId,
        name,
        parentFolderId,
        req.user.userId
      );
      
      res.status(201).json({
        success: true,
        message: 'Folder created successfully',
        data: { folderId }
      });
    } catch (error) {
      logger.error('Folder creation failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getFolders(req, res) {
    try {
      const folders = await documentService.getFolders(req.institutionId);
      res.json({
        success: true,
        data: folders
      });
    } catch (error) {
      logger.error('Failed to get folders', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { folderId, associatedEntity, associatedEntityId } = req.body;
      const documentId = await documentService.uploadDocument(
        req.institutionId,
        req.file,
        folderId,
        associatedEntity,
        associatedEntityId,
        req.user.userId
      );

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: { documentId }
      });
    } catch (error) {
      logger.error('Document upload failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async getDocuments(req, res) {
    try {
      const { folderId, view } = req.query;
      const documents = await documentService.getDocuments(
        req.institutionId,
        folderId,
        view
      );
      
      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      logger.error('Failed to get documents', { error: error.message, institutionId: req.institutionId });
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  async deleteDocument(req, res) {
    try {
      const { documentId } = req.params;
      await documentService.deleteDocument(req.institutionId, documentId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error) {
      logger.error('Document deletion failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteFolder(req, res) {
    try {
      const { folderId } = req.params;
      await documentService.deleteFolder(req.institutionId, folderId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Folder deleted successfully'
      });
    } catch (error) {
      logger.error('Folder deletion failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async toggleFolderStatus(req, res) {
    try {
      const { folderId } = req.params;
      await documentService.toggleFolderStatus(req.institutionId, folderId, req.user.userId);
      
      res.json({
        success: true,
        message: 'Folder status updated successfully'
      });
    } catch (error) {
      logger.error('Folder status update failed', { error: error.message, institutionId: req.institutionId });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new DocumentController();
