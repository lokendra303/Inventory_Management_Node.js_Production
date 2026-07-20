/**
 * Curated SI / common UOM conversion catalog for BOM stock conversion.
 * conversion_factor = how many base units equal 1 of this unit.
 *
 * Sources: SI brochure / NIST SP 811 style factors (metric) and common trade units.
 */

const STANDARD_FAMILIES = [
  {
    family: 'weight',
    base: {
      name: 'Grams',
      symbol: 'g',
      type: 'weight',
      aliases: ['g', 'gram', 'grams'],
    },
    units: [
      { name: 'Milligrams', symbol: 'mg', factor: 0.001, aliases: ['mg', 'milligram', 'milligrams'] },
      { name: 'Kilograms', symbol: 'kg', factor: 1000, aliases: ['kg', 'kilogram', 'kilograms'] },
      { name: 'Metric Tons', symbol: 't', factor: 1000000, aliases: ['t', 'tonne', 'tonnes', 'metric ton', 'metric tons'] },
      { name: 'Ounces', symbol: 'oz', factor: 28.349523125, aliases: ['oz', 'ounce', 'ounces'] },
      { name: 'Pounds', symbol: 'lb', factor: 453.59237, aliases: ['lb', 'lbs', 'pound', 'pounds'] },
    ],
  },
  {
    family: 'volume',
    base: {
      name: 'Millilitres',
      symbol: 'ml',
      type: 'volume',
      aliases: ['ml', 'ml.', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
    },
    units: [
      { name: 'Liters', symbol: 'L', factor: 1000, aliases: ['l', 'ltr', 'lt', 'liter', 'liters', 'litre', 'litres'] },
      { name: 'Cubic Metres', symbol: 'm³', factor: 1000000, aliases: ['m3', 'm³', 'cubic meter', 'cubic metre', 'cubic metres'] },
      { name: 'US Fluid Ounces', symbol: 'fl oz', factor: 29.5735295625, aliases: ['fl oz', 'floz', 'fluid ounce', 'fluid ounces'] },
      { name: 'US Gallons', symbol: 'gal', factor: 3785.411784, aliases: ['gal', 'gallon', 'gallons'] },
    ],
  },
  {
    family: 'length',
    base: {
      name: 'Millimetres',
      symbol: 'mm',
      type: 'length',
      aliases: ['mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters'],
    },
    units: [
      { name: 'Centimetres', symbol: 'cm', factor: 10, aliases: ['cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters'] },
      { name: 'Metres', symbol: 'm', factor: 1000, aliases: ['m', 'meter', 'meters', 'metre', 'metres'] },
      { name: 'Kilometres', symbol: 'km', factor: 1000000, aliases: ['km', 'kilometer', 'kilometers', 'kilometre', 'kilometres'] },
      { name: 'Inches', symbol: 'in', factor: 25.4, aliases: ['in', 'inch', 'inches', '"'] },
      { name: 'Feet', symbol: 'ft', factor: 304.8, aliases: ['ft', 'foot', 'feet'] },
    ],
  },
  {
    family: 'count',
    base: {
      name: 'Pieces',
      symbol: 'pcs',
      type: 'count',
      aliases: ['pcs', 'pc', 'piece', 'pieces', 'ea', 'each'],
    },
    units: [
      { name: 'Dozen', symbol: 'dz', factor: 12, aliases: ['dz', 'doz', 'dozen'] },
      { name: 'Gross', symbol: 'gr', factor: 144, aliases: ['gr', 'gross'] },
    ],
  },
];

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesAliases(unitRow, aliases = []) {
  const name = norm(unitRow.name);
  const symbol = norm(unitRow.symbol);
  return aliases.some((alias) => {
    const a = norm(alias);
    return a && (name === a || symbol === a);
  });
}

function findUnit(units, aliases) {
  return (units || []).find((u) => matchesAliases(u, aliases)) || null;
}

function getStandardCatalog() {
  return STANDARD_FAMILIES.map((family) => ({
    family: family.family,
    base: {
      name: family.base.name,
      symbol: family.base.symbol,
      type: family.base.type,
      conversion_factor: 1,
      is_base: true,
    },
    units: family.units.map((u) => ({
      name: u.name,
      symbol: u.symbol,
      type: family.base.type,
      conversion_factor: u.factor,
      base_symbol: family.base.symbol,
      formula: `1 ${u.symbol} = ${u.factor} ${family.base.symbol}`,
    })),
  }));
}

/**
 * Ensure standard units exist and link conversion factors for an institution.
 * @param {object} db - database connection with .query
 * @param {string} institutionId
 * @param {{ createMissing?: boolean, updateExisting?: boolean }} options
 */
async function applyStandardConversions(db, institutionId, options = {}) {
  const { v4: uuidv4 } = require('uuid');
  const createMissing = options.createMissing !== false;
  const updateExisting = options.updateExisting === true;

  const existing = await db.query(
    'SELECT * FROM units WHERE institution_id = ? AND status = ?',
    [institutionId, 'active']
  );

  const created = [];
  const updated = [];
  const skipped = [];
  let working = [...existing];

  const ensureUnit = async ({ name, symbol, type, aliases }) => {
    let row = findUnit(working, aliases);
    if (row) return row;
    if (!createMissing) return null;

    const id = uuidv4();
    const safeSymbol = String(symbol).trim().slice(0, 20);
    await db.query(
      `INSERT INTO units (id, institution_id, name, symbol, type, base_unit_id, conversion_factor, status)
       VALUES (?, ?, ?, ?, ?, NULL, 1, 'active')`,
      [id, institutionId, name, safeSymbol, type || 'other']
    );
    row = {
      id,
      institution_id: institutionId,
      name,
      symbol: safeSymbol,
      type: type || 'other',
      base_unit_id: null,
      conversion_factor: 1,
      status: 'active',
    };
    working.push(row);
    created.push({ id, name, symbol: safeSymbol, type });
    return row;
  };

  for (const family of STANDARD_FAMILIES) {
    const baseRow = await ensureUnit(family.base);
    if (!baseRow) {
      skipped.push({ family: family.family, reason: `Missing base ${family.base.symbol}` });
      continue;
    }

    // Ensure base is a true base
    const baseNeedsReset = baseRow.base_unit_id
      || Number(baseRow.conversion_factor) !== 1
      || (family.base.type && baseRow.type !== family.base.type);
    if (baseNeedsReset && (updateExisting || !baseRow.base_unit_id)) {
      await db.query(
        `UPDATE units SET base_unit_id = NULL, conversion_factor = 1, type = ?
         WHERE id = ? AND institution_id = ?`,
        [family.base.type, baseRow.id, institutionId]
      );
      baseRow.base_unit_id = null;
      baseRow.conversion_factor = 1;
      baseRow.type = family.base.type;
      updated.push({ id: baseRow.id, name: baseRow.name, role: 'base' });
    }

    for (const unitDef of family.units) {
      const child = await ensureUnit({
        name: unitDef.name,
        symbol: unitDef.symbol,
        type: family.base.type,
        aliases: unitDef.aliases,
      });
      if (!child) continue;

      const linkedOk = String(child.base_unit_id || '') === String(baseRow.id)
        && Number(child.conversion_factor) === Number(unitDef.factor);
      if (linkedOk) {
        skipped.push({ name: child.name, reason: 'already linked' });
        continue;
      }

      const isDefaultLink = !child.base_unit_id
        && (child.conversion_factor == null || Number(child.conversion_factor) === 1);
      if (!isDefaultLink && !updateExisting) {
        skipped.push({ name: child.name, reason: 'custom link preserved' });
        continue;
      }

      await db.query(
        `UPDATE units SET base_unit_id = ?, conversion_factor = ?, type = ?
         WHERE id = ? AND institution_id = ?`,
        [baseRow.id, unitDef.factor, family.base.type, child.id, institutionId]
      );
      child.base_unit_id = baseRow.id;
      child.conversion_factor = unitDef.factor;
      child.type = family.base.type;
      updated.push({
        id: child.id,
        name: child.name,
        formula: `1 ${child.symbol} = ${unitDef.factor} ${baseRow.symbol}`,
      });
    }
  }

  const units = await db.query(
    'SELECT * FROM units WHERE institution_id = ? AND status = ? ORDER BY type, name',
    [institutionId, 'active']
  );

  return {
    created,
    updated,
    skipped,
    units,
    catalogVersion: 'si-common-2026.07',
    source: 'SI / NIST-style standard factors (server catalog)',
  };
}

module.exports = {
  STANDARD_FAMILIES,
  getStandardCatalog,
  applyStandardConversions,
  findUnit,
  matchesAliases,
};
