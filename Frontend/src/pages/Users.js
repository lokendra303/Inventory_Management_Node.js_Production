import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, Input, Select, Tag, message, Tabs, Checkbox, Typography, Alert } from 'antd';
import { PlusOutlined, EditOutlined, SettingOutlined, KeyOutlined } from '@ant-design/icons';
import apiService from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

const { TabPane } = Tabs;
const { Text, Paragraph } = Typography;

const Users = () => {
  const { user: currentUser, fetchProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [tempAccessModalVisible, setTempAccessModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [tempAccessData, setTempAccessData] = useState(null);
  const [form] = Form.useForm();
  const [roleForm] = Form.useForm();
  const [tempAccessForm] = Form.useForm();

  const availablePermissions = [
    { key: 'all', label: 'All Permissions (Admin)' },
    { key: 'user_management', label: 'User Management' },
    { key: 'inventory_view', label: 'View Inventory' },
    { key: 'inventory_receive', label: 'Receive Stock' },
    { key: 'inventory_reserve', label: 'Reserve Stock' },
    { key: 'inventory_ship', label: 'Ship Stock' },
    { key: 'inventory_adjust', label: 'Adjust Stock' },
    { key: 'inventory_transfer', label: 'Transfer Stock' },
    { key: 'item_view', label: 'View Items' },
    { key: 'item_management', label: 'Manage Items' },
    { key: 'warehouse_view', label: 'View Warehouses' },
    { key: 'warehouse_management', label: 'Manage Warehouses' },
    { key: 'warehouse_type_view', label: 'View Warehouse Types' },
    { key: 'warehouse_type_management', label: 'Manage Warehouse Types' },
    { key: 'category_view', label: 'View Categories' },
    { key: 'category_management', label: 'Manage Categories' },
    { key: 'purchase_view', label: 'View Purchase Orders' },
    { key: 'purchase_management', label: 'Manage Purchase Orders' },
    { key: 'sales_view', label: 'View Sales Orders' },
    { key: 'sales_management', label: 'Manage Sales Orders' }
  ];

  const columns = [
    { 
      title: 'Name', 
      dataIndex: 'first_name', 
      key: 'name', 
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {record.first_name} {record.last_name}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.email}
          </div>
        </div>
      )
    },
    { 
      title: 'Role', 
      dataIndex: 'role', 
      key: 'role',
      width: 100,
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : role === 'manager' ? 'blue' : 'green'}>
          {role.toUpperCase()}
        </Tag>
      )
    },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      )
    },
    { 
      title: 'Last Login', 
      dataIndex: 'last_login', 
      key: 'last_login',
      width: 120,
      render: (date) => date ? new Date(date).toLocaleDateString() : 'Never'
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 250,
      render: (_, record) => (
        <Space size="small">
          <Button 
            icon={<EditOutlined />} 
            size="small"
            onClick={() => editUser(record)}
          >
            Edit
          </Button>
          <Button 
            size="small"
            type={record.status === 'active' ? 'default' : 'primary'}
            onClick={() => toggleUserStatus(record)}
            disabled={record.role === 'admin' && record.status === 'active'}
          >
            {record.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <Button 
            icon={<KeyOutlined />}
            size="small"
            onClick={() => generateTempAccess(record)}
            disabled={record.role === 'admin'}
            type="dashed"
          >
            Access
          </Button>
        </Space>
      )
    }
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const [usersResponse, warehousesResponse, rolesResponse] = await Promise.all([
        apiService.get('/users'),
        apiService.get('/warehouses'),
        apiService.get('/roles')
      ]);
      
      if (usersResponse.success) {
        setUsers(usersResponse.data);
      }
      if (warehousesResponse.success) {
        setWarehouses(warehousesResponse.data);
      }
      if (rolesResponse.success) {
        setRoles(rolesResponse.data);
      }
    } catch (error) {
      message.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (values) => {
    try {
      const response = await apiService.post('/users', values);
      if (response.success) {
        message.success('User created successfully');
        setModalVisible(false);
        form.resetFields();
        fetchUsers();
      }
    } catch (error) {
      message.error('Failed to create user');
    }
  };

  const handleUpdatePermissions = async (values) => {
    try {
      const permissions = {};
      if (values.role === 'admin') {
        permissions.all = true;
      } else {
        // Set specific permissions based on role
        const rolePermissions = roles.find(r => r.name === values.role)?.permissions || {};
        Object.assign(permissions, rolePermissions);
      }

      console.log('Updating user:', editingUser.id);
      console.log('New role:', values.role);
      console.log('Permissions:', permissions);
      console.log('Warehouse access:', values.warehouseAccess);

      const response = await apiService.put(`/users/${editingUser.id}/permissions`, {
        permissions,
        warehouseAccess: values.warehouseAccess || [],
        role: values.role
      });
      
      console.log('Update response:', response);
      
      if (response.success) {
        message.success('User permissions updated successfully');
        setModalVisible(false);
        setEditingUser(null);
        form.resetFields();
        fetchUsers();
        
        // If updating current user's permissions, refresh their profile
        if (editingUser.id === currentUser?.id) {
          await fetchProfile();
          message.info('Your permissions have been updated. Please refresh the page if needed.');
        }
      }
    } catch (error) {
      console.error('Update error:', error);
      message.error('Failed to update user permissions');
    }
  };

  const handleUpdateRole = async (values) => {
    try {
      const response = await apiService.put(`/roles/${editingRole.id}`, {
        name: values.roleName,
        permissions: values.permissions.reduce((acc, perm) => {
          acc[perm] = true;
          return acc;
        }, {})
      });
      
      if (response.success) {
        message.success('Role updated successfully');
        setRoleModalVisible(false);
        setEditingRole(null);
        roleForm.resetFields();
        fetchUsers(); // This will also fetch updated roles
      }
    } catch (error) {
      message.error('Failed to update role');
    }
  };

  const handleCreateRole = async (values) => {
    try {
      const response = await apiService.post('/roles', {
        name: values.roleName,
        permissions: values.permissions.reduce((acc, perm) => {
          acc[perm] = true;
          return acc;
        }, {})
      });
      
      if (response.success) {
        message.success('Role created successfully');
        setRoleModalVisible(false);
        roleForm.resetFields();
        fetchUsers(); // This will also fetch updated roles
      }
    } catch (error) {
      message.error('Failed to create role');
    }
  };

  const toggleUserStatus = async (user) => {
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      console.log('Updating user status:', { userId: user.id, newStatus });
      
      const response = await apiService.put(`/users/${user.id}/status`, {
        status: newStatus
      });
      
      console.log('Status update response:', response);
      
      if (response.success) {
        message.success(`User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchUsers();
      } else {
        message.error(response.error || 'Failed to update user status');
      }
    } catch (error) {
      console.error('Status update error:', error);
      message.error(error.response?.data?.error || 'Failed to update user status');
    }
  };

  const generateTempAccess = async (user) => {
    setSelectedUser(user);
    tempAccessForm.setFieldsValue({ expiresInHours: 24 });
    setTempAccessModalVisible(true);
  };

  const handleGenerateTempAccess = async (values) => {
    try {
      const response = await apiService.post(`/users/${selectedUser.id}/temp-access`, {
        targetUserId: selectedUser.id,
        expiresInHours: values.expiresInHours
      });
      
      if (response.success) {
        setTempAccessData(response.data);
        message.success('Temporary access generated successfully');
      }
    } catch (error) {
      message.error('Failed to generate temporary access');
    }
  };

  const toggleRoleStatus = async (role) => {
    try {
      const response = await apiService.put(`/roles/${role.id}/status`);
      
      if (response.success) {
        message.success(`Role ${response.data.status === 'active' ? 'activated' : 'deactivated'} successfully`);
        fetchUsers(); // This will also fetch updated roles
      }
    } catch (error) {
      message.error('Failed to update role status');
    }
  };

  const editRole = (role) => {
    setEditingRole(role);
    roleForm.setFieldsValue({
      roleName: role.name,
      permissions: Object.keys(role.permissions)
    });
    setRoleModalVisible(true);
  };

  const editUser = (user) => {
    setEditingUser(user);
    let warehouseAccess = [];
    try {
      warehouseAccess = user.warehouse_access ? JSON.parse(user.warehouse_access) : [];
    } catch (e) {
      warehouseAccess = [];
    }
    
    form.setFieldsValue({
      role: user.role,
      warehouseAccess: warehouseAccess
    });
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>User & Role Management</h1>
      
      <Tabs defaultActiveKey="users">
        <TabPane tab="Users" key="users">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                Add User
              </Button>
            </Space>
            <Table 
              columns={columns} 
              dataSource={users} 
              loading={loading}
              rowKey="id"
              scroll={{ x: 800 }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`
              }}
            />
          </Card>
        </TabPane>
        
        <TabPane tab="Roles" key="roles">
          <Card>
            <Space style={{ marginBottom: 16 }}>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={() => setRoleModalVisible(true)}
              >
                Create Role
              </Button>
            </Space>
            <Table 
              columns={[
                { title: 'Role Name', dataIndex: 'name', key: 'name' },
                { title: 'Status', dataIndex: 'status', key: 'status',
                  render: (status) => (
                    <Tag color={status === 'active' ? 'green' : 'red'}>
                      {status?.toUpperCase() || 'ACTIVE'}
                    </Tag>
                  )
                },
                { title: 'Permissions', dataIndex: 'permissions', key: 'permissions',
                  render: (permissions) => (
                    <Space wrap>
                      {Object.keys(permissions).map(perm => (
                        <Tag key={perm} color="blue">{perm}</Tag>
                      ))}
                    </Space>
                  )
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  render: (_, record) => (
                    <Space>
                      <Button 
                        icon={<EditOutlined />} 
                        size="small"
                        onClick={() => editRole(record)}
                        disabled={record.name === 'admin'}
                      >
                        Edit
                      </Button>
                      {record.name !== 'admin' && (
                        <Button 
                          type={record.status === 'active' ? 'default' : 'primary'}
                          size="small"
                          onClick={() => toggleRoleStatus(record)}
                        >
                          {record.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                      )}
                    </Space>
                  )
                }
              ]}
              dataSource={roles} 
              rowKey="name"
            />
          </Card>
        </TabPane>
      </Tabs>

      <Modal
        title={editingUser ? 'Edit User Permissions' : 'Create New User'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingUser(null);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={editingUser ? handleUpdatePermissions : handleCreateUser}
        >
          {!editingUser && (
            <>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[{ required: true, message: 'Please input first name!' }]}
              >
                <Input placeholder="Enter first name" />
              </Form.Item>
              
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[{ required: true, message: 'Please input last name!' }]}
              >
                <Input placeholder="Enter last name" />
              </Form.Item>
              
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: 'Please input email!' },
                  { type: 'email', message: 'Please enter valid email!' }
                ]}
              >
                <Input placeholder="Enter email address" />
              </Form.Item>
              
              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: 'Please input password!' },
                  { min: 8, message: 'Password must be at least 8 characters!' }
                ]}
              >
                <Input.Password placeholder="Enter password" />
              </Form.Item>
            </>
          )}
          
          <Form.Item
            name="role"
            label="Role"
            rules={[{ required: true, message: 'Please select role!' }]}
          >
            <Select placeholder="Select role">
              {roles.map(role => (
                <Select.Option key={role.name} value={role.name}>
                  {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="warehouseAccess" label="Warehouse Access">
            <Select 
              mode="multiple" 
              placeholder="Select warehouses (empty = all warehouses)"
              allowClear
            >
              {warehouses.map(warehouse => (
                <Select.Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingUser ? 'Update Permissions' : 'Create User'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingUser(null);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Role Management Modal */}
      <Modal
        title={editingRole ? 'Edit Role' : 'Create New Role'}
        open={roleModalVisible}
        onCancel={() => {
          setRoleModalVisible(false);
          setEditingRole(null);
          roleForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={roleForm}
          layout="vertical"
          onFinish={editingRole ? handleUpdateRole : handleCreateRole}
        >
          <Form.Item
            name="roleName"
            label="Role Name"
            rules={[{ required: true, message: 'Please input role name!' }]}
          >
            <Input placeholder="Enter role name" disabled={editingRole?.name === 'admin'} />
          </Form.Item>
          
          <Form.Item
            name="permissions"
            label="Permissions"
            rules={[{ required: true, message: 'Please select permissions!' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #e9ecef',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {availablePermissions.map(perm => (
                  <div key={perm.key} style={{
                    padding: '12px 16px',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e1e5e9',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    ':hover': {
                      borderColor: '#1890ff',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }
                  }}>
                    <Checkbox value={perm.key} style={{ width: '100%' }}>
                      <div style={{ marginLeft: '8px' }}>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '600',
                          color: '#262626',
                          marginBottom: '2px'
                        }}>
                          {perm.label}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#8c8c8c'
                        }}>
                          {perm.key}
                        </div>
                      </div>
                    </Checkbox>
                  </div>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
              <Button onClick={() => {
                setRoleModalVisible(false);
                setEditingRole(null);
                roleForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Temporary Access Modal */}
      <Modal
        title="Generate Temporary Access"
        open={tempAccessModalVisible}
        onCancel={() => {
          setTempAccessModalVisible(false);
          setSelectedUser(null);
          setTempAccessData(null);
          tempAccessForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        {!tempAccessData ? (
          <Form
            form={tempAccessForm}
            layout="vertical"
            onFinish={handleGenerateTempAccess}
          >
            <Alert
              message="Generate Temporary Access"
              description={`This will generate a temporary password for ${selectedUser?.first_name} ${selectedUser?.last_name} (${selectedUser?.email}) that allows admin access to their account.`}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Form.Item
              name="expiresInHours"
              label="Expires In (Hours)"
              rules={[{ required: true, message: 'Please select expiry time!' }]}
            >
              <Select>
                <Select.Option value={1}>1 Hour</Select.Option>
                <Select.Option value={4}>4 Hours</Select.Option>
                <Select.Option value={8}>8 Hours</Select.Option>
                <Select.Option value={24}>24 Hours</Select.Option>
                <Select.Option value={72}>72 Hours</Select.Option>
              </Select>
            </Form.Item>
            
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Generate Temporary Access
                </Button>
                <Button onClick={() => {
                  setTempAccessModalVisible(false);
                  setSelectedUser(null);
                  tempAccessForm.resetFields();
                }}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div>
            <Alert
              message="Temporary Access Generated"
              description="Share these credentials securely with the admin who needs access."
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>User Email:</Text>
                <Paragraph copyable>{selectedUser?.email}</Paragraph>
              </div>
              
              <div>
                <Text strong>Temporary Password:</Text>
                <Paragraph copyable code>{tempAccessData.tempPassword}</Paragraph>
              </div>
              
              <div>
                <Text strong>Expires At:</Text>
                <Text> {new Date(tempAccessData.expiresAt).toLocaleString()}</Text>
              </div>
              
              <Alert
                message="Important Security Notes"
                description={
                  <ul>
                    <li>This password can only be used once</li>
                    <li>It expires automatically at the specified time</li>
                    <li>The session will be limited to 2 hours</li>
                    <li>All actions will be logged for audit purposes</li>
                  </ul>
                }
                type="info"
                showIcon
              />
            </Space>
            
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button onClick={() => {
                setTempAccessModalVisible(false);
                setSelectedUser(null);
                setTempAccessData(null);
                tempAccessForm.resetFields();
              }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Users;