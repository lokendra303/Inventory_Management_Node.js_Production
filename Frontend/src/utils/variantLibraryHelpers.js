export const normalizeOptionalTextArray = (value) => {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) return value.map((v) => String(v || '').trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
};

export const formScalarMeta = (value) => normalizeOptionalTextArray(value)[0] || undefined;

export function getVariantLibraryValuesByAliases(variantLibrary = [], aliases = []) {
  const aliasSet = new Set((aliases || []).map((a) => String(a || '').trim().toLowerCase()).filter(Boolean));
  const merged = [];
  (variantLibrary || []).forEach((row) => {
    const name = String(row?.name || '').trim().toLowerCase();
    if (!aliasSet.has(name)) return;
    if (Array.isArray(row?.values)) merged.push(...row.values);
  });
  return Array.from(new Set(merged.map((v) => String(v || '').trim()).filter(Boolean)));
}

export function mapSkuMetaToVariantFormFields(customFields = {}) {
  const skuMeta = customFields?.skuMeta && typeof customFields.skuMeta === 'object'
    ? customFields.skuMeta
    : {};
  return {
    variant: formScalarMeta(skuMeta.variant ?? customFields.variant),
    colorCode: formScalarMeta(skuMeta.color),
    sizeCode: formScalarMeta(skuMeta.size),
    packType: formScalarMeta(skuMeta.packType),
  };
}

export function buildSkuMetaFromFormValues(values = {}) {
  const skuMeta = {};
  const variant = normalizeOptionalTextArray(values.variant);
  const color = normalizeOptionalTextArray(values.colorCode);
  const size = normalizeOptionalTextArray(values.sizeCode);
  const packType = normalizeOptionalTextArray(values.packType);
  if (variant.length) skuMeta.variant = variant;
  if (color.length) skuMeta.color = color;
  if (size.length) skuMeta.size = size;
  if (packType.length) skuMeta.packType = packType;
  return Object.keys(skuMeta).length ? skuMeta : null;
}
