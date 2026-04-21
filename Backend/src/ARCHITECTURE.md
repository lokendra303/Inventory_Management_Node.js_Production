# Enterprise Modular Monolith Structure

## Layered Structure

- `core/`
  - Cross-cutting HTTP concerns (`error`, `response`, `async handler`)
  - Module composition root (`moduleRegistry`)
- `modules/`
  - Domain modules with route/controller/service separation
- `shared/`
  - Reusable infrastructure helpers (file storage, utilities shared by modules)
- `middleware/`
  - App-level middleware for auth, subscriptions, auditing
- `database/`
  - Connection and transaction abstraction

## Rules

1. Route -> Controller -> Service -> Repository/DB
2. No SQL in route files
3. No direct `res.status(...).json(...)` duplication for common patterns; use shared response helpers
4. Throw `ApiError` for expected domain failures
5. Centralized error middleware is the single error response boundary
6. File-storage path resolution and move/delete operations use `shared/storage/fileStorage.js`

## Migration Path

1. New features must follow the structure above.
2. Existing modules are migrated module-by-module without breaking endpoint contracts.
3. Start with high-churn modules first: `documents`, `settings`, `inventory`.
