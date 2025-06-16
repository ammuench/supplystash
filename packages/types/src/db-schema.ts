import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { SUPPLY_ITEM_UPDATE_ACTION } from "./schemas/itemUpdateSchema";

export const inventoryTransactionAction = pgEnum(
  "inventory_transaction_type",
  SUPPLY_ITEM_UPDATE_ACTION
);

// Users Table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }),
  first_name: varchar("first_name", { length: 255 }),
  last_name: varchar("last_name", { length: 255 }),
  profile_image_url: text("profile_image_url"),
  settings: jsonb("settings"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Homes Table
export const homes = pgTable("homes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by_id: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

// UserHomes (Junction Table for Many-to-Many User-Home relationship)
export const user_homes = pgTable(
  "user_homes",
  {
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    home_id: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"),
    created_at: timestamp("created_at").defaultNow().notNull(),
    updated_at: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.user_id, t.home_id] })]
);

// Categories Table
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Items Table
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  home_id: uuid("home_id")
    .notNull()
    .references(() => homes.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  photo_url: text("photo_url"),
  purchase_link: text("purchase_link"),
  current_inventory: integer("current_inventory").notNull().default(0),
  warning_amount: integer("warning_amount").notNull().default(0),
  is_archived: boolean("is_archived").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  created_by_id: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  last_updated_by_id: uuid("last_updated_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
});

// ItemCategories (Junction Table for Many-to-Many Item-Category relationship)
export const item_categories = pgTable(
  "item_categories",
  {
    item_id: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    category_id: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.item_id, t.category_id] })]
);

// InventoryTransactions Table (Ledger for inventory changes)
export const inventory_transactions = pgTable("inventory_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  item_id: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  quantity_changed: integer("quantity_changed").notNull(),
  transaction_type: inventoryTransactionAction("transaction_type").notNull(),
  notes: text("notes"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Notifications Table
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  home_id: uuid("home_id").references(() => homes.id, { onDelete: "cascade" }),
  item_id: uuid("item_id").references(() => items.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  is_read: boolean("is_read").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Relations

export const users_relations = relations(users, ({ many }) => ({
  user_homes: many(user_homes),
  created_homes: many(homes),
  created_items: many(items, { relationName: "createdItems" }),
  last_updated_items: many(items, { relationName: "lastUpdatedItems" }),
  inventory_transactions: many(inventory_transactions),
  notifications: many(notifications),
}));

export const homes_relations = relations(homes, ({ one, many }) => ({
  created_by: one(users, {
    fields: [homes.created_by_id],
    references: [users.id],
  }),
  user_homes: many(user_homes),
  items: many(items),
  notifications: many(notifications),
}));

export const user_homes_relations = relations(user_homes, ({ one }) => ({
  user: one(users, {
    fields: [user_homes.user_id],
    references: [users.id],
  }),
  home: one(homes, {
    fields: [user_homes.home_id],
    references: [homes.id],
  }),
}));

export const categories_relations = relations(categories, ({ many }) => ({
  item_categories: many(item_categories),
}));

export const items_relations = relations(items, ({ one, many }) => ({
  home: one(homes, {
    fields: [items.home_id],
    references: [homes.id],
  }),
  created_by: one(users, {
    fields: [items.created_by_id],
    references: [users.id],
    relationName: "createdItems",
  }),
  last_updated_by: one(users, {
    fields: [items.last_updated_by_id],
    references: [users.id],
    relationName: "lastUpdatedItems",
  }),
  item_categories: many(item_categories),
  inventory_transactions: many(inventory_transactions),
  notifications: many(notifications),
}));

export const item_categories_relations = relations(
  item_categories,
  ({ one }) => ({
    item: one(items, {
      fields: [item_categories.item_id],
      references: [items.id],
    }),
    category: one(categories, {
      fields: [item_categories.category_id],
      references: [categories.id],
    }),
  })
);

export const inventory_transactions_relations = relations(
  inventory_transactions,
  ({ one }) => ({
    item: one(items, {
      fields: [inventory_transactions.item_id],
      references: [items.id],
    }),
    user: one(users, {
      fields: [inventory_transactions.user_id],
      references: [users.id],
    }),
  })
);

export const notifications_relations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
  home: one(homes, {
    fields: [notifications.home_id],
    references: [homes.id],
  }),
  item: one(items, {
    fields: [notifications.item_id],
    references: [items.id],
  }),
}));
