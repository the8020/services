Parent DOX: [services DOX](../AGENTS.md).

# Purpose

- Own service declaration resolution, configuration mutations, defaults, and
  package indexing.

# Ownership

- Own `configuration.ts`, `defaults.ts`, `indexing.ts`, `admin.ts`, command
  helpers, and colocated tests.

# Local Contracts

- Resolve package fallback, platform defaults, declaration, then explicit
  operator overrides; effective versions are immutable.
- Session keepalive accepts zero for explicit-completion lifetime and positive
  durations of at least one millisecond. Declaration, defaults, and operator
  overrides share this validation. Worker keepalive remains strictly positive.
- Advance generic package-index revisions in the same transaction as desired
  changes, then reindex affected packages.
- Kernel routing consumes validated fragments and owns execution; it never reads
  application service tables or TOML.

# Work Guidance

- Add service policy here through the existing resolution and mutation
  contracts, keeping unrelated application features in their own packages.
  Validate before publishing and preserve the distinction between saved desired
  state and accepted runtime state.

- Keep publication package-targeted and use the same mutation API from command
  programs and UUI administration.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
