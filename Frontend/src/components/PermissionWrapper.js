import React from 'react';
import { Result, Button } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

// Permission checker hook
export const usePermissions = () => {
  const { user } = useAuth();
  
  const hasPermission = (permission) => {
    if (!user?.permissions) return false;
    return user.permissions.all || user.permissions[permission];
  };

  const hasAnyPermission = (permissions) => {
    return permissions.some(permission => hasPermission(permission));
  };

  return { hasPermission, hasAnyPermission, user };
};

// Permission wrapper component
export const PermissionWrapper = ({ 
  permission, 
  permissions, 
  children, 
  fallback = null,
  showError = false 
}) => {
  const { hasPermission, hasAnyPermission } = usePermissions();
  const navigate = useNavigate();

  let hasAccess = false;
  
  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = hasAnyPermission(permissions);
  }

  if (!hasAccess) {
    if (showError) {
      return (
        <Result
          status="403"
          title="403"
          subTitle="Sorry, you are not authorized to access this page."
          extra={
            <Button type="primary" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          }
        />
      );
    }
    return fallback;
  }

  return children;
};

// Higher-order component for page protection
export const withPermission = (permission, permissions) => (Component) => {
  return (props) => (
    <PermissionWrapper 
      permission={permission} 
      permissions={permissions}
      showError={true}
    >
      <Component {...props} />
    </PermissionWrapper>
  );
};

export default PermissionWrapper;