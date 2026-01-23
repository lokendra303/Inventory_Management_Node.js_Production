import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message, Row, Col } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, ShopOutlined, PhoneOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const onLogin = async (values) => {
    setLoading(true);
    try {
      const result = await login(values);
      if (result.success) {
        // Always redirect to dashboard on successful login
        navigate('/dashboard', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values) => {
    setLoading(true);
    try {
      const result = await register(values);
      if (result.success) {
        setActiveTab('login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <Row justify="center" style={{ width: '100%' }}>
        <Col xs={24} sm={20} md={16} lg={12} xl={8}>
          <Card
            style={{
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
              borderRadius: '10px'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: 'bold',
                color: '#1890ff',
                marginBottom: '8px'
              }}>
                IMS SEPCUNE
              </h1>
              <p style={{ color: '#666', fontSize: '16px' }}>
                Inventory Management System
              </p>
            </div>

            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              centered
              size="large"
              items={[
                {
                  key: 'login',
                  label: 'Login',
                  children: (
                    <Form
                      name="login"
                      onFinish={onLogin}
                      layout="vertical"
                      size="large"
                    >
                      <Form.Item
                        name="email"
                        rules={[
                          { required: true, message: 'Please input your email!' },
                          { type: 'email', message: 'Please enter a valid email!' }
                        ]}
                      >
                        <Input 
                          prefix={<MailOutlined />} 
                          placeholder="Email"
                        />
                      </Form.Item>

                      <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your password!' }]}
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="Password"
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button 
                          type="primary" 
                          htmlType="submit" 
                          loading={loading}
                          block
                          style={{ height: '45px', fontSize: '16px' }}
                        >
                          Sign In
                        </Button>
                      </Form.Item>
                    </Form>
                  )
                },
                {
                  key: 'register',
                  label: 'Register',
                  children: (
                    <Form
                      name="register"
                      onFinish={onRegister}
                      layout="vertical"
                      size="large"
                    >
                      <Form.Item
                        name="name"
                        rules={[{ required: true, message: 'Please input company name!' }]}
                      >
                        <Input 
                          prefix={<ShopOutlined />} 
                          placeholder="Company Name"
                        />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item
                            name="adminFirstName"
                            rules={[{ required: true, message: 'Please input first name!' }]}
                          >
                            <Input 
                              prefix={<UserOutlined />} 
                              placeholder="First Name"
                            />
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item
                            name="adminLastName"
                            rules={[{ required: true, message: 'Please input last name!' }]}
                          >
                            <Input 
                              prefix={<UserOutlined />} 
                              placeholder="Last Name"
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        name="adminMobile"
                        rules={[
                          { required: true, message: 'Please input mobile number!' },
                          { pattern: /^[0-9+\-\s()]{10,20}$/, message: 'Please enter a valid mobile number!' }
                        ]}
                      >
                        <Input 
                          prefix={<PhoneOutlined />} 
                          placeholder="Mobile Number"
                        />
                      </Form.Item>

                      <Form.Item
                        name="adminEmail"
                        rules={[
                          { required: true, message: 'Please input admin email!' },
                          { type: 'email', message: 'Please enter a valid email!' }
                        ]}
                      >
                        <Input 
                          prefix={<MailOutlined />} 
                          placeholder="Admin Email"
                        />
                      </Form.Item>

                      <Form.Item
                        name="adminPassword"
                        rules={[
                          { required: true, message: 'Please input password!' },
                          { min: 8, message: 'Password must be at least 8 characters!' }
                        ]}
                      >
                        <Input.Password 
                          prefix={<LockOutlined />} 
                          placeholder="Password (min 8 characters)"
                        />
                      </Form.Item>

                      <Form.Item>
                        <Button 
                          type="primary" 
                          htmlType="submit" 
                          loading={loading}
                          block
                          style={{ height: '45px', fontSize: '16px' }}
                        >
                          Create Account
                        </Button>
                      </Form.Item>
                    </Form>
                  )
                }
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Login;