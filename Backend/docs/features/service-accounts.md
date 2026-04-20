# Service accounts

## Purpose

Machine-to-machine access for an institution using JWTs scoped with a permission map (alternative to interactive user tokens). Used by `auth.middleware` when `type === 'service_account'`.

## Intended API base path

`/api/service-accounts` (as documented in `serviceAccount.routes.js` comments).

## Backend files

- `Backend/src/modules/auth/serviceAccount.routes.js`
- `Backend/src/modules/auth/serviceAccount.service.js`
- `Backend/src/modules/auth/auth.middleware.js` (verification branch)

## Implementation note

`server.js` mounts `auth.routes.js` at `/api/auth` only. **`serviceAccount.routes` is not attached** on the main API router today. To manage service accounts over HTTP, add `router.use('/service-accounts', require('../modules/auth/serviceAccount.routes'))` (with the same auth middleware stack as other protected routes) in `routes/api.js`, or an equivalent mount.

## Frontend

No dedicated SPA page was identified in the initial inventory; management may be API-only or planned.
