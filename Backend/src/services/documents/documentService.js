const db = require('../../database/connection');
const path = require('path');
const fs = require('fs');

class DocumentService {
  async createFolder(institutionId, name, parentFolderId, userId) {
    if (!name || name.trim() === '') {
      throw new Error('Folder name is required');
    }

    const existing = await db.query(
      'SELECT id FROM document_folders WHERE institution_id = ? AND name = ? AND parent_folder_id <=> ? AND is_deleted = 0',
      [institutionId, name, parentFolderId || null]
    );

    if (existing && existing.length > 0) {
      throw new Error('Folder with this name already exists in this location');
    }

    const result = await db.query(
      `INSERT INTO document_folders (institution_id, name, parent_folder_id, created_by) 
       VALUES (?, ?, ?, ?)`,
      [institutionId, name, parentFolderId || null, userId]
    );

    const folderPath = path.join(__dirname, `../../../uploads/documents/${institutionId}/${result.insertId}`);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    return result.insertId;
  }

  async getFolders(institutionId) {
    const folders = await db.query(
      `SELECT f.*,
       (SELECT COUNT(*) FROM documents WHERE folder_id = f.id AND is_deleted = 0) as document_count
       FROM document_folders f
       WHERE f.institution_id = ? AND f.is_deleted = 0
       ORDER BY f.name`,
      [institutionId]
    );
    return folders;
  }

  async toggleFolderStatus(institutionId, folderId, userId) {
    await db.query(
      'UPDATE document_folders SET is_active = NOT is_active WHERE id = ? AND institution_id = ?',
      [folderId, institutionId]
    );
  }

  async uploadDocument(institutionId, file, folderId, associatedEntity, associatedEntityId, userId) {
    const folder = folderId || 'root';
    const targetDir = path.join(__dirname, `../../../uploads/documents/${institutionId}/${folder}`);
    
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    const targetPath = path.join(targetDir, file.filename);
    fs.renameSync(file.path, targetPath);
    
    const filePath = `/uploads/documents/${institutionId}/${folder}/${file.filename}`;
    
    const result = await db.query(
      `INSERT INTO documents (institution_id, folder_id, file_name, file_path, file_size, mime_type, 
       associated_entity, associated_entity_id, uploaded_by) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [institutionId, folderId || null, file.originalname, filePath, file.size, file.mimetype, 
       associatedEntity || null, associatedEntityId || null, userId]
    );

    return result.insertId;
  }

  async getDocuments(institutionId, folderId, view) {
    let query = `
      SELECT d.*, f.name as folder_name, f.is_active as folder_is_active, u.email as uploaded_by_name
      FROM documents d
      LEFT JOIN document_folders f ON d.folder_id = f.id
      LEFT JOIN institution_users u ON d.uploaded_by = u.id
      WHERE d.institution_id = ? AND d.is_deleted = 0
    `;
    const params = [institutionId];

    if (folderId) {
      query += ' AND d.folder_id = ?';
      params.push(folderId);
    }

    if (view === 'inbox') {
      query += ' AND d.folder_id IS NULL';
    }

    query += ' AND (d.folder_id IS NULL OR f.is_active = 1)';
    query += ' ORDER BY d.created_at DESC';

    const documents = await db.query(query, params);
    return documents;
  }

  async deleteDocument(institutionId, documentId, userId) {
    const doc = await db.query(
      'SELECT file_path FROM documents WHERE id = ? AND institution_id = ?',
      [documentId, institutionId]
    );

    if (!doc || doc.length === 0) {
      throw new Error('Document not found');
    }

    await db.query(
      'UPDATE documents SET is_deleted = 1, deleted_by = ?, deleted_at = NOW() WHERE id = ? AND institution_id = ?',
      [userId, documentId, institutionId]
    );

    const filePath = path.join(__dirname, '../../../', doc[0].file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async deleteFolder(institutionId, folderId, userId) {
    const docs = await db.query(
      'SELECT COUNT(*) as count FROM documents WHERE folder_id = ? AND is_deleted = 0',
      [folderId]
    );

    if (docs && docs.length > 0 && docs[0].count > 0) {
      throw new Error('Cannot delete folder with documents. Please delete or move documents first.');
    }

    await db.query(
      'UPDATE document_folders SET is_deleted = 1, deleted_by = ?, deleted_at = NOW() WHERE id = ? AND institution_id = ?',
      [userId, folderId, institutionId]
    );
  }
}

module.exports = new DocumentService();
