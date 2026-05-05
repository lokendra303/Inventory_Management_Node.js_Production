import React, { useEffect, useMemo, useState } from 'react';
import { Card, Col, Form, Input, InputNumber, message, Row, Select, Space, Table, Tabs, Tag, Button } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import apiService from '../../services/apiService';
import skuGeneratorService from '../../services/skuGeneratorService';

const Production = () => {
  const [masters, setMasters] = useState([]);
  const [orders, setOrders] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creatingMaster, setCreatingMaster] = useState(false);
  const [skuGenerating, setSkuGenerating] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newManufacturerName, setNewManufacturerName] = useState('');
  const [masterSearch, setMasterSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [orderAvailability, setOrderAvailability] = useState({});
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [masterForm] = Form.useForm();
  const [orderForm] = Form.useForm();
  const watchedIngredients = Form.useWatch('ingredients', masterForm);
  const watchedProcessCost = Form.useWatch('processCost', masterForm);
  const watchedOutputQuantity = Form.useWatch('outputQuantity', masterForm);

  const ingredientOptions = useMemo(
    () => allItems.map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` })),
    [allItems]
  );
  const filteredMasters = useMemo(() => {
    const q = (masterSearch || '').trim().toLowerCase();
    if (!q) return masters;
    return masters.filter((m) =>
      [m.production_item_name, m.production_item_sku, m.title, m.tagline, m.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [masters, masterSearch]);

  const filteredOrders = useMemo(() => {
    const q = (orderSearch || '').trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((o) =>
      [o.order_number, o.production_item_name, o.production_item_sku, o.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [orders, orderSearch]);

  const formulationWarning = useMemo(() => {
    const ingredientRows = Array.isArray(watchedIngredients) ? watchedIngredients : [];
    const outputQty = Number(watchedOutputQuantity || 0);
    if (ingredientRows.length === 0 || outputQty <= 0) return null;

    const units = ingredientRows
      .map((row) => allItems.find((i) => i.id === row?.componentItemId)?.unit)
      .filter(Boolean);
    const uniqueUnits = [...new Set(units)];
    const totalIngredientQty = ingredientRows.reduce((sum, row) => sum + Number(row?.quantityRequired || 0), 0);

    if (uniqueUnits.length === 1) {
      const ratio = totalIngredientQty / outputQty;
      if (ratio > 1.5 || ratio < 0.5) {
        return `Check formula: total ingredient qty (${totalIngredientQty.toFixed(4)} ${uniqueUnits[0]}) looks unusual vs output qty (${outputQty.toFixed(4)} ${uniqueUnits[0]}).`;
      }
    }
    return null;
  }, [watchedIngredients, watchedOutputQuantity, allItems]);

  const outputBalanceInfo = useMemo(() => {
    const ingredientRows = Array.isArray(watchedIngredients) ? watchedIngredients : [];
    const outputQty = Number(watchedOutputQuantity || 0);
    if (ingredientRows.length === 0 || outputQty <= 0) return null;

    const outputUnit = String(masterForm.getFieldValue('unit') || '').trim();
    const ingredientUnits = ingredientRows
      .map((row) => String(allItems.find((i) => i.id === row?.componentItemId)?.unit || '').trim())
      .filter(Boolean);
    if (!outputUnit || ingredientUnits.length === 0) return null;

    const sameUnit = ingredientUnits.every((u) => u.toLowerCase() === outputUnit.toLowerCase());
    if (!sameUnit) return null;

    const totalIngredientQty = ingredientRows.reduce((sum, row) => sum + Number(row?.quantityRequired || 0), 0);
    const diff = Number((outputQty - totalIngredientQty).toFixed(4));
    return {
      outputQty: Number(outputQty.toFixed(4)),
      totalIngredientQty: Number(totalIngredientQty.toFixed(4)),
      diff,
      unit: outputUnit
    };
  }, [watchedIngredients, watchedOutputQuantity, allItems, masterForm]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [mastersRes, ordersRes, allItemsRes, warehousesRes, categoriesRes, manufacturersRes, brandsRes] = await Promise.all([
        apiService.get('/production/masters'),
        apiService.get('/production/orders'),
        apiService.get('/items', { params: { status: 'active' } }),
        apiService.get('/warehouses', { params: { status: 'active' } }),
        apiService.get('/categories').catch(() => ({ success: false, data: [] })),
        apiService.get('/manufacturers').catch(() => ({ success: false, data: [] })),
        apiService.get('/brands').catch(() => ({ success: false, data: [] }))
      ]);
      if (mastersRes.success) setMasters(mastersRes.data);
      if (ordersRes.success) setOrders(ordersRes.data);
      if (allItemsRes.success) setAllItems(allItemsRes.data);
      if (warehousesRes.success) setWarehouses(warehousesRes.data);
      if (categoriesRes?.success) setCategories(categoriesRes.data || []);
      if (Array.isArray(manufacturersRes)) {
        setManufacturers(manufacturersRes);
      } else if (manufacturersRes?.success) {
        setManufacturers(manufacturersRes.data || []);
      } else if (Array.isArray(manufacturersRes?.data)) {
        setManufacturers(manufacturersRes.data);
      }
      if (Array.isArray(brandsRes)) {
        setBrands(brandsRes);
      } else if (brandsRes?.success) {
        setBrands(brandsRes.data || []);
      } else if (Array.isArray(brandsRes?.data)) {
        setBrands(brandsRes.data);
      }
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to load production data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const ingredientRows = Array.isArray(watchedIngredients) ? watchedIngredients : [];
    const selectedUnits = ingredientRows
      .map((row) => allItems.find((i) => i.id === row?.componentItemId)?.unit)
      .filter(Boolean);

    if (selectedUnits.length === 0) return;

    const uniqueUnits = [...new Set(selectedUnits)];
    if (uniqueUnits.length === 1) {
      // Auto-derive output unit from ingredient composition when all units match.
      masterForm.setFieldsValue({ unit: uniqueUnits[0] });
    }
  }, [watchedIngredients, allItems, masterForm]);

  useEffect(() => {
    const ingredientRows = Array.isArray(watchedIngredients) ? watchedIngredients : [];
    const materialCost = ingredientRows.reduce((sum, row) => {
      const item = allItems.find((i) => i.id === row?.componentItemId);
      const qty = Number(row?.quantityRequired || 0);
      const unitCost = Number(item?.cost_price || 0);
      return sum + (qty * unitCost);
    }, 0);

    const processCost = Number(watchedProcessCost || 0);
    const outputQty = Number(watchedOutputQuantity || 0);
    const totalCost = materialCost + processCost;
    const derivedCostPrice = outputQty > 0 ? (totalCost / outputQty) : 0;

    masterForm.setFieldsValue({
      costPrice: Number.isFinite(derivedCostPrice) ? Number(derivedCostPrice.toFixed(4)) : 0,
      materialCost: Number(materialCost.toFixed(4)),
      totalEstimatedCost: Number(totalCost.toFixed(4))
    });
  }, [watchedIngredients, watchedProcessCost, watchedOutputQuantity, allItems, masterForm]);

  const handleGenerateSku = async () => {
    setSkuGenerating(true);
    try {
      const ctx = {
        category: masterForm.getFieldValue('category'),
        name: masterForm.getFieldValue('itemName')
      };
      const sku = await skuGeneratorService.generateSku(ctx);
      if (sku) {
        masterForm.setFieldsValue({ itemSku: sku });
        message.success(`Generated SKU: ${sku}`);
      }
    } catch (error) {
      message.error(error?.response?.data?.error || error?.message || 'Failed to generate SKU');
    } finally {
      setSkuGenerating(false);
    }
  };

  const handleAddCategory = async () => {
    const name = (newCategoryName || '').trim();
    if (!name) {
      message.warning('Enter category name');
      return;
    }
    try {
      const existing = categories.find((c) => (c.name || '').toLowerCase() === name.toLowerCase());
      if (existing) {
        masterForm.setFieldsValue({ category: existing.name });
        setNewCategoryName('');
        return;
      }
      const res = await apiService.post('/categories', { name });
      if (res.success) {
        const created = res.data || {};
        const next = [...categories, { id: created.id || Date.now().toString(), name }];
        setCategories(next);
        masterForm.setFieldsValue({ category: name });
        setNewCategoryName('');
        message.success('Category added');
      }
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to add category');
    }
  };

  const handleDeleteCategory = async (category) => {
    try {
      if (category?.id) {
        await apiService.delete(`/categories/${category.id}`);
      }
      const next = categories.filter((c) => c.id !== category.id);
      setCategories(next);
      if (masterForm.getFieldValue('category') === category.name) {
        masterForm.setFieldsValue({ category: undefined });
      }
      message.success(`Category '${category.name}' deleted`);
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to delete category');
    }
  };

  const handleAddManufacturer = async () => {
    const name = (newManufacturerName || '').trim();
    if (!name) {
      message.warning('Enter manufacturer name');
      return;
    }
    try {
      const existing = manufacturers.find((m) => (m.name || '').toLowerCase() === name.toLowerCase());
      if (existing) {
        masterForm.setFieldsValue({ manufacturer: existing.id });
        setNewManufacturerName('');
        return;
      }
      const res = await apiService.post('/manufacturers', { name });
      const created = (res && !res.success) ? res : (res?.data || {});
      const added = { id: created.id || Date.now().toString(), name: created.name || name };
      const next = [...manufacturers, added];
      setManufacturers(next);
      masterForm.setFieldsValue({ manufacturer: added.id });
      setNewManufacturerName('');
      message.success('Manufacturer added');
    } catch (error) {
      const apiError = error?.response?.data?.error || '';
      if (String(apiError).toLowerCase().includes('duplicate entry')) {
        try {
          const refreshed = await apiService.get('/manufacturers');
          const list = Array.isArray(refreshed)
            ? refreshed
            : Array.isArray(refreshed?.data)
              ? refreshed.data
              : [];
          setManufacturers(list);
          const existing = list.find((m) => String(m.name || '').trim().toLowerCase() === name.toLowerCase());
          if (existing) {
            masterForm.setFieldsValue({ manufacturer: existing.id });
            setNewManufacturerName('');
            message.info('Manufacturer already exists, selected existing record');
            return;
          }
        } catch {
          // Fallback to generic error below if refresh fails.
        }
      }
      message.error(apiError || 'Failed to add manufacturer');
    }
  };

  const handleDeleteManufacturer = async (manufacturer) => {
    try {
      if (manufacturer?.id) {
        await apiService.delete(`/manufacturers/${manufacturer.id}`);
      }
      const next = manufacturers.filter((m) => m.id !== manufacturer.id);
      setManufacturers(next);
      if (masterForm.getFieldValue('manufacturer') === manufacturer.id) {
        masterForm.setFieldsValue({ manufacturer: undefined });
      }
      message.success(`Manufacturer '${manufacturer.name}' deleted`);
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to delete manufacturer');
    }
  };

  const createMaster = async (values) => {
    setCreatingMaster(true);
    try {
      const itemRes = await apiService.post('/items', {
        sku: values.itemSku,
        name: values.itemName,
        description: values.itemDescription,
        type: 'manufactured',
        category: values.category || null,
        brand: values.brand || null,
        manufacturer: values.manufacturer || null,
        unit: values.unit,
        warehouseId: values.defaultWarehouseId,
        costPrice: Number(values.costPrice || 0),
        sellingPrice: Number(values.sellingPrice || 0),
        mrp: Number(values.mrp || 0),
        taxRate: Number(values.taxRate || 0),
        barcode: values.barcode || null,
        hsnCode: values.hsnCode || null,
        upc: values.upc || null,
        ean: values.ean || null,
        isbn: values.isbn || null,
        mpn: values.mpn || null,
        weight: Number(values.weight || 0),
        minStockLevel: Number(values.minStockLevel || 0),
        maxStockLevel: Number(values.maxStockLevel || 0),
        openingStock: Number(values.openingStock || 0),
        openingValue: Number(values.openingValue || 0),
        valuationMethod: values.valuationMethod || 'fifo',
        customFields: {
          production_tagline: values.tagline || null,
          production_notes: values.processNotes || null
        }
      });
      const productionItemId = itemRes?.data?.itemId;
      if (!productionItemId) throw new Error('Failed to create production item');

      const masterRes = await apiService.post('/production/masters', {
        productionItemId,
        defaultWarehouseId: values.defaultWarehouseId,
        title: values.masterTitle || values.itemName,
        tagline: values.tagline || null,
        status: 'active'
      });
      const masterId = masterRes?.data?.masterId;
      if (!masterId) throw new Error('Failed to create production master');

      await apiService.post(`/production/masters/${masterId}/bom-versions`, {
        outputQuantity: Number(values.outputQuantity),
        status: 'active',
        notes: values.processNotes || null,
        lines: (values.ingredients || []).map((line, idx) => ({
          componentItemId: line.componentItemId,
          quantityRequired: Number(line.quantityRequired),
          wastagePercent: Number(line.wastagePercent || 0),
          sequenceNo: idx + 1
        }))
      });

      message.success('Production master created with item + ingredients');
      masterForm.resetFields();
      await loadAll();
    } catch (error) {
      message.error(error?.response?.data?.error || error.message || 'Failed to create production master');
    } finally {
      setCreatingMaster(false);
    }
  };

  const createOrder = async (values) => {
    try {
      const res = await apiService.post('/production/orders', {
        masterId: values.masterId,
        warehouseId: values.warehouseId,
        plannedQuantity: values.plannedQuantity,
        processCostTotal: values.processCostTotal || 0
      });
      if (res.success) {
        message.success(`Production order created (${res.data.orderNumber})`);
        orderForm.resetFields();
        await loadAll();
      }
    } catch (error) {
      message.error(error?.response?.data?.error || 'Failed to create order');
    }
  };

  const runAvailability = async (orderId) => {
    try {
      const res = await apiService.get(`/production/orders/${orderId}/availability-summary`);
      if (res.success) {
        setOrderAvailability((prev) => ({ ...prev, [orderId]: res.data }));
        setSelectedOrderId(orderId);
        if (res.data.isFullyAvailable) message.success('All raw materials are available for remaining quantity');
        else message.warning(`Shortage found. Max completable now: ${res.data.maxCompletableNow}`);
      }
    } catch (error) {
      message.error(error?.response?.data?.error || 'Availability check failed');
    }
  };

  const completeOrder = async (order) => {
    try {
      let summary = orderAvailability[order.id];
      if (!summary) {
        const summaryRes = await apiService.get(`/production/orders/${order.id}/availability-summary`);
        if (summaryRes.success) {
          summary = summaryRes.data;
          setOrderAvailability((prev) => ({ ...prev, [order.id]: summaryRes.data }));
        }
      }
      const remaining = Number(summary?.remainingQuantity ?? (Number(order.planned_quantity) - Number(order.actual_quantity || 0)));
      const maxCompletable = Number(summary?.maxCompletableNow ?? 0);
      const completionQty = Math.max(0, Math.min(remaining, maxCompletable));
      if (completionQty <= 0) {
        message.warning('No stock available to complete this order now');
        return;
      }

      const res = await apiService.post(`/production/orders/${order.id}/complete`, {
        actualQuantity: completionQty,
        processCostTotal: Number(order.process_cost_total || 0)
      });
      if (res.success) {
        message.success(`Production updated. Completed qty: ${completionQty}`);
        setOrderAvailability((prev) => ({ ...prev, [order.id]: undefined }));
        await loadAll();
      }
    } catch (error) {
      message.error(error?.response?.data?.error || 'Complete failed');
    }
  };

  const sectionCardStyle = {
    background: '#fff',
    border: '1px solid #eef0f5',
    borderRadius: 12,
    padding: '14px 14px 4px',
    marginBottom: 14
  };
  const sectionTitleStyle = {
    fontWeight: 700,
    fontSize: 13,
    color: '#4f46e5',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  };

  return (
    <div style={{ padding: 24 }}>
      <Card title="Production" style={{ borderRadius: 12 }}>
        <Tabs
          defaultActiveKey="masters"
          items={[
            {
              key: 'masters',
              label: <span>Production Masters <Tag color="purple">{masters.length}</Tag></span>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Card size="small" style={{ background: '#fafafa', borderColor: '#eee' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>How quantity is handled</div>
                    <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                      <div>- <b>Qty Required</b> is absolute quantity (not percentage), in ingredient item unit.</div>
                      <div>- <b>Wastage %</b> is extra consumption: effective = qty required x (1 + wastage/100).</div>
                      <div>- <b>Output Quantity</b> is finished quantity per batch basis.</div>
                      <div>- Example: Output 20 g, Ingredient A 10 g, Ingredient B 10 g.</div>
                    </div>
                  </Card>
                  <Form form={masterForm} layout="vertical" onFinish={createMaster}>
                    <div style={sectionCardStyle}>
                      <div style={sectionTitleStyle}>Basic Item Info</div>
                    <Row gutter={12}>
                      <Col span={6}><Form.Item label="Item Name" name="itemName" rules={[{ required: true }]}><Input placeholder="Finished good name" /></Form.Item></Col>
                      <Col span={5}>
                        <Form.Item label="SKU" name="itemSku" rules={[{ required: true }]}>
                          <Input
                            placeholder="FG-001"
                            addonAfter={
                              <Button
                                type="link"
                                size="small"
                                onClick={handleGenerateSku}
                                loading={skuGenerating}
                                style={{ padding: 0, height: 'auto' }}
                              >
                                Generate
                              </Button>
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item
                          label="Unit"
                          name="unit"
                          rules={[{ required: true }]}
                          extra="Auto-derived from ingredients when units match"
                        >
                          <Input
                            placeholder="Auto from ingredients (or set manually)"
                            disabled={
                              (() => {
                                const ingredientRows = Array.isArray(watchedIngredients) ? watchedIngredients : [];
                                const units = ingredientRows
                                  .map((row) => allItems.find((i) => i.id === row?.componentItemId)?.unit)
                                  .filter(Boolean);
                                return units.length > 0 && new Set(units).size === 1;
                              })()
                            }
                          />
                        </Form.Item>
                      </Col>
                      <Col span={5}><Form.Item label="Default Warehouse" name="defaultWarehouseId" rules={[{ required: true }]}><Select showSearch options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Master Title" name="masterTitle"><Input placeholder="Optional master name" /></Form.Item></Col>
                    </Row>
                    </div>

                    <div style={sectionCardStyle}>
                      <div style={sectionTitleStyle}>Pricing and Costing</div>
                    <Row gutter={12}>
                      <Col span={8}><Form.Item label="Tagline" name="tagline"><Input placeholder="Production tagline" /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Output Quantity" name="outputQuantity" rules={[{ required: true }]}><InputNumber min={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}>
                        <Form.Item label="Process Cost" name="processCost" initialValue={0}>
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Cost Price (Auto)" name="costPrice" extra="(Material + Process Cost) / Output Qty">
                          <InputNumber min={0} style={{ width: '100%' }} disabled />
                        </Form.Item>
                      </Col>
                      <Col span={4}><Form.Item label="Selling Price" name="sellingPrice"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Valuation" name="valuationMethod" initialValue="fifo"><Select options={[{ value: 'fifo', label: 'FIFO' }, { value: 'weighted_average', label: 'Weighted Avg' }]} /></Form.Item></Col>
                    </Row>
                    </div>

                    <div style={sectionCardStyle}>
                      <div style={sectionTitleStyle}>Classification and Identification</div>
                    <Row gutter={12}>
                      <Col span={8}><Form.Item label="Description" name="itemDescription"><Input /></Form.Item></Col>
                      <Col span={4}>
                        <Form.Item label="Category" name="category">
                          <Select
                            placeholder="Select category"
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                              String(option?.value || '').toLowerCase().includes(input.toLowerCase())
                            }
                            dropdownRender={(menu) => (
                              <div>
                                {menu}
                                <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
                                  <Space.Compact style={{ width: '100%' }}>
                                    <Input
                                      placeholder="New category"
                                      value={newCategoryName}
                                      onChange={(e) => setNewCategoryName(e.target.value)}
                                      onPressEnter={handleAddCategory}
                                    />
                                    <Button type="primary" onClick={handleAddCategory}>Add</Button>
                                  </Space.Compact>
                                </div>
                              </div>
                            )}
                          >
                            {categories.map((category) => (
                              <Select.Option key={category.id} value={category.name}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span>{category.name}</span>
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCategory(category);
                                    }}
                                    style={{
                                      marginLeft: 8,
                                      width: 18,
                                      height: 18,
                                      borderRadius: '50%',
                                      backgroundColor: '#ff4d4f',
                                      color: 'white',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 12,
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ×
                                  </span>
                                </div>
                              </Select.Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Brand" name="brand">
                          <Select
                            placeholder="Select brand"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={brands.map((b) => ({ value: b.id || b.name, label: b.name }))}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}>
                        <Form.Item label="Manufacturer" name="manufacturer">
                          <Select
                            placeholder="Select manufacturer"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            options={manufacturers.map((m) => ({ value: m.id, label: m.name }))}
                            dropdownRender={(menu) => (
                              <div>
                                {menu}
                                <div style={{ padding: 8, borderTop: '1px solid #f0f0f0' }}>
                                  <Space.Compact style={{ width: '100%' }}>
                                    <Input
                                      placeholder="New manufacturer"
                                      value={newManufacturerName}
                                      onChange={(e) => setNewManufacturerName(e.target.value)}
                                      onPressEnter={handleAddManufacturer}
                                    />
                                    <Button type="primary" onClick={handleAddManufacturer}>Add</Button>
                                  </Space.Compact>
                                  <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>
                                    {manufacturers.map((m) => (
                                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                                        <span style={{ fontSize: 12 }}>{m.name}</span>
                                        <Button type="text" danger size="small" onClick={() => handleDeleteManufacturer(m)}>Delete</Button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={4}><Form.Item label="Tax Rate (%)" name="taxRate"><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="MRP" name="mrp"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    </div>

                    <div style={sectionCardStyle}>
                      <div style={sectionTitleStyle}>Inventory Defaults</div>
                    <Row gutter={12}>
                      <Col span={4}><Form.Item label="Barcode" name="barcode"><Input /></Form.Item></Col>
                      <Col span={4}><Form.Item label="HSN Code" name="hsnCode"><Input /></Form.Item></Col>
                      <Col span={4}><Form.Item label="UPC" name="upc"><Input /></Form.Item></Col>
                      <Col span={4}><Form.Item label="EAN" name="ean"><Input /></Form.Item></Col>
                      <Col span={4}><Form.Item label="ISBN" name="isbn"><Input /></Form.Item></Col>
                      <Col span={4}><Form.Item label="MPN" name="mpn"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={4}><Form.Item label="Weight" name="weight"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Min Stock" name="minStockLevel"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Max Stock" name="maxStockLevel"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Opening Stock" name="openingStock"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={8}><Form.Item label="Process Notes" name="processNotes"><Input /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Opening Value" name="openingValue"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Material Cost (Auto)" name="materialCost"><InputNumber min={0} style={{ width: '100%' }} disabled /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Total Est. Cost (Auto)" name="totalEstimatedCost"><InputNumber min={0} style={{ width: '100%' }} disabled /></Form.Item></Col>
                    </Row>
                    </div>

                    <div style={sectionCardStyle}>
                      <div style={sectionTitleStyle}>Ingredients and Formula</div>
                    <Form.List name="ingredients" initialValue={[{}]}>
                      {(fields, { add, remove }) => (
                        <>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Ingredients (existing items)</div>
                          <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                            Select ingredient -> enter absolute required quantity in that ingredient unit -> optional wastage %.
                          </div>
                          {fields.map((field, idx) => (
                            <Row gutter={12} key={field.key} align="middle">
                              <Col span={10}>
                                <Form.Item
                                  {...field}
                                  label={idx === 0 ? 'Ingredient Item' : ''}
                                  name={[field.name, 'componentItemId']}
                                  rules={[{ required: true, message: 'Select ingredient item' }]}
                                >
                                  <Select showSearch options={ingredientOptions} />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item
                                  label={idx === 0 ? 'Unit' : ''}
                                  extra={idx === 0 ? 'Auto from ingredient' : null}
                                >
                                  <Input
                                    value={
                                      (() => {
                                        const selectedId = watchedIngredients?.[field.name]?.componentItemId;
                                        return allItems.find((i) => i.id === selectedId)?.unit || '-';
                                      })()
                                    }
                                    disabled
                                  />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item
                                  {...field}
                                  label={idx === 0 ? 'Qty Required' : ''}
                                  name={[field.name, 'quantityRequired']}
                                  rules={[
                                    { required: true, message: 'Enter required quantity' },
                                    {
                                      validator: (_, value) => (
                                        Number(value) > 0
                                          ? Promise.resolve()
                                          : Promise.reject(new Error('Quantity must be greater than 0'))
                                      )
                                    }
                                  ]}
                                  extra={
                                    (() => {
                                      const selectedId = watchedIngredients?.[field.name]?.componentItemId;
                                      const unit = allItems.find((i) => i.id === selectedId)?.unit;
                                      return unit ? `Unit: ${unit}` : 'Select ingredient to see unit';
                                    })()
                                  }
                                >
                                  <InputNumber min={0.0001} style={{ width: '100%' }} placeholder="e.g. 10" />
                                </Form.Item>
                              </Col>
                              <Col span={4}>
                                <Form.Item
                                  {...field}
                                  label={idx === 0 ? 'Wastage %' : ''}
                                  name={[field.name, 'wastagePercent']}
                                  rules={[
                                    {
                                      validator: (_, value) => (
                                        value === undefined || value === null || Number(value) >= 0
                                          ? Promise.resolve()
                                          : Promise.reject(new Error('Wastage cannot be negative'))
                                      )
                                    }
                                  ]}
                                  extra={idx === 0 ? 'Percentage only (e.g. 2 means 2%)' : null}
                                >
                                  <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                                </Form.Item>
                              </Col>
                              <Col span={2}>
                                <Button danger icon={<MinusCircleOutlined />} onClick={() => remove(field.name)} disabled={fields.length === 1} style={{ marginTop: idx === 0 ? 30 : 0 }} />
                              </Col>
                            </Row>
                          ))}
                          <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>Add Ingredient</Button>
                        </>
                      )}
                    </Form.List>
                    </div>
                    {outputBalanceInfo && (
                      <div
                        style={{
                          marginTop: 10,
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 12,
                          border: outputBalanceInfo.diff === 0 ? '1px solid #b7eb8f' : '1px solid #ffd591',
                          background: outputBalanceInfo.diff === 0 ? '#f6ffed' : '#fff7e6',
                          color: outputBalanceInfo.diff === 0 ? '#389e0d' : '#d46b08'
                        }}
                      >
                        {outputBalanceInfo.diff > 0 && (
                          <>Ingredients total is {outputBalanceInfo.totalIngredientQty} {outputBalanceInfo.unit}. Add {outputBalanceInfo.diff} {outputBalanceInfo.unit} more to match output {outputBalanceInfo.outputQty} {outputBalanceInfo.unit}.</>
                        )}
                        {outputBalanceInfo.diff < 0 && (
                          <>Ingredients total exceeds output by {Math.abs(outputBalanceInfo.diff)} {outputBalanceInfo.unit}. Please review formula balance.</>
                        )}
                        {outputBalanceInfo.diff === 0 && (
                          <>Ingredients total matches output quantity ({outputBalanceInfo.outputQty} {outputBalanceInfo.unit}).</>
                        )}
                      </div>
                    )}
                    {formulationWarning && (
                      <div style={{ marginTop: 10, color: '#d46b08', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>
                        {formulationWarning}
                      </div>
                    )}
                    <div style={{ marginTop: 12 }}>
                      <Button type="primary" htmlType="submit" loading={creatingMaster}>Create Master Item + BOM</Button>
                    </div>
                  </Form>
                  <Table
                    rowKey="id"
                    loading={loading}
                    title={() => (
                      <Input
                        placeholder="Search masters by item, SKU, title, tagline..."
                        value={masterSearch}
                        onChange={(e) => setMasterSearch(e.target.value)}
                        allowClear
                        style={{ maxWidth: 420 }}
                      />
                    )}
                    dataSource={filteredMasters}
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: 'Item', render: (_, r) => `${r.production_item_name || '-'} (${r.production_item_sku || '-'})` },
                      { title: 'Active BOM', dataIndex: 'active_bom_version_id', render: (v) => (v ? <Tag color="green">Configured</Tag> : <Tag color="red">Missing</Tag>) },
                      { title: 'Title', dataIndex: 'title' },
                      { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
                      { title: 'Tagline', dataIndex: 'tagline' }
                    ]}
                  />
                </Space>
              )
            },
            {
              key: 'orders',
              label: <span>Production Orders <Tag color="blue">{orders.length}</Tag></span>,
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <Form form={orderForm} layout="vertical" onFinish={createOrder}>
                    <Row gutter={12}>
                      <Col span={8}><Form.Item label="Master" name="masterId" rules={[{ required: true }]}><Select showSearch options={masters.filter(m => m.status === 'active').map(m => ({ value: m.id, label: `${m.production_item_name} ${m.title ? `- ${m.title}` : ''}` }))} /></Form.Item></Col>
                      <Col span={6}><Form.Item label="Warehouse" name="warehouseId" rules={[{ required: true }]}><Select showSearch options={warehouses.map(w => ({ value: w.id, label: w.name }))} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Planned Quantity" name="plannedQuantity" rules={[{ required: true }]}><InputNumber min={0.0001} style={{ width: '100%' }} /></Form.Item></Col>
                      <Col span={4}><Form.Item label="Process Cost" name="processCostTotal"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Button type="primary" htmlType="submit">Create Order</Button>
                  </Form>
                  <Table
                    rowKey="id"
                    loading={loading}
                    title={() => (
                      <Input
                        placeholder="Search orders by number, item, SKU, status..."
                        value={orderSearch}
                        onChange={(e) => setOrderSearch(e.target.value)}
                        allowClear
                        style={{ maxWidth: 420 }}
                      />
                    )}
                    dataSource={filteredOrders}
                    pagination={{ pageSize: 8 }}
                    columns={[
                      { title: 'Order', dataIndex: 'order_number' },
                      { title: 'Item', render: (_, r) => `${r.production_item_name || '-'} (${r.production_item_sku || '-'})` },
                      { title: 'Planned Qty', dataIndex: 'planned_quantity' },
                      { title: 'Completed Qty', dataIndex: 'actual_quantity' },
                      {
                        title: 'Remaining Qty',
                        render: (_, r) => Number((Number(r.planned_quantity || 0) - Number(r.actual_quantity || 0)).toFixed(4))
                      },
                      {
                        title: 'Max Completable Now',
                        render: (_, r) => {
                          const s = orderAvailability[r.id];
                          return s ? Number(s.maxCompletableNow || 0) : '-';
                        }
                      },
                      { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'completed' ? 'green' : 'gold'}>{v}</Tag> },
                      {
                        title: 'Actions',
                        render: (_, r) => (
                          <Space>
                            <Button size="small" onClick={() => runAvailability(r.id)}>Check</Button>
                            <Button size="small" type="primary" disabled={r.status === 'completed' || r.status === 'cancelled'} onClick={() => completeOrder(r)}>
                              Complete
                            </Button>
                          </Space>
                        )
                      }
                    ]}
                  />
                  {selectedOrderId && orderAvailability[selectedOrderId] && (
                    <Card size="small" title="Availability Details" style={{ marginTop: 12 }}>
                      <div style={{ marginBottom: 8, fontSize: 12 }}>
                        Remaining: <b>{orderAvailability[selectedOrderId].remainingQuantity}</b> | Max completable now: <b>{orderAvailability[selectedOrderId].maxCompletableNow}</b>
                      </div>
                      <Table
                        rowKey="componentItemId"
                        size="small"
                        pagination={false}
                        dataSource={orderAvailability[selectedOrderId].components || []}
                        columns={[
                          { title: 'Ingredient', dataIndex: 'componentName' },
                          { title: 'Required (Remaining)', dataIndex: 'requiredForRemaining' },
                          { title: 'Available', dataIndex: 'availableQuantity' },
                          {
                            title: 'Shortage',
                            dataIndex: 'shortageQuantity',
                            render: (v) => v > 0 ? <Tag color="red">{v}</Tag> : <Tag color="green">0</Tag>
                          }
                        ]}
                      />
                    </Card>
                  )}
                </Space>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default Production;
