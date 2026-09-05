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
- Advance generic package-index revisions in the same transaction as desired
  changes, then reindex affected packages.
- Kernel routing consumes validated fragments and owns execution; it never reads
  application service tables or TOML.

# Work Guidance

- Keep publication package-targeted and use the same mutation API from command
  programs and UUI administration.

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
