import { assertRejects } from "@std/assert";
import { authDatabase } from "/p/the8020/auth/src/test_support.ts";

Deno.test("service inspection requires view for the service ID", async () => {
  const fixture = await authDatabase();
  const { inspectService } = await import("./admin.ts");
  const users = await import("/p/the8020/users/src/admin.ts");
  try {
    await users.add("alice");
    fixture.asUser("alice");
    await assertRejects(
      () => inspectService("the8020/uui/shell"),
      Error,
      "Permission denied: the8020.services.service.view",
    );
  } finally {
    fixture.close();
  }
});
