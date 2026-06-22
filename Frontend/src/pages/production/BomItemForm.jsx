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
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import BomItemFormFields from '../../components/production/BomItemFormFields';
import apiService from '../../services/apiService';
import { useAuth } from '../../hooks/useAuth.jsx';
import {
  buildBomSubmitPayload,
  hasBomDraftContent,
  mapBomItemToFormValues,
  restoreBomDraftToForm,
  serializeBomDraft,
} from '../../utils/bomDraft';

const AUTO_DRAFT_MS = 45000;

const normalizeComponents = (rows = []) => {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      itemId: String(row?.itemId || row?.component_item_id || '').trim(),
      quantityRequired: Number(row?.quantityRequired ?? row?.quantity_required),
      consumptionTiming: String(row?.consumptionTiming || row?.consumption_timing || 'shipment').toLowerCase(),
    }))
    .filter((row) => row.itemId && Number.isFinite(row.quantityRequired) && row.quantityRequired > 0)
    .map((row) => ({
      ...row,
      consumptionTiming: ['order', 'shipment'].includes(row.consumptionTiming) ? row.consumptionTiming : 'shipment',
    }));
};

const pickDefaultUnit = (units = []) => {
  if (!units.length) return 'pcs';
  const pcs = units.find((u) => String(u.name || '').toLowerCase() === 'pcs'
    || String(u.symbol || '').toLowerCase() === 'pcs');
  const row = pcs || units[0];
  return row.id || row.name || 'pcs';
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
  unit: pickDefaultUnit(units),
});

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
  const [form] = Form.useForm();
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

  const hasExpiry = Form.useWatch('hasExpiry', form);
  const isEditing = Boolean(itemId);

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
    form.setFieldsValue(defaultFormValues(units));
    setImageUrl('');
    setComponents([{ itemId: '', quantityRequired: 1, consumptionTiming: 'shipment' }]);
    setKitFulfillmentMode('prebuilt');
    setActiveDraftId(null);
    setDraftBanner(null);
    setDraftRestored(false);
    setBinsForWarehouse([]);
    setExistingCustomFields({});
  }, [form, units]);

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
    if (!open) {
      initDoneRef.current = false;
      return undefined;
    }

    const loadLookups = async () => {
      try {
        const [
          itemsRes,
          unitsRes,
          whRes,
          catRes,
          groupsRes,
          brandsRes,
          mfgRes,
          taxRes,
        ] = await Promise.all([
          apiService.get('/items', { params: { limit: 5000 } }),
          apiService.get('/units'),
          apiService.get('/warehouses'),
          apiService.get('/categories'),
          apiService.get('/item-groups'),
          apiService.get('/brands'),
          apiService.get('/manufacturers'),
          apiService.get('/tax/rates'),
        ]);
        const unitRows = unitsRes.success ? unitsRes.data : [];
        setCatalogItems(itemsRes.success ? itemsRes.data : []);
        setUnits(unitRows);
        setWarehouses((whRes.success ? whRes.data : []).filter((w) => w.status === 'active'));
        setCategories(catRes.success ? catRes.data : []);
        setItemGroups(groupsRes.success ? groupsRes.data : []);
        setBrandOptions(brandsRes.success ? brandsRes.data : []);
        setManufacturerOptions(mfgRes.success ? mfgRes.data : []);
        setTaxRateOptions(taxRes.success ? taxRes.data : []);

        if (!itemId && !resumeDraftId && !draftRestored) {
          form.setFieldsValue({ unit: pickDefaultUnit(unitRows) });
        }
      } catch {
        message.error('Failed to load form lookups');
      }
    };

    loadLookups();
    return undefined;
  }, [open, itemId, resumeDraftId, draftRestored, form]);

  useEffect(() => {
    if (!open) {
      resetCreateForm();
      return undefined;
    }

    if (itemId) {
      const loadItem = async () => {
        try {
          setLoading(true);
          const res = await apiService.get(`/production/bom-items/${itemId}`);
          if (!res.success || !res.data) {
            message.error('BOM item not found');
            onCancel?.();
            return;
          }
          const item = res.data;
          const custom = item.custom_fields || {};
          setExistingCustomFields(custom);
          form.setFieldsValue({
            ...mapBomItemToFormValues(item),
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
            }))
            : [{ itemId: '', quantityRequired: 1, consumptionTiming: 'shipment' }]);
          const whId = item.warehouse_id || (item.warehouse_ids?.[0]);
          if (whId) await fetchBinsForWarehouse(whId);
        } catch (err) {
          message.error(err?.response?.data?.error || 'Failed to load BOM item');
          onCancel?.();
        } finally {
          setLoading(false);
        }
      };
      loadItem();
      return undefined;
    }

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
  }, [open, itemId, resumeDraftId, form, onCancel, loadDraftById, resetCreateForm, tryLoadLatestDraft, fetchBinsForWarehouse]);

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

  const validateComponents = () => {
    const emptyRows = components.filter((row) => !row.itemId);
    if (emptyRows.length > 0) {
      message.error('Select a component item for each BOM row (or remove empty rows)');
      return false;
    }
    const normalizedComponents = normalizeComponents(components);
    if (normalizedComponents.length === 0) {
      message.error('Add at least one BOM component');
      return false;
    }
    const duplicateSet = new Set(normalizedComponents.map((row) => row.itemId));
    if (duplicateSet.size !== normalizedComponents.length) {
      message.error('Duplicate component is not allowed — use one row and increase qty');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!validateComponents()) throw new Error('validation_failed');

      const openingStock = Number(values.openingStock) || 0;
      if (!isEditing && openingStock > 0 && values.warehouseId && values.hasExpiry && !values.openingExpiryDate) {
        message.error('Expiry date is required when Has expiry is on and opening stock is set');
        throw new Error('validation_failed');
      }

      const payload = buildBomSubmitPayload(values, {
        components: normalizeComponents(components),
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', borderRadius: 8, padding: '6px 10px', color: '#fff', fontSize: 16 }}>
            {isEditing ? <EditOutlined /> : <PlusOutlined />}
          </div>
          <span style={{ fontWeight: 700, fontSize: 17 }}>
            {isEditing ? 'Edit BOM item' : 'Create BOM item'}
          </span>
        </div>
      )}
      onCancel={handleCancel}
      confirmLoading={saving}
      width="min(1280px, 98vw)"
      style={{ top: 12 }}
      destroyOnClose
      styles={{ body: { background: '#fafbff', maxHeight: '88vh', overflowY: 'auto', padding: 20 } }}
      footer={(
        <Space wrap>
          {!isEditing && canManage && (
            <Button loading={draftSaving} onClick={() => saveDraft(false)}>
              Save draft
            </Button>
          )}
          {!isEditing && draftBanner && !draftRestored && (
            <Button type="link" onClick={() => loadDraftById(draftBanner.draftId)}>
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
            style={{
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              fontWeight: 700,
            }}
          >
            {isEditing ? 'Save changes' : 'Create BOM item'}
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
            components={components}
            onComponentsChange={setComponents}
            catalogItems={catalogItems}
            kitFulfillmentMode={kitFulfillmentMode}
            onKitFulfillmentModeChange={setKitFulfillmentMode}
            hasExpiry={Boolean(hasExpiry)}
            imageUrl={imageUrl}
            onImageChange={(url) => setImageUrl(url)}
            onImageClear={() => setImageUrl('')}
            binsForWarehouse={binsForWarehouse}
            binsLoading={binsLoading}
            onWarehouseChange={fetchBinsForWarehouse}
          />
        </Form>
      </Spin>
    </Modal>
  );
}
