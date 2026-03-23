import React, { useState, useEffect } from 'react';
import { Button, Table, Collapse, Space, Input, Modal, Form, message, Select, Switch, Drawer } from 'antd';
import { PlusOutlined, UploadOutlined, DeleteOutlined, FolderOutlined, EyeOutlined, DownloadOutlined, MenuOutlined } from '@ant-design/icons';
import { documentService } from '../../services/documentService';
import '../../styles/Documents.css';

const Documents = () => {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedView, setSelectedView] = useState('all');
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedFolderName, setSelectedFolderName] = useState('All Documents');
  const [documents, setDocuments] = useState([]);
  const [folders, setFolders] = useState([]);
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [isFolderModalVisible, setIsFolderModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm] = Form.useForm();
  const [folderForm] = Form.useForm();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadFolders();
    loadDocuments();
  }, [selectedView, selectedFolder]);

  const loadFolders = async () => {
    try {
      const response = await documentService.getFolders();
      setFolders(response.data || []);
    } catch (error) {
      message.error('Failed to load folders');
      setFolders([]);
    }
  };

  const getFolderPath = (folderId) => {
    if (!folderId) return '';
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return '';
    const parentPath = getFolderPath(folder.parent_folder_id);
    return parentPath ? `${parentPath} > ${folder.name}` : folder.name;
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentService.getDocuments(selectedFolder, selectedView);
      setDocuments(response.data || []);
    } catch (error) {
      message.error('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = () => setIsFolderModalVisible(true);

  const handleFolderSubmit = async () => {
    try {
      const values = await folderForm.validateFields();
      await documentService.createFolder(values.name, values.parentFolderId);
      message.success('Folder created successfully');
      setIsFolderModalVisible(false);
      folderForm.resetFields();
      loadFolders();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to create folder');
    }
  };

  const handleUploadDocument = async () => {
    try {
      if (!selectedFile) { message.error('Please select a file'); return; }
      const values = await uploadForm.validateFields();
      await documentService.uploadDocument(selectedFile, values.folderId);
      message.success('Document uploaded successfully');
      setIsUploadModalVisible(false);
      setSelectedFile(null);
      uploadForm.resetFields();
      loadDocuments();
    } catch (error) {
      message.error(error.response?.data?.error || 'Failed to upload document');
    }
  };

  const handleDeleteDocument = async (documentId) => {
    Modal.confirm({
      title: 'Delete Document',
      content: 'Are you sure you want to delete this document?',
      onOk: async () => {
        try {
          await documentService.deleteDocument(documentId);
          message.success('Document deleted successfully');
          loadDocuments();
        } catch (error) {
          message.error('Failed to delete document');
        }
      }
    });
  };

  const columns = [
    { title: '', dataIndex: 'checkbox', key: 'checkbox', width: 40, render: () => <input type="checkbox" /> },
    {
      title: 'FILE NAME', dataIndex: 'file_name', key: 'file_name', ellipsis: true,
      render: (text, record) => (
        <a href={`http://localhost:5000${record.file_path}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>
          📄 {text}
        </a>
      )
    },
    { title: 'UPLOADED BY', dataIndex: 'uploaded_by_name', key: 'uploaded_by_name', width: 130, ellipsis: true, responsive: ['md'], render: (text) => text || 'Unknown' },
    { title: 'UPLOADED ON', dataIndex: 'created_at', key: 'created_at', width: 150, responsive: ['lg'], render: (text) => new Date(text).toLocaleString() },
    { title: 'FOLDER', dataIndex: 'folder_name', key: 'folder_name', width: 110, responsive: ['md'], render: (text) => text || '-' },
    {
      title: 'ACTION', key: 'action', width: 100,
      render: (_, record) => (
        <Space size={2}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => window.open(`http://localhost:5000${record.file_path}`, '_blank')} />
          <Button type="link" icon={<DownloadOutlined />} onClick={() => {
            fetch(`http://localhost:5000${record.file_path}`)
              .then(r => r.blob())
              .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = record.file_name;
                document.body.appendChild(link); link.click();
                document.body.removeChild(link); window.URL.revokeObjectURL(url);
              });
          }} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteDocument(record.id)} />
        </Space>
      )
    }
  ];

  const selectNav = (view, folder, name) => {
    setSelectedView(view);
    setSelectedFolder(folder);
    setSelectedFolderName(name);
    if (isMobile) setSidebarOpen(false);
  };

  const folderItems = [
    {
      key: 'folders',
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FOLDERS</span>
          <PlusOutlined onClick={(e) => { e.stopPropagation(); handleCreateFolder(); }} style={{ cursor: 'pointer' }} />
        </div>
      ),
      children: folders && folders.length === 0 ? [
        <div key="no-folders" style={{ padding: '8px 0', color: '#999' }}>There are no folders.</div>,
        <div key="create-folder"><Button type="link" onClick={handleCreateFolder} style={{ padding: 0 }}>Create New Folder</Button></div>
      ] : folders && folders.map(folder => {
        const indent = folder.parent_folder_id ? 20 : 0;
        return (
          <div key={folder.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', paddingLeft: `${indent}px`, cursor: 'pointer', opacity: folder.is_active ? 1 : 0.5 }}>
            <span onClick={() => selectNav('all', folder.id, folder.name)}>
              <FolderOutlined /> {folder.name} ({folder.document_count})
            </span>
            <Switch size="small" checked={folder.is_active}
              onChange={() => {
                documentService.toggleFolderStatus(folder.id).then(() => {
                  message.success('Folder status updated');
                  loadFolders(); loadDocuments();
                });
              }}
              onClick={(_, e) => e.stopPropagation()}
            />
          </div>
        );
      })
    }
  ];

  const sidebarContent = (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: '0 0 16px 0' }}>Documents</h3>
      <div style={{ marginBottom: '24px' }}>
        {[{ label: 'All Documents', key: 'all' }, { label: 'Inbox', key: 'inbox' }].map(item => (
          <div key={item.key} onClick={() => selectNav(item.key, null, item.label)}
            style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '4px', marginBottom: '4px',
              background: selectedView === item.key && !selectedFolder ? '#1890ff' : 'transparent',
              color: selectedView === item.key && !selectedFolder ? '#fff' : '#000' }}>
            {selectedView === item.key && !selectedFolder && <FolderOutlined style={{ marginRight: '8px' }} />}
            {item.label}
          </div>
        ))}
      </div>
      <Collapse items={folderItems} />
      <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
        <Button type="text" danger block style={{ textAlign: 'left' }}>🗑️ Trash</Button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '60vh' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <div style={{ width: 200, flexShrink: 0, background: '#fff', borderRight: '1px solid #f0f0f0' }}>
          {sidebarContent}
        </div>
      )}

      {/* Mobile drawer */}
      {isMobile && (
        <Drawer title="Documents" placement="left" open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          bodyStyle={{ padding: 0 }} width={220}>
          {sidebarContent}
        </Drawer>
      )}

      {/* Main content */}
      <div style={{ flex: 1, padding: '16px', minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && (
              <Button icon={<MenuOutlined />} onClick={() => setSidebarOpen(true)} />
            )}
            <h2 style={{ margin: 0, fontSize: '18px' }}>{selectedFolderName}</h2>
          </div>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setIsUploadModalVisible(true)}>
            Upload File
          </Button>
        </div>

        <Table columns={columns} dataSource={documents} rowKey="id" loading={loading}
          pagination={{ pageSize: 20, size: 'small' }}
          scroll={{ x: 'max-content' }} size="small" bordered={false}
        />
      </div>

      {/* Upload Modal */}
      <Modal title="Upload File" open={isUploadModalVisible} onOk={handleUploadDocument}
        onCancel={() => { setIsUploadModalVisible(false); setSelectedFile(null); uploadForm.resetFields(); }}
        width="min(480px, 96vw)" style={{ top: 16 }}>
        <Form form={uploadForm} layout="vertical">
          <Form.Item label="Select File" required>
            <Input type="file" key={isUploadModalVisible ? 'file-input' : 'reset'} onChange={(e) => setSelectedFile(e.target.files[0])} />
          </Form.Item>
          <Form.Item name="folderId" label="Folder (Optional)">
            <Select placeholder="Select folder" allowClear>
              {folders && folders.filter(f => f.is_active).map(folder => (
                <Select.Option key={folder.id} value={folder.id}>{getFolderPath(folder.id)}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Folder Modal */}
      <Modal title="Create New Folder" open={isFolderModalVisible} onOk={handleFolderSubmit}
        onCancel={() => setIsFolderModalVisible(false)}
        width="min(480px, 96vw)" style={{ top: 16 }}>
        <Form form={folderForm} layout="vertical">
          <Form.Item name="name" label="Folder Name" rules={[{ required: true, message: 'Please enter folder name' }]}>
            <Input placeholder="Enter folder name" />
          </Form.Item>
          <Form.Item name="parentFolderId" label="Parent Folder (Optional)">
            <Select placeholder="Root level" allowClear>
              {folders && folders.map(folder => (
                <Select.Option key={folder.id} value={folder.id}>{getFolderPath(folder.id)}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Documents;
