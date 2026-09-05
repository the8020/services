Parent DOX: [services DOX](../AGENTS.md).

# Purpose

- Register the package-owned service-index construction hook.

# Ownership

- Own `index-services.toml`; `../programs/index-services/` and
  `../src/indexing.ts` own execution.

# Local Contracts

- The handler runs in the complete ordered index-services chain as one ordinary
  system job.
- Receive shared mutable draft state and a separate frozen owning-package/commit
  scope.

# Work Guidance

# Verification

- Kernel package handler-index tests verify declaration contracts; run
  `go test ./kernel/packages/...` from the sibling kernel repository with its
  local Go environment.
- Run this package's `deno task check` for the referenced handler programs.

# Child DOX Index

No child DOX documents. This document owns the entire local scope.
