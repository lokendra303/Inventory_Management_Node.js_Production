import React, { useState, useRef, useEffect } from 'react';
import { Layout, Drawer } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.jsx';
import CurrencySelector from '../common/CurrencySelector.jsx';
import {
  FundProjectionScreenOutlined, DatabaseOutlined, TagsOutlined, BankOutlined,
  ContainerOutlined, FileDoneOutlined, AccountBookOutlined,
  ControlOutlined, TeamOutlined, FolderOpenOutlined, TransactionOutlined,
  DownOutlined, PieChartOutlined, AuditOutlined,
  PercentageOutlined, ThunderboltOutlined, CrownOutlined, TagsFilled,
  BookOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

/* ── Theme ───────────────────────────────────────────── */
const SIDEBAR_BG   = 'linear-gradient(180deg,#0f0c29 0%,#302b63 55%,#24243e 100%)';
const ACCENT       = 'linear-gradient(135deg,#667eea,#764ba2)';
const ACTIVE_BG    = 'linear-gradient(135deg,rgba(102,126,234,0.32),rgba(118,75,162,0.32))';
const ACTIVE_BORDER= '#667eea';
const HOVER_BG     = 'rgba(255,255,255,0.07)';
const SUB_BG       = 'rgba(0,0,0,0.20)';
const TEXT         = 'rgba(255,255,255,0.72)';
const TEXT_ACTIVE  = '#fff';

const ICON_COLORS = {
  '/dashboard'   : '#667eea',
  inventory      : '#38ef7d',
  items          : '#f093fb',
  '/warehouses'  : '#ffd200',
  'warehouses'   : '#ffd200',
  sales          : '#f5576c',
  purchases      : '#f7971e',
  invoices       : '#11998e',
  '/users'       : '#a78bfa',
  reports        : '#38ef7d',
  '/documents'   : '#ffd200',
  '/audit'        : '#ff6b6b',
  '/tax'           : '#fa8c16',
  '/price-lists'   : '#11998e',
  '/subscription'  : '#f7971e',
  '/workflows'     : '#f5576c',
  '/user-guides'   : '#66d9ef',
  'settings-menu'  : '#a0a0b0',
};

/* ── Active-child resolution ──────────────────────────
 * Pick at most one child as "active" using a longest-prefix-match rule.
 * Fixes the case where `/warehouses` would also light up when the current
 * URL is `/warehouses/locations` — both match under plain prefix logic.
 * The child with the longer key wins; `/warehouses/123/edit` still lights
 * up `/warehouses` because it's the longest-matching key among siblings.
 */
const resolveActiveChildKey = (children, pathname) => {
  let best = null;
  for (const c of children || []) {
    if (!c || !c.key) continue;
    const k = String(c.key);
    if (pathname === k || pathname.startsWith(k + '/')) {
      if (best === null || k.length > best.length) best = k;
    }
  }
  return best;
};

/* ── Flyout popup (collapsed submenu) ───────────────── */
const CollapsedFlyout = ({ item, iconColor, location, onNavigate, anchorRef }) => {
  const [visible, setVisible] = useState(false);
  const [top, setTop]         = useState(0);
  const flyoutRef             = useRef(null);
  const hideTimer             = useRef(null);

  const show = () => {
    clearTimeout(hideTimer.current);
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setTop(rect.top);
    }
    setVisible(true);
  };

  const hide = () => {
    hideTimer.current = setTimeout(() => setVisible(false), 120);
  };

  const keepOpen = () => clearTimeout(hideTimer.current);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const isAnyChildActive = item.children?.some(
    c => location.pathname === c.key || location.pathname.startsWith(c.key + '/')
  );

  return (
    <div
      ref={anchorRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{ position: 'relative' }}
    >
      {/* Icon-only row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '10px 0', margin: '2px 8px', borderRadius: 10, cursor: 'pointer',
        background: isAnyChildActive ? ACTIVE_BG : 'transparent',
        borderLeft: isAnyChildActive ? `3px solid ${ACTIVE_BORDER}` : '3px solid transparent',
        transition: 'background 0.18s',
      }}>
        <span style={{
          fontSize: 17,
          color: isAnyChildActive ? iconColor : TEXT,
          filter: isAnyChildActive ? `drop-shadow(0 0 6px ${iconColor})` : 'none',
          transition: 'color 0.18s',
        }}>
          {item.icon}
        </span>
      </div>

      {/* Floating flyout */}
      {visible && (
        <div
          ref={flyoutRef}
          onMouseEnter={keepOpen}
          onMouseLeave={hide}
          style={{
            position: 'fixed',
            left: 82,
            top: top,
            zIndex: 9999,
            background: 'linear-gradient(160deg,#1a1740,#2d2660)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(102,126,234,0.2)',
            minWidth: 200,
            padding: '6px 0',
            animation: 'flyoutIn 0.15s ease',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '8px 16px 6px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: iconColor, fontSize: 14 }}>{item.icon}</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{item.label}</span>
          </div>

          {(() => {
            const activeKey = resolveActiveChildKey(item.children, location.pathname);
            return item.children?.map(child => (
              <FlyoutChild
                key={child.key}
                child={child}
                active={child.key === activeKey}
                accentColor={iconColor}
                onNavigate={onNavigate}
              />
            ));
          })()}
        </div>
      )}
    </div>
  );
};

/* ── Flyout child item ───────────────────────────────── */
const FlyoutChild = ({ child, active, accentColor, onNavigate }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onNavigate(child.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', cursor: 'pointer',
        background: active ? `rgba(102,126,234,0.22)` : hovered ? 'rgba(255,255,255,0.07)' : 'transparent',
        transition: 'background 0.15s',
        position: 'relative',
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: active ? accentColor : hovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)',
        boxShadow: active ? `0 0 6px ${accentColor}` : 'none',
        transition: 'all 0.15s',
      }} />
      <span style={{
        fontSize: 13, fontWeight: active ? 600 : 400,
        color: active ? '#fff' : hovered ? 'rgba(255,255,255,0.9)' : TEXT,
        transition: 'color 0.15s',
        whiteSpace: 'nowrap',
      }}>
        {child.label}
      </span>
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: '15%', bottom: '15%',
          width: 3, borderRadius: '0 3px 3px 0',
          background: accentColor, boxShadow: `0 0 8px ${accentColor}`,
        }} />
      )}
    </div>
  );
};

/* ── Expanded SubMenu ────────────────────────────────── */
const SubMenu = ({ item, location, onNavigate, iconColor }) => {
  const isAnyChildActive = item.children?.some(
    c => location.pathname === c.key || location.pathname.startsWith(c.key + '/')
  );
  const [open, setOpen]       = useState(isAnyChildActive);
  const [hovered, setHovered] = useState(false);

  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 14px', margin: '2px 8px', borderRadius: 10,
          cursor: 'pointer',
          background: isAnyChildActive ? ACTIVE_BG : hovered ? HOVER_BG : 'transparent',
          borderLeft: isAnyChildActive ? `3px solid ${ACTIVE_BORDER}` : '3px solid transparent',
          transition: 'all 0.18s ease', userSelect: 'none',
        }}
      >
        <span style={{
          fontSize: 16, flexShrink: 0,
          color: isAnyChildActive ? iconColor : hovered ? iconColor : TEXT,
          filter: isAnyChildActive ? `drop-shadow(0 0 6px ${iconColor})` : 'none',
          transition: 'color 0.18s, transform 0.18s',
          transform: hovered && !isAnyChildActive ? 'scale(1.15)' : 'scale(1)',
        }}>
          {item.icon}
        </span>
        <span style={{
          fontSize: 13, flex: 1,
          fontWeight: isAnyChildActive ? 600 : 400,
          color: isAnyChildActive ? TEXT_ACTIVE : hovered ? '#fff' : TEXT,
          transition: 'color 0.18s',
        }}>
          {item.label}
        </span>
        <span style={{
          fontSize: 10, color: TEXT,
          transition: 'transform 0.22s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>
          <DownOutlined />
        </span>
      </div>

      {/* Animated children */}
      <div style={{
        maxHeight: open ? `${(item.children?.length || 0) * 40}px` : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1)',
        background: open ? SUB_BG : 'transparent',
        borderRadius: open ? '0 0 10px 10px' : 0,
        margin: '0 8px',
      }}>
        {(() => {
          const activeKey = resolveActiveChildKey(item.children, location.pathname);
          return item.children?.map(child => (
            <ChildItem
              key={child.key}
              child={child}
              active={child.key === activeKey}
              onNavigate={onNavigate}
              accentColor={iconColor}
            />
          ));
        })()}
      </div>
    </div>
  );
};

/* ── Expanded MenuItem ───────────────────────────────── */
const MenuItem = ({ item, active, onClick, iconColor }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onClick(item.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', margin: '2px 8px', borderRadius: 10,
        cursor: 'pointer',
        background: active ? ACTIVE_BG : hovered ? HOVER_BG : 'transparent',
        borderLeft: active ? `3px solid ${ACTIVE_BORDER}` : '3px solid transparent',
        transition: 'all 0.18s ease', userSelect: 'none', position: 'relative', overflow: 'hidden',
      }}
    >
      {active && (
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 10, pointerEvents: 'none',
          background: 'radial-gradient(circle at 30% 50%, rgba(102,126,234,0.15), transparent 70%)',
        }} />
      )}
      <span style={{
        fontSize: 16, flexShrink: 0,
        color: active ? iconColor : hovered ? iconColor : TEXT,
        filter: active ? `drop-shadow(0 0 6px ${iconColor})` : 'none',
        transition: 'color 0.18s, transform 0.18s',
        transform: hovered && !active ? 'scale(1.15)' : 'scale(1)',
      }}>
        {item.icon}
      </span>
      <span style={{
        fontSize: 13, flex: 1,
        fontWeight: active ? 600 : 400,
        color: active ? TEXT_ACTIVE : hovered ? '#fff' : TEXT,
        transition: 'color 0.18s',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {item.label}
      </span>
    </div>
  );
};

/* ── Collapsed MenuItem (icon only, with tooltip) ────── */
const CollapsedMenuItem = ({ item, active, onClick, iconColor }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        onClick={() => onClick(item.key)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px 0', margin: '2px 8px', borderRadius: 10, cursor: 'pointer',
          background: active ? ACTIVE_BG : hovered ? HOVER_BG : 'transparent',
          borderLeft: active ? `3px solid ${ACTIVE_BORDER}` : '3px solid transparent',
          transition: 'all 0.18s ease',
        }}
      >
        <span style={{
          fontSize: 17,
          color: active ? iconColor : hovered ? iconColor : TEXT,
          filter: active ? `drop-shadow(0 0 6px ${iconColor})` : 'none',
          transition: 'color 0.18s, transform 0.18s',
          transform: hovered && !active ? 'scale(1.18)' : 'scale(1)',
        }}>
          {item.icon}
        </span>
      </div>

      {/* Tooltip label */}
      {hovered && (
        <div style={{
          position: 'fixed',
          left: 82,
          transform: 'translateY(-50%)',
          zIndex: 9999,
          background: 'linear-gradient(135deg,#1a1740,#2d2660)',
          color: '#fff',
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          border: '1px solid rgba(102,126,234,0.3)',
          pointerEvents: 'none',
          animation: 'flyoutIn 0.12s ease',
        }}>
          {item.label}
        </div>
      )}
    </div>
  );
};

/* ── Child item (expanded) ───────────────────────────── */
const ChildItem = ({ child, active, onNavigate, accentColor }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onNavigate(child.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px 8px 22px', cursor: 'pointer',
        background: active ? 'rgba(102,126,234,0.18)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent',
        transition: 'background 0.15s', userSelect: 'none', position: 'relative',
      }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: active ? accentColor : hovered ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.2)',
        boxShadow: active ? `0 0 6px ${accentColor}` : 'none',
        transition: 'all 0.15s',
      }} />
      <span style={{
        fontSize: 12.5, fontWeight: active ? 600 : 400,
        color: active ? '#fff' : hovered ? 'rgba(255,255,255,0.9)' : TEXT,
        transition: 'color 0.15s',
      }}>
        {child.label}
      </span>
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: '15%', bottom: '15%',
          width: 3, borderRadius: '0 3px 3px 0',
          background: accentColor, boxShadow: `0 0 8px ${accentColor}`,
        }} />
      )}
    </div>
  );
};

/* ── Logo ────────────────────────────────────────────── */
const Logo = ({ collapsed, isMobile }) => (
  <div style={{
    height: 68, flexShrink: 0,
    display: 'flex', alignItems: 'center',
    justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
    padding: collapsed && !isMobile ? '0 8px' : '0 18px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    gap: 10,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
      background: ACCENT,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: 13, color: '#fff',
      boxShadow: '0 4px 14px rgba(102,126,234,0.55)',
      letterSpacing: 0.5,
    }}>
      IMS
    </div>
    {(!collapsed || isMobile) && (
      <div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.25, letterSpacing: 0.3 }}>
          IMS SEPCUNE
        </div>
        <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, letterSpacing: 0.5 }}>
          INVENTORY MANAGEMENT
        </div>
      </div>
    )}
  </div>
);

/* ── Main Sidebar ────────────────────────────────────── */
const Sidebar = ({ collapsed, isMobile, onClose }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const hasPermission    = (p) => {
    if (!user?.permissions) return false;
    if (user.role === 'admin' || user.role === 'super_admin') return true;
    return user.permissions.all || user.permissions[p];
  };
  const hasAnyPermission = (...ps) => ps.some(p => hasPermission(p));
  const hasRole          = (roles) => (Array.isArray(roles) ? roles : [roles]).includes(user?.role);

  const menuItems = [
    { key: '/dashboard', icon: <FundProjectionScreenOutlined />, label: 'Dashboard' },
    hasAnyPermission('inventory_view','inventory_receive','inventory_reserve','inventory_ship','inventory_adjust','inventory_transfer','inventory_management') && {
      key: 'inventory', icon: <DatabaseOutlined />, label: 'Inventory',
      children: [
        hasPermission('inventory_view')     && { key: '/inventory',               label: 'Overview' },
        hasPermission('inventory_adjust')   && { key: '/inventory/adjustments',   label: 'Adjustments' },
        hasPermission('inventory_adjust')   && { key: '/inventory/stock-count',   label: 'Stock Count' },
        hasPermission('inventory_view')     && { key: '/inventory/batch-tracking',label: 'Batch & Serial' },
        hasPermission('inventory_view')     && { key: '/inventory/reorder-levels', label: 'Reorder Levels' },
        hasPermission('inventory_view')     && { key: '/inventory/packages',      label: 'Packages' },
        hasPermission('inventory_ship')     && { key: '/inventory/shipments',     label: 'Shipments' },
        hasPermission('inventory_transfer') && { key: '/inventory/move-orders',   label: 'Move Orders' },
        hasPermission('inventory_receive')  && { key: '/inventory/putaways',      label: 'Putaways' },
      ].filter(Boolean),
    },
    hasAnyPermission('production_view','production_management') && {
      key: '/production', icon: <DatabaseOutlined />, label: 'Production'
    },
    hasAnyPermission('item_view','item_management') && {
      key: 'items', icon: <TagsOutlined />, label: 'Items',
      children: [
        hasPermission('item_view') && { key: '/items',       label: 'Items' },
        hasPermission('item_view') && { key: '/item-groups', label: 'Item Groups' },
      ].filter(Boolean),
    },
    hasAnyPermission('warehouse_view','warehouse_management','warehouse_type_view','warehouse_type_management') && {
      key: 'warehouses', icon: <BankOutlined />, label: 'Warehouses',
      children: [
        hasPermission('warehouse_view') && { key: '/warehouses',           label: 'Warehouses' },
        hasPermission('warehouse_view') && { key: '/warehouses/locations', label: 'Zones / Racks / Bins' },
      ].filter(Boolean),
    },
    hasAnyPermission('sales_view','sales_management','customer_view','customer_management') && {
      key: 'sales', icon: <FileDoneOutlined />, label: 'Sales',
      children: [
        hasAnyPermission('customer_view','customer_management') && { key: '/sales/customers',         label: 'Customers' },
        hasAnyPermission('sales_view','sales_management')       && { key: '/sales-orders',            label: 'Sales Orders' },
        hasAnyPermission('sales_view','sales_management')       && { key: '/sales-invoices',          label: 'Sales Invoices' },
        hasAnyPermission('sales_view','sales_management')       && { key: '/sales/delivery-challans', label: 'Delivery Challans' },
        hasAnyPermission('sales_view','sales_management')       && { key: '/sales/payments-received', label: 'Payments Received' },
        hasAnyPermission('sales_view','sales_management')       && { key: '/sales/returns',           label: 'Sales Returns' },
        hasAnyPermission('sales_view','sales_management')       && { key: '/sales/credit-notes',      label: 'Credit Notes' },
      ].filter(Boolean),
    },
    hasAnyPermission('purchase_view','purchase_management','vendor_view','vendor_management') && {
      key: 'purchases', icon: <ContainerOutlined />, label: 'Purchases',
      children: [
        hasAnyPermission('vendor_view','vendor_management')                         && { key: '/purchases/vendors',        label: 'Vendors' },
        hasAnyPermission('purchase_view','purchase_management')                     && { key: '/purchase-orders',          label: 'Purchase Orders' },
        hasAnyPermission('purchase_view','purchase_management')                     && { key: '/purchase-invoices',        label: 'Purchase Invoices' },
        hasAnyPermission('purchase_view','purchase_management','inventory_receive') && { key: '/purchases/receives',       label: 'Purchase Receives' },
        hasAnyPermission('purchase_view','purchase_management')                     && { key: '/purchases/bills',          label: 'Bills' },
        hasAnyPermission('purchase_view','purchase_management')                     && { key: '/purchases/payments-made',  label: 'Payments Made' },
        hasAnyPermission('purchase_view','purchase_management')                     && { key: '/purchases/vendor-credits', label: 'Vendor Credits' },
        hasAnyPermission('purchase_view','purchase_management')                     && { key: '/purchases/returns',        label: 'Purchase Returns' },
      ].filter(Boolean),
    },
    hasAnyPermission('invoice_view','invoice_management') && {
      key: 'invoices', icon: <TransactionOutlined />, label: 'Invoices',
      children: [
        { key: '/invoices/dashboard',   label: 'Invoice Dashboard' },
        { key: '/invoices/purchase',    label: 'Purchase Invoices' },
        { key: '/invoices/sales',       label: 'Sales Invoices' },
        { key: '/invoices/outstanding', label: 'Outstanding' },
        { key: '/invoices/payments',    label: 'Payments' },
      ],
    },
    hasAnyPermission('invoice_view','invoice_management') && {
      key: '/accounting', icon: <AccountBookOutlined />, label: 'Accounting',
    },
    hasPermission('audit_view') && { key: '/audit', icon: <AuditOutlined />, label: 'Audit Trail' },
    hasRole(['admin','super_admin']) && { key: '/tax',          icon: <PercentageOutlined />, label: 'Tax Management' },
    hasRole(['admin','super_admin']) && { key: '/price-lists',  icon: <TagsFilled />,         label: 'Price Lists' },
    hasRole(['admin','super_admin']) && { key: '/workflows',    icon: <ThunderboltOutlined />,label: 'Workflows' },
    hasRole(['admin','super_admin']) && { key: '/subscription', icon: <CrownOutlined />,      label: 'Subscription' },
    hasPermission('user_management') && { key: '/users', icon: <TeamOutlined />, label: 'User Management' },
    hasAnyPermission('inventory_view','sales_view','sales_management','purchase_view','purchase_management','invoice_view','invoice_management') && {
      key: 'reports', icon: <PieChartOutlined />, label: 'Reports',
      children: [
        hasAnyPermission('inventory_view','sales_view','purchase_view','invoice_view') && { key: '/reports',     label: 'Home' },
        hasAnyPermission('sales_view','purchase_view','invoice_view')                  && { key: '/profit-loss', label: 'Profit & Loss' },
      ].filter(Boolean),
    },
    { key: '/documents', icon: <FolderOpenOutlined />, label: 'Documents' },
    {
      key: 'settings-menu', icon: <ControlOutlined />, label: 'Settings',
      children: [
        hasRole(['admin','super_admin']) && { key: '/company-settings',       label: 'Company Settings' },
        hasRole(['admin','super_admin']) && { key: '/settings/exchange-rate', label: 'Exchange Rate' },
        hasRole(['admin','super_admin']) && { key: '/settings',               label: 'All Settings' },
      ].filter(Boolean),
    },
    { key: '/user-guides', icon: <BookOutlined />, label: 'User Guide' },
  ].filter(Boolean);

  const handleNavigate = (key) => {
    if (typeof key === 'string' && key.startsWith('/')) {
      navigate(key);
      if (isMobile && onClose) onClose();
    }
  };

  const isCollapsed = collapsed && !isMobile;

  const renderMenu = () => (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 0' }}>
      {menuItems.map(item => {
        const iconColor = ICON_COLORS[item.key] || '#667eea';

        if (item.children?.length) {
          if (isCollapsed) {
            const anchorRef = React.createRef();
            return (
              <CollapsedFlyout
                key={item.key}
                item={item}
                iconColor={iconColor}
                location={location}
                onNavigate={handleNavigate}
                anchorRef={anchorRef}
              />
            );
          }
          return (
            <SubMenu
              key={item.key}
              item={item}
              location={location}
              onNavigate={handleNavigate}
              iconColor={iconColor}
            />
          );
        }

        const active = location.pathname === item.key || location.pathname.startsWith(item.key + '/');
        if (isCollapsed) {
          return (
            <CollapsedMenuItem
              key={item.key}
              item={item}
              active={active}
              onClick={handleNavigate}
              iconColor={iconColor}
            />
          );
        }
        return (
          <MenuItem
            key={item.key}
            item={item}
            active={active}
            onClick={handleNavigate}
            iconColor={iconColor}
          />
        );
      })}
    </div>
  );

  const sidebarContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Logo collapsed={collapsed} isMobile={isMobile} />
      {renderMenu()}
      {!isCollapsed && (
        <div style={{
          padding: '12px 16px', flexShrink: 0,
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          <CurrencySelector />
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer
        title={null}
        placement="left"
        onClose={onClose}
        open={!collapsed}
        bodyStyle={{ padding: 0, background: '#0f0c29' }}
        headerStyle={{ display: 'none' }}
        width={260}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  return (
    <>
      {/* Keyframe for flyout animation */}
      <style>{`
        @keyframes flyoutIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{
          position: 'sticky', top: 0, height: '100vh',
          background: SIDEBAR_BG,
          boxShadow: '2px 0 20px rgba(0,0,0,0.3)',
          overflow: 'visible',
          zIndex: 200,
        }}
      >
        {sidebarContent}
      </Sider>
    </>
  );
};

export default Sidebar;
