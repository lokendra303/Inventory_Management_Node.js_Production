const OFF_BASE =
  process.env.REACT_APP_OPENFOODFACTS_API_BASE
  || 'https://world.openfoodfacts.org/api/v2/product';

/**
 * Lookup product data from Open Food Facts by barcode or EAN.
 * Returns mapped fields compatible with the Items form, or null if not found.
 */
export const lookupProductByBarcode = async (barcode) => {
  if (!barcode || typeof barcode !== 'string' || !/^\d{4,14}$/.test(barcode.trim())) {
    throw new Error('Invalid barcode format. Must be 4–14 digits.');
  }

  const sanitized = barcode.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`${OFF_BASE}/${encodeURIComponent(sanitized)}.json`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) throw new Error(`API responded with status ${res.status}`);

    const data = await res.json();

    if (data.status !== 1 || !data.product) return null;

    const p = data.product;

    return {
      name: p.product_name_en || p.product_name || p.abbreviated_product_name || null,
      brand: p.brands?.split(',')[0]?.trim() || null,
      category: p.categories_tags?.[0]?.replace(/^en:/, '').replace(/-/g, ' ') || p.categories?.split(',')[0]?.trim() || null,
      weight: p.quantity || p.net_weight || null,
      image: p.image_front_url || p.image_url || null,
      ean: p.code || sanitized,
      manufacturer: p.manufacturer || p.manufacturing_places?.split(',')[0]?.trim() || null,
    };
  } finally {
    clearTimeout(timeout);
  }
};
