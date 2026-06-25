import React from 'react';
import { Card } from 'antd';
import { BuildOutlined } from '@ant-design/icons';
import { BatchRulesPanel } from '../../components/production/BatchRulesModal';

export default function BatchRulesPage() {
  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100vh' }}>
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: 16,
          padding: '22px 28px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.35)',
        }}
      >
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
          <BuildOutlined style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>Batch coding rules</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, maxWidth: 640 }}>
            Configure how lot / batch numbers are generated for kit assembly, opening stock, disassembly, and general receiving.
            Rules are private to your organization.
          </div>
        </div>
      </div>

      <Card variant="borderless" style={{ borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <BatchRulesPanel active />
      </Card>
    </div>
  );
}
