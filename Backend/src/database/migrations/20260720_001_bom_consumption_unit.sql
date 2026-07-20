-- BOM line consumption UOM (qty may be in g while item stock is in kg, etc.)
ALTER TABLE `composite_components`
  ADD COLUMN `consumption_unit_id` varchar(36) DEFAULT NULL AFTER `quantity_required`;

ALTER TABLE `composite_components`
  ADD KEY `idx_cc_consumption_unit` (`consumption_unit_id`);

ALTER TABLE `composite_components`
  ADD CONSTRAINT `fk_cc_consumption_unit`
    FOREIGN KEY (`consumption_unit_id`) REFERENCES `units` (`id`) ON DELETE SET NULL;

-- Link standard metric pairs per institution (only untouched defaults).
-- Weight: Grams = base; Kilograms = 1000 g
UPDATE units child
  INNER JOIN units base
    ON base.institution_id = child.institution_id
   AND base.status = 'active'
   AND (
     LOWER(TRIM(base.symbol)) IN ('g')
     OR LOWER(TRIM(base.name)) IN ('g', 'gram', 'grams')
   )
   AND (base.base_unit_id IS NULL OR base.base_unit_id = '')
SET child.base_unit_id = base.id,
    child.conversion_factor = 1000,
    child.type = COALESCE(NULLIF(child.type, ''), 'weight')
WHERE child.status = 'active'
  AND (child.base_unit_id IS NULL OR child.base_unit_id = '')
  AND (child.conversion_factor IS NULL OR child.conversion_factor = 1)
  AND (
    LOWER(TRIM(child.symbol)) IN ('kg')
    OR LOWER(TRIM(child.name)) IN ('kg', 'kilogram', 'kilograms')
  )
  AND child.id <> base.id;

UPDATE units
SET type = COALESCE(NULLIF(type, ''), 'weight')
WHERE status = 'active'
  AND (base_unit_id IS NULL OR base_unit_id = '')
  AND (
    LOWER(TRIM(symbol)) IN ('g')
    OR LOWER(TRIM(name)) IN ('g', 'gram', 'grams')
  );

-- Volume: Millilitres = base; Liters = 1000 ml
UPDATE units child
  INNER JOIN units base
    ON base.institution_id = child.institution_id
   AND base.status = 'active'
   AND (
     LOWER(TRIM(base.symbol)) IN ('ml', 'ml.')
     OR LOWER(TRIM(base.name)) IN ('ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters')
   )
   AND (base.base_unit_id IS NULL OR base.base_unit_id = '')
SET child.base_unit_id = base.id,
    child.conversion_factor = 1000,
    child.type = COALESCE(NULLIF(child.type, ''), 'volume')
WHERE child.status = 'active'
  AND (child.base_unit_id IS NULL OR child.base_unit_id = '')
  AND (child.conversion_factor IS NULL OR child.conversion_factor = 1)
  AND (
    LOWER(TRIM(child.symbol)) IN ('l', 'ltr', 'lt')
    OR LOWER(TRIM(child.name)) IN ('l', 'liter', 'liters', 'litre', 'litres')
  )
  AND child.id <> base.id;

UPDATE units
SET type = COALESCE(NULLIF(type, ''), 'volume')
WHERE status = 'active'
  AND (base_unit_id IS NULL OR base_unit_id = '')
  AND (
    LOWER(TRIM(symbol)) IN ('ml', 'ml.')
    OR LOWER(TRIM(name)) IN ('ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters')
  );

-- Length: Millimetres = base; Centimetres = 10 mm; Metres = 1000 mm
UPDATE units child
  INNER JOIN units base
    ON base.institution_id = child.institution_id
   AND base.status = 'active'
   AND (
     LOWER(TRIM(base.symbol)) IN ('mm')
     OR LOWER(TRIM(base.name)) IN ('mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters')
   )
   AND (base.base_unit_id IS NULL OR base.base_unit_id = '')
SET child.base_unit_id = base.id,
    child.conversion_factor = 10,
    child.type = COALESCE(NULLIF(child.type, ''), 'length')
WHERE child.status = 'active'
  AND (child.base_unit_id IS NULL OR child.base_unit_id = '')
  AND (child.conversion_factor IS NULL OR child.conversion_factor = 1)
  AND (
    LOWER(TRIM(child.symbol)) IN ('cm')
    OR LOWER(TRIM(child.name)) IN ('cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters')
  )
  AND child.id <> base.id;

UPDATE units child
  INNER JOIN units base
    ON base.institution_id = child.institution_id
   AND base.status = 'active'
   AND (
     LOWER(TRIM(base.symbol)) IN ('mm')
     OR LOWER(TRIM(base.name)) IN ('mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters')
   )
   AND (base.base_unit_id IS NULL OR base.base_unit_id = '')
SET child.base_unit_id = base.id,
    child.conversion_factor = 1000,
    child.type = COALESCE(NULLIF(child.type, ''), 'length')
WHERE child.status = 'active'
  AND (child.base_unit_id IS NULL OR child.base_unit_id = '')
  AND (child.conversion_factor IS NULL OR child.conversion_factor = 1)
  AND (
    LOWER(TRIM(child.symbol)) IN ('m')
    OR LOWER(TRIM(child.name)) IN ('m', 'meter', 'meters', 'metre', 'metres')
  )
  AND child.id <> base.id;

UPDATE units
SET type = COALESCE(NULLIF(type, ''), 'length')
WHERE status = 'active'
  AND (base_unit_id IS NULL OR base_unit_id = '')
  AND (
    LOWER(TRIM(symbol)) IN ('mm')
    OR LOWER(TRIM(name)) IN ('mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters')
  );
