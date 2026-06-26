import React from 'react';
import {
  Checkbox,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Switch,
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
  const watchedTrackInventory = Form.useWatch('trackInventory', form) === true;
  const watchedIsSellable = Form.useWatch('isSellable', form) !== false;
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

  return (
    <>
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><AppstoreOutlined /></span>
          Basic information
        </div>
        <Row gutter={16}>
          <Col xs={24} lg={16}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Item type">
                  <Select
                    disabled
                    value="composite"
                    options={[{ value: 'composite', label: 'Composite (BOM / finished good)' }]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="name" label="Item name" rules={[{ required: true, message: 'Name is required' }]}>
                  <Input placeholder="Finished product name" style={{ borderRadius: 8 }} />
                </Form.Item>
              </Col>
            </Row>
            <ItemVariantTagFields
              variantLibrary={variantLibrary}
              canManage={canManage}
              onRefreshVariantLibrary={onRefreshVariantLibrary}
            />
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <SkuGeneratorField
                  excludeItemId={itemId}
                  itemType="composite"
                  units={units}
                  warehouses={warehouses}
                  skuInputDisabled={isEditing}
                  canManage={canManage}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <CategoryField
                  form={form}
                  categories={categories}
                  canViewCategories={canViewCategories}
                  canManageCategories={canManageCategories}
                  onRefresh={onRefreshMasterData}
                />
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="itemGroupId" label="Item group">
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
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <UnitField form={form} units={units} onRefresh={onRefreshMasterData} />
              </Col>
              <Col xs={24} md={12}>
                {isEditing ? (
                  <Form.Item name="status" label="Status">
                    <Select
                      options={[
                        { value: 'active', label: 'Active — available for production & sales' },
                        { value: 'inactive', label: 'Inactive — hidden from active lists' },
                      ]}
                    />
                  </Form.Item>
                ) : (
                  <Form.Item name="returnableItem" valuePropName="checked">
                    <Checkbox>Returnable item</Checkbox>
                  </Form.Item>
                )}
              </Col>
            </Row>
            <Form.Item name="description" label="Notes / description">
              <Input.TextArea rows={2} placeholder="Optional description" />
            </Form.Item>
          </Col>
          <Col xs={24} lg={8}>
            <Form.Item label="Item image">
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

      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><BarcodeOutlined /></span>
          Identifiers &amp; codes
        </div>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item name="barcode" label="Barcode">
              <Input placeholder="Barcode" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="hsnCode" label="HSN code">
              <Input placeholder="HSN / SAC" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={8}>
            <Form.Item name="supplierCode" label="Supplier code">
              <Input placeholder="Vendor / supplier code" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col xs={24} sm={6}>
            <Form.Item name="upc" label="UPC">
              <Input placeholder="UPC" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item name="mpn" label="MPN">
              <Input placeholder="MPN" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item name="ean" label="EAN">
              <Input placeholder="EAN" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={6}>
            <Form.Item name="isbn" label="ISBN">
              <Input placeholder="ISBN" />
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
            <Form.Item label="Dimensions (L × W × H)">
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
      </div>

      <ItemTypeCustomFields
        fieldConfigs={fieldConfigs}
        sectionStyle={sectionStyle}
        sectionHeader={sectionHeader}
        sectionIconStyle={sectionIconStyle}
        title="BOM / finished product fields"
      />

      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><DollarOutlined /></span>
          Sales information
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff' }}>
            <Form.Item name="isSellable" valuePropName="checked" noStyle>
              <Checkbox
                style={{ fontSize: 13, color: '#595959' }}
                onChange={(e) => {
                  if (!e.target.checked) clearSalesFields();
                }}
              >
                Available for sale
              </Checkbox>
            </Form.Item>
          </div>
          {!watchedIsSellable && (
            <div style={{ marginTop: 12, padding: '10px 12px', background: '#fff7e6', borderRadius: 8, border: '1px solid #ffd591', fontSize: 12, color: '#ad6800' }}>
              Production / internal product only — not listed on sales orders or invoices. Purchase and manufacturing assembly still work.
            </div>
          )}
        </div>
        {watchedIsSellable && (
          <>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="sellingPrice" label="Selling price (per unit)">
                  <InputNumber min={0} step={0.01} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="mrp" label="MRP (per unit)">
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
                <Form.Item name="taxRate" label="Tax rate (%)">
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
                  <Input.TextArea rows={2} placeholder="Shown on sales documents" />
                </Form.Item>
              </Col>
            </Row>
          </>
        )}
      </div>

      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><ShopOutlined /></span>
          Purchase information
        </div>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item
              name="costPrice"
              label="Cost price (per unit)"
              tooltip="Use “Apply to cost price” in the BOM cost summary, or enter your final cost manually."
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
        <Row gutter={16}>
          <Col span={24}>
            <Form.Item name="purchaseDescription" label="Purchase description">
              <Input.TextArea rows={2} placeholder="Shown on purchase documents" />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><InboxOutlined /></span>
          Inventory tracking
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#f5f5ff', borderRadius: 8, border: '1px solid #e0e0ff' }}>
            <Form.Item name="trackInventory" valuePropName="checked" noStyle>
              <Checkbox style={{ fontSize: 13, color: '#595959' }}>
                Track inventory for this item
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
              <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
                Required for batch/serial fields on manufacturing assembly, shipment, and returns.
              </div>
            </div>
          )}
        </div>
        {watchedTrackInventory && (
          <>
            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item name="minStockLevel" label="Min stock level">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="maxStockLevel" label="Max stock level">
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
                    <Form.Item name="warehouseId" label="Warehouse">
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

      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionIconStyle}><BuildOutlined /></span>
          Fulfillment &amp; BOM
        </div>
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#64748b' }}>
              SALES / FULFILMENT MODE
            </div>
            <Select
              style={{ width: '100%' }}
              value={kitFulfillmentMode}
              onChange={onKitFulfillmentModeChange}
              options={[
                { value: 'prebuilt', label: 'Pre-built — assemble parts first, then sell finished goods stock' },
                { value: 'explode_on_ship', label: 'Explode on ship — deduct parts when fulfilling sales (no finished goods stock)' },
              ]}
            />
          </Col>
        </Row>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12, borderRadius: 10 }}
          message={
            String(kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship'
              ? 'Explode on ship: components leave inventory at order or shipment (per row below). Finished goods stock is not tracked.'
              : 'Pre-built: components are consumed when you run Manufacturing → Assemble. Sales ship finished goods stock only.'
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
    </>
  );
}
