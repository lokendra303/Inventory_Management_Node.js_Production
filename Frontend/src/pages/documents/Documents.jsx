import React, { useState, useEffect } from 'react';
import { Layout, Button, Table, Collapse, Space, Input, Modal, Form, message, Select, Switch } from 'antd';
import { PlusOutlined, UploadOutlined, DeleteOutlined, FolderOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons';
import { documentService } from '../../services/documentService';
import '../../styles/Documents.css';

const { Sider, Content } = Layout;

const Documents = () => {
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

  const handleCreateFolder = () => {
    setIsFolderModalVisible(true);
  };

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
      if (!selectedFile) {
        message.error('Please select a file');
        return;
      }
      
      const values = await uploadForm.validateFields();
      await documentService.uploadDocument(
        selectedFile,
        values.folderId
      );
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

  const handleDeleteFolder = async (folderId) => {
    Modal.confirm({
      title: 'Delete Folder',
      content: 'Are you sure you want to delete this folder?',
      onOk: async () => {
        try {
          await documentService.deleteFolder(folderId);
          message.success('Folder deleted successfully');
          loadFolders();
        } catch (error) {
          message.error(error.response?.data?.error || 'Failed to delete folder');
        }
      }
    });
  };

  const columns = [
    {
      title: '',
      dataIndex: 'checkbox',
      key: 'checkbox',
      width: 40,
      render: () => <input type="checkbox" />
    },
    {
      title: 'FILE NAME',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (text, record) => (
        <a href={`http://localhost:5000${record.file_path}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>
          📄 {text}
        </a>
      )
    },
    {
      title: 'UPLOADED BY',
      dataIndex: 'uploaded_by_name',
      key: 'uploaded_by_name',
      render: (text) => text || 'Unknown'
    },
    {
      title: 'UPLOADED ON',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => new Date(text).toLocaleString()
    },
    {
      title: 'ASSOCIATED TO',
      dataIndex: 'associated_entity',
      key: 'associated_entity',
      render: (text, record) => text ? `${text}: ${record.associated_entity_id}` : '-'
    },
    {
      title: 'FOLDER',
      dataIndex: 'folder_name',
      key: 'folder_name',
      render: (text) => text || '-'
    },
    {
      title: 'ACTION',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button 
            type="link" 
            icon={<EyeOutlined />}
            onClick={() => window.open(`http://localhost:5000${record.file_path}`, '_blank')}
          />
          <Button 
            type="link" 
            icon={<DownloadOutlined />}
            onClick={() => {
              fetch(`http://localhost:5000${record.file_path}`)
                .then(response => response.blob())
                .then(blob => {
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = record.file_name;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                });
            }}
          />
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteDocument(record.id)}
          />
        </Space>
      )
    }
  ];

  const leftMenu = [
    {
      label: 'All Documents',
      key: 'all',
      onClick: () => { setSelectedView('all'); setSelectedFolder(null); setSelectedFolderName('All Documents'); }
    },
    {
      label: 'Inbox',
      key: 'inbox',
      onClick: () => { setSelectedView('inbox'); setSelectedFolder(null); setSelectedFolderName('Inbox'); }
    }
  ];

  const folderItems = [
    {
      key: 'folders',
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>FOLDERS</span>
          <PlusOutlined 
            onClick={(e) => {
              e.stopPropagation();
              handleCreateFolder();
            }}
            style={{ cursor: 'pointer' }}
          />
        </div>
      ),
      children: folders && folders.length === 0 ? [
        <div key="no-folders" style={{ padding: '8px 0', color: '#999' }}>
          There are no folders.
        </div>,
        <div key="create-folder">
          <Button 
            type="link" 
            onClick={handleCreateFolder}
            style={{ padding: 0 }}
          >
            Create New Folder
          </Button>
        </div>
      ] : folders && folders.map(folder => (
        <div 
          key={folder.id}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            padding: '8px 0',
            cursor: 'pointer',
            opacity: folder.is_active ? 1 : 0.5
          }}
        >
          <span onClick={() => { setSelectedFolder(folder.id); setSelectedView('all'); setSelectedFolderName(folder.name); }}>
            <FolderOutlined /> {folder.name} ({folder.document_count})
          </span>
          <Switch 
            size="small"
            checked={folder.is_active}
            onChange={(checked) => {
              documentService.toggleFolderStatus(folder.id).then(() => {
                message.success(`Folder ${checked ? 'activated' : 'deactivated'}`);
                loadFolders();
                loadDocuments();
              });
            }}
            onClick={(checked, e) => e.stopPropagation()}
          />
        </div>
      ))
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={200} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Documents</h3>
          
          {/* Navigation Items */}
          <div style={{ marginBottom: '24px' }}>
            {leftMenu.map(item => (
              <div
                key={item.key}
                onClick={item.onClick}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  background: selectedView === item.key ? '#1890ff' : 'transparent',
                  color: selectedView === item.key ? '#fff' : '#000',
                  marginBottom: '4px'
                }}
              >
                {selectedView === item.key && <FolderOutlined style={{ marginRight: '8px' }} />}
                {item.label}
              </div>
            ))}
          </div>

          {/* Folders Collapse */}
          <Collapse items={folderItems} />
        </div>

        {/* Trash */}
        <div style={{ 
          padding: '16px', 
          borderTop: '1px solid #f0f0f0',
          position: 'absolute',
          bottom: 0,
          width: '100%'
        }}>
          <Button 
            type="text" 
            danger
            block
            style={{ textAlign: 'left' }}
          >
            🗑️ Trash
          </Button>
        </div>
      </Sider>

      <Content style={{ padding: '24px' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: 0 }}>{selectedFolderName}</h2>
          <Space>
            <Button type="primary" icon={<UploadOutlined />} onClick={() => setIsUploadModalVisible(true)}>
              Upload File
            </Button>
          </Space>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: '16px' }}>
          <span>Filter By: </span>
          <Button type="link" size="small">
            File Type: All
          </Button>
        </div>

        {/* Documents Table */}
        <Table
          columns={columns}
          dataSource={documents}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
          bordered={false}
        />
      </Content>

      {/* Upload Modal */}
      <Modal
        title="Upload File"
        open={isUploadModalVisible}
        onOk={handleUploadDocument}
        onCancel={() => {
          setIsUploadModalVisible(false);
          setSelectedFile(null);
          uploadForm.resetFields();
        }}
      >
        <Form form={uploadForm} layout="vertical">
          <Form.Item
            label="Select File"
            required
          >
            <Input 
              type="file" 
              key={isUploadModalVisible ? 'file-input' : 'reset'}
              onChange={(e) => setSelectedFile(e.target.files[0])} 
            />
          </Form.Item>
          <Form.Item
            name="folderId"
            label="Folder (Optional)"
          >
            <Select placeholder="Select folder" allowClear>
              {folders && folders.filter(f => f.is_active).map(folder => (
                <Select.Option key={folder.id} value={folder.id}>
                  {folder.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Folder Modal */}
      <Modal
        title="Create New Folder"
        open={isFolderModalVisible}
        onOk={handleFolderSubmit}
        onCancel={() => setIsFolderModalVisible(false)}
      >
        <Form form={folderForm} layout="vertical">
          <Form.Item
            name="name"
            label="Folder Name"
            rules={[{ required: true, message: 'Please enter folder name' }]}
          >
            <Input placeholder="Enter folder name" />
          </Form.Item>
          <Form.Item
            name="parentFolderId"
            label="Parent Folder (Optional)"
          >
            <Select placeholder="Root level" allowClear>
              {folders && folders.map(folder => (
                <Select.Option key={folder.id} value={folder.id}>
                  {folder.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default Documents;
