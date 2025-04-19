import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const desktopFiles = pgTable("desktop_files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  dataUrl: text("data_url").notNull(),
  position: jsonb("position").notNull().$type<{ x: number; y: number }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }),
});

// Define the relations
export const usersRelations = relations(users, ({ many }) => ({
  files: many(desktopFiles),
}));

export const desktopFilesRelations = relations(desktopFiles, ({ one }) => ({
  user: one(users, {
    fields: [desktopFiles.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertDesktopFileSchema = createInsertSchema(desktopFiles).pick({
  name: true,
  type: true,
  size: true,
  dataUrl: true,
  position: true,
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
};
