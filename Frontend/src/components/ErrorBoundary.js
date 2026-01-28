import React from 'react';
import { Modal } from 'antd';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Check if it's a session-related error
    if (error.message?.includes('Failed to fetch') || 
        error.message?.includes('Network Error') ||
        error.message?.includes('401')) {
      
      const token = sessionStorage.getItem('token');
      if (token) {
        Modal.warning({
          title: 'Session Expired',
          content: 'Your session has expired. Please login again.',
          okText: 'Login',
          onOk: () => {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('lastActivity');
            window.location.href = '/';
          },
          centered: true,
          maskClosable: false,
        });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return null; // Don't render anything, let the modal handle it
    }

    return this.props.children;
  }
}

export default ErrorBoundary;