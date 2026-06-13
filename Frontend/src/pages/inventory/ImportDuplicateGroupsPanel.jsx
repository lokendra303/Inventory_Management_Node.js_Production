import React from 'react';
import { Alert, Button, Collapse, Input, Radio, Space, Table, Tag, Typography } from 'antd';
import { MergeCellsOutlined, CheckCircleOutlined, DatabaseOutlined } from '@ant-design/icons';
import { CSV_IMPORT_PURPOSE_UPDATE, CSV_IMPORT_PURPOSE_CREATE } from './importConstants';
import {
  analyzeImportDuplicateGroupBatches,
  buildConsolidatedImportBatchLinesFromRowIndexes,
  buildImportGroupDetailTableColumns,
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

function getGroupPlan(plans, groupKey, defaultRowIndex, batchAnalysis) {
  const p = plans?.[groupKey];
  if (p) {
    const mode = p.mode === 'pick_one'
      ? 'pick_one'
      : (p.mode === 'import_batches' ? 'import_batches' : 'merge');
    return {
      mode,
      selectedRowIndex: p.selectedRowIndex != null ? p.selectedRowIndex : defaultRowIndex,
      note: p.note || '',
      selectedRowIndexes: p.selectedRowIndexes,
    };
  }
  if (batchAnalysis?.canImportAsBatches) {
    return { mode: 'import_batches', selectedRowIndex: defaultRowIndex, note: '' };
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
  onDirectImportBatches,
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
            ? 'When rows share the same item but have different batch numbers, use Import as warehouse batches. Otherwise merge quantities or pick one row.'
            : 'Map Batch number + Opening stock per row. If the same item appears with different batches, choose Import as warehouse batches instead of merging into one item.'
        }
      />
      <Collapse
        accordion={groups.length > 3}
        items={groups.map((group) => {
          const resolved = groupIsResolved(group, addedRowIndexes, supersededRowIndexes);
          const defaultRow = group.rowIndexes[0];
          const batchAnalysis = group.batchAnalysis
            || analyzeImportDuplicateGroupBatches(
              group,
              rows,
              mapping,
              importDefaults,
              isUpdateImport ? CSV_IMPORT_PURPOSE_UPDATE : undefined
            );
          const plan = getGroupPlan(duplicateGroupPlans, group.groupKey, defaultRow, batchAnalysis);
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
          const mergeBatchLines = plan.mode === 'merge'
            ? buildConsolidatedImportBatchLinesFromRowIndexes(
              selectedRowIndexes,
              rows,
              mapping,
              importDefaults,
              { importPurpose: isUpdateImport ? CSV_IMPORT_PURPOSE_UPDATE : undefined }
            ).filter((line) => line.batchNumber && line.quantity > 0)
            : [];
          const primaryIndex = (
            plan.selectedRowIndex != null && selectedRowIndexes.includes(plan.selectedRowIndex)
          )
            ? plan.selectedRowIndex
            : (selectedRowIndexes[0] ?? defaultRow);
          const matchTags = (group.matchTypes || []).map((t) => MATCH_TYPE_LABELS[t] || t);
          const mergePlan = { ...plan, selectedRowIndexes, selectedRowIndex: primaryIndex };
          const combinedQty = mergedQty.openingStock ?? group.totalOpeningStock;
          const usesRowSelection = !resolved
            && (plan.mode === 'merge' || plan.mode === 'import_batches')
            && pendingRowIndexes.length > 0;
          const importPurpose = isUpdateImport ? CSV_IMPORT_PURPOSE_UPDATE : CSV_IMPORT_PURPOSE_CREATE;
          const detailColumns = buildImportGroupDetailTableColumns({
            mapping,
            importDefaults,
            importPurpose,
            variant: 'duplicate',
            statusColumn: {
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
                if (usesRowSelection && !selectedRowIndexes.includes(d.rowIndex)) {
                  return <Tag>Not selected</Tag>;
                }
                return <Tag color="processing">Pending</Tag>;
              },
            },
          });

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
                {batchAnalysis.canImportAsBatches && (
                  <Tag color="cyan">Different batches</Tag>
                )}
                <Tag>{group.rowIndexes.length} rows</Tag>
                {!resolved && usesRowSelection && selectedRowIndexes.length > 0 && (
                  <Tag color="geekblue">{selectedRowIndexes.length} selected</Tag>
                )}
                {combinedQty > 0 && plan.mode === 'merge' && (
                  <Tag color="blue">Combined qty: {combinedQty}</Tag>
                )}
                {mergeBatchLines.length > 0 && plan.mode === 'merge' && (
                  <Tag color="cyan">{mergeBatchLines.length} warehouse batch(es)</Tag>
                )}
                {plan.mode === 'import_batches' && selectedRowIndexes.length > 0 && (
                  <Tag color="blue">{batchAnalysis.distinctBatches} batch(es)</Tag>
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
                {!resolved && usesRowSelection && pendingRowIndexes.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    Check rows to include. For batch import, each row should have a unique batch number and its own opening quantity.
                  </Text>
                )}
                <Table
                  size="small"
                  pagination={false}
                  rowKey="rowIndex"
                  dataSource={group.details}
                  rowSelection={usesRowSelection ? {
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
                  columns={detailColumns}
                />

                {!resolved && (
                  <>
                    <div style={{ marginTop: 12, marginBottom: 8, fontWeight: 600, fontSize: 12 }}>
                      {isUpdateImport ? 'How should this duplicate group be handled?' : 'How should this group be saved?'}
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
                        {batchAnalysis.canImportAsBatches && (
                          <Radio value="import_batches">
                            <DatabaseOutlined style={{ marginRight: 6 }} />
                            Import as warehouse batches (one item, {batchAnalysis.distinctBatches} batch records)
                          </Radio>
                        )}
                        <Radio value="merge">
                          <MergeCellsOutlined style={{ marginRight: 6 }} />
                          Merge into one item (sum opening quantities
                          {plan.mode === 'merge' && selectedRowIndexes.length > 0
                            ? `: ${combinedQty}`
                            : `: ${group.totalOpeningStock}`}
                          {batchAnalysis.withBatch?.length > 0 ? '; split warehouse batches by batch number' : ''}
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
                                {d.batchNumber ? ` — batch ${d.batchNumber}` : ''}
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
                        {mergeBatchLines.length > 0 && (
                          <>
                            {' '}
                            On save, {mergeBatchLines.length} warehouse batch(es) are created:
                            {' '}
                            {mergeBatchLines.map((line) => `${line.batchNumber} (${line.quantity})`).join(', ')}.
                          </>
                        )}
                      </Text>
                    )}

                    {plan.mode === 'import_batches' && selectedRowIndexes.length > 0 && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                        One item is created or matched by SKU. Each selected row becomes a warehouse batch using
                        Batch number, Opening stock (batch qty), and optional expiry / manufacture date columns.
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
                      {plan.mode === 'import_batches' && onDirectImportBatches && (
                        <Button
                          type="primary"
                          disabled={disabled || !canManageItems || selectedRowIndexes.length === 0}
                          onClick={() => onDirectImportBatches(group, mergePlan)}
                        >
                          {isUpdateImport
                            ? `Import ${selectedRowIndexes.length} batch(es) directly`
                            : `Import ${selectedRowIndexes.length} batch(es) for existing item`}
                        </Button>
                      )}
                      {isUpdateImport && onDirectUpdate && plan.mode !== 'import_batches' && (
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
                        type={
                          (plan.mode === 'import_batches' && onDirectImportBatches)
                          || (isUpdateImport && onDirectUpdate && plan.mode !== 'import_batches')
                            ? 'default'
                            : 'primary'
                        }
                        disabled={
                          disabled
                          || !canManageItems
                          || ((plan.mode === 'merge' || plan.mode === 'import_batches') && selectedRowIndexes.length === 0)
                        }
                        onClick={() => onAddInForm(group, mergePlan)}
                      >
                        {plan.mode === 'import_batches'
                          ? (isUpdateImport
                            ? `Add ${selectedRowIndexes.length} batch(es) in form`
                            : `Add item + ${selectedRowIndexes.length} batch(es) in form`)
                          : isUpdateImport
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
