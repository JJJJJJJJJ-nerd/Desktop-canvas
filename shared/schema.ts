import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define desktop files table with a self-referencing foreign key
export type DesktopFilesTable = ReturnType<typeof pgTable>;

export const desktopFiles = pgTable("desktop_files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(), // File byte size
  dataUrl: text("data_url").notNull(),
  position: jsonb("position").notNull().$type<{ x: number; y: number }>(),
  dimensions: jsonb("dimensions").$type<{ width: number; height: number }>(), // UI dimensions
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
  parentId: integer("parent_id"), // Will be set after table creation
  isFolder: text("is_folder").default("false").notNull(),
});

// Define the relations
export const usersRelations = relations(users, ({ many }) => ({
  files: many(desktopFiles),
}));

export const desktopFilesRelations = relations(desktopFiles, ({ one, many }) => ({
  user: one(users, {
    fields: [desktopFiles.userId],
    references: [users.id],
  }),
  parent: one(desktopFiles, {
    fields: [desktopFiles.parentId],
    references: [desktopFiles.id],
    relationName: "childToParent",
  }),
  children: many(desktopFiles, { relationName: "childToParent" }),
}));

// Create insert schemas with zod
export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertDesktopFileSchema = createInsertSchema(desktopFiles).pick({
  name: true,
  type: true,
  size: true,
  dataUrl: true,
  position: true,
  dimensions: true,
  userId: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertDesktopFile = z.infer<typeof insertDesktopFileSchema>;
export type DesktopFileDB = typeof desktopFiles.$inferSelect;

// The type used in the frontend
export type DesktopFile = {
  id?: number;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  position: {
    x: number;
    y: number;
  };
  dimensions?: {
    width: number;
    height: number;
  };
};
