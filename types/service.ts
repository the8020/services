import { field, z } from "/p/the8020/db/fields.ts";

export const serviceId: z.ZodString = field(z.string(), {
  label: "Service",
  description:
    "Open a service to see its health, running capacity, and settings.",
  valueHelp: async ({ query, offset, limit }) => {
    const { default: Services } = await import("../tables/services.ts");
    const { sql } = await import("/p/the8020/db/mod.ts");
    const search = `%${query.trim().toLowerCase()}%`;
    const rows = await Services.select([
      Services.serviceId,
      Services.description,
      Services.enabled,
    ]).where(Services.active, "=", true).where((eb) =>
      eb.or([
        eb(sql<string>`lower(${sql.ref(Services.serviceId)})`, "like", search),
        eb(
          sql<string>`lower(${sql.ref(Services.description)})`,
          "like",
          search,
        ),
      ])
    ).orderBy(Services.serviceId).offset(offset).limit(limit + 1).execute();
    return {
      items: rows.slice(0, limit).map((row) => ({
        value: row.serviceId,
        label: row.serviceId,
        description: [row.description, row.enabled ? "" : "Disabled"].filter(
          Boolean,
        ).join(" · "),
      })),
      more: rows.length > limit,
    };
  },
  open: async (value) => {
    const { default: services } = await import(
      "/p/the8020/admin-core/programs/services/program.ts"
    );
    await services(value);
  },
});
