import { assertEquals, assertThrows } from "@std/assert";
import {
  declaration,
  duration,
  resolveAccess,
  resolveConfiguration,
} from "./configuration.ts";

Deno.test("service declarations and operator overrides resolve in Deno", () => {
  const source = `schema = 2
description = "Requests"
[lifecycle]
default_enabled = true
service_type = "session"
session_keep_alive = "5m"
[scaling]
minimum_workers = 2
maximum_workers = 4
concurrency_per_worker = 3
[execution]
anonymous_user = "worker1"
[access]
mode = "authenticated"
[access.unauthenticated]
action = "redirect"
redirect_url = "/login"
`;
  const manifest = declaration(source);
  const value = resolveConfiguration(manifest, {
    maximumWorkers: 8,
    anonymousUser: "system",
    minimumWorkers: null,
  });
  assertEquals(value.scaling.minimum_workers, 2);
  assertEquals(value.scaling.maximum_workers, 8);
  assertEquals(value.scaling.concurrency_per_worker, 3);
  assertEquals(value.scaling.target_utilization, 0.7);
  assertEquals(value.execution.anonymous_user, "system");
  assertEquals(value.lifecycle.session_keep_alive, 300_000_000_000);
  assertEquals(value.placement.workers_per_sandbox, 4);
  assertEquals(manifest.access.unauthenticated.status, 302);
  assertEquals(manifest.defaultEnabled, true);
  assertEquals(manifest.declared.anonymousUser, "worker1");
  for (
    const accessMode of [undefined, null, "public", "authenticated"] as const
  ) {
    assertEquals(resolveAccess(manifest, { accessMode }), {
      ...manifest.access,
      mode: accessMode ?? "authenticated",
    });
  }
  assertEquals(manifest.access.mode, "authenticated");
  assertThrows(
    () => resolveAccess(manifest, { accessMode: "private" as "public" }),
    TypeError,
    "access.mode",
  );
  assertThrows(
    () => resolveConfiguration(manifest, { maximumWorkers: 1 }),
    TypeError,
    "minimum_workers",
  );
  assertThrows(
    () => resolveConfiguration(manifest, { anonymousUser: "" }),
    TypeError,
    "anonymous_user",
  );
});

Deno.test("service declaration errors are rejected before desired configuration writes", () => {
  for (
    const source of [
      "schema = 1",
      "schema = 2\nunknown = true",
      "schema = 2\nentrypoint = 1",
      "schema = 2\n[lifecycle]\nservice_type = 'persistent'",
      "schema = 2\n[lifecycle]\ndefault_enabled = 'yes'",
      "schema = 2\n[scaling]\nminimum_workers = -1",
      "schema = 2\n[scaling]\nminimum_workers = 0.5",
      "schema = 2\n[scaling]\ntarget_utilization = 0",
      "schema = 2\n[placement]\nworkers_per_sandbox = 0",
      "schema = 2\n[execution]\nanonymous_user = 'unknown-user'",
      "schema = 2\n[access]\nmode = 'optional'",
      "schema = 2\n[access.unauthenticated]\naction = 'redirect'",
    ]
  ) assertThrows(() => declaration(source), TypeError);
  assertEquals(duration("1m2.5s", "keepalive"), 62_500_000_000);
  for (const input of ["", "0s", "-1s", "1minute", "1s trailing", "1e3s"]) {
    assertThrows(() => duration(input, "keepalive"), TypeError);
  }
});

Deno.test("zero session keepalive retains execution until explicit completion", () => {
  const manifest = declaration(
    'schema = 2\n[lifecycle]\nservice_type = "session"\nsession_keep_alive = "0s"',
  );
  assertEquals(resolveConfiguration(manifest).lifecycle.session_keep_alive, 0);
  assertEquals(
    resolveConfiguration(manifest, { sessionKeepAliveMs: 10 }).lifecycle
      .session_keep_alive,
    10_000_000,
  );
  assertEquals(
    resolveConfiguration(declaration("schema = 2"), { sessionKeepAliveMs: 0 })
      .lifecycle.session_keep_alive,
    0,
  );
  for (const time of ["", "-1s", "1ns"]) {
    assertThrows(
      () =>
        declaration(`schema = 2\n[lifecycle]\nsession_keep_alive = "${time}"`),
      TypeError,
    );
  }
  assertThrows(
    () => resolveConfiguration(manifest, { sessionKeepAliveMs: -1 }),
    TypeError,
  );
  assertThrows(
    () => declaration('schema = 2\n[scaling]\nworker_keep_alive = "0s"'),
    TypeError,
  );
});
