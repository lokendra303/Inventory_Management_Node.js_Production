import React from 'react';
import { Alert, Button, Collapse, Input, Radio, Space, Table, Tag, Typography } from 'antd';
import { MergeCellsOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const DEFAULT_PLAN = { mode: 'merge', selectedRowIndex: null, note: '' };

const MATCH_TYPE_LABELS = {
  sku: 'Same SKU',
  name: 'Same name',
  description: 'Same description',
  linked: 'Linked rows',
};

function getGroupPlan(plans, groupKey, defaultRowIndex) {
  const p = plans?.[groupKey];
  if (p) {
    return {
      mode: p.mode === 'pick_one' ? 'pick_one' : 'merge',
      selectedRowIndex: p.selectedRowIndex != null ? p.selectedRowIndex : defaultRowIndex,
      note: p.note || '',
    };
  }
  return { ...DEFAULT_PLAN, selectedRowIndex: defaultRowIndex };
}

function groupIsResolved(group, addedRowIndexes, supersededRowIndexes) {
  return group.rowIndexes.every(
    (i) => addedRowIndexes[String(i)] || supersededRowIndexes[String(i)]
  );
}

export function ImportDuplicateGroupsPanel({
  groups = [],
  duplicateGroupPlans = {},
  addedRowIndexes = {},
  supersededRowIndexes = {},
  disabled = false,
  canManageItems = false,
  onPlanChange,
  onAddInForm,
}) {
  const pendingGroups = groups.filter(
    (g) => !groupIsResolved(g, addedRowIndexes, supersededRowIndexes)
  );

  if (!groups.length) return null;

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Duplicate item groups ({pendingGroups.length} pending / {groups.length} total)
      </Text>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Rows match by SKU, item name, or description"
        description="Two or more rows are grouped when they share the same SKU, the same item name, or the same description text (case-insensitive). Choose how to save each group: merge opening quantities into one item, use a single row only, or add an optional note (included in the item description)."
      />
      <Collapse
        accordion={groups.length > 3}
        items={groups.map((group) => {
          const resolved = groupIsResolved(group, addedRowIndexes, supersededRowIndexes);
          const defaultRow = group.rowIndexes[0];
          const plan = getGroupPlan(duplicateGroupPlans, group.groupKey, defaultRow);
          const primaryIndex = plan.selectedRowIndex ?? defaultRow;
          const matchTags = (group.matchTypes || []).map((t) => MATCH_TYPE_LABELS[t] || t);

          return {
            key: group.groupKey,
            label: (
              <Space wrap size={[8, 4]}>
                <Text strong>{group.label || 'Duplicate group'}</Text>
                {matchTags.map((t) => (
                  <Tag key={t} color="purple">
                    {t}
                  </Tag>
                ))}
                <Tag>{group.rowIndexes.length} rows</Tag>
                {group.totalOpeningStock > 0 && (
                  <Tag color="blue">Combined qty: {group.totalOpeningStock}</Tag>
                )}
                {resolved ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>
                    Resolved
                  </Tag>
                ) : (
                  <Tag color="warning">Needs action</Tag>
                )}
              </Space>
            ),
            children: (
              <div>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="rowIndex"
                  dataSource={group.details}
                  columns={[
                    {
                      title: 'Line',
                      dataIndex: 'sourceLine',
                      width: 64,
                      render: (v) => (v != null ? v : '—'),
                    },
                    { title: 'SKU', dataIndex: 'sku', width: 100, ellipsis: true, render: (v) => v || '—' },
                    { title: 'Name', dataIndex: 'name', ellipsis: true, render: (v) => v || '—' },
                    {
                      title: 'Description',
                      dataIndex: 'description',
                      ellipsis: true,
                      render: (v) => v || '—',
                    },
                    {
                      title: 'Opening qty',
                      dataIndex: 'openingStock',
                      width: 100,
                      render: (v) => (v == null ? '—' : v),
                    },
                    {
                      title: 'Status',
                      key: 'st',
                      width: 100,
                      render: (_, d) => {
                        if (addedRowIndexes[String(d.rowIndex)]) {
                          return <Tag color="success">Added</Tag>;
                        }
                        if (supersededRowIndexes[String(d.rowIndex)]) {
                          return <Tag>Skipped</Tag>;
                        }
                        return <Tag color="processing">Pending</Tag>;
                      },
                    },
                  ]}
                />

                {!resolved && (
                  <>
                    <div style={{ marginTop: 12, marginBottom: 8, fontWeight: 600, fontSize: 12 }}>
                      How should this group be saved?
                    </div>
                    <Radio.Group
                      value={plan.mode}
                      disabled={disabled}
                      onChange={(e) => {
                        onPlanChange(group.groupKey, {
                          mode: e.target.value,
                          selectedRowIndex: primaryIndex,
                        });
                      }}
                    >
                      <Space direction="vertical" size={4}>
                        <Radio value="merge">
                          <MergeCellsOutlined style={{ marginRight: 6 }} />
                          Merge into one item (sum opening quantities: {group.totalOpeningStock})
                        </Radio>
                        <Radio value="pick_one">Use one row only (other rows marked skipped)</Radio>
                      </Space>
                    </Radio.Group>

                    {plan.mode === 'pick_one' && (
                      <div style={{ marginTop: 10 }}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                          Select which row to import
                        </Text>
                        <Radio.Group
                          value={primaryIndex}
                          disabled={disabled}
                          onChange={(e) => {
                            onPlanChange(group.groupKey, { selectedRowIndex: e.target.value });
                          }}
                        >
                          <Space direction="vertical" size={2}>
                            {group.details.map((d) => (
                              <Radio key={d.rowIndex} value={d.rowIndex}>
                                Line {d.sourceLine ?? d.rowIndex + 1}: {d.name || '(no name)'}
                                {d.openingStock != null ? ` — qty ${d.openingStock}` : ''}
                              </Radio>
                            ))}
                          </Space>
                        </Radio.Group>
                      </div>
                    )}

                    {plan.mode === 'merge' && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        Field values come from line{' '}
                        {group.details.find((d) => d.rowIndex === primaryIndex)?.sourceLine
                          ?? primaryIndex + 1}
                        ; opening stock and value are summed across all rows in this group.
                      </Text>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        Note (optional — appended to item description)
                      </Text>
                      <Input.TextArea
                        rows={2}
                        disabled={disabled}
                        placeholder="e.g. Combined from warehouse count sheets"
                        value={plan.note}
                        onChange={(e) => onPlanChange(group.groupKey, { note: e.target.value })}
                      />
                    </div>

                    <Button
                      type="primary"
                      style={{ marginTop: 12 }}
                      disabled={disabled || !canManageItems}
                      onClick={() => onAddInForm(group, plan)}
                    >
                      {plan.mode === 'merge' ? 'Add merged item in form' : 'Add selected row in form'}
                    </Button>
                  </>
                )}
              </div>
            ),
          };
        })}
      />
    </div>
  );
}
