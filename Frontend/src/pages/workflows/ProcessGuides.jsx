import React, { useState } from 'react';
import { Card, Tag, Collapse, Tooltip, Alert, Table } from 'antd';
import {
  CheckCircleFilled, ArrowRightOutlined, ArrowDownOutlined,
  InboxOutlined, ShoppingCartOutlined, ShopOutlined, FileTextOutlined,
  FileDoneOutlined, TruckOutlined,
  BankOutlined, DatabaseOutlined, InfoCircleOutlined, RollbackOutlined,
  ContainerOutlined, TeamOutlined, GiftOutlined, DollarCircleOutlined,
  UserOutlined, SolutionOutlined, TagsOutlined, SettingOutlined,
} from '@ant-design/icons';

/**
 * ProcessGuides — interactive "how the flow works" roadmap.
 *
 * Two exports: <SalesOrderFlow /> and <PurchaseOrderFlow />.
 *
 * Each is a vertical hierarchical guide derived from the canonical
 * docs/WORKFLOW.md (sections §7 and §8). Each phase lists:
 *   - what the user does (UI/endpoint)
 *   - what the system does (tables touched, status transitions)
 *   - how the inventory ledger changes (on_hand / reserved / available / on_order)
 *
 * Visual design:
 *   - left rail with numbered phase dots + connector
 *   - right side: a phase card with a one-line summary and a collapsible
 *     "deep dive" that exposes DB details, alt paths, and failure modes
 *   - an inventory-ledger mini panel inside each phase card shows deltas
 *     like `available: 80 → 70` with arrows, so a new user can see exactly
 *     how the three counters move at every step.
 */

const C = {
  bgPage:     '#f5f6fa',
  cardShadow: '0 2px 16px rgba(0,0,0,0.06)',
  railLine:   '#e5e7f0',
  okGreen:    '#52c41a',
  warnOrange: '#fa8c16',
  accent:     '#667eea',
  accentPur:  '#764ba2',
  bad:        '#f5222d',
  muted:      '#8c8c8c',
  chipBg:     '#f0f5ff',
  chipBorder: '#adc6ff',
};

/* ---------------------------------------------------------------------- */
/* Small visual primitives                                                 */
/* ---------------------------------------------------------------------- */

const LedgerCheatsheet = () => (
  <Card
    size="small"
    bordered={false}
    style={{ background: '#fffbe6', borderRadius: 12, boxShadow: C.cardShadow, marginBottom: 16 }}
  >
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
      <InfoCircleOutlined style={{ color: C.warnOrange, fontSize: 16 }} />
      <strong style={{ fontSize: 13 }}>Inventory ledger — three numbers to remember</strong>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 }}>
      {[
        { k: 'on_hand',   desc: 'Physical units sitting in the warehouse right now.' },
        { k: 'reserved',  desc: 'Part of on_hand that is promised to open sales orders.' },
        { k: 'available', desc: 'on_hand − reserved. What you can still sell today.' },
        { k: 'on_order',  desc: 'Units coming in from confirmed but not-yet-received POs.' },
      ].map((x) => (
        <div key={x.k} style={{
          background: '#fff', border: '1px solid #ffe58f', borderRadius: 10, padding: '8px 12px',
        }}>
          <div style={{ fontFamily: 'monospace', color: C.accent, fontWeight: 700, fontSize: 13 }}>{x.k}</div>
          <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.4 }}>{x.desc}</div>
        </div>
      ))}
    </div>
  </Card>
);

const Delta = ({ from, to }) => {
  if (from === to) {
    return <span style={{ color: C.muted }}>unchanged</span>;
  }
  const up = Number(to) > Number(from);
  const color = up ? C.okGreen : C.bad;
  const sign  = up ? '+' : '−';
  const diff  = Math.abs(Number(to) - Number(from));
  return (
    <span>
      <span style={{ color: C.muted }}>{from}</span>
      <ArrowRightOutlined style={{ margin: '0 6px', color: C.muted, fontSize: 10 }} />
      <strong style={{ color }}>{to}</strong>
      <span style={{ marginLeft: 6, color, fontSize: 11, fontWeight: 600 }}>({sign}{diff})</span>
    </span>
  );
};

const LedgerPanel = ({ ledger }) => {
  if (!ledger) return null;
  const rows = Object.entries(ledger);
  return (
    <div style={{
      background: '#fafbff', border: '1px dashed #d6deff',
      borderRadius: 10, padding: '10px 14px', marginTop: 12,
    }}>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        Inventory delta (example: 1 item starting at on_hand=100)
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 6 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ fontFamily: 'monospace', fontSize: 12 }}>
            <span style={{ color: C.accent, fontWeight: 600 }}>{k}:</span>{' '}
            <Delta from={v[0]} to={v[1]} />
          </div>
        ))}
      </div>
    </div>
  );
};

const PhaseCard = ({ phase, index, total }) => {
  const [open, setOpen] = useState(index === 0);
  const isLast = index === total - 1;
  const done = phase.terminal;

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
      {/* Left rail */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: done ? C.okGreen : `linear-gradient(135deg,${C.accent},${C.accentPur})`,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, boxShadow: '0 2px 8px rgba(102,126,234,0.35)', flexShrink: 0,
        }}>
          {done ? <CheckCircleFilled /> : index + 1}
        </div>
        {!isLast && (
          <div style={{ flex: 1, width: 2, background: C.railLine, marginTop: 4, minHeight: 30 }} />
        )}
      </div>

      {/* Right card */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
        <Card
          size="small"
          bordered={false}
          style={{ borderRadius: 12, boxShadow: C.cardShadow, borderLeft: `4px solid ${phase.color || C.accent}` }}
          bodyStyle={{ padding: '14px 16px' }}
        >
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, color: phase.color || C.accent }}>{phase.icon}</span>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{phase.title}</div>
            {phase.optional && <Tag color="default" style={{ marginLeft: 4 }}>optional</Tag>}
            {phase.status && (
              <Tag color="blue" style={{ fontFamily: 'monospace' }}>
                status → {phase.status}
              </Tag>
            )}
          </div>

          {/* Summary */}
          <div style={{ fontSize: 13, color: '#434343', marginTop: 6, lineHeight: 1.55 }}>
            {phase.summary}
          </div>

          {/* Chips: endpoint, tables */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {phase.endpoint && (
              <Tooltip title="HTTP endpoint the UI calls">
                <Tag style={{ fontFamily: 'monospace', background: C.chipBg, border: `1px solid ${C.chipBorder}` }}>
                  {phase.endpoint}
                </Tag>
              </Tooltip>
            )}
            {(phase.tables || []).map((t) => (
              <Tooltip key={t} title={`Database table written to`}>
                <Tag icon={<DatabaseOutlined />} color="purple" style={{ fontFamily: 'monospace' }}>{t}</Tag>
              </Tooltip>
            ))}
          </div>

          {/* Ledger */}
          <LedgerPanel ledger={phase.ledger} />

          {/* Deep dive */}
          {phase.detail && (
            <Collapse
              ghost
              activeKey={open ? ['1'] : []}
              onChange={(k) => setOpen(k.length > 0)}
              style={{ marginTop: 10 }}
              items={[{
                key: '1',
                label: <span style={{ color: C.accent, fontWeight: 600, fontSize: 12 }}>Deep dive — what the backend actually does</span>,
                children: (
                  <div style={{ fontSize: 12.5, color: '#555', lineHeight: 1.6, paddingLeft: 4 }}>
                    {phase.detail}
                  </div>
                ),
              }]}
            />
          )}

          {/* Branches / alt paths */}
          {(phase.branches || []).length > 0 && (
            <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: `2px dashed ${C.railLine}` }}>
              {phase.branches.map((b, i) => (
                <div key={i} style={{ fontSize: 12, color: '#595959', marginTop: i === 0 ? 0 : 6 }}>
                  <ArrowDownOutlined style={{ color: C.muted, marginRight: 6 }} />
                  <strong style={{ color: b.tone === 'danger' ? C.bad : b.tone === 'ok' ? C.okGreen : C.accent }}>
                    {b.label}:
                  </strong>{' '}
                  {b.desc}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

const FlowHeader = ({ title, subtitle, color1, color2, legend }) => (
  <Card
    bordered={false}
    bodyStyle={{ padding: 0 }}
    style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 18, boxShadow: C.cardShadow }}
  >
    <div style={{
      background: `linear-gradient(135deg,${color1},${color2})`,
      padding: '18px 22px', color: '#fff',
    }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginTop: 3 }}>{subtitle}</div>
    </div>
    <div style={{ padding: '12px 22px', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#595959' }}>
      {legend.map((l) => (
        <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 10, height: 10, borderRadius: 5, background: l.color, display: 'inline-block',
          }} />
          {l.label}
        </div>
      ))}
    </div>
  </Card>
);

/* ---------------------------------------------------------------------- */
/* Sales Order flow data                                                   */
/* Source of truth: docs/WORKFLOW.md §8                                    */
/* ---------------------------------------------------------------------- */

const SO_PHASES = [
  {
    title: 'Prerequisites — master data',
    icon: <UserOutlined />,
    color: '#8c8c8c',
    summary: 'Sidebar: Customers + Items (and warehouse). Before you can sell, the item, customer, and shipping/selling warehouse must exist. Stock should be available in inventory_projections (usually from a prior GRN).',
    endpoint: 'setup — one-time',
    tables: ['items', 'customers', 'warehouses', 'inventory_projections'],
    branches: [
      { label: 'Customers', desc: 'Maintained under Sales → Customers (/sales/customers).', tone: 'info' },
      { label: 'No stock yet', desc: 'Do a purchase flow first, or an Inventory Adjustment of type "gain".', tone: 'info' },
      { label: 'Item with variants', desc: 'Each variant is sold separately — the variant parent is not sellable.', tone: 'info' },
    ],
  },
  {
    title: 'Create the Sales Order',
    icon: <ShoppingCartOutlined />,
    color: '#667eea',
    status: 'draft',
    summary: 'Lines + quantities + warehouse are captured. The moment you save, stock is reserved for the customer so nobody else can sell it — this is the single most important side-effect to understand.',
    endpoint: 'POST /api/sales-orders',
    tables: ['sales_orders', 'sales_order_lines', 'inventory_projections', 'event_store'],
    ledger: {
      on_hand:   [100, 100],
      reserved:  [20,  30],
      available: [80,  70],
    },
    detail: (
      <>
        Creates the SO header + lines in one transaction, then calls <code>inventoryService.reserveStock</code> per line.
        An event <code>SALE_RESERVED</code> is written to <code>event_store</code> with idempotency key
        <code>reserve-&lt;soLineId&gt;</code>, so a retry never double-reserves. <code>quantity_reserved</code>
        increases and <code>quantity_available</code> decreases by the same amount — <code>quantity_on_hand</code>
        stays put because the goods haven't physically moved.
      </>
    ),
    branches: [
      { label: 'Not enough available', desc: 'The API returns 400 "Insufficient available stock" and no row is inserted.', tone: 'danger' },
    ],
  },
  {
    title: 'Confirm the Sales Order',
    icon: <FileTextOutlined />,
    color: '#722ed1',
    status: 'confirmed',
    optional: true,
    summary: 'Optional intermediate state. Confirms the order with the customer without shipping yet. No inventory change — the reservation from step 2 is still in place.',
    endpoint: 'PUT /api/sales-orders/:id/status (confirmed)',
    tables: ['sales_orders'],
    ledger: {
      on_hand:   [100, 100],
      reserved:  [30, 30],
      available: [70, 70],
    },
    branches: [
      { label: 'Alt: skip this step', desc: 'You can go straight from draft to ship. Confirming is only for a clearer audit trail.', tone: 'info' },
    ],
  },
  {
    title: 'Ship the Sales Order',
    icon: <TruckOutlined />,
    color: '#fa8c16',
    status: 'partially_shipped → shipped',
    summary: 'Pick, pack, and ship. This is where stock physically leaves the warehouse. on_hand drops, reserved drops by the same amount, available is unchanged (it was already dropped at step 2).',
    endpoint: 'POST /api/sales-orders/:id/ship',
    tables: ['sales_orders', 'sales_order_lines', 'inventory_projections', 'stock_movements', 'event_store'],
    ledger: {
      on_hand:   [100, 90],
      reserved:  [30, 20],
      available: [70, 70],
    },
    detail: (
      <>
        Per line: decrements <code>inventory_projections.quantity_on_hand</code> and
        <code>quantity_reserved</code> by the shipped qty, inserts a <code>stock_movements</code> row
        (<code>movement_type = 'sales'</code>), and emits <code>SALE_SHIPPED</code>. If every line is fully
        shipped, the SO header moves to <code>shipped</code>; otherwise <code>partially_shipped</code> and you
        ship the remainder later.
      </>
    ),
    branches: [
      { label: 'Partial ship', desc: 'Ship less than ordered: status becomes partially_shipped, repeat the step for the rest.', tone: 'info' },
      { label: 'Short-cut', desc: 'POST /sales-orders/:id/confirm runs a ship-everything + create-invoice in one call.', tone: 'info' },
    ],
  },
  {
    title: 'Delivery Challan',
    icon: <FileTextOutlined />,
    color: '#13c2c2',
    optional: true,
    summary: 'Sidebar: Delivery Challans (/sales/delivery-challans). Optional dispatch document for the customer or carrier. Stock already left at ship; challan does not change on_hand again.',
    endpoint: 'POST /api/delivery-challans',
    tables: ['delivery_challans', 'delivery_challan_lines'],
    ledger: {
      on_hand:   [90, 90],
      reserved:  [20, 20],
      available: [70, 70],
    },
  },
  {
    title: 'Sales Invoice',
    icon: <SolutionOutlined />,
    color: '#eb2f96',
    status: 'AR recorded',
    summary: 'Sidebar: Sales Invoices (/sales-invoices) — same records as Invoices → Sales in some setups. Bill for what you sold. No second hit to on_hand (already reduced at ship); this is revenue + receivables.',
    endpoint: 'POST /api/sales-invoices',
    tables: ['sales_invoices', 'sales_invoice_lines', 'accounting_entries'],
    ledger: {
      on_hand:   [90, 90],
      reserved:  [20, 20],
      available: [70, 70],
    },
    detail: (
      <>
        Create from a shipped SO (<code>POST /sales-invoices</code>) or convert a delivered challan (
        <code>POST /delivery-challans/:id/convert-to-invoice</code>). Posting (
        <code>POST /sales-invoices/:id/post</code>) writes <code>accounting_entries</code>. Inventory movement is complete at <strong>ship</strong>.
      </>
    ),
  },
  {
    title: 'Payments Received',
    icon: <DollarCircleOutlined />,
    color: '#52c41a',
    status: 'paid / partially_paid',
    summary: 'Sidebar: Payments Received (/sales/payments-received). Customer pays you — records against the sales invoice. Purely cash/bank vs receivable; no inventory movement.',
    endpoint: 'POST /api/sales-invoices/:id/payments',
    tables: ['invoice_payments', 'accounting_entries'],
    ledger: {
      on_hand:   [90, 90],
      reserved:  [20, 20],
      available: [70, 70],
    },
    branches: [
      { label: 'Partial payments', desc: 'Multiple payment rows until the invoice is fully settled.', tone: 'info' },
    ],
  },
  {
    title: 'Credit Notes',
    icon: <GiftOutlined />,
    color: '#faad14',
    optional: true,
    summary: 'Sidebar: Credit Notes (/sales/credit-notes). A sales credit note reduces what the customer owes (rebate, pricing fix, service issue). Created as a sales invoice with type credit_note — financial; it does not by itself put goods back on the shelf.',
    endpoint: 'POST /api/sales-invoices (invoiceType: credit_note)',
    tables: ['sales_invoices', 'accounting_entries'],
    ledger: {
      on_hand:   [90, 90],
      reserved:  [20, 20],
      available: [70, 70],
    },
    detail: (
      <>
        Pairs logically with an agreed price adjustment. If goods are physically returned, use <strong>Sales Returns</strong> (or your SOP) so stock and money stay aligned.
      </>
    ),
  },
  {
    title: 'Sales Returns',
    icon: <RollbackOutlined />,
    color: '#722ed1',
    optional: true,
    summary: 'Sidebar: Sales Returns (/sales/returns). Exception path after a sale — customer sends goods back. Business intent: increase on_hand when product is accepted back into the warehouse (mirror of ship). Confirm your org’s process: some teams use a dedicated return receipt; the UI may record a follow-up document.',
    endpoint: 'varies — align with sales return SOP',
    tables: ['sales_orders', 'sales_order_lines', 'inventory_projections'],
    ledger: {
      on_hand:   [90, 95],
      reserved:  [20, 20],
      available: [70, 75],
    },
    detail: (
      <>
        <strong>Target model:</strong> stock increases when the return is accepted (opposite of ship). Implementation details can differ by release — if returns and normal orders share the same create endpoint, validate with a test return in a sandbox so reservation behaviour matches your expectation (
        <code>docs/WORKFLOW.md</code> notes some sales-return UI vs backend alignment gaps).
      </>
    ),
    branches: [
      { label: 'vs Credit Note', desc: 'Credit note = money owed adjustment; return = (usually) physical stock + financial follow-up.', tone: 'info' },
    ],
  },
  {
    title: 'Done',
    icon: <CheckCircleFilled />,
    color: C.okGreen,
    summary: 'SO shipped, invoiced, paid (or adjusted with credits/returns as needed). Standard happy path: reserve → ship reduces on_hand; money steps do not change stock.',
    terminal: true,
    ledger: {
      on_hand:   [100, 90],
      reserved:  [30, 20],
      available: [70, 70],
    },
  },
];

const SO_ALT_PATHS = [
  { title: 'Why the first guide looked shorter', color: C.accent, desc: 'Like Purchases, the first version was one straight line: SO → ship → invoice → pay. The Sales menu names each screen (Delivery Challans, Payments Received, Credit Notes, Returns) — several are the same step under different entry points, and credits/returns are optional exceptions after the main sale.' },
  { title: 'Cancel before ship', color: '#fa541c', desc: 'POST /sales-orders/:id/cancel — reservation released (reserved ↓, available ↑). on_hand unchanged.' },
  { title: 'Same screens, other modules', color: '#13c2c2', desc: 'Sales Invoices also appear under Invoices → Sales (/invoices/sales) for users who work from a combined invoice desk.' },
];

/** Maps every item under the Sales sidebar to: role, when, inventory */
const SALES_MENU_ROWS = [
  { key: '1', menu: 'Customers',           route: '/sales/customers',         role: 'Master data',              when: 'Before first SO',   inv: '—',    note: 'Who you sell to' },
  { key: '2', menu: 'Sales Orders',        route: '/sales-orders',              role: 'Step 1 — order + reserve', when: 'When customer orders', inv: 'avail↓', note: 'Reserved at save' },
  { key: '3', menu: 'Sales Invoices',      route: '/sales-invoices',            role: 'Step 2 — customer bill',   when: 'After ship (usually)', inv: '—',    note: 'Same as Invoices → Sales' },
  { key: '4', menu: 'Delivery Challans',   route: '/sales/delivery-challans',  role: 'Optional — dispatch doc',  when: 'With shipment',     inv: '—',    note: 'No extra stock move' },
  { key: '5', menu: 'Payments Received',  route: '/sales/payments-received', role: 'Step 3 — collect cash',  when: 'After invoice',     inv: '—',    note: 'AR settlement' },
  { key: '6', menu: 'Sales Returns',      route: '/sales/returns',            role: 'Exception — goods back',   when: 'After sale',        inv: 'on_hand↑', note: 'Intended: put stock back' },
  { key: '7', menu: 'Credit Notes',        route: '/sales/credit-notes',       role: 'Exception — reduce AR',  when: 'Rebate / dispute',  inv: '—',   note: 'Financial; pair with return if physical' },
];

const SalesMenuMap = () => (
  <Card
    bordered={false}
    size="small"
    style={{ borderRadius: 12, boxShadow: C.cardShadow, marginBottom: 16 }}
    title={(
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FileDoneOutlined style={{ color: C.accent }} />
        <span>Sales menu — how each page maps to the flow</span>
      </div>
    )}
  >
    <Table
      size="small"
      pagination={false}
      dataSource={SALES_MENU_ROWS}
      rowKey="key"
      scroll={{ x: 980 }}
      columns={[
        { title: 'Sidebar', dataIndex: 'menu', width: 170,
          render: (t, r) => (
            <div>
              <div><UserOutlined style={{ marginRight: 6, color: C.muted }} />{t}</div>
              <code style={{ fontSize: 10, color: C.muted }}>{r.route}</code>
            </div>
          ),
        },
        { title: 'Role in the process', dataIndex: 'role', width: 200 },
        { title: 'Typical when', dataIndex: 'when', width: 150 },
        { title: 'Inventory', dataIndex: 'inv', width: 110,
          render: (v) => {
            if (v === '—') return <span style={{ color: C.muted }}>no change</span>;
            if (v === 'avail↓') return <Tag color="orange">available ↓</Tag>;
            if (v === 'on_hand↑') return <Tag color="blue">on_hand ↑</Tag>;
            return <Tag>{v}</Tag>;
          },
        },
        { title: 'Note', dataIndex: 'note', width: 220 },
      ]}
    />
  </Card>
);

/* ---------------------------------------------------------------------- */
/* Purchase Order flow data                                                */
/* Source of truth: docs/WORKFLOW.md §7                                    */
/* ---------------------------------------------------------------------- */

const PO_PHASES = [
  {
    title: 'Prerequisites — master data',
    icon: <InboxOutlined />,
    color: '#8c8c8c',
    summary: 'Before you can buy, the item, vendor, and the destination warehouse must exist. Unlike sales, stock can start at zero — the PO is how the item arrives in the first place.',
    endpoint: 'setup — one-time',
    tables: ['items', 'vendors', 'warehouses'],
  },
  {
    title: 'Create the Purchase Order',
    icon: <ShopOutlined />,
    color: '#667eea',
    status: 'draft',
    summary: 'Capture what you want to buy, from whom, at what unit cost, delivered to which warehouse. Nothing physical has moved — no on_hand change. The "expected to arrive" signal lives on the PO line, not the ledger.',
    endpoint: 'POST /api/purchase-orders',
    tables: ['purchase_orders', 'purchase_order_lines'],
    ledger: {
      on_hand:   [100, 100],
      available: [80, 80],
    },
    detail: (
      <>
        Header + lines are written in a single transaction. Each line carries the <code>warehouse_id</code> it will
        be received into (GRN later validates this matches). On-order visibility today is read from
        <code>purchase_order_lines</code> filtered by status; a dedicated ledger column is on the roadmap.
      </>
    ),
  },
  {
    title: 'Confirm / Send the PO',
    icon: <FileTextOutlined />,
    color: '#722ed1',
    status: 'confirmed (or sent)',
    summary: 'Lock the PO down and send it to the vendor. After confirmation you cannot freely edit lines — only receive against them.',
    endpoint: 'POST /api/purchase-orders/:id/confirm',
    tables: ['purchase_orders'],
    branches: [
      { label: 'Alt: PUT /:id/status (sent)', desc: 'Two-step workflow if you want an explicit "sent to vendor" state before confirm.', tone: 'info' },
    ],
  },
  {
    title: 'Receive goods — create GRN',
    icon: <TruckOutlined />,
    color: '#fa8c16',
    status: 'partially_received → received',
    summary: 'Vendor delivers. You post a Goods Receipt Note (GRN) for what actually arrived. This is the step where stock lands in your warehouse — on_hand goes up, average cost is recomputed.',
    endpoint: 'POST /api/grn',
    tables: ['goods_receipt_notes', 'grn_lines', 'purchase_order_lines', 'inventory_projections', 'event_store'],
    ledger: {
      on_hand:   [100, 110],
      reserved:  [20, 20],
      available: [80, 90],
    },
    detail: (
      <>
        Per GRN line, inside one transaction:
        (1) validates warehouse and <code>quantity_received ≤ quantity_pending</code>;
        (2) inserts <code>grn_lines</code>;
        (3) updates <code>purchase_order_lines.quantity_received</code> and line status
        (<code>pending / partially_received / received</code>);
        (4) upserts <code>inventory_projections</code> — <code>on_hand += qty</code>,
        <code>available += qty</code>, weighted-average <code>average_cost</code> recomputed,
        <code>version += 1</code>;
        (5) writes <code>event_store</code> with idempotency key <code>receive-&lt;grnLineId&gt;</code>;
        (6) updates the PO header status.
      </>
    ),
    branches: [
      { label: 'Partial receive', desc: 'Receive less than ordered: status becomes partially_received, do another GRN for the rest.', tone: 'info' },
      { label: 'Quantity over-receive', desc: 'Blocked with 400 — the API enforces qty ≤ pending.', tone: 'danger' },
    ],
  },
  {
    title: 'Putaway — Zone / Rack / Bin',
    icon: <BankOutlined />,
    color: '#13c2c2',
    optional: true,
    summary: 'Physically place the stock into a specific bin. Items carry a default bin (settable on the Item page), but GRN writes stock at warehouse granularity today — bin-level ledger is a roadmap item.',
    tables: ['warehouse_bins'],
    branches: [
      { label: 'Current state', desc: 'items.default_bin_id is stored but GRN does not yet consume it.', tone: 'info' },
    ],
  },
  {
    title: 'Bill / Purchase Invoice',
    icon: <FileDoneOutlined />,
    color: '#eb2f96',
    status: 'vendor bill recorded',
    summary: 'Same flow whether you open Purchase Invoices, Bills under Purchases, or the Invoice module — you record the vendor’s bill, line taxes, and post to accounting. No automatic change to on_hand (stock already changed at GRN).',
    endpoint: 'POST /api/purchase-invoices (or generate-from-grn / generate-from-po)',
    tables: ['purchase_invoices', 'purchase_invoice_lines', 'accounting_entries'],
    ledger: {
      on_hand:   [110, 110],
      available: [90, 90],
    },
    detail: (
      <>
        UI routes <code>/purchase-invoices</code>, <code>/purchases/bills</code>, and <code>/invoices/purchase</code> all surface the
        same purchase-invoice data — different entry points, one backend. Posting (
        <code>POST /purchase-invoices/:id/post</code>) writes <code>accounting_entries</code> (expense + accounts payable). Inventory was
        already updated at GRN; the bill is money owed, not another receipt.
      </>
    ),
    branches: [
      { label: 'Alt', desc: 'Generate from PO or from GRN depending on how the vendor bills you.', tone: 'info' },
    ],
  },
  {
    title: 'Payments Made',
    icon: <DollarCircleOutlined />,
    color: '#52c41a',
    status: 'paid / partially_paid',
    summary: 'This is the “Payments Made” screen — you pay the vendor against a posted purchase invoice. Records cash/bank and closes (or part-closes) the bill.',
    endpoint: 'POST /api/purchase-invoices/:id/payments',
    tables: ['invoice_payments', 'accounting_entries'],
    ledger: {
      on_hand:   [110, 110],
      available: [90, 90],
    },
    detail: (
      <>
        No inventory movement — you are only settling liabilities. <code>invoice_payments</code> with the purchase invoice type. Multiple
        partial payments are allowed until the open balance is zero.
      </>
    ),
  },
  {
    title: 'Vendor Credits',
    icon: <GiftOutlined />,
    color: '#faad14',
    optional: true,
    summary: 'A vendor credit (credit note) reduces what you owe — usually for price adjustments, service failures, or agreed rebates. Created as a purchase document with type credit_note. Does not, by itself, remove stock from the warehouse.',
    endpoint: 'POST /api/purchase-invoices (invoiceType: credit_note)',
    tables: ['purchase_invoices', 'accounting_entries'],
    ledger: {
      on_hand:   [110, 110],
      available: [90, 90],
    },
    detail: (
      <>
        <code>VendorCredits.jsx</code> posts to the same <code>purchase_invoices</code> table with <code>invoice_type = credit_note</code>.
        It offsets payables. If the credit is for returned goods, you normally also use <strong>Purchase Returns</strong> so inventory and
        money stay in sync; the credit alone is the financial side.
      </>
    ),
    branches: [
      { label: 'Inventory?', desc: 'No automatic on_hand change from vendor credits. Physical returns use Purchase Returns.', tone: 'info' },
    ],
  },
  {
    title: 'Purchase Returns',
    icon: <RollbackOutlined />,
    color: '#722ed1',
    optional: true,
    summary: 'You send goods back to the vendor (defective, over-shipment, etc.). On confirm, stock is removed from the warehouse: on_hand and available both decrease, and a debit note is generated.',
    endpoint: 'POST /api/purchase-returns + POST …/confirm',
    tables: ['purchase_returns', 'purchase_return_lines', 'inventory_projections', 'inventory_adjustments'],
    ledger: {
      on_hand:   [110, 105],
      available: [90, 85],
    },
    detail: (
      <>
        <code>confirmPurchaseReturn</code> validates you are not returning more than was received, then
        <code>UPDATE inventory_projections</code> to decrease <code>quantity_on_hand</code> and
        <code>quantity_available</code>, and logs an <code>inventory_adjustments</code> row. This is the purchase-side
        counter-step to GRN: goods physically leave.
      </>
    ),
    branches: [
      { label: 'Draft first', desc: 'Create return in draft, then confirm when the goods have actually left your warehouse.', tone: 'info' },
    ],
  },
  {
    title: 'Done',
    icon: <CheckCircleFilled />,
    color: C.okGreen,
    summary: 'Stock received, bills and credits aligned, vendor paid (or net balance). Goods available to sell; exceptions (returns) handled in their own steps.',
    terminal: true,
    ledger: {
      on_hand:   [100, 110],
      available: [80, 90],
    },
  },
];

const PO_ALT_PATHS = [
  { title: 'Why the first guide looked shorter', color: C.accent, desc: 'The main roadmap teaches one straight path: order → receive → bill → pay. The Purchases menu lists every screen; several point at the same backend step (Bills = Purchase Invoices), and vendor credits / returns are optional exception flows — we folded them in above so the inventory effect is explicit.' },
  { title: 'Cancel before receive', color: '#fa541c', desc: 'POST /purchase-orders/:id/cancel — PO is cancelled; inventory is untouched if no GRN was posted.' },
];

/* ---------------------------------------------------------------------- */
/* Price List flow data                                                    */
/* Source of truth: docs/WORKFLOW.md §5.1                                  */
/* ---------------------------------------------------------------------- */

const PL_PHASES = [
  {
    title: 'Prerequisites — items and customer segments',
    icon: <UserOutlined />,
    color: '#8c8c8c',
    summary: 'Define sellable items first, then decide which customer segments need special pricing (e.g. retail, wholesale, VIP).',
    endpoint: 'setup — one-time',
    tables: ['items', 'customers'],
    branches: [
      { label: 'Tip', desc: 'Use one list per policy, then assign to customer groups.', tone: 'info' },
    ],
  },
  {
    title: 'Create Price List',
    icon: <TagsOutlined />,
    color: '#11998e',
    status: 'active',
    summary: 'Create list with currency, type (sales/purchase), and optional list-level discount. Mark as default if required for that type.',
    endpoint: 'POST /api/price-lists',
    tables: ['price_lists'],
    detail: (
      <>
        Creates price-list master row. If <code>is_default = true</code>, backend clears previous default for the same
        <code>pricelist_type</code>. If currency is omitted, institution currency is used.
      </>
    ),
  },
  {
    title: 'Configure Item Rules',
    icon: <SettingOutlined />,
    color: '#667eea',
    summary: 'Add item-level pricing logic: custom price override or item discount (% / fixed). One rule per item per list.',
    endpoint: 'POST /api/price-lists/:id/items',
    tables: ['price_list_items'],
    detail: (
      <>
        Upsert behavior: existing <code>(price_list_id, item_id)</code> row updates; otherwise inserts new row.
        Rule precedence later in SO is: custom price {'>'} item discount {'>'} list discount {'>'} base price.
      </>
    ),
    branches: [
      { label: 'Custom price', desc: 'Absolute unit price replacement for that item.', tone: 'ok' },
      { label: 'Discount rule', desc: 'Keeps base selling price and applies discount.', tone: 'info' },
    ],
  },
  {
    title: 'Assign List to Customer',
    icon: <TeamOutlined />,
    color: '#722ed1',
    summary: 'Link the price list on customer create/edit form so sales teams do not choose pricing manually every time.',
    endpoint: 'GET /api/customers/:id/price-list',
    tables: ['customers'],
    detail: (
      <>
        In SO create form, selecting customer auto-fetches assigned list. If found, SO form auto-populates
        <code>priceListId</code> and applies mapped unit price/discount on matching line items.
      </>
    ),
  },
  {
    title: 'Apply in Sales Order',
    icon: <ShoppingCartOutlined />,
    color: '#fa8c16',
    status: 'pricing applied',
    summary: 'Create SO; selected price list drives unit price/discount per item. Items not present in list mapping use normal selling price.',
    endpoint: 'GET /api/price-lists/:id + POST /api/sales-orders',
    tables: ['sales_orders', 'sales_order_lines'],
    detail: (
      <>
        SO UI loads list item map and calculates line values in this order:
        custom price, else item-level discount, else list-level discount, else base selling price.
      </>
    ),
    branches: [
      { label: 'Manual override', desc: 'User can still edit line unit price/discount before saving SO.', tone: 'info' },
    ],
  },
  {
    title: 'Maintain / Deactivate List',
    icon: <FileDoneOutlined />,
    color: '#13c2c2',
    optional: true,
    summary: 'Update list details any time. Delete action is soft-delete (inactive), so list disappears from active listing but history remains.',
    endpoint: 'PUT /api/price-lists/:id, DELETE /api/price-lists/:id',
    tables: ['price_lists', 'price_list_items'],
    detail: (
      <>
        Deletion sets <code>status = inactive</code>; list is filtered out from <code>GET /api/price-lists</code>.
        Existing sales documents remain unchanged.
      </>
    ),
  },
  {
    title: 'Done',
    icon: <CheckCircleFilled />,
    color: C.okGreen,
    summary: 'Pricing policies are centrally managed and consistently applied in SO creation, with customer-based auto-selection.',
    terminal: true,
  },
];

const PL_ALT_PATHS = [
  { title: 'Feature gate', color: '#fa8c16', desc: "All price-list APIs are guarded by checkFeature('price_lists'). If plan doesn't include it, UI shows warning/permission error." },
  { title: 'Default behavior', color: '#13c2c2', desc: 'Default list is stored and displayed, but SO auto-selection is primarily customer-assignment based.' },
  { title: 'Scope of effect', color: '#722ed1', desc: 'Only items present in price_list_items receive price-list logic; others stay on normal selling price.' },
];

/** Maps every item under the Purchases sidebar to: role,when,inventory */
const PURCHASES_MENU_ROWS = [
  { key: '1', menu: 'Vendors',            route: '/purchases/vendors',     role: 'Master data',              when: 'Before first PO', inv: '—',         note: 'Who you buy from' },
  { key: '2', menu: 'Purchase Orders',    route: '/purchase-orders',       role: 'Step 1 — commitment to buy', when: 'After vendors/items', inv: '—', note: 'No stock until GRN' },
  { key: '3', menu: 'Purchase Invoices',  route: '/purchase-invoices',     role: 'Step 2 — same as Bill',     when: 'When vendor bills you', inv: '—', note: 'Accrual / AP' },
  { key: '4', menu: 'Purchase Receives',  route: '/purchases/receives',    role: 'GRN in the UI',            when: 'Goods arrive',         inv: '↑ on_hand', note: 'Where stock is added' },
  { key: '5', menu: 'Bills',              route: '/purchases/bills',      role: 'Step 2 — same as invoice',   when: 'When vendor bills you', inv: '—', note: 'Another entry to same PI' },
  { key: '6', menu: 'Payments Made',      route: '/purchases/payments-made', role: 'Step 3 — pay vendor',   when: 'After bill (usually)', inv: '—', note: 'Cash/bank' },
  { key: '7', menu: 'Vendor Credits',     route: '/purchases/vendor-credits', role: 'Exception — reduce AP', when: 'Rebates, price fixes', inv: '—', note: 'Usually no stock; pair with return if physical' },
  { key: '8', menu: 'Purchase Returns',   route: '/purchases/returns',     role: 'Exception — send stock back', when: 'After receipt',   inv: '↓ on_hand', note: 'Confirms with debit note' },
];

const PurchasesMenuMap = () => (
  <Card
    bordered={false}
    size="small"
    style={{ borderRadius: 12, boxShadow: C.cardShadow, marginBottom: 16 }}
    title={(
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ContainerOutlined style={{ color: C.accent }} />
        <span>Purchases menu — how each page maps to the flow</span>
      </div>
    )}
  >
    <Table
      size="small"
      pagination={false}
      dataSource={PURCHASES_MENU_ROWS}
      rowKey="key"
      scroll={{ x: 980 }}
      columns={[
        { title: 'Sidebar', dataIndex: 'menu', width: 170,
          render: (t, r) => (
            <div>
              <div><TeamOutlined style={{ marginRight: 6, color: C.muted }} />{t}</div>
              <code style={{ fontSize: 10, color: C.muted }}>{r.route}</code>
            </div>
          ),
        },
        { title: 'Role in the process', dataIndex: 'role', width: 200 },
        { title: 'Typical when', dataIndex: 'when', width: 150 },
        { title: 'Inventory', dataIndex: 'inv', width: 100, render: (v) => v === '—' ? <span style={{ color: C.muted }}>no change</span> : <Tag color="blue">{v}</Tag> },
        { title: 'Note', dataIndex: 'note', width: 220 },
      ]}
    />
  </Card>
);

/* ---------------------------------------------------------------------- */
/* Flow layouts                                                            */
/* ---------------------------------------------------------------------- */

const AltPathsCard = ({ paths }) => (
  <Card
    bordered={false}
    size="small"
    style={{ marginTop: 18, borderRadius: 12, boxShadow: C.cardShadow }}
    title={
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RollbackOutlined style={{ color: C.warnOrange }} />
        <span>Other paths from the happy flow</span>
      </div>
    }
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 10 }}>
      {paths.map((p) => (
        <div key={p.title}
             style={{ padding: '10px 12px', borderLeft: `4px solid ${p.color}`,
                      background: '#fafafa', borderRadius: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: p.color }}>{p.title}</div>
          <div style={{ fontSize: 12.5, color: '#595959', marginTop: 4, lineHeight: 1.5 }}>{p.desc}</div>
        </div>
      ))}
    </div>
  </Card>
);

const MiniNav = ({ phases }) => (
  <Card
    bordered={false}
    size="small"
    style={{ borderRadius: 12, boxShadow: C.cardShadow, marginBottom: 16 }}
    bodyStyle={{ padding: 12 }}
  >
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      Process overview
    </div>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
      {phases.map((p, i) => (
        <React.Fragment key={p.title}>
          <Tag color={p.terminal ? 'green' : 'geekblue'}
               style={{ margin: 0, fontSize: 12, padding: '2px 10px', borderRadius: 16 }}>
            {i + 1}. {p.title.replace(/^.* — /, '')}
          </Tag>
          {i < phases.length - 1 && <ArrowRightOutlined style={{ color: C.muted, fontSize: 10 }} />}
        </React.Fragment>
      ))}
    </div>
  </Card>
);

export const SalesOrderFlow = () => (
  <div style={{ background: C.bgPage, borderRadius: 12, padding: 16 }}>
    <FlowHeader
      title="Sales Order — end-to-end lifecycle"
      subtitle="Aligned with the Sales sidebar: customers → order → ship → challan/invoice → payments, plus optional credit notes and returns. Inventory only moves on create (reservation) and ship; the rest is documents and money."
      color1="#f093fb" color2="#f5576c"
      legend={[
        { label: 'Core phase', color: C.accent },
        { label: 'Optional step', color: '#13c2c2' },
        { label: 'Status change', color: '#722ed1' },
        { label: 'Terminal', color: C.okGreen },
      ]}
    />
    <LedgerCheatsheet />
    <Alert
      type="info" showIcon
      style={{ marginBottom: 14 }}
      message="The Sales menu has more labels than there are “stock events”: Delivery Challan and Sales Invoice are different papers for different teams; only Sales Orders (reservation) and Ship (on_hand down) change inventory. Payments Received, Credit Notes, and Returns are the financial / exception column."
    />
    <SalesMenuMap />
    <MiniNav phases={SO_PHASES} />
    <Alert
      type="info" showIcon style={{ marginBottom: 14 }}
      message="Watch on_hand / reserved / available in each phase card. Invoices, payments, and credit notes do not re-hit stock — goods already left at ship."
    />
    <div>
      {SO_PHASES.map((p, i) => (
        <PhaseCard key={p.title} phase={p} index={i} total={SO_PHASES.length} />
      ))}
    </div>
    <AltPathsCard paths={SO_ALT_PATHS} />
  </div>
);

export const PurchaseOrderFlow = () => (
  <div style={{ background: C.bgPage, borderRadius: 12, padding: 16 }}>
    <FlowHeader
      title="Purchase Order — end-to-end lifecycle"
      subtitle="Covers the full Purchases area: order → receive (GRN) → bill → pay → optional vendor credit / purchase return, with inventory effect called out on each step."
      color1="#4facfe" color2="#00f2fe"
      legend={[
        { label: 'Core phase', color: C.accent },
        { label: 'Optional step', color: '#13c2c2' },
        { label: 'Status change', color: '#722ed1' },
        { label: 'Terminal', color: C.okGreen },
      ]}
    />
    <LedgerCheatsheet />
    <Alert
      type="info" showIcon
      style={{ marginBottom: 14 }}
      message="Why it looked shorter at first: the first version was a clean “happy path” so new users are not overwhelmed. Your sidebar has more labels because teams think in different words — e.g. Bills and Purchase Invoices are the same step; only GRN and Purchase Returns change on_hand."
    />
    <PurchasesMenuMap />
    <MiniNav phases={PO_PHASES} />
    <Alert
      type="info" showIcon style={{ marginBottom: 14 }}
      message="GRN / Purchase Receives is where stock is added. Bills, Invoices, Payments Made, and Vendor Credits are money/owed — no automatic on_hand change. Purchase Returns reduces stock when you confirm the return."
    />
    <div>
      {PO_PHASES.map((p, i) => (
        <PhaseCard key={p.title} phase={p} index={i} total={PO_PHASES.length} />
      ))}
    </div>
    <AltPathsCard paths={PO_ALT_PATHS} />
  </div>
);

export const PriceListFlow = () => (
  <div style={{ background: C.bgPage, borderRadius: 12, padding: 16 }}>
    <FlowHeader
      title="Price List — end-to-end lifecycle"
      subtitle="Covers setup, item rules, customer assignment, and real Sales Order pricing behavior."
      color1="#11998e" color2="#38ef7d"
      legend={[
        { label: 'Core phase', color: C.accent },
        { label: 'Optional step', color: '#13c2c2' },
        { label: 'Status change', color: '#722ed1' },
        { label: 'Terminal', color: C.okGreen },
      ]}
    />
    <Alert
      type="info" showIcon style={{ marginBottom: 14 }}
      message="Price list itself does not move inventory. It standardizes pricing that is consumed during Sales Order line creation."
    />
    <MiniNav phases={PL_PHASES} />
    <div>
      {PL_PHASES.map((p, i) => (
        <PhaseCard key={p.title} phase={p} index={i} total={PL_PHASES.length} />
      ))}
    </div>
    <AltPathsCard paths={PL_ALT_PATHS} />
  </div>
);

export default { SalesOrderFlow, PurchaseOrderFlow, PriceListFlow };
