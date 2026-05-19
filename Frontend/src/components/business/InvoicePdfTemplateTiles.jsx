import React from 'react';
import { Row, Col, Card, Button, Typography, Space, Radio, Tag } from 'antd';
import { CheckCircleFilled, FilePdfOutlined } from '@ant-design/icons';
import { INVOICE_PDF_TEMPLATES } from '../../constants/invoicePdfTemplates';

const { Text, Paragraph } = Typography;

function ThumbnailClassic() {
  return (
    <div style={{ height: 72, background: '#fafafa', borderRadius: 4, padding: 6, display: 'flex', gap: 8 }}>
      <div style={{ width: 28, height: 22, background: '#d9d9d9', borderRadius: 2 }} />
      <div style={{ flex: 1, textAlign: 'right' }}>
        <div style={{ height: 6, background: '#434343', borderRadius: 1, marginBottom: 4, marginLeft: 24 }} />
        <div style={{ height: 4, background: '#bfbfbf', borderRadius: 1, marginBottom: 3, marginLeft: 16 }} />
        <div style={{ height: 4, background: '#bfbfbf', borderRadius: 1, marginLeft: 20 }} />
      </div>
    </div>
  );
}

function ThumbnailMinimal() {
  return (
    <div style={{ height: 72, background: '#fafafa', borderRadius: 4, padding: 8 }}>
      <div style={{ height: 7, background: '#434343', borderRadius: 1, width: '55%', marginBottom: 6 }} />
      <div style={{ height: 4, background: '#d9d9d9', borderRadius: 1, width: '85%', marginBottom: 8 }} />
      <div style={{ height: 4, background: '#bfbfbf', borderRadius: 1, width: '40%', marginBottom: 10 }} />
      <div style={{ height: 22, background: '#ececec', borderRadius: 2 }} />
    </div>
  );
}

function ThumbnailModern() {
  return (
    <div style={{ height: 72, borderRadius: 4, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      <div style={{ height: 26, background: '#1e3a5f' }} />
      <div style={{ padding: 6, background: '#fff' }}>
        <div style={{ height: 28, border: '1px solid #cbd5e1', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function ThumbnailProforma() {
  return (
    <div style={{ height: 72, background: '#fff', borderRadius: 4, padding: 4, border: '1px solid #d9d9d9' }}>
      <div style={{ height: 8, background: '#434343', marginBottom: 3, width: '50%', marginLeft: '25%' }} />
      <div style={{ display: 'flex', gap: 2, height: 28, marginBottom: 3 }}>
        <div style={{ flex: 1.2, border: '1px solid #999' }} />
        <div style={{ flex: 0.8, border: '1px solid #999' }} />
      </div>
      <div style={{ height: 10, border: '1px solid #999', marginBottom: 2 }} />
      <div style={{ height: 18, border: '1px solid #999' }} />
    </div>
  );
}

function ThumbnailBranded() {
  return (
    <div style={{ height: 72, background: '#fafafa', borderRadius: 4, padding: 6 }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <div style={{ width: 22, height: 22, background: '#0099DD', borderRadius: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 5, background: '#434343', width: '70%', marginBottom: 3 }} />
          <div style={{ height: 3, background: '#bfbfbf', width: '50%' }} />
        </div>
        <div
          style={{
            width: 48,
            height: 18,
            background: '#4A4A4A',
            transform: 'skewX(-12deg)',
            borderLeft: '3px solid #0099DD',
          }}
        />
      </div>
      <div style={{ marginTop: 8, display: 'flex', height: 22 }}>
        <div style={{ flex: 1.2, background: '#0099DD', borderRadius: '1px 0 0 1px' }} />
        <div style={{ flex: 0.8, background: '#4A4A4A', borderRadius: '0 1px 1px 0' }} />
      </div>
    </div>
  );
}

const THUMB = {
  branded: ThumbnailBranded,
  classic: ThumbnailClassic,
  minimal: ThumbnailMinimal,
  modern: ThumbnailModern,
  proforma: ThumbnailProforma,
};

/**
 * Form-controlled template picker (value + onChange from Form.Item).
 */
const InvoicePdfTemplateTiles = ({ value, onChange, onPreviewPdf }) => {
  const activeId = value || INVOICE_PDF_TEMPLATES[0]?.id;
  const activeMeta = INVOICE_PDF_TEMPLATES.find((t) => t.id === activeId);

  const handleSelect = (id) => {
    if (typeof onChange === 'function') {
      onChange(id);
    }
  };

  return (
    <div>
      {activeMeta && (
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">Current selection: </Text>
          <Tag icon={<CheckCircleFilled />} color="processing">
            {activeMeta.name}
          </Tag>
        </div>
      )}

      <Radio.Group
        value={activeId}
        onChange={(e) => handleSelect(e.target.value)}
        style={{ width: '100%' }}
      >
        <Row gutter={[12, 12]}>
          {INVOICE_PDF_TEMPLATES.map((t) => {
            const selected = activeId === t.id;
            const Thumb = THUMB[t.id] || ThumbnailClassic;
            return (
              <Col xs={24} sm={12} lg={6} key={t.id}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => handleSelect(t.id)}
                  styles={{ body: { padding: 12 } }}
                  style={{
                    cursor: 'pointer',
                    borderColor: selected ? '#1677ff' : '#d9d9d9',
                    borderWidth: selected ? 2 : 1,
                    background: selected ? '#f0f5ff' : '#fff',
                    boxShadow: selected ? '0 0 0 2px rgba(22,119,255,0.15)' : undefined,
                  }}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Radio value={t.id} onClick={(e) => e.stopPropagation()}>
                        <span style={{ fontWeight: selected ? 600 : 400 }}>{selected ? 'Selected' : 'Select'}</span>
                      </Radio>
                      {selected && (
                        <Tag color="blue" icon={<CheckCircleFilled />} style={{ margin: 0 }}>
                          Active
                        </Tag>
                      )}
                    </div>
                    <Thumb />
                    <div>
                      <Text strong>{t.name}</Text>
                      <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4, fontSize: 12 }}>
                        {t.description}
                      </Paragraph>
                    </div>
                    <Button
                      type="link"
                      size="small"
                      icon={<FilePdfOutlined />}
                      style={{ padding: 0, alignSelf: 'flex-start' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewPdf?.(t.id);
                      }}
                    >
                      Preview sample PDF
                    </Button>
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      </Radio.Group>
    </div>
  );
};

export default InvoicePdfTemplateTiles;

