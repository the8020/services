Parent DOX: [services DOX](../AGENTS.md).

# Purpose

- Ship the package-owned Hono dependency as a single-file bundle.

# Ownership

- `hono.ts` pins the upstream entrypoint and supplies original types through
  `@deno-types`. Its generated `.js` bundle and upstream license notice ship
  with this package.

# Local Contracts

- `../http.ts` consumes this bundle. Bundle only the external library; keep
  application source as ordinary modules.
- Regenerate and commit JavaScript when changing the pin. Preserve upstream
  exports and names; do not edit generated files.

# Work Guidance

# Verification

- Run `deno task bundle`, `deno task check`, and `deno task test` from the
  package root.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
