import React from 'react';
import { Modal, Typography } from 'antd';
import { UserSwitchOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

let sessionModalOpen = false;

function openSessionModal(config) {
  if (sessionModalOpen) return;
  sessionModalOpen = true;

  const goLogin = () => {
    sessionModalOpen = false;
    window.location.href = '/';
  };

  Modal.info({
    centered: true,
    maskClosable: false,
    okText: 'Sign in again',
    onOk: goLogin,
    afterClose: () => { sessionModalOpen = false; },
    ...config,
  });
}

/** Set on axios errors when the global interceptor already showed a session modal. */
export function isSessionHandled(error) {
  return Boolean(error?.sessionHandled);
}

export function showSessionRevokedModal(onRedirect) {
  openSessionModal({
    title: 'You have been signed out',
    icon: <UserSwitchOutlined style={{ color: '#1677ff', fontSize: 22 }} />,
    width: 440,
    content: (
      <>
        <Paragraph style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.88)' }}>
          A platform administrator ended your active session. This is a routine security action — not an error with your account.
        </Paragraph>
        <Text type="secondary">Sign in again when you are ready to continue.</Text>
      </>
    ),
    onOk: () => {
      sessionModalOpen = false;
      (onRedirect || (() => { window.location.href = '/'; }))();
    },
  });
}

export function showSessionExpiredModal(onRedirect) {
  openSessionModal({
    title: 'Your session timed out',
    icon: <ClockCircleOutlined style={{ color: '#1677ff', fontSize: 22 }} />,
    width: 440,
    content: (
      <>
        <Paragraph style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.88)' }}>
          You were signed out after a period of inactivity. This is normal — your data is safe.
        </Paragraph>
        <Text type="secondary">Sign in again to pick up where you left off.</Text>
      </>
    ),
    onOk: () => {
      sessionModalOpen = false;
      (onRedirect || (() => { window.location.href = '/'; }))();
    },
  });
}
