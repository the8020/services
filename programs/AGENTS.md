Parent DOX: [services DOX](../AGENTS.md).

# Purpose

- Expose service administration and the ordinary service-index hook program.

# Ownership

- Own manifests and thin entrypoints; `../src/` owns application policy, command
  parsing, and index construction.

# Local Contracts

- Configuration-changing commands use the shared Deno API and targeted kernel
  publication.
- Index-services receives per-package drafts and an immutable package selection;
  failures must preserve the last accepted kernel fragment.

# Work Guidance

# Verification

- From the repository root, run `deno task check` and `deno task test`.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
