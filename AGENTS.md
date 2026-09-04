# Purpose

- Own durable service declarations, operator overrides, immutable effective
  policy versions, and generic persistent execution routes.
- This file is the root contract of the independent `the8020/services`
  repository.

# Ownership

- Own authored schemas, administrative command programs, explicit overrides,
  effective service versions, and session-service route leases.
- Do not own runtime Worker telemetry, sandbox placement implementation,
  application sessions, or package Git activation.

# Local Contracts

- Effective policy resolves platform fallback, active package declaration, then
  explicit operator override.
- Package defaults and operator overrides remain distinguishable. Each serving
  Worker uses one immutable service-version snapshot.
- Persistent route records contain only a token hash and generic execution
  identity; raw route tokens are never stored.
- `cbus/commands/**/command.toml` maps visible `services.*` commands to
  non-discoverable ordinary programs whose default exports parse raw string
  arguments, report intentional input errors structurally, and call typed kernel
  service operations.

# Verification

- `deno task check` formats, lints, and type-checks all table modules.
- `deno task test` verifies structured policy fields and composite identities.

# Child DOX Index
