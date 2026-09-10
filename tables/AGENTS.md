Parent DOX: [services DOX](../AGENTS.md).

# Purpose

- Describe service declarations, operator overrides, and immutable effective
  versions.

# Ownership

- Own `services.ts`, `overrides.ts`, and `versions.ts` and their descriptor
  tests; physical schema deployment remains kernel-owned.

# Local Contracts

- Default-export authored table descriptors through `/p/the8020/db/mod.ts`;
  table identity follows the package and file path.
- Service, package, and execution-principal columns reuse their owning semantic
  Zod fields through `t.from`; table-local keys and nullability stay explicit.
- Shared service policy counts, grouping, lifecycle type, descriptions, and
  versions reuse `types/service.ts`; source commits/entrypoints reuse package
  fields. Durations in milliseconds and fractional utilization retain their
  existing physical representations.
- Retired or removed declarations do not erase operator overrides.
- `accessMode` in declarations, nullable overrides, and version snapshots reuses
  the shared visibility field. Null overrides inherit the declaration; null
  version values identify older snapshots that did not record access mode.
- Normal activation retires removed schemas; physical removal remains an
  explicit confirmed trim.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
