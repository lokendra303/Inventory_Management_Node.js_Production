import React from 'react';
import { Button, Tooltip } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';

/**
 * Toggle between list (table) and grid (card) catalog views.
 */
const ViewModeToggle = ({
  value = 'list',
  onChange,
  size = 'middle',
  listTitle = 'List view',
  gridTitle = 'Grid view',
}) => (
  <Tooltip title={value === 'list' ? gridTitle : listTitle}>
    <Button
      size={size}
      icon={value === 'list' ? <AppstoreOutlined /> : <UnorderedListOutlined />}
      onClick={() => onChange(value === 'list' ? 'grid' : 'list')}
      aria-label={value === 'list' ? gridTitle : listTitle}
      style={{ borderRadius: 8 }}
    />
  </Tooltip>
);

export default ViewModeToggle;
