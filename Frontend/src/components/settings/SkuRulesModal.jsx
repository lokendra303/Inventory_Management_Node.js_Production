import React from 'react';
import { Modal } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { SkuRulesPanel } from './SkuRulesPanel';

export default function SkuRulesModal({ open, onClose }) {
  return (
    <Modal
      title={(
        <span>
          <ThunderboltOutlined style={{ color: '#764ba2', marginRight: 8 }} />
          Manage SKU Rules
        </span>
      )}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1200px, 98vw)"
      style={{ top: 8 }}
      styles={{
        body: {
          background: '#f8f9ff',
          borderRadius: '0 0 12px 12px',
          maxHeight: '86vh',
          overflowY: 'auto',
          padding: 16,
        },
      }}
      destroyOnClose
      zIndex={1100}
    >
      {open ? <SkuRulesPanel active /> : null}
    </Modal>
  );
}
