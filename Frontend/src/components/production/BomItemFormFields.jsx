import React from 'react';
import {
  Checkbox,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Radio,
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
  ThunderboltOutlined,
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
import {
  BOM_COLORS,
  sectionStyle,
  sectionStyleRecipe,
  sectionStyleQuiet,
  sectionHeader,
  sectionIndexBadge,
  sectionIndexLabel,
  sectionIconStyle,
  fulfillmentTileBase,
  fulfillmentTileActive,
} from './bomItemFormStyles';
import {
  openingValueWithPurchaseTax,
  unitCostIncludingTax,
} from '../../utils/purchaseCostHelpers';
import { cleanNumberInputProps, formatNumber } from '../../utils/numberFormat';

const SectionTitle = ({ index, title, extra = null }) => (
  <div style={{ ...sectionHeader, justifyContent: 'space-between' }}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <span style={sectionIndexBadge}>{sectionIndexLabel(index)}</span>
      <span>{title}</span>
    </span>
    {extra}
  </div>
);

const clearInventoryFields = (form) => {
  form.setFieldsValue({
    trackInventory: false,
    openingStock: undefined,
    openingValue: undefined,
    openingStockMode: 'physical',
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
  onUnitCreated,
}) {
  const isExplodeMode = String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';
  const watchedTrackInventoryRaw = Form.useWatch('trackInventory', form) === true;
  const watchedTrackInventory = !isExplodeMode && watchedTrackInventoryRaw;
  const watchedIsSellable = Form.useWatch('isSellable', form) !== false;
  const watchedIsPurchasable = Form.useWatch('isPurchasable', form) !== false;
  const watchedIsManufacturable = Form.useWatch('isManufacturable', form) !== false;
  const watchedHasExpiry = Form.useWatch('hasExpiry', form) === true;
  const watchedWarehouseId = Form.useWatch('warehouseId', form);
  const watchedCostPrice = Form.useWatch('costPrice', form);
  const watchedPurchaseTaxRate = Form.useWatch('purchaseTaxRate', form);
  const purchaseUnitCostInclTax = unitCostIncludingTax(watchedCostPrice, watchedPurchaseTaxRate);

  const recalcOpeningValueFromForm = () => {
    const openingStock = form.getFieldValue('openingStock');
    const costPrice = form.getFieldValue('costPrice');
    const purchaseTaxRate = form.getFieldValue('purchaseTaxRate');
    const value = openingValueWithPurchaseTax(openingStock, costPrice, purchaseTaxRate);
    if (value > 0) {
      form.setFieldsValue({ openingValue: value });
    }
  };

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
      {/* —— 1. Product identity —— */}
      <div style={sectionStyle}>
        <SectionTitle
          index={1}
          title="Product identity"
          extra={(
            <Tag
              style={{
                borderRadius: 8,
                margin: 0,
                border: `1px solid ${BOM_COLORS.accent}`,
                background: BOM_COLORS.accentSoft,
                color: BOM_COLORS.accentDeep,
                fontWeight: 600,
              }}
            >
              Finished good
            </Tag>
          )}
        />
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Row gutter={16}>
              <Col xs={24} md={14}>
                <Form.Item
                  name="name"
                  label="Product name"
                  rules={[{ required: true, message: 'Product name is required' }]}
                >
                  <Input placeholder="Finished product name" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={10}>
                <UnitField
                  form={form}
                  units={units}
                  onRefresh={onRefreshMasterData}
                  label="Stock unit"
                  requiredMessage="Stock unit is required"
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
              skuLabel="Product SKU"
              accentTheme="bom"
            />
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <CategoryField
                  form={form}
                  categories={categories}
                  canViewCategories={canViewCategories}
                  canManageCategories={canManageCategories}
                  onRefresh={onRefreshMasterData}
                  tooltip="Classify this finished product for filtering, reports, and per-category SKU rules."
                />
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  name="itemGroupId"
                  label="Item group"
                  tooltip="Organize related finished goods for reporting and master-data consistency."
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
                  <Form.Item name="status" label="Status">
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
            <Form.Item name="description" label="Notes / description">
              <Input.TextArea rows={2} placeholder="Internal notes or short product description" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={8}>
            <Form.Item label="Product image">
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
                        background: `linear-gradient(160deg, ${BOM_COLORS.accentSoft} 0%, #fff 100%)`,
                        border: `2px dashed ${BOM_COLORS.accentMuted}`,
                        borderRadius: 10,
                        color: BOM_COLORS.accentDeep,
                        cursor: 'pointer',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          background: BOM_COLORS.accent,
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
                      <div style={{ fontWeight: 600, fontSize: 13, color: BOM_COLORS.accentDeep }}>Upload image</div>
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

      {/* —— 2. Fulfillment —— */}
      <div style={sectionStyle}>
        <SectionTitle index={2} title="Fulfillment mode" />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleFulfillmentModeChange('prebuilt')}
            onKeyDown={(e) => e.key === 'Enter' && handleFulfillmentModeChange('prebuilt')}
            style={!isExplodeMode ? fulfillmentTileActive : fulfillmentTileBase}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <InboxOutlined style={{ color: !isExplodeMode ? BOM_COLORS.accentDeep : BOM_COLORS.slate }} />
              <span style={{ fontWeight: 700, color: BOM_COLORS.charcoal }}>Pre-built</span>
            </div>
            <div style={{ fontSize: 12, color: BOM_COLORS.slate, lineHeight: 1.45 }}>
              Assemble first, then sell or stock finished goods. Parts are consumed at assembly.
            </div>
          </div>
          <div
            role="button"
            tabIndex={0}
            onClick={() => handleFulfillmentModeChange('explode_on_ship')}
            onKeyDown={(e) => e.key === 'Enter' && handleFulfillmentModeChange('explode_on_ship')}
            style={isExplodeMode ? fulfillmentTileActive : fulfillmentTileBase}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ThunderboltOutlined style={{ color: isExplodeMode ? BOM_COLORS.accentDeep : BOM_COLORS.slate }} />
              <span style={{ fontWeight: 700, color: BOM_COLORS.charcoal }}>Explode on ship</span>
            </div>
            <div style={{ fontSize: 12, color: BOM_COLORS.slate, lineHeight: 1.45 }}>
              Kit / phantom — deduct component parts at order or shipment. No finished-goods stock.
            </div>
          </div>
        </div>
        <Alert
          type={isExplodeMode ? 'warning' : 'info'}
          showIcon
          style={{ borderRadius: 10, borderColor: isExplodeMode ? undefined : BOM_COLORS.accentMuted }}
          message={
            isExplodeMode
              ? 'Explode on ship: no finished-goods stock. Component parts leave inventory when orders are confirmed or shipped.'
              : 'Pre-built: run Manufacturing → Assemble to consume parts and add finished goods stock.'
          }
        />
      </div>

      {/* —— 3. Component recipe —— */}
      <div style={sectionStyleRecipe}>
        <SectionTitle
          index={3}
          title="Component recipe"
          extra={(
            <Tag style={{ margin: 0, borderRadius: 8, background: '#fff', borderColor: BOM_COLORS.accent, color: BOM_COLORS.accentDeep }}>
              Bill of materials
            </Tag>
          )}
        />
        <CompositeBomSection
          components={components}
          onComponentsChange={onComponentsChange}
          catalogItems={catalogItems}
          excludeItemId={itemId}
          kitFulfillmentMode={kitFulfillmentMode}
          warehouseId={watchedWarehouseId}
          units={units}
          onUnitCreated={onUnitCreated}
          accentTheme="bom"
        />
      </div>

      {/* —— 4. Cost & pricing —— */}
      <div style={sectionStyle}>
        <SectionTitle index={4} title="Cost & pricing" />
        <BomCostSummary
          form={form}
          components={components}
          catalogItems={catalogItems}
          units={units}
        />

        <div style={{ marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: 700, color: BOM_COLORS.slate, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          How this product is used
        </div>
        <Space direction="vertical" size={10} style={{ width: '100%', marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'inline-flex', padding: '6px 12px', background: BOM_COLORS.accentSoft, borderRadius: 8, border: `1px solid #99f6e4` }}>
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
            <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fcd34d' }}>
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
              message="This finished product will not appear as a component when building other BOMs."
            />
          )}
        </Space>

        {watchedIsSellable && (
          <>
            <div style={{ marginTop: 8, marginBottom: 8, fontSize: 12, fontWeight: 700, color: BOM_COLORS.slate, textTransform: 'uppercase', letterSpacing: 0.4 }}>
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
          </>
        )}
      </div>

      <ItemTypeCustomFields
        fieldConfigs={fieldConfigs}
        sectionStyle={sectionStyleQuiet}
        sectionHeader={sectionHeader}
        sectionIconStyle={sectionIconStyle}
        title="Custom fields"
      />

      {/* —— 5. Unit cost & purchase —— */}
      <div style={sectionStyleQuiet}>
        <SectionTitle index={5} title={`Unit cost${watchedIsPurchasable ? ' & purchase' : ''}`} />
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="costPrice"
              label="Cost price (per unit)"
              tooltip="Standard / manufacturing cost. Use “Apply to cost price” in the BOM summary above, or enter manually."
              extra={
                purchaseUnitCostInclTax > 0 && Number(watchedPurchaseTaxRate) > 0 ? (
                  <span style={{ fontSize: 12 }}>
                    Incl. {formatNumber(watchedPurchaseTaxRate, 2)}% purchase tax: {formatNumber(purchaseUnitCostInclTax, 4)} per unit
                  </span>
                ) : null
              }
            >
              <InputNumber
                min={0}
                step={0.01}
                style={{ width: '100%' }}
                {...cleanNumberInputProps(4)}
                onChange={() => recalcOpeningValueFromForm()}
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
                  {taxRateOptions.length > 0 ? (
                    <Select
                      allowClear
                      placeholder="Select tax rate"
                      showSearch
                      optionFilterProp="children"
                      onChange={() => recalcOpeningValueFromForm()}
                    >
                      {taxRateOptions.map((t) => (
                        <Select.Option key={t.id} value={parseFloat(t.rate)}>
                          {t.name} ({parseFloat(t.rate).toFixed(2)}%)
                        </Select.Option>
                      ))}
                    </Select>
                  ) : (
                    <InputNumber
                      min={0}
                      max={100}
                      step={0.01}
                      style={{ width: '100%' }}
                      {...cleanNumberInputProps(2)}
                      onChange={() => recalcOpeningValueFromForm()}
                    />
                  )}
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
        <div style={sectionStyleQuiet}>
          <SectionTitle index={6} title="Finished goods inventory" />
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', padding: '6px 12px', background: BOM_COLORS.accentSoft, borderRadius: 8, border: `1px solid #99f6e4` }}>
              <Form.Item name="trackInventory" valuePropName="checked" noStyle>
                <Checkbox style={{ fontSize: 13, color: '#595959' }}>
                  Track finished goods stock for this product
                </Checkbox>
              </Form.Item>
            </div>
            {watchedTrackInventory && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: `1px solid ${BOM_COLORS.border}` }}>
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
                          step={1}
                          style={{ width: '100%' }}
                          {...cleanNumberInputProps(4)}
                          onChange={() => recalcOpeningValueFromForm()}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={8}>
                      <Form.Item name="openingValue" label="Opening value (auto, incl. tax)">
                        <InputNumber disabled min={0} step={0.01} style={{ width: '100%' }} {...cleanNumberInputProps(4)} />
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
                  <Form.Item noStyle shouldUpdate={(prev, cur) => (
                    prev.openingStock !== cur.openingStock
                    || prev.openingStockMode !== cur.openingStockMode
                  )}>
                    {() => {
                      const opening = Number(form.getFieldValue('openingStock')) || 0;
                      if (opening <= 0) return null;
                      const mode = String(form.getFieldValue('openingStockMode') || 'physical').toLowerCase();
                      return (
                        <Row gutter={16} style={{ marginBottom: 16 }}>
                          <Col xs={24}>
                            <Form.Item
                              name="openingStockMode"
                              label="Opening stock source"
                              initialValue="physical"
                            >
                              <Radio.Group>
                                <Space direction="vertical" size={4}>
                                  <Radio value="physical">
                                    Already on hand — record physical finished goods (components unchanged)
                                  </Radio>
                                  <Radio value="assemble">
                                    Assemble from components — deduct BOM parts from stock
                                  </Radio>
                                </Space>
                              </Radio.Group>
                            </Form.Item>
                            <Alert
                              type={mode === 'assemble' ? 'warning' : 'info'}
                              showIcon
                              message={
                                mode === 'assemble'
                                  ? `Creating with ${opening} unit(s) will consume components per BOM qty (e.g. 1 per unit → ${opening} each).`
                                  : `Creating with ${opening} unit(s) adds finished goods only. Component on-hand quantities will not change.`
                              }
                              style={{ marginBottom: 8 }}
                            />
                          </Col>
                        </Row>
                      );
                    }}
                  </Form.Item>
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
