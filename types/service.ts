import { msg } from "/p/the8020/services/i18n/messages.ts";
import { runtimeInfo } from "/p/the8020/admin-core/types/runtime.ts";
import { username } from "/p/the8020/users/types/user.ts";
import { choiceHelp, field, z } from "/p/the8020/db/fields.ts";

export const serviceId: z.ZodString = field(z.string(), {
  label: msg("service.service"),
  description: msg("service.open_a_service_to_see_its_health"),
  valueHelp: async (request) => {
    const { default: Services } = await import("../tables/services.ts");
    const { lookupPage } = await import("/p/the8020/db/lookup.ts");
    return lookupPage(
      z.object({
        serviceId,
        description: serviceInfo.shape.description,
        enabled: serviceInfo.shape.enabled,
      }),
      Services.select([
        Services.serviceId,
        Services.description,
        Services.enabled,
      ]).where(Services.active, "=", true),
      request,
    );
  },
  open: async (value) => {
    const { default: services } = await import(
      "/p/the8020/admin-core/programs/services/program.ts"
    );
    await services(value);
  },
});

export const serviceInfo = z.object({
  serviceType: field(z.string(), {
    label: msg("service.service_type"),
    description: msg(
      "service.the_declared_service_lifecycle_stateless_for_independent",
    ),
    valueHelp: choiceHelp(z.string(), ["stateless", "session"]),
  }),
  description: field(z.string(), {
    label: msg("service.description"),
    description: msg("service.what_this_service_provides_to_callers"),
  }),
  state: field(z.string(), {
    label: msg("service.status"),
    description: msg("service.the_observed_service_health_an_idle_service"),
    valueHelp: choiceHelp(z.string(), [
      "DISCOVERED",
      "DISABLED",
      "IDLE",
      "PENDING_CAPACITY",
      "STARTING",
      "READY",
      "DEGRADED",
      "RESTARTING",
      "DRAINING",
      "STOPPED",
      "FAILED",
    ]),
  }),
  path: field(z.string(), {
    label: msg("service.address"),
    description: msg("service.the_address_at_which_callers_reach_this"),
  }),
  enabled: field(z.boolean(), {
    label: msg("service.enabled"),
    description: msg("service.allow_this_service_to_accept_work_disabling"),
  }),
  accessMode: field(z.string(), {
    label: msg("service.access"),
    description: msg(
      "service.public_services_allow_unauthenticated_requests_authenticated_services",
    ),
    valueHelp: choiceHelp(z.string(), ["public", "authenticated"]),
  }),
  versionCount: field(z.number().int(), {
    label: msg("service.live_versions"),
    description: msg(
      "service.number_of_service_versions_still_running_including",
    ),
  }),
  desiredVersion: field(z.number().int(), {
    label: msg("service.desired_version"),
    description: msg(
      "service.the_service_configuration_version_requested_by_the",
    ),
  }),
  loadedVersion: field(z.number().int(), {
    label: msg("service.loaded_version"),
    description: msg(
      "service.the_service_configuration_version_currently_loaded_on",
    ),
  }),
  version: field(z.number().int(), {
    label: msg("service.version"),
    description: msg(
      "service.the_service_configuration_version_associated_with_this",
    ),
  }),
});

export const serviceSettings = z.object({
  accessMode: field(z.enum(["public", "authenticated"]), {
    label: msg("service.visibility"),
    description: msg(
      "service.public_allows_unauthenticated_requests_private_requires_a",
    ),
  }),
  anonymousUser: field(username, {
    label: msg("service.public_execution_user"),
    description: msg(
      "service.runs_unauthenticated_requests_with_this_identity_enter",
    ),
  }),
  minimumWorkers: field(z.number().int().nonnegative(), {
    label: msg("service.minimum_workers"),
    description: msg("service.keep_this_many_workers_ready_0_allows"),
  }),
  maximumWorkers: field(z.number().int().nonnegative(), {
    label: msg("service.maximum_workers"),
    description: msg("service.limit_the_number_of_workers_this_service"),
  }),
  concurrencyPerWorker: field(z.number().int().positive(), {
    label: msg("service.requests_per_worker"),
    description: msg(
      "service.maximum_number_of_concurrent_requests_handled_by",
    ),
  }),
  targetUtilizationPercent: field(z.number().min(1).max(100), {
    label: msg("service.target_utilization"),
    description: msg(
      "service.target_percentage_of_occupied_request_slots_used",
    ),
  }),
  workerKeepAlive: field(z.string().min(1), {
    label: msg("service.idle_worker_timeout"),
    description: msg("service.how_long_an_excess_idle_worker_stays"),
  }),
  sandboxGroup: runtimeInfo.shape.sandboxGroup,
  minimumSandboxes: field(z.number().int().nonnegative(), {
    label: msg("service.minimum_sandboxes"),
    description: msg("service.keep_this_many_compatible_sandboxes_ready_even"),
  }),
  workersPerSandbox: field(z.number().int().positive(), {
    label: msg("service.workers_per_sandbox"),
    description: msg("service.maximum_number_of_this_service_s_workers"),
  }),
  serviceType: field(z.enum(["stateless", "session"]), {
    label: msg("service.service_type"),
    description: msg(
      "service.stateless_services_handle_independent_requests_session_services",
    ),
  }),
  sessionKeepAlive: field(z.string().min(1), {
    label: msg("service.idle_session_timeout"),
    description: msg("service.how_long_an_inactive_session_stays_available"),
  }),
});
