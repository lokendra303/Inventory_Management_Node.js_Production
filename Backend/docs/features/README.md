# Feature workflow documentation

Every user-facing feature should have a workflow doc in this folder before or alongside implementation.

## What to include

1. **Purpose** — one paragraph on the business problem.
2. **Prerequisites** — master data, flags, permissions.
3. **Database** — tables/columns touched.
4. **API** — base path, endpoints, request/response notes.
5. **Workflows** — step-by-step flow with mermaid diagrams where helpful.
6. **Backend / frontend file map** — paths to services, routes, pages.
7. **Validation rules** — errors users may hit.
8. **Related features** — links to other docs and `docs/WORKFLOW.md` sections.
9. **Out of scope / known gaps** — honest limits.

Also add a short cross-reference in `docs/WORKFLOW.md` under the relevant chapter.

## Index

| Feature | Doc |
|---------|-----|
| Batch / serial lifecycle | [batch-serial-lifecycle.md](./batch-serial-lifecycle.md) |
| Barcode scanning | [barcode-scanning.md](./barcode-scanning.md) |
| Price lists | [price-lists.md](./price-lists.md) |
| Institution settings | [institution-settings.md](./institution-settings.md) |
| Service accounts | [service-accounts.md](./service-accounts.md) |
| Units and measures | [units-and-measures.md](./units-and-measures.md) |
| Vendor pricing | [vendor-pricing.md](./vendor-pricing.md) |

System-wide flow map: [docs/WORKFLOW.md](../../docs/WORKFLOW.md)
