import React, { useMemo, useState } from 'react';
import { Table, Checkbox, Button, Modal, Space, Typography, Alert } from 'antd';
import {
  PERMISSION_MATRIX_SECTIONS,
  COLUMN_KEYS,
  cellChecked,
  cellIndeterminate,
  toggleCellKeys,
  toggleRowFull,
  rowKeySet,
  isEffectiveSysAllSelected,
  isSysAllFullIndeterminate,
  selectAllMatrixPermissions,
  collectMatrixPermissionKeys,
} from '../../config/rolePermissionMatrix';

const { Text } = Typography;

const COL_LABELS = {
  full: 'Full',
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
};

/**
 * @param {string[]} value - selected permission keys
 * @param {(keys: string[]) => void} onChange
 * @param {Record<string, string>} [keyLabels] - optional friendly labels for "More permissions" modal
 */
export default function RolePermissionMatrix({ value = [], onChange, keyLabels = {} }) {
  const [moreRow, setMoreRow] = useState(null);
  const selectedSet = useMemo(() => new Set(value || []), [value]);
  const matrixKeyCount = useMemo(() => collectMatrixPermissionKeys().length, []);

  const labelFor = (key) => keyLabels[key] || key;

  const renderCell = (row, col) => {
    const keys = row.cells[col];
    if (!keys || keys.length === 0) {
      return <span style={{ color: '#d9d9d9' }}>—</span>;
    }
    const checked = cellChecked(selectedSet, keys);
    const indeterminate = cellIndeterminate(selectedSet, keys);
    return (
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={(e) => {
          const next = toggleCellKeys(value, keys, e.target.checked);
          onChange(next);
        }}
      />
    );
  };

  const renderFullCell = (row) => {
    if (row.id === 'sys_all') {
      const checked = isEffectiveSysAllSelected(value);
      const indeterminate = isSysAllFullIndeterminate(value);
      return (
        <Checkbox
          checked={checked}
          indeterminate={indeterminate}
          onChange={(e) => {
            onChange(toggleRowFull(value, row, e.target.checked));
          }}
        />
      );
    }
    const keys = row.cells.full;
    if (!keys || keys.length === 0) {
      return <span style={{ color: '#d9d9d9' }}>—</span>;
    }
    const checked = cellChecked(selectedSet, keys);
    const rk = rowKeySet(row);
    const any = [...rk].some((k) => selectedSet.has('all') || selectedSet.has(k));
    const indeterminate = any && !checked;
    return (
      <Checkbox
        checked={checked}
        indeterminate={indeterminate}
        onChange={(e) => {
          onChange(toggleRowFull(value, row, e.target.checked));
        }}
      />
    );
  };

  const columns = [
    {
      title: 'Particulars',
      dataIndex: 'label',
      key: 'label',
      width: 220,
      fixed: 'left',
      render: (t) => <Text strong>{t}</Text>,
    },
    ...COLUMN_KEYS.map((col) => ({
      title: COL_LABELS[col],
      key: col,
      width: col === 'full' ? 72 : 68,
      align: 'center',
      render: (_, row) => (col === 'full' ? renderFullCell(row) : renderCell(row, col)),
    })),
    {
      title: 'Others',
      key: 'others',
      width: 130,
      align: 'center',
      render: (_, row) => {
        const extra = row.moreKeys && row.moreKeys.length > 0;
        if (!extra) return <span style={{ color: '#d9d9d9' }}>—</span>;
        return (
          <Button type="link" size="small" onClick={() => setMoreRow(row)} style={{ padding: 0 }}>
            More permissions
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 12 }} wrap>
        <Button
          size="small"
          type="primary"
          ghost
          onClick={() => onChange(selectAllMatrixPermissions(value))}
        >
          Select all
        </Button>
        <Button size="small" onClick={() => onChange([])}>
          Clear all
        </Button>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="What Full, View, Create, Edit, Delete mean"
        description={(
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 8px' }}>
              Permissions in the database are <strong>simple on/off keys</strong> (for example{' '}
              <Text code>user_management</Text>, <Text code>item_view</Text>), not separate create vs edit vs delete
              records. This grid maps <Text strong>{matrixKeyCount}</Text> distinct keys into columns for clarity.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><strong>Full</strong> — every permission we bundle on that row (e.g. view + manage for Items).</li>
              <li><strong>View</strong> — read / list access where a separate view flag exists.</li>
              <li>
                <strong>Create</strong>, <strong>Edit</strong>, <strong>Delete</strong> — often the same{' '}
                <Text code>*_management</Text> flag behind all three; the API does not split them. Checking any of
                these grants “manage” access for that row.
              </li>
              <li><strong>Approve</strong> — only where we mapped a workflow-style permission; an em dash (—) means that column is not used.</li>
              <li>
                <strong>Full system access</strong> — only the <strong>Full</strong> box is used; it sets the special{' '}
                <Text code>all</Text> flag (access to the whole app). Other columns show — because they do not apply.
              </li>
            </ul>
          </div>
        )}
      />

      <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 8 }}>
        {PERMISSION_MATRIX_SECTIONS.map((section) => (
          <div key={section.title}>
            <div
              style={{
                padding: '8px 12px',
                background: '#fafafa',
                borderBottom: '1px solid #f0f0f0',
                fontWeight: 600,
                fontSize: 13,
                color: '#262626',
              }}
            >
              {section.title}
            </div>
            <Table
              size="small"
              pagination={false}
              showHeader
              rowKey="id"
              columns={columns}
              dataSource={section.rows}
              bordered
              scroll={{ x: 860 }}
            />
          </div>
        ))}
      </div>

      <Modal
        title={moreRow ? `More permissions — ${moreRow.label}` : 'More permissions'}
        open={Boolean(moreRow)}
        onCancel={() => setMoreRow(null)}
        footer={(
          <Button type="primary" onClick={() => setMoreRow(null)}>
            Done
          </Button>
        )}
        destroyOnClose
        width={480}
      >
        {moreRow && moreRow.moreKeys.length > 0 && (
          <Space direction="vertical" style={{ width: '100%' }}>
            {moreRow.moreKeys.map((key) => {
              const checked = selectedSet.has('all') || selectedSet.has(key);
              return (
                <Checkbox
                  key={key}
                  checked={checked}
                  onChange={(e) => {
                    onChange(toggleCellKeys(value, [key], e.target.checked));
                  }}
                >
                  <Text>{labelFor(key)}</Text>
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>({key})</Text>
                </Checkbox>
              );
            })}
          </Space>
        )}
      </Modal>
    </>
  );
}
