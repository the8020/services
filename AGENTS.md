Parent DOX: [8020 workspace](../AGENTS.md).

Framework source:
[agent0ai/dox/AGENTS.md](https://github.com/agent0ai/dox/blob/765ae4ac02cc884eefcd41a3d0f71941721adb89/AGENTS.md).

# DOX framework

- DOX is highly performant AGENTS.md hierarchy installed here
- Agent must follow DOX instructions across any edits

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable
  docs must stay understandable from the nearest applicable AGENTS.md plus every
  parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path,
   read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide
   rules
7. If docs conflict, the closer doc controls local work details, but no child
   doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session
before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or
  quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child
index changes. Update child docs when parent changes alter local rules. Remove
stale or contradictory text immediately. Small edits that do not change behavior
or contracts may leave docs unchanged, but the DOX pass still must happen.

## Hierarchy

- Root AGENTS.md is the DOX rail: project-wide instructions, global preferences,
  durable workflow rules, and the top-level Child DOX Index
- Child AGENTS.md files own domain-specific instructions and their own Child DOX
  Index
- Each parent explains what its direct children cover and what stays owned by
  the parent
- The closer a doc is to the work, the more specific and practical it must be

## Child Doc Shape

- Create a child AGENTS.md when a folder becomes a durable boundary with its own
  purpose, rules, responsibilities, workflow, materials, or quality standards
- Work Guidance must reflect the current standards of the project or user
  instructions; if there are no specific standards or instructions yet, leave it
  empty
- Verification must reflect an existing check; if no verification framework
  exists yet, leave it empty and update it when one exists

Default section order:

- Purpose
- Ownership
- Local Contracts
- Work Guidance
- Verification
- Child DOX Index

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Do not duplicate rules across many files unless each scope needs a local
  version
- Delete stale notes instead of explaining history
- Trim obvious statements, repeated rules, misplaced detail, and warnings for
  risks that no longer exist

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant
6. Report any docs intentionally left unchanged and why

## User Preferences

When the user requests a durable behavior change, record it here or in the
relevant child AGENTS.md

## Child DOX Index

This root retains repository-wide contracts and files outside the child scopes
below.

- [cbus/AGENTS.md](cbus/AGENTS.md): Declare the public `services.*`
  administrative commands.
- [hooks/AGENTS.md](hooks/AGENTS.md): Register the package-owned service-index
  construction hook.
- [programs/AGENTS.md](programs/AGENTS.md): Expose service administration and
  the ordinary service-index hook program.
- [src/AGENTS.md](src/AGENTS.md): Own service declaration resolution,
  configuration mutations, defaults, and package indexing.
- [tables/AGENTS.md](tables/AGENTS.md): Describe service declarations, operator
  overrides, and immutable effective versions.
- [types/AGENTS.md](types/AGENTS.md): Share service references with searchable
  value help, service metadata, and reusable configuration fields.

# Purpose

- Own Deno service configuration for the independent `the8020/services` package.

# Ownership

- Read service declarations, resolve application defaults and explicit operator
  overrides, store desired configuration and immutable effective versions, and
  implement administrative commands.
- Produce fully resolved runtime specifications through `index-services`. The
  kernel validates/publishes them and owns admission, cryptography, placement,
  Workers, execution, and observed runtime status.
- Do not own persistent route storage or execution lifetime. Signed routing
  tokens identify exact targets; supervisors own their live bindings.

# Local Contracts

- Shared `src/admin.ts` mutations require `services.service.edit` or
  `services.service.restart` against the canonical service ID. `setDefault`
  requires `services.defaults.edit` against the default name. Both command and
  UUI paths use these owners; `declarations/auth.toml` describes the actions.

- `src/configuration.ts` owns declaration parsing, validation, and resolution.
  Precedence is package fallback, configured platform default, active
  declaration, then explicit operator override. A service version captures its
  resolved policy.
- Visibility is an operator override using `public` or `authenticated`. It
  inherits the declaration when unset and retains the declaration's
  unauthenticated reject/redirect behavior. Publication and version snapshots
  include the resolved visibility.
- `lifecycle.session_keep_alive = "0s"` retains a session execution until
  explicit completion or destruction of its owner. Positive values are at least
  one millisecond. Omission retains the ten-minute default; Worker keepalive
  remains positive and independent.
- `src/defaults.ts` owns service defaults stored under the existing
  `services.default_*` keys in system settings. They are application settings,
  never Go setting definitions, validation, or environment inputs.
- `src/indexing.ts` discovers services for the complete selected package set in
  one invocation, updating declaration/version rows in a transaction per
  package. Package failures are explicit result errors and do not block healthy
  packages. Retired/removed packages produce empty fragments without deleting
  operator overrides.
- Source-only package commit changes refresh declaration diagnostics without
  advancing immutable policy versions. Observed imports and generic kernel
  restart revisions drive code replacement independently of configuration.
- `hooks/index-services.toml` selects an ordinary program. The kernel runs the
  complete ordered handler chain once as one system job with normal mounts and
  permissions. Every handler receives the same mutable `state.packages` drafts
  and a separate frozen `scope.packages` selection with package IDs, commits,
  and active flags. Handlers may enhance or filter those drafts.
- A failed handler retains all selected accepted fragments. A package error or
  invalid final specification retains only that package's accepted fragment. A
  successful fragment atomically replaces its package, including removal of
  omitted services. Other fragments keep serving.
- Configuration mutations lock and advance generic package-index revisions in
  the same transaction through `the8020/system/src/indexes.ts`, then call
  `kernel.reindex` for the affected packages. Missed notifications catch up from
  those revisions. There is one durable configuration source and one derived
  in-memory kernel index, with no Go service-table poller or alternate editor.
- Public services use their configured execution principal, default `system`.
  Principals are structural kernel identities; account rows and login policy
  belong to users and never govern job/service execution eligibility.
- Flat `cbus/commands/*.toml` declarations contain complete `services.*` names
  and full `namespace/package/program` IDs. Start/stop/scale/defaults persist
  application configuration in Deno and trigger targeted publication.
  `services.restart` calls `kernel.services.restart` with soft mode by default
  and hard mode for `--hard`, preserving the enabled policy. Kernel operations
  also supply observed list/inspect/refresh and runtime validation, request, and
  OpenAPI primitives. UUI administration imports the same `src/admin.ts`
  mutation functions within its current Worker.
- Local package commands use the ordinary system job runtime and remain usable
  when HTTP services or authentication are broken, provided the database and
  execution runtime work. Publication errors report whether desired settings
  were saved. No emergency Go override store or special sandbox exists.
- Removing the former routes table declaration follows normal schema retirement:
  activation retires its catalog entry and retains physical data until explicit
  confirmed trim. Never delete deployed tables through ad hoc cleanup.

# Work Guidance

- Keep declarations, defaults, operator policy, and effective versions in this
  standalone Deno package. New application behavior uses ordinary services and
  programs; touch the kernel only when a generic execution foundation is
  missing.
- Reuse one configuration mutation path and publish bounded, package-targeted
  fragments from transactional revisions. Preserve accepted runtime state on
  publication failure and verify policy and runtime behavior at their respective
  owners.

# Verification

- `deno task check` formats, lints, and type-checks schemas and programs.
- `deno task test` covers policy resolution, table contracts, and transactional
  package indexing. Kernel tests own publication/failure and runtime routing.
