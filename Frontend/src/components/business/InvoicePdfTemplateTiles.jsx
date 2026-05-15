import React from 'react';
import { Row, Col, Card, Button, Typography, Space } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
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

const THUMB = {
  classic: ThumbnailClassic,
  minimal: ThumbnailMinimal,
  modern: ThumbnailModern,
};

const InvoicePdfTemplateTiles = ({ value, onChange, onPreviewPdf }) => {
  return (
    <Row gutter={[12, 12]}>
      {INVOICE_PDF_TEMPLATES.map((t) => {
        const selected = value === t.id;
        const Thumb = THUMB[t.id] || ThumbnailClassic;
        return (
          <Col xs={24} md={8} key={t.id}>
            <Card
              size="small"
              hoverable
              onClick={() => onChange(t.id)}
              styles={{
                body: { padding: 12 },
              }}
              style={{
                cursor: 'pointer',
                borderColor: selected ? '#1677ff' : undefined,
                borderWidth: selected ? 2 : 1,
                boxShadow: selected ? '0 0 0 1px rgba(22,119,255,0.2)' : undefined,
              }}
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
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
                    onPreviewPdf(t.id);
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
  );
};

export default InvoicePdfTemplateTiles;
