import React from 'react';
import { Alert, Button, Collapse, Input, Radio, Space, Table, Tag, Typography } from 'antd';
import { MergeCellsOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { CSV_IMPORT_PURPOSE_UPDATE } from './importConstants';
import {
  buildMergedImportQuantities,
  getImportGroupPendingRowIndexes,
  getImportGroupSelectedRowIndexes,
} from './importItemHelpers';

const { Text } = Typography;

const DEFAULT_PLAN = { mode: 'merge', selectedRowIndex: null, note: '' };

const MATCH_TYPE_LABELS = {
  sku: 'Same SKU',
  name: 'Same name',
  description: 'Same description',
  linked: 'Linked rows',
  catalog: 'Same catalog item',
};

function getGroupPlan(plans, groupKey, defaultRowIndex) {
  const p = plans?.[groupKey];
  if (p) {
    return {
      mode: p.mode === 'pick_one' ? 'pick_one' : 'merge',
      selectedRowIndex: p.selectedRowIndex != null ? p.selectedRowIndex : defaultRowIndex,
      note: p.note || '',
      selectedRowIndexes: p.selectedRowIndexes,
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
  rows = [],
  mapping = {},
  importDefaults = {},
  addedRowIndexes = {},
  supersededRowIndexes = {},
  disabled = false,
  canManageItems = false,
  importPurpose = 'create',
  onPlanChange,
  onAddInForm,
  onDirectUpdate,
}) {
  const isUpdateImport = importPurpose === CSV_IMPORT_PURPOSE_UPDATE;
  const pendingGroups = groups.filter(
    (g) => !groupIsResolved(g, addedRowIndexes, supersededRowIndexes)
  );

  if (!groups.length) return null;

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        {isUpdateImport
          ? `Same catalog item — multiple sheet rows (${pendingGroups.length} pending / ${groups.length} total)`
          : `Duplicate item groups (${pendingGroups.length} pending / ${groups.length} total)`}
      </Text>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message={
          isUpdateImport
            ? 'Multiple sheet rows update the same catalog item'
            : 'Duplicate rows in your uploaded file'
        }
        description={
          isUpdateImport
            ? 'These sheet rows all matched one existing item in your catalog. Merge quantities into a single update, or pick one row.'
            : 'Rows grouped when they share the same SKU, name, or description. Check rows to merge, sum opening quantities, and add one item.'
        }
      />
      <Collapse
        accordion={groups.length > 3}
        items={groups.map((group) => {
          const resolved = groupIsResolved(group, addedRowIndexes, supersededRowIndexes);
          const defaultRow = group.rowIndexes[0];
          const plan = getGroupPlan(duplicateGroupPlans, group.groupKey, defaultRow);
          const pendingRowIndexes = getImportGroupPendingRowIndexes(
            group,
            addedRowIndexes,
            supersededRowIndexes
          );
          const selectedRowIndexes = getImportGroupSelectedRowIndexes(
            group,
            plan,
            addedRowIndexes,
            supersededRowIndexes
          );
          const mergedQty = buildMergedImportQuantities(
            selectedRowIndexes,
            rows,
            mapping,
            importDefaults
          );
          const primaryIndex = (
            plan.selectedRowIndex != null && selectedRowIndexes.includes(plan.selectedRowIndex)
          )
            ? plan.selectedRowIndex
            : (selectedRowIndexes[0] ?? defaultRow);
          const matchTags = (group.matchTypes || []).map((t) => MATCH_TYPE_LABELS[t] || t);
          const mergePlan = { ...plan, selectedRowIndexes, selectedRowIndex: primaryIndex };
          const combinedQty = mergedQty.openingStock ?? group.totalOpeningStock;

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
                {!resolved && plan.mode === 'merge' && selectedRowIndexes.length > 0 && (
                  <Tag color="geekblue">{selectedRowIndexes.length} selected</Tag>
                )}
                {combinedQty > 0 && plan.mode === 'merge' && (
                  <Tag color="blue">Combined qty: {combinedQty}</Tag>
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
                {!resolved && plan.mode === 'merge' && pendingRowIndexes.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    Check rows to include in the merge. Unchecked rows can be added separately from the preview list.
                  </Text>
                )}
                <Table
                  size="small"
                  pagination={false}
                  rowKey="rowIndex"
                  dataSource={group.details}
                  rowSelection={!resolved && plan.mode === 'merge' && pendingRowIndexes.length > 0 ? {
                    selectedRowKeys: selectedRowIndexes,
                    onChange: (keys) => {
                      onPlanChange(group.groupKey, {
                        selectedRowIndexes: keys.map((k) => Number(k)),
                      });
                    },
                    getCheckboxProps: (record) => ({
                      disabled:
                        disabled
                        || !!addedRowIndexes[String(record.rowIndex)]
                        || !!supersededRowIndexes[String(record.rowIndex)],
                    }),
                  } : undefined}
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
                          return <Tag color="success">{isUpdateImport ? 'Updated' : 'Added'}</Tag>;
                        }
                        if (supersededRowIndexes[String(d.rowIndex)]) {
                          return <Tag>Skipped</Tag>;
                        }
                        if (plan.mode === 'merge' && !selectedRowIndexes.includes(d.rowIndex)) {
                          return <Tag>Not selected</Tag>;
                        }
                        return <Tag color="processing">Pending</Tag>;
                      },
                    },
                  ]}
                />

                {!resolved && (
                  <>
                    <div style={{ marginTop: 12, marginBottom: 8, fontWeight: 600, fontSize: 12 }}>
                      {isUpdateImport ? 'How should this duplicate group be updated?' : 'How should this group be saved?'}
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
                          Merge into one item (sum opening quantities
                          {plan.mode === 'merge' && selectedRowIndexes.length > 0
                            ? `: ${combinedQty}`
                            : `: ${group.totalOpeningStock}`}
                          )
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

                    {plan.mode === 'merge' && selectedRowIndexes.length > 0 && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        Field values come from line{' '}
                        {group.details.find((d) => d.rowIndex === primaryIndex)?.sourceLine
                          ?? primaryIndex + 1}
                        ; opening stock is summed across {selectedRowIndexes.length} checked row(s).
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

                    <Space style={{ marginTop: 12 }} wrap>
                      {isUpdateImport && onDirectUpdate && (
                        <Button
                          type="primary"
                          disabled={disabled || !canManageItems || selectedRowIndexes.length === 0}
                          onClick={() => onDirectUpdate(group, mergePlan)}
                        >
                          {plan.mode === 'merge'
                            ? (selectedRowIndexes.length > 1
                              ? `Update ${selectedRowIndexes.length} merged directly`
                              : 'Update selected directly')
                            : 'Update selected directly'}
                        </Button>
                      )}
                      <Button
                        type={isUpdateImport && onDirectUpdate ? 'default' : 'primary'}
                        disabled={disabled || !canManageItems || (plan.mode === 'merge' && selectedRowIndexes.length === 0)}
                        onClick={() => onAddInForm(group, mergePlan)}
                      >
                        {isUpdateImport
                          ? (plan.mode === 'merge'
                            ? (selectedRowIndexes.length > 1
                              ? `Update ${selectedRowIndexes.length} merged in form`
                              : 'Update selected in form')
                            : 'Update selected in form')
                          : (plan.mode === 'merge'
                            ? (selectedRowIndexes.length > 1
                              ? `Add ${selectedRowIndexes.length} merged in form`
                              : 'Add selected in form')
                            : 'Add selected row in form')}
                      </Button>
                    </Space>
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
