import React from 'react';
import { Modal, Typography } from 'antd';
import { UserSwitchOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

export function showSessionRevokedModal(onRedirect) {
  const goLogin = onRedirect || (() => { window.location.href = '/'; });

  Modal.info({
    title: 'You have been signed out',
    icon: <UserSwitchOutlined style={{ color: '#1677ff', fontSize: 22 }} />,
    okText: 'Sign in again',
    centered: true,
    maskClosable: false,
    width: 440,
    content: (
      <>
        <Paragraph style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.88)' }}>
          A platform administrator ended your active session. This is a routine security action — not an error with your account.
        </Paragraph>
        <Text type="secondary">Sign in again when you are ready to continue.</Text>
      </>
    ),
    onOk: goLogin,
  });
}

export function showSessionExpiredModal(onRedirect) {
  const goLogin = onRedirect || (() => { window.location.href = '/'; });

  Modal.warning({
    title: 'Session expired',
    content: 'Your session has expired due to inactivity. Please sign in again.',
    okText: 'Sign in again',
    onOk: goLogin,
    centered: true,
    maskClosable: false,
  });
}
