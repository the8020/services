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
- `resolveAccess` applies and validates visibility overrides while retaining the
  declaration's unauthenticated reject/redirect policy. Mutations and indexing
  share it; policy hashes include resolved visibility and configuration.
- Package commit changes alone update source diagnostics without adding policy
  versions. Manual restart delegates to `kernel.services.restart`; `--hard`
  requests immediate termination of active and draining generations. Neither
  mode writes overrides, enables disabled services, or fabricates a policy edit.
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

- Index the selected packages in one invocation with one transaction and result
  per package. Preserve explicit errors without discarding healthy drafts.
- Keep publication package-targeted and use the same mutation API from command
  programs and UUI administration.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
