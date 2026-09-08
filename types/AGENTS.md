Parent DOX: [services DOX](../AGENTS.md).

# Purpose

- Own reusable service references, observed metadata, and configuration fields
  for tables, forms, and lists.

# Ownership

- `service.ts` defines `serviceId`, `serviceInfo`, and `serviceSettings`.
  Configuration resolution and mutations stay in `src/`.

# Local Contracts

- Policy fields own labels, help, and scalar constraints; sandbox grouping
  reuses the admin-core runtime field shared with Jobs. UUI keeps sliders,
  visibility, and read-only settings local. Target utilization in the form is
  explicitly a percentage; durable configuration retains its fraction. Text
  duration fields retain duration notation; durable rows retain milliseconds.
- Observed service type and access fields accept incomplete inspection text; the
  editable service type and stored declaration use the validated enum.
- Lookup exposes service ID, description, and enabled fields, with ID first. The
  shared SQL lookup applies full list queries before paging and returns the
  matching count. Only active declarations appear; disabled services remain
  selectable.
- Open calls the selected service's public administration program. Load database
  and UUI dependencies only when the callback runs.

# Work Guidance

# Verification

- Run `deno task check` and `deno task test` from the repository root.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
