import React from 'react';
import {
  Checkbox,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Upload,
  message,
  Alert,
} from 'antd';
import {
  AppstoreOutlined,
  BarcodeOutlined,
  DollarOutlined,
  InboxOutlined,
  ShopOutlined,
  UploadOutlined,
  BuildOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import ItemVariantTagFields from '../inventory/ItemVariantTagFields';
import CompositeBomSection from '../inventory/CompositeBomSection';
import BomCostSummary from './BomCostSummary';
import ItemTypeCustomFields from '../inventory/ItemTypeCustomFields';
import {
  BrandField,
  CategoryField,
  ManufacturerField,
  UnitField,
} from '../inventory/ItemMasterDataFields';
import SkuGeneratorField from '../inventory/SkuGeneratorField';
import OpeningBatchFields from './OpeningBatchFields';
import { filterSelectOption } from '../../utils/selectFilter';
import { sectionStyle, sectionHeader, sectionIconStyle } from './bomItemFormStyles';

const clearInventoryFields = (form) => {
  form.setFieldsValue({
    trackInventory: false,
    openingStock: undefined,
    openingValue: undefined,
    warehouseId: undefined,
    defaultBinId: undefined,
    minStockLevel: undefined,
    maxStockLevel: undefined,
    isBatchTracked: false,
    isSerialized: false,
    hasExpiry: false,
    shelfLifeDays: undefined,
  });
};

export default function BomItemFormFields({
  form,
  isEditing,
  canManage,
  itemId,
  units = [],
  warehouses = [],
  categories = [],
  itemGroups = [],
  brandOptions = [],
  manufacturerOptions = [],
  taxRateOptions = [],
  fieldConfigs = [],
  canViewCategories = true,
  canManageCategories = false,
  onRefreshMasterData,
  components,
  onComponentsChange,
  catalogItems,
  kitFulfillmentMode,
  onKitFulfillmentModeChange,
  imageUrl,
  onImageChange,
  onImageClear,
  binsForWarehouse = [],
  binsLoading = false,
  onWarehouseChange,
  variantLibrary = [],
  onRefreshVariantLibrary,
}) {
  const isExplodeMode = String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';
  const watchedTrackInventoryRaw = Form.useWatch('trackInventory', form) === true;
  const watchedTrackInventory = !isExplodeMode && watchedTrackInventoryRaw;
  const watchedIsSellable = Form.useWatch('isSellable', form) !== false;
  const watchedIsPurchasable = Form.useWatch('isPurchasable', form) !== false;
  const watchedIsManufacturable = Form.useWatch('isManufacturable', form) !== false;
  const watchedHasExpiry = Form.useWatch('hasExpiry', form) === true;

  const clearSalesFields = () => {
    form.setFieldsValue({
      sellingPrice: undefined,
      mrp: undefined,
      salesAccount: undefined,
      taxRate: undefined,
      salesDescription: undefined,
    });
  };

  const clearPurchaseFields = () => {
    form.setFieldsValue({
      purchaseAccount: undefined,
      purchaseTaxRate: undefined,
      purchaseDescription: undefined,
      supplierCode: undefined,
    });
  };

  const handleFulfillmentModeChange = (mode) => {
    onKitFulfillmentModeChange?.(mode);
    if (String(mode || 'prebuilt').toLowerCase() === 'explode_on_ship') {
      clearInventoryFields(form);
    } else if (!isEditing) {
      form.setFieldsValue({ trackInventory: true });
    }
  };

  return (
    <>
      {/* —— 1. Basic —— */}
      <div style={sectionStyle}>
        <div style={{ ...sectionHeader, justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={sectionIconStyle}><AppstoreOutlined /></span>
            BOM item — basic information
          </span>
          <Tag color="purple" style={{ borderRadius: 20, margin: 0 }}>BOM / Finished good</Tag>
        </div>
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Row gutter={16}>
              <Col xs={24} md={14}>
                <Form.Item
                  name="name"
                  label="BOM item name"
                  rules={[{ required: true, message: 'BOM item name is required' }]}
                >
                  <Input placeholder="Finished product name" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <UnitField
                  form={form}
                  units={units}
                  onRefresh={onRefreshMasterData}
                  label="BOM item unit"
                  requiredMessage="BOM item unit is required"
                />
              </Col>
            </Row>
            <SkuGeneratorField
              excludeItemId={itemId}
              itemType="composite"
              units={units}
              warehouses={warehouses}
              skuInputDisabled={isEditing}
              canManage={canManage}
              skuLabel="BOM item SKU"
            />
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <CategoryField
                  form={form}
                  categories={categories}
                  canViewCategories={canViewCategories}
                  canManageCategories={canManageCategories}
                  onRefresh={onRefreshMasterData}
                  tooltip="Classify this BOM item for filtering, reports, and per-category SKU rules. Options are sorted by your category order."
                />
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="itemGroupId"
                  label="Item group"
                  tooltip="Use item groups to organize related items for reporting, filtering, and master-data consistency. Options are sorted A–Z."
                >
                  <Select
                    allowClear
                    showSearch
                    placeholder="Select item group"
                    filterOption={filterSelectOption}
                    options={itemGroups.map((g) => ({ value: g.id, label: g.name }))}
                  />
                </Form.Item>
              </Col>
            </Row>
            <ItemVariantTagFields
              variantLibrary={variantLibrary}
              canManage={canManage}
              onRefreshVariantLibrary={onRefreshVariantLibrary}
            />
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="barcode" label="Barcode">
                  <Input placeholder="Scan or enter barcode" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="hsnCode"
                  label="HSN / SAC code"
                  tooltip="Required on sales & purchase documents for GST (India)."
                >
                  <Input placeholder="e.g. 9403" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                {isEditing ? (
                  <Form.Item name="status" label="BOM item status">
                    <Select
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'inactive', label: 'Inactive' },
                      ]}
                    />
                  </Form.Item>
                ) : null}
              </Col>
            </Row>
            <Form.Item name="returnableItem" valuePropName="checked" style={{ marginBottom: 8 }}>
              <Checkbox>Returnable on sales / delivery</Checkbox>
            </Form.Item>
            <Form.Item name="description" label="BOM item notes / description">
              <Input.TextArea rows={2} placeholder="Internal notes or short product description" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={8}>
            <Form.Item label="BOM item image">
              <div style={{ position: 'relative' }}>
                <Upload
                  name="image"
                  listType="picture-card"
                  showUploadList={false}
                  style={{ width: '100%' }}
                  beforeUpload={(file) => {
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                      message.error('JPG, PNG or WEBP only');
                      return false;
                    }
                    if (file.size / 1024 / 1024 > 2) {
                      message.error('Max 2MB');
                      return false;
                    }
                    const reader = new FileReader();
                    reader.onload = (e) => onImageChange?.(e.target.result, file);
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  {imageUrl ? (
                    <div style={{ position: 'relative', width: '100%', height: 200 }}>
                      <img src={imageUrl} alt="finished product" style={{ width: '100%', height: 200, objectFit: 'cover', borderRadius: 10 }} />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.35)',
                          borderRadius: 10,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 600,
                          gap: 6,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
                      >
                        <UploadOutlined style={{ fontSize: 24 }} />
                        Change image
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        height: 200,
                        background: 'linear-gradient(135deg, #f5f5ff 0%, #faf0ff 100%)',
                        border: '2px dashed #c5b8f5',
                        borderRadius: 10,
                        color: '#9b8fd4',
                        cursor: 'pointer',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          borderRadius: '50%',
                          width: 48,
                          height: 48,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <UploadOutlined style={{ fontSize: 22, color: '#fff' }} />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#667eea' }}>Upload image</div>
                    </div>
                  )}
                </Upload>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={onImageClear}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: '#ff4d4f',
                      border: 'none',
                      borderRadius: '50%',
                      width: 26,
                      height: 26,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      zIndex: 2,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            </Form.Item>
          </Col>
        </Row>
      </div>

      {/* —— 2. Usage —— */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><TagsOutlined /></span>
          How this BOM item is used
        </div>
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff' }}>
              <Form.Item name="isSellable" valuePropName="checked" noStyle>
                <Checkbox
                  style={{ fontSize: 13, color: '#595959' }}
                  onChange={(e) => { if (!e.target.checked) clearSalesFields(); }}
                >
                  Available for sale
                </Checkbox>
              </Form.Item>
            </div>
            <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <Form.Item name="isManufacturable" valuePropName="checked" noStyle>
                <Checkbox style={{ fontSize: 13, color: '#595959' }}>
                  Can be used in other BOMs (sub-assembly)
                </Checkbox>
              </Form.Item>
            </div>
            <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591' }}>
              <Form.Item name="isPurchasable" valuePropName="checked" noStyle>
                <Checkbox
                  style={{ fontSize: 13, color: '#595959' }}
                  onChange={(e) => { if (!e.target.checked) clearPurchaseFields(); }}
                >
                  Available for purchase
                </Checkbox>
              </Form.Item>
            </div>
          </div>
          {!watchedIsManufacturable && (
            <Alert
              type="warning"
              showIcon
              style={{ borderRadius: 10 }}
              message="This BOM item will not appear as a component when building other BOMs."
            />
          )}
        </Space>
      </div>

      {/* —— 3. BOM (core) —— */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><BuildOutlined /></span>
          Bill of materials &amp; fulfillment
        </div>
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={24} md={14}>
            <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
              FULFILLMENT MODE
            </div>
            <Select
              style={{ width: '100%' }}
              value={kitFulfillmentMode}
              onChange={handleFulfillmentModeChange}
              options={[
                { value: 'prebuilt', label: 'Pre-built — assemble first, then sell / stock finished goods' },
                { value: 'explode_on_ship', label: 'Explode on ship — deduct parts at sale (kit / phantom)' },
              ]}
            />
          </Col>
        </Row>
        <Alert
          type={isExplodeMode ? 'warning' : 'info'}
          showIcon
          style={{ marginBottom: 12, borderRadius: 10 }}
          message={
            isExplodeMode
              ? 'Explode on ship: no finished-goods stock. Component parts leave inventory when orders are confirmed or shipped.'
              : 'Pre-built: run Manufacturing → Assemble to consume parts and add finished goods stock.'
          }
        />
        <CompositeBomSection
          components={components}
          onComponentsChange={onComponentsChange}
          catalogItems={catalogItems}
          excludeItemId={itemId}
          kitFulfillmentMode={kitFulfillmentMode}
        />
        <BomCostSummary
          form={form}
          components={components}
          catalogItems={catalogItems}
        />
      </div>

      <ItemTypeCustomFields
        fieldConfigs={fieldConfigs}
        sectionStyle={sectionStyle}
        sectionHeader={sectionHeader}
        sectionIconStyle={sectionIconStyle}
        title="Custom fields"
      />

      {/* —— 4. Sales (conditional) —— */}
      {watchedIsSellable && (
        <div style={sectionStyle}>
          <div style={sectionHeader}>
            <span style={sectionIconStyle}><DollarOutlined /></span>
            Sales pricing
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="sellingPrice" label="Selling price (per unit)" rules={[{ type: 'number', min: 0, message: 'Must be 0 or more' }]}>
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item
                name="mrp"
                label="MRP (per unit)"
                rules={[
                  { type: 'number', min: 0, message: 'Must be 0 or more' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      const selling = Number(getFieldValue('sellingPrice'));
                      const mrp = Number(value);
                      if (!Number.isFinite(mrp) || mrp <= 0 || !Number.isFinite(selling) || selling <= mrp) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('MRP must be greater than or equal to selling price'));
                    },
                  }),
                ]}
              >
                <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="salesAccount" label="Sales account">
                <Select allowClear placeholder="Select account">
                  <Select.Option value="sales">Sales</Select.Option>
                  <Select.Option value="income">Income</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={8}>
              <Form.Item name="taxRate" label="Sales tax rate (%)">
                {taxRateOptions.length > 0 ? (
                  <Select allowClear placeholder="Select tax rate" showSearch optionFilterProp="children">
                    {taxRateOptions.map((t) => (
                      <Select.Option key={t.id} value={parseFloat(t.rate)}>
                        {t.name} ({parseFloat(t.rate).toFixed(2)}%)
                      </Select.Option>
                    ))}
                  </Select>
                ) : (
                  <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                )}
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="salesDescription" label="Sales description">
                <Input.TextArea rows={2} placeholder="Shown on quotations, sales orders & invoices" />
              </Form.Item>
            </Col>
          </Row>
        </div>
      )}

      {/* —— 5. Cost & purchase —— */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><ShopOutlined /></span>
          Unit cost {watchedIsPurchasable ? '& purchase' : ''}
        </div>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="costPrice"
              label="Cost price (per unit)"
              tooltip="Standard / manufacturing cost. Use “Apply to cost price” in the BOM summary above, or enter manually."
            >
              <InputNumber
                min={0}
                step={0.01}
                precision={2}
                style={{ width: '100%' }}
                onChange={(value) => {
                  const openingStock = form.getFieldValue('openingStock');
                  if (openingStock > 0 && value > 0) {
                    form.setFieldsValue({ openingValue: Math.round(openingStock * value * 100) / 100 });
                  }
                }}
              />
            </Form.Item>
          </Col>
        </Row>
        {watchedIsPurchasable && (
          <>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="supplierCode" label="Supplier / vendor code">
                  <Input placeholder="Vendor catalogue code" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="purchaseAccount" label="Purchase account">
                  <Select allowClear placeholder="Select account">
                    <Select.Option value="cogs">Cost of goods sold</Select.Option>
                    <Select.Option value="expense">Expense</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="purchaseTaxRate" label="Purchase tax rate (%)">
                  <InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="purchaseDescription" label="Purchase description">
              <Input.TextArea rows={2} placeholder="Shown on purchase orders & vendor bills" />
            </Form.Item>
          </>
        )}
      </div>

      {/* —— 6. Inventory (pre-built only) —— */}
      {!isExplodeMode ? (
        <div style={sectionStyle}>
          <div style={sectionHeader}>
            <span style={sectionIconStyle}><InboxOutlined /></span>
            Finished goods inventory
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff' }}>
              <Form.Item name="trackInventory" valuePropName="checked" noStyle>
                <Checkbox style={{ fontSize: 13, color: '#595959' }}>
                  Track finished goods stock for this BOM item
                </Checkbox>
              </Form.Item>
            </div>
            {watchedTrackInventory && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#f0f5ff', borderRadius: 8, border: '1px solid #adc6ff' }}>
                <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Batch / serial tracking</div>
                <Space wrap size="middle">
                  <Form.Item name="isBatchTracked" valuePropName="checked" noStyle>
                    <Checkbox>Batch / lot tracked</Checkbox>
                  </Form.Item>
                  <Form.Item name="isSerialized" valuePropName="checked" noStyle>
                    <Checkbox>Serialized (one # per unit)</Checkbox>
                  </Form.Item>
                  <Form.Item name="hasExpiry" valuePropName="checked" noStyle>
                    <Checkbox>Track expiry date</Checkbox>
                  </Form.Item>
                </Space>
                {watchedHasExpiry && (
                  <Form.Item name="shelfLifeDays" label="Shelf life (days)" style={{ marginTop: 8, marginBottom: 0, maxWidth: 220 }}>
                    <InputNumber min={1} style={{ width: '100%' }} placeholder="Optional" />
                  </Form.Item>
                )}
              </div>
            )}
          </div>
          {watchedTrackInventory && (
            <>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                <Form.Item name="minStockLevel" label="Min stock level" dependencies={['maxStockLevel']}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="maxStockLevel"
                  label="Max stock level"
                  dependencies={['minStockLevel']}
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        const minVal = Number(getFieldValue('minStockLevel')) || 0;
                        const maxVal = Number(value) || 0;
                        if (minVal <= 0 || maxVal <= 0 || minVal <= maxVal) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Max must be greater than or equal to min'));
                      },
                    }),
                  ]}
                >
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item name="allowNegativeStock" label="Allow negative stock" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Form.Item name="valuationMethod" label="Valuation method">
                    <Select>
                      <Select.Option value="fifo">FIFO</Select.Option>
                      <Select.Option value="weighted_average">Weighted average</Select.Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              {!isEditing && (
                <>
                  <Row gutter={16}>
                    <Col xs={24} sm={8}>
                      <Form.Item name="openingStock" label="Opening stock">
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          onChange={(value) => {
                            const costPrice = form.getFieldValue('costPrice');
                            if (value > 0 && costPrice > 0) {
                              form.setFieldsValue({ openingValue: Math.round(value * costPrice * 100) / 100 });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item name="openingValue" label="Opening value (auto)">
                        <InputNumber disabled min={0} step={0.01} precision={2} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item
                        name="warehouseId"
                        label="Warehouse"
                        dependencies={['openingStock']}
                        rules={[
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              const opening = Number(getFieldValue('openingStock')) || 0;
                              if (opening > 0 && !value) {
                                return Promise.reject(new Error('Warehouse is required when opening stock is set'));
                              }
                              return Promise.resolve();
                            },
                          }),
                        ]}
                      >
                        <Select
                          allowClear
                          showSearch
                          placeholder="Select warehouse"
                          filterOption={filterSelectOption}
                          onChange={(value) => {
                            form.setFieldsValue({ defaultBinId: null });
                            onWarehouseChange?.(value);
                          }}
                          options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col xs={24} sm={12}>
                      <Form.Item noStyle shouldUpdate={(prev, cur) => prev.warehouseId !== cur.warehouseId}>
                        {() => {
                          const hasWarehouse = Boolean(form.getFieldValue('warehouseId'));
                          return (
                            <Form.Item name="defaultBinId" label="Default bin (optional)">
                              <Select
                                allowClear
                                showSearch
                                loading={binsLoading}
                                placeholder={hasWarehouse ? 'Select bin' : 'Select warehouse first'}
                                disabled={!hasWarehouse}
                                optionFilterProp="label"
                                options={binsForWarehouse.map((b) => ({
                                  value: b.id,
                                  label: `${b.zone_code || ''} / ${b.rack_code || ''} / ${b.code}${b.name ? ` — ${b.name}` : ''}`,
                                }))}
                              />
                            </Form.Item>
                          );
                        }}
                      </Form.Item>
                    </Col>
                  </Row>
                  <OpeningBatchFields
                    form={form}
                    warehouses={warehouses}
                    hasExpiry={watchedHasExpiry}
                    canManageRules={canManage}
                  />
                </>
              )}
            </>
          )}
        </div>
      ) : (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 10 }}
          message="Finished goods inventory is not used for explode-on-ship BOM items. Only component stock is tracked."
        />
      )}

      {/* —— 7. Optional extras (collapsed) —— */}
      <Collapse
        ghost
        style={{ marginBottom: 16, background: '#fff', borderRadius: 12, border: '1px solid #e6e8f0' }}
        items={[
          {
            key: 'identifiers',
            label: (
              <span style={{ fontWeight: 600, color: '#334155' }}>
                <BarcodeOutlined style={{ marginRight: 8 }} />
                Additional identifiers &amp; attributes (optional)
              </span>
            ),
            children: (
              <>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <Form.Item name="upc" label="UPC">
                      <Input placeholder="UPC" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="ean" label="EAN">
                      <Input placeholder="EAN" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="mpn" label="MPN">
                      <Input placeholder="Manufacturer part number" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={8}>
                    <BrandField form={form} brandOptions={brandOptions} onRefresh={onRefreshMasterData} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <ManufacturerField form={form} manufacturerOptions={manufacturerOptions} onRefresh={onRefreshMasterData} />
                  </Col>
                  <Col xs={24} sm={8}>
                    <Form.Item name="weight" label="Weight (per unit)">
                      <Input placeholder="e.g. 0.5 kg" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Dimensions L × W × H">
                      <Input.Group compact>
                        <Form.Item name="length" noStyle>
                          <InputNumber placeholder="L" style={{ width: '33%' }} min={0} />
                        </Form.Item>
                        <Form.Item name="width" noStyle>
                          <InputNumber placeholder="W" style={{ width: '33%' }} min={0} />
                        </Form.Item>
                        <Form.Item name="height" noStyle>
                          <InputNumber placeholder="H" style={{ width: '34%' }} min={0} />
                        </Form.Item>
                      </Input.Group>
                    </Form.Item>
                  </Col>
                </Row>
              </>
            ),
          },
        ]}
      />
    </>
  );
}
