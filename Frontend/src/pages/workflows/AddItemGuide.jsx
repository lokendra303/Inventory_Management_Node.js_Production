import React from 'react';
import { Alert, Card, Table, Typography } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

const tableProps = {
  size: 'small',
  pagination: false,
  showHeader: true,
  style: { marginBottom: 0 },
};

const colField = { title: 'Field / area', dataIndex: 'field', width: '32%', render: (t) => <Text strong>{t}</Text> };
const colInfo = { title: 'Purpose (brief)', dataIndex: 'info' };

/**
 * User-facing reference for the Add / Edit Item modal (Items page).
 * Keep in sync with Frontend/src/pages/inventory/Items.jsx sections.
 */
export function AddItemGuide() {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Alert
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        message="Where to find this form"
        description={
          <span>
            Go to <Text code>Inventory → Items</Text>, then <Text strong>Add Item</Text> (or edit an existing row). The same modal is used for create and update.
            Prices are stored <Text strong>per unit</Text> of the selected <Text strong>Unit</Text>; currency picks which FX rate applies before saving.
          </span>
        }
      />

      <Alert
        type="warning"
        showIcon
        message="Item types"
        description={
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
            <li><Text strong>Simple</Text> — one SKU; optional “quick variant” tags (colour, size, pack) are labels only.</li>
            <li><Text strong>Variant</Text> — many SKUs from a matrix (e.g. size × colour); stock and prices are set per child row.</li>
            <li><Text strong>Service</Text> — non-stock; inventory sections are largely irrelevant.</li>
            <li><Text strong>BOM / kit items</Text> — managed under <Text code>Production → BOM Items</Text>, not on this form.</li>
          </ul>
        }
      />

      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} title="Basic Information">
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Identity, classification, physical attributes, and retail identifiers.
        </Paragraph>
        <Table
          {...tableProps}
          rowKey="field"
          columns={[colField, colInfo]}
          dataSource={[
            { field: 'SKU', info: 'Unique code for this item or variant line. Used on documents, barcodes, and duplicate checks. Optional SKU rules / Generate SKU help auto-build it from category and attributes.' },
            { field: 'Item Name', info: 'Name shown in lists, orders, and invoices.' },
            { field: 'Variant / Packing, Colour, Size, Pack Type', info: 'For non-variant items: optional labels (e.g. 100ML, Red, Large) to refine naming and SKU generation — not full multi-attribute variants.' },
            { field: 'Item type', info: 'Controls whether you get a single row, a variant matrix, or a service item. BOM kits use Production.' },
            { field: 'Category', info: 'Reporting group and input for default SKU rules.' },
            { field: 'Unit', info: 'How stock and prices are counted (pieces, kg, box, etc.).' },
            { field: 'Item Group', info: 'Optional higher-level grouping for filters and reporting.' },
            { field: 'Returnable item', info: 'Marks whether returns are expected for this product (business / process hint).' },
            { field: 'Item Image', info: 'Thumbnail used in catalogs and item views.' },
            { field: 'Dimensions (L × W × H)', info: 'Physical size of one sellable unit — useful for shipping and storage planning.' },
            { field: 'Weight', info: 'Weight of one unit in the chosen weight unit (shipping, labels).' },
            { field: 'Manufacturer / Brand', info: 'Linked master records for supplier and catalog display.' },
            { field: 'UPC, EAN, ISBN, Barcode', info: 'Standard product identifiers; EAN supports lookup to fill name and attributes where available.' },
            { field: 'MPN', info: 'Manufacturer part number — internal or supplier reference.' },
            { field: 'HSN Code', info: 'Tax / customs classification (e.g. GST line mapping).' },
            { field: 'Batch Number', info: 'Default or reference batch label when batch tracking applies.' },
          ]}
        />
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} title="Production — BOM items (kits)">
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          BOM / composite kits are created under <Text code>Production → BOM Items</Text>, not on the Items page. Use <Text code>Production → BOM Operation</Text> to assemble or disassemble finished kits from parts.
        </Paragraph>
        <Table
          {...tableProps}
          rowKey="field"
          columns={[colField, colInfo]}
          dataSource={[
            { field: 'Component item', info: 'An existing catalogue item (simple or variant only). Each row is one BOM line for the parent kit.' },
            { field: 'Qty per 1 kit', info: 'How many units of the component belong to exactly one unit of the parent kit.' },
            { field: 'Fulfillment mode', info: 'Pre-built: sell finished kit stock. Explode on ship: consume components when shipping sales orders.' },
            { field: 'Consume when → Shipment / Order', info: 'For explode-on-ship kits: when component stock is reserved or consumed.' },
          ]}
        />
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} title="Sales Information">
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Customer-facing pricing and tax context for quotations, sales orders, and invoices.
        </Paragraph>
        <Table
          {...tableProps}
          rowKey="field"
          columns={[colField, colInfo]}
          dataSource={[
            { field: 'Price Currency', info: 'Currency you type selling price and MRP in; backend converts using configured rates where needed.' },
            { field: 'Selling Price', info: 'Usual selling amount per unit before tax (as shown to customers).' },
            { field: 'MRP', info: 'Maximum retail price / list price reference per unit.' },
            { field: 'Account', info: 'Income-side ledger mapping for this item’s sales.' },
            { field: 'Tax Rate (%)', info: 'Default sales tax rate for this item when invoiced.' },
            { field: 'Description (Sales)', info: 'Text that can appear on sales documents for this line.' },
          ]}
        />
        <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          For <Text strong>variant</Text> parents, these values act as <Text strong>defaults</Text> when a child row in the matrix leaves price blank.
        </Paragraph>
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} title="Purchase Information">
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Buying cost and purchase-side tax / GL defaults.
        </Paragraph>
        <Table
          {...tableProps}
          rowKey="field"
          columns={[colField, colInfo]}
          dataSource={[
            { field: 'Cost Price', info: 'Expected or standard cost per unit for POs, costing, and margin views.' },
            { field: 'Account (Purchase)', info: 'Expense / inventory GRN account mapping for purchases.' },
            { field: 'Tax Rate (Purchase)', info: 'Default purchase tax on receipts for this item.' },
            { field: 'Description (Purchase)', info: 'Notes for purchase orders or internal buyers.' },
            { field: 'Preferred Vendor', info: 'Suggested supplier when raising purchase documents.' },
          ]}
        />
      </Card>

      <Card bordered={false} style={{ borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }} title="Inventory Tracking">
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          Only relevant when the item is stock-controlled (simple / composite / variant stock rows).
        </Paragraph>
        <Table
          {...tableProps}
          rowKey="field"
          columns={[colField, colInfo]}
          dataSource={[
            { field: 'Track Inventory', info: 'When on, the system maintains quantity by warehouse — receiving, shipping, transfers, and adjustments apply.' },
            { field: 'Inventory Account', info: 'Balance-sheet inventory / stock account for valuation postings.' },
            { field: 'Min / Max Stock Level', info: 'Reorder and overstock signals for this item (simple items; variants use matrix columns).' },
            { field: 'Opening Stock & Opening Value', info: 'Initial on-hand quantity and value when first loading the system (simple); value often derives from cost × qty.' },
            { field: 'Warehouse', info: 'Where opening / default stock for this SKU is held after save.' },
            { field: 'Default Bin', info: 'Preferred storage location in that warehouse for putaway and picking hints.' },
            { field: 'Valuation Method', info: 'How cost layers are consumed: FIFO, LIFO, or weighted average.' },
            { field: 'Notes / Description', info: 'Internal notes for warehouse and operations (not necessarily printed on invoices).' },
          ]}
        />
        <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          <Text strong>Variant items:</Text> quantities and warehouse assignments are managed in the <Text strong>Variant Matrix</Text>; the short green/purple callouts in the form explain stock per combination.
        </Paragraph>
      </Card>
    </div>
  );
}

export default AddItemGuide;
