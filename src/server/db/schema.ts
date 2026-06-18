import { index, pgTableCreator, pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `nudgehq_${name}`);

export const posts = createTable(
  "post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    name: d.varchar({ length: 256 }),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [index("name_idx").on(t.name)]
);

export const corsairIntegrations = pgTable('corsair_integrations', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  name: text('name').notNull(),
  config: jsonb('config').notNull().default({}),
  dek: text('dek'),
});

export const corsairAccounts = pgTable('corsair_accounts', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  tenantId: text('tenant_id').notNull(),
  integrationId: text('integration_id').notNull().references(() => corsairIntegrations.id),
  config: jsonb('config').notNull().default({}),
  dek: text('dek'),
});

export const corsairEntities = pgTable('corsair_entities', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  accountId: text('account_id').notNull().references(() => corsairAccounts.id),
  entityId: text('entity_id').notNull(),
  entityType: text('entity_type').notNull(),
  version: text('version').notNull(),
  data: jsonb('data').notNull().default({}),
});

export const corsairEvents = pgTable('corsair_events', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  accountId: text('account_id').notNull().references(() => corsairAccounts.id),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull().default({}),
  status: text('status'),
});