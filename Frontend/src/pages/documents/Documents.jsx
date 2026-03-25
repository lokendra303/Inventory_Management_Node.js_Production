import React, { useState, useEffect, useRef } from 'react';
import {
  Button, Table, Space, Modal, Form, message, Select, Drawer, Tag, Tooltip, Input
} from 'antd';
import {
  PlusOutlined, UploadOutlined, DeleteOutlined, FolderOutlined,
  EyeOutlined, DownloadOutlined, MenuOutlined, FolderAddOutlined,
  FileImageOutlined, FilePdfOutlined, FileExcelOutlined, FileWordOutlined,
  FileZipOutlined, FileTextOutlined, FileUnknownOutlined, InboxOutlined,
  AppstoreOutlined, UnorderedListOutlined, CloudUploadOutlined
} from '@ant-design/icons';
import { documentService } from '../../services/documentService';
import '../../styles/Documents.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const FOLDER_COLORS = ['#4361ee','#f72585','#7209b7','#3a0ca3','#4cc9f0','#f77f00','#06d6a0','#ef233c'];

const getFileIcon = (name = '') => {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return { icon: <FileImageOutlined />, color: '#06d6a0', label: 'Image' };
  if (ext === 'pdf') return { icon: <FilePdfOutlined />, color: '#ef233c', label: 'PDF' };
  if (['xls','xlsx','csv'].includes(ext)) return { icon: <FileExcelOutlined />, color: '#06d6a0', label: 'Excel' };
  if (['doc','docx'].includes(ext)) return { icon: <FileWordOutlined />, color: '#4361ee', label: 'Word' };
  if (['zip','rar','7z'].includes(ext)) return { icon: <FileZipOutlined />, color: '#f77f00', label: 'Archive' };
  if (['txt','md'].includes(ext)) return { icon: <FileTextOutlined />, color: '#888', label: 'Text' };
  return { icon: <FileUnknownOutlined />, color: '#aaa', label: ext.toUpperCase() || 'File' };
};

const getFolderEmoji = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('invoice') || n.includes('bill')) return '🧾';
  if (n.includes('contract') || n.includes('legal')) return '📜';
  if (n.includes('report')) return '📊';
  if (n.includes('image') || n.includes('photo')) return '🖼️';
  if (n.includes('purchase') || n.includes('po')) return '🛒';
  if (n.includes('sales') || n.includes('so')) return '💰';
  if (n.includes('hr') || n.includes('employee')) return '👥';
  return '📁';
};

const formatSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

// ── component ─────────────────────────────────────────────────────────────────
const Documents = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [selectedView, setSelectedView] = useState('all');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFolderName, setSelectedFolderName] = useState('All Documents');
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadForm] = Form.useForm();
  const [folderForm] = Form.useForm();
  const fileInputRef = useRef();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => { loadFolders(); loadDocuments(); }, [selectedView, selectedFolder]);

  const loadFolders = async () => {
    try { const r = await documentService.getFolders(); setFolders(r.data || []); }
    catch { setFolders([]); }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const r = await documentService.getDocuments(selectedFolder, selectedView);
      setDocuments(r.data || []);
    } catch { setDocuments([]); }
    finally { setLoading(false); }
  };

  const getFolderPath = (id) => {
    if (!id) return '';
    const f = folders.find(x => x.id === id);
    if (!f) return '';
    const p = getFolderPath(f.parent_folder_id);
    return p ? `${p} > ${f.name}` : f.name;
  };

  const handleFolderSubmit = async () => {
    try {
      const v = await folderForm.validateFields();
      await documentService.createFolder(v.name, v.parentFolderId);
      message.success('Folder created');
      setIsFolderModalVisible(false); folderForm.resetFields(); loadFolders();
    } catch (e) { message.error(e.response?.data?.error || 'Failed to create folder'); }
  };

  const handleUpload = async () => {
    try {
      if (!selectedFile) { message.error('Please select a file'); return; }
      const v = await uploadForm.validateFields();
      await documentService.uploadDocument(selectedFile, v.folderId);
      message.success('Document uploaded');
      setIsUploadModalVisible(false); setSelectedFile(null); uploadForm.resetFields(); loadDocuments();
    } catch (e) { message.error(e.response?.data?.error || 'Upload failed'); }
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Delete Document', content: 'Are you sure?',
      okButtonProps: { danger: true },
      onOk: async () => {
        try { await documentService.deleteDocument(id); message.success('Deleted'); loadDocuments(); }
        catch { message.error('Delete failed'); }
      }
    });
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { setSelectedFile(file); setIsUploadModalVisible(true); }
  };

  const selectNav = (view, folder, name) => {
    setSelectedView(view); setSelectedFolder(folder); setSelectedFolderName(name);
    if (isMobile) setSidebarOpen(false);
  };

  // ── columns ────────────────────────────────────────────────────────────────
  const columns = [
    {
      title: 'File Name', dataIndex: 'file_name', key: 'file_name', ellipsis: true,
      render: (text, record) => {
        const { icon, color } = getFileIcon(text);
        return (
          <div className="docs-file-name-cell">
            <span className="docs-file-icon" style={{ color }}>{icon}</span>
            <div className="docs-file-info">
              <a href={`http://localhost:5000${record.file_path}`} target="_blank" rel="noopener noreferrer">{text}</a>
              {record.file_size && <div className="docs-file-size">{formatSize(record.file_size)}</div>}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Folder', dataIndex: 'folder_name', key: 'folder_name', width: 130,
      responsive: ['md'],
      render: (text) => text
        ? <Tag icon={<FolderOutlined />} color="blue" style={{ borderRadius: 6 }}>{text}</Tag>
        : <span style={{ color: '#ccc' }}>—</span>
    },
    {
      title: 'Uploaded By', dataIndex: 'uploaded_by_name', key: 'uploaded_by_name',
      width: 130, responsive: ['lg'], render: (t) => t || 'Unknown'
    },
    {
      title: 'Date', dataIndex: 'created_at', key: 'created_at', width: 140,
      responsive: ['lg'], render: (t) => new Date(t).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    },
    {
      title: '', key: 'action', width: 90, align: 'center',
      render: (_, record) => (
        <Space size={2}>
          <Tooltip title="Preview">
            <Button type="text" size="small" icon={<EyeOutlined />}
              onClick={() => window.open(`http://localhost:5000${record.file_path}`, '_blank')} />
          </Tooltip>
          <Tooltip title="Download">
            <Button type="text" size="small" icon={<DownloadOutlined />}
              onClick={() => {
                fetch(`http://localhost:5000${record.file_path}`)
                  .then(r => r.blob()).then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = record.file_name;
                    a.click(); URL.revokeObjectURL(url);
                  });
              }} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button type="text" size="small" danger icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)} />
          </Tooltip>
        </Space>
      )
    }
  ];

  // ── sidebar ────────────────────────────────────────────────────────────────
  const sidebarContent = (
    <div className="docs-sidebar">
      <div className="docs-sidebar-header">
        <h3>📂 Documents</h3>
      </div>

      <div style={{ padding: '12px 0' }}>
        {[
          { label: 'All Documents', key: 'all', icon: <AppstoreOutlined /> },
          { label: 'Inbox', key: 'inbox', icon: <InboxOutlined /> }
        ].map(item => (
          <div key={item.key}
            className={`docs-nav-item ${selectedView === item.key && !selectedFolder ? 'active' : ''}`}
            onClick={() => selectNav(item.key, null, item.label)}>
            {item.icon} {item.label}
          </div>
        ))}
      </div>

      <div className="docs-nav-section">
        Folders
        <Tooltip title="New Folder">
          <PlusOutlined
            style={{ marginLeft: 8, cursor: 'pointer', color: '#4361ee' }}
            onClick={() => setIsFolderModalVisible(true)} />
        </Tooltip>
      </div>

      {folders.length === 0
        ? <div style={{ padding: '8px 20px', color: '#bbb', fontSize: 12 }}>No folders yet</div>
        : folders.map((folder, i) => {
          const isChild = !!folder.parent_folder_id;
          return (
            <div key={folder.id}
              className={`docs-folder-item ${selectedFolder === folder.id ? 'active' : ''}`}
              style={{ paddingLeft: isChild ? 44 : 28, opacity: folder.is_active ? 1 : 0.45, position: 'relative' }}
              onClick={() => selectNav('all', folder.id, folder.name)}>
              {/* tree connector line for child */}
              {isChild && (
                <span style={{
                  position: 'absolute', left: 24, top: 0, bottom: '50%',
                  width: 12, borderLeft: '1.5px dashed #d0d5e8',
                  borderBottom: '1.5px dashed #d0d5e8', borderRadius: '0 0 0 4px',
                  pointerEvents: 'none'
                }} />
              )}
              <div className="docs-folder-item-left">
                <FolderOutlined style={{ color: isChild ? '#a0aec0' : FOLDER_COLORS[i % FOLDER_COLORS.length], fontSize: isChild ? 12 : 14 }} />
                <span style={{ fontSize: isChild ? 12 : 13, color: isChild ? '#666' : '#444' }}>{folder.name}</span>
                {isChild && <span style={{ fontSize: 9, background: '#eef1ff', color: '#4361ee', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>sub</span>}
              </div>
              <span className="docs-folder-badge">{folder.document_count || 0}</span>
            </div>
          );
        })
      }

      <div className="docs-sidebar-footer">
        <Button type="text" danger block style={{ textAlign: 'left', borderRadius: 8 }}>
          🗑️ Trash
        </Button>
      </div>
    </div>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="docs-layout">
      {!isMobile && sidebarContent}

      {isMobile && (
        <Drawer title="Documents" placement="left" open={sidebarOpen}
          onClose={() => setSidebarOpen(false)} bodyStyle={{ padding: 0 }} width={240}>
          {sidebarContent}
        </Drawer>
      )}

      {/* Main */}
      <div className="docs-main">
        {/* Top bar */}
        <div className="docs-topbar">
          <div className="docs-topbar-left">
            {isMobile && <Button icon={<MenuOutlined />} onClick={() => setSidebarOpen(true)} />}
            <div>
              <div className="docs-breadcrumb">Documents / <span>{selectedFolderName}</span></div>
            </div>
          </div>
          <div className="docs-topbar-actions">
            <Tooltip title={viewMode === 'list' ? 'Grid view' : 'List view'}>
              <Button icon={viewMode === 'list' ? <AppstoreOutlined /> : <UnorderedListOutlined />}
                onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')} />
            </Tooltip>
            <Button icon={<FolderAddOutlined />} onClick={() => setIsFolderModalVisible(true)}>
              {!isMobile && 'New Folder'}
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />}
              onClick={() => setIsUploadModalVisible(true)}
              style={{ background: 'linear-gradient(135deg,#4361ee,#7209b7)', border: 'none' }}>
              {!isMobile && 'Upload File'}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="docs-stats">
          <div className="docs-stat">
            <div className="docs-stat-dot" style={{ background: '#4361ee' }} />
            <span>{documents.length} files</span>
          </div>
          <div className="docs-stat">
            <div className="docs-stat-dot" style={{ background: '#06d6a0' }} />
            <span>{folders.length} folders</span>
          </div>
        </div>

        {/* Drag & Drop Upload Zone */}
        <div
          className={`docs-upload-zone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}>
          <input ref={fileInputRef} type="file" hidden
            onChange={(e) => { if (e.target.files[0]) { setSelectedFile(e.target.files[0]); setIsUploadModalVisible(true); } }} />
          <div className="docs-upload-icon">☁️</div>
          <h4>Drop files here or click to upload</h4>
          <p>Supports PDF, Word, Excel, Images and more</p>
        </div>

        {/* Folder Cards */}
        {folders.length > 0 && (
          <>
            <div className="docs-section-title">📁 Folders</div>
            <div className="docs-folders-grid">
              {folders.map((folder, i) => {
                const isChild = !!folder.parent_folder_id;
                const color = isChild ? '#a0aec0' : FOLDER_COLORS[i % FOLDER_COLORS.length];
                return (
                  <div key={folder.id}
                    className={`docs-folder-card ${selectedFolder === folder.id ? 'selected' : ''} ${isChild ? 'docs-folder-card-child' : ''}`}
                    style={{ '--folder-color': color, opacity: folder.is_active ? 1 : 0.5 }}
                    onClick={() => selectNav('all', folder.id, folder.name)}>
                    <div className="docs-folder-card-actions">
                      <Tooltip title={folder.is_active ? 'Disable' : 'Enable'}>
                        <Button size="small" type="text"
                          style={{ fontSize: 10, padding: '0 4px' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            documentService.toggleFolderStatus(folder.id).then(() => {
                              message.success('Updated'); loadFolders(); loadDocuments();
                            });
                          }}>
                          {folder.is_active ? '🔒' : '🔓'}
                        </Button>
                      </Tooltip>
                    </div>
                    {isChild && (
                      <span style={{
                        position: 'absolute', top: 10, left: 10,
                        fontSize: 9, background: '#eef1ff', color: '#4361ee',
                        borderRadius: 4, padding: '1px 6px', fontWeight: 700, letterSpacing: 0.3
                      }}>SUB</span>
                    )}
                    <div className="docs-folder-card-icon" style={{ fontSize: isChild ? 24 : 32 }}>
                      {isChild ? '📂' : getFolderEmoji(folder.name)}
                    </div>
                    <div className="docs-folder-card-name" style={{ fontSize: isChild ? 11 : 13 }}>{folder.name}</div>
                    <div className="docs-folder-card-count" style={{ color }}>
                      {folder.document_count || 0} files
                    </div>
                  </div>
                );
              })}
              {/* Add folder card */}
              <div className="docs-folder-card"
                style={{ '--folder-color': '#ccc', border: '2px dashed #e0e0e0', background: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setIsFolderModalVisible(true)}>
                <div style={{ fontSize: 28, color: '#ccc', marginBottom: 8 }}>+</div>
                <div style={{ fontSize: 12, color: '#bbb' }}>New Folder</div>
              </div>
            </div>
          </>
        )}

        {/* Documents Table */}
        <div className="docs-section-title">📄 Files</div>
        <div className="docs-table-area">
          {documents.length === 0 && !loading
            ? (
              <div className="docs-empty">
                <div className="docs-empty-icon">📭</div>
                <h4>No documents found</h4>
                <p>Upload a file or select a different folder</p>
                <Button type="primary" icon={<UploadOutlined />}
                  onClick={() => setIsUploadModalVisible(true)}
                  style={{ marginTop: 12, background: '#4361ee', border: 'none' }}>
                  Upload First File
                </Button>
              </div>
            ) : (
              <Table
                columns={columns} dataSource={documents} rowKey="id"
                loading={loading} size="small"
                pagination={{ pageSize: 15, size: 'small', showTotal: (t) => `${t} files` }}
                scroll={{ x: 'max-content' }}
                rowClassName={() => 'docs-table-row'}
                style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              />
            )}
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        title={<span>☁️ Upload Document</span>}
        open={isUploadModalVisible}
        onOk={handleUpload}
        okText="Upload"
        okButtonProps={{ style: { background: '#4361ee', border: 'none' } }}
        onCancel={() => { setIsUploadModalVisible(false); setSelectedFile(null); uploadForm.resetFields(); }}
        width="min(480px, 96vw)">
        <Form form={uploadForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Select File" required>
            <div style={{ border: '2px dashed #c7d2fe', borderRadius: 8, padding: 16, textAlign: 'center', background: '#f8f9ff', cursor: 'pointer' }}
              onClick={() => fileInputRef.current?.click()}>
              {selectedFile
                ? <><span style={{ fontSize: 24 }}>{getFileIcon(selectedFile.name).icon}</span><div style={{ marginTop: 8, fontWeight: 600 }}>{selectedFile.name}</div><div style={{ fontSize: 12, color: '#888' }}>{formatSize(selectedFile.size)}</div></>
                : <><UploadOutlined style={{ fontSize: 28, color: '#4361ee' }} /><div style={{ marginTop: 8, color: '#888' }}>Click to select file</div></>
              }
            </div>
            <Input type="file" style={{ display: 'none' }} key={isUploadModalVisible}
              onChange={(e) => setSelectedFile(e.target.files[0])} />
          </Form.Item>
          <Form.Item name="folderId" label="Save to Folder">
            <Select placeholder="Root (no folder)" allowClear>
              {folders.filter(f => f.is_active).map(f => (
                <Select.Option key={f.id} value={f.id}>
                  {getFolderEmoji(f.name)} {getFolderPath(f.id)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Folder Modal */}
      <Modal
        title={<span>📁 Create New Folder</span>}
        open={isFolderModalVisible}
        onOk={handleFolderSubmit}
        okText="Create"
        okButtonProps={{ style: { background: '#4361ee', border: 'none' } }}
        onCancel={() => { setIsFolderModalVisible(false); folderForm.resetFields(); }}
        width="min(420px, 96vw)">
        <Form form={folderForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Folder Name" rules={[{ required: true, message: 'Enter folder name' }]}>
            <Input prefix={<FolderOutlined style={{ color: '#4361ee' }} />} placeholder="e.g. Invoices 2024" />
          </Form.Item>
          <Form.Item name="parentFolderId" label="Parent Folder (optional)">
            <Select placeholder="Root level" allowClear>
              {folders.map(f => (
                <Select.Option key={f.id} value={f.id}>
                  {getFolderEmoji(f.name)} {getFolderPath(f.id)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Documents;
