import React from 'react';
import { Col, Collapse, DatePicker, Form, Input, Row } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { getDocumentMetaProfile } from '../../constants/documentMetaFields';

const { TextArea } = Input;

/**
 * Optional document fields (nested under form name "documentMeta").
 * @param {string} docType - salesInvoice | purchaseInvoice | salesOrder | purchaseOrder
 */
const DocumentMetaFields = ({
  docType = 'salesInvoice',
  namePrefix = 'documentMeta',
  defaultActive = false,
}) => {
  const profile = getDocumentMetaProfile(docType);

  const fields = (
    <Row gutter={[12, 0]}>
      {profile.fields.map((f) => (
        <Col xs={24} sm={f.span >= 24 ? 24 : 12} md={f.span} key={f.key}>
          <Form.Item
            name={[namePrefix, f.key]}
            label={f.label}
            style={{ marginBottom: 12 }}
          >
            {f.textarea ? (
              <TextArea rows={2} placeholder="Optional" allowClear />
            ) : f.date ? (
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" allowClear />
            ) : (
              <Input placeholder="Optional" allowClear />
            )}
          </Form.Item>
        </Col>
      ))}
    </Row>
  );

  return (
    <Collapse
      ghost
      defaultActiveKey={defaultActive ? ['meta'] : []}
      style={{ marginBottom: 16, background: '#fafafa', borderRadius: 8 }}
      items={[
        {
          key: 'meta',
          label: (
            <span>
              <FileTextOutlined style={{ marginRight: 8 }} />
              {profile.panelLabel}
            </span>
          ),
          children: fields,
        },
      ]}
    />
  );
};

export default DocumentMetaFields;
