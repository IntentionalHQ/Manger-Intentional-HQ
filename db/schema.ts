import { sql } from "drizzle-orm";
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").notNull(),
    ownerEmail: text("owner_email").notNull(),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["data", "social", "site"] }).notNull(),
    detail: text("detail").notNull(),
    mark: text("mark").notNull(),
    status: text("status", {
      enum: ["connected", "not_connected", "error"],
    })
      .notNull()
      .default("not_connected"),
    lastSyncedAt: text("last_synced_at"),
    lastError: text("last_error"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.ownerEmail, table.id] })],
);
