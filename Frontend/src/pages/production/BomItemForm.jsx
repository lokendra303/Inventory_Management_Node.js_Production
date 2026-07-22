import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Form,
  message,
  Spin,
  Button,
  Alert,
  Space,
} from 'antd';
import { EditOutlined, PlusOutlined, BuildOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import BomItemFormFields from '../../components/production/BomItemFormFields';
import { resolveMasterDataIds } from '../../components/inventory/ItemMasterDataFields';
import apiService from '../../services/apiService';
import { itemService } from '../../services/itemService';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  buildBomSubmitPayload,
  hasBomDraftContent,
  mapBomItemToFormValues,
  restoreBomDraftToForm,
  serializeBomDraft,
} from '../../utils/bomDraft';
import { validateBomBusinessRules } from '../../utils/bomFormValidation';
import { itemIsBreakable, resolveItemPackSpec } from '../../utils/packSizeHelpers';
import {
  BOM_COLORS,
  BOM_GRADIENT,
  primaryButtonStyle,
} from '../../components/production/bomItemFormStyles';

const AUTO_DRAFT_MS = 45000;

const asApiList = (res) => (Array.isArray(res) ? res : (res?.data || []));

const normalizeComponents = (rows = [], catalogItems = [], units = []) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      const itemId = String(row?.itemId || row?.component_item_id || '').trim();
      const item = catalogItems.find((c) => String(c.id) === String(itemId));
      const packSpec = item ? resolveItemPackSpec(item, units) : null;
      const mustFullPack = !!(packSpec && !itemIsBreakable(item));
      return {
        itemId,
        quantityRequired: Number(row?.quantityRequired ?? row?.quantity_required),
        consumptionTiming: String(row?.consumptionTiming || row?.consumption_timing || 'shipment').toLowerCase(),
        consumptionUnitId: row?.consumptionUnitId || row?.consumption_unit_id || null,
        consumeFullPack: mustFullPack || !!(row?.consumeFullPack || row?.consume_full_pack),
      };
    })
    .filter((row) => row.itemId && Number.isFinite(row.quantityRequired) && row.quantityRequired > 0)
    .map((row) => ({
      ...row,
      consumptionTiming: ['order', 'shipment'].includes(row.consumptionTiming) ? row.consumptionTiming : 'shipment',
      consumptionUnitId: row.consumptionUnitId ? String(row.consumptionUnitId).trim() || null : null,
      consumeFullPack: !!row.consumeFullPack,
    }));
};

const pickDefaultUnit = (units = []) => {
  if (!units.length) return undefined;
  const pcs = units.find((u) => String(u.name || '').toLowerCase() === 'pcs'
    || String(u.symbol || '').toLowerCase() === 'pcs');
  const row = pcs || units[0];
  return row.id || row.name || undefined;
};

const defaultFormValues = (units = []) => ({
  valuationMethod: 'fifo',
  allowNegativeStock: false,
  purchaseAccount: 'cogs',
  taxRate: 0,
  purchaseTaxRate: 0,
  isBatchTracked: false,
  isSerialized: false,
  hasExpiry: false,
  returnableItem: false,
  trackInventory: true,
  isSellable: true,
  isPurchasable: false,
  isManufacturable: true,
  unit: pickDefaultUnit(units),
  openingStockMode: 'physical',
  bomAdditionalCharges: [],
});

const RESERVED_CUSTOM_FIELD_KEYS = new Set([
  'variantMatrix',
  'variantAttributes',
  'skuMeta',
  'returnableItem',
  'returnable',
  'salesDescription',
  'purchaseDescription',
  'purchaseTaxRate',
  'bomAdditionalCharges',
]);

const extractTypeCustomFields = (custom = {}) => {
  const out = {};
  Object.entries(custom || {}).forEach(([key, value]) => {
    if (!RESERVED_CUSTOM_FIELD_KEYS.has(key)) out[key] = value;
  });
  return out;
};

const deriveTrackInventoryValue = (item = {}, warehouseId = null) => (
  Boolean(
    warehouseId ||
    item?.default_bin_id ||
    Number(item?.opening_stock) > 0 ||
    Number(item?.opening_value) > 0 ||
    Number(item?.min_stock_level) > 0 ||
    Number(item?.max_stock_level) > 0 ||
    item?.is_batch_tracked ||
    item?.is_serialized ||
    item?.has_expiry
  )
);

export default function BomItemForm({
  open,
  itemId,
  resumeDraftId = null,
  onCancel,
  onSuccess,
  onDraftsChange,
}) {
  const { user } = useAuth();
  const canManage = user?.permissions?.production_management || user?.permissions?.all;
  const canManageCategories = user?.permissions?.category_management || user?.permissions?.all;
  const canViewCategories = user?.permissions?.category_view || user?.permissions?.all;
  const [form] = Form.useForm();
  const watchedWarehouseId = Form.useWatch('warehouseId', form);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [catalogItems, setCatalogItems] = useState([]);
  const [units, setUnits] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [itemGroups, setItemGroups] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [manufacturerOptions, setManufacturerOptions] = useState([]);
  const [taxRateOptions, setTaxRateOptions] = useState([]);
  const [fieldConfigs, setFieldConfigs] = useState([]);
  const [variantLibrary, setVariantLibrary] = useState([]);
  const [binsForWarehouse, setBinsForWarehouse] = useState([]);
  const [binsLoading, setBinsLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [components, setComponents] = useState([]);
  const [kitFulfillmentMode, setKitFulfillmentMode] = useState('prebuilt');
  const [activeDraftId, setActiveDraftId] = useState(null);
  const [draftBanner, setDraftBanner] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [existingCustomFields, setExistingCustomFields] = useState({});
  const autoDraftLock = useRef(false);
  const initDoneRef = useRef(false);
  const editLoadedItemIdRef = useRef(null);
  const unitsRef = useRef([]);
  const onCancelRef = useRef(onCancel);

  const isEditing = Boolean(itemId);

  unitsRef.current = units;
  onCancelRef.current = onCancel;

  const loadMasterData = useCallback(async () => {
    const settled = await Promise.allSettled([
      apiService.get('/units'),
      apiService.get('/warehouses'),
      apiService.get('/categories'),
      apiService.get('/item-groups'),
      apiService.get('/brands'),
      apiService.get('/manufacturers'),
      apiService.get('/tax/rates'),
      itemService.getFieldConfig('composite'),
      apiService.get('/items/variant-library'),
    ]);

    const valueOf = (i) => (settled[i].status === 'fulfilled' ? settled[i].value : null);

    const unitRows = asApiList(valueOf(0));
    const brandRows = asApiList(valueOf(4));
    const manufacturerRows = asApiList(valueOf(5));
    const categoryRows = asApiList(valueOf(2));
    const compositeFieldConfigs = valueOf(7);
    const variantLibraryRes = valueOf(8);

    setUnits(unitRows);
    setWarehouses(asApiList(valueOf(1)).filter((w) => w.status === 'active'));
    setCategories(categoryRows);
    setItemGroups(asApiList(valueOf(3)));
    setBrandOptions(brandRows);
    setManufacturerOptions(manufacturerRows);
    setTaxRateOptions(asApiList(valueOf(6)));
    setFieldConfigs(Array.isArray(compositeFieldConfigs) ? compositeFieldConfigs : []);
    const library = variantLibraryRes?.success
      ? (variantLibraryRes.data || [])
      : (Array.isArray(variantLibraryRes) ? variantLibraryRes : []);
    setVariantLibrary(Array.isArray(library) ? library : []);

    return {
      units: unitRows,
      brands: brandRows,
      manufacturers: manufacturerRows,
      categories: categoryRows,
    };
  }, []);

  const refreshMasterData = useCallback(async () => loadMasterData(), [loadMasterData]);

  const fetchBinsForWarehouse = useCallback(async (warehouseId) => {
    if (!warehouseId) {
      setBinsForWarehouse([]);
      return;
    }
    setBinsLoading(true);
    try {
      const res = await apiService.get('/warehouse-locations/bins', {
        params: { warehouseId, status: 'all', limit: 1000 },
      });
      const bins = res.success ? (res.data || []) : [];
      if (bins.length === 0) {
        const hierarchyRes = await apiService.get(`/warehouse-locations/warehouses/${warehouseId}/hierarchy`);
        const hierarchyBins = hierarchyRes.success
          ? (hierarchyRes.data || []).flatMap((z) => (z.racks || []).flatMap((r) => r.bins || []))
          : [];
        setBinsForWarehouse(hierarchyBins);
      } else {
        setBinsForWarehouse(bins);
      }
    } catch {
      setBinsForWarehouse([]);
    } finally {
      setBinsLoading(false);
    }
  }, []);

  const resetCreateForm = useCallback(() => {
    form.resetFields();
    form.setFieldsValue(defaultFormValues(unitsRef.current));
    setImageUrl('');
    setComponents([{ itemId: '', quantityRequired: 1, consumptionTiming: 'shipment', consumptionUnitId: null, consumeFullPack: false }]);
    setKitFulfillmentMode('prebuilt');
    setActiveDraftId(null);
    setDraftBanner(null);
    setDraftRestored(false);
    setBinsForWarehouse([]);
    setExistingCustomFields({});
  }, [form]);

  const applyDraft = useCallback((draft) => {
    if (!draft?.data) return;
    restoreBomDraftToForm(draft.data, form, {
      setKitFulfillmentMode,
      setComponents,
      setImageUrl,
    });
    setActiveDraftId(draft.id);
    setDraftBanner({ savedAt: draft.savedAt, label: draft.label || draft.data?.name || 'BOM draft' });
    setDraftRestored(true);
    if (draft.data?.warehouseId) {
      fetchBinsForWarehouse(draft.data.warehouseId);
    }
  }, [form, fetchBinsForWarehouse]);

  const loadDraftById = useCallback(async (draftId) => {
    try {
      const res = await apiService.get('/production/bom-drafts');
      const list = res.success ? res.data : [];
      const draft = list.find((d) => d.id === draftId);
      if (draft) applyDraft(draft);
    } catch {
      message.error('Could not load BOM draft');
    }
  }, [applyDraft]);

  const tryLoadLatestDraft = useCallback(async () => {
    try {
      const res = await apiService.get('/production/bom-draft');
      if (res.success && res.data) {
        setDraftBanner({
          savedAt: res.data.savedAt,
          label: res.data.label || res.data.data?.name || 'BOM draft',
          draftId: res.data.id,
        });
        return res.data;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  useEffect(() => {
    if (open) return undefined;
    initDoneRef.current = false;
    editLoadedItemIdRef.current = null;
    resetCreateForm();
    return undefined;
  }, [open, resetCreateForm]);

  const fetchCatalogItems = useCallback(async (warehouseId) => {
    const params = { status: 'active', limit: 5000, includeVariants: '1' };
    if (warehouseId) params.warehouseId = warehouseId;
    const itemsRes = await apiService.get('/items', { params });
    setCatalogItems(itemsRes.success ? itemsRes.data : []);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    const loadLookups = async () => {
      try {
        const master = await loadMasterData();
        if (cancelled) return;

        if (!itemId && !resumeDraftId && !draftRestored) {
          form.setFieldsValue({ unit: pickDefaultUnit(master.units) });
        }
      } catch {
        if (!cancelled) message.error('Failed to load form lookups');
      }
    };

    loadLookups();
    return () => {
      cancelled = true;
    };
  }, [open, itemId, resumeDraftId, draftRestored, form, loadMasterData]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    fetchCatalogItems(watchedWarehouseId).catch(() => {
      if (!cancelled) message.error('Failed to load component catalog');
    });
    return () => {
      cancelled = true;
    };
  }, [open, watchedWarehouseId, fetchCatalogItems]);

  useEffect(() => {
    if (!open || !itemId) return undefined;
    if (editLoadedItemIdRef.current === itemId) return undefined;

    let cancelled = false;
    editLoadedItemIdRef.current = itemId;

    const loadItem = async () => {
      try {
        setLoading(true);
        const [master, res] = await Promise.all([
          loadMasterData(),
          apiService.get(`/production/bom-items/${itemId}`),
        ]);
        if (cancelled) return;
        if (!res.success || !res.data) {
          message.error('BOM item not found');
          onCancelRef.current?.();
          return;
        }
        const item = res.data;
        const custom = item.custom_fields || {};
        const { brandId, manufacturerId, unitId } = resolveMasterDataIds(item, {
          units: master.units,
          brandOptions: master.brands,
          manufacturerOptions: master.manufacturers,
        });
        setExistingCustomFields(custom);
        const whId = item.warehouse_id || (item.warehouse_ids?.[0]);
        const itemExplode = String(item.kit_fulfillment_mode || item.kitFulfillmentMode || 'prebuilt').toLowerCase() === 'explode_on_ship';
        form.setFieldsValue({
          ...mapBomItemToFormValues(item),
          category: item.category,
          unit: unitId,
          brand: brandId,
          manufacturer: manufacturerId,
          trackInventory: itemExplode ? false : deriveTrackInventoryValue(item, whId),
          isSellable: item.is_sellable !== 0 && item.is_sellable !== false,
          isPurchasable: item.is_purchasable !== 0 && item.is_purchasable !== false,
          isManufacturable: item.is_manufacturable !== 0 && item.is_manufacturable !== false,
          customFields: extractTypeCustomFields(custom),
          salesDescription: custom.salesDescription,
          purchaseDescription: custom.purchaseDescription,
          purchaseTaxRate: custom.purchaseTaxRate,
        });
        setImageUrl(item.image || '');
        setKitFulfillmentMode(item.kit_fulfillment_mode || item.kitFulfillmentMode || 'prebuilt');
        setComponents(normalizeComponents(item.composite_components || []).length
          ? item.composite_components.map((c) => ({
            itemId: c.component_item_id || c.itemId,
            quantityRequired: Number(c.quantity_required ?? c.quantityRequired ?? 1),
            consumptionTiming: c.consumption_timing || c.consumptionTiming || 'shipment',
            consumptionUnitId: c.consumption_unit_id || c.consumptionUnitId || null,
            consumeFullPack: !!(c.consume_full_pack || c.consumeFullPack),
          }))
          : [{ itemId: '', quantityRequired: 1, consumptionTiming: 'shipment', consumptionUnitId: null, consumeFullPack: false }]);
        if (whId) await fetchBinsForWarehouse(whId);
      } catch (err) {
        if (!cancelled) {
          message.error(err?.response?.data?.error || 'Failed to load BOM item');
          onCancelRef.current?.();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadItem();
    return () => {
      cancelled = true;
    };
  }, [open, itemId, form, fetchBinsForWarehouse, loadMasterData]);

  useEffect(() => {
    if (!open || itemId) return undefined;
    if (initDoneRef.current) return undefined;
    initDoneRef.current = true;

    (async () => {
      if (resumeDraftId) {
        await loadDraftById(resumeDraftId);
        return;
      }
      resetCreateForm();
      await tryLoadLatestDraft();
    })();

    return undefined;
  }, [open, itemId, resumeDraftId, loadDraftById, resetCreateForm, tryLoadLatestDraft]);

  const saveDraft = useCallback(async (silent = false) => {
    if (isEditing || autoDraftLock.current) return false;
    const values = form.getFieldsValue();
    if (!hasBomDraftContent(values, components, imageUrl)) {
      if (!silent) message.warning('Nothing to save as draft yet');
      return false;
    }

    autoDraftLock.current = true;
    setDraftSaving(true);
    try {
      const payload = serializeBomDraft(values, components, kitFulfillmentMode, imageUrl);
      const res = await apiService.post('/production/bom-draft', payload);
      const draftId = res?.data?.draftId;
      if (draftId) setActiveDraftId(draftId);
      setDraftBanner({
        savedAt: new Date().toISOString(),
        label: values.name || values.sku || 'BOM draft',
        draftId: draftId || activeDraftId,
      });
      onDraftsChange?.();
      if (!silent) message.success('BOM draft saved');
      return true;
    } catch (err) {
      if (!silent) message.error(err?.response?.data?.error || 'Failed to save draft');
      return false;
    } finally {
      setDraftSaving(false);
      autoDraftLock.current = false;
    }
  }, [isEditing, form, components, kitFulfillmentMode, imageUrl, activeDraftId, onDraftsChange]);

  useEffect(() => {
    if (!open || isEditing) return undefined;
    const timer = setInterval(() => {
      saveDraft(true);
    }, AUTO_DRAFT_MS);
    return () => clearInterval(timer);
  }, [open, isEditing, saveDraft]);

  const discardDraft = async () => {
    try {
      const draftId = activeDraftId || draftBanner?.draftId;
      if (draftId) {
        await apiService.delete(`/production/bom-draft/${draftId}`);
      } else {
        await apiService.delete('/production/bom-draft');
      }
      resetCreateForm();
      onDraftsChange?.();
      message.info('Draft discarded');
    } catch {
      message.error('Could not discard draft');
    }
  };

  const validateBeforeSubmit = () => {
    const values = form.getFieldsValue();
    const result = validateBomBusinessRules({
      values,
      components,
      catalogItems,
      kitFulfillmentMode,
      isEditing,
      units,
    });
    if (!result.ok) {
      message.error(result.message);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!validateBeforeSubmit()) throw new Error('validation_failed');

      const openingStock = Number(values.openingStock) || 0;

      const payload = buildBomSubmitPayload(values, {
        components: normalizeComponents(components, catalogItems, units),
        kitFulfillmentMode,
        imageUrl,
        isEditing,
        existingCustomFields,
      });

      setSaving(true);
      if (isEditing) {
        await apiService.put(`/production/bom-items/${itemId}`, payload);
        message.success('BOM item updated');
      } else {
        await apiService.post('/production/bom-items', payload);
        message.success(
          openingStock > 0 && values.warehouseId
            ? `BOM item created with opening lot ${values.openingBatchNumber || '(auto)'}`
            : 'BOM item created'
        );
        if (activeDraftId || draftBanner?.draftId) {
          try {
            await apiService.delete(`/production/bom-draft/${activeDraftId || draftBanner.draftId}`);
          } catch {
            // non-fatal
          }
        }
        onDraftsChange?.();
      }
      onSuccess?.();
    } catch (err) {
      if (err?.errorFields) {
        message.error('Please fix the highlighted fields (SKU, name, unit, etc.)');
        throw err;
      }
      if (err?.message === 'validation_failed') throw err;
      message.error(err?.response?.data?.error || err?.message || 'Failed to save BOM item');
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!isEditing && hasBomDraftContent(form.getFieldsValue(), components, imageUrl)) {
      await saveDraft(true);
    }
    onCancel?.();
  };

  return (
    <Modal
      open={open}
      title={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              background: BOM_GRADIENT,
              borderRadius: 10,
              padding: '8px 11px',
              color: '#fff',
              fontSize: 16,
              boxShadow: '0 2px 8px rgba(15, 118, 110, 0.35)',
            }}
          >
            {isEditing ? <EditOutlined /> : <BuildOutlined />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, color: BOM_COLORS.charcoal, lineHeight: 1.2 }}>
              {isEditing ? 'Edit BOM recipe' : 'New finished product'}
            </div>
            <div style={{ fontSize: 12, color: BOM_COLORS.slate, fontWeight: 500, marginTop: 2 }}>
              {isEditing ? 'Update product identity, components, and costs' : 'Define the product, then build its component recipe'}
            </div>
          </div>
        </div>
      )}
      onCancel={handleCancel}
      confirmLoading={saving}
      width="min(1280px, 98vw)"
      style={{ top: 12 }}
      destroyOnClose
      styles={{
        header: {
          borderBottom: `1px solid ${BOM_COLORS.border}`,
          padding: '14px 20px',
          marginBottom: 0,
        },
        body: {
          background: BOM_COLORS.formBg,
          maxHeight: '88vh',
          overflowY: 'auto',
          padding: 20,
        },
        footer: {
          borderTop: `1px solid ${BOM_COLORS.border}`,
          background: '#fff',
        },
      }}
      footer={(
        <Space wrap>
          {!isEditing && canManage && (
            <Button loading={draftSaving} onClick={() => saveDraft(false)}>
              Save draft
            </Button>
          )}
          {!isEditing && draftBanner && !draftRestored && (
            <Button type="link" onClick={() => loadDraftById(draftBanner.draftId)} style={{ color: BOM_COLORS.accent }}>
              Resume draft
            </Button>
          )}
          {!isEditing && (activeDraftId || draftBanner?.draftId) && (
            <Button danger type="link" onClick={discardDraft}>
              Discard draft
            </Button>
          )}
          <Button onClick={handleCancel}>Cancel</Button>
          <Button
            type="primary"
            loading={saving}
            onClick={() => handleSubmit().catch(() => {})}
            style={primaryButtonStyle}
          >
            {isEditing ? 'Save recipe' : 'Create finished product'}
          </Button>
        </Space>
      )}
    >
      <Spin spinning={loading}>
        {!isEditing && draftBanner && !draftRestored && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Saved draft: ${draftBanner.label}`}
            description={`Last saved ${draftBanner.savedAt ? dayjs(draftBanner.savedAt).format('DD MMM YYYY, HH:mm') : 'recently'}. Click "Resume draft" to continue.`}
            action={(
              <Button size="small" type="primary" onClick={() => loadDraftById(draftBanner.draftId)}>
                Resume
              </Button>
            )}
          />
        )}

        <Form form={form} layout="vertical" preserve={false} initialValues={defaultFormValues()}>
          <BomItemFormFields
            form={form}
            isEditing={isEditing}
            canManage={canManage}
            itemId={itemId}
            units={units}
            warehouses={warehouses}
            categories={categories}
            itemGroups={itemGroups}
            brandOptions={brandOptions}
            manufacturerOptions={manufacturerOptions}
            taxRateOptions={taxRateOptions}
            fieldConfigs={fieldConfigs}
            canViewCategories={canViewCategories}
            canManageCategories={canManageCategories}
            onRefreshMasterData={refreshMasterData}
            components={components}
            onComponentsChange={setComponents}
            catalogItems={catalogItems}
            kitFulfillmentMode={kitFulfillmentMode}
            onKitFulfillmentModeChange={setKitFulfillmentMode}
            imageUrl={imageUrl}
            onImageChange={(url) => setImageUrl(url)}
            onImageClear={() => setImageUrl('')}
            binsForWarehouse={binsForWarehouse}
            binsLoading={binsLoading}
            onWarehouseChange={fetchBinsForWarehouse}
            variantLibrary={variantLibrary}
            onRefreshVariantLibrary={refreshMasterData}
            onUnitCreated={(unit) => {
              if (!unit?.id) return;
              setUnits((prev) => (prev.some((u) => u.id === unit.id) ? prev : [...prev, unit]));
            }}
          />
        </Form>
      </Spin>
    </Modal>
  );
}
