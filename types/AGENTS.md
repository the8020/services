Parent DOX: [services DOX](../AGENTS.md).

# Purpose

- Own reusable service references for tables, forms, and lists.

# Ownership

- `service.ts` defines the semantic Zod `serviceId` field.

# Local Contracts

- Lookup searches active declarations by ID or description, with database paging
  and one-row lookahead. Disabled services remain selectable.
- Open calls the selected service's public administration program. Load database
  and UUI dependencies only when the callback runs.

# Work Guidance

# Verification

- Run `deno task check` and `deno task test` from the repository root.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
