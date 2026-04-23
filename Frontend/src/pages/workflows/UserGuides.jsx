import React, { useMemo, useState } from 'react';
import { Card, Alert, Row, Col, Tag, Input, Empty, Typography, Divider, Collapse, Button, Tooltip } from 'antd';
import { BookOutlined, CheckCircleOutlined, ShoppingCartOutlined, ShopOutlined, TagsOutlined, SearchOutlined, DownOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { SalesOrderFlow, PurchaseOrderFlow, PriceListFlow } from './ProcessGuides.jsx';
const { Title, Text } = Typography;

const WorkflowGuide = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <Alert
      type="info"
      showIcon
      message="How Workflow Automation works"
      description="A rule runs automatically when its trigger event happens in backend code, the rule is active, and all conditions match the event data."
    />

    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
      title="1) Rule lifecycle (automatic execution)">
      <div style={{ lineHeight: 1.8, color: '#434343' }}>
        <div><strong>Step 1:</strong> Create a rule (module + trigger event + conditions + actions).</div>
        <div><strong>Step 2:</strong> Backend raises an event (example: <code>stock_received</code>).</div>
        <div><strong>Step 3:</strong> System loads active rules for that event and checks conditions.</div>
        <div><strong>Step 4:</strong> If conditions match, actions execute in order.</div>
        <div><strong>Step 5:</strong> System writes execution result into <code>workflow_logs</code> and increments run count.</div>
      </div>
    </Card>

    <Row gutter={16}>
      <Col xs={24} md={12}>
        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
          title="2) What is Execution Log?">
          <div style={{ lineHeight: 1.8, color: '#434343' }}>
            <div>Execution Log is the history of each rule run attempt.</div>
            <div>Each row includes:</div>
            <ul style={{ marginTop: 8, marginBottom: 0 }}>
              <li>rule name (<code>rule_name</code>)</li>
              <li>status (<code>success</code> / <code>partial</code>)</li>
              <li>error (if any action fails)</li>
              <li>execution time (<code>executed_at</code>)</li>
            </ul>
          </div>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
          title="3) Current supported automatic triggers">
          <div style={{ lineHeight: 1.8, color: '#434343' }}>
            <div><Tag color="green">stock_received</Tag> Fired after inventory receive flow.</div>
            <div><Tag color="blue">stock_adjusted</Tag> Fired after inventory adjustment flow.</div>
            <div style={{ marginTop: 8, color: '#8c8c8c' }}>
              Other trigger labels are roadmap-ready and may not auto-fire until backend integration is added.
            </div>
          </div>
        </Card>
      </Col>
    </Row>

    <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}
      title="4) Condition and action behavior">
      <div style={{ lineHeight: 1.8, color: '#434343' }}>
        <div><strong>Condition logic:</strong> all conditions must match (AND logic).</div>
        <div><strong>Operators:</strong> equals, not_equals, greater_than, less_than, contains.</div>
        <div><strong>Actions currently available:</strong> send notification, update status.</div>
        <div><strong>Failure handling:</strong> workflow trigger is non-fatal; main business operation still completes.</div>
      </div>
    </Card>
  </div>
);

export default function UserGuides() {
  const guides = useMemo(() => ([
    {
      key: 'workflow-guide',
      title: 'Workflow Guide',
      category: 'Automation',
      keywords: ['workflow', 'rules', 'execution', 'logs', 'automation'],
      icon: <CheckCircleOutlined />,
      component: <WorkflowGuide />,
    },
    {
      key: 'so-flow',
      title: 'Sales Order Flow',
      category: 'Operations',
      keywords: ['sales', 'order', 'delivery', 'invoice', 'payment'],
      icon: <ShoppingCartOutlined />,
      component: <SalesOrderFlow />,
    },
    {
      key: 'po-flow',
      title: 'Purchase Order Flow',
      category: 'Operations',
      keywords: ['purchase', 'po', 'grn', 'vendor', 'payment'],
      icon: <ShopOutlined />,
      component: <PurchaseOrderFlow />,
    },
    {
      key: 'price-list-flow',
      title: 'Price List Flow',
      category: 'Masters',
      keywords: ['price', 'list', 'discount', 'customer pricing'],
      icon: <TagsOutlined />,
      component: <PriceListFlow />,
    },
  ]), []);

  const categories = useMemo(() => Array.from(new Set(guides.map(g => g.category))), [guides]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [selectedGuideKey, setSelectedGuideKey] = useState(guides[0]?.key || '');
  const [openSections, setOpenSections] = useState(['Automation', 'Operations', 'Masters']);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);

  const filteredGuides = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return guides.filter(g => {
      const categoryOk = selectedCategory === 'All' || g.category === selectedCategory;
      if (!categoryOk) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q) ||
        g.keywords.some(k => k.toLowerCase().includes(q))
      );
    });
  }, [guides, selectedCategory, searchText]);

  const groupedGuides = useMemo(() => {
    const byCat = {};
    for (const cat of categories) byCat[cat] = [];
    filteredGuides.forEach(g => {
      if (!byCat[g.category]) byCat[g.category] = [];
      byCat[g.category].push(g);
    });
    return byCat;
  }, [categories, filteredGuides]);

  const selectedGuide = useMemo(() => {
    const fromFiltered = filteredGuides.find(g => g.key === selectedGuideKey);
    if (fromFiltered) return fromFiltered;
    return filteredGuides[0] || null;
  }, [filteredGuides, selectedGuideKey]);

  return (
    <div style={{ padding: 24, background: '#f5f6fa', minHeight: '100vh' }}>
      <div style={{
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 14
      }}>
        <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 14px' }}>
          <BookOutlined style={{ fontSize: 28, color: '#fff' }} />
        </div>
        <div>
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>User Guide</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
            Centralized guides for workflow automation and key business flows
          </div>
        </div>
      </div>

      <Row gutter={16}>
        {!leftPanelCollapsed && (
        <Col xs={24} lg={8} xl={7}>
          <Card
            bordered={false}
            style={{
              borderRadius: 14,
              boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
              marginBottom: 16,
              position: 'sticky',
              top: 12
            }}
          >
            <Title level={5} style={{ marginBottom: 4 }}>Find a guide</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Search by process name, module, or keyword.
            </Text>
            <Input
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search guide..."
              prefix={<SearchOutlined />}
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <Tag
                onClick={() => setSelectedCategory('All')}
                color={selectedCategory === 'All' ? 'blue' : 'default'}
                style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: 14 }}
              >
                All
              </Tag>
              {categories.map(cat => (
                <Tag
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  color={selectedCategory === cat ? 'blue' : 'default'}
                  style={{ cursor: 'pointer', padding: '4px 10px', borderRadius: 14 }}
                >
                  {cat}
                </Tag>
              ))}
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto', display: 'grid', gap: 8 }}>
              <Collapse
                ghost
                activeKey={openSections}
                onChange={(keys) => setOpenSections(Array.isArray(keys) ? keys : [keys])}
                expandIcon={({ isActive }) => (
                  <DownOutlined style={{ fontSize: 11, color: '#8c8c8c', transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                )}
                items={Object.entries(groupedGuides)
                  .filter(([, items]) => items.length > 0)
                  .map(([cat, items]) => ({
                    key: cat,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#8c8c8c', letterSpacing: 0.4 }}>
                          {cat.toUpperCase()}
                        </span>
                        <Tag style={{ margin: 0 }}>{items.length}</Tag>
                      </div>
                    ),
                    children: (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {items.map(g => {
                          const isActive = selectedGuide?.key === g.key;
                          return (
                            <div
                              key={g.key}
                              onClick={() => setSelectedGuideKey(g.key)}
                              style={{
                                cursor: 'pointer',
                                borderRadius: 12,
                                padding: '12px 12px',
                                border: isActive ? '1px solid #667eea' : '1px solid #ececec',
                                background: isActive ? 'linear-gradient(135deg,rgba(102,126,234,0.12),rgba(118,75,162,0.08))' : '#fff',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 16 }}>{g.icon}</span>
                                <div>
                                  <div style={{ fontWeight: 700, color: '#262626' }}>{g.title}</div>
                                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>{g.keywords.slice(0, 3).join(' • ')}</div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  }))}
              />
              <Divider style={{ margin: '8px 0 0' }} />

              {filteredGuides.length === 0 && (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No guide found for current filter"
                  style={{ marginTop: 20 }}
                />
              )}
            </div>
          </Card>
        </Col>
        )}

        <Col xs={24} lg={leftPanelCollapsed ? 24 : 16} xl={leftPanelCollapsed ? 24 : 17}>
          <Card bordered={false} style={{ borderRadius: 14, boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
              <Tooltip title={leftPanelCollapsed ? 'Show guide list' : 'Hide guide list'}>
                <Button
                  icon={leftPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setLeftPanelCollapsed(v => !v)}
                >
                  {leftPanelCollapsed ? 'Show Navigator' : 'Hide Navigator'}
                </Button>
              </Tooltip>
            </div>
            {selectedGuide && (
              <div style={{ marginBottom: 14 }}>
                <Title level={4} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedGuide.icon} {selectedGuide.title}
                </Title>
                <Text type="secondary">
                  Category: {selectedGuide.category}
                </Text>
                <Divider style={{ margin: '12px 0 4px' }} />
              </div>
            )}
            {selectedGuide ? selectedGuide.component : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Select a guide from the left panel"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
