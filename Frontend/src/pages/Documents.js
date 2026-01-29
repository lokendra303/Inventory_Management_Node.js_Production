import React, { useState } from 'react';
import { Layout, Button, Table, Breadcrumb, Collapse, Space, Input, Modal, Form } from 'antd';
import { PlusOutlined, UploadOutlined, DeleteOutlined, FolderOutlined } from '@ant-design/icons';
import './Documents.css';

const { Sider, Content } = Layout;

const Documents = () => {
  const [selectedView, setSelectedView] = useState('all');
  const [documents, setDocuments] = useState([
    {
      id: 1,
      fileName: 'page1_img5.jpeg',
      uploadedBy: 'Me',
      uploadedOn: '10/01/2026 02:26 PM',
      associatedTo: 'Item: good 1, Item Group: good 1',
      folder: '-'
    }
  ]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  const showUploadModal = () => {
    setIsModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then(() => {
      // Handle file upload here
      setIsModalVisible(false);
      form.resetFields();
    });
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  const handleCreateFolder = () => {
    Modal.confirm({
      title: 'Create New Folder',
      content: <Input placeholder="Enter folder name" />,
      okText: 'Create',
      cancelText: 'Cancel',
      onOk() {
        // Handle folder creation
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
      dataIndex: 'fileName',
      key: 'fileName',
      render: (text) => <span style={{ color: '#1890ff' }}>📄 {text}</span>
    },
    {
      title: 'UPLOADED BY',
      dataIndex: 'uploadedBy',
      key: 'uploadedBy'
    },
    {
      title: 'UPLOADED ON',
      dataIndex: 'uploadedOn',
      key: 'uploadedOn'
    },
    {
      title: 'ASSOCIATED TO',
      dataIndex: 'associatedTo',
      key: 'associatedTo'
    },
    {
      title: 'FOLDER',
      dataIndex: 'folder',
      key: 'folder'
    }
  ];

  const leftMenu = [
    {
      label: 'All Documents',
      key: 'all',
      onClick: () => setSelectedView('all')
    },
    {
      label: 'Inbox',
      key: 'inbox',
      onClick: () => setSelectedView('inbox')
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
      children: [
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
      ]
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
          <h2 style={{ margin: 0 }}>All Documents</h2>
          <Space>
            <Button type="primary" icon={<UploadOutlined />} onClick={showUploadModal}>
              Upload File
            </Button>
            <Button type="text" icon="⋮" />
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
          pagination={false}
          bordered={false}
        />
      </Content>

      {/* Upload Modal */}
      <Modal
        title="Upload File"
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="file"
            label="Select File"
            rules={[{ required: true, message: 'Please select a file' }]}
          >
            <Input type="file" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default Documents;
