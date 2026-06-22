import React from 'react';
import { Radio } from 'antd';
import { Alert, Button, Collapse, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { MergeCellsOutlined, CheckCircleOutlined } from '@ant-design/icons';
import {
  analyzeImportDuplicateGroupBatches,
  buildConsolidatedImportBatchLinesFromRowIndexes,
  buildImportGroupDetailTableColumns,
  buildMergedImportQuantitiesForUpdate,
  getSheetMatchGroupPendingRowIndexes,
  getSheetMatchGroupSelectedRowIndexes,
  isSheetMatchGroupReadyForMergeUpdate,
  isSheetMatchGroupResolved,
} from './importItemHelpers';
import { CSV_IMPORT_PURPOSE_UPDATE } from './importConstants';

const { Text } = Typography;

export function ImportSheetMatchGroupsPanel({
  groups = [],
  groupPlans = {},
  rows = [],
  addedRowIndexes = {},
  supersededRowIndexes = {},
  disabled = false,
  canManageItems = false,
  matchFieldLabel = 'Name',
  mapping = {},
  importDefaults = {},
  skuSource,
  onPlanChange,
  onCatalogPickForGroup,
  onMergeUpdateDirect,
  onMergeUpdateInForm,
  onDirectImportBatches,
}) {
  const pendingGroups = groups.filter(
    (g) => !isSheetMatchGroupResolved(g, addedRowIndexes, supersededRowIndexes)
  );

  if (!groups.length) return null;

  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Same item on multiple sheet rows ({pendingGroups.length} pending / {groups.length} groups)
      </Text>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Merge sheet duplicates into one catalog update"
        description={
          'Rows grouped by the same value in your match column. '
          + 'If rows have different batch numbers, import as warehouse batches. Otherwise merge quantities into one update.'
        }
      />
      <Collapse
        accordion={groups.length > 3}
        defaultActiveKey={pendingGroups.length === 1 ? [pendingGroups[0].groupKey] : undefined}
        items={groups.map((group) => {
          const resolved = isSheetMatchGroupResolved(group, addedRowIndexes, supersededRowIndexes);
          const batchAnalysis = group.batchAnalysis
            || analyzeImportDuplicateGroupBatches(
              group,
              rows,
              mapping,
              importDefaults,
              CSV_IMPORT_PURPOSE_UPDATE
            );
          const plan = {
            mode: groupPlans[group.groupKey]?.mode
              || (batchAnalysis.canImportAsBatches ? 'import_batches' : 'merge'),
            note: groupPlans[group.groupKey]?.note || '',
            selectedRowIndexes: groupPlans[group.groupKey]?.selectedRowIndexes,
          };
          const pendingRowIndexes = getSheetMatchGroupPendingRowIndexes(
            group,
            addedRowIndexes,
            supersededRowIndexes
          );
          const selectedRowIndexes = getSheetMatchGroupSelectedRowIndexes(
            group,
            plan,
            addedRowIndexes,
            supersededRowIndexes
          );
          const mergedQty = buildMergedImportQuantitiesForUpdate(
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
              { importPurpose: CSV_IMPORT_PURPOSE_UPDATE }
            ).filter((line) => line.batchNumber && line.quantity > 0)
            : [];
          const ready = isSheetMatchGroupReadyForMergeUpdate(
            group,
            mapping,
            importDefaults,
            skuSource,
            selectedRowIndexes
          );
          const mergePlan = { ...plan, selectedRowIndexes };
          const detailColumns = buildImportGroupDetailTableColumns({
            mapping,
            importDefaults,
            importPurpose: CSV_IMPORT_PURPOSE_UPDATE,
            variant: 'sheet_match',
            statusColumn: {
              title: 'Status',
              key: 'st',
              width: 90,
              render: (_, d) => {
                if (addedRowIndexes[String(d.rowIndex)]) {
                  return <Tag color="success">Updated</Tag>;
                }
                if (supersededRowIndexes[String(d.rowIndex)]) {
                  return <Tag>Skipped</Tag>;
                }
                if (!selectedRowIndexes.includes(d.rowIndex)) {
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
                <Text strong>{group.displayValue || group.label}</Text>
                <Tag color="purple">{group.rowIndexes.length} sheet rows</Tag>
                {!resolved && selectedRowIndexes.length > 0 && (
                  <Tag color="geekblue">{selectedRowIndexes.length} selected</Tag>
                )}
                {batchAnalysis.canImportAsBatches && (
                  <Tag color="cyan">Different batches</Tag>
                )}
                {group.hasOpeningStockSource && mergedQty.openingStock != null && selectedRowIndexes.length > 0 && plan.mode === 'merge' && (
                  <Tag color="blue">Merged qty: {mergedQty.openingStock}</Tag>
                )}
                {mergeBatchLines.length > 0 && plan.mode === 'merge' && (
                  <Tag color="cyan">{mergeBatchLines.length} warehouse batch(es)</Tag>
                )}
                {group.catalogStatus === 'unique' && (
                  <Tag color="green">1 catalog match</Tag>
                )}
                {group.catalogStatus === 'ambiguous' && !group.resolvedItem && (
                  <Tag color="warning">Pick catalog item</Tag>
                )}
                {group.resolvedItem && (
                  <Tag color="cyan">
                    → {group.resolvedItem.sku || 'no SKU'} — {group.resolvedItem.name || '—'}
                  </Tag>
                )}
                {resolved ? (
                  <Tag color="success" icon={<CheckCircleOutlined />}>Updated</Tag>
                ) : (
                  <Tag color="processing">Needs merge update</Tag>
                )}
              </Space>
            ),
            children: (
              <div>
                {!resolved && pendingRowIndexes.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                    Check rows to include in the merge. Unchecked rows can be updated separately from the list above.
                  </Text>
                )}
                <Table
                  size="small"
                  pagination={false}
                  rowKey="rowIndex"
                  dataSource={group.details}
                  rowSelection={!resolved && pendingRowIndexes.length > 0 ? {
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
                    {group.catalogStatus === 'no_match' && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginTop: 12 }}
                        message="No catalog item for this name"
                        description={`No existing item matched "${group.displayValue}" by ${matchFieldLabel}. Fix the catalog or match column.`}
                      />
                    )}

                    {(group.catalogStatus === 'ambiguous' || group.catalogStatus === 'picked') && (
                      <div style={{ marginTop: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                          Which catalog item should receive the merged update?
                          {' '}
                          (applies to all {selectedRowIndexes.length || group.rowIndexes.length} selected rows)
                        </Text>
                        <Select
                          showSearch
                          allowClear
                          placeholder="Pick catalog item"
                          style={{ width: '100%', maxWidth: 420 }}
                          disabled={disabled}
                          value={group.resolvedItem?.id}
                          options={(group.catalogMatches || []).map((item) => ({
                            value: item.id,
                            label: `${item.sku || 'no SKU'} — ${item.name || '—'}`,
                          }))}
                          optionFilterProp="label"
                          onChange={(v) => onCatalogPickForGroup(group, v)}
                        />
                      </div>
                    )}

                    {group.resolvedItem && (
                      <>
                        <div style={{ marginTop: 12, marginBottom: 8, fontWeight: 600, fontSize: 12 }}>
                          How should these rows be applied?
                        </div>
                        <Radio.Group
                          value={plan.mode}
                          disabled={disabled}
                          onChange={(e) => onPlanChange(group.groupKey, { mode: e.target.value })}
                        >
                          <Space direction="vertical" size={4}>
                            {batchAnalysis.canImportAsBatches && (
                              <Radio value="import_batches">
                                Import as warehouse batches ({batchAnalysis.distinctBatches} batches)
                              </Radio>
                            )}
                            <Radio value="merge">
                              Merge into one catalog update (sum opening quantities
                              {batchAnalysis.withBatch?.length > 0 ? '; split warehouse batches by batch number' : ''}
                              )
                            </Radio>
                          </Space>
                        </Radio.Group>
                      </>
                    )}

                    {group.catalogStatus === 'unique' && group.resolvedItem && plan.mode === 'merge' && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                        Selected rows update catalog item{' '}
                        <Text strong>
                          {group.resolvedItem.sku || 'no SKU'} — {group.resolvedItem.name}
                        </Text>
                        . Quantities from mapped opening-stock column are summed for checked rows only.
                        {mergeBatchLines.length > 0 && (
                          <>
                            {' '}
                            Warehouse batches on save:{' '}
                            {mergeBatchLines.map((line) => `${line.batchNumber} (${line.quantity})`).join(', ')}.
                          </>
                        )}
                      </Text>
                    )}

                    {plan.mode === 'import_batches' && group.resolvedItem && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                        Each selected row creates a warehouse batch on{' '}
                        <Text strong>
                          {group.resolvedItem.sku || 'no SKU'} — {group.resolvedItem.name}
                        </Text>
                        . Map Batch number and Opening stock in update fields.
                      </Text>
                    )}

                    {group.hasOpeningStockSource && mergedQty.openingStock != null && selectedRowIndexes.length > 0 && plan.mode === 'merge' && (
                      <Alert
                        type="success"
                        showIcon
                        style={{ marginTop: 12 }}
                        message={`Combined quantity (${selectedRowIndexes.length} row(s)): ${mergedQty.openingStock}`}
                        description="Sum of opening stock from checked rows only."
                      />
                    )}

                    {!group.hasOpeningStockSource && (
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 12 }}>
                        Map <Text strong>Opening stock</Text> to your quantity column (or set a default) to merge quantities.
                      </Text>
                    )}

                    <div style={{ marginTop: 12 }}>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                        Note (optional — appended to item description)
                      </Text>
                      <Input.TextArea
                        rows={2}
                        disabled={disabled}
                        placeholder="e.g. Merged from kit stock sheet"
                        value={plan.note || ''}
                        onChange={(e) => onPlanChange(group.groupKey, { note: e.target.value })}
                      />
                    </div>

                    <Space style={{ marginTop: 12 }} wrap>
                      {plan.mode === 'import_batches' && onDirectImportBatches && group.resolvedItem && (
                        <Button
                          type="primary"
                          disabled={disabled || !canManageItems || selectedRowIndexes.length === 0}
                          onClick={() => onDirectImportBatches({
                            ...group,
                            catalogItemId: group.resolvedItem.id,
                            catalogItemName: group.resolvedItem.name,
                          }, mergePlan)}
                        >
                          Import {selectedRowIndexes.length} batch(es) directly
                        </Button>
                      )}
                      {plan.mode === 'merge' && (
                        <>
                      <Button
                        type="primary"
                        icon={<MergeCellsOutlined />}
                        disabled={disabled || !canManageItems || !ready || selectedRowIndexes.length === 0}
                        onClick={() => onMergeUpdateDirect(group, mergePlan)}
                      >
                        {selectedRowIndexes.length > 1
                          ? `Merge ${selectedRowIndexes.length} selected & update directly`
                          : 'Update selected row directly'}
                      </Button>
                      <Button
                        disabled={disabled || !canManageItems || !ready || selectedRowIndexes.length === 0}
                        onClick={() => onMergeUpdateInForm(group, mergePlan)}
                      >
                        {selectedRowIndexes.length > 1
                          ? `Merge ${selectedRowIndexes.length} selected & update in form`
                          : 'Update selected row in form'}
                      </Button>
                        </>
                      )}
                      {plan.mode === 'import_batches' && group.resolvedItem && (
                        <Button
                          disabled={disabled || !canManageItems || selectedRowIndexes.length === 0}
                          onClick={() => onMergeUpdateInForm(group, { ...mergePlan, mode: 'import_batches' })}
                        >
                          Import {selectedRowIndexes.length} batch(es) in form
                        </Button>
                      )}
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

export default ImportSheetMatchGroupsPanel;
