import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Users Table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 255 }),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: text("profile_image_url"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Homes Table
export const homes = pgTable("homes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

// UserHomes (Junction Table for Many-to-Many User-Home relationship)
export const userHomes = pgTable(
  "user_homes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    homeId: uuid("home_id")
      .notNull()
      .references(() => homes.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 50 }).notNull().default("member"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.homeId] })]
);

// Categories Table
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Items Table
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  homeId: uuid("home_id")
    .notNull()
    .references(() => homes.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  photoUrl: text("photo_url"),
  purchaseLink: text("purchase_link"),
  currentInventory: integer("current_inventory").notNull().default(0),
  warningAmount: integer("warning_amount").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  lastUpdatedById: uuid("last_updated_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
});

// ItemCategories (Junction Table for Many-to-Many Item-Category relationship)
export const itemCategories = pgTable(
  "item_categories",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [
    // Define extra configuration (constraints) here as an array
    primaryKey({ columns: [t.itemId, t.categoryId] }),
  ]
);

// InventoryTransactions Table (Ledger for inventory changes)
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  quantityChanged: integer("quantity_changed").notNull(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notifications Table
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  homeId: uuid("home_id").references(() => homes.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  userHomes: many(userHomes),
  createdHomes: many(homes),
  createdItems: many(items, { relationName: "createdItems" }),
  lastUpdatedItems: many(items, { relationName: "lastUpdatedItems" }),
  inventoryTransactions: many(inventoryTransactions),
  notifications: many(notifications),
}));

export const homesRelations = relations(homes, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [homes.createdById],
    references: [users.id],
  }),
  userHomes: many(userHomes),
  items: many(items),
  notifications: many(notifications),
}));

export const userHomesRelations = relations(userHomes, ({ one }) => ({
  user: one(users, {
    fields: [userHomes.userId],
    references: [users.id],
  }),
  home: one(homes, {
    fields: [userHomes.homeId],
    references: [homes.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  itemCategories: many(itemCategories),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  home: one(homes, {
    fields: [items.homeId],
    references: [homes.id],
  }),
  createdBy: one(users, {
    fields: [items.createdById],
    references: [users.id],
    relationName: "createdItems",
  }),
  lastUpdatedBy: one(users, {
    fields: [items.lastUpdatedById],
    references: [users.id],
    relationName: "lastUpdatedItems",
  }),
  itemCategories: many(itemCategories),
  inventoryTransactions: many(inventoryTransactions),
  notifications: many(notifications),
}));

export const itemCategoriesRelations = relations(itemCategories, ({ one }) => ({
  item: one(items, {
    fields: [itemCategories.itemId],
    references: [items.id],
  }),
  category: one(categories, {
    fields: [itemCategories.categoryId],
    references: [categories.id],
  }),
}));

export const inventoryTransactionsRelations = relations(
  inventoryTransactions,
  ({ one }) => ({
    item: one(items, {
      fields: [inventoryTransactions.itemId],
      references: [items.id],
    }),
    user: one(users, {
      fields: [inventoryTransactions.userId],
      references: [users.id],
    }),
  })
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  home: one(homes, {
    fields: [notifications.homeId],
    references: [homes.id],
  }),
  item: one(items, {
    fields: [notifications.itemId],
    references: [items.id],
  }),
}));
