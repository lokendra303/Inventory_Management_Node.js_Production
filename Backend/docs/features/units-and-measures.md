# Units and measures

## Purpose

Define units of measure (each, kg, box, etc.) used by items, PO/SO lines, and inventory quantities.

## API base path

`/api/units`

## Backend files

- `Backend/src/modules/master-data/units.routes.js`
- `Backend/src/modules/master-data/units.controller.js`

## Frontend

- `Frontend/src/services/masterDataService.js` (often loads units with other lookups)

## Permissions

See `units.routes.js` for required permissions on mutating operations.
