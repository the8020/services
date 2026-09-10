import { runtimeInfo } from "/p/the8020/admin-core/types/runtime.ts";
import { username } from "/p/the8020/users/types/user.ts";
import { choiceHelp, field, z } from "/p/the8020/db/fields.ts";

export const serviceId: z.ZodString = field(z.string(), {
  label: "Service",
  description:
    "Open a service to see its health, running capacity, and settings.",
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
    label: "Service type",
    description:
      "The declared service lifecycle: stateless for independent requests or session for a retained execution. An empty value indicates an unavailable declaration.",
    valueHelp: choiceHelp(z.string(), ["stateless", "session"]),
  }),
  description: field(z.string(), {
    label: "Description",
    description: "What this service provides to callers.",
  }),
  state: field(z.string(), {
    label: "Status",
    description:
      "The observed service health. An idle service can start Workers when requests arrive.",
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
    label: "Address",
    description: "The address at which callers reach this service.",
  }),
  enabled: field(z.boolean(), {
    label: "Enabled",
    description:
      "Allow this service to accept work. Disabling stops new work and drains running work.",
  }),
  accessMode: field(z.string(), {
    label: "Access",
    description:
      "Public services allow unauthenticated requests; authenticated services require a signed-in user.",
    valueHelp: choiceHelp(z.string(), ["public", "authenticated"]),
  }),
  versionCount: field(z.number().int(), {
    label: "Live versions",
    description:
      "Number of service versions still running, including versions draining older work.",
  }),
  desiredVersion: field(z.number().int(), {
    label: "Desired version",
    description:
      "The service configuration version requested by the current settings.",
  }),
  loadedVersion: field(z.number().int(), {
    label: "Loaded version",
    description:
      "The service configuration version currently loaded on this node.",
  }),
  version: field(z.number().int(), {
    label: "Version",
    description:
      "The service configuration version associated with this running capacity.",
  }),
});

export const serviceSettings = z.object({
  anonymousUser: field(username, {
    label: "Public execution user",
    description:
      "Runs unauthenticated requests with this identity. Enter an identity directly or choose an account; account sign-in settings do not limit service execution.",
  }),
  minimumWorkers: field(z.number().int().nonnegative(), {
    label: "Minimum Workers",
    description:
      "Keep this many Workers ready. **0** allows idle Workers to stop and start again when needed.",
  }),
  maximumWorkers: field(z.number().int().nonnegative(), {
    label: "Maximum Workers",
    description:
      "Limit the number of Workers this service may start. **0** means no service limit; available resources still limit capacity.",
  }),
  concurrencyPerWorker: field(z.number().int().positive(), {
    label: "Requests per Worker",
    description: "Maximum number of concurrent requests handled by one Worker.",
  }),
  targetUtilizationPercent: field(z.number().min(1).max(100), {
    label: "Target utilization",
    description:
      "Target percentage of occupied request slots used when scaling Workers. A lower target keeps more spare capacity.",
  }),
  workerKeepAlive: field(z.string().min(1), {
    label: "Idle Worker timeout",
    description:
      "How long an excess idle Worker stays ready. Use a positive duration such as `30s`, `5m`, or `1h`.",
  }),
  sandboxGroup: runtimeInfo.shape.sandboxGroup,
  minimumSandboxes: field(z.number().int().nonnegative(), {
    label: "Minimum sandboxes",
    description:
      "Keep this many compatible sandboxes ready even with zero Workers.",
  }),
  workersPerSandbox: field(z.number().int().positive(), {
    label: "Workers per sandbox",
    description:
      "Maximum number of this service's Workers placed in one sandbox.",
  }),
  serviceType: field(z.enum(["stateless", "session"]), {
    label: "Service type",
    description:
      "Stateless services handle independent requests. Session services retain an execution across requests until it ends or times out.",
  }),
  sessionKeepAlive: field(z.string().min(1), {
    label: "Idle session timeout",
    description:
      "How long an inactive session stays available, for example `30m` or `2h`. **0s** keeps it until it ends or its environment is stopped.",
  }),
});
